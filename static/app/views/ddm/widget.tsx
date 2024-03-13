import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {SeriesOption} from 'echarts';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {Field} from 'sentry/components/ddm/metricSamplesTable';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  getDefaultMetricDisplayType,
  getFormattedMQL,
  getMetricsSeriesId,
  getMetricsSeriesName,
  isCumulativeOp,
  unescapeMetricsFormula,
} from 'sentry/utils/metrics';
import {metricDisplayTypeOptions} from 'sentry/utils/metrics/constants';
import {formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import type {
  FocusedMetricsSeries,
  MetricCorrelation,
  MetricQueryWidgetParams,
  MetricWidgetQueryParams,
  SortState,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useMetricSamples} from 'sentry/utils/metrics/useMetricsCorrelations';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
  type MetricsQueryApiRequestQuery,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import useRouter from 'sentry/utils/useRouter';
import {getIngestionSeriesId, MetricChart} from 'sentry/views/ddm/chart/chart';
import type {Series} from 'sentry/views/ddm/chart/types';
import {useFocusArea} from 'sentry/views/ddm/chart/useFocusArea';
import {
  useMetricChartSamples,
  useMetricChartSamplesV2,
} from 'sentry/views/ddm/chart/useMetricChartSamples';
import type {FocusAreaProps} from 'sentry/views/ddm/context';
import {EquationSymbol} from 'sentry/views/ddm/equationSymbol copy';
import {FormularFormatter} from 'sentry/views/ddm/formulaParser/formatter';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';
import {useSeriesHover} from 'sentry/views/ddm/useSeriesHover';
import {extendQueryWithGroupBys} from 'sentry/views/ddm/utils';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';

import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from './constants';

type MetricWidgetProps = {
  context: 'ddm' | 'dashboard';
  displayType: MetricDisplayType;
  filters: PageFilters;
  focusAreaProps: FocusAreaProps;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  queries: MetricsQueryApiQueryParams[];
  chartHeight?: number;
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  hasSiblings?: boolean;
  highlightedSampleId?: string;
  index?: number;
  isSelected?: boolean;
  metricsSamples?: MetricsSamplesResults<Field>['data'];
  onSampleClick?: (sample: Sample) => void;
  onSampleClickV2?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
  onSelect?: (index: number) => void;
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

function isNotQueryOnly(query: MetricsQueryApiQueryParams) {
  return !('isQueryOnly' in query) || !query.isQueryOnly;
}

export function getWidgetTitle(queries: MetricsQueryApiQueryParams[]) {
  const filteredQueries = queries.filter(isNotQueryOnly);

  if (filteredQueries.length === 1) {
    const firstQuery = filteredQueries[0];
    if (isMetricFormula(firstQuery)) {
      return (
        <Fragment>
          <FormularFormatter formula={unescapeMetricsFormula(firstQuery.formula)} />
        </Fragment>
      );
    }
    return getFormattedMQL(firstQuery);
  }

  return filteredQueries
    .map(q =>
      isMetricFormula(q)
        ? unescapeMetricsFormula(q.formula)
        : formatMRIField(MRIToField(q.mri, q.op))
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
    onSampleClickV2,
    highlightedSampleId,
    chartHeight = 300,
    focusedSeries,
    metricsSamples,
    context = 'ddm',
  }: MetricWidgetProps) => {
    const firstQuery = queries
      .filter(isNotQueryOnly)
      .find((query): query is MetricsQueryApiRequestQuery => !isMetricFormula(query));

    const handleChange = useCallback(
      (data: Partial<MetricWidgetQueryParams>) => {
        onChange(index, data);
      },
      [index, onChange]
    );

    const handleQueryChange = useCallback(
      (queryIndex, data: Partial<MetricWidgetQueryParams>) => {
        onChange(queryIndex, data);
      },
      [onChange]
    );

    const handleDisplayTypeChange = ({value}: SelectOption<MetricDisplayType>) => {
      Sentry.metrics.increment('ddm.widget.display');
      onChange(index, {displayType: value});
    };

    const queryWithFocusedSeries = useMemo(
      () =>
        extendQueryWithGroupBys(
          firstQuery?.query ?? '',
          focusedSeries?.map(s => s.groupBy)
        ),
      [firstQuery, focusedSeries]
    );

    const samplesQuery = useMetricSamples(firstQuery?.mri, {
      ...focusAreaProps?.selection?.range,
      query: queryWithFocusedSeries,
    });

    const samples = useMemo(() => {
      return {
        data: samplesQuery.data,
        onClick: onSampleClick,
        unit: parseMRI(firstQuery?.mri)?.unit ?? '',
        operation: firstQuery?.op ?? '',
        highlightedId: highlightedSampleId,
      };
    }, [
      samplesQuery.data,
      onSampleClick,
      firstQuery?.mri,
      firstQuery?.op,
      highlightedSampleId,
    ]);

    const samplesV2 = useMemo(() => {
      if (!defined(metricsSamples)) {
        return undefined;
      }
      return {
        data: metricsSamples,
        onSampleClick: onSampleClickV2,
        unit: parseMRI(firstQuery?.mri)?.unit ?? '',
        operation: firstQuery?.op ?? '',
        highlightedId: highlightedSampleId,
      };
    }, [
      metricsSamples,
      firstQuery?.mri,
      firstQuery?.op,
      onSampleClickV2,
      highlightedSampleId,
    ]);

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
            {showQuerySymbols &&
              queryId !== undefined &&
              (queries[0] && isMetricFormula(queries[0]) ? (
                <EquationSymbol
                  equationId={queryId}
                  isSelected={isSelected && hasSiblings}
                />
              ) : (
                <QuerySymbol queryId={queryId} isSelected={isSelected && hasSiblings} />
              ))}
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
                getDefaultMetricDisplayType(firstQuery?.mri, firstQuery?.op)
              }
              options={metricDisplayTypeOptions}
              onChange={handleDisplayTypeChange}
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
                  samplesV2={isSelected ? samplesV2 : undefined}
                  chartHeight={chartHeight}
                  chartGroup={DDM_CHART_GROUP}
                  queries={queries}
                  filters={filters}
                  displayType={displayType}
                  tableSort={tableSort}
                  focusedSeries={focusedSeries}
                  context={context}
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
  context: 'ddm' | 'dashboard';
  displayType: MetricDisplayType;
  filters: PageFilters;
  focusAreaProps: FocusAreaProps;
  queries: MetricsQueryApiQueryParams[];
  widgetIndex: number;
  chartGroup?: string;
  chartHeight?: number;
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  onChange?: (data: Partial<MetricWidgetQueryParams>) => void;
  onQueryChange?: (queryIndex: number, data: Partial<MetricQueryWidgetParams>) => void;
  samples?: SamplesProps;
  samplesV2?: SamplesV2Props;
  tableSort?: SortState;
}

export interface SamplesProps {
  operation: string;
  unit: string;
  data?: MetricCorrelation[];
  highlightedId?: string;
  onClick?: (sample: Sample) => void;
}

export interface SamplesV2Props {
  operation: string;
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
    samplesV2,
    filters,
    queries,
    context,
  }: MetricWidgetBodyProps) => {
    const router = useRouter();

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

    const {
      data: timeseriesData,
      isLoading,
      isError,
      error,
    } = useMetricsQuery(orderedQueries, filters, {
      intervalLadder: displayType === MetricDisplayType.BAR ? 'bar' : context,
    });

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

    const samplesProp = useMetricChartSamples({
      chartRef,
      correlations: samples?.data,
      unit: samples?.unit,
      onClick: samples?.onClick,
      highlightedSampleId: samples?.highlightedId,
      operation: samples?.operation,
      timeseries: chartSeries,
    });

    const samplesV2Prop = useMetricChartSamplesV2({
      samples: samplesV2?.data,
      highlightedSampleId: samplesV2?.highlightedId,
      operation: samplesV2?.operation,
      onSampleClick: samplesV2?.onSampleClick,
      timeseries: chartSeries,
      unit: samplesV2?.unit,
    });

    const handleZoom = useCallback(
      (range: DateTimeObject) => {
        Sentry.metrics.increment('ddm.enhance.zoom');
        updateDateTime(range, router, {save: true});
      },
      [router]
    );

    const handleRowFilter = useCallback(
      (queryIndex, series) => {
        const queryToUpdate = queries[queryIndex];
        if (!queryToUpdate) {
          return;
        }

        if (isMetricFormula(queryToUpdate)) {
          // TODO(ddm): filtering on an equation series should extend all conditions of all queries in the equation
          return;
        }

        const newQuery = extendQueryWithGroupBys(queryToUpdate.query, [series.groupBy]);
        onQueryChange?.(queryIndex, {query: newQuery});
      },
      [queries, onQueryChange]
    );

    const isCumulativeSamplesOp =
      queries[0] && !isMetricFormula(queries[0]) && isCumulativeOp(queries[0].op);
    const firstScalingFactor = chartSeries.find(s => !s.hidden)?.scalingFactor || 1;

    const focusArea = useFocusArea({
      ...focusAreaProps,
      scalingFactor: firstScalingFactor,
      chartRef,
      opts: {
        widgetIndex,
        isDisabled: !focusAreaProps.onAdd,
        useFullYAxis: isCumulativeSamplesOp,
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
          {isLoading && <LoadingIndicator />}
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
        <TransparentLoadingMask visible={isLoading} />
        <MetricChart
          ref={chartRef}
          series={chartSeries}
          displayType={displayType}
          height={chartHeight}
          samples={samplesV2Prop ?? samplesProp}
          focusArea={focusArea}
          group={chartGroup}
        />
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
    getChartPalette,
    focusedSeries,
  }: {
    getChartPalette: (seriesNames: string[]) => Record<string, string>;
    focusedSeries?: Set<string>;
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
    const operation = isEquationSeries ? 'count' : query.op;
    const isMultiQuery = filteredQueries.length > 1;

    return group.map(entry => ({
      unit: unit,
      operation: operation,
      values: entry.series,
      scalingFactor: scalingFactor,
      name: getMetricsSeriesName(query, entry.by, isMultiQuery),
      id: getMetricsSeriesId(query, entry.by),
      queryIndex: index,
      isEquationSeries,
      groupBy: entry.by,
      transaction: entry.by.transaction,
      release: entry.by.release,
    }));
  });

  const chartPalette = getChartPalette(series.map(s => s.id));

  return series.map(item => ({
    id: item.id,
    seriesName: item.name,
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
  gap: ${space(1)};
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

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
