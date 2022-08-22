"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_chartZoom_tsx-app_components_charts_errorPanel_tsx-app_components_chart-a35ba8"],{

/***/ "./app/components/charts/chartZoom.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/chartZoom.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/pageFilters */ "./app/actionCreators/pageFilters.tsx");
/* harmony import */ var sentry_components_charts_components_dataZoomInside__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/components/dataZoomInside */ "./app/components/charts/components/dataZoomInside.tsx");
/* harmony import */ var sentry_components_charts_components_dataZoomSlider__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/components/dataZoomSlider */ "./app/components/charts/components/dataZoomSlider.tsx");
/* harmony import */ var sentry_components_charts_components_toolBox__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/components/toolBox */ "./app/components/charts/components/toolBox.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");












const getDate = date => date ? moment__WEBPACK_IMPORTED_MODULE_3___default().utc(date).format((moment__WEBPACK_IMPORTED_MODULE_3___default().HTML5_FMT.DATETIME_LOCAL_SECONDS)) : null;

const ZoomPropKeys = ['period', 'xAxis', 'onChartReady', 'onDataZoom', 'onRestore', 'onFinished'];

/**
 * This is a very opinionated component that takes a render prop through `children`. It
 * will provide props to be passed to `BaseChart` to enable support of zooming without
 * eCharts' clunky zoom toolboxes.
 *
 * This also is very tightly coupled with the Global Selection Header. We can make it more
 * generic if need be in the future.
 */
class ChartZoom extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor(_props2) {
    var _this;

    super(_props2);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "history", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "currentPeriod", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "zooming", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "saveCurrentPeriod", props => {
      this.currentPeriod = {
        period: props.period,
        start: getDate(props.start),
        end: getDate(props.end)
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setPeriod", function (_ref) {
      let {
        period,
        start,
        end
      } = _ref;
      let saveHistory = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      const {
        router,
        onZoom,
        usePageDate
      } = _this.props;
      const startFormatted = getDate(start);
      const endFormatted = getDate(end); // Save period so that we can revert back to it when using echarts "back" navigation

      if (saveHistory) {
        _this.history.push(_this.currentPeriod);
      } // Callback to let parent component know zoom has changed
      // This is required for some more perceived responsiveness since
      // we delay updating URL state so that chart animation can finish
      //
      // Parent container can use this to change into a loading state before
      // URL parameters are changed


      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(onZoom, {
        period,
        start: startFormatted,
        end: endFormatted
      });

      _this.zooming = () => {
        if (usePageDate && router) {
          const newQuery = { ...router.location.query,
            pageStart: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcDateString)(start) : undefined,
            pageEnd: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcDateString)(end) : undefined,
            pageStatsPeriod: period !== null && period !== void 0 ? period : undefined
          }; // Only push new location if query params has changed because this will cause a heavy re-render

          if (query_string__WEBPACK_IMPORTED_MODULE_4__.stringify(newQuery) !== query_string__WEBPACK_IMPORTED_MODULE_4__.stringify(router.location.query)) {
            router.push({
              pathname: router.location.pathname,
              query: newQuery
            });
          }
        } else {
          (0,sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_5__.updateDateTime)({
            period,
            start: startFormatted ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcToLocalDateObject)(startFormatted) : startFormatted,
            end: endFormatted ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcToLocalDateObject)(endFormatted) : endFormatted
          }, router);
        }

        _this.saveCurrentPeriod({
          period,
          start,
          end
        });
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChartReady", chart => {
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(this.props.onChartReady, chart);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleZoomRestore", (evt, chart) => {
      if (!this.history.length) {
        return;
      }

      this.setPeriod(this.history[0]); // reset history

      this.history = [];
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(this.props.onRestore, evt, chart);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDataZoom", (evt, chart) => {
      const model = chart.getModel();
      const {
        startValue,
        endValue
      } = model._payload.batch[0]; // if `rangeStart` and `rangeEnd` are null, then we are going back

      if (startValue === null && endValue === null) {
        const previousPeriod = this.history.pop();

        if (!previousPeriod) {
          return;
        }

        this.setPeriod(previousPeriod);
      } else {
        const start = moment__WEBPACK_IMPORTED_MODULE_3___default().utc(startValue); // Add a day so we go until the end of the day (e.g. next day at midnight)

        const end = moment__WEBPACK_IMPORTED_MODULE_3___default().utc(endValue);
        this.setPeriod({
          period: null,
          start,
          end
        }, true);
      }

      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(this.props.onDataZoom, evt, chart);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChartFinished", (_props, chart) => {
      var _chart$_componentsVie;

      if (typeof this.zooming === 'function') {
        this.zooming();
        this.zooming = null;
      } // This attempts to activate the area zoom toolbox feature


      const zoom = (_chart$_componentsVie = chart._componentsViews) === null || _chart$_componentsVie === void 0 ? void 0 : _chart$_componentsVie.find(c => c._features && c._features.dataZoom);

      if (zoom && !zoom._features.dataZoom._isZoomActive) {
        // Calling dispatchAction will re-trigger handleChartFinished
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'dataZoomSelect',
          dataZoomSelectActive: true
        });
      }

      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_9__.callIfFunction)(this.props.onFinished);
    });

    // Zoom history
    this.history = []; // Initialize current period instance state for zoom history

    this.saveCurrentPeriod(_props2);
  }

  componentDidUpdate() {
    if (this.props.disabled) {
      return;
    } // When component updates, make sure we sync current period state
    // for use in zoom history


    this.saveCurrentPeriod(this.props);
  }

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
    const utc = _utc !== null && _utc !== void 0 ? _utc : undefined;
    const start = _start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcToLocalDateObject)(_start) : undefined;
    const end = _end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.getUtcToLocalDateObject)(_end) : undefined;

    if (disabled) {
      return children({
        utc,
        start,
        end,
        ...props
      });
    }

    const renderProps = {
      // Zooming only works when grouped by date
      isGroupedByDate: true,
      onChartReady: this.handleChartReady,
      utc,
      start,
      end,
      dataZoom: showSlider ? [...(0,sentry_components_charts_components_dataZoomSlider__WEBPACK_IMPORTED_MODULE_7__["default"])({
        xAxisIndex,
        ...chartZoomOptions
      }), ...(0,sentry_components_charts_components_dataZoomInside__WEBPACK_IMPORTED_MODULE_6__["default"])({
        xAxisIndex,
        ...chartZoomOptions
      })] : (0,sentry_components_charts_components_dataZoomInside__WEBPACK_IMPORTED_MODULE_6__["default"])({
        xAxisIndex,
        ...chartZoomOptions
      }),
      showTimeInTooltip: true,
      toolBox: (0,sentry_components_charts_components_toolBox__WEBPACK_IMPORTED_MODULE_8__["default"])({}, {
        dataZoom: {
          title: {
            zoom: '',
            back: ''
          },
          iconStyle: {
            borderWidth: 0,
            color: 'transparent',
            opacity: 0
          }
        }
      }),
      onDataZoom: this.handleDataZoom,
      onFinished: this.handleChartFinished,
      onRestore: this.handleZoomRestore,
      ...props
    };
    return children(renderProps);
  }

}

