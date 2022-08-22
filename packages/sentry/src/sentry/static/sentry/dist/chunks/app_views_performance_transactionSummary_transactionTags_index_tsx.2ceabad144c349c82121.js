"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionSummary_transactionTags_index_tsx"],{

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

/***/ "./app/components/charts/heatMapChart.tsx":
/*!************************************************!*\
  !*** ./app/components/charts/heatMapChart.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _components_visualMap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./components/visualMap */ "./app/components/charts/components/visualMap.tsx");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _series_heatMapSeries__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./series/heatMapSeries */ "./app/components/charts/series/heatMapSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((props, ref) => {
  const {
    series,
    seriesOptions,
    visualMaps,
    ...otherProps
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
    ref: ref,
    options: {
      visualMap: visualMaps
    },
    ...otherProps,
    series: series.map(_ref => {
      let {
        seriesName,
        data,
        dataArray,
        ...options
      } = _ref;
      return (0,_series_heatMapSeries__WEBPACK_IMPORTED_MODULE_2__["default"])({ ...seriesOptions,
        ...options,
        name: seriesName,
        data: dataArray || data.map(_ref2 => {
          let {
            value,
            name
          } = _ref2;
          return [name, value];
        })
      });
    })
  });
}));

/***/ }),

/***/ "./app/components/charts/loadingPanel.tsx":
/*!************************************************!*\
  !*** ./app/components/charts/loadingPanel.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const LoadingPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    height: _height,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__["default"], {})
  });
},  true ? {
  target: "eumb2md0"
} : 0)("flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height, ";position:relative;border-color:transparent;margin-bottom:0;" + ( true ? "" : 0));

LoadingPanel.defaultProps = {
  height: '200px'
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingPanel);

/***/ }),

/***/ "./app/components/charts/series/heatMapSeries.tsx":
/*!********************************************************!*\
  !*** ./app/components/charts/series/heatMapSeries.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HeatMapSeries)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_heatmap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/heatmap */ "../node_modules/echarts/lib/chart/heatmap.js");
/* harmony import */ var echarts_lib_component_visualMap__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! echarts/lib/component/visualMap */ "../node_modules/echarts/lib/component/visualMap.js");


function HeatMapSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const {
    data,
    ...rest
  } = props;
  return {
    data: data,
    ...rest,
    type: 'heatmap'
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

/***/ "./app/components/loadingMask.tsx":
/*!****************************************!*\
  !*** ./app/components/loadingMask.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const LoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dnwgq10"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border-radius:", p => p.theme.borderRadius, ";position:absolute;top:0;bottom:0;left:0;right:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingMask);

/***/ }),

/***/ "./app/utils/performance/segmentExplorer/tagKeyHistogramQuery.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/segmentExplorer/tagKeyHistogramQuery.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getRequestFunction": () => (/* binding */ getRequestFunction)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


/**
 * An individual row in a Segment explorer result
 */


function getRequestFunction(_props) {
  const {
    aggregateColumn
  } = _props;

  function getTagExplorerRequestPayload(props) {
    const {
      eventView
    } = props;
    const apiPayload = eventView.getEventsAPIPayload(props.location);
    apiPayload.aggregateColumn = aggregateColumn;
    apiPayload.sort = _props.sort;
    apiPayload.tagKey = _props.tagKey;
    apiPayload.numBucketsPerKey = _props.numBucketsPerKey;
    return apiPayload;
  }

  return getTagExplorerRequestPayload;
}

function shouldRefetchData(prevProps, nextProps) {
  return prevProps.aggregateColumn !== nextProps.aggregateColumn || prevProps.sort !== nextProps.sort || prevProps.tagKey !== nextProps.tagKey;
}

function TagKeyHistogramQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    route: "events-facets-performance-histogram",
    getRequestPayload: getRequestFunction(props),
    shouldRefetchData: shouldRefetchData,
    ...props
  });
}

TagKeyHistogramQuery.displayName = "TagKeyHistogramQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])(TagKeyHistogramQuery));

/***/ }),

/***/ "./app/utils/performance/segmentExplorer/tagTransactionsQuery.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/segmentExplorer/tagTransactionsQuery.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function shouldRefetchData(prevProps, nextProps) {
  return prevProps.query !== nextProps.query;
}

function TagTransactionsQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    route: "events",
    shouldRefetchData: shouldRefetchData,
    ...props
  });
}

TagTransactionsQuery.displayName = "TagTransactionsQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])(TagTransactionsQuery));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/constants.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/constants.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "X_AXIS_SELECT_OPTIONS": () => (/* binding */ X_AXIS_SELECT_OPTIONS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types */ "./app/views/performance/transactionSummary/transactionTags/types.tsx");


