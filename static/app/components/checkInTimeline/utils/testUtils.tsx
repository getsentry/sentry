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
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
  },
  timeout: {
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
    hatchTick: theme.tokens.border.danger.muted,
  },
  ok: {
    labelColor: theme.tokens.content.success,
    tickColor: theme.tokens.dataviz.semantic.good,
  },
  missed: {
    labelColor: theme.tokens.content.warning,
    tickColor: theme.tokens.dataviz.semantic.meh,
  },
  in_progress: {
    labelColor: theme.tokens.content.disabled,
    tickColor: theme.tokens.content.disabled,
  },
  unknown: {
    labelColor: theme.tokens.content.secondary,
    tickColor: theme.tokens.dataviz.semantic.neutral,
    hatchTick: theme.tokens.border.neutral.muted,
  },
});
