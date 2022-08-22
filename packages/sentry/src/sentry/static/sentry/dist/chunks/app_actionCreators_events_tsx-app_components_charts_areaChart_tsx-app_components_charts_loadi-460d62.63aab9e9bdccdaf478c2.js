"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_events_tsx-app_components_charts_areaChart_tsx-app_components_charts_loadi-460d62"],{

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

/***/ "./app/components/events/searchBar.tsx":
/*!*********************************************!*\
  !*** ./app/components/events/searchBar.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/assign */ "../node_modules/lodash/assign.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_assign__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withTags */ "./app/utils/withTags.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(`^${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.NEGATION_OPERATOR}|\\${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.SEARCH_WILDCARD}`, 'g');

const getFunctionTags = fields => Object.fromEntries(fields.filter(item => !Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).includes(item.field) && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isEquation)(item.field)).map(item => [item.field, {
  key: item.field,
  name: item.field,
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FUNCTION
}]));

const getFieldTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

const getMeasurementTags = measurements => Object.fromEntries(Object.keys(measurements).map(key => [key, { ...measurements[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.MEASUREMENT
}]));

const getSpanTags = () => {
  return Object.fromEntries(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SPAN_OP_BREAKDOWN_FIELDS.map(key => [key, {
    key,
    name: key,
    kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.METRICS
  }]));
};

const getSemverTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

function SearchBar(props) {
  const {
    maxSearchItems,
    organization,
    tags,
    omitTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    maxMenuHeight
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    var _getEventFieldValues$, _getEventFieldValues$2;

    // Clear memoized data on mount to make tests more consistent.
    (_getEventFieldValues$ = (_getEventFieldValues$2 = getEventFieldValues.cache).clear) === null || _getEventFieldValues$ === void 0 ? void 0 : _getEventFieldValues$.call(_getEventFieldValues$2); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds]); // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready

  const getEventFieldValues = lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default()((tag, query, endpointParams) => {
    const projectIdStrings = projectIds === null || projectIds === void 0 ? void 0 : projectIds.map(String);

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isAggregateField)(tag.key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isMeasurement)(tag.key)) {
      // We can't really auto suggest values for aggregate fields
      // or measurements, so we simply don't
      return Promise.resolve([]);
    }

    return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__.fetchTagValues)(api, organization.slug, tag.key, query, projectIdStrings, endpointParams, // allows searching for tags on transactions as well
    true, // allows searching for tags on sessions as well
    includeSessionTagsValues).then(results => lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default()(results.filter(_ref => {
      let {
        name
      } = _ref;
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(name);
    }).map(_ref2 => {
      let {
        name
      } = _ref2;
      return name;
    })), () => {
      throw new Error('Unable to fetch event field values');
    });
  }, (_ref3, query) => {
    let {
      key
    } = _ref3;
    return `${key}-${query}`;
  });

  const getTagList = measurements => {
    const functionTags = getFunctionTags(fields !== null && fields !== void 0 ? fields : []);
    const fieldTags = getFieldTags();
    const measurementsWithKind = getMeasurementTags(measurements);
    const spanTags = getSpanTags();
    const semverTags = getSemverTags();
    const orgHasPerformanceView = organization.features.includes('performance-view');
    const combinedTags = orgHasPerformanceView ? Object.assign({}, measurementsWithKind, spanTags, fieldTags, functionTags) : lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(fieldTags, sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.TRACING_FIELDS);
    const tagsWithKind = Object.fromEntries(Object.keys(tags).map(key => [key, { ...tags[key],
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.TAG
    }]));
    lodash_assign__WEBPACK_IMPORTED_MODULE_4___default()(combinedTags, tagsWithKind, fieldTags, semverTags);
    const sortedTagKeys = Object.keys(combinedTags);
    sortedTagKeys.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    combinedTags.has = {
      key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKey.HAS,
      name: 'Has property',
      values: sortedTagKeys,
      predefined: true,
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
    };
    return lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(combinedTags, omitTags !== null && omitTags !== void 0 ? omitTags : []);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__["default"], {
    children: _ref4 => {
      let {
        measurements
      } = _ref4;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
        hasRecentSearches: true,
        savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_11__.SavedSearchType.EVENT,
        onGetTagValues: getEventFieldValues,
        supportedTags: getTagList(measurements),
        prepareQuery: query => {
          // Prepare query string (e.g. strip special characters like negation operator)
          return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
        },
        maxSearchItems: maxSearchItems,
        excludeEnvironment: true,
        maxMenuHeight: maxMenuHeight !== null && maxMenuHeight !== void 0 ? maxMenuHeight : 300,
        ...props
      });
    }
  });
}