ChartZoom.displayName = "ChartZoom";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ChartZoom);

/***/ }),

/***/ "./app/components/charts/components/dataZoomInside.tsx":
/*!*************************************************************!*\
  !*** ./app/components/charts/components/dataZoomInside.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DataZoomInside)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_dataZoomInside__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/dataZoomInside */ "../node_modules/echarts/lib/component/dataZoomInside.js");

const DEFAULT = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is available but zoom is not
  zoomLock: true,
  throttle: 50
};
function DataZoomInside(props) {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = { ...DEFAULT,
      ...props
    };
    return [dataZoom];
  }

  return props;
}

/***/ }),

/***/ "./app/components/charts/components/dataZoomSlider.tsx":
/*!*************************************************************!*\
  !*** ./app/components/charts/components/dataZoomSlider.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DataZoomSlider)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_dataZoomSlider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/dataZoomSlider */ "../node_modules/echarts/lib/component/dataZoomSlider.js");

const DEFAULT = {
  realtime: false,
  showDetail: false,
  left: 0,
  right: 6,
  bottom: 8
};
function DataZoomSlider(props) {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = { ...DEFAULT,
      ...props
    };
    return [dataZoom];
  }

  return props;
}

/***/ }),

/***/ "./app/components/charts/components/toolBox.tsx":
/*!******************************************************!*\
  !*** ./app/components/charts/components/toolBox.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ToolBox)
/* harmony export */ });
function getFeatures() {
  let {
    dataZoom,
    ...features
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return { ...(dataZoom ? {
      dataZoom: {
        yAxisIndex: 'none',
        title: {
          zoom: 'zoom',
          back: 'undo'
        },
        ...dataZoom
      }
    } : {}),
    ...features
  };
}

function ToolBox(options, features) {
  return {
    right: 0,
    top: 0,
    itemSize: 16,
    // Stack the toolbox under the legend.
    // so all series names are clickable.
    z: -1,
    feature: getFeatures(features),
    ...options
  };
}

/***/ }),

/***/ "./app/components/charts/components/visualMap.tsx":
/*!********************************************************!*\
  !*** ./app/components/charts/components/visualMap.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VisualMap)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_visualMap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/visualMap */ "../node_modules/echarts/lib/component/visualMap.js");

function VisualMap(visualMap) {
  return visualMap;
}

/***/ }),

/***/ "./app/components/charts/errorPanel.tsx":
/*!**********************************************!*\
  !*** ./app/components/charts/errorPanel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const ErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1six6h50"
} : 0)("display:flex;flex-direction:column;justify-content:center;align-items:center;flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height || '200px', ";position:relative;border-color:transparent;margin-bottom:0;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorPanel);

/***/ }),

/***/ "./app/components/charts/lineChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/lineChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LineChart": () => (/* binding */ LineChart)
/* harmony export */ });
/* harmony import */ var _series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function LineChart(_ref) {
  let {
    series,
    seriesOptions,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    series: series.map(_ref2 => {
      let {
        seriesName,
        data,
        dataArray,
        ...options
      } = _ref2;
      return (0,_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...seriesOptions,
        ...options,
        name: seriesName,
        data: dataArray || (data === null || data === void 0 ? void 0 : data.map(_ref3 => {
          let {
            value,
            name
          } = _ref3;
          return [name, value];
        })),
        animation: false,
        animationThreshold: 1,
        animationDuration: 0
      });
    })
  });
}
LineChart.displayName = "LineChart";

/***/ }),

/***/ "./app/components/charts/series/mapSeries.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/series/mapSeries.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MapSeries)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/map */ "../node_modules/echarts/lib/chart/map.js");

function MapSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
    map: ''
  };
  return {
    roam: true,
    ...props,
    emphasis: {
      label: {
        show: false
      },
      ...props.emphasis
    },
    type: 'map'
  };
}

/***/ }),

/***/ "./app/components/charts/transitionChart.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/transitionChart.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const defaultProps = {
  height: '200px'
};

class TransitionChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      prevReloading: this.props.reloading,
      prevLoading: this.props.loading,
      key: 1
    });
  }

  static getDerivedStateFromProps(props, state) {
    // Transitions are controlled using variables called:
    // - loading and,
    // - reloading (also called pending in other apps)
    //
    // This component remounts the chart to ensure the stable transition
    // from one dataset to the next.
    const prevReloading = state.prevReloading;
    const nextReloading = props.reloading;
    const prevLoading = state.prevLoading;
    const nextLoading = props.loading; // whenever loading changes, we explicitly remount the children by updating
    // the key prop; regardless of what state reloading is in

    if (prevLoading !== nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // invariant: prevLoading === nextLoading
    // if loading is true, and hasn't changed from the previous re-render,
    // do not remount the children.


    if (nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key
      };
    } // invariant: loading is false
    // whenever the chart is transitioning from the reloading (pending) state to a non-loading state,
    // remount the children


    if (prevReloading && !nextReloading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // do not remount the children in these remaining cases:
    // !prevReloading && !nextReloading (re-render with no prop change)
    // prevReloading && nextReloading (re-render with no prop change)
    // !prevReloading && nextReloading (from loaded to pending state)


    return {
      prevReloading: nextReloading,
      prevLoading: nextLoading,
      key: state.key
    };
  }

  render() {
    const {
      height,
      loading,
      reloading
    } = this.props;

    if (loading && !reloading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: height,
        "data-test-id": "events-request-loading"
      });
    } // We make use of the key prop to explicitly remount the children
    // https://reactjs.org/docs/lists-and-keys.html#keys


    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: this.props.children
    }, String(this.state.key));
  }

}

TransitionChart.displayName = "TransitionChart";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(TransitionChart, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransitionChart);

/***/ }),

/***/ "./app/components/charts/transparentLoadingMask.tsx":
/*!**********************************************************!*\
  !*** ./app/components/charts/transparentLoadingMask.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const TransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    className,
    visible,
    children,
    ...props
  } = _ref;
  const other = visible ? { ...props,
    'data-test-id': 'loading-placeholder'
  } : props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    ...other,
    children: children
  });
},  true ? {
  target: "ewtkxp50"
} : 0)(p => !p.visible && 'display: none;', ";opacity:0.4;z-index:1;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransparentLoadingMask);

/***/ }),

/***/ "./app/components/charts/worldMapChart.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/worldMapChart.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WorldMapChart": () => (/* binding */ WorldMapChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/lib/core/echarts.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/core.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/max */ "../node_modules/lodash/max.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_max__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _components_visualMap__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/visualMap */ "./app/components/charts/components/visualMap.tsx");
/* harmony import */ var _series_mapSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./series/mapSeries */ "./app/components/charts/series/mapSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const DEFAULT_ZOOM = 1.3;
const DISCOVER_ZOOM = 1.1;
const DISCOVER_QUERY_LIST_ZOOM = 0.9;
const DEFAULT_CENTER_X = 10.97;
const DISCOVER_QUERY_LIST_CENTER_Y = -12;
const DEFAULT_CENTER_Y = 9.71;
function WorldMapChart(_ref) {
  let {
    series,
    seriesOptions,
    fromDiscover,
    fromDiscoverQueryList,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(() => ({
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null
  }));
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    let unmounted = false;

    if (!unmounted) {
      loadWorldMap();
    }

    return () => {
      unmounted = true;
    };
  }, []);

  async function loadWorldMap() {
    try {
      var _echarts$registerMap;

      const [countryCodesMap, world] = await Promise.all([__webpack_require__.e(/*! import() */ "app_data_countryCodesMap_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/data/countryCodesMap */ "./app/data/countryCodesMap.tsx")), __webpack_require__.e(/*! import() */ "app_data_world_json").then(__webpack_require__.t.bind(__webpack_require__, /*! sentry/data/world.json */ "./app/data/world.json", 19))]);
      const countryToCodeMap = countryCodesMap.default;
      const worldMap = world.default; // Echarts not available in tests

      (_echarts$registerMap = echarts_core__WEBPACK_IMPORTED_MODULE_7__.registerMap) === null || _echarts$registerMap === void 0 ? void 0 : _echarts$registerMap.call(echarts_core__WEBPACK_IMPORTED_MODULE_8__, 'sentryWorld', worldMap);
      const codeToCountryMap = {};

      for (const country in worldMap) {
        codeToCountryMap[countryToCodeMap[country]] = country;
      }

      setState({
        countryToCodeMap,
        map: worldMap,
        codeToCountryMap
      });
    } catch {// do nothing
    }
  }

  if (state.countryToCodeMap === null || state.map === null) {
    return null;
  }

  const processedSeries = series.map(_ref2 => {
    var _state$countryToCodeM;

    let {
      seriesName,
      data,
      ...options
    } = _ref2;
    return (0,_series_mapSeries__WEBPACK_IMPORTED_MODULE_4__["default"])({ ...seriesOptions,
      ...options,
      map: 'sentryWorld',
      name: seriesName,
      nameMap: (_state$countryToCodeM = state.countryToCodeMap) !== null && _state$countryToCodeM !== void 0 ? _state$countryToCodeM : undefined,
      aspectScale: 0.85,
      zoom: fromDiscover ? DISCOVER_ZOOM : fromDiscoverQueryList ? DISCOVER_QUERY_LIST_ZOOM : DEFAULT_ZOOM,
      center: [DEFAULT_CENTER_X, fromDiscoverQueryList ? DISCOVER_QUERY_LIST_CENTER_Y : DEFAULT_CENTER_Y],
      itemStyle: {
        areaColor: theme.gray200,
        borderColor: theme.backgroundSecondary
      },
      emphasis: {
        itemStyle: {
          areaColor: theme.pink300
        },
        label: {
          show: false
        }
      },
      data,
      silent: fromDiscoverQueryList,
      roam: !fromDiscoverQueryList
    });
  }); // TODO(billy):
  // For absolute values, we want min/max to based on min/max of series
  // Otherwise it should be 0-100

  const maxValue = lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(series.map(_ref3 => {
    let {
      data
    } = _ref3;
    return lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(data.map(_ref4 => {
      let {
        value
      } = _ref4;
      return value;
    }));
  })) || 1;

  const tooltipFormatter = format => {
    var _state$codeToCountryM;

    const {
      marker,
      name,
      value
    } = Array.isArray(format) ? format[0] : format; // If value is NaN, don't show anything because we won't have a country code either

    if (isNaN(value)) {
      return '';
    } // `value` should be a number


    const formattedValue = typeof value === 'number' ? value.toLocaleString() : '';
    const countryOrCode = ((_state$codeToCountryM = state.codeToCountryMap) === null || _state$codeToCountryM === void 0 ? void 0 : _state$codeToCountryM[name]) || name;
    return [`<div class="tooltip-series tooltip-series-solo">
               <div><span class="tooltip-label">${marker} <strong>${countryOrCode}</strong></span> ${formattedValue}</div>
            </div>`, '<div class="tooltip-arrow"></div>'].join('');
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
    options: {
      backgroundColor: fromDiscoverQueryList ? undefined : theme.background,
      visualMap: [(0,_components_visualMap__WEBPACK_IMPORTED_MODULE_3__["default"])({
        show: !fromDiscoverQueryList,
        left: fromDiscover ? undefined : 'right',
        right: fromDiscover ? 5 : undefined,
        min: 0,
        max: maxValue,
        inRange: {
          color: [theme.purple200, theme.purple300]
        },
        text: ['High', 'Low'],
        textStyle: {
          color: theme.textColor
        },
        // Whether show handles, which can be dragged to adjust "selected range".
        // False because the handles are pretty ugly
        calculable: false
      })]
    },
    ...props,
    yAxis: null,
    xAxis: null,
    series: processedSeries,
    tooltip: {
      formatter: tooltipFormatter
    },
    height: fromDiscover ? 400 : undefined
  });
}
WorldMapChart.displayName = "WorldMapChart";

/***/ }),

