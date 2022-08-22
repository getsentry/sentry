"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionSummary_pageLayout_tsx"],{

/***/ "./app/components/createAlertButton.tsx":
/*!**********************************************!*\
  !*** ./app/components/createAlertButton.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CreateAlertFromViewButton": () => (/* binding */ CreateAlertFromViewButton),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports













/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertFromViewButton(_ref) {
  var _queryParams$query, _queryParams$yAxis;

  let {
    projects,
    eventView,
    organization,
    referrer,
    onClick,
    alertType,
    disableMetricDataset,
    ...buttonProps
  } = _ref;
  const project = projects.find(p => p.id === `${eventView.project[0]}`);
  const queryParams = eventView.generateQueryStringObject();

  if ((_queryParams$query = queryParams.query) !== null && _queryParams$query !== void 0 && _queryParams$query.includes(`project:${project === null || project === void 0 ? void 0 : project.slug}`)) {
    queryParams.query = queryParams.query.replace(`project:${project === null || project === void 0 ? void 0 : project.slug}`, '');
  }

  const alertTemplate = alertType ? sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.AlertWizardRuleTemplates[alertType] : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.DEFAULT_WIZARD_TEMPLATE;
  const to = {
    pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
    query: { ...queryParams,
      createFromDiscover: true,
      disableMetricDataset,
      referrer,
      ...alertTemplate,
      project: project === null || project === void 0 ? void 0 : project.slug,
      aggregate: (_queryParams$yAxis = queryParams.yAxis) !== null && _queryParams$yAxis !== void 0 ? _queryParams$yAxis : alertTemplate.aggregate
    }
  };

  const handleClick = () => {
    onClick === null || onClick === void 0 ? void 0 : onClick();
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CreateAlertButton, {
    organization: organization,
    onClick: handleClick,
    to: to,
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert'),
    ...buttonProps
  });
}

CreateAlertFromViewButton.displayName = "CreateAlertFromViewButton";
const CreateAlertButton = (0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(_ref2 => {
  let {
    organization,
    projectSlug,
    iconProps,
    referrer,
    router,
    hideIcon,
    showPermissionGuide,
    alertOption,
    onEnter,
    ...buttonProps
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();

  const createAlertUrl = providedProj => {
    const alertsBaseUrl = `/organizations/${organization.slug}/alerts`;
    const alertsArgs = [`${referrer ? `referrer=${referrer}` : ''}`, `${providedProj && providedProj !== ':projectId' ? `project=${providedProj}` : ''}`, alertOption ? `alert_option=${alertOption}` : ''].filter(item => item !== '');
    return `${alertsBaseUrl}/wizard/${alertsArgs.length ? '?' : ''}${alertsArgs.join('&')}`;
  };

  function handleClickWithoutProject(event) {
    event.preventDefault();
    onEnter === null || onEnter === void 0 ? void 0 : onEnter();
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__.navigateTo)(createAlertUrl(':projectId'), router);
  }

  async function enableAlertsMemberWrite() {
    const settingsEndpoint = `/organizations/${organization.slug}/`;
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)();

    try {
      await api.requestPromise(settingsEndpoint, {
        method: 'PUT',
        data: {
          alertsMemberWrite: true
        }
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully updated organization settings'));
    } catch (err) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unable to update organization settings'));
    }
  }

  const permissionTooltipText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Ask your organization owner or manager to [settingsLink:enable alerts access] for you.', {
    settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
      to: `/settings/${organization.slug}`
    })
  });

  const renderButton = hasAccess => {
    var _buttonProps$children;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
      disabled: !hasAccess,
      title: !hasAccess ? permissionTooltipText : undefined,
      icon: !hideIcon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconSiren, { ...iconProps
      }),
      to: projectSlug ? createAlertUrl(projectSlug) : undefined,
      tooltipProps: {
        isHoverable: true,
        position: 'top',
        overlayStyle: {
          maxWidth: '270px'
        }
      },
      onClick: projectSlug ? onEnter : handleClickWithoutProject,
      ...buttonProps,
      children: (_buttonProps$children = buttonProps.children) !== null && _buttonProps$children !== void 0 ? _buttonProps$children : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert')
    });
  };

  const showGuide = !organization.alertsMemberWrite && !!showPermissionGuide;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
    organization: organization,
    access: ['alerts:write'],
    children: _ref3 => {
      let {
        hasAccess
      } = _ref3;
      return showGuide ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
        organization: organization,
        access: ['org:write'],
        children: _ref4 => {
          let {
            hasAccess: isOrgAdmin
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__["default"], {
            target: isOrgAdmin ? 'alerts_write_owner' : 'alerts_write_member',
            onFinish: isOrgAdmin ? enableAlertsMemberWrite : undefined,
            children: renderButton(hasAccess)
          });
        }
      }) : renderButton(hasAccess);
    }
  });
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateAlertButton);

