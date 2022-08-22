"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_controls_tsx-app_views_dashboardsV2_detail_tsx"],{

/***/ "./app/components/globalSdkUpdateAlert.tsx":
/*!*************************************************!*\
  !*** ./app/components/globalSdkUpdateAlert.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GlobalSdkUpdateAlert": () => (/* binding */ WithSdkUpdatesGlobalSdkUpdateAlert),
/* harmony export */   "InnerGlobalSdkUpdateAlert": () => (/* binding */ InnerGlobalSdkUpdateAlert)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/sidebarPanelStore */ "./app/stores/sidebarPanelStore.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var sentry_utils_withSdkUpdates__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withSdkUpdates */ "./app/utils/withSdkUpdates.tsx");
/* harmony import */ var _sidebar_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./sidebar/types */ "./app/components/sidebar/types.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./button */ "./app/components/button.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function InnerGlobalSdkUpdateAlert(props) {
  var _props$sdkUpdates, _selection$projects;

  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const {
    selection
  } = (0,sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const [showUpdateAlert, setShowUpdateAlert] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const handleSnoozePrompt = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__.promptsUpdate)(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
      status: 'snoozed'
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.snoozed', {
      organization
    });
    setShowUpdateAlert(false);
  }, [api, organization]);
  const handleReviewUpdatesClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_7__["default"].activatePanel(_sidebar_types__WEBPACK_IMPORTED_MODULE_14__.SidebarPanelKey.Broadcasts);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.clicked', {
      organization
    });
  }, [organization]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.seen', {
      organization
    });
    let isUnmounted = false;
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__.promptsCheck)(api, {
      organizationId: organization.id,
      feature: 'sdk_updates'
    }).then(prompt => {
      if (isUnmounted) {
        return;
      }

      setShowUpdateAlert(!(0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_9__.promptIsDismissed)(prompt));
    });
    return () => {
      isUnmounted = true;
    };
  }, [api, organization]);

  if (!showUpdateAlert || !((_props$sdkUpdates = props.sdkUpdates) !== null && _props$sdkUpdates !== void 0 && _props$sdkUpdates.length)) {
    return null;
  } // withSdkUpdates explicitly only queries My Projects. This means that when
  // looking at any projects outside of My Projects (like All Projects), this
  // will only show the updates relevant to the to user.


  const projectSpecificUpdates = (selection === null || selection === void 0 ? void 0 : (_selection$projects = selection.projects) === null || _selection$projects === void 0 ? void 0 : _selection$projects.length) === 0 || (selection === null || selection === void 0 ? void 0 : selection.projects[0]) === sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.ALL_ACCESS_PROJECTS ? props.sdkUpdates : props.sdkUpdates.filter(update => {
    var _selection$projects2;

    return selection === null || selection === void 0 ? void 0 : (_selection$projects2 = selection.projects) === null || _selection$projects2 === void 0 ? void 0 : _selection$projects2.includes(parseInt(update.projectId, 10));
  }); // Check if we have at least one suggestion out of the list of updates

  if (projectSpecificUpdates.every(v => v.suggestions.length === 0)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
    type: "info",
    showIcon: true,
    className: props.className,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_button__WEBPACK_IMPORTED_MODULE_15__["default"], {
        priority: "link",
        size: "zero",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Dismiss for the next two weeks'),
        onClick: handleSnoozePrompt,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Remind me later')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
        children: "|"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_button__WEBPACK_IMPORTED_MODULE_15__["default"], {
        priority: "link",
        size: "zero",
        onClick: handleReviewUpdatesClick,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Review updates')
      })]
    }),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(`You have outdated SDKs in your projects. Update them for important fixes and features.`)
  });
}

InnerGlobalSdkUpdateAlert.displayName = "InnerGlobalSdkUpdateAlert";
const WithSdkUpdatesGlobalSdkUpdateAlert = (0,sentry_utils_withSdkUpdates__WEBPACK_IMPORTED_MODULE_13__["default"])(InnerGlobalSdkUpdateAlert);


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

/***/ "./app/views/dashboardsV2/controls.tsx":
/*!*********************************************!*\
  !*** ./app/views/dashboardsV2/controls.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _detail__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./detail */ "./app/views/dashboardsV2/detail.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















