import type {RecordingFrame} from 'sentry/utils/replays/types';

import {captureReplayFrames} from './captureFrames';
import {encodeFramesToMp4} from './encodeVideo';
import type {ExportProgress, ExportReplayAsVideoArgs} from './types';

export type {ExportPhase, ExportProgress} from './types';

/**
 * Full pipeline: capture frames from a replay → encode to MP4 → trigger download.
 *
 * Designed to run entirely in the browser with no backend involvement.
 *
 * Usage:
 * ```ts
 * const replay = useReplayReader();
 * await exportReplayAsVideo({
 *   rrwebEvents: replay.getRRWebFrames(),
 *   startTimestampMs: replay.getStartTimestampMs(),
 *   durationMs: replay.getDurationMs(),
 *   replayId: replay.getReplay().id,
 *   width: dimensions.width,
 *   height: dimensions.height,
 *   fps: 1,
 *   onProgress: setProgress,
 *   signal: abortController.signal,
 * });
 * ```
 */
export async function exportReplayAsVideo({
  rrwebEvents,
  startTimestampMs,
  durationMs,
  replayId,
  width,
  height,
  fps = 4,
  onProgress,
  signal,
}: ExportReplayAsVideoArgs): Promise<void> {
  // Phase 1: Capture frames
  onProgress?.({phase: 'capturing', current: 0, total: 0});

  const captureResult = await captureReplayFrames({
    rrwebEvents: rrwebEvents as RecordingFrame[],
    startTimestampMs,
    durationMs,
    fps,
    onProgress,
    signal,
  });

  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  // Use detected dimensions from the replay iframe, falling back to provided values
  const videoWidth = captureResult.width || width;
  const videoHeight = captureResult.height || height;

  // Phase 2: Encode to MP4
  const mp4Blob = await encodeFramesToMp4({
    frames: captureResult.frames,
    fps,
    width: videoWidth,
    height: videoHeight,
    onProgress,
    signal,
  });

  if (signal?.aborted) {
    throw new DOMException('Export cancelled', 'AbortError');
  }

  // Phase 3: Trigger download
  onProgress?.({phase: 'done'});
  triggerDownload(mp4Blob, `replay-${replayId}.mp4`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Returns a human-readable progress message for the current export state.
 */
export function getProgressMessage(progress: ExportProgress): string {
  switch (progress.phase) {
    case 'idle':
      return '';
    case 'capturing':
      if (progress.total && progress.current) {
        return `Capturing frame ${progress.current} of ${progress.total}…`;
      }
      return 'Preparing to capture frames…';
    case 'encoding':
      if (progress.total && progress.current) {
        if (progress.current >= progress.total) {
          return 'Encoding video…';
        }
        return `Writing frame ${progress.current} of ${progress.total - 1}…`;
      }
      return 'Encoding video…';
    case 'done':
      return 'Export complete!';
    case 'error':
      return progress.errorMessage ?? 'Export failed.';
    default:
      return '';
  }
}

/**
 * Returns a 0–100 percentage for the current export progress across both phases.
 */
export function getProgressPercent(progress: ExportProgress): number {
  if (progress.phase === 'done') {
    return 100;
  }
  if (progress.phase === 'idle' || progress.phase === 'error') {
    return 0;
  }

  const current = progress.current ?? 0;
  const total = progress.total ?? 1;
  const phasePercent = total > 0 ? (current / total) * 100 : 0;

  if (progress.phase === 'capturing') {
    // Capture is 0–60% of total progress
    return Math.min(phasePercent * 0.6, 60);
  }

  if (progress.phase === 'encoding') {
    // Encoding is 60–100% of total progress
    return 60 + Math.min(phasePercent * 0.4, 40);
  }

  return 0;
}
