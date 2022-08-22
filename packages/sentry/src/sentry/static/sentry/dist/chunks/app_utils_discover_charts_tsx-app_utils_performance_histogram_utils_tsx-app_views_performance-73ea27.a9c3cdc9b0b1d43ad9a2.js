(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_discover_charts_tsx-app_utils_performance_histogram_utils_tsx-app_views_performance-73ea27"],{

/***/ "./app/components/events/errorLevel.tsx":
/*!**********************************************!*\
  !*** ./app/components/events/errorLevel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DEFAULT_SIZE = '13px';

const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e145dcfe0"
} : 0)("padding:0;position:relative;width:", p => p.size || DEFAULT_SIZE, ";height:", p => p.size || DEFAULT_SIZE, ";text-indent:-9999em;display:inline-block;border-radius:50%;flex-shrink:0;background-color:", p => p.level ? p.theme.level[p.level] : p.theme.level.error, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorLevel);

/***/ }),

/***/ "./app/components/events/eventMessage.tsx":
/*!************************************************!*\
  !*** ./app/components/events/eventMessage.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const BaseEventMessage = _ref => {
  let {
    className,
    level,
    levelIndicatorSize,
    message,
    annotations
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: className,
    children: [level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledErrorLevel, {
      size: levelIndicatorSize,
      level: level,
      children: level
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Message, {
      children: message
    }), annotations]
  });
};

BaseEventMessage.displayName = "BaseEventMessage";

const EventMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseEventMessage,  true ? {
  target: "e1rp796r2"
} : 0)( true ? {
  name: "1go2o7p",
  styles: "display:flex;align-items:center;position:relative;line-height:1.2;overflow:hidden"
} : 0);

const StyledErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1rp796r1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rp796r0"
} : 0)(p => p.theme.overflowEllipsis, " width:auto;max-height:38px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMessage);

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "axisDuration": () => (/* binding */ axisDuration),
/* harmony export */   "axisLabelFormatter": () => (/* binding */ axisLabelFormatter),
/* harmony export */   "axisLabelFormatterUsingAggregateOutputType": () => (/* binding */ axisLabelFormatterUsingAggregateOutputType),
/* harmony export */   "categorizeDuration": () => (/* binding */ categorizeDuration),
/* harmony export */   "findRangeOfMultiSeries": () => (/* binding */ findRangeOfMultiSeries),
/* harmony export */   "getDurationUnit": () => (/* binding */ getDurationUnit),
/* harmony export */   "tooltipFormatter": () => (/* binding */ tooltipFormatter),
/* harmony export */   "tooltipFormatterUsingAggregateOutputType": () => (/* binding */ tooltipFormatterUsingAggregateOutputType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");




/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */

function tooltipFormatter(value) {
  let outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}
/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */

function tooltipFormatterUsingAggregateOutputType(value, type) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 2);

    case 'duration':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.getDuration)(value / 1000, 2, true);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value);

    default:
      return value.toString();
  }
}
/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */

function axisLabelFormatter(value, outputType) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;
  return axisLabelFormatterUsingAggregateOutputType(value, outputType, abbreviation, durationUnit);
}
/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */

function axisLabelFormatterUsingAggregateOutputType(value, type) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;

  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatAbbreviatedNumber)(value) : value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 0);

    case 'duration':
      return axisDuration(value, durationUnit);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value, 0);

    default:
      return value.toString();
  }
}
/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */

function axisDuration(value, durationUnit) {
  var _durationUnit;

  (_durationUnit = durationUnit) !== null && _durationUnit !== void 0 ? _durationUnit : durationUnit = categorizeDuration(value);

  if (value === 0) {
    return '0';
  }

  switch (durationUnit) {
    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%swk', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sd', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%shr', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%smin', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%ss', label);
      }

    default:
      const label = value.toFixed(0);
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sms', label);
  }
}
/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend
 * Assumes series[0] > series[1] > ...
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */

function findRangeOfMultiSeries(series, legend) {
  var _series$;

  let range;

  if ((_series$ = series[0]) !== null && _series$ !== void 0 && _series$.data) {
    var _maxSeries2;

    let minSeries = series[0];
    let maxSeries;
    series.forEach((_ref, idx) => {
      var _legend$selected;

      let {
        seriesName,
        data
      } = _ref;

      if ((legend === null || legend === void 0 ? void 0 : (_legend$selected = legend.selected) === null || _legend$selected === void 0 ? void 0 : _legend$selected[seriesName]) !== false && data.length) {
        var _maxSeries;

        minSeries = series[idx];
        (_maxSeries = maxSeries) !== null && _maxSeries !== void 0 ? _maxSeries : maxSeries = series[idx];
      }
    });

    if ((_maxSeries2 = maxSeries) !== null && _maxSeries2 !== void 0 && _maxSeries2.data) {
      const max = Math.max(...maxSeries.data.map(_ref2 => {
        let {
          value
        } = _ref2;
        return value;
      }).filter(value => !!value));
      const min = Math.min(...minSeries.data.map(_ref3 => {
        let {
          value
        } = _ref3;
        return value;
      }).filter(value => !!value));
      range = {
        max,
        min
      };
    }
  }

  return range;
}
/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */

function getDurationUnit(series, legend) {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);

  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;

    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }

  return durationUnit;
}
/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */

function categorizeDuration(value) {
  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND;
  }

  return 1;
}

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

/***/ "./app/views/sharedGroupDetails/index.tsx":
/*!************************************************!*\
  !*** ./app/views/sharedGroupDetails/index.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SharedGroupDetails": () => (/* binding */ SharedGroupDetails),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/eventEntries */ "./app/components/events/eventEntries.tsx");
