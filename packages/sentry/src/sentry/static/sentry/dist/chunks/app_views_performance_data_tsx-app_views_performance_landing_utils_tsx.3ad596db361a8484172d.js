"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_data_tsx-app_views_performance_landing_utils_tsx"],{

/***/ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx":
/*!*******************************************************************!*\
  !*** ./app/utils/performance/contexts/metricsEnhancedSetting.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AutoSampleState": () => (/* binding */ AutoSampleState),
/* harmony export */   "MEPConsumer": () => (/* binding */ MEPConsumer),
/* harmony export */   "MEPSetting": () => (/* binding */ MEPSetting),
/* harmony export */   "MEPSettingProvider": () => (/* binding */ MEPSettingProvider),
/* harmony export */   "MEPState": () => (/* binding */ MEPState),
/* harmony export */   "METRIC_SEARCH_SETTING_PARAM": () => (/* binding */ METRIC_SEARCH_SETTING_PARAM),
/* harmony export */   "METRIC_SETTING_PARAM": () => (/* binding */ METRIC_SETTING_PARAM),
/* harmony export */   "canUseMetricsData": () => (/* binding */ canUseMetricsData),
/* harmony export */   "canUseMetricsDevUI": () => (/* binding */ canUseMetricsDevUI),
/* harmony export */   "useMEPSettingContext": () => (/* binding */ useMEPSettingContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const [_MEPSettingProvider, _useMEPSettingContext, _MEPSettingContext] = (0,_utils__WEBPACK_IMPORTED_MODULE_8__.createDefinedContext)({
  name: 'MetricsEnhancedSettingContext'
});
const MEPConsumer = _MEPSettingContext.Consumer;
/**
 * These will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 * "Unset" should be the initial state before any queries return for the first time.
 */

let AutoSampleState;
/**
 * Metrics/transactions will be called something else in the copy, but functionally the data is coming from metrics / transactions.
 */

(function (AutoSampleState) {
  AutoSampleState["unset"] = "unset";
  AutoSampleState["metrics"] = "metrics";
  AutoSampleState["transactions"] = "transactions";
})(AutoSampleState || (AutoSampleState = {}));

let MEPState;

(function (MEPState) {
  MEPState["auto"] = "auto";
  MEPState["metricsOnly"] = "metricsOnly";
  MEPState["transactionsOnly"] = "transactionsOnly";
})(MEPState || (MEPState = {}));

const METRIC_SETTING_PARAM = 'metricSetting';
const METRIC_SEARCH_SETTING_PARAM = 'metricSearchSetting'; // TODO: Clean this up since we don't need multiple params in practice.

const storageKey = 'performance.metrics-enhanced-setting';
class MEPSetting {
  static get() {
    const value = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__["default"].getItem(storageKey);

    if (value) {
      if (!(value in MEPState)) {
        sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__["default"].removeItem(storageKey);
        return null;
      }

      return MEPState[value];
    }

    return null;
  }

  static set(value) {
    sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__["default"].setItem(storageKey, value);
  }

}
function canUseMetricsDevUI(organization) {
  return organization.features.includes('performance-use-metrics');
}
function canUseMetricsData(organization) {
  const isDevFlagOn = canUseMetricsDevUI(organization); // Forces metrics data on as well.

  const isInternalViewOn = organization.features.includes('performance-transaction-name-only-search'); // TODO: Swap this flag out.

  const samplingRolloutFlag = organization.features.includes('server-side-sampling');
  const isRollingOut = samplingRolloutFlag && organization.features.includes('mep-rollout-flag');
  return isDevFlagOn || isInternalViewOn || isRollingOut;
}
const MEPSettingProvider = _ref => {
  var _allowedStates$find;

  let {
    children,
    location,
    _hasMEPState,
    forceTransactions
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const canUseMEP = canUseMetricsData(organization);
  const allowedStates = [MEPState.metricsOnly, MEPState.transactionsOnly];

  const _metricSettingFromParam = location ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(location.query[METRIC_SETTING_PARAM]) : MEPState.metricsOnly;

  let defaultMetricsState = MEPState.metricsOnly;

  if (forceTransactions) {
    defaultMetricsState = MEPState.transactionsOnly;
  }

  const metricSettingFromParam = (_allowedStates$find = allowedStates.find(s => s === _metricSettingFromParam)) !== null && _allowedStates$find !== void 0 ? _allowedStates$find : defaultMetricsState;
  const isControlledMEP = typeof _hasMEPState !== 'undefined';
  const [_metricSettingState, _setMetricSettingState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useReducer)((_, next) => next, metricSettingFromParam);
  const setMetricSettingState = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(settingState => {
    if (!location) {
      return;
    }

    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({ ...location,
      query: { ...location.query,
        [METRIC_SETTING_PARAM]: settingState
      }
    });

    _setMetricSettingState(settingState);
  }, [location, _setMetricSettingState]);
  const [autoSampleState, setAutoSampleState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useReducer)((_, next) => next, AutoSampleState.unset);
  const metricSettingState = isControlledMEP ? _hasMEPState : _metricSettingState;
  const shouldQueryProvideMEPAutoParams = canUseMEP && metricSettingState === MEPState.auto;
  const shouldQueryProvideMEPMetricParams = canUseMEP && metricSettingState === MEPState.metricsOnly;
  const shouldQueryProvideMEPTransactionParams = canUseMEP && metricSettingState === MEPState.transactionsOnly;
  const memoizationKey = `${metricSettingState}`;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_MEPSettingProvider, {
    value: {
      autoSampleState,
      metricSettingState,
      shouldQueryProvideMEPAutoParams,
      shouldQueryProvideMEPMetricParams,
      shouldQueryProvideMEPTransactionParams,
      memoizationKey,
      setMetricSettingState,
      setAutoSampleState
    },
    children: children
  });
};
MEPSettingProvider.displayName = "MEPSettingProvider";
const useMEPSettingContext = _useMEPSettingContext;

/***/ }),

