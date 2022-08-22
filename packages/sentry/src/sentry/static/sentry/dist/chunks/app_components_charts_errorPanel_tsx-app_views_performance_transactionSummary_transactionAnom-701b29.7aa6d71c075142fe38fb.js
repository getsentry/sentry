(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_errorPanel_tsx-app_views_performance_transactionSummary_transactionAnom-701b29"],{

/***/ "./app/components/charts/chartZoom.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/chartZoom.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./app/components/charts/components/markArea.tsx":
/*!*******************************************************!*\
  !*** ./app/components/charts/components/markArea.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MarkArea)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_markArea__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/markArea */ "../node_modules/echarts/lib/component/markArea.js");


/**
 * eCharts markArea
 *
 * See https://echarts.apache.org/en/option.html#series-line.markArea
 */
function MarkArea(props) {
  return { ...props
  };
}

/***/ }),

/***/ "./app/components/charts/components/toolBox.tsx":
/*!******************************************************!*\
  !*** ./app/components/charts/components/toolBox.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/components/charts/errorPanel.tsx":
/*!**********************************************!*\
  !*** ./app/components/charts/errorPanel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

/***/ "./app/components/gridEditable/sortLink.tsx":
/*!**************************************************!*\
  !*** ./app/components/gridEditable/sortLink.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SortLink(_ref) {
  let {
    align,
    title,
    canSort,
    generateSortLink,
    onClick,
    direction
  } = _ref;
  const target = generateSortLink();

  if (!target || !canSort) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledNonLink, {
      align: align,
      children: title
    });
  }

  const arrow = !direction ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconArrow, {
    size: "xs",
    direction: direction === 'desc' ? 'down' : 'up'
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(StyledLink, {
    align: align,
    to: target,
    onClick: onClick,
    children: [title, " ", arrow]
  });
}

SortLink.displayName = "SortLink";

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const forwardProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['align']);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...forwardProps
  });
},  true ? {
  target: "e1xb2te62"
} : 0)("display:block;width:100%;white-space:nowrap;color:inherit;&:hover,&:active,&:focus,&:visited{color:inherit;}", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledNonLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xb2te61"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconArrow,  true ? {
  target: "e1xb2te60"
} : 0)( true ? {
  name: "40f4ru",
  styles: "vertical-align:top"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SortLink);

/***/ }),

/***/ "./app/utils/performance/anomalies/anomaliesQuery.tsx":
/*!************************************************************!*\
  !*** ./app/utils/performance/anomalies/anomaliesQuery.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionAnomalies/utils */ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function transformStatsTimes(stats) {
  stats.data.forEach(d => d[0] = d[0] * 1000);
  return stats;
}

function transformAnomaliesTimes(anoms) {
  anoms.forEach(a => {
    a.start = a.start * 1000;
    a.end = a.end * 1000;
  });
  return anoms;
}

function transformPayload(payload) {
  const newPayload = { ...payload
  };

  if (!payload.y || !payload.yhat_lower || !payload.yhat_upper || !payload.anomalies) {
    return newPayload;
  }

  newPayload.y = transformStatsTimes(payload.y);
  newPayload.yhat_upper = transformStatsTimes(payload.yhat_upper);
  newPayload.yhat_lower = transformStatsTimes(payload.yhat_lower);
  newPayload.anomalies = transformAnomaliesTimes(payload.anomalies);
  return newPayload;
}

function AnomaliesSeriesQuery(props) {
  if (!props.organization.features.includes(sentry_views_performance_transactionSummary_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_3__.ANOMALY_FLAG)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
      children: props.children({
        data: null,
        isLoading: false,
        error: null,
        pageLinks: null
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "transaction-anomaly-detection",
    ...props,
    children: _ref => {
      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        data: tableData && tableData.y ? transformPayload(tableData) : null,
        ...rest
      });
    }
  });
}

