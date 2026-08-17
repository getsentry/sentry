import {FileSystemWritableFileStreamTarget, Muxer} from 'mp4-muxer';

import type {
  EncoderInboundMessage,
  EncoderOutboundMessage,
} from 'sentry/utils/replays/export/replayVideoEncoderMessages';

/**
 * Encodes captured replay frames into an MP4 and streams the muxed bytes
 * straight to a file on disk, instead of buffering the whole video in the
 * tab's memory.
 *
 * This is the ffmpeg.wasm alternative: WebCodecs' `VideoEncoder` is a native,
 * hardware-accelerated browser API (no multi-MB wasm download), and
 * `mp4-muxer`'s `FileSystemWritableFileStreamTarget` writes each muxed chunk
 * to the `FileSystemWritableFileStream` as soon as it's ready. `fastStart:
 * 'fragmented'` is required here — a regular MP4 needs to seek back to the
 * start of the file to write its metadata once the total duration is known,
 * which an append-only disk stream can't do.
 */

let muxer: Muxer<FileSystemWritableFileStreamTarget> | null = null;
let encoder: VideoEncoder | null = null;
let writable: FileSystemWritableFileStream | null = null;
let framesEncoded = 0;

const KEYFRAME_INTERVAL = 150; // ~5s at 30fps

function postOutbound(message: EncoderOutboundMessage) {
  self.postMessage(message);
}

async function handleInit(
  width: number,
  height: number,
  fps: number,
  handle: FileSystemFileHandle
) {
  writable = await handle.createWritable();

  muxer = new Muxer({
    target: new FileSystemWritableFileStreamTarget(writable),
    video: {codec: 'avc', width, height, frameRate: fps},
    fastStart: 'fragmented',
    // VideoFrame timestamps from MediaStreamTrackProcessor are relative to
    // an arbitrary clock, not to the start of capture. Offset them so the
    // output file's first frame is presented at t=0.
    firstTimestampBehavior: 'offset',
  });

  encoder = new VideoEncoder({
    output: (chunk, meta) => muxer?.addVideoChunk(chunk, meta),
    error: error => postOutbound({type: 'error', message: error.message}),
  });

  encoder.configure({
    codec: 'avc1.640034', // H.264 High profile, level 5.2
    width,
    height,
    bitrate: 8_000_000,
    framerate: fps,
  });
}

function handleFrame(frame: VideoFrame) {
  if (!encoder) {
    frame.close();
    return;
  }

  encoder.encode(frame, {keyFrame: framesEncoded % KEYFRAME_INTERVAL === 0});
  frame.close();
  framesEncoded += 1;
  postOutbound({type: 'progress', framesEncoded});
}

async function handleStop() {
  try {
    await encoder?.flush();
    muxer?.finalize();
    await writable?.close();
    postOutbound({type: 'done'});
  } catch (error) {
    postOutbound({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to finalize video export',
    });
  } finally {
    encoder?.close();
    encoder = null;
    muxer = null;
    writable = null;
    framesEncoded = 0;
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