/***/ "./app/views/performance/data.tsx":
/*!****************************************!*\
  !*** ./app/views/performance/data.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COLUMN_TITLES": () => (/* binding */ COLUMN_TITLES),
/* harmony export */   "DEFAULT_PROJECT_THRESHOLD": () => (/* binding */ DEFAULT_PROJECT_THRESHOLD),
/* harmony export */   "DEFAULT_PROJECT_THRESHOLD_METRIC": () => (/* binding */ DEFAULT_PROJECT_THRESHOLD_METRIC),
/* harmony export */   "DEFAULT_STATS_PERIOD": () => (/* binding */ DEFAULT_STATS_PERIOD),
/* harmony export */   "PERFORMANCE_TERM": () => (/* binding */ PERFORMANCE_TERM),
/* harmony export */   "PERFORMANCE_TERMS": () => (/* binding */ PERFORMANCE_TERMS),
/* harmony export */   "generatePerformanceEventView": () => (/* binding */ generatePerformanceEventView),
/* harmony export */   "generatePerformanceVitalDetailView": () => (/* binding */ generatePerformanceVitalDetailView),
/* harmony export */   "getAxisOptions": () => (/* binding */ getAxisOptions),
/* harmony export */   "getBackendAxisOptions": () => (/* binding */ getBackendAxisOptions),
/* harmony export */   "getFrontendAxisOptions": () => (/* binding */ getFrontendAxisOptions),
/* harmony export */   "getFrontendOtherAxisOptions": () => (/* binding */ getFrontendOtherAxisOptions),
/* harmony export */   "getMobileAxisOptions": () => (/* binding */ getMobileAxisOptions),
/* harmony export */   "getTermHelp": () => (/* binding */ getTermHelp)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _landing_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./landing/utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");













const DEFAULT_STATS_PERIOD = '24h';
const DEFAULT_PROJECT_THRESHOLD_METRIC = 'duration';
const DEFAULT_PROJECT_THRESHOLD = 300;
const COLUMN_TITLES = ['transaction', 'project', 'tpm', 'p50', 'p95', 'failure rate', 'apdex', 'users', 'user misery'];
let PERFORMANCE_TERM;

