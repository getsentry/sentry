import {t} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import type {SpanMetricsResponse} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

export function CacheMetrics({
  cacheMetrics,
}: {
  cacheMetrics: Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>[];
}) {
  const items: SectionCardKeyValueList = cacheMetrics.flatMap((metricRow, idx) => [
    {
      key: `avg(cache.item_size)${idx}`,
      subject: DataTitles['avg(cache.item_size)'],
      value: formatBytesBase2(metricRow?.['avg(cache.item_size)']),
    },
    {
      key: `cache_miss_rate()${idx}`,
      subject: DataTitles['cache_miss_rate()'],
      value: formatPercentage(metricRow?.['cache_miss_rate()']),
    },
  ]);

  return <TraceDrawerComponents.SectionCard items={items} title={t('Cache Metrics')} />;
}
