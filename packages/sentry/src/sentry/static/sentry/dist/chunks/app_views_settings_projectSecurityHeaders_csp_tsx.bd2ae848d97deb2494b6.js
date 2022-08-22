"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectSecurityHeaders_csp_tsx"],{

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

/***/ "./app/data/forms/cspReports.tsx":
/*!***************************************!*\
  !*** ./app/data/forms/cspReports.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
// Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/csp/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'CSP Settings',
  fields: [{
    name: 'sentry:csp_ignored_sources_defaults',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Use default ignored sources'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Our default list will attempt to ignore common issues and reduce noise.'),
    getData: data => ({
      options: data
    })
  }, // XXX: Org details endpoints accept these multiline inputs as a list,
  // where as it looks like project details accepts it as a string with newlines
  {
    name: 'sentry:csp_ignored_sources',
    type: 'string',
    multiline: true,
    autosize: true,
    rows: 4,
    placeholder: 'e.g.\nfile://*\n*.example.com\nexample.com',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Additional ignored sources'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Discard reports about requests from the given sources. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Separate multiple entries with a newline.'),
    getData: data => ({
      options: data
    })
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

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

/***/ "./app/views/settings/projectSecurityHeaders/csp.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/projectSecurityHeaders/csp.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ProjectCspReports)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_previewFeature__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/previewFeature */ "./app/components/previewFeature.tsx");
/* harmony import */ var sentry_data_forms_cspReports__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/data/forms/cspReports */ "./app/data/forms/cspReports.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/projectSecurityHeaders/reportUri */ "./app/views/settings/projectSecurityHeaders/reportUri.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class ProjectCspReports extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__["default"] {
  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['keyList', `/projects/${orgId}/${projectId}/keys/`], ['project', `/projects/${orgId}/${projectId}/`]];
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_8__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Content Security Policy (CSP)'), projectId, false);
  }

  getInstructions(keyList) {
    return 'def middleware(request, response):\n' + "    response['Content-Security-Policy'] = \\\n" + '        "default-src *; " \\\n' + "        \"script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.example.com cdn.ravenjs.com; \" \\\n" + "        \"style-src 'self' 'unsafe-inline' cdn.example.com; \" \\\n" + '        "img-src * data:; " \\\n' + '        "report-uri ' + (0,sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_11__.getSecurityDsn)(keyList) + '"\n' + '    return response\n';
  }

  getReportOnlyInstructions(keyList) {
    return 'def middleware(request, response):\n' + "    response['Content-Security-Policy-Report-Only'] = \\\n" + '        "default-src \'self\'; " \\\n' + '        "report-uri ' + (0,sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_11__.getSecurityDsn)(keyList) + '"\n' + '    return response\n';
  }

  renderBody() {
    const {
      orgId,
      projectId
    } = this.props.params;
    const {
      project,
      keyList
    } = this.state;

    if (!keyList || !project) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_10__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Content Security Policy')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_previewFeature__WEBPACK_IMPORTED_MODULE_5__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_settings_projectSecurityHeaders_reportUri__WEBPACK_IMPORTED_MODULE_11__["default"], {
        keyList: keyList,
        orgId: orgId,
        projectId: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_1__["default"], {
        saveOnBlur: true,
        apiMethod: "PUT",
        initialData: project.options,
        apiEndpoint: `/projects/${orgId}/${projectId}/`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
          access: ['project:write'],
          children: _ref => {
            let {
              hasAccess
            } = _ref;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_2__["default"], {
              disabled: !hasAccess,
              forms: sentry_data_forms_cspReports__WEBPACK_IMPORTED_MODULE_6__["default"]
            });
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('About')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)(`[link:Content Security Policy]
            (CSP) is a security standard which helps prevent cross-site scripting (XSS),
            clickjacking and other code injection attacks resulting from execution of
            malicious content in the trusted web page context. It's enforced by browser
            vendors, and Sentry supports capturing CSP violations using the standard
            reporting hooks.`, {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
                href: "https://en.wikipedia.org/wiki/Content_Security_Policy"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)(`To configure [csp:CSP] reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`, {
              csp: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("abbr", {
                title: "Content Security Policy"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('For example, in Python you might achieve this via a simple web middleware')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("pre", {
            children: this.getInstructions(keyList)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`Alternatively you can setup CSP reports to simply send reports rather than
              actually enforcing the policy`)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("pre", {
            children: this.getReportOnlyInstructions(keyList)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)(`We recommend setting this up to only run on a percentage of requests, as
              otherwise you may find that you've quickly exhausted your quota. For more
              information, take a look at [link:the article on html5rocks.com].`, {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("a", {
                href: "http://www.html5rocks.com/en/tutorials/security/content-security-policy/"
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
//# sourceMappingURL=../sourcemaps/app_views_settings_projectSecurityHeaders_csp_tsx.88c34963f6fca14b34d5bf4f963c8938.js.map