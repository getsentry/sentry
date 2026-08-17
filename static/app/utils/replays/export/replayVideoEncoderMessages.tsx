/**
 * Message contract between `useExportReplayVideo` (main thread) and
 * `replayVideoEncoder.worker` (worker thread).
 */

export interface EncoderInitMessage {
  fps: number;
  handle: FileSystemFileHandle;
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

export interface EncoderErrorMessage {
  message: string;
  type: 'error';
}

export type EncoderOutboundMessage =
  | EncoderCapturingMessage
  | EncoderEncodingMessage
  | EncoderDoneMessage
  | EncoderErrorMessage;
