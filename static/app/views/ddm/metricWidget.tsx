import {Fragment, useEffect, useRef, useState} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import colorFn from 'color';
import type {LineSeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import Legend from 'sentry/components/charts/components/legend';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {RELEASE_LINES_THRESHOLD} from 'sentry/components/charts/utils';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconAdd, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {ReactEchartsRef} from 'sentry/types/echarts';
import {
  defaultMetricDisplayType,
  formatMetricsUsingUnitAndOp,
  getNameFromMRI,
  getUnitFromMRI,
  MetricDisplayType,
  MetricsData,
  MetricsDataProps,
  MetricsQuery,
  updateQuery,
  useMetricsData,
} from 'sentry/utils/metrics';
import {decodeList} from 'sentry/utils/queryString';
import theme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {QueryBuilder} from 'sentry/views/ddm/metricQueryBuilder';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';

import {getFormatter} from '../../components/charts/components/tooltip';

const DDM_CHART_GROUP = 'ddm_chart_group';

const emptyWidget = {
  mri: '',
  op: undefined,
  query: '',
  groupBy: [],
  displayType: defaultMetricDisplayType,
};

export type MetricWidgetDisplayConfig = {
  displayType: MetricDisplayType;
  onChange: (data: Partial<MetricWidgetProps>) => void;
  position: number;
  focusedSeries?: string;
  powerUserMode?: boolean;
  showSummaryTable?: boolean;
};

export type MetricWidgetProps = MetricsQuery & MetricWidgetDisplayConfig;

function useMetricWidgets() {
  const router = useRouter();

  const currentWidgets = JSON.parse(
    router.location.query.widgets ?? JSON.stringify([emptyWidget])
  );

  const widgets: MetricWidgetProps[] = currentWidgets.map(
    (widget: MetricWidgetProps, i) => {
      return {
        mri: widget.mri,
        op: widget.op,
        query: widget.query,
        groupBy: decodeList(widget.groupBy),
        displayType: widget.displayType ?? defaultMetricDisplayType,
        focusedSeries: widget.focusedSeries,
        showSummaryTable: widget.showSummaryTable ?? true, // temporary default
        position: widget.position ?? i,
        powerUserMode: widget.powerUserMode,
      };
    }
  );

  const onChange = (position: number, data: Partial<MetricWidgetProps>) => {
    currentWidgets[position] = {...currentWidgets[position], ...data};

    updateQuery(router, {
      widgets: JSON.stringify(currentWidgets),
    });
  };

  const addWidget = () => {
    currentWidgets.push({...emptyWidget, position: currentWidgets.length});

    updateQuery(router, {
      widgets: JSON.stringify(currentWidgets),
    });
  };

  return {
    widgets,
    onChange,
    addWidget,
  };
}

function MetricDashboard() {
  const {widgets, onChange, addWidget} = useMetricWidgets();
  const {selection} = usePageFilters();

  const Wrapper =
    widgets.length === 1 ? StyledSingleWidgetWrapper : StyledMetricDashboard;

  echarts.connect(DDM_CHART_GROUP);

  return (
    <Wrapper>
      {widgets.map(widget => (
        <MetricWidget
          key={widget.position}
          widget={{
            ...widget,
            onChange: data => {
              onChange(widget.position, data);
            },
          }}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
        />
      ))}
      <AddWidgetPanel onClick={addWidget}>
        <Button priority="primary" icon={<IconAdd isCircled />}>
          Add widget
        </Button>
      </AddWidgetPanel>
    </Wrapper>
  );
}

// TODO(ddm): reuse from types/metrics.tsx
type Group = {
  by: Record<string, unknown>;
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

type DisplayProps = MetricWidgetProps & MetricsDataProps;

export function MetricWidget({
  widget,
  datetime,
  projects,
  environments,
}: {
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  projects: PageFilters['projects'];
  widget: MetricWidgetProps;
}) {
  return (
    <MetricWidgetPanel key={widget.position}>
      <PanelBody>
        <QueryBuilder
          metricsQuery={{
            mri: widget.mri,
            query: widget.query,
            op: widget.op,
            groupBy: widget.groupBy,
          }}
          projects={projects}
          displayType={widget.displayType}
          onChange={widget.onChange}
          powerUserMode={widget.powerUserMode}
        />
        <MetricWidgetBody
          datetime={datetime}
          projects={projects}
          environments={environments}
          {...widget}
        />
      </PanelBody>
    </MetricWidgetPanel>
  );
}

function MetricWidgetBody(props?: DisplayProps) {
  if (!props?.mri) {
    return (
      <StyledMetricWidgetBody>
        <EmptyMessage
          icon={<IconSearch size="xxl" />}
          title={t('Nothing to show!')}
          description={t('Choose a metric to display data.')}
        />
      </StyledMetricWidgetBody>
    );
  }

  return <MetricWidgetBodyInner {...props} />;
}

function MetricWidgetBodyInner({
  onChange,
  displayType,
  focusedSeries,
  ...metricsDataProps
}: DisplayProps) {
  const {data, isLoading, isError, error} = useMetricsData(metricsDataProps);

  const [dataToBeRendered, setDataToBeRendered] = useState<MetricsData | undefined>(
    undefined
  );

  const [hoveredLegend, setHoveredLegend] = useState('');

  useEffect(() => {
    if (data) {
      setDataToBeRendered(data);
    }
  }, [data]);

  const toggleSeriesVisibility = (seriesName: string) => {
    setHoveredLegend('');
    onChange({
      focusedSeries: focusedSeries === seriesName ? undefined : seriesName,
    });
  };

  if (!dataToBeRendered || isError) {
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

  // TODO(ddm): we should move this into the useMetricsData hook
  const sorted = sortData(dataToBeRendered);
  const unit = getUnitFromMRI(Object.keys(dataToBeRendered.groups[0]?.series ?? {})[0]); // this assumes that all series have the same unit

  const series = sorted.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getSeriesName(
        g,
        dataToBeRendered.groups.length === 1,
        metricsDataProps.groupBy
      ),
      transaction: g.by.transaction,
      release: g.by.release,
    };
  });

  const colors = theme.charts.getColorPalette(series.length);

  const chartSeries = series.map((item, i) => ({
    seriesName: item.name,
    unit,
    color: colorFn(colors[i])
      .alpha(hoveredLegend && hoveredLegend !== item.name ? 0.1 : 1)
      .string(),
    hidden: focusedSeries && focusedSeries !== item.name,
    data: item.values.map((value, index) => ({
      name: sorted.intervals[index],
      value,
    })),
    transaction: item.transaction as string | undefined,
    release: item.release as string | undefined,
    emphasis: {
      focus: 'series',
    } as LineSeriesOption['emphasis'],
  })) as Series[];

  return (
    <StyledMetricWidgetBody>
      <TransparentLoadingMask visible={isLoading} />
      <MetricChart
        series={chartSeries}
        displayType={displayType}
        operation={metricsDataProps.op}
        projects={metricsDataProps.projects}
        environments={metricsDataProps.environments}
        {...normalizeChartTimeParams(sorted)}
      />
      {metricsDataProps.showSummaryTable && (
        <SummaryTable
          series={chartSeries}
          operation={metricsDataProps.op}
          onClick={toggleSeriesVisibility}
          setHoveredLegend={focusedSeries ? undefined : setHoveredLegend}
        />
      )}
    </StyledMetricWidgetBody>
  );
}

