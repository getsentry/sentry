"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_trends_utils_tsx-app_views_performance_utils_tsx-app_views_performance_-d12d8e"],{

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/performance/trends/types.tsx":
/*!************************************************!*\
  !*** ./app/views/performance/trends/types.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TrendChangeType": () => (/* binding */ TrendChangeType),
/* harmony export */   "TrendColumnField": () => (/* binding */ TrendColumnField),
/* harmony export */   "TrendFunctionField": () => (/* binding */ TrendFunctionField)
/* harmony export */ });
let TrendChangeType;

(function (TrendChangeType) {
  TrendChangeType["IMPROVED"] = "improved";
  TrendChangeType["REGRESSION"] = "regression";
})(TrendChangeType || (TrendChangeType = {}));

let TrendFunctionField;

(function (TrendFunctionField) {
  TrendFunctionField["P50"] = "p50";
  TrendFunctionField["P75"] = "p75";
  TrendFunctionField["P95"] = "p95";
  TrendFunctionField["P99"] = "p99";
  TrendFunctionField["AVG"] = "avg";
})(TrendFunctionField || (TrendFunctionField = {}));

let TrendColumnField;

(function (TrendColumnField) {
  TrendColumnField["DURATION"] = "transaction.duration";
  TrendColumnField["LCP"] = "measurements.lcp";
  TrendColumnField["FCP"] = "measurements.fcp";
  TrendColumnField["FID"] = "measurements.fid";
  TrendColumnField["CLS"] = "measurements.cls";
  TrendColumnField["SPANS_DB"] = "spans.db";
  TrendColumnField["SPANS_HTTP"] = "spans.http";
  TrendColumnField["SPANS_BROWSER"] = "spans.browser";
  TrendColumnField["SPANS_RESOURCE"] = "spans.resource";
})(TrendColumnField || (TrendColumnField = {}));

/***/ }),

/***/ "./app/views/performance/trends/utils.tsx":
/*!************************************************!*\
  !*** ./app/views/performance/trends/utils.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_MAX_DURATION": () => (/* binding */ DEFAULT_MAX_DURATION),
/* harmony export */   "DEFAULT_TRENDS_STATS_PERIOD": () => (/* binding */ DEFAULT_TRENDS_STATS_PERIOD),
/* harmony export */   "TRENDS_FUNCTIONS": () => (/* binding */ TRENDS_FUNCTIONS),
/* harmony export */   "TRENDS_PARAMETERS": () => (/* binding */ TRENDS_PARAMETERS),
/* harmony export */   "generateTrendFunctionAsString": () => (/* binding */ generateTrendFunctionAsString),
/* harmony export */   "getCurrentTrendFunction": () => (/* binding */ getCurrentTrendFunction),
/* harmony export */   "getCurrentTrendParameter": () => (/* binding */ getCurrentTrendParameter),
/* harmony export */   "getSelectedQueryKey": () => (/* binding */ getSelectedQueryKey),
/* harmony export */   "getTrendProjectId": () => (/* binding */ getTrendProjectId),
/* harmony export */   "getUnselectedSeries": () => (/* binding */ getUnselectedSeries),
/* harmony export */   "modifyTrendView": () => (/* binding */ modifyTrendView),
/* harmony export */   "modifyTrendsViewDefaultPeriod": () => (/* binding */ modifyTrendsViewDefaultPeriod),
/* harmony export */   "movingAverage": () => (/* binding */ movingAverage),
/* harmony export */   "normalizeTrends": () => (/* binding */ normalizeTrends),
/* harmony export */   "performanceTypeToTrendParameterLabel": () => (/* binding */ performanceTypeToTrendParameterLabel),
/* harmony export */   "replaceSeriesName": () => (/* binding */ replaceSeriesName),
/* harmony export */   "replaceSmoothedSeriesName": () => (/* binding */ replaceSmoothedSeriesName),
/* harmony export */   "resetCursors": () => (/* binding */ resetCursors),
/* harmony export */   "smoothTrend": () => (/* binding */ smoothTrend),
/* harmony export */   "transformDeltaSpread": () => (/* binding */ transformDeltaSpread),
/* harmony export */   "transformEventStatsSmoothed": () => (/* binding */ transformEventStatsSmoothed),
/* harmony export */   "transformValueDelta": () => (/* binding */ transformValueDelta),
/* harmony export */   "trendCursorNames": () => (/* binding */ trendCursorNames),
/* harmony export */   "trendSelectedQueryKeys": () => (/* binding */ trendSelectedQueryKeys),
/* harmony export */   "trendToColor": () => (/* binding */ trendToColor),
/* harmony export */   "trendUnselectedSeries": () => (/* binding */ trendUnselectedSeries)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var downsample_methods_ASAP__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! downsample/methods/ASAP */ "../node_modules/downsample/methods/ASAP.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./types */ "./app/views/performance/trends/types.tsx");












