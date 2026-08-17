/**
 * Message contract between `useExportReplayVideo` (main thread) and
 * `replayVideoEncoder.worker` (worker thread).
 */

export interface EncoderInitMessage {
  filename: string;
  fps: number;
  /**
   * Null when the browser doesn't support (or user-facing prompt for)
   * `showSaveFilePicker` (e.g. Brave, which disables the File System Access
   * API outright) — the worker then falls back to sending the finished
   * video back as an `EncoderDownloadMessage` instead of writing to disk
   * itself.
   */
  handle: FileSystemFileHandle | null;
  height: number;
  type: 'init';
  width: number;
}

export interface EncoderFrameMessage {
  frame: VideoFrame;
  type: 'frame';
}

export interface EncoderStopMessage {
  type: 'stop';
}

export type EncoderInboundMessage =
  | EncoderInitMessage
  | EncoderFrameMessage
  | EncoderStopMessage;

/** ffmpeg-core has finished loading; the caller may now start sending frames. */
export interface EncoderReadyMessage {
  type: 'ready';
}

export interface EncoderCapturingMessage {
  framesWritten: number;
  type: 'capturing';
}

/** Progress of the final ffmpeg encode/mux pass, reported by ffmpeg itself. */
export interface EncoderEncodingMessage {
  ratio: number;
  type: 'encoding';
}

export interface EncoderDoneMessage {
  type: 'done';
}

/**
 * Sent instead of `EncoderDoneMessage` when there's no `FileSystemFileHandle`
 * to write to — the finished video's bytes are transferred back to the main
 * thread to trigger a normal `<a download>` browser download.
 */
export interface EncoderDownloadMessage {
  // Always a freshly allocated (non-shared) buffer — see where this is
  // constructed in the worker.
  bytes: Uint8Array<ArrayBuffer>;
  filename: string;
  type: 'download';
}

export interface EncoderErrorMessage {
  message: string;
  type: 'error';
}

export type EncoderOutboundMessage =
  | EncoderReadyMessage
  | EncoderCapturingMessage
  | EncoderEncodingMessage
  | EncoderDoneMessage
  | EncoderDownloadMessage
  | EncoderErrorMessage;