const X_AXIS_SELECT_OPTIONS = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('LCP'),
  value: _types__WEBPACK_IMPORTED_MODULE_1__.XAxisOption.LCP
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Duration'),
  value: _types__WEBPACK_IMPORTED_MODULE_1__.XAxisOption.DURATION
}];

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/content.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/content.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/performance/segmentExplorer/segmentExplorerQuery */ "./app/utils/performance/segmentExplorer/segmentExplorerQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _transactionOverview_tagExplorer__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../transactionOverview/tagExplorer */ "./app/views/performance/transactionSummary/transactionOverview/tagExplorer.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./constants */ "./app/views/performance/transactionSummary/transactionTags/constants.tsx");
/* harmony import */ var _tagsDisplay__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./tagsDisplay */ "./app/views/performance/transactionSummary/transactionTags/tagsDisplay.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























const TagsPageContent = props => {
  const {
    eventView,
    location,
    organization,
    projects
  } = props;
  const [aggregateColumn, setAggregateColumn] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)((0,_transactionOverview_tagExplorer__WEBPACK_IMPORTED_MODULE_23__.getTransactionField)(_filter__WEBPACK_IMPORTED_MODULE_22__.SpanOperationBreakdownFilter.None, projects, eventView));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Main, {
    fullWidth: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_19__["default"], {
      eventView: eventView,
      orgSlug: organization.slug,
      location: location,
      aggregateColumn: aggregateColumn,
      limit: 20,
      sort: "-sumdelta",
      allTagKeys: true,
      children: _ref => {
        let {
          isLoading,
          tableData
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(InnerContent, { ...props,
          isLoading: isLoading,
          tableData: tableData,
          aggregateColumn: aggregateColumn,
          onChangeAggregateColumn: setAggregateColumn
        });
      }
    })
  });
};

TagsPageContent.displayName = "TagsPageContent";

function getTagKeyOptions(tableData) {
  const suspectTags = [];
  const otherTags = [];
  tableData.data.forEach(row => {
    const tagArray = row.comparison > 1 ? suspectTags : otherTags;
    tagArray.push(row.tags_key);
  });
  return {
    suspectTags,
    otherTags
  };
}

const InnerContent = props => {
  const {
    eventView: _eventView,
    location,
    organization,
    tableData,
    aggregateColumn,
    onChangeAggregateColumn,
    isLoading
  } = props;

  const eventView = _eventView.clone();

  const tagOptions = tableData ? getTagKeyOptions(tableData) : null;
  const suspectTags = tagOptions ? tagOptions.suspectTags : [];
  const otherTags = tagOptions ? tagOptions.otherTags : [];
  const decodedTagKey = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.decodeSelectedTagKey)(location);
  const allTags = [...suspectTags, ...otherTags];
  const decodedTagFromOptions = decodedTagKey ? allTags.find(tag => tag === decodedTagKey) : undefined;
  const defaultTag = allTags.length ? allTags[0] : undefined;
  const initialTag = decodedTagFromOptions !== null && decodedTagFromOptions !== void 0 ? decodedTagFromOptions : defaultTag;
  const [tagSelected, _changeTagSelected] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(initialTag);
  const lastTag = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)('');
  const changeTagSelected = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(tagKey => {
    if (lastTag.current !== tagKey) {
      const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_13__.normalizeDateTimeParams)({ ...(location.query || {}),
        tagKey,
        [_tagsDisplay__WEBPACK_IMPORTED_MODULE_25__.TAG_PAGE_TABLE_CURSOR]: undefined
      });
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({
        pathname: location.pathname,
        query: queryParams
      });

      _changeTagSelected(tagKey);

      lastTag.current = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)(location.query.tagKey, '');
    }
  }, [location.query, location.pathname]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (initialTag) {
      changeTagSelected(initialTag);
    }
  }, [initialTag, changeTagSelected]);

  const handleSearch = query => {
    const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_13__.normalizeDateTimeParams)({ ...(location.query || {}),
      query
    });
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
      pathname: location.pathname,
      query: queryParams
    });
  };

  const changeTag = (tag, isOtherTag) => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('performance_views.tags.change_tag', {
      organization,
      from_tag: tagSelected,
      to_tag: tag,
      is_other_tag: isOtherTag
    });
    return changeTagSelected(tag);
  };

  if (tagSelected) {
    eventView.additionalConditions.setFilterValues('has', [tagSelected]);
  }

  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)(location.query.query, '');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(ReversedLayoutBody, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(TagsSideBar, {
      suspectTags: suspectTags,
      otherTags: otherTags,
      tagSelected: tagSelected,
      changeTag: changeTag,
      isLoading: isLoading
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledMain, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(FilterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_12__["default"], {
          condensed: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_7__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_6__["default"], {
            alignDropdown: "left"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledSearchBar, {
          organization: organization,
          projectIds: eventView.project,
          query: query,
          fields: eventView.fields,
          onSearch: handleSearch
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_9__["default"], {
          value: aggregateColumn,
          options: _constants__WEBPACK_IMPORTED_MODULE_24__.X_AXIS_SELECT_OPTIONS,
          onChange: opt => {
            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('performance_views.tags.change_aggregate_column', {
              organization,
              value: opt.value
            });
            onChangeAggregateColumn(opt.value);
          },
          triggerProps: {
            prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('X-Axis')
          }
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(_tagsDisplay__WEBPACK_IMPORTED_MODULE_25__["default"], { ...props,
        tagKey: tagSelected
      })]
    })]
  });
};

InnerContent.displayName = "InnerContent";

const TagsSideBar = props => {
  const {
    suspectTags,
    otherTags,
    changeTag,
    tagSelected,
    isLoading
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledSide, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledSectionHeading, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Suspect Tags'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Suspect tags are tags that often correspond to slower transaction'),
        size: "sm"
      })]
    }), isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Center, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {
        mini: true
      })
    }) : suspectTags.length ? suspectTags.map(tag => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(RadioLabel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__["default"], {
        "aria-label": tag,
        checked: tagSelected === tag,
        onChange: () => changeTag(tag, false)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(SidebarTagValue, {
        className: "truncate",
        children: tag
      })]
    }, tag)) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No tags detected.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_21__.SidebarSpacer, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledSectionHeading, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Other Tags'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Other common tags for this transaction'),
        size: "sm"
      })]
    }), isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Center, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {
        mini: true
      })
    }) : otherTags.length ? otherTags.map(tag => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(RadioLabel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_15__["default"], {
        "aria-label": tag,
        checked: tagSelected === tag,
        onChange: () => changeTag(tag, true)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(SidebarTagValue, {
        className: "truncate",
        children: tag
      })]
    }, tag)) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No tags detected.')
    })]
  });
};

