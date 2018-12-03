import {pick, isDate, isEqual, isEqualWith} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {getFormattedDate} from 'app/utils/dates';
import {t} from 'app/locale';
import DataZoom from 'app/components/charts/components/dataZoom';
import LineChart from 'app/components/charts/lineChart';
import EventsContext from 'app/views/organizationEvents/utils/eventsContext';
import EventsRequest from 'app/views/organizationEvents/utils/eventsRequest';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';
import withApi from 'app/utils/withApi';

const DEFAULT_GET_CATEGORY = () => t('Events');

const dateComparator = (value, other) => {
  if (isDate(value) && isDate(other)) {
    return +value === +other;
  }

  // returning undefined will use default comparator
  return undefined;
};

const isEqualWithDates = (a, b) => isEqualWith(a, b, dateComparator);
const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

class EventsChart extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    actions: PropTypes.object,
    period: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      period: props.period,
      start: getDate(props.start),
      end: getDate(props.end),
    };
    this.history = [];
  }

  // Need to be aggressive about not re-rendering because eCharts handles zoom so we
  // don't want the component to update (unless parameters besides time period were changed)
  shouldComponentUpdate(nextProps, nextState) {
    const periodKeys = ['period', 'start', 'end'];
    const otherKeys = ['environment', 'project', 'params', 'utc'];
    const nextPeriod = pick(nextProps, periodKeys);
    const currentPeriod = pick(this.props, periodKeys);

    // We need state and props (via url params) to be different since zooming updates
    // state and url params (and therefore state will be the same as nextProps) - whereas
    // time range selector will only update url params, and tchart needs to re-render
    if (
      (!isEqualWithDates(nextPeriod, currentPeriod) &&
        !isEqualWithDates(
          {
            period: nextProps.period,
            start: getDate(nextProps.start),
            end: getDate(nextProps.end),
          },
          this.state
        )) ||
      !isEqual(pick(this.props, otherKeys), pick(nextProps, otherKeys))
    ) {
      return true;
    }

    return false;
  }

  setPeriod = ({period, start, end}, saveHistory) => {
    const startFormatted = getDate(start);
    const endFormatted = getDate(end);

    // Save period so that we can revert back to it when using echarts "back" navigation
    if (saveHistory) {
      this.history.push({
        period: this.state.period,
        start: this.state.start,
        end: this.state.end,
      });
    }

    this.setState(
      {
        period,
        start: startFormatted,
        end: endFormatted,
      },
      () =>
        this.props.actions.updateParams({
          statsPeriod: period,
          start: startFormatted,
          end: endFormatted,
        })
    );
  };

  handleZoomRestore = (evt, chart) => {
    if (!this.history.length) {
      return;
    }

    this.setPeriod(this.history[0]);

    // reset history
    this.history = [];
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {xAxis, series} = model.option;
    const axis = xAxis[0];
    const [firstSeries] = series;

    // if `rangeStart` and `rangeEnd` are null, then we are going back
    if (axis.rangeStart === null && axis.rangeEnd === null) {
      const previousPeriod = this.history.pop();

      if (!previousPeriod) {
        return;
      }

      this.setPeriod(previousPeriod);
    } else {
      const start = moment.utc(firstSeries.data[axis.rangeStart][0]);

      // Add a day so we go until the end of the day (e.g. next day at midnight)
      const end = moment
        .utc(firstSeries.data[axis.rangeEnd][0])
        .add(1, 'day')
        .subtract(1, 'second');

      this.setPeriod({period: null, start, end}, true);
    }
  };

  render() {
    const {period, utc, location} = this.props;

    let interval = '1d';
    let xAxisOptions = {};
    if ((typeof period === 'string' && period.endsWith('h')) || period === '1d') {
      interval = '1h';
      xAxisOptions.axisLabel = {
        formatter: value => getFormattedDate(value, 'LT', {local: !utc}),
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
                onChartReady={echarts => {
                  // Enable zoom immediately instead of having to toggle
                  echarts.dispatchAction({
                    type: 'takeGlobalCursor',
                    key: 'dataZoomSelect',
                    dataZoomSelectActive: true,
                  });
                }}
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
                dataZoom={DataZoom()}
                toolBox={ToolBox(
                  {},
                  {
                    dataZoom: {},
                    restore: {
                      title: 'Restore',
                    },
                  }
                )}
                onEvents={{
                  datazoom: this.handleDataZoom,
                  restore: this.handleZoomRestore,
                }}
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
                project={context.project || []}
                environment={context.environment || []}
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