/***/ }),

/***/ "./app/components/replays/replaysFeatureBadge.tsx":
/*!********************************************************!*\
  !*** ./app/components/replays/replaysFeatureBadge.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function ReplaysFeatureBadge(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    type: "alpha"
  });
}

ReplaysFeatureBadge.displayName = "ReplaysFeatureBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplaysFeatureBadge);

/***/ }),

/***/ "./app/utils/performance/vitals/hasMeasurementsQuery.tsx":
/*!***************************************************************!*\
  !*** ./app/utils/performance/vitals/hasMeasurementsQuery.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function getHasMeasurementsRequestPayload(props) {
  const {
    eventView,
    location,
    transaction,
    type
  } = props;
  const escaped = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.escapeDoubleQuotes)((0,sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.escapeFilterValue)(transaction));
  const baseApiPayload = {
    transaction: `"${escaped}"`,
    type
  };
  const additionalApiPayload = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(eventView.getEventsAPIPayload(location), ['project', 'environment']);
  return Object.assign(baseApiPayload, additionalApiPayload);
}

function HasMeasurementsQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_3__["default"], {
    route: "events-has-measurements",
    getRequestPayload: getHasMeasurementsRequestPayload,
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(props, 'children'),
    children: _ref => {
      var _tableData$measuremen;

      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        hasMeasurements: (_tableData$measuremen = tableData === null || tableData === void 0 ? void 0 : tableData.measurements) !== null && _tableData$measuremen !== void 0 ? _tableData$measuremen : null,
        ...rest
      });
    }
  });
}

HasMeasurementsQuery.displayName = "HasMeasurementsQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_5__["default"])(HasMeasurementsQuery));

/***/ }),

/***/ "./app/views/alerts/rules/metric/types.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/rules/metric/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionLabel": () => (/* binding */ ActionLabel),
/* harmony export */   "ActionType": () => (/* binding */ ActionType),
/* harmony export */   "AlertRuleComparisonType": () => (/* binding */ AlertRuleComparisonType),
/* harmony export */   "AlertRuleThresholdType": () => (/* binding */ AlertRuleThresholdType),
/* harmony export */   "AlertRuleTriggerType": () => (/* binding */ AlertRuleTriggerType),
/* harmony export */   "Dataset": () => (/* binding */ Dataset),
/* harmony export */   "Datasource": () => (/* binding */ Datasource),
/* harmony export */   "EventTypes": () => (/* binding */ EventTypes),
/* harmony export */   "SessionsAggregate": () => (/* binding */ SessionsAggregate),
/* harmony export */   "TargetLabel": () => (/* binding */ TargetLabel),
/* harmony export */   "TargetType": () => (/* binding */ TargetType),
/* harmony export */   "TimePeriod": () => (/* binding */ TimePeriod),
/* harmony export */   "TimeWindow": () => (/* binding */ TimeWindow)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let AlertRuleThresholdType;

(function (AlertRuleThresholdType) {
  AlertRuleThresholdType[AlertRuleThresholdType["ABOVE"] = 0] = "ABOVE";
  AlertRuleThresholdType[AlertRuleThresholdType["BELOW"] = 1] = "BELOW";
})(AlertRuleThresholdType || (AlertRuleThresholdType = {}));

let AlertRuleTriggerType;

(function (AlertRuleTriggerType) {
  AlertRuleTriggerType["CRITICAL"] = "critical";
  AlertRuleTriggerType["WARNING"] = "warning";
  AlertRuleTriggerType["RESOLVE"] = "resolve";
})(AlertRuleTriggerType || (AlertRuleTriggerType = {}));

let AlertRuleComparisonType;

(function (AlertRuleComparisonType) {
  AlertRuleComparisonType["COUNT"] = "count";
  AlertRuleComparisonType["CHANGE"] = "change";
  AlertRuleComparisonType["PERCENT"] = "percent";
})(AlertRuleComparisonType || (AlertRuleComparisonType = {}));

let Dataset;

(function (Dataset) {
  Dataset["ERRORS"] = "events";
  Dataset["TRANSACTIONS"] = "transactions";
  Dataset["GENERIC_METRICS"] = "generic_metrics";
  Dataset["SESSIONS"] = "sessions";
  Dataset["METRICS"] = "metrics";
})(Dataset || (Dataset = {}));

let EventTypes;

(function (EventTypes) {
  EventTypes["DEFAULT"] = "default";
  EventTypes["ERROR"] = "error";
  EventTypes["TRANSACTION"] = "transaction";
  EventTypes["USER"] = "user";
  EventTypes["SESSION"] = "session";
})(EventTypes || (EventTypes = {}));

let Datasource;
/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */

(function (Datasource) {
  Datasource["ERROR_DEFAULT"] = "error_default";
  Datasource["DEFAULT"] = "default";
  Datasource["ERROR"] = "error";
  Datasource["TRANSACTION"] = "transaction";
})(Datasource || (Datasource = {}));

