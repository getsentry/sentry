import * as React from 'react';
import {InjectedRouter} from 'react-router';
import {Theme, withTheme} from '@emotion/react';
import type {
  EChartsOption,
  LegendComponentOption,
  LineSeriesOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';
import {Query} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import {BarChart, BarChartProps} from 'sentry/components/charts/barChart';
import ChartZoom, {ZoomRenderProps} from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {
  getInterval,
  processTableResults,
  RELEASE_LINES_THRESHOLD,
} from 'sentry/components/charts/utils';
import {WorldMapChart, WorldMapChartProps} from 'sentry/components/charts/worldMapChart';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DateString, OrganizationSummary} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  axisLabelFormatterUsingAggregateOutputType,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {
  aggregateMultiPlotType,
  aggregateOutputType,
  AggregationOutputType,
  getEquation,
  isEquation,
} from 'sentry/utils/discover/fields';
import {decodeList} from 'sentry/utils/queryString';

import EventsGeoRequest from './eventsGeoRequest';
import EventsRequest from './eventsRequest';

type ChartComponent =
  | React.ComponentType<BarChartProps>
  | React.ComponentType<AreaChartProps>
  | React.ComponentType<LineChartProps>
  | React.ComponentType<WorldMapChartProps>;

type ChartProps = {
  currentSeriesNames: string[];
  loading: boolean;
  previousSeriesNames: string[];
  reloading: boolean;
  stacked: boolean;
  tableData: TableDataWithTitle[];
  theme: Theme;
  timeseriesData: Series[];
  yAxis: string;
  zoomRenderProps: ZoomRenderProps;
  additionalSeries?: LineSeriesOption[];
  chartComponent?: ChartComponent;
  chartOptions?: Omit<EChartsOption, 'xAxis' | 'yAxis'> & {
    xAxis?: XAXisComponentOption;
    yAxis?: YAXisComponentOption;
  };
  colors?: string[];
  /**
   * By default, only the release series is disableable. This adds
   * a list of series names that are also disableable.
   */
  disableableSeries?: string[];
  fromDiscover?: boolean;
  height?: number;
  interval?: string;
  legendOptions?: LegendComponentOption;
  minutesThresholdToDisplaySeconds?: number;
  previousSeriesTransformer?: (series?: Series | null) => Series | null | undefined;
  previousTimeseriesData?: Series[] | null;
  referrer?: string;
  releaseSeries?: Series[];
  /**
   * A callback to allow for post-processing of the series data.
   * Can be used to rename series or even insert a new series.
   */
  seriesTransformer?: (series: Series[]) => Series[];
  showDaily?: boolean;
  showLegend?: boolean;
  timeframe?: {end: number; start: number};
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  topEvents?: number;
};

type State = {
  forceUpdate: boolean;
  seriesSelection: Record<string, boolean>;
};

class Chart extends React.Component<ChartProps, State> {
  state: State = {
    seriesSelection: {},
    forceUpdate: false,
  };

