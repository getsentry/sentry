"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_rules_issue_details_ruleDetails_tsx"],{

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

/***/ "./app/components/keyValueTable.tsx":
/*!******************************************!*\
  !*** ./app/components/keyValueTable.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KeyValueTable": () => (/* binding */ KeyValueTable),
/* harmony export */   "KeyValueTableRow": () => (/* binding */ KeyValueTableRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const KeyValueTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dl',  true ? {
  target: "e13z4zle2"
} : 0)( true ? {
  name: "u4s7v9",
  styles: "display:grid;grid-template-columns:50% 50%"
} : 0);
const KeyValueTableRow = _ref => {
  let {
    keyName,
    value
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
      children: keyName
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Value, {
      children: value
    })]
  });
};
KeyValueTableRow.displayName = "KeyValueTableRow";

const commonStyles = _ref2 => {
  let {
    theme
  } = _ref2;
  return `
font-size: ${theme.fontSizeMedium};
padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1)};
font-weight: normal;
line-height: inherit;
${p => p.theme.overflowEllipsis};
&:nth-of-type(2n-1) {
  background-color: ${theme.backgroundSecondary};
}
`;
};

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dt',  true ? {
  target: "e13z4zle1"
} : 0)(commonStyles, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dd',  true ? {
  target: "e13z4zle0"
} : 0)(commonStyles, ";color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/pageTimeRangeSelector.tsx":
/*!**************************************************!*\
  !*** ./app/components/pageTimeRangeSelector.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector */ "./app/components/organizations/timeRangeSelector/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function PageTimeRangeSelector(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownDate, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__["default"], {
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownLabel, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Date Range:')
      }),
      detached: true,
      ...props
    }, `period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`)
  });
}

PageTimeRangeSelector.displayName = "PageTimeRangeSelector";

const DropdownDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel,  true ? {
  target: "e1hsuxgy1"
} : 0)("padding:0;margin:0;display:flex;justify-content:center;align-items:center;height:42px;background:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.textColor, ";>div{width:100%;align-self:stretch;}>div>div:first-child>div{padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";}>div>div:last-child:not(:first-child){min-width:calc(100% + 2px);transform:translateX(-1px);right:auto;}" + ( true ? "" : 0));

const DropdownLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1hsuxgy0"
} : 0)("text-align:left;font-weight:600;color:", p => p.theme.textColor, ";>span:last-child{font-weight:400;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageTimeRangeSelector);

/***/ }),

/***/ "./app/views/alerts/rules/issue/details/alertChart.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/alertChart.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

// eslint-disable-next-line no-restricted-imports













class AlertChart extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__["default"] {
  componentDidUpdate(prevProps) {
    const {
      project,
      organization,
      start,
      end,
      period,
      utc
    } = this.props;

    if (prevProps.start !== start || prevProps.end !== end || prevProps.period !== period || prevProps.utc !== utc || prevProps.organization.id !== organization.id || prevProps.project.id !== project.id) {
      this.remountComponent();
    }
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      ruleFireHistory: []
    };
  }

  getEndpoints() {
    const {
      project,
      organization,
      period,
      start,
      end,
      utc,
      rule
    } = this.props;
    return [['ruleFireHistory', `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/stats/`, {
      query: { ...(period && {
          statsPeriod: period
        }),
        start,
        end,
        utc
      }
    }]];
  }

  renderChart() {
    const {
      router,
      period,
      start,
      end,
      utc
    } = this.props;
    const {
      ruleFireHistory
    } = this.state;
    const series = {
      seriesName: 'Alerts Triggered',
      data: ruleFireHistory.map(alert => ({
        name: alert.date,
        value: alert.count
      })),
      emphasis: {
        disabled: true
      }
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_4__["default"], {
      router: router,
      period: period,
      start: start,
      end: end,
      utc: utc,
      usePageDate: true,
      children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_3__.AreaChart, { ...zoomRenderProps,
        isGroupedByDate: true,
        showTimeInTooltip: true,
        grid: {
          left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.25),
          right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2),
          top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3),
          bottom: 0
        },
        yAxis: {
          minInterval: 1
        },
        series: [series]
      })
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
        withPadding: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
          height: "200px"
        })
      })
    });
  }

  render() {
    const {
      ruleFireHistory,
      loading
    } = this.state;
    const totalAlertsTriggered = ruleFireHistory.reduce((acc, curr) => acc + curr.count, 0);
    return loading ? this.renderEmpty() : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledPanelBody, {
        withPadding: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChartHeader, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.HeaderTitleLegend, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Alerts Triggered')
          })
        }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
          value: this.renderChart(),
          fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
            height: "200px",
            testId: "skeleton-ui"
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ChartFooter, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FooterHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Total Alerts')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FooterValue, {
          children: totalAlertsTriggered.toLocaleString()
        })]
      })]
    });
  }

}

