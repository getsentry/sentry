import {memo, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {SeriesOption} from 'echarts';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse, PageFilters} from 'sentry/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {
  formatMetricsFormula,
  getDefaultMetricDisplayType,
  getFormattedMQL,
  getMetricsSeriesId,
  getMetricsSeriesName,
} from 'sentry/utils/metrics';
import {metricDisplayTypeOptions} from 'sentry/utils/metrics/constants';
import {formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {
  getMetricValueNormalizer,
  getNormalizedMetricUnit,
} from 'sentry/utils/metrics/normalizeMetricValue';
import type {
  FocusedMetricsSeries,
  MetricCorrelation,
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
import {getIngestionSeriesId, MetricChart} from 'sentry/views/ddm/chart/chart';
import type {Series} from 'sentry/views/ddm/chart/types';
import {useMetricChartSamples} from 'sentry/views/ddm/chart/useMetricChartSamples';
import type {FocusAreaProps} from 'sentry/views/ddm/context';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';
import {getQueryWithFocusedSeries} from 'sentry/views/ddm/utils';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';

import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from './constants';

type MetricWidgetProps = {
  context: 'ddm' | 'dashboard';
  displayType: MetricDisplayType;
  filters: PageFilters;
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  queries: MetricsQueryApiQueryParams[];
  chartHeight?: number;
  focusArea?: FocusAreaProps;
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  hasSiblings?: boolean;
  highlightedSampleId?: string;
  index?: number;
  isSelected?: boolean;
  onSampleClick?: (sample: Sample) => void;
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
      return formatMetricsFormula(firstQuery.formula);
    }
    return getFormattedMQL(firstQuery);
  }

  return filteredQueries
    .map(q =>
      isMetricFormula(q)
        ? formatMetricsFormula(q.formula)
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
    focusArea,
    onSampleClick,
    highlightedSampleId,
    chartHeight = 300,
    focusedSeries,
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

    const handleDisplayTypeChange = ({value}: SelectOption<MetricDisplayType>) => {
      Sentry.metrics.increment('ddm.widget.display');
      onChange(index, {displayType: value});
    };

    const queryWithFocusedSeries = useMemo(
      () => getQueryWithFocusedSeries(firstQuery?.query ?? '', focusedSeries),
      [firstQuery, focusedSeries]
    );

    const samplesQuery = useMetricSamples(firstQuery?.mri, {
      ...focusArea?.selection?.range,
      query: queryWithFocusedSeries,
    });

    const samples = useMemo(() => {
      return {
        data: samplesQuery.data,
        onClick: onSampleClick,
        unit: parseMRI(firstQuery?.mri)?.unit ?? '',
        operation: firstQuery?.op ?? '',
        higlightedId: highlightedSampleId,
      };
    }, [
      samplesQuery.data,
      onSampleClick,
      firstQuery?.mri,
      firstQuery?.op,
      highlightedSampleId,
    ]);

    const widgetTitle = getWidgetTitle(queries);

    const queriesAreComplete = queries.every(q =>
      isMetricFormula(q) ? !!q.formula : !!q.mri
    );

    return (
      <MetricWidgetPanel
        // show the selection border only if we have more widgets than one
        isHighlighted={isSelected && !!hasSiblings}
        isHighlightable={!!hasSiblings}
        onClick={() => onSelect?.(index)}
      >
        <PanelBody>
          <MetricWidgetHeader>
            {showQuerySymbols && queryId !== undefined && (
              <QuerySymbol queryId={queryId} isSelected={isSelected} />
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
                getDefaultMetricDisplayType(firstQuery?.mri, firstQuery?.op)
              }
              options={metricDisplayTypeOptions}
              onChange={handleDisplayTypeChange}
            />
          </MetricWidgetHeader>
          <MetricWidgetBodyWrapper>
            {queriesAreComplete ? (
              <MetricWidgetBody
                widgetIndex={index}
                getChartPalette={getChartPalette}
                onChange={handleChange}
                focusArea={focusArea}
                samples={samples}
                chartHeight={chartHeight}
                chartGroup={DDM_CHART_GROUP}
                queries={queries}
                filters={filters}
                displayType={displayType}
                tableSort={tableSort}
                focusedSeries={focusedSeries}
                context={context}
              />
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
  queries: MetricsQueryApiQueryParams[];
  widgetIndex: number;
  chartGroup?: string;
  chartHeight?: number;
  focusArea?: FocusAreaProps;
  focusedSeries?: FocusedMetricsSeries[];
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  onChange?: (data: Partial<MetricWidgetQueryParams>) => void;
  samples?: SamplesProps;
  tableSort?: SortState;
}

export interface SamplesProps {
  operation: string;
  unit: string;
  data?: MetricCorrelation[];
  higlightedId?: string;
  onClick?: (sample: Sample) => void;
}

const MetricWidgetBody = memo(
  ({
    onChange,
    displayType,
    focusedSeries,
    tableSort,
    widgetIndex,
    getChartPalette = createChartPalette,
    focusArea,
    chartHeight,
    chartGroup,
    samples,
    filters,
    queries,
    context,
  }: MetricWidgetBodyProps) => {
    const {
      data: timeseriesData,
      isLoading,
      isError,
      error,
    } = useMetricsQuery(queries, filters, {
      intervalLadder: displayType === MetricDisplayType.BAR ? 'bar' : context,
    });

    const chartRef = useRef<ReactEchartsRef>(null);

    const setHoveredSeries = useCallback((seriesId: string) => {
      if (!chartRef.current) {
        return;
      }
      const echartsInstance = chartRef.current.getEchartsInstance();
      echartsInstance.dispatchAction({
        type: 'highlight',
        seriesId: [seriesId, getIngestionSeriesId(seriesId)],
      });
    }, []);

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
      highlightedSampleId: samples?.higlightedId,
      operation: samples?.operation,
      timeseries: chartSeries,
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
              {error?.responseJSON?.detail || t('Error while fetching metrics data')}
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
          widgetIndex={widgetIndex}
          height={chartHeight}
          samples={samplesProp}
          focusArea={focusArea}
          group={chartGroup}
        />
        <SummaryTable
          series={chartSeries}
          onSortChange={handleSortChange}
          sort={tableSort}
          onRowClick={setSeriesVisibility}
          onColorDotClick={toggleSeriesVisibility}
          setHoveredSeries={setHoveredSeries}
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
    const isMultiQuery = filteredQueries.length > 1;

    let unit = '';
    let operation = '';
    if (!isMetricFormula(query)) {
      const parsed = parseMRI(query.mri);
      unit = parsed?.unit ?? '';
      operation = query.op ?? '';
    } else {
      // Treat formulas as if they were a single query with none as the unit and count as the operation
      unit = 'none';
      operation = 'count';
    }

    // We normalize metric units to make related units
    // (e.g. seconds & milliseconds) render in the correct ratio
    const normalizedUnit = getNormalizedMetricUnit(unit, operation);
    const normalizeValue = getMetricValueNormalizer(unit, operation);

    return group.map(entry => ({
      unit: normalizedUnit,
      operation: operation,
      values: entry.series.map(normalizeValue),
      name: getMetricsSeriesName(query, entry.by, isMultiQuery),
      id: getMetricsSeriesId(query, entry.by),
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
    operation: item.operation,
    color: chartPalette[item.id],
    hidden: focusedSeries && focusedSeries.size > 0 && !focusedSeries.has(item.id),
    data: item.values.map((value, index) => ({
      name: moment(data.intervals[index]).valueOf(),
      value,
    })),
    transaction: item.transaction as string | undefined,
    release: item.release as string | undefined,
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
