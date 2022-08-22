"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_apiNewToken_tsx"],{

/***/ "./app/views/settings/account/apiNewToken.tsx":
/*!****************************************************!*\
  !*** ./app/views/settings/account/apiNewToken.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ApiNewToken)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/apiForm */ "./app/components/forms/apiForm.tsx");
/* harmony import */ var sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/controls/multipleCheckbox */ "./app/components/forms/controls/multipleCheckbox.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const SORTED_DEFAULT_API_ACCESS_SCOPES = sentry_constants__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_API_ACCESS_SCOPES.sort();
const API_CHOICES = sentry_constants__WEBPACK_IMPORTED_MODULE_10__.API_ACCESS_SCOPES.map(s => [s, s]);
const API_INDEX_ROUTE = '/settings/account/api/auth-tokens/';
class ApiNewToken extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onCancel", () => {
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(API_INDEX_ROUTE);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", () => {
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(API_INDEX_ROUTE);
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create API Token'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create New Token')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API.")
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('For more information on how to use the web API, see our [link:documentation].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
              href: "https://docs.sentry.io/api/"
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create New Token')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__["default"], {
            apiMethod: "POST",
            apiEndpoint: "/api-tokens/",
            initialData: {
              scopes: SORTED_DEFAULT_API_ACCESS_SCOPES
            },
            onSubmitSuccess: this.onSubmitSuccess,
            onCancel: this.onCancel,
            footerStyle: {
              marginTop: 0,
              paddingRight: 20
            },
            submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Create Token'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__["default"], {
                name: "scopes",
                label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Scopes'),
                inline: false,
                required: true,
                children: _ref => {
                  let {
                    value,
                    onChange
                  } = _ref;
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    onChange: onChange,
                    value: value,
                    choices: API_CHOICES
                  });
                }
              })
            })
          })]
        })]
      })
    });
  }

}
ApiNewToken.displayName = "ApiNewToken";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_apiNewToken_tsx.94953089987443c42ce68ab14b7ec080.js.map