TagsSideBar.displayName = "TagsSideBar";

const Center = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e5m8yi88"
} : 0)( true ? {
  name: "1wnowod",
  styles: "display:flex;align-items:center;justify-content:center"
} : 0);

const RadioLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e5m8yi87"
} : 0)("cursor:pointer;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";font-weight:normal;display:grid;grid-auto-flow:column;grid-auto-columns:max-content 1fr;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";" + ( true ? "" : 0));

const SidebarTagValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e5m8yi86"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

const StyledSectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.SectionHeading,  true ? {
  target: "e5m8yi85"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0)); // TODO(k-fish): Adjust thirds layout to allow for this instead.


const ReversedLayoutBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e5m8yi84"
} : 0)("margin:0;background-color:", p => p.theme.background, ";flex-grow:1;@media (min-width: ", p => p.theme.breakpoints.medium, "){display:grid;grid-template-columns:auto 66%;align-content:start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(3), ";}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:225px minmax(100px, auto);}" + ( true ? "" : 0));

const StyledSide = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e5m8yi83"
} : 0)( true ? {
  name: "sarfoe",
  styles: "grid-column:1/2"
} : 0);

const StyledMain = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e5m8yi82"
} : 0)( true ? {
  name: "g99mcu",
  styles: "grid-column:2/4;max-width:100%"
} : 0);

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e5m8yi81"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){order:1;grid-column:1/6;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){order:initial;grid-column:auto;}" + ( true ? "" : 0));

const FilterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e5m8yi80"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:auto 1fr auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagsPageContent);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/index.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/index.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _pageLayout__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../pageLayout */ "./app/views/performance/transactionSummary/pageLayout.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionTags/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function TransactionTags(props) {
  const {
    location,
    organization,
    projects
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_pageLayout__WEBPACK_IMPORTED_MODULE_6__["default"], {
    location: location,
    organization: organization,
    projects: projects,
    tab: _tabs__WEBPACK_IMPORTED_MODULE_7__["default"].Tags,
    getDocumentTitle: getDocumentTitle,
    generateEventView: generateEventView,
    childComponent: _content__WEBPACK_IMPORTED_MODULE_8__["default"]
  });
}

TransactionTags.displayName = "TransactionTags";

function getDocumentTitle(transactionName) {
  const hasTransactionName = typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Tags')].join(' \u2014 ');
  }

  return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Summary'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Tags')].join(' \u2014 ');
}

function generateEventView(_ref) {
  let {
    location,
    transactionName
  } = _ref;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_3__.MutableSearch(query);
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_1__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: transactionName,
    fields: ['transaction.duration'],
    query: conditions.formatString(),
    projects: []
  }, location);
  return eventView;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_5__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])(TransactionTags)));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/tagValueTable.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/tagValueTable.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TagValueTable": () => (/* binding */ TagValueTable),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_icons_iconAdd__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons/iconAdd */ "./app/icons/iconAdd.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var _transactionOverview_tagExplorer__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../transactionOverview/tagExplorer */ "./app/views/performance/transactionSummary/transactionOverview/tagExplorer.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _tagsDisplay__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./tagsDisplay */ "./app/views/performance/transactionSummary/transactionTags/tagsDisplay.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























