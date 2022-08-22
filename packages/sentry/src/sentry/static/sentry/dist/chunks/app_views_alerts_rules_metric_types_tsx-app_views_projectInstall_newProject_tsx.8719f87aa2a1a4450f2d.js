"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_rules_metric_types_tsx-app_views_projectInstall_newProject_tsx"],{

/***/ "./app/utils/slugify.tsx":
/*!*******************************!*\
  !*** ./app/utils/slugify.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ slugify)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);

// XXX: This is NOT an exhaustive slugify function
// Only forces lowercase and replaces spaces with hyphens
function slugify(str) {
  return typeof str === 'string' ? str.toLowerCase().replace(' ', '-') : '';
}

/***/ }),

/***/ "./app/utils/withTeams.tsx":
/*!*********************************!*\
  !*** ./app/utils/withTeams.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * Higher order component that provides a list of teams
 *
 * @deprecated Prefer `useTeams` or `<Teams />`.
 */
const withTeams = WrappedComponent => {
  const WithTeams = props => {
    const {
      teams
    } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_1__["default"])();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, {
      teams: teams,
      ...props
    });
  };

  WithTeams.displayName = `withTeams(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return WithTeams;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withTeams);

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

/***/ "./app/views/projectInstall/createProject.tsx":
/*!****************************************************!*\
  !*** ./app/views/projectInstall/createProject.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CreateProject": () => (/* binding */ CreateProject),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_platformPicker__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/platformPicker */ "./app/components/platformPicker.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_getPlatformName__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/getPlatformName */ "./app/utils/getPlatformName.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withTeams__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/withTeams */ "./app/utils/withTeams.tsx");
/* harmony import */ var sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/projectInstall/issueAlertOptions */ "./app/views/projectInstall/issueAlertOptions.tsx");
/* harmony import */ var _alerts_rules_metric_presets__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../alerts/rules/metric/presets */ "./app/views/alerts/rules/metric/presets.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




 // eslint-disable-next-line no-restricted-imports




























const getCategoryName = category => {
  var _categoryList$find;

  return (_categoryList$find = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_14__["default"].find(_ref => {
    let {
      id
    } = _ref;
    return id === category;
  })) === null || _categoryList$find === void 0 ? void 0 : _categoryList$find.id;
};

class CreateProject extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor(props, _context) {
    super(props, _context);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createProject", async e => {
      e.preventDefault();
      const {
        organization,
        api
      } = this.props;
      const {
        projectName,
        platform,
        team,
        dataFragment
      } = this.state;
      const {
        slug
      } = organization;
      const {
        shouldCreateCustomRule,
        name,
        conditions,
        actions,
        actionMatch,
        frequency,
        defaultRules,
        metricAlertPresets
      } = dataFragment || {};
      this.setState({
        inFlight: true
      });

      if (!projectName) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_28__.withScope(scope => {
          scope.setExtra('props', this.props);
          scope.setExtra('state', this.state);
          _sentry_react__WEBPACK_IMPORTED_MODULE_28__.captureMessage('No project name');
        });
      }

      try {
        const projectData = await api.requestPromise(`/teams/${slug}/${team}/projects/`, {
          method: 'POST',
          data: {
            name: projectName,
            platform,
            default_rules: defaultRules !== null && defaultRules !== void 0 ? defaultRules : true
          }
        });
        let ruleId;

        if (shouldCreateCustomRule) {
          const ruleData = await api.requestPromise(`/projects/${organization.slug}/${projectData.slug}/rules/`, {
            method: 'POST',
            data: {
              name,
              conditions,
              actions,
              actionMatch,
              frequency
            }
          });
          ruleId = ruleData.id;
        }

        if (!!organization.experiments.MetricAlertOnProjectCreationExperiment && metricAlertPresets && metricAlertPresets.length > 0) {
          const presets = _alerts_rules_metric_presets__WEBPACK_IMPORTED_MODULE_27__.PRESET_AGGREGATES.filter(aggregate => metricAlertPresets.includes(aggregate.id));
          const teamObj = this.props.teams.find(aTeam => aTeam.slug === team);
          await Promise.all([presets.map(preset => {
            const context = preset.makeUnqueriedContext({ ...projectData,
              teams: teamObj ? [teamObj] : []
            }, organization);
            return api.requestPromise(`/projects/${organization.slug}/${projectData.slug}/alert-rules/?referrer=create_project`, {
              method: 'POST',
              data: {
                aggregate: context.aggregate,
                comparisonDelta: context.comparisonDelta,
                dataset: context.dataset,
                eventTypes: context.eventTypes,
                name: context.name,
                owner: null,
                projectId: projectData.id,
                projects: [projectData.slug],
                query: '',
                resolveThreshold: null,
                thresholdPeriod: 1,
                thresholdType: context.thresholdType,
                timeWindow: context.timeWindow,
                triggers: context.triggers
              }
            });
          })]);
        }

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('project_creation_page.created', {
          organization,
          metric_alerts: (metricAlertPresets || []).join(','),
          issue_alert: defaultRules ? 'Default' : shouldCreateCustomRule ? 'Custom' : 'No Rule',
          project_id: projectData.id,
          rule_id: ruleId || ''
        });
        sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_8__["default"].createSuccess(projectData);
        const platformKey = platform || 'other';
        const nextUrl = `/${organization.slug}/${projectData.slug}/getting-started/${platformKey}/`;
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(nextUrl);
      } catch (err) {
        this.setState({
          inFlight: false,
          error: err.responseJSON.detail
        }); // Only log this if the error is something other than:
        // * The user not having access to create a project, or,
        // * A project with that slug already exists

        if (err.status !== 403 && err.status !== 409) {
          _sentry_react__WEBPACK_IMPORTED_MODULE_28__.withScope(scope => {
            scope.setExtra('err', err);
            scope.setExtra('props', this.props);
            scope.setExtra('state', this.state);
            _sentry_react__WEBPACK_IMPORTED_MODULE_28__.captureMessage('Project creation failed');
          });
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setPlatform", platformId => this.setState(_ref2 => {
      let {
        projectName,
        platform
      } = _ref2;
      return {
        platform: platformId,
        projectName: !projectName || platform && (0,sentry_utils_getPlatformName__WEBPACK_IMPORTED_MODULE_21__["default"])(platform) === projectName ? (0,sentry_utils_getPlatformName__WEBPACK_IMPORTED_MODULE_21__["default"])(platformId) || '' : projectName
      };
    }));

    const {
      teams,
      location
    } = props;
    const {
      query
    } = location;
    const accessTeams = teams.filter(team => team.hasAccess);

    const _team = query.team || accessTeams.length && accessTeams[0].slug;

    const _platform = (0,sentry_utils_getPlatformName__WEBPACK_IMPORTED_MODULE_21__["default"])(query.platform) ? query.platform : '';

    this.state = {
      error: false,
      projectName: (0,sentry_utils_getPlatformName__WEBPACK_IMPORTED_MODULE_21__["default"])(_platform) || '',
      team: _team,
      platform: _platform,
      inFlight: false,
      dataFragment: undefined
    };
  }

  componentDidMount() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('project_creation_page.viewed', {
      organization: this.props.organization
    });
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_19__.logExperiment)({
      key: 'MetricAlertOnProjectCreationExperiment',
      organization: this.props.organization
    });
  }

  get defaultCategory() {
    const {
      query
    } = this.props.location;
    return getCategoryName(query.category);
  }

  renderProjectForm() {
    const {
      organization
    } = this.props;
    const {
      projectName,
      platform,
      team
    } = this.state;

    const createProjectForm = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(CreateProjectForm, {
      onSubmit: this.createProject,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(FormLabel, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project name')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ProjectNameInput, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledPlatformIcon, {
            platform: platform !== null && platform !== void 0 ? platform : ''
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("input", {
            type: "text",
            name: "name",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('project-name'),
            autoComplete: "off",
            value: projectName,
            onChange: e => this.setState({
              projectName: (0,sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_22__["default"])(e.target.value)
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(FormLabel, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Team')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(TeamSelectInput, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_11__["default"], {
            name: "select-team",
            menuPlacement: "auto",
            clearable: false,
            value: team,
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Select a Team'),
            onChange: choice => this.setState({
              team: choice.value
            }),
            teamFilter: filterTeam => filterTeam.hasAccess
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
            borderless: true,
            "data-test-id": "create-team",
            type: "button",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconAdd, {
              isCircled: true
            }),
            onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openCreateTeamModal)({
              organization,
              onClose: _ref3 => {
                let {
                  slug
                } = _ref3;
                return this.setState({
                  team: slug
                });
              }
            }),
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Create a team'),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Create a team')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          "data-test-id": "create-project",
          priority: "primary",
          disabled: !this.canSubmitForm,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Create Project')
        })
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__["default"], {
        withMargins: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Give your project a name')
      }), createProjectForm]
    });
  }

  get canSubmitForm() {
    var _conditions$every;

    const {
      projectName,
      team,
      inFlight
    } = this.state;
    const {
      shouldCreateCustomRule,
      conditions
    } = this.state.dataFragment || {};
    return !inFlight && team && projectName !== '' && (!shouldCreateCustomRule || (conditions === null || conditions === void 0 ? void 0 : (_conditions$every = conditions.every) === null || _conditions$every === void 0 ? void 0 : _conditions$every.call(conditions, condition => condition.value)));
  }

  render() {
    const {
      platform,
      error
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
        type: "error",
        children: error
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)("div", {
        "data-test-id": "onboarding-info",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__["default"], {
          withMargins: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Create a new Project')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(HelpText, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)(`Projects allow you to scope error and transaction events to a specific
               application in your organization. For example, you might have separate
               projects for your API server and frontend client.`)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__["default"], {
          withMargins: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Choose a platform')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_platformPicker__WEBPACK_IMPORTED_MODULE_13__["default"], {
          platform: platform,
          defaultCategory: this.defaultCategory,
          setPlatform: this.setPlatform,
          organization: this.props.organization,
          showOther: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_26__["default"], {
          onChange: updatedData => {
            this.setState({
              dataFragment: updatedData
            });
          }
        }), this.renderProjectForm()]
      })]
    });
  }

}

CreateProject.displayName = "CreateProject";
// TODO(davidenwang): change to functional component and replace withTeams with useTeams
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_23__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_24__["default"])((0,sentry_utils_withTeams__WEBPACK_IMPORTED_MODULE_25__["default"])(CreateProject)))));


const CreateProjectForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('form',  true ? {
  target: "e1icdt8d5"
} : 0)("display:grid;grid-template-columns:300px minmax(250px, max-content) max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";align-items:end;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), " 0;box-shadow:0 -1px 0 rgba(0, 0, 0, 0.1);background:", p => p.theme.background, ";" + ( true ? "" : 0));

const FormLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1icdt8d4"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";" + ( true ? "" : 0));

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_6__.PlatformIcon,  true ? {
  target: "e1icdt8d3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";" + ( true ? "" : 0));

const ProjectNameInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1icdt8d2"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_17__.inputStyles)(p), ";padding:5px 10px;display:flex;align-items:center;input{background:", p => p.theme.background, ";border:0;outline:0;flex:1;}" + ( true ? "" : 0));

const TeamSelectInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1icdt8d1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";grid-template-columns:1fr min-content;align-items:center;" + ( true ? "" : 0));

const HelpText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1icdt8d0"
} : 0)("color:", p => p.theme.subText, ";max-width:760px;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/projectInstall/newProject.tsx":
/*!*************************************************!*\
  !*** ./app/views/projectInstall/newProject.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_projectInstall_createProject__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/projectInstall/createProject */ "./app/views/projectInstall/createProject.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const NewProject = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Container, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
      className: "container",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Content, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_views_projectInstall_createProject__WEBPACK_IMPORTED_MODULE_3__["default"], {})
      })
    })
  })
});

NewProject.displayName = "NewProject";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "escx7041"
} : 0)("flex:1;background:", p => p.theme.background, ";" + ( true ? "" : 0));

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "escx7040"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NewProject);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_rules_metric_types_tsx-app_views_projectInstall_newProject_tsx.08dda2701633b19fad79fc38182b7479.js.map