(function (PERFORMANCE_TERM) {
  PERFORMANCE_TERM["TPM"] = "tpm";
  PERFORMANCE_TERM["THROUGHPUT"] = "throughput";
  PERFORMANCE_TERM["FAILURE_RATE"] = "failureRate";
  PERFORMANCE_TERM["P50"] = "p50";
  PERFORMANCE_TERM["P75"] = "p75";
  PERFORMANCE_TERM["P95"] = "p95";
  PERFORMANCE_TERM["P99"] = "p99";
  PERFORMANCE_TERM["LCP"] = "lcp";
  PERFORMANCE_TERM["FCP"] = "fcp";
  PERFORMANCE_TERM["FID"] = "fid";
  PERFORMANCE_TERM["CLS"] = "cls";
  PERFORMANCE_TERM["STATUS_BREAKDOWN"] = "statusBreakdown";
  PERFORMANCE_TERM["DURATION_DISTRIBUTION"] = "durationDistribution";
  PERFORMANCE_TERM["USER_MISERY"] = "userMisery";
  PERFORMANCE_TERM["APDEX"] = "apdex";
  PERFORMANCE_TERM["APP_START_COLD"] = "appStartCold";
  PERFORMANCE_TERM["APP_START_WARM"] = "appStartWarm";
  PERFORMANCE_TERM["SLOW_FRAMES"] = "slowFrames";
  PERFORMANCE_TERM["FROZEN_FRAMES"] = "frozenFrames";
  PERFORMANCE_TERM["STALL_PERCENTAGE"] = "stallPercentage";
  PERFORMANCE_TERM["MOST_ISSUES"] = "mostIssues";
  PERFORMANCE_TERM["MOST_ERRORS"] = "mostErrors";
  PERFORMANCE_TERM["SLOW_HTTP_SPANS"] = "slowHTTPSpans";
})(PERFORMANCE_TERM || (PERFORMANCE_TERM = {}));

function getAxisOptions(organization) {
  return [{
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
    value: 'apdex()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Apdex')
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    value: 'tpm()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions Per Minute')
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    value: 'failure_rate()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Failure Rate')
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
    value: 'p50()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p50 Duration')
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
    value: 'p95()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p95 Duration')
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
    value: 'p99()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p99 Duration')
  }];
}
function getFrontendAxisOptions(organization) {
  return [{
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.LCP),
    value: `p75(lcp)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('LCP p75'),
    field: 'p75(measurements.lcp)',
    isLeftDefault: true,
    backupOption: {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.FCP),
      value: `p75(fcp)`,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('FCP p75'),
      field: 'p75(measurements.fcp)'
    }
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    value: 'lcp_distribution',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('LCP Distribution'),
    field: 'measurements.lcp',
    isDistribution: true,
    isRightDefault: true,
    backupOption: {
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
      value: 'fcp_distribution',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('FCP Distribution'),
      field: 'measurements.fcp',
      isDistribution: true
    }
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    value: 'tpm()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions Per Minute'),
    field: 'tpm()'
  }];
}
function getFrontendOtherAxisOptions(organization) {
  return [{
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
    value: `p50()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p50'),
    field: 'p50(transaction.duration)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
    value: `p75()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p75'),
    field: 'p75(transaction.duration)',
    isLeftDefault: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
    value: `p95()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p95'),
    field: 'p95(transaction.duration)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    value: 'duration_distribution',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration Distribution'),
    field: 'transaction.duration',
    isDistribution: true,
    isRightDefault: true
  }];
}
function getBackendAxisOptions(organization) {
  return [{
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P50),
    value: `p50()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p50'),
    field: 'p50(transaction.duration)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
    value: `p75()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p75'),
    field: 'p75(transaction.duration)',
    isLeftDefault: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P95),
    value: `p95()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p95'),
    field: 'p95(transaction.duration)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.P99),
    value: `p99()`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration p99'),
    field: 'p99(transaction.duration)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    value: 'tpm()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions Per Minute'),
    field: 'tpm()'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    value: 'failure_rate()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Failure Rate'),
    field: 'failure_rate()'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    value: 'duration_distribution',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Duration Distribution'),
    field: 'transaction.duration',
    isDistribution: true,
    isRightDefault: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
    value: 'apdex()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Apdex'),
    field: 'apdex()'
  }];
}
function getMobileAxisOptions(organization) {
  return [{
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
    value: `p50(measurements.app_start_cold)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold Start Duration p50'),
    field: 'p50(measurements.app_start_cold)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
    value: `p75(measurements.app_start_cold)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold Start Duration p75'),
    field: 'p75(measurements.app_start_cold)',
    isLeftDefault: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
    value: `p95(measurements.app_start_cold)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold Start Duration p95'),
    field: 'p95(measurements.app_start_cold)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
    value: `p99(measurements.app_start_cold)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold Start Duration p99'),
    field: 'p99(measurements.app_start_cold)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    value: 'app_start_cold_distribution',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold Start Distribution'),
    field: 'measurements.app_start_cold',
    isDistribution: true,
    isRightDefault: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
    value: `p50(measurements.app_start_warm)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm Start Duration p50'),
    field: 'p50(measurements.app_start_warm)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
    value: `p75(measurements.app_start_warm)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm Start Duration p75'),
    field: 'p75(measurements.app_start_warm)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
    value: `p95(measurements.app_start_warm)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm Start Duration p95'),
    field: 'p95(measurements.app_start_warm)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
    value: `p99(measurements.app_start_warm)`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm Start Duration p99'),
    field: 'p99(measurements.app_start_warm)'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.DURATION_DISTRIBUTION),
    value: 'app_start_warm_distribution',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm Start Distribution'),
    field: 'measurements.app_start_warm',
    isDistribution: true
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.TPM),
    value: 'tpm()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions Per Minute'),
    field: 'tpm()'
  }, {
    tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
    value: 'failure_rate()',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Failure Rate'),
    field: 'failure_rate()'
  }];
}
const PERFORMANCE_TERMS = {
  tpm: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('TPM is the number of recorded transaction events per minute.'),
  throughput: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Throughput is the number of recorded transaction events per minute.'),
  failureRate: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Failure rate is the percentage of recorded transactions that had a known and unsuccessful status.'),
  p50: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p50 indicates the duration that 50% of transactions are faster than.'),
  p75: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p75 indicates the duration that 75% of transactions are faster than.'),
  p95: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p95 indicates the duration that 95% of transactions are faster than.'),
  p99: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('p99 indicates the duration that 99% of transactions are faster than.'),
  lcp: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Largest contentful paint (LCP) is a web vital meant to represent user load times'),
  fcp: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('First contentful paint (FCP) is a web vital meant to represent user load times'),
  fid: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('First input delay (FID) is a web vital representing load for the first user interaction on a page.'),
  cls: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cumulative layout shift (CLS) is a web vital measuring unexpected visual shifting a user experiences.'),
  statusBreakdown: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The breakdown of transaction statuses. This may indicate what type of failure it is.'),
  durationDistribution: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Distribution buckets counts of transactions at specifics times for your current date range'),
  userMisery: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("User Misery is a score that represents the number of unique users who have experienced load times 4x the project's configured threshold. Adjust project threshold in project performance settings."),
  apdex: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Apdex is the ratio of both satisfactory and tolerable response times to all response times. To adjust the tolerable threshold, go to project performance settings.'),
  appStartCold: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Cold start is a measure of the application start up time from scratch.'),
  appStartWarm: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Warm start is a measure of the application start up time while still in memory.'),
  slowFrames: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The count of the number of slow frames in the transaction.'),
  frozenFrames: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The count of the number of frozen frames in the transaction.'),
  mostErrors: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Transactions with the most associated errors.'),
  mostIssues: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The most instances of an issue for a related transaction.'),
  slowHTTPSpans: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The transactions with the slowest spans of a certain type.'),
  stallPercentage: () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('The percentage of the transaction duration in which the application is in a stalled state.')
};
function getTermHelp(organization, term) {
  if (!PERFORMANCE_TERMS.hasOwnProperty(term)) {
    return '';
  }

  return PERFORMANCE_TERMS[term](organization);
}