  shouldComponentUpdate(nextProps: ChartProps, nextState: State) {
    if (nextState.forceUpdate) {
      return true;
    }

    if (!isEqual(this.state.seriesSelection, nextState.seriesSelection)) {
      return true;
    }

    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries) &&
      isEqual(this.props.previousTimeseriesData, nextProps.previousTimeseriesData) &&
      isEqual(this.props.tableData, nextProps.tableData) &&
      isEqual(this.props.additionalSeries, nextProps.additionalSeries)
    ) {
      return false;
    }

    return true;
  }

  getChartComponent(): ChartComponent {
    const {showDaily, timeseriesData, yAxis, chartComponent} = this.props;

    if (defined(chartComponent)) {
      return chartComponent;
    }

    if (showDaily) {
      return BarChart;
    }

    if (timeseriesData.length > 1) {
      switch (aggregateMultiPlotType(yAxis)) {
        case 'line':
          return LineChart;
        case 'area':
          return AreaChart;
        default:
          throw new Error(`Unknown multi plot type for ${yAxis}`);
      }
    }

    return AreaChart;
  }

  handleLegendSelectChanged = legendChange => {
    const {disableableSeries = []} = this.props;
    const {selected} = legendChange;
    const seriesSelection = Object.keys(selected).reduce((state, key) => {
      // we only want them to be able to disable the Releases&Other series,
      // and not any of the other possible series here
      const disableable =
        ['Releases', 'Other'].includes(key) || disableableSeries.includes(key);
      state[key] = disableable ? selected[key] : true;
      return state;
    }, {});

    // we have to force an update here otherwise ECharts will
    // update its internal state and disable the series
    this.setState({seriesSelection, forceUpdate: true}, () =>
      this.setState({forceUpdate: false})
    );
  };

  render() {
    const {
      theme,
      loading: _loading,
      reloading: _reloading,
      yAxis,
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      legendOptions,
      chartOptions: chartOptionsProp,
      currentSeriesNames,
      previousSeriesNames,
      seriesTransformer,
      previousSeriesTransformer,
      colors,
      height,
      timeframe,
      topEvents,
      tableData,
      fromDiscover,
      timeseriesResultsTypes,
      additionalSeries,
      ...props
    } = this.props;
    const {seriesSelection} = this.state;

    let Component = this.getChartComponent();

    if (Component === WorldMapChart) {
      const {data, title} = processTableResults(tableData);
      const tableSeries = [
        {
          seriesName: title,
          data,
        },
      ];
      return <WorldMapChart series={tableSeries} fromDiscover={fromDiscover} />;
    }

    Component = Component as Exclude<
      ChartComponent,
      React.ComponentType<WorldMapChartProps>
    >;

    const data = [
      ...(currentSeriesNames.length > 0 ? currentSeriesNames : [t('Current')]),
      ...(previousSeriesNames.length > 0 ? previousSeriesNames : [t('Previous')]),
      ...(additionalSeries ? additionalSeries.map(series => series.name as string) : []),
    ];

    const releasesLegend = t('Releases');

    const hasOther = topEvents && topEvents + 1 === timeseriesData.length;
    if (hasOther) {
      data.push('Other');
    }

    if (Array.isArray(releaseSeries)) {
      data.push(releasesLegend);
    }

    // Temporary fix to improve performance on pages with a high number of releases.
    const releases = releaseSeries && releaseSeries[0];
    const hideReleasesByDefault =
      Array.isArray(releaseSeries) &&
      (releases as any)?.markLine?.data &&
      (releases as any).markLine.data.length >= RELEASE_LINES_THRESHOLD;

    const selected = !Array.isArray(releaseSeries)
      ? seriesSelection
      : Object.keys(seriesSelection).length === 0 && hideReleasesByDefault
      ? {[releasesLegend]: false}
      : seriesSelection;

    const legend = showLegend
      ? {
          right: 16,
          top: 12,
          data,
          selected,
          ...(legendOptions ?? {}),
        }
      : undefined;

    let series = Array.isArray(releaseSeries)
      ? [...timeseriesData, ...releaseSeries]
      : timeseriesData;
    let previousSeries = previousTimeseriesData;

    if (seriesTransformer) {
      series = seriesTransformer(series);
    }

    if (previousSeriesTransformer) {
      previousSeries = previousSeries?.map(
        prev => previousSeriesTransformer(prev) as Series
      );
    }
    const chartColors = timeseriesData.length
      ? colors?.slice(0, series.length) ?? [
          ...theme.charts.getColorPalette(timeseriesData.length - 2 - (hasOther ? 1 : 0)),
        ]
      : undefined;
    if (chartColors && chartColors.length && hasOther) {
      chartColors.push(theme.chartOther);
    }
    const chartOptions = {
      colors: chartColors,
      grid: {
        left: '24px',
        right: '24px',
        top: '32px',
        bottom: '12px',
      },
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis' as const,
        truncate: 80,
        valueFormatter: (value: number, label?: string) => {
          const aggregateName = label
            ?.replace(/^previous /, '')
            .split(':')
            .pop()
            ?.trim();
          if (aggregateName) {
            return timeseriesResultsTypes
              ? tooltipFormatter(value, timeseriesResultsTypes[aggregateName])
              : tooltipFormatter(value, aggregateOutputType(aggregateName));
          }
          return tooltipFormatter(value, 'number');
        },
      },
      xAxis: timeframe
        ? {
            min: timeframe.start,
            max: timeframe.end,
          }
        : undefined,
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => {
            if (timeseriesResultsTypes) {
              // Check to see if all series output types are the same. If not, then default to number.
              const outputType =
                new Set(Object.values(timeseriesResultsTypes)).size === 1
                  ? timeseriesResultsTypes[yAxis]
                  : 'number';
              return axisLabelFormatterUsingAggregateOutputType(value, outputType);
            }
            return axisLabelFormatter(value, aggregateOutputType(yAxis));
          },
        },
      },
      ...(chartOptionsProp ?? {}),
      animation: typeof Component === typeof BarChart ? false : undefined,
    };

    return (
      <Component
        {...props}
        {...zoomRenderProps}
        {...chartOptions}
        legend={legend}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        series={series}
        previousPeriod={previousSeries ? previousSeries : undefined}
        height={height}
        additionalSeries={additionalSeries}
      />
    );
  }
}

