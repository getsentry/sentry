"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_wizard_index_tsx"],{

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

/***/ "./app/views/alerts/builder/builderBreadCrumbs.tsx":
/*!*********************************************************!*\
  !*** ./app/views/alerts/builder/builderBreadCrumbs.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function BuilderBreadCrumbs(_ref) {
  let {
    title,
    alertName,
    projectSlug,
    organization
  } = _ref;
  const crumbs = [{
    to: `/organizations/${organization.slug}/alerts/rules/`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Alerts'),
    preservePageFilters: true
  }, {
    label: title,
    ...(alertName ? {
      to: `/organizations/${organization.slug}/alerts/${projectSlug}/wizard`,
      preservePageFilters: true
    } : {})
  }];

  if (alertName) {
    crumbs.push({
      label: alertName
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledBreadcrumbs, {
    crumbs: crumbs
  });
}

BuilderBreadCrumbs.displayName = "BuilderBreadCrumbs";

const StyledBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "eykqk0t0"
} : 0)("font-size:18px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BuilderBreadCrumbs);

/***/ }),

/***/ "./app/views/alerts/rules/metric/presets.tsx":
/*!***************************************************!*\
  !*** ./app/views/alerts/rules/metric/presets.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PRESET_AGGREGATES": () => (/* binding */ PRESET_AGGREGATES)
/* harmony export */ });
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");





async function getHighestVolumeTransaction(client, organizationSlug, projectId) {
  const result = await client.requestPromise(`/organizations/${organizationSlug}/events/`, {
    method: 'GET',
    data: {
      statsPeriod: '7d',
      project: projectId,
      field: ['count()', 'transaction'],
      sort: '-count',
      referrer: 'alert.presets.highest-volume',
      query: 'event.type:transaction',
      per_page: 1
    }
  });
  const transaction = result.data[0];

  if (transaction) {
    return [transaction.transaction, transaction['count()']];
  }

  return null;
}

function makeTeamCriticalAlert(project) {
  let threshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 200;
  return {
    label: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleTriggerType.CRITICAL,
    alertThreshold: threshold,
    actions: project.teams.slice(0, 4).map(team => ({
      type: _types__WEBPACK_IMPORTED_MODULE_3__.ActionType.EMAIL,
      targetType: _types__WEBPACK_IMPORTED_MODULE_3__.TargetType.TEAM,
      targetIdentifier: team.id,
      unsavedDateCreated: new Date().toISOString(),
      inputChannelId: null,
      options: null,
      unsavedId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_2__.uniqueId)()
    }))
  };
}

function makeTeamWarningAlert() {
  let threshold = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 100;
  return {
    label: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleTriggerType.WARNING,
    alertThreshold: threshold,
    actions: []
  };
}

const PRESET_AGGREGATES = [{
  id: 'p95-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow transactions'),
  description: 'Get notified when important transactions are slower on average',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'trans_duration',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p95 Alert for %s', [project.slug]),
      aggregate: 'p95(transaction.duration)',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 60,
      comparisonDelta: 1440,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.ABOVE,
      triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu;

    const transaction = (_await$getHighestVolu = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu === void 0 ? void 0 : _await$getHighestVolu[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}, {
  id: 'throughput-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Throttled throughput'),
  description: 'Send an alert when transaction throughput drops significantly',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'throughput',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Throughput Alert for %s', [project.slug]),
      aggregate: 'count()',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 30,
      comparisonDelta: 24 * 60 * 7,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.BELOW,
      triggers: [makeTeamCriticalAlert(project, 500), makeTeamWarningAlert(300)]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu2;

    const transaction = (_await$getHighestVolu2 = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu2 === void 0 ? void 0 : _await$getHighestVolu2[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}, {
  id: 'apdex-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apdex Score'),
  description: 'Learn when the ratio of satisfactory, tolerable, and frustrated requests drop',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'apdex',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apdex regression for %s', [project.slug]),
      aggregate: 'apdex(300)',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 30,
      comparisonDelta: 24 * 60 * 7,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.BELOW,
      triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu3;

    const transaction = (_await$getHighestVolu3 = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu3 === void 0 ? void 0 : _await$getHighestVolu3[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}];

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

/***/ "./app/views/alerts/types.tsx":
/*!************************************!*\
  !*** ./app/views/alerts/types.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertRuleStatus": () => (/* binding */ AlertRuleStatus),
/* harmony export */   "AlertRuleType": () => (/* binding */ AlertRuleType),
/* harmony export */   "CombinedAlertType": () => (/* binding */ CombinedAlertType),
/* harmony export */   "IncidentActivityType": () => (/* binding */ IncidentActivityType),
/* harmony export */   "IncidentStatus": () => (/* binding */ IncidentStatus),
/* harmony export */   "IncidentStatusMethod": () => (/* binding */ IncidentStatusMethod)
/* harmony export */ });
let AlertRuleType;

