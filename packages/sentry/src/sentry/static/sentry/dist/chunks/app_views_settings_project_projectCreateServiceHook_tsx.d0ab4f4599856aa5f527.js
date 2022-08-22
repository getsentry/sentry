"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectCreateServiceHook_tsx"],{

/***/ "./app/views/settings/project/projectCreateServiceHook.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/settings/project/projectCreateServiceHook.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_serviceHookSettingsForm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/project/serviceHookSettingsForm */ "./app/views/settings/project/serviceHookSettingsForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function ProjectCreateServiceHook(_ref) {
  let {
    params
  } = _ref;
  const {
    orgId,
    projectId
  } = params;
  const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Create Service Hook');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: title,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_3__["default"], {
        title: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_project_serviceHookSettingsForm__WEBPACK_IMPORTED_MODULE_4__["default"], {
        orgId: orgId,
        projectId: projectId,
        initialData: {
          events: [],
          isActive: true
        }
      })]
    })
  });
}

ProjectCreateServiceHook.displayName = "ProjectCreateServiceHook";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectCreateServiceHook);

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
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectCreateServiceHook_tsx.91eb57d0cf6e3b0fa5cc83458ff49c71.js.map