SearchBar.displayName = "SearchBar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__["default"])(SearchBar));

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

/***/ "./app/utils/withTags.tsx":
/*!********************************!*\
  !*** ./app/utils/withTags.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/tagStore */ "./app/stores/tagStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * HOC for getting *only* tags from the TagStore.
 */
function withTags(WrappedComponent) {
  class WithTags extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        tags: sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].getStateTags()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(tags => this.setState({
        tags
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        tags,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        tags: tags !== null && tags !== void 0 ? tags : this.state.tags,
        ...props
      });
    }

  }

  WithTags.displayName = "WithTags";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithTags, "displayName", `withTags(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithTags;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withTags);

/***/ }),

/***/ "./app/views/eventsV2/table/arithmeticInput.tsx":
/*!******************************************************!*\
  !*** ./app/views/eventsV2/table/arithmeticInput.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ArithmeticInput)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.match-all.js */ "../node_modules/core-js/modules/es.string.match-all.js");
/* harmony import */ var core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const NONE_SELECTED = -1;
class ArithmeticInput extends react__WEBPACK_IMPORTED_MODULE_6__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      query: this.props.value,
      partialTerm: null,
      rawOptions: this.props.options,
      dropdownVisible: false,
      dropdownOptionGroups: makeOptions(this.props.options, null, this.props.hideFieldOptions),
      activeSelection: NONE_SELECTED
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "input", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_6__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "blur", () => {
      var _this$input$current;

      (_this$input$current = this.input.current) === null || _this$input$current === void 0 ? void 0 : _this$input$current.blur();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "focus", position => {
      var _this$input$current2, _this$input$current3;

      (_this$input$current2 = this.input.current) === null || _this$input$current2 === void 0 ? void 0 : _this$input$current2.focus();
      (_this$input$current3 = this.input.current) === null || _this$input$current3 === void 0 ? void 0 : _this$input$current3.setSelectionRange(position, position);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", event => {
      const query = event.target.value.replace('\n', '');
      this.setState({
        query
      }, this.updateAutocompleteOptions);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClick", () => {
      this.updateAutocompleteOptions();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFocus", () => {
      this.setState({
        dropdownVisible: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBlur", () => {
      this.props.onUpdate(this.state.query);
      this.setState({
        dropdownVisible: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyDown", event => {
      const {
        key
      } = event;
      const {
        options,
        hideFieldOptions
      } = this.props;
      const {
        activeSelection,
        partialTerm
      } = this.state;
      const startedSelection = activeSelection >= 0; // handle arrow navigation

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        const newOptionGroups = makeOptions(options, partialTerm, hideFieldOptions);
        const flattenedOptions = newOptionGroups.map(group => group.options).flat();

        if (flattenedOptions.length === 0) {
          return;
        }

        let newSelection;

        if (!startedSelection) {
          newSelection = key === 'ArrowUp' ? flattenedOptions.length - 1 : 0;
        } else {
          newSelection = key === 'ArrowUp' ? (activeSelection - 1 + flattenedOptions.length) % flattenedOptions.length : (activeSelection + 1) % flattenedOptions.length;
        } // This is modifying the `active` value of the references so make sure to
        // use `newOptionGroups` at the end.


        flattenedOptions[newSelection].active = true;
        this.setState({
          activeSelection: newSelection,
          dropdownOptionGroups: newOptionGroups
        });
        return;
      } // handle selection


      if (startedSelection && (key === 'Tab' || key === 'Enter')) {
        event.preventDefault();
        const selection = this.getSelection(activeSelection);

        if (selection) {
          this.handleSelect(selection);
        }

        return;
      }

      if (key === 'Enter') {
        this.blur();
        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyUp", event => {
      // Other keys are managed at handleKeyDown function
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      const {
        activeSelection
      } = this.state;
      const startedSelection = activeSelection >= 0;

      if (!startedSelection) {
        this.blur();
        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelect", option => {
      const {
        prefix,
        suffix
      } = this.splitQuery();
      this.setState({
        // make sure to insert a space after the autocompleted term
        query: `${prefix}${option.value} ${suffix}`,
        activeSelection: NONE_SELECTED
      }, () => {
        // updating the query will cause the input to lose focus
        // and make sure to move the cursor behind the space after
        // the end of the autocompleted term
        this.focus(prefix.length + option.value.length + 1);
        this.updateAutocompleteOptions();
      });
    });
  }

  static getDerivedStateFromProps(props, state) {
    const changed = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()(state.rawOptions, props.options);

    if (changed) {
      return { ...state,
        rawOptions: props.options,
        dropdownOptionGroups: makeOptions(props.options, state.partialTerm, props.hideFieldOptions),
        activeSelection: NONE_SELECTED
      };
    }

    return { ...state
    };
  }

  getCursorPosition() {
    var _this$input$current$s, _this$input$current4;

    return (_this$input$current$s = (_this$input$current4 = this.input.current) === null || _this$input$current4 === void 0 ? void 0 : _this$input$current4.selectionStart) !== null && _this$input$current$s !== void 0 ? _this$input$current$s : -1;
  }

  splitQuery() {
    const {
      query
    } = this.state;
    const currentPosition = this.getCursorPosition(); // The current term is delimited by whitespaces. So if no spaces are found,
    // the entire string is taken to be 1 term.
    //
    // TODO: add support for when there are no spaces

    const matches = [...query.substring(0, currentPosition).matchAll(/\s|^/g)];
    const match = matches[matches.length - 1];
    const startOfTerm = match[0] === '' ? 0 : (match.index || 0) + 1;
    const cursorOffset = query.slice(currentPosition).search(/\s|$/);
    const endOfTerm = currentPosition + (cursorOffset === -1 ? 0 : cursorOffset);
    return {
      startOfTerm,
      endOfTerm,
      prefix: query.substring(0, startOfTerm),
      term: query.substring(startOfTerm, endOfTerm),
      suffix: query.substring(endOfTerm)
    };
  }

  getSelection(selection) {
    const {
      dropdownOptionGroups
    } = this.state;

    for (const group of dropdownOptionGroups) {
      if (selection >= group.options.length) {
        selection -= group.options.length;
        continue;
      }

      return group.options[selection];
    }

    return null;
  }

  updateAutocompleteOptions() {
    const {
      options,
      hideFieldOptions
    } = this.props;
    const {
      term
    } = this.splitQuery();
    const partialTerm = term || null;
    this.setState({
      dropdownOptionGroups: makeOptions(options, partialTerm, hideFieldOptions),
      partialTerm
    });
  }

  render() {
    const {
      onUpdate: _onUpdate,
      options: _options,
      ...props
    } = this.props;
    const {
      dropdownVisible,
      dropdownOptionGroups
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Container, {
      isOpen: dropdownVisible,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledInput, { ...props,
        ref: this.input,
        autoComplete: "off",
        className: "form-control",
        value: this.state.query,
        onClick: this.handleClick,
        onChange: this.handleChange,
        onBlur: this.handleBlur,
        onFocus: this.handleFocus,
        onKeyDown: this.handleKeyDown,
        spellCheck: false
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(TermDropdown, {
        isOpen: dropdownVisible,
        optionGroups: dropdownOptionGroups,
        handleSelect: this.handleSelect
      })]
    });
  }

}
ArithmeticInput.displayName = "ArithmeticInput";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ArithmeticInput, "defaultProps", {
  options: []
});

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18r1b6w8"
} : 0)("border:1px solid ", p => p.theme.border, ";box-shadow:inset ", p => p.theme.dropShadowLight, ";background:", p => p.theme.background, ";position:relative;border-radius:", p => p.isOpen ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0` : p.theme.borderRadius, ";.show-sidebar &{background:", p => p.theme.backgroundSecondary, ";}" + ( true ? "" : 0));

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e18r1b6w7"
} : 0)( true ? {
  name: "pv1u47",
  styles: "height:40px;padding:7px 10px;border:0;box-shadow:none;&:hover,&:focus{border:0;box-shadow:none;}"
} : 0);

