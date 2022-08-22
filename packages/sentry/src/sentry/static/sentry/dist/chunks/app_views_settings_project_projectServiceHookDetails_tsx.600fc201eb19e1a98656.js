"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectServiceHookDetails_tsx"],{

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

/***/ "./app/views/settings/project/projectServiceHookDetails.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/project/projectServiceHookDetails.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ProjectServiceHookDetails)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_serviceHookSettingsForm__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/project/serviceHookSettingsForm */ "./app/views/settings/project/serviceHookSettingsForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















class HookStats extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  getEndpoints() {
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    const {
      hookId,
      orgId,
      projectId
    } = this.props.params;
    return [['stats', `/projects/${orgId}/${projectId}/hooks/${hookId}/stats/`, {
      query: {
        since,
        until,
        resolution: '1d'
      }
    }]];
  }

  renderBody() {
    const {
      stats
    } = this.state;

    if (stats === null) {
      return null;
    }

    let emptyStats = true;
    const series = {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Events'),
      data: stats.map(p => {
        if (p.total) {
          emptyStats = false;
        }

        return {
          name: p.ts * 1000,
          value: p.total
        };
      })
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Events in the last 30 days (by day)')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
        withPadding: true,
        children: !emptyStats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_7__["default"], {
          isGroupedByDate: true,
          showTimeInTooltip: true,
          labelYAxisExtents: true,
          series: [series],
          height: 150
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Nothing recorded in the last 30 days.'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Total webhooks fired for this configuration.')
        })
      })]
    });
  }

}

class ProjectServiceHookDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDelete", () => {
      const {
        orgId,
        projectId,
        hookId
      } = this.props.params;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Saving changes\u2026'));
      this.api.request(`/projects/${orgId}/${projectId}/hooks/${hookId}/`, {
        method: 'DELETE',
        success: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.clearIndicators)();
          react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(`/settings/${orgId}/projects/${projectId}/hooks/`);
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to remove application. Please try again.'));
        }
      });
    });
  }

  getEndpoints() {
    const {
      orgId,
      projectId,
      hookId
    } = this.props.params;
    return [['hook', `/projects/${orgId}/${projectId}/hooks/${hookId}/`]];
  }

  renderBody() {
    const {
      orgId,
      projectId,
      hookId
    } = this.props.params;
    const {
      hook
    } = this.state;

    if (!hook) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Service Hook Details')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_8__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(HookStats, {
          params: this.props.params
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_settings_project_serviceHookSettingsForm__WEBPACK_IMPORTED_MODULE_17__["default"], {
        orgId: orgId,
        projectId: projectId,
        hookId: hookId,
        initialData: { ...hook,
          isActive: hook.status !== 'disabled'
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Event Validation')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelAlert, {
            type: "info",
            showIcon: true,
            children: ["Sentry will send the ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("code", {
              children: "X-ServiceHook-Signature"
            }), " header built using", ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("code", {
              children: "HMAC(SHA256, [secret], [payload])"
            }), ". You should always verify this signature before trusting the information provided in the webhook."]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Secret'),
            flexibleControlStateSize: true,
            inline: false,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('The shared secret used for generating event HMAC signatures.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_10__["default"], {
              children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_13__["default"])({
                value: hook.secret,
                fixed: 'a dynamic secret value'
              })
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete Hook')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete Hook'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Removing this hook is immediate and permanent.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                priority: "danger",
                onClick: this.onDelete,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete Hook')
              })
            })
          })
        })]
      })]
    });
  }

}

/***/ }),

/***/ "./app/views/settings/project/serviceHookSettingsForm.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/project/serviceHookSettingsForm.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ServiceHookSettingsForm)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/apiForm */ "./app/components/forms/apiForm.tsx");
/* harmony import */ var sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/booleanField */ "./app/components/forms/booleanField.tsx");
/* harmony import */ var sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/controls/multipleCheckbox */ "./app/components/forms/controls/multipleCheckbox.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const EVENT_CHOICES = ['event.alert', 'event.created'].map(e => [e, e]);
class ServiceHookSettingsForm extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", () => {
      const {
        orgId,
        projectId
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(`/settings/${orgId}/projects/${projectId}/hooks/`);
    });
  }

  render() {
    const {
      initialData,
      orgId,
      projectId,
      hookId
    } = this.props;
    const endpoint = hookId ? `/projects/${orgId}/${projectId}/hooks/${hookId}/` : `/projects/${orgId}/${projectId}/hooks/`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__["default"], {
        apiMethod: hookId ? 'PUT' : 'POST',
        apiEndpoint: endpoint,
        initialData: initialData,
        onSubmitSuccess: this.onSubmitSuccess,
        footerStyle: {
          marginTop: 0,
          paddingRight: 20
        },
        submitLabel: hookId ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Save Changes') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Hook'),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Hook Configuration')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_booleanField__WEBPACK_IMPORTED_MODULE_5__["default"], {
            name: "isActive",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Active')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
            name: "url",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('URL'),
            required: true,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The URL which will receive events.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_7__["default"], {
            name: "events",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Events'),
            inline: false,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The event types you wish to subscribe to.'),
            children: _ref => {
              let {
                value,
                onChange
              } = _ref;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_6__["default"], {
                onChange: onChange,
                value: value,
                choices: EVENT_CHOICES
              });
            }
          })]
        })]
      })
    });
  }

}
ServiceHookSettingsForm.displayName = "ServiceHookSettingsForm";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectServiceHookDetails_tsx.f55c0ff200de1fcee61f4140852116ca.js.map