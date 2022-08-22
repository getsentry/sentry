"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_profiling_content_tsx"],{

/***/ "./app/components/charts/areaChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/areaChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AreaChart": () => (/* binding */ AreaChart)
/* harmony export */ });
/* harmony import */ var _series_areaSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/areaSeries */ "./app/components/charts/series/areaSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function AreaChart(_ref) {
  let {
    series,
    stacked,
    colors,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    "data-test-id": "area-chart",
    colors: colors,
    series: series.map((_ref2, i) => {
      let {
        seriesName,
        data,
        ...otherSeriesProps
      } = _ref2;
      return (0,_series_areaSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({
        stack: stacked ? 'area' : undefined,
        name: seriesName,
        data: data.map(_ref3 => {
          let {
            name,
            value
          } = _ref3;
          return [name, value];
        }),
        lineStyle: {
          color: colors === null || colors === void 0 ? void 0 : colors[i],
          opacity: 1,
          width: 0.4
        },
        areaStyle: {
          color: colors === null || colors === void 0 ? void 0 : colors[i],
          opacity: 1.0
        },
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
        ...otherSeriesProps
      });
    })
  });
}
AreaChart.displayName = "AreaChart";

/***/ }),

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

/***/ "./app/components/charts/series/areaSeries.tsx":
/*!*****************************************************!*\
  !*** ./app/components/charts/series/areaSeries.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AreaSeries)
/* harmony export */ });
/* harmony import */ var sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");

function AreaSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return (0,sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...props
  });
}

/***/ }),

/***/ "./app/components/onboardingPanel.tsx":
/*!********************************************!*\
  !*** ./app/components/onboardingPanel.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function OnboardingPanel(_ref) {
  let {
    className,
    image,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IlloBox, {
        children: image
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledBox, {
        children: children
      })]
    })
  });
}

OnboardingPanel.displayName = "OnboardingPanel";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";position:relative;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:center;flex-direction:row;justify-content:center;flex-wrap:wrap;min-height:300px;max-width:1000px;margin:0 auto;}@media (min-width: ", p => p.theme.breakpoints.medium, "){min-height:350px;}" + ( true ? "" : 0));

const StyledBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos1"
} : 0)("z-index:1;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:2;}" + ( true ? "" : 0));

const IlloBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(StyledBox,  true ? {
  target: "e19tujos0"
} : 0)("position:relative;min-height:100px;max-width:300px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " auto;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:1;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";max-width:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OnboardingPanel);

/***/ }),

/***/ "./app/components/performanceDuration.tsx":
/*!************************************************!*\
  !*** ./app/components/performanceDuration.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function isMilliseconds(props) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(props.milliseconds);
}

function isNanoseconds(props) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(props.nanoseconds);
}

function PerformanceDuration(props) {
  const normalizedSeconds = isNanoseconds(props) ? props.nanoseconds / 1_000_000_000 : isMilliseconds(props) ? props.milliseconds / 1000 : props.seconds;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_0__["default"], {
    abbreviation: props.abbreviation,
    seconds: normalizedSeconds,
    fixedDigits: 2
  });
}

PerformanceDuration.displayName = "PerformanceDuration";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PerformanceDuration);

/***/ }),

/***/ "./app/components/profiling/ProfilingOnboarding/profilingOnboardingModal.tsx":
/*!***********************************************************************************!*\
  !*** ./app/components/profiling/ProfilingOnboarding/profilingOnboardingModal.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfilingOnboardingModal": () => (/* binding */ ProfilingOnboardingModal)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











 // This is just a doubly linked list of steps




function useOnboardingRouter(initialStep) {
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(initialStep);
  const toStep = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(nextStep => {
    // For ergonomics, else we need to move everything to consts so that typescript can infer non nullable types
    if (nextStep === null) {
      return;
    }

    setState(current => {
      const next = { ...nextStep,
        next: null,
        previous: current
      }; // Add the edges between the old and the new step

      current.next = next;
      next.previous = current; // Return the next step

      return next;
    });
  }, []);
  return [state, toStep];
} // The wrapper component for all of the onboarding steps. Keeps track of the current step
// and all state. This ensures that moving from step to step does not require users to redo their actions
// and each step can just re-initialize with the values that the user has already selected.


function ProfilingOnboardingModal(props) {
  const [state, toStep] = useOnboardingRouter({
    previous: null,
    current: SelectProjectStep,
    next: null
  });
  const [project, setProject] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(state.current, { ...props,
    toStep: toStep,
    step: state,
    project: project,
    setProject: setProject
  });
}
ProfilingOnboardingModal.displayName = "ProfilingOnboardingModal";

// Generate an option for the select field from project
function asSelectOption(project, options) {
  return {
    label: project.name,
    value: project,
    disabled: options.disabled,
    leadingItems: project.platform ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(platformicons__WEBPACK_IMPORTED_MODULE_4__.PlatformIcon, {
      platform: project.platform
    }) : null
  };
}

