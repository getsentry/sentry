"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectSecurityHeaders_hpkp_tsx"],{

/***/ "./app/components/previewFeature.tsx":
/*!*******************************************!*\
  !*** ./app/components/previewFeature.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const PreviewFeature = _ref => {
  let {
    type = 'info'
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__["default"], {
    type: type,
    showIcon: true,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This feature is a preview and may change in the future. Thanks for being an early adopter!')
  });
};

PreviewFeature.displayName = "PreviewFeature";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PreviewFeature);

/***/ }),

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

/***/ "./app/views/settings/projectSecurityHeaders/hpkp.tsx":
/*!************************************************************!*\
  !*** ./app/views/settings/projectSecurityHeaders/hpkp.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ProjectHpkpReports)
/* harmony export */ });
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_previewFeature__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/previewFeature */ "./app/components/previewFeature.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/projectSecurityHeaders/reportUri */ "./app/views/settings/projectSecurityHeaders/reportUri.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class ProjectHpkpReports extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__["default"] {
  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`]];
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_4__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('HTTP Public Key Pinning (HPKP)'), projectId, false);
  }

  getInstructions(keyList) {
    return 'def middleware(request, response):\n' + "    response['Public-Key-Pins'] = \\\n" + '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' + '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' + "        'max-age=5184000; includeSubDomains; ' \\\n" + `        \'report-uri="${(0,sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__.getSecurityDsn)(keyList)}"\' \n` + '    return response\n';
  }

  getReportOnlyInstructions(keyList) {
    return 'def middleware(request, response):\n' + "    response['Public-Key-Pins-Report-Only'] = \\\n" + '        \'pin-sha256="cUPcTAZWKaASuYWhhneDttWpY3oBAkE3h2+soZS7sWs="; \' \\\n' + '        \'pin-sha256="M8HztCzM3elUxkcjR2S5P4hhyBNf6lHkmjAHKhpGPWE="; \' \\\n' + "        'max-age=5184000; includeSubDomains; ' \\\n" + `        \'report-uri="${(0,sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__.getSecurityDsn)(keyList)}"\' \n` + '    return response\n';
  }

  renderBody() {
    const {
      params
    } = this.props;
    const {
      keyList
    } = this.state;

    if (!keyList) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_6__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('HTTP Public Key Pinning')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_previewFeature__WEBPACK_IMPORTED_MODULE_2__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__["default"], {
        keyList: keyList,
        orgId: params.orgId,
        projectId: params.projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('About')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)(`[link:HTTP Public Key Pinning]
              (HPKP) is a security feature that tells a web client to associate a specific
              cryptographic public key with a certain web server to decrease the risk of MITM
              attacks with forged certificates. It's enforced by browser vendors, and Sentry
              supports capturing violations using the standard reporting hooks.`, {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
                href: "https://en.wikipedia.org/wiki/HTTP_Public_Key_Pinning"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`To configure HPKP reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('For example, in Python you might achieve this via a simple web middleware')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("pre", {
            children: this.getInstructions(keyList)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`Alternatively you can setup HPKP reports to simply send reports rather than
              actually enforcing the policy`)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("pre", {
            children: this.getReportOnlyInstructions(keyList)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)(`We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the documentation on MDN].`, {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("a", {
                href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning"
              })
            })
          })]
        })]
      })]
    });
  }

}

/***/ }),

/***/ "./app/views/settings/projectSecurityHeaders/reportUri.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/settings/projectSecurityHeaders/reportUri.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ReportUri),
/* harmony export */   "getSecurityDsn": () => (/* binding */ getSecurityDsn)
/* harmony export */ });
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const DEFAULT_ENDPOINT = 'https://sentry.example.com/api/security-report/';
function getSecurityDsn(keyList) {
  const endpoint = keyList.length ? keyList[0].dsn.security : DEFAULT_ENDPOINT;
  return (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_5__["default"])({
    value: endpoint,
    fixed: DEFAULT_ENDPOINT
  });
}
function ReportUri(_ref) {
  let {
    keyList,
    orgId,
    projectId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Report URI')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelAlert, {
        type: "info",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)("We've automatically pulled these credentials from your available [link:Client Keys]", {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
            to: `/settings/${orgId}/projects/${projectId}/keys/`
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_0__["default"], {
        inline: false,
        flexibleControlStateSize: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_1__["default"], {
          children: getSecurityDsn(keyList)
        })
      })]
    })]
  });
}
ReportUri.displayName = "ReportUri";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectSecurityHeaders_hpkp_tsx.339997283e77032d9cf80a92bbe6cbb0.js.map