AnomaliesSeriesQuery.displayName = "AnomaliesSeriesQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_2__["default"])(AnomaliesSeriesQuery));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionAnomalies/anomaliesTable.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionAnomalies/anomaliesTable.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AnomaliesTable)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const transformRow = anom => {
  return {
    anomaly: `#${anom.id}`,
    confidence: anom.confidence,
    timestamp: new Date(anom.start),
    timeInterval: anom.end - anom.start,
    expected: anom.expected,
    received: anom.received
  };
};

function AnomaliesTable(props) {
  const {
    location,
    organization,
    isLoading,
    anomalies
  } = props;
  const data = (anomalies === null || anomalies === void 0 ? void 0 : anomalies.map(transformRow)) || [];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__["default"], {
    isLoading: isLoading,
    data: data,
    columnOrder: Object.values(COLUMNS),
    columnSortBy: [],
    grid: {
      renderHeadCell,
      renderBodyCell: renderBodyCellWithMeta(location, organization)
    },
    location: location
  });
}
AnomaliesTable.displayName = "AnomaliesTable";

function renderHeadCell(column, _index) {
  const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.fieldAlignment)(column.key, COLUMN_TYPE[column.key]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
    title: column.name,
    align: align,
    direction: undefined,
    canSort: false,
    generateSortLink: () => undefined
  });
}

renderHeadCell.displayName = "renderHeadCell";

function renderBodyCellWithMeta(location, organization) {
  return (column, dataRow) => {
    const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.getFieldRenderer)(column.key, COLUMN_TYPE);

    if (column.key === 'confidence') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ConfidenceCell, {
        children: dataRow.confidence === 'low' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(LowConfidence, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Low Confidence')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(HighConfidence, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('High Confidence')
        })
      });
    }

    if (column.key === 'expected') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(NumberCell, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_1__["default"], {
          value: dataRow.expected
        })
      });
    }

    if (column.key === 'received') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(NumberCell, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_1__["default"], {
          value: dataRow.received
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
          size: "sm",
          direction: dataRow.received > dataRow.expected ? 'up' : 'down'
        })]
      });
    }

    return fieldRenderer(dataRow, {
      location,
      organization
    });
  };
}

const NumberCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1uhfujm3"
} : 0)("display:flex;justify-content:flex-end;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";" + ( true ? "" : 0));

const LowConfidence = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1uhfujm2"
} : 0)("color:", p => p.theme.yellow300, ";" + ( true ? "" : 0));

const HighConfidence = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1uhfujm1"
} : 0)("color:", p => p.theme.red300, ";" + ( true ? "" : 0));

const ConfidenceCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1uhfujm0"
} : 0)( true ? {
  name: "1qetfgc",
  styles: "text-align:left;justify-self:flex-end;flex-grow:1"
} : 0);

const COLUMNS = {
  anomaly: {
    key: 'anomaly',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Anomaly'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  },
  confidence: {
    key: 'confidence',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Confidence'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  },
  timeInterval: {
    key: 'timeInterval',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Time Interval'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  },
  timestamp: {
    key: 'timestamp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Timestamp'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  },
  expected: {
    key: 'expected',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Expected'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  },
  received: {
    key: 'received',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Received'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED
  }
};
const COLUMN_TYPE = {
  anomaly: 'string',
  confidence: 'string',
  timeInterval: 'duration',
  timestamp: 'date',
  expected: 'number',
  received: 'number'
};

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionAnomalies/anomalyChart.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionAnomalies/anomalyChart.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AnomalyChart": () => (/* binding */ AnomalyChart)
/* harmony export */ });
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
// eslint-disable-next-line no-restricted-imports










const _AnomalyChart = props => {
  const {
    data,
    location,
    statsPeriod,
    height,
    router,
    start: propsStart,
    end: propsEnd
  } = props;
  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_5__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_5__.getUtcToLocalDateObject)(propsEnd) : null;
  const {
    utc
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_3__.normalizeDateTimeParams)(location.query);
  const chartOptions = {
    legend: {
      right: 10,
      top: 5,
      data: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('High Confidence'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Low Confidence')]
    },
    seriesOptions: {
      showSymbol: false
    },
    height,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_6__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_7__.aggregateOutputType)(label))
    },
    xAxis: undefined,
    yAxis: {
      axisLabel: {
        // Coerces the axis to be count based
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_6__.axisLabelFormatter)(value, 'number')
      }
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__["default"], {
    router: router,
    period: statsPeriod,
    start: start,
    end: end,
    utc: utc === 'true',
    children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_2__.LineChart, { ...zoomRenderProps,
      series: data,
      ...chartOptions
    })
  });
};

