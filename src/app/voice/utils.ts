// Adapted from https://github.com/shawkatq/voice-commands-demo

export class Utils {
    static getTimestamp() {
        var timeStampInMs = window.performance.now() + window.performance.timing.navigationStart
        return timeStampInMs
    }

    /******************************************************************************
    * blob and buffer works
    ******************************************************************************/
    static writeUTFBytes(view: DataView, offset: number, string: string) {
        var lng = string.length;
        for (var i = 0; i < lng; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    static bufferToBlob (internalLeftChannel: Float32Array) {
        var numChannels = 1, sampleRate = 48000;
        // we create our wav file
        var buffer = new ArrayBuffer(44 + internalLeftChannel.length * 2);
        var view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeUTFBytes(view, 0, 'RIFF');

        // -8 (via #97)
        view.setUint32(4, 44 + internalLeftChannel.length * 2 - 8, true);

        this.writeUTFBytes(view, 8, 'WAVE');
        // FMT sub-chunk
        this.writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        // stereo (2 channels)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true); // numChannels * 2 (via #71)
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        // data sub-chunk
        this.writeUTFBytes(view, 36, 'data');
        view.setUint32(40, internalLeftChannel.length * 2, true);

        // write the PCM samples
        var lng = internalLeftChannel.length;
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++) {
            view.setInt16(index, internalLeftChannel[i] * (0x7FFF * volume), true);
            index += 2;
        }

        // our final binary blob
        var blob = new Blob([view], {
            type: 'audio/wav'
        });

        return blob;
    }

    /******************************************************************************
    * for debugging, use the following method to get voice file
    ******************************************************************************/

    static getVoiceFile (blob: Blob) {
        if (!blob)
            return;

        var a = document.createElement('a');
        a.target = '_blank';
        a.innerHTML = 'Open Recorded Audio';
        a.href = URL.createObjectURL(blob);
        document.querySelector('#audios-container')!.appendChild(a)
    };

}
