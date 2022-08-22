"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_landing_widgets_components_performanceWidget_tsx"],{

/***/ "./app/utils/performance/contexts/metricsEnhancedPerformanceDataContext.tsx":
/*!**********************************************************************************!*\
  !*** ./app/utils/performance/contexts/metricsEnhancedPerformanceDataContext.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MEPDataProvider": () => (/* binding */ MEPDataProvider),
/* harmony export */   "MEPTag": () => (/* binding */ MEPTag),
/* harmony export */   "useMEPDataContext": () => (/* binding */ useMEPDataContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_views_performance_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/landing/widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const [_MEPDataProvider, _useMEPDataContext] = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createDefinedContext)({
  name: 'MetricsEnhancedPerformanceDataContext'
});
const MEPDataProvider = _ref => {
  let {
    children,
    chartSetting
  } = _ref;
  const {
    setAutoSampleState
  } = (0,_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.useMEPSettingContext)();
  const [isMetricsData, _setIsMetricsData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(undefined); // Uses undefined to cover 'not initialized'

  const setIsMetricsData = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(value => {
    if (sentry_views_performance_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_5__.WIDGET_MAP_DENY_LIST.includes(chartSetting)) {
      // Certain widgets shouldn't update their sampled tags or have the page info change eg. Auto(...)
      return;
    }

    if (value === true) {
      setAutoSampleState(_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.AutoSampleState.metrics);
    } else if (value === false) {
      setAutoSampleState(_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.AutoSampleState.transactions);
    }

    _setIsMetricsData(value);
  }, [setAutoSampleState, _setIsMetricsData, chartSetting]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_MEPDataProvider, {
    value: {
      isMetricsData,
      setIsMetricsData
    },
    children: children
  });
};
MEPDataProvider.displayName = "MEPDataProvider";
const useMEPDataContext = _useMEPDataContext;
const MEPTag = () => {
  const {
    isMetricsData
  } = useMEPDataContext();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();

  if (!organization.features.includes('performance-use-metrics')) {
    // Separate if for easier flag deletion
    return null;
  }

  if (isMetricsData === undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("span", {
      "data-test-id": "no-metrics-data-tag"
    });
  }

  const tagText = isMetricsData ? 'processed' : 'indexed';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_3__["default"], {
    "data-test-id": "has-metrics-data-tag",
    children: tagText
  });
};
MEPTag.displayName = "MEPTag";

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/dataStateSwitch.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/dataStateSwitch.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DataStateSwitch": () => (/* binding */ DataStateSwitch)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function DataStateSwitch(props) {
  if (props.isErrored) {
    return props.errorComponent;
  }

  if (props.isLoading && props.loadingComponent) {
    return props.loadingComponent;
  }

  if (!props.hasData) {
    return props.emptyComponent;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: props.dataComponents
  });
}
DataStateSwitch.displayName = "DataStateSwitch";

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/performanceWidget.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/performanceWidget.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DataDisplay": () => (/* binding */ DataDisplay),
/* harmony export */   "GenericPerformanceWidget": () => (/* binding */ GenericPerformanceWidget)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconWarning */ "./app/icons/iconWarning.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext */ "./app/utils/performance/contexts/metricsEnhancedPerformanceDataContext.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_performance_landing_widgets_components_performanceWidgetContainer__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/performance/landing/widgets/components/performanceWidgetContainer */ "./app/views/performance/landing/widgets/components/performanceWidgetContainer.tsx");
/* harmony import */ var _dataStateSwitch__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./dataStateSwitch */ "./app/views/performance/landing/widgets/components/dataStateSwitch.tsx");
/* harmony import */ var _queryHandler__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./queryHandler */ "./app/views/performance/landing/widgets/components/queryHandler.tsx");
/* harmony import */ var _widgetHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./widgetHeader */ "./app/views/performance/landing/widgets/components/widgetHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports













 // Generic performance widget for type T, where T defines all the data contained in the widget.



