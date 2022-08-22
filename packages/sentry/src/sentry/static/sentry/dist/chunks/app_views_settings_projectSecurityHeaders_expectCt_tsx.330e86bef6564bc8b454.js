"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectSecurityHeaders_expectCt_tsx"],{

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

/***/ "./app/views/settings/projectSecurityHeaders/expectCt.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/projectSecurityHeaders/expectCt.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ProjectExpectCtReports)
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










class ProjectExpectCtReports extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__["default"] {
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
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_4__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Certificate Transparency (Expect-CT)'), projectId, false);
  }

  getInstructions(keyList) {
    return `Expect-CT: report-uri="${(0,sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__.getSecurityDsn)(keyList)}"`;
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
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Certificate Transparency')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_previewFeature__WEBPACK_IMPORTED_MODULE_2__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_7__["default"], {
        keyList: keyList,
        orgId: params.orgId,
        projectId: params.orgId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
          children: 'About'
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)(`[link:Certificate Transparency]
      (CT) is a security standard which helps track and identify valid certificates, allowing identification of maliciously issued certificates`, {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
                href: "https://en.wikipedia.org/wiki/Certificate_Transparency"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)("To configure reports in Sentry, you'll need to configure the [header] a header from your server:", {
              header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("code", {
                children: "Expect-CT"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("pre", {
            children: this.getInstructions(keyList)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('For more information, see [link:the article on MDN].', {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("a", {
                href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect-CT"
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
//# sourceMappingURL=../sourcemaps/app_views_settings_projectSecurityHeaders_expectCt_tsx.d6dd8e8e8e8aed30492ece98cacd5642.js.map