/***/ "./app/utils/touch.tsx":
/*!*****************************!*\
  !*** ./app/utils/touch.tsx ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getPointerPosition": () => (/* binding */ getPointerPosition)
/* harmony export */ });
function isReactEvent(maybe) {
  return 'nativeEvent' in maybe;
}
/**
 * Handle getting position out of both React and Raw DOM events
 * as both are handled here due to mousedown/mousemove events
 * working differently.
 */


function getPointerPosition(event, property) {
  const actual = isReactEvent(event) ? event.nativeEvent : event;

  if (window.TouchEvent && actual instanceof TouchEvent) {
    return actual.targetTouches[0][property];
  }

  if (actual instanceof MouseEvent) {
    return actual[property];
  }

  return 0;
}

/***/ }),

/***/ "./app/utils/userselect.tsx":
/*!**********************************!*\
  !*** ./app/utils/userselect.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "setBodyUserSelect": () => (/* binding */ setBodyUserSelect)
/* harmony export */ });
const setBodyUserSelect = nextValues => {
  // NOTE: Vendor prefixes other than `ms` should begin with a capital letter.
  // ref: https://reactjs.org/docs/dom-elements.html#style
  const previousValues = {
    userSelect: document.body.style.userSelect,
    // MozUserSelect is not typed in TS
    // @ts-expect-error
    MozUserSelect: document.body.style.MozUserSelect,
    // msUserSelect is not typed in TS
    // @ts-expect-error
    msUserSelect: document.body.style.msUserSelect,
    webkitUserSelect: document.body.style.webkitUserSelect
  };
  document.body.style.userSelect = nextValues.userSelect || ''; // MozUserSelect is not typed in TS
  // @ts-expect-error

  document.body.style.MozUserSelect = nextValues.MozUserSelect || ''; // msUserSelect is not typed in TS
  // @ts-expect-error

  document.body.style.msUserSelect = nextValues.msUserSelect || '';
  document.body.style.webkitUserSelect = nextValues.webkitUserSelect || '';
  return previousValues;
};

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FieldKey": () => (/* binding */ FieldKey),
/* harmony export */   "ISSUE_FIELDS": () => (/* binding */ ISSUE_FIELDS),
/* harmony export */   "ISSUE_FIELD_TO_HEADER_MAP": () => (/* binding */ ISSUE_FIELD_TO_HEADER_MAP)
/* harmony export */ });
let FieldKey;

(function (FieldKey) {
  FieldKey["ASSIGNEE"] = "assignee";
  FieldKey["TITLE"] = "title";
  FieldKey["ISSUE"] = "issue";
  FieldKey["LEVEL"] = "level";
  FieldKey["STATUS"] = "status";
  FieldKey["PLATFORM"] = "platform";
  FieldKey["IS_BOOKMARKED"] = "isBookmarked";
  FieldKey["IS_SUBSCRIBED"] = "isSubscribed";
  FieldKey["IS_HANDLED"] = "isHandled";
  FieldKey["LAST_SEEN"] = "lastSeen";
  FieldKey["FIRST_SEEN"] = "firstSeen";
  FieldKey["EVENTS"] = "events";
  FieldKey["USERS"] = "users";
  FieldKey["LIFETIME_EVENTS"] = "lifetimeEvents";
  FieldKey["LIFETIME_USERS"] = "lifetimeUsers";
  FieldKey["PROJECT"] = "project";
  FieldKey["LINKS"] = "links";
})(FieldKey || (FieldKey = {}));

