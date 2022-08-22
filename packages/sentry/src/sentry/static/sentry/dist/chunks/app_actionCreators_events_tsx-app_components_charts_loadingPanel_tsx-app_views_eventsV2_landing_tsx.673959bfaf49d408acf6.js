"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_events_tsx-app_components_charts_loadingPanel_tsx-app_views_eventsV2_landing_tsx"],{

/***/ "./app/actionCreators/events.tsx":
/*!***************************************!*\
  !*** ./app/actionCreators/events.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "doEventsRequest": () => (/* binding */ doEventsRequest),
/* harmony export */   "fetchTagFacets": () => (/* binding */ fetchTagFacets),
/* harmony export */   "fetchTotalCount": () => (/* binding */ fetchTotalCount)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/constants */ "./app/utils/performance/constants.tsx");






/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {Boolean} options.excludeOther Exclude the "Other" series when making a topEvents query
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 * @param {QueryBatching} options.queryBatching A container for batching functions from a provider
 * @param {Record<string, string>} options.queryExtras A list of extra query parameters
 * @param {(org: OrganizationSummary) => string} options.generatePathname A function that returns an override for the pathname
 */
const doEventsRequest = (api, _ref) => {
  var _generatePathname;

  let {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
    queryBatching,
    generatePathname,
    queryExtras,
    excludeOther,
    includeAllArgs
  } = _ref;
  const pathname = (_generatePathname = generatePathname === null || generatePathname === void 0 ? void 0 : generatePathname(organization)) !== null && _generatePathname !== void 0 ? _generatePathname : `/organizations/${organization.slug}/events-stats/`;
  const shouldDoublePeriod = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__.canIncludePreviousPeriod)(includePrevious, period);
  const urlQuery = Object.fromEntries(Object.entries({
    interval,
    comparisonDelta,
    project,
    environment,
    team,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial: partial ? '1' : undefined,
    withoutZerofill: withoutZerofill ? '1' : undefined,
    referrer: referrer ? referrer : 'api.organization-event-stats',
    excludeOther: excludeOther ? '1' : undefined
  }).filter(_ref2 => {
    let [, value] = _ref2;
    return typeof value !== 'undefined';
  })); // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.

  const periodObj = (0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__.getPeriod)({
    period,
    start,
    end
  }, {
    shouldDoublePeriod
  });
  const queryObject = {
    includeAllArgs,
    query: { ...urlQuery,
      ...periodObj,
      ...queryExtras
    }
  };

  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, pathname, queryObject);
  }

  return api.requestPromise(pathname, queryObject);
};

/**
 * Fetches tag facets for a query
 */
function fetchTagFacets(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption
  });
}
/**
 * Fetches total count of events for a given query
 */

