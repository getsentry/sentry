"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_performance_histogram_utils_tsx-app_views_performance_transactionSummary_transactio-36f0d7"],{

/***/ "./app/utils/performance/histogram/utils.tsx":
/*!***************************************************!*\
  !*** ./app/utils/performance/histogram/utils.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "computeBuckets": () => (/* binding */ computeBuckets),
/* harmony export */   "formatHistogramData": () => (/* binding */ formatHistogramData),
/* harmony export */   "getBucketWidth": () => (/* binding */ getBucketWidth)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");


function getBucketWidth(data) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return data.length >= 2 ? data[1].bin - data[0].bin : 0;
}
function computeBuckets(data) {
  const width = getBucketWidth(data);
  return data.map(item => {
    const bucket = item.bin;
    return {
      start: bucket,
      end: bucket + width
    };
  });
}
function formatHistogramData(data) {
  let {
    precision,
    type,
    additionalFieldsFn
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const formatter = value => {
    switch (type) {
      case 'duration':
        const decimalPlaces = precision !== null && precision !== void 0 ? precision : value < 1000 ? 0 : 3;
        return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__.getDuration)(value / 1000, decimalPlaces, true);

      case 'number':
        // This is trying to avoid some of potential rounding errors that cause bins
        // have the same label, if the number of bins doesn't visually match what is
        // expected, check that this rounding is correct. If this issue persists,
        // consider formatting the bin as a string in the response
        const factor = 10 ** (precision !== null && precision !== void 0 ? precision : 0);
        return (Math.round((value + Number.EPSILON) * factor) / factor).toLocaleString();

      default:
        throw new Error(`Unable to format type: ${type}`);
    }
  };

  return data.map(item => {
    var _additionalFieldsFn;

    return {
      value: item.count,
      name: formatter(item.bin),
      ...((_additionalFieldsFn = additionalFieldsFn === null || additionalFieldsFn === void 0 ? void 0 : additionalFieldsFn(item.bin)) !== null && _additionalFieldsFn !== void 0 ? _additionalFieldsFn : {})
    };
  });
}

/***/ }),

/***/ "./app/utils/performance/urls.ts":
/*!***************************************!*\
  !*** ./app/utils/performance/urls.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTransactionDetailsUrl": () => (/* binding */ getTransactionDetailsUrl)
/* harmony export */ });
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function getTransactionDetailsUrl(orgSlug, eventSlug, transaction, query, spanId) {
  const locationQuery = { ...(query || {}),
    transaction
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(locationQuery.transaction)) {
    delete locationQuery.transaction;
  }

  const target = {
    pathname: `/organizations/${orgSlug}/performance/${eventSlug}/`,
    query: locationQuery,
    hash: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(spanId) ? (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__.spanTargetHash)(spanId) : undefined
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(target.hash)) {
    delete target.hash;
  }

  return target;
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionEvents/utils.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventsDisplayFilterName": () => (/* binding */ EventsDisplayFilterName),
/* harmony export */   "decodeEventsDisplayFilterFromLocation": () => (/* binding */ decodeEventsDisplayFilterFromLocation),
/* harmony export */   "eventsRouteWithQuery": () => (/* binding */ eventsRouteWithQuery),
/* harmony export */   "filterEventsDisplayToLocationQuery": () => (/* binding */ filterEventsDisplayToLocationQuery),
/* harmony export */   "getEventsFilterOptions": () => (/* binding */ getEventsFilterOptions),
/* harmony export */   "mapShowTransactionToPercentile": () => (/* binding */ mapShowTransactionToPercentile)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./app/views/performance/transactionSummary/utils.tsx");





let EventsDisplayFilterName;

(function (EventsDisplayFilterName) {
  EventsDisplayFilterName["p50"] = "p50";
  EventsDisplayFilterName["p75"] = "p75";
  EventsDisplayFilterName["p95"] = "p95";
  EventsDisplayFilterName["p99"] = "p99";
  EventsDisplayFilterName["p100"] = "p100";
})(EventsDisplayFilterName || (EventsDisplayFilterName = {}));

function getEventsFilterOptions(spanOperationBreakdownFilter, percentileValues) {
  const {
    p99,
    p95,
    p75,
    p50
  } = percentileValues ? percentileValues : {
    p99: 0,
    p95: 0,
    p75: 0,
    p50: 0
  };
  return {
    [EventsDisplayFilterName.p50]: {
      name: EventsDisplayFilterName.p50,
      query: p50 ? [['transaction.duration', `<=${p50.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: (0,_filter__WEBPACK_IMPORTED_MODULE_3__.filterToField)(spanOperationBreakdownFilter) || 'transaction.duration'
      },
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p50')
    },
    [EventsDisplayFilterName.p75]: {
      name: EventsDisplayFilterName.p75,
      query: p75 ? [['transaction.duration', `<=${p75.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: (0,_filter__WEBPACK_IMPORTED_MODULE_3__.filterToField)(spanOperationBreakdownFilter) || 'transaction.duration'
      },
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p75')
    },
    [EventsDisplayFilterName.p95]: {
      name: EventsDisplayFilterName.p95,
      query: p95 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: (0,_filter__WEBPACK_IMPORTED_MODULE_3__.filterToField)(spanOperationBreakdownFilter) || 'transaction.duration'
      },
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p95')
    },
    [EventsDisplayFilterName.p99]: {
      name: EventsDisplayFilterName.p99,
      query: p99 ? [['transaction.duration', `<=${p99.toFixed(0)}`]] : undefined,
      sort: {
        kind: 'desc',
        field: (0,_filter__WEBPACK_IMPORTED_MODULE_3__.filterToField)(spanOperationBreakdownFilter) || 'transaction.duration'
      },
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p99')
    },
    [EventsDisplayFilterName.p100]: {
      name: EventsDisplayFilterName.p100,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p100')
    }
  };
}
function eventsRouteWithQuery(_ref) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref;
  const pathname = `/organizations/${orgSlug}/performance/summary/events/`;
  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query
    }
  };
}

