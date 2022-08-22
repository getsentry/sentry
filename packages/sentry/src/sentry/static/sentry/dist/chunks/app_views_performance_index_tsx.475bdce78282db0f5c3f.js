"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_index_tsx"],{

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

/***/ "./app/utils/performance/contexts/metricsCardinality.tsx":
/*!***************************************************************!*\
  !*** ./app/utils/performance/contexts/metricsCardinality.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricCardinalityConsumer": () => (/* binding */ MetricCardinalityConsumer),
/* harmony export */   "MetricsCardinalityProvider": () => (/* binding */ MetricsCardinalityProvider),
/* harmony export */   "useMetricsCardinalityContext": () => (/* binding */ useMetricsCardinalityContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuery__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/metricsEnhanced/metricsCompatibilityQuery */ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx");
/* harmony import */ var sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuerySums__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums */ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const [_Provider, _useContext, _Context] = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createDefinedContext)({
  name: 'MetricsCardinalityContext',
  strict: false
});
/**
 * This provider determines whether the metrics data is storing performance information correctly before we
 * make dozens of requests on pages such as performance landing and dashboards.
 */

const MetricsCardinalityProvider = props => {
  const isUsingMetrics = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_4__.canUseMetricsData)(props.organization);

  if (!isUsingMetrics) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_Provider, {
      value: {
        isLoading: false,
        outcome: {
          forceTransactionsOnly: true
        }
      },
      children: props.children
    });
  }

  const baseDiscoverProps = {
    location: props.location,
    orgSlug: props.organization.slug,
    cursor: '0:0:0'
  };
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__["default"].fromLocation(props.location);
  eventView.fields = [{
    field: 'tpm()'
  }];

  const _eventView = adjustEventViewTime(eventView);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuery__WEBPACK_IMPORTED_MODULE_5__["default"], {
      eventView: _eventView,
      ...baseDiscoverProps,
      children: compatabilityResult => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuerySums__WEBPACK_IMPORTED_MODULE_6__["default"], {
        eventView: _eventView,
        ...baseDiscoverProps,
        children: sumsResult => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_Provider, {
          value: {
            isLoading: compatabilityResult.isLoading || sumsResult.isLoading,
            outcome: compatabilityResult.isLoading || sumsResult.isLoading ? undefined : getMetricsOutcome(compatabilityResult.tableData && sumsResult.tableData ? { ...compatabilityResult.tableData,
              ...sumsResult.tableData
            } : null, !!compatabilityResult.error && !!sumsResult.error)
          },
          children: props.children
        })
      })
    })
  });
};
MetricsCardinalityProvider.displayName = "MetricsCardinalityProvider";
const MetricCardinalityConsumer = _Context.Consumer;
const useMetricsCardinalityContext = _useContext;
/**
 * Logic for picking sides of metrics vs. transactions along with the associated warnings.
 */

function getMetricsOutcome(dataCounts, hasOtherFallbackCondition) {
  const fallbackOutcome = {
    forceTransactionsOnly: true
  };
  const successOutcome = {
    forceTransactionsOnly: false
  };

  if (!dataCounts) {
    return fallbackOutcome;
  }

  const compatibleProjects = dataCounts.compatible_projects;

  if (hasOtherFallbackCondition) {
    return fallbackOutcome;
  }

  if (!dataCounts) {
    return fallbackOutcome;
  }

  if (checkForSamplingRules(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkNoDataFallback(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkIncompatibleData(dataCounts)) {
    return {
      shouldWarnIncompatibleSDK: true,
      forceTransactionsOnly: true,
      compatibleProjects
    };
  }

  if (checkIfAllOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      forceTransactionsOnly: true,
      compatibleProjects
    };
  }

  if (checkIfPartialOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      compatibleProjects,
      forceTransactionsOnly: false
    };
  }

  return successOutcome;
}
/**
 * Fallback if very similar amounts of metrics and transactions are found.
 * No projects with dynamic sampling means no rules have been enabled yet.
 */