(function (AlertRuleType) {
  AlertRuleType["METRIC"] = "metric";
  AlertRuleType["ISSUE"] = "issue";
})(AlertRuleType || (AlertRuleType = {}));

let IncidentActivityType;

(function (IncidentActivityType) {
  IncidentActivityType[IncidentActivityType["CREATED"] = 0] = "CREATED";
  IncidentActivityType[IncidentActivityType["DETECTED"] = 1] = "DETECTED";
  IncidentActivityType[IncidentActivityType["STATUS_CHANGE"] = 2] = "STATUS_CHANGE";
  IncidentActivityType[IncidentActivityType["COMMENT"] = 3] = "COMMENT";
  IncidentActivityType[IncidentActivityType["STARTED"] = 4] = "STARTED";
})(IncidentActivityType || (IncidentActivityType = {}));

let IncidentStatus;

(function (IncidentStatus) {
  IncidentStatus[IncidentStatus["OPENED"] = 1] = "OPENED";
  IncidentStatus[IncidentStatus["CLOSED"] = 2] = "CLOSED";
  IncidentStatus[IncidentStatus["WARNING"] = 10] = "WARNING";
  IncidentStatus[IncidentStatus["CRITICAL"] = 20] = "CRITICAL";
})(IncidentStatus || (IncidentStatus = {}));

let IncidentStatusMethod;

(function (IncidentStatusMethod) {
  IncidentStatusMethod[IncidentStatusMethod["MANUAL"] = 1] = "MANUAL";
  IncidentStatusMethod[IncidentStatusMethod["RULE_UPDATED"] = 2] = "RULE_UPDATED";
  IncidentStatusMethod[IncidentStatusMethod["RULE_TRIGGERED"] = 3] = "RULE_TRIGGERED";
})(IncidentStatusMethod || (IncidentStatusMethod = {}));

let AlertRuleStatus;

(function (AlertRuleStatus) {
  AlertRuleStatus[AlertRuleStatus["PENDING"] = 0] = "PENDING";
  AlertRuleStatus[AlertRuleStatus["SNAPSHOT"] = 4] = "SNAPSHOT";
  AlertRuleStatus[AlertRuleStatus["DISABLED"] = 5] = "DISABLED";
})(AlertRuleStatus || (AlertRuleStatus = {}));

let CombinedAlertType;

(function (CombinedAlertType) {
  CombinedAlertType["METRIC"] = "alert_rule";
  CombinedAlertType["ISSUE"] = "rule";
})(CombinedAlertType || (CombinedAlertType = {}));

/***/ }),

/***/ "./app/views/alerts/wizard/index.tsx":
/*!*******************************************!*\
  !*** ./app/views/alerts/wizard/index.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/alerts/builder/builderBreadCrumbs */ "./app/views/alerts/builder/builderBreadCrumbs.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _rules_metric_presets__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../rules/metric/presets */ "./app/views/alerts/rules/metric/presets.tsx");
/* harmony import */ var _options__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var _panelContent__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./panelContent */ "./app/views/alerts/wizard/panelContent.tsx");
/* harmony import */ var _radioPanelGroup__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./radioPanelGroup */ "./app/views/alerts/wizard/radioPanelGroup.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























const DEFAULT_ALERT_OPTION = 'issues';