function TermDropdown(_ref) {
  let {
    isOpen,
    optionGroups,
    handleSelect
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DropdownContainer, {
    isOpen: isOpen,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DropdownItemsList, {
      children: optionGroups.map(group => {
        const {
          title,
          options
        } = group;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_6__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(ListItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DropdownTitle, {
              children: title
            })
          }), options.map(option => {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DropdownListItem, {
              className: option.active ? 'active' : undefined,
              onClick: () => handleSelect(option) // prevent the blur event on the input from firing
              ,
              onMouseDown: event => event.preventDefault() // scroll into view if it is the active element
              ,
              ref: element => {
                var _element$scrollIntoVi;

                return option.active && (element === null || element === void 0 ? void 0 : (_element$scrollIntoVi = element.scrollIntoView) === null || _element$scrollIntoVi === void 0 ? void 0 : _element$scrollIntoVi.call(element, {
                  block: 'nearest'
                }));
              },
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DropdownItemTitleWrapper, {
                children: option.value
              })
            }, option.value);
          }), options.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Info, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No items found')
          })]
        }, title);
      })
    })
  });
}

TermDropdown.displayName = "TermDropdown";

function makeFieldOptions(columns, partialTerm) {
  const fieldValues = new Set();
  const options = columns.filter(_ref2 => {
    let {
      kind
    } = _ref2;
    return kind !== 'equation';
  }).filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.isLegalEquationColumn).map(option => ({
    kind: 'field',
    active: false,
    value: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.generateFieldAsString)(option)
  })).filter(_ref3 => {
    let {
      value
    } = _ref3;

    if (fieldValues.has(value)) {
      return false;
    }

    fieldValues.add(value);
    return true;
  }).filter(_ref4 => {
    let {
      value
    } = _ref4;
    return partialTerm ? value.includes(partialTerm) : true;
  });
  return {
    title: 'Fields',
    options
  };
}

