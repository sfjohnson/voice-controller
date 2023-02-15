# voice-controller

UI experiment to control lighting precisely with voice.

## Development setup

1. Make sure you are running Node 18.
2. Run

```
npm ci
```

3. Make a `.env` in the root directory containing this:

```
ELECTRON_ENV=development
```

4. In `addon/src/main.cpp` change `INPUT_DEVICE` to the name of your microphone. A list of found devices is logged to terminal when the app is started.
5. In `src/app/app.svelte` set `VOICE_TRAINING_MODE` to `true`.
6. In `src/app/lights/lights.ts` change `email` and `password` to your TP-LINK account if you are controlling Tapo lights.
7. Run

```
npm start
```

8. Click `Start` and follow the instructions to train the voice algorithm. The training data will be stored in the user's directory (`~/Library/Application Support/voice-controller` on macOS) and will be read when the app is started with `VOICE_TRAINING_MODE` set to `false`.
9. Change the audio gate settings in `addon/src/main.cpp` if necessary to make sure each word is being picked up correctly.

## Production setup

1. In `src/app/app.svelte` set `VOICE_TRAINING_MODE` to `false`.
2. Run

```
npm run make
```

3. The build will be in the `out/` directory.

## Live demo

[![Voice Controller live demo video](https://img.youtube.com/vi/CiT4eCt-CCw/0.jpg)](https://www.youtube.com/watch?v=CiT4eCt-CCw)

## Voice recognition

Uses https://github.com/shawkatq/voice-commands-demo with the part that splits the audio stream up into individual commands re-written in C++.

## Lighting control

Uses https://github.com/dickydoouk/tp-link-tapo-connect with 2 x Tapo L530E bulbs.
