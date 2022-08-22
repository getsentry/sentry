"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_apiApplications_details_tsx"],{

/***/ "./app/data/forms/apiApplication.tsx":
/*!*******************************************!*\
  !*** ./app/data/forms/apiApplication.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");


const forms = [{
  // Form "section"/"panel"
  title: 'Application Details',
  fields: [{
    name: 'name',
    type: 'string',
    required: true,
    // additional data/props that is related to rendering of form field rather than data
    label: 'Name',
    help: 'e.g. My Application',
    setValue: value => (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_1__["default"])({
      value,
      fixed: 'CI_APPLICATION_NAME'
    })
  }, {
    name: 'homepageUrl',
    type: 'string',
    required: false,
    label: 'Homepage',
    placeholder: 'e.g. https://example.com/',
    help: "An optional link to your application's homepage"
  }, {
    name: 'privacyUrl',
    type: 'string',
    label: 'Privacy Policy',
    placeholder: 'e.g. https://example.com/privacy',
    help: 'An optional link to your Privacy Policy'
  }, {
    name: 'termsUrl',
    type: 'string',
    label: 'Terms of Service',
    placeholder: 'e.g. https://example.com/terms',
    help: 'An optional link to your Terms of Service agreement'
  }]
}, {
  title: 'Security',
  fields: [{
    name: 'redirectUris',
    type: 'string',
    multiline: true,
    placeholder: 'e.g. https://example.com/oauth/complete',
    label: 'Authorized Redirect URIs',
    help: 'Separate multiple entries with a newline.',
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.convertMultilineFieldValue)(val)
  }, {
    name: 'allowedOrigins',
    type: 'string',
    multiline: true,
    placeholder: 'e.g. example.com',
    label: 'Authorized JavaScript Origins',
    help: 'Separate multiple entries with a newline.',
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.convertMultilineFieldValue)(val)
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (forms);

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

/***/ "./app/views/settings/account/apiApplications/details.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/account/apiApplications/details.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_data_forms_apiApplication__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/data/forms/apiApplication */ "./app/data/forms/apiApplication.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















class ApiApplicationsDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  getEndpoints() {
    return [['app', `/api-applications/${this.props.params.appId}/`]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Application Details');
  }

  renderBody() {
    const urlPrefix = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('urlPrefix');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
        title: this.getTitle()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__["default"], {
        apiMethod: "PUT",
        apiEndpoint: `/api-applications/${this.props.params.appId}/`,
        saveOnBlur: true,
        allowUndo: true,
        initialData: this.state.app,
        onSubmitError: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)('Unable to save change'),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_3__["default"], {
          forms: sentry_data_forms_apiApplication__WEBPACK_IMPORTED_MODULE_6__["default"]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Credentials')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelBody, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__["default"], {
              name: "clientID",
              label: "Client ID",
              children: _ref => {
                let {
                  value
                } = _ref;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__["default"], {
                    children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_9__["default"])({
                      value,
                      fixed: 'CI_CLIENT_ID'
                    })
                  })
                });
              }
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__["default"], {
              name: "clientSecret",
              label: "Client Secret",
              help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`Your secret is only available briefly after application creation. Make
                  sure to save this value!`),
              children: _ref2 => {
                let {
                  value
                } = _ref2;
                return value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_9__["default"])({
                    value,
                    fixed: 'CI_CLIENT_SECRET'
                  })
                }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("em", {
                  children: "hidden"
                });
              }
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__["default"], {
              name: "",
              label: "Authorization URL",
              children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__["default"], {
                children: `${urlPrefix}/oauth/authorize/`
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__["default"], {
              name: "",
              label: "Token URL",
              children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_4__["default"], {
                children: `${urlPrefix}/oauth/token/`
              })
            })]
          })]
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ApiApplicationsDetails);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_apiApplications_details_tsx.dfc8dd0202ae4ac528c196cd642126d2.js.map