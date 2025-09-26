import type {Theme} from '@emotion/react';

import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
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
  if (areNumbersAlmostEqual(value, baseline, 10)) {
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