function GenericPerformanceWidget(props) {
  var _allWidgetData$props$;

  // Use object keyed to chart setting so switching between charts of a similar type doesn't retain data with query components still having inflight requests.
  const [allWidgetData, setWidgetData] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({});
  const widgetData = (_allWidgetData$props$ = allWidgetData[props.chartSetting]) !== null && _allWidgetData$props$ !== void 0 ? _allWidgetData$props$ : {};
  const widgetDataRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(widgetData);
  const setWidgetDataForKey = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)((dataKey, result) => {
    const _widgetData = widgetDataRef.current;
    const newWidgetData = { ..._widgetData,
      [dataKey]: result
    };
    widgetDataRef.current = newWidgetData;
    setWidgetData({
      [props.chartSetting]: newWidgetData
    });
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [allWidgetData, setWidgetData]);
  const removeWidgetDataForKey = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(dataKey => {
    const _widgetData = widgetDataRef.current;
    const newWidgetData = { ..._widgetData
    };
    delete newWidgetData[dataKey];
    widgetDataRef.current = newWidgetData;
    setWidgetData({
      [props.chartSetting]: newWidgetData
    });
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [allWidgetData, setWidgetData]);
  const widgetProps = {
    widgetData,
    setWidgetDataForKey,
    removeWidgetDataForKey
  };
  const queries = Object.entries(props.Queries).map(_ref => {
    let [key, definition] = _ref;
    return { ...definition,
      queryKey: key
    };
  });
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const totalHeight = props.Visualizations.reduce((acc, curr) => acc + curr.height, 0);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_10__.MEPDataProvider, {
      chartSetting: props.chartSetting,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_queryHandler__WEBPACK_IMPORTED_MODULE_14__.QueryHandler, {
        eventView: props.eventView,
        widgetData: widgetData,
        setWidgetDataForKey: setWidgetDataForKey,
        removeWidgetDataForKey: removeWidgetDataForKey,
        queryProps: props,
        queries: queries,
        api: api
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_DataDisplay, { ...props,
        ...widgetProps,
        totalHeight: totalHeight
      })]
    })
  });
}
GenericPerformanceWidget.displayName = "GenericPerformanceWidget";

function trackDataComponentClicks(chartSetting, organization) {
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('performance_views.landingv3.widget.interaction', {
    organization,
    widget_type: chartSetting
  });
}

function _DataDisplay(props) {
  const {
    Visualizations,
    chartHeight,
    totalHeight,
    containerType,
    EmptyComponent
  } = props;
  const Container = (0,sentry_views_performance_landing_widgets_components_performanceWidgetContainer__WEBPACK_IMPORTED_MODULE_12__["default"])({
    containerType
  });
  const numberKeys = Object.keys(props.Queries).length;
  const missingDataKeys = Object.values(props.widgetData).length !== numberKeys;
  const hasData = !missingDataKeys && Object.values(props.widgetData).every(d => !d || d.hasData);
  const isLoading = Object.values(props.widgetData).some(d => !d || d.isLoading);
  const isErrored = !missingDataKeys && Object.values(props.widgetData).some(d => d && d.isErrored);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Container, {
    "data-test-id": "performance-widget-container",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ContentContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_widgetHeader__WEBPACK_IMPORTED_MODULE_15__.WidgetHeader, { ...props
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_dataStateSwitch__WEBPACK_IMPORTED_MODULE_13__.DataStateSwitch, {
      isLoading: isLoading,
      isErrored: isErrored,
      hasData: hasData,
      errorComponent: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DefaultErrorComponent, {
        height: totalHeight
      }),
      dataComponents: Visualizations.map((Visualization, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ContentContainer, {
        noPadding: Visualization.noPadding,
        bottomPadding: Visualization.bottomPadding,
        "data-test-id": "widget-state-has-data",
        onClick: () => trackDataComponentClicks(props.chartSetting, props.organization),
        children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_9__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Visualization.component, {
            grid: defaultGrid,
            queryFields: Visualization.fields,
            widgetData: props.widgetData,
            height: chartHeight
          }),
          fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"], {
            height: `${chartHeight}px`
          })
        })
      }, index)),
      loadingComponent: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(PerformanceWidgetPlaceholder, {
        height: `${totalHeight}px`
      }),
      emptyComponent: EmptyComponent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(EmptyComponent, {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(PerformanceWidgetPlaceholder, {
        height: `${totalHeight}px`
      })
    })]
  });
}

_DataDisplay.displayName = "_DataDisplay";
const DataDisplay = (0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(_DataDisplay);

const DefaultErrorComponent = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
    "data-test-id": "widget-state-is-errored",
    height: `${props.height}px`,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_6__.IconWarning, {
      color: "gray300",
      size: "lg"
    })
  });
};