function Controls(_ref) {
  let {
    organization,
    dashboardState,
    dashboards,
    hasUnsavedFilters,
    widgetLimitReached,
    onEdit,
    onCommit,
    onDelete,
    onCancel,
    onAddWidget
  } = _ref;

  function renderCancelButton() {
    let label = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Cancel');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
      "data-test-id": "dashboard-cancel",
      onClick: e => {
        e.preventDefault();
        onCancel();
      },
      children: label
    });
  }

  if ([_types__WEBPACK_IMPORTED_MODULE_16__.DashboardState.EDIT, _types__WEBPACK_IMPORTED_MODULE_16__.DashboardState.PENDING_DELETE].includes(dashboardState)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledButtonBar, {
      gap: 1,
      children: [renderCancelButton(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
        priority: "danger",
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Are you sure you want to delete this dashboard?'),
        onConfirm: onDelete,
        disabled: dashboards.length <= 1,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "dashboard-delete",
          priority: "danger",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        "data-test-id": "dashboard-commit",
        onClick: e => {
          e.preventDefault();
          onCommit();
        },
        priority: "primary",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Save and Finish')
      })]
    }, "edit-controls");
  }

  if (dashboardState === _types__WEBPACK_IMPORTED_MODULE_16__.DashboardState.CREATE) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledButtonBar, {
      gap: 1,
      children: [renderCancelButton(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        "data-test-id": "dashboard-commit",
        onClick: e => {
          e.preventDefault();
          onCommit();
        },
        priority: "primary",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Save and Finish')
      })]
    }, "create-controls");
  }

  if (dashboardState === _types__WEBPACK_IMPORTED_MODULE_16__.DashboardState.PREVIEW) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledButtonBar, {
      gap: 1,
      children: [renderCancelButton((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Go Back')), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        "data-test-id": "dashboard-commit",
        onClick: e => {
          e.preventDefault();
          onCommit();
        },
        priority: "primary",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add Dashboard')
      })]
    }, "preview-controls");
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledButtonBar, {
    gap: 1,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(DashboardEditFeature, {
      children: hasFeature => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          "data-test-id": "dashboard-edit",
          onClick: e => {
            e.preventDefault();
            onEdit();
          },
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconEdit, {}),
          disabled: !hasFeature || hasUnsavedFilters,
          title: hasUnsavedFilters && _detail__WEBPACK_IMPORTED_MODULE_15__.UNSAVED_FILTERS_MESSAGE,
          priority: "default",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Edit Dashboard')
        }), hasFeature ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Max widgets ([maxWidgets]) per dashboard reached.', {
            maxWidgets: _types__WEBPACK_IMPORTED_MODULE_16__.MAX_WIDGETS
          }),
          disabled: !!!widgetLimitReached,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__["default"], {
            disabled: !!!organization.features.includes('dashboards-releases'),
            target: "releases_widget",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
              "data-test-id": "add-widget-library",
              priority: "primary",
              disabled: widgetLimitReached,
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconAdd, {
                isCircled: true
              }),
              onClick: () => {
                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('dashboards_views.widget_library.opened', {
                  organization
                });
                onAddWidget();
              },
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add Widget')
            })
          })
        }) : null]
      })
    })
  }, "controls");
}

Controls.displayName = "Controls";

const DashboardEditFeature = _ref2 => {
  let {
    children
  } = _ref2;

  const renderDisabled = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_9__.Hovercard, {
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_4__["default"], {
      features: p.features,
      hideHelpToggle: true,
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Dashboard Editing')
    }),
    children: p.children(p)
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__["default"], {
    hookName: "feature-disabled:dashboards-edit",
    features: ['organizations:dashboards-edit'],
    renderDisabled: renderDisabled,
    children: _ref3 => {
      let {
        hasFeature
      } = _ref3;
      return children(hasFeature);
    }
  });
};

DashboardEditFeature.displayName = "DashboardEditFeature";

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e78awt50"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){grid-auto-flow:row;grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";width:100%;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Controls);

/***/ }),

/***/ "./app/views/dashboardsV2/detail.tsx":
/*!*******************************************!*\
  !*** ./app/views/dashboardsV2/detail.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "UNSAVED_FILTERS_MESSAGE": () => (/* binding */ UNSAVED_FILTERS_MESSAGE),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/dashboards */ "./app/actionCreators/dashboards.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_modals_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/modals/widgetViewerModal/utils */ "./app/components/modals/widgetViewerModal/utils.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var sentry_views_performance_landing_metricsDataSwitcherAlert__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/performance/landing/metricsDataSwitcherAlert */ "./app/views/performance/landing/metricsDataSwitcherAlert.tsx");
/* harmony import */ var _performance_data__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ../performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _performance_landing_metricsDataSwitcher__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ../performance/landing/metricsDataSwitcher */ "./app/views/performance/landing/metricsDataSwitcher.tsx");
/* harmony import */ var _widgetViewer_widgetViewerContext__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./widgetViewer/widgetViewerContext */ "./app/views/dashboardsV2/widgetViewer/widgetViewerContext.tsx");
/* harmony import */ var _controls__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./controls */ "./app/views/dashboardsV2/controls.tsx");
/* harmony import */ var _dashboard__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./dashboard */ "./app/views/dashboardsV2/dashboard.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./data */ "./app/views/dashboardsV2/data.tsx");
/* harmony import */ var _filtersBar__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! ./filtersBar */ "./app/views/dashboardsV2/filtersBar.tsx");
/* harmony import */ var _layoutUtils__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! ./layoutUtils */ "./app/views/dashboardsV2/layoutUtils.tsx");
/* harmony import */ var _title__WEBPACK_IMPORTED_MODULE_44__ = __webpack_require__(/*! ./title */ "./app/views/dashboardsV2/title.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_45__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












































const UNSAVED_MESSAGE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('You have unsaved changes, are you sure you want to leave?');
const UNSAVED_FILTERS_MESSAGE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('You have unsaved dashboard filters. You can save or discard them.');
const HookHeader = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_16__["default"])({
  hookName: 'component:dashboards-header'
});

