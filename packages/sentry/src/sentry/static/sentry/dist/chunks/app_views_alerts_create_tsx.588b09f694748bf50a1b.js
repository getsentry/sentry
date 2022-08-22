"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_create_tsx"],{

/***/ "./app/views/alerts/create.tsx":
/*!*************************************!*\
  !*** ./app/views/alerts/create.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/builder/builderBreadCrumbs */ "./app/views/alerts/builder/builderBreadCrumbs.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/rules/issue */ "./app/views/alerts/rules/issue/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_create__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/create */ "./app/views/alerts/rules/metric/create.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_duplicate__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/duplicate */ "./app/views/alerts/rules/metric/duplicate.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















class Create extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sessionId", (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_11__.uniqueId)());
  }

  getInitialState() {
    var _location$query;

    const {
      organization,
      location,
      project,
      params,
      router
    } = this.props;
    const {
      aggregate,
      dataset,
      eventTypes,
      createFromDuplicate
    } = (_location$query = location === null || location === void 0 ? void 0 : location.query) !== null && _location$query !== void 0 ? _location$query : {};
    const alertType = params.alertType || sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__.AlertRuleType.METRIC; // TODO(taylangocmen): Remove redirect with aggregate && dataset && eventTypes, init from template

    if (alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__.AlertRuleType.METRIC && !(aggregate && dataset && eventTypes) && !createFromDuplicate) {
      router.replace({ ...location,
        pathname: `/organizations/${organization.slug}/alerts/new/${alertType}`,
        query: { ...location.query,
          ...sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_WIZARD_TEMPLATE,
          project: project.slug
        }
      });
    }

    return {
      alertType
    };
  }

  componentDidMount() {
    const {
      organization,
      project
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('new_alert_rule.viewed', {
      organization,
      project_id: project.id,
      session_id: this.sessionId,
      alert_type: this.state.alertType,
      duplicate_rule: this.isDuplicateRule ? 'true' : 'false',
      wizard_v3: 'true'
    });
  }
  /** Used to track analytics within one visit to the creation page */


  get isDuplicateRule() {
    const {
      location
    } = this.props;
    const createFromDuplicate = (location === null || location === void 0 ? void 0 : location.query.createFromDuplicate) === 'true';
    return createFromDuplicate && (location === null || location === void 0 ? void 0 : location.query.duplicateRuleId);
  }

  render() {
    var _location$query2;

    const {
      hasMetricAlerts,
      organization,
      project,
      location,
      routes
    } = this.props;
    const {
      alertType
    } = this.state;
    const {
      aggregate,
      dataset,
      eventTypes,
      createFromWizard,
      createFromDiscover
    } = (_location$query2 = location === null || location === void 0 ? void 0 : location.query) !== null && _location$query2 !== void 0 ? _location$query2 : {};
    const wizardTemplate = {
      aggregate: aggregate !== null && aggregate !== void 0 ? aggregate : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_WIZARD_TEMPLATE.aggregate,
      dataset: dataset !== null && dataset !== void 0 ? dataset : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_WIZARD_TEMPLATE.dataset,
      eventTypes: eventTypes !== null && eventTypes !== void 0 ? eventTypes : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_WIZARD_TEMPLATE.eventTypes
    };
    const eventView = createFromDiscover ? sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_10__["default"].fromLocation(location) : undefined;
    let wizardAlertType;

    if (createFromWizard && alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__.AlertRuleType.METRIC) {
      wizardAlertType = wizardTemplate ? (0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_19__.getAlertTypeFromAggregateDataset)(wizardTemplate) : 'issues';
    }

    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('New Alert Rule');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: title,
        projectSlug: project.slug
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(StyledHeaderContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_13__["default"], {
            organization: organization,
            alertName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Set Conditions'),
            title: wizardAlertType ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Select Alert') : title,
            projectSlug: project.slug,
            alertType: alertType,
            routes: routes,
            location: location,
            canChangeProject: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Title, {
            children: wizardAlertType ? `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Set Conditions for')} ${sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_18__.AlertWizardAlertNames[wizardAlertType]}` : title
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_12__["default"], {
          provideUserTeams: true,
          children: _ref => {
            let {
              teams,
              initiallyLoaded
            } = _ref;
            return initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(!hasMetricAlerts || alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__.AlertRuleType.ISSUE) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_issue__WEBPACK_IMPORTED_MODULE_14__["default"], { ...this.props,
                project: project,
                userTeamIds: teams.map(_ref2 => {
                  let {
                    id
                  } = _ref2;
                  return id;
                })
              }), hasMetricAlerts && alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_17__.AlertRuleType.METRIC && (this.isDuplicateRule ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_metric_duplicate__WEBPACK_IMPORTED_MODULE_16__["default"], { ...this.props,
                eventView: eventView,
                wizardTemplate: wizardTemplate,
                sessionId: this.sessionId,
                project: project,
                userTeamIds: teams.map(_ref3 => {
                  let {
                    id
                  } = _ref3;
                  return id;
                })
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_metric_create__WEBPACK_IMPORTED_MODULE_15__["default"], { ...this.props,
                eventView: eventView,
                wizardTemplate: wizardTemplate,
                sessionId: this.sessionId,
                project: project,
                userTeamIds: teams.map(_ref4 => {
                  let {
                    id
                  } = _ref4;
                  return id;
                })
              }))]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__["default"], {});
          }
        })
      })]
    });
  }

}