const DEFAULT_TRENDS_STATS_PERIOD = '14d';
const DEFAULT_MAX_DURATION = '15min';
const TRENDS_FUNCTIONS = [{
  label: 'p50',
  field: _types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.P50,
  alias: 'percentile_range',
  legendLabel: 'p50'
}, {
  label: 'p75',
  field: _types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.P75,
  alias: 'percentile_range',
  legendLabel: 'p75'
}, {
  label: 'p95',
  field: _types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.P95,
  alias: 'percentile_range',
  legendLabel: 'p95'
}, {
  label: 'p99',
  field: _types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.P99,
  alias: 'percentile_range',
  legendLabel: 'p99'
}, {
  label: 'average',
  field: _types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.AVG,
  alias: 'avg_range',
  legendLabel: 'average'
}];
const TRENDS_PARAMETERS = [{
  label: 'Duration',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.DURATION
}, {
  label: 'LCP',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.LCP
}, {
  label: 'FCP',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.FCP
}, {
  label: 'FID',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.FID
}, {
  label: 'CLS',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.CLS
}, {
  label: 'Spans (http)',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.SPANS_HTTP
}, {
  label: 'Spans (db)',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.SPANS_DB
}, {
  label: 'Spans (browser)',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.SPANS_BROWSER
}, {
  label: 'Spans (resource)',
  column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.SPANS_RESOURCE
}];
const trendToColor = {
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.IMPROVED]: {
    lighter: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].green200,
    default: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].green300
  },
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION]: {
    lighter: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].red200,
    default: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_8__["default"].red300
  }
};
const trendSelectedQueryKeys = {
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.IMPROVED]: 'improvedSelected',
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION]: 'regressionSelected'
};
const trendUnselectedSeries = {
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.IMPROVED]: 'improvedUnselectedSeries',
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION]: 'regressionUnselectedSeries'
};
const trendCursorNames = {
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.IMPROVED]: 'improvedCursor',
  [_types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION]: 'regressionCursor'
};
function resetCursors() {
  const cursors = {};
  Object.values(trendCursorNames).forEach(cursor => cursors[cursor] = undefined); // Resets both cursors

  return cursors;
}
function getCurrentTrendFunction(location, _trendFunctionField) {
  var _location$query;

  const trendFunctionField = _trendFunctionField !== null && _trendFunctionField !== void 0 ? _trendFunctionField : (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_7__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.trendFunction);
  const trendFunction = TRENDS_FUNCTIONS.find(_ref => {
    let {
      field
    } = _ref;
    return field === trendFunctionField;
  });
  return trendFunction || TRENDS_FUNCTIONS[0];
}

function getDefaultTrendParameter(projects, projectIds) {
  const performanceType = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.platformToPerformanceType)(projects, projectIds);
  const trendParameter = performanceTypeToTrendParameterLabel(performanceType);
  return trendParameter;
}

