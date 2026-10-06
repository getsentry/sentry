import type {Theme} from '@emotion/react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {tct} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import type {TagVariant} from 'sentry/utils/theme';

/** Hide comparisons below this delta so tiny, noisy differences aren't shown. */
export const MIN_PCT_DURATION_DIFFERENCE = 10;

export type DurationComparison = {
  deltaPct: number;
  deltaText: React.JSX.Element;
  status: 'faster' | 'slower' | 'equal';
  variant: TagVariant;
} | null;

export function makeDurationComparisonStatusColors(theme: Theme): {
  equal: {light: string; normal: string};
  faster: {light: string; normal: string};
  slower: {light: string; normal: string};
} {
  return {
    faster: {
      light: theme.colors.green100,
      normal: theme.colors.green600,
    },
    slower: {
      light: theme.colors.red100,
      normal: theme.colors.red600,
    },
    equal: {
      light: theme.tokens.background.transparent.neutral.muted,
      normal: theme.tokens.content.secondary,
    },
  };
}

export const getDurationComparison = (
  baseline: number | undefined,
  duration: number,
  baseDescription?: string
): DurationComparison => {
  if (!baseline) {
    return null;
  }

  const delta = duration - baseline;
  const deltaPct = Math.round(Math.abs((delta / baseline) * 100));
  const status = delta > 0 ? 'slower' : delta < 0 ? 'faster' : 'equal';
  const variant =
    status === 'faster' ? 'success' : status === 'slower' ? 'danger' : 'muted';

  const formattedBaseDuration = (
    <Tooltip title={baseDescription} showUnderline underlineColor={variant}>
      {getDuration(baseline, 2, true)}
    </Tooltip>
  );

  const deltaText =
    status === 'equal'
      ? tct('equal to avg [formattedBaseDuration]', {
          formattedBaseDuration,
        })
      : status === 'faster'
        ? tct('[deltaPct] faster than avg [formattedBaseDuration]', {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          })
        : tct('[deltaPct] slower than avg [formattedBaseDuration]', {
            formattedBaseDuration,
            deltaPct: `${deltaPct}%`,
          });

  return {deltaPct, status, deltaText, variant};
};