AlertChart.displayName = "AlertChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(AlertChart));

const ChartHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehsccqr4"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";" + ( true ? "" : 0));

const ChartFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelFooter,  true ? {
  target: "ehsccqr3"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " 20px;" + ( true ? "" : 0));

const FooterHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.SectionHeading,  true ? {
  target: "ehsccqr2"
} : 0)("display:flex;align-items:center;margin:0;font-weight:bold;font-size:", p => p.theme.fontSizeMedium, ";line-height:1;" + ( true ? "" : 0));

const FooterValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehsccqr1"
} : 0)("display:flex;align-items:center;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));
/* Override padding to make chart appear centered */


const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody,  true ? {
  target: "ehsccqr0"
} : 0)( true ? {
  name: "sgs7ru",
  styles: "padding-right:6px"
} : 0);

/***/ }),

/***/ "./app/views/alerts/rules/issue/details/issuesList.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/issuesList.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class AlertRuleIssuesList extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  componentDidUpdate(prevProps) {
    const {
      project,
      organization,
      start,
      end,
      period,
      utc,
      cursor
    } = this.props;

    if (prevProps.start !== start || prevProps.end !== end || prevProps.period !== period || prevProps.utc !== utc || prevProps.organization.id !== organization.id || prevProps.project.id !== project.id || prevProps.cursor !== cursor) {
      this.remountComponent();
    }
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      groupHistory: null
    };
  }

  getEndpoints() {
    const {
      project,
      rule,
      organization,
      period,
      start,
      end,
      utc,
      cursor
    } = this.props;
    return [['groupHistory', `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/group-history/`, {
      query: {
        per_page: 10,
        ...(period && {
          statsPeriod: period
        }),
        start,
        end,
        utc,
        cursor
      }
    }]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      organization,
      rule
    } = this.props;
    const {
      loading,
      groupHistory,
      groupHistoryPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPanelTable, {
        isLoading: loading,
        isEmpty: (groupHistory === null || groupHistory === void 0 ? void 0 : groupHistory.length) === 0,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No issues exist for the current query.'),
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Issue'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(AlignRight, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Alerts')
        }, "alerts"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(AlignRight, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Events')
        }, "events"), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Last Triggered')],
        children: groupHistory === null || groupHistory === void 0 ? void 0 : groupHistory.map(_ref => {
          let {
            group: issue,
            count,
            lastTriggered
          } = _ref;
          const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getMessage)(issue);
          const {
            title
          } = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getTitle)(issue);
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(TitleWrapper, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
                to: {
                  pathname: `/organizations/${organization.slug}/issues/${issue.id}/`,
                  query: rule.environment ? {
                    environment: rule.environment
                  } : {}
                },
                children: [title, ":"]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(MessageWrapper, {
                children: message
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(AlignRight, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_5__["default"], {
                value: count
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(AlignRight, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_5__["default"], {
                value: issue.count
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledDateTime, {
                date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__["default"])({
                  value: lastTriggered,
                  fixed: 'Mar 16, 2020 9:10:13 AM UTC'
                }),
                year: true,
                seconds: true,
                timeZone: true
              })
            })]
          }, issue.id);
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(PaginationWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPagination, {
          pageLinks: groupHistoryPageLinks,
          size: "xs"
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertRuleIssuesList);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelTable,  true ? {
  target: "e1sgzy2g6"
} : 0)("grid-template-columns:1fr 0.2fr 0.2fr 0.5fr;font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";", p => !p.isEmpty && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_15__.css)("&>div{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const AlignRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sgzy2g5"
} : 0)( true ? {
  name: "mnwtso",
  styles: "text-align:right;font-variant-numeric:tabular-nums"
} : 0);

const StyledDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1sgzy2g4"
} : 0)("white-space:nowrap;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sgzy2g3"
} : 0)(p => p.theme.overflowEllipsis, ";display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";min-width:200px;" + ( true ? "" : 0));

const MessageWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1sgzy2g2"
} : 0)(p => p.theme.overflowEllipsis, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const PaginationWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sgzy2g1"
} : 0)("display:flex;align-items:center;justify-content:flex-end;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1sgzy2g0"
} : 0)( true ? {
  name: "1i9vogi",
  styles: "margin-top:0"
} : 0);

/***/ }),

/***/ "./app/views/alerts/rules/issue/details/ruleDetails.tsx":
/*!**************************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/ruleDetails.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/pageTimeRangeSelector */ "./app/components/pageTimeRangeSelector.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/details/constants */ "./app/views/alerts/rules/metric/details/constants.tsx");
/* harmony import */ var _alertChart__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./alertChart */ "./app/views/alerts/rules/issue/details/alertChart.tsx");
/* harmony import */ var _issuesList__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./issuesList */ "./app/views/alerts/rules/issue/details/issuesList.tsx");
/* harmony import */ var _sidebar__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./sidebar */ "./app/views/alerts/rules/issue/details/sidebar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























const PAGE_QUERY_PARAMS = ['pageStatsPeriod', 'pageStart', 'pageEnd', 'pageUtc', 'cursor'];

