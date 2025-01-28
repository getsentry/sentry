import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {
  type Field,
  MetricSamplesTable,
  SearchableMetricSamplesTable,
} from 'sentry/components/metrics/metricSamplesTable';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import {defined} from 'sentry/utils';
import {isVirtualMetric} from 'sentry/utils/metrics';
import type {FocusedMetricsSeries, MetricsWidget} from 'sentry/utils/metrics/types';
import {isMetricsEquationWidget} from 'sentry/utils/metrics/types';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {FocusAreaProps} from 'sentry/views/metrics/context';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {extendQueryWithGroupBys} from 'sentry/views/metrics/utils';
import {generateTracesRouteWithQuery} from 'sentry/views/traces/utils';

export function WidgetDetails() {
  const {
    selectedWidgetIndex,
    widgets,
    focusArea,
    setHighlightedSampleId,
    setMetricsSamples,
    hasPerformanceMetrics,
  } = useMetricsContext();

  const selectedWidget = widgets[selectedWidgetIndex] as MetricsWidget | undefined;

  const handleSampleRowHover = useCallback(
    (sampleId?: string) => {
      setHighlightedSampleId(sampleId);
    },
    [setHighlightedSampleId]
  );

  if (!selectedWidget || isMetricsEquationWidget(selectedWidget)) {
    return <MetricDetails onRowHover={handleSampleRowHover} focusArea={focusArea} />;
  }

  const {mri, aggregation, query, condition, focusedSeries} = selectedWidget;

  return (
    <MetricDetails
      mri={mri}
      aggregation={aggregation}
      condition={condition}
      query={query}
      focusedSeries={focusedSeries}
      onRowHover={handleSampleRowHover}
      setMetricsSamples={setMetricsSamples}
      focusArea={focusArea}
      hasPerformanceMetrics={hasPerformanceMetrics}
    />
  );
}

interface MetricDetailsProps {
  aggregation?: MetricAggregation;
  condition?: number;
  focusArea?: FocusAreaProps;
  focusedSeries?: FocusedMetricsSeries[];
  hasPerformanceMetrics?: boolean;
  mri?: MRI;
  onRowHover?: (sampleId?: string) => void;
  query?: string;
  setMetricsSamples?: React.Dispatch<
    React.SetStateAction<MetricsSamplesResults<Field>['data'] | undefined>
  >;
}

export function MetricDetails({
  mri,
  aggregation,
  condition,
  query,
  focusedSeries,
  onRowHover,
  focusArea,
  setMetricsSamples,
  hasPerformanceMetrics,
}: MetricDetailsProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const {getCondition} = useVirtualMetricsContext();

  const queryWithFocusedSeries = useMemo(
    () =>
      focusedSeries &&
      extendQueryWithGroupBys(
        query || '',
        focusedSeries.map(s => s.groupBy)
      ),
    [focusedSeries, query]
  );

  const selectionRange = focusArea?.selection?.range;

  const tracesTarget = useMemo(() => {
    const selectionDatetime =
      defined(selectionRange) && defined(selectionRange) && defined(selectionRange)
        ? ({
            start: selectionRange.start,
            end: selectionRange.end,
          } as PageFilters['datetime'])
        : undefined;

    if (mri && isVirtualMetric({mri})) {
      const conditionQuery = getCondition(mri, condition || -1)?.value || '';

      return generateTracesRouteWithQuery({
        orgSlug: organization.slug,
        query: {
          project: selection.projects as unknown as string[],
          environment: selection.environments,
          ...normalizeDateTimeParams(selectionDatetime ?? selection.datetime),
          query: `${conditionQuery.trim()} ${queryWithFocusedSeries?.trim()}`,
        },
      });
    }
    if (aggregation && mri) {
      return generateTracesRouteWithQuery({
        orgSlug: organization.slug,
        metric: {
          max: selectionRange?.max,
          min: selectionRange?.min,
          op: aggregation,
          query: queryWithFocusedSeries,
          mri,
        },
        query: {
          project: selection.projects as unknown as string[],
          environment: selection.environments,
          ...normalizeDateTimeParams(selectionDatetime ?? selection.datetime),
        },
      });
    }
    return '';
  }, [
    aggregation,
    mri,
    organization.slug,
    queryWithFocusedSeries,
    selection,
    selectionRange,
    condition,
    getCondition,
  ]);

  return (
    <TrayWrapper>
      <TabsAndAction>
        <Heading>{t('Span Samples')}</Heading>
        <Feature
          features={[
            'performance-trace-explorer-with-metrics',
            'performance-trace-explorer',
          ]}
          requireAll
        >
          <LinkButton to={tracesTarget} size="sm">
            {t('Open in Traces')}
          </LinkButton>
        </Feature>
      </TabsAndAction>
      <ContentWrapper>
        <MetricSampleTableWrapper organization={organization}>
          {organization.features.includes('metrics-samples-list-search') ? (
            <SearchableMetricSamplesTable
              focusArea={selectionRange}
              mri={mri}
              onRowHover={onRowHover}
              aggregation={aggregation}
              condition={condition}
              query={queryWithFocusedSeries}
              setMetricsSamples={setMetricsSamples}
              hasPerformance={hasPerformanceMetrics}
            />
          ) : (
            <MetricSamplesTable
              focusArea={selectionRange}
              mri={mri}
              onRowHover={onRowHover}
              aggregation={aggregation}
              condition={condition}
              query={queryWithFocusedSeries}
              setMetricsSamples={setMetricsSamples}
              hasPerformance={hasPerformanceMetrics}
            />
          )}
        </MetricSampleTableWrapper>
      </ContentWrapper>
    </TrayWrapper>
  );
}

const MetricSampleTableWrapper = HookOrDefault({
  hookName: 'component:ddm-metrics-samples-list',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const Heading = styled('h6')`
  margin-bottom: ${space(0.5)};
`;

const TrayWrapper = styled('div')`
  padding-top: ${space(4)};
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const ContentWrapper = styled('div')`
  position: relative;
  padding-top: ${space(1)};
`;

const TabsAndAction = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(4)};
  align-items: end;
`;