DefaultErrorComponent.displayName = "DefaultErrorComponent";
const defaultGrid = {
  left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0),
  right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0),
  top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2),
  bottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1)
};

const ContentContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqcpc8s1"
} : 0)("padding-left:", p => p.noPadding ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0) : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";padding-right:", p => p.noPadding ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0) : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";padding-bottom:", p => p.bottomPadding ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1) : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0), ";" + ( true ? "" : 0));

const PerformanceWidgetPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eqcpc8s0"
} : 0)( true ? {
  name: "cs3onb",
  styles: "border-color:transparent;border-bottom-right-radius:inherit;border-bottom-left-radius:inherit"
} : 0);

GenericPerformanceWidget.defaultProps = {
  containerType: 'panel',
  chartHeight: 200
};

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/performanceWidgetContainer.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/performanceWidgetContainer.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");




const StyledPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel,  true ? {
  target: "e1evmidq1"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";margin-bottom:0;" + ( true ? "" : 0));

const Div = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1evmidq0"
} : 0)( true ? "" : 0);

const getPerformanceWidgetContainer = _ref => {
  let {
    containerType
  } = _ref;

  if (containerType === 'panel') {
    return StyledPanel;
  }

  if (containerType === 'inline') {
    return Div;
  }

  return Div;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (getPerformanceWidgetContainer);

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/queryHandler.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/queryHandler.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "QueryHandler": () => (/* binding */ QueryHandler)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext */ "./app/utils/performance/contexts/metricsEnhancedPerformanceDataContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/*
  Component to handle switching component-style queries over to state. This should be temporary to make it easier to switch away from waterfall style api components.
*/
function QueryHandler(props) {
  var _props$children;

  const children = (_props$children = props.children) !== null && _props$children !== void 0 ? _props$children : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {});

  if (!props.queries.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: children
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: props.queries.filter(q => q.enabled ? q.enabled(props.widgetData) : true).map(query => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SingleQueryHandler, { ...props,
      query: query
    }, query.queryKey))
  });
}
QueryHandler.displayName = "QueryHandler";

function genericQueryReferrer(setting) {
  return `api.performance.generic-widget-chart.${setting.replace(/_/g, '-')}`;
}

function SingleQueryHandler(props) {
  const query = props.query;
  const globalSelection = props.queryProps.eventView.getPageFilters();
  const start = globalSelection.datetime.start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcToLocalDateObject)(globalSelection.datetime.start) : null;
  const end = globalSelection.datetime.end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcToLocalDateObject)(globalSelection.datetime.end) : null;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => () => {
    // Destroy previous data on unmount, in case enabled value changes and unmounts the query component.
    props.removeWidgetDataForKey(query.queryKey);
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(query.component, {
    fields: query.fields,
    yAxis: query.fields,
    start: start,
    end: end,
    period: globalSelection.datetime.period,
    project: globalSelection.projects,
    environment: globalSelection.environments,
    organization: props.queryProps.organization,
    orgSlug: props.queryProps.organization.slug,
    eventView: props.queryProps.eventView,
    query: props.queryProps.eventView.getQueryWithAdditionalConditions(),
    widgetData: props.widgetData,
    referrer: genericQueryReferrer(props.queryProps.chartSetting),
    children: results => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(QueryResultSaver, {
          results: results,
          ...props,
          query: query
        })
      });
    }
  }, query.queryKey);
}

SingleQueryHandler.displayName = "SingleQueryHandler";

function QueryResultSaver(props) {
  const mepContext = (0,sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_3__.useMEPDataContext)();
  const {
    results,
    query
  } = props;
  const transformed = query.transform(props.queryProps, results, props.query);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    var _results$seriesAdditi, _results$seriesAdditi2, _results$seriesAdditi3, _results$histograms, _results$histograms$m;

    const isMetricsData = (_results$seriesAdditi = results === null || results === void 0 ? void 0 : (_results$seriesAdditi2 = results.seriesAdditionalInfo) === null || _results$seriesAdditi2 === void 0 ? void 0 : (_results$seriesAdditi3 = _results$seriesAdditi2[props.queryProps.fields[0]]) === null || _results$seriesAdditi3 === void 0 ? void 0 : _results$seriesAdditi3.isMetricsData) !== null && _results$seriesAdditi !== void 0 ? _results$seriesAdditi : results === null || results === void 0 ? void 0 : (_results$histograms = results.histograms) === null || _results$histograms === void 0 ? void 0 : (_results$histograms$m = _results$histograms.meta) === null || _results$histograms$m === void 0 ? void 0 : _results$histograms$m.isMetricsData;
    mepContext.setIsMetricsData(isMetricsData);
    props.setWidgetDataForKey(query.queryKey, transformed);
  }, [transformed === null || transformed === void 0 ? void 0 : transformed.hasData, transformed === null || transformed === void 0 ? void 0 : transformed.isLoading, transformed === null || transformed === void 0 ? void 0 : transformed.isErrored]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {});
}