function shouldAddDefaultConditions(location) {
  const {
    query
  } = location;
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const isDefaultQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.isDefaultQuery);
  return !searchQuery && isDefaultQuery !== 'false';
}

function isUsingLimitedSearch(location, withStaticFilters) {
  const {
    query
  } = location;
  const mepSearchState = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query[sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.METRIC_SEARCH_SETTING_PARAM], '');
  const mepSettingState = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query[sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.METRIC_SETTING_PARAM], ''); // TODO: Can be removed since it's for dev ui only.

  return withStaticFilters && (mepSearchState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.MEPState.metricsOnly || mepSettingState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_6__.MEPState.metricsOnly);
}

function generateGenericPerformanceEventView(location, withStaticFilters) {
  const {
    query
  } = location;
  const fields = ['team_key_transaction', 'transaction', 'project', 'tpm()', 'p50()', 'p95()', 'failure_rate()', 'apdex()', 'count_unique(user)', 'count_miserable(user)', 'user_misery()'];
  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
    version: 2
  };
  const widths = Array(savedQuery.fields.length).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-tpm');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery);
  const isLimitedSearch = isUsingLimitedSearch(location, withStaticFilters); // This is not an override condition since we want the duration to appear in the search bar as a default.

  if (shouldAddDefaultConditions(location) && !withStaticFilters) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  } // If there is a bare text search, we want to treat it as a search
  // on the transaction name.


  if (conditions.freeText.length > 0) {
    const parsedFreeText = isLimitedSearch ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(conditions.freeText, '') : conditions.freeText.join(' ');

    if (isLimitedSearch) {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`${parsedFreeText}`], false);
    } else {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`*${parsedFreeText}*`], false);
    }

    conditions.freeText = [];
  }

  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);

  if (query.trendParameter) {
    // projects and projectIds are not necessary here since trendParameter will always
    // be present in location and will not be determined based on the project type
    const trendParameter = (0,sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_10__.getCurrentTrendParameter)(location, [], []);

    if (Boolean(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_7__.WEB_VITAL_DETAILS[trendParameter.column])) {
      eventView.additionalConditions.addFilterValues('has', [trendParameter.column]);
    }
  }

  return eventView;
}

