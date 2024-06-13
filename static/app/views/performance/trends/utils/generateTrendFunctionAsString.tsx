import type {AggregationKeyWithAlias} from 'sentry/utils/discover/fields';
import {generateFieldAsString} from 'sentry/utils/discover/fields';

import type {TrendFunctionField} from '../types';

export default function generateTrendFunctionAsString(
  trendFunction: TrendFunctionField,
  trendParameter: string
): string {
  return generateFieldAsString({
    kind: 'function',
    function: [
      trendFunction as AggregationKeyWithAlias,
      trendParameter,
      undefined,
      undefined,
    ],
  });
}