class AlertWizard extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      alertOption: this.props.location.query.alert_option in _options__WEBPACK_IMPORTED_MODULE_24__.AlertWizardAlertNames ? this.props.location.query.alert_option : DEFAULT_ALERT_OPTION
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeAlertOption", alertOption => {
      this.setState({
        alertOption
      });
      this.trackView(alertOption);
    });
  }

  componentDidMount() {
    // capture landing on the alert wizard page and viewing the issue alert by default
    this.trackView();
  }

  trackView() {
    let alertType = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_ALERT_OPTION;
    const {
      organization
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('alert_wizard.option_viewed', {
      organization,
      alert_type: alertType
    });
  }

  renderCreateAlertButton() {
    var _params$projectId, _metricRuleTemplate, _metricRuleTemplate2, _location$query, _metricRuleTemplate3;

    const {
      organization,
      location,
      params,
      projectId: _projectId
    } = this.props;
    const {
      alertOption
    } = this.state;
    const projectId = (_params$projectId = params.projectId) !== null && _params$projectId !== void 0 ? _params$projectId : _projectId;
    const project = this.props.projects.find(p => p.slug === projectId);
    let metricRuleTemplate = _options__WEBPACK_IMPORTED_MODULE_24__.AlertWizardRuleTemplates[alertOption];
    const isMetricAlert = !!metricRuleTemplate;
    const isTransactionDataset = ((_metricRuleTemplate = metricRuleTemplate) === null || _metricRuleTemplate === void 0 ? void 0 : _metricRuleTemplate.dataset) === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_21__.Dataset.TRANSACTIONS;

    if (organization.features.includes('alert-crash-free-metrics') && ((_metricRuleTemplate2 = metricRuleTemplate) === null || _metricRuleTemplate2 === void 0 ? void 0 : _metricRuleTemplate2.dataset) === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_21__.Dataset.SESSIONS) {
      metricRuleTemplate = { ...metricRuleTemplate,
        dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_21__.Dataset.METRICS
      };
    }

    const supportedPreset = _rules_metric_presets__WEBPACK_IMPORTED_MODULE_23__.PRESET_AGGREGATES.filter(agg => agg.alertType === alertOption)[0];
    const to = {
      pathname: `/organizations/${organization.slug}/alerts/new/${isMetricAlert ? sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_22__.AlertRuleType.METRIC : sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_22__.AlertRuleType.ISSUE}/`,
      query: { ...(metricRuleTemplate ? metricRuleTemplate : {}),
        project: projectId,
        referrer: location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.referrer
      }
    };

    const renderNoAccess = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_8__.Hovercard, {
      body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_6__["default"], {
        features: p.features,
        hideHelpToggle: true,
        featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Metric Alerts')
      }),
      children: p.children(p)
    });

    let showUseTemplateBtn = !!(project !== null && project !== void 0 && project.firstTransactionEvent) && isMetricAlert && ((_metricRuleTemplate3 = metricRuleTemplate) === null || _metricRuleTemplate3 === void 0 ? void 0 : _metricRuleTemplate3.dataset) === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_21__.Dataset.TRANSACTIONS && !!supportedPreset;

    if (showUseTemplateBtn) {
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__.logExperiment)({
        key: 'MetricAlertPresetExperiment',
        organization
      });
    }

    showUseTemplateBtn = showUseTemplateBtn && !!organization.experiments.MetricAlertPresetExperiment;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__["default"], {
      features: isTransactionDataset ? ['organizations:incidents', 'organizations:performance-view'] : isMetricAlert ? ['organizations:incidents'] : [],
      requireAll: true,
      organization: organization,
      hookName: "feature-disabled:alert-wizard-performance",
      renderDisabled: renderNoAccess,
      children: _ref => {
        let {
          hasFeature
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(WizardButtonContainer, {
          onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('alert_wizard.option_selected', {
            organization,
            alert_type: alertOption
          }),
          children: [showUseTemplateBtn && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_7__["default"], {
            organization: organization,
            projectSlug: projectId,
            disabled: !hasFeature,
            priority: "default",
            to: {
              pathname: to.pathname,
              query: { ...to.query,
                preset: supportedPreset.id
              }
            },
            onEnter: () => {
              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.metric_alert_preset_use_template', {
                organization,
                preset: supportedPreset.id
              });
            },
            hideIcon: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Use Template')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_7__["default"], {
            organization: organization,
            projectSlug: projectId,
            disabled: !hasFeature,
            priority: "primary",
            to: to,
            hideIcon: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Set Conditions')
          })]
        });
      }
    });
  }

  render() {
    var _params$projectId2;

    const {
      organization,
      params,
      projectId: _projectId,
      routes,
      location
    } = this.props;
    const {
      alertOption
    } = this.state;
    const projectId = (_params$projectId2 = params.projectId) !== null && _params$projectId2 !== void 0 ? _params$projectId2 : _projectId;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Alert Creation Wizard');
    const panelContent = _panelContent__WEBPACK_IMPORTED_MODULE_25__.AlertWizardPanelContent[alertOption];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_14__["default"], {
        title: title,
        projectSlug: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledHeaderContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_20__["default"], {
            organization: organization,
            projectSlug: projectId,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Select Alert'),
            routes: routes,
            location: location,
            canChangeProject: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Title, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Select Alert')
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Main, {
          fullWidth: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(WizardBody, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(WizardOptions, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(CategoryTitle, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Errors')
              }), (0,_options__WEBPACK_IMPORTED_MODULE_24__.getAlertWizardCategories)(organization).map((_ref2, i) => {
                let {
                  categoryHeading,
                  options
                } = _ref2;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(OptionsWrapper, {
                  children: [i > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(CategoryTitle, {
                    children: [categoryHeading, " "]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(_radioPanelGroup__WEBPACK_IMPORTED_MODULE_26__["default"], {
                    choices: options.map(alertType => {
                      return [alertType, _options__WEBPACK_IMPORTED_MODULE_24__.AlertWizardAlertNames[alertType]];
                    }),
                    onChange: this.handleChangeAlertOption,
                    value: alertOption,
                    label: "alert-option"
                  })]
                }, categoryHeading);
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(WizardPanel, {
              visible: !!panelContent && !!alertOption,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(WizardPanelBody, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)("div", {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
                    children: _options__WEBPACK_IMPORTED_MODULE_24__.AlertWizardAlertNames[alertOption]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
                    withPadding: true,
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(PanelDescription, {
                      children: [panelContent.description, ' ', panelContent.docsLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                        href: panelContent.docsLink,
                        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Learn more')
                      })]
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(WizardImage, {
                      src: panelContent.illustration
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ExampleHeader, {
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Examples')
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ExampleList, {
                      symbol: "bullet",
                      children: panelContent.examples.map((example, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ExampleItem, {
                        children: example
                      }, i))
                    })]
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(WizardFooter, {
                  children: this.renderCreateAlertButton()
                })]
              })
            })]
          })
        })
      })]
    });
  }

}

