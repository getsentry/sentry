import {TrendChangeType} from 'sentry/views/performance/trends/types';

export const trendSelectedQueryKeys = {
  [TrendChangeType.IMPROVED]: 'improvedSelected',
  [TrendChangeType.REGRESSION]: 'regressionSelected',
};

export default function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendSelectedQueryKeys[trendChangeType];
}
