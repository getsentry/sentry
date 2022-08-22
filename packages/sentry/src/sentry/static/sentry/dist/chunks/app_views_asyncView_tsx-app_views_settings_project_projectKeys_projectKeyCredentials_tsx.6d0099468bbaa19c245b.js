"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_asyncView_tsx-app_views_settings_project_projectKeys_projectKeyCredentials_tsx"],{

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

/***/ "./app/views/settings/project/projectKeys/projectKeyCredentials.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/settings/project/projectKeys/projectKeyCredentials.tsx ***!
  \**************************************************************************/
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
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const DEFAULT_PROPS = {
  showDsn: true,
  showDsnPublic: true,
  showSecurityEndpoint: true,
  showMinidump: true,
  showUnreal: true,
  showPublicKey: false,
  showSecretKey: false,
  showProjectId: false
};

class ProjectKeyCredentials extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showDeprecatedDsn: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleDeprecatedDsn", () => {
      this.setState(state => ({
        showDeprecatedDsn: !state.showDeprecatedDsn
      }));
    });
  }

  render() {
    const {
      showDeprecatedDsn
    } = this.state;
    const {
      projectId,
      data,
      showDsn,
      showDsnPublic,
      showSecurityEndpoint,
      showMinidump,
      showUnreal,
      showPublicKey,
      showSecretKey,
      showProjectId
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [showDsnPublic && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('DSN'),
        inline: false,
        flexibleControlStateSize: true,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('The DSN tells the SDK where to send the events to. [link]', {
          link: showDsn ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
            to: "",
            onClick: this.toggleDeprecatedDsn,
            children: showDeprecatedDsn ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Hide deprecated DSN') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Show deprecated DSN')
          }) : null
        }),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.dsn.public,
            fixed: '__DSN__'
          })
        }), showDeprecatedDsn && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledField, {
          label: null,
          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Deprecated DSN includes a secret which is no longer required by newer SDK versions. If you are unsure which to use, follow installation instructions for your language.'),
          inline: false,
          flexibleControlStateSize: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
            children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
              value: data.dsn.secret,
              fixed: '__DSN_DEPRECATED__'
            })
          })
        })]
      }), !showDsnPublic && showDsn && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('DSN (Deprecated)'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Deprecated DSN includes a secret which is no longer required by newer SDK versions. If you are unsure which to use, follow installation instructions for your language.'),
        inline: false,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.dsn.secret,
            fixed: '__DSN_DEPRECATED__'
          })
        })
      }), showSecurityEndpoint && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Security Header Endpoint'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Use your security header endpoint for features like CSP and Expect-CT reports.'),
        inline: false,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.dsn.security,
            fixed: '__SECURITY_HEADER_ENDPOINT__'
          })
        })
      }), showMinidump && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Minidump Endpoint'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Use this endpoint to upload [link], for example with Electron, Crashpad or Breakpad.', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
            href: "https://docs.sentry.io/platforms/native/guides/minidumps/",
            children: "minidump crash reports"
          })
        }),
        inline: false,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.dsn.minidump,
            fixed: '__MINIDUMP_ENDPOINT__'
          })
        })
      }), showUnreal && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unreal Engine 4 Endpoint'),
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Use this endpoint to configure your UE4 Crash Reporter.'),
        inline: false,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.dsn.unreal || '',
            fixed: '__UNREAL_ENDPOINT__'
          })
        })
      }), showPublicKey && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Public Key'),
        inline: true,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.public,
            fixed: '__PUBLICKEY__'
          })
        })
      }), showSecretKey && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Secret Key'),
        inline: true,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: data.secret,
            fixed: '__SECRETKEY__'
          })
        })
      }), showProjectId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Project ID'),
        inline: true,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_5__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
            value: projectId,
            fixed: '__PROJECTID__'
          })
        })
      })]
    });
  }

}

ProjectKeyCredentials.displayName = "ProjectKeyCredentials";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ProjectKeyCredentials, "defaultProps", DEFAULT_PROPS);

const StyledField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "exezfd10"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), " 0 0 0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectKeyCredentials);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_asyncView_tsx-app_views_settings_project_projectKeys_projectKeyCredentials_tsx.02b097621efd8b0eb73b2d031a206c30.js.map