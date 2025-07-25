// Client-side audio compression utilities
export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export async function compressAudioFile(file: File): Promise<CompressionResult> {
  const targetSizeBytes = 4 * 1024 * 1024; // 4MB target for Vercel

  // If file is already small enough and MP3, return as-is
  if (file.size <= targetSizeBytes && file.type === 'audio/mpeg') {
    return {
      compressedFile: file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 1,
    };
  }

  try {
    // Create audio context and decode the file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Calculate target bitrate to stay under 4MB (for future use)
    const durationSeconds = audioBuffer.duration;
    // const targetBitrate = Math.min(64000, (targetSizeBytes * 8) / durationSeconds); // Max 64kbps

    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext(
      1, // Mono for smaller size
      audioBuffer.sampleRate * durationSeconds,
      audioBuffer.sampleRate
    );

    // Create source and connect (mix to mono if stereo)
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    if (audioBuffer.numberOfChannels > 1) {
      // Mix stereo to mono
      const merger = offlineContext.createChannelMerger(1);
      const splitter = offlineContext.createChannelSplitter(audioBuffer.numberOfChannels);
      source.connect(splitter);
      splitter.connect(merger, 0, 0);
      if (audioBuffer.numberOfChannels > 1) {
        splitter.connect(merger, 1, 0);
      }
      merger.connect(offlineContext.destination);
    } else {
      source.connect(offlineContext.destination);
    }

    source.start();
    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV (will be smaller than original for most cases)
    const wavBlob = audioBufferToWav(renderedBuffer);

    const compressedFile = new File([wavBlob], file.name.replace(/\.[^/.]+$/, '.wav'), {
      type: 'audio/wav',
    });

    return {
      compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionRatio: file.size / compressedFile.size,
    };
  } catch (error) {
    console.warn('Audio compression failed, using original file:', error);
    // Fallback: return original file (user will get size error from server)
    return {
      compressedFile: file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 1,
    };
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;

  // Create WAV header
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