const ISSUE_FIELDS = {
  [FieldKey.ASSIGNEE]: 'string',
  [FieldKey.TITLE]: 'string',
  [FieldKey.ISSUE]: 'string',
  [FieldKey.LEVEL]: 'string',
  [FieldKey.STATUS]: 'string',
  [FieldKey.PLATFORM]: 'string',
  [FieldKey.IS_BOOKMARKED]: 'boolean',
  [FieldKey.IS_SUBSCRIBED]: 'boolean',
  [FieldKey.IS_HANDLED]: 'boolean',
  [FieldKey.LAST_SEEN]: 'date',
  [FieldKey.FIRST_SEEN]: 'date',
  [FieldKey.EVENTS]: 'string',
  [FieldKey.USERS]: 'string',
  [FieldKey.LIFETIME_EVENTS]: 'string',
  [FieldKey.LIFETIME_USERS]: 'string',
  [FieldKey.PROJECT]: 'string',
  [FieldKey.LINKS]: 'string'
};
const ISSUE_FIELD_TO_HEADER_MAP = {
  [FieldKey.LIFETIME_EVENTS]: 'Lifetime Events',
  [FieldKey.LIFETIME_USERS]: 'Lifetime Users'
};

/***/ }),

/***/ "./app/views/eventsV2/table/columnEditCollection.tsx":
/*!***********************************************************!*\
  !*** ./app/views/eventsV2/table/columnEditCollection.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/arithmeticInput/parser */ "./app/components/arithmeticInput/parser.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_touch__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/touch */ "./app/utils/touch.tsx");
/* harmony import */ var sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/userselect */ "./app/utils/userselect.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/issueWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _queryField__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./queryField */ "./app/views/eventsV2/table/queryField.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























const DRAG_CLASS = 'draggable-item';
const GHOST_PADDING = 4;
const MAX_COL_COUNT = 20;
var PlaceholderPosition;

(function (PlaceholderPosition) {
  PlaceholderPosition[PlaceholderPosition["TOP"] = 0] = "TOP";
  PlaceholderPosition[PlaceholderPosition["BOTTOM"] = 1] = "BOTTOM";
})(PlaceholderPosition || (PlaceholderPosition = {}));