function getCurrentTrendParameter(location, projects, projectIds) {
  var _location$query2;

  const trendParameterLabel = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_7__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2.trendParameter);
  const trendParameter = TRENDS_PARAMETERS.find(_ref2 => {
    let {
      label
    } = _ref2;
    return label === trendParameterLabel;
  });

  if (trendParameter) {
    return trendParameter;
  }

  const defaultTrendParameter = getDefaultTrendParameter(projects, projectIds);
  return defaultTrendParameter;
}
function performanceTypeToTrendParameterLabel(performanceType) {
  switch (performanceType) {
    case _utils__WEBPACK_IMPORTED_MODULE_10__.PROJECT_PERFORMANCE_TYPE.FRONTEND:
      return {
        label: 'LCP',
        column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.LCP
      };

    case _utils__WEBPACK_IMPORTED_MODULE_10__.PROJECT_PERFORMANCE_TYPE.ANY:
    case _utils__WEBPACK_IMPORTED_MODULE_10__.PROJECT_PERFORMANCE_TYPE.BACKEND:
    case _utils__WEBPACK_IMPORTED_MODULE_10__.PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER:
    default:
      return {
        label: 'Duration',
        column: _types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.DURATION
      };
  }
}
function generateTrendFunctionAsString(trendFunction, trendParameter) {
  return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.generateFieldAsString)({
    kind: 'function',
    function: [trendFunction, trendParameter, undefined, undefined]
  });
}
function transformDeltaSpread(from, to) {
  const fromSeconds = from / 1000;
  const toSeconds = to / 1000;
  const showDigits = from > 1000 || to > 1000 || from < 10 || to < 10; // Show digits consistently if either has them

  return {
    fromSeconds,
    toSeconds,
    showDigits
  };
}
function getTrendProjectId(trend, projects) {
  if (!trend.project || !projects) {
    return undefined;
  }

  const transactionProject = projects.find(project => project.slug === trend.project);
  return transactionProject === null || transactionProject === void 0 ? void 0 : transactionProject.id;
}
function modifyTrendView(trendView, location, trendsType, projects, isProjectOnly) {
  const trendFunction = getCurrentTrendFunction(location);
  const trendParameter = getCurrentTrendParameter(location, projects, trendView.project);
  const transactionField = isProjectOnly ? [] : ['transaction'];
  const fields = [...transactionField, 'project'].map(field => ({
    field
  }));
  const trendSort = {
    field: 'trend_percentage()',
    kind: 'asc'
  };
  trendView.trendType = trendsType;

  if (trendsType === _types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION) {
    trendSort.kind = 'desc';
  }

  if (trendFunction && trendParameter) {
    trendView.trendFunction = generateTrendFunctionAsString(trendFunction.field, trendParameter.column);
  }

  trendView.query = getLimitTransactionItems(trendView.query);
  trendView.interval = getQueryInterval(location, trendView);
  trendView.sorts = [trendSort];
  trendView.fields = fields;
}
function modifyTrendsViewDefaultPeriod(eventView, location) {
  const {
    query
  } = location;
  const hasStartAndEnd = query.start && query.end;

  if (!query.statsPeriod && !hasStartAndEnd) {
    eventView.statsPeriod = DEFAULT_TRENDS_STATS_PERIOD;
  }

  return eventView;
}

function getQueryInterval(location, eventView) {
  var _location$query3;

  const intervalFromQueryParam = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_7__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query3 = location.query) === null || _location$query3 === void 0 ? void 0 : _location$query3.interval);
  const {
    start,
    end,
    statsPeriod
  } = eventView;
  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod
  };
  const intervalFromSmoothing = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getInterval)(datetimeSelection, 'high');
  return intervalFromQueryParam || intervalFromSmoothing;
}

function transformValueDelta(value, trendType) {
  const absoluteValue = Math.abs(value);
  const changeLabel = trendType === _types__WEBPACK_IMPORTED_MODULE_11__.TrendChangeType.REGRESSION ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('slower') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('faster');
  const seconds = absoluteValue / 1000;
  const fixedDigits = absoluteValue > 1000 || absoluteValue < 10 ? 1 : 0;
  return {
    seconds,
    fixedDigits,
    changeLabel
  };
}
/**
 * This will normalize the trends transactions while the current trend function and current data are out of sync
 * To minimize extra renders with missing results.
 */

function normalizeTrends(data) {
  const received_at = moment__WEBPACK_IMPORTED_MODULE_3___default()(); // Adding the received time for the transaction so calls to get baseline always line up with the transaction

  return data.map(row => {
    return { ...row,
      received_at,
      transaction: row.transaction
    };
  });
}
function getSelectedQueryKey(trendChangeType) {
  return trendSelectedQueryKeys[trendChangeType];
}
function getUnselectedSeries(trendChangeType) {
  return trendUnselectedSeries[trendChangeType];
}
function movingAverage(data, index, size) {
  return data.slice(index - size, index).map(a => a.value).reduce((a, b) => a + b, 0) / size;
}
/**
 * This function applies defaults for trend and count percentage, and adds the confidence limit to the query
 */

function getLimitTransactionItems(query) {
  const limitQuery = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(query);

  if (!limitQuery.hasFilter('count_percentage()')) {
    limitQuery.addFilterValues('count_percentage()', ['>0.25', '<4']);
  }

  if (!limitQuery.hasFilter('trend_percentage()')) {
    limitQuery.addFilterValues('trend_percentage()', ['>0%']);
  }

  if (!limitQuery.hasFilter('confidence()')) {
    limitQuery.addFilterValues('confidence()', ['>6']);
  }

  return limitQuery.formatString();
}

