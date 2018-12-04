import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {t} from 'app/locale';
import LineChart from 'app/components/charts/lineChart';
import EventsContext from 'app/views/organizationEvents/utils/eventsContext';
import EventsRequest from 'app/views/organizationEvents/utils/eventsRequest';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

const DEFAULT_GET_CATEGORY = () => t('Events');

class EventsChart extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization,
    actions: PropTypes.object,
    period: PropTypes.string,
    utc: PropTypes.bool,
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {xAxis, series} = model.option;
    const axis = xAxis[0];
    const [firstSeries] = series;

    const start = moment(firstSeries.data[axis.rangeStart][0]).format(
      moment.HTML5_FMT.DATETIME_LOCAL_MS
    );

    // Add a day so we go until the end of the day (e.g. next day at midnight)
    const end = moment(firstSeries.data[axis.rangeEnd][0])
      .add(1, 'day')
      .subtract(1, 'second')
      .format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    this.props.actions.updateParams({
      statsPeriod: null,
      start,
      end,
    });
  };

  handleChartClick = series => {
    if (!series) {
      return;
    }

    const firstSeries = series;

    const date = moment(firstSeries.name);
    const start = date.format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    // Add a day so we go until the end of the day (e.g. next day at midnight)
    const end = date
      .add(1, 'day')
      .subtract(1, 'second')
      .format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    this.props.actions.updateParams({
      statsPeriod: null,
      start,
      end,
    });
  };

  render() {
    const {period, utc, location} = this.props;

    let interval = '1d';
    let xAxisOptions = {};
    if ((typeof period === 'string' && period.endsWith('h')) || period === '1d') {
      interval = '1h';
      xAxisOptions.axisLabel = {
        formatter: value =>
          moment
            .utc(value)
            .local()
            .format('LT'),
      };
    }

    // TODO(billy): For now only include previous period when we use relative time

    return (
      <div>
        <EventsRequest
          {...this.props}
          interval={interval}
          showLoading
          query={(location.query && location.query.query) || ''}
          getCategory={DEFAULT_GET_CATEGORY}
          includePrevious={!!period}
        >
          {({timeseriesData, previousTimeseriesData}) => {
            return (
              <LineChart
                isGroupedByDate
                useUtc={utc}
                interval={interval === '1h' ? 'hour' : 'day'}
                series={timeseriesData}
                seriesOptions={{
                  showSymbol: true,
                }}
                previousPeriod={previousTimeseriesData}
                grid={{
                  left: '18px',
                  right: '18px',
                }}
                xAxis={xAxisOptions}
              />
            );
          }}
        </EventsRequest>
      </div>
    );
  }
}

const EventsChartContainer = withRouter(
  withApi(
    class EventsChartWithParams extends React.Component {
      render() {
        return (
          <EventsContext.Consumer>
            {context => (
              <EventsChart
                {...context}
                projects={context.project || []}
                environments={context.environment || []}
                {...this.props}
              />
            )}
          </EventsContext.Consumer>
        );
      }
    }
  )
);

export default EventsChartContainer;
export {EventsChart};
