import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';

import {t} from 'app/locale';
import {getInterval} from 'app/components/charts/utils';
import ChartZoom from 'app/components/charts/chartZoom';
import AreaChart from 'app/components/charts/areaChart';
import BarChart from 'app/components/charts/barChart';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/errorPanel';
import {getDuration, formatPercentage} from 'app/utils/formatters';

import EventsRequest from './utils/eventsRequest';

const DURATION_AGGREGATE_PATTERN = /^(p75|p95|p99|percentile)|transaction\.duration/;
const PERCENTAGE_AGGREGATE_PATTERN = /^(error_rate)/;

class Chart extends React.Component {
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
  };

  shouldComponentUpdate(nextProps) {
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

  render() {
    const {
      loading: _loading,
      reloading: _reloading,
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      currentSeriesName,
      previousSeriesName,
      showDaily,
      ...props
    } = this.props;

    const legend = showLegend && {
      right: 16,
      top: 12,
      selectedMode: false,
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
      data: [currentSeriesName ?? t('Current'), previousSeriesName ?? t('Previous'), ''],
    };

    const colors = theme.charts.getColorPalette(timeseriesData.length - 2);
    const Component = showDaily ? BarChart : AreaChart;

    return (
      <Component
        {...props}
        {...zoomRenderProps}
        legend={legend}
        series={[...timeseriesData, ...releaseSeries]}
        seriesOptions={{
          showSymbol: false,
        }}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : null}
        colors={colors}
        grid={{
          left: '24px',
          right: '24px',
          top: '32px',
          bottom: '12px',
        }}
      />
    );
  }
}

class EventsChart extends React.Component {
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
      showDaily,
      topEvents,
      orderby,
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const previousSeriesName =
      previousName ?? yAxis ? t('previous %s', yAxis) : undefined;
    const currentSeriesName = currentName ?? yAxis;

    const tooltip = {
      truncate: 80,
      valueFormatter(value) {
        if (DURATION_AGGREGATE_PATTERN.test(yAxis)) {
          return getDuration(value / 1000, 2);
        }
        if (PERCENTAGE_AGGREGATE_PATTERN.test(yAxis)) {
          return formatPercentage(value, 2);
        }
        if (typeof value === 'number') {
          return value.toLocaleString();
        }

        return value;
      },
    };
    const interval = showDaily
      ? '1d'
      : router?.location?.query?.interval || getInterval(this.props, true);

    let chartImplementation = ({
      zoomRenderProps,
      releaseSeries,
      errored,
      loading,
      reloading,
      results,
      timeseriesData,
      previousTimeseriesData,
    }) => {
      if (errored) {
        return (
          <ErrorPanel>
            <IconWarning color={theme.gray2} size="lg" />
          </ErrorPanel>
        );
      }
      const seriesData = results ? results : timeseriesData;

      return (
        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />
          <Chart
            {...zoomRenderProps}
            tooltip={tooltip}
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
            showDaily={showDaily}
          />
        </TransitionChart>
      );
    };

    if (!disableReleases) {
      const previousChart = chartImplementation;
      chartImplementation = chartProps => (
        <ReleaseSeries utc={utc} api={api} projects={projects}>
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
            interval={interval}
            query={query}
            includePrevious={includePrevious}
            currentSeriesName={currentSeriesName}
            previousSeriesName={previousSeriesName}
            yAxis={yAxis}
            field={field}
            orderby={orderby}
            topEvents={topEvents}
          >
            {eventData => chartImplementation({...eventData, zoomRenderProps})}
          </EventsRequest>
        )}
      </ChartZoom>
    );
  }
}

const EventsChartContainer = withGlobalSelection(
  withApi(
    class EventsChartWithParams extends React.Component {
      static propTypes = {
        selection: SentryTypes.GlobalSelection,
      };

      render() {
        const {selection, ...props} = this.props;
        const {datetime, projects, environments} = selection;

        return (
          <EventsChart
            {...datetime}
            projects={projects || []}
            environments={environments || []}
            {...props}
          />
        );
      }
    }
  )
);

export default EventsChartContainer;
export {EventsChart};
