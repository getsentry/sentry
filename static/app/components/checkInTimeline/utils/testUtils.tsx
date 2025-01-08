import type {StatsBucket, TickStyle} from '../types';

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

export const testStatusPrecedent = ['in_progress', 'ok', 'missed', 'timeout', 'error'];

export const testStatusLabel = {
  in_progress: 'In Progress',
  ok: 'Okay',
  missed: 'Missed',
  timeout: 'Timed Out',
  error: 'Failed',
};

export const testStatusStyle: Record<string, TickStyle> = {
  error: {
    labelColor: 'red400',
    tickColor: 'red300',
  },
  timeout: {
    labelColor: 'red400',
    tickColor: 'red300',
    hatchTick: 'red200',
  },
  ok: {
    labelColor: 'green400',
    tickColor: 'green300',
  },
  missed: {
    labelColor: 'yellow400',
    tickColor: 'yellow300',
  },
  in_progress: {
    labelColor: 'disabled',
    tickColor: 'disabled',
  },
  unknown: {
    labelColor: 'gray400',
    tickColor: 'gray300',
    hatchTick: 'gray200',
  },
};
