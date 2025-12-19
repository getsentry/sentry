import type {StatsBucket, TickStyle} from 'sentry/components/checkInTimeline/types';

export type TestStatusCounts = [
  in_progress: number,
  ok: number,
  missed: number,
  timeout: number,
  error: number,
];

export function generateTestStats(counts: TestStatusCounts): StatsBucket<string> {
  const [in_progress, ok, missed, timeout, error] = counts;
  return {
    in_progress,
    ok,
    missed,
    timeout,
    error,
  };
}

export const testStatusPrecedent = ['error', 'timeout', 'missed', 'ok', 'in_progress'];

export const testStatusLabel = {
  error: 'Failed',
  timeout: 'Timed Out',
  missed: 'Missed',
  ok: 'Okay',
  in_progress: 'In Progress',
};

export const testStatusStyle: TickStyle<string> = theme => ({
  error: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  timeout: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  ok: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  missed: {
    labelColor: theme.colors.yellow500,
    tickColor: theme.colors.yellow400,
  },
  in_progress: {
    labelColor: theme.disabled,
    tickColor: theme.disabled,
  },
  unknown: {
    labelColor: theme.colors.gray500,
    tickColor: theme.colors.gray400,
    hatchTick: theme.colors.gray200,
  },
});
