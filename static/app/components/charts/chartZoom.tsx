import {Component} from 'react';
import {InjectedRouter} from 'react-router';
import type {
  DataZoomComponentOption,
  InsideDataZoomComponentOption,
  ToolboxComponentOption,
  XAXisComponentOption,
} from 'echarts';
import moment from 'moment';
import * as qs from 'query-string';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import DataZoomInside from 'sentry/components/charts/components/dataZoomInside';
import DataZoomSlider from 'sentry/components/charts/components/dataZoomSlider';
import ToolBox from 'sentry/components/charts/components/toolBox';
import {DateString} from 'sentry/types';
import {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
  EChartRestoreHandler,
} from 'sentry/types/echarts';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {getUtcDateString, getUtcToLocalDateObject} from 'sentry/utils/dates';

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

type Period = {
  end: DateString;
  period: string | null;
  start: DateString;
};

const ZoomPropKeys = [
  'period',
  'xAxis',
  'onChartReady',
  'onDataZoom',
  'onRestore',
  'onFinished',
] as const;

export interface ZoomRenderProps extends Pick<Props, (typeof ZoomPropKeys)[number]> {
  dataZoom?: DataZoomComponentOption[];
  end?: Date;
  isGroupedByDate?: boolean;
  showTimeInTooltip?: boolean;
  start?: Date;
  toolBox?: ToolboxComponentOption;
  utc?: boolean;
}

type Props = {
  children: (props: ZoomRenderProps) => React.ReactNode;
  chartZoomOptions?: DataZoomComponentOption;
  disabled?: boolean;
  end?: DateString;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onRestore?: EChartRestoreHandler;
  onZoom?: (period: Period) => void;
  period?: string | null;
  router?: InjectedRouter;
  saveOnZoom?: boolean;
  showSlider?: boolean;
  start?: DateString;
  usePageDate?: boolean;
  utc?: boolean | null;
  xAxis?: XAXisComponentOption;
  xAxisIndex?: number | number[];
};

/**
 * This is a very opinionated component that takes a render prop through `children`. It
 * will provide props to be passed to `BaseChart` to enable support of zooming without
 * eCharts' clunky zoom toolboxes.
 *
 * This also is very tightly coupled with the Global Selection Header. We can make it more
 * generic if need be in the future.
 */
class ChartZoom extends Component<Props> {
  constructor(props: Props) {
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
    const {router, onZoom, usePageDate, saveOnZoom} = this.props;
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
    onZoom?.({
      period,
      start: startFormatted,
      end: endFormatted,
    });

    this.zooming = () => {
      if (usePageDate && router) {
        const newQuery = {
          ...router.location.query,
          pageStart: start ? getUtcDateString(start) : undefined,
          pageEnd: end ? getUtcDateString(end) : undefined,
          pageStatsPeriod: period ?? undefined,
        };

        // Only push new location if query params has changed because this will cause a heavy re-render
        if (qs.stringify(newQuery) !== qs.stringify(router.location.query)) {
          router.push({
            pathname: router.location.pathname,
            query: newQuery,
          });
        }
      } else {
        updateDateTime(
          {
            period,
            start: startFormatted
              ? getUtcToLocalDateObject(startFormatted)
              : startFormatted,
            end: endFormatted ? getUtcToLocalDateObject(endFormatted) : endFormatted,
          },
          router,
          {save: saveOnZoom}
        );
      }

      this.saveCurrentPeriod({period, start, end});
    };
  };

  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  handleChartReady = chart => {
    this.props.onChartReady?.(chart);
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

    this.props.onRestore?.(evt, chart);
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {startValue, endValue} = model._payload.batch[0];

    // if `rangeStart` and `rangeEnd` are null, then we are going back
    if (startValue === null && endValue === null) {
      const previousPeriod = this.history.pop();

      if (!previousPeriod) {
        return;
      }

      this.setPeriod(previousPeriod);
    } else {
      const start = moment.utc(startValue);

      // Add a day so we go until the end of the day (e.g. next day at midnight)
      const end = moment.utc(endValue);

      this.setPeriod({period: null, start, end}, true);
    }

    this.props.onDataZoom?.(evt, chart);
  };

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  handleChartFinished = (_props, chart) => {
    if (typeof this.zooming === 'function') {
      this.zooming();
      this.zooming = null;
    }

    // This attempts to activate the area zoom toolbox feature
    const zoom = chart._componentsViews?.find(c => c._features && c._features.dataZoom);
    if (zoom && !zoom._features.dataZoom._isZoomActive) {
      // Calling dispatchAction will re-trigger handleChartFinished
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
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
      showSlider,
      chartZoomOptions,
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
      dataZoom: showSlider
        ? [
            ...DataZoomSlider({xAxisIndex, ...chartZoomOptions}),
            ...DataZoomInside({
              xAxisIndex,
              ...(chartZoomOptions as InsideDataZoomComponentOption),
            }),
          ]
        : DataZoomInside({
            xAxisIndex,
            ...(chartZoomOptions as InsideDataZoomComponentOption),
          }),
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