class AlertRuleDetails extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateDatetime", datetime => {
      const {
        start,
        end,
        relative,
        utc
      } = datetime;

      if (start && end) {
        const parser = utc ? (moment__WEBPACK_IMPORTED_MODULE_4___default().utc) : (moment__WEBPACK_IMPORTED_MODULE_4___default());
        return this.setStateOnUrl({
          pageStatsPeriod: undefined,
          pageStart: parser(start).format(),
          pageEnd: parser(end).format(),
          pageUtc: utc !== null && utc !== void 0 ? utc : undefined,
          cursor: undefined
        });
      }

      return this.setStateOnUrl({
        pageStatsPeriod: relative || undefined,
        pageStart: undefined,
        pageEnd: undefined,
        pageUtc: undefined,
        cursor: undefined
      });
    });
  }

  componentDidMount() {
    const {
      organization,
      params
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('issue_alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(params.ruleId, 10)
    });
  }

  componentDidUpdate(prevProps) {
    const {
      params: prevParams
    } = prevProps;
    const {
      params: currParams
    } = this.props;

    if (prevParams.ruleId !== currParams.ruleId || prevParams.orgId !== currParams.orgId || prevParams.projectId !== currParams.projectId) {
      this.reloadData();
    }
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      rule: null,
      memberList: []
    };
  }

  getEndpoints() {
    const {
      orgId,
      ruleId,
      projectId
    } = this.props.params;
    return [['rule', `/projects/${orgId}/${projectId}/rules/${ruleId}/`, {
      query: {
        expand: 'lastTriggered'
      }
    }, {
      allowError: error => error.status === 404
    }], ['memberList', `/organizations/${orgId}/users/`, {
      query: {
        projectSlug: projectId
      }
    }]];
  }

  getDataDatetime() {
    var _this$props$location$, _this$props$location;

    const query = (_this$props$location$ = (_this$props$location = this.props.location) === null || _this$props$location === void 0 ? void 0 : _this$props$location.query) !== null && _this$props$location$ !== void 0 ? _this$props$location$ : {};
    const {
      start,
      end,
      statsPeriod,
      utc: utcString
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__.normalizeDateTimeParams)(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true
    });

    if (!statsPeriod && !start && !end) {
      return {
        period: sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_21__.ALERT_DEFAULT_CHART_PERIOD
      };
    } // Following getParams, statsPeriod will take priority over start/end


    if (statsPeriod) {
      return {
        period: statsPeriod
      };
    }

    const utc = utcString === 'true';

    if (start && end) {
      return utc ? {
        start: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(start).format(),
        end: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(end).format(),
        utc
      } : {
        start: moment__WEBPACK_IMPORTED_MODULE_4___default()(start).utc().format(),
        end: moment__WEBPACK_IMPORTED_MODULE_4___default()(end).utc().format(),
        utc
      };
    }

    return {
      period: sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_21__.ALERT_DEFAULT_CHART_PERIOD
    };
  }

  setStateOnUrl(nextState) {
    return this.props.router.push({ ...this.props.location,
      query: { ...this.props.location.query,
        ...lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(nextState, PAGE_QUERY_PARAMS)
      }
    });
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
        fullWidth: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {})
      })
    });
  }

  renderBody() {
    const {
      params,
      location,
      organization,
      project
    } = this.props;
    const {
      orgId,
      ruleId,
      projectId
    } = params;
    const {
      cursor
    } = location.query;
    const {
      period,
      start,
      end,
      utc
    } = this.getDataDatetime();
    const {
      rule,
      memberList
    } = this.state;

    if (!rule) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledLoadingError, {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('The alert rule you were looking for was not found.')
      });
    }

    if (!project) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledLoadingError, {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('The project you were looking for was not found.')
      });
    }

    const duplicateLink = {
      pathname: `/organizations/${orgId}/alerts/new/issue/`,
      query: {
        project: project.slug,
        duplicateRuleId: rule.id,
        createFromDuplicate: true,
        referrer: 'issue_rule_details'
      }
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_13__["default"], {
      skipInitializeUrlParams: true,
      skipLoadLastUsed: true,
      shouldForceProject: true,
      forceProject: project,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__["default"], {
        title: rule.name,
        orgSlug: orgId,
        projectSlug: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.HeaderContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_6__["default"], {
            crumbs: [{
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Alerts'),
              to: `/organizations/${orgId}/alerts/rules/`
            }, {
              label: rule.name,
              to: null
            }]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Title, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(RuleName, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
                project: project,
                avatarSize: 28,
                hideName: true,
                avatarProps: {
                  hasTooltip: true,
                  tooltip: project.slug
                }
              }), rule.name]
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.HeaderActions, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconCopy, {}),
              to: duplicateLink,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Duplicate')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconEdit, {}),
              to: `/organizations/${orgId}/alerts/rules/${projectId}/${ruleId}/`,
              onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('issue_alert_rule_details.edit_clicked', {
                organization,
                rule_id: parseInt(ruleId, 10)
              }),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Edit Rule')
            })]
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledPageTimeRangeSelector, {
            organization: organization,
            relative: period !== null && period !== void 0 ? period : '',
            start: start !== null && start !== void 0 ? start : null,
            end: end !== null && end !== void 0 ? end : null,
            utc: utc !== null && utc !== void 0 ? utc : null,
            onUpdate: this.handleUpdateDatetime
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_alertChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            organization: organization,
            orgId: orgId,
            project: project,
            rule: rule,
            period: period !== null && period !== void 0 ? period : '',
            start: start !== null && start !== void 0 ? start : null,
            end: end !== null && end !== void 0 ? end : null,
            utc: utc !== null && utc !== void 0 ? utc : null
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_issuesList__WEBPACK_IMPORTED_MODULE_23__["default"], {
            organization: organization,
            project: project,
            rule: rule,
            period: period !== null && period !== void 0 ? period : '',
            start: start !== null && start !== void 0 ? start : null,
            end: end !== null && end !== void 0 ? end : null,
            utc: utc !== null && utc !== void 0 ? utc : null,
            cursor: cursor
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Side, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_sidebar__WEBPACK_IMPORTED_MODULE_24__["default"], {
            rule: rule,
            memberList: memberList,
            teams: project.teams
          })
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertRuleDetails);

const StyledPageTimeRangeSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e1niaui32"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(2), ";" + ( true ? "" : 0));

const RuleName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1niaui31"
} : 0)("display:grid;grid-template-columns:max-content 1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const StyledLoadingError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e1niaui30"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/issue/details/sidebar.tsx":
/*!**********************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/sidebar.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _textRule__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./textRule */ "./app/views/alerts/rules/issue/details/textRule.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function Conditions(_ref) {
  let {
    rule,
    teams,
    memberList
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Step, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StepContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChevronContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconChevron, {
            color: "gray200",
            isCircled: true,
            direction: "right",
            size: "sm"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StepContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StepLead, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[when:When] an event is captured [selector]', {
              when: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Badge, {}),
              selector: rule.conditions.length ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('and %s...', rule.actionMatch) : ''
            })
          }), rule.conditions.map((condition, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ConditionsBadge, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_textRule__WEBPACK_IMPORTED_MODULE_10__.TextCondition, {
              condition: condition
            })
          }, idx))]
        })]
      })
    }), rule.filters.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Step, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StepContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChevronContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconChevron, {
            color: "gray200",
            isCircled: true,
            direction: "right",
            size: "sm"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StepContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StepLead, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[if:If] [selector] of these filters match', {
              if: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Badge, {}),
              selector: rule.filterMatch
            })
          }), rule.filters.map((filter, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ConditionsBadge, {
            children: filter.time ? filter.name + '(s)' : filter.name
          }, idx))]
        })]
      })
    }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Step, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StepContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ChevronContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconChevron, {
            isCircled: true,
            color: "gray200",
            direction: "right",
            size: "sm"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StepLead, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[then:Then] perform these actions', {
              then: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Badge, {})
            })
          }), rule.actions.length ? rule.actions.map((action, idx) => {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ConditionsBadge, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_textRule__WEBPACK_IMPORTED_MODULE_10__.TextAction, {
                action: action,
                memberList: memberList,
                teams: teams
              })
            }, idx);
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ConditionsBadge, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Do nothing')
          })]
        })]
      })
    })]
  });
}

Conditions.displayName = "Conditions";

function Sidebar(_ref2) {
  var _rule$owner, _rule$environment, _rule$createdBy$name;

  let {
    rule,
    teams,
    memberList
  } = _ref2;
  const ownerId = (_rule$owner = rule.owner) === null || _rule$owner === void 0 ? void 0 : _rule$owner.split(':')[1];
  const teamActor = ownerId && {
    type: 'team',
    id: ownerId,
    name: ''
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StatusContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(HeaderItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Heading, {
          noMargin: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last Triggered')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Status, {
          children: rule.lastTriggered ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__["default"], {
            date: rule.lastTriggered
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No alerts triggered')
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SidebarGroup, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Heading, {
        noMargin: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Alert Conditions')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Conditions, {
        rule: rule,
        teams: teams,
        memberList: memberList
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SidebarGroup, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Heading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Alert Rule Details')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__.KeyValueTable, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__.KeyValueTableRow, {
          keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Environment'),
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(OverflowTableValue, {
            children: (_rule$environment = rule.environment) !== null && _rule$environment !== void 0 ? _rule$environment : '-'
          })
        }), rule.dateCreated && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__.KeyValueTableRow, {
          keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Date Created'),
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_6__["default"], {
            date: rule.dateCreated,
            suffix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('ago')
          })
        }), rule.createdBy && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__.KeyValueTableRow, {
          keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Created By'),
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(OverflowTableValue, {
            children: (_rule$createdBy$name = rule.createdBy.name) !== null && _rule$createdBy$name !== void 0 ? _rule$createdBy$name : '-'
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_4__.KeyValueTableRow, {
          keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Team'),
          value: teamActor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__["default"], {
            actor: teamActor,
            size: 24
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unassigned')
        })]
      })]
    })]
  });
}