function stringToFilter(option) {
  if (Object.values(EventsDisplayFilterName).includes(option)) {
    return option;
  }

  return EventsDisplayFilterName.p100;
}

function decodeEventsDisplayFilterFromLocation(location) {
  return stringToFilter((0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__.decodeScalar)(location.query.showTransactions, EventsDisplayFilterName.p100));
}
function filterEventsDisplayToLocationQuery(option, spanOperationBreakdownFilter) {
  var _eventsFilterOptions$, _eventsFilterOptions$2;

  const eventsFilterOptions = getEventsFilterOptions(spanOperationBreakdownFilter);
  const kind = (_eventsFilterOptions$ = eventsFilterOptions[option].sort) === null || _eventsFilterOptions$ === void 0 ? void 0 : _eventsFilterOptions$.kind;
  const field = (_eventsFilterOptions$2 = eventsFilterOptions[option].sort) === null || _eventsFilterOptions$2 === void 0 ? void 0 : _eventsFilterOptions$2.field;
  const query = {
    showTransactions: option
  };

  if (kind && field) {
    query.sort = `${kind === 'desc' ? '-' : ''}${field}`;
  }

  return query;
}
function mapShowTransactionToPercentile(showTransaction) {
  switch (showTransaction) {
    case _utils__WEBPACK_IMPORTED_MODULE_4__.TransactionFilterOptions.OUTLIER:
      return EventsDisplayFilterName.p100;

    case _utils__WEBPACK_IMPORTED_MODULE_4__.TransactionFilterOptions.SLOW:
      return EventsDisplayFilterName.p95;

    default:
      return undefined;
  }
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/transactionSummary/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SidebarSpacer": () => (/* binding */ SidebarSpacer),
/* harmony export */   "TransactionFilterOptions": () => (/* binding */ TransactionFilterOptions),
/* harmony export */   "generateTraceLink": () => (/* binding */ generateTraceLink),
/* harmony export */   "generateTransactionLink": () => (/* binding */ generateTransactionLink),
/* harmony export */   "generateTransactionSummaryRoute": () => (/* binding */ generateTransactionSummaryRoute),
/* harmony export */   "normalizeSearchConditions": () => (/* binding */ normalizeSearchConditions),
/* harmony export */   "normalizeSearchConditionsWithTransactionName": () => (/* binding */ normalizeSearchConditionsWithTransactionName),
/* harmony export */   "transactionSummaryRouteWithQuery": () => (/* binding */ transactionSummaryRouteWithQuery)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");






let TransactionFilterOptions;

(function (TransactionFilterOptions) {
  TransactionFilterOptions["FASTEST"] = "fastest";
  TransactionFilterOptions["SLOW"] = "slow";
  TransactionFilterOptions["OUTLIER"] = "outlier";
  TransactionFilterOptions["RECENT"] = "recent";
})(TransactionFilterOptions || (TransactionFilterOptions = {}));

function generateTransactionSummaryRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/`;
} // normalizes search conditions by removing any redundant search conditions before presenting them in:
// - query strings
// - search UI

function normalizeSearchConditions(query) {
  const filterParams = normalizeSearchConditionsWithTransactionName(query); // no need to include transaction as its already in the query params

  filterParams.removeFilter('transaction');
  return filterParams;
} // normalizes search conditions by removing any redundant search conditions, but retains any transaction name

function normalizeSearchConditionsWithTransactionName(query) {
  const filterParams = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch(query); // remove any event.type queries since it is implied to apply to only transactions

  filterParams.removeFilter('event.type');
  return filterParams;
}
function transactionSummaryRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query,
    unselectedSeries = 'p100()',
    display,
    trendFunction,
    trendColumn,
    showTransactions,
    additionalQuery
  } = _ref2;
  const pathname = generateTransactionSummaryRoute({
    orgSlug
  });
  let searchFilter;

  if (typeof query.query === 'string') {
    searchFilter = normalizeSearchConditions(query.query).formatString();
  } else {
    searchFilter = query.query;
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: searchFilter,
      unselectedSeries,
      showTransactions,
      display,
      trendFunction,
      trendColumn,
      ...additionalQuery
    }
  };
}
function generateTraceLink(dateSelection) {
  return (organization, tableRow, _query) => {
    const traceId = `${tableRow.trace}`;

    if (!traceId) {
      return {};
    }

    return (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__.getTraceDetailsUrl)(organization, traceId, dateSelection, {});
  };
}
function generateTransactionLink(transactionName) {
  return (organization, tableRow, query, spanId) => {
    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__.generateEventSlug)(tableRow);
    return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__.getTransactionDetailsUrl)(organization.slug, eventSlug, transactionName, query, spanId);
  };
}
const SidebarSpacer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1radvp0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/trends/changedTransactions.tsx":
/*!**************************************************************!*\
  !*** ./app/views/performance/trends/changedTransactions.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompareDurations": () => (/* binding */ CompareDurations),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/performance/trends/trendsDiscoverQuery */ "./app/utils/performance/trends/trendsDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ../transactionSummary/transactionOverview/charts */ "./app/views/performance/transactionSummary/transactionOverview/charts.tsx");
/* harmony import */ var _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ../transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _chart__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./chart */ "./app/views/performance/trends/chart.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./types */ "./app/views/performance/trends/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






































const makeTrendsCursorHandler = trendChangeType => (cursor, path, query) => {
  const cursorQuery = {};

  if (trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED) {
    cursorQuery.improvedCursor = cursor;
  } else if (trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.REGRESSION) {
    cursorQuery.regressionCursor = cursor;
  }

  const selectedQueryKey = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getSelectedQueryKey)(trendChangeType);
  delete query[selectedQueryKey];
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
    pathname: path,
    query: { ...query,
      ...cursorQuery
    }
  });
};

function getChartTitle(trendChangeType) {
  switch (trendChangeType) {
    case _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Most Improved Transactions');

    case _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.REGRESSION:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Most Regressed Transactions');

    default:
      throw new Error('No trend type passed');
  }
}

function getSelectedTransaction(location, trendChangeType, transactions) {
  const queryKey = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getSelectedQueryKey)(trendChangeType);
  const selectedTransactionName = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query[queryKey]);

  if (!transactions) {
    return undefined;
  }

  const selectedTransaction = transactions.find(transaction => `${transaction.transaction}-${transaction.project}` === selectedTransactionName);

  if (selectedTransaction) {
    return selectedTransaction;
  }

  return transactions.length > 0 ? transactions[0] : undefined;
}

function handleChangeSelected(location, organization, trendChangeType) {
  return function updateSelected(transaction) {
    const selectedQueryKey = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getSelectedQueryKey)(trendChangeType);
    const query = { ...location.query
    };

    if (!transaction) {
      delete query[selectedQueryKey];
    } else {
      query[selectedQueryKey] = transaction ? `${transaction.transaction}-${transaction.project}` : undefined;
    }

    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
      pathname: location.pathname,
      query
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('performance_views.trends.widget_interaction', {
      organization,
      widget_type: trendChangeType
    });
  };
}

var FilterSymbols;

(function (FilterSymbols) {
  FilterSymbols["GREATER_THAN_EQUALS"] = ">=";
  FilterSymbols["LESS_THAN_EQUALS"] = "<=";
})(FilterSymbols || (FilterSymbols = {}));

function handleFilterTransaction(location, transaction) {
  const queryString = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query.query);
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_27__.MutableSearch(queryString !== null && queryString !== void 0 ? queryString : '');
  conditions.addFilterValues('!transaction', [transaction]);
  const query = conditions.formatString();
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
    pathname: location.pathname,
    query: { ...location.query,
      query: String(query).trim()
    }
  });
}

function handleFilterDuration(location, organization, value, symbol, trendChangeType, projects, projectIds) {
  const durationTag = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getCurrentTrendParameter)(location, projects, projectIds).column;
  const queryString = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query.query);
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_27__.MutableSearch(queryString !== null && queryString !== void 0 ? queryString : '');
  const existingValues = conditions.getFilterValues(durationTag);
  const alternateSymbol = symbol === FilterSymbols.GREATER_THAN_EQUALS ? '>' : '<';

  if (existingValues) {
    existingValues.forEach(existingValue => {
      if (existingValue.startsWith(symbol) || existingValue.startsWith(alternateSymbol)) {
        conditions.removeFilterValue(durationTag, existingValue);
      }
    });
  }

  conditions.addFilterValues(durationTag, [`${symbol}${value}`]);
  const query = conditions.formatString();
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
    pathname: location.pathname,
    query: { ...location.query,
      query: String(query).trim()
    }
  });
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('performance_views.trends.change_duration', {
    organization,
    widget_type: getChartTitle(trendChangeType),
    value: `${symbol}${value}`
  });
}

function ChangedTransactions(props) {
  const {
    location,
    trendChangeType,
    previousTrendFunction,
    previousTrendColumn,
    organization,
    projects,
    setError
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_28__["default"])();
  const trendView = props.trendView.clone();
  const chartTitle = getChartTitle(trendChangeType);
  (0,_utils__WEBPACK_IMPORTED_MODULE_35__.modifyTrendView)(trendView, location, trendChangeType, projects);
  const onCursor = makeTrendsCursorHandler(trendChangeType);
  const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query[_utils__WEBPACK_IMPORTED_MODULE_35__.trendCursorNames[trendChangeType]]);

  const paginationAnalyticsEvent = direction => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('performance_views.trends.widget_pagination', {
      organization,
      direction,
      widget_type: getChartTitle(trendChangeType)
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_25__["default"], {
    eventView: trendView,
    orgSlug: organization.slug,
    location: location,
    trendChangeType: trendChangeType,
    cursor: cursor,
    limit: 5,
    setError: error => setError(error === null || error === void 0 ? void 0 : error.message),
    children: _ref => {
      let {
        isLoading,
        trendsData,
        pageLinks
      } = _ref;
      const trendFunction = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getCurrentTrendFunction)(location);
      const trendParameter = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getCurrentTrendParameter)(location, projects, trendView.project);
      const events = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.normalizeTrends)(trendsData && trendsData.events && trendsData.events.data || []);
      const selectedTransaction = getSelectedTransaction(location, trendChangeType, events);
      const statsData = (trendsData === null || trendsData === void 0 ? void 0 : trendsData.stats) || {};
      const transactionsList = events && events.slice ? events.slice(0, 5) : [];
      const currentTrendFunction = isLoading && previousTrendFunction ? previousTrendFunction : trendFunction.field;
      const currentTrendColumn = isLoading && previousTrendColumn ? previousTrendColumn : trendParameter.column;
      const titleTooltipContent = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('This compares the baseline (%s) of the past with the present.', trendFunction.legendLabel);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(TransactionsListContainer, {
        "data-test-id": "changed-transactions",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(TrendsTransactionPanel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(StyledHeaderTitleLegend, {
            children: [chartTitle, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_17__["default"], {
              size: "sm",
              position: "top",
              title: titleTooltipContent
            })]
          }), isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {
            style: {
              margin: '237px auto'
            }
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: transactionsList.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ChartContainer, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(_chart__WEBPACK_IMPORTED_MODULE_33__["default"], {
                  statsData: statsData,
                  query: trendView.query,
                  project: trendView.project,
                  environment: trendView.environment,
                  start: trendView.start,
                  end: trendView.end,
                  statsPeriod: trendView.statsPeriod,
                  transaction: selectedTransaction,
                  isLoading: isLoading,
                  ...props
                })
              }), transactionsList.map((transaction, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(TrendsListItem, {
                api: api,
                currentTrendFunction: currentTrendFunction,
                currentTrendColumn: currentTrendColumn,
                trendView: props.trendView,
                organization: organization,
                transaction: transaction,
                index: index,
                trendChangeType: trendChangeType,
                transactions: transactionsList,
                location: location,
                projects: projects,
                statsData: statsData,
                handleSelectTransaction: handleChangeSelected(location, organization, trendChangeType)
              }, transaction.transaction))]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(StyledEmptyStateWarning, {
              small: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('No results')
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__["default"], {
          pageLinks: pageLinks,
          onCursor: onCursor,
          paginationAnalyticsEvent: paginationAnalyticsEvent
        })]
      });
    }
  });
}

ChangedTransactions.displayName = "ChangedTransactions";

function TrendsListItem(props) {
  const {
    transaction,
    transactions,
    trendChangeType,
    currentTrendFunction,
    currentTrendColumn,
    index,
    location,
    organization,
    projects,
    handleSelectTransaction,
    trendView
  } = props;
  const color = _utils__WEBPACK_IMPORTED_MODULE_35__.trendToColor[trendChangeType].default;
  const selectedTransaction = getSelectedTransaction(location, trendChangeType, transactions);
  const isSelected = selectedTransaction === transaction;
  const project = projects.find(_ref2 => {
    let {
      slug
    } = _ref2;
    return slug === transaction.project;
  });
  const currentPeriodValue = transaction.aggregate_range_2;
  const previousPeriodValue = transaction.aggregate_range_1;
  const absolutePercentChange = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.formatPercentage)(Math.abs(transaction.trend_percentage - 1), 0);
  const previousDuration = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.getDuration)(previousPeriodValue / 1000, previousPeriodValue < 1000 && previousPeriodValue > 10 ? 0 : 2);
  const currentDuration = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.getDuration)(currentPeriodValue / 1000, currentPeriodValue < 1000 && currentPeriodValue > 10 ? 0 : 2);
  const percentChangeExplanation = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Over this period, the %s for %s has %s %s from %s to %s', currentTrendFunction, currentTrendColumn, trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('decreased') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('increased'), absolutePercentChange, previousDuration, currentDuration);
  const longestPeriodValue = trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED ? previousPeriodValue : currentPeriodValue;
  const longestDuration = trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED ? previousDuration : currentDuration;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(ListItemContainer, {
    "data-test-id": 'trends-list-item-' + trendChangeType,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ItemRadioContainer, {
      color: color,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(TooltipContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)("span", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Total Events')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)("span", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_6__["default"], {
              value: transaction.count_range_1
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(StyledIconArrow, {
              direction: "right",
              size: "xs"
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_6__["default"], {
              value: transaction.count_range_2
            })]
          })]
        }),
        disableForVisualTest: true // Disabled tooltip in snapshots because of overlap order issues.
        ,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_10__.RadioLineItem, {
          index: index,
          role: "radio",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_18__["default"], {
            checked: isSelected,
            onChange: () => handleSelectTransaction(transaction)
          })
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(TransactionSummaryLink, { ...props
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ItemTransactionPercentage, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: percentChangeExplanation,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [trendChangeType === _types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.REGRESSION ? '+' : '', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_24__.formatPercentage)(transaction.trend_percentage - 1, 0)]
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
      caret: false,
      anchorRight: true,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(StyledButton, {
        size: "xs",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconEllipsis, {
          "data-test-id": "trends-item-action",
          size: "xs"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Actions')
      }),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_14__["default"], {
        onClick: () => handleFilterDuration(location, organization, longestPeriodValue, FilterSymbols.LESS_THAN_EQUALS, trendChangeType, projects, trendView.project),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(MenuAction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Show \u2264 %s', longestDuration)
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_14__["default"], {
        onClick: () => handleFilterDuration(location, organization, longestPeriodValue, FilterSymbols.GREATER_THAN_EQUALS, trendChangeType, projects, trendView.project),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(MenuAction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Show \u2265 %s', longestDuration)
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_14__["default"], {
        onClick: () => handleFilterTransaction(location, transaction.transaction),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(MenuAction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Hide from list')
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(ItemTransactionDurationChange, {
      children: [project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: transaction.project,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
          avatarSize: 16,
          project: project,
          hideName: true
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(CompareDurations, { ...props
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ItemTransactionStatus, {
      color: color,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ValueDelta, { ...props
      })
    })]
  });
}

TrendsListItem.displayName = "TrendsListItem";
const CompareDurations = _ref3 => {
  let {
    transaction
  } = _ref3;
  const {
    fromSeconds,
    toSeconds,
    showDigits
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.transformDeltaSpread)(transaction.aggregate_range_1, transaction.aggregate_range_2);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(DurationChange, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__["default"], {
      seconds: fromSeconds,
      fixedDigits: showDigits ? 1 : 0,
      abbreviation: true
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(StyledIconArrow, {
      direction: "right",
      size: "xs"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__["default"], {
      seconds: toSeconds,
      fixedDigits: showDigits ? 1 : 0,
      abbreviation: true
    })]
  });
};
CompareDurations.displayName = "CompareDurations";

const ValueDelta = _ref4 => {
  let {
    transaction,
    trendChangeType
  } = _ref4;
  const {
    seconds,
    fixedDigits,
    changeLabel
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.transformValueDelta)(transaction.trend_difference, trendChangeType);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)("span", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__["default"], {
      seconds: seconds,
      fixedDigits: fixedDigits,
      abbreviation: true
    }), " ", changeLabel]
  });
};

ValueDelta.displayName = "ValueDelta";

const TransactionSummaryLink = props => {
  const {
    organization,
    trendView: eventView,
    transaction,
    projects,
    currentTrendFunction,
    currentTrendColumn
  } = props;
  const summaryView = eventView.clone();
  const projectID = (0,_utils__WEBPACK_IMPORTED_MODULE_35__.getTrendProjectId)(transaction, projects);
  const target = (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_32__.transactionSummaryRouteWithQuery)({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction),
    query: summaryView.generateQueryStringObject(),
    projectID,
    display: _transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_31__.DisplayModes.TREND,
    trendFunction: currentTrendFunction,
    trendColumn: currentTrendColumn
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(ItemTransactionName, {
    to: target,
    "data-test-id": "item-transaction-name",
    children: transaction.transaction
  });
};

TransactionSummaryLink.displayName = "TransactionSummaryLink";

const TransactionsListContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w115"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const TrendsTransactionPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__.Panel,  true ? {
  target: "e11bn3w114"
} : 0)( true ? {
  name: "154zghl",
  styles: "margin:0;flex-grow:1"
} : 0);

const ChartContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w113"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(3), ";" + ( true ? "" : 0));

const StyledHeaderTitleLegend = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.HeaderTitleLegend,  true ? {
  target: "e11bn3w112"
} : 0)("border-radius:", p => p.theme.borderRadius, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(3), ";" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e11bn3w111"
} : 0)( true ? {
  name: "1989ovb",
  styles: "vertical-align:middle"
} : 0);

const MenuAction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w110"
} : 0)("white-space:nowrap;color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

MenuAction.defaultProps = {
  'data-test-id': 'menu-action'
};

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e11bn3w19"
} : 0)( true ? {
  name: "1t1oqhu",
  styles: "min-height:300px;justify-content:center"
} : 0);

const ListItemContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w18"
} : 0)("display:grid;grid-template-columns:24px auto 100px 30px;grid-template-rows:repeat(2, auto);grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";border-top:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";" + ( true ? "" : 0));

const ItemRadioContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w17"
} : 0)("grid-row:1/3;input{cursor:pointer;}input:checked::after{background-color:", p => p.color, ";}" + ( true ? "" : 0));

const ItemTransactionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e11bn3w16"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const ItemTransactionDurationChange = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w15"
} : 0)("display:flex;align-items:center;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const DurationChange = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e11bn3w14"
} : 0)("color:", p => p.theme.gray300, ";margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";" + ( true ? "" : 0));

const ItemTransactionPercentage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w13"
} : 0)("text-align:right;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const ItemTransactionStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w12"
} : 0)("color:", p => p.color, ";text-align:right;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const TooltipContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bn3w11"
} : 0)( true ? {
  name: "zigog8",
  styles: "display:flex;flex-direction:column;align-items:center"
} : 0);

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconArrow,  true ? {
  target: "e11bn3w10"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_30__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_29__["default"])(ChangedTransactions)));

/***/ }),

/***/ "./app/views/performance/trends/chart.tsx":
/*!************************************************!*\
  !*** ./app/views/performance/trends/chart.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Chart": () => (/* binding */ Chart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

// eslint-disable-next-line no-restricted-imports

















function transformEventStats(data, seriesName) {
  return [{
    seriesName: seriesName || 'Current',
    data: data.map(_ref => {
      let [timestamp, countsForTimestamp] = _ref;
      return {
        name: timestamp * 1000,
        value: countsForTimestamp.reduce((acc, _ref2) => {
          let {
            count
          } = _ref2;
          return acc + count;
        }, 0)
      };
    })
  }];
}

function getLegend(trendFunction) {
  return {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left',
    data: [{
      name: 'Baseline',
      icon: 'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z'
    }, {
      name: 'Releases'
    }, {
      name: trendFunction
    }]
  };
}

function getIntervalLine(theme, series, intervalRatio, transaction) {
  if (!transaction || !series.length || !series[0].data || !series[0].data.length) {
    return [];
  }

  const seriesStart = parseInt(series[0].data[0].name, 10);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name, 10);

  if (seriesEnd < seriesStart) {
    return [];
  }

  const periodLine = {
    data: [],
    color: theme.textColor,
    markLine: {
      data: [],
      label: {},
      lineStyle: {
        color: theme.textColor,
        type: 'dashed',
        width: 1
      },
      symbol: ['none', 'none'],
      tooltip: {
        show: false
      }
    },
    seriesName: 'Baseline'
  };
  const periodLineLabel = {
    fontSize: 11,
    show: true,
    color: theme.textColor,
    silent: true
  };
  const previousPeriod = { ...periodLine,
    markLine: { ...periodLine.markLine
    },
    seriesName: 'Baseline'
  };
  const currentPeriod = { ...periodLine,
    markLine: { ...periodLine.markLine
    },
    seriesName: 'Baseline'
  };
  const periodDividingLine = { ...periodLine,
    markLine: { ...periodLine.markLine
    },
    seriesName: 'Period split'
  };
  const seriesDiff = seriesEnd - seriesStart;
  const seriesLine = seriesDiff * intervalRatio + seriesStart;
  previousPeriod.markLine.data = [[{
    value: 'Past',
    coord: [seriesStart, transaction.aggregate_range_1]
  }, {
    coord: [seriesLine, transaction.aggregate_range_1]
  }]];
  previousPeriod.markLine.tooltip = {
    formatter: () => {
      return ['<div class="tooltip-series tooltip-series-solo">', '<div>', `<span class="tooltip-label"><strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Past Baseline')}</strong></span>`, // p50() coerces the axis to be time based
      (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.tooltipFormatter)(transaction.aggregate_range_1, 'duration'), '</div>', '</div>', '<div class="tooltip-arrow"></div>'].join('');
    }
  };
  currentPeriod.markLine.data = [[{
    value: 'Present',
    coord: [seriesLine, transaction.aggregate_range_2]
  }, {
    coord: [seriesEnd, transaction.aggregate_range_2]
  }]];
  currentPeriod.markLine.tooltip = {
    formatter: () => {
      return ['<div class="tooltip-series tooltip-series-solo">', '<div>', `<span class="tooltip-label"><strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Present Baseline')}</strong></span>`, // p50() coerces the axis to be time based
      (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.tooltipFormatter)(transaction.aggregate_range_2, 'duration'), '</div>', '</div>', '<div class="tooltip-arrow"></div>'].join('');
    }
  };
  periodDividingLine.markLine = {
    data: [{
      xAxis: seriesLine
    }],
    label: {
      show: false
    },
    lineStyle: {
      color: theme.textColor,
      type: 'solid',
      width: 2
    },
    symbol: ['none', 'none'],
    tooltip: {
      show: false
    },
    silent: true
  };
  previousPeriod.markLine.label = { ...periodLineLabel,
    formatter: 'Past',
    position: 'insideStartBottom'
  };
  currentPeriod.markLine.label = { ...periodLineLabel,
    formatter: 'Present',
    position: 'insideEndBottom'
  };
  const additionalLineSeries = [previousPeriod, currentPeriod, periodDividingLine];
  return additionalLineSeries;
}

