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

export interface EncoderProgressMessage {
  framesEncoded: number;
  type: 'progress';
}

export interface EncoderDoneMessage {
  type: 'done';
}

export interface EncoderErrorMessage {
  message: string;
  type: 'error';
}

export type EncoderOutboundMessage =
  | EncoderProgressMessage
  | EncoderDoneMessage
  | EncoderErrorMessage;