function getSeriesName(
  group: Group,
  isOnlyGroup = false,
  groupBy: MetricsDataProps['groupBy']
) {
  if (isOnlyGroup && !groupBy?.length) {
    return Object.keys(group.series)?.[0] ?? '(none)';
  }

  return Object.entries(group.by)
    .map(([key, value]) => `${key}:${String(value).length ? value : t('none')}`)
    .join(', ');
}

function sortData(data: MetricsData): MetricsData {
  if (!data.groups.length) {
    return data;
  }

  const key = Object.keys(data.groups[0].totals)[0];

  const sortedGroups = data.groups.sort((a, b) =>
    a.totals[key] < b.totals[key] ? 1 : -1
  );

  return {
    ...data,
    groups: sortedGroups,
  };
}

function normalizeChartTimeParams(data: MetricsData) {
  const {
    start,
    end,
    utc: utcString,
    statsPeriod,
  } = normalizeDateTimeParams(data, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
  });

  const utc = utcString === 'true';

  if (start && end) {
    return utc
      ? {
          start: moment.utc(start).format(),
          end: moment.utc(end).format(),
          utc,
        }
      : {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
          utc,
        };
  }

  return {
    period: statsPeriod ?? '90d',
  };
}

export type Series = {
  color: string;
  data: {name: string; value: number}[];
  seriesName: string;
  unit: string;
  hidden?: boolean;
  release?: string;
  transaction?: string;
};