_AnomalyChart.displayName = "_AnomalyChart";
const AnomalyChart = (0,react_router__WEBPACK_IMPORTED_MODULE_0__.withRouter)(_AnomalyChart);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionAnomalies/content.tsx":
/*!***********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionAnomalies/content.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/components/markArea */ "./app/components/charts/components/markArea.tsx");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_performance_anomalies_anomaliesQuery__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/anomalies/anomaliesQuery */ "./app/utils/performance/anomalies/anomaliesQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _landing_widgets_components_performanceWidget__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../../landing/widgets/components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _landing_widgets_components_selectableList__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../../landing/widgets/components/selectableList */ "./app/views/performance/landing/widgets/components/selectableList.tsx");
/* harmony import */ var _landing_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../landing/widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _anomaliesTable__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./anomaliesTable */ "./app/views/performance/transactionSummary/transactionAnomalies/anomaliesTable.tsx");
/* harmony import */ var _anomalyChart__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./anomalyChart */ "./app/views/performance/transactionSummary/transactionAnomalies/anomalyChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























const anomalyAreaName = anomaly => `#${anomaly.id}`;

const transformAnomalyToArea = anomaly => [{
  name: anomalyAreaName(anomaly),
  xAxis: anomaly.start
}, {
  xAxis: anomaly.end
}];

const transformAnomalyData = (_, results) => {
  const data = [];
  const resultData = results.data;

  if (!resultData) {
    return {
      isLoading: results.isLoading,
      isErrored: !!results.error,
      data: undefined,
      hasData: false,
      loading: results.isLoading
    };
  }

  data.push({
    seriesName: 'tpm()',
    data: resultData.y.data.map(_ref => {
      let [name, [{
        count
      }]] = _ref;
      return {
        name,
        value: count
      };
    })
  });
  data.push({
    seriesName: 'tpm() lower bound',
    data: resultData.yhat_lower.data.map(_ref2 => {
      let [name, [{
        count
      }]] = _ref2;
      return {
        name,
        value: count
      };
    })
  });
  data.push({
    seriesName: 'tpm() upper bound',
    data: resultData.yhat_upper.data.map(_ref3 => {
      let [name, [{
        count
      }]] = _ref3;
      return {
        name,
        value: count
      };
    })
  });
  const anomalies = results.data.anomalies;
  const highConfidenceAreas = anomalies.filter(a => a.confidence === 'high').map(transformAnomalyToArea);
  const highConfidenceLines = anomalies.filter(a => a.confidence === 'high').map(area => ({
    xAxis: area.start,
    name: anomalyAreaName(area)
  }));
  const lowConfidenceAreas = anomalies.filter(a => a.confidence === 'low').map(transformAnomalyToArea);
  const lowConfidenceLines = anomalies.filter(a => a.confidence === 'low').map(area => ({
    xAxis: area.start,
    name: anomalyAreaName(area)
  }));
  data.push({
    seriesName: 'High Confidence',
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].red300,
    data: [],
    silent: true,
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_6__["default"])({
      animation: false,
      lineStyle: {
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].red300,
        type: 'solid',
        width: 1,
        opacity: 1.0
      },
      data: highConfidenceLines,
      label: {
        show: true,
        rotate: 90,
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].red300,
        position: 'insideEndBottom',
        fontSize: '10',
        offset: [5, 5],
        formatter: obj => `${obj.data.name}`
      }
    }),
    markArea: (0,sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_5__["default"])({
      itemStyle: {
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].red300,
        opacity: 0.2
      },
      label: {
        show: false
      },
      data: highConfidenceAreas
    })
  });
  data.push({
    seriesName: 'Low Confidence',
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].yellow200,
    data: [],
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_6__["default"])({
      animation: false,
      lineStyle: {
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].yellow200,
        type: 'solid',
        width: 1,
        opacity: 1.0
      },
      data: lowConfidenceLines,
      label: {
        show: true,
        rotate: 90,
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].yellow300,
        position: 'insideEndBottom',
        fontSize: '10',
        offset: [5, 5],
        formatter: obj => `${obj.data.name}`
      }
    }),
    markArea: (0,sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_5__["default"])({
      itemStyle: {
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].yellow200,
        opacity: 0.2
      },
      label: {
        show: false
      },
      data: lowConfidenceAreas
    })
  });
  return {
    isLoading: results.isLoading,
    isErrored: !!results.error,
    data,
    hasData: true,
    loading: results.isLoading
  };
};