const ThemedChart = withTheme(Chart);

export type EventsChartProps = {
  api: Client;
  /**
   * Absolute end date.
   */
  end: DateString;
  /**
   * Environment condition.
   */
  environments: string[];
  organization: OrganizationSummary;
  /**
   * Project ids
   */
  projects: number[];
  /**
   * The discover query string to find events with.
   */
  query: string;
  router: InjectedRouter;
  /**
   * Absolute start date.
   */
  start: DateString;
  /**
   * The aggregate/metric to plot.
   */
  yAxis: string | string[];
  additionalSeries?: LineSeriesOption[];
  /**
   * Markup for optional chart header
   */
  chartHeader?: React.ReactNode;
  /**
   * Override the default color palette.
   */
  colors?: string[];
  confirmedQuery?: boolean;
  /**
   * Name of the series
   */
  currentSeriesName?: string;
  /**
   * Don't show the previous period's data. Will automatically disable
   * when start/end are used.
   */
  disablePrevious?: boolean;
  /**
   * Don't show the release marklines.
   */
  disableReleases?: boolean;
  /**
   * A list of release names to visually emphasize. Can only be used when `disableReleases` is false.
   */
  emphasizeReleases?: string[];
  /**
   * The fields that act as grouping conditions when generating a topEvents chart.
   */
  field?: string[];
  /**
   * The interval resolution for a chart e.g. 1m, 5m, 1d
   */
  interval?: string;
  /**
   * Whether or not the request for processed baseline data has been resolved/terminated
   */
  loadingAdditionalSeries?: boolean;
  /**
   * Order condition when showing topEvents
   */
  orderby?: string;
  /**
   * Relative datetime expression. eg. 14d
   */
  period?: string | null;
  preserveReleaseQueryParams?: boolean;
  /**
   * Name of the previous series
   */
  previousSeriesName?: string;
  /**
   * A unique name for what's triggering this request, see organization_events_stats for an allowlist
   */
  referrer?: string;
  releaseQueryExtra?: Query;
  reloadingAdditionalSeries?: boolean;
  /**
   * Override the interval calculation and show daily results.
   */
  showDaily?: boolean;
  /**
   * Fetch n top events as dictated by the field and orderby props.
   */
  topEvents?: number;
  /**
   * Chart zoom will change 'pageStart' instead of 'start'
   */
  usePageZoom?: boolean;
  /**
   * Should datetimes be formatted in UTC?
   */
  utc?: boolean | null;
  /**
   * Whether or not to zerofill results
   */
  withoutZerofill?: boolean;
} & Pick<
  ChartProps,
  | 'seriesTransformer'
  | 'previousSeriesTransformer'
  | 'showLegend'
  | 'minutesThresholdToDisplaySeconds'
  | 'disableableSeries'
  | 'legendOptions'
  | 'chartOptions'
  | 'chartComponent'
  | 'height'
  | 'fromDiscover'
>;

type ChartDataProps = {
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  zoomRenderProps: ZoomRenderProps;
  previousTimeseriesData?: Series[] | null;
  releaseSeries?: Series[];
  results?: Series[];
  tableData?: TableDataWithTitle[];
  timeframe?: {end: number; start: number};
  timeseriesData?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  topEvents?: number;
};

class EventsChart extends React.Component<EventsChartProps> {
  isStacked() {
    const {topEvents, yAxis} = this.props;
    return (
      (typeof topEvents === 'number' && topEvents > 0) ||
      (Array.isArray(yAxis) && yAxis.length > 1)
    );
  }