AlertWizard.displayName = "AlertWizard";

const StyledHeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.HeaderContent,  true ? {
  target: "e154lla713"
} : 0)( true ? {
  name: "1h8nup8",
  styles: "overflow:visible"
} : 0);

const CategoryTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h2',  true ? {
  target: "e154lla712"
} : 0)("font-weight:normal;font-size:", p => p.theme.fontSizeExtraLarge, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), "!important;" + ( true ? "" : 0));

const WizardBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla711"
} : 0)("display:flex;padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const WizardOptions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla710"
} : 0)("flex:3;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(3), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(3), ";max-width:300px;" + ( true ? "" : 0));

const WizardImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('img',  true ? {
  target: "e154lla79"
} : 0)( true ? {
  name: "1f6izsi",
  styles: "max-height:300px"
} : 0);

const WizardPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel,  true ? {
  target: "e154lla78"
} : 0)("max-width:700px;position:sticky;top:20px;flex:5;display:flex;", p => !p.visible && 'visibility: hidden', ";flex-direction:column;align-items:start;align-self:flex-start;", p => p.visible && 'animation: 0.6s pop ease forwards', ";@keyframes pop{0%{transform:translateY(30px);opacity:0;}100%{transform:translateY(0);opacity:1;}}" + ( true ? "" : 0));