function Anomalies(props) {
  const height = 250;
  const chartColor = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].charts.colors[0];
  const chart = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    return {
      fields: '',
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: provided.children(props.queryData)
      }),
      transform: transformAnomalyData
    };
  }, [props.queryData]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_landing_widgets_components_performanceWidget__WEBPACK_IMPORTED_MODULE_19__.GenericPerformanceWidget, { ...props,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Transaction Count'),
    titleTooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Represents transaction count across time, with added visualizations to highlight anomalies in your data.'),
    fields: [''],
    chartSetting: _landing_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_21__.PerformanceWidgetSetting.TPM_AREA,
    chartDefinition: _landing_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_21__.WIDGET_DEFINITIONS[_landing_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_21__.PerformanceWidgetSetting.TPM_AREA],
    Subtitle: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("div", {}),
    HeaderActions: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("div", {}),
    EmptyComponent: _landing_widgets_components_selectableList__WEBPACK_IMPORTED_MODULE_20__.WidgetEmptyStateWarning,
    Queries: {
      chart
    },
    Visualizations: [{
      component: provided => {
        var _provided$widgetData$, _provided$widgetData$2;

        const data = (_provided$widgetData$ = (_provided$widgetData$2 = provided.widgetData.chart.data) === null || _provided$widgetData$2 === void 0 ? void 0 : _provided$widgetData$2.map(series => {
          if (series.seriesName !== 'tpm()') {
            series.lineStyle = {
              type: 'dashed',
              color: chartColor,
              width: 1.5
            };
          }

          if (series.seriesName === 'score') {
            series.lineStyle = {
              color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_18__["default"].red400
            };
          }

          return series;
        })) !== null && _provided$widgetData$ !== void 0 ? _provided$widgetData$ : [];
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_anomalyChart__WEBPACK_IMPORTED_MODULE_23__.AnomalyChart, { ...provided,
          data: data,
          height: height,
          statsPeriod: undefined,
          start: null,
          end: null
        });
      },
      height
    }]
  });
}

Anomalies.displayName = "Anomalies";