class DashboardDetail extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      dashboardState: this.props.initialState,
      modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
      widgetLimitReached: this.props.dashboard.widgets.length >= _types__WEBPACK_IMPORTED_MODULE_45__.MAX_WIDGETS,
      setData: data => {
        this.setState(data);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onEdit", () => {
      const {
        dashboard
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
        eventKey: 'dashboards2.edit.start',
        eventName: 'Dashboards2: Edit start',
        organization_id: parseInt(this.props.organization.id, 10)
      });
      this.setState({
        dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.EDIT,
        modifiedDashboard: (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(dashboard)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRouteLeave", () => {
      const {
        dashboard
      } = this.props;
      const {
        modifiedDashboard
      } = this.state;

      if (![_types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PENDING_DELETE, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PREVIEW].includes(this.state.dashboardState) && !lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()(modifiedDashboard, dashboard)) {
        return UNSAVED_MESSAGE;
      }

      return undefined;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onUnload", event => {
      const {
        dashboard
      } = this.props;
      const {
        modifiedDashboard
      } = this.state;

      if ([_types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PENDING_DELETE, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PREVIEW].includes(this.state.dashboardState) || lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()(modifiedDashboard, dashboard)) {
        return;
      }

      event.preventDefault();
      event.returnValue = UNSAVED_MESSAGE;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDelete", dashboard => () => {
      const {
        api,
        organization,
        location
      } = this.props;

      if (!(dashboard !== null && dashboard !== void 0 && dashboard.id)) {
        return;
      }

      const previousDashboardState = this.state.dashboardState;
      this.setState({
        dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PENDING_DELETE
      }, () => {
        (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__.deleteDashboard)(api, organization.slug, dashboard.id).then(() => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboard deleted'));
          (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
            eventKey: 'dashboards2.delete',
            eventName: 'Dashboards2: Delete',
            organization_id: parseInt(this.props.organization.id, 10)
          });
          react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
            pathname: `/organizations/${organization.slug}/dashboards/`,
            query: location.query
          });
        }).catch(() => {
          this.setState({
            dashboardState: previousDashboardState
          });
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onCancel", () => {
      const {
        organization,
        dashboard,
        location,
        params
      } = this.props;
      const {
        modifiedDashboard
      } = this.state;
      let hasDashboardChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()(modifiedDashboard, dashboard); // If a dashboard has every layout undefined, then ignore the layout field
      // when checking equality because it is a dashboard from before the grid feature

      const isLegacyLayout = dashboard.widgets.every(_ref => {
        let {
          layout
        } = _ref;
        return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_27__.defined)(layout);
      });

      if (isLegacyLayout) {
        hasDashboardChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()({ ...modifiedDashboard,
          widgets: modifiedDashboard === null || modifiedDashboard === void 0 ? void 0 : modifiedDashboard.widgets.map(widget => lodash_omit__WEBPACK_IMPORTED_MODULE_9___default()(widget, 'layout'))
        }, { ...dashboard,
          widgets: dashboard.widgets.map(widget => lodash_omit__WEBPACK_IMPORTED_MODULE_9___default()(widget, 'layout'))
        });
      } // Don't confirm preview cancellation regardless of dashboard state


      if (hasDashboardChanged && !this.isPreview) {
        // Ignore no-alert here, so that the confirm on cancel matches onUnload & onRouteLeave

        /* eslint no-alert:0 */
        if (!confirm(UNSAVED_MESSAGE)) {
          return;
        }
      }

      if (params.dashboardId) {
        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
          eventKey: 'dashboards2.edit.cancel',
          eventName: 'Dashboards2: Edit cancel',
          organization_id: parseInt(this.props.organization.id, 10)
        });
        this.setState({
          dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW,
          modifiedDashboard: null
        });
        return;
      }

      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
        eventKey: 'dashboards2.create.cancel',
        eventName: 'Dashboards2: Create cancel',
        organization_id: parseInt(this.props.organization.id, 10)
      });
      react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: location.query
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeFilter", activeFilters => {
      const {
        dashboard,
        location
      } = this.props;
      const {
        modifiedDashboard
      } = this.state;
      const newModifiedDashboard = modifiedDashboard || dashboard;

      if (Object.keys(activeFilters).every(key => {
        var _newModifiedDashboard;

        return !!!((_newModifiedDashboard = newModifiedDashboard.filters) !== null && _newModifiedDashboard !== void 0 && _newModifiedDashboard[key]) && activeFilters[key].length === 0;
      })) {
        return;
      }

      const filterParams = {};
      Object.keys(activeFilters).forEach(key => {
        filterParams[key] = activeFilters[key].length ? activeFilters[key] : '';
      });

      if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()(activeFilters, dashboard.filters)) {
        react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push({ ...location,
          query: { ...location.query,
            ...filterParams
          }
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateWidgetList", widgets => {
      const {
        organization,
        dashboard,
        api,
        onDashboardUpdate,
        location
      } = this.props;
      const {
        modifiedDashboard
      } = this.state; // Use the new widgets for calculating layout because widgets has
      // the most up to date information in edit state

      const currentLayout = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_43__.getDashboardLayout)(widgets);
      const layoutColumnDepths = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_43__.calculateColumnDepths)(currentLayout);
      const newModifiedDashboard = { ...(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(modifiedDashboard || dashboard),
        widgets: (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_43__.assignDefaultLayout)(widgets, layoutColumnDepths)
      };
      this.setState({
        modifiedDashboard: newModifiedDashboard,
        widgetLimitReached: widgets.length >= _types__WEBPACK_IMPORTED_MODULE_45__.MAX_WIDGETS
      });

      if (this.isEditing || this.isPreview) {
        return;
      }

      (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__.updateDashboard)(api, organization.slug, newModifiedDashboard).then(newDashboard => {
        if (onDashboardUpdate) {
          onDashboardUpdate(newDashboard);
          this.setState({
            modifiedDashboard: null
          });
        }

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboard updated'));

        if (dashboard && newDashboard.id !== dashboard.id) {
          react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
            pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
            query: { ...location.query
            }
          });
          return;
        }
      }, () => undefined);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddCustomWidget", widget => {
      const {
        dashboard
      } = this.props;
      const {
        modifiedDashboard
      } = this.state;
      const newModifiedDashboard = modifiedDashboard || dashboard;
      this.onUpdateWidget([...newModifiedDashboard.widgets, widget]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAddWidget", () => {
      const {
        organization,
        dashboard,
        router,
        location,
        params: {
          dashboardId
        }
      } = this.props;
      this.setState({
        modifiedDashboard: (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(dashboard)
      });

      if (organization.features.includes('new-widget-builder-experience-design') && !organization.features.includes('new-widget-builder-experience-modal-access')) {
        if (dashboardId) {
          router.push({
            pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
            query: { ...location.query,
              source: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardWidgetSource.DASHBOARDS
            }
          });
          return;
        }
      }

      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_12__.openAddDashboardWidgetModal)({
        organization,
        dashboard,
        onAddLibraryWidget: widgets => this.handleUpdateWidgetList(widgets),
        source: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardWidgetSource.LIBRARY
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onCommit", () => {
      const {
        api,
        organization,
        location,
        dashboard,
        onDashboardUpdate
      } = this.props;
      const {
        modifiedDashboard,
        dashboardState
      } = this.state;

      switch (dashboardState) {
        case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PREVIEW:
        case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE:
          {
            if (modifiedDashboard) {
              if (this.isPreview) {
                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_29__["default"])('dashboards_manage.templates.add', {
                  organization,
                  dashboard_id: dashboard.id,
                  dashboard_title: dashboard.title,
                  was_previewed: true
                });
              }

              let newModifiedDashboard = modifiedDashboard;

              if (organization.features.includes('dashboards-top-level-filter')) {
                var _getDashboardFiltersF;

                newModifiedDashboard = { ...(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(modifiedDashboard),
                  ...(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.getCurrentPageFilters)(location),
                  filters: (_getDashboardFiltersF = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.getDashboardFiltersFromURL)(location)) !== null && _getDashboardFiltersF !== void 0 ? _getDashboardFiltersF : modifiedDashboard.filters
                };
              }

              (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__.createDashboard)(api, organization.slug, newModifiedDashboard, this.isPreview).then(newDashboard => {
                (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboard created'));
                (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
                  eventKey: 'dashboards2.create.complete',
                  eventName: 'Dashboards2: Create complete',
                  organization_id: parseInt(organization.id, 10)
                });
                this.setState({
                  dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW
                }); // redirect to new dashboard

                react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
                  pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                  query: {
                    query: lodash_omit__WEBPACK_IMPORTED_MODULE_9___default()(location.query, Object.values(_types__WEBPACK_IMPORTED_MODULE_45__.DashboardFilterKeys))
                  }
                });
              }, () => undefined);
            }

            break;
          }

        case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.EDIT:
          {
            // only update the dashboard if there are changes
            if (modifiedDashboard) {
              if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_8___default()(dashboard, modifiedDashboard)) {
                this.setState({
                  dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW,
                  modifiedDashboard: null
                });
                return;
              }

              (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__.updateDashboard)(api, organization.slug, modifiedDashboard).then(newDashboard => {
                if (onDashboardUpdate) {
                  onDashboardUpdate(newDashboard);
                }

                (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboard updated'));
                (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_28__.trackAnalyticsEvent)({
                  eventKey: 'dashboards2.edit.complete',
                  eventName: 'Dashboards2: Edit complete',
                  organization_id: parseInt(organization.id, 10)
                });
                this.setState({
                  dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW,
                  modifiedDashboard: null
                });

                if (dashboard && newDashboard.id !== dashboard.id) {
                  react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
                    pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                    query: { ...location.query
                    }
                  });
                  return;
                }
              }, () => undefined);
              return;
            }

            this.setState({
              dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW,
              modifiedDashboard: null
            });
            break;
          }

        case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW:
        default:
          {
            this.setState({
              dashboardState: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.VIEW,
              modifiedDashboard: null
            });
            break;
          }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setModifiedDashboard", dashboard => {
      this.setState({
        modifiedDashboard: dashboard
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onUpdateWidget", widgets => {
      this.setState(state => ({ ...state,
        widgetLimitReached: widgets.length >= _types__WEBPACK_IMPORTED_MODULE_45__.MAX_WIDGETS,
        modifiedDashboard: { ...(state.modifiedDashboard || this.props.dashboard),
          widgets
        }
      }));
    });
  }

  componentDidMount() {
    const {
      route,
      router
    } = this.props;
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
    this.checkIfShouldMountWidgetViewerModal();
  }

  componentDidUpdate(prevProps) {
    this.checkIfShouldMountWidgetViewerModal();

    if (prevProps.initialState !== this.props.initialState) {
      // Widget builder can toggle Edit state when saving
      this.setState({
        dashboardState: this.props.initialState
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  checkIfShouldMountWidgetViewerModal() {
    const {
      params: {
        widgetId,
        dashboardId
      },
      organization,
      dashboard,
      location,
      router
    } = this.props;
    const {
      seriesData,
      tableData,
      pageLinks,
      totalIssuesCount,
      seriesResultsType
    } = this.state;

    if ((0,sentry_components_modals_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_18__.isWidgetViewerPath)(location.pathname)) {
      var _dashboard$widgets$fi;

      const widget = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_27__.defined)(widgetId) && ((_dashboard$widgets$fi = dashboard.widgets.find(_ref2 => {
        let {
          id
        } = _ref2;
        return id === String(widgetId);
      })) !== null && _dashboard$widgets$fi !== void 0 ? _dashboard$widgets$fi : dashboard.widgets[widgetId]);

      if (widget) {
        var _widget$widgetType;

        (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_12__.openWidgetViewerModal)({
          organization,
          widget,
          seriesData,
          seriesResultsType,
          tableData,
          pageLinks,
          totalIssuesCount,
          onClose: () => {
            // Filter out Widget Viewer Modal query params when exiting the Modal
            const query = lodash_omit__WEBPACK_IMPORTED_MODULE_9___default()(location.query, Object.values(sentry_components_modals_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_18__.WidgetViewerQueryField));
            router.push({
              pathname: location.pathname.replace(/widget\/[0-9]+\/$/, ''),
              query
            });
          },
          onEdit: () => {
            if (organization.features.includes('new-widget-builder-experience-design') && !organization.features.includes('new-widget-builder-experience-modal-access')) {
              const widgetIndex = dashboard.widgets.indexOf(widget);

              if (dashboardId) {
                router.push({
                  pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetIndex}/edit/`,
                  query: { ...location.query,
                    source: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardWidgetSource.DASHBOARDS
                  }
                });
                return;
              }
            }

            (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_12__.openAddDashboardWidgetModal)({
              organization,
              widget,
              onUpdateWidget: nextWidget => {
                const updateIndex = dashboard.widgets.indexOf(widget);
                const nextWidgetsList = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(dashboard.widgets);
                nextWidgetsList[updateIndex] = nextWidget;
                this.handleUpdateWidgetList(nextWidgetsList);
              },
              source: _types__WEBPACK_IMPORTED_MODULE_45__.DashboardWidgetSource.DASHBOARDS
            });
          }
        });
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_29__["default"])('dashboards_views.widget_viewer.open', {
          organization,
          widget_type: (_widget$widgetType = widget.widgetType) !== null && _widget$widgetType !== void 0 ? _widget$widgetType : _types__WEBPACK_IMPORTED_MODULE_45__.WidgetType.DISCOVER,
          display_type: widget.displayType
        });
      } else {
        // Replace the URL if the widget isn't found and raise an error in toast
        router.replace({
          pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
          query: location.query
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Widget not found'));
      }
    }
  }

  updateModifiedDashboard(dashboardState) {
    const {
      dashboard
    } = this.props;

    switch (dashboardState) {
      case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PREVIEW:
      case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE:
      case _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.EDIT:
        return (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(dashboard);

      default:
        {
          return null;
        }
    }
  }

  get isPreview() {
    const {
      dashboardState
    } = this.state;
    return _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PREVIEW === dashboardState;
  }

  get isEditing() {
    const {
      dashboardState
    } = this.state;
    return [_types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.EDIT, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE, _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.PENDING_DELETE].includes(dashboardState);
  }

  get isWidgetBuilderRouter() {
    const {
      location,
      params,
      organization
    } = this.props;
    const {
      dashboardId,
      widgetIndex
    } = params;
    const widgetBuilderRoutes = [`/organizations/${organization.slug}/dashboards/new/widget/new/`, `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`, `/organizations/${organization.slug}/dashboards/new/widget/${widgetIndex}/edit/`, `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetIndex}/edit/`];
    return widgetBuilderRoutes.includes(location.pathname);
  }

  get dashboardTitle() {
    const {
      dashboard
    } = this.props;
    const {
      modifiedDashboard
    } = this.state;
    return modifiedDashboard ? modifiedDashboard.title : dashboard.title;
  }

  renderWidgetBuilder() {
    const {
      children,
      dashboard
    } = this.props;
    const {
      modifiedDashboard
    } = this.state;
    return /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.cloneElement)(children, {
      dashboard: modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard,
      onSave: this.isEditing ? this.onUpdateWidget : this.handleUpdateWidgetList
    }) : children;
  }

  renderDefaultDashboardDetail() {
    const {
      organization,
      dashboard,
      dashboards,
      params,
      router,
      location
    } = this.props;
    const {
      modifiedDashboard,
      dashboardState,
      widgetLimitReached
    } = this.state;
    const {
      dashboardId
    } = params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_21__["default"], {
      defaultSelection: {
        datetime: {
          start: null,
          end: null,
          utc: false,
          period: _data__WEBPACK_IMPORTED_MODULE_41__.DEFAULT_STATS_PERIOD
        }
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_25__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
          organization: organization,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(StyledPageHeader, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(StyledTitle, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_title__WEBPACK_IMPORTED_MODULE_44__["default"], {
                dashboard: modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard,
                onUpdate: this.setModifiedDashboard,
                isEditing: this.isEditing
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_controls__WEBPACK_IMPORTED_MODULE_39__["default"], {
              organization: organization,
              dashboards: dashboards,
              onEdit: this.onEdit,
              onCancel: this.onCancel,
              onCommit: this.onCommit,
              onAddWidget: this.onAddWidget,
              onDelete: this.onDelete(dashboard),
              dashboardState: dashboardState,
              widgetLimitReached: widgetLimitReached
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(HookHeader, {
            organization: organization
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(StyledPageFilterBar, {
            condensed: true,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_22__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_14__["default"], {
              alignDropdown: "left"
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_dashboard__WEBPACK_IMPORTED_MODULE_40__["default"], {
            paramDashboardId: dashboardId,
            dashboard: modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard,
            organization: organization,
            isEditing: this.isEditing,
            widgetLimitReached: widgetLimitReached,
            onUpdate: this.onUpdateWidget,
            handleUpdateWidgetList: this.handleUpdateWidgetList,
            handleAddCustomWidget: this.handleAddCustomWidget,
            isPreview: this.isPreview,
            router: router,
            location: location
          })]
        })
      })
    });
  }

  getBreadcrumbLabel() {
    const {
      dashboardState
    } = this.state;
    let label = this.dashboardTitle;

    if (dashboardState === _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE) {
      label = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Create Dashboard');
    } else if (this.isPreview) {
      label = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Preview Dashboard');
    }

    return label;
  }

  renderDashboardDetail() {
    const {
      api,
      organization,
      dashboard,
      dashboards,
      params,
      router,
      location,
      newWidget,
      onSetNewWidget,
      onDashboardUpdate,
      projects
    } = this.props;
    const {
      modifiedDashboard,
      dashboardState,
      widgetLimitReached,
      seriesData,
      setData
    } = this.state;
    const {
      dashboardId
    } = params;
    const hasUnsavedFilters = organization.features.includes('dashboards-top-level-filter') && dashboard.id !== 'default-overview' && dashboardState !== _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE && (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.hasUnsavedFilterChanges)(dashboard, location);
    const eventView = (0,_performance_data__WEBPACK_IMPORTED_MODULE_36__.generatePerformanceEventView)(location, projects);
    const isDashboardUsingTransaction = dashboard.widgets.some(sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.isWidgetUsingTransactionName);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_23__["default"], {
      title: dashboard.title,
      orgSlug: organization.slug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_21__["default"], {
        defaultSelection: {
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: _data__WEBPACK_IMPORTED_MODULE_41__.DEFAULT_STATS_PERIOD
          }
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(StyledPageContent, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
            organization: organization,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Header, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.HeaderContent, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  crumbs: [{
                    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboards'),
                    to: `/organizations/${organization.slug}/dashboards/`
                  }, {
                    label: this.getBreadcrumbLabel()
                  }]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Title, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_title__WEBPACK_IMPORTED_MODULE_44__["default"], {
                    dashboard: modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard,
                    onUpdate: this.setModifiedDashboard,
                    isEditing: this.isEditing
                  })
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.HeaderActions, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_controls__WEBPACK_IMPORTED_MODULE_39__["default"], {
                  organization: organization,
                  dashboards: dashboards,
                  hasUnsavedFilters: hasUnsavedFilters,
                  onEdit: this.onEdit,
                  onCancel: this.onCancel,
                  onCommit: this.onCommit,
                  onAddWidget: this.onAddWidget,
                  onDelete: this.onDelete(dashboard),
                  dashboardState: dashboardState,
                  widgetLimitReached: widgetLimitReached
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Body, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Main, {
                fullWidth: true,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_30__.MetricsCardinalityProvider, {
                  organization: organization,
                  location: location,
                  children: (organization.features.includes('dashboards-mep') || organization.features.includes('mep-rollout-flag')) && isDashboardUsingTransaction ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_performance_landing_metricsDataSwitcher__WEBPACK_IMPORTED_MODULE_37__.MetricsDataSwitcher, {
                    organization: organization,
                    eventView: eventView,
                    location: location,
                    hideLoadingIndicator: true,
                    children: metricsDataSide => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(sentry_views_performance_landing_metricsDataSwitcherAlert__WEBPACK_IMPORTED_MODULE_35__.MetricsDataSwitcherAlert, {
                      organization: organization,
                      eventView: eventView,
                      projects: projects,
                      location: location,
                      router: router,
                      ...metricsDataSide
                    })
                  }) : null
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_filtersBar__WEBPACK_IMPORTED_MODULE_42__["default"], {
                  filters: (modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard).filters,
                  location: location,
                  hasUnsavedChanges: hasUnsavedFilters,
                  isEditingDashboard: dashboardState !== _types__WEBPACK_IMPORTED_MODULE_45__.DashboardState.CREATE && this.isEditing,
                  isPreview: this.isPreview,
                  onDashboardFilterChange: this.handleChangeFilter,
                  onCancel: () => {
                    (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.resetPageFilters)(dashboard, location);
                    this.setState({
                      modifiedDashboard: { ...(modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard),
                        filters: dashboard.filters
                      }
                    });
                  },
                  onSave: () => {
                    var _getDashboardFiltersF2;

                    const newModifiedDashboard = { ...(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.cloneDashboard)(modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard),
                      ...(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.getCurrentPageFilters)(location),
                      filters: (_getDashboardFiltersF2 = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_34__.getDashboardFiltersFromURL)(location)) !== null && _getDashboardFiltersF2 !== void 0 ? _getDashboardFiltersF2 : (modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard).filters
                    };
                    (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_10__.updateDashboard)(api, organization.slug, newModifiedDashboard).then(newDashboard => {
                      if (onDashboardUpdate) {
                        onDashboardUpdate(newDashboard);
                        this.setState({
                          modifiedDashboard: null
                        });
                      }

                      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_11__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Dashboard filters updated'));
                      react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace({
                        pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                        query: lodash_omit__WEBPACK_IMPORTED_MODULE_9___default()(location.query, Object.values(_types__WEBPACK_IMPORTED_MODULE_45__.DashboardFilterKeys))
                      });
                    }, () => undefined);
                  }
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_widgetViewer_widgetViewerContext__WEBPACK_IMPORTED_MODULE_38__.WidgetViewerContext.Provider, {
                  value: {
                    seriesData,
                    setData
                  },
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_46__.jsx)(_dashboard__WEBPACK_IMPORTED_MODULE_40__["default"], {
                    paramDashboardId: dashboardId,
                    dashboard: modifiedDashboard !== null && modifiedDashboard !== void 0 ? modifiedDashboard : dashboard,
                    organization: organization,
                    isEditing: this.isEditing,
                    widgetLimitReached: widgetLimitReached,
                    onUpdate: this.onUpdateWidget,
                    handleUpdateWidgetList: this.handleUpdateWidgetList,
                    handleAddCustomWidget: this.handleAddCustomWidget,
                    router: router,
                    location: location,
                    newWidget: newWidget,
                    onSetNewWidget: onSetNewWidget,
                    isPreview: this.isPreview
                  })
                })]
              })
            })]
          })
        })
      })
    });
  }

  render() {
    const {
      organization
    } = this.props;

    if (this.isWidgetBuilderRouter) {
      return this.renderWidgetBuilder();
    }

    if (organization.features.includes('dashboards-edit')) {
      return this.renderDashboardDetail();
    }

    return this.renderDefaultDashboardDetail();
  }

}

DashboardDetail.displayName = "DashboardDetail";

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1anno2f3"
} : 0)("display:grid;grid-template-columns:minmax(0, 1fr);grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(2), ";align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:minmax(0, 1fr) max-content;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(2), ";height:40px;}" + ( true ? "" : 0));

const StyledTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Title,  true ? {
  target: "e1anno2f2"
} : 0)( true ? {
  name: "1i9vogi",
  styles: "margin-top:0"
} : 0);

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_25__.PageContent,  true ? {
  target: "e1anno2f1"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const StyledPageFilterBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_20__["default"],  true ? {
  target: "e1anno2f0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_33__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_31__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_32__["default"])(DashboardDetail))));

/***/ }),

/***/ "./app/views/dashboardsV2/filtersBar.tsx":
/*!***********************************************!*\
  !*** ./app/views/dashboardsV2/filtersBar.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FiltersBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_releases_releasesProvider__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/releases/releasesProvider */ "./app/utils/releases/releasesProvider.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var _releasesSelectControl__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./releasesSelectControl */ "./app/views/dashboardsV2/releasesSelectControl.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















function FiltersBar(_ref) {
  var _ref2, _location$query;

  let {
    filters,
    hasUnsavedChanges,
    isEditingDashboard,
    isPreview,
    location,
    onCancel,
    onDashboardFilterChange,
    onSave
  } = _ref;
  const {
    selection
  } = (0,sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const selectedReleases = (_ref2 = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query[_types__WEBPACK_IMPORTED_MODULE_17__.DashboardFilterKeys.RELEASE]) ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeList)(location.query[_types__WEBPACK_IMPORTED_MODULE_17__.DashboardFilterKeys.RELEASE]) : filters === null || filters === void 0 ? void 0 : filters[_types__WEBPACK_IMPORTED_MODULE_17__.DashboardFilterKeys.RELEASE]) !== null && _ref2 !== void 0 ? _ref2 : [];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
      condensed: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_8__["default"], {
        disabled: isEditingDashboard
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__["default"], {
        disabled: isEditingDashboard
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__["default"], {
        alignDropdown: "left",
        disabled: isEditingDashboard
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__["default"], {
      features: ['dashboards-top-level-filter'],
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterButtons, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FilterButton, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_utils_releases_releasesProvider__WEBPACK_IMPORTED_MODULE_13__.ReleasesProvider, {
              organization: organization,
              selection: selection,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(_releasesSelectControl__WEBPACK_IMPORTED_MODULE_16__["default"], {
                handleChangeFilter: onDashboardFilterChange,
                selectedReleases: selectedReleases,
                isDisabled: isEditingDashboard
              })
            })
          })
        }), hasUnsavedChanges && !isEditingDashboard && !isPreview && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(FilterButtons, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            priority: "primary",
            onClick: onSave,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Save')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            onClick: onCancel,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Cancel')
          })]
        })]
      })
    })]
  });
}
FiltersBar.displayName = "FiltersBar";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eecuk2e2"
} : 0)("display:flex;flex-direction:row;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:grid;grid-auto-flow:row;}" + ( true ? "" : 0));

const FilterButtons = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "eecuk2e1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";}" + ( true ? "" : 0));

const FilterButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eecuk2e0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){max-width:300px;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/title.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/title.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_editableText__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/editableText */ "./app/components/editableText.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function DashboardTitle(_ref) {
  let {
    dashboard,
    isEditing,
    onUpdate
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    children: !dashboard ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Dashboards') : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_editableText__WEBPACK_IMPORTED_MODULE_0__["default"], {
      isDisabled: !isEditing,
      value: dashboard.title,
      onChange: newTitle => onUpdate({ ...dashboard,
        title: newTitle
      }),
      errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Please set a title for this dashboard'),
      autoSelect: true
    })
  });
}

DashboardTitle.displayName = "DashboardTitle";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DashboardTitle);

/***/ }),

/***/ "./app/views/performance/landing/metricsDataSwitcher.tsx":
/*!***************************************************************!*\
  !*** ./app/views/performance/landing/metricsDataSwitcher.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricsDataSwitcher": () => (/* binding */ MetricsDataSwitcher)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









/**
 * This component decides based on some stats about current projects whether to show certain views of the landing page.
 * It is primarily needed for the rollout during which time users, despite having the flag enabled,
 * may or may not have sampling rules, compatible sdk's etc. This can be simplified post rollout.
 */
function MetricsDataSwitcher(props) {
  const isUsingMetrics = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.canUseMetricsData)(props.organization);
  const metricsCardinality = (0,sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__.useMetricsCardinalityContext)();

  if (!isUsingMetrics) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: props.children({
        forceTransactionsOnly: true
      })
    });
  }

  if (metricsCardinality.isLoading && !props.hideLoadingIndicator) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(LoadingContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {})
      })
    });
  }

  if (!metricsCardinality.outcome) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: props.children({
        forceTransactionsOnly: true
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(MetricsSwitchHandler, {
      eventView: props.eventView,
      location: props.location,
      outcome: metricsCardinality.outcome,
      switcherChildren: props.children
    })
  });
}
MetricsDataSwitcher.displayName = "MetricsDataSwitcher";

function MetricsSwitchHandler(_ref) {
  let {
    switcherChildren,
    outcome,
    location,
    eventView
  } = _ref;
  const {
    query
  } = location;
  const mepSearchState = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(query[sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.METRIC_SEARCH_SETTING_PARAM], '');
  const hasQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(query.query, '');
  const queryIsTransactionsBased = mepSearchState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.MEPState.transactionsOnly;
  const shouldAdjustQuery = hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (shouldAdjustQuery) {
      react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          cursor: undefined,
          query: undefined,
          [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.METRIC_SEARCH_SETTING_PARAM]: undefined
        }
      });
    }
  }, [shouldAdjustQuery, location]);

  if (hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly) {
    eventView.query = ''; // TODO: Create switcher provider and move it to the route level to remove the need for this.
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: switcherChildren(outcome)
  });
}

MetricsSwitchHandler.displayName = "MetricsSwitchHandler";

const LoadingContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r04u5n0"
} : 0)( true ? {
  name: "zl1inp",
  styles: "display:flex;justify-content:center"
} : 0);

/***/ }),

/***/ "./app/views/performance/landing/metricsDataSwitcherAlert.tsx":
/*!********************************************************************!*\
  !*** ./app/views/performance/landing/metricsDataSwitcherAlert.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricsDataSwitcherAlert": () => (/* binding */ MetricsDataSwitcherAlert)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/pageFilters */ "./app/actionCreators/pageFilters.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/globalSdkUpdateAlert */ "./app/components/globalSdkUpdateAlert.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sidebar/types */ "./app/components/sidebar/types.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/sidebarPanelStore */ "./app/stores/sidebarPanelStore.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













/**
 * From
 * https://github.com/getsentry/sentry-docs/blob/master/src/platforms/common/enriching-events/transaction-name.mdx
 */
const SUPPORTED_TRANSACTION_NAME_DOCS = ['javascript', 'node', 'python', 'ruby', 'native', 'react-native', 'dotnet', 'unity', 'flutter', 'dart', 'java', 'android'];
const UNSUPPORTED_TRANSACTION_NAME_DOCS = ['javascript.cordova', 'javascript.nextjs', 'native.minidumps'];
function MetricsDataSwitcherAlert(props) {
  const handleReviewUpdatesClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_9__["default"].activatePanel(sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_7__.SidebarPanelKey.Broadcasts);
  }, []);
  const docsLink = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const platforms = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getSelectedProjectPlatformsArray)(props.location, props.projects);

    if (platforms.length < 1) {
      return null;
    }

    const platform = platforms[0];

    if (UNSUPPORTED_TRANSACTION_NAME_DOCS.includes(platform)) {
      return null;
    }

    const supportedPlatform = SUPPORTED_TRANSACTION_NAME_DOCS.find(platformBase => platform.includes(platformBase));

    if (!supportedPlatform) {
      return null;
    }

    return `https://docs.sentry.io/platforms/${supportedPlatform}/enriching-events/transaction-name/`;
  }, [props.location, props.projects]);
  const handleSwitchToCompatibleProjects = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    (0,sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_2__.updateProjects)(props.compatibleProjects || [], props.router);
  }, [props.compatibleProjects, props.router]);

  if (!props.shouldNotifyUnnamedTransactions && !props.shouldWarnIncompatibleSDK) {
    // Control showing generic sdk-alert here since stacking alerts is noisy.
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_4__.GlobalSdkUpdateAlert, {});
  }

  const discoverTarget = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.createUnnamedTransactionsDiscoverTarget)(props);

  if (props.shouldWarnIncompatibleSDK) {
    const updateSDK = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: "",
      onClick: handleReviewUpdatesClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('update your SDK version')
    });

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_10__.areMultipleProjectsSelected)(props.eventView)) {
      var _props$compatibleProj;

      if (((_props$compatibleProj = props.compatibleProjects) !== null && _props$compatibleProj !== void 0 ? _props$compatibleProj : []).length === 0) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
          type: "warning",
          showIcon: true,
          "data-test-id": "landing-mep-alert-multi-project-all-incompatible",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`A few projects are incompatible with server side sampling. To enable this feature [updateSDK].`, {
            updateSDK
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "warning",
        showIcon: true,
        "data-test-id": "landing-mep-alert-multi-project-incompatible",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`A few projects are incompatible with server side sampling. You can either [updateSDK] or [onlyViewCompatible]`, {
          updateSDK,
          onlyViewCompatible: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
            to: "",
            onClick: handleSwitchToCompatibleProjects,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('only view compatible projects.')
          })
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "warning",
      showIcon: true,
      "data-test-id": "landing-mep-alert-single-project-incompatible",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`Your project has an outdated SDK which is incompatible with server side sampling. To enable this feature [updateSDK].`, {
        updateSDK
      })
    });
  }

  if (props.shouldNotifyUnnamedTransactions) {
    const discover = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: discoverTarget,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('open them in Discover.')
    });

    if (!docsLink) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "warning",
        showIcon: true,
        "data-test-id": "landing-mep-alert-unnamed-discover",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`You have some unparameterized transactions which are incompatible with server side sampling. You can [discover]`, {
          discover
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "warning",
      showIcon: true,
      "data-test-id": "landing-mep-alert-unnamed-discover-or-set",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`You have some unparameterized transactions which are incompatible with server side sampling. You can either [setNames] or [discover]`, {
        setNames: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
          href: docsLink,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('set names manually')
        }),
        discover
      })
    });
  }

  return null;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_controls_tsx-app_views_dashboardsV2_detail_tsx.4e5a2313a9aca302964698e251ee54e0.js.map