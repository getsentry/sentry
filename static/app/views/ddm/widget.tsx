import {memo, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import colorFn from 'color';
import type {LineSeriesOption} from 'echarts';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricsApiResponse, MRI, PageFilters} from 'sentry/types';
import {ReactEchartsRef} from 'sentry/types/echarts';
import {
  getDefaultMetricDisplayType,
  getSeriesName,
  MetricDisplayType,
  metricDisplayTypeOptions,
  MetricWidgetQueryParams,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {useIncrementQueryMetric} from 'sentry/utils/metrics/useIncrementQueryMetric';
import {useMetricsDataZoom} from 'sentry/utils/metrics/useMetricsData';
import theme from 'sentry/utils/theme';
import {MetricChart} from 'sentry/views/ddm/chart';
import {FocusArea} from 'sentry/views/ddm/chartBrush';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';

import {MIN_WIDGET_WIDTH} from './constants';

type MetricWidgetProps = {
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
  projects: PageFilters['projects'];
  widget: MetricWidgetQueryParams;
  addFocusArea?: (area: FocusArea) => void;
  focusArea?: FocusArea | null;
  hasSiblings?: boolean;
  index?: number;
  isSelected?: boolean;
  onSelect?: (index: number) => void;
  removeFocusArea?: () => void;
  showQuerySymbols?: boolean;
};

export const MetricWidget = memo(
  ({
    widget,
    datetime,
    projects,
    environments,
    index = 0,
    isSelected = false,
    onSelect,
    onChange,
    hasSiblings = false,
    addFocusArea,
    removeFocusArea,
    showQuerySymbols,
    focusArea = null,
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
            {showQuerySymbols && <QuerySymbol index={index} />}
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
                environments={environments}
                onChange={handleChange}
                addFocusArea={addFocusArea}
                focusArea={focusArea}
                removeFocusArea={removeFocusArea}
                chartHeight={300}
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
  focusArea: FocusArea | null;
  widgetIndex: number;
  addFocusArea?: (area: FocusArea) => void;
  chartHeight?: number;
  onChange?: (data: Partial<MetricWidgetQueryParams>) => void;
  removeFocusArea?: () => void;
}

export const MetricWidgetBody = memo(
  ({
    onChange,
    displayType,
    focusedSeries,
    sort,
    widgetIndex,
    addFocusArea,
    focusArea,
    removeFocusArea,
    chartHeight,
    ...metricsQuery
  }: MetricWidgetBodyProps & PageFilters) => {
    const {mri, op, query, groupBy, projects, environments, datetime} = metricsQuery;

    const {data, isLoading, isError, error} = useMetricsDataZoom(
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

    const toggleSeriesVisibility = useCallback(
      (series: MetricWidgetQueryParams['focusedSeries']) => {
        setHoveredSeries('');
        onChange?.({
          focusedSeries:
            focusedSeries?.seriesName === series?.seriesName ? undefined : series,
        });
      },
      [focusedSeries, onChange, setHoveredSeries]
    );

    const chartSeries = useMemo(() => {
      return (
        data &&
        getChartSeries(data, {
          mri,
          focusedSeries: focusedSeries?.seriesName,
          groupBy: metricsQuery.groupBy,
          displayType,
        })
      );
    }, [data, displayType, focusedSeries, metricsQuery.groupBy, mri]);

    const handleSortChange = useCallback(
      newSort => {
        onChange?.({sort: newSort});
      },
      [onChange]
    );

    if (!chartSeries || !data || isError) {
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

    if (data.groups.length === 0) {
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
          addFocusArea={addFocusArea}
          focusArea={focusArea}
          removeFocusArea={removeFocusArea}
          height={chartHeight}
        />
        {metricsQuery.showSummaryTable && (
          <SummaryTable
            series={chartSeries}
            onSortChange={handleSortChange}
            sort={sort}
            operation={metricsQuery.op}
            onRowClick={toggleSeriesVisibility}
            setHoveredSeries={focusedSeries ? undefined : setHoveredSeries}
          />
        )}
      </StyledMetricWidgetBody>
    );
  }
);

export function getChartSeries(
  data: MetricsApiResponse,
  {
    mri,
    focusedSeries,
    groupBy,
    hoveredLegend,
    displayType,
  }: {
    displayType: MetricDisplayType;
    mri: MRI;
    focusedSeries?: string;
    groupBy?: string[];
    hoveredLegend?: string;
  }
) {
  // this assumes that all series have the same unit
  const parsed = parseMRI(mri);
  const unit = parsed?.unit ?? '';

  const series = data.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getSeriesName(g, data.groups.length === 1, groupBy),
      groupBy: g.by,
      transaction: g.by.transaction,
      release: g.by.release,
    };
  });

  const colors = getChartColorPalette(displayType, series.length);

  return sortSeries(series, displayType).map((item, i) => ({
    seriesName: item.name,
    groupBy: item.groupBy,
    unit,
    color: colorFn(colors[i % colors.length])
      .alpha(hoveredLegend && hoveredLegend !== item.name ? 0.1 : 1)
      .string(),
    hidden: focusedSeries && focusedSeries !== item.name,
    data: item.values.map((value, index) => ({
      name: moment(data.intervals[index]).valueOf(),
      value,
    })),
    transaction: item.transaction as string | undefined,
    release: item.release as string | undefined,
    emphasis: {
      focus: 'series',
    } as LineSeriesOption['emphasis'],
  })) as Series[];
}

function sortSeries(
  series: {
    groupBy: Record<string, string>;
    name: string;
    release: string;
    transaction: string;
    values: (number | null)[];
  }[],
  displayType: MetricDisplayType
) {
  const sorted = series
    // we need to sort the series by their values so that the colors in area chart do not overlap
    // for now we are only sorting by the first value, but we might need to sort by the sum of all values
    .sort((a, b) => {
      return Number(a.values?.[0]) > Number(b.values?.[0]) ? -1 : 1;
    });

  if (displayType === MetricDisplayType.BAR) {
    return sorted.toReversed();
  }

  return sorted;
}

function getChartColorPalette(displayType: MetricDisplayType, length: number) {
  // We do length - 2 to be aligned with the colors in other parts of the app (copy-pasta)
  // We use Math.max to avoid numbers < -1 as then `getColorPalette` returns undefined (not typesafe because of array access)
  const palette = theme.charts.getColorPalette(Math.max(length - 2, -1));

  if (displayType === MetricDisplayType.BAR) {
    return palette;
  }

  return palette.toReversed();
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