let SessionsAggregate;

(function (SessionsAggregate) {
  SessionsAggregate["CRASH_FREE_SESSIONS"] = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate";
  SessionsAggregate["CRASH_FREE_USERS"] = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate";
})(SessionsAggregate || (SessionsAggregate = {}));

let TimePeriod;

(function (TimePeriod) {
  TimePeriod["SIX_HOURS"] = "6h";
  TimePeriod["ONE_DAY"] = "1d";
  TimePeriod["THREE_DAYS"] = "3d";
  TimePeriod["SEVEN_DAYS"] = "10000m";
  TimePeriod["FOURTEEN_DAYS"] = "14d";
  TimePeriod["THIRTY_DAYS"] = "30d";
})(TimePeriod || (TimePeriod = {}));

let TimeWindow;

(function (TimeWindow) {
  TimeWindow[TimeWindow["ONE_MINUTE"] = 1] = "ONE_MINUTE";
  TimeWindow[TimeWindow["FIVE_MINUTES"] = 5] = "FIVE_MINUTES";
  TimeWindow[TimeWindow["TEN_MINUTES"] = 10] = "TEN_MINUTES";
  TimeWindow[TimeWindow["FIFTEEN_MINUTES"] = 15] = "FIFTEEN_MINUTES";
  TimeWindow[TimeWindow["THIRTY_MINUTES"] = 30] = "THIRTY_MINUTES";
  TimeWindow[TimeWindow["ONE_HOUR"] = 60] = "ONE_HOUR";
  TimeWindow[TimeWindow["TWO_HOURS"] = 120] = "TWO_HOURS";
  TimeWindow[TimeWindow["FOUR_HOURS"] = 240] = "FOUR_HOURS";
  TimeWindow[TimeWindow["ONE_DAY"] = 1440] = "ONE_DAY";
})(TimeWindow || (TimeWindow = {}));

let ActionType;

(function (ActionType) {
  ActionType["EMAIL"] = "email";
  ActionType["SLACK"] = "slack";
  ActionType["PAGERDUTY"] = "pagerduty";
  ActionType["MSTEAMS"] = "msteams";
  ActionType["SENTRY_APP"] = "sentry_app";
})(ActionType || (ActionType = {}));

