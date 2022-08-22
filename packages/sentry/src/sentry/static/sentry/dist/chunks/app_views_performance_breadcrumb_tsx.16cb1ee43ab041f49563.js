"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_breadcrumb_tsx"],{

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

/***/ "./app/views/performance/breadcrumb.tsx":
/*!**********************************************!*\
  !*** ./app/views/performance/breadcrumb.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./transactionSummary/tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./transactionSummary/transactionEvents/utils */ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx");
/* harmony import */ var _transactionSummary_transactionSpans_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./transactionSummary/transactionSpans/utils */ "./app/views/performance/transactionSummary/transactionSpans/utils.tsx");
/* harmony import */ var _transactionSummary_transactionTags_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./transactionSummary/transactionTags/utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _transactionSummary_transactionVitals_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./transactionSummary/transactionVitals/utils */ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx");
/* harmony import */ var _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function Breadcrumb(props) {
  function getCrumbs() {
    const crumbs = [];
    const {
      organization,
      location,
      transaction,
      vitalName,
      spanSlug,
      eventSlug,
      traceSlug,
      tab
    } = props;
    const performanceTarget = {
      pathname: (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getPerformanceLandingUrl)(organization),
      query: { ...location.query,
        // clear out the transaction name
        transaction: undefined
      }
    };
    crumbs.push({
      to: performanceTarget,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Performance'),
      preservePageFilters: true
    });

    if (vitalName) {
      const webVitalsTarget = (0,_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_9__.vitalDetailRouteWithQuery)({
        orgSlug: organization.slug,
        vitalName: 'fcp',
        projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__.decodeScalar)(location.query.project),
        query: location.query
      });
      crumbs.push({
        to: webVitalsTarget,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Vital Detail'),
        preservePageFilters: true
      });
    } else if (transaction) {
      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transaction.name,
        projectID: transaction.project,
        query: location.query
      };

      switch (tab) {
        case _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__["default"].Tags:
          {
            const tagsTarget = (0,_transactionSummary_transactionTags_utils__WEBPACK_IMPORTED_MODULE_6__.tagsRouteWithQuery)(routeQuery);
            crumbs.push({
              to: tagsTarget,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Tags'),
              preservePageFilters: true
            });
            break;
          }

        case _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__["default"].Events:
          {
            const eventsTarget = (0,_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_4__.eventsRouteWithQuery)(routeQuery);
            crumbs.push({
              to: eventsTarget,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('All Events'),
              preservePageFilters: true
            });
            break;
          }

        case _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__["default"].WebVitals:
          {
            const webVitalsTarget = (0,_transactionSummary_transactionVitals_utils__WEBPACK_IMPORTED_MODULE_7__.vitalsRouteWithQuery)(routeQuery);
            crumbs.push({
              to: webVitalsTarget,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Web Vitals'),
              preservePageFilters: true
            });
            break;
          }

        case _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__["default"].Spans:
          {
            const spansTarget = (0,_transactionSummary_transactionSpans_utils__WEBPACK_IMPORTED_MODULE_5__.spansRouteWithQuery)(routeQuery);
            crumbs.push({
              to: spansTarget,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Spans'),
              preservePageFilters: true
            });
            break;
          }

        case _transactionSummary_tabs__WEBPACK_IMPORTED_MODULE_3__["default"].TransactionSummary:
        default:
          {
            const summaryTarget = (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_8__.transactionSummaryRouteWithQuery)(routeQuery);
            crumbs.push({
              to: summaryTarget,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Transaction Summary'),
              preservePageFilters: true
            });
          }
      }
    }

    if (transaction && spanSlug) {
      crumbs.push({
        to: '',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Span Summary')
      });
    } else if (transaction && eventSlug) {
      crumbs.push({
        to: '',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Event Details')
      });
    } else if (traceSlug) {
      crumbs.push({
        to: '',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Trace View')
      });
    }

    return crumbs;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_0__["default"], {
    crumbs: getCrumbs()
  });
}

