import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {SpanMetricsResponse} from 'sentry/views/insights/types';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

import {hasSDKContext} from './sdk';

type Props = {
  cacheMetrics: Array<
    Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>
  >;
  event: EventTransaction;
};

export function BuiltIn({event, cacheMetrics}: Props) {
  const items: SectionCardKeyValueList = [];

  // SDK info
  const meta = event._meta?.sdk;
  if (hasSDKContext(event)) {
    items.push({
      key: 'sdk_name',
      subject: 'SDK Name',
      value: meta?.name?.[''] ? (
        <AnnotatedText value={event?.sdk?.name} meta={meta?.name?.['']} />
      ) : (
        event?.sdk?.name
      ),
    });

    items.push({
      key: 'version',
      subject: 'SDK Version',
      value: meta?.version?.[''] ? (
        <AnnotatedText value={event?.sdk?.version} meta={meta?.version?.['']} />
      ) : (
        event?.sdk?.version
      ),
    });
  }

  // Cache metrics
  const cacheMetric = cacheMetrics[0];
  if (cacheMetric) {
    if (cacheMetric['avg(cache.item_size)'] !== null) {
      items.push({
        key: 'avg(cache.item_size)',
        subject: t('Cache Avg Value Size'),
        value: formatBytesBase2(cacheMetric['avg(cache.item_size)']),
      });
    }

    if (cacheMetric['cache_miss_rate()'] !== null) {
      items.push({
        key: 'cache_miss_rate()',
        subject: t('Cache Miss Rate'),
        value: formatPercentage(cacheMetric['cache_miss_rate()']),
      });
    }
  }

  return <TraceDrawerComponents.SectionCard items={items} title={t('Built-in')} />;
}