QueryResultSaver.displayName = "QueryResultSaver";

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/widgetHeader.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/widgetHeader.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetHeader": () => (/* binding */ WidgetHeader)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext */ "./app/utils/performance/contexts/metricsEnhancedPerformanceDataContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function WidgetHeader(props) {
  const {
    title,
    titleTooltip,
    Subtitle,
    HeaderActions
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(WidgetHeaderContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(TitleContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StyledHeaderTitleLegend, {
        "data-test-id": "performance-widget-title",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: title
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_utils_performance_contexts_metricsEnhancedPerformanceDataContext__WEBPACK_IMPORTED_MODULE_5__.MEPTag, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
          position: "top",
          size: "sm",
          title: titleTooltip
        })]
      }), Subtitle ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Subtitle, { ...props
      }) : null]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(HeaderActionsContainer, {
      children: HeaderActions && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(HeaderActions, { ...props
      })
    })]
  });
}
WidgetHeader.displayName = "WidgetHeader";

const StyledHeaderTitleLegend = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.HeaderTitleLegend,  true ? {
  target: "evi51ay3"
} : 0)( true ? {
  name: "ld8wu3",
  styles: "position:relative;z-index:initial"
} : 0);

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evi51ay2"
} : 0)( true ? {
  name: "6kz1wu",
  styles: "display:flex;flex-direction:column;align-items:flex-start"
} : 0);

const WidgetHeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evi51ay1"
} : 0)("display:flex;justify-content:space-between;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const HeaderActionsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evi51ay0"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/landing/widgets/types.tsx":
/*!*********************************************************!*\
  !*** ./app/views/performance/landing/widgets/types.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GenericPerformanceWidgetDataType": () => (/* binding */ GenericPerformanceWidgetDataType),
/* harmony export */   "VisualizationDataState": () => (/* binding */ VisualizationDataState)
/* harmony export */ });
let VisualizationDataState;

(function (VisualizationDataState) {
  VisualizationDataState["ERROR"] = "error";
  VisualizationDataState["LOADING"] = "loading";
  VisualizationDataState["EMPTY"] = "empty";
  VisualizationDataState["DATA"] = "data";
})(VisualizationDataState || (VisualizationDataState = {}));

let GenericPerformanceWidgetDataType;

(function (GenericPerformanceWidgetDataType) {
  GenericPerformanceWidgetDataType["histogram"] = "histogram";
  GenericPerformanceWidgetDataType["area"] = "area";
  GenericPerformanceWidgetDataType["vitals"] = "vitals";
  GenericPerformanceWidgetDataType["line_list"] = "line_list";
  GenericPerformanceWidgetDataType["trends"] = "trends";
})(GenericPerformanceWidgetDataType || (GenericPerformanceWidgetDataType = {}));

/***/ }),

/***/ "./app/views/performance/landing/widgets/utils.tsx":
/*!*********************************************************!*\
  !*** ./app/views/performance/landing/widgets/utils.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WIDGET_MAP_DENY_LIST": () => (/* binding */ WIDGET_MAP_DENY_LIST),
/* harmony export */   "_setChartSetting": () => (/* binding */ _setChartSetting),
/* harmony export */   "eventsRequestQueryProps": () => (/* binding */ eventsRequestQueryProps),
/* harmony export */   "filterAllowedChartsMetrics": () => (/* binding */ filterAllowedChartsMetrics),
/* harmony export */   "getChartSetting": () => (/* binding */ getChartSetting),
/* harmony export */   "getMEPParamsIfApplicable": () => (/* binding */ getMEPParamsIfApplicable),
/* harmony export */   "getMEPQueryParams": () => (/* binding */ getMEPQueryParams),
/* harmony export */   "getMetricOnlyQueryParams": () => (/* binding */ getMetricOnlyQueryParams)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var _widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");