const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Emai\u200Bl'),
  [ActionType.SLACK]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slack'),
  [ActionType.PAGERDUTY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Pagerduty'),
  [ActionType.MSTEAMS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MS Teams'),
  [ActionType.SENTRY_APP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notification')
};
let TargetType;

(function (TargetType) {
  TargetType["SPECIFIC"] = "specific";
  TargetType["USER"] = "user";
  TargetType["TEAM"] = "team";
  TargetType["SENTRY_APP"] = "sentry_app";
})(TargetType || (TargetType = {}));

const TargetLabel = {
  [TargetType.USER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Member'),
  [TargetType.TEAM]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Team')
};
/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */

/***/ }),

/***/ "./app/views/alerts/wizard/options.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/wizard/options.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertWizardAlertNames": () => (/* binding */ AlertWizardAlertNames),
/* harmony export */   "AlertWizardRuleTemplates": () => (/* binding */ AlertWizardRuleTemplates),
/* harmony export */   "DEFAULT_WIZARD_TEMPLATE": () => (/* binding */ DEFAULT_WIZARD_TEMPLATE),
/* harmony export */   "DatasetMEPAlertQueryTypes": () => (/* binding */ DatasetMEPAlertQueryTypes),
/* harmony export */   "MEPAlertsDataset": () => (/* binding */ MEPAlertsDataset),
/* harmony export */   "MEPAlertsQueryType": () => (/* binding */ MEPAlertsQueryType),
/* harmony export */   "getAlertWizardCategories": () => (/* binding */ getAlertWizardCategories),
/* harmony export */   "getMEPAlertsDataset": () => (/* binding */ getMEPAlertsDataset),
/* harmony export */   "hideParameterSelectorSet": () => (/* binding */ hideParameterSelectorSet),
/* harmony export */   "hidePrimarySelectorSet": () => (/* binding */ hidePrimarySelectorSet)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");




let MEPAlertsQueryType;

(function (MEPAlertsQueryType) {
  MEPAlertsQueryType[MEPAlertsQueryType["ERROR"] = 0] = "ERROR";
  MEPAlertsQueryType[MEPAlertsQueryType["PERFORMANCE"] = 1] = "PERFORMANCE";
  MEPAlertsQueryType[MEPAlertsQueryType["CRASH_RATE"] = 2] = "CRASH_RATE";
})(MEPAlertsQueryType || (MEPAlertsQueryType = {}));

let MEPAlertsDataset;

(function (MEPAlertsDataset) {
  MEPAlertsDataset["DISCOVER"] = "discover";
  MEPAlertsDataset["METRICS"] = "metrics";
  MEPAlertsDataset["METRICS_ENHANCED"] = "metricsEnhanced";
})(MEPAlertsDataset || (MEPAlertsDataset = {}));

const DatasetMEPAlertQueryTypes = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS]: MEPAlertsQueryType.ERROR,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.METRICS]: MEPAlertsQueryType.CRASH_RATE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS]: MEPAlertsQueryType.CRASH_RATE
};
const AlertWizardAlertNames = {
  issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issues'),
  num_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Number of Errors'),
  users_experiencing_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Users Experiencing Errors'),
  throughput: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Throughput'),
  trans_duration: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Transaction Duration'),
  apdex: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Apdex'),
  failure_rate: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failure Rate'),
  lcp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Largest Contentful Paint'),
  fid: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('First Input Delay'),
  cls: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Cumulative Layout Shift'),
  custom: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Custom Metric'),
  crash_free_sessions: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free Session Rate'),
  crash_free_users: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free User Rate')
};
const getAlertWizardCategories = org => [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Errors'),
  options: ['issues', 'num_errors', 'users_experiencing_errors']
}, ...(org.features.includes('crash-rate-alerts') ? [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sessions'),
  options: ['crash_free_sessions', 'crash_free_users']
}] : []), {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Performance'),
  options: ['throughput', 'trans_duration', 'apdex', 'failure_rate', 'lcp', 'fid', 'cls']
}, {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Other'),
  options: ['custom']
}];
const AlertWizardRuleTemplates = {
  num_errors: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(user)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  throughput: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  trans_duration: {
    aggregate: 'p95(transaction.duration)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  apdex: {
    aggregate: 'apdex(300)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  failure_rate: {
    aggregate: 'failure_rate()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  fid: {
    aggregate: 'p95(measurements.fid)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  cls: {
    aggregate: 'p95(measurements.cls)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  custom: {
    aggregate: 'p95(measurements.fp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  crash_free_sessions: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_SESSIONS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.SESSION
  },
  crash_free_users: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_USERS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.USER
  }
};
const DEFAULT_WIZARD_TEMPLATE = AlertWizardRuleTemplates.num_errors;
const hidePrimarySelectorSet = new Set(['num_errors', 'users_experiencing_errors', 'throughput', 'apdex', 'failure_rate', 'crash_free_sessions', 'crash_free_users']);
const hideParameterSelectorSet = new Set(['trans_duration', 'lcp', 'fid', 'cls']);
function getMEPAlertsDataset(dataset, newAlert) {
  // Dataset.ERRORS overrides all cases
  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS) {
    return MEPAlertsDataset.DISCOVER;
  }

  if (newAlert) {
    return MEPAlertsDataset.METRICS_ENHANCED;
  }

  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS) {
    return MEPAlertsDataset.METRICS;
  }

  return MEPAlertsDataset.DISCOVER;
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/header.tsx":
/*!*************************************************************!*\
  !*** ./app/views/performance/transactionSummary/header.tsx ***!
  \*************************************************************/
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
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/replays/replaysFeatureBadge */ "./app/components/replays/replaysFeatureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_performance_vitals_hasMeasurementsQuery__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/performance/vitals/hasMeasurementsQuery */ "./app/utils/performance/vitals/hasMeasurementsQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_performance_breadcrumb__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/performance/breadcrumb */ "./app/views/performance/breadcrumb.tsx");
/* harmony import */ var _landing_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../landing/utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./transactionAnomalies/utils */ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx");
/* harmony import */ var _transactionEvents_utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./transactionEvents/utils */ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx");
/* harmony import */ var _transactionReplays_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./transactionReplays/utils */ "./app/views/performance/transactionSummary/transactionReplays/utils.ts");
/* harmony import */ var _transactionSpans_utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./transactionSpans/utils */ "./app/views/performance/transactionSummary/transactionSpans/utils.tsx");
/* harmony import */ var _transactionTags_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./transactionTags/utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _transactionVitals_utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./transactionVitals/utils */ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _teamKeyTransactionButton__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./teamKeyTransactionButton */ "./app/views/performance/transactionSummary/teamKeyTransactionButton.tsx");
/* harmony import */ var _transactionThresholdButton__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./transactionThresholdButton */ "./app/views/performance/transactionSummary/transactionThresholdButton.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
