function generateBackendPerformanceEventView(location, withStaticFilters) {
  const {
    query
  } = location;
  const fields = ['team_key_transaction', 'transaction', 'project', 'transaction.op', 'http.method', 'tpm()', 'p50()', 'p95()', 'failure_rate()', 'apdex()', 'count_unique(user)', 'count_miserable(user)', 'user_misery()'];
  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
    version: 2
  };
  const widths = Array(savedQuery.fields.length).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-tpm');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery);
  const isLimitedSearch = isUsingLimitedSearch(location, withStaticFilters); // This is not an override condition since we want the duration to appear in the search bar as a default.

  if (shouldAddDefaultConditions(location) && !withStaticFilters) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  } // If there is a bare text search, we want to treat it as a search
  // on the transaction name.


  if (conditions.freeText.length > 0) {
    const parsedFreeText = isLimitedSearch ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(conditions.freeText, '') : conditions.freeText.join(' ');

    if (isLimitedSearch) {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`${parsedFreeText}`], false);
    } else {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`*${parsedFreeText}*`], false);
    }

    conditions.freeText = [];
  }

  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  return eventView;
}

function generateMobilePerformanceEventView(location, projects, genericEventView, withStaticFilters) {
  const {
    query
  } = location;
  const fields = ['team_key_transaction', 'transaction', 'project', 'transaction.op', 'tpm()', 'p75(measurements.frames_slow_rate)', 'p75(measurements.frames_frozen_rate)']; // At this point, all projects are mobile projects.
  // If in addition to that, all projects are react-native projects,
  // then show the stall percentage as well.

  const projectIds = genericEventView.project;

  if (projectIds.length > 0 && projectIds[0] !== sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__.ALL_ACCESS_PROJECTS) {
    const selectedProjects = projects.filter(p => projectIds.includes(parseInt(p.id, 10)));

    if (selectedProjects.length > 0 && selectedProjects.every(project => project.platform === 'react-native')) {
      fields.push('p75(measurements.stall_percentage)');
    }
  }

  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields: [...fields, 'count_unique(user)', 'count_miserable(user)', 'user_misery()'],
    version: 2
  };
  const widths = Array(savedQuery.fields.length).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-tpm');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery);
  const isLimitedSearch = isUsingLimitedSearch(location, withStaticFilters); // This is not an override condition since we want the duration to appear in the search bar as a default.

  if (shouldAddDefaultConditions(location) && !withStaticFilters) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  } // If there is a bare text search, we want to treat it as a search
  // on the transaction name.


  if (conditions.freeText.length > 0) {
    const parsedFreeText = isLimitedSearch ? // pick first element to search transactions by name
    (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(conditions.freeText, '') : conditions.freeText.join(' ');

    if (isLimitedSearch) {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`${parsedFreeText}`], false);
    } else {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`*${parsedFreeText}*`], false);
    }

    conditions.freeText = [];
  }

  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  return eventView;
}

function generateFrontendPageloadPerformanceEventView(location, withStaticFilters) {
  const {
    query
  } = location;
  const fields = ['team_key_transaction', 'transaction', 'project', 'tpm()', 'p75(measurements.fcp)', 'p75(measurements.lcp)', 'p75(measurements.fid)', 'p75(measurements.cls)', 'count_unique(user)', 'count_miserable(user)', 'user_misery()'];
  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
    version: 2
  };
  const widths = Array(savedQuery.fields.length).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-tpm');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery);
  const isLimitedSearch = isUsingLimitedSearch(location, withStaticFilters); // This is not an override condition since we want the duration to appear in the search bar as a default.

  if (shouldAddDefaultConditions(location) && !withStaticFilters) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  } // If there is a bare text search, we want to treat it as a search
  // on the transaction name.


  if (conditions.freeText.length > 0) {
    const parsedFreeText = isLimitedSearch ? // pick first element to search transactions by name
    (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(conditions.freeText, '') : conditions.freeText.join(' ');

    if (isLimitedSearch) {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`${parsedFreeText}`], false);
    } else {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`*${parsedFreeText}*`], false);
    }

    conditions.freeText = [];
  }

  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);
  return eventView;
}

