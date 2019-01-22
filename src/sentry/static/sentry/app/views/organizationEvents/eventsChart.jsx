import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import EventsRequest from './utils/eventsRequest';

const DEFAULT_GET_CATEGORY = () => t('Events');

class EventsChart extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    period: PropTypes.string,
    query: PropTypes.string,
    utc: PropTypes.bool,
  };

  render() {
    const {period, utc, query} = this.props;

    return (
      <ChartZoom {...this.props}>
        {({interval, ...zoomRenderProps}) => (
          <EventsRequest
            {...this.props}
            interval={interval}
            showLoading
            query={query}
            getCategory={DEFAULT_GET_CATEGORY}
            includePrevious={!!period}
          >
            {({timeseriesData, previousTimeseriesData}) => {
              return (
                <ReleaseSeries api={this.props.api}>
                  {({releaseSeries}) => {
                    return (
                      <LineChart
                        {...zoomRenderProps}
                        utc={utc}
                        series={[...timeseriesData, ...releaseSeries]}
                        seriesOptions={{
                          showSymbol: false,
                        }}
                        previousPeriod={
                          previousTimeseriesData ? [previousTimeseriesData] : null
                        }
                        grid={{
                          left: '30px',
                          right: '18px',
                        }}
                      />
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
        const {datetime, projects, environments} = this.props.selection;
        return (
          <EventsChart
            {...datetime}
            project={projects || []}
            environment={environments || []}
            {...this.props}
          />
        );
      }
    }
  )
);

export default EventsChartContainer;
export {EventsChart};
