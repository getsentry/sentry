import * as React from 'react';
import {InjectedRouter} from 'react-router';
import {withTheme} from '@emotion/react';
import {EChartOption} from 'echarts/lib/echarts';
import {Query} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import ChartZoom, {ZoomRenderProps} from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, RELEASE_LINES_THRESHOLD} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {DateString, OrganizationSummary} from 'app/types';
import {Series} from 'app/types/echarts';
import {defined} from 'app/utils';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {aggregateMultiPlotType, getEquation, isEquation} from 'app/utils/discover/fields';
import {decodeList} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';

import EventsRequest from './eventsRequest';

type ChartProps = {
  theme: Theme;
  loading: boolean;
  reloading: boolean;
  zoomRenderProps: ZoomRenderProps;
  timeseriesData: Series[];
  showLegend?: boolean;
  legendOptions?: EChartOption.Legend;
  chartOptions?: Omit<EChartOption, 'xAxis' | 'yAxis'> & {
    xAxis?: EChartOption.XAxis;
    yAxis?: EChartOption.YAxis;
  };
  currentSeriesNames: string[];
  releaseSeries?: Series[];
  previousSeriesNames: string[];
  previousTimeseriesData?: Series | null;
  /**
   * A callback to allow for post-processing of the series data.
   * Can be used to rename series or even insert a new series.
   */
  seriesTransformer?: (series: Series[]) => Series[];
  previousSeriesTransformer?: (series?: Series | null) => Series | null | undefined;
  showDaily?: boolean;
  interval?: string;
  yAxis: string;
  stacked: boolean;
  colors?: string[];
  /**
   * By default, only the release series is disableable. This adds
   * a list of series names that are also disableable.
   */
  disableableSeries?: string[];
  chartComponent?:
    | React.ComponentType<BarChart['props']>
    | React.ComponentType<AreaChart['props']>
    | React.ComponentType<LineChart['props']>;
  height?: number;
  timeframe?: {start: number; end: number};
};

type State = {
  seriesSelection: Record<string, boolean>;
  forceUpdate: boolean;
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
      isEqual(this.props.previousTimeseriesData, nextProps.previousTimeseriesData)
    ) {
      return false;
    }

    return true;
  }

  getChartComponent():
    | React.ComponentType<BarChart['props']>
    | React.ComponentType<AreaChart['props']>
    | React.ComponentType<LineChart['props']> {
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
      // we only want them to be able to disable the Releases series,
      // and not any of the other possible series here
      const disableable = key === 'Releases' || disableableSeries.includes(key);
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
      ...props
    } = this.props;
    const {seriesSelection} = this.state;

    const data = [
      ...(currentSeriesNames.length > 0 ? currentSeriesNames : [t('Current')]),
      ...(previousSeriesNames.length > 0 ? previousSeriesNames : [t('Previous')]),
    ];

    const releasesLegend = t('Releases');
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
      previousSeries = previousSeriesTransformer(previousTimeseriesData);
    }
    const chartOptions = {
      colors: timeseriesData.length
        ? colors?.slice(0, series.length) ?? [
            ...theme.charts.getColorPalette(timeseriesData.length - 2),
          ]
        : undefined,
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
        valueFormatter: (value: number) => tooltipFormatter(value, yAxis),
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
          formatter: (value: number) => axisLabelFormatter(value, yAxis),
        },
      },
      ...(chartOptionsProp ?? {}),
    };

    const Component = this.getChartComponent();
    return (
      <Component
        {...props}
        {...zoomRenderProps}
        {...chartOptions}
        legend={legend}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        series={series}
        previousPeriod={previousSeries ? [previousSeries] : undefined}
        height={height}
      />
    );
  }
}

const ThemedChart = withTheme(Chart);

export type EventsChartProps = {
  api: Client;
  router: InjectedRouter;
  organization: OrganizationSummary;
  /**
   * Project ids
   */
  projects: number[];
  /**
   * Environment condition.
   */
  environments: string[];
  /**
   * The discover query string to find events with.
   */
  query: string;
  /**
   * The aggregate/metric to plot.
   */
  yAxis: string | string[];
  /**
   * Relative datetime expression. eg. 14d
   */
  period?: string;
  /**
   * Absolute start date.
   */
  start: DateString;
  /**
   * Absolute end date.
   */
  end: DateString;
  /**
   * Should datetimes be formatted in UTC?
   */
  utc?: boolean | null;
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
   * Fetch n top events as dictated by the field and orderby props.
   */
  topEvents?: number;
  /**
   * The fields that act as grouping conditions when generating a topEvents chart.
   */
  field?: string[];
  /**
   * The interval resolution for a chart e.g. 1m, 5m, 1d
   */
  interval?: string;
  /**
   * Order condition when showing topEvents
   */
  orderby?: string;
  /**
   * Override the interval calculation and show daily results.
   */
  showDaily?: boolean;
  confirmedQuery?: boolean;
  /**
   * Override the default color palette.
   */
  colors?: string[];
  /**
   * Markup for optional chart header
   */
  chartHeader?: React.ReactNode;
  releaseQueryExtra?: Query;
  preserveReleaseQueryParams?: boolean;
  /**
   * Chart zoom will change 'pageStart' instead of 'start'
   */
  usePageZoom?: boolean;
  /**
   * Whether or not to zerofill results
   */
  withoutZerofill?: boolean;
  /**
   * Name of the series
   */
  currentSeriesName?: string;
  /**
   * Name of the previous series
   */
  previousSeriesName?: string;
} & Pick<
  ChartProps,
  | 'seriesTransformer'
  | 'previousSeriesTransformer'
  | 'showLegend'
  | 'disableableSeries'
  | 'legendOptions'
  | 'chartOptions'
  | 'chartComponent'
  | 'height'
>;

type ChartDataProps = {
  zoomRenderProps: ZoomRenderProps;
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  results?: Series[];
  timeseriesData?: Series[];
  previousTimeseriesData?: Series | null;
  releaseSeries?: Series[];
  timeframe?: {start: number; end: number};
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
      period,
      utc,
      query,
      router,
      start,
      end,
      projects,
      environments,
      showLegend,
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

    const previousSeriesName = previousName
      ? [previousName]
      : yAxisSeriesNames.map(name => t('previous %s', name));
    const currentSeriesName = currentName ? [currentName] : yAxisSeriesNames;

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
          reloading={reloading}
          height={height ? `${height}px` : undefined}
        >
          <TransparentLoadingMask visible={reloading} />

          {React.isValidElement(chartHeader) && chartHeader}

          <ThemedChart
            zoomRenderProps={zoomRenderProps}
            loading={loading}
            reloading={reloading}
            showLegend={showLegend}
            releaseSeries={releaseSeries || []}
            timeseriesData={seriesData ?? []}
            previousTimeseriesData={previousTimeseriesData}
            currentSeriesNames={currentSeriesName}
            previousSeriesNames={previousSeriesName}
            seriesTransformer={seriesTransformer}
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
        {zoomRenderProps => (
          <EventsRequest
            {...props}
            api={api}
            period={period}
            project={projects}
            environment={environments}
            start={start}
            end={end}
            interval={intervalVal}
            query={query}
            includePrevious={includePrevious}
            currentSeriesName={currentSeriesName[0]}
            previousSeriesName={previousSeriesName[0]}
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
        )}
      </ChartZoom>
    );
  }
}

export default EventsChart;
