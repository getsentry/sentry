import {memo, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
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
import type {MetricsApiResponse, MRI, PageFilters} from 'sentry/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {
  getDefaultMetricDisplayType,
  getMetricsSeriesName,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {metricDisplayTypeOptions} from 'sentry/utils/metrics/constants';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {
  FocusedMetricsSeries,
  MetricCorrelation,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricSamples} from 'sentry/utils/metrics/useMetricsCorrelations';
import {useMetricsDataZoom} from 'sentry/utils/metrics/useMetricsData';
import {MetricChart} from 'sentry/views/ddm/chart';
import type {FocusAreaProps} from 'sentry/views/ddm/context';
import {createChartPalette} from 'sentry/views/ddm/metricsChartPalette';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';
import {getQueryWithFocusedSeries} from 'sentry/views/ddm/utils';

import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from './constants';

type MetricWidgetProps = {
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  projects: PageFilters['projects'];
  widget: MetricWidgetQueryParams;
  focusArea?: FocusAreaProps;
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  hasSiblings?: boolean;
  highlightedSampleId?: string;
  index?: number;
  isSelected?: boolean;
  onSampleClick?: (sample: Sample) => void;
  onSelect?: (index: number) => void;
  showQuerySymbols?: boolean;
};

export type Sample = {
  projectId: number;
  spanId: string;
  transactionId: string;
  transactionSpanId: string;
};

export const MetricWidget = memo(
  ({
    widget,
    datetime,
    projects,
    environments,
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
  }: MetricWidgetProps) => {
    const handleChange = useCallback(
      (data: Partial<MetricWidgetQueryParams>) => {
        onChange(index, data);
      },
      [index, onChange]
    );

    const metricsQuery = useMemo(
      () => ({
        mri: widget.mri,
        query: widget.query,
        op: widget.op,
        groupBy: widget.groupBy,
        projects,
        datetime,
        environments,
        title: widget.title,
      }),
      [
        widget.mri,
        widget.query,
        widget.op,
        widget.groupBy,
        widget.title,
        projects,
        datetime,
        environments,
      ]
    );

    const incrementQueryMetric = useIncrementQueryMetric({
      displayType: widget.displayType,
      op: metricsQuery.op,
      groupBy: metricsQuery.groupBy,
      query: metricsQuery.query,
      mri: metricsQuery.mri,
    });

    const handleDisplayTypeChange = ({value}: SelectOption<MetricDisplayType>) => {
      incrementQueryMetric('ddm.widget.display', {displayType: value});
      onChange(index, {displayType: value});
    };

    const queryWithFocusedSeries = useMemo(
      () => getQueryWithFocusedSeries(widget),
      [widget]
    );

    const samplesQuery = useMetricSamples(metricsQuery.mri, {
      ...focusArea?.selection?.range,
      query: queryWithFocusedSeries,
    });

    const samples = useMemo(() => {
      return {
        data: samplesQuery.data,
        onClick: onSampleClick,
        higlightedId: highlightedSampleId,
      };
    }, [samplesQuery.data, onSampleClick, highlightedSampleId]);

    const widgetTitle = metricsQuery.title ?? stringifyMetricWidget(metricsQuery);

    return (
      <MetricWidgetPanel
        // show the selection border only if we have more widgets than one
        isHighlighted={isSelected && !!hasSiblings}
        isHighlightable={!!hasSiblings}
        onClick={() => onSelect?.(index)}
      >
        <PanelBody>
          <MetricWidgetHeader>
            {showQuerySymbols && <QuerySymbol index={index} isSelected={isSelected} />}
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
                widget.displayType ??
                getDefaultMetricDisplayType(metricsQuery.mri, metricsQuery.op)
              }
              options={metricDisplayTypeOptions}
              onChange={handleDisplayTypeChange}
            />
          </MetricWidgetHeader>
          <MetricWidgetBodyWrapper>
            {widget.mri ? (
              <MetricWidgetBody
                widgetIndex={index}
                datetime={datetime}
                projects={projects}
                getChartPalette={getChartPalette}
                environments={environments}
                onChange={handleChange}
                focusArea={focusArea}
                samples={samples}
                chartHeight={300}
                chartGroup={DDM_CHART_GROUP}
                {...widget}
              />
            ) : (
              <StyledMetricWidgetBody>
                <EmptyMessage
                  icon={<IconSearch size="xxl" />}
                  title={t('Nothing to show!')}
                  description={t('Choose a metric to display data.')}
                />
              </StyledMetricWidgetBody>
            )}
          </MetricWidgetBodyWrapper>
        </PanelBody>
      </MetricWidgetPanel>
    );
  }
);

