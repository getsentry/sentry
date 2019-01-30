import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {callIfFunction} from 'app/utils/callIfFunction';
import {getFormattedDate} from 'app/utils/dates';
import {useShortInterval} from 'app/components/charts/utils';
import {updateParams} from 'app/actionCreators/globalSelection';
import DataZoom from 'app/components/charts/components/dataZoom';
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
 *
 * TODO(billy): If this sees extended uses, this would be better as a child of LineChart so
 * you can enable it via a prop to `<LineChart>`
 */
class ChartZoom extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    period: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    utc: PropTypes.bool,
    disabled: PropTypes.bool,

    xAxis: SentryTypes.EChartsXAxis,

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
    callIfFunction(this.props.onZoom, {
      period,
      start: startFormatted,
      end: endFormatted,
    });

    this.zooming = () => {
      updateParams(
        {
          period,
          start: startFormatted,
          end: endFormatted,
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
      xAxis,
      disabled,
      children,

      onZoom, // eslint-disable-line no-unused-vars
      onRestore, // eslint-disable-line no-unused-vars
      onChartReady, // eslint-disable-line no-unused-vars
      onDataZoom, // eslint-disable-line no-unused-vars
      onFinished, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    if (disabled) {
      return children(props);
    }

    const hasShortInterval = useShortInterval(this.props);
    const xAxisOptions = {
      axisLabel: {
        formatter: (value, index) => {
          const firstItem = index === 0;
          const format = hasShortInterval && !firstItem ? 'LT' : 'lll';
          return getFormattedDate(value, format, {local: !utc});
        },
      },
      ...xAxis,
    };

    const tooltip = {
      formatAxisLabel: (value, isTimestamp, isUtc) => {
        if (!isTimestamp) {
          return value;
        }
        return getFormattedDate(value, 'lll', {local: !isUtc});
      },
    };

    const renderProps = {
      // Zooming only works when grouped by date
      isGroupedByDate: true,
      onChartReady: this.handleChartReady,
      utc,
      dataZoom: DataZoom(),
      tooltip,
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
      xAxis: xAxisOptions,
    };

    return children(renderProps);
  }
}

export default ChartZoom;
