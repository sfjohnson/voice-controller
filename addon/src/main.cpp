#include <napi.h>
#include <cmath>
#include <atomic>
#include "portaudio/portaudio.h"
#include "ck/ck_ring.h"

#define INPUT_DEVICE "MacBook Air Microphone"
#define SAMPLE_RATE 48000
#define INPUT_CHANNEL_NUMBER 0
#define ENVELOPE_ATTACK 0.08f
#define ENVELOPE_RELEASE 0.0017f
// CAPTURE_STOP_THRESHOLD must be lower than CAPTURE_START_THRESHOLD
#define CAPTURE_START_THRESHOLD 0.07f
#define CAPTURE_STOP_THRESHOLD 0.03f
#define MAX_CAPTURE_LENGTH 1000 // ms
#define LOOKAHEAD_LENGTH 100 // ms, the time between the capture starting and the envelope reaching the threshold

#define UNUSED __attribute__((unused))

using namespace Napi;

static bool audioRunning = false;
static int deviceChannelCount = 0;
static unsigned int captureFrameLength = 0;
static unsigned int lookaheadRingLength = 0;
static std::atomic<float> envelopeVal = 0.0f;
static std::atomic_bool capturing = false;
// lookaheadRing is used only by the audio thread to delay the audio and catch the start of the capture
static ck_ring_t lookaheadRing;
static ck_ring_buffer_t *lookaheadRingBuf;
// captureRing is used to send completed captures from the audio thread to the main thread
static ck_ring_t captureRing;
static ck_ring_buffer_t *captureRingBuf;
// captureFrameBuf is used by pollForAudioCapture as a temporary buffer to put the samples pulled from captureRing
static float *captureFrameBuf = nullptr;

// NOTE: this function is undefined for x = 0 or x = 1
static int roundUpPowerOfTwo (unsigned int x) {
  return 1 << (1 + __builtin_clz(1) - __builtin_clz(x-1));
}

static int recordCallback (const void *inputBuffer, UNUSED void *outputBuffer, unsigned long framesPerBuffer, UNUSED const PaStreamCallbackTimeInfo* timeInfo, UNUSED PaStreamCallbackFlags statusFlags, UNUSED void *userData) {
  static const float envelopeAttackSamples = 0.000001f * (float)SAMPLE_RATE * ENVELOPE_ATTACK;
  static const float envelopeReleaseSamples = 0.000001f * (float)SAMPLE_RATE * ENVELOPE_RELEASE;
  static int captureWrittenLength = -1; // captureWrittenLength == -1 means we are not writing at the moment

  const float *samples = (float*)inputBuffer;
  for (unsigned long sampleIndex = 0; sampleIndex < framesPerBuffer; sampleIndex++) {
    intptr_t ringVal = 0;
    float sample = samples[deviceChannelCount*sampleIndex + INPUT_CHANNEL_NUMBER];
    // There are no arithmetic operations on atomic floats so operations need to be done on a local copy.
    float envelopeValLocal = envelopeVal;
    float envelopeDiff = fabsf(sample) - envelopeValLocal;

    if (envelopeDiff > 0.0f) {
      envelopeValLocal += envelopeAttackSamples * envelopeDiff;
    } else {
      envelopeValLocal += envelopeReleaseSamples * envelopeDiff;
    }

    envelopeVal = envelopeValLocal;

    // https://gist.github.com/shafik/848ae25ee209f698763cffee272a58f8#how-do-we-type-pun-correctly
    memcpy(&ringVal, &sample, 4);
    ck_ring_enqueue_spsc(&lookaheadRing, lookaheadRingBuf, (void*)ringVal);

    if (ck_ring_size(&lookaheadRing) < lookaheadRingLength) {
      // wait for lookaheadRing to fill, then keep it full
      continue;
    }

    ck_ring_dequeue_spsc(&lookaheadRing, lookaheadRingBuf, &ringVal);

    unsigned int captureRingSize = ck_ring_size(&captureRing);
    if (!capturing && envelopeValLocal >= CAPTURE_START_THRESHOLD) {
      // start capture
      capturing = true;
      if (captureRingSize <= captureFrameLength) {
        // Write all of lookaheadRing to captureRing without emptying lookaheadRing
        ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
        for (unsigned int i = 0; i < lookaheadRingLength - 1; i++) {
          ck_ring_dequeue_spsc(&lookaheadRing, lookaheadRingBuf, &ringVal);
          ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
          ck_ring_enqueue_spsc(&lookaheadRing, lookaheadRingBuf, (void*)ringVal);
        }
        captureWrittenLength = lookaheadRingLength;
      }
    } else if (capturing && envelopeValLocal <= CAPTURE_STOP_THRESHOLD) {
      // end capture, fill remaining space with zeros
      ringVal = 0;
      for (int i = captureWrittenLength; i < (int)(captureFrameLength - 1); i++) {
        ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
      }
      // write length
      memcpy(&ringVal, &captureWrittenLength, 4);
      ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
      capturing = false;
      captureWrittenLength = -1;
    } else if (capturing && captureWrittenLength > 0) {
      // during capture
      memcpy(&ringVal, &sample, 4);
      ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
      if (++captureWrittenLength == (int)(captureFrameLength - 1)) {
        // overflow, mark as zero length and end capture
        ringVal = 0;
        ck_ring_enqueue_spsc(&captureRing, captureRingBuf, (void*)ringVal);
        capturing = false;
        captureWrittenLength = -1;
      }
    }
  }

  return paContinue;
}

