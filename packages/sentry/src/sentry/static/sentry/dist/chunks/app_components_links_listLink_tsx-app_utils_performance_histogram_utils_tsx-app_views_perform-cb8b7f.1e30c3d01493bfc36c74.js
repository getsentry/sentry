(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_links_listLink_tsx-app_utils_performance_histogram_utils_tsx-app_views_perform-cb8b7f"],{

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/performance/histogram/utils.tsx":
/*!***************************************************!*\
  !*** ./app/utils/performance/histogram/utils.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "../node_modules/lodash/maxBy.js":
/*!***************************************!*\
  !*** ../node_modules/lodash/maxBy.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseExtremum = __webpack_require__(/*! ./_baseExtremum */ "../node_modules/lodash/_baseExtremum.js"),
    baseGt = __webpack_require__(/*! ./_baseGt */ "../node_modules/lodash/_baseGt.js"),
    baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js");

/**
 * This method is like `_.max` except that it accepts `iteratee` which is
 * invoked for each element in `array` to generate the criterion by which
 * the value is ranked. The iteratee is invoked with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Math
 * @param {Array} array The array to iterate over.
 * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
 * @returns {*} Returns the maximum value.
 * @example
 *
 * var objects = [{ 'n': 1 }, { 'n': 2 }];
 *
 * _.maxBy(objects, function(o) { return o.n; });
 * // => { 'n': 2 }
 *
 * // The `_.property` iteratee shorthand.
 * _.maxBy(objects, 'n');
 * // => { 'n': 2 }
 */
function maxBy(array, iteratee) {
  return (array && array.length)
    ? baseExtremum(array, baseIteratee(iteratee, 2), baseGt)
    : undefined;
}

module.exports = maxBy;


/***/ }),

/***/ "../node_modules/lodash/negate.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/negate.js ***!
  \****************************************/
/***/ ((module) => {

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that negates the result of the predicate `func`. The
 * `func` predicate is invoked with the `this` binding and arguments of the
 * created function.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Function
 * @param {Function} predicate The predicate to negate.
 * @returns {Function} Returns the new negated function.
 * @example
 *
 * function isEven(n) {
 *   return n % 2 == 0;
 * }
 *
 * _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
 * // => [1, 3, 5]
 */
function negate(predicate) {
  if (typeof predicate != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  return function() {
    var args = arguments;
    switch (args.length) {
      case 0: return !predicate.call(this);
      case 1: return !predicate.call(this, args[0]);
      case 2: return !predicate.call(this, args[0], args[1]);
      case 3: return !predicate.call(this, args[0], args[1], args[2]);
    }
    return !predicate.apply(this, args);
  };
}

module.exports = negate;


/***/ }),

/***/ "../node_modules/lodash/omitBy.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/omitBy.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    negate = __webpack_require__(/*! ./negate */ "../node_modules/lodash/negate.js"),
    pickBy = __webpack_require__(/*! ./pickBy */ "../node_modules/lodash/pickBy.js");

/**
 * The opposite of `_.pickBy`; this method creates an object composed of
 * the own and inherited enumerable string keyed properties of `object` that
 * `predicate` doesn't return truthy for. The predicate is invoked with two
 * arguments: (value, key).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The source object.
 * @param {Function} [predicate=_.identity] The function invoked per property.
 * @returns {Object} Returns the new object.
 * @example
 *
 * var object = { 'a': 1, 'b': '2', 'c': 3 };
 *
 * _.omitBy(object, _.isNumber);
 * // => { 'b': '2' }
 */
function omitBy(object, predicate) {
  return pickBy(object, negate(baseIteratee(predicate)));
}

module.exports = omitBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_links_listLink_tsx-app_utils_performance_histogram_utils_tsx-app_views_perform-cb8b7f.e7bab9d27d59eda3377563d061be88c7.js.map