const eventsRequestQueryProps = ['children', 'organization', 'yAxis', 'period', 'start', 'end', 'environment', 'project', 'referrer'];

function setWidgetStorageObject(localObject) {
  sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].setItem(getContainerLocalStorageObjectKey, JSON.stringify(localObject));
}

const mepQueryParamBase = {};
function getMEPQueryParams(mepContext) {
  let queryParams = {};
  const base = mepQueryParamBase;

  if (mepContext.shouldQueryProvideMEPAutoParams) {
    queryParams = { ...queryParams,
      ...base,
      dataset: 'metricsEnhanced'
    };
  }

  if (mepContext.shouldQueryProvideMEPTransactionParams) {
    queryParams = { ...queryParams,
      ...base,
      dataset: 'discover'
    };
  }

  if (mepContext.shouldQueryProvideMEPMetricParams) {
    queryParams = { ...queryParams,
      ...base,
      dataset: 'metrics'
    };
  } // Disallow any performance request from using aggregates since they aren't currently possible in all visualizations and we don't want to mix modes.


  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.objectIsEmpty)(queryParams) ? undefined : queryParams;
}
function getMetricOnlyQueryParams() {
  return { ...mepQueryParamBase,
    dataset: 'metrics'
  };
}
const WIDGET_MAP_DENY_LIST = [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.MOST_RELATED_ERRORS, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.MOST_RELATED_ISSUES];
/**
 * Some widgets, such as Related Issues, are inherently not possible w/ metrics at the moment since they use event.type:error under the hood.
 */

function getMEPParamsIfApplicable(mepContext, widget) {
  if (WIDGET_MAP_DENY_LIST.includes(widget)) {
    return undefined;
  }

  return getMEPQueryParams(mepContext);
}
const getContainerLocalStorageObjectKey = 'landing-chart-container';

const getContainerKey = (index, performanceType, height) => `landing-chart-container#${performanceType}#${height}#${index}`;

function getWidgetStorageObject() {
  const localObject = JSON.parse(sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].getItem(getContainerLocalStorageObjectKey) || '{}');
  return localObject;
}

const getChartSetting = (index, height, performanceType, defaultType, forceDefaultChartSetting) => {
  if (forceDefaultChartSetting) {
    return defaultType;
  }

  const key = getContainerKey(index, performanceType, height);
  const localObject = getWidgetStorageObject();
  const value = localObject === null || localObject === void 0 ? void 0 : localObject[key];

  if (value && Object.values(_widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting).includes(value)) {
    const _value = value;
    return _value;
  }

  return defaultType;
};
const _setChartSetting = (index, height, performanceType, setting) => {
  const key = getContainerKey(index, performanceType, height);
  const localObject = getWidgetStorageObject();
  localObject[key] = setting;
  setWidgetStorageObject(localObject);
};
const DISALLOWED_CHARTS_METRICS = [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.DURATION_HISTOGRAM, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.FCP_HISTOGRAM, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.LCP_HISTOGRAM, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_4__.PerformanceWidgetSetting.FID_HISTOGRAM];
function filterAllowedChartsMetrics(organization, allowedCharts, mepSetting) {
  if (!(0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.canUseMetricsData)(organization) || mepSetting.metricSettingState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.MEPState.transactionsOnly) {
    return allowedCharts;
  }

  return allowedCharts.filter(c => !DISALLOWED_CHARTS_METRICS.includes(c));
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgetDefinitions.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgetDefinitions.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceWidgetSetting": () => (/* binding */ PerformanceWidgetSetting),
/* harmony export */   "WIDGET_DEFINITIONS": () => (/* binding */ WIDGET_DEFINITIONS)
/* harmony export */ });
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../data */ "./app/views/performance/data.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./types */ "./app/views/performance/landing/widgets/types.tsx");




let PerformanceWidgetSetting;

