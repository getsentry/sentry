import {t} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import type {SpanMetricsResponse} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

export function CacheMetrics({
  cacheMetrics,
}: {
  cacheMetrics: Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>;
}) {
  const avgCacheValueSize = cacheMetrics?.['avg(cache.item_size)'];
  const cacheMissRate = cacheMetrics?.['cache_miss_rate()'];

  const items: SectionCardKeyValueList = [
    {
      key: 'avg(cache.item_size)',
      subject: DataTitles['avg(cache.item_size)'],
      value: formatBytesBase2(avgCacheValueSize),
    },
    {
      key: 'cache_miss_rate()',
      subject: DataTitles['cache_miss_rate()'],
      value: formatPercentage(cacheMissRate),
    },
  ];

  return <TraceDrawerComponents.SectionCard items={items} title={t('Cache Metrics')} />;
}
