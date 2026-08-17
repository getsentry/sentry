import {FFmpeg} from '@ffmpeg/ffmpeg';
import {toBlobURL} from '@ffmpeg/util';

import type {
  EncoderInboundMessage,
  EncoderOutboundMessage,
} from 'sentry/utils/replays/export/replayVideoEncoderMessages';

/**
 * Encodes captured replay frames into an MP4 using ffmpeg compiled to
 * WebAssembly, entirely client-side, and writes the result to a file on
 * disk once ffmpeg has finished muxing it.
 *
 * ffmpeg.wasm's virtual filesystem (MEMFS) only exists in memory, so unlike
 * the WebCodecs + mp4-muxer pipeline this replaced, frames accumulate in the
 * wasm heap for the whole capture, and the finished MP4 is fully
 * materialized in memory before it's written to disk in one shot. This is
 * the tradeoff for using ffmpeg's decoder/encoder pipeline (broad codec and
 * container support, familiar CLI flags) instead of the browser's native
 * WebCodecs API.
 *
 * `@ffmpeg/core`'s ~30MB of wasm+glue is loaded from a CDN at runtime rather
 * than bundled, per the library's own recommended usage (bundling
 * `ffmpeg-core.js` through webpack/rspack's normal JS pipeline breaks its
 * internal wasm-loading paths). That means this feature requires outbound
 * access to unpkg.com; a strict CSP or an air-gapped/self-hosted deployment
 * without internet access will cause `load()` to fail, surfaced below as an
 * `error` message.
 */

const FFMPEG_CORE_VERSION = '0.12.10'; // Keep in sync with the installed @ffmpeg/core version.
const FFMPEG_CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

const FRAME_FILENAME_DIGITS = 6;

let ffmpeg: FFmpeg | null = null;
let canvas: OffscreenCanvas | null = null;
let canvasCtx: OffscreenCanvasRenderingContext2D | null = null;
let handle: FileSystemFileHandle | null = null;
let fps = 30;
let frameCount = 0;
// Serializes frame writes so `frameNNNNNN.png` files land in capture order
// even though `self.onmessage` handlers can interleave while awaiting I/O.
let writeChain = Promise.resolve();

function postOutbound(message: EncoderOutboundMessage) {
  self.postMessage(message);
}

function frameFilename(index: number) {
  return `frame${String(index).padStart(FRAME_FILENAME_DIGITS, '0')}.png`;
}

async function handleInit(
  width: number,
  height: number,
  frameRate: number,
  fileHandle: FileSystemFileHandle
) {
  handle = fileHandle;
  fps = frameRate;
  canvas = new OffscreenCanvas(width, height);
  canvasCtx = canvas.getContext('2d');

  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({progress}) => {
    postOutbound({type: 'encoding', ratio: Math.max(0, Math.min(1, progress))});
  });
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(
      `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
      'application/wasm'
    ),
  });
}

function handleFrame(frame: VideoFrame) {
  const index = frameCount;
  frameCount += 1;

  writeChain = writeChain
    .then(async () => {
      if (!ffmpeg || !canvas || !canvasCtx) {
        return;
      }
      canvasCtx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({type: 'image/png'});
      const data = new Uint8Array(await blob.arrayBuffer());
      await ffmpeg.writeFile(frameFilename(index), data);
      postOutbound({type: 'capturing', framesWritten: index + 1});
    })
    .catch(error => {
      postOutbound({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to capture a replay frame',
      });
    });

  frame.close();
}

async function handleStop() {
  await writeChain;

  try {
    if (!ffmpeg || !handle) {
      throw new Error('Video export was stopped before it started');
    }

    await ffmpeg.exec([
      '-framerate',
      String(fps),
      '-start_number',
      '0',
      '-i',
      `frame%0${FRAME_FILENAME_DIGITS}d.png`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      'out.mp4',
    ]);

    const data = await ffmpeg.readFile('out.mp4');
    const raw = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    // Copied into a freshly allocated buffer: ffmpeg.wasm's Uint8Array is
    // typed against ArrayBufferLike (it could in principle back onto a
    // SharedArrayBuffer), which FileSystemWritableFileStream.write() doesn't
    // accept.
    const bytes = new Uint8Array(raw.length);
    bytes.set(raw);

    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();

    postOutbound({type: 'done'});
  } catch (error) {
    postOutbound({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to finalize video export',
    });
  } finally {
    ffmpeg?.terminate();
    ffmpeg = null;
    canvas = null;
    canvasCtx = null;
    handle = null;
    frameCount = 0;
    writeChain = Promise.resolve();
  }
}

self.onmessage = async (event: MessageEvent<EncoderInboundMessage>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'init':
        await handleInit(message.width, message.height, message.fps, message.handle);
        break;
      case 'frame':
        handleFrame(message.frame);
        break;
      case 'stop':
        await handleStop();
        break;
      default:
        break;
    }
  } catch (error) {
    postOutbound({
      type: 'error',
      message: error instanceof Error ? error.message : 'Replay video export failed',
    });
  }
};
