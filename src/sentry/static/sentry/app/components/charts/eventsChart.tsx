import PropTypes from 'prop-types';
import * as React from 'react';
import isEqual from 'lodash/isEqual';
import {InjectedRouter} from 'react-router/lib/Router';

import {Client} from 'app/api';
import {DateString, OrganizationSummary} from 'app/types';
import {Series} from 'app/types/echarts';
import {t} from 'app/locale';
import {getInterval} from 'app/components/charts/utils';
import ChartZoom from 'app/components/charts/chartZoom';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/errorPanel';
import {tooltipFormatter, axisLabelFormatter} from 'app/utils/discover/charts';
import {aggregateMultiPlotType} from 'app/utils/discover/fields';

import EventsRequest from './eventsRequest';

type ChartProps = {
  loading: boolean;
  reloading: boolean;
  // TODO(mark) Update this when components/charts/chartZoom is updated.
  zoomRenderProps: any;
  timeseriesData: Series[];
  showLegend?: boolean;
  currentSeriesName?: string;
  releaseSeries?: Series | null;
  previousTimeseriesData?: Series | null;
  previousSeriesName?: string;
  showDaily?: boolean;
  interval?: string;
  yAxis: string;
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
    showDaily: PropTypes.bool,
    yAxis: PropTypes.string,
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

  getChartComponent() {
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
    const {selected} = legendChange;
    const seriesSelection = Object.keys(selected).reduce((state, key) => {
      // we only want them to be able to disable the Releases series,
      // and not any of the other possible series here
      state[key] = key === 'Releases' ? selected[key] : true;
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
      currentSeriesName,
      previousSeriesName,
      ...props
    } = this.props;
    const {seriesSelection} = this.state;

    const data = [currentSeriesName ?? t('Current'), previousSeriesName ?? t('Previous')];
    if (Array.isArray(releaseSeries)) {
      data.push(t('Releases'));
    }

    const legend = showLegend && {
      right: 16,
      top: 12,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      data,
      selected: seriesSelection,
    };

    const chartOptions = {
      colors: theme.charts.getColorPalette(timeseriesData.length - 2),
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
        trigger: 'axis',
        truncate: 80,
        valueFormatter: (value: number) => tooltipFormatter(value, yAxis),
      },
      yAxis: {
        axisLabel: {
          color: theme.gray400,
          formatter: (value: number) => axisLabelFormatter(value, yAxis),
        },
      },
    };

    const Component = this.getChartComponent();
    const series = Array.isArray(releaseSeries)
      ? [...timeseriesData, ...releaseSeries]
      : timeseriesData;

    return (
      <Component
        {...props}
        {...zoomRenderProps}
        {...chartOptions}
        legend={legend}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        series={series}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : null}
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
   * Overide the interval calculation and show daily results.
   */
  showDaily?: boolean;
  confirmedQuery?: boolean;
} & Pick<ChartProps, 'currentSeriesName' | 'previousSeriesName' | 'showLegend'>;

type ChartDataProps = {
  // TODO(mark) Update this when components/charts/chartZoom is updated.
  zoomRenderProps: any;
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  results?: Series[];
  timeseriesData?: Series[];
  previousTimeseriesData?: Series | null;
  releaseSeries?: Series;
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
    currentSeriesName: PropTypes.string,
    previousSeriesName: PropTypes.string,
    topEvents: PropTypes.number,
    field: PropTypes.arrayOf(PropTypes.string),
    showDaily: PropTypes.bool,
    orderby: PropTypes.string,
    confirmedQuery: PropTypes.bool,
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
      currentSeriesName: currentName,
      previousSeriesName: previousName,
      field,
      interval,
      showDaily,
      topEvents,
      orderby,
      confirmedQuery,
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const previousSeriesName =
      previousName ?? yAxis ? t('previous %s', yAxis) : undefined;
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
            <IconWarning color="gray500" size="lg" />
          </ErrorPanel>
        );
      }
      const seriesData = results ? results : timeseriesData;

      return (
        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />
          <Chart
            {...zoomRenderProps}
            loading={loading}
            reloading={reloading}
            utc={utc}
            showLegend={showLegend}
            releaseSeries={releaseSeries || []}
            timeseriesData={seriesData}
            previousTimeseriesData={previousTimeseriesData}
            currentSeriesName={currentSeriesName}
            previousSeriesName={previousSeriesName}
            stacked={typeof topEvents === 'number' && topEvents > 0}
            yAxis={yAxis}
            showDaily={showDaily}
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
        >
          {({releaseSeries}) => previousChart({...chartProps, releaseSeries})}
        </ReleaseSeries>
      );
    }

    return (
      <ChartZoom
        router={router}
        period={period}
        utc={utc}
        projects={projects}
        environments={environments}
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