type ChartProps = {
  displayType: MetricDisplayType;
  environments: PageFilters['environments'];
  projects: PageFilters['projects'];
  series: Series[];
  end?: string;
  operation?: string;
  period?: string;
  start?: string;
  utc?: boolean;
};

function MetricChart({
  series,
  displayType,
  start,
  end,
  period,
  utc,
  operation,
  projects,
  environments,
}: ChartProps) {
  const chartRef = useRef<ReactEchartsRef>(null);

  useEffect(() => {
    const echartsInstance = chartRef?.current?.getEchartsInstance();
    if (echartsInstance && !echartsInstance.group) {
      echartsInstance.group = DDM_CHART_GROUP;
    }
  }, []);

  const unit = series[0]?.unit;
  const seriesToShow = series.filter(s => !s.hidden);

  const formatters = {
    valueFormatter: (value: number) => {
      return formatMetricsUsingUnitAndOp(value, unit, operation);
    },
    nameFormatter: mri => getNameFromMRI(mri),
  };

  const chartProps = {
    forwardedRef: chartRef,
    isGroupedByDate: true,
    height: 300,
    colors: seriesToShow.map(s => s.color),
    grid: {top: 20, bottom: 20, left: 15, right: 25},
    tooltip: {
      formatter: (params, asyncTicket) => {
        const hoveredEchartElement = Array.from(document.querySelectorAll(':hover')).find(
          element => {
            return element.classList.contains('echarts-for-react');
          }
        );

        if (hoveredEchartElement === chartRef?.current?.ele) {
          return getFormatter(formatters)(params, asyncTicket);
        }
        return '';
      },
      axisPointer: {
        label: {show: true},
      },
      ...formatters,
    },

    yAxis: {
      axisLabel: {
        formatter: (value: number) => {
          return formatMetricsUsingUnitAndOp(value, unit, operation);
        },
      },
    },
  };

  return (
    <Fragment>
      <ChartZoom period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <ReleaseSeries
            utc={utc}
            period={period}
            start={zoomRenderProps.start!}
            end={zoomRenderProps.end!}
            projects={projects}
            environments={environments}
            preserveQueryParams
          >
            {({releaseSeries}) => {
              const releaseSeriesData = releaseSeries?.[0]?.markLine?.data ?? [];

              const selected =
                releaseSeriesData?.length >= RELEASE_LINES_THRESHOLD
                  ? {[t('Releases')]: false}
                  : {};

              const legend = releaseSeriesData?.length
                ? Legend({
                    itemGap: 20,
                    top: 0,
                    right: 20,
                    data: releaseSeries.map(s => s.seriesName),
                    theme: theme as Theme,
                    selected,
                  })
                : undefined;

              const allProps = {
                series: [...seriesToShow, ...releaseSeries],
                legend,
                ...chartProps,
                ...zoomRenderProps,
              };

              return displayType === MetricDisplayType.LINE ? (
                <LineChart {...allProps} />
              ) : displayType === MetricDisplayType.AREA ? (
                <AreaChart {...allProps} />
              ) : (
                <BarChart stacked {...allProps} />
              );
            }}
          </ReleaseSeries>
        )}
      </ChartZoom>
    </Fragment>
  );
}

const minWidgetWidth = 400;

const MetricWidgetPanel = styled(Panel)`
  padding-bottom: 0;
  margin-bottom: 0;
  min-width: ${minWidgetWidth};
`;

const StyledMetricWidgetBody = styled('div')`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const StyledMetricDashboard = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(${minWidgetWidth}px, 1fr));
  gap: ${space(2)};
  @media (max-width: ${props => props.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(2, minmax(${minWidgetWidth}px, 1fr));
  }
  @media (max-width: ${props => props.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(1, minmax(${minWidgetWidth}px, 1fr));
  }
`;

const StyledSingleWidgetWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const AddWidgetPanel = styled(MetricWidgetPanel)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(4)};
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
    cursor: pointer;
  }
`;

export default MetricDashboard;