const ExampleList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e154lla77"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), "!important;" + ( true ? "" : 0));

const WizardPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody,  true ? {
  target: "e154lla76"
} : 0)( true ? {
  name: "mko90d",
  styles: "flex:1;min-width:100%"
} : 0);

const PanelDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e154lla75"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const ExampleHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla74"
} : 0)("margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), " 0;font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const ExampleItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e154lla73"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const OptionsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla72"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(4), ";&:last-child{margin-bottom:0;}" + ( true ? "" : 0));

const WizardFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla71"
} : 0)("border-top:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1.5), ";" + ( true ? "" : 0));

const WizardButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e154lla70"
} : 0)("display:flex;justify-content:flex-end;a:not(:last-child){margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_19__["default"])(AlertWizard));

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

/***/ "./app/views/alerts/wizard/panelContent.tsx":
/*!**************************************************!*\
  !*** ./app/views/alerts/wizard/panelContent.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertWizardPanelContent": () => (/* binding */ AlertWizardPanelContent)
/* harmony export */ });
/* harmony import */ var sentry_images_spot_alerts_wizard_apdex_svg__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-apdex.svg */ "./images/spot/alerts-wizard-apdex.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_cls_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-cls.svg */ "./images/spot/alerts-wizard-cls.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_crash_free_sessions_svg__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-crash-free-sessions.svg */ "./images/spot/alerts-wizard-crash-free-sessions.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_crash_free_users_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-crash-free-users.svg */ "./images/spot/alerts-wizard-crash-free-users.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_custom_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-custom.svg */ "./images/spot/alerts-wizard-custom.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_errors_svg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-errors.svg */ "./images/spot/alerts-wizard-errors.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_failure_rate_svg__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-failure-rate.svg */ "./images/spot/alerts-wizard-failure-rate.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_fid_svg__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-fid.svg */ "./images/spot/alerts-wizard-fid.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_issues_svg__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-issues.svg */ "./images/spot/alerts-wizard-issues.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_lcp_svg__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-lcp.svg */ "./images/spot/alerts-wizard-lcp.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_throughput_svg__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-throughput.svg */ "./images/spot/alerts-wizard-throughput.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_transaction_duration_svg__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-transaction-duration.svg */ "./images/spot/alerts-wizard-transaction-duration.svg");
/* harmony import */ var sentry_images_spot_alerts_wizard_users_experiencing_errors_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry-images/spot/alerts-wizard-users-experiencing-errors.svg */ "./images/spot/alerts-wizard-users-experiencing-errors.svg");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");