(function (PerformanceWidgetSetting) {
  PerformanceWidgetSetting["DURATION_HISTOGRAM"] = "duration_histogram";
  PerformanceWidgetSetting["LCP_HISTOGRAM"] = "lcp_histogram";
  PerformanceWidgetSetting["FCP_HISTOGRAM"] = "fcp_histogram";
  PerformanceWidgetSetting["FID_HISTOGRAM"] = "fid_histogram";
  PerformanceWidgetSetting["APDEX_AREA"] = "apdex_area";
  PerformanceWidgetSetting["P50_DURATION_AREA"] = "p50_duration_area";
  PerformanceWidgetSetting["P75_DURATION_AREA"] = "p75_duration_area";
  PerformanceWidgetSetting["P95_DURATION_AREA"] = "p95_duration_area";
  PerformanceWidgetSetting["P99_DURATION_AREA"] = "p99_duration_area";
  PerformanceWidgetSetting["P75_LCP_AREA"] = "p75_lcp_area";
  PerformanceWidgetSetting["TPM_AREA"] = "tpm_area";
  PerformanceWidgetSetting["FAILURE_RATE_AREA"] = "failure_rate_area";
  PerformanceWidgetSetting["USER_MISERY_AREA"] = "user_misery_area";
  PerformanceWidgetSetting["WORST_LCP_VITALS"] = "worst_lcp_vitals";
  PerformanceWidgetSetting["WORST_FCP_VITALS"] = "worst_fcp_vitals";
  PerformanceWidgetSetting["WORST_CLS_VITALS"] = "worst_cls_vitals";
  PerformanceWidgetSetting["WORST_FID_VITALS"] = "worst_fid_vitals";
  PerformanceWidgetSetting["MOST_IMPROVED"] = "most_improved";
  PerformanceWidgetSetting["MOST_REGRESSED"] = "most_regressed";
  PerformanceWidgetSetting["MOST_RELATED_ERRORS"] = "most_related_errors";
  PerformanceWidgetSetting["MOST_RELATED_ISSUES"] = "most_related_issues";
  PerformanceWidgetSetting["SLOW_HTTP_OPS"] = "slow_http_ops";
  PerformanceWidgetSetting["SLOW_DB_OPS"] = "slow_db_ops";
  PerformanceWidgetSetting["SLOW_RESOURCE_OPS"] = "slow_resource_ops";
  PerformanceWidgetSetting["SLOW_BROWSER_OPS"] = "slow_browser_ops";
  PerformanceWidgetSetting["COLD_STARTUP_AREA"] = "cold_startup_area";
  PerformanceWidgetSetting["WARM_STARTUP_AREA"] = "warm_startup_area";
  PerformanceWidgetSetting["SLOW_FRAMES_AREA"] = "slow_frames_area";
  PerformanceWidgetSetting["FROZEN_FRAMES_AREA"] = "frozen_frames_area";
  PerformanceWidgetSetting["MOST_SLOW_FRAMES"] = "most_slow_frames";
  PerformanceWidgetSetting["MOST_FROZEN_FRAMES"] = "most_frozen_frames";
})(PerformanceWidgetSetting || (PerformanceWidgetSetting = {}));

