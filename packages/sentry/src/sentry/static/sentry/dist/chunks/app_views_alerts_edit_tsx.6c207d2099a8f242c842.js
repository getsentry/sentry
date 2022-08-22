"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_edit_tsx"],{

/***/ "./app/views/alerts/edit.tsx":
/*!***********************************!*\
  !*** ./app/views/alerts/edit.tsx ***!
  \***********************************/
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
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/alerts/builder/builderBreadCrumbs */ "./app/views/alerts/builder/builderBreadCrumbs.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/rules/issue */ "./app/views/alerts/rules/issue/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_edit__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/edit */ "./app/views/alerts/rules/metric/edit.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class ProjectAlertsEditor extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      ruleName: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeTitle", ruleName => {
      this.setState({
        ruleName
      });
    });
  }

  componentDidMount() {
    const {
      organization,
      project
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('edit_alert_rule.viewed', {
      organization,
      project_id: project.id,
      alert_type: this.getAlertType()
    });
  }

  getTitle() {
    const {
      ruleName
    } = this.state;
    return `${ruleName}`;
  }

  getAlertType() {
    return location.pathname.includes('/alerts/metric-rules/') ? sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleType.METRIC : sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleType.ISSUE;
  }

  render() {
    const {
      hasMetricAlerts,
      location,
      organization,
      project,
      routes
    } = this.props;
    const alertType = this.getAlertType();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_7__["default"], {
        title: this.getTitle(),
        orgSlug: organization.slug,
        projectSlug: project.slug
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.HeaderContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_alerts_builder_builderBreadCrumbs__WEBPACK_IMPORTED_MODULE_11__["default"], {
            organization: organization,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Edit Alert Rule'),
            projectSlug: project.slug,
            routes: routes,
            location: location
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Title, {
            children: this.getTitle()
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(EditConditionsBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_10__["default"], {
          provideUserTeams: true,
          children: _ref => {
            let {
              teams,
              initiallyLoaded
            } = _ref;
            return initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(!hasMetricAlerts || alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleType.ISSUE) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_alerts_rules_issue__WEBPACK_IMPORTED_MODULE_12__["default"], { ...this.props,
                project: project,
                onChangeTitle: this.handleChangeTitle,
                userTeamIds: teams.map(_ref2 => {
                  let {
                    id
                  } = _ref2;
                  return id;
                })
              }), hasMetricAlerts && alertType === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleType.METRIC && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_alerts_rules_metric_edit__WEBPACK_IMPORTED_MODULE_13__["default"], { ...this.props,
                project: project,
                onChangeTitle: this.handleChangeTitle,
                userTeamIds: teams.map(_ref3 => {
                  let {
                    id
                  } = _ref3;
                  return id;
                })
              })]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__["default"], {});
          }
        })
      })]
    });
  }

}

ProjectAlertsEditor.displayName = "ProjectAlertsEditor";

const EditConditionsBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body,  true ? {
  target: "eqr07hw0"
} : 0)( true ? {
  name: "9ap5cm",
  styles: "*:not(img){max-width:1000px;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectAlertsEditor);

/***/ }),

/***/ "./app/views/alerts/rules/metric/edit.tsx":
/*!************************************************!*\
  !*** ./app/views/alerts/rules/metric/edit.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_ruleForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/ruleForm */ "./app/views/alerts/rules/metric/ruleForm.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class MetricRulesEdit extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      const {
        router
      } = this.props;
      const {
        orgId,
        ruleId
      } = this.props.params;
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_5__.metric.endTransaction({
        name: 'saveAlertRule'
      });
      router.push({
        pathname: `/organizations/${orgId}/alerts/rules/details/${ruleId}/`
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      actions: new Map()
    };
  }

  getTitle() {
    const {
      organization,
      project
    } = this.props;
    const {
      rule
    } = this.state;
    const ruleName = rule === null || rule === void 0 ? void 0 : rule.name;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__["default"])(ruleName ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Alert %s', ruleName) : '', organization.slug, false, project === null || project === void 0 ? void 0 : project.slug);
  }

  getEndpoints() {
    const {
      orgId,
      ruleId
    } = this.props.params;
    return [['rule', `/organizations/${orgId}/alert-rules/${ruleId}/`]];
  }

  onRequestSuccess(_ref) {
    let {
      stateKey,
      data
    } = _ref;

    if (stateKey === 'rule' && data.name) {
      this.props.onChangeTitle(data.name);
    }
  }

  onLoadAllEndpointsSuccess() {
    const {
      rule
    } = this.state;

    if (rule !== null && rule !== void 0 && rule.errors) {
      ((rule === null || rule === void 0 ? void 0 : rule.errors) || []).map(_ref2 => {
        let {
          detail
        } = _ref2;
        return (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)(detail, {
          append: true
        });
      });
    }
  }

  renderError(error) {
    let disableLog = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const {
      errors
    } = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);

    if (notFound) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This alert rule could not be found.')
      });
    }

    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {
      ruleId
    } = this.props.params;
    const {
      rule
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_alerts_rules_metric_ruleForm__WEBPACK_IMPORTED_MODULE_7__["default"], { ...this.props,
      ruleId: ruleId,
      rule: rule,
      onSubmitSuccess: this.handleSubmitSuccess,
      disableProjectSelector: true
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MetricRulesEdit);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_edit_tsx.f1333caff4d8aa300940abd4c5cc8f16.js.map