function fetchTotalCount(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-meta/`, {
    query: queryOption
  }).then(res => res.count);
}

/***/ }),

/***/ "./app/components/activity/item/avatar.tsx":
/*!*************************************************!*\
  !*** ./app/components/activity/item/avatar.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function ActivityAvatar(_ref) {
  let {
    className,
    type,
    user,
    size = 38
  } = _ref;

  if (user) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
      user: user,
      size: size,
      className: className
    });
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SystemAvatar, {
      className: className,
      size: size,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconSentry, {
        size: "md"
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__["default"], {
    className: className,
    width: `${size}px`,
    height: `${size}px`,
    shape: "circle"
  });
}

ActivityAvatar.displayName = "ActivityAvatar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityAvatar);

const SystemAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ety7k0b1"
} : 0)("display:flex;justify-content:center;align-items:center;width:", p => p.size, "px;height:", p => p.size, "px;background-color:", p => p.theme.textColor, ";color:", p => p.theme.background, ";border-radius:50%;" + ( true ? "" : 0));

const StyledIconSentry = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry,  true ? {
  target: "ety7k0b0"
} : 0)( true ? {
  name: "1p2ly5v",
  styles: "padding-bottom:3px"
} : 0);

/***/ }),

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

/***/ "./app/components/charts/eventsGeoRequest.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/eventsGeoRequest.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");






const EventsGeoRequest = _ref => {
  let {
    api,
    organization,
    yAxis,
    query,
    orderby,
    projects,
    period,
    start,
    end,
    environments,
    referrer,
    children
  } = _ref;
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__["default"].fromSavedQuery({
    id: undefined,
    name: '',
    version: 2,
    fields: Array.isArray(yAxis) ? yAxis : [yAxis],
    query,
    orderby: orderby !== null && orderby !== void 0 ? orderby : '',
    projects,
    range: period !== null && period !== void 0 ? period : '',
    start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(start) : undefined,
    end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(end) : undefined,
    environment: environments
  });
  const [results, setResults] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const [reloading, setReloading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [errored, setErrored] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    let mounted = true;
    setErrored(false);

    if (results) {
      setReloading(true);
    }

    (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_4__.doDiscoverQuery)(api, `/organizations/${organization.slug}/events-geo/`, { ...eventView.generateQueryStringObject(),
      referrer
    }).then(discoverQueryResults => {
      if (mounted) {
        setResults([discoverQueryResults[0]]);
        setReloading(false);
      }
    }).catch(() => {
      if (mounted) {
        setErrored(true);
        setReloading(false);
      }
    });
    return () => {
      // Prevent setState leaking on unmounted component
      mounted = false;
    };
  }, [query, yAxis, start, end, period, environments, projects, api]);
  return children({
    errored,
    loading: !results && !errored,
    reloading,
    tableData: results
  });
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsGeoRequest);

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

/***/ "./app/components/loading/loadingContainer.tsx":
/*!*****************************************************!*\
  !*** ./app/components/loading/loadingContainer.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LoadingContainer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function LoadingContainer(_ref) {
  let {
    isLoading = false,
    isReloading = false,
    maskBackgroundColor = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__["default"].white,
    className,
    children
  } = _ref;
  const isLoadingOrReloading = isLoading || isReloading;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
    className: className,
    children: [isLoadingOrReloading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(LoadingMask, {
        isReloading: isReloading,
        maskBackgroundColor: maskBackgroundColor
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Indicator, {})]
    }), children]
  });
}
LoadingContainer.displayName = "LoadingContainer";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1v826ox2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const LoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1v826ox1"
} : 0)("position:absolute;z-index:1;background-color:", p => p.maskBackgroundColor, ";width:100%;height:100%;opacity:", p => p.isReloading ? '0.6' : '1', ";" + ( true ? "" : 0));

const Indicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1v826ox0"
} : 0)( true ? {
  name: "1aa909c",
  styles: "position:absolute;z-index:3;width:100%"
} : 0);

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

/***/ "./app/utils/discover/genericDiscoverQuery.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/discover/genericDiscoverQuery.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GenericDiscoverQuery": () => (/* binding */ GenericDiscoverQuery),
/* harmony export */   "QueryError": () => (/* binding */ QueryError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "doDiscoverQuery": () => (/* binding */ doDiscoverQuery)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/organizationContext */ "./app/views/organizationContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class QueryError {
  // For debugging in case parseError picks a value that doesn't make sense.
  constructor(errorMessage, originalError) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "message", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "originalError", void 0);

    this.message = errorMessage;
    this.originalError = originalError;
  }

  getOriginalError() {
    return this.originalError;
  }

}

/**
 * Generic component for discover queries
 */
class _GenericDiscoverQuery extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isLoading: true,
      tableFetchID: undefined,
      error: null,
      tableData: null,
      pageLinks: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_shouldRefetchData", prevProps => {
      const thisAPIPayload = this.getPayload(this.props);
      const otherAPIPayload = this.getPayload(prevProps);
      return !(0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__.isAPIPayloadSimilar)(thisAPIPayload, otherAPIPayload) || prevProps.limit !== this.props.limit || prevProps.route !== this.props.route || prevProps.cursor !== this.props.cursor;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_parseError", error => {
      var _error$responseJSON;

      if (this.props.parseError) {
        return this.props.parseError(error);
      }

      if (!error) {
        return null;
      }

      const detail = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail;

      if (typeof detail === 'string') {
        return new QueryError(detail, error);
      }

      const message = detail === null || detail === void 0 ? void 0 : detail.message;

      if (typeof message === 'string') {
        return new QueryError(message, error);
      }

      const unknownError = new QueryError((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('An unknown error occurred.'), error);
      return unknownError;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        queryBatching,
        beforeFetch,
        afterFetch,
        didFetch,
        eventView,
        orgSlug,
        route,
        setError
      } = this.props;

      if (!eventView.isValid()) {
        return;
      }

      const url = `/organizations/${orgSlug}/${route}/`;
      const tableFetchID = Symbol(`tableFetchID`);
      const apiPayload = this.getPayload(this.props);
      this.setState({
        isLoading: true,
        tableFetchID
      });
      setError === null || setError === void 0 ? void 0 : setError(undefined);
      beforeFetch === null || beforeFetch === void 0 ? void 0 : beforeFetch(api); // clear any inflight requests since they are now stale

      api.clear();

      try {
        const [data,, resp] = await doDiscoverQuery(api, url, apiPayload, queryBatching);

        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        const tableData = afterFetch ? afterFetch(data, this.props) : data;
        didFetch === null || didFetch === void 0 ? void 0 : didFetch(tableData);
        this.setState(prevState => {
          var _resp$getResponseHead;

          return {
            isLoading: false,
            tableFetchID: undefined,
            error: null,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : prevState.pageLinks,
            tableData
          };
        });
      } catch (err) {
        const error = this._parseError(err);

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error,
          tableData: null
        });

        if (setError) {
          setError(error !== null && error !== void 0 ? error : undefined);
        }
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    // Reload data if the payload changes
    const refetchCondition = this._shouldRefetchData(prevProps); // or if we've moved from an invalid view state to a valid one,


    const eventViewValidation = prevProps.eventView.isValid() === false && this.props.eventView.isValid();
    const shouldRefetchExternal = this.props.shouldRefetchData ? this.props.shouldRefetchData(prevProps, this.props) : false;

    if (refetchCondition || eventViewValidation || shouldRefetchExternal) {
      this.fetchData();
    }
  }

  getPayload(props) {
    var _props$queryExtras;

    const {
      cursor,
      limit,
      noPagination,
      referrer
    } = props;
    const payload = this.props.getRequestPayload ? this.props.getRequestPayload(props) : props.eventView.getEventsAPIPayload(props.location, props.forceAppendRawQueryString);

    if (cursor) {
      payload.cursor = cursor;
    }

    if (limit) {
      payload.per_page = limit;
    }

    if (noPagination) {
      payload.noPagination = noPagination;
    }

    if (referrer) {
      payload.referrer = referrer;
    }

    Object.assign(payload, (_props$queryExtras = props.queryExtras) !== null && _props$queryExtras !== void 0 ? _props$queryExtras : {});
    return payload;
  }

  render() {
    const {
      isLoading,
      error,
      tableData,
      pageLinks
    } = this.state;
    const childrenProps = {
      isLoading,
      error,
      tableData,
      pageLinks
    };
    const children = this.props.children; // Explicitly setting type due to issues with generics and React's children

    return children === null || children === void 0 ? void 0 : children(childrenProps);
  }

}

_GenericDiscoverQuery.displayName = "_GenericDiscoverQuery";
// Shim to allow us to use generic discover query or any specialization with or without passing org slug or eventview, which are now contexts.
// This will help keep tests working and we can remove extra uses of context-provided props and update tests as we go.
function GenericDiscoverQuery(props) {
  var _useContext, _useContext2, _props$orgSlug, _props$eventView;

  const organizationSlug = (_useContext = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__.OrganizationContext)) === null || _useContext === void 0 ? void 0 : _useContext.slug;
  const performanceEventView = (_useContext2 = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__.PerformanceEventViewContext)) === null || _useContext2 === void 0 ? void 0 : _useContext2.eventView;
  const orgSlug = (_props$orgSlug = props.orgSlug) !== null && _props$orgSlug !== void 0 ? _props$orgSlug : organizationSlug;
  const eventView = (_props$eventView = props.eventView) !== null && _props$eventView !== void 0 ? _props$eventView : performanceEventView;

  if (orgSlug === undefined || eventView === undefined) {
    throw new Error('GenericDiscoverQuery requires both an orgSlug and eventView');
  }

  const _props = { ...props,
    orgSlug,
    eventView
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_GenericDiscoverQuery, { ..._props
  });
}
GenericDiscoverQuery.displayName = "GenericDiscoverQuery";
function doDiscoverQuery(api, url, params, queryBatching) {
  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, url, {
      query: params,
      includeAllArgs: true
    });
  }

  return api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
    query: { // marking params as any so as to not cause typescript errors
      ...params
    }
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GenericDiscoverQuery);

/***/ }),

/***/ "./app/utils/getPeriod.tsx":
/*!*********************************!*\
  !*** ./app/utils/getPeriod.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getPeriod": () => (/* binding */ getPeriod)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");






/**
 * Gets the period to query with if we need to double the initial period in order
 * to get data for the previous period
 *
 * Returns an object with either a period or start/end dates ({statsPeriod: string} or {start: string, end: string})
 */
function getPeriod(_ref) {
  let {
    period,
    start,
    end
  } = _ref;
  let {
    shouldDoublePeriod
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!period && !start && !end) {
    period = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_STATS_PERIOD;
  } // you can not specify both relative and absolute periods
  // relative period takes precedence


  if (period) {
    if (!shouldDoublePeriod) {
      return {
        statsPeriod: period
      };
    }

    const [, periodNumber, periodLength] = period.match(/([0-9]+)([mhdw])/);
    return {
      statsPeriod: `${parseInt(periodNumber, 10) * 2}${periodLength}`
    };
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  const formattedStart = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(start);
  const formattedEnd = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(end);

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment__WEBPACK_IMPORTED_MODULE_2___default()(end).diff(moment__WEBPACK_IMPORTED_MODULE_2___default()(start));
    const previousPeriodStart = moment__WEBPACK_IMPORTED_MODULE_2___default()(start).subtract(diff); // This is not as accurate as having 2 start/end objs

    return {
      start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(previousPeriodStart),
      end: formattedEnd
    };
  }

  return {
    start: formattedStart,
    end: formattedEnd
  };
}

/***/ }),

/***/ "./app/utils/performance/contexts/performanceEventViewContext.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/contexts/performanceEventViewContext.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceEventViewContext": () => (/* binding */ PerformanceEventViewContext),
/* harmony export */   "PerformanceEventViewProvider": () => (/* binding */ PerformanceEventViewProvider),
/* harmony export */   "useMutablePerformanceEventView": () => (/* binding */ useMutablePerformanceEventView),
/* harmony export */   "usePerformanceEventView": () => (/* binding */ usePerformanceEventView)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");


const [PerformanceEventViewProvider, _usePerformanceEventView, PerformanceEventViewContext] = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.createDefinedContext)({
  name: 'PerformanceEventViewContext'
});
 // Provides a readonly event view. Also omits anything that isn't currently read-only, although in the future we should switch the code in EventView instead.
// If you need mutability, use the mutable version.

function usePerformanceEventView() {
  return _usePerformanceEventView().eventView;
}
function useMutablePerformanceEventView() {
  return usePerformanceEventView().clone();
}

/***/ }),

/***/ "./app/utils/performance/contexts/utils.tsx":
/*!**************************************************!*\
  !*** ./app/utils/performance/contexts/utils.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createDefinedContext": () => (/* binding */ createDefinedContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");



/*
 * Creates provider, context and useContext hook, guarding against calling useContext without a provider.
 * [0]: https://github.com/chakra-ui/chakra-ui/blob/c0f9c287df0397e2aa9bd90eb3d5c2f2c08aa0b1/packages/utils/src/react-helpers.ts#L27
 *
 * Renamed to createDefinedContext to not conflate with React context.
 */
function createDefinedContext(options) {
  const {
    strict = true,
    errorMessage = `useContext for "${options.name}" must be inside a Provider with a value`,
    name
  } = options;
  const Context = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);
  Context.displayName = name;

  function useDefinedContext() {
    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(Context);

    if (!context && strict) {
      throw new Error(errorMessage);
    }

    return context;
  }

  return [Context.Provider, useDefinedContext, Context];
}

/***/ }),

/***/ "./app/views/eventsV2/backgroundSpace.tsx":
/*!************************************************!*\
  !*** ./app/views/eventsV2/backgroundSpace.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ BackgroundSpace)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const twinkles = _emotion_react__WEBPACK_IMPORTED_MODULE_1__.keyframes`
  0% {opacity: 1;}
  50% {opacity: 0;}
  100% {opacity: 1;}
`;
const hover = _emotion_react__WEBPACK_IMPORTED_MODULE_1__.keyframes`
  0% {transform: translateY(0) translateX(0);}
  25% {transform: translateY(4px) translateX(-4px);}
  50% {transform: translateY(0) translateX(0);}
  75% {transform: translateY(4px) translateX(-4px);}
  100% {transform: translateY(0) translate(0);}
`;

const Twinkles = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('path',  true ? {
  target: "e1x941mb2"
} : 0)("fill:#d35bab;animation:", twinkles, " 2s infinite;" + ( true ? "" : 0));

const TwinklesDelay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('path',  true ? {
  target: "e1x941mb1"
} : 0)("animation:", twinkles, " 2s infinite;animation-delay:1s;fill:#ce5d9e;" + ( true ? "" : 0));

const Planet = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('g',  true ? {
  target: "e1x941mb0"
} : 0)("animation:", hover, " 10s infinite;" + ( true ? "" : 0));

function BackgroundSpace() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    xmlnsXlink: "http://www.w3.org/1999/xlink",
    viewBox: "0 0 1160.08 280.01",
    preserveAspectRatio: "xMinYMin slice",
    height: "100%",
    width: "100%",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("defs", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("linearGradient", {
        id: "linear-gradient",
        x1: "580",
        y1: "-163.62",
        x2: "580",
        y2: "289.19",
        gradientUnits: "userSpaceOnUse",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.19",
          stopColor: "#7a2878"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.41",
          stopColor: "#612765"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.56",
          stopColor: "#54275c"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("linearGradient", {
        id: "linear-gradient-2",
        x1: "438.93",
        y1: "-375.6",
        x2: "619.69",
        y2: "374.54",
        gradientUnits: "userSpaceOnUse",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.2",
          stopColor: "#8b3087"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.76",
          stopColor: "#aa4689"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "1",
          stopColor: "#a33f79"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("linearGradient", {
        id: "linear-gradient-3",
        x1: "114.15",
        y1: "-573.81",
        x2: "340.44",
        y2: "365.28",
        xlinkHref: "#linear-gradient-2"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("linearGradient", {
        id: "linear-gradient-4",
        x1: "1494.33",
        y1: "259.61",
        x2: "1494.83",
        y2: "259.61",
        gradientUnits: "userSpaceOnUse",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.2",
          stopColor: "#ff6668"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.72",
          stopColor: "#b44968"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("linearGradient", {
        id: "linear-gradient-5",
        x1: "536.86",
        y1: "213.35",
        x2: "534.35",
        y2: "381.73",
        xlinkHref: "#linear-gradient-4"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("radialGradient", {
        id: "radial-gradient",
        cx: "134.5",
        cy: "307.77",
        fx: "98.57685568341846",
        fy: "320.2801558841244",
        r: "380.71",
        gradientTransform: "matrix(0.88, 0.47, -0.33, 0.61, 117.41, 55.32)",
        gradientUnits: "userSpaceOnUse",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.2",
          stopColor: "#ff7d7f",
          stopOpacity: "0"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.28",
          stopColor: "#ff7d7f",
          stopOpacity: "0.02"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.38",
          stopColor: "#ff7d7f",
          stopOpacity: "0.08"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.49",
          stopColor: "#ff7d7f",
          stopOpacity: "0.19"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.61",
          stopColor: "#ff7d7f",
          stopOpacity: "0.33"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.73",
          stopColor: "#ff7d7f",
          stopOpacity: "0.51"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "0.87",
          stopColor: "#ff7d7f",
          stopOpacity: "0.74"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("stop", {
          offset: "1",
          stopColor: "#ff7d7f"
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("g", {
      id: "background",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("rect", {
        fill: "url(#linear-gradient)",
        width: "1160",
        height: "280"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("g", {
      id: "streaks",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#662665",
          d: "M448.36,280c-4.4-31.92-8.18-68.42-8.77-102.41-1.12-64.44.22-121.22,45.16-177.59H422c-22.16,26.8-35.31,46.33-35.31,46.33S391.52,26.59,403.26,0H378.89a279,279,0,0,0-11.77,49.37C357.57,115.58,373,215.74,385.47,280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#662665",
          d: "M722.56,137.09c-34.63,39.36-58.79,90.55-58.79,90.55l-12.16-13.52s27.36-62,80.07-96.63S853.82,70.87,853.82,70.87,757.19,97.73,722.56,137.09ZM690.63,280c7.71-43.77,25.77-103.7,68.08-144.26,73.82-70.78,163-64.87,236.84-69.43,58.57-3.62,135.31-11.92,164.53-15.19V0h-102.8A1046.22,1046.22,0,0,1,944.37,21C853.82,33,743.84,63.27,710.56,87.42c0,0,79.91-60.47,147.82-72.47S1004.5,6,1036.26,1.44q4.88-.7,9.44-1.44H872.77c-78.13,11.4-130.26,42.76-189.4,93.34C616.45,150.56,588,263.49,584.16,280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
            fill: "url(#linear-gradient-2)",
            d: "M210.14,0c1.4,18.35,15.06,27.51,23.7,28.47,9.12,1,9.8-5.92,5.58-10.14-3-3-10.8-6.23-14.69-18.33ZM164.88,0a66.31,66.31,0,0,0,10.85,39.11S149.33,23.48,144.78,0H45.53a182.28,182.28,0,0,0,2,61.75c9,44.59,49,92.74,49,92.74l-37.67,6.08s-26.36-52-29.4-104.06c-1.24-21.3,3-40.85,8.34-56.51H0V280H1160V235.51c-31.07-3.31-115.41-12.26-150.09-15.81C967,215.31,908,206.18,908,206.18s78.05-13.51,146-11.32c42.37,1.37,82.1,4.59,106,6.81l.08-61.67c-19.59,4.72-77.35,18.33-143.41,31.05C935.07,186.76,778,210.74,650.09,179s-157.28-52-157.28-52C428.28,99.76,387.57,93,305.13,84.05S193,37.59,188.57,3.63c-.16-1.21-.26-2.43-.3-3.63ZM408,121.38c-34-9.12-89-26.52-89-26.52s65,6.75,98.15,15.88,91.22,34,91.22,34S442,130.5,408,121.38Z"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
            fill: "url(#linear-gradient-3)",
            d: "M251.92,34.72s-6.42,6.92,2.7,13.68S274.38,59,277.26,55.67s-2.88-4.57-8.45-11.32S258.17,30.66,251.92,34.72Z"
          })]
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(Planet, {
      id: "planet",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "url(#linear-gradient-4)",
          d: "M578.57,280c17-12.64,20.48-23.05,9.35-31.25-12.84-9.46-51.69-10.47-77.71-8.95-10.63.62-30.38,3.21-48.62,5.82l15,12.26s46.8-9.8,78.56-6.76,18.07,14.36-.85,24.83c-2.4,1.33-4.82,2.69-7.2,4.05Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "url(#linear-gradient-5)",
          d: "M644.87,280l1.5-1.85c18.08-22,23.65-45.78-39.87-62.34C516.1,192.25,417.13,208,417.13,208l-2.36-.67L433.89,223c19.47-3.8,54.48-8.82,93.22-5.83,58.95,4.56,82.18,25.68,86.83,40.38,2.6,8.23-1.23,15.63-7.58,22.46Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#ff9371",
          d: "M644.87,280l1.5-1.85c18.08-22,23.65-45.78-39.87-62.34-40.85-10.65-83.46-13.26-117.89-12.92l-41.86,1.88-2.51.21c20.12-.33,115.29-1,164.37,15.14,55.08,18.08,46.12,39.19,37,50.51-2,2.45-4.72,5.69-7.65,9.37Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#ff9371",
          d: "M576.52,218.6s39.7,10.14,54.39,22.64,3.38,23.82,3.38,23.82,19.26-14.7,3.38-26S576.52,218.6,576.52,218.6Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#ff9371",
          d: "M578.57,280c17-12.64,20.48-23.05,9.35-31.25-12.84-9.46-51.69-10.47-77.71-8.95-8.71.51-23.53,2.34-38.63,4.42,9.12-.58,80.16-4.84,97.85.06,18.91,5.23,20.05,9.61,18.91,18.07-1,7.21-7.14,13.81-11.5,17.65Z"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#582163",
          d: "M509.8,280c-120.75-123.12-289-199.5-475-199.5q-17.49,0-34.76.89V280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#6b2775",
          d: "M44.2,280,280.72,127.44A661,661,0,0,0,110.17,84.73C83.15,106.24,28.11,150.16,0,173.38V280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#6b2775",
          d: "M483.75,280l17.43-8.63a670.42,670.42,0,0,0-69.4-59.48L312,280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "#ff7d7f",
          d: "M509.8,280c-120.75-123.12-289-199.5-475-199.5q-17.49,0-34.76.89v4.29C179.75,74.76,363.75,157,494.5,280Z"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
          fill: "url(#radial-gradient)",
          d: "M509.8,280c-120.74-123.12-289-199.5-475-199.5q-17.49,0-34.76.89V280Z"
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
      id: "stars-static",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M1121.59,268.29c1.28,1.1,4.29,1.4,4.29,1.4s-2.85,0-4.29,1.39c-1.25,1.25-1.4,4.3-1.4,4.3s-.14-3-1.4-4.3c-1-1-4.29-1.39-4.29-1.39s3-.25,4.29-1.4,1.4-4.3,1.4-4.3S1120.14,267.05,1121.59,268.29Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M104.51,15.9C106.46,17.56,111,18,111,18s-4.33-.06-6.51,2.12c-1.89,1.88-2.12,6.51-2.12,6.51s-.21-4.57-2.12-6.51C98.73,18.57,93.76,18,93.76,18s4.59-.38,6.51-2.12c1.71-1.56,2.12-6.51,2.12-6.51S102.31,14,104.51,15.9Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M196.69,68.5c2.53,2.16,8.44,2.75,8.44,2.75s-5.61-.08-8.44,2.74c-2.45,2.45-2.74,8.44-2.74,8.44s-.27-5.92-2.75-8.44c-2-2-8.43-2.74-8.43-2.74s5.95-.49,8.43-2.75c2.22-2,2.75-8.43,2.75-8.43S193.85,66.07,196.69,68.5Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M473,188.45c1.31,1.12,4.38,1.43,4.38,1.43s-2.91,0-4.38,1.43c-1.27,1.27-1.43,4.38-1.43,4.38s-.14-3.07-1.42-4.38c-1-1.06-4.39-1.43-4.39-1.43s3.1-.25,4.39-1.43,1.42-4.38,1.42-4.38S471.53,187.19,473,188.45Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#ce5d9e",
        d: "M693.5,263.34c2.77,2.37,9.28,3,9.28,3s-6.18-.08-9.28,3c-2.7,2.69-3,9.28-3,9.28s-.3-6.5-3-9.28c-2.19-2.24-9.28-3-9.28-3s6.55-.53,9.28-3c2.44-2.23,3-9.28,3-9.28S690.37,260.67,693.5,263.34Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#ce5d9e",
        d: "M752.05,219.29c3.48,3,11.63,3.79,11.63,3.79s-7.73-.11-11.63,3.78c-3.38,3.38-3.78,11.64-3.78,11.64s-.38-8.16-3.79-11.64c-2.75-2.8-11.63-3.78-11.63-3.78s8.21-.67,11.63-3.79c3.06-2.79,3.79-11.63,3.79-11.63S748.13,215.94,752.05,219.29Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#ce5d9e",
        d: "M834.09,219.21c1.85,1.58,6.17,2,6.17,2s-4.1-.06-6.17,2c-1.79,1.79-2,6.17-2,6.17s-.2-4.33-2-6.17c-1.45-1.49-6.17-2-6.17-2s4.36-.35,6.17-2c1.63-1.48,2-6.17,2-6.17S832,217.43,834.09,219.21Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M1136.67,159.66c1.81,1.55,6,2,6,2s-4-.06-6,2c-1.75,1.75-2,11.15-2,11.15s-.19-9.35-2-11.15c-1.43-1.45-6-2-6-2s4.25-.35,6-2c1.58-1.44,2-12.06,2-12.06S1134.64,157.93,1136.67,159.66Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M482.41,157.12c1.94,1.67,6.51,2.12,6.51,2.12s-4.33-.06-6.51,2.12c-1.89,1.89-2.12,6.51-2.12,6.51s-.21-4.56-2.12-6.51c-1.54-1.57-6.51-2.12-6.51-2.12s4.59-.37,6.51-2.12c1.71-1.56,2.12-6.51,2.12-6.51S480.21,155.25,482.41,157.12Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fill: "#d35bab",
        d: "M24.94,36.75c2.84,2.42,9.48,3.08,9.48,3.08s-6.3-.09-9.48,3.09c-2.75,2.75-3.08,17.51-3.08,17.51s-.31-14.68-3.08-17.51c-2.24-2.29-9.48-3.09-9.48-3.09s6.69-.54,9.48-3.08c2.49-2.28,3.08-19,3.08-19S21.75,34,24.94,36.75Z"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("g", {
      id: "stars-twinkle",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Twinkles, {
        d: "M300.17,85.94c3.37,2.89,11.28,3.67,11.28,3.67s-7.5-.1-11.28,3.67c-3.28,3.28-3.67,20.85-3.67,20.85s-.37-17.47-3.67-20.85c-2.67-2.71-11.29-3.67-11.29-3.67s8-.64,11.29-3.67c3-2.7,3.67-22.56,3.67-22.56S296.36,82.69,300.17,85.94Z"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(TwinklesDelay, {
        fill: "#ce5d9e",
        d: "M971.51,236.58C976.44,240.79,988,242,988,242s-11-.15-16.49,5.36c-4.79,4.79-5.37,30.48-5.37,30.48s-.53-25.54-5.37-30.48c-3.89-4-16.49-5.36-16.49-5.36s11.64-.95,16.49-5.37c4.34-4,5.37-33,5.37-33S965.94,231.82,971.51,236.58Z"
      })]
    })]
  });
}
BackgroundSpace.displayName = "BackgroundSpace";

/***/ }),

/***/ "./app/views/eventsV2/banner.tsx":
/*!***************************************!*\
  !*** ./app/views/eventsV2/banner.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_images_spot_discover_tour_alert_svg__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry-images/spot/discover-tour-alert.svg */ "./images/spot/discover-tour-alert.svg");
/* harmony import */ var sentry_images_spot_discover_tour_explore_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/discover-tour-explore.svg */ "./images/spot/discover-tour-explore.svg");
/* harmony import */ var sentry_images_spot_discover_tour_filter_svg__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry-images/spot/discover-tour-filter.svg */ "./images/spot/discover-tour-filter.svg");
/* harmony import */ var sentry_images_spot_discover_tour_group_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/discover-tour-group.svg */ "./images/spot/discover-tour-group.svg");
/* harmony import */ var sentry_components_banner__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/banner */ "./app/components/banner.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/modals/featureTourModal */ "./app/components/modals/featureTourModal.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useMedia */ "./app/utils/useMedia.tsx");
/* harmony import */ var _backgroundSpace__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./backgroundSpace */ "./app/views/eventsV2/backgroundSpace.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














const docsUrl = 'https://docs.sentry.io/product/discover-queries/';

const docsLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
  external: true,
  href: docsUrl,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View Docs')
});

const TOUR_STEPS = [{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Explore Data over Time'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourImage, {
    src: sentry_images_spot_discover_tour_explore_svg__WEBPACK_IMPORTED_MODULE_1__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Analyze and visualize all of your data over time to find answers to your most complex problems.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Filter on Event Attributes.'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourImage, {
    src: sentry_images_spot_discover_tour_filter_svg__WEBPACK_IMPORTED_MODULE_2__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Drill down on data by any custom tag or field to reduce noise and hone in on specific areas.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Group Data by Tags'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourImage, {
    src: sentry_images_spot_discover_tour_group_svg__WEBPACK_IMPORTED_MODULE_3__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Go beyond Issues and create custom groupings to investigate events from a different lens.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Save, Share and Alert'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourImage, {
    src: sentry_images_spot_discover_tour_alert_svg__WEBPACK_IMPORTED_MODULE_0__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Send insights to your team and set alerts to monitor any future spikes.')
  })
}];

function DiscoverBanner(_ref) {
  let {
    organization,
    resultsUrl
  } = _ref;

  function onAdvance(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_8__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.tour.advance',
      eventName: 'Discoverv2: Tour Advance',
      organization_id: parseInt(organization.id, 10),
      step,
      duration
    });
  }

  function onCloseModal(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_8__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.tour.close',
      eventName: 'Discoverv2: Tour Close',
      organization_id: parseInt(organization.id, 10),
      step,
      duration
    });
  }

  const isSmallBanner = (0,sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_10__["default"])(`(max-width: ${sentry_utils_theme__WEBPACK_IMPORTED_MODULE_9__["default"].breakpoints.medium})`);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_banner__WEBPACK_IMPORTED_MODULE_4__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Discover Trends'),
    subtitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Customize and save queries by search conditions, event fields, and tags'),
    backgroundComponent: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_backgroundSpace__WEBPACK_IMPORTED_MODULE_11__["default"], {}),
    dismissKey: "discover",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      size: isSmallBanner ? 'xs' : undefined,
      translucentBorder: true,
      to: resultsUrl,
      onClick: () => {
        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_8__.trackAnalyticsEvent)({
          eventKey: 'discover_v2.build_new_query',
          eventName: 'Discoverv2: Build a new Discover Query',
          organization_id: parseInt(organization.id, 10)
        });
      },
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Build a new query')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_6__["default"], {
      steps: TOUR_STEPS,
      doneText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View all Events'),
      doneUrl: resultsUrl,
      onAdvance: onAdvance,
      onCloseModal: onCloseModal,
      children: _ref2 => {
        let {
          showModal
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          size: isSmallBanner ? 'xs' : undefined,
          translucentBorder: true,
          onClick: () => {
            (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_8__.trackAnalyticsEvent)({
              eventKey: 'discover_v2.tour.start',
              eventName: 'Discoverv2: Tour Start',
              organization_id: parseInt(organization.id, 10)
            });
            showModal();
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Get a Tour')
        });
      }
    })]
  });
}

DiscoverBanner.displayName = "DiscoverBanner";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverBanner);

/***/ }),

/***/ "./app/views/eventsV2/landing.tsx":
/*!****************************************!*\
  !*** ./app/views/eventsV2/landing.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DiscoverLanding": () => (/* binding */ DiscoverLanding),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _banner__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./banner */ "./app/views/eventsV2/banner.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./data */ "./app/views/eventsV2/data.tsx");
/* harmony import */ var _queryList__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./queryList */ "./app/views/eventsV2/queryList.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





























const SORT_OPTIONS = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('My Queries'),
  value: 'myqueries'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Recently Edited'),
  value: '-dateUpdated'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Query Name (A-Z)'),
  value: 'name'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Date Created (Newest)'),
  value: '-dateCreated'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Date Created (Oldest)'),
  value: 'dateCreated'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Most Outdated'),
  value: 'dateUpdated'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Most Popular'),
  value: 'mostPopular'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Recently Viewed'),
  value: 'recentlyViewed'
}];

class DiscoverLanding extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_11__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      // AsyncComponent state
      loading: true,
      reloading: false,
      error: false,
      errors: {},
      // local component state
      renderPrebuilt: (0,_utils__WEBPACK_IMPORTED_MODULE_29__.shouldRenderPrebuilt)(),
      savedQueries: null,
      savedQueriesPageLinks: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleQueryChange", () => {
      this.fetchData({
        reloading: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearchQuery", searchQuery => {
      const {
        location
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          cursor: undefined,
          query: String(searchQuery).trim() || undefined
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSortChange", value => {
      const {
        location
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__.trackAnalyticsEvent)({
        eventKey: 'discover_v2.change_sort',
        eventName: 'Discoverv2: Sort By Changed',
        organization_id: parseInt(this.props.organization.id, 10),
        sort: value
      });
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          cursor: undefined,
          sort: value
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "togglePrebuilt", () => {
      const {
        renderPrebuilt
      } = this.state;
      this.setState({
        renderPrebuilt: !renderPrebuilt
      }, () => {
        (0,_utils__WEBPACK_IMPORTED_MODULE_29__.setRenderPrebuilt)(!renderPrebuilt);
        this.fetchData({
          reloading: true
        });
      });
    });
  }

  getSavedQuerySearchQuery() {
    const {
      location
    } = this.props;
    return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_24__.decodeScalar)(location.query.query, '').trim();
  }

  getActiveSort() {
    const {
      location
    } = this.props;
    const urlSort = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_24__.decodeScalar)(location.query.sort, 'myqueries');
    return SORT_OPTIONS.find(item => item.value === urlSort) || SORT_OPTIONS[0];
  }

  getEndpoints() {
    const {
      organization,
      location
    } = this.props;
    const views = (0,_utils__WEBPACK_IMPORTED_MODULE_29__.getPrebuiltQueries)(organization);
    const searchQuery = this.getSavedQuerySearchQuery();
    const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_24__.decodeScalar)(location.query.cursor);
    let perPage = 9;
    const canRenderPrebuilt = this.state ? this.state.renderPrebuilt : (0,_utils__WEBPACK_IMPORTED_MODULE_29__.shouldRenderPrebuilt)();

    if (!cursor && canRenderPrebuilt) {
      // invariant: we're on the first page
      if (searchQuery && searchQuery.length > 0) {
        const needleSearch = searchQuery.toLowerCase();
        const numOfPrebuiltQueries = views.reduce((sum, view) => {
          const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromNewQueryWithLocation(view, location); // if a search is performed on the list of queries, we filter
          // on the pre-built queries

          if (eventView.name && eventView.name.toLowerCase().includes(needleSearch)) {
            return sum + 1;
          }

          return sum;
        }, 0);
        perPage = Math.max(1, perPage - numOfPrebuiltQueries);
      } else {
        perPage = Math.max(1, perPage - views.length);
      }
    }

    const queryParams = {
      cursor,
      query: `version:2 name:"${searchQuery}"`,
      per_page: perPage.toString(),
      sortBy: this.getActiveSort().value
    };

    if (!cursor) {
      delete queryParams.cursor;
    }

    return [['savedQueries', `/organizations/${organization.slug}/discover/saved/`, {
      query: queryParams
    }]];
  }

  componentDidUpdate(prevProps) {
    const PAYLOAD_KEYS = ['sort', 'cursor', 'query'];
    const payloadKeysChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.location.query, PAYLOAD_KEYS), lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(this.props.location.query, PAYLOAD_KEYS)); // if any of the query strings relevant for the payload has changed,
    // we re-fetch data

    if (payloadKeysChanged) {
      this.fetchData();
    }
  }

  renderBanner() {
    const {
      location,
      organization
    } = this.props;
    const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromNewQueryWithLocation(_data__WEBPACK_IMPORTED_MODULE_27__.DEFAULT_EVENT_VIEW, location);
    const to = eventView.getResultsViewUrlTarget(organization.slug);
    const resultsUrl = `${to.pathname}?${(0,query_string__WEBPACK_IMPORTED_MODULE_7__.stringify)(to.query)}`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_banner__WEBPACK_IMPORTED_MODULE_26__["default"], {
      organization: organization,
      resultsUrl: resultsUrl
    });
  }

  renderActions() {
    const activeSort = this.getActiveSort();
    const {
      renderPrebuilt,
      savedQueries
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(StyledActions, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(StyledSearchBar, {
        defaultQuery: "",
        query: this.getSavedQuerySearchQuery(),
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Search saved queries'),
        onSearch: this.handleSearchQuery
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(PrebuiltSwitch, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(SwitchLabel, {
          children: "Show Prebuilt"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_18__["default"], {
          isActive: renderPrebuilt,
          isDisabled: renderPrebuilt && (savedQueries !== null && savedQueries !== void 0 ? savedQueries : []).length === 0,
          size: "lg",
          toggle: this.togglePrebuilt
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_13__["default"], {
        triggerProps: {
          prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Sort By')
        },
        value: activeSort.value,
        options: SORT_OPTIONS,
        onChange: opt => this.handleSortChange(opt.value),
        placement: "bottom right"
      })]
    });
  }

  renderNoAccess() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)("You don't have access to this feature")
      })
    });
  }

  renderBody() {
    const {
      location,
      organization,
      router
    } = this.props;
    const {
      savedQueries,
      savedQueriesPageLinks,
      renderPrebuilt
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_queryList__WEBPACK_IMPORTED_MODULE_28__["default"], {
      pageLinks: savedQueriesPageLinks,
      savedQueries: savedQueries !== null && savedQueries !== void 0 ? savedQueries : [],
      savedQuerySearchQuery: this.getSavedQuerySearchQuery(),
      renderPrebuilt: renderPrebuilt,
      location: location,
      organization: organization,
      onQueryChange: this.handleQueryChange,
      router: router
    });
  }

  render() {
    const {
      location,
      organization
    } = this.props;
    const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromNewQueryWithLocation(_data__WEBPACK_IMPORTED_MODULE_27__.DEFAULT_EVENT_VIEW, location);
    const to = eventView.getResultsViewUrlTarget(organization.slug);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
      organization: organization,
      features: ['discover-query'],
      renderDisabled: this.renderNoAccess,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_17__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Discover'),
        orgSlug: organization.slug,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(StyledPageContent, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
            organization: organization,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__.PageContent, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(StyledPageHeader, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_14__.Title, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    target: "discover_landing_header",
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Discover')
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(StyledButton, {
                  "data-test-id": "build-new-query",
                  to: to,
                  priority: "primary",
                  onClick: () => {
                    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__.trackAnalyticsEvent)({
                      eventKey: 'discover_v2.build_new_query',
                      eventName: 'Discoverv2: Build a new Discover Query',
                      organization_id: parseInt(this.props.organization.id, 10)
                    });
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Build a new query')
                })]
              }), this.renderBanner(), this.renderActions(), this.renderComponent()]
            })
          })
        })
      })
    });
  }

}

DiscoverLanding.displayName = "DiscoverLanding";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__.PageContent,  true ? {
  target: "es9haop6"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const PrebuiltSwitch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "es9haop5"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const SwitchLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "es9haop4"
} : 0)( true ? {
  name: "13vjjlj",
  styles: "padding-right:8px"
} : 0);

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "es9haop3"
} : 0)("display:flex;align-items:flex-end;font-size:", p => p.theme.headerFontSize, ";color:", p => p.theme.textColor, ";justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "es9haop2"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

const StyledActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "es9haop1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";grid-template-columns:auto max-content min-content;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:auto;}" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "es9haop0"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_25__["default"])(DiscoverLanding));


/***/ }),

/***/ "./app/views/eventsV2/miniGraph.tsx":
/*!******************************************!*\
  !*** ./app/views/eventsV2/miniGraph.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_eventsGeoRequest__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/eventsGeoRequest */ "./app/components/charts/eventsGeoRequest.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/worldMapChart */ "./app/components/charts/worldMapChart.tsx");
/* harmony import */ var sentry_components_loading_loadingContainer__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loading/loadingContainer */ "./app/components/loading/loadingContainer.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























class MiniGraph extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  shouldComponentUpdate(nextProps) {
    // We pay for the cost of the deep comparison here since it is cheaper
    // than the cost for rendering the graph, which can take ~200ms to ~300ms to
    // render.
    return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(this.getRefreshProps(this.props), this.getRefreshProps(nextProps));
  }

  getRefreshProps(props) {
    // get props that are relevant to the API payload for the graph
    const {
      organization,
      location,
      eventView,
      yAxis
    } = props;
    const apiPayload = eventView.getEventsAPIPayload(location);
    const query = apiPayload.query;
    const start = apiPayload.start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__.getUtcToLocalDateObject)(apiPayload.start) : null;
    const end = apiPayload.end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__.getUtcToLocalDateObject)(apiPayload.end) : null;
    const period = apiPayload.statsPeriod;
    const display = eventView.getDisplayMode();
    const isTopEvents = display === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.DisplayModes.TOP5 || display === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.DisplayModes.DAILYTOP5;
    const isDaily = display === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.DisplayModes.DAILYTOP5 || display === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.DisplayModes.DAILY;
    const field = isTopEvents ? apiPayload.field : undefined;
    const topEvents = isTopEvents ? sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.TOP_N : undefined;
    const orderby = isTopEvents ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__.decodeScalar)(apiPayload.sort) : undefined;
    const intervalFidelity = display === 'bar' ? 'low' : 'high';
    const interval = isDaily ? '1d' : (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__.getInterval)({
      start,
      end,
      period
    }, intervalFidelity);
    return {
      organization,
      apiPayload,
      query,
      start,
      end,
      period,
      interval,
      project: eventView.project,
      environment: eventView.environment,
      yAxis: yAxis !== null && yAxis !== void 0 ? yAxis : eventView.getYAxis(),
      field,
      topEvents,
      orderby,
      showDaily: isDaily,
      expired: eventView.expired,
      name: eventView.name,
      display
    };
  }

  getChartType(_ref) {
    let {
      showDaily
    } = _ref;

    if (showDaily) {
      return 'bar';
    }

    return 'area';
  }

  getChartComponent(chartType) {
    switch (chartType) {
      case 'bar':
        return sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_6__.BarChart;

      case 'line':
        return sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_9__.LineChart;

      case 'area':
        return sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_5__.AreaChart;

      default:
        throw new Error(`Unknown multi plot type for ${chartType}`);
    }
  }

  render() {
    const {
      theme,
      api,
      referrer
    } = this.props;
    const {
      query,
      start,
      end,
      period,
      interval,
      organization,
      project,
      environment,
      yAxis,
      field,
      topEvents,
      orderby,
      showDaily,
      expired,
      name,
      display
    } = this.getRefreshProps(this.props);

    if (display === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_18__.DisplayModes.WORLDMAP) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_charts_eventsGeoRequest__WEBPACK_IMPORTED_MODULE_7__["default"], {
        api: api,
        organization: organization,
        yAxis: yAxis,
        query: query,
        orderby: orderby,
        projects: project,
        period: period,
        start: start,
        end: end,
        environments: environment,
        referrer: referrer,
        children: _ref2 => {
          let {
            errored,
            loading,
            tableData
          } = _ref2;

          if (errored) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledGraphContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconWarning, {
                color: "gray300",
                size: "md"
              })
            });
          }

          if (loading) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledGraphContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {
                mini: true
              })
            });
          }

          const {
            data,
            title
          } = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_10__.processTableResults)(tableData);
          const chartOptions = {
            height: 100,
            series: [{
              seriesName: title,
              data
            }],
            fromDiscoverQueryList: true
          };
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_11__.WorldMapChart, { ...chartOptions
          });
        }
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_8__["default"], {
      organization: organization,
      api: api,
      query: query,
      start: start,
      end: end,
      period: period,
      interval: interval,
      project: project,
      environment: environment,
      includePrevious: false,
      yAxis: yAxis,
      field: field,
      topEvents: topEvents,
      orderby: orderby,
      expired: expired,
      name: name,
      referrer: referrer,
      hideError: true,
      partial: true,
      children: _ref3 => {
        var _ref4;

        let {
          loading,
          timeseriesData,
          results,
          errored,
          errorMessage
        } = _ref3;

        if (errored) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(StyledGraphContainer, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconWarning, {
              color: "gray300",
              size: "md"
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledErrorMessage, {
              children: errorMessage
            })]
          });
        }

        if (loading) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(StyledGraphContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {
              mini: true
            })
          });
        }

        const allSeries = (_ref4 = timeseriesData !== null && timeseriesData !== void 0 ? timeseriesData : results) !== null && _ref4 !== void 0 ? _ref4 : [];
        const chartType = display === 'bar' ? display : this.getChartType({
          showDaily,
          yAxis: Array.isArray(yAxis) ? yAxis[0] : yAxis,
          timeseriesData: allSeries
        });
        const data = allSeries.map(series => ({ ...series,
          lineStyle: {
            opacity: chartType === 'line' ? 1 : 0
          },
          smooth: true
        }));
        const hasOther = topEvents && topEvents + 1 === allSeries.length;
        const chartColors = allSeries.length ? [...theme.charts.getColorPalette(allSeries.length - 2 - (hasOther ? 1 : 0))] : undefined;

        if (chartColors && chartColors.length && hasOther) {
          chartColors.push(theme.chartOther);
        }

        const chartOptions = {
          colors: chartColors,
          height: 150,
          series: [...data],
          xAxis: {
            show: false,
            axisPointer: {
              show: false
            }
          },
          yAxis: {
            show: true,
            axisLine: {
              show: false
            },
            axisLabel: {
              color: theme.chartLabel,
              fontFamily: theme.text.family,
              fontSize: 12,
              formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_16__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.aggregateOutputType)(Array.isArray(yAxis) ? yAxis[0] : yAxis), true),
              inside: true,
              showMinLabel: false,
              showMaxLabel: false
            },
            splitNumber: 3,
            splitLine: {
              show: false
            },
            zlevel: theme.zIndex.header
          },
          tooltip: {
            show: false
          },
          toolBox: {
            show: false
          },
          grid: {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            containLabel: false
          },
          stacked: typeof topEvents === 'number' && topEvents > 0 || Array.isArray(yAxis) && yAxis.length > 1
        };
        const ChartComponent = this.getChartComponent(chartType);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(ChartComponent, { ...chartOptions
        });
      }
    });
  }

}

MiniGraph.displayName = "MiniGraph";

const StyledGraphContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_loading_loadingContainer__WEBPACK_IMPORTED_MODULE_12__["default"], { ...props,
  maskBackgroundColor: "transparent"
}),  true ? {
  target: "e1ts1dxn1"
} : 0)( true ? {
  name: "khkb4p",
  styles: "height:150px;display:flex;justify-content:center;align-items:center"
} : 0);

const StyledErrorMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ts1dxn0"
} : 0)("color:", p => p.theme.gray300, ";margin-left:4px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__["default"])((0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.d)(MiniGraph)));

/***/ }),

/***/ "./app/views/eventsV2/queryList.tsx":
/*!******************************************!*\
  !*** ./app/views/eventsV2/queryList.tsx ***!
  \******************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/pageFilters */ "./app/actionCreators/pageFilters.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _savedQuery_utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./savedQuery/utils */ "./app/views/eventsV2/savedQuery/utils.tsx");
/* harmony import */ var _miniGraph__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./miniGraph */ "./app/views/eventsV2/miniGraph.tsx");
/* harmony import */ var _querycard__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./querycard */ "./app/views/eventsV2/querycard.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























class QueryList extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteQuery", eventView => {
      const {
        api,
        organization,
        onQueryChange,
        location,
        savedQueries
      } = this.props;
      (0,_savedQuery_utils__WEBPACK_IMPORTED_MODULE_22__.handleDeleteQuery)(api, organization, eventView).then(() => {
        if (savedQueries.length === 1 && location.query.cursor) {
          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
            pathname: location.pathname,
            query: { ...location.query,
              cursor: undefined
            }
          });
        } else {
          onQueryChange();
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDuplicateQuery", (eventView, yAxis) => {
      const {
        api,
        location,
        organization,
        onQueryChange
      } = this.props;
      eventView = eventView.clone();
      eventView.name = `${eventView.name} copy`;
      (0,_savedQuery_utils__WEBPACK_IMPORTED_MODULE_22__.handleCreateQuery)(api, organization, eventView, yAxis).then(() => {
        onQueryChange();
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
          pathname: location.pathname,
          query: {}
        });
      });
    });
  }

  componentDidMount() {
    /**
     * We need to reset global selection here because the saved queries can define their own projects
     * in the query. This can lead to mismatched queries for the project
     */
    (0,sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_7__.resetPageFilters)();
  }

  renderQueries() {
    const {
      pageLinks,
      renderPrebuilt
    } = this.props;
    const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_19__["default"])(pageLinks || '');
    let cards = []; // If we're on the first page (no-previous page exists)
    // include the pre-built queries.

    if (renderPrebuilt && (!links.previous || links.previous.results === false)) {
      cards = cards.concat(this.renderPrebuiltQueries());
    }

    cards = cards.concat(this.renderSavedQueries());

    if (cards.filter(x => x).length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledEmptyStateWarning, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No saved queries match that filter')
        })
      });
    }

    return cards;
  }

  renderDropdownMenu(items) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
      items: items,
      trigger: _ref => {
        let {
          props: triggerProps,
          ref: triggerRef
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(DropdownTrigger, {
          ref: triggerRef,
          ...triggerProps,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Query actions'),
          size: "xs",
          borderless: true,
          onClick: e => {
            var _triggerProps$onClick;

            e.stopPropagation();
            e.preventDefault();
            (_triggerProps$onClick = triggerProps.onClick) === null || _triggerProps$onClick === void 0 ? void 0 : _triggerProps$onClick.call(triggerProps, e);
          },
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconEllipsis, {
            direction: "down",
            size: "sm"
          }),
          "data-test-id": "menu-trigger"
        });
      },
      placement: "bottom right",
      offset: 4
    });
  }

  renderPrebuiltQueries() {
    const {
      location,
      organization,
      savedQuerySearchQuery,
      router
    } = this.props;
    const views = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.getPrebuiltQueries)(organization);
    const hasSearchQuery = typeof savedQuerySearchQuery === 'string' && savedQuerySearchQuery.length > 0;
    const needleSearch = hasSearchQuery ? savedQuerySearchQuery.toLowerCase() : '';
    const list = views.map((view, index) => {
      const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_18__["default"].fromNewQueryWithLocation(view, location); // if a search is performed on the list of queries, we filter
      // on the pre-built queries

      if (hasSearchQuery && eventView.name && !eventView.name.toLowerCase().includes(needleSearch)) {
        return null;
      }

      const recentTimeline = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Last ') + eventView.statsPeriod;
      const customTimeline = moment__WEBPACK_IMPORTED_MODULE_6___default()(eventView.start).format('MMM D, YYYY h:mm A') + ' - ' + moment__WEBPACK_IMPORTED_MODULE_6___default()(eventView.end).format('MMM D, YYYY h:mm A');
      const to = eventView.getResultsViewUrlTarget(organization.slug);
      const menuItems = [{
        key: 'add-to-dashboard',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add to Dashboard'),
        onAction: () => (0,_utils__WEBPACK_IMPORTED_MODULE_25__.handleAddQueryToDashboard)({
          eventView,
          location,
          query: view,
          organization,
          yAxis: view === null || view === void 0 ? void 0 : view.yAxis,
          router
        })
      }];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_querycard__WEBPACK_IMPORTED_MODULE_24__["default"], {
        to: to,
        title: eventView.name,
        subtitle: eventView.statsPeriod ? recentTimeline : customTimeline,
        queryDetail: eventView.query,
        createdBy: eventView.createdBy,
        renderGraph: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_miniGraph__WEBPACK_IMPORTED_MODULE_23__["default"], {
          location: location,
          eventView: eventView,
          organization: organization,
          referrer: "api.discover.homepage.prebuilt"
        }),
        onEventClick: () => {
          (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__.trackAnalyticsEvent)({
            eventKey: 'discover_v2.prebuilt_query_click',
            eventName: 'Discoverv2: Click a pre-built query',
            organization_id: parseInt(this.props.organization.id, 10),
            query_name: eventView.name
          });
        },
        renderContextMenu: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
          organization: organization,
          features: ['dashboards-edit'],
          children: _ref2 => {
            let {
              hasFeature
            } = _ref2;
            return hasFeature && this.renderDropdownMenu(menuItems);
          }
        })
      }, `${index}-${eventView.name}`);
    });
    return list;
  }

  renderSavedQueries() {
    const {
      savedQueries,
      location,
      organization,
      router
    } = this.props;

    if (!savedQueries || !Array.isArray(savedQueries) || savedQueries.length === 0) {
      return [];
    }

    return savedQueries.map((savedQuery, index) => {
      const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_18__["default"].fromSavedQuery(savedQuery);
      const recentTimeline = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Last ') + eventView.statsPeriod;
      const customTimeline = moment__WEBPACK_IMPORTED_MODULE_6___default()(eventView.start).format('MMM D, YYYY h:mm A') + ' - ' + moment__WEBPACK_IMPORTED_MODULE_6___default()(eventView.end).format('MMM D, YYYY h:mm A');
      const to = eventView.getResultsViewShortUrlTarget(organization.slug);

      const dateStatus = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_13__["default"], {
        date: savedQuery.dateUpdated
      });

      const referrer = `api.discover.${eventView.getDisplayMode()}-chart`;

      const menuItems = canAddToDashboard => [...(canAddToDashboard ? [{
        key: 'add-to-dashboard',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add to Dashboard'),
        onAction: () => {
          var _savedQuery$yAxis;

          return (0,_utils__WEBPACK_IMPORTED_MODULE_25__.handleAddQueryToDashboard)({
            eventView,
            location,
            query: savedQuery,
            organization,
            yAxis: (_savedQuery$yAxis = savedQuery === null || savedQuery === void 0 ? void 0 : savedQuery.yAxis) !== null && _savedQuery$yAxis !== void 0 ? _savedQuery$yAxis : eventView.yAxis,
            router
          });
        }
      }] : []), {
        key: 'duplicate',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Duplicate Query'),
        onAction: () => this.handleDuplicateQuery(eventView, (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeList)(savedQuery.yAxis))
      }, {
        key: 'delete',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Delete Query'),
        priority: 'danger',
        onAction: () => this.handleDeleteQuery(eventView)
      }];

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_querycard__WEBPACK_IMPORTED_MODULE_24__["default"], {
        to: to,
        title: eventView.name,
        subtitle: eventView.statsPeriod ? recentTimeline : customTimeline,
        queryDetail: eventView.query,
        createdBy: eventView.createdBy,
        dateStatus: dateStatus,
        onEventClick: () => {
          (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__.trackAnalyticsEvent)({
            eventKey: 'discover_v2.saved_query_click',
            eventName: 'Discoverv2: Click a saved query',
            organization_id: parseInt(this.props.organization.id, 10)
          });
        },
        renderGraph: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_miniGraph__WEBPACK_IMPORTED_MODULE_23__["default"], {
          location: location,
          eventView: eventView,
          organization: organization,
          referrer: referrer,
          yAxis: savedQuery.yAxis && savedQuery.yAxis.length ? savedQuery.yAxis : ['count()']
        }),
        renderContextMenu: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
          organization: organization,
          features: ['dashboards-edit'],
          children: _ref3 => {
            let {
              hasFeature
            } = _ref3;
            return this.renderDropdownMenu(menuItems(hasFeature));
          }
        })
      }, `${index}-${eventView.id}`);
    });
  }

  render() {
    const {
      pageLinks
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(QueryGrid, {
        children: this.renderQueries()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(PaginationRow, {
        pageLinks: pageLinks,
        onCursor: (cursor, path, query, direction) => {
          var _cursor$split$, _cursor$split;

          const offset = Number((_cursor$split$ = cursor === null || cursor === void 0 ? void 0 : (_cursor$split = cursor.split(':')) === null || _cursor$split === void 0 ? void 0 : _cursor$split[1]) !== null && _cursor$split$ !== void 0 ? _cursor$split$ : 0);
          const newQuery = { ...query,
            cursor
          };
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }

          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
            pathname: path,
            query: newQuery
          });
        }
      })]
    });
  }

}

QueryList.displayName = "QueryList";

const PaginationRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e1m5p7vx3"
} : 0)( true ? {
  name: "1azpx8r",
  styles: "margin-bottom:20px"
} : 0);

const QueryGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1m5p7vx2"
} : 0)("display:grid;grid-template-columns:minmax(100px, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:repeat(2, minmax(100px, 1fr));}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:repeat(3, minmax(100px, 1fr));}" + ( true ? "" : 0));

const DropdownTrigger = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1m5p7vx1"
} : 0)("transform:translateX(", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ");" + ( true ? "" : 0));

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e1m5p7vx0"
} : 0)( true ? {
  name: "1wygoze",
  styles: "grid-column:1/4"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__["default"])(QueryList));

/***/ }),

/***/ "./app/views/eventsV2/querycard.tsx":
/*!******************************************!*\
  !*** ./app/views/eventsV2/querycard.tsx ***!
  \******************************************/
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
/* harmony import */ var sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/activity/item/avatar */ "./app/components/activity/item/avatar.tsx");
/* harmony import */ var sentry_components_card__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/card */ "./app/components/card.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class QueryCard extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClick", () => {
      const {
        onEventClick
      } = this.props;
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__.callIfFunction)(onEventClick);
    });
  }

  render() {
    const {
      title,
      subtitle,
      queryDetail,
      renderContextMenu,
      renderGraph,
      createdBy,
      dateStatus
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
      "data-test-id": `card-${title}`,
      onClick: this.handleClick,
      to: this.props.to,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledQueryCard, {
        interactive: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(QueryCardHeader, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(QueryCardContent, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(QueryTitle, {
              children: title
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(QueryDetail, {
              children: queryDetail
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(AvatarWrapper, {
            children: createdBy ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
              type: "user",
              user: createdBy,
              size: 34
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
              type: "system",
              size: 34
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(QueryCardBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledErrorBoundary, {
            mini: true,
            children: renderGraph()
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(QueryCardFooter, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(DateSelected, {
            children: [subtitle, dateStatus ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(DateStatus, {
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Edited'), " ", dateStatus]
            }) : null]
          }), renderContextMenu && renderContextMenu()]
        })]
      })
    });
  }

}

QueryCard.displayName = "QueryCard";

const AvatarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "edx1qyo10"
} : 0)("border:3px solid ", p => p.theme.border, ";border-radius:50%;height:min-content;" + ( true ? "" : 0));

const QueryCardContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo9"
} : 0)("flex-grow:1;overflow:hidden;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const StyledQueryCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_card__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "edx1qyo8"
} : 0)( true ? {
  name: "1h9y2eg",
  styles: "justify-content:space-between;height:100%;&:focus,&:hover{top:-1px;}"
} : 0);

const QueryCardHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo7"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

const QueryTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo6"
} : 0)(p => p.theme.text.cardTitle, ";color:", p => p.theme.headingColor, ";", p => p.theme.overflowEllipsis, ";font-weight:initial;" + ( true ? "" : 0));

const QueryDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo5"
} : 0)("font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.gray300, ";line-height:1.5;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const QueryCardBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo4"
} : 0)("background:", p => p.theme.backgroundSecondary, ";max-height:150px;height:100%;overflow:hidden;" + ( true ? "" : 0));

const QueryCardFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo3"
} : 0)("display:flex;justify-content:space-between;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

const DateSelected = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edx1qyo2"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";", p => p.theme.overflowEllipsis, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const DateStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "edx1qyo1"
} : 0)("color:", p => p.theme.subText, ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const StyledErrorBoundary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "edx1qyo0"
} : 0)( true ? {
  name: "qu9742",
  styles: "margin-bottom:100px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (QueryCard);

/***/ }),

/***/ "./images/spot/discover-tour-alert.svg":
/*!*********************************************!*\
  !*** ./images/spot/discover-tour-alert.svg ***!
  \*********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMzU5IDE5NCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMzU5IDE5NDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPiA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPiAuc3Qwe2ZpbGw6I0ZGRkZGRjt9IC5zdDF7ZmlsbDojRURFN0Y1O30gLnN0MntmaWxsOiNDMUIyREQ7fSAuc3Qze2ZpbGw6IzNFMkM3Mzt9IC5zdDR7ZmlsbDpub25lO3N0cm9rZTojM0UyQzczO3N0cm9rZS13aWR0aDowLjc1O30gLnN0NXtmaWxsOm5vbmU7c3Ryb2tlOiNGRjc3Mzg7c3Ryb2tlLXdpZHRoOjEuNTt9IC5zdDZ7ZmlsbDojNUE0QTc5O30gLnN0N3tmaWxsOiNGRjc3Mzg7fSAucXVlcnkgeyBhbmltYXRpb246IGZhZGVJbiA2cyBlYXNlLWluIGluZmluaXRlOyB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXIgY2VudGVyOyB9IC5xdWVyeTIgeyBhbmltYXRpb24tZGVsYXk6IDJzOyB9IC5xdWVyeTEgeyBhbmltYXRpb24tZGVsYXk6IDRzOyB9IEBrZXlmcmFtZXMgZmFkZUluIHsgMCUsIDM4JSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfSA0MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMnB4KSBzY2FsZSgwLjk5KTsgfSA0NCUsIDEwMCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7IH0gfSA8L3N0eWxlPiA8ZyBpZD0icXVlcnkzIiBjbGFzcz0icXVlcnkgcXVlcnkzIj4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTIxOSwxMTYuMUwyMTguMSw1YzAtMS4xLTAuOS0yLTItMkg3LjFjLTEuMSwwLTIsMC45LTIsMkw0LDExN2MwLDEuMSwwLjksMiwyLDJsMjExLTAuOCBDMjE4LjEsMTE4LjEsMjE5LDExNy4yLDIxOSwxMTYuMXoiLz4gPHJlY3QgeT0iMzkiIGNsYXNzPSJzdDEiIHdpZHRoPSIyMjQiIGhlaWdodD0iNTciLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTE5MywxMmgxNGMxLjEsMCwyLDAuOSwyLDJ2MTRjMCwxLjEtMC45LDItMiwyaC0xNGMtMS4xLDAtMi0wLjktMi0yVjE0QzE5MSwxMi45LDE5MS45LDEyLDE5MywxMnoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE5LjUsMTZoMTAyYzAuOCwwLDEuNSwwLjcsMS41LDEuNWwwLDBjMCwwLjgtMC43LDEuNS0xLjUsMS41aC0xMDJjLTAuOCwwLTEuNS0wLjctMS41LTEuNWwwLDAgQzE4LDE2LjcsMTguNywxNiwxOS41LDE2eiIvPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTkuNSwyM2g2MmMwLjgsMCwxLjUsMC43LDEuNSwxLjVsMCwwYzAsMC44LTAuNywxLjUtMS41LDEuNWgtNjJjLTAuOCwwLTEuNS0wLjctMS41LTEuNWwwLDAgQzE4LDIzLjcsMTguNywyMywxOS41LDIzeiIvPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTksMTA2aDI4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDE5Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE4LDEwNi40LDE4LjQsMTA2LDE5LDEwNnoiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTU0LDEwNmg2OGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUg1NGMtMC42LDAtMS0wLjQtMS0xbDAsMEM1MywxMDYuNCw1My40LDEwNiw1NCwxMDZ6Ii8+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0yMTQuNyw4Ny41bDQuMywwLjlWOTRINFY4MS4ybDQuOCwxLjlMMTMsODRsNC4zLTEuNmw0LjMtMC4xbDQuMywwLjFsNC4zLTVsNC4zLDAuMWw0LjMsMGw0LjMsMC4ybDQuMy02LjcgbDQuMy0xLjlMNTYsNTVsNC4zLDIxLjJsNC4zLDEuM2w0LjMtMC4zbDQuMyw0LjNsNC4zLTEuNGw0LjMsMC42bDQuMywyLjFsNC4zLDEuN2w0LjMsMC4xbDQuMy0wLjVsNC4zLTEzLjhsNC4zLTguN2w0LjMsMjIgbDQuMy0yLjJsNC4zLDAuNWw0LjMsMC4zbDQuMywwLjFsNC4zLTEuOGw0LjMsMi40bDQuMywwLjlsNC4zLTEuMWw0LjMtMC4ybDQuMywwLjZsNC0xMi45bDQuNiwxMy40bDQuMywwLjFsNC4zLTAuOGw0LjMsMC4xIGw0LjMtMC4zbDQuMy0xLjFsNC4zLDEuNGw0LjMsMC44bDQuMywwLjdsNC4zLTAuMmw0LjMtMS44bDYuOS0xLjhMMjE0LjcsODcuNXoiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTIxOSwxMTYuMUwyMTguMSw1YzAtMS4xLTAuOS0yLTItMkg3LjFjLTEuMSwwLTIsMC45LTIsMkw0LDExN2MwLDEuMSwwLjksMiwyLDJsMjExLTAuOCBDMjE4LjEsMTE4LjEsMjE5LDExNy4yLDIxOSwxMTYuMXoiLz4gPHBhdGggY2xhc3M9InN0NSIgZD0iTTMsMTE2LjNMMiwzYzAtMS4xLDAuOS0yLDItMmgyMTQuNGMxLjEsMCwyLDAuOSwyLDJsMC41LDExNmMwLDEuMS0wLjksMi0yLDJMNSwxMTguMiBDMy45LDExOC4yLDMsMTE3LjQsMywxMTYuM3oiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTE5MSwxMC40aDE0YzAuOSwwLDEuNiwwLjcsMS42LDEuNnYxNGMwLDAuOS0wLjcsMS42LTEuNiwxLjZoLTE0Yy0wLjksMC0xLjYtMC43LTEuNi0xLjZWMTIgQzE4OS40LDExLjEsMTkwLjEsMTAuNCwxOTEsMTAuNHoiLz4gPC9nPiA8ZyBpZD0icXVlcnkyIiBjbGFzcz0icXVlcnkgcXVlcnkyIj4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTM1NCwxNTAuMUwzNTMuMSwzOWMwLTEuMS0wLjktMi0yLTJoLTIwOWMtMS4xLDAtMiwwLjktMiwyTDEzOSwxNTFjMCwxLjEsMC45LDIsMiwybDIxMS0wLjggQzM1My4xLDE1Mi4xLDM1NCwxNTEuMiwzNTQsMTUwLjF6Ii8+IDxyZWN0IHg9IjEzNSIgeT0iNzMiIGNsYXNzPSJzdDEiIHdpZHRoPSIyMjQiIGhlaWdodD0iNTciLz4gPHBhdGggY2xhc3M9InN0NiIgZD0iTTMyOCw0NmgxNGMxLjEsMCwyLDAuOSwyLDJ2MTRjMCwxLjEtMC45LDItMiwyaC0xNGMtMS4xLDAtMi0wLjktMi0yVjQ4QzMyNiw0Ni45LDMyNi45LDQ2LDMyOCw0NnoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE1NC41LDUwaDEwMmMwLjgsMCwxLjUsMC43LDEuNSwxLjVsMCwwYzAsMC44LTAuNywxLjUtMS41LDEuNWgtMTAyYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVsMCwwIEMxNTMsNTAuNywxNTMuNyw1MCwxNTQuNSw1MHoiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTE4OSwxNDBoNjhjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFoLTY4Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE4OCwxNDAuNCwxODguNCwxNDAsMTg5LDE0MHoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE0My4zLDEyNS4ybC00LjMsMC40djIuNWgyMTV2LTUuNmwtNC44LDAuOGwtNC4zLDAuNGwtNC4zLTAuN2wtNC4zLTAuMWwtNC4zLDAuMWwtNC4zLTIuMmwtNC4zLDAuMWwtNC4zLDAgbC00LjMsMC4xbC00LjMtMi45bC00LjMtMC44TDMwMiwxMTFsLTQuMyw5LjNsLTQuMywwLjZsLTQuMy0wLjFsLTQuMywxLjlsLTQuMy0wLjZsLTQuMywwLjNsLTQuMywwLjlsLTQuMywwLjdsLTQuMywwLjFsLTQuMy0wLjIgbC00LjMtNmwtNC4zLTMuOGwtNC4zLDkuNmwtNC4zLTFsLTQuMywwLjJsLTQuMywwLjFsLTQuMywwbC00LjMtMC44bC00LjMsMWwtNC4zLDAuNGwtNC4zLTAuNWwtNC4zLTAuMWwtNC4zLDAuM2wtNC01LjZsLTQuNiw1LjggbC00LjMsMGwtNC4zLTAuNGwtNC4zLDAuMWwtNC4zLTAuMWwtNC4zLTAuNWwtNC4zLDAuNmwtNC4zLDAuM2wtNC4zLDAuM2wtNC4zLTAuMWwtNC4zLTAuOGwtNi45LTAuOEwxNDMuMywxMjUuMnoiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTM1NCwxNTAuMUwzNTMuMSwzOWMwLTEuMS0wLjktMi0yLTJoLTIwOWMtMS4xLDAtMiwwLjktMiwyTDEzOSwxNTFjMCwxLjEsMC45LDIsMiwybDIxMS0wLjggQzM1My4xLDE1Mi4xLDM1NCwxNTEuMiwzNTQsMTUwLjF6Ii8+IDxwYXRoIGNsYXNzPSJzdDUiIGQ9Ik0xMzgsMTUwLjNMMTM3LDM3YzAtMS4xLDAuOS0yLDItMmgyMTQuNGMxLjEsMCwyLDAuOSwyLDJsMC41LDExNmMwLDEuMS0wLjksMi0yLDJsLTIxNC0yLjcgQzEzOC45LDE1Mi4yLDEzOCwxNTEuNCwxMzgsMTUwLjN6Ii8+IDxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0zMjYsNDQuNGgxNGMwLjksMCwxLjYsMC43LDEuNiwxLjZ2MTRjMCwwLjktMC43LDEuNi0xLjYsMS42aC0xNGMtMC45LDAtMS42LTAuNy0xLjYtMS42VjQ2IEMzMjQuNCw0NS4xLDMyNS4xLDQ0LjQsMzI2LDQ0LjR6Ii8+IDxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik0xNTQsMTQwaDI4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC0yOGMtMC42LDAtMS0wLjQtMS0xbDAsMEMxNTMsMTQwLjQsMTUzLjQsMTQwLDE1NCwxNDB6Ii8+IDxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik0xNTQuNSw1N2g2MmMwLjgsMCwxLjUsMC43LDEuNSwxLjVsMCwwYzAsMC44LTAuNywxLjUtMS41LDEuNWgtNjJjLTAuOCwwLTEuNS0wLjctMS41LTEuNWwwLDAgQzE1Myw1Ny43LDE1My43LDU3LDE1NC41LDU3eiIvPiA8L2c+IDxnIGlkPSJxdWVyeTEiIGNsYXNzPSJxdWVyeSBxdWVyeTEiPiA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMjU2LDE4OC4xTDI1NS4xLDc3YzAtMS4xLTAuOS0yLTItMmgtMjA5Yy0xLjEsMC0yLDAuOS0yLDJMNDEsMTg5YzAsMS4xLDAuOSwyLDIsMmwyMTEtMC44IEMyNTUuMSwxOTAuMSwyNTYsMTg5LjIsMjU2LDE4OC4xeiIvPiA8cmVjdCB4PSIzNyIgeT0iMTExIiBjbGFzcz0ic3QxIiB3aWR0aD0iMjI0IiBoZWlnaHQ9IjU3Ii8+IDxwYXRoIGNsYXNzPSJzdDciIGQ9Ik0yMzAsODRoMTRjMS4xLDAsMiwwLjksMiwydjE0YzAsMS4xLTAuOSwyLTIsMmgtMTRjLTEuMSwwLTItMC45LTItMlY4NkMyMjgsODQuOSwyMjguOSw4NCwyMzAsODR6Ii8+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik01Ni41LDg4aDEwMmMwLjgsMCwxLjUsMC43LDEuNSwxLjVsMCwwYzAsMC44LTAuNywxLjUtMS41LDEuNWgtMTAyYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVsMCwwIEM1NSw4OC43LDU1LjcsODgsNTYuNSw4OHoiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTU2LjUsOTVoNjJjMC44LDAsMS41LDAuNywxLjUsMS41bDAsMGMwLDAuOC0wLjcsMS41LTEuNSwxLjVoLTYyYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVsMCwwIEM1NSw5NS43LDU1LjcsOTUsNTYuNSw5NXoiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTU2LDE3OGgyOGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUg1NmMtMC42LDAtMS0wLjQtMS0xbDAsMEM1NSwxNzguNCw1NS40LDE3OCw1NiwxNzh6Ii8+IDxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik05MSwxNzhoNjhjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIOTFjLTAuNiwwLTEtMC40LTEtMWwwLDBDOTAsMTc4LjQsOTAuNCwxNzgsOTEsMTc4eiIvPiA8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNDUuMywxNTkuNWwtNC4zLDAuOXY1LjZoMjE1di0xMi44bC00LjgsMS45TDI0NywxNTZsLTQuMy0xLjZsLTQuMy0wLjFsLTQuMywwLjFsLTQuMy01bC00LjMsMC4xbC00LjMsMCBsLTQuMywwLjJsLTQuMy02LjdsLTQuMy0xLjlMMjA0LDEyN2wtNC4zLDIxLjJsLTQuMywxLjNsLTQuMy0wLjNsLTQuMyw0LjNsLTQuMy0xLjRsLTQuMywwLjZsLTQuMywyLjFsLTQuMywxLjdsLTQuMywwLjFsLTQuMy0wLjUgbC00LjMtMTMuOGwtNC4zLTguN2wtNC4zLDIybC00LjMtMi4ybC00LjMsMC41bC00LjMsMC4zbC00LjMsMC4xbC00LjMtMS44bC00LjMsMi40bC00LjMsMC45bC00LjMtMS4xbC00LjMtMC4ybC00LjMsMC42bC00LTEyLjkgbC00LjYsMTMuNGwtNC4zLDAuMWwtNC4zLTAuOGwtNC4zLDAuMWwtNC4zLTAuM2wtNC4zLTEuMWwtNC4zLDEuNGwtNC4zLDAuOGwtNC4zLDAuN2wtNC4zLTAuMmwtNC4zLTEuOGwtNi45LTEuOEw0NS4zLDE1OS41eiIvPiA8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjU2LDE4OC4xTDI1NS4xLDc3YzAtMS4xLTAuOS0yLTItMmgtMjA5Yy0xLjEsMC0yLDAuOS0yLDJMNDEsMTg5YzAsMS4xLDAuOSwyLDIsMmwyMTEtMC44IEMyNTUuMSwxOTAuMSwyNTYsMTg5LjIsMjU2LDE4OC4xeiIvPiA8cGF0aCBjbGFzcz0ic3Q1IiBkPSJNNDAsMTg4LjNMMzksNzVjMC0xLjEsMC45LTIsMi0yaDIxNC40YzEuMSwwLDIsMC45LDIsMmwwLjUsMTE2YzAsMS4xLTAuOSwyLTIsMmwtMjE0LTIuNyBDNDAuOSwxOTAuMiw0MCwxODkuNCw0MCwxODguM3oiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTIyOCw4Mi40aDE0YzAuOSwwLDEuNiwwLjcsMS42LDEuNnYxNGMwLDAuOS0wLjcsMS42LTEuNiwxLjZoLTE0Yy0wLjksMC0xLjYtMC43LTEuNi0xLjZWODQgQzIyNi40LDgzLjEsMjI3LjEsODIuNCwyMjgsODIuNHoiLz4gPC9nPiA8L3N2Zz4K";

/***/ }),

/***/ "./images/spot/discover-tour-explore.svg":
/*!***********************************************!*\
  !*** ./images/spot/discover-tour-explore.svg ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/discover-tour-explore.e00a99a4ab0e422b0fb5.svg";

/***/ }),

/***/ "./images/spot/discover-tour-filter.svg":
/*!**********************************************!*\
  !*** ./images/spot/discover-tour-filter.svg ***!
  \**********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMzQyIDE0MyIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMzQyIDE0MzsiIHhtbDpzcGFjZT0icHJlc2VydmUiPiA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPiAuc3Qwe2ZpbGw6I0MxQjJERDt9IC5zdDF7ZmlsbDpub25lO3N0cm9rZTojM0UyQzczO3N0cm9rZS13aWR0aDowLjc1O30gLnN0MntmaWxsOiM1QTRBNzk7fSAuc3Qze2ZpbGw6IzNFMkM3Mzt9IC5zdDR7ZmlsbDpub25lO3N0cm9rZTojRkY3NzM4O3N0cm9rZS13aWR0aDoxLjU7fSAudHlwZSB7IGZpbGw6I0ZGNzczODsgfSAudHlwZTIgeyBvcGFjaXR5OiAwOyBhbmltYXRpb246IHR5cGUyIDRzIGluZmluaXRlOyB9IC50eXBlMyB7IG9wYWNpdHk6IDA7IGFuaW1hdGlvbjogdHlwZTMgNHMgaW5maW5pdGU7IH0gLnJlc3VsdHMgeyB0cmFuc2Zvcm0tb3JpZ2luOiAxMCUgY2VudGVyOyBhbmltYXRpb246IHJlc3VsdENoYW5nZSA0cyBpbmZpbml0ZTsgfSBAa2V5ZnJhbWVzIHJlc3VsdENoYW5nZSB7IDAlLCA0OSUgeyB0cmFuc2Zvcm06IHNjYWxlWCgxKTsgfSA1MCUsIDc0JSB7IHRyYW5zZm9ybTogc2NhbGVYKDAuNyk7IH0gNzUlLCA5OSUgeyB0cmFuc2Zvcm06IHNjYWxlWCgxLjIpOyB9IDEwMCUgeyB0cmFuc2Zvcm06IHNjYWxlWCgxKTsgfSB9IEBrZXlmcmFtZXMgdHlwZTIgeyAwJSwgNDklIHsgb3BhY2l0eTogMDsgfSA1MCUsIDk5JSB7IG9wYWNpdHk6IDE7IH0gMTAwJSB7IG9wYWNpdHk6IDA7IH0gfSBAa2V5ZnJhbWVzIHR5cGUzIHsgMCUsIDc0JSB7IG9wYWNpdHk6IDA7IH0gNzUlLCA5OSUgeyBvcGFjaXR5OiAxOyB9IDEwMCUgeyBvcGFjaXR5OiAwOyB9IH0gPC9zdHlsZT4gPGcgaWQ9ImhpZ2hsaWdodCI+IDxyZWN0IHg9IjEiIHk9IjMwIiBjbGFzcz0ic3QwIiB3aWR0aD0iMzQwIiBoZWlnaHQ9IjE5Ii8+IDwvZz4gPGcgaWQ9ImJvcmRlciI+IDxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0zMzkuMSwxMzkuOUwzMzksNS4xYzAtMS4xLTAuOS0yLTItMkw0LjgsNC4xYy0xLjEsMC0yLDAuOS0yLDJMMi4xLDEzOC43YzAsMS4xLDAuOSwyLDIsMmwzMzMsMS4yIEMzMzguMiwxNDEuOSwzMzkuMSwxNDEsMzM5LjEsMTM5Ljl6Ii8+IDwvZz4gPGcgaWQ9Im1hcmtlcnMiPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTMsMzloOGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMWgtOGMtMC42LDAtMS0wLjQtMS0xbDAsMEMxMiwzOS40LDEyLjQsMzksMTMsMzl6Ii8+IDxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMyw2MGg4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC04Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzEyLDYwLjQsMTIuNCw2MCwxMyw2MHoiLz4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTEzLDcxaDhjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFoLThjLTAuNiwwLTEtMC40LTEtMWwwLDBDMTIsNzEuNCwxMi40LDcxLDEzLDcxeiIvPiA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTMsODJoOGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMWgtOGMtMC42LDAtMS0wLjQtMS0xbDAsMEMxMiw4Mi40LDEyLjQsODIsMTMsODJ6Ii8+IDxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMyw5M2g4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC04Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzEyLDkzLjQsMTIuNCw5MywxMyw5M3oiLz4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTEzLDEwNGg4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC04Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzEyLDEwNC40LDEyLjQsMTA0LDEzLDEwNHoiLz4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTEzLDExNWg4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC04Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzEyLDExNS40LDEyLjQsMTE1LDEzLDExNXoiLz4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTEzLDEyNmg4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC04Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzEyLDEyNi40LDEyLjQsMTI2LDEzLDEyNnoiLz4gPC9nPiA8ZyBpZD0icmVzdWx0cyIgY2xhc3M9InJlc3VsdHMiPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMzQsMzloODVjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMzRjLTAuNiwwLTEtMC40LTEtMWwwLDBDMzMsMzkuNCwzMy40LDM5LDM0LDM5eiIvPiA8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzQsNjBoNzNjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMzRjLTAuNiwwLTEtMC40LTEtMWwwLDBDMzMsNjAuNCwzMy40LDYwLDM0LDYweiIvPiA8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzQsNzFoMTYyYzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM0Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzMzLDcxLjQsMzMuNCw3MSwzNCw3MXoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTM0LDgyaDE4NWMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgzNGMtMC42LDAtMS0wLjQtMS0xbDAsMEMzMyw4Mi40LDMzLjQsODIsMzQsODJ6Ii8+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNCw5M2g2MWMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgzNGMtMC42LDAtMS0wLjQtMS0xbDAsMEMzMyw5My40LDMzLjQsOTMsMzQsOTN6Ii8+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNCwxMDRoMTE4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM0Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzMzLDEwNC40LDMzLjQsMTA0LDM0LDEwNHoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTM0LDExNWgzOWMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgzNGMtMC42LDAtMS0wLjQtMS0xbDAsMEMzMywxMTUuNCwzMy40LDExNSwzNCwxMTV6Ii8+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNCwxMjZoOTZjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMzRjLTAuNiwwLTEtMC40LTEtMWwwLDBDMzMsMTI2LjQsMzMuNCwxMjYsMzQsMTI2eiIvPiA8L2c+IDxnIGlkPSJzZWFyY2giPiA8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMS43LDI0LjVMMS4xLDMuMWMwLTEuMSwwLjktMiwyLTJMMzM4LDMuNGMxLjEsMCwyLDAuOSwyLDEuOWwwLjYsMjAuN2MwLDEuMS0wLjksMi4xLTIsMi4xbC0zMzUtMS42IEMyLjYsMjYuNSwxLjcsMjUuNiwxLjcsMjQuNXoiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE5LjYsMTUuM2wzLjEsMy4xYzAuNCwwLjQsMC40LDAuOSwwLDEuM2MtMC40LDAuNC0wLjksMC40LTEuMywwbC0zLjEtMy4xYy0wLjYsMC40LTEuNCwwLjYtMi4yLDAuNiBjLTIuMywwLTQuMS0xLjgtNC4xLTQuMVMxMy44LDksMTYuMSw5czQuMSwxLjgsNC4xLDQuMUMyMC4yLDEzLjksMjAsMTQuNywxOS42LDE1LjN6IE0xNi4xLDE1LjRjMS4zLDAsMi4zLTEsMi4zLTIuMyBzLTEtMi4zLTIuMy0yLjNzLTIuMywxLTIuMywyLjNTMTQuOCwxNS40LDE2LjEsMTUuNHoiLz4gPC9nPiA8cGF0aCBjbGFzcz0idHlwZSB0eXBlMSIgZD0iTTM0LDEzaDU1YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM0Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzMzLDEzLjQsMzMuNCwxMywzNCwxM3oiLz4gPHBhdGggY2xhc3M9InR5cGUgdHlwZTIiIGQ9Ik05NywxM2gxN2MwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUg5N2MtMC42LDAtMS0wLjQtMS0xbDAsMEM5NiwxMy40LDk2LjQsMTMsOTcsMTN6Ii8+IDxwYXRoIGNsYXNzPSJ0eXBlIHR5cGUzIiBkPSJNMTIxLDEzaDY5YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC02OWMtMC42LDAtMS0wLjQtMS0xbDAsMEMxMjAsMTMuNCwxMjAuNCwxMywxMjEsMTN6Ii8+IDwvc3ZnPgo=";

/***/ }),

/***/ "./images/spot/discover-tour-group.svg":
/*!*********************************************!*\
  !*** ./images/spot/discover-tour-group.svg ***!
  \*********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjg4IDE3MiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMjg4IDE3MjsiIHhtbDpzcGFjZT0icHJlc2VydmUiPiA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPiAuc3Qwe2ZpbGw6bm9uZTtzdHJva2U6IzNFMkM3Mzt9IC5zdDF7ZmlsbDojQzFCMkREO30gLnN0MntmaWxsOiM1QTRBNzk7fSAuc3Qze2ZpbGw6I0ZGRkZGRjtzdHJva2U6IzNFMkM3MztzdHJva2Utd2lkdGg6MC43NTt9IC5zdDR7ZmlsbDpub25lO3N0cm9rZTojRkY3NzM4O3N0cm9rZS13aWR0aDoxLjU7fSAuc3Q1e2ZpbGw6I0VERTdGNTt9IC5zdDZ7ZmlsbDojM0UyQzczO30gLnN0N3tmaWxsOiNGRkZGRkY7fSAuc3Q4e2ZpbGw6I0ZGNzczODt9IC5ib3JkZXJ7ZmlsbDpub25lO3N0cm9rZTojM0UyQzczO3N0cm9rZS13aWR0aDowLjc1O30gLmlucHV0MyB7IGFuaW1hdGlvbjogc2hpZnRJbnB1dDEgOHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7IH0gLmlucHV0NCB7IGFuaW1hdGlvbjogc2hpZnRJbnB1dDIgOHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7IH0gLmlucHV0NSB7IGFuaW1hdGlvbjogc2hpZnRJbnB1dDMgOHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7IH0gQGtleWZyYW1lcyBzaGlmdElucHV0MSB7IDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IDEwJSwgMjAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDE4cHgpOyB9IDMwJSwgNDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDM2cHgpOyB9IDUwJSwgNjAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IDcwJSwgMTAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfSB9IEBrZXlmcmFtZXMgc2hpZnRJbnB1dDIgeyAwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfSAxMCUsIDIwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMThweCk7IH0gMzAlLCA0MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7IH0gNTAlLCA2MCUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMThweCk7IH0gNzAlLCAxMDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IH0gQGtleWZyYW1lcyBzaGlmdElucHV0MyB7IDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IDEwJSwgMjAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IDMwJSwgNDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0zNnB4KTsgfSA1MCUsIDYwJSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMThweCk7IH0gNzAlLCAxMDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9IH0gPC9zdHlsZT4gPGcgaWQ9ImJhY2tncm91bmQiPiA8bGluZSBjbGFzcz0ic3QwIiB4MT0iMCIgeTE9IjE0MC41IiB4Mj0iMjg4IiB5Mj0iMTQwLjUiLz4gPHBhdGggY2xhc3M9InN0MSIgZD0iTTUsN2MwLTEuNywxLjMtMywzLTNoMjc1YzEuNywwLDMsMS4zLDMsM3YyMUg1Vjd6Ii8+IDxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik0zMCwxNmg0NGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgzMGMtMC42LDAtMS0wLjQtMS0xbDAsMEMyOSwxNi40LDI5LjQsMTYsMzAsMTZ6Ii8+IDxwYXRoIGNsYXNzPSJib3JkZXIiIGQ9Ik0yODMuMiwxNjguOEwyODIsM0gzLjVMMiwxNzBMMjgzLjIsMTY4Ljh6Ii8+IDxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0zLjMsMTY3LjFMMiwxaDI4My4zbDAuNywxNzBMMy4zLDE2Ny4xeiIvPiA8cGF0aCBjbGFzcz0ic3Q1IiBkPSJNMTg3LDE0N2gzOS44YzAuNiwwLDEsMC40LDEsMXYxMi40YzAsMC42LTAuNCwxLTEsMUgxODdjLTAuNiwwLTEtMC40LTEtMVYxNDhDMTg2LDE0Ny40LDE4Ni40LDE0NywxODcsMTQ3eiIvPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMjAxLjEsMTUzLjVIMjE0YzAuNCwwLDAuOCwwLjMsMC44LDAuOGwwLDBjMCwwLjQtMC4zLDAuOC0wLjgsMC44aC0xMi45Yy0wLjQsMC0wLjgtMC4zLTAuOC0wLjhsMCwwIEMyMDAuNCwxNTMuOSwyMDAuNywxNTMuNSwyMDEuMSwxNTMuNXoiLz4gPC9nPiA8ZyBpZD0ic2F2ZSIgY2xhc3M9InNhdmUiPiA8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMjM0LDE0N2gzOS44YzAuNiwwLDEsMC40LDEsMXYxMi40YzAsMC42LTAuNCwxLTEsMUgyMzRjLTAuNiwwLTEtMC40LTEtMVYxNDhDMjMzLDE0Ny40LDIzMy40LDE0NywyMzQsMTQ3eiIvPiA8cGF0aCBjbGFzcz0ic3Q3IiBkPSJNMjQ4LjEsMTUzLjVIMjYxYzAuNCwwLDAuOCwwLjMsMC44LDAuOGwwLDBjMCwwLjQtMC4zLDAuOC0wLjgsMC44aC0xMi45Yy0wLjQsMC0wLjgtMC4zLTAuOC0wLjhsMCwwIEMyNDcuNCwxNTMuOSwyNDcuNywxNTMuNSwyNDguMSwxNTMuNXoiLz4gPC9nPiA8ZyBpZD0iaW5wdXQ1IiBjbGFzcz0iaW5wdXQ1Ij4gPGc+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iMTEzIiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iMTEzIiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iMTE4IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iMTE4IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iMTIzIiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iMTIzIiByPSIxIi8+IDwvZz4gPGc+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zMCwxMTIuNGgxMTJjMC4zLDAsMC42LDAuMywwLjYsMC42djEwYzAsMC4zLTAuMywwLjYtMC42LDAuNkgzMGMtMC4zLDAtMC42LTAuMy0wLjYtMC42di0xMCBDMjkuNCwxMTIuNywyOS43LDExMi40LDMwLDExMi40eiIvPiA8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMzcsMTE3aDYwYzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM3Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzM2LDExNy40LDM2LjQsMTE3LDM3LDExN3oiLz4gPC9nPiA8Zz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE1MCwxMTIuNGgxMTRjMC4zLDAsMC42LDAuMywwLjYsMC42djEwYzAsMC4zLTAuMywwLjYtMC42LDAuNkgxNTBjLTAuMywwLTAuNi0wLjMtMC42LTAuNnYtMTAgQzE0OS40LDExMi43LDE0OS43LDExMi40LDE1MCwxMTIuNHoiLz4gPHBhdGggY2xhc3M9InN0NiIgZD0iTTE1NCwxMTdoMzBjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFoLTMwYy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE1MywxMTcuNCwxNTMuNCwxMTcsMTU0LDExN3oiLz4gPC9nPiA8L2c+IDxnIGlkPSJpbnB1dDQiIGNsYXNzPSJpbnB1dDQiPiA8Zz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMTciIGN5PSI5NSIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIyMiIgY3k9Ijk1IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iMTAwIiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iMTAwIiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iMTA1IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iMTA1IiByPSIxIi8+IDwvZz4gPGc+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zMCw5NC40aDExMmMwLjMsMCwwLjYsMC4zLDAuNiwwLjZ2MTBjMCwwLjMtMC4zLDAuNi0wLjYsMC42SDMwYy0wLjMsMC0wLjYtMC4zLTAuNi0wLjZWOTUgQzI5LjQsOTQuNywyOS43LDk0LjQsMzAsOTQuNHoiLz4gPHBhdGggY2xhc3M9InN0NiIgZD0iTTM3LDk5aDM4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM3Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzM2LDk5LjQsMzYuNCw5OSwzNyw5OXoiLz4gPC9nPiA8Zz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE1MCw5NC40aDExNGMwLjMsMCwwLjYsMC4zLDAuNiwwLjZ2MTBjMCwwLjMtMC4zLDAuNi0wLjYsMC42SDE1MGMtMC4zLDAtMC42LTAuMy0wLjYtMC42Vjk1IEMxNDkuNCw5NC43LDE0OS43LDk0LjQsMTUwLDk0LjR6Ii8+IDxwYXRoIGNsYXNzPSJzdDYiIGQ9Ik0xNTQsOTloMTljMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFoLTE5Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE1Myw5OS40LDE1My40LDk5LDE1NCw5OXoiLz4gPC9nPiA8L2c+IDxnIGlkPSJpbnB1dDMiIGNsYXNzPSJpbnB1dDMiPiA8Zz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMTciIGN5PSI3NyIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIyMiIgY3k9Ijc3IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iODIiIHI9IjEiLz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMjIiIGN5PSI4MiIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIxNyIgY3k9Ijg3IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iODciIHI9IjEiLz4gPC9nPiA8Zz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTMwLDc2LjRoMTEyYzAuMywwLDAuNiwwLjMsMC42LDAuNnYxMGMwLDAuMy0wLjMsMC42LTAuNiwwLjZIMzBjLTAuMywwLTAuNi0wLjMtMC42LTAuNlY3NyBDMjkuNCw3Ni43LDI5LjcsNzYuNCwzMCw3Ni40eiIvPiA8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMzcsODFoNjBjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMzdjLTAuNiwwLTEtMC40LTEtMWwwLDBDMzYsODEuNCwzNi40LDgxLDM3LDgxeiIvPiA8L2c+IDxnPiA8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMTUwLDc2LjRoMTE0YzAuMywwLDAuNiwwLjMsMC42LDAuNnYxMGMwLDAuMy0wLjMsMC42LTAuNiwwLjZIMTUwYy0wLjMsMC0wLjYtMC4zLTAuNi0wLjZWNzcgQzE0OS40LDc2LjcsMTQ5LjcsNzYuNCwxNTAsNzYuNHoiLz4gPHBhdGggY2xhc3M9InN0NiIgZD0iTTE1NCw4MWgzMGMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMWgtMzBjLTAuNiwwLTEtMC40LTEtMWwwLDBDMTUzLDgxLjQsMTUzLjQsODEsMTU0LDgxeiIvPiA8L2c+IDwvZz4gPGcgaWQ9ImlucHV0MiIgY2xhc3M9ImlucHV0MiI+IDxnPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIxNyIgY3k9IjU5IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iNTkiIHI9IjEiLz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMTciIGN5PSI2NCIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIyMiIgY3k9IjY0IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iNjkiIHI9IjEiLz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMjIiIGN5PSI2OSIgcj0iMSIvPiA8L2c+IDxnPiA8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzAsNTguNGgxMTJjMC4zLDAsMC42LDAuMywwLjYsMC42djEwYzAsMC4zLTAuMywwLjYtMC42LDAuNkgzMGMtMC4zLDAtMC42LTAuMy0wLjYtMC42VjU5IEMyOS40LDU4LjcsMjkuNyw1OC40LDMwLDU4LjR6Ii8+IDxwYXRoIGNsYXNzPSJzdDYiIGQ9Ik0zNyw2M2gyNmMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgzN2MtMC42LDAtMS0wLjQtMS0xbDAsMEMzNiw2My40LDM2LjQsNjMsMzcsNjN6Ii8+IDwvZz4gPGc+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0xNTAsNTguNGgxMTRjMC4zLDAsMC42LDAuMywwLjYsMC42djEwYzAsMC4zLTAuMywwLjYtMC42LDAuNkgxNTBjLTAuMywwLTAuNi0wLjMtMC42LTAuNlY1OSBDMTQ5LjQsNTguNywxNDkuNyw1OC40LDE1MCw1OC40eiIvPiA8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMTU0LDYzaDEyYzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxaC0xMmMtMC42LDAtMS0wLjQtMS0xbDAsMEMxNTMsNjMuNCwxNTMuNCw2MywxNTQsNjN6Ii8+IDwvZz4gPC9nPiA8ZyBpZD0iaW5wdXQxIiBjbGFzcz0iaW5wdXQxIj4gPGc+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjE3IiBjeT0iNDEiIHI9IjEiLz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMjIiIGN5PSI0MSIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIxNyIgY3k9IjQ2IiByPSIxIi8+IDxjaXJjbGUgY2xhc3M9InN0OCIgY3g9IjIyIiBjeT0iNDYiIHI9IjEiLz4gPGNpcmNsZSBjbGFzcz0ic3Q4IiBjeD0iMTciIGN5PSI1MSIgcj0iMSIvPiA8Y2lyY2xlIGNsYXNzPSJzdDgiIGN4PSIyMiIgY3k9IjUxIiByPSIxIi8+IDwvZz4gPGc+IDxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zMCw0MC40aDExMmMwLjMsMCwwLjYsMC4zLDAuNiwwLjZ2MTBjMCwwLjMtMC4zLDAuNi0wLjYsMC42SDMwYy0wLjMsMC0wLjYtMC4zLTAuNi0wLjZWNDEgQzI5LjQsNDAuNywyOS43LDQwLjQsMzAsNDAuNHoiLz4gPHBhdGggY2xhc3M9InN0NiIgZD0iTTM3LDQ1aDYwYzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDM3Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzM2LDQ1LjQsMzYuNCw0NSwzNyw0NXoiLz4gPC9nPiA8Zz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTE1MCw0MC40aDExNGMwLjMsMCwwLjYsMC4zLDAuNiwwLjZ2MTBjMCwwLjMtMC4zLDAuNi0wLjYsMC42SDE1MGMtMC4zLDAtMC42LTAuMy0wLjYtMC42VjQxIEMxNDkuNCw0MC43LDE0OS43LDQwLjQsMTUwLDQwLjR6Ii8+IDxwYXRoIGNsYXNzPSJzdDYiIGQ9Ik0xNTQsNDVoMzBjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFoLTMwYy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE1Myw0NS40LDE1My40LDQ1LDE1NCw0NXoiLz4gPC9nPiA8L2c+IDwvc3ZnPgo=";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_events_tsx-app_components_charts_loadingPanel_tsx-app_views_eventsV2_landing_tsx.aeefea65d18976792022e9f55d8afe90.js.map