Sidebar.displayName = "Sidebar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Sidebar);

const SidebarGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg12"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";" + ( true ? "" : 0));

const HeaderItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg11"
} : 0)( true ? {
  name: "10sya4f",
  styles: "flex:1;display:flex;flex-direction:column;>*:nth-child(2){flex:1;display:flex;align-items:center;}"
} : 0);

const Status = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg10"
} : 0)("position:relative;display:grid;grid-template-columns:auto auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const StatusContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg9"
} : 0)("height:60px;display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), ";" + ( true ? "" : 0));

const Step = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg8"
} : 0)("position:relative;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";:first-child{margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";}" + ( true ? "" : 0));

const StepContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg7"
} : 0)( true ? {
  name: "bnlinx",
  styles: "display:flex;align-items:flex-start;flex-grow:1"
} : 0);

const StepContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg6"
} : 0)("&::before{content:'';position:absolute;height:100%;top:28px;left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";border-right:1px ", p => p.theme.gray200, " dashed;}" + ( true ? "" : 0));

const StepLead = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg5"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";font-size:", p => p.theme.fontSizeMedium, ";font-weight:400;" + ( true ? "" : 0));

const ChevronContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg4"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), " 0;" + ( true ? "" : 0));

const Badge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "emzltbg3"
} : 0)("display:inline-block;background-color:", p => p.theme.purple300, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.75), ";border-radius:", p => p.theme.borderRadius, ";color:", p => p.theme.white, ";text-transform:uppercase;text-align:center;font-size:", p => p.theme.fontSizeSmall, ";font-weight:400;line-height:1.5;" + ( true ? "" : 0));

const ConditionsBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "emzltbg2"
} : 0)("display:block;background-color:", p => p.theme.surface100, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.75), ";border-radius:", p => p.theme.borderRadius, ";color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeSmall, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";width:fit-content;font-weight:400;" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading,  true ? {
  target: "emzltbg1"
} : 0)("margin-top:", p => p.noMargin ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";margin-bottom:", p => p.noMargin ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const OverflowTableValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emzltbg0"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/issue/details/textRule.tsx":
/*!***********************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/textRule.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TextAction": () => (/* binding */ TextAction),
/* harmony export */   "TextCondition": () => (/* binding */ TextCondition)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * Translate Issue Alert Conditions to text
 */


