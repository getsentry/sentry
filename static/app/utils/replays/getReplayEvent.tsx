import type {ReplayFrame} from 'sentry/utils/replays/types';

export function getPrevReplayFrame({
  frames,
  targetOffsetMs,
  allowExact = false,
}: {
  frames: ReplayFrame[];
  targetOffsetMs: number;
  allowExact?: boolean;
}) {
  return frames.reduce<ReplayFrame | undefined>((found, item) => {
    if (
      item.offsetMs > targetOffsetMs ||
      (!allowExact && item.offsetMs === targetOffsetMs)
    ) {
      return found;
    }
    if (
      (allowExact && item.offsetMs === targetOffsetMs) ||
      !found ||
      item.offsetMs > found.offsetMs
    ) {
      return item;
    }
    return found;
  }, undefined);
}

export function getNextReplayFrame({
  frames,
  targetOffsetMs,
  allowExact = false,
}: {
  frames: ReplayFrame[];
  targetOffsetMs: number;
  allowExact?: boolean;
}) {
  return frames.reduce<ReplayFrame | undefined>((found, item) => {
    if (
      item.offsetMs < targetOffsetMs ||
      (!allowExact && item.offsetMs === targetOffsetMs)
    ) {
      return found;
    }
    if (
      (allowExact && item.offsetMs === targetOffsetMs) ||
      !found ||
      item.offsetMs < found.offsetMs
    ) {
      return item;
    }
    return found;
  }, undefined);
}
