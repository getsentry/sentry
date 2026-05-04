import {memo, useCallback, useMemo} from 'react';

import {Grid} from '@sentry/scraps/layout';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceMetricItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricSelector';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsCrossEvents,
  useQueryParamsMode,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SpansTabCrossEventMetricsSearchBarProps {
  index: number;
  metric: TraceMetric;
  query: string;
}

export const SpansTabCrossEventMetricsSearchBar = memo(
  ({index, metric, query}: SpansTabCrossEventMetricsSearchBarProps) => {
    const mode = useQueryParamsMode();
    const crossEvents = useQueryParamsCrossEvents();
    const setCrossEvents = useSetQueryParamsCrossEvents();

    const metricFilter = useMemo(() => createTraceMetricFilter(metric), [metric]);
    const attributeOptions = useMemo(
      () => (metricFilter ? {query: metricFilter} : {}),
      [metricFilter]
    );

    const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
      useTraceMetricItemAttributes(
        attributeOptions,
        'number',
        HiddenTraceMetricSearchFields
      );
    const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
      useTraceMetricItemAttributes(
        attributeOptions,
        'string',
        HiddenTraceMetricSearchFields
      );
    const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
      useTraceMetricItemAttributes(
        attributeOptions,
        'boolean',
        HiddenTraceMetricSearchFields
      );

    const onMetricChange = useCallback(
      (newMetric: TraceMetric) => {
        if (!crossEvents) return;
        setCrossEvents?.(
          crossEvents.map((c, i) => {
            if (i === index) return {type: 'metrics', query, metric: newMetric};
            return c;
          })
        );
      },
      [crossEvents, setCrossEvents, index, query]
    );

    const hasMetric = Boolean(metric.name);

    const eapSpanSearchQueryBuilderProps = useMemo(
      () => ({
        initialQuery: query,
        onSearch: (newQuery: string) => {
          if (!crossEvents) return;
          setCrossEvents?.(
            crossEvents.map((c, i) => {
              if (i === index) return {type: 'metrics', query: newQuery, metric};
              return c;
            })
          );
        },
        searchSource: 'explore',
        getFilterTokenWarning:
          mode === Mode.SAMPLES
            ? (key: string) => {
                if (
                  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)
                ) {
                  return t(
                    "This key won't affect the results because samples mode does not support aggregate functions"
                  );
                }
                return;
              }
            : undefined,
        supportedAggregates:
          mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
        booleanAttributes,
        numberAttributes,
        stringAttributes,
        matchKeySuggestions: [
          {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
          {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
        ],
        booleanSecondaryAliases,
        numberSecondaryAliases,
        stringSecondaryAliases,
        namespace: metric.name,
        disableRecentSearches: !hasMetric,
        disabled: !hasMetric,
        attributeQuery: metricFilter,
        hiddenAttributeKeys: HiddenTraceMetricSearchFields,
      }),
      [
        booleanAttributes,
        booleanSecondaryAliases,
        crossEvents,
        hasMetric,
        index,
        metric,
        metricFilter,
        mode,
        numberAttributes,
        numberSecondaryAliases,
        query,
        setCrossEvents,
        stringAttributes,
        stringSecondaryAliases,
      ]
    );

    const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.TRACEMETRICS,
      ...eapSpanSearchQueryBuilderProps,
    });

    return (
      <Grid columns="minmax(180px, 240px) 1fr" gap="md">
        <MetricSelector traceMetric={metric} onChange={onMetricChange} />
        <SearchQueryBuilderProvider
          // Use the metric name as a key to force remount when it changes
          // This prevents race conditions when switching between different metrics
          key={metric.name}
          {...searchQueryBuilderProps}
        >
          <TraceItemSearchQueryBuilder
            itemType={TraceItemDataset.TRACEMETRICS}
            {...eapSpanSearchQueryBuilderProps}
          />
        </SearchQueryBuilderProvider>
      </Grid>
    );
  }
);