function TextCondition(_ref) {
  let {
    condition
  } = _ref;

  if (condition.id === 'sentry.rules.conditions.event_frequency.EventFrequencyCondition') {
    if (condition.comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.PERCENT) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)( // Double %% escapes
        'Number of events in an issue is %s%% higher in %s compared to %s ago', condition.value, condition.comparisonInterval, condition.interval)
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Number of events in an issue is more than %s in %s', condition.value, condition.interval)
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: condition.name
  });
}
TextCondition.displayName = "TextCondition";
// TODO(scttcper): Remove the teams/memberList prop drilling
function TextAction(_ref2) {
  let {
    action,
    memberList,
    teams
  } = _ref2;

  if (action.targetType === 'Member') {
    const user = memberList.find(member => member.user.id === `${action.targetIdentifier}`);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Send a notification to %s', user === null || user === void 0 ? void 0 : user.email)
    });
  }

  if (action.targetType === 'Team') {
    const team = teams.find(tm => tm.id === `${action.targetIdentifier}`);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Send a notification to #%s', team === null || team === void 0 ? void 0 : team.name)
    });
  }

  if (action.id === 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction') {
    // Remove (optionally, an ID: XXX) from slack action
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: action.name.replace(/\(optionally.*\)/, '')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: action.name
  });
}
TextAction.displayName = "TextAction";

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/constants.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/constants.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALERT_DEFAULT_CHART_PERIOD": () => (/* binding */ ALERT_DEFAULT_CHART_PERIOD),
/* harmony export */   "API_INTERVAL_POINTS_LIMIT": () => (/* binding */ API_INTERVAL_POINTS_LIMIT),
/* harmony export */   "API_INTERVAL_POINTS_MIN": () => (/* binding */ API_INTERVAL_POINTS_MIN),
/* harmony export */   "SELECTOR_DEFAULT_PERIOD": () => (/* binding */ SELECTOR_DEFAULT_PERIOD),
/* harmony export */   "SELECTOR_RELATIVE_PERIODS": () => (/* binding */ SELECTOR_RELATIVE_PERIODS),
/* harmony export */   "TIME_OPTIONS": () => (/* binding */ TIME_OPTIONS),
/* harmony export */   "TIME_WINDOWS": () => (/* binding */ TIME_WINDOWS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");


const SELECTOR_RELATIVE_PERIODS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 6 hours'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 24 hours'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 3 days'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 7 days')
};
const ALERT_DEFAULT_CHART_PERIOD = '7d';
const TIME_OPTIONS = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 6 hours'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 24 hours'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 3 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 7 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 14 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS
}];
const TIME_WINDOWS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_HOUR * 6 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 3 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 7 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 14 * 60 * 1000
};
const SELECTOR_DEFAULT_PERIOD = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS;
const API_INTERVAL_POINTS_LIMIT = 10000;
const API_INTERVAL_POINTS_MIN = 150;

/***/ }),

/***/ "./app/views/alerts/rules/metric/types.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/rules/metric/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionLabel": () => (/* binding */ ActionLabel),
/* harmony export */   "ActionType": () => (/* binding */ ActionType),
/* harmony export */   "AlertRuleComparisonType": () => (/* binding */ AlertRuleComparisonType),
/* harmony export */   "AlertRuleThresholdType": () => (/* binding */ AlertRuleThresholdType),
/* harmony export */   "AlertRuleTriggerType": () => (/* binding */ AlertRuleTriggerType),
/* harmony export */   "Dataset": () => (/* binding */ Dataset),
/* harmony export */   "Datasource": () => (/* binding */ Datasource),
/* harmony export */   "EventTypes": () => (/* binding */ EventTypes),
/* harmony export */   "SessionsAggregate": () => (/* binding */ SessionsAggregate),
/* harmony export */   "TargetLabel": () => (/* binding */ TargetLabel),
/* harmony export */   "TargetType": () => (/* binding */ TargetType),
/* harmony export */   "TimePeriod": () => (/* binding */ TimePeriod),
/* harmony export */   "TimeWindow": () => (/* binding */ TimeWindow)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let AlertRuleThresholdType;

(function (AlertRuleThresholdType) {
  AlertRuleThresholdType[AlertRuleThresholdType["ABOVE"] = 0] = "ABOVE";
  AlertRuleThresholdType[AlertRuleThresholdType["BELOW"] = 1] = "BELOW";
})(AlertRuleThresholdType || (AlertRuleThresholdType = {}));

let AlertRuleTriggerType;

(function (AlertRuleTriggerType) {
  AlertRuleTriggerType["CRITICAL"] = "critical";
  AlertRuleTriggerType["WARNING"] = "warning";
  AlertRuleTriggerType["RESOLVE"] = "resolve";
})(AlertRuleTriggerType || (AlertRuleTriggerType = {}));

let AlertRuleComparisonType;

(function (AlertRuleComparisonType) {
  AlertRuleComparisonType["COUNT"] = "count";
  AlertRuleComparisonType["CHANGE"] = "change";
  AlertRuleComparisonType["PERCENT"] = "percent";
})(AlertRuleComparisonType || (AlertRuleComparisonType = {}));

let Dataset;

