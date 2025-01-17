import {TrendChangeType} from 'sentry/views/performance/trends/types';

export const trendSelectedQueryKeys = {
  [TrendChangeType.IMPROVED]: 'improvedSelected',
  [TrendChangeType.REGRESSION]: 'regressionSelected',
};

export default function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return trendSelectedQueryKeys[trendChangeType];
}
