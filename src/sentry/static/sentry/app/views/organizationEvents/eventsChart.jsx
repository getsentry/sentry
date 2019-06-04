import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getInterval} from 'app/components/charts/utils';
import {t} from 'app/locale';
import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import LoadingPanel, {LoadingMask} from 'app/views/organizationEvents/loadingPanel';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import EventsRequest from './utils/eventsRequest';
import YAxisSelector from './yAxisSelector';

const DEFAULT_GET_CATEGORY = () => t('Events');

class EventsLineChart extends React.Component {
  static propTypes = {
    loading: PropTypes.bool,
    reloading: PropTypes.bool,
    releaseSeries: PropTypes.array,
    zoomRenderProps: PropTypes.object,
    timeseriesData: PropTypes.array,
    showLegend: PropTypes.bool,
    previousTimeseriesData: PropTypes.object,
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries)
    ) {
      return false;
    }

    return true;
  }

  render() {
    const {
      loading, // eslint-disable-line no-unused-vars
      reloading, // eslint-disable-line no-unused-vars
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      ...props
    } = this.props;

    const legend = showLegend && {
      right: 100,
      top: 10,
      selectedMode: false,
      itemWidth: 15,
      icon: 'line',
      textStyle: {
        lineHeight: 16,
      },
      data: ['Current Period', 'Previous Period'],
    };

    return (
      <LineChart
        {...props}
        {...zoomRenderProps}
        legend={legend}
        series={[...timeseriesData, ...releaseSeries]}
        seriesOptions={{
          showSymbol: false,
        }}
        previousPeriod={previousTimeseriesData ? [previousTimeseriesData] : null}
        grid={{
          left: '30px',
          right: '18px',
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
    yAxisOptions: PropTypes.array,
  };

  state = {
    yAxis: 'event_count',
  };

  handleYAxisChange = value => {
    this.setState({yAxis: value});
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
      yAxisOptions,
      ...props
    } = this.props;
    // Include previous only on relative dates (defaults to relative if no start and end)
    const includePrevious = !start && !end;

    return (
      <ChartZoom
        router={router}
        period={period}
        utc={utc}
        projects={projects}
        environments={environments}
        {...props}
      >
        {({interval, ...zoomRenderProps}) => (
          <EventsRequest
            {...props}
            api={api}
            period={period}
            project={projects}
            environment={environments}
            start={start}
            end={end}
            interval={getInterval(this.props, true)}
            showLoading={false}
            query={query}
            getCategory={DEFAULT_GET_CATEGORY}
            includePrevious={includePrevious}
            yAxis={this.state.yAxis}
          >
            {({loading, reloading, timeseriesData, previousTimeseriesData}) => {
              return (
                <ReleaseSeries utc={utc} api={api} projects={projects}>
                  {({releaseSeries}) => {
                    if (loading && !reloading) {
                      return <LoadingPanel data-test-id="events-request-loading" />;
                    }

                    return (
                      <React.Fragment>
                        <TransparentLoadingMask visible={reloading} />
                        {yAxisOptions && (
                          <YAxisSelector
                            selected={this.state.yAxis}
                            options={yAxisOptions}
                            onChange={this.handleYAxisChange}
                          />
                        )}
                        <EventsLineChart
                          {...zoomRenderProps}
                          loading={loading}
                          reloading={reloading}
                          utc={utc}
                          showLegend={showLegend}
                          releaseSeries={releaseSeries}
                          timeseriesData={timeseriesData}
                          previousTimeseriesData={previousTimeseriesData}
                        />
                      </React.Fragment>
                    );
                  }}
                </ReleaseSeries>
              );
            }}
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

const TransparentLoadingMask = styled(LoadingMask)`
  ${p => !p.visible && 'display: none;'} opacity: 0.4;
  z-index: 1;
`;
