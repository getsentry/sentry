import {formatSecondsToClock} from 'sentry/utils/duration/formatSecondsToClock';

export default function formatReplayDuration(ms: number, showMs?: boolean): string {
  if (ms <= 0 || isNaN(ms)) {
    if (showMs) {
      return '00:00.000';
    }

    return '00:00';
  }

  const seconds = ms / 1000;
  return formatSecondsToClock(showMs ? seconds : Math.floor(seconds));
}