const platformToInstructionsMapping = {
  android: AndroidSendDebugFilesInstruction,
  'apple-ios': IOSSendDebugFilesInstruction
}; // Splits a list of projects into supported and unsuported list

function splitProjectsByProfilingSupport(projects) {
  const supported = [];
  const unsupported = [];

  for (const project of projects) {
    if (project.platform && platformToInstructionsMapping[project.platform]) {
      supported.push(project);
    } else {
      unsupported.push(project);
    }
  }

  return {
    supported,
    unsupported
  };
} // Individual modal steps are defined here.
// We proxy the modal props to each individaul modal component
// so that each can build their own modal and they can remain independent.


function SelectProjectStep(_ref) {
  let {
    Body: ModalBody,
    Header: ModalHeader,
    Footer: ModalFooter,
    closeModal,
    toStep,
    step,
    project,
    setProject
  } = _ref;
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_13__["default"])();
  const onFormSubmit = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(evt => {
    evt.preventDefault();

    if (!(project !== null && project !== void 0 && project.platform)) {
      return;
    }

    const nextStep = platformToInstructionsMapping[project.platform];

    if (nextStep === undefined) {
      throw new TypeError("Platform doesn't have a onboarding step, user should not be able to select it");
    }

    toStep({
      previous: step,
      current: nextStep,
      next: null
    });
  }, [project, step, toStep]);
  const projectSelectOptions = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    const {
      supported: supportedProjects,
      unsupported: unsupporedProjects
    } = splitProjectsByProfilingSupport(projects);
    return [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Supported'),
      options: supportedProjects.map(p => asSelectOption(p, {
        disabled: false
      }))
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unsupported'),
      options: unsupporedProjects.map(p => asSelectOption(p, {
        disabled: true
      }))
    }];
  }, [projects]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalBody, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Set Up Profiling')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("form", {
      onSubmit: onFormSubmit,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledList, {
        symbol: "colored-numeric",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("label", {
              htmlFor: "project-select",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Select a project')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledSelectField, {
              id: "project-select",
              name: "select",
              options: projectSelectOptions,
              onChange: setProject
            })
          })]
        }), (project === null || project === void 0 ? void 0 : project.platform) === 'android' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(AndroidInstallSteps, {}) : null, (project === null || project === void 0 ? void 0 : project.platform) === 'apple-ios' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(IOSInstallSteps, {}) : null]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalFooter, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalActions, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(DocsLink, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepIndicator, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Step 1 of 2')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PreviousStepButton, {
              type: "button",
              onClick: closeModal
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(NextStepButton, {
              disabled: !(project !== null && project !== void 0 && project.platform && platformToInstructionsMapping[project.platform]),
              type: "submit"
            })]
          })]
        })
      })]
    })]
  });
}

SelectProjectStep.displayName = "SelectProjectStep";

function AndroidInstallSteps() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Update your projects SDK version')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Make sure your SDKs are upgraded to at least version 6.0.0 (sentry-android).')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Setup Performance Monitoring')
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`For Sentry to ingest profiles, we first require you to setup performance monitoring. To set up performance monitoring,`), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
        openInNewTab: true,
        href: "https://docs.sentry.io/platforms/android/performance/",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('follow our step by step instructions here.')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Set Up Profiling')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(CodeContainer, {
        children: `<application>
  <meta-data android:name="io.sentry.dsn" android:value="..." />
  <meta-data android:name="io.sentry.traces.sample-rate" android:value="1.0" />
  <meta-data android:name="io.sentry.traces.profiling.enable" android:value="true" />
</application>`
      })]
    })]
  });
}

AndroidInstallSteps.displayName = "AndroidInstallSteps";

function IOSInstallSteps() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Update your projects SDK version')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Make sure your SDKs are upgraded to at least version 7.23.0 (sentry-cocoa).')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Setup Performance Monitoring')
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`For Sentry to ingest profiles, we first require you to setup performance monitoring. To set up performance monitoring,`), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
        openInNewTab: true,
        href: "https://docs.sentry.io/platforms/apple/guides/ios/performance/",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('follow our step by step instructions here.')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("li", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Enable profiling in your app by configuring the SDKs like below:')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(CodeContainer, {
        children: `SentrySDK.start { options in
    options.dsn = "..."
    options.tracesSampleRate = 1.0 // Make sure transactions are enabled
    options.enableProfiling = true
}`
      })]
    })]
  });
}

IOSInstallSteps.displayName = "IOSInstallSteps";

const StyledList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ewfgfp910"
} : 0)("position:relative;li{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";}" + ( true ? "" : 0));

const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms__WEBPACK_IMPORTED_MODULE_6__.SelectField,  true ? {
  target: "ewfgfp99"
} : 0)( true ? {
  name: "9nn1p6",
  styles: "padding:0;border-bottom:0;>div{width:100%;padding-left:0;}"
} : 0);

