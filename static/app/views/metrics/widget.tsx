import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {SeriesOption} from 'echarts';
import moment from 'moment-timezone';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getIngestionSeriesId, MetricChart} from 'sentry/components/metrics/chart/chart';
import type {Series} from 'sentry/components/metrics/chart/types';
import {useFocusArea} from 'sentry/components/metrics/chart/useFocusArea';
import {useMetricChartSamples} from 'sentry/components/metrics/chart/useMetricChartSamples';
import {useReleaseSeries} from 'sentry/components/metrics/chart/useMetricReleases';
import {EquationFormatter} from 'sentry/components/metrics/equationInput/syntax/formatter';
import type {Field} from 'sentry/components/metrics/metricSamplesTable';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {MetricAggregation, MetricsQueryApiResponse} from 'sentry/types/metrics';
import {defined} from 'sentry/utils';
import {
  areResultsLimited,
  getDefaultAggregation,
  getDefaultMetricDisplayType,
  getFormattedMQL,
  getMetricsSeriesId,
  getMetricsSeriesName,
  isNotQueryOnly,
  unescapeMetricsFormula,
} from 'sentry/utils/metrics';
import {metricDisplayTypeOptions} from 'sentry/utils/metrics/constants';
import {formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {
  type FocusedMetricsSeries,
  MetricChartOverlayType,
  type MetricDisplayType,
  type MetricSeriesFilterUpdateType,
  type MetricsQueryWidget,
  type MetricsWidget,
  type SortState,
} from 'sentry/utils/metrics/types';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
  type MetricsQueryApiRequestQuery,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import useRouter from 'sentry/utils/useRouter';
import type {FocusAreaProps} from 'sentry/views/metrics/context';
import {SummaryTable} from 'sentry/views/metrics/summaryTable';
import {useSeriesHover} from 'sentry/views/metrics/useSeriesHover';
import {updateQueryWithSeriesFilter} from 'sentry/views/metrics/utils';
import {createChartPalette} from 'sentry/views/metrics/utils/metricsChartPalette';
import {useMetricsIntervalParam} from 'sentry/views/metrics/utils/useMetricsIntervalParam';

import {METRIC_CHART_GROUP, MIN_WIDGET_WIDTH} from './constants';

type MetricWidgetProps = {
  displayType: MetricDisplayType;
  filters: PageFilters;
  focusAreaProps: FocusAreaProps;
  onChange: (index: number, data: Partial<MetricsWidget>) => void;
  queries: MetricsQueryApiQueryParams[];
  chartHeight?: number;
  context?: 'ddm' | 'dashboard';
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  hasSiblings?: boolean;
  highlightedSampleId?: string;
  index?: number;
  isSelected?: boolean;
  metricsSamples?: MetricsSamplesResults<Field>['data'];
  onSampleClick?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
  onSelect?: (index: number) => void;
  overlays?: MetricChartOverlayType[];
  queryId?: number;
  showQuerySymbols?: boolean;
  tableSort?: SortState;
};

export type Sample = {
  projectId: number;
  spanId: string;
  transactionId: string;
  transactionSpanId: string;
};

export function getWidgetTitle(queries: MetricsQueryApiQueryParams[]) {
  const filteredQueries = queries.filter(isNotQueryOnly);

  if (filteredQueries.length === 1) {
    const firstQuery = filteredQueries[0];
    if (isMetricFormula(firstQuery)) {
      return (
        <Fragment>
          <EquationFormatter equation={unescapeMetricsFormula(firstQuery.formula)} />
        </Fragment>
      );
    }
    return getFormattedMQL(firstQuery);
  }

  return filteredQueries
    .map(q =>
      isMetricFormula(q)
        ? unescapeMetricsFormula(q.formula)
        : formatMRIField(MRIToField(q.mri, q.aggregation))
    )
    .join(', ');
}

export const MetricWidget = memo(
  ({
    queryId,
    queries,
    filters,
    displayType,
    tableSort,
    index = 0,
    isSelected = false,
    getChartPalette,
    onSelect,
    onChange,
    hasSiblings = false,
    showQuerySymbols,
    focusAreaProps,
    onSampleClick,
    chartHeight = 300,
    focusedSeries,
    metricsSamples,
    overlays,
    highlightedSampleId,
  }: MetricWidgetProps) => {
    const firstQuery = queries
      .filter(isNotQueryOnly)
      .find((query): query is MetricsQueryApiRequestQuery => !isMetricFormula(query));

    const handleChange = useCallback(
      (data: Partial<MetricsWidget>) => {
        onChange(index, data);
      },
      [index, onChange]
    );

    const handleQueryChange = useCallback(
      (queryIndex, data: Partial<MetricsWidget>) => {
        onChange(queryIndex, data);
      },
      [onChange]
    );

    const handleDisplayTypeChange = ({value}: SelectOption<MetricDisplayType>) => {
      Sentry.metrics.increment('ddm.widget.display');
      onChange(index, {displayType: value});
    };

    const handleOverlayChange = (options: SelectOption<MetricChartOverlayType>[]) => {
      const values = options.map(({value}) => value);

      Sentry.metrics.increment('ddm.widget.overlay', 1, {
        tags: {
          releases: values.includes(MetricChartOverlayType.RELEASES),
          samples: values.includes(MetricChartOverlayType.SAMPLES),
        },
      });

      onChange(index, {overlays: values});
    };
    const samples = useMemo(() => {
      if (!defined(metricsSamples)) {
        return undefined;
      }
      if (!firstQuery) {
        return undefined;
      }
      return {
        data: metricsSamples,
        onSampleClick,
        unit: parseMRI(firstQuery?.mri)?.unit ?? '',
        aggregation: firstQuery.aggregation ?? getDefaultAggregation(firstQuery.mri),
        highlightedId: highlightedSampleId,
      };
    }, [metricsSamples, firstQuery, onSampleClick, highlightedSampleId]);

    const widgetTitle = getWidgetTitle(queries);

    const queriesAreComplete = queries.every(q =>
      isMetricFormula(q) ? !!q.formula : !!q.mri
    );

    return (
      <MetricWidgetPanel
        // show the selection border only if we have more widgets than one
        isHighlighted={isSelected && hasSiblings}
        isHighlightable={hasSiblings}
        onClick={() => onSelect?.(index)}
      >
        <PanelBody>
          <MetricWidgetHeader>
            {showQuerySymbols && queryId !== undefined && queries[0] && (
              <span>{queries[0].name}:</span>
            )}
            <WidgetTitle>
              <StyledTooltip
                title={widgetTitle}
                showOnlyOnOverflow
                delay={500}
                overlayStyle={{maxWidth: '90vw'}}
              >
                {widgetTitle}
              </StyledTooltip>
            </WidgetTitle>
            <CompactSelect
              size="xs"
              triggerProps={{prefix: t('Display')}}
              value={
                displayType ??
                getDefaultMetricDisplayType(firstQuery?.mri, firstQuery?.aggregation)
              }
              options={metricDisplayTypeOptions}
              onChange={handleDisplayTypeChange}
            />
            <CompactSelect
              size="xs"
              triggerProps={{prefix: t('Overlay')}}
              multiple
              value={overlays}
              options={[
                {
                  label: t('Samples'),
                  value: MetricChartOverlayType.SAMPLES,
                },
                {
                  label: t('Releases'),
                  value: MetricChartOverlayType.RELEASES,
                },
              ]}
              onChange={handleOverlayChange}
            />
          </MetricWidgetHeader>
          <MetricWidgetBodyWrapper>
            {queriesAreComplete ? (
              <ErrorBoundary mini>
                <MetricWidgetBody
                  widgetIndex={index}
                  getChartPalette={getChartPalette}
                  onChange={handleChange}
                  onQueryChange={handleQueryChange}
                  focusAreaProps={focusAreaProps}
                  samples={isSelected ? samples : undefined}
                  chartHeight={chartHeight}
                  chartGroup={METRIC_CHART_GROUP}
                  queries={queries}
                  filters={filters}
                  displayType={displayType}
                  tableSort={tableSort}
                  focusedSeries={focusedSeries}
                  overlays={overlays}
                />
              </ErrorBoundary>
            ) : (
              <StyledMetricWidgetBody>
                <EmptyMessage
                  icon={<IconSearch size="xxl" />}
                  title={t('Nothing to show!')}
                  description={t('Choose a metric and an operation to display data.')}
                />
              </StyledMetricWidgetBody>
            )}
          </MetricWidgetBodyWrapper>
        </PanelBody>
      </MetricWidgetPanel>
    );
  }
);

interface MetricWidgetBodyProps {
  displayType: MetricDisplayType;
  filters: PageFilters;
  focusAreaProps: FocusAreaProps;
  queries: MetricsQueryApiQueryParams[];
  widgetIndex: number;
  chartGroup?: string;
  chartHeight?: number;
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  onChange?: (data: Partial<MetricsWidget>) => void;
  onQueryChange?: (queryIndex: number, data: Partial<MetricsQueryWidget>) => void;
  overlays?: MetricChartOverlayType[];
  samples?: SamplesProps;
  tableSort?: SortState;
}

export interface SamplesProps {
  aggregation: MetricAggregation;
  unit: string;
  data?: MetricsSamplesResults<Field>['data'];
  highlightedId?: string;
  onSampleClick?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
}

const MetricWidgetBody = memo(
  ({
    onChange,
    onQueryChange,
    displayType,
    focusedSeries,
    tableSort,
    widgetIndex,
    getChartPalette = createChartPalette,
    focusAreaProps,
    chartHeight,
    chartGroup,
    samples,
    filters,
    queries,
    overlays,
  }: MetricWidgetBodyProps) => {
    const router = useRouter();
    const {interval} = useMetricsIntervalParam();

    const orderedQueries = useMemo(() => {
      return queries.map(q => {
        if (isMetricFormula(q)) {
          return q;
        }
        return {
          ...q,
          orderBy: q.orderBy ? q.orderBy : q.groupBy?.length ? 'desc' : undefined,
        };
      });
    }, [queries]);

    // Pause refetching if focus area is drawn
    const enableRefetch = !focusAreaProps.selection;
    const {
      data: timeseriesData,
      isPending,
      isError,
      error,
    } = useMetricsQuery(orderedQueries, filters, {interval}, enableRefetch);

    const limitedResults = useMemo(() => {
      if (!timeseriesData) {
        return false;
      }
      return areResultsLimited(timeseriesData);
    }, [timeseriesData]);

    const {chartRef, setHoveredSeries} = useSeriesHover();

    const handleHoverSeries = useCallback(
      (seriesId: string) => {
        setHoveredSeries([seriesId, getIngestionSeriesId(seriesId)]);
      },
      [setHoveredSeries]
    );

    const chartSeries = useMemo(() => {
      return timeseriesData
        ? getChartTimeseries(timeseriesData, queries, {
            getChartPalette,
            focusedSeries: focusedSeries && new Set(focusedSeries?.map(s => s.id)),
          })
        : [];
    }, [timeseriesData, queries, getChartPalette, focusedSeries]);

    const chartSamples = useMetricChartSamples({
      samples: samples?.data,
      highlightedSampleId: samples?.highlightedId,
      aggregation: samples?.aggregation,
      onSampleClick: samples?.onSampleClick,
      timeseries: chartSeries,
      unit: samples?.unit,
    });

    const samplesProp = useMemo(() => {
      if (!overlays?.includes(MetricChartOverlayType.SAMPLES)) {
        return undefined;
      }
      return chartSamples;
    }, [chartSamples, overlays]);

    const releaseSeries = useReleaseSeries();

    const releasesProp = useMemo(() => {
      if (!overlays?.includes(MetricChartOverlayType.RELEASES)) {
        return undefined;
      }
      return releaseSeries;
    }, [releaseSeries, overlays]);

    const handleZoom = useCallback(
      (range: DateTimeObject) => {
        Sentry.metrics.increment('ddm.enhance.zoom');
        updateDateTime(range, router, {save: true});
      },
      [router]
    );

    const handleRowFilter = useCallback(
      (
        queryIndex: number,
        series: FocusedMetricsSeries,
        updateType: MetricSeriesFilterUpdateType
      ) => {
        const queryToUpdate = queries[queryIndex];
        if (!queryToUpdate || !series.groupBy) {
          return;
        }

        if (isMetricFormula(queryToUpdate)) {
          // TODO(metrics): filtering on an equation series should extend all conditions of all queries in the equation
          return;
        }

        const newQuery = updateQueryWithSeriesFilter(
          queryToUpdate,
          series.groupBy,
          updateType
        );
        const indexToUpdate = queries.length > 1 ? queryIndex : widgetIndex;

        onQueryChange?.(indexToUpdate, newQuery);
      },
      [queries, onQueryChange, widgetIndex]
    );

    const firstScalingFactor = chartSeries.find(s => !s.hidden)?.scalingFactor || 1;

    const focusArea = useFocusArea({
      ...focusAreaProps,
      scalingFactor: firstScalingFactor,
      chartRef,
      opts: {
        widgetIndex,
        // The focus area relies on the chart samples to calculate its position
        isDisabled: chartSamples === undefined || !focusAreaProps.onAdd,
        useFullYAxis: true,
      },
      onZoom: handleZoom,
    });

    const toggleSeriesVisibility = useCallback(
      (series: FocusedMetricsSeries) => {
        setHoveredSeries('');

        // The focused series array is not populated yet, so we can add all series except the one that was de-selected
        if (!focusedSeries || focusedSeries.length === 0) {
          onChange?.({
            focusedSeries: chartSeries
              .filter(s => s.id !== series.id)
              .map(s => ({
                id: s.id,
                groupBy: s.groupBy,
              })),
          });
          return;
        }

        const filteredSeries = focusedSeries.filter(s => s.id !== series.id);

        if (filteredSeries.length === focusedSeries.length) {
          // The series was not focused before so we can add it
          filteredSeries.push(series);
        }

        onChange?.({
          focusedSeries: filteredSeries,
        });
      },
      [chartSeries, focusedSeries, onChange, setHoveredSeries]
    );

    const setSeriesVisibility = useCallback(
      (series: FocusedMetricsSeries) => {
        setHoveredSeries('');
        if (focusedSeries?.length === 1 && focusedSeries[0].id === series.id) {
          onChange?.({
            focusedSeries: [],
          });
          return;
        }
        onChange?.({
          focusedSeries: [series],
        });
      },
      [focusedSeries, onChange, setHoveredSeries]
    );

    const handleSortChange = useCallback(
      newSort => {
        onChange?.({sort: newSort});
      },
      [onChange]
    );

    if (!chartSeries || !timeseriesData || isError) {
      return (
        <StyledMetricWidgetBody>
          {isPending && <LoadingIndicator />}
          {isError && (
            <Alert type="error">
              {(error?.responseJSON?.detail as string) ||
                t('Error while fetching metrics data')}
            </Alert>
          )}
        </StyledMetricWidgetBody>
      );
    }

    if (timeseriesData.data.length === 0) {
      return (
        <StyledMetricWidgetBody>
          <EmptyMessage
            icon={<IconSearch size="xxl" />}
            title={t('No results')}
            description={t('No results found for the given query')}
          />
        </StyledMetricWidgetBody>
      );
    }

    return (
      <StyledMetricWidgetBody>
        {limitedResults && (
          <LimitAlert type="warning" showIcon>
            {tct(
              'The queries in this chart generate a large number of result groups. Only the first [numOfGroups] groups are displayed.',
              {numOfGroups: chartSeries.length}
            )}
          </LimitAlert>
        )}
        <TransparentLoadingMask visible={isPending} />
        <GuideAnchor target="metrics_chart" disabled={widgetIndex !== 0}>
          <MetricChart
            ref={chartRef}
            series={chartSeries}
            displayType={displayType}
            height={chartHeight}
            samples={samplesProp}
            focusArea={focusArea}
            releases={releasesProp}
            group={chartGroup}
          />
        </GuideAnchor>
        <SummaryTable
          series={chartSeries}
          onSortChange={handleSortChange}
          sort={tableSort}
          onRowClick={setSeriesVisibility}
          onColorDotClick={toggleSeriesVisibility}
          onRowHover={handleHoverSeries}
          onRowFilter={handleRowFilter}
        />
      </StyledMetricWidgetBody>
    );
  }
);

export function getChartTimeseries(
  data: MetricsQueryApiResponse,
  queries: MetricsQueryApiQueryParams[],
  {
    getChartPalette = createChartPalette,
    focusedSeries,
  }: {
    focusedSeries?: Set<string>;
    getChartPalette?: (seriesNames: string[]) => Record<string, string>;
    showQuerySymbol?: boolean;
  }
) {
  const filteredQueries = queries.filter(isNotQueryOnly);

  const series = data.data.flatMap((group, index) => {
    const query = filteredQueries[index];
    const meta = data.meta[index];
    const lastMetaEntry = meta[meta.length - 1];
    const unit =
      (lastMetaEntry && 'unit' in lastMetaEntry && lastMetaEntry.unit) || 'none';
    const scalingFactor =
      (lastMetaEntry &&
        'scaling_factor' in lastMetaEntry &&
        lastMetaEntry.scaling_factor) ||
      1;
    const isEquationSeries = isMetricFormula(query);
    const operation = isEquationSeries ? 'count' : query.aggregation;
    const isMultiQuery = filteredQueries.length > 1;

    return group.map(entry => ({
      unit,
      operation,
      values: entry.series,
      scalingFactor,
      name: getMetricsSeriesName(query, entry.by, isMultiQuery),
      id: getMetricsSeriesId(query, entry.by),
      queryIndex: index,
      isEquationSeries,
      groupBy: entry.by,
      transaction: entry.by.transaction,
      release: entry.by.release,
      total: entry.totals,
    }));
  });

  const chartPalette = getChartPalette(series.map(s => s.id));

  return series.map(item => ({
    id: item.id,
    seriesName: item.name,
    aggregate: item.operation,
    groupBy: item.groupBy,
    unit: item.unit,
    scalingFactor: item.scalingFactor,
    operation: item.operation,
    color: chartPalette[item.id],
    hidden: focusedSeries && focusedSeries.size > 0 && !focusedSeries.has(item.id),
    data: item.values.map((value, index) => ({
      name: moment(data.intervals[index]).valueOf(),
      value,
    })),
    transaction: item.transaction as string | undefined,
    release: item.release as string | undefined,
    isEquationSeries: item.isEquationSeries,
    queryIndex: item.queryIndex,
    total: item.total,
    emphasis: {
      focus: 'series',
    } as SeriesOption['emphasis'],
  })) as Series[];
}

const MetricWidgetPanel = styled(Panel)<{
  isHighlightable: boolean;
  isHighlighted: boolean;
}>`
  padding-bottom: 0;
  margin-bottom: 0;
  min-width: ${MIN_WIDGET_WIDTH}px;
  position: relative;
  transition: box-shadow 0.2s ease;
  ${p =>
    p.isHighlightable &&
    `
  &:focus,
  &:hover {
    box-shadow: 0px 0px 0px 3px
      ${p.isHighlighted ? p.theme.purple200 : 'rgba(209, 202, 216, 0.2)'};
  }
  `}

  ${p =>
    p.isHighlighted &&
    `
  box-shadow: 0px 0px 0px 3px ${p.theme.purple200};
  border-color: transparent;
  `}
`;

const StyledMetricWidgetBody = styled('div')`
  padding: ${space(1)};
  gap: ${space(3)};
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
`;

const MetricWidgetBodyWrapper = styled('div')`
  padding: ${space(1)};
`;

const MetricWidgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(0.5)};
  padding-left: ${space(2)};
  padding-top: ${space(1.5)};
  padding-right: ${space(2)};
`;

const WidgetTitle = styled('div')`
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  display: inline-grid;
  grid-auto-flow: column;
`;

const LimitAlert = styled(Alert)`
  margin-bottom: 0;
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