(function (Dataset) {
  Dataset["ERRORS"] = "events";
  Dataset["TRANSACTIONS"] = "transactions";
  Dataset["GENERIC_METRICS"] = "generic_metrics";
  Dataset["SESSIONS"] = "sessions";
  Dataset["METRICS"] = "metrics";
})(Dataset || (Dataset = {}));

let EventTypes;

(function (EventTypes) {
  EventTypes["DEFAULT"] = "default";
  EventTypes["ERROR"] = "error";
  EventTypes["TRANSACTION"] = "transaction";
  EventTypes["USER"] = "user";
  EventTypes["SESSION"] = "session";
})(EventTypes || (EventTypes = {}));

let Datasource;
/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */

(function (Datasource) {
  Datasource["ERROR_DEFAULT"] = "error_default";
  Datasource["DEFAULT"] = "default";
  Datasource["ERROR"] = "error";
  Datasource["TRANSACTION"] = "transaction";
})(Datasource || (Datasource = {}));

let SessionsAggregate;

(function (SessionsAggregate) {
  SessionsAggregate["CRASH_FREE_SESSIONS"] = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate";
  SessionsAggregate["CRASH_FREE_USERS"] = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate";
})(SessionsAggregate || (SessionsAggregate = {}));

let TimePeriod;

(function (TimePeriod) {
  TimePeriod["SIX_HOURS"] = "6h";
  TimePeriod["ONE_DAY"] = "1d";
  TimePeriod["THREE_DAYS"] = "3d";
  TimePeriod["SEVEN_DAYS"] = "10000m";
  TimePeriod["FOURTEEN_DAYS"] = "14d";
  TimePeriod["THIRTY_DAYS"] = "30d";
})(TimePeriod || (TimePeriod = {}));

let TimeWindow;

(function (TimeWindow) {
  TimeWindow[TimeWindow["ONE_MINUTE"] = 1] = "ONE_MINUTE";
  TimeWindow[TimeWindow["FIVE_MINUTES"] = 5] = "FIVE_MINUTES";
  TimeWindow[TimeWindow["TEN_MINUTES"] = 10] = "TEN_MINUTES";
  TimeWindow[TimeWindow["FIFTEEN_MINUTES"] = 15] = "FIFTEEN_MINUTES";
  TimeWindow[TimeWindow["THIRTY_MINUTES"] = 30] = "THIRTY_MINUTES";
  TimeWindow[TimeWindow["ONE_HOUR"] = 60] = "ONE_HOUR";
  TimeWindow[TimeWindow["TWO_HOURS"] = 120] = "TWO_HOURS";
  TimeWindow[TimeWindow["FOUR_HOURS"] = 240] = "FOUR_HOURS";
  TimeWindow[TimeWindow["ONE_DAY"] = 1440] = "ONE_DAY";
})(TimeWindow || (TimeWindow = {}));

let ActionType;

(function (ActionType) {
  ActionType["EMAIL"] = "email";
  ActionType["SLACK"] = "slack";
  ActionType["PAGERDUTY"] = "pagerduty";
  ActionType["MSTEAMS"] = "msteams";
  ActionType["SENTRY_APP"] = "sentry_app";
})(ActionType || (ActionType = {}));

const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Emai\u200Bl'),
  [ActionType.SLACK]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slack'),
  [ActionType.PAGERDUTY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Pagerduty'),
  [ActionType.MSTEAMS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MS Teams'),
  [ActionType.SENTRY_APP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notification')
};
let TargetType;

(function (TargetType) {
  TargetType["SPECIFIC"] = "specific";
  TargetType["USER"] = "user";
  TargetType["TEAM"] = "team";
  TargetType["SENTRY_APP"] = "sentry_app";
})(TargetType || (TargetType = {}));

const TargetLabel = {
  [TargetType.USER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Member'),
  [TargetType.TEAM]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Team')
};
/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_rules_issue_details_ruleDetails_tsx.4671c19d0e7f9f58cd6423c47d8d974f.js.map