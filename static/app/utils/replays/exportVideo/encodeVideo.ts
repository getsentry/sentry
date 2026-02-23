import {FFmpegClient} from './ffmpegClient';
import type {EncodeVideoArgs} from './types';

/**
 * Takes an array of JPEG frame blobs and encodes them into an MP4 video
 * using ffmpeg.wasm (single-threaded build — no SharedArrayBuffer required).
 *
 * Uses our own `FFmpegClient` wrapper instead of the `@ffmpeg/ffmpeg` npm
 * package to avoid webpack bundling issues with Web Workers.
 *
 * The ffmpeg-core WASM binary (~30MB) is loaded lazily from CDN the first
 * time this function is called.
 */
export async function encodeFramesToMp4({
  frames,
  fps,
  width,
  height,
  onProgress,
  signal,
}: EncodeVideoArgs): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  const ffmpeg = new FFmpegClient();

  // Log ffmpeg output to the console for debugging
  ffmpeg.onLog(({message}) => {
    // eslint-disable-next-line no-console
    console.debug('[ffmpeg]', message);
  });

  try {
    await ffmpeg.load();
  } catch (err) {
    throw new Error(
      `Failed to load ffmpeg.wasm: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (signal?.aborted) {
    ffmpeg.terminate();
    throw new DOMException('Export cancelled', 'AbortError');
  }

  try {
    // Write each frame to ffmpeg's virtual filesystem
    for (let i = 0; i < frames.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      const blob = frames[i]!;
      const data = new Uint8Array(await blob.arrayBuffer());
      const filename = `frame_${String(i).padStart(5, '0')}.jpg`;
      await ffmpeg.writeFile(filename, data);

      onProgress?.({
        phase: 'encoding',
        current: i + 1,
        total: frames.length + 1, // +1 for the final encode step
      });
    }

    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    // H.264 requires even dimensions
    const evenWidth = width - (width % 2);
    const evenHeight = height - (height % 2);

    // Encode the frames into an MP4 video
    const exitCode = await ffmpeg.exec([
      '-framerate',
      String(fps),
      '-i',
      'frame_%05d.jpg',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'fast',
      '-vf',
      `scale=${evenWidth}:${evenHeight}`,
      'output.mp4',
    ]);

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}. Check console for details.`);
    }

    onProgress?.({
      phase: 'encoding',
      current: frames.length + 1,
      total: frames.length + 1,
    });

    // Read the output file
    const outputData = await ffmpeg.readFile('output.mp4');
    return new Blob([outputData as BlobPart], {type: 'video/mp4'});
  } finally {
    ffmpeg.terminate();
  }
}