const TAGS_CURSOR_NAME = 'tags_cursor';
class TagValueTable extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      widths: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderHeadCellWithMeta", (sortedEventView, tableMeta, columns) => {
      return (column, index) => this.renderHeadCell(sortedEventView, tableMeta, column, columns[index]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTagValueClick", (location, tagKey, tagValue) => {
      const queryString = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__.decodeScalar)(location.query.query);
      const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch(queryString !== null && queryString !== void 0 ? queryString : '');
      conditions.addFilterValues(tagKey, [tagValue]);
      const query = conditions.formatString();
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          query: String(query).trim()
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCellAction", (column, tagValue, actionRow) => {
      return action => {
        const {
          eventView,
          location,
          organization
        } = this.props;
        (0,_utils__WEBPACK_IMPORTED_MODULE_22__.trackTagPageInteraction)(organization);
        const searchConditions = (0,_utils__WEBPACK_IMPORTED_MODULE_20__.normalizeSearchConditions)(eventView.query);
        (0,sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_18__.updateQuery)(searchConditions, action, { ...column,
          name: actionRow.id
        }, tagValue);
        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
          pathname: location.pathname,
          query: { ...location.query,
            [TAGS_CURSOR_NAME]: undefined,
            query: searchConditions.formatString()
          }
        });
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "generateReleaseLocation", release => {
      const {
        organization,
        location
      } = this.props;
      const {
        project
      } = location.query;
      return {
        pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(release)}`,
        query: {
          project
        }
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReleaseLinkClicked", () => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])('performance_views.tags.jump_to_release', {
        organization
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCell", (parentProps, column, dataRow) => {
      const value = dataRow[column.key];
      const {
        location,
        eventView,
        organization
      } = parentProps;

      if (column.key === 'key') {
        return dataRow.tags_key;
      }

      const allowActions = [sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_18__.Actions.ADD, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_18__.Actions.EXCLUDE];

      if (column.key === 'tagValue') {
        const actionRow = { ...dataRow,
          id: dataRow.tags_key
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_18__["default"], {
          column: column,
          dataRow: actionRow,
          handleCellAction: this.handleCellAction(column, dataRow.tags_value, actionRow),
          allowActions: allowActions,
          children: column.name === 'release' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
            to: this.generateReleaseLocation(dataRow.tags_value),
            onClick: this.handleReleaseLinkClicked,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_transactionOverview_tagExplorer__WEBPACK_IMPORTED_MODULE_19__.TagValue, {
              row: dataRow
            })
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_transactionOverview_tagExplorer__WEBPACK_IMPORTED_MODULE_19__.TagValue, {
            row: dataRow
          })
        });
      }

      if (column.key === 'frequency') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AlignRight, {
          children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_15__.formatPercentage)(dataRow.frequency, 0)
        });
      }

      if (column.key === 'action') {
        const searchConditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch(eventView.query);
        const disabled = searchConditions.hasFilter(dataRow.tags_key);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AlignRight, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
            disabled: disabled,
            to: "",
            onClick: () => {
              (0,_utils__WEBPACK_IMPORTED_MODULE_22__.trackTagPageInteraction)(organization);
              this.handleTagValueClick(location, dataRow.tags_key, dataRow.tags_value);
            },
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(LinkContainer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons_iconAdd__WEBPACK_IMPORTED_MODULE_10__.IconAdd, {
                isCircled: true
              }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Add to filter')]
            })
          })
        });
      }

      if (column.key === 'comparison') {
        const localValue = dataRow.comparison;
        const pct = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_15__.formatPercentage)(localValue - 1, 0);
        return localValue > 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('+%s slower', pct) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('%s faster', pct);
      }

      if (column.key === 'aggregate') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AlignRight, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_9__["default"], {
            abbreviation: true,
            milliseconds: dataRow.aggregate
          })
        });
      }

      if (column.key === 'sumdelta') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AlignRight, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_9__["default"], {
            abbreviation: true,
            milliseconds: dataRow.sumdelta
          })
        });
      }

      if (column.key === 'count') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AlignRight, {
          children: value
        });
      }

      return value;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCellWithData", parentProps => {
      return (column, dataRow) => this.renderBodyCell(parentProps, column, dataRow);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResizeColumn", (columnIndex, nextColumn) => {
      const widths = [...this.state.widths];
      widths[columnIndex] = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__.COL_WIDTH_UNDEFINED;
      this.setState({
        widths
      });
    });
  }

  renderHeadCell(sortedEventView, tableMeta, column, columnInfo) {
    const {
      location
    } = this.props;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_14__.fieldAlignment)(column.key, column.type, tableMeta);
    const field = {
      field: column.key,
      width: column.width
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = sortedEventView.sortOnField(field, tableMeta);
      const {
        sort
      } = nextEventView.generateQueryStringObject();
      return { ...location,
        query: { ...location.query,
          [TAGS_CURSOR_NAME]: undefined,
          tagSort: sort
        }
      };
    }

    const currentSort = sortedEventView.sortForField(field, tableMeta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
      align: align,
      title: columnInfo.name,
      direction: currentSortKind,
      canSort: true,
      generateSortLink: generateSortLink
    });
  }

  render() {
    const {
      eventView,
      tagKey,
      location,
      isLoading,
      tableData,
      aggregateColumn,
      pageLinks,
      onCursor
    } = this.props;
    const newColumns = [..._tagsDisplay__WEBPACK_IMPORTED_MODULE_21__.TAGS_TABLE_COLUMN_ORDER].map(c => {
      const newColumn = { ...c
      };

      if (c.key === 'tagValue' && tagKey) {
        newColumn.name = tagKey;
      }

      if (c.key === 'aggregate') {
        if (aggregateColumn === 'measurements.lcp') {
          newColumn.name = 'Avg LCP';
        }
      }

      return newColumn;
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(StyledPanelTable, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__["default"], {
        isLoading: isLoading,
        data: tableData && tableData.data ? tableData.data : [],
        columnOrder: newColumns,
        columnSortBy: [],
        grid: {
          renderHeadCell: this.renderHeadCellWithMeta(eventView, tableData ? tableData.meta : {}, newColumns),
          renderBodyCell: this.renderBodyCellWithData(this.props),
          onResizeColumn: this.handleResizeColumn
        },
        location: location
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"], {
        pageLinks: pageLinks,
        onCursor: onCursor,
        size: "sm"
      })]
    });
  }

}
TagValueTable.displayName = "TagValueTable";

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gt1k5a2"
} : 0)( true ? {
  name: "122h187",
  styles: ">div{border-top-left-radius:0;border-top-right-radius:0;}"
} : 0);

const AlignRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gt1k5a1"
} : 0)( true ? {
  name: "29h503",
  styles: "text-align:right;flex:1"
} : 0);

const LinkContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gt1k5a0"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";justify-content:flex-end;align-items:center;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagValueTable);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/tagsDisplay.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/tagsDisplay.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TAGS_TABLE_COLUMN_ORDER": () => (/* binding */ TAGS_TABLE_COLUMN_ORDER),
/* harmony export */   "TAG_PAGE_TABLE_CURSOR": () => (/* binding */ TAG_PAGE_TABLE_CURSOR),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/segmentExplorer/segmentExplorerQuery */ "./app/utils/performance/segmentExplorer/segmentExplorerQuery.tsx");
/* harmony import */ var sentry_utils_performance_segmentExplorer_tagKeyHistogramQuery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/segmentExplorer/tagKeyHistogramQuery */ "./app/utils/performance/segmentExplorer/tagKeyHistogramQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _tagsHeatMap__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./tagsHeatMap */ "./app/views/performance/transactionSummary/transactionTags/tagsHeatMap.tsx");
/* harmony import */ var _tagValueTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./tagValueTable */ "./app/views/performance/transactionSummary/transactionTags/tagValueTable.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const HISTOGRAM_TAG_KEY_LIMIT = 8;
const HISTOGRAM_BUCKET_LIMIT = 40;
const TAG_PAGE_TABLE_CURSOR = 'tableCursor';
const TAGS_TABLE_COLUMN_ORDER = [{
  key: 'tagValue',
  field: 'tagValue',
  name: 'Tag Values',
  width: -1,
  column: {
    kind: 'field'
  }
}, {
  key: 'frequency',
  field: 'frequency',
  name: 'Frequency',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'count',
  field: 'count',
  name: 'Events',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'aggregate',
  field: 'aggregate',
  name: 'Avg Duration',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'action',
  field: 'action',
  name: '',
  width: -1,
  column: {
    kind: 'field'
  }
}];

const TagsDisplay = props => {
  var _location$query;

  const {
    eventView: _eventView,
    location,
    organization,
    aggregateColumn,
    tagKey
  } = props;

  const eventView = _eventView.clone();

  const handleCursor = (cursor, pathname, query) => react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
    pathname,
    query: { ...query,
      [TAG_PAGE_TABLE_CURSOR]: cursor
    }
  });

  const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__.decodeScalar)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query[TAG_PAGE_TABLE_CURSOR]);
  const tagSort = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.getTagSortForTagsPage)(location);
  const tagSorts = (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__.fromSorts)(tagSort);
  eventView.fields = TAGS_TABLE_COLUMN_ORDER;
  const sortedEventView = eventView.withSorts(tagSorts.length ? tagSorts : [{
    field: 'frequency',
    kind: 'desc'
  }]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: tagKey ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_segmentExplorer_tagKeyHistogramQuery__WEBPACK_IMPORTED_MODULE_4__["default"], {
        eventView: eventView,
        orgSlug: organization.slug,
        location: location,
        aggregateColumn: aggregateColumn,
        numBucketsPerKey: HISTOGRAM_BUCKET_LIMIT,
        tagKey: tagKey,
        limit: HISTOGRAM_TAG_KEY_LIMIT,
        cursor: cursor,
        sort: tagSort !== null && tagSort !== void 0 ? tagSort : '-sumdelta',
        children: _ref => {
          let {
            isLoading,
            tableData
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_tagsHeatMap__WEBPACK_IMPORTED_MODULE_6__["default"], { ...props,
            tagKey: tagKey,
            aggregateColumn: aggregateColumn,
            tableData: tableData,
            isLoading: isLoading
          });
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_3__["default"], {
        eventView: sortedEventView,
        orgSlug: organization.slug,
        location: location,
        aggregateColumn: aggregateColumn,
        tagKey: tagKey,
        limit: HISTOGRAM_TAG_KEY_LIMIT,
        cursor: cursor,
        sort: tagSort,
        allTagKeys: true,
        children: _ref2 => {
          let {
            isLoading,
            tableData,
            pageLinks
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_tagValueTable__WEBPACK_IMPORTED_MODULE_7__.TagValueTable, { ...props,
            eventView: sortedEventView,
            tagKey: tagKey,
            aggregateColumn: aggregateColumn,
            pageLinks: pageLinks,
            tableData: tableData,
            isLoading: isLoading,
            onCursor: handleCursor
          });
        }
      })]
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_tagsHeatMap__WEBPACK_IMPORTED_MODULE_6__["default"], { ...props,
        aggregateColumn: aggregateColumn,
        tableData: null,
        isLoading: false
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_tagValueTable__WEBPACK_IMPORTED_MODULE_7__.TagValueTable, { ...props,
        pageLinks: null,
        aggregateColumn: aggregateColumn,
        tableData: null,
        isLoading: false
      })]
    })
  });
};

TagsDisplay.displayName = "TagsDisplay";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagsDisplay);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/tagsHeatMap.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/tagsHeatMap.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/usePopper.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _react_aria_overlays__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @react-aria/overlays */ "../node_modules/@react-aria/overlays/dist/module.js");
/* harmony import */ var _react_stately_overlays__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! @react-stately/overlays */ "../node_modules/@react-stately/overlays/dist/module.js");
/* harmony import */ var _sentry_utils__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @sentry/utils */ "../node_modules/@sentry/utils/esm/string.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_charts_heatMapChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/heatMapChart */ "./app/components/charts/heatMapChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_overlay__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/overlay */ "./app/components/overlay.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_quickTrace_styles__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/quickTrace/styles */ "./app/components/quickTrace/styles.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_segmentExplorer_tagTransactionsQuery__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/performance/segmentExplorer/tagTransactionsQuery */ "./app/utils/performance/segmentExplorer/tagTransactionsQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _transactionEvents_utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../transactionEvents/utils */ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



































const findRowKey = row => {
  return Object.keys(row).find(key => key.includes('histogram'));
};

class VirtualReference {
  constructor(element) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "boundingRect", void 0);

    this.boundingRect = element.getBoundingClientRect();
  }

  getBoundingClientRect() {
    return this.boundingRect;
  }

  get clientWidth() {
    return this.getBoundingClientRect().width;
  }

  get clientHeight() {
    return this.getBoundingClientRect().height;
  }

}

const getPortal = lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default()(() => {
  let portal = document.getElementById('heatmap-portal');

  if (portal) {
    return portal;
  }

  portal = document.createElement('div');
  portal.setAttribute('id', 'heatmap-portal');
  document.body.appendChild(portal);
  return portal;
});

const TagsHeatMap = props => {
  const {
    tableData,
    isLoading,
    organization,
    eventView,
    location,
    tagKey,
    transactionName,
    aggregateColumn
  } = props;
  const chartRef = (0,react__WEBPACK_IMPORTED_MODULE_4__.useRef)(null);
  const [chartElement, setChartElement] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)();
  const [overlayElement, setOverlayElement] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const [overlayArrowElement, setOverlayArrowElement] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const [transactionEventView, setTransactionEventView] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(); // TODO(k-fish): Replace with actual theme colors.

  const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];
  const xValues = new Set();
  const histogramData = tableData && tableData.histogram && tableData.histogram.data && tableData.histogram.data.length ? tableData.histogram.data : undefined;
  const tagData = tableData && tableData.tags && tableData.tags.data ? tableData.tags.data : undefined;
  const rowKey = histogramData && findRowKey(histogramData[0]); // Reverse since e-charts takes the axis labels in the opposite order.

  const columnNames = tagData ? tagData.map(tag => tag.tags_value).reverse() : [];
  let maxCount = 0;

  const _data = rowKey && histogramData ? histogramData.map(row => {
    const rawDuration = row[rowKey];
    const x = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.getPerformanceDuration)(rawDuration);
    const y = row.tags_value;
    xValues.add(x);
    maxCount = Math.max(maxCount, row.count);
    return [x, y, row.count];
  }) : null;

  _data === null || _data === void 0 ? void 0 : _data.sort((a, b) => {
    const i = b[0] === a[0] ? 1 : 0;
    return b[i] - a[i];
  }); // TODO(k-fish): Cleanup options

  const chartOptions = {
    height: 290,
    animation: false,
    colors: purples,
    tooltip: {},
    yAxis: {
      type: 'category',
      data: Array.from(columnNames),
      splitArea: {
        show: true
      },
      axisLabel: {
        formatter: value => (0,_sentry_utils__WEBPACK_IMPORTED_MODULE_30__.truncate)(value, 30)
      }
    },
    xAxis: {
      type: 'category',
      splitArea: {
        show: true
      },
      data: Array.from(xValues),
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_21__.axisLabelFormatter)(value, 'number')
      },
      axisLine: {},
      axisPointer: {
        show: false
      },
      axisTick: {
        show: true,
        interval: 0,
        alignWithLabel: true
      }
    },
    grid: {
      left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3),
      right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3),
      top: '25px',
      // Need to bump top spacing past space(3) so the chart title doesn't overlap.
      bottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(4)
    }
  };
  const visualMaps = [{
    min: 0,
    max: maxCount,
    show: false,
    orient: 'horizontal',
    calculable: true,
    inRange: {
      color: purples
    }
  }];
  const series = [];

  if (_data) {
    series.push({
      seriesName: 'Count',
      dataArray: _data,
      label: {
        show: true,
        formatter: data => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber)(data.value[2])
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }); // TODO(k-fish): Fix heatmap data typing
  }

  const onChartClick = bucket => {
    const htmlEvent = bucket.event.event; // Make a copy of the dims because echarts can remove elements after this click happens.
    // TODO(k-fish): Look at improving this to respond properly to resize events.

    const virtualRef = new VirtualReference(htmlEvent.target);
    setChartElement(virtualRef);
    const newTransactionEventView = eventView.clone();
    newTransactionEventView.fields = [{
      field: aggregateColumn
    }];
    const [_, tagValue] = bucket.value;

    if (histogramBucketInfo && histogramData) {
      const row = histogramData[bucket.dataIndex];
      const currentBucketStart = parseInt(`${row[histogramBucketInfo.histogramField]}`, 10);
      const currentBucketEnd = currentBucketStart + histogramBucketInfo.bucketSize;
      newTransactionEventView.additionalConditions.setFilterValues(aggregateColumn, [`>=${currentBucketStart}`, `<${currentBucketEnd}`]);
    }

    if (tagKey) {
      newTransactionEventView.additionalConditions.setFilterValues(tagKey, [tagValue]);
    }

    setTransactionEventView(newTransactionEventView);
    (0,_utils__WEBPACK_IMPORTED_MODULE_29__.trackTagPageInteraction)(organization);

    if (!overlayState.isOpen) {
      overlayState.open();
    }
  };

  const overlayState = (0,_react_stately_overlays__WEBPACK_IMPORTED_MODULE_31__.useOverlayTriggerState)({});
  const {
    overlayProps
  } = (0,_react_aria_overlays__WEBPACK_IMPORTED_MODULE_32__.useOverlay)({
    isOpen: overlayState.isOpen,
    onClose: overlayState.close,
    isDismissable: true,
    shouldCloseOnBlur: true,
    // Ignore the menu being closed if the echart is being clicked.
    shouldCloseOnInteractOutside: el => {
      var _chartRef$current;

      return !((_chartRef$current = chartRef.current) !== null && _chartRef$current !== void 0 && _chartRef$current.getEchartsInstance().getDom().contains(el));
    }
  }, {
    current: overlayElement !== null && overlayElement !== void 0 ? overlayElement : null
  });
  const {
    styles: popperStyles,
    state: popperState
  } = (0,react_popper__WEBPACK_IMPORTED_MODULE_33__.usePopper)(chartElement, overlayElement, {
    placement: 'bottom',
    strategy: 'absolute',
    modifiers: [{
      name: 'computeStyles',
      options: {
        gpuAcceleration: false
      }
    }, {
      name: 'offset',
      options: {
        offset: [0, 8]
      }
    }, {
      name: 'arrow',
      options: {
        element: overlayArrowElement,
        padding: 4
      }
    }, {
      name: 'preventOverflow',
      enabled: true,
      options: {
        padding: 12,
        altAxis: true
      }
    }]
  });
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_34__.a)();
  const portaledContent = !chartElement || !overlayState.isOpen ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_overlay__WEBPACK_IMPORTED_MODULE_12__.PositionWrapper, {
    ref: setOverlayElement,
    zIndex: theme.zIndex.dropdown,
    style: popperStyles.popper,
    ...overlayProps,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_overlay__WEBPACK_IMPORTED_MODULE_12__.Overlay, {
      arrowProps: {
        ref: setOverlayArrowElement,
        style: popperStyles.arrow,
        placement: popperState === null || popperState === void 0 ? void 0 : popperState.placement
      },
      children: transactionEventView && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_utils_performance_segmentExplorer_tagTransactionsQuery__WEBPACK_IMPORTED_MODULE_24__["default"], {
        query: transactionEventView.getQueryWithAdditionalConditions(),
        location: location,
        eventView: transactionEventView,
        orgSlug: organization.slug,
        limit: 4,
        referrer: "api.performance.tag-page",
        children: _ref => {
          let {
            isLoading: isTransactionsLoading,
            tableData: transactionTableData
          } = _ref;

          if (isTransactionsLoading) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(LoadingContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {
                size: 40,
                hideMessage: true
              })
            });
          }

          const moreEventsTarget = (0,_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_27__.eventsRouteWithQuery)({
            orgSlug: organization.slug,
            transaction: transactionName,
            projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__.decodeScalar)(location.query.project),
            query: { ...transactionEventView.generateQueryStringObject(),
              query: transactionEventView.getQueryWithAdditionalConditions()
            }
          });
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)("div", {
            children: [!(transactionTableData !== null && transactionTableData !== void 0 && transactionTableData.data.length) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"], {}) : null, [...(transactionTableData === null || transactionTableData === void 0 ? void 0 : transactionTableData.data)].slice(0, 3).map(row => {
              const target = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.generateTransactionLink)(transactionName)(organization, row, location.query);
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_quickTrace_styles__WEBPACK_IMPORTED_MODULE_17__.DropdownItem, {
                width: "small",
                to: target,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)(DropdownItemContainer, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_18__["default"], {
                    value: row.id,
                    maxLength: 12
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_quickTrace_styles__WEBPACK_IMPORTED_MODULE_17__.SectionSubtext, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_14__["default"], {
                      milliseconds: row[aggregateColumn],
                      abbreviation: true
                    })
                  })]
                })
              }, row.id);
            }), moreEventsTarget && transactionTableData && transactionTableData.data.length > 3 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_quickTrace_styles__WEBPACK_IMPORTED_MODULE_17__.DropdownItem, {
              width: "small",
              to: moreEventsTarget,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(DropdownItemContainer, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('View all events')
              })
            }) : null]
          });
        }
      })
    })
  });
  const histogramBucketInfo = histogramData && (0,_utils__WEBPACK_IMPORTED_MODULE_29__.parseHistogramBucketInfo)(histogramData[0]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)(StyledPanel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)(StyledHeaderTitleLegend, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Heat Map'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
        size: "sm",
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('This heatmap shows the frequency for each duration across the most common tag values')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
      loading: isLoading,
      reloading: isLoading,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
        visible: isLoading
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [/*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_5__.createPortal)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)("div", {
          children: portaledContent
        }), getPortal()), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_23__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_charts_heatMapChart__WEBPACK_IMPORTED_MODULE_7__["default"], {
            ref: chartRef,
            visualMaps: visualMaps,
            series: series,
            onClick: onChartClick,
            ...chartOptions
          }),
          fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_35__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"], {
            height: "290px",
            testId: "skeleton-ui"
          })
        })]
      })]
    })]
  });
};

TagsHeatMap.displayName = "TagsHeatMap";

const LoadingContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eoy5kj73"
} : 0)( true ? {
  name: "kxllrv",
  styles: "width:200px;height:100px;display:flex;align-items:center;justify-content:center"
} : 0);

const DropdownItemContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eoy5kj72"
} : 0)( true ? {
  name: "17wn5yb",
  styles: "width:100%;display:flex;flex-direction:row;justify-content:space-between"
} : 0);

const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel,  true ? {
  target: "eoy5kj71"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";margin-bottom:0;border-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;" + ( true ? "" : 0));

const StyledHeaderTitleLegend = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.HeaderTitleLegend,  true ? {
  target: "eoy5kj70"
} : 0)( true ? "" : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagsHeatMap);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/types.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/types.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "XAxisOption": () => (/* binding */ XAxisOption)
/* harmony export */ });
let XAxisOption;

(function (XAxisOption) {
  XAxisOption["DURATION"] = "transaction.duration";
  XAxisOption["LCP"] = "measurements.lcp";
})(XAxisOption || (XAxisOption = {}));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionSummary_transactionTags_index_tsx.a2c03a042141860dfd47a3265e6d4af5.js.map