function Chart(_ref3) {
  var _events$data;

  let {
    trendChangeType,
    router,
    statsPeriod,
    transaction,
    statsData,
    isLoading,
    location,
    start: propsStart,
    end: propsEnd,
    trendFunctionField,
    disableXAxis,
    disableLegend,
    grid,
    height,
    projects,
    project
  } = _ref3;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_14__.a)();

  const handleLegendSelectChanged = legendChange => {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const query = { ...location.query
    };
    const queryKey = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getUnselectedSeries)(trendChangeType);
    query[queryKey] = unselected;
    const to = { ...location,
      query
    };
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push(to);
  };

  const lineColor = _utils__WEBPACK_IMPORTED_MODULE_13__.trendToColor[trendChangeType || ''];
  const events = statsData && transaction !== null && transaction !== void 0 && transaction.project && transaction !== null && transaction !== void 0 && transaction.transaction ? statsData[[transaction.project, transaction.transaction].join(',')] : undefined;
  const data = (_events$data = events === null || events === void 0 ? void 0 : events.data) !== null && _events$data !== void 0 ? _events$data : [];
  const trendFunction = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getCurrentTrendFunction)(location, trendFunctionField);
  const trendParameter = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getCurrentTrendParameter)(location, projects, project);
  const chartLabel = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.generateTrendFunctionAsString)(trendFunction.field, trendParameter.column);
  const results = transformEventStats(data, chartLabel);
  const {
    smoothedResults,
    minValue,
    maxValue
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.transformEventStatsSmoothed)(results, chartLabel);
  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsEnd) : null;
  const {
    utc
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__.normalizeDateTimeParams)(location.query);
  const seriesSelection = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeList)(location.query[(0,_utils__WEBPACK_IMPORTED_MODULE_13__.getUnselectedSeries)(trendChangeType)]).reduce((selection, metric) => {
    selection[metric] = false;
    return selection;
  }, {});
  const legend = disableLegend ? {
    show: false
  } : { ...getLegend(chartLabel),
    selected: seriesSelection
  };
  const loading = isLoading;
  const reloading = isLoading;
  const yMax = Math.max(maxValue, (transaction === null || transaction === void 0 ? void 0 : transaction.aggregate_range_2) || 0, (transaction === null || transaction === void 0 ? void 0 : transaction.aggregate_range_1) || 0);
  const yMin = Math.min(minValue, (transaction === null || transaction === void 0 ? void 0 : transaction.aggregate_range_1) || Number.MAX_SAFE_INTEGER, (transaction === null || transaction === void 0 ? void 0 : transaction.aggregate_range_2) || Number.MAX_SAFE_INTEGER);
  const smoothedSeries = smoothedResults ? smoothedResults.map(values => {
    return { ...values,
      color: lineColor.default,
      lineStyle: {
        opacity: 1
      }
    };
  }) : [];
  const intervalSeries = getIntervalLine(theme, smoothedResults || [], 0.5, transaction);
  const yDiff = yMax - yMin;
  const yMargin = yDiff * 0.1;
  const series = [...smoothedSeries, ...intervalSeries];
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.getDurationUnit)(series);
  const chartOptions = {
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.aggregateOutputType)(seriesName));
      }
    },
    yAxis: {
      min: Math.max(0, yMin - yMargin),
      max: yMax + yMargin,
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.axisLabelFormatter)(value, 'duration', undefined, durationUnit)
      }
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_2__["default"], {
    router: router,
    period: statsPeriod,
    start: start,
    end: end,
    utc: utc === 'true',
    children: zoomRenderProps => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_4__["default"], {
        loading: loading,
        reloading: reloading,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_5__["default"], {
          visible: reloading
        }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__.LineChart, {
            height: height,
            ...zoomRenderProps,
            ...chartOptions,
            onLegendSelectChanged: handleLegendSelectChanged,
            series: series,
            seriesOptions: {
              showSymbol: false
            },
            legend: legend,
            toolBox: {
              show: false
            },
            grid: grid !== null && grid !== void 0 ? grid : {
              left: '10px',
              right: '10px',
              top: '40px',
              bottom: '0px'
            },
            xAxis: disableXAxis ? {
              show: false
            } : undefined
          }),
          fixed: 'Duration Chart'
        })]
      });
    }
  });
}
Chart.displayName = "Chart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(Chart));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_performance_histogram_utils_tsx-app_views_performance_transactionSummary_transactio-36f0d7.daf68b4e5e9d2f85ea2f647215861435.js.map