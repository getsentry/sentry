import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';

import {t} from 'app/locale';
import {getInterval} from 'app/components/charts/utils';
import ChartZoom from 'app/components/charts/chartZoom';
import AreaChart from 'app/components/charts/areaChart';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import TransparentLoadingMask from 'app/components/charts/components/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import {getDuration, formatPercentage} from 'app/utils/formatters';

import EventsRequest from './utils/eventsRequest';

const DURATION_AGGREGATE_PATTERN = /^(p75|p95|p99|percentile)|transaction\.duration/;
const PERCENTAGE_AGGREGATE_PATTERN = /^(error_rate)/;

class EventsAreaChart extends React.Component {
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

    return (
      <AreaChart
        {...props}
        {...zoomRenderProps}
        legend={legend}
        series={[...timeseriesData, ...releaseSeries]}
        seriesOptions={{
          showSymbol: false,
        }}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : null}
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
    currentSeriesName: PropTypes.string,
    previousSeriesName: PropTypes.string,
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
      currentSeriesName: currentName,
      previousSeriesName: previousName,
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !disablePrevious && !start && !end;

    const previousSeriesName =
      previousName ?? yAxis ? t('previous %s', yAxis) : undefined;
    const currentSeriesName = currentName ?? yAxis;

    const tooltip = {
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
            interval={router?.location?.query?.interval || getInterval(this.props, true)}
            showLoading={false}
            query={query}
            includePrevious={includePrevious}
            currentSeriesName={currentSeriesName}
            previousSeriesName={previousSeriesName}
            yAxis={yAxis}
          >
            {({loading, reloading, errored, timeseriesData, previousTimeseriesData}) => (
              <ReleaseSeries utc={utc} api={api} projects={projects}>
                {({releaseSeries}) => {
                  if (errored) {
                    return (
                      <ErrorPanel>
                        <IconWarning color={theme.gray2} size="lg" />
                      </ErrorPanel>
                    );
                  }

                  return (
                    <TransitionChart loading={loading} reloading={reloading}>
                      <React.Fragment>
                        <TransparentLoadingMask visible={reloading} />
                        <EventsAreaChart
                          {...zoomRenderProps}
                          tooltip={tooltip}
                          loading={loading}
                          reloading={reloading}
                          utc={utc}
                          showLegend={showLegend}
                          releaseSeries={releaseSeries}
                          timeseriesData={timeseriesData}
                          previousTimeseriesData={previousTimeseriesData}
                          currentSeriesName={currentSeriesName}
                          previousSeriesName={previousSeriesName}
                        />
                      </React.Fragment>
                    </TransitionChart>
                  );
                }}
              </ReleaseSeries>
            )}
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
export {EventsChart, EventsAreaChart};
