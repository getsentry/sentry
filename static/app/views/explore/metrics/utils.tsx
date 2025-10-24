import type {ReactNode} from 'react';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {PickableDays} from 'sentry/views/explore/utils';

export function makeMetricsPathname({
  organizationSlug,
  path,
}: {
  organizationSlug: string;
  path: string;
}) {
  return normalizeUrl(`/organizations/${organizationSlug}/explore/metrics${path}`);
}

/**
 * Creates a filter string for co-occurring attributes based on a metric name.
 * This filter is used to narrow down attribute keys to only those that co-occur
 * with the specified metric.
 */
export function createMetricNameFilter(
  metricName: string | undefined
): string | undefined {
  return metricName
    ? MutableSearch.fromQueryObject({
        [`sentry._internal.cooccuring.name.${metricName}`]: ['true'],
      }).formatString()
    : undefined;
}

export function metricsPickableDays(): PickableDays {
  const relativeOptions: Array<[string, ReactNode]> = [
    ['1h', t('Last hour')],
    ['24h', t('Last 24 hours')],
    ['7d', t('Last 7 days')],
    ['14d', t('Last 14 days')],
    ['30d', t('Last 30 days')],
  ];

  return {
    defaultPeriod: '24h',
    maxPickableDays: 30, // May change with downsampled multi month support.
    relativeOptions: ({
      arbitraryOptions,
    }: {
      arbitraryOptions: Record<string, ReactNode>;
    }) => ({
      ...arbitraryOptions,
      ...Object.fromEntries(relativeOptions),
    }),
  };
}
