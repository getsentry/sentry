import {pick, isEqual} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {getFormattedDate} from 'app/utils/dates';
import {isEqualWithDates} from 'app/utils/isEqualWithDates';
import {t} from 'app/locale';
import {updateParams} from 'app/actionCreators/globalSelection';
import DataZoom from 'app/components/charts/components/dataZoom';
import LineChart from 'app/components/charts/lineChart';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';
import withApi from 'app/utils/withApi';

import EventsContext from './utils/eventsContext';
import EventsRequest from './utils/eventsRequest';

const DEFAULT_GET_CATEGORY = () => t('Events');

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

class EventsChart extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,
    period: PropTypes.string,
    query: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
    zoom: PropTypes.bool,

    // Callback for when chart has been zoomed
    onZoom: PropTypes.func,
  };

  constructor(props) {
    super(props);

    // Zoom history
    this.history = [];

    // Initialize current period instance state for zoom history
    this.saveCurrentPeriod(props);
  }

  // Need to be aggressive about not re-rendering because eCharts handles zoom so we
  // don't want the component to update (unless parameters besides time period were changed)
  shouldComponentUpdate(nextProps, nextState) {
    const periodKeys = ['period', 'start', 'end'];
    const nextPeriod = pick(nextProps, periodKeys);
    const currentPeriod = pick(this.props, periodKeys);
    const otherKeys = ['query', 'project', 'environment'];
    const zoom = nextProps.zoom;

    // Exception for these parameters -- needs to re-render chart
    if (!zoom && !isEqual(pick(nextProps, otherKeys), pick(this.props, otherKeys))) {
      return true;
    }

    if (
      zoom &&
      this.useHourlyInterval(nextProps) !== this.useHourlyInterval(this.props)
    ) {
      return true;
    }

    // do not update if we are zooming or if period via props does not change
    if (zoom || isEqualWithDates(currentPeriod, nextPeriod)) {
      return false;
    }

    return true;
  }

  componentDidUpdate() {
    // When component updates, make sure we sync current period state
    // for use in zoom history
    this.saveCurrentPeriod(this.props);
  }

  useHourlyInterval = (props = this.props) => {
    const {period, start, end} = props;

    if (typeof period === 'string') {
      return period.endsWith('h') || period === '1d';
    }

    return moment(end).diff(start, 'hours') <= 24;
  };

  /**
   * Save current period state from period in props to be used
   * in handling chart's zoom history state
   */
  saveCurrentPeriod = props => {
    this.currentPeriod = {
      period: props.period,
      start: getDate(props.start),
      end: getDate(props.end),
    };
  };

  /**
   * Sets the new period due to a zoom related action
   *
   * Saves the current period to an instance property so that we
   * can control URL state when zoom history is being manipulated
   * by the chart controls.
   *
   * Saves a callback function to be called after chart animation is completed
   */
  setPeriod = ({period, start, end}, saveHistory) => {
    const startFormatted = getDate(start);
    const endFormatted = getDate(end);

    // Save period so that we can revert back to it when using echarts "back" navigation
    if (saveHistory) {
      this.history.push(this.currentPeriod);
    }

    // Callback to let parent component know zoom has changed
    // This is required for some more perceived responsiveness since
    // we delay updating URL state so that chart animation can finish
    //
    // Parent container can use this to change into a loading state before
    // URL parameters are changed
    if (this.props.onZoom) {
      this.props.onZoom({
        period,
        start: startFormatted,
        end: endFormatted,
      });
    }

    this.zooming = () => {
      updateParams(
        {
          period,
          start: startFormatted,
          end: endFormatted,
          zoom: '1',
        },
        this.props.router
      );

      this.saveCurrentPeriod({period, start, end});
    };
  };

  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  handleChartReady = chart => {
    chart.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'dataZoomSelect',
      dataZoomSelectActive: true,
    });
  };

  /**
   * Restores the chart to initial viewport/zoom level
   *
   * Updates URL state to reflect initial params
   */
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
      const end = moment.utc(firstSeries.data[axis.rangeEnd][0]);

      this.setPeriod({period: null, start, end}, true);
    }
  };

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  handleChartFinished = () => {
    if (typeof this.zooming === 'function') {
      this.zooming();
      this.zooming = null;
    }
  };

  render() {
    const {period, utc, query} = this.props;

    const useHourly = this.useHourlyInterval();

    let interval = '30m';
    let xAxisOptions = {
      axisLabel: {
        formatter: (value, index, ...rest) => {
          const firstItem = index === 0;
          const format = useHourly && !firstItem ? 'LT' : 'lll';
          return getFormattedDate(value, format, {local: !utc});
        },
      },
    };

    if (this.useHourlyInterval()) {
      interval = '5m';
    }

    // TODO(billy): For now only include previous period when we use relative time

    return (
      <div>
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
                onChartReady={this.handleChartReady}
                isGroupedByDate
                useUtc={utc}
                interval={interval === '1h' ? 'hour' : 'day'}
                series={timeseriesData}
                seriesOptions={{
                  showSymbol: false,
                }}
                previousPeriod={previousTimeseriesData}
                grid={{
                  left: '30px',
                  right: '18px',
                }}
                xAxis={xAxisOptions}
                dataZoom={DataZoom()}
                tooltip={{
                  formatAxisLabel: (value, isTimestamp, isUtc) => {
                    if (!isTimestamp) {
                      return value;
                    }
                    return getFormattedDate(value, 'lll', {local: !isUtc});
                  },
                }}
                toolBox={ToolBox(
                  {},
                  {
                    dataZoom: {
                      title: {
                        zoom: '',
                        back: '',
                      },
                      iconStyle: {
                        borderWidth: 0,
                        color: 'transparent',
                        opacity: 0,
                      },
                    },
                  }
                )}
                onEvents={{
                  datazoom: this.handleDataZoom,
                  restore: this.handleZoomRestore,
                  finished: this.handleChartFinished,
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
