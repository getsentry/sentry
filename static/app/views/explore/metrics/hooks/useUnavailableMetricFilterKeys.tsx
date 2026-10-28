import {useCallback} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {FilterType, parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {MetricQuery, TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  traceItemAttributeKeysOptions,
  type TraceItemAttribute,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

const EMPTY_KEYS: string[] = [];

const DATASET_FIELD_KEYS = new Set<string>([
  TraceMetricKnownFieldKey.ID,
  TraceMetricKnownFieldKey.TRACE,
  TraceMetricKnownFieldKey.ORGANIZATION_ID,
  TraceMetricKnownFieldKey.PROJECT,
  TraceMetricKnownFieldKey.PROJECT_ID,
  'project_id',
  'project.name',
  'project.slug',
  TraceMetricKnownFieldKey.TIMESTAMP,
  TraceMetricKnownFieldKey.TIMESTAMP_PRECISE,
  TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE,
  TraceMetricKnownFieldKey.METRIC_NAME,
  TraceMetricKnownFieldKey.METRIC_TYPE,
  TraceMetricKnownFieldKey.METRIC_UNIT,
  TraceMetricKnownFieldKey.METRIC_VALUE,
]);

const EXPLICIT_TYPED_KEY = /^tags\[(.+),(?:string|number|boolean|array)\]$/;

function attributeName(key: string): string {
  return EXPLICIT_TYPED_KEY.exec(key)?.[1] ?? key;
}

/**
 * Filter keys in `query` that aren't attributes of the metric the attribute
 * response was scoped to. Returns nothing when the response is truncated,
 * since a key past the page limit can't be told apart from a missing one.
 */
export function getUnavailableFilterKeys(
  query: string,
  response: ApiResponse<TraceItemAttribute[]>
): string[] {
  if (!query || parseLinkHeader(response.headers.Link ?? null).next?.results) {
    return EMPTY_KEYS;
  }

  const available = new Set(DATASET_FIELD_KEYS);
  for (const attribute of response.json) {
    available.add(attributeName(attribute.key));
    for (const alias of attribute.secondaryAliases ?? []) {
      available.add(alias);
    }
  }

  const unavailable = new Set<string>();
  for (const token of parseSearch(query, {flattenParenGroups: true}) ?? []) {
    if (
      token.type !== Token.FILTER ||
      token.key.type === Token.KEY_AGGREGATE ||
      token.filter === FilterType.HAS ||
      token.filter === FilterType.IS
    ) {
      continue;
    }
    const key = getKeyName(token.key);
    const name = attributeName(key);
    if (name.startsWith('sentry.') || available.has(name)) {
      continue;
    }
    unavailable.add(key);
  }

  return unavailable.size ? Array.from(unavailable) : EMPTY_KEYS;
}

function metricAttributeKeysOptions({
  organization,
  selection,
  traceMetric,
  projectIds,
  environments,
}: {
  organization: Organization;
  selection: PageFilters;
  traceMetric: TraceMetric;
  environments?: string[];
  projectIds?: number[];
}) {
  return traceItemAttributeKeysOptions({
    organization,
    selection,
    traceItemType: TraceItemDataset.TRACEMETRICS,
    query: createTraceMetricFilter(traceMetric),
    projectIds,
    environments,
  });
}

function metricKey(traceMetric: TraceMetric): string {
  return `${traceMetric.name}:${traceMetric.type}`;
}

/**
 * Filter keys that the selected metric doesn't have. Stays empty until the
 * metric's attributes load successfully, so pending or failed requests never
 * flag a filter.
 */
export function useUnavailableMetricFilterKeys({
  traceMetric,
  query,
  projectIds,
  environments,
  enabled = true,
}: {
  query: string;
  traceMetric: TraceMetric;
  enabled?: boolean;
  environments?: string[];
  projectIds?: number[];
}): string[] {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const select = useCallback(
    (response: ApiResponse<TraceItemAttribute[]>) =>
      getUnavailableFilterKeys(query, response),
    [query]
  );

  const isEnabled = enabled && Boolean(traceMetric.name) && Boolean(query);
  const {data, isSuccess} = useQuery({
    ...metricAttributeKeysOptions({
      organization,
      selection,
      traceMetric,
      projectIds,
      environments,
    }),
    enabled: isEnabled,
    select,
  });
  return isEnabled && isSuccess ? data : EMPTY_KEYS;
}

/**
 * Whether any metric query filters on a key its metric doesn't have.
 */
export function useHasUnavailableMetricFilters(metricQueries: MetricQuery[]): boolean {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const filteredQueries = metricQueries.filter(
    metricQuery => metricQuery.metric.name && metricQuery.queryParams.query
  );
  const metrics = uniqBy(
    filteredQueries.map(metricQuery => metricQuery.metric),
    metricKey
  );

  return useQueries({
    queries: metrics.map(traceMetric => ({
      ...metricAttributeKeysOptions({organization, selection, traceMetric}),
      select: selectJsonWithHeaders<TraceItemAttribute[]>,
    })),
    combine: results => {
      const resultsByMetric = new Map(
        metrics.map((traceMetric, index) => [metricKey(traceMetric), results[index]])
      );
      return filteredQueries.some(metricQuery => {
        const result = resultsByMetric.get(metricKey(metricQuery.metric));
        return (
          result?.isSuccess === true &&
          getUnavailableFilterKeys(metricQuery.queryParams.query, result.data).length > 0
        );
      });
    },
  });
}
