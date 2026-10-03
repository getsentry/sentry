import {useCallback, useSyncExternalStore} from 'react';

import {
  type RecordedFrame,
  recordedFrameIndexAt,
} from 'sentry/views/investigations/__stories__/recordedRun';

// How often the clock advances. Fine enough for a scrubber, cheap enough to
// leave the investigation page alone between frames.
const TICK_INTERVAL_MS = 100;

type ReplayClockSnapshot = {
  isPlaying: boolean;
  speed: number;
  timeMs: number;
};

export type ReplayClock = ReturnType<typeof createReplayClock>;

/**
 * The playhead. It advances by real elapsed time (times the playback speed) so
 * a run replays at the pace it actually ran, and it lives outside React so the
 * investigation page only re-renders when a recorded response changes — not on
 * every tick.
 */
export function createReplayClock(durationMs: number) {
  let snapshot: ReplayClockSnapshot = {isPlaying: false, speed: 1, timeMs: 0};
  const listeners = new Set<() => void>();
  let interval: ReturnType<typeof setInterval> | undefined;
  let tickedAt = 0;

  function update(next: Partial<ReplayClockSnapshot>) {
    snapshot = {...snapshot, ...next};
    for (const listener of listeners) {
      listener();
    }
  }

  function stopInterval() {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  function tick() {
    const now = performance.now();
    const elapsed = (now - tickedAt) * snapshot.speed;
    tickedAt = now;

    const timeMs = snapshot.timeMs + elapsed;
    if (timeMs >= durationMs) {
      stopInterval();
      update({isPlaying: false, timeMs: durationMs});
      return;
    }
    update({timeMs});
  }

  function pause() {
    stopInterval();
    if (snapshot.isPlaying) {
      update({isPlaying: false});
    }
  }

  function play() {
    if (snapshot.isPlaying) {
      return;
    }
    stopInterval();
    tickedAt = performance.now();
    interval = setInterval(tick, TICK_INTERVAL_MS);
    // Replaying from the end restarts rather than sitting on the last frame.
    update({
      isPlaying: true,
      timeMs: snapshot.timeMs >= durationMs ? 0 : snapshot.timeMs,
    });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play,
    pause,
    toggle: () => (snapshot.isPlaying ? pause() : play()),
    seek(timeMs: number) {
      tickedAt = performance.now();
      update({timeMs: Math.min(Math.max(timeMs, 0), durationMs)});
    },
    setSpeed(speed: number) {
      update({speed});
    },
    destroy() {
      stopInterval();
      listeners.clear();
    },
  };
}

/** Re-renders on every tick. Only for something that shows the time itself. */
export function useReplayClock(clock: ReplayClock) {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}

/**
 * The index of the frame being served at the playhead, or -1 before the first
 * response. Returning the index rather than the frame lets
 * `useSyncExternalStore` skip the re-render on the ticks between frames, which
 * is what keeps an expensive subscriber off the 10Hz path.
 */
export function useRecordedFrameIndex(
  clock: ReplayClock,
  frames: Array<RecordedFrame<unknown>>
) {
  const getSnapshot = useCallback(
    () => recordedFrameIndexAt(frames, clock.getSnapshot().timeMs),
    [clock, frames]
  );

  return useSyncExternalStore(clock.subscribe, getSnapshot, getSnapshot);
}

export function formatReplayClock(timeMs: number) {
  const totalSeconds = Math.max(0, Math.round(timeMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