function makeOperatorOptions(partialTerm) {
  const options = ['+', '-', '*', '/', '(', ')'].filter(operator => partialTerm ? operator.includes(partialTerm) : true).map(operator => ({
    kind: 'operator',
    active: false,
    value: operator
  }));
  return {
    title: 'Operators',
    options
  };
}

function makeOptions(columns, partialTerm, hideFieldOptions) {
  if (hideFieldOptions) {
    return [makeOperatorOptions(partialTerm)];
  }

  return [makeFieldOptions(columns, partialTerm), makeOperatorOptions(partialTerm)];
}

const DropdownContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18r1b6w6"
} : 0)("display:", p => p.isOpen ? 'block' : 'none', ";position:absolute;top:100%;left:-1px;right:-1px;z-index:", p => p.theme.zIndex.dropdown, ";background:", p => p.theme.background, ";box-shadow:", p => p.theme.dropShadowLight, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadiusBottom, ";max-height:300px;overflow-y:auto;" + ( true ? "" : 0));

const DropdownItemsList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('ul',  true ? {
  target: "e18r1b6w5"
} : 0)( true ? {
  name: "nfj5ll",
  styles: "padding-left:0;list-style:none;margin-bottom:0"
} : 0);

const ListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  target: "e18r1b6w4"
} : 0)("&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const DropdownTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('header',  true ? {
  target: "e18r1b6w3"
} : 0)("display:flex;align-items:center;background-color:", p => p.theme.backgroundSecondary, ";color:", p => p.theme.gray300, ";font-weight:normal;font-size:", p => p.theme.fontSizeMedium, ";margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";&>svg{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}" + ( true ? "" : 0));

const DropdownListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ListItem,  true ? {
  target: "e18r1b6w2"
} : 0)("scroll-margin:40px 0;font-size:", p => p.theme.fontSizeLarge, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";cursor:pointer;&:hover,&.active{background:", p => p.theme.hover, ";}" + ( true ? "" : 0));

const DropdownItemTitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18r1b6w1"
} : 0)("color:", p => p.theme.textColor, ";font-weight:normal;font-size:", p => p.theme.fontSizeMedium, ";margin:0;line-height:", p => p.theme.text.lineHeightHeading, ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const Info = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18r1b6w0"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";font-size:", p => p.theme.fontSizeLarge, ";color:", p => p.theme.gray300, ";&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/eventsV2/table/queryField.tsx":
/*!*************************************************!*\
  !*** ./app/views/eventsV2/table/queryField.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "QueryField": () => (/* binding */ QueryField)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_animations__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/animations */ "./app/styles/animations.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _arithmeticInput__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./arithmeticInput */ "./app/views/eventsV2/table/arithmeticInput.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