function AnomaliesContent(props) {
  const {
    location,
    organization,
    eventView
  } = props;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeScalar)(location.query.query, '');

  function handleChange(key) {
    return function (value) {
      const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)({ ...(location.query || {}),
        [key]: value
      }); // do not propagate pagination when making a new search

      const toOmit = ['cursor'];

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(value)) {
        toOmit.push(key);
      }

      const searchQueryParams = lodash_omit__WEBPACK_IMPORTED_MODULE_4___default()(queryParams, toOmit);
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({ ...location,
        query: searchQueryParams
      });
    };
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
    fullWidth: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(FilterActions, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_11__["default"], {
        condensed: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_8__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_7__["default"], {
          alignDropdown: "left"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
        organization: organization,
        projectIds: eventView.project,
        query: query,
        fields: eventView.fields,
        onSearch: handleChange('query')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_utils_performance_anomalies_anomaliesQuery__WEBPACK_IMPORTED_MODULE_16__["default"], {
      organization: organization,
      location: location,
      eventView: eventView,
      children: queryData => {
        var _queryData$data;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Anomalies, { ...props,
            queryData: queryData
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_anomaliesTable__WEBPACK_IMPORTED_MODULE_22__["default"], {
            anomalies: (_queryData$data = queryData.data) === null || _queryData$data === void 0 ? void 0 : _queryData$data.anomalies,
            ...props,
            isLoading: queryData.isLoading
          })]
        });
      }
    })]
  });
}

AnomaliesContent.displayName = "AnomaliesContent";

const FilterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eoagdn90"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:auto 1fr;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AnomaliesContent);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionAnomalies/index.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionAnomalies/index.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _pageLayout__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../pageLayout */ "./app/views/performance/transactionSummary/pageLayout.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionAnomalies/content.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function TransactionAnomalies(props) {
  const {
    location,
    organization,
    projects
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_1__.MEPSettingProvider, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_pageLayout__WEBPACK_IMPORTED_MODULE_4__["default"], {
      location: location,
      organization: organization,
      projects: projects,
      tab: _tabs__WEBPACK_IMPORTED_MODULE_5__["default"].Anomalies,
      generateEventView: _utils__WEBPACK_IMPORTED_MODULE_7__.generateAnomaliesEventView,
      getDocumentTitle: getDocumentTitle,
      childComponent: _content__WEBPACK_IMPORTED_MODULE_6__["default"]
    })
  });
}

TransactionAnomalies.displayName = "TransactionAnomalies";

function getDocumentTitle(transactionName) {
  const hasTransactionName = typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Performance')].join(' - ');
  }

  return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Summary'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Performance')].join(' - ');
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_3__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])(TransactionAnomalies)));

/***/ }),

/***/ "../node_modules/lodash/assign.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/assign.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assignValue = __webpack_require__(/*! ./_assignValue */ "../node_modules/lodash/_assignValue.js"),
    copyObject = __webpack_require__(/*! ./_copyObject */ "../node_modules/lodash/_copyObject.js"),
    createAssigner = __webpack_require__(/*! ./_createAssigner */ "../node_modules/lodash/_createAssigner.js"),
    isArrayLike = __webpack_require__(/*! ./isArrayLike */ "../node_modules/lodash/isArrayLike.js"),
    isPrototype = __webpack_require__(/*! ./_isPrototype */ "../node_modules/lodash/_isPrototype.js"),
    keys = __webpack_require__(/*! ./keys */ "../node_modules/lodash/keys.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Assigns own enumerable string keyed properties of source objects to the
 * destination object. Source objects are applied from left to right.
 * Subsequent sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object` and is loosely based on
 * [`Object.assign`](https://mdn.io/Object/assign).
 *
 * @static
 * @memberOf _
 * @since 0.10.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.assignIn
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * function Bar() {
 *   this.c = 3;
 * }
 *
 * Foo.prototype.b = 2;
 * Bar.prototype.d = 4;
 *
 * _.assign({ 'a': 0 }, new Foo, new Bar);
 * // => { 'a': 1, 'c': 3 }
 */
var assign = createAssigner(function(object, source) {
  if (isPrototype(source) || isArrayLike(source)) {
    copyObject(source, keys(source), object);
    return;
  }
  for (var key in source) {
    if (hasOwnProperty.call(source, key)) {
      assignValue(object, key, source[key]);
    }
  }
});

module.exports = assign;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_errorPanel_tsx-app_views_performance_transactionSummary_transactionAnom-701b29.1d354b1ab679d6084bbc891ab731fd12.js.map