const TAB_ANALYTICS = {
  [_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].WebVitals]: {
    eventKey: 'performance_views.vitals.vitals_tab_clicked',
    eventName: 'Performance Views: Vitals tab clicked'
  },
  [_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Tags]: {
    eventKey: 'performance_views.tags.tags_tab_clicked',
    eventName: 'Performance Views: Tags tab clicked'
  },
  [_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Events]: {
    eventKey: 'performance_views.events.events_tab_clicked',
    eventName: 'Performance Views: Events tab clicked'
  },
  [_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Spans]: {
    eventKey: 'performance_views.spans.spans_tab_clicked',
    eventName: 'Performance Views: Spans tab clicked'
  },
  [_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Anomalies]: {
    eventKey: 'performance_views.anomalies.anomalies_tab_clicked',
    eventName: 'Performance Views: Anomalies tab clicked'
  }
};

class TransactionHeader extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackTabClick", tab => () => {
      const analyticKeys = TAB_ANALYTICS[tab];

      if (!analyticKeys) {
        return;
      }

      const {
        location,
        projects
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__.trackAnalyticsEvent)({ ...analyticKeys,
        organization_id: this.props.organization.id,
        project_platforms: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getSelectedProjectPlatforms)(location, projects)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCreateAlertSuccess", () => {
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__.trackAnalyticsEvent)({
        eventKey: 'performance_views.summary.create_alert_clicked',
        eventName: 'Performance Views: Create alert clicked',
        organization_id: this.props.organization.id
      });
    });
  }

  renderCreateAlertButton() {
    var _metricsCardinality$o;

    const {
      eventView,
      organization,
      projects,
      metricsCardinality
    } = this.props;

    if (metricsCardinality !== null && metricsCardinality !== void 0 && metricsCardinality.isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {});
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_7__.CreateAlertFromViewButton, {
      eventView: eventView,
      organization: organization,
      projects: projects,
      onClick: this.handleCreateAlertSuccess,
      referrer: "performance",
      alertType: "trans_duration",
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Create Alert'),
      disableMetricDataset: metricsCardinality === null || metricsCardinality === void 0 ? void 0 : (_metricsCardinality$o = metricsCardinality.outcome) === null || _metricsCardinality$o === void 0 ? void 0 : _metricsCardinality$o.forceTransactionsOnly
    });
  }

  renderKeyTransactionButton() {
    const {
      eventView,
      organization,
      transactionName
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_teamKeyTransactionButton__WEBPACK_IMPORTED_MODULE_29__["default"], {
      transactionName: transactionName,
      eventView: eventView,
      organization: organization
    });
  }

  renderSettingsButton() {
    const {
      organization,
      transactionName,
      eventView,
      onChangeThreshold
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__["default"], {
      target: "project_transaction_threshold_override",
      position: "bottom",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_transactionThresholdButton__WEBPACK_IMPORTED_MODULE_30__["default"], {
        organization: organization,
        transactionName: transactionName,
        eventView: eventView,
        onChangeThreshold: onChangeThreshold
      })
    });
  }

  renderWebVitalsTab() {
    const {
      organization,
      eventView,
      location,
      projects,
      transactionName,
      currentTab,
      hasWebVitals
    } = this.props;
    const vitalsTarget = (0,_transactionVitals_utils__WEBPACK_IMPORTED_MODULE_27__.vitalsRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.project),
      query: location.query
    });

    const tab = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
      "data-test-id": "web-vitals-tab",
      to: vitalsTarget,
      isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].WebVitals,
      onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].WebVitals),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Web Vitals')
    });

    switch (hasWebVitals) {
      case 'maybe':
        // need to check if the web vitals tab should be shown
        // frontend projects should always show the web vitals tab
        if ((0,_landing_utils__WEBPACK_IMPORTED_MODULE_20__.getCurrentLandingDisplay)(location, projects, eventView).field === _landing_utils__WEBPACK_IMPORTED_MODULE_20__.LandingDisplayField.FRONTEND_PAGELOAD) {
          return tab;
        } // if it is not a frontend project, then we check to see if there
        // are any web vitals associated with the transaction recently


        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_utils_performance_vitals_hasMeasurementsQuery__WEBPACK_IMPORTED_MODULE_17__["default"], {
          location: location,
          orgSlug: organization.slug,
          eventView: eventView,
          transaction: transactionName,
          type: "web",
          children: _ref => {
            let {
              hasMeasurements
            } = _ref;
            return hasMeasurements ? tab : null;
          }
        });

      case 'yes':
        // always show the web vitals tab
        return tab;

      case 'no':
      default:
        // never show the web vitals tab
        return null;
    }
  }

  render() {
    const {
      organization,
      location,
      projectId,
      transactionName,
      currentTab,
      projects
    } = this.props;
    const routeQuery = {
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: projectId,
      query: location.query
    };
    const summaryTarget = (0,_utils__WEBPACK_IMPORTED_MODULE_31__.transactionSummaryRouteWithQuery)(routeQuery);
    const tagsTarget = (0,_transactionTags_utils__WEBPACK_IMPORTED_MODULE_26__.tagsRouteWithQuery)(routeQuery);
    const eventsTarget = (0,_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_23__.eventsRouteWithQuery)(routeQuery);
    const spansTarget = (0,_transactionSpans_utils__WEBPACK_IMPORTED_MODULE_25__.spansRouteWithQuery)(routeQuery);
    const anomaliesTarget = (0,_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_22__.anomaliesRouteWithQuery)(routeQuery);
    const replaysTarget = (0,_transactionReplays_utils__WEBPACK_IMPORTED_MODULE_24__.replaysRouteWithQuery)(routeQuery);
    const project = projects.find(p => p.id === projectId);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Header, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.HeaderContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_views_performance_breadcrumb__WEBPACK_IMPORTED_MODULE_19__["default"], {
          organization: organization,
          location: location,
          transaction: {
            project: projectId,
            name: transactionName
          },
          tab: currentTab
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.Title, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(TransactionName, {
            children: [project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
              project: project,
              avatarSize: 28,
              hideName: true,
              avatarProps: {
                hasTooltip: true,
                tooltip: project.slug
              }
            }), transactionName]
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_10__.HeaderActions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
            organization: organization,
            features: ['incidents'],
            children: _ref2 => {
              let {
                hasFeature
              } = _ref2;
              return hasFeature && this.renderCreateAlertButton();
            }
          }), this.renderKeyTransactionButton(), this.renderSettingsButton()]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(StyledNavTabs, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
            to: summaryTarget,
            isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].TransactionSummary,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Overview')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
            to: eventsTarget,
            isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Events,
            onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Events),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('All Events')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
            to: tagsTarget,
            isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Tags,
            onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Tags),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Tags')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
            organization: organization,
            features: ['organizations:performance-suspect-spans-view'],
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
              "data-test-id": "spans-tab",
              to: spansTarget,
              isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Spans,
              onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Spans),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Spans')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
            organization: organization,
            features: ['organizations:performance-anomaly-detection-ui'],
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
              "data-test-id": "anomalies-tab",
              to: anomaliesTarget,
              isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Anomalies,
              onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Anomalies),
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Anomalies'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
                type: "alpha",
                noTooltip: true
              })]
            })
          }), this.renderWebVitalsTab(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
            features: ['session-replay-ui'],
            organization: organization,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
              "data-test-id": "replays-tab",
              to: replaysTarget,
              isActive: () => currentTab === _tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Replays,
              onClick: this.trackTabClick(_tabs__WEBPACK_IMPORTED_MODULE_28__["default"].Replays),
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Replays'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_13__["default"], {
                noTooltip: true
              })]
            })
          })]
        })
      })]
    });
  }

}