const WIDGET_PALETTE = sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][5];
const WIDGET_DEFINITIONS = _ref => {
  let {
    organization
  } = _ref;
  return {
    [PerformanceWidgetSetting.DURATION_HISTOGRAM]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Duration Distribution'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      fields: ['transaction.duration'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.histogram,
      chartColor: WIDGET_PALETTE[5]
    },
    [PerformanceWidgetSetting.LCP_HISTOGRAM]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('LCP Distribution'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      fields: ['measurements.lcp'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.histogram,
      chartColor: WIDGET_PALETTE[5]
    },
    [PerformanceWidgetSetting.FCP_HISTOGRAM]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('FCP Distribution'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      fields: ['measurements.fcp'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.histogram,
      chartColor: WIDGET_PALETTE[5]
    },
    [PerformanceWidgetSetting.FID_HISTOGRAM]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('FID Distribution'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      fields: ['measurements.fid'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.histogram,
      chartColor: WIDGET_PALETTE[5]
    },
    [PerformanceWidgetSetting.WORST_LCP_VITALS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Worst LCP Web Vitals'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.LCP),
      fields: ['measurements.lcp'],
      vitalStops: {
        poor: 4000,
        meh: 2500
      },
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.vitals
    },
    [PerformanceWidgetSetting.WORST_FCP_VITALS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Worst FCP Web Vitals'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.FCP),
      fields: ['measurements.fcp'],
      vitalStops: {
        poor: 3000,
        meh: 1000
      },
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.vitals
    },
    [PerformanceWidgetSetting.WORST_FID_VITALS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Worst FID Web Vitals'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.FID),
      fields: ['measurements.fid'],
      vitalStops: {
        poor: 300,
        meh: 100
      },
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.vitals
    },
    [PerformanceWidgetSetting.WORST_CLS_VITALS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Worst CLS Web Vitals'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.CLS),
      fields: ['measurements.cls'],
      vitalStops: {
        poor: 0.25,
        meh: 0.1
      },
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.vitals
    },
    [PerformanceWidgetSetting.TPM_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Transactions Per Minute'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.TPM),
      fields: ['tpm()'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[1],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.APDEX_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apdex'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.APDEX),
      fields: ['apdex()'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[4],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.P50_DURATION_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p50 Duration'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.P50),
      fields: ['p50(transaction.duration)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[3],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.P75_DURATION_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p75 Duration'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.P75),
      fields: ['p75(transaction.duration)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[3],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.P95_DURATION_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p95 Duration'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.P95),
      fields: ['p95(transaction.duration)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[3],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.P99_DURATION_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p99 Duration'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.P99),
      fields: ['p99(transaction.duration)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[3],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.P75_LCP_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p75 LCP'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.P75),
      fields: ['p75(measurements.lcp)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[1],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.FAILURE_RATE_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Failure Rate'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.FAILURE_RATE),
      fields: ['failure_rate()'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[2],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.USER_MISERY_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('User Misery'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.USER_MISERY),
      fields: [`user_misery()`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[0],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.COLD_STARTUP_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Cold Startup Time'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.APP_START_COLD),
      fields: ['p75(measurements.app_start_cold)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[4],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.WARM_STARTUP_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Warm Startup Time'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.APP_START_WARM),
      fields: ['p75(measurements.app_start_warm)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[3],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.SLOW_FRAMES_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow Frames'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_FRAMES),
      fields: ['p75(measurements.frames_slow_rate)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[0],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.FROZEN_FRAMES_AREA]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Frozen Frames'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.FROZEN_FRAMES),
      fields: ['p75(measurements.frames_frozen_rate)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.area,
      chartColor: WIDGET_PALETTE[5],
      allowsOpenInDiscover: true
    },
    [PerformanceWidgetSetting.MOST_RELATED_ERRORS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Related Errors'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.MOST_ERRORS),
      fields: [`failure_count()`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.MOST_RELATED_ISSUES]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Related Issues'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.MOST_ISSUES),
      fields: [`count()`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.SLOW_HTTP_OPS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow HTTP Ops'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_HTTP_SPANS),
      fields: [`p75(spans.http)`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.SLOW_BROWSER_OPS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow Browser Ops'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_HTTP_SPANS),
      fields: [`p75(spans.browser)`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.SLOW_RESOURCE_OPS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow Resource Ops'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_HTTP_SPANS),
      fields: [`p75(spans.resource)`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.SLOW_DB_OPS]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow DB Ops'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_HTTP_SPANS),
      fields: [`p75(spans.db)`],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.MOST_SLOW_FRAMES]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Slow Frames'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.SLOW_FRAMES),
      fields: ['avg(measurements.frames_slow)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.MOST_FROZEN_FRAMES]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Frozen Frames'),
      titleTooltip: (0,_data__WEBPACK_IMPORTED_MODULE_2__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_2__.PERFORMANCE_TERM.FROZEN_FRAMES),
      fields: ['avg(measurements.frames_frozen)'],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.line_list,
      chartColor: WIDGET_PALETTE[0]
    },
    [PerformanceWidgetSetting.MOST_IMPROVED]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Improved'),
      titleTooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This compares the baseline (%s) of the past with the present.', 'improved'),
      fields: [],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.trends
    },
    [PerformanceWidgetSetting.MOST_REGRESSED]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Most Regressed'),
      titleTooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This compares the baseline (%s) of the past with the present.', 'regressed'),
      fields: [],
      dataType: _types__WEBPACK_IMPORTED_MODULE_3__.GenericPerformanceWidgetDataType.trends
    }
  };
};

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_landing_widgets_components_performanceWidget_tsx.175b9303a23aeebd29d2a1e87a39b3f2.js.map