Create.displayName = "Create";

const StyledHeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.HeaderContent,  true ? {
  target: "ew02uqt1"
} : 0)( true ? {
  name: "1h8nup8",
  styles: "overflow:visible"
} : 0);

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body,  true ? {
  target: "ew02uqt0"
} : 0)("&&{padding:0;gap:0;}grid-template-rows:1fr;@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:minmax(100px, auto) 400px;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Create);

/***/ }),

/***/ "./app/views/alerts/rules/metric/create.tsx":
/*!**************************************************!*\
  !*** ./app/views/alerts/rules/metric/create.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _ruleForm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./ruleForm */ "./app/views/alerts/rules/metric/ruleForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
function MetricRulesCreate(props) {
  var _userTeamIds$find;

  function handleSubmitSuccess(data) {
    const {
      router,
      project
    } = props;
    const {
      orgId
    } = props.params;
    const alertRuleId = data ? data.id : undefined;
    sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__.metric.endTransaction({
      name: 'saveAlertRule'
    });
    router.push(alertRuleId ? {
      pathname: `/organizations/${orgId}/alerts/rules/details/${alertRuleId}/`
    } : {
      pathname: `/organizations/${orgId}/alerts/rules/`,
      query: {
        project: project.id
      }
    });
  }

  const {
    project,
    eventView,
    wizardTemplate,
    sessionId,
    userTeamIds,
    ...otherProps
  } = props;
  const defaultRule = eventView ? (0,sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_2__.createRuleFromEventView)(eventView) : wizardTemplate ? (0,sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_2__.createRuleFromWizardTemplate)(wizardTemplate) : (0,sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_2__.createDefaultRule)();
  const projectTeamIds = new Set(project.teams.map(_ref => {
    let {
      id
    } = _ref;
    return id;
  }));
  const defaultOwnerId = (_userTeamIds$find = userTeamIds.find(id => projectTeamIds.has(id))) !== null && _userTeamIds$find !== void 0 ? _userTeamIds$find : null;
  defaultRule.owner = defaultOwnerId && `team:${defaultOwnerId}`;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_ruleForm__WEBPACK_IMPORTED_MODULE_3__["default"], {
    onSubmitSuccess: handleSubmitSuccess,
    rule: { ...defaultRule,
      projects: [project.slug]
    },
    sessionId: sessionId,
    project: project,
    userTeamIds: userTeamIds,
    eventView: eventView,
    ...otherProps
  });
}

MetricRulesCreate.displayName = "MetricRulesCreate";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MetricRulesCreate);

/***/ }),

/***/ "./app/views/alerts/rules/metric/duplicate.tsx":
/*!*****************************************************!*\
  !*** ./app/views/alerts/rules/metric/duplicate.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _ruleForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./ruleForm */ "./app/views/alerts/rules/metric/ruleForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










/**
 * Show metric rules form with values from an existing rule. Redirects to alerts list after creation.
 */
class MetricRulesDuplicate extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", data => {
      const {
        router,
        project,
        params: {
          orgId
        }
      } = this.props;
      const alertRuleId = data ? data.id : undefined;
      router.push(alertRuleId ? {
        pathname: `/organizations/${orgId}/alerts/rules/details/${alertRuleId}/`
      } : {
        pathname: `/organizations/${orgId}/alerts/rules/`,
        query: {
          project: project.id
        }
      });
    });
  }

  getEndpoints() {
    const {
      params: {
        orgId
      },
      location: {
        query
      }
    } = this.props;
    return [['duplicateTargetRule', `/organizations/${orgId}/alert-rules/${query.duplicateRuleId}/`]];
  }

  renderBody() {
    const {
      project,
      sessionId,
      userTeamIds,
      ...otherProps
    } = this.props;
    const {
      duplicateTargetRule
    } = this.state;

    if (!duplicateTargetRule) {
      return this.renderLoading();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_3__.Main, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_ruleForm__WEBPACK_IMPORTED_MODULE_7__["default"], {
        onSubmitSuccess: this.handleSubmitSuccess,
        rule: { ...lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(duplicateTargetRule, sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_5__.DuplicateMetricFields),
          triggers: duplicateTargetRule.triggers.map(trigger => ({ ...lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(trigger, sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_5__.DuplicateTriggerFields),
            actions: trigger.actions.map(action => ({
              inputChannelId: null,
              integrationId: undefined,
              options: null,
              sentryAppId: undefined,
              unsavedId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_4__.uniqueId)(),
              unsavedDateCreated: new Date().toISOString(),
              ...lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(action, sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_5__.DuplicateActionFields)
            }))
          })),
          name: duplicateTargetRule.name + ' copy'
        },
        sessionId: sessionId,
        project: project,
        userTeamIds: userTeamIds,
        isDuplicateRule: true,
        ...otherProps
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MetricRulesDuplicate);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_create_tsx.8c6f9eeca124449bd053ae89f6f14d3d.js.map