Value initAudio (const CallbackInfo& info) {
  Env env = info.Env();

  if (audioRunning) return Number::New(env, -1);

  PaError pErr = Pa_Initialize();
  if (pErr != paNoError) {
    printf("Pa_Initialize error: %d\n", pErr);
    return Number::New(env, -2);
  }

  int deviceCount = Pa_GetDeviceCount();
  if (deviceCount <= 0) {
    printf("Pa_GetDeviceCount error: %d\n", deviceCount);
    return Number::New(env, -3);
  }

  printf("\nAvailable input devices:\n");
  int chosenDeviceIndex = -1;
  const PaDeviceInfo *chosenDeviceInfo = NULL;

  for (int deviceIndex = 0; deviceIndex < deviceCount; deviceIndex++) {
    const PaDeviceInfo *deviceInfo = Pa_GetDeviceInfo(deviceIndex);
    printf(" - %s\n", deviceInfo->name);
    if (strcmp(deviceInfo->name, INPUT_DEVICE) == 0) {
      chosenDeviceInfo = deviceInfo;
      chosenDeviceIndex = deviceIndex;
    }
  }
  printf("\n");

  if (chosenDeviceIndex == -1) {
    printf("Input device not found!\n");
    return Number::New(env, -4);
  }

  deviceChannelCount = chosenDeviceInfo->maxInputChannels;
  printf("Input device: %s\n", chosenDeviceInfo->name);
  printf("Device channels: %d\n", deviceChannelCount); 

  PaStream *stream;
  PaStreamParameters params;
  params.device = chosenDeviceIndex;
  params.channelCount = deviceChannelCount;
  params.sampleFormat = paFloat32;
  params.suggestedLatency = chosenDeviceInfo->defaultLowInputLatency;
  params.hostApiSpecificStreamInfo = NULL;
  pErr = Pa_OpenStream(&stream, &params, NULL, SAMPLE_RATE, 0, 0, recordCallback, NULL);
  if (pErr != paNoError) {
    printf("Pa_OpenStream error: %d\n", pErr);
    return Number::New(env, -5);
  }

  const PaStreamInfo *streamInfo = Pa_GetStreamInfo(stream);
  if (streamInfo->sampleRate != SAMPLE_RATE) {
    printf("Expected sample rate %d but got %f, please adjust SAMPLE_RATE.\n", SAMPLE_RATE, streamInfo->sampleRate);
    return Number::New(env, -6);
  }

  // Make captureRing large enough for 2 * (capture data + capture length)
  captureFrameLength = 1 + MAX_CAPTURE_LENGTH * SAMPLE_RATE / 1000;
  lookaheadRingLength = LOOKAHEAD_LENGTH * SAMPLE_RATE / 1000;
  int captureRingMemLength = roundUpPowerOfTwo(2 * captureFrameLength);
  int lookaheadRingMemLength = roundUpPowerOfTwo(lookaheadRingLength);

  captureRingBuf = new(std::nothrow) ck_ring_buffer_t[captureRingMemLength] {};
  if (captureRingBuf == nullptr) return Number::New(env, -7);
  ck_ring_init(&captureRing, captureRingMemLength);

  lookaheadRingBuf = new(std::nothrow) ck_ring_buffer_t[lookaheadRingMemLength] {};
  if (lookaheadRingBuf == nullptr) return Number::New(env, -8);
  ck_ring_init(&lookaheadRing, lookaheadRingMemLength);

  captureFrameBuf = new(std::nothrow) float[captureFrameLength - 1] {};
  if (captureFrameBuf == nullptr) return Number::New(env, -9);

  pErr = Pa_StartStream(stream);
  if (pErr != paNoError) {
    printf("Pa_StartStream error: %d\n", pErr);
    return Number::New(env, -10);
  }

  audioRunning = true;
  return Number::New(env, 0);
}

Value getAudioState (const CallbackInfo& info) {
  Env env = info.Env();

  if (!audioRunning || info.Length() < 1 || !info[0].IsObject()) {
    return env.Null();
  }

  Object arg = info[0].As<Object>();
  arg.Set("envelopeVal", envelopeVal.load());
  arg.Set("capturing", capturing.load());
  return arg;
}

Value pollForAudioCapture (const CallbackInfo& info) {
  Env env = info.Env();

  if (!audioRunning || ck_ring_size(&captureRing) < captureFrameLength) {
    return env.Null();
  }

  intptr_t ringVal = 0;
  for (unsigned int i = 0; i < captureFrameLength - 1; i++) {
    ck_ring_dequeue_spsc(&captureRing, captureRingBuf, &ringVal);
    memcpy(&captureFrameBuf[i], &ringVal, 4);
  }

  unsigned int captureLength = 0;
  ck_ring_dequeue_spsc(&captureRing, captureRingBuf, &ringVal);
  memcpy(&captureLength, &ringVal, 4);

  if (captureLength == 0) return env.Null();

  if (captureLength >= captureFrameLength) {
    printf("WARNING: invalid capture frame detected!\n");
    return env.Null();
  }

  Float32Array arr = Float32Array::New(env, captureLength);
  for (unsigned int i = 0; i < captureLength; i++) {
    arr[i] = captureFrameBuf[i];
  }
  return arr;
}

Object Init (Env env, Object exports) {
  exports.Set(String::New(env, "initAudio"), Function::New(env, initAudio));
  exports.Set(String::New(env, "getAudioState"), Function::New(env, getAudioState));
  exports.Set(String::New(env, "pollForAudioCapture"), Function::New(env, pollForAudioCapture));
  return exports;
}

NODE_API_MODULE(addon, Init)