Breadcrumb.displayName = "Breadcrumb";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Breadcrumb);

/***/ }),

/***/ "./app/views/performance/transactionSummary/tabs.tsx":
/*!***********************************************************!*\
  !*** ./app/views/performance/transactionSummary/tabs.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var Tab;

(function (Tab) {
  Tab[Tab["TransactionSummary"] = 0] = "TransactionSummary";
  Tab[Tab["WebVitals"] = 1] = "WebVitals";
  Tab[Tab["Tags"] = 2] = "Tags";
  Tab[Tab["Events"] = 3] = "Events";
  Tab[Tab["Spans"] = 4] = "Spans";
  Tab[Tab["Anomalies"] = 5] = "Anomalies";
  Tab[Tab["Replays"] = 6] = "Replays";
})(Tab || (Tab = {}));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Tab);

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

/***/ "./app/views/performance/transactionSummary/transactionSpans/types.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionSpans/types.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SpanSortOthers": () => (/* binding */ SpanSortOthers),
/* harmony export */   "SpanSortPercentiles": () => (/* binding */ SpanSortPercentiles)
/* harmony export */ });
let SpanSortPercentiles;

(function (SpanSortPercentiles) {
  SpanSortPercentiles["P50_EXCLUSIVE_TIME"] = "p50ExclusiveTime";
  SpanSortPercentiles["P75_EXCLUSIVE_TIME"] = "p75ExclusiveTime";
  SpanSortPercentiles["P95_EXCLUSIVE_TIME"] = "p95ExclusiveTime";
  SpanSortPercentiles["P99_EXCLUSIVE_TIME"] = "p99ExclusiveTime";
})(SpanSortPercentiles || (SpanSortPercentiles = {}));

let SpanSortOthers;

(function (SpanSortOthers) {
  SpanSortOthers["COUNT"] = "count";
  SpanSortOthers["AVG_OCCURRENCE"] = "avgOccurrence";
  SpanSortOthers["SUM_EXCLUSIVE_TIME"] = "sumExclusiveTime";
})(SpanSortOthers || (SpanSortOthers = {}));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionSpans/utils.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionSpans/utils.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SPAN_RELATIVE_PERIODS": () => (/* binding */ SPAN_RELATIVE_PERIODS),
/* harmony export */   "SPAN_RETENTION_DAYS": () => (/* binding */ SPAN_RETENTION_DAYS),
/* harmony export */   "SPAN_SORT_OPTIONS": () => (/* binding */ SPAN_SORT_OPTIONS),
/* harmony export */   "SPAN_SORT_TO_FIELDS": () => (/* binding */ SPAN_SORT_TO_FIELDS),
/* harmony export */   "generateSpansEventView": () => (/* binding */ generateSpansEventView),
/* harmony export */   "generateSpansRoute": () => (/* binding */ generateSpansRoute),
/* harmony export */   "getExclusiveTimeDisplayedValue": () => (/* binding */ getExclusiveTimeDisplayedValue),
/* harmony export */   "getSuspectSpanSortFromEventView": () => (/* binding */ getSuspectSpanSortFromEventView),
/* harmony export */   "getSuspectSpanSortFromLocation": () => (/* binding */ getSuspectSpanSortFromLocation),
/* harmony export */   "getTotalsView": () => (/* binding */ getTotalsView),
/* harmony export */   "parseSpanSlug": () => (/* binding */ parseSpanSlug),
/* harmony export */   "spansRouteWithQuery": () => (/* binding */ spansRouteWithQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./types */ "./app/views/performance/transactionSummary/transactionSpans/types.tsx");











function generateSpansRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/spans/`;
}
function spansRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref2;
  const pathname = generateSpansRoute({
    orgSlug
  });
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
const SPAN_RETENTION_DAYS = 30;
const SPAN_RELATIVE_PERIODS = lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_RELATIVE_PERIODS, ['1h', '24h', '7d', '14d', '30d']);
const SPAN_SORT_OPTIONS = [{
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Total Self Time'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.SUM_EXCLUSIVE_TIME
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Average Count'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.AVG_OCCURRENCE
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Total Count'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.COUNT
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p50 Self Time'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P50_EXCLUSIVE_TIME
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p75 Self Time'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P75_EXCLUSIVE_TIME
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p95 Self Time'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P95_EXCLUSIVE_TIME
}, {
  prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sort By'),
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p99 Self Time'),
  field: _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P99_EXCLUSIVE_TIME
}];
const DEFAULT_SORT = _types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.SUM_EXCLUSIVE_TIME;

function getSuspectSpanSort(sort) {
  const selected = SPAN_SORT_OPTIONS.find(option => option.field === sort);

  if (selected) {
    return selected;
  }

  return SPAN_SORT_OPTIONS.find(option => option.field === DEFAULT_SORT);
}

function getSuspectSpanSortFromLocation(location) {
  var _decodeScalar, _location$query;

  let sortKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'sort';
  const sort = (_decodeScalar = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query[sortKey])) !== null && _decodeScalar !== void 0 ? _decodeScalar : DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}
function getSuspectSpanSortFromEventView(eventView) {
  const sort = eventView.sorts.length ? eventView.sorts[0].field : DEFAULT_SORT;
  return getSuspectSpanSort(sort);
}
function parseSpanSlug(spanSlug) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(spanSlug)) {
    return undefined;
  }

  const delimiterPos = spanSlug.lastIndexOf(':');

  if (delimiterPos < 0) {
    return undefined;
  }

  const op = spanSlug.slice(0, delimiterPos);
  const group = spanSlug.slice(delimiterPos + 1);
  return {
    op,
    group
  };
}
function generateSpansEventView(_ref3) {
  let {
    location,
    transactionName
  } = _ref3;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(query);
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);
  Object.keys(conditions.filters).forEach(field => {
    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_7__.isAggregateField)(field)) {
      conditions.removeFilter(field);
    }
  });
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_6__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: transactionName,
    fields: [...Object.values(_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers), ...Object.values(_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles)],
    query: conditions.formatString(),
    projects: []
  }, location);
  const sort = getSuspectSpanSortFromLocation(location);
  return eventView.withSorts([{
    field: sort.field,
    kind: 'desc'
  }]);
}
/**
 * For the totals view, we want to get some transaction level stats like
 * the number of transactions and the sum of the transaction duration.
 * This requires the removal of any aggregate conditions as they can result
 * in unexpected empty responses.
 */

function getTotalsView(eventView) {
  const totalsView = eventView.withColumns([{
    kind: 'function',
    function: ['count', '', undefined, undefined]
  }]);
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(eventView.query); // filter out any aggregate conditions

  Object.keys(conditions.filters).forEach(field => {
    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_7__.isAggregateField)(field)) {
      conditions.removeFilter(field);
    }
  });
  totalsView.query = conditions.formatString();
  return totalsView;
}
const SPAN_SORT_TO_FIELDS = {
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.SUM_EXCLUSIVE_TIME]: ['percentileArray(spans_exclusive_time, 0.75)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.AVG_OCCURRENCE]: ['percentileArray(spans_exclusive_time, 0.75)', 'count()', 'count_unique(id)', 'equation|count() / count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortOthers.COUNT]: ['percentileArray(spans_exclusive_time, 0.75)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P50_EXCLUSIVE_TIME]: ['percentileArray(spans_exclusive_time, 0.5)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P75_EXCLUSIVE_TIME]: ['percentileArray(spans_exclusive_time, 0.75)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P95_EXCLUSIVE_TIME]: ['percentileArray(spans_exclusive_time, 0.95)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)'],
  [_types__WEBPACK_IMPORTED_MODULE_10__.SpanSortPercentiles.P99_EXCLUSIVE_TIME]: ['percentileArray(spans_exclusive_time, 0.99)', 'count()', 'count_unique(id)', 'sumArray(spans_exclusive_time)']
};
function getExclusiveTimeDisplayedValue(value) {
  return value.replace('exclusive', 'self');
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionTags/utils.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionTags/utils.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decodeSelectedTagKey": () => (/* binding */ decodeSelectedTagKey),
/* harmony export */   "generateTagsRoute": () => (/* binding */ generateTagsRoute),
/* harmony export */   "getTagSortForTagsPage": () => (/* binding */ getTagSortForTagsPage),
/* harmony export */   "parseHistogramBucketInfo": () => (/* binding */ parseHistogramBucketInfo),
/* harmony export */   "tagsRouteWithQuery": () => (/* binding */ tagsRouteWithQuery),
/* harmony export */   "trackTagPageInteraction": () => (/* binding */ trackTagPageInteraction)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");



function generateTagsRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/tags/`;
}
function decodeSelectedTagKey(location) {
  return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__.decodeScalar)(location.query.tagKey);
}
function trackTagPageInteraction(organization) {
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__.trackAnalyticsEvent)({
    eventKey: 'performance_views.tags.interaction',
    eventName: 'Performance Views: Tag Page - Interaction',
    organization_id: parseInt(organization.id, 10)
  });
}
function tagsRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref2;
  const pathname = generateTagsRoute({
    orgSlug
  });
  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
      tagKey: query.tagKey
    }
  };
}
function getTagSortForTagsPage(location) {
  var _decodeScalar, _location$query;

  // Retrieves the tag from the same query param segment explorer uses, but removes columns that aren't supported.
  let tagSort = (_decodeScalar = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_2__.decodeScalar)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.tagSort)) !== null && _decodeScalar !== void 0 ? _decodeScalar : '-frequency';

  if (['sumdelta'].find(denied => {
    var _tagSort;

    return (_tagSort = tagSort) === null || _tagSort === void 0 ? void 0 : _tagSort.includes(denied);
  })) {
    tagSort = '-frequency';
  }

  return tagSort;
} // TODO(k-fish): Improve meta of backend response to return these directly