function checkForSamplingRules(dataCounts) {
  var _dataCounts$dynamic_s;

  const counts = normalizeCounts(dataCounts);

  if (!((_dataCounts$dynamic_s = dataCounts.dynamic_sampling_projects) !== null && _dataCounts$dynamic_s !== void 0 && _dataCounts$dynamic_s.length)) {
    return true;
  }

  if (counts.metricsCount === 0) {
    return true;
  }

  return false;
}
/**
 * Fallback if no metrics found.
 */


function checkNoDataFallback(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return !counts.metricsCount;
}
/**
 * Fallback and warn if incompatible data found (old specific SDKs).
 */


function checkIncompatibleData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.nullCount > 0;
}
/**
 * Fallback and warn about unnamed transactions (specific SDKs).
 */


function checkIfAllOtherData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount >= counts.metricsCount;
}
/**
 * Show metrics but warn about unnamed transactions.
 */


function checkIfPartialOtherData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount > 0;
}
/**
 * Temporary function, can be removed after API changes.
 */


function normalizeCounts(_ref) {
  let {
    sum
  } = _ref;

  try {
    const metricsCount = Number(sum.metrics);
    const unparamCount = Number(sum.metrics_unparam);
    const nullCount = Number(sum.metrics_null);
    return {
      metricsCount,
      unparamCount,
      nullCount
    };
  } catch (_) {
    return {
      metricsCount: 0,
      unparamCount: 0,
      nullCount: 0
    };
  }
}
/**
 * Performance optimization to limit the amount of rows scanned before showing the landing page.
 */


function adjustEventViewTime(eventView) {
  const _eventView = eventView.clone();

  if (!_eventView.start && !_eventView.end) {
    if (!_eventView.statsPeriod) {
      _eventView.statsPeriod = '1h';
      _eventView.start = undefined;
      _eventView.end = undefined;
    } else {
      const periodHours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.parsePeriodToHours)(_eventView.statsPeriod);

      if (periodHours > 1) {
        _eventView.statsPeriod = '1h';
        _eventView.start = undefined;
        _eventView.end = undefined;
      }
    }
  }

  return _eventView;
}

/***/ }),

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

/***/ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx":
/*!*****************************************************************************!*\
  !*** ./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MetricsCompatibilityQuery)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getRequestPayload(_ref) {
  let {
    eventView,
    location
  } = _ref;
  return lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page', 'query']);
}

function MetricsCompatibilityQuery(_ref2) {
  let {
    children,
    ...props
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "metrics-compatibility-sums",
    getRequestPayload: getRequestPayload,
    ...props,
    api: api,
    children: _ref3 => {
      let {
        tableData,
        ...rest
      } = _ref3;
      return children({
        tableData,
        ...rest
      });
    }
  });
}
MetricsCompatibilityQuery.displayName = "MetricsCompatibilityQuery";

/***/ }),

/***/ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx":
/*!*********************************************************************************!*\
  !*** ./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MetricsCompatibilitySumsQuery)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getRequestPayload(_ref) {
  let {
    eventView,
    location
  } = _ref;
  return lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page', 'query']);
}

function MetricsCompatibilitySumsQuery(_ref2) {
  let {
    children,
    ...props
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "metrics-compatibility",
    getRequestPayload: getRequestPayload,
    ...props,
    api: api,
    children: _ref3 => {
      let {
        tableData,
        ...rest
      } = _ref3;
      return children({
        tableData,
        ...rest
      });
    }
  });
}
MetricsCompatibilitySumsQuery.displayName = "MetricsCompatibilitySumsQuery";

/***/ }),

/***/ "./app/views/performance/index.tsx":
/*!*****************************************!*\
  !*** ./app/views/performance/index.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function PerformanceContainer(_ref) {
  let {
    organization,
    location,
    children
  } = _ref;

  function renderNoAccess() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("You don't have access to this feature")
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    hookName: "feature-disabled:performance-page",
    features: ['performance-view'],
    organization: organization,
    renderDisabled: renderNoAccess,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__.MetricsCardinalityProvider, {
      location: location,
      organization: organization,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.MEPSettingProvider, {
        children: children
      })
    })
  });
}

PerformanceContainer.displayName = "PerformanceContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(PerformanceContainer));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_index_tsx.8ad3bf35af0c30adb259564b0a6049ad.js.map