import type {Theme} from '@emotion/react';

import {isNearAverage as areAlmostEqual} from 'sentry/views/insights/common/components/samplesTable/common';
import {
  crossIconPath,
  downwardPlayIconPath,
  upwardPlayIconPath,
} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/symbol';

export function getSampleChartSymbol(
  value: number,
  baseline: number,
  theme: Theme
): {color: string; symbol: string} {
  if (areAlmostEqual(value, baseline)) {
    return {
      symbol: crossIconPath,
      color: theme.gray500,
    };
  }

  return value > baseline
    ? {
        symbol: upwardPlayIconPath,
        color: theme.red300,
      }
    : {
        symbol: downwardPlayIconPath,
        color: theme.green300,
      };
}
