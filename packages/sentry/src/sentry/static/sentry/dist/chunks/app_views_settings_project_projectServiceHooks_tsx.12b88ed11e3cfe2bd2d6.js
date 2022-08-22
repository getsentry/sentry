"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectServiceHooks_tsx"],{

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

/***/ "./app/views/settings/project/projectServiceHooks.tsx":
/*!************************************************************!*\
  !*** ./app/views/settings/project/projectServiceHooks.tsx ***!
  \************************************************************/
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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function ServiceHookRow(_ref) {
  let {
    orgId,
    projectId,
    hook,
    onToggleActive
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      "data-test-id": "project-service-hook",
      to: `/settings/${orgId}/projects/${projectId}/hooks/${hook.id}/`,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_9__["default"], {
        value: hook.url
      })
    }),
    help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("small", {
      children: hook.events && hook.events.length !== 0 ? hook.events.join(', ') : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("em", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('no events configured')
      })
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_8__["default"], {
      isActive: hook.status === 'active',
      size: "lg",
      toggle: onToggleActive
    })
  });
}

ServiceHookRow.displayName = "ServiceHookRow";

class ProjectServiceHooks extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onToggleActive", hook => {
      const {
        orgId,
        projectId
      } = this.props.params;
      const {
        hookList
      } = this.state;

      if (!hookList) {
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Saving changes\u2026'));
      this.api.request(`/projects/${orgId}/${projectId}/hooks/${hook.id}/`, {
        method: 'PUT',
        data: {
          isActive: hook.status !== 'active'
        },
        success: data => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.clearIndicators)();
          this.setState({
            hookList: hookList.map(h => {
              if (h.id === data.id) {
                return { ...h,
                  ...data
                };
              }

              return h;
            })
          });
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Unable to remove application. Please try again.'));
        }
      });
    });
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['hookList', `/projects/${orgId}/${projectId}/hooks/`]];
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('There are no service hooks associated with this project.')
    });
  }

  renderResults() {
    var _this$state$hookList;

    const {
      orgId,
      projectId
    } = this.props.params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Service Hook')
      }, "header"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelAlert, {
          type: "info",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Service Hooks are an early adopter preview feature and will change in the future.')
        }), (_this$state$hookList = this.state.hookList) === null || _this$state$hookList === void 0 ? void 0 : _this$state$hookList.map(hook => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ServiceHookRow, {
          orgId: orgId,
          projectId: projectId,
          hook: hook,
          onToggleActive: this.onToggleActive.bind(this, hook)
        }, hook.id))]
      }, "body")]
    });
  }

  renderBody() {
    const {
      hookList
    } = this.state;
    const body = hookList && hookList.length > 0 ? this.renderResults() : this.renderEmpty();
    const {
      orgId,
      projectId
    } = this.props.params;
    const access = new Set(this.props.organization.access);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Service Hooks'),
        action: access.has('project:write') ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          "data-test-id": "new-service-hook",
          to: `/settings/${orgId}/projects/${projectId}/hooks/new/`,
          size: "sm",
          priority: "primary",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconAdd, {
            size: "xs",
            isCircled: true
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create New Hook')
        }) : null
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
        children: body
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])(ProjectServiceHooks));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectServiceHooks_tsx.0ecd330ef1f818e4fe644481ef4c49d2.js.map