const AlertWizardPanelContent = {
  issues: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Issues are groups of errors that have a similar stacktrace. Set an alert for new issues, when an issue changes state, frequency of errors, or users affected by an issue.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)("When the triggering event's level is fatal."), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When an issue was seen 100 times in the last 2 days.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Create a JIRA ticket when an issue changes state from resolved to unresolved and is unassigned.')],
    illustration: sentry_images_spot_alerts_wizard_issues_svg__WEBPACK_IMPORTED_MODULE_8__
  },
  num_errors: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Alert when the number of errors in a project matching your filters crosses a threshold. This is useful for monitoring the overall level or errors in your project or errors occurring in specific parts of your app.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the signup page has more than 10k errors in 5 minutes.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When there are more than 500k errors in 10 minutes from a specific file.')],
    illustration: sentry_images_spot_alerts_wizard_errors_svg__WEBPACK_IMPORTED_MODULE_5__
  },
  users_experiencing_errors: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Alert when the number of users affected by errors in your project crosses a threshold.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When 100k users experience an error in 1 hour.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When 100 users experience a problem on the Checkout page.')],
    illustration: sentry_images_spot_alerts_wizard_users_experiencing_errors_svg__WEBPACK_IMPORTED_MODULE_12__
  },
  throughput: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Throughput is the total number of transactions in a project and you can alert when it reaches a threshold within a period of time.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When number of transactions on a key page exceeds 100k per minute.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When number of transactions drops below a threshold.')],
    illustration: sentry_images_spot_alerts_wizard_throughput_svg__WEBPACK_IMPORTED_MODULE_10__
  },
  trans_duration: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Monitor how long it takes for transactions to complete. Use flexible aggregates like percentiles, averages, and min/max.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When any transaction is slower than 3 seconds.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the 75th percentile response time is higher than 250 milliseconds.')],
    illustration: sentry_images_spot_alerts_wizard_transaction_duration_svg__WEBPACK_IMPORTED_MODULE_11__
  },
  apdex: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Apdex is a metric used to track and measure user satisfaction based on your application response times. The Apdex score provides the ratio of satisfactory, tolerable, and frustrated requests in a specific transaction or endpoint.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When apdex is below 300.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#apdex',
    illustration: sentry_images_spot_alerts_wizard_apdex_svg__WEBPACK_IMPORTED_MODULE_0__
  },
  failure_rate: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Failure rate is the percentage of unsuccessful transactions. Sentry treats transactions with a status other than “ok,” “canceled,” and “unknown” as failures.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the failure rate for an important endpoint reaches 10%.')],
    docsLink: 'https://docs.sentry.io/product/performance/metrics/#failure-rate',
    illustration: sentry_images_spot_alerts_wizard_failure_rate_svg__WEBPACK_IMPORTED_MODULE_6__
  },
  lcp: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Largest Contentful Paint (LCP) measures loading performance. It marks the point when the largest image or text block is visible within the viewport. A fast LCP helps reassure the user that the page is useful, and so we recommend an LCP of less than 2.5 seconds.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the 75th percentile LCP of your homepage is longer than 2.5 seconds.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: sentry_images_spot_alerts_wizard_lcp_svg__WEBPACK_IMPORTED_MODULE_9__
  },
  fid: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('First Input Delay (FID) measures interactivity as the response time when the user tries to interact with the viewport. A low FID helps ensure that a page is useful, and we recommend a FID of less than 100 milliseconds.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the average FID of a page is longer than 4 seconds.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: sentry_images_spot_alerts_wizard_fid_svg__WEBPACK_IMPORTED_MODULE_7__
  },
  cls: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Cumulative Layout Shift (CLS) measures visual stability by quantifying unexpected layout shifts that occur during the entire lifespan of the page. A CLS of less than 0.1 is a good user experience, while anything greater than 0.25 is poor.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the CLS of a page is more than 0.5.')],
    docsLink: 'https://docs.sentry.io/product/performance/web-vitals',
    illustration: sentry_images_spot_alerts_wizard_cls_svg__WEBPACK_IMPORTED_MODULE_1__
  },
  custom: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Alert on metrics which are not listed above, such as first paint (FP), first contentful paint (FCP), and time to first byte (TTFB).'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the 95th percentile FP of a page is longer than 250 milliseconds.'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the average TTFB of a page is longer than 600 millliseconds.')],
    illustration: sentry_images_spot_alerts_wizard_custom_svg__WEBPACK_IMPORTED_MODULE_4__
  },
  crash_free_sessions: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('A session begins when a user starts the application and ends when it’s closed or sent to the background. A crash is when a session ends due to an error and this type of alert lets you monitor when those crashed sessions exceed a threshold. This lets you get a better picture of the health of your app.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the Crash Free Rate is below 98%, send a Slack notification to the team.')],
    illustration: sentry_images_spot_alerts_wizard_crash_free_sessions_svg__WEBPACK_IMPORTED_MODULE_2__
  },
  crash_free_users: {
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Crash Free Users is the percentage of distinct users that haven’t experienced a crash and so this type of alert tells you when the overall user experience dips below a certain unacceptable threshold.'),
    examples: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('When the Crash Free Rate is below 97%, send an email notification to yourself.')],
    illustration: sentry_images_spot_alerts_wizard_crash_free_users_svg__WEBPACK_IMPORTED_MODULE_3__
  }
};