/* harmony import */ var sentry_components_footer__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/footer */ "./app/components/footer.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _sharedGroupHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./sharedGroupHeader */ "./app/views/sharedGroupDetails/sharedGroupHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















class SharedGroupDetails extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRetry", () => {
      this.setState(this.getInitialState());
      this.fetchData();
    });
  }

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false
    };
  }

  getChildContext() {
    return {
      group: this.state.group
    };
  }

  componentWillMount() {
    document.body.classList.add('shared-group');
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillUnmount() {
    document.body.classList.remove('shared-group');
  }

  async fetchData() {
    const {
      params,
      api
    } = this.props;
    const {
      shareId
    } = params;

    try {
      const group = await api.requestPromise(`/shared/issues/${shareId}/`);
      this.setState({
        loading: false,
        group
      });
    } catch {
      this.setState({
        loading: false,
        error: true
      });
    }
  }

  getTitle() {
    var _group$title;

    const {
      group
    } = this.state;
    return (_group$title = group === null || group === void 0 ? void 0 : group.title) !== null && _group$title !== void 0 ? _group$title : 'Sentry';
  }

  render() {
    const {
      group,
      loading,
      error
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    }

    if (!group) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_4__["default"], {});
    }

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_8__["default"], {
        onRetry: this.handleRetry
      });
    }

    const {
      location,
      api,
      route,
      router
    } = this.props;
    const {
      permalink,
      latestEvent,
      project
    } = group;
    const title = this.getTitle();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
      noSuffix: true,
      title: title,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        className: "app",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          className: "pattern-bg"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          className: "container",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
            className: "box box-modal",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
              className: "box-header",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
                className: "logo",
                to: "/",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
                  className: "icon-sentry-logo-full"
                })
              }), permalink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
                className: "details",
                to: permalink,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Details')
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
              className: "box-content",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_sharedGroupHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
                group: group
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Container, {
                className: "group-overview event-details-container",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_5__.BorderlessEventEntries, {
                  location: location,
                  organization: project.organization,
                  group: group,
                  event: latestEvent,
                  project: project,
                  api: api,
                  route: route,
                  router: router,
                  isShare: true
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_footer__WEBPACK_IMPORTED_MODULE_6__["default"], {})]
            })]
          })
        })]
      })
    });
  }

}

SharedGroupDetails.displayName = "SharedGroupDetails";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SharedGroupDetails, "childContextTypes", {
  group: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_12__["default"].Group
});

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emmfqra0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__["default"])(SharedGroupDetails));

/***/ }),

/***/ "./app/views/sharedGroupDetails/sharedGroupHeader.tsx":
/*!************************************************************!*\
  !*** ./app/views/sharedGroupDetails/sharedGroupHeader.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/eventMessage */ "./app/components/events/eventMessage.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_shortId__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/shortId */ "./app/components/shortId.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _organizationGroupDetails_unhandledTag__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../organizationGroupDetails/unhandledTag */ "./app/views/organizationGroupDetails/unhandledTag.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const SharedGroupHeader = _ref => {
  let {
    group
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Wrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Details, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(TitleWrap, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Title, {
          children: group.title
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledShortId, {
          shortId: group.shortId,
          avatar: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
            project: group.project,
            avatarSize: 20,
            hideName: true
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(_organizationGroupDetails_unhandledTag__WEBPACK_IMPORTED_MODULE_5__.TagAndMessageWrapper, {
        children: [group.isUnhandled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_organizationGroupDetails_unhandledTag__WEBPACK_IMPORTED_MODULE_5__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_1__["default"], {
          message: group.culprit
        })]
      })]
    })
  });
};

SharedGroupHeader.displayName = "SharedGroupHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SharedGroupHeader);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s0n9dd4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(4), ";border-bottom:1px solid ", p => p.theme.border, ";position:relative;" + ( true ? "" : 0));

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s0n9dd3"
} : 0)( true ? {
  name: "5eha28",
  styles: "max-width:960px;margin:0 auto"
} : 0);

const TitleWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s0n9dd2"
} : 0)("display:flex;justify-content:space-between;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const StyledShortId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_shortId__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1s0n9dd1"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "e1s0n9dd0"
} : 0)("color:", p => p.theme.headingColor, ";font-size:", p => p.theme.fontSizeExtraLarge, ";line-height:", p => p.theme.text.lineHeightHeading, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";margin-bottom:0;", p => p.theme.overflowEllipsis, ";@media (min-width: ", props => props.theme.breakpoints.small, "){font-size:", p => p.theme.headerFontSize, ";}" + ( true ? "" : 0));

/***/ }),

/***/ "../node_modules/lodash/_baseExtremum.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_baseExtremum.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "../node_modules/lodash/isSymbol.js");

/**
 * The base implementation of methods like `_.max` and `_.min` which accepts a
 * `comparator` to determine the extremum value.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The iteratee invoked per iteration.
 * @param {Function} comparator The comparator used to compare values.
 * @returns {*} Returns the extremum value.
 */
function baseExtremum(array, iteratee, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index],
        current = iteratee(value);

    if (current != null && (computed === undefined
          ? (current === current && !isSymbol(current))
          : comparator(current, computed)
        )) {
      var computed = current,
          result = value;
    }
  }
  return result;
}

module.exports = baseExtremum;


/***/ }),

/***/ "../node_modules/lodash/_baseGt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseGt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.gt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is greater than `other`,
 *  else `false`.
 */
function baseGt(value, other) {
  return value > other;
}

module.exports = baseGt;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_discover_charts_tsx-app_utils_performance_histogram_utils_tsx-app_views_performance-73ea27.eeeb294c4973b9892c9192d3fe677077.js.map