function generateFrontendOtherPerformanceEventView(location, withStaticFilters) {
  const {
    query
  } = location;
  const fields = ['team_key_transaction', 'transaction', 'project', 'transaction.op', 'tpm()', 'p50(transaction.duration)', 'p75(transaction.duration)', 'p95(transaction.duration)', 'count_unique(user)', 'count_miserable(user)', 'user_misery()'];
  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
    query: 'event.type:transaction',
    projects: [],
    fields,
    version: 2
  };
  const widths = Array(savedQuery.fields.length).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_2__.COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-tpm');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery);
  const isLimitedSearch = isUsingLimitedSearch(location, withStaticFilters); // This is not an override condition since we want the duration to appear in the search bar as a default.

  if (shouldAddDefaultConditions(location) && !withStaticFilters) {
    conditions.setFilterValues('transaction.duration', ['<15m']);
  } // If there is a bare text search, we want to treat it as a search
  // on the transaction name.


  if (conditions.freeText.length > 0 && !isLimitedSearch) {
    const parsedFreeText = isLimitedSearch ? // pick first element to search transactions by name
    (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(conditions.freeText, '') : conditions.freeText.join(' ');

    if (isLimitedSearch) {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`${parsedFreeText}`], false);
    } else {
      // the query here is a user entered condition, no need to escape it
      conditions.setFilterValues('transaction', [`*${parsedFreeText}*`], false);
    }

    conditions.freeText = [];
  }

  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  return eventView;
}

function generatePerformanceEventView(location, projects) {
  let {
    isTrends = false,
    withStaticFilters = false
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const eventView = generateGenericPerformanceEventView(location, withStaticFilters);

  if (isTrends) {
    return eventView;
  }

  const display = (0,_landing_utils__WEBPACK_IMPORTED_MODULE_11__.getCurrentLandingDisplay)(location, projects, eventView);

  switch (display === null || display === void 0 ? void 0 : display.field) {
    case _landing_utils__WEBPACK_IMPORTED_MODULE_11__.LandingDisplayField.FRONTEND_PAGELOAD:
      return generateFrontendPageloadPerformanceEventView(location, withStaticFilters);

    case _landing_utils__WEBPACK_IMPORTED_MODULE_11__.LandingDisplayField.FRONTEND_OTHER:
      return generateFrontendOtherPerformanceEventView(location, withStaticFilters);

    case _landing_utils__WEBPACK_IMPORTED_MODULE_11__.LandingDisplayField.BACKEND:
      return generateBackendPerformanceEventView(location, withStaticFilters);

    case _landing_utils__WEBPACK_IMPORTED_MODULE_11__.LandingDisplayField.MOBILE:
      return generateMobilePerformanceEventView(location, projects, eventView, withStaticFilters);

    default:
      return eventView;
  }
}
function generatePerformanceVitalDetailView(location) {
  const {
    query
  } = location;
  const vitalName = (0,_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_12__.vitalNameFromLocation)(location);
  const hasStartAndEnd = query.start && query.end;
  const savedQuery = {
    id: undefined,
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Vitals Performance Details'),
    query: 'event.type:transaction',
    projects: [],
    fields: ['team_key_transaction', 'transaction', 'project', 'count_unique(user)', 'count()', `p50(${vitalName})`, `p75(${vitalName})`, `p95(${vitalName})`, (0,_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_12__.getVitalDetailTablePoorStatusFunction)(vitalName), (0,_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_12__.getVitalDetailTableMehStatusFunction)(vitalName)],
    version: 2,
    yAxis: [`p75(${vitalName})`]
  };

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = DEFAULT_STATS_PERIOD;
  }

  savedQuery.orderby = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.sort, '-count');
  const searchQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(searchQuery); // If there is a bare text search, we want to treat it as a search
  // on the transaction name.

  if (conditions.freeText.length > 0) {
    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues('transaction', [`*${conditions.freeText.join(' ')}*`], false);
    conditions.freeText = [];
  }

  conditions.setFilterValues('event.type', ['transaction']);
  savedQuery.query = conditions.formatString();
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__["default"].fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.addFilterValues('has', [vitalName]);
  return eventView;
}

/***/ }),

