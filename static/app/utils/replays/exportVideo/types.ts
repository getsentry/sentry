export type ExportPhase = 'idle' | 'capturing' | 'encoding' | 'done' | 'error';

export interface ExportProgress {
  /**
   * Current phase of the export pipeline
   */
  phase: ExportPhase;
  /**
   * Current step within the phase (1-indexed)
   */
  current?: number;
  /**
   * Error message if phase is 'error'
   */
  errorMessage?: string;
  /**
   * Total steps within the phase
   */
  total?: number;
}

export interface CaptureFramesArgs {
  /**
   * Duration of the replay in milliseconds
   */
  durationMs: number;
  /**
   * The rrweb recording events
   */
  rrwebEvents: unknown[];
  /**
   * Start timestamp of the replay in epoch ms
   */
  startTimestampMs: number;
  /**
   * Target frames per second (default: 4)
   */
  fps?: number;
  /**
   * Callback for progress updates
   */
  onProgress?: (progress: ExportProgress) => void;
  /**
   * AbortSignal for cancellation support
   */
  signal?: AbortSignal;
}

export interface EncodeVideoArgs {
  /**
   * Target frames per second - must match what was used during capture
   */
  fps: number;
  /**
   * Captured frame blobs (JPEG images)
   */
  frames: Blob[];
  /**
   * Video height in pixels
   */
  height: number;
  /**
   * Video width in pixels
   */
  width: number;
  /**
   * Callback for progress updates
   */
  onProgress?: (progress: ExportProgress) => void;
  /**
   * AbortSignal for cancellation support
   */
  signal?: AbortSignal;
}

export interface ExportReplayAsVideoArgs {
  /**
   * Duration of the replay in milliseconds
   */
  durationMs: number;
  /**
   * Video height in pixels
   */
  height: number;
  /**
   * Replay ID for the output filename
   */
  replayId: string;
  /**
   * The rrweb recording events
   */
  rrwebEvents: unknown[];
  /**
   * Start timestamp of the replay in epoch ms
   */
  startTimestampMs: number;
  /**
   * Video width in pixels
   */
  width: number;
  /**
   * Target frames per second (default: 4)
   */
  fps?: number;
  /**
   * Callback for progress updates
   */
  onProgress?: (progress: ExportProgress) => void;
  /**
   * AbortSignal for cancellation support
   */
  signal?: AbortSignal;
}