function AndroidSendDebugFilesInstruction(_ref2) {
  let {
    Body: ModalBody,
    Header: ModalHeader,
    Footer: ModalFooter,
    closeModal,
    toStep,
    step
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalBody, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Set Up Profiling')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("p", {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`If you want to see de-obfuscated stack traces, you'll need to use ProGuard with Sentry. To do so, upload the ProGuard mapping files by either the recommended method of using our Gradle integration or manually by using sentry-cli.`), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
        href: "https://docs.sentry.io/product/cli/dif/",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Learn more about Debug Information Files.')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionsContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionTitleContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Option 1')
        }), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Recommended')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitleContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Option 2')
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionsContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Option, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ExternalOptionTitle, {
          href: "https://docs.sentry.io/platforms/android/proguard/",
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Proguard and DexGuard'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconOpen, {})]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Upload ProGuard files using our Gradle plugin.')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Option, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ExternalOptionTitle, {
          href: "https://docs.sentry.io/product/cli/dif/#uploading-files",
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry-cli'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconOpen, {})]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Validate and upload debug files using our cli tool.')
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalFooter, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(DocsLink, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepIndicator, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Step 2 of 2')
          }), step.previous ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PreviousStepButton, {
            onClick: () => toStep(step.previous)
          }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Done')
          })]
        })]
      })
    })]
  });
}

AndroidSendDebugFilesInstruction.displayName = "AndroidSendDebugFilesInstruction";

function IOSSendDebugFilesInstruction(_ref3) {
  let {
    Body: ModalBody,
    Header: ModalHeader,
    Footer: ModalFooter,
    closeModal,
    toStep,
    step
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalBody, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Set Up Profiling')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("p", {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`The most straightforward way to provide Sentry with debug information files is to
        upload them using sentry-cli. Depending on your workflow, you may want to upload
        as part of your build pipeline or when deploying and publishing your application.`), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
        href: "https://docs.sentry.io/product/cli/dif/",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Learn more about Debug Information Files.')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionsContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionTitleContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Option 1')
        }), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Recommended')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitleContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(OptionTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Option 2')
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(OptionsContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Option, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ExternalOptionTitle, {
          href: "https://docs.sentry.io/product/cli/dif/#uploading-files",
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry-cli'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconOpen, {})]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Validate and upload debug files using our cli tool.')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Option, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ExternalOptionTitle, {
          href: "https://docs.sentry.io/platforms/apple/dsym/",
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Symbol servers'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconOpen, {})]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry downloads debug information files from external repositories.')
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalFooter, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ModalActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(DocsLink, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StepIndicator, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Step 2 of 2')
          }), step.previous !== null ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PreviousStepButton, {
            onClick: () => toStep(step.previous)
          }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Next')
          })]
        })]
      })
    })]
  });
}

IOSSendDebugFilesInstruction.displayName = "IOSSendDebugFilesInstruction";

// A few common component definitions that are used in each step
function NextStepButton(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
    priority: "primary",
    ...props,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Next')
  });
}

NextStepButton.displayName = "NextStepButton";

function PreviousStepButton(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], { ...props,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Back')
  });
}

PreviousStepButton.displayName = "PreviousStepButton";

function DocsLink() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
    external: true,
    href: "https://docs.sentry.io/",
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Read Docs')
  });
}

DocsLink.displayName = "DocsLink";

function ModalActions(_ref4) {
  let {
    children
  } = _ref4;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ModalActionsContainer, {
    children: children
  });
}

ModalActions.displayName = "ModalActions";

const OptionTitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewfgfp98"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const OptionTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewfgfp97"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const ExternalOptionTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ewfgfp96"
} : 0)("font-weight:bold;font-size:", p => p.theme.fontSizeLarge, ";display:flex;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";svg{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";}" + ( true ? "" : 0));

const Option = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewfgfp95"
} : 0)("border-radius:", p => p.theme.borderRadius, ";border:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const OptionsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewfgfp94"
} : 0)("display:grid;grid-template-columns:1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";>p{margin:0;}" + ( true ? "" : 0));

const ModalActionsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewfgfp93"
} : 0)("display:flex;justify-content:space-between;align-items:center;flex:1 1 100%;button:not(:last-child){margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";}" + ( true ? "" : 0));

const StepTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewfgfp92"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";font-weight:bold;" + ( true ? "" : 0));

const StepIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewfgfp91"
} : 0)("color:", p => p.theme.subText, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

const PreContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "ewfgfp90"
} : 0)( true ? {
  name: "ex6y9o",
  styles: "code{white-space:pre;}"
} : 0);

function CodeContainer(_ref5) {
  let {
    children
  } = _ref5;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PreContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("code", {
      children: children
    })
  });
}

CodeContainer.displayName = "CodeContainer";

/***/ }),

/***/ "./app/components/profiling/profileTransactionsTable.tsx":
/*!***************************************************************!*\
  !*** ./app/components/profiling/profileTransactionsTable.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfileTransactionsTable": () => (/* binding */ ProfileTransactionsTable)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/tableRenderer */ "./app/utils/profiling/tableRenderer.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function ProfileTransactionsTable(props) {
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__.useLocation)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const transactions = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return props.transactions.map(transaction => {
      const project = projects.find(proj => proj.id === transaction.project_id);
      return {
        transaction: project ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_11__.generateProfileSummaryRouteWithQuery)({
            location,
            orgSlug: organization.slug,
            projectSlug: project.slug,
            transaction: transaction.name
          }),
          children: transaction.name
        }) : transaction.name,
        count: transaction.profiles_count,
        project,
        p50: transaction.duration_ms.p50,
        p75: transaction.duration_ms.p75,
        p90: transaction.duration_ms.p90,
        p95: transaction.duration_ms.p95,
        p99: transaction.duration_ms.p99,
        lastSeen: transaction.last_profile_at
      };
    });
  }, [props.transactions, location, organization, projects]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__["default"], {
    isLoading: props.isLoading,
    error: props.error,
    data: transactions,
    columnOrder: COLUMN_ORDER.map(key => COLUMNS[key]),
    columnSortBy: [],
    grid: {
      renderHeadCell: (0,sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_12__.renderTableHead)({
        rightAlignedColumns: RIGHT_ALIGNED_COLUMNS
      }),
      renderBodyCell: renderTableBody
    },
    location: location
  });
}

ProfileTransactionsTable.displayName = "ProfileTransactionsTable";
const RIGHT_ALIGNED_COLUMNS = new Set(['count', 'p50', 'p75', 'p90', 'p95', 'p99']);

function renderTableBody(column, dataRow, rowIndex, columnIndex) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ProfilingTransactionsTableCell, {
    column: column,
    dataRow: dataRow,
    rowIndex: rowIndex,
    columnIndex: columnIndex
  });
}

renderTableBody.displayName = "renderTableBody";

function ProfilingTransactionsTableCell(_ref) {
  let {
    column,
    dataRow
  } = _ref;
  const value = dataRow[column.key];

  switch (column.key) {
    case 'project':
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(value)) {
        // should never happen but just in case
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('n/a')
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
          project: value,
          avatarSize: 16
        })
      });

    case 'count':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.NumberContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_2__["default"], {
          value: value
        })
      });

    case 'p50':
    case 'p75':
    case 'p90':
    case 'p95':
    case 'p99':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.NumberContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_7__["default"], {
          milliseconds: value,
          abbreviation: true
        })
      });

    case 'lastSeen':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__["default"], {
          date: value
        })
      });

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: value
      });
  }
}

const COLUMN_ORDER = ['transaction', 'project', 'lastSeen', 'p75', 'p95', 'count'];
const COLUMNS = {
  transaction: {
    key: 'transaction',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Transaction'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  count: {
    key: 'count',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Count'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  project: {
    key: 'project',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Project'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  p50: {
    key: 'p50',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('P50'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  p75: {
    key: 'p75',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('P75'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  p90: {
    key: 'p90',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('P90'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  p95: {
    key: 'p95',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('P95'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  p99: {
    key: 'p99',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('P99'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  },
  lastSeen: {
    key: 'lastSeen',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last Seen'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED
  }
};


/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "axisDuration": () => (/* binding */ axisDuration),
/* harmony export */   "axisLabelFormatter": () => (/* binding */ axisLabelFormatter),
/* harmony export */   "axisLabelFormatterUsingAggregateOutputType": () => (/* binding */ axisLabelFormatterUsingAggregateOutputType),
/* harmony export */   "categorizeDuration": () => (/* binding */ categorizeDuration),
/* harmony export */   "findRangeOfMultiSeries": () => (/* binding */ findRangeOfMultiSeries),
/* harmony export */   "getDurationUnit": () => (/* binding */ getDurationUnit),
/* harmony export */   "tooltipFormatter": () => (/* binding */ tooltipFormatter),
/* harmony export */   "tooltipFormatterUsingAggregateOutputType": () => (/* binding */ tooltipFormatterUsingAggregateOutputType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");




/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */

function tooltipFormatter(value) {
  let outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}
/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */

function tooltipFormatterUsingAggregateOutputType(value, type) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 2);

    case 'duration':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.getDuration)(value / 1000, 2, true);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value);

    default:
      return value.toString();
  }
}
/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */

function axisLabelFormatter(value, outputType) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;
  return axisLabelFormatterUsingAggregateOutputType(value, outputType, abbreviation, durationUnit);
}
/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */

function axisLabelFormatterUsingAggregateOutputType(value, type) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;

  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatAbbreviatedNumber)(value) : value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 0);

    case 'duration':
      return axisDuration(value, durationUnit);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value, 0);

    default:
      return value.toString();
  }
}
/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */

function axisDuration(value, durationUnit) {
  var _durationUnit;

  (_durationUnit = durationUnit) !== null && _durationUnit !== void 0 ? _durationUnit : durationUnit = categorizeDuration(value);

  if (value === 0) {
    return '0';
  }

  switch (durationUnit) {
    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%swk', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sd', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%shr', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%smin', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%ss', label);
      }

    default:
      const label = value.toFixed(0);
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sms', label);
  }
}
/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend
 * Assumes series[0] > series[1] > ...
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */

function findRangeOfMultiSeries(series, legend) {
  var _series$;

  let range;

  if ((_series$ = series[0]) !== null && _series$ !== void 0 && _series$.data) {
    var _maxSeries2;

    let minSeries = series[0];
    let maxSeries;
    series.forEach((_ref, idx) => {
      var _legend$selected;

      let {
        seriesName,
        data
      } = _ref;

      if ((legend === null || legend === void 0 ? void 0 : (_legend$selected = legend.selected) === null || _legend$selected === void 0 ? void 0 : _legend$selected[seriesName]) !== false && data.length) {
        var _maxSeries;

        minSeries = series[idx];
        (_maxSeries = maxSeries) !== null && _maxSeries !== void 0 ? _maxSeries : maxSeries = series[idx];
      }
    });

    if ((_maxSeries2 = maxSeries) !== null && _maxSeries2 !== void 0 && _maxSeries2.data) {
      const max = Math.max(...maxSeries.data.map(_ref2 => {
        let {
          value
        } = _ref2;
        return value;
      }).filter(value => !!value));
      const min = Math.min(...minSeries.data.map(_ref3 => {
        let {
          value
        } = _ref3;
        return value;
      }).filter(value => !!value));
      range = {
        max,
        min
      };
    }
  }

  return range;
}
/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */

function getDurationUnit(series, legend) {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);

  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;

    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }

  return durationUnit;
}
/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */

function categorizeDuration(value) {
  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND;
  }

  return 1;
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useProfileFilters.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/profiling/hooks/useProfileFilters.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useProfileFilters": () => (/* binding */ useProfileFilters)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");






function useProfileFilters(_ref) {
  let {
    query,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();
  const [profileFilters, setProfileFilters] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({});
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!selection) {
      return undefined;
    }

    fetchProfileFilters(api, organization, query, selection).then(response => {
      const withPredefinedFilters = response.reduce((filters, tag) => {
        filters[tag.key] = { ...tag,
          // predefined allows us to specify a list of possible values
          predefined: true
        };
        return filters;
      }, {});
      setProfileFilters(withPredefinedFilters);
    });
    return () => api.clear();
  }, [api, organization, query, selection]);
  return profileFilters;
}

function fetchProfileFilters(api, organization, query, selection) {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/filters/`, {
    method: 'GET',
    query: {
      query,
      project: selection.projects,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime)
    }
  });
}