/***/ "./app/views/performance/landing/utils.tsx":
/*!*************************************************!*\
  !*** ./app/views/performance/landing/utils.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LANDING_DISPLAYS": () => (/* binding */ LANDING_DISPLAYS),
/* harmony export */   "LEFT_AXIS_QUERY_KEY": () => (/* binding */ LEFT_AXIS_QUERY_KEY),
/* harmony export */   "LandingDisplayField": () => (/* binding */ LandingDisplayField),
/* harmony export */   "RIGHT_AXIS_QUERY_KEY": () => (/* binding */ RIGHT_AXIS_QUERY_KEY),
/* harmony export */   "checkIsReactNative": () => (/* binding */ checkIsReactNative),
/* harmony export */   "excludeTransaction": () => (/* binding */ excludeTransaction),
/* harmony export */   "getChartWidth": () => (/* binding */ getChartWidth),
/* harmony export */   "getCurrentLandingDisplay": () => (/* binding */ getCurrentLandingDisplay),
/* harmony export */   "getDefaultDisplayFieldForPlatform": () => (/* binding */ getDefaultDisplayFieldForPlatform),
/* harmony export */   "getDefaultDisplayForPlatform": () => (/* binding */ getDefaultDisplayForPlatform),
/* harmony export */   "getDisplayAxes": () => (/* binding */ getDisplayAxes),
/* harmony export */   "getLandingDisplayFromParam": () => (/* binding */ getLandingDisplayFromParam),
/* harmony export */   "handleLandingDisplayChange": () => (/* binding */ handleLandingDisplayChange),
/* harmony export */   "vitalCardDetails": () => (/* binding */ vitalCardDetails)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../data */ "./app/views/performance/data.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");










const LEFT_AXIS_QUERY_KEY = 'left';
const RIGHT_AXIS_QUERY_KEY = 'right';
let LandingDisplayField;

(function (LandingDisplayField) {
  LandingDisplayField["ALL"] = "all";
  LandingDisplayField["FRONTEND_PAGELOAD"] = "frontend_pageload";
  LandingDisplayField["FRONTEND_OTHER"] = "frontend_other";
  LandingDisplayField["BACKEND"] = "backend";
  LandingDisplayField["MOBILE"] = "mobile";
})(LandingDisplayField || (LandingDisplayField = {}));