class QueryField extends react__WEBPACK_IMPORTED_MODULE_6__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "FieldSelectComponents", {
      SingleValue: _ref => {
        let {
          data,
          ...props
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react_select__WEBPACK_IMPORTED_MODULE_21__.y.SingleValue, {
          data: data,
          ...props,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("span", {
            "data-test-id": "label",
            children: data.label
          }), data.value && this.renderTag(data.value.kind, data.label)]
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "FieldSelectStyles", {
      singleValue(provided) {
        const custom = {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        };
        return { ...provided,
          ...custom
        };
      }

    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", selected => {
      if (!selected) {
        return;
      }

      const {
        value
      } = selected;
      const current = this.props.fieldValue;
      let fieldValue = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(this.props.fieldValue);

      switch (value.kind) {
        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG:
        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.MEASUREMENT:
        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT:
        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.BREAKDOWN:
        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FIELD:
          fieldValue = {
            kind: 'field',
            field: value.meta.name
          };
          break;

        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.NUMERIC_METRICS:
          fieldValue = {
            kind: 'calculatedField',
            field: value.meta.name
          };
          break;

        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FUNCTION:
          if (current.kind === 'function') {
            fieldValue = {
              kind: 'function',
              function: [value.meta.name, current.function[1], current.function[2], current.function[3]]
            };
          } else {
            fieldValue = {
              kind: 'function',
              function: [value.meta.name, '', undefined, undefined]
            };
          }

          break;

        case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.EQUATION:
          fieldValue = {
            kind: 'equation',
            field: value.meta.name,
            alias: value.meta.name
          };
          break;

        default:
          throw new Error('Invalid field type found in column picker');
      }

      if (value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FUNCTION) {
        value.meta.parameters.forEach((param, i) => {
          if (fieldValue.kind !== 'function') {
            return;
          }

          if (param.kind === 'column') {
            const field = this.getFieldOrTagOrMeasurementValue(fieldValue.function[i + 1]);

            if (field === null) {
              fieldValue.function[i + 1] = param.defaultValue || '';
            } else if ((field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FIELD || field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG || field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.MEASUREMENT || field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT || field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.METRICS || field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.BREAKDOWN) && validateColumnTypes(param.columnTypes, field)) {
              // New function accepts current field.
              fieldValue.function[i + 1] = field.meta.name;
            } else {
              // field does not fit within new function requirements, use the default.
              fieldValue.function[i + 1] = param.defaultValue || '';
              fieldValue.function[i + 2] = undefined;
              fieldValue.function[i + 3] = undefined;
            }
          } else {
            fieldValue.function[i + 1] = param.defaultValue || '';
          }
        });

        if (fieldValue.kind === 'function') {
          if (value.meta.parameters.length === 0) {
            fieldValue.function = [fieldValue.function[0], '', undefined, undefined];
          } else if (value.meta.parameters.length === 1) {
            fieldValue.function[2] = undefined;
            fieldValue.function[3] = undefined;
          } else if (value.meta.parameters.length === 2) {
            fieldValue.function[3] = undefined;
          }
        }
      }

      this.triggerChange(fieldValue);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEquationChange", value => {
      const newColumn = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(this.props.fieldValue);

      if (newColumn.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.EQUATION) {
        newColumn.field = value;
      }

      this.triggerChange(newColumn);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldParameterChange", _ref2 => {
      let {
        value
      } = _ref2;
      const newColumn = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(this.props.fieldValue);

      if (newColumn.kind === 'function') {
        newColumn.function[1] = value.meta.name;
      }

      this.triggerChange(newColumn);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDropdownParameterChange", index => {
      return value => {
        const newColumn = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(this.props.fieldValue);

        if (newColumn.kind === 'function') {
          newColumn.function[index] = value.value;
        }

        this.triggerChange(newColumn);
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleScalarParameterChange", index => {
      return value => {
        const newColumn = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(this.props.fieldValue);

        if (newColumn.kind === 'function') {
          newColumn.function[index] = value;
        }

        this.triggerChange(newColumn);
      };
    });
  }

  triggerChange(fieldValue) {
    this.props.onChange(fieldValue);
  }

  getFieldOrTagOrMeasurementValue(name) {
    let functions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    const {
      fieldOptions
    } = this.props;

    if (name === undefined) {
      return null;
    }

    const fieldName = `field:${name}`;

    if (fieldOptions[fieldName]) {
      return fieldOptions[fieldName].value;
    }

    const measurementName = `measurement:${name}`;

    if (fieldOptions[measurementName]) {
      return fieldOptions[measurementName].value;
    }

    const spanOperationBreakdownName = `span_op_breakdown:${name}`;

    if (fieldOptions[spanOperationBreakdownName]) {
      return fieldOptions[spanOperationBreakdownName].value;
    }

    const equationName = `equation:${name}`;

    if (fieldOptions[equationName]) {
      return fieldOptions[equationName].value;
    }

    const tagName = name.indexOf('tags[') === 0 ? `tag:${name.replace(/tags\[(.*?)\]/, '$1')}` : `tag:${name}`;

    if (fieldOptions[tagName]) {
      return fieldOptions[tagName].value;
    }

    if (name.length > 0) {
      // Custom Measurement. Probably not appearing in field options because
      // no metrics found within selected time range
      if (name.startsWith('measurements.')) {
        return {
          kind: _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT,
          meta: {
            name,
            dataType: 'number',
            functions
          }
        };
      } // Likely a tag that was deleted but left behind in a saved query
      // Cook up a tag option so select control works.


      return {
        kind: _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG,
        meta: {
          name,
          dataType: 'string',
          unknown: true
        }
      };
    }

    return null;
  }

  getFieldData() {
    let field = null;
    const {
      fieldValue
    } = this.props;
    let {
      fieldOptions
    } = this.props;

    if ((fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === 'function') {
      const funcName = `function:${fieldValue.function[0]}`;

      if (fieldOptions[funcName] !== undefined) {
        field = fieldOptions[funcName].value;
      }
    }

    if ((fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === 'field' || (fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === 'calculatedField') {
      field = this.getFieldOrTagOrMeasurementValue(fieldValue.field);
      fieldOptions = this.appendFieldIfUnknown(fieldOptions, field);
    }

    let parameterDescriptions = []; // Generate options and values for each parameter.

    if (field && field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FUNCTION && field.meta.parameters.length > 0 && (fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FUNCTION) {
      parameterDescriptions = field.meta.parameters.map((param, index) => {
        if (param.kind === 'column') {
          const fieldParameter = this.getFieldOrTagOrMeasurementValue(fieldValue.function[1], [fieldValue.function[0]]);
          fieldOptions = this.appendFieldIfUnknown(fieldOptions, fieldParameter);
          return {
            kind: 'column',
            value: fieldParameter,
            required: param.required,
            options: Object.values(fieldOptions).filter(_ref3 => {
              let {
                value
              } = _ref3;
              return (value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FIELD || value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG || value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.MEASUREMENT || value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT || value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.METRICS || value.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.BREAKDOWN) && validateColumnTypes(param.columnTypes, value);
            })
          };
        }

        if (param.kind === 'dropdown') {
          return {
            kind: 'dropdown',
            options: param.options,
            dataType: param.dataType,
            required: param.required,
            value: fieldValue.kind === 'function' && fieldValue.function[index + 1] || param.defaultValue || ''
          };
        }

        return {
          kind: 'value',
          value: fieldValue.kind === 'function' && fieldValue.function[index + 1] || param.defaultValue || '',
          dataType: param.dataType,
          required: param.required,
          placeholder: param.placeholder
        };
      });
    }

    return {
      field,
      fieldOptions,
      parameterDescriptions
    };
  }

  appendFieldIfUnknown(fieldOptions, field) {
    if (!field) {
      return fieldOptions;
    }

    if (field && field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG && field.meta.unknown) {
      // Clone the options so we don't mutate other rows.
      fieldOptions = Object.assign({}, fieldOptions);
      fieldOptions[field.meta.name] = {
        label: field.meta.name,
        value: field
      };
    } else if (field && field.kind === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT) {
      fieldOptions = Object.assign({}, fieldOptions);
      fieldOptions[`measurement:${field.meta.name}`] = {
        label: field.meta.name,
        value: field
      };
    }

    return fieldOptions;
  }

  renderParameterInputs(parameters) {
    const {
      disabled,
      inFieldLabels,
      filterAggregateParameters,
      hideParameterSelector,
      skipParameterPlaceholder,
      fieldValue
    } = this.props;
    const inputs = parameters.map((descriptor, index) => {
      if (descriptor.kind === 'column' && descriptor.options.length > 0) {
        if (hideParameterSelector) {
          return null;
        }

        const aggregateParameters = filterAggregateParameters ? descriptor.options.filter(option => filterAggregateParameters(option, fieldValue)) : descriptor.options;
        aggregateParameters.forEach(opt => {
          opt.trailingItems = this.renderTag(opt.value.kind, String(opt.label));
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__["default"], {
          name: "parameter",
          menuPlacement: "auto",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Select value'),
          options: aggregateParameters,
          value: descriptor.value,
          required: descriptor.required,
          onChange: this.handleFieldParameterChange,
          inFieldLabel: inFieldLabels ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Parameter: ') : undefined,
          disabled: disabled,
          styles: !inFieldLabels ? this.FieldSelectStyles : undefined,
          components: this.FieldSelectComponents
        }, "select");
      }

      if (descriptor.kind === 'value') {
        const inputProps = {
          required: descriptor.required,
          value: descriptor.value,
          onUpdate: this.handleScalarParameterChange(index + 1),
          placeholder: descriptor.placeholder,
          disabled
        };

        switch (descriptor.dataType) {
          case 'number':
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(BufferedInput, {
              name: "refinement",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*(\\.[0-9]*)?",
              ...inputProps
            }, "parameter:number");

          case 'integer':
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(BufferedInput, {
              name: "refinement",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              ...inputProps
            }, "parameter:integer");

          default:
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(BufferedInput, {
              name: "refinement",
              type: "text",
              ...inputProps
            }, "parameter:text");
        }
      }

      if (descriptor.kind === 'dropdown') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__["default"], {
          name: "dropdown",
          menuPlacement: "auto",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Select value'),
          options: descriptor.options,
          value: descriptor.value,
          required: descriptor.required,
          onChange: this.handleDropdownParameterChange(index + 1),
          inFieldLabel: inFieldLabels ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Parameter: ') : undefined,
          disabled: disabled
        }, "dropdown");
      }

      throw new Error(`Unknown parameter type encountered for ${this.props.fieldValue}`);
    });

    if (skipParameterPlaceholder) {
      return inputs;
    } // Add enough disabled inputs to fill the grid up.
    // We always have 1 input.


    const {
      gridColumns
    } = this.props;
    const requiredInputs = (gridColumns !== null && gridColumns !== void 0 ? gridColumns : inputs.length + 1) - inputs.length - 1;

    if (gridColumns !== undefined && requiredInputs > 0) {
      for (let i = 0; i < requiredInputs; i++) {
        inputs.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(BlankSpace, {}, i));
      }
    }

    return inputs;
  }

  renderTag(kind, label) {
    const {
      shouldRenderTag
    } = this.props;

    if (shouldRenderTag === false) {
      return null;
    }

    let text, tagType;

    switch (kind) {
      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FUNCTION:
        text = 'f(x)';
        tagType = 'success';
        break;

      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.CUSTOM_MEASUREMENT:
      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.MEASUREMENT:
        text = 'field';
        tagType = 'highlight';
        break;

      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.BREAKDOWN:
        text = 'field';
        tagType = 'highlight';
        break;

      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.TAG:
        text = kind;
        tagType = 'warning';
        break;

      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.NUMERIC_METRICS:
        text = 'f(x)';
        tagType = 'success';
        break;

      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.FIELD:
      case _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.METRICS:
        text = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.DEPRECATED_FIELDS.includes(label) ? 'deprecated' : 'field';
        tagType = 'highlight';
        break;

      default:
        text = kind;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_10__["default"], {
      type: tagType,
      children: text
    });
  }

  render() {
    var _gridColumnsQuantity;

    const {
      className,
      takeFocus,
      filterPrimaryOptions,
      fieldValue,
      inFieldLabels,
      disabled,
      error,
      hidePrimarySelector,
      gridColumns,
      otherColumns,
      placeholder,
      noFieldsMessage,
      skipParameterPlaceholder
    } = this.props;
    const {
      field,
      fieldOptions,
      parameterDescriptions
    } = this.getFieldData();
    const allFieldOptions = filterPrimaryOptions ? Object.values(fieldOptions).filter(filterPrimaryOptions) : Object.values(fieldOptions);
    allFieldOptions.forEach(opt => {
      opt.trailingItems = this.renderTag(opt.value.kind, String(opt.label));
    });
    const selectProps = {
      name: 'field',
      options: Object.values(allFieldOptions),
      placeholder: placeholder !== null && placeholder !== void 0 ? placeholder : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('(Required)'),
      value: field,
      onChange: this.handleFieldChange,
      inFieldLabel: inFieldLabels ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Function: ') : undefined,
      disabled,
      noOptionsMessage: () => noFieldsMessage,
      menuPlacement: 'auto'
    };

    if (takeFocus && field === null) {
      selectProps.autoFocus = true;
    }

    const parameters = this.renderParameterInputs(parameterDescriptions);

    if ((fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === _types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.EQUATION) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Container, {
        className: className,
        gridColumns: 1,
        tripleLayout: false,
        error: error !== undefined,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_arithmeticInput__WEBPACK_IMPORTED_MODULE_18__["default"], {
          name: "arithmetic",
          type: "text",
          required: true,
          value: fieldValue.field,
          onUpdate: this.handleEquationChange,
          options: otherColumns,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Equation')
        }, "parameter:text"), error ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ArithmeticError, {
          title: error,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconWarning, {
            color: "red300"
          })
        }) : null]
      });
    } // if there's more than 2 parameters, set gridColumns to 2 so they go onto the next line instead


    const containerColumns = parameters.length > 2 ? 2 : gridColumns ? gridColumns : parameters.length + 1;
    let gridColumnsQuantity = undefined;

    if (skipParameterPlaceholder) {
      // if the selected field is a function and has parameters, we would like to display each value in separate columns.
      // Otherwise the field should be displayed in a column, taking up all available space and not displaying the "no parameter" field
      if (fieldValue.kind !== 'function') {
        gridColumnsQuantity = 1;
      } else {
        var _AGGREGATIONS$fieldVa;

        const operation = (_AGGREGATIONS$fieldVa = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.AGGREGATIONS[fieldValue.function[0]]) !== null && _AGGREGATIONS$fieldVa !== void 0 ? _AGGREGATIONS$fieldVa : sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_17__.SESSIONS_OPERATIONS[fieldValue.function[0]];

        if (operation.parameters.length > 0) {
          if (containerColumns === 3 && operation.parameters.length === 1) {
            gridColumnsQuantity = 2;
          } else {
            gridColumnsQuantity = containerColumns;
          }
        } else {
          gridColumnsQuantity = 1;
        }
      }
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Container, {
      className: className,
      gridColumns: (_gridColumnsQuantity = gridColumnsQuantity) !== null && _gridColumnsQuantity !== void 0 ? _gridColumnsQuantity : containerColumns,
      tripleLayout: gridColumns === 3 && parameters.length > 2,
      children: [!hidePrimarySelector && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__["default"], { ...selectProps,
        styles: !inFieldLabels ? this.FieldSelectStyles : undefined,
        components: this.FieldSelectComponents
      }), parameters]
    });
  }

}