interface MetricWidgetBodyProps extends MetricWidgetQueryParams {
  widgetIndex: number;
  chartGroup?: string;
  chartHeight?: number;
  focusArea?: FocusAreaProps;
  getChartPalette?: (seriesNames: string[]) => Record<string, string>;
  onChange?: (data: Partial<MetricWidgetQueryParams>) => void;
  samples?: SamplesProps;
}

export interface SamplesProps {
  data?: MetricCorrelation[];
  higlightedId?: string;
  onClick?: (sample: Sample) => void;
}

const MetricWidgetBody = memo(
  ({
    onChange,
    displayType,
    focusedSeries,
    sort,
    widgetIndex,
    getChartPalette = createChartPalette,
    focusArea,
    chartHeight,
    chartGroup,
    samples,
    ...metricsQuery
  }: MetricWidgetBodyProps & PageFilters) => {
    const {mri, op, query, groupBy, projects, environments, datetime} = metricsQuery;

    const {
      data: timeseriesData,
      isLoading,
      isError,
      error,
    } = useMetricsDataZoom(
      {
        mri,
        op,
        query,
        groupBy,
        projects,
        environments,
        datetime,
      },
      {fidelity: displayType === MetricDisplayType.BAR ? 'low' : 'high'}
    );

    const chartRef = useRef<ReactEchartsRef>(null);

    const setHoveredSeries = useCallback((legend: string) => {
      if (!chartRef.current) {
        return;
      }
      const echartsInstance = chartRef.current.getEchartsInstance();
      echartsInstance.dispatchAction({
        type: 'highlight',
        seriesName: legend,
      });
    }, []);

    const chartSeries = useMemo(() => {
      return timeseriesData
        ? getChartTimeseries(timeseriesData, {
            getChartPalette,
            mri,
            focusedSeries:
              focusedSeries && new Set(focusedSeries?.map(s => s.seriesName)),
          })
        : [];
    }, [timeseriesData, getChartPalette, mri, focusedSeries]);

    const toggleSeriesVisibility = useCallback(
      (series: FocusedMetricsSeries) => {
        setHoveredSeries('');

        // The focused series array is not populated yet, so we can add all series except the one that was de-selected
        if (!focusedSeries || focusedSeries.length === 0) {
          onChange?.({
            focusedSeries: chartSeries
              .filter(s => s.seriesName !== series.seriesName)
              .map(s => ({
                seriesName: s.seriesName,
                groupBy: s.groupBy,
              })),
          });
          return;
        }

        const filteredSeries = focusedSeries.filter(
          s => s.seriesName !== series.seriesName
        );

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
        if (
          focusedSeries?.length === 1 &&
          focusedSeries[0].seriesName === series.seriesName
        ) {
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

    if (timeseriesData.groups.length === 0) {
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
          operation={metricsQuery.op}
          widgetIndex={widgetIndex}
          height={chartHeight}
          scatter={samples}
          focusArea={focusArea}
          group={chartGroup}
        />
        {metricsQuery.showSummaryTable && (
          <SummaryTable
            series={chartSeries}
            onSortChange={handleSortChange}
            sort={sort}
            operation={metricsQuery.op}
            onRowClick={setSeriesVisibility}
            onColorDotClick={toggleSeriesVisibility}
            setHoveredSeries={setHoveredSeries}
          />
        )}
      </StyledMetricWidgetBody>
    );
  }
);

export function getChartTimeseries(
  data: MetricsApiResponse,
  {
    getChartPalette,
    mri,
    focusedSeries,
  }: {
    getChartPalette: (seriesNames: string[]) => Record<string, string>;
    mri: MRI;
    focusedSeries?: Set<string>;
  }
) {
  // this assumes that all series have the same unit
  const parsed = parseMRI(mri);
  const unit = parsed?.unit ?? '';

  const series = data.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getMetricsSeriesName(g),
      groupBy: g.by,
      transaction: g.by.transaction,
      release: g.by.release,
    };
  });

  const chartPalette = getChartPalette(series.map(s => s.name));

  return series.map(item => ({
    seriesName: item.name,
    groupBy: item.groupBy,
    unit,
    color: chartPalette[item.name],
    hidden: focusedSeries && focusedSeries.size > 0 && !focusedSeries.has(item.name),
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

export type Series = {
  color: string;
  data: {name: number; value: number}[];
  seriesName: string;
  unit: string;
  groupBy?: Record<string, string>;
  hidden?: boolean;
  release?: string;
  transaction?: string;
};

export interface ScatterSeries extends Series {
  itemStyle: {
    color: string;
    opacity: number;
  };
  projectId: number;
  spanId: string;
  symbol: string;
  symbolSize: number;
  transactionId: string;
  z: number;
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
  padding-bottom: 0;
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
