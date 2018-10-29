import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {HealthRequestWithParams} from 'app/views/organizationHealth/util/healthRequest';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import DataZoom from 'app/components/charts/components/dataZoom';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';
import withApi from 'app/utils/withApi';

class EventsChart extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    actions: PropTypes.object,
    period: PropTypes.string,
  };

  constructor(props) {
    super(props);
  }

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
    const {period} = this.props;

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

    return (
      <div>
        <HealthRequestWithParams
          {...this.props}
          tag="error.handled"
          includeTimeseries
          interval={interval}
          showLoading
          getCategory={() => t('Event')}
        >
          {({timeseriesData, previousTimeseriesData}) => (
            <AreaChart
              isGroupedByDate
              interval={interval === '1h' ? 'hour' : 'day'}
              series={timeseriesData}
              previousPeriod={previousTimeseriesData}
              grid={{
                left: '18px',
                right: '18px',
              }}
              xAxis={xAxisOptions}
              dataZoom={DataZoom()}
              toolBox={ToolBox(
                {},
                {
                  dataZoom: {},
                  restore: {},
                }
              )}
              onEvents={{
                datazoom: this.handleDataZoom,
                click: this.handleChartClick,
              }}
            />
          )}
        </HealthRequestWithParams>
      </div>
    );
  }
}

const EventsChartContainer = withApi(
  class EventsChartContainer extends React.Component {
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
);
export default EventsChartContainer;
export {EventsChart};
