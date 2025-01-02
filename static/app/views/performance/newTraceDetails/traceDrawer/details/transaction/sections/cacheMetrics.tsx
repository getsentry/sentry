import {t} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import type {SpanMetricsResponse} from 'sentry/views/insights/types';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

export function CacheMetrics({
  cacheMetrics,
}: {
  cacheMetrics: Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>[];
}) {
  const itemSize: number | null = cacheMetrics[0]!['avg(cache.item_size)'];
  const missRate: number | null = cacheMetrics[0]!['cache_miss_rate()'];

  const items: SectionCardKeyValueList = [];

  if (itemSize !== null) {
    items.push({
      key: 'avg(cache.item_size)',
      subject: DataTitles['avg(cache.item_size)'],
      value: formatBytesBase2(itemSize),
    });
  }

  if (missRate !== null) {
    items.push({
      key: 'cache_miss_rate()',
      subject: DataTitles['cache_miss_rate()'],
      value: formatPercentage(missRate),
    });
  }

  return <TraceDrawerComponents.SectionCard items={items} title={t('Cache Metrics')} />;
}