TransactionHeader.displayName = "TransactionHeader";

const StyledNavTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "ega7at51"
} : 0)( true ? {
  name: "13jhhqe",
  styles: "margin-bottom:0;width:100%"
} : 0);

const TransactionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ega7at50"
} : 0)("display:grid;grid-template-columns:max-content 1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionHeader);

/***/ }),

/***/ "./app/views/performance/transactionSummary/pageLayout.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/performance/transactionSummary/pageLayout.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "NoAccess": () => (/* binding */ NoAccess),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "redirectToPerformanceHomepage": () => (/* binding */ redirectToPerformanceHomepage)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./header */ "./app/views/performance/transactionSummary/header.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















function PageLayout(props) {
  const {
    location,
    organization,
    projects,
    tab,
    getDocumentTitle,
    generateEventView,
    childComponent: ChildComponent,
    features = []
  } = props;
  const projectId = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_16__.decodeScalar)(location.query.project);
  const transactionName = (0,_utils__WEBPACK_IMPORTED_MODULE_17__.getTransactionName)(location);
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)();
  const metricsCardinality = (0,sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_14__.useMetricsCardinalityContext)();
  const [transactionThreshold, setTransactionThreshold] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)();

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(projectId) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(transactionName)) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  const project = projects.find(p => p.id === projectId);
  const eventView = generateEventView({
    location,
    transactionName
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
    title: getDocumentTitle(transactionName),
    orgSlug: organization.slug,
    projectSlug: project === null || project === void 0 ? void 0 : project.slug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__["default"], {
      features: ['performance-view', ...features],
      organization: organization,
      renderDisabled: NoAccess,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_15__.PerformanceEventViewProvider, {
        value: {
          eventView
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__["default"], {
          shouldForceProject: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(project),
          forceProject: project,
          specificProjectSlugs: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(project) ? [project.slug] : [],
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPageContent, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
              organization: organization,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_header__WEBPACK_IMPORTED_MODULE_18__["default"], {
                eventView: eventView,
                location: location,
                organization: organization,
                projects: projects,
                projectId: projectId,
                transactionName: transactionName,
                currentTab: tab,
                hasWebVitals: tab === _tabs__WEBPACK_IMPORTED_MODULE_19__["default"].WebVitals ? 'yes' : 'maybe',
                onChangeThreshold: (threshold, metric) => {
                  setTransactionThreshold(threshold);
                  setTransactionThresholdMetric(metric);
                },
                metricsCardinality: metricsCardinality
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Body, {
                children: [(0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(error) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledAlert, {
                  type: "error",
                  showIcon: true,
                  children: error
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ChildComponent, {
                  location: location,
                  organization: organization,
                  projects: projects,
                  eventView: eventView,
                  projectId: projectId,
                  transactionName: transactionName,
                  setError: setError,
                  transactionThreshold: transactionThreshold,
                  transactionThresholdMetric: transactionThresholdMetric
                })]
              })]
            })
          })
        })
      })
    })
  });
}