  render() {
    const {
      api,
      organization,
      period,
      utc,
      query,
      router,
      start,
      end,
      projects,
      environments,
      showLegend,
      minutesThresholdToDisplaySeconds,
      yAxis,
      disablePrevious,
      disableReleases,
      emphasizeReleases,
      currentSeriesName: currentName,
      previousSeriesName: previousName,
      seriesTransformer,
      previousSeriesTransformer,
      field,
      interval,
      showDaily,
      topEvents,
      orderby,
      confirmedQuery,
      colors,
      chartHeader,
      legendOptions,
      chartOptions,
      preserveReleaseQueryParams,
      releaseQueryExtra,
      disableableSeries,
      chartComponent,
      usePageZoom,
      height,
      withoutZerofill,
      fromDiscover,
      additionalSeries,
      loadingAdditionalSeries,
      reloadingAdditionalSeries,
      ...props
    } = this.props;

    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const yAxisArray = decodeList(yAxis);
    const yAxisSeriesNames = yAxisArray.map(name => {
      let yAxisLabel = name && isEquation(name) ? getEquation(name) : name;
      if (yAxisLabel && yAxisLabel.length > 60) {
        yAxisLabel = yAxisLabel.substr(0, 60) + '...';
      }
      return yAxisLabel;
    });

    const previousSeriesNames = previousName
      ? [previousName]
      : yAxisSeriesNames.map(name => t('previous %s', name));
    const currentSeriesNames = currentName ? [currentName] : yAxisSeriesNames;

    const intervalVal = showDaily ? '1d' : interval || getInterval(this.props, 'high');

    let chartImplementation = ({
      zoomRenderProps,
      releaseSeries,
      errored,
      loading,
      reloading,
      results,
      timeseriesData,
      previousTimeseriesData,
      timeframe,
      tableData,
      timeseriesResultsTypes,
    }: ChartDataProps) => {
      if (errored) {
        return (
          <ErrorPanel>
            <IconWarning color="gray300" size="lg" />
          </ErrorPanel>
        );
      }
      const seriesData = results ? results : timeseriesData;

      return (
        <TransitionChart
          loading={loading}
          reloading={reloading || !!reloadingAdditionalSeries}
          height={height ? `${height}px` : undefined}
        >
          <TransparentLoadingMask visible={reloading || !!reloadingAdditionalSeries} />

          {React.isValidElement(chartHeader) && chartHeader}

          <ThemedChart
            zoomRenderProps={zoomRenderProps}
            loading={loading || !!loadingAdditionalSeries}
            reloading={reloading || !!reloadingAdditionalSeries}
            showLegend={showLegend}
            minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
            releaseSeries={releaseSeries || []}
            timeseriesData={seriesData ?? []}
            previousTimeseriesData={previousTimeseriesData}
            currentSeriesNames={currentSeriesNames}
            previousSeriesNames={previousSeriesNames}
            seriesTransformer={seriesTransformer}
            additionalSeries={additionalSeries}
            previousSeriesTransformer={previousSeriesTransformer}
            stacked={this.isStacked()}
            yAxis={yAxisArray[0]}
            showDaily={showDaily}
            colors={colors}
            legendOptions={legendOptions}
            chartOptions={chartOptions}
            disableableSeries={disableableSeries}
            chartComponent={chartComponent}
            height={height}
            timeframe={timeframe}
            topEvents={topEvents}
            tableData={tableData ?? []}
            fromDiscover={fromDiscover}
            timeseriesResultsTypes={timeseriesResultsTypes}
          />
        </TransitionChart>
      );
    };

    if (!disableReleases) {
      const previousChart = chartImplementation;
      chartImplementation = chartProps => (
        <ReleaseSeries
          utc={utc}
          period={period}
          start={start}
          end={end}
          projects={projects}
          environments={environments}
          emphasizeReleases={emphasizeReleases}
          preserveQueryParams={preserveReleaseQueryParams}
          queryExtra={releaseQueryExtra}
        >
          {({releaseSeries}) => previousChart({...chartProps, releaseSeries})}
        </ReleaseSeries>
      );
    }

    return (
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc}
        usePageDate={usePageZoom}
        {...props}
      >
        {zoomRenderProps => {
          if (chartComponent === WorldMapChart) {
            return (
              <EventsGeoRequest
                api={api}
                organization={organization}
                yAxis={yAxis}
                query={query}
                orderby={orderby}
                projects={projects}
                period={period}
                start={start}
                end={end}
                environments={environments}
                referrer={props.referrer}
              >
                {({errored, loading, reloading, tableData}) =>
                  chartImplementation({
                    errored,
                    loading,
                    reloading,
                    zoomRenderProps,
                    tableData,
                  })
                }
              </EventsGeoRequest>
            );
          }
          return (
            <EventsRequest
              {...props}
              api={api}
              organization={organization}
              period={period}
              project={projects}
              environment={environments}
              start={start}
              end={end}
              interval={intervalVal}
              query={query}
              includePrevious={includePrevious}
              currentSeriesNames={currentSeriesNames}
              previousSeriesNames={previousSeriesNames}
              yAxis={yAxis}
              field={field}
              orderby={orderby}
              topEvents={topEvents}
              confirmedQuery={confirmedQuery}
              partial
              // Cannot do interpolation when stacking series
              withoutZerofill={withoutZerofill && !this.isStacked()}
            >
              {eventData => {
                return chartImplementation({
                  ...eventData,
                  zoomRenderProps,
                });
              }}
            </EventsRequest>
          );
        }}
      </ChartZoom>
    );
  }
}

export default EventsChart;
