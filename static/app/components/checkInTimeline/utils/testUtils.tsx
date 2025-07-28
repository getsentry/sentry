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
    labelColor: theme.red400,
    tickColor: theme.red300,
  },
  timeout: {
    labelColor: theme.red400,
    tickColor: theme.red300,
    hatchTick: theme.red200,
  },
  ok: {
    labelColor: theme.green400,
    tickColor: theme.green300,
  },
  missed: {
    labelColor: theme.yellow400,
    tickColor: theme.yellow300,
  },
  in_progress: {
    labelColor: theme.disabled,
    tickColor: theme.disabled,
  },
  unknown: {
    labelColor: theme.gray400,
    tickColor: theme.gray300,
    hatchTick: theme.gray200,
  },
});
