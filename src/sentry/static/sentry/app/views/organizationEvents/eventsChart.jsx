import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import withApi from 'app/utils/withApi';

import EventsContext from './utils/eventsContext';
import EventsRequest from './utils/eventsRequest';

const DEFAULT_GET_CATEGORY = () => t('Events');

class EventsChart extends React.Component {
  static propTypes = {
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
                <LineChart
                  {...zoomRenderProps}
                  utc={utc}
                  series={timeseriesData}
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
          </EventsRequest>
        )}
      </ChartZoom>
    );
  }
}

const EventsChartContainer = withApi(
  class EventsChartWithParams extends React.Component {
    render() {
      return (
        <EventsContext.Consumer>
          {context => (
            <EventsChart
              {...context}
              project={context.project || []}
              environment={context.environment || []}
              {...this.props}
            />
          )}
        </EventsContext.Consumer>
      );
    }
  }
);

export default EventsChartContainer;
export {EventsChart};
