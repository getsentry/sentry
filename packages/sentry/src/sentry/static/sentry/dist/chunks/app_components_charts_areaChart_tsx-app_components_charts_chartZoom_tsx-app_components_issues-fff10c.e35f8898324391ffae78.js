"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_areaChart_tsx-app_components_charts_chartZoom_tsx-app_components_issues-fff10c"],{

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

/***/ "./app/components/issues/groupList.tsx":
/*!*********************************************!*\
  !*** ./app/components/issues/groupList.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupList": () => (/* binding */ GroupList),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/searchSyntax/utils */ "./app/components/searchSyntax/utils.tsx");
/* harmony import */ var sentry_components_stream_group__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/stream/group */ "./app/components/stream/group.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_streamManager__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/streamManager */ "./app/utils/streamManager.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_details_relatedIssuesNotAvailable__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable */ "./app/views/alerts/rules/metric/details/relatedIssuesNotAvailable.tsx");
/* harmony import */ var _groupListHeader__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./groupListHeader */ "./app/components/issues/groupListHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // eslint-disable-next-line no-restricted-imports























const defaultProps = {
  canSelectGroups: true,
  withChart: true,
  withPagination: true,
  useFilteredStats: true,
  useTintRow: true,
  narrowGroups: false
};

class GroupList extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      error: false,
      errorData: null,
      groups: [],
      pageLinks: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_17__["default"].listen(() => this.onGroupChange(), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_streamManager", new sentry_utils_streamManager__WEBPACK_IMPORTED_MODULE_19__["default"](sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_17__["default"]));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_17__["default"].loadInitialData([]);
      const {
        api,
        orgId,
        queryParams
      } = this.props;
      api.clear();
      this.setState({
        loading: true,
        error: false,
        errorData: null
      });
      (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_7__.fetchOrgMembers)(api, orgId).then(members => {
        this.setState({
          memberList: (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_7__.indexMembersByProject)(members)
        });
      });
      const endpoint = this.getGroupListEndpoint();
      const parsedQuery = (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_13__.parseSearch)((queryParams !== null && queryParams !== void 0 ? queryParams : this.getQueryParams()).query);
      const hasLogicBoolean = parsedQuery ? (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_14__.treeResultLocator)({
        tree: parsedQuery,
        noResultValue: false,
        visitorTest: _ref => {
          let {
            token,
            returnResult
          } = _ref;
          return token.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_13__.Token.LogicBoolean ? returnResult(true) : null;
        }
      }) : false; // Check if the alert rule query has AND or OR
      // logic queries haven't been implemented for issue search yet

      if (hasLogicBoolean) {
        this.setState({
          error: true,
          errorData: {
            detail: sentry_views_alerts_rules_metric_details_relatedIssuesNotAvailable__WEBPACK_IMPORTED_MODULE_21__.RELATED_ISSUES_BOOLEAN_QUERY_ERROR
          },
          loading: false
        });
        return;
      }

      try {
        var _jqXHR$getResponseHea;

        const [data,, jqXHR] = await api.requestPromise(endpoint, {
          includeAllArgs: true
        });

        this._streamManager.push(data);

        this.setState({
          error: false,
          errorData: null,
          loading: false,
          pageLinks: (_jqXHR$getResponseHea = jqXHR === null || jqXHR === void 0 ? void 0 : jqXHR.getResponseHeader('Link')) !== null && _jqXHR$getResponseHea !== void 0 ? _jqXHR$getResponseHea : null
        }, () => {
          var _this$props$onFetchSu, _this$props;

          (_this$props$onFetchSu = (_this$props = this.props).onFetchSuccess) === null || _this$props$onFetchSu === void 0 ? void 0 : _this$props$onFetchSu.call(_this$props, this.state, this.handleCursorChange);
        });
      } catch (error) {
        this.setState({
          error: true,
          errorData: error.responseJSON,
          loading: false
        });
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(this.state, nextState) || nextProps.endpointPath !== this.props.endpointPath || nextProps.query !== this.props.query || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(nextProps.queryParams, this.props.queryParams);
  }

  componentDidUpdate(prevProps) {
    const ignoredQueryParams = ['end'];

    if (prevProps.orgId !== this.props.orgId || prevProps.endpointPath !== this.props.endpointPath || prevProps.query !== this.props.query || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.queryParams, ignoredQueryParams), lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(this.props.queryParams, ignoredQueryParams))) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_17__["default"].reset();
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_18__.callIfFunction)(this.listener);
  }

  getGroupListEndpoint() {
    const {
      orgId,
      endpointPath,
      queryParams
    } = this.props;
    const path = endpointPath !== null && endpointPath !== void 0 ? endpointPath : `/organizations/${orgId}/issues/`;
    const queryParameters = queryParams !== null && queryParams !== void 0 ? queryParams : this.getQueryParams();
    return `${path}?${query_string__WEBPACK_IMPORTED_MODULE_6__.stringify(queryParameters)}`;
  }

  getQueryParams() {
    const {
      location,
      query
    } = this.props;
    const queryParams = location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = query;
    return queryParams;
  }

  handleCursorChange(cursor, path, query, pageDiff) {
    const queryPageInt = parseInt(query.page, 10);
    let nextPage = isNaN(queryPageInt) ? pageDiff : queryPageInt + pageDiff; // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards

    if (nextPage <= 0) {
      cursor = undefined;
      nextPage = undefined;
    }

    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
      pathname: path,
      query: { ...query,
        cursor,
        page: nextPage
      }
    });
  }

  onGroupChange() {
    const groups = this._streamManager.getAllItems();

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(groups, this.state.groups)) {
      this.setState({
        groups
      });
    }
  }

  render() {
    const {
      canSelectGroups,
      withChart,
      renderEmptyMessage,
      renderErrorMessage,
      withPagination,
      useFilteredStats,
      useTintRow,
      customStatsPeriod,
      queryParams,
      queryFilterDescription,
      narrowGroups
    } = this.props;
    const {
      loading,
      error,
      errorData,
      groups,
      memberList,
      pageLinks
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {});
    }

    if (error) {
      if (typeof renderErrorMessage === 'function' && errorData) {
        return renderErrorMessage(errorData, this.fetchData);
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__["default"], {
        onRetry: this.fetchData
      });
    }

    if (groups.length === 0) {
      if (typeof renderEmptyMessage === 'function') {
        return renderEmptyMessage();
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_8__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("p", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)("There don't seem to be any events fitting the query.")
            })
          })
        })
      });
    }

    const statsPeriod = (queryParams === null || queryParams === void 0 ? void 0 : queryParams.groupStatsPeriod) === 'auto' ? queryParams === null || queryParams === void 0 ? void 0 : queryParams.groupStatsPeriod : sentry_components_stream_group__WEBPACK_IMPORTED_MODULE_15__.DEFAULT_STREAM_GROUP_STATS_PERIOD;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_groupListHeader__WEBPACK_IMPORTED_MODULE_22__["default"], {
          withChart: !!withChart,
          narrowGroups: narrowGroups
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: groups.map(_ref2 => {
            let {
              id,
              project
            } = _ref2;
            const members = memberList !== null && memberList !== void 0 && memberList.hasOwnProperty(project.slug) ? memberList[project.slug] : undefined;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_stream_group__WEBPACK_IMPORTED_MODULE_15__["default"], {
              id: id,
              canSelect: canSelectGroups,
              withChart: withChart,
              memberList: members,
              useFilteredStats: useFilteredStats,
              useTintRow: useTintRow,
              customStatsPeriod: customStatsPeriod,
              statsPeriod: statsPeriod,
              queryFilterDescription: queryFilterDescription,
              narrowGroups: narrowGroups
            }, id);
          })
        })]
      }), withPagination && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
        pageLinks: pageLinks,
        onCursor: this.handleCursorChange
      })]
    });
  }

}