/***/ }),

/***/ "./app/utils/profiling/hooks/useProfileStats.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/profiling/hooks/useProfileStats.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useProfileStats": () => (/* binding */ useProfileStats)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");








function useProfileStats(_ref) {
  let {
    query,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const [requestState, setRequestState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(selection)) {
      return undefined;
    }

    setRequestState({
      type: 'loading'
    });
    fetchProfileStats(api, organization, {
      query,
      selection
    }).then(result => {
      setRequestState({
        type: 'resolved',
        data: result
      });
    }).catch(err => {
      setRequestState({
        type: 'errored',
        error: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Error: Unable to load profile stats')
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_7__.captureException(err);
    });
    return () => api.clear();
  }, [api, organization, query, selection]);
  return requestState;
}

function fetchProfileStats(api, organization, _ref2) {
  let {
    query,
    selection
  } = _ref2;
  return api.requestPromise(`/organizations/${organization.slug}/profiling/stats/`, {
    method: 'GET',
    includeAllArgs: false,
    query: {
      query,
      project: selection.projects,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime)
    }
  });
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useProfileTransactions.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/profiling/hooks/useProfileTransactions.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useProfileTransactions": () => (/* binding */ useProfileTransactions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");









function useProfileTransactions(_ref) {
  let {
    cursor,
    limit,
    query,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const [requestState, setRequestState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(selection)) {
      return undefined;
    }

    setRequestState({
      type: 'loading'
    });
    fetchTransactions(api, organization, {
      cursor,
      limit,
      query,
      selection
    }).then(_ref2 => {
      var _response$getResponse;

      let [transactions,, response] = _ref2;
      setRequestState({
        type: 'resolved',
        data: {
          transactions,
          pageLinks: (_response$getResponse = response === null || response === void 0 ? void 0 : response.getResponseHeader('Link')) !== null && _response$getResponse !== void 0 ? _response$getResponse : null
        }
      });
    }).catch(err => {
      setRequestState({
        type: 'errored',
        error: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Error: Unable to load transactions')
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_7__.captureException(err);
    });
    return () => api.clear();
  }, [api, organization, cursor, limit, query, selection]);
  return requestState;
}

function fetchTransactions(api, organization, _ref3) {
  let {
    cursor,
    limit,
    query,
    selection
  } = _ref3;
  return api.requestPromise(`/organizations/${organization.slug}/profiling/transactions/`, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      query,
      per_page: limit,
      project: selection.projects,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime)
    }
  });
}