PageLayout.displayName = "PageLayout";
function NoAccess() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
    type: "warning",
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("You don't have access to this feature")
  });
}
NoAccess.displayName = "NoAccess";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__.PageContent,  true ? {
  target: "e1ehad6a1"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1ehad6a0"
} : 0)( true ? {
  name: "3hfw1i",
  styles: "grid-column:1/3;margin:0"
} : 0);

function redirectToPerformanceHomepage(organization, location) {
  // If there is no transaction name, redirect to the Performance landing page
  react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({
    pathname: `/organizations/${organization.slug}/performance/`,
    query: { ...location.query
    }
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageLayout);

/***/ }),

/***/ "./app/views/performance/transactionSummary/teamKeyTransactionButton.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/teamKeyTransactionButton.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransaction__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransaction */ "./app/components/performance/teamKeyTransaction.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransactionsManager */ "./app/components/performance/teamKeyTransactionsManager.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










/**
 * This can't be a function component because `TeamKeyTransaction` uses
 * `DropdownControl` which in turn uses passes a ref to this component.
 */



class TitleButton extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    var _keyedTeams$length;

    const {
      isOpen,
      keyedTeams,
      ...props
    } = this.props;
    const keyedTeamsCount = (_keyedTeams$length = keyedTeams === null || keyedTeams === void 0 ? void 0 : keyedTeams.length) !== null && _keyedTeams$length !== void 0 ? _keyedTeams$length : 0;

    const button = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
      icon: keyedTeamsCount ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconStar, {
        color: "yellow300",
        isSolid: true
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconStar, {}),
      children: keyedTeamsCount ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tn)('Starred for Team', 'Starred for Teams', keyedTeamsCount) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Star for Team')
    });

    if (!isOpen && keyedTeams !== null && keyedTeams !== void 0 && keyedTeams.length) {
      const teamSlugs = keyedTeams.map(_ref => {
        let {
          slug
        } = _ref;
        return slug;
      }).join(', ');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
        title: teamSlugs,
        children: button
      });
    }

    return button;
  }

}

TitleButton.displayName = "TitleButton";

function TeamKeyTransactionButton(_ref2) {
  let {
    counts,
    getKeyedTeams,
    project,
    transactionName,
    ...props
  } = _ref2;
  const keyedTeams = getKeyedTeams(project.id, transactionName);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_teamKeyTransaction__WEBPACK_IMPORTED_MODULE_2__["default"], {
    counts: counts,
    keyedTeams: keyedTeams,
    title: TitleButton,
    project: project,
    transactionName: transactionName,
    ...props
  });
}

TeamKeyTransactionButton.displayName = "TeamKeyTransactionButton";

function TeamKeyTransactionButtonWrapper(_ref3) {
  let {
    eventView,
    organization,
    projects,
    ...props
  } = _ref3;
  const {
    teams,
    initiallyLoaded
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_8__["default"])({
    provideUserTeams: true
  });

  if (eventView.project.length !== 1) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TitleButton, {
      isOpen: false,
      disabled: true,
      keyedTeams: null
    });
  }

  const projectId = String(eventView.project[0]);
  const project = projects.find(proj => proj.id === projectId);

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(project)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TitleButton, {
      isOpen: false,
      disabled: true,
      keyedTeams: null
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_3__.Provider, {
    organization: organization,
    teams: teams,
    selectedTeams: ['myteams'],
    selectedProjects: [String(projectId)],
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_3__.Consumer, {
      children: _ref4 => {
        let {
          isLoading,
          ...results
        } = _ref4;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(TeamKeyTransactionButton, {
          organization: organization,
          project: project,
          isLoading: isLoading || !initiallyLoaded,
          ...props,
          ...results
        });
      }
    })
  });
}

TeamKeyTransactionButtonWrapper.displayName = "TeamKeyTransactionButtonWrapper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_9__["default"])(TeamKeyTransactionButtonWrapper));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ANOMALY_FLAG": () => (/* binding */ ANOMALY_FLAG),
/* harmony export */   "anomaliesRouteWithQuery": () => (/* binding */ anomaliesRouteWithQuery),
/* harmony export */   "anomalyToColor": () => (/* binding */ anomalyToColor),
/* harmony export */   "generateAnomaliesEventView": () => (/* binding */ generateAnomaliesEventView),
/* harmony export */   "generateAnomaliesRoute": () => (/* binding */ generateAnomaliesRoute)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");



function generateAnomaliesRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/anomalies/`;
}
const ANOMALY_FLAG = 'performance-anomaly-detection-ui';
function anomaliesRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref2;
  const pathname = generateAnomaliesRoute({
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
function anomalyToColor(anomalyConfidence, theme) {
  // Map inside function so it's reactive to theme.
  const map = {
    high: theme.red300,
    low: theme.yellow300
  };
  return map[anomalyConfidence];
}
function generateAnomaliesEventView(_ref3) {
  let {
    location,
    transactionName
  } = _ref3;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_1__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_2__.MutableSearch(query);
  conditions.setFilterValues('transaction', [transactionName]);
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_0__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: transactionName,
    fields: ['tpm()'],
    // TODO(k-fish): Modify depending on api url later.
    query: conditions.formatString(),
    projects: []
  }, location);
  return eventView;
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionReplays/utils.ts":
/*!******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionReplays/utils.ts ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "replaysRouteWithQuery": () => (/* binding */ replaysRouteWithQuery)
/* harmony export */ });
function replaysRouteWithQuery(_ref) {
  let {
    orgSlug,
    transaction,
    projectID,
    query
  } = _ref;
  const pathname = `/organizations/${orgSlug}/performance/summary/replays/`;
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

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionThresholdButton.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionThresholdButton.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _transactionThresholdModal__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./transactionThresholdModal */ "./app/views/performance/transactionSummary/transactionThresholdModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class TransactionThresholdButton extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      transactionThreshold: undefined,
      transactionThresholdMetric: undefined,
      loadingThreshold: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchTransactionThreshold", () => {
      const {
        api,
        organization,
        transactionName
      } = this.props;
      const project = this.getProject();

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(project)) {
        return;
      }

      const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;
      this.setState({
        loadingThreshold: true
      });
      api.requestPromise(transactionThresholdUrl, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: project.id,
          transaction: transactionName
        }
      }).then(_ref => {
        let [data] = _ref;
        this.setState({
          loadingThreshold: false,
          transactionThreshold: data.threshold,
          transactionThresholdMetric: data.metric
        });
      }).catch(() => {
        const projectThresholdUrl = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
        this.props.api.requestPromise(projectThresholdUrl, {
          method: 'GET',
          includeAllArgs: true,
          query: {
            project: project.id
          }
        }).then(_ref2 => {
          let [data] = _ref2;
          this.setState({
            loadingThreshold: false,
            transactionThreshold: data.threshold,
            transactionThresholdMetric: data.metric
          });
        }).catch(err => {
          var _err$responseJSON$thr, _err$responseJSON;

          this.setState({
            loadingThreshold: false
          });
          const errorMessage = (_err$responseJSON$thr = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.threshold) !== null && _err$responseJSON$thr !== void 0 ? _err$responseJSON$thr : null;
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(errorMessage);
        });
      });
    });
  }

  componentDidMount() {
    this.fetchTransactionThreshold();
  }

  getProject() {
    const {
      projects,
      eventView
    } = this.props;

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(eventView)) {
      return undefined;
    }

    const projectId = String(eventView.project[0]);
    const project = projects.find(proj => proj.id === projectId);
    return project;
  }

  onChangeThreshold(threshold, metric) {
    const {
      onChangeThreshold
    } = this.props;
    this.setState({
      transactionThreshold: threshold,
      transactionThresholdMetric: metric
    });

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(onChangeThreshold)) {
      onChangeThreshold(threshold, metric);
    }
  }

  openModal() {
    const {
      organization,
      transactionName,
      eventView
    } = this.props;
    const {
      transactionThreshold,
      transactionThresholdMetric
    } = this.state;
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_transactionThresholdModal__WEBPACK_IMPORTED_MODULE_11__["default"], { ...modalProps,
      organization: organization,
      transactionName: transactionName,
      eventView: eventView,
      transactionThreshold: transactionThreshold,
      transactionThresholdMetric: transactionThresholdMetric,
      onApply: (threshold, metric) => this.onChangeThreshold(threshold, metric)
    }), {
      modalCss: _transactionThresholdModal__WEBPACK_IMPORTED_MODULE_11__.modalCss,
      backdrop: 'static'
    });
  }

  render() {
    const {
      loadingThreshold
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onClick: () => this.openModal(),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconSettings, {}),
      disabled: loadingThreshold,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Settings'),
      "data-test-id": "set-transaction-threshold"
    });
  }

}

TransactionThresholdButton.displayName = "TransactionThresholdButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_10__["default"])(TransactionThresholdButton)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionSummary_pageLayout_tsx.34fc52d712163634f89b61d0c5d2fce8.js.map