function parseHistogramBucketInfo(row) {
  const field = Object.keys(row).find(f => f.includes('histogram'));

  if (!field) {
    return undefined;
  }

  const parts = field.split('_');
  return {
    histogramField: field,
    bucketSize: parseInt(parts[parts.length - 3], 10),
    offset: parseInt(parts[parts.length - 2], 10),
    multiplier: parseInt(parts[parts.length - 1], 10)
  };
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/utils.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "asPixelRect": () => (/* binding */ asPixelRect),
/* harmony export */   "findNearestBucketIndex": () => (/* binding */ findNearestBucketIndex),
/* harmony export */   "generateVitalsRoute": () => (/* binding */ generateVitalsRoute),
/* harmony export */   "getRefRect": () => (/* binding */ getRefRect),
/* harmony export */   "isMissingVitalsData": () => (/* binding */ isMissingVitalsData),
/* harmony export */   "mapPoint": () => (/* binding */ mapPoint),
/* harmony export */   "vitalsRouteWithQuery": () => (/* binding */ vitalsRouteWithQuery)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/histogram/utils */ "./app/utils/performance/histogram/utils.tsx");

function generateVitalsRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/vitals/`;
}
function vitalsRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref2;
  const pathname = generateVitalsRoute({
    orgSlug
  });
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
/**
 * Given a value on the x-axis, return the index of the nearest bucket or null
 * if it cannot be found.
 *
 * A bucket contains a range of values, and nearest is defined as the bucket the
 * value will fall in.
 */

function findNearestBucketIndex(chartData, xAxis) {
  const width = (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_0__.getBucketWidth)(chartData); // it's possible that the data is not available yet or the x axis is out of range

  if (!chartData.length || xAxis >= chartData[chartData.length - 1].bin + width) {
    return null;
  }

  if (xAxis < chartData[0].bin) {
    return -1;
  }

  return Math.floor((xAxis - chartData[0].bin) / width);
}
/**
 * To compute pixel coordinates, we need at least 2 unique points on the chart.
 * The two points must have different x axis and y axis values for it to work.
 *
 * If all bars have the same y value, pick the most naive reference rect. This
 * may result in floating point errors, but should be okay for our purposes.
 */

function getRefRect(chartData) {
  // not enough points to construct 2 reference points
  if (chartData.length < 2) {
    return null;
  }

  for (let i = 0; i < chartData.length; i++) {
    const data1 = chartData[i];

    for (let j = i + 1; j < chartData.length; j++) {
      const data2 = chartData[j];

      if (data1.bin !== data2.bin && data1.count !== data2.count) {
        return {
          point1: {
            x: i,
            y: Math.min(data1.count, data2.count)
          },
          point2: {
            x: j,
            y: Math.max(data1.count, data2.count)
          }
        };
      }
    }
  } // all data points have the same count, just pick any 2 histogram bins
  // and use 0 and 1 as the count as we can rely on them being on the graph


  return {
    point1: {
      x: 0,
      y: 0
    },
    point2: {
      x: 1,
      y: 1
    }
  };
}
/**
 * Given an ECharts instance and a rectangle defined in terms of the x and y axis,
 * compute the corresponding pixel coordinates. If it cannot be done, return null.
 */

function asPixelRect(chartRef, dataRect) {
  const point1 = chartRef.convertToPixel({
    xAxisIndex: 0,
    yAxisIndex: 0
  }, [dataRect.point1.x, dataRect.point1.y]);

  if (isNaN(point1 === null || point1 === void 0 ? void 0 : point1[0]) || isNaN(point1 === null || point1 === void 0 ? void 0 : point1[1])) {
    return null;
  }

  const point2 = chartRef.convertToPixel({
    xAxisIndex: 0,
    yAxisIndex: 0
  }, [dataRect.point2.x, dataRect.point2.y]);

  if (isNaN(point2 === null || point2 === void 0 ? void 0 : point2[0]) || isNaN(point2 === null || point2 === void 0 ? void 0 : point2[1])) {
    return null;
  }

  return {
    point1: {
      x: point1[0],
      y: point1[1]
    },
    point2: {
      x: point2[0],
      y: point2[1]
    }
  };
}
/**
 * Given a point on a source rectangle, map it to the corresponding point on the
 * destination rectangle. Assumes that the two rectangles are related by a simple
 * transformation containing only translations and scaling.
 */

function mapPoint(point, srcRect, destRect) {
  if (srcRect.point1.x === srcRect.point2.x || srcRect.point1.y === srcRect.point2.y || destRect.point1.x === destRect.point2.x || destRect.point1.y === destRect.point2.y) {
    return null;
  }

  const xPercentage = (point.x - srcRect.point1.x) / (srcRect.point2.x - srcRect.point1.x);
  const yPercentage = (point.y - srcRect.point1.y) / (srcRect.point2.y - srcRect.point1.y);
  return {
    x: destRect.point1.x + (destRect.point2.x - destRect.point1.x) * xPercentage,
    y: destRect.point1.y + (destRect.point2.y - destRect.point1.y) * yPercentage
  };
}
function isMissingVitalsData(vitalsData, allVitals) {
  if (!vitalsData || allVitals.some(vital => !vitalsData[vital])) {
    return true;
  }

  const measurementsWithoutCounts = Object.values(vitalsData).filter(vitalObj => vitalObj.total === 0);
  return measurementsWithoutCounts.length > 0;
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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_breadcrumb_tsx.0cc9984f1a7958dacae7379a2663e15c.js.map