/***/ }),

/***/ "./app/utils/profiling/routes.tsx":
/*!****************************************!*\
  !*** ./app/utils/profiling/routes.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateProfileDetailsRoute": () => (/* binding */ generateProfileDetailsRoute),
/* harmony export */   "generateProfileDetailsRouteWithQuery": () => (/* binding */ generateProfileDetailsRouteWithQuery),
/* harmony export */   "generateProfileFlamechartRoute": () => (/* binding */ generateProfileFlamechartRoute),
/* harmony export */   "generateProfileFlamechartRouteWithQuery": () => (/* binding */ generateProfileFlamechartRouteWithQuery),
/* harmony export */   "generateProfileSummaryRoute": () => (/* binding */ generateProfileSummaryRoute),
/* harmony export */   "generateProfileSummaryRouteWithQuery": () => (/* binding */ generateProfileSummaryRouteWithQuery),
/* harmony export */   "generateProfilingRoute": () => (/* binding */ generateProfilingRoute),
/* harmony export */   "generateProfilingRouteWithQuery": () => (/* binding */ generateProfilingRouteWithQuery)
/* harmony export */ });
function generateProfilingRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/profiling/`;
}
function generateProfileSummaryRoute(_ref2) {
  let {
    orgSlug,
    projectSlug
  } = _ref2;
  return `/organizations/${orgSlug}/profiling/summary/${projectSlug}/`;
}
function generateProfileFlamechartRoute(_ref3) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref3;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamechart/`;
}
function generateProfileDetailsRoute(_ref4) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref4;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/details/`;
}
function generateProfilingRouteWithQuery(_ref5) {
  let {
    location,
    orgSlug,
    query
  } = _ref5;
  const pathname = generateProfilingRoute({
    orgSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileSummaryRouteWithQuery(_ref6) {
  let {
    location,
    orgSlug,
    projectSlug,
    transaction,
    query
  } = _ref6;
  const pathname = generateProfileSummaryRoute({
    orgSlug,
    projectSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query,
      transaction
    }
  };
}
function generateProfileFlamechartRouteWithQuery(_ref7) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref7;
  const pathname = generateProfileFlamechartRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileDetailsRouteWithQuery(_ref8) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref8;
  const pathname = generateProfileDetailsRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}

/***/ }),

/***/ "./app/utils/useLocation.tsx":
/*!***********************************!*\
  !*** ./app/utils/useLocation.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocation": () => (/* binding */ useLocation)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useLocation() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.location;
}

/***/ }),

/***/ "./app/views/profiling/content.tsx":
/*!*****************************************!*\
  !*** ./app/views/profiling/content.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_profiling_profileTransactionsTable__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/profiling/profileTransactionsTable */ "./app/components/profiling/profileTransactionsTable.tsx");
/* harmony import */ var sentry_components_profiling_ProfilingOnboarding_profilingOnboardingModal__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal */ "./app/components/profiling/ProfilingOnboarding/profilingOnboardingModal.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useProfileFilters__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useProfileFilters */ "./app/utils/profiling/hooks/useProfileFilters.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useProfileTransactions__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useProfileTransactions */ "./app/utils/profiling/hooks/useProfileTransactions.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _landing_profileCharts__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./landing/profileCharts */ "./app/views/profiling/landing/profileCharts.tsx");
/* harmony import */ var _profilingOnboardingPanel__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./profilingOnboardingPanel */ "./app/views/profiling/profilingOnboardingPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



































function hasSetupProfilingForAtLeastOneProject(selectedProjects, projects) {
  const projectIDsToProjectTable = projects.reduce((acc, project) => {
    acc[project.id] = project;
    return acc;
  }, {});

  if (selectedProjects[0] === sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_19__.ALL_ACCESS_PROJECTS || selectedProjects.length === 0) {
    const projectWithProfiles = projects.find(p => {
      const project = projectIDsToProjectTable[String(p)];

      if (!project) {
        // Shouldnt happen, but lets be safe and just not do anything
        return false;
      }

      return project.hasProfiles;
    });
    return projectWithProfiles !== undefined;
  }

  const projectWithProfiles = selectedProjects.find(p => {
    const project = projectIDsToProjectTable[String(p)];

    if (!project) {
      // Shouldnt happen, but lets be safe and just not do anything
      return false;
    }

    return project.hasProfiles;
  });
  return projectWithProfiles !== undefined;
}

function ProfilingContent(_ref) {
  let {
    location,
    router
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_27__["default"])();
  const {
    selection
  } = (0,sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_28__["default"])();
  const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query.cursor);
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query.query, '');
  const profileFilters = (0,sentry_utils_profiling_hooks_useProfileFilters__WEBPACK_IMPORTED_MODULE_24__.useProfileFilters)({
    query: '',
    selection
  });
  const transactions = (0,sentry_utils_profiling_hooks_useProfileTransactions__WEBPACK_IMPORTED_MODULE_25__.useProfileTransactions)({
    cursor,
    query,
    selection
  });
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_29__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('profiling_views.landing', {
      organization
    });
  }, [organization]);
  const handleSearch = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(searchQuery => {
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({ ...location,
      query: { ...location.query,
        cursor: undefined,
        query: searchQuery || undefined
      }
    });
  }, [location]); // Open the modal on demand

  const onSetupProfilingClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openModal)(props => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_profiling_ProfilingOnboarding_profilingOnboardingModal__WEBPACK_IMPORTED_MODULE_14__.ProfilingOnboardingModal, { ...props
      });
    });
  }, []);
  const shouldShowProfilingOnboardingPanel = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (transactions.type !== 'resolved') {
      return false;
    }

    if (transactions.data.transactions.length > 0) {
      return false;
    }

    return !hasSetupProfilingForAtLeastOneProject(selection.projects, projects);
  }, [selection.projects, projects, transactions]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Profiling'),
    orgSlug: organization.slug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
        organization: organization,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(StyledPageContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Header, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(StyledLayoutHeaderContent, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(StyledHeading, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Profiling')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                onClick: onSetupProfilingClick,
                children: "Set Up Profiling"
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Body, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Main, {
              fullWidth: true,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(ActionBar, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  condensed: true,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    alignDropdown: "left"
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_17__["default"], {
                  organization: organization,
                  hasRecentSearches: true,
                  searchSource: "profile_landing",
                  supportedTags: profileFilters,
                  query: query,
                  onSearch: handleSearch,
                  maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_18__.MAX_QUERY_LENGTH
                })]
              }), shouldShowProfilingOnboardingPanel ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(_profilingOnboardingPanel__WEBPACK_IMPORTED_MODULE_31__.ProfilingOnboardingPanel, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  href: "https://docs.sentry.io/",
                  external: true,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Read Docs')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  onClick: onSetupProfilingClick,
                  priority: "primary",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Set Up Profiling')
                })]
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_landing_profileCharts__WEBPACK_IMPORTED_MODULE_30__.ProfileCharts, {
                  router: router,
                  query: query,
                  selection: selection
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_profiling_profileTransactionsTable__WEBPACK_IMPORTED_MODULE_13__.ProfileTransactionsTable, {
                  error: transactions.type === 'errored' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Unable to load profiles') : null,
                  isLoading: transactions.type === 'loading',
                  transactions: transactions.type === 'resolved' ? transactions.data.transactions : []
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  pageLinks: transactions.type === 'resolved' ? transactions.data.pageLinks : null
                })]
              })]
            })
          })]
        })
      })
    })
  });
}

ProfilingContent.displayName = "ProfilingContent";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_21__.PageContent,  true ? {
  target: "eil9lws3"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const StyledLayoutHeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.HeaderContent,  true ? {
  target: "eil9lws2"
} : 0)( true ? {
  name: "1iix8hw",
  styles: "display:flex;justify-content:space-between;flex-direction:row"
} : 0);

const StyledHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "eil9lws1"
} : 0)( true ? {
  name: "ht6xsx",
  styles: "line-height:40px"
} : 0);

const ActionBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eil9lws0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";grid-template-columns:min-content auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfilingContent);

/***/ }),

/***/ "./app/views/profiling/landing/profileCharts.tsx":
/*!*******************************************************!*\
  !*** ./app/views/profiling/landing/profileCharts.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfileCharts": () => (/* binding */ ProfileCharts)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useProfileStats__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useProfileStats */ "./app/utils/profiling/hooks/useProfileStats.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














// We want p99 to be before p75 because echarts renders the series in order.
// So if p75 is before p99, p99 will be rendered on top of p75 which will
// cover it up.
const SERIES_ORDER = ['count()', 'p99()', 'p75()'];
function ProfileCharts(_ref) {
  let {
    query,
    router,
    selection
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_13__.a)();
  const profileStats = (0,sentry_utils_profiling_hooks_useProfileStats__WEBPACK_IMPORTED_MODULE_12__.useProfileStats)({
    query,
    selection
  });
  const series = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    if (profileStats.type !== 'resolved') {
      return [];
    } // the timestamps in the response is in seconds but echarts expects
    // a timestamp in milliseconds, so multiply by 1e3 to do the conversion


    const timestamps = profileStats.data.timestamps.map(ts => ts * 1e3);
    const allSeries = profileStats.data.data.filter(rawData => SERIES_ORDER.indexOf(`${rawData.axis}()`) > -1).map(rawData => {
      if (timestamps.length !== rawData.values.length) {
        throw new Error('Invalid stats response');
      }

      if (rawData.axis === 'count') {
        return {
          data: rawData.values.map((value, i) => ({
            name: timestamps[i],
            // the response value contains nulls when no data is
            // available, use 0 to represent it
            value: value !== null && value !== void 0 ? value : 0
          })),
          seriesName: `${rawData.axis}()`,
          xAxisIndex: 0,
          yAxisIndex: 0
        };
      }

      return {
        data: rawData.values.map((value, i) => ({
          name: timestamps[i],
          // the response value contains nulls when no data
          // is available, use 0 to represent it
          value: (value !== null && value !== void 0 ? value : 0) / 1e6 // convert ns to ms

        })),
        seriesName: `${rawData.axis}()`,
        xAxisIndex: 1,
        yAxisIndex: 1
      };
    });
    allSeries.sort((a, b) => {
      const idxA = SERIES_ORDER.indexOf(a.seriesName);
      const idxB = SERIES_ORDER.indexOf(b.seriesName);
      return idxA - idxB;
    });
    return allSeries;
  }, [profileStats]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_5__["default"], {
    router: router,
    ...(selection === null || selection === void 0 ? void 0 : selection.datetime),
    children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledPanel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(TitleContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledHeaderTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Profiles by Count')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledHeaderTitle, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Profiles by Percentiles')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_4__.AreaChart, {
        height: 300,
        series: series,
        grid: [{
          top: '32px',
          left: '24px',
          right: '52%',
          bottom: '16px'
        }, {
          top: '32px',
          left: '52%',
          right: '24px',
          bottom: '16px'
        }],
        legend: {
          right: 16,
          top: 12,
          data: SERIES_ORDER.slice()
        },
        axisPointer: {
          link: [{
            xAxisIndex: [0, 1]
          }]
        },
        xAxes: [{
          gridIndex: 0,
          type: 'time'
        }, {
          gridIndex: 1,
          type: 'time'
        }],
        yAxes: [{
          gridIndex: 0,
          scale: true,
          axisLabel: {
            color: theme.chartLabel,

            formatter(value) {
              return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.axisLabelFormatter)(value, 'integer');
            }

          }
        }, {
          gridIndex: 1,
          scale: true,
          axisLabel: {
            color: theme.chartLabel,

            formatter(value) {
              return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.axisLabelFormatter)(value, 'duration');
            }

          }
        }],
        tooltip: {
          valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.aggregateOutputType)(label))
        },
        isGroupedByDate: true,
        showTimeInTooltip: true,
        ...zoomRenderProps
      })]
    })
  });
}
ProfileCharts.displayName = "ProfileCharts";

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel,  true ? {
  target: "e16luuhi2"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16luuhi1"
} : 0)( true ? {
  name: "ai16bo",
  styles: "width:100%;display:flex;flex-direction:row"
} : 0);

const StyledHeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.HeaderTitle,  true ? {
  target: "e16luuhi0"
} : 0)("flex-grow:1;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/profiling/profilingOnboardingPanel.tsx":
/*!**********************************************************!*\
  !*** ./app/views/profiling/profilingOnboardingPanel.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfilingOnboardingPanel": () => (/* binding */ ProfilingOnboardingPanel)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_images_spot_performance_empty_state_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/performance-empty-state.svg */ "./images/spot/performance-empty-state.svg");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/onboardingPanel */ "./app/components/onboardingPanel.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function ProfilingOnboardingPanel(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
    image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertsImage, {
      src: sentry_images_spot_performance_empty_state_svg__WEBPACK_IMPORTED_MODULE_1__
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("h3", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Function level insights')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Discover slow-to-execute or resource intensive functions within your application')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ButtonList, {
      gap: 1,
      children: props.children
    })]
  });
}
ProfilingOnboardingPanel.displayName = "ProfilingOnboardingPanel";

const AlertsImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('img',  true ? {
  target: "e1ye1f4w1"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){user-select:none;position:absolute;top:0;bottom:0;width:220px;margin-top:auto;margin-bottom:auto;transform:translateX(-50%);left:50%;}@media (min-width: ", p => p.theme.breakpoints.large, "){transform:translateX(-30%);width:380px;min-width:380px;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){transform:translateX(-30%);width:420px;min-width:420px;}" + ( true ? "" : 0));

const ButtonList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1ye1f4w0"
} : 0)( true ? {
  name: "vpj881",
  styles: "grid-template-columns:repeat(auto-fit, minmax(130px, max-content))"
} : 0);

/***/ }),

/***/ "./images/spot/performance-empty-state.svg":
/*!*************************************************!*\
  !*** ./images/spot/performance-empty-state.svg ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/performance-empty-state.8da0e336a4e99ef87edb.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_profiling_content_tsx.e9ab5c44132f900f99ab18dc85c7086b.js.map