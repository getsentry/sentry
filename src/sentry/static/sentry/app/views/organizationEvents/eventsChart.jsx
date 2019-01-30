import {isEqual} from 'lodash';
import {withRouter} from 'react-router';
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

const DEFAULT_GET_CATEGORY = () => t('Events');

class EventsLineChart extends React.Component {
  static propTypes = {
    loading: PropTypes.bool,
    reloading: PropTypes.bool,
    releaseSeries: PropTypes.array,
    zoomRenderProps: PropTypes.object,
    timeseriesData: PropTypes.array,
    previousTimeseriesData: PropTypes.object,
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (isEqual(this.props.timeseriesData, nextProps.timeseriesData)) {
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
      ...props
    } = this.props;

    return (
      <LineChart
        {...props}
        {...zoomRenderProps}
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
    period: PropTypes.string,
    query: PropTypes.string,
    utc: PropTypes.bool,
  };

  render() {
    const {api, period, utc, query, ...props} = this.props;

    return (
      <ChartZoom period={period} utc={utc} {...props}>
        {({interval, ...zoomRenderProps}) => (
          <EventsRequest
            {...props}
            api={api}
            period={period}
            interval={getInterval(this.props, true)}
            showLoading={false}
            query={query}
            getCategory={DEFAULT_GET_CATEGORY}
            includePrevious={!!period}
          >
            {({loading, reloading, timeseriesData, previousTimeseriesData}) => {
              return (
                <ReleaseSeries api={api}>
                  {({releaseSeries}) => {
                    if (loading && !reloading) {
                      return <LoadingPanel data-test-id="events-request-loading" />;
                    }

                    return (
                      <React.Fragment>
                        <TransparentLoadingMask visible={reloading} />
                        <EventsLineChart
                          {...zoomRenderProps}
                          loading={loading}
                          reloading={reloading}
                          utc={utc}
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

const EventsChartContainer = withRouter(
  withGlobalSelection(
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
              project={projects || []}
              environment={environments || []}
              {...props}
            />
          );
        }
      }
    )
  )
);

export default EventsChartContainer;
export {EventsChart};

const TransparentLoadingMask = styled(LoadingMask)`
  ${p => !p.visible && 'display: none;'} opacity: 0.4;
  z-index: 1;
`;