const smoothTrend = function (data) {
  let resolution = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 100;
  return (0,downsample_methods_ASAP__WEBPACK_IMPORTED_MODULE_2__.ASAP)(data, resolution);
};
const replaceSeriesName = seriesName => {
  return ['p50', 'p75'].find(aggregate => seriesName.includes(aggregate));
};
const replaceSmoothedSeriesName = seriesName => {
  return `Smoothed ${['p50', 'p75'].find(aggregate => seriesName.includes(aggregate))}`;
};
function transformEventStatsSmoothed(data, seriesName) {
  let minValue = Number.MAX_SAFE_INTEGER;
  let maxValue = 0;

  if (!data) {
    return {
      maxValue,
      minValue,
      smoothedResults: undefined
    };
  }

  const smoothedResults = [];

  for (const current of data) {
    const currentData = current.data;
    const resultData = [];
    const smoothed = smoothTrend(currentData.map(_ref3 => {
      let {
        name,
        value
      } = _ref3;
      return [Number(name), value];
    }));

    for (let i = 0; i < smoothed.length; i++) {
      const point = smoothed[i];
      const value = point.y;
      resultData.push({
        name: point.x,
        value
      });

      if (!isNaN(value)) {
        const rounded = Math.round(value);
        minValue = Math.min(rounded, minValue);
        maxValue = Math.max(rounded, maxValue);
      }
    }

    smoothedResults.push({
      seriesName: seriesName || current.seriesName || 'Current',
      data: resultData,
      lineStyle: current.lineStyle,
      color: current.color
    });
  }

  return {
    minValue,
    maxValue,
    smoothedResults
  };
}

/***/ }),

/***/ "./app/views/performance/utils.tsx":
/*!*****************************************!*\
  !*** ./app/views/performance/utils.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EXCLUDE_METRICS_UNPARAM_CONDITIONS": () => (/* binding */ EXCLUDE_METRICS_UNPARAM_CONDITIONS),
/* harmony export */   "PROJECT_PERFORMANCE_TYPE": () => (/* binding */ PROJECT_PERFORMANCE_TYPE),
/* harmony export */   "QUERY_KEYS": () => (/* binding */ QUERY_KEYS),
/* harmony export */   "UNPARAMETERIZED_TRANSACTION": () => (/* binding */ UNPARAMETERIZED_TRANSACTION),
/* harmony export */   "addRoutePerformanceContext": () => (/* binding */ addRoutePerformanceContext),
/* harmony export */   "areMultipleProjectsSelected": () => (/* binding */ areMultipleProjectsSelected),
/* harmony export */   "createUnnamedTransactionsDiscoverTarget": () => (/* binding */ createUnnamedTransactionsDiscoverTarget),
/* harmony export */   "getPerformanceDuration": () => (/* binding */ getPerformanceDuration),
/* harmony export */   "getPerformanceLandingUrl": () => (/* binding */ getPerformanceLandingUrl),
/* harmony export */   "getPerformanceTrendsUrl": () => (/* binding */ getPerformanceTrendsUrl),
/* harmony export */   "getSelectedProjectPlatforms": () => (/* binding */ getSelectedProjectPlatforms),
/* harmony export */   "getSelectedProjectPlatformsArray": () => (/* binding */ getSelectedProjectPlatformsArray),
/* harmony export */   "getTransactionName": () => (/* binding */ getTransactionName),
/* harmony export */   "getTransactionSearchQuery": () => (/* binding */ getTransactionSearchQuery),
/* harmony export */   "handleTrendsClick": () => (/* binding */ handleTrendsClick),
/* harmony export */   "isSummaryViewFrontend": () => (/* binding */ isSummaryViewFrontend),
/* harmony export */   "isSummaryViewFrontendPageLoad": () => (/* binding */ isSummaryViewFrontendPageLoad),
/* harmony export */   "platformAndConditionsToPerformanceType": () => (/* binding */ platformAndConditionsToPerformanceType),
/* harmony export */   "platformToPerformanceType": () => (/* binding */ platformToPerformanceType),
/* harmony export */   "removeTracingKeysFromSearch": () => (/* binding */ removeTracingKeysFromSearch),
/* harmony export */   "trendsTargetRoute": () => (/* binding */ trendsTargetRoute)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getCurrentSentryReactTransaction__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getCurrentSentryReactTransaction */ "./app/utils/getCurrentSentryReactTransaction.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./trends/utils */ "./app/views/performance/trends/utils.tsx");















