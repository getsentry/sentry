import React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {EChartOption} from 'echarts/lib/echarts';
import {Query} from 'history';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import ChartZoom, {ZoomRenderProps} from 'app/components/charts/chartZoom';
import Legend from 'app/components/charts/components/legend';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval} from 'app/components/charts/utils';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {DateString, OrganizationSummary} from 'app/types';
import {Series} from 'app/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import {aggregateMultiPlotType} from 'app/utils/discover/fields';
import theme from 'app/utils/theme';

import EventsRequest from './eventsRequest';

type ChartProps = {
  loading: boolean;
  reloading: boolean;
  zoomRenderProps: ZoomRenderProps;
  timeseriesData: Series[];
  showLegend?: boolean;
  legendOptions?: EChartOption.Legend;
  chartOptions?: EChartOption;
  currentSeriesName?: string;
  releaseSeries?: Series[];
  previousTimeseriesData?: Series | null;
  previousSeriesName?: string;
  /**
   * The default series names are based on the column names. This callback
   * allows for custom naming of series.
   */
  seriesNameTransformer?: (string) => string;
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
};

type State = {
  seriesSelection: Record<string, boolean>;
  forceUpdate: boolean;
};

class Chart extends React.Component<ChartProps, State> {
  static propTypes = {
    loading: PropTypes.bool,
    reloading: PropTypes.bool,
    releaseSeries: PropTypes.array,
    zoomRenderProps: PropTypes.object,
    timeseriesData: PropTypes.array,
    showLegend: PropTypes.bool,
    previousTimeseriesData: PropTypes.object,
    currentSeriesName: PropTypes.string,
    previousSeriesName: PropTypes.string,
    seriesNameTransformer: PropTypes.func,
    showDaily: PropTypes.bool,
    yAxis: PropTypes.string,
    stacked: PropTypes.bool,
    colors: PropTypes.array,
    disableableSeries: PropTypes.array,
    legendOptions: PropTypes.object,
    chartOptions: PropTypes.object,
  };

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
    const {showDaily, timeseriesData, yAxis} = this.props;
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
      currentSeriesName,
      previousSeriesName,
      seriesNameTransformer,
      colors,
      ...props
    } = this.props;
    const {seriesSelection} = this.state;

    const data = [currentSeriesName ?? t('Current'), previousSeriesName ?? t('Previous')];
    if (Array.isArray(releaseSeries)) {
      data.push(t('Releases'));
    }

    const legend = showLegend
      ? Legend({
          right: 16,
          top: 12,
          data,
          selected: seriesSelection,
          theme,
          ...(legendOptions ?? {}),
        })
      : undefined;

    const chartOptions = {
      colors: timeseriesData.length
        ? colors?.slice(0, timeseriesData.length) ?? [
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
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => axisLabelFormatter(value, yAxis),
        },
      },
      ...(chartOptionsProp ?? {}),
    };

    const Component = this.getChartComponent();
    const series = Array.isArray(releaseSeries)
      ? [...timeseriesData, ...releaseSeries]
      : timeseriesData;

    if (seriesNameTransformer) {
      series.forEach(s => {
        s.seriesName = seriesNameTransformer(s.seriesName);
      });
    }

    return (
      <Component
        {...props}
        {...zoomRenderProps}
        {...chartOptions}
        legend={legend}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        series={series}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : undefined}
      />
    );
  }
}

type Props = {
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
  yAxis: string;
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
} & Pick<
  ChartProps,
  | 'currentSeriesName'
  | 'previousSeriesName'
  | 'seriesNameTransformer'
  | 'showLegend'
  | 'disableableSeries'
  | 'legendOptions'
  | 'chartOptions'
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
};

class EventsChart extends React.Component<Props> {
  static propTypes = {
    api: PropTypes.object,
    projects: PropTypes.arrayOf(PropTypes.number),
    environments: PropTypes.arrayOf(PropTypes.string),
    period: PropTypes.string,
    query: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
    router: PropTypes.object,
    showLegend: PropTypes.bool,
    yAxis: PropTypes.string,
    disablePrevious: PropTypes.bool,
    disableReleases: PropTypes.bool,
    emphasizeReleases: PropTypes.array,
    currentSeriesName: PropTypes.string,
    previousSeriesName: PropTypes.string,
    seriesNameTransformer: PropTypes.func,
    topEvents: PropTypes.number,
    field: PropTypes.arrayOf(PropTypes.string),
    showDaily: PropTypes.bool,
    orderby: PropTypes.string,
    confirmedQuery: PropTypes.bool,
    colors: PropTypes.array,
    preserveReleaseQueryParams: PropTypes.bool,
    releaseQueryExtras: PropTypes.object,
    disableableSeries: PropTypes.array,
    chartHeader: PropTypes.object,
    legendOptions: PropTypes.object,
    chartOptions: PropTypes.object,
  };

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
      seriesNameTransformer,
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
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const previousSeriesName =
      previousName ?? (yAxis ? t('previous %s', yAxis) : undefined);
    const currentSeriesName = currentName ?? yAxis;

    const intervalVal = showDaily ? '1d' : interval || getInterval(this.props, true);

    let chartImplementation = ({
      zoomRenderProps,
      releaseSeries,
      errored,
      loading,
      reloading,
      results,
      timeseriesData,
      previousTimeseriesData,
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
        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />

          {React.isValidElement(chartHeader) && chartHeader}

          <Chart
            zoomRenderProps={zoomRenderProps}
            loading={loading}
            reloading={reloading}
            showLegend={showLegend}
            releaseSeries={releaseSeries || []}
            timeseriesData={seriesData ?? []}
            previousTimeseriesData={previousTimeseriesData}
            currentSeriesName={currentSeriesName}
            previousSeriesName={previousSeriesName}
            seriesNameTransformer={seriesNameTransformer}
            stacked={typeof topEvents === 'number' && topEvents > 0}
            yAxis={yAxis}
            showDaily={showDaily}
            colors={colors}
            legendOptions={legendOptions}
            chartOptions={chartOptions}
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
      <ChartZoom router={router} period={period} utc={utc} {...props}>
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
            currentSeriesName={currentSeriesName}
            previousSeriesName={previousSeriesName}
            yAxis={yAxis}
            field={field}
            orderby={orderby}
            topEvents={topEvents}
            confirmedQuery={confirmedQuery}
          >
            {eventData =>
              chartImplementation({
                ...eventData,
                zoomRenderProps,
              })
            }
          </EventsRequest>
        )}
      </ChartZoom>
    );
  }
}

export default EventsChart;