const LANDING_DISPLAYS = [{
  label: 'All Transactions',
  field: LandingDisplayField.ALL
}, {
  label: 'Web Vitals',
  field: LandingDisplayField.FRONTEND_PAGELOAD
}, {
  label: 'Frontend',
  field: LandingDisplayField.FRONTEND_OTHER
}, {
  label: 'Backend',
  field: LandingDisplayField.BACKEND
}, {
  label: 'Mobile',
  field: LandingDisplayField.MOBILE
}];
function excludeTransaction(transaction, props) {
  const {
    eventView,
    location
  } = props;
  const searchConditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__.MutableSearch(eventView.query);
  searchConditions.addFilterValues('!transaction', [`${transaction}`]);
  react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
    pathname: location.pathname,
    query: { ...location.query,
      cursor: undefined,
      query: searchConditions.formatString()
    }
  });
}
function getLandingDisplayFromParam(location) {
  var _location$query;

  const landingField = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.landingDisplay);
  const display = LANDING_DISPLAYS.find(_ref => {
    let {
      field
    } = _ref;
    return field === landingField;
  });
  return display;
}
function getDefaultDisplayForPlatform(projects, eventView) {
  const defaultDisplayField = getDefaultDisplayFieldForPlatform(projects, eventView);
  const defaultDisplay = LANDING_DISPLAYS.find(_ref2 => {
    let {
      field
    } = _ref2;
    return field === defaultDisplayField;
  });
  return defaultDisplay || LANDING_DISPLAYS[0];
}
function getCurrentLandingDisplay(location, projects, eventView) {
  const display = getLandingDisplayFromParam(location);

  if (display) {
    return display;
  }

  return getDefaultDisplayForPlatform(projects, eventView);
}
function handleLandingDisplayChange(field, location, projects, organization, eventView) {
  // Transaction op can affect the display and show no results if it is explicitly set.
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(location.query.query, '');
  const searchConditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__.MutableSearch(query);
  searchConditions.removeFilter('transaction.op');
  const queryWithConditions = { ...lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(location.query, ['landingDisplay', 'sort']),
    query: searchConditions.formatString()
  };
  delete queryWithConditions[LEFT_AXIS_QUERY_KEY];
  delete queryWithConditions[RIGHT_AXIS_QUERY_KEY];
  const defaultDisplay = getDefaultDisplayFieldForPlatform(projects, eventView);
  const currentDisplay = getCurrentLandingDisplay(location, projects, eventView).field;
  const newQuery = defaultDisplay === field ? { ...queryWithConditions
  } : { ...queryWithConditions,
    landingDisplay: field
  };
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__["default"])('performance_views.landingv3.display_change', {
    organization,
    change_to_display: field,
    default_display: defaultDisplay,
    current_display: currentDisplay,
    is_default: defaultDisplay === currentDisplay
  });
  react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
    pathname: location.pathname,
    query: newQuery
  });
}
function getChartWidth(chartData, refPixelRect) {
  const distance = refPixelRect ? refPixelRect.point2.x - refPixelRect.point1.x : 0;
  const chartWidth = chartData.length * distance;
  return {
    chartWidth
  };
}
function getDefaultDisplayFieldForPlatform(projects, eventView) {
  var _performanceTypeToDis;

  if (!eventView) {
    return LandingDisplayField.ALL;
  }

  const projectIds = eventView.project;
  const performanceTypeToDisplay = {
    [_utils__WEBPACK_IMPORTED_MODULE_9__.PROJECT_PERFORMANCE_TYPE.ANY]: LandingDisplayField.ALL,
    [_utils__WEBPACK_IMPORTED_MODULE_9__.PROJECT_PERFORMANCE_TYPE.FRONTEND]: LandingDisplayField.FRONTEND_PAGELOAD,
    [_utils__WEBPACK_IMPORTED_MODULE_9__.PROJECT_PERFORMANCE_TYPE.BACKEND]: LandingDisplayField.BACKEND,
    [_utils__WEBPACK_IMPORTED_MODULE_9__.PROJECT_PERFORMANCE_TYPE.MOBILE]: LandingDisplayField.MOBILE
  };
  const performanceType = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.platformToPerformanceType)(projects, projectIds);
  const landingField = (_performanceTypeToDis = performanceTypeToDisplay[performanceType]) !== null && _performanceTypeToDis !== void 0 ? _performanceTypeToDis : LandingDisplayField.ALL;
  return landingField;
}
const vitalCardDetails = organization => {
  return {
    'p75(transaction.duration)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Duration (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.P75),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.getDuration)(value / 1000, value >= 1000 ? 3 : 0, true)
    },
    'tpm()': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Throughput'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.THROUGHPUT),
      formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatAbbreviatedNumber
    },
    'failure_rate()': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Failure Rate'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.FAILURE_RATE),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatPercentage)(value, 2)
    },
    'apdex()': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Apdex'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.APDEX),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatFloat)(value, 4)
    },
    'p75(measurements.frames_slow_rate)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Slow Frames (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.SLOW_FRAMES),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatPercentage)(value, 2)
    },
    'p75(measurements.frames_frozen_rate)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Frozen Frames (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.FROZEN_FRAMES),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatPercentage)(value, 2)
    },
    'p75(measurements.app_start_cold)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Cold Start (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.APP_START_COLD),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.getDuration)(value / 1000, value >= 1000 ? 3 : 0, true)
    },
    'p75(measurements.app_start_warm)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Warm Start (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.APP_START_WARM),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.getDuration)(value / 1000, value >= 1000 ? 3 : 0, true)
    },
    'p75(measurements.stall_percentage)': {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Stall Percentage (p75)'),
      tooltip: (0,_data__WEBPACK_IMPORTED_MODULE_8__.getTermHelp)(organization, _data__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TERM.STALL_PERCENTAGE),
      formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_5__.formatPercentage)(value, 2)
    }
  };
};
function getDisplayAxes(options, location) {
  const leftDefault = options.find(opt => opt.isLeftDefault) || options[0];
  const rightDefault = options.find(opt => opt.isRightDefault) || options[1];
  const leftAxis = options.find(opt => opt.value === location.query[LEFT_AXIS_QUERY_KEY]) || leftDefault;
  const rightAxis = options.find(opt => opt.value === location.query[RIGHT_AXIS_QUERY_KEY]) || rightDefault;
  return {
    leftAxis,
    rightAxis
  };
}
function checkIsReactNative(eventView) {
  // only react native should contain the stall percentage column
  return Boolean(eventView.getFields().find(field => field.includes('measurements.stall_percentage')));
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_data_tsx-app_views_performance_landing_utils_tsx.477c9886220b6f59ad6cb1e3e3fad78d.js.map