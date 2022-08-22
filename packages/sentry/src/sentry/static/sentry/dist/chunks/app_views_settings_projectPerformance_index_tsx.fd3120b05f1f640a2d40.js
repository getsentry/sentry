"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectPerformance_index_tsx"],{

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function routeTitleGen(routeName, orgSlug) {
  let withSentry = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let projectSlug = arguments.length > 3 ? arguments[3] : undefined;
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (routeTitleGen);

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "./app/views/settings/project/permissionAlert.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/project/permissionAlert.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const PermissionAlert = _ref => {
  let {
    access = ['project:write'],
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
    access: access,
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return !hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        ...props,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner, manager, or admin role.')
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/projectPerformance/index.tsx":
/*!*********************************************************!*\
  !*** ./app/views/settings/projectPerformance/index.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var _projectPerformance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./projectPerformance */ "./app/views/settings/projectPerformance/projectPerformance.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function ProjectPerformanceContainer(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['performance-view'],
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_projectPerformance__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props
    })
  });
}

ProjectPerformanceContainer.displayName = "ProjectPerformanceContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectPerformanceContainer);

/***/ }),

/***/ "./app/views/settings/projectPerformance/projectPerformance.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/projectPerformance/projectPerformance.tsx ***!
  \**********************************************************************/
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
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class ProjectPerformance extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      const {
        organization
      } = this.props;
      this.setState({
        loading: true
      });
      this.api.request(`/projects/${orgId}/${projectId}/transaction-threshold/configure/`, {
        method: 'DELETE',
        success: () => {
          (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_12__.trackAnalyticsEvent)({
            eventKey: 'performance_views.project_transaction_threshold.clear',
            eventName: 'Project Transaction Threshold: Cleared',
            organization_id: organization.id
          });
        },
        complete: () => this.fetchData()
      });
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Performance'), projectId, false);
  }

  getEndpoints() {
    const {
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;
    const endpoints = [['threshold', `/projects/${orgId}/${projectId}/transaction-threshold/configure/`]];
    return endpoints;
  }

  getEmptyMessage() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('There is no threshold set for this project.');
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(LoadingIndicatorContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {})
    });
  }

  get formFields() {
    const fields = [{
      name: 'metric',
      type: 'select',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Calculation Method'),
      options: [{
        value: 'duration',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Transaction Duration')
      }, {
        value: 'lcp',
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Largest Contentful Paint')
      }],
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('This determines which duration is used to set your thresholds. By default, we use transaction duration which measures the entire length of the transaction. You can also set this to use a [link:Web Vital].', {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
          href: "https://docs.sentry.io/product/performance/web-vitals/"
        })
      })
    }, {
      name: 'threshold',
      type: 'string',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Response Time Threshold (ms)'),
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('300'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Define what a satisfactory response time is based on the calculation method above. This will affect how your [link1:Apdex] and [link2:User Misery] thresholds are calculated. For example, misery will be 4x your satisfactory response time.', {
        link1: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
          href: "https://docs.sentry.io/performance-monitoring/performance/metrics/#apdex"
        }),
        link2: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
          href: "https://docs.sentry.io/product/performance/metrics/#user-misery"
        })
      })
    }];
    return fields;
  }

  get initialData() {
    const {
      threshold
    } = this.state;
    return {
      threshold: threshold.threshold,
      metric: threshold.metric
    };
  }

  renderBody() {
    const {
      organization,
      project
    } = this.props;
    const endpoint = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
    const requiredScopes = ['project:write'];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Performance')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_16__["default"], {
        access: requiredScopes
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__["default"], {
        saveOnBlur: true,
        allowUndo: true,
        initialData: this.initialData,
        apiMethod: "POST",
        apiEndpoint: endpoint,
        onSubmitSuccess: resp => {
          const initial = this.initialData;
          const changedThreshold = initial.metric === resp.metric;
          (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_12__.trackAnalyticsEvent)({
            eventKey: 'performance_views.project_transaction_threshold.change',
            eventName: 'Project Transaction Threshold: Changed',
            organization_id: organization.id,
            from: changedThreshold ? initial.threshold : initial.metric,
            to: changedThreshold ? resp.threshold : resp.metric,
            key: changedThreshold ? 'threshold' : 'metric'
          });
          this.setState({
            threshold: resp
          });
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
          access: requiredScopes,
          children: _ref => {
            let {
              hasAccess
            } = _ref;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_7__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('General'),
              fields: this.formFields,
              disabled: !hasAccess,
              renderFooter: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Actions, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  type: "button",
                  onClick: () => this.handleDelete(),
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Reset All')
                })
              })
            });
          }
        })
      })]
    });
  }

}

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelItem,  true ? {
  target: "e1ynt7f21"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

const LoadingIndicatorContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ynt7f20"
} : 0)( true ? {
  name: "lj2qtm",
  styles: "margin:18px 18px 0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectPerformance);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectPerformance_index_tsx.c18dca3f415ea80edb33f5e5f241e95f.js.map