QueryField.displayName = "QueryField";

function validateColumnTypes(columnTypes, input) {
  if (typeof columnTypes === 'function') {
    return columnTypes({
      name: input.meta.name,
      dataType: input.meta.dataType
    });
  }

  return columnTypes.includes(input.meta.dataType);
}

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eve9joo3"
} : 0)("display:grid;", p => p.tripleLayout ? `grid-template-columns: 1fr 2fr;` : `grid-template-columns: repeat(${p.gridColumns}, 1fr) ${p.error ? 'auto' : ''};`, " gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";align-items:center;flex-grow:1;" + ( true ? "" : 0));

/**
 * Because controlled inputs fire onChange on every key stroke,
 * we can't update the QueryField that often as it would re-render
 * the input elements causing focus to be lost.
 *
 * Using a buffered input lets us throttle rendering and enforce data
 * constraints better.
 */
class BufferedInput extends react__WEBPACK_IMPORTED_MODULE_6__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      value: this.props.value
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "input", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBlur", () => {
      if (this.props.required && this.state.value === '') {
        // Handle empty strings separately because we don't pass required
        // to input elements, causing isValid to return true
        this.setState({
          value: this.props.value
        });
      } else if (this.isValid) {
        this.props.onUpdate(this.state.value);
      } else {
        this.setState({
          value: this.props.value
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", event => {
      if (this.isValid) {
        this.setState({
          value: event.target.value
        });
      }
    });

    this.input = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_6__.createRef)();
  }

  get isValid() {
    if (!this.input.current) {
      return true;
    }

    return this.input.current.validity.valid;
  }

  render() {
    const {
      onUpdate: _,
      ...props
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledInput, { ...props,
      ref: this.input,
      className: "form-control",
      value: this.state.value,
      onChange: this.handleChange,
      onBlur: this.handleBlur
    });
  }

}

BufferedInput.displayName = "BufferedInput";

// Set a min-width to allow shrinkage in grid.
const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "eve9joo2"
} : 0)( true ? {
  name: "9dgk9j",
  styles: "height:41px;min-width:50px"
} : 0);

const BlankSpace = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eve9joo1"
} : 0)("height:41px;min-width:50px;background:", p => p.theme.backgroundSecondary, ";border-radius:", p => p.theme.borderRadius, ";display:flex;align-items:center;justify-content:center;&:after{font-size:", p => p.theme.fontSizeMedium, ";content:'", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No parameter'), "';color:", p => p.theme.gray300, ";}" + ( true ? "" : 0));

const ArithmeticError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "eve9joo0"
} : 0)("color:", p => p.theme.red300, ";animation:", () => (0,sentry_styles_animations__WEBPACK_IMPORTED_MODULE_14__.pulse)(1.15), " 1s ease infinite;display:flex;" + ( true ? "" : 0));



/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_events_tsx-app_components_charts_areaChart_tsx-app_components_charts_loadi-460d62.210ca9a6818253116c116338756c7a7a.js.map