import PropTypes from 'prop-types';
import {Component} from 'react';
import moment from 'moment';

import {callIfFunction} from 'app/utils/callIfFunction';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {updateDateTime} from 'app/actionCreators/globalSelection';
import DataZoomInside from 'app/components/charts/components/dataZoomInside';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

/**
 * This is a very opinionated component that takes a render prop through `children`. It
 * will provide props to be passed to `BaseChart` to enable support of zooming without
 * eCharts' clunky zoom toolboxes.
 *
 * This also is very tightly coupled with the Global Selection Header. We can make it more
 * generic if need be in the future.
 */
class ChartZoom extends Component {
  static propTypes = {
    router: PropTypes.object,
    period: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
    disabled: PropTypes.bool,

    xAxis: SentryTypes.EChartsXAxis,
    /**
     * If you need the dataZoom control to control more than one chart.
     * you can provide a list of the axis indexes.
     */
    xAxisIndex: PropTypes.arrayOf(PropTypes.number),

    // Callback for when chart has been zoomed
    onZoom: PropTypes.func,
    // Callbacks for eCharts events
    onRestore: PropTypes.func,
    onChartReady: PropTypes.func,
    onDataZoom: PropTypes.func,
    onFinished: PropTypes.func,
  };

  constructor(props) {
    super(props);

    // Zoom history
    this.history = [];

    // Initialize current period instance state for zoom history
    this.saveCurrentPeriod(props);
  }

  componentDidUpdate() {
    if (this.props.disabled) {
      return;
    }

    // When component updates, make sure we sync current period state
    // for use in zoom history
    this.saveCurrentPeriod(this.props);
  }

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
    const {router, onZoom} = this.props;
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
    callIfFunction(onZoom, {
      period,
      start: startFormatted,
      end: endFormatted,
    });

    this.zooming = () => {
      updateDateTime(
        {
          period,
          start: startFormatted
            ? getUtcToLocalDateObject(startFormatted)
            : startFormatted,
          end: endFormatted ? getUtcToLocalDateObject(endFormatted) : endFormatted,
        },
        router
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

    callIfFunction(this.props.onChartReady, chart);
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

    callIfFunction(this.props.onRestore, evt, chart);
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {xAxis} = model.option;
    const axis = xAxis[0];

    // if `rangeStart` and `rangeEnd` are null, then we are going back
    if (axis.rangeStart === null && axis.rangeEnd === null) {
      const previousPeriod = this.history.pop();

      if (!previousPeriod) {
        return;
      }

      this.setPeriod(previousPeriod);
    } else {
      const start = moment.utc(axis.rangeStart);

      // Add a day so we go until the end of the day (e.g. next day at midnight)
      const end = moment.utc(axis.rangeEnd);

      this.setPeriod({period: null, start, end}, true);
    }

    callIfFunction(this.props.onDataZoom, evt, chart);
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
    callIfFunction(this.props.onFinished);
  };

  render() {
    const {
      utc,
      disabled,
      children,
      xAxisIndex,

      onZoom: _onZoom,
      onRestore: _onRestore,
      onChartReady: _onChartReady,
      onDataZoom: _onDataZoom,
      onFinished: _onFinished,
      ...props
    } = this.props;

    if (disabled) {
      return children(props);
    }

    // TODO(mark) Update consumers of DataZoom when typing this.
    const renderProps = {
      // Zooming only works when grouped by date
      isGroupedByDate: true,
      onChartReady: this.handleChartReady,
      utc,
      dataZoom: DataZoomInside({xAxisIndex}),
      showTimeInTooltip: true,
      toolBox: ToolBox(
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
      ),
      onDataZoom: this.handleDataZoom,
      onRestore: this.handleZoomRestore,
      onFinished: this.handleChartFinished,
      ...props,
    };

    return children(renderProps);
  }
}

export default ChartZoom;
