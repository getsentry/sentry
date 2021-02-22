import React from 'react';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {EChartOption} from 'echarts/lib/echarts';
import moment from 'moment';

import {updateDateTime} from 'app/actionCreators/globalSelection';
import DataZoomInside from 'app/components/charts/components/dataZoomInside';
import ToolBox from 'app/components/charts/components/toolBox';
import {DateString} from 'app/types';
import {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
  EChartRestoreHandler,
} from 'app/types/echarts';
import {callIfFunction} from 'app/utils/callIfFunction';
import {getUtcToLocalDateObject} from 'app/utils/dates';

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

type Period = {
  period: string;
  start: DateString;
  end: DateString;
};

const ZoomPropKeys = [
  'period',
  'xAxis',
  'onChartReady',
  'onDataZoom',
  'onRestore',
  'onFinished',
] as const;

export type ZoomRenderProps = Pick<Props, typeof ZoomPropKeys[number]> & {
  utc?: boolean;
  start?: Date;
  end?: Date;
  isGroupedByDate?: boolean;
  showTimeInTooltip?: boolean;
  dataZoom?: EChartOption.DataZoom[];
  toolBox?: EChartOption['toolbox'];
};

type Props = {
  router?: WithRouterProps['router'];
  children: (props: ZoomRenderProps) => React.ReactNode;
  disabled?: boolean;
  xAxis?: EChartOption.XAxis;
  xAxisIndex?: number | number[];
  start?: DateString;
  end?: DateString;
  period?: string;
  utc?: boolean | null;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onRestore?: EChartRestoreHandler;
  onZoom?: (period: Period) => void;
};

/**
 * This is a very opinionated component that takes a render prop through `children`. It
 * will provide props to be passed to `BaseChart` to enable support of zooming without
 * eCharts' clunky zoom toolboxes.
 *
 * This also is very tightly coupled with the Global Selection Header. We can make it more
 * generic if need be in the future.
 */
class ChartZoom extends React.Component<Props> {
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

  history: Period[];
  currentPeriod?: Period;
  zooming: (() => void) | null = null;

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
  setPeriod = ({period, start, end}, saveHistory = false) => {
    const {router, onZoom} = this.props;
    const startFormatted = getDate(start);
    const endFormatted = getDate(end);

    // Save period so that we can revert back to it when using echarts "back" navigation
    if (saveHistory) {
      this.history.push(this.currentPeriod!);
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
      utc: _utc,
      start: _start,
      end: _end,
      disabled,
      children,
      xAxisIndex,

      router: _router,
      onZoom: _onZoom,
      onRestore: _onRestore,
      onChartReady: _onChartReady,
      onDataZoom: _onDataZoom,
      onFinished: _onFinished,
      ...props
    } = this.props;

    const utc = _utc ?? undefined;
    const start = _start ? getUtcToLocalDateObject(_start) : undefined;
    const end = _end ? getUtcToLocalDateObject(_end) : undefined;

    if (disabled) {
      return children({
        utc,
        start,
        end,
        ...props,
      });
    }

    const renderProps = {
      // Zooming only works when grouped by date
      isGroupedByDate: true,
      onChartReady: this.handleChartReady,
      utc,
      start,
      end,
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
      onFinished: this.handleChartFinished,
      onRestore: this.handleZoomRestore,
      ...props,
    };

    return children(renderProps);
  }
}

export default ChartZoom;