GroupList.displayName = "GroupList";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(GroupList, "defaultProps", defaultProps);


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(GroupList)));

/***/ }),

/***/ "./app/components/issues/groupListHeader.tsx":
/*!***************************************************!*\
  !*** ./app/components/issues/groupListHeader.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const GroupListHeader = _ref => {
  let {
    withChart = true,
    narrowGroups = false
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
    disablePadding: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(IssueWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issue')
    }), withChart && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(ChartWrapper, {
      className: `hidden-xs hidden-sm ${narrowGroups ? 'hidden-md' : ''}`,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Graph')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EventUserWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('events')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(EventUserWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('users')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(AssigneeWrapper, {
      className: "hidden-xs hidden-sm toolbar-header",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Assignee')
    })]
  });
};

GroupListHeader.displayName = "GroupListHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupListHeader);

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emaz6xo4"
} : 0)("display:flex;align-self:center;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(2), ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const IssueWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Heading,  true ? {
  target: "emaz6xo3"
} : 0)("flex:1;width:66.66%;@media (min-width: ", p => p.theme.breakpoints.medium, "){width:50%;}" + ( true ? "" : 0));

const EventUserWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Heading,  true ? {
  target: "emaz6xo2"
} : 0)("justify-content:flex-end;width:60px;@media (min-width: ", p => p.theme.breakpoints.xlarge, "){width:80px;}" + ( true ? "" : 0));

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Heading,  true ? {
  target: "emaz6xo1"
} : 0)( true ? {
  name: "1yz45kt",
  styles: "justify-content:space-between;width:160px"
} : 0);

const AssigneeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Heading,  true ? {
  target: "emaz6xo0"
} : 0)( true ? {
  name: "8mimsw",
  styles: "justify-content:flex-end;width:80px"
} : 0);

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/relatedIssuesNotAvailable.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/relatedIssuesNotAvailable.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RELATED_ISSUES_BOOLEAN_QUERY_ERROR": () => (/* binding */ RELATED_ISSUES_BOOLEAN_QUERY_ERROR),
/* harmony export */   "RelatedIssuesNotAvailable": () => (/* binding */ RelatedIssuesNotAvailable)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const RELATED_ISSUES_BOOLEAN_QUERY_ERROR = 'Error parsing search query: Boolean statements containing "OR" or "AND" are not supported in this search';
/**
 * Renders an Alert box of type "info" for boolean queries in alert details. Renders a discover link if the feature is available.
 */

const RelatedIssuesNotAvailable = _ref => {
  let {
    buttonTo,
    buttonText
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledAlert, {
    type: "info",
    showIcon: true,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__["default"], {
      features: ['discover-basic'],
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "button",
        priority: "default",
        size: "xs",
        to: buttonTo,
        children: buttonText
      })
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
      "data-test-id": "loading-error-message",
      children: "Related Issues unavailable for this alert."
    })
  });
};
RelatedIssuesNotAvailable.displayName = "RelatedIssuesNotAvailable";

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e14eefiq0"
} : 0)(
/* sc-selector */
sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel, " &{border-radius:0;border-width:1px 0;}" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_areaChart_tsx-app_components_charts_chartZoom_tsx-app_components_issues-fff10c.aa9abcf4284120abadbe1daadc17af62.js.map