class ColumnEditCollection extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isDragging: false,
      draggingIndex: void 0,
      draggingTargetIndex: void 0,
      draggingGrabbedOffset: void 0,
      error: new Map(),
      left: void 0,
      top: void 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "previousUserSelect", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "portal", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dragGhostRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddColumn", () => {
      const newColumn = {
        kind: 'field',
        field: ''
      };
      this.props.onChange([...this.props.columns, newColumn]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddEquation", () => {
      const {
        organization
      } = this.props;
      const newColumn = {
        kind: _types__WEBPACK_IMPORTED_MODULE_24__.FieldValueKind.EQUATION,
        field: ''
      };
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
        eventKey: 'discover_v2.add_equation',
        eventName: 'Discoverv2: Equation added',
        organization_id: parseInt(organization.id, 10)
      });
      this.props.onChange([...this.props.columns, newColumn]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateColumn", (index, updatedColumn) => {
      const newColumns = [...this.props.columns];

      if (updatedColumn.kind === 'equation') {
        this.setState(prevState => {
          const error = new Map(prevState.error);
          error.set(index, (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_6__.parseArithmetic)(updatedColumn.field).error);
          return { ...prevState,
            error
          };
        });
      } else {
        // Update any equations that contain the existing column
        this.updateEquationFields(newColumns, index, updatedColumn);
      }

      newColumns.splice(index, 1, updatedColumn);
      this.props.onChange(newColumns);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateEquationFields", (newColumns, index, updatedColumn) => {
      const oldColumn = newColumns[index];
      const existingColumn = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.generateFieldAsString)(newColumns[index]);
      const updatedColumnString = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.generateFieldAsString)(updatedColumn);

      if (!(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isLegalEquationColumn)(updatedColumn) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.hasDuplicate)(newColumns, oldColumn)) {
        return;
      } // Find the equations in the list of columns


      for (let i = 0; i < newColumns.length; i++) {
        const newColumn = newColumns[i];

        if (newColumn.kind === 'equation') {
          const result = (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_6__.parseArithmetic)(newColumn.field);
          let newEquation = ''; // Track where to continue from, not reconstructing from result so we don't have to worry
          // about spacing

          let lastIndex = 0; // the parser separates fields & functions, so we only need to check one

          const fields = oldColumn.kind === 'function' ? result.tc.functions : result.tc.fields; // for each field, add the text before it, then the new function and update index
          // to be where we want to start again

          for (const field of fields) {
            if (field.term === existingColumn && lastIndex !== field.location.end.offset) {
              newEquation += newColumn.field.substring(lastIndex, field.location.start.offset) + updatedColumnString;
              lastIndex = field.location.end.offset;
            }
          } // Add whatever remains to be added from the equation, if existing field wasn't found
          // add the entire equation


          newEquation += newColumn.field.substring(lastIndex);
          newColumns[i] = {
            kind: 'equation',
            field: newEquation,
            alias: newColumns[i].alias
          };
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragMove", event => {
      var _draggingGrabbedOffse, _draggingGrabbedOffse2;

      const {
        isDragging,
        draggingTargetIndex,
        draggingGrabbedOffset
      } = this.state;

      if (!isDragging || !['mousemove', 'touchmove'].includes(event.type)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const pointerX = (0,sentry_utils_touch__WEBPACK_IMPORTED_MODULE_18__.getPointerPosition)(event, 'pageX');
      const pointerY = (0,sentry_utils_touch__WEBPACK_IMPORTED_MODULE_18__.getPointerPosition)(event, 'pageY');
      const dragOffsetX = (_draggingGrabbedOffse = draggingGrabbedOffset === null || draggingGrabbedOffset === void 0 ? void 0 : draggingGrabbedOffset.x) !== null && _draggingGrabbedOffse !== void 0 ? _draggingGrabbedOffse : 0;
      const dragOffsetY = (_draggingGrabbedOffse2 = draggingGrabbedOffset === null || draggingGrabbedOffset === void 0 ? void 0 : draggingGrabbedOffset.y) !== null && _draggingGrabbedOffse2 !== void 0 ? _draggingGrabbedOffse2 : 0;

      if (this.dragGhostRef.current) {
        // move the ghost box
        const ghostDOM = this.dragGhostRef.current; // Adjust so cursor is over the grab handle.

        ghostDOM.style.left = `${pointerX - dragOffsetX}px`;
        ghostDOM.style.top = `${pointerY - dragOffsetY}px`;
      }

      const dragItems = document.querySelectorAll(`.${DRAG_CLASS}`); // Find the item that the ghost is currently over.

      const targetIndex = Array.from(dragItems).findIndex(dragItem => {
        const rects = dragItem.getBoundingClientRect();
        const top = pointerY;
        const thresholdStart = window.scrollY + rects.top;
        const thresholdEnd = window.scrollY + rects.top + rects.height;
        return top >= thresholdStart && top <= thresholdEnd;
      }); // Issue column in Issue widgets are fixed (cannot be moved or deleted)

      if (targetIndex >= 0 && targetIndex !== draggingTargetIndex) {
        this.setState({
          draggingTargetIndex: targetIndex
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isFixedIssueColumn", columnIndex => {
      const {
        source,
        columns
      } = this.props;
      const column = columns[columnIndex];
      const issueFieldColumnCount = columns.filter(col => col.kind === 'field' && col.field === sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_21__.FieldKey.ISSUE).length;
      return issueFieldColumnCount <= 1 && source === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.ISSUE && column.kind === 'field' && column.field === sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_21__.FieldKey.ISSUE;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isRemainingReleaseHealthAggregate", columnIndex => {
      const {
        source,
        columns
      } = this.props;
      const column = columns[columnIndex];
      const aggregateCount = columns.filter(col => col.kind === _types__WEBPACK_IMPORTED_MODULE_24__.FieldValueKind.FUNCTION).length;
      return aggregateCount <= 1 && source === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.RELEASE && column.kind === _types__WEBPACK_IMPORTED_MODULE_24__.FieldValueKind.FUNCTION;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDragEnd", event => {
      if (!this.state.isDragging || !['mouseup', 'touchend'].includes(event.type)) {
        return;
      }

      const sourceIndex = this.state.draggingIndex;
      const targetIndex = this.state.draggingTargetIndex;

      if (typeof sourceIndex !== 'number' || typeof targetIndex !== 'number') {
        return;
      } // remove listeners that were attached in startColumnDrag


      this.cleanUpListeners(); // restore body user-select values

      if (this.previousUserSelect) {
        (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_19__.setBodyUserSelect)(this.previousUserSelect);
        this.previousUserSelect = null;
      } // Reorder columns and trigger change.


      const newColumns = [...this.props.columns];
      const removed = newColumns.splice(sourceIndex, 1);
      newColumns.splice(targetIndex, 0, removed[0]);
      this.checkColumnErrors(newColumns);
      this.props.onChange(newColumns);
      this.setState({
        isDragging: false,
        left: undefined,
        top: undefined,
        draggingIndex: undefined,
        draggingTargetIndex: undefined,
        draggingGrabbedOffset: undefined
      });
    });
  }

  componentDidMount() {
    if (!this.portal) {
      const portal = document.createElement('div');
      portal.style.position = 'absolute';
      portal.style.top = '0';
      portal.style.left = '0';
      portal.style.zIndex = String(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_17__["default"].zIndex.modal);
      this.portal = portal;
      document.body.appendChild(this.portal);
    }

    this.checkColumnErrors(this.props.columns);
  }

  componentWillUnmount() {
    if (this.portal) {
      document.body.removeChild(this.portal);
    }

    this.cleanUpListeners();
  }

  checkColumnErrors(columns) {
    const error = new Map();

    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];

      if (column.kind === 'equation') {
        const result = (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_6__.parseArithmetic)(column.field);

        if (result.error) {
          error.set(i, result.error);
        }
      }
    }

    this.setState({
      error
    });
  }

  keyForColumn(column, isGhost) {
    if (column.kind === 'function') {
      return [...column.function, isGhost].join(':');
    }

    return [...column.field, isGhost].join(':');
  }

  cleanUpListeners() {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('touchmove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
      window.removeEventListener('touchend', this.onDragEnd);
    }
  } // Signal to the parent that a new column has been added.


  removeColumn(index) {
    const newColumns = [...this.props.columns];
    newColumns.splice(index, 1);
    this.checkColumnErrors(newColumns);
    this.props.onChange(newColumns);
  }

  startDrag(event, index) {
    const isDragging = this.state.isDragging;

    if (isDragging || !['mousedown', 'touchstart'].includes(event.type)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const top = (0,sentry_utils_touch__WEBPACK_IMPORTED_MODULE_18__.getPointerPosition)(event, 'pageY');
    const left = (0,sentry_utils_touch__WEBPACK_IMPORTED_MODULE_18__.getPointerPosition)(event, 'pageX'); // Compute where the user clicked on the drag handle. Avoids the element
    // jumping from the cursor on mousedown.

    const draggingElement = Array.from(document.querySelectorAll(`.${DRAG_CLASS}`)).find(n => n.contains(event.currentTarget));
    const {
      x,
      y
    } = (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_11__.getOffsetOfElement)(draggingElement);
    const draggingGrabbedOffset = {
      x: left - x + GHOST_PADDING,
      y: top - y + GHOST_PADDING
    }; // prevent the user from selecting things when dragging a column.

    this.previousUserSelect = (0,sentry_utils_userselect__WEBPACK_IMPORTED_MODULE_19__.setBodyUserSelect)({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none'
    }); // attach event listeners so that the mouse cursor can drag anywhere

    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('touchmove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    window.addEventListener('touchend', this.onDragEnd);
    this.setState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      draggingGrabbedOffset,
      top,
      left
    });
  }

  renderGhost(_ref) {
    var _draggingGrabbedOffse3, _draggingGrabbedOffse4;

    let {
      gridColumns,
      singleColumn
    } = _ref;
    const {
      isDragging,
      draggingIndex,
      draggingGrabbedOffset
    } = this.state;
    const index = draggingIndex;

    if (typeof index !== 'number' || !isDragging || !this.portal) {
      return null;
    }

    const dragOffsetX = (_draggingGrabbedOffse3 = draggingGrabbedOffset === null || draggingGrabbedOffset === void 0 ? void 0 : draggingGrabbedOffset.x) !== null && _draggingGrabbedOffse3 !== void 0 ? _draggingGrabbedOffse3 : 0;
    const dragOffsetY = (_draggingGrabbedOffse4 = draggingGrabbedOffset === null || draggingGrabbedOffset === void 0 ? void 0 : draggingGrabbedOffset.y) !== null && _draggingGrabbedOffse4 !== void 0 ? _draggingGrabbedOffse4 : 0;
    const top = Number(this.state.top) - dragOffsetY;
    const left = Number(this.state.left) - dragOffsetX;
    const col = this.props.columns[index];
    const style = {
      top: `${top}px`,
      left: `${left}px`
    };

    const ghost = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Ghost, {
      ref: this.dragGhostRef,
      style: style,
      children: this.renderItem(col, index, {
        singleColumn,
        isGhost: true,
        gridColumns
      })
    });

    return /*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_5__.createPortal)(ghost, this.portal);
  }

  renderItem(col, i, _ref2) {
    var _col$alias;

    let {
      singleColumn = false,
      canDelete = true,
      canDrag = true,
      isGhost = false,
      gridColumns = 2,
      disabled = false
    } = _ref2;
    const {
      columns,
      fieldOptions,
      filterAggregateParameters,
      filterPrimaryOptions,
      noFieldsMessage,
      showAliasField
    } = this.props;
    const {
      isDragging,
      draggingTargetIndex,
      draggingIndex
    } = this.state;
    let placeholder = null; // Add a placeholder above the target row.

    if (isDragging && isGhost === false && draggingTargetIndex === i) {
      placeholder = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(DragPlaceholder, {
        className: DRAG_CLASS
      }, `placeholder:${this.keyForColumn(col, isGhost)}`);
    } // If the current row is the row in the drag ghost return the placeholder
    // or a hole if the placeholder is elsewhere.


    if (isDragging && isGhost === false && draggingIndex === i) {
      return placeholder;
    }

    const position = Number(draggingTargetIndex) <= Number(draggingIndex) ? PlaceholderPosition.TOP : PlaceholderPosition.BOTTOM;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [position === PlaceholderPosition.TOP && placeholder, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(RowContainer, {
        showAliasField: showAliasField,
        singleColumn: singleColumn,
        className: isGhost ? '' : DRAG_CLASS,
        children: [canDrag ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(DragAndReorderButton, {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Drag to reorder'),
          onMouseDown: event => this.startDrag(event, i),
          onTouchStart: event => this.startDrag(event, i),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconGrabbable, {
            size: "xs"
          }),
          size: "zero",
          borderless: true
        }) : singleColumn && showAliasField ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("span", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_queryField__WEBPACK_IMPORTED_MODULE_23__.QueryField, {
          fieldOptions: fieldOptions,
          gridColumns: gridColumns,
          fieldValue: col,
          onChange: value => this.handleUpdateColumn(i, value),
          error: this.state.error.get(i),
          takeFocus: i === this.props.columns.length - 1,
          otherColumns: columns,
          shouldRenderTag: true,
          disabled: disabled,
          filterPrimaryOptions: filterPrimaryOptions,
          filterAggregateParameters: filterAggregateParameters,
          noFieldsMessage: noFieldsMessage,
          skipParameterPlaceholder: showAliasField
        }), showAliasField && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AliasField, {
          singleColumn: singleColumn,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AliasInput, {
            name: "alias",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Alias'),
            value: (_col$alias = col.alias) !== null && _col$alias !== void 0 ? _col$alias : '',
            onChange: value => {
              this.handleUpdateColumn(i, { ...col,
                alias: value.target.value
              });
            }
          })
        }), canDelete || col.kind === 'equation' ? showAliasField ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(RemoveButton, {
          "data-test-id": `remove-column-${i}`,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove column'),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove column'),
          onClick: () => this.removeColumn(i),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {}),
          borderless: true
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(RemoveButton, {
          "data-test-id": `remove-column-${i}`,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove column'),
          onClick: () => this.removeColumn(i),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {}),
          borderless: true
        }) : singleColumn && showAliasField ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)("span", {})]
      }), position === PlaceholderPosition.BOTTOM && placeholder]
    }, `${i}:${this.keyForColumn(col, isGhost)}`);
  }

  render() {
    const {
      className,
      columns,
      showAliasField,
      source
    } = this.props;
    const canDelete = columns.filter(field => field.kind !== 'equation').length > 1;
    const canDrag = columns.length > 1;
    const canAdd = columns.length < MAX_COL_COUNT;
    const title = canAdd ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)(`Sorry, you've reached the maximum number of columns (${MAX_COL_COUNT}). Delete columns to add more.`);
    const singleColumn = columns.length === 1; // Get the longest number of columns so we can layout the rows.
    // We always want at least 2 columns.

    const gridColumns = source === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.ISSUE ? 1 : Math.max(...columns.map(col => {
      var _AGGREGATIONS$col$fun;

      if (col.kind !== 'function') {
        return 2;
      }

      const operation = (_AGGREGATIONS$col$fun = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.AGGREGATIONS[col.function[0]]) !== null && _AGGREGATIONS$col$fun !== void 0 ? _AGGREGATIONS$col$fun : sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_22__.SESSIONS_OPERATIONS[col.function[0]];
      return operation.parameters.length === 2 ? 3 : 2;
    }));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)("div", {
      className: className,
      children: [this.renderGhost({
        gridColumns,
        singleColumn
      }), !showAliasField && source !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.ISSUE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(RowContainer, {
        showAliasField: showAliasField,
        singleColumn: singleColumn,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(Heading, {
          gridColumns: gridColumns,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledSectionHeading, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Tag / Field / Function')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledSectionHeading, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Field Parameter')
          })]
        })
      }), columns.map((col, i) => {
        // Issue column in Issue widgets are fixed (cannot be changed or deleted)
        if (this.isFixedIssueColumn(i)) {
          return this.renderItem(col, i, {
            singleColumn,
            canDelete: false,
            canDrag,
            gridColumns,
            disabled: true
          });
        }

        if (this.isRemainingReleaseHealthAggregate(i)) {
          return this.renderItem(col, i, {
            singleColumn,
            canDelete: false,
            canDrag,
            gridColumns
          });
        }

        return this.renderItem(col, i, {
          singleColumn,
          canDelete,
          canDrag,
          gridColumns
        });
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(RowContainer, {
        showAliasField: showAliasField,
        singleColumn: singleColumn,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(Actions, {
          gap: 1,
          showAliasField: showAliasField,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            size: "sm",
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add a Column'),
            onClick: this.handleAddColumn,
            title: title,
            disabled: !canAdd,
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconAdd, {
              isCircled: true,
              size: "xs"
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add a Column')
          }), source !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.ISSUE && source !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_20__.WidgetType.RELEASE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            size: "sm",
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add an Equation'),
            onClick: this.handleAddEquation,
            title: title,
            disabled: !canAdd,
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconAdd, {
              isCircled: true,
              size: "xs"
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add an Equation')
          })]
        })
      })]
    });
  }

}

ColumnEditCollection.displayName = "ColumnEditCollection";

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ev0fm799"
} : 0)("grid-column:", p => p.showAliasField ? '1/-1' : ' 2/3', ";justify-content:flex-start;" + ( true ? "" : 0));

const RowContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev0fm798"
} : 0)("display:grid;grid-template-columns:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), " 1fr 40px;justify-content:center;align-items:center;width:100%;touch-action:none;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";", p => p.showAliasField && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_26__.css)("align-items:flex-start;grid-template-columns:", p.singleColumn ? `1fr` : `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3)} 1fr 40px`, ";@media (min-width: ", p.theme.breakpoints.small, "){grid-template-columns:", p.singleColumn ? `1fr calc(200px + ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1)})` : `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3)} 1fr calc(200px + ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1)}) 40px`, ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const Ghost = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev0fm797"
} : 0)("background:", p => p.theme.background, ";display:block;position:absolute;padding:", GHOST_PADDING, "px;border-radius:", p => p.theme.borderRadius, ";box-shadow:0 0 15px rgba(0, 0, 0, 0.15);width:710px;opacity:0.8;cursor:grabbing;padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";&>", RowContainer, "{padding-bottom:0;}& svg{cursor:grabbing;}" + ( true ? "" : 0));

const DragPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev0fm796"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), ";border:2px dashed ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";height:41px;" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev0fm795"
} : 0)("grid-column:2/3;display:grid;grid-template-columns:repeat(", p => p.gridColumns, ", 1fr);grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const StyledSectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.SectionHeading,  true ? {
  target: "ev0fm794"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const AliasInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ev0fm793"
} : 0)( true ? {
  name: "1bzx5v3",
  styles: "height:40px;min-width:50px"
} : 0);

const AliasField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev0fm792"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";@media (min-width: ", p => p.theme.breakpoints.small, "){margin-top:0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";}@media (max-width: ", p => p.theme.breakpoints.small, "){grid-row:2/2;grid-column:", p => p.singleColumn ? '1/-1' : '2/2', ";}" + ( true ? "" : 0));

const RemoveButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ev0fm791"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";height:40px;" + ( true ? "" : 0));

const DragAndReorderButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ev0fm790"
} : 0)( true ? {
  name: "1k18kha",
  styles: "height:40px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ColumnEditCollection);

/***/ }),

/***/ "./app/views/eventsV2/table/topResultsIndicator.tsx":
/*!**********************************************************!*\
  !*** ./app/views/eventsV2/table/topResultsIndicator.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const TopResultsIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r2bjtv0"
} : 0)("position:absolute;left:-1px;margin-top:4.5px;width:9px;height:15px;border-radius:0 3px 3px 0;background-color:", p => {
  // this background color needs to match the colors used in
  // app/components/charts/eventsChart so that the ordering matches
  // the color pallete contains n + 2 colors, so we subtract 2 here
  return p.theme.charts.getColorPalette(p.count - 2)[p.index];
}, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TopResultsIndicator);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_chartZoom_tsx-app_components_charts_errorPanel_tsx-app_components_chart-a35ba8.999c1c9132df7b7e1e0fd1c2eb33f458.js.map