const QUERY_KEYS = ['environment', 'project', 'query', 'start', 'end', 'statsPeriod'];
const UNPARAMETERIZED_TRANSACTION = '<< unparameterized >>'; // Represents 'other' transactions with high cardinality names that were dropped on the metrics dataset.

const UNPARAMETRIZED_TRANSACTION = '<< unparametrized >>'; // Old spelling. Can be deleted in the future when all data for this transaction name is gone.

const EXCLUDE_METRICS_UNPARAM_CONDITIONS = `(!transaction:"${UNPARAMETERIZED_TRANSACTION}" AND !transaction:"${UNPARAMETRIZED_TRANSACTION}")`;
const SHOW_UNPARAM_BANNER = 'showUnparameterizedBanner';
function createUnnamedTransactionsDiscoverTarget(props) {
  const fields = ['transaction', 'project', 'transaction.source', 'epm()', 'p50()', 'p95()'];
  const query = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Performance - Unparameterized Transactions '),
    query: 'event.type:transaction transaction.source:"url"',
    projects: [],
    fields,
    version: 2
  };
  const discoverEventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromNewQueryWithLocation(query, props.location).withSorts([{
    field: 'epm',
    kind: 'desc'
  }]);
  const target = discoverEventView.getResultsViewUrlTarget(props.organization.slug);
  target.query[SHOW_UNPARAM_BANNER] = 'true';
  return target;
}
/**
 * Performance type can used to determine a default view or which specific field should be used by default on pages
 * where we don't want to wait for transaction data to return to determine how to display aspects of a page.
 */

let PROJECT_PERFORMANCE_TYPE; // The native SDK is equally used on clients and end-devices as on
// backend, the default view should be "All Transactions".

(function (PROJECT_PERFORMANCE_TYPE) {
  PROJECT_PERFORMANCE_TYPE["ANY"] = "any";
  PROJECT_PERFORMANCE_TYPE["FRONTEND"] = "frontend";
  PROJECT_PERFORMANCE_TYPE["BACKEND"] = "backend";
  PROJECT_PERFORMANCE_TYPE["FRONTEND_OTHER"] = "frontend_other";
  PROJECT_PERFORMANCE_TYPE["MOBILE"] = "mobile";
})(PROJECT_PERFORMANCE_TYPE || (PROJECT_PERFORMANCE_TYPE = {}));

const FRONTEND_PLATFORMS = [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_4__.frontend];
const BACKEND_PLATFORMS = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_4__.backend.filter(platform => platform !== 'native');
const MOBILE_PLATFORMS = [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_4__.mobile];
function platformToPerformanceType(projects, projectIds) {
  if (projectIds.length === 0 || projectIds[0] === sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__.ALL_ACCESS_PROJECTS) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }

  const selectedProjects = projects.filter(p => projectIds.includes(parseInt(`${p.id}`, 10)));

  if (selectedProjects.length === 0 || selectedProjects.some(p => !p.platform)) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }

  if (selectedProjects.every(project => FRONTEND_PLATFORMS.includes(project.platform))) {
    return PROJECT_PERFORMANCE_TYPE.FRONTEND;
  }

  if (selectedProjects.every(project => BACKEND_PLATFORMS.includes(project.platform))) {
    return PROJECT_PERFORMANCE_TYPE.BACKEND;
  }

  if (selectedProjects.every(project => MOBILE_PLATFORMS.includes(project.platform))) {
    return PROJECT_PERFORMANCE_TYPE.MOBILE;
  }

  return PROJECT_PERFORMANCE_TYPE.ANY;
}
/**
 * Used for transaction summary to determine appropriate columns on a page, since there is no display field set for the page.
 */

function platformAndConditionsToPerformanceType(projects, eventView) {
  const performanceType = platformToPerformanceType(projects, eventView.project);

  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__.MutableSearch(eventView.query);
    const ops = conditions.getFilterValues('!transaction.op');

    if (ops.some(op => op === 'pageload')) {
      return PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER;
    }
  }

  return performanceType;
}
/**
 * Used for transaction summary to check the view itself, since it can have conditions which would exclude it from having vitals aside from platform.
 */

