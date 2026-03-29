type SeekBuffer = {
  previous: number;
  target: number;
};

type SeekBufferingResult = {
  displayTime: number;
  hasPassed: boolean;
  isBuffering: boolean;
};

const SEEK_THRESHOLD_MS = 200;

/**
 * Computes the displayed time during a seek operation, preventing the
 * scrubber handle from jumping backward during forward seeks (or forward
 * during backward seeks).
 *
 * While the replayer is mid-seek, `displayTime` is clamped to the seek
 * target. Once the replayer reaches or passes the target, `displayTime`
 * switches to the real player time. `hasPassed` signals when the buffer
 * can be safely cleared without causing a visible jump.
 */
export function computeSeekBuffering(
  buffer: SeekBuffer,
  currentPlayerTime: number,
  thresholdMs: number = SEEK_THRESHOLD_MS
): SeekBufferingResult {
  if (buffer.target === -1 || buffer.target === buffer.previous) {
    return {isBuffering: false, displayTime: currentPlayerTime, hasPassed: false};
  }

  const isForwardSeek = buffer.target > buffer.previous;

  if (isForwardSeek) {
    const arrived = currentPlayerTime >= buffer.target - thresholdMs;
    const passed = currentPlayerTime >= buffer.target;
    return {
      isBuffering: !arrived,
      displayTime: passed ? currentPlayerTime : buffer.target,
      hasPassed: passed,
    };
  }

  const arrived = currentPlayerTime <= buffer.target + thresholdMs;
  const passed = currentPlayerTime <= buffer.target;
  return {
    isBuffering: !arrived,
    displayTime: passed ? currentPlayerTime : buffer.target,
    hasPassed: passed,
  };
}