/***/ }),

/***/ "./app/views/alerts/wizard/radioPanelGroup.tsx":
/*!*****************************************************!*\
  !*** ./app/views/alerts/wizard/radioPanelGroup.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const RadioPanelGroup = _ref => {
  let {
    value,
    choices,
    label,
    onChange,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Container, { ...props,
    role: "radiogroup",
    "aria-labelledby": label,
    children: (choices || []).map((_ref2, index) => {
      let [id, name, extraContent] = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(RadioPanel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(RadioLineItem, {
          role: "radio",
          index: index,
          "aria-checked": value === id,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_2__["default"], {
            radioSize: "small",
            "aria-label": id,
            checked: value === id,
            onChange: e => onChange(id, e)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
            children: name
          }), extraContent]
        })
      }, index);
    })
  });
};

RadioPanelGroup.displayName = "RadioPanelGroup";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RadioPanelGroup);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6syngk2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";grid-auto-flow:row;grid-auto-rows:max-content;grid-auto-columns:auto;" + ( true ? "" : 0));

const RadioLineItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e6syngk1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";grid-template-columns:max-content auto max-content;align-items:center;cursor:pointer;outline:none;font-weight:normal;margin:0;color:", p => p.theme.subText, ";transition:color 0.3s ease-in;padding:0;position:relative;&:hover,&:focus{color:", p => p.theme.textColor, ";}svg{display:none;opacity:0;}&[aria-checked='true']{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

const RadioPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e6syngk0"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/***/ }),

/***/ "./images/spot/alerts-wizard-apdex.svg":
/*!*********************************************!*\
  !*** ./images/spot/alerts-wizard-apdex.svg ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-apdex.2d7b903af1af600b0364.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-cls.svg":
/*!*******************************************!*\
  !*** ./images/spot/alerts-wizard-cls.svg ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-cls.cf220f0ac2dffab58be1.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-crash-free-sessions.svg":
/*!***********************************************************!*\
  !*** ./images/spot/alerts-wizard-crash-free-sessions.svg ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-crash-free-sessions.ef24692dfac042b1e001.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-crash-free-users.svg":
/*!********************************************************!*\
  !*** ./images/spot/alerts-wizard-crash-free-users.svg ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-crash-free-users.902c18719fd9edc73570.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-custom.svg":
/*!**********************************************!*\
  !*** ./images/spot/alerts-wizard-custom.svg ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-custom.e7e18ffaa3cdca142c09.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-errors.svg":
/*!**********************************************!*\
  !*** ./images/spot/alerts-wizard-errors.svg ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-errors.53d97ecbafeaae2f8328.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-failure-rate.svg":
/*!****************************************************!*\
  !*** ./images/spot/alerts-wizard-failure-rate.svg ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-failure-rate.550a98c4c3cf00696a98.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-fid.svg":
/*!*******************************************!*\
  !*** ./images/spot/alerts-wizard-fid.svg ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-fid.f583e064ca64ffea0288.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-issues.svg":
/*!**********************************************!*\
  !*** ./images/spot/alerts-wizard-issues.svg ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-issues.022643ec283774262884.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-lcp.svg":
/*!*******************************************!*\
  !*** ./images/spot/alerts-wizard-lcp.svg ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-lcp.7fba13d3d39336bc0181.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-throughput.svg":
/*!**************************************************!*\
  !*** ./images/spot/alerts-wizard-throughput.svg ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-throughput.bde64167ff79e5592399.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-transaction-duration.svg":
/*!************************************************************!*\
  !*** ./images/spot/alerts-wizard-transaction-duration.svg ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-transaction-duration.bc8485680f884dedd379.svg";

/***/ }),

/***/ "./images/spot/alerts-wizard-users-experiencing-errors.svg":
/*!*****************************************************************!*\
  !*** ./images/spot/alerts-wizard-users-experiencing-errors.svg ***!
  \*****************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/alerts-wizard-users-experiencing-errors.4c0ae6f7f4833b58f206.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_wizard_index_tsx.f0a9c7c8d18f4295ef6a6b7ffc0ba88d.js.map