function isSummaryViewFrontendPageLoad(eventView, projects) {
  return platformAndConditionsToPerformanceType(projects, eventView) === PROJECT_PERFORMANCE_TYPE.FRONTEND;
}
function isSummaryViewFrontend(eventView, projects) {
  return platformAndConditionsToPerformanceType(projects, eventView) === PROJECT_PERFORMANCE_TYPE.FRONTEND || platformAndConditionsToPerformanceType(projects, eventView) === PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER;
}
function getPerformanceLandingUrl(organization) {
  return `/organizations/${organization.slug}/performance/`;
}
function getPerformanceTrendsUrl(organization) {
  return `/organizations/${organization.slug}/performance/trends/`;
}
function getTransactionSearchQuery(location) {
  let query = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.query, query).trim();
}
function handleTrendsClick(_ref) {
  let {
    location,
    organization,
    projectPlatforms
  } = _ref;
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.trackAnalyticsEvent)({
    eventKey: 'performance_views.change_view',
    eventName: 'Performance Views: Change View',
    organization_id: parseInt(organization.id, 10),
    view_name: 'TRENDS',
    project_platforms: projectPlatforms
  });
  const target = trendsTargetRoute({
    location,
    organization
  });
  react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push(target);
}
function trendsTargetRoute(_ref2) {
  let {
    location,
    organization,
    initialConditions,
    additionalQuery
  } = _ref2;
  const newQuery = { ...location.query,
    ...additionalQuery
  };
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__.MutableSearch(query);
  const modifiedConditions = initialConditions !== null && initialConditions !== void 0 ? initialConditions : new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__.MutableSearch([]);

  if (conditions.hasFilter('tpm()')) {
    modifiedConditions.setFilterValues('tpm()', conditions.getFilterValues('tpm()'));
  } else {
    modifiedConditions.setFilterValues('tpm()', ['>0.01']);
  }

  if (conditions.hasFilter('transaction.duration')) {
    modifiedConditions.setFilterValues('transaction.duration', conditions.getFilterValues('transaction.duration'));
  } else {
    modifiedConditions.setFilterValues('transaction.duration', ['>0', `<${_trends_utils__WEBPACK_IMPORTED_MODULE_14__.DEFAULT_MAX_DURATION}`]);
  }

  newQuery.query = modifiedConditions.formatString();
  return {
    pathname: getPerformanceTrendsUrl(organization),
    query: { ...newQuery
    }
  };
}
function removeTracingKeysFromSearch(currentFilter) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
    excludeTagKeys: new Set([// event type can be "transaction" but we're searching for issues
    'event.type', // the project is already determined by the transaction,
    // and issue search does not support the project filter
    'project'])
  };
  currentFilter.getFilterKeys().forEach(tagKey => {
    const searchKey = tagKey.startsWith('!') ? tagKey.substr(1) : tagKey; // Remove aggregates and transaction event fields

    if ( // aggregates
    searchKey.match(/\w+\(.*\)/) || // transaction event fields
    sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.TRACING_FIELDS.includes(searchKey) || // tags that we don't want to pass to pass to issue search
    options.excludeTagKeys.has(searchKey)) {
      currentFilter.removeFilter(tagKey);
    }
  });
  return currentFilter;
}
function addRoutePerformanceContext(selection) {
  const transaction = (0,sentry_utils_getCurrentSentryReactTransaction__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const days = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_7__.statsPeriodToDays)(selection.datetime.period, selection.datetime.start, selection.datetime.end);
  const oneDay = 86400;
  const seconds = Math.floor(days * oneDay);
  transaction === null || transaction === void 0 ? void 0 : transaction.setTag('query.period', seconds.toString());
  let groupedPeriod = '>30d';

  if (seconds <= oneDay) {
    groupedPeriod = '<=1d';
  } else if (seconds <= oneDay * 7) {
    groupedPeriod = '<=7d';
  } else if (seconds <= oneDay * 14) {
    groupedPeriod = '<=14d';
  } else if (seconds <= oneDay * 30) {
    groupedPeriod = '<=30d';
  }

  transaction === null || transaction === void 0 ? void 0 : transaction.setTag('query.period.grouped', groupedPeriod);
}
function getTransactionName(location) {
  const {
    transaction
  } = location.query;
  return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(transaction);
}
function getPerformanceDuration(milliseconds) {
  return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_10__.getDuration)(milliseconds / 1000, milliseconds > 1000 ? 2 : 0, true);
}
function areMultipleProjectsSelected(eventView) {
  if (!eventView.project.length) {
    return true; // My projects
  }

  if (eventView.project.length === 1 && eventView.project[0] === sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__.ALL_ACCESS_PROJECTS) {
    return true; // All projects
  }

  return false;
}
function getSelectedProjectPlatformsArray(location, projects) {
  const projectQuery = location.query.project;
  const selectedProjectIdSet = Array.isArray(projectQuery) ? new Set(projectQuery) : new Set([projectQuery]);
  const selectedProjectPlatforms = projects.reduce((acc, project) => {
    if (selectedProjectIdSet.has(project.id)) {
      var _project$platform;

      acc.push((_project$platform = project.platform) !== null && _project$platform !== void 0 ? _project$platform : 'undefined');
    }

    return acc;
  }, []);
  return selectedProjectPlatforms;
}
function getSelectedProjectPlatforms(location, projects) {
  const selectedProjectPlatforms = getSelectedProjectPlatformsArray(location, projects);
  return selectedProjectPlatforms.join(', ');
}

/***/ }),

/***/ "./app/views/performance/vitalDetail/utils.tsx":
/*!*****************************************************!*\
  !*** ./app/views/performance/vitalDetail/utils.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VitalState": () => (/* binding */ VitalState),
/* harmony export */   "generateVitalDetailRoute": () => (/* binding */ generateVitalDetailRoute),
/* harmony export */   "getMaxOfSeries": () => (/* binding */ getMaxOfSeries),
/* harmony export */   "getVitalChartDefinitions": () => (/* binding */ getVitalChartDefinitions),
/* harmony export */   "getVitalChartTitle": () => (/* binding */ getVitalChartTitle),
/* harmony export */   "getVitalDetailTableMehStatusFunction": () => (/* binding */ getVitalDetailTableMehStatusFunction),
/* harmony export */   "getVitalDetailTablePoorStatusFunction": () => (/* binding */ getVitalDetailTablePoorStatusFunction),
/* harmony export */   "vitalAbbreviations": () => (/* binding */ vitalAbbreviations),
/* harmony export */   "vitalAlertTypes": () => (/* binding */ vitalAlertTypes),
/* harmony export */   "vitalChartTitleMap": () => (/* binding */ vitalChartTitleMap),
/* harmony export */   "vitalDescription": () => (/* binding */ vitalDescription),
/* harmony export */   "vitalDetailRouteWithQuery": () => (/* binding */ vitalDetailRouteWithQuery),
/* harmony export */   "vitalMap": () => (/* binding */ vitalMap),
/* harmony export */   "vitalNameFromLocation": () => (/* binding */ vitalNameFromLocation),
/* harmony export */   "vitalStateColors": () => (/* binding */ vitalStateColors),
/* harmony export */   "vitalStateIcons": () => (/* binding */ vitalStateIcons),
/* harmony export */   "vitalSupportedBrowsers": () => (/* binding */ vitalSupportedBrowsers),
/* harmony export */   "webVitalMeh": () => (/* binding */ webVitalMeh),
/* harmony export */   "webVitalPoor": () => (/* binding */ webVitalPoor)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function generateVitalDetailRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/vitaldetail/`;
}
const webVitalPoor = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FP]: 3000,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 3000,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 4000,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 300,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 0.25
};
const webVitalMeh = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FP]: 1000,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 1000,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 2500,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 100,
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 0.1
};
let VitalState;

(function (VitalState) {
  VitalState["POOR"] = "Poor";
  VitalState["MEH"] = "Meh";
  VitalState["GOOD"] = "Good";
})(VitalState || (VitalState = {}));

const vitalStateColors = {
  [VitalState.POOR]: 'red300',
  [VitalState.MEH]: 'yellow300',
  [VitalState.GOOD]: 'green300'
};
const vitalStateIcons = {
  [VitalState.POOR]: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSad, {
    color: vitalStateColors[VitalState.POOR]
  }),
  [VitalState.MEH]: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconMeh, {
    color: vitalStateColors[VitalState.MEH]
  }),
  [VitalState.GOOD]: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconHappy, {
    color: vitalStateColors[VitalState.GOOD]
  })
};
function vitalDetailRouteWithQuery(_ref2) {
  let {
    orgSlug,
    vitalName,
    projectID,
    query
  } = _ref2;
  const pathname = generateVitalDetailRoute({
    orgSlug
  });
  return {
    pathname,
    query: {
      vitalName,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query
    }
  };
}
function vitalNameFromLocation(location) {
  const _vitalName = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.vitalName);

  const vitalName = Object.values(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital).find(v => v === _vitalName);

  if (vitalName) {
    return vitalName;
  }

  return sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP;
}
function getVitalChartTitle(webVital) {
  if (webVital === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('CLS p75');
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p75');
}
function getVitalDetailTablePoorStatusFunction(vitalName) {
  const vitalThreshold = webVitalPoor[vitalName];
  const statusFunction = `compare_numeric_aggregate(${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.getAggregateAlias)(`p75(${vitalName})`)},greater,${vitalThreshold})`;
  return statusFunction;
}
function getVitalDetailTableMehStatusFunction(vitalName) {
  const vitalThreshold = webVitalMeh[vitalName];
  const statusFunction = `compare_numeric_aggregate(${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.getAggregateAlias)(`p75(${vitalName})`)},greater,${vitalThreshold})`;
  return statusFunction;
}
const vitalMap = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 'First Contentful Paint',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 'Cumulative Layout Shift',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 'First Input Delay',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 'Largest Contentful Paint'
};
const vitalChartTitleMap = vitalMap;
const vitalDescription = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 'First Contentful Paint (FCP) measures the amount of time the first content takes to render in the viewport. Like FP, this could also show up in any form from the document object model (DOM), such as images, SVGs, or text blocks. At the moment, there is support for FCP in the following browsers:',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. Imagine navigating to an article and trying to click a link before the page finishes loading. Before your cursor even gets there, the link may have shifted down due to an image rendering. Rather than using duration for this Web Vital, the CLS score represents the degree of disruptive and visually unstable shifts. At the moment, there is support for CLS in the following browsers:',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 'First Input Delay (FID) measures the response time when the user tries to interact with the viewport. Actions maybe include clicking a button, link or other custom Javascript controller. It is key in helping the user determine if a page is usable or not. At the moment, there is support for FID in the following browsers:',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. This may be in any form from the document object model (DOM), such as images, SVGs, or text blocks. It’s the largest pixel area in the viewport, thus most visually defining. LCP helps developers understand how long it takes to see the main content on the page. At the moment, there is support for LCP in the following browsers:'
};
const vitalAbbreviations = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 'FCP',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 'CLS',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 'FID',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 'LCP'
};
const vitalAlertTypes = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: 'custom',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: 'cls',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: 'fid',
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: 'lcp'
};
function getMaxOfSeries(series) {
  let max = -Infinity;

  for (const {
    data
  } of series) {
    for (const point of data) {
      max = Math.max(max, point.value);
    }
  }

  return max;
}
const vitalSupportedBrowsers = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA],
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.FIREFOX, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.SAFARI, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.IE],
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA],
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FP]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA],
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.FIREFOX, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.SAFARI],
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.TTFB]: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.CHROME, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.EDGE, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.OPERA, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.FIREFOX, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.SAFARI, sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_8__.Browser.IE]
};
function getVitalChartDefinitions(_ref3) {
  let {
    theme,
    location,
    vital,
    yAxis
  } = _ref3;
  const utc = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.utc) !== 'false';
  const vitalPoor = webVitalPoor[vital];
  const vitalMeh = webVitalMeh[vital];
  const legend = {
    right: 10,
    top: 0,
    selected: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__.getSeriesSelection)(location)
  };
  const chartOptions = {
    grid: {
      left: '5px',
      right: '10px',
      top: '35px',
      bottom: '0px'
    },
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, seriesName) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(vital === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS ? seriesName : yAxis))
    },
    yAxis: {
      min: 0,
      max: vitalPoor,
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        // coerces the axis to be time based
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(yAxis))
      }
    }
  };
  const markLines = [{
    seriesName: 'Thresholds',
    type: 'line',
    data: [],
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_1__["default"])({
      silent: true,
      lineStyle: {
        color: theme.red300,
        type: 'dashed',
        width: 1.5
      },
      label: {
        show: true,
        position: 'insideEndTop',
        formatter: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Poor')
      },
      data: [{
        yAxis: vitalPoor
      } // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
      ]
    })
  }, {
    seriesName: 'Thresholds',
    type: 'line',
    data: [],
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_1__["default"])({
      silent: true,
      lineStyle: {
        color: theme.yellow300,
        type: 'dashed',
        width: 1.5
      },
      label: {
        show: true,
        position: 'insideEndTop',
        formatter: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Meh')
      },
      data: [{
        yAxis: vitalMeh
      } // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
      ]
    })
  }];
  return {
    vitalPoor,
    vitalMeh,
    legend,
    chartOptions,
    markLines,
    utc
  };
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_trends_utils_tsx-app_views_performance_utils_tsx-app_views_performance_-d12d8e.5909503c20408cb2b730e7ce37fd8cfc.js.map