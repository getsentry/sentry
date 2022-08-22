(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectDebugFiles_index_tsx"],{

/***/ "./app/components/acl/role.tsx":
/*!*************************************!*\
  !*** ./app/components/acl/role.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Role": () => (/* binding */ withOrganizationRole)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");







function checkUserRole(user, organization, role) {
  var _organization$role, _organization$role2;

  if (!user) {
    return false;
  }

  if ((0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__.isActiveSuperuser)()) {
    return true;
  }

  if (!Array.isArray(organization.orgRoleList)) {
    return false;
  }

  const roleIds = organization.orgRoleList.map(r => r.id);

  if (!roleIds.includes(role) || !roleIds.includes((_organization$role = organization.role) !== null && _organization$role !== void 0 ? _organization$role : '')) {
    return false;
  }

  const requiredIndex = roleIds.indexOf(role);
  const currentIndex = roleIds.indexOf((_organization$role2 = organization.role) !== null && _organization$role2 !== void 0 ? _organization$role2 : '');
  return currentIndex >= requiredIndex;
}

function Role(_ref) {
  let {
    role,
    organization,
    children
  } = _ref;
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('user');
  const hasRole = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => checkUserRole(user, organization, role), // It seems that this returns a stable reference, but
  [organization, role, user]);

  if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__.isRenderFunc)(children)) {
    return children({
      hasRole
    });
  }

  return hasRole ? children : null;
}

const withOrganizationRole = (0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(Role);


/***/ }),

/***/ "./app/components/actions/menuItemActionLink.tsx":
/*!*******************************************************!*\
  !*** ./app/components/actions/menuItemActionLink.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/actionLink */ "./app/components/actions/actionLink.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function MenuItemActionLink(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_2__["default"], {
    noAnchor: true,
    withBorder: true,
    disabled: props.disabled,
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(InnerActionLink, { ...props
    })
  });
}

MenuItemActionLink.displayName = "MenuItemActionLink";

const InnerActionLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_actionLink__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e18s0uh10"
} : 0)("color:", p => p.theme.textColor, ";", p => p.theme.overflowEllipsis, " &:hover{color:", p => p.theme.textColor, ";}.dropdown-menu>li>&,.dropdown-menu>span>li>&{&.disabled:hover{background:", p => p.theme.background, ";}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItemActionLink);

/***/ }),

/***/ "./app/components/confirmDelete.tsx":
/*!******************************************!*\
  !*** ./app/components/confirmDelete.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const ConfirmDelete = _ref => {
  let {
    message,
    confirmInput,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    bypass: false,
    disableConfirmButton: true,
    renderMessage: _ref2 => {
      let {
        disableConfirmButton
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
          type: "error",
          children: message
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_3__["default"], {
          flexibleControlStateSize: true,
          inline: false,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Please enter %s to confirm the deletion', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("code", {
            children: confirmInput
          })),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"], {
            type: "text",
            placeholder: confirmInput,
            onChange: e => disableConfirmButton(e.target.value !== confirmInput)
          })
        })]
      });
    }
  });
};

ConfirmDelete.displayName = "ConfirmDelete";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConfirmDelete);

/***/ }),

/***/ "./app/components/notAvailable.tsx":
/*!*****************************************!*\
  !*** ./app/components/notAvailable.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function NotAvailable(_ref) {
  let {
    tooltip,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: tooltip,
    skipWrapper: true,
    disabled: tooltip === undefined,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Wrapper, {
      className: className,
      children: '\u2014'
    })
  });
}

NotAvailable.displayName = "NotAvailable";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ickyb10"
} : 0)("color:", p => p.theme.gray200, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NotAvailable);

/***/ }),

/***/ "./app/components/projects/appStoreConnectContext.tsx":
/*!************************************************************!*\
  !*** ./app/components/projects/appStoreConnectContext.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Provider": () => (/* binding */ Provider),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/appStoreValidationErrorMessage */ "./app/utils/appStoreValidationErrorMessage.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const AppStoreConnectContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);

const Provider = _ref => {
  let {
    children,
    project,
    organization
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const [projectDetails, setProjectDetails] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  const [appStoreConnectStatusData, setAppStoreConnectStatusData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const appStoreConnectSymbolSources = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return (projectDetails !== null && projectDetails !== void 0 && projectDetails.symbolSources ? JSON.parse(projectDetails.symbolSources) : []).reduce((acc, _ref2) => {
      let {
        type,
        id,
        ...symbolSource
      } = _ref2;

      if (type.toLowerCase() === 'appstoreconnect') {
        acc[id] = {
          type,
          ...symbolSource
        };
      }

      return acc;
    }, {});
  }, [projectDetails === null || projectDetails === void 0 ? void 0 : projectDetails.symbolSources]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!project || projectDetails) {
      return undefined;
    }

    if (project.symbolSources) {
      setProjectDetails(project);
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${project.slug}/`).then(responseProjectDetails => {
      if (unmounted) {
        return;
      }

      setProjectDetails(responseProjectDetails);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [project, organization, api]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!projectDetails) {
      return undefined;
    }

    if (!Object.keys(appStoreConnectSymbolSources).length) {
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${projectDetails.slug}/appstoreconnect/status/`).then(appStoreConnectStatus => {
      if (unmounted) {
        return;
      }

      setAppStoreConnectStatusData(appStoreConnectStatus);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [projectDetails, organization, appStoreConnectSymbolSources, api]);

  function getUpdateAlertMessage(respository, credentials) {
    if ((credentials === null || credentials === void 0 ? void 0 : credentials.status) === 'valid') {
      return undefined;
    }

    return (0,sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__.getAppStoreValidationErrorMessage)(credentials, respository);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(AppStoreConnectContext.Provider, {
    value: appStoreConnectStatusData && project ? Object.keys(appStoreConnectStatusData).reduce((acc, key) => {
      const appStoreConnect = appStoreConnectStatusData[key];
      return { ...acc,
        [key]: { ...appStoreConnect,
          updateAlertMessage: getUpdateAlertMessage({
            name: appStoreConnectSymbolSources[key].name,
            link: `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?customRepository=${key}`
          }, appStoreConnect.credentials)
        }
      };
    }, {}) : undefined,
    children: children
  });
};

Provider.displayName = "Provider";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AppStoreConnectContext);

/***/ }),

/***/ "./app/types/debugFiles.tsx":
/*!**********************************!*\
  !*** ./app/types/debugFiles.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CustomRepoType": () => (/* binding */ CustomRepoType),
/* harmony export */   "DebugFileFeature": () => (/* binding */ DebugFileFeature),
/* harmony export */   "DebugFileType": () => (/* binding */ DebugFileType)
/* harmony export */ });
let DebugFileType;

(function (DebugFileType) {
  DebugFileType["EXE"] = "exe";
  DebugFileType["DBG"] = "dbg";
  DebugFileType["LIB"] = "lib";
})(DebugFileType || (DebugFileType = {}));

let DebugFileFeature;

(function (DebugFileFeature) {
  DebugFileFeature["SYMTAB"] = "symtab";
  DebugFileFeature["DEBUG"] = "debug";
  DebugFileFeature["UNWIND"] = "unwind";
  DebugFileFeature["SOURCES"] = "sources";
})(DebugFileFeature || (DebugFileFeature = {}));

// Custom Repository
let CustomRepoType;

(function (CustomRepoType) {
  CustomRepoType["HTTP"] = "http";
  CustomRepoType["S3"] = "s3";
  CustomRepoType["GCS"] = "gcs";
  CustomRepoType["APP_STORE_CONNECT"] = "appStoreConnect";
})(CustomRepoType || (CustomRepoType = {}));

/***/ }),

/***/ "./app/utils/appStoreValidationErrorMessage.tsx":
/*!******************************************************!*\
  !*** ./app/utils/appStoreValidationErrorMessage.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAppStoreValidationErrorMessage": () => (/* binding */ getAppStoreValidationErrorMessage),
/* harmony export */   "unexpectedErrorMessage": () => (/* binding */ unexpectedErrorMessage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const unexpectedErrorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An unexpected error occurred while configuring the App Store Connect integration');
function getAppStoreValidationErrorMessage(error, repo) {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return repo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('App Store Connect credentials are invalid or missing. [linkToCustomRepository]', {
        linkToCustomRepository: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: repo.link,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)("Make sure the credentials of the '[customRepositoryName]' repository are correct and exist.", {
            customRepositoryName: repo.name
          })
        })
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied App Store Connect credentials are invalid or missing.');

    case 'app-connect-forbidden-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied API key does not have sufficient permissions.');

    case 'app-connect-multiple-sources-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Only one App Store Connect application is allowed in this project.');

    default:
      {
        // this shall not happen
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown app store connect error.'));
        return unexpectedErrorMessage;
      }
  }
}

/***/ }),

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./app/views/settings/projectDebugFiles/debugFileRow.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/debugFileRow.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/role */ "./app/components/acl/role.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/views/settings/projectDebugFiles/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const DebugFileRow = _ref => {
  let {
    debugFile,
    showDetails,
    downloadUrl,
    downloadRole,
    onDelete,
    orgSlug
  } = _ref;
  const {
    id,
    data,
    debugId,
    uuid,
    size,
    dateCreated,
    objectName,
    cpuName,
    symbolType,
    codeId
  } = debugFile;
  const fileType = (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getFileType)(debugFile);
  const {
    features
  } = data || {};
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Column, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DebugId, {
          children: debugId || uuid
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TimeAndSizeWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledFileSize, {
          bytes: size
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TimeWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconClock, {
            size: "xs"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__["default"], {
            date: dateCreated
          })]
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Column, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Name, {
        children: symbolType === 'proguard' && objectName === 'proguard-mapping' ? '\u2015' : objectName
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Description, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DescriptionText, {
          children: symbolType === 'proguard' && cpuName === 'any' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('proguard mapping') : `${cpuName} (${symbolType}${fileType ? ` ${fileType}` : ''})`
        }), features && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FeatureTags, {
          children: features.map(feature => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledTag, {
            tooltipText: (0,_utils__WEBPACK_IMPORTED_MODULE_15__.getFeatureTooltip)(feature),
            children: feature
          }, feature))
        }), showDetails && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: codeId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(DetailsItem, {
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Code ID'), ": ", codeId]
          })
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RightColumn, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        gap: 0.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_3__.Role, {
          role: downloadRole,
          children: _ref2 => {
            let {
              hasRole
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              disabled: hasRole,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Debug files can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.', {
                downloadRole,
                orHigher: downloadRole !== 'owner' ? ` ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('or higher')}` : '',
                settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  to: `/settings/${orgSlug}/#debugFilesRole`
                })
              }),
              isHoverable: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                size: "xs",
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDownload, {
                  size: "xs"
                }),
                href: downloadUrl,
                disabled: !hasRole,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Download')
              })
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
          access: ['project:write'],
          children: _ref3 => {
            let {
              hasAccess
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              disabled: hasAccess,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('You do not have permission to delete debug files.'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
                confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Delete'),
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Are you sure you wish to delete this file?'),
                onConfirm: () => onDelete(id),
                disabled: !hasAccess,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  priority: "danger",
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {
                    size: "xs"
                  }),
                  size: "xs",
                  disabled: !hasAccess,
                  "data-test-id": "delete-dif",
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Delete')
                })
              })
            });
          }
        })]
      })
    })]
  });
};

DebugFileRow.displayName = "DebugFileRow";

const DescriptionText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1imnv3r11"
} : 0)("display:inline-flex;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " 0;" + ( true ? "" : 0));

const FeatureTags = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r10"
} : 0)("display:inline-flex;flex-wrap:wrap;margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1imnv3r9"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";" + ( true ? "" : 0));

const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r8"
} : 0)( true ? {
  name: "6kz1wu",
  styles: "display:flex;flex-direction:column;align-items:flex-start"
} : 0);

const RightColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r7"
} : 0)("display:flex;justify-content:flex-end;align-items:flex-start;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const DebugId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "e1imnv3r6"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const TimeAndSizeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r5"
} : 0)("width:100%;display:flex;font-size:", p => p.theme.fontSizeSmall, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";color:", p => p.theme.subText, ";align-items:center;" + ( true ? "" : 0));

const StyledFileSize = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1imnv3r4"
} : 0)("flex:1;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";" + ( true ? "" : 0));

const TimeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r3"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";grid-template-columns:min-content 1fr;flex:2;align-items:center;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r1"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";@media (max-width: ", p => p.theme.breakpoints.large, "){line-height:1.7;}" + ( true ? "" : 0));

const DetailsItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1imnv3r0"
} : 0)(p => p.theme.overflowEllipsis, " margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DebugFileRow);

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/index.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/index.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _debugFileRow__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./debugFileRow */ "./app/views/settings/projectDebugFiles/debugFileRow.tsx");
/* harmony import */ var _sources__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./sources */ "./app/views/settings/projectDebugFiles/sources/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















class ProjectDebugSymbols extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_14__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", id => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.setState({
        loading: true
      });
      this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${id}`, {
        method: 'DELETE',
        complete: () => this.fetchData()
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", query => {
      const {
        location,
        router
      } = this.props;
      router.push({ ...location,
        query: { ...location.query,
          cursor: undefined,
          query
        }
      });
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Debug Files'), projectId, false);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      project: this.props.project,
      showDetails: false
    };
  }

  getEndpoints() {
    const {
      organization,
      params,
      location
    } = this.props;
    const {
      builtinSymbolSources
    } = this.state || {};
    const {
      orgId,
      projectId
    } = params;
    const {
      query
    } = location.query;
    const endpoints = [['debugFiles', `/projects/${orgId}/${projectId}/files/dsyms/`, {
      query: {
        query,
        file_formats: ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle', 'wasm', 'bcsymbolmap', 'uuidmap', 'il2cpp']
      }
    }]];

    if (!builtinSymbolSources && organization.features.includes('symbol-sources')) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/', {}]);
    }

    return endpoints;
  }

  async fetchProject() {
    const {
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;

    try {
      const updatedProject = await this.api.requestPromise(`/projects/${orgId}/${projectId}/`);
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__["default"].updateSuccess(updatedProject);
    } catch {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('An error occurred while fetching project data'));
    }
  }

  getQuery() {
    const {
      query
    } = this.props.location.query;
    return typeof query === 'string' ? query : undefined;
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('There are no debug symbols that match your search.');
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('There are no debug symbols for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderDebugFiles() {
    const {
      debugFiles,
      showDetails
    } = this.state;
    const {
      organization,
      params
    } = this.props;
    const {
      orgId,
      projectId
    } = params;

    if (!(debugFiles !== null && debugFiles !== void 0 && debugFiles.length)) {
      return null;
    }

    return debugFiles.map(debugFile => {
      const downloadUrl = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${debugFile.id}`;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_debugFileRow__WEBPACK_IMPORTED_MODULE_18__["default"], {
        debugFile: debugFile,
        showDetails: showDetails,
        downloadUrl: downloadUrl,
        downloadRole: organization.debugFilesRole,
        onDelete: this.handleDelete,
        orgSlug: organization.slug
      }, debugFile.id);
    });
  }

  renderBody() {
    var _project$builtinSymbo;

    const {
      organization,
      project,
      router,
      location
    } = this.props;
    const {
      loading,
      showDetails,
      builtinSymbolSources,
      debugFiles,
      debugFilesPageLinks
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Debug Information Files')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`
            Debug information files are used to convert addresses and minified
            function names from native crash reports into function names and
            locations.
          `)
      }), organization.features.includes('symbol-sources') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_17__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_sources__WEBPACK_IMPORTED_MODULE_19__["default"], {
          api: this.api,
          location: location,
          router: router,
          projSlug: project.slug,
          organization: organization,
          customRepositories: project.symbolSources ? JSON.parse(project.symbolSources) : [],
          builtinSymbolSources: (_project$builtinSymbo = project.builtinSymbolSources) !== null && _project$builtinSymbo !== void 0 ? _project$builtinSymbo : [],
          builtinSymbolSourceOptions: builtinSymbolSources !== null && builtinSymbolSources !== void 0 ? builtinSymbolSources : [],
          isLoading: loading
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Wrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
          noMargin: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Uploaded debug information files')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Filters, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Label, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_7__["default"], {
              checked: showDetails,
              onChange: e => {
                this.setState({
                  showDetails: e.target.checked
                });
              }
            }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('show details')]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__["default"], {
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Search DIFs'),
            onSearch: this.handleSearch,
            query: this.getQuery()
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPanelTable, {
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Debug ID'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Information'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Actions, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Actions')
        }, "actions")],
        emptyMessage: this.getEmptyMessage(),
        isEmpty: (debugFiles === null || debugFiles === void 0 ? void 0 : debugFiles.length) === 0,
        isLoading: loading,
        children: this.renderDebugFiles()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"], {
        pageLinks: debugFilesPageLinks
      })]
    });
  }

}

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelTable,  true ? {
  target: "e1l178ju4"
} : 0)( true ? {
  name: "l40ow2",
  styles: "grid-template-columns:37% 1fr auto"
} : 0);

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1l178ju3"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1l178ju2"
} : 0)("display:grid;grid-template-columns:auto 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";align-items:center;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

const Filters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1l178ju1"
} : 0)("display:grid;grid-template-columns:min-content minmax(200px, 400px);align-items:center;justify-content:flex-end;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:min-content 1fr;}" + ( true ? "" : 0));

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('label',  true ? {
  target: "e1l178ju0"
} : 0)("font-weight:normal;display:flex;margin-bottom:0;white-space:nowrap;input{margin-top:0;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectDebugSymbols);

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/builtInRepositories.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/builtInRepositories.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const SECTION_TITLE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Built-in Repositories');

function BuiltInRepositories(_ref) {
  let {
    api,
    organization,
    builtinSymbolSourceOptions,
    builtinSymbolSources,
    projSlug,
    isLoading
  } = _ref;
  // If the project details object has an unknown built-in source, this will be filtered here.
  // This prevents the UI from showing the wrong feedback message when updating the field
  const validBuiltInSymbolSources = builtinSymbolSources.filter(builtinSymbolSource => builtinSymbolSourceOptions.find(_ref2 => {
    let {
      sentry_key
    } = _ref2;
    return sentry_key === builtinSymbolSource;
  }));

  function getRequestMessages(builtinSymbolSourcesQuantity) {
    if (builtinSymbolSourcesQuantity === 0) {
      return {
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This field requires at least one built-in repository')
      };
    }

    if (builtinSymbolSourcesQuantity > validBuiltInSymbolSources.length) {
      return {
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Successfully added built-in repository'),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('An error occurred while adding new built-in repository')
      };
    }

    return {
      successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Successfully removed built-in repository'),
      errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('An error occurred while removing built-in repository')
    };
  }

  async function handleChange(value) {
    const {
      successMessage,
      errorMessage
    } = getRequestMessages((value !== null && value !== void 0 ? value : []).length);

    try {
      const updatedProjectDetails = await api.requestPromise(`/projects/${organization.slug}/${projSlug}/`, {
        method: 'PUT',
        data: {
          builtinSymbolSources: value
        }
      });
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(updatedProjectDetails);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)(successMessage);
    } catch {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errorMessage);
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
      children: SECTION_TITLE
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
      children: isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__["default"], {
        access: ['project:write'],
        children: _ref3 => {
          let {
            hasAccess
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledSelectField, {
            disabledReason: !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('You do not have permission to edit built-in repositories configurations.') : undefined,
            disabled: !hasAccess,
            name: "builtinSymbolSources",
            label: SECTION_TITLE,
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Configures which built-in repositories Sentry should use to resolve debug files.'),
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Select built-in repository'),
            value: validBuiltInSymbolSources,
            onChange: handleChange,
            options: builtinSymbolSourceOptions.filter(source => !source.hidden).map(source => ({
              value: source.sentry_key,
              label: source.name
            })),
            getValue: value => value === null ? [] : value,
            flexibleControlStateSize: true,
            multiple: true
          });
        }
      })
    })]
  });
}

BuiltInRepositories.displayName = "BuiltInRepositories";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BuiltInRepositories);

const StyledSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1wp48am0"
} : 0)(p => p.disabled && `cursor: not-allowed`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/actions.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/actions.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/actions/menuItemActionLink */ "./app/components/actions/menuItemActionLink.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirmDelete */ "./app/components/confirmDelete.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons_iconEllipsis__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons/iconEllipsis */ "./app/icons/iconEllipsis.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















function Actions(_ref) {
  let {
    repositoryName,
    repositoryType,
    disabled,
    onEdit,
    onDelete,
    hasFeature,
    hasAccess,
    syncNowButton
  } = _ref;

  function renderConfirmDelete(element) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirmDelete__WEBPACK_IMPORTED_MODULE_6__["default"], {
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete Repository'),
      message: repositoryType === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_12__.CustomRepoType.APP_STORE_CONNECT ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Removing App Store Connect symbol source does not remove current dSYMs.')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The App Store Connect symbol source periodically imports dSYMs into the "Uploaded debug information files". Removing this symbol source does not delete those files and they will remain available for symbolication until deleted directly.')
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Removing this repository applies instantly to new events.')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Debug files from this repository will not be used to symbolicate future events. This may create new issues and alert members in your organization.')
        })]
      }),
      confirmInput: repositoryName,
      priority: "danger",
      onConfirm: onDelete,
      children: element
    });
  }

  const actionsDisabled = !hasAccess || !hasFeature || disabled;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledButtonBar, {
    gap: 1,
    children: [syncNowButton, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ButtonTooltip, {
      title: !hasFeature ? undefined : !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('You do not have permission to edit custom repositories configurations.') : undefined,
      disabled: actionsDisabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ActionBtn, {
        disabled: actionsDisabled,
        onClick: onEdit,
        size: "sm",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Configure')
      })
    }), actionsDisabled ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ButtonTooltip, {
      title: !hasFeature ? undefined : !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('You do not have permission to delete custom repositories configurations.') : undefined,
      disabled: actionsDisabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ActionBtn, {
        size: "sm",
        disabled: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete')
      })
    }) : renderConfirmDelete((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ActionBtn, {
      size: "sm",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete')
    })), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(DropDownWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
        caret: false,
        disabled: actionsDisabled,
        customTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledActionButton, {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Actions'),
          disabled: actionsDisabled,
          title: !hasFeature ? undefined : !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('You do not have permission to edit and delete custom repositories configurations.') : undefined,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons_iconEllipsis__WEBPACK_IMPORTED_MODULE_9__.IconEllipsis, {})
        }),
        anchorRight: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Configure'),
          onClick: onEdit,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Configure')
        }), renderConfirmDelete((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_actions_menuItemActionLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Delete')
        }))]
      })
    })]
  });
}

Actions.displayName = "Actions";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Actions);

const StyledActionButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1md5css4"
} : 0)( true ? {
  name: "s0vnfv",
  styles: "height:32px"
} : 0);

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1md5css3"
} : 0)("gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";grid-column:2/2;grid-row:4/4;grid-auto-flow:row;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:3/3;grid-row:1/3;grid-auto-flow:column;margin-top:0;}" + ( true ? "" : 0));

const ButtonTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1md5css2"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

const ActionBtn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1md5css1"
} : 0)("width:100%;@media (min-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

const DropDownWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1md5css0"
} : 0)("display:none;@media (min-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/details.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/details.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function Details(_ref) {
  let {
    details
  } = _ref;
  const {
    latestBuildVersion,
    latestBuildNumber,
    lastCheckedBuilds
  } = details !== null && details !== void 0 ? details : {};
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Wrapper, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Last detected version'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Value, {
      children: latestBuildVersion ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('v[version]', {
        version: latestBuildVersion
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {
        tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Not available')
      })
    }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Last detected build'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Value, {
      children: latestBuildNumber !== null && latestBuildNumber !== void 0 ? latestBuildNumber : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {
        tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Not available')
      })
    }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Detected last build on'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Value, {
      children: lastCheckedBuilds ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__["default"], {
        date: lastCheckedBuilds
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {
        tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Not available')
      })
    })]
  });
}

Details.displayName = "Details";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Details);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e50haka1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";align-items:center;font-size:", p => p.theme.fontSizeSmall, ";font-weight:700;grid-column:2/-1;@media (min-width: ", p => p.theme.breakpoints.small, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";grid-row:3/3;}" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e50haka0"
} : 0)("font-weight:400;white-space:pre-wrap;word-break:break-all;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1.5), ";font-family:", p => p.theme.text.familyMono, ";background-color:", p => p.theme.backgroundSecondary, ";@media (max-width: ", p => p.theme.breakpoints.small, "){:not(:last-child){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/index.tsx":
/*!***********************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/index.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var _repository__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./repository */ "./app/views/settings/projectDebugFiles/sources/customRepositories/repository.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/settings/projectDebugFiles/sources/customRepositories/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
























const SECTION_TITLE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Custom Repositories');

function CustomRepositories(_ref) {
  let {
    api,
    organization,
    customRepositories: repositories,
    projSlug,
    router,
    location,
    isLoading
  } = _ref;
  const appStoreConnectContext = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_14__["default"]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    openDebugFileSourceDialog();
  }, [location.query, appStoreConnectContext]);
  const orgSlug = organization.slug;
  const appStoreConnectSourcesQuantity = repositories.filter(repository => repository.type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_17__.CustomRepoType.APP_STORE_CONNECT).length;

  function openDebugFileSourceDialog() {
    const {
      customRepository
    } = location.query;

    if (!customRepository) {
      return;
    }

    const itemIndex = repositories.findIndex(repository => repository.id === customRepository);
    const item = repositories[itemIndex];

    if (!item) {
      return;
    }

    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openDebugFileSourceModal)({
      organization,
      sourceConfig: item,
      sourceType: item.type,
      appStoreConnectSourcesQuantity,
      appStoreConnectStatusData: appStoreConnectContext === null || appStoreConnectContext === void 0 ? void 0 : appStoreConnectContext[item.id],
      onSave: updatedItem => persistData({
        updatedItem: updatedItem,
        index: itemIndex
      }),
      onClose: handleCloseModal
    });
  }

  function persistData(_ref2) {
    let {
      updatedItems,
      updatedItem,
      index,
      refresh
    } = _ref2;
    let items = updatedItems !== null && updatedItems !== void 0 ? updatedItems : [];

    if (updatedItem && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(index)) {
      items = [...repositories];
      items.splice(index, 1, updatedItem);
    }

    const {
      successMessage,
      errorMessage
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getRequestMessages)(items.length, repositories.length);
    const symbolSources = JSON.stringify(items.map(_utils__WEBPACK_IMPORTED_MODULE_21__.expandKeys));
    const promise = api.requestPromise(`/projects/${orgSlug}/${projSlug}/`, {
      method: 'PUT',
      data: {
        symbolSources
      }
    });
    promise.catch(() => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(errorMessage);
    });
    promise.then(result => {
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(result);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)(successMessage);

      if (refresh) {
        window.location.reload();
      }
    });
    return promise;
  }

  function handleCloseModal() {
    router.push({ ...location,
      query: { ...location.query,
        customRepository: undefined
      }
    });
  }

  function handleAddRepository(repoType) {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openDebugFileSourceModal)({
      organization,
      appStoreConnectSourcesQuantity,
      sourceType: repoType,
      onSave: updatedData => persistData({
        updatedItems: [...repositories, updatedData]
      })
    });
  }

  function handleDeleteRepository(repoId) {
    const newRepositories = [...repositories];
    const index = newRepositories.findIndex(item => item.id === repoId);
    newRepositories.splice(index, 1);
    persistData({
      updatedItems: newRepositories,
      refresh: repositories[index].type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_17__.CustomRepoType.APP_STORE_CONNECT
    });
  }

  function handleEditRepository(repoId) {
    router.push({ ...location,
      query: { ...location.query,
        customRepository: repoId
      }
    });
  }

  async function handleSyncRepositoryNow(repoId) {
    try {
      await api.requestPromise(`/projects/${orgSlug}/${projSlug}/appstoreconnect/${repoId}/refresh/`, {
        method: 'POST'
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Repository sync started.'));
    } catch (error) {
      const errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Rate limit for refreshing repository exceeded. Try again in a few minutes.');
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(errorMessage);
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_19__["default"])(errorMessage)(error);
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_7__["default"], {
    features: ['custom-symbol-sources'],
    organization: organization,
    children: _ref3 => {
      let {
        hasFeature
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__["default"], {
        access: ['project:write'],
        children: _ref4 => {
          let {
            hasAccess
          } = _ref4;
          const addRepositoryButtonDisabled = !hasAccess || isLoading;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
              hasButtons: true,
              children: [SECTION_TITLE, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_15__["default"], {
                title: !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('You do not have permission to add custom repositories.') : undefined,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  alignMenu: "right",
                  disabled: addRepositoryButtonDisabled,
                  onSelect: item => handleAddRepository(item.value),
                  items: _utils__WEBPACK_IMPORTED_MODULE_21__.dropDownItems.map(dropDownItem => ({ ...dropDownItem,
                    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(DropDownLabel, {
                      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Open %s custom repository modal', dropDownItem.label),
                      children: dropDownItem.label
                    })
                  })),
                  children: _ref5 => {
                    let {
                      isOpen
                    } = _ref5;
                    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      isOpen: isOpen,
                      disabled: addRepositoryButtonDisabled,
                      size: "sm",
                      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Repository'),
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Add Repository')
                    });
                  }
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
              children: isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {}) : !repositories.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_10__["default"], {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("p", {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No custom repositories configured')
                })
              }) : repositories.map((repository, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_repository__WEBPACK_IMPORTED_MODULE_20__["default"], {
                repository: repository.type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_17__.CustomRepoType.APP_STORE_CONNECT ? { ...repository,
                  details: appStoreConnectContext === null || appStoreConnectContext === void 0 ? void 0 : appStoreConnectContext[repository.id]
                } : repository,
                hasFeature: repository.type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_17__.CustomRepoType.APP_STORE_CONNECT ? hasFeature || appStoreConnectSourcesQuantity === 1 : hasFeature,
                hasAccess: hasAccess,
                onDelete: handleDeleteRepository,
                onEdit: handleEditRepository,
                onSyncNow: handleSyncRepositoryNow
              }, index))
            })]
          });
        }
      });
    }
  });
}

CustomRepositories.displayName = "CustomRepositories";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CustomRepositories);

const DropDownLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "el5qoxx0"
} : 0)("color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeMedium, ";font-weight:400;text-transform:none;span{padding:0;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/repository.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/repository.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons/iconChevron */ "./app/icons/iconChevron.tsx");
/* harmony import */ var sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconRefresh */ "./app/icons/iconRefresh.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");
/* harmony import */ var _actions__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./actions */ "./app/views/settings/projectDebugFiles/sources/customRepositories/actions.tsx");
/* harmony import */ var _details__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./details */ "./app/views/settings/projectDebugFiles/sources/customRepositories/details.tsx");
/* harmony import */ var _status__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./status */ "./app/views/settings/projectDebugFiles/sources/customRepositories/status.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./utils */ "./app/views/settings/projectDebugFiles/sources/customRepositories/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















function Repository(_ref) {
  let {
    repository,
    onSyncNow,
    onDelete,
    onEdit,
    hasFeature,
    hasAccess
  } = _ref;
  const [isDetailsExpanded, setIsDetailsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const {
    id,
    name,
    type
  } = repository;

  if (repository.type === sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_9__.CustomRepoType.APP_STORE_CONNECT) {
    var _repository$details;

    const authenticated = ((_repository$details = repository.details) === null || _repository$details === void 0 ? void 0 : _repository$details.credentials.status) !== 'invalid';
    const detailsAvailable = repository.details !== undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledPanelItem, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ToggleDetails, {
        size: "sm",
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Toggle details'),
        onClick: () => detailsAvailable ? setIsDetailsExpanded(!isDetailsExpanded) : undefined,
        direction: isDetailsExpanded ? 'down' : 'up'
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Name, {
        children: name
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(TypeAndStatus, {
        children: [_utils__WEBPACK_IMPORTED_MODULE_13__.customRepoTypeLabel[type], (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_status__WEBPACK_IMPORTED_MODULE_12__["default"], {
          details: repository.details,
          onEditRepository: () => onEdit(id)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_10__["default"], {
        repositoryName: name,
        repositoryType: type,
        hasFeature: hasFeature,
        hasAccess: hasAccess,
        onDelete: () => onDelete(id),
        onEdit: () => onEdit(id),
        disabled: repository.details === undefined,
        syncNowButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          size: "sm",
          onClick: () => onSyncNow(id),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_6__.IconRefresh, {}),
          disabled: !detailsAvailable || !authenticated || !hasFeature || !hasAccess,
          title: !hasFeature ? undefined : !hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('You do not have permission to edit custom repositories configurations.') : !authenticated ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Authentication is required before this repository can sync with App Store Connect.') : undefined,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sync Now')
        })
      }), isDetailsExpanded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_details__WEBPACK_IMPORTED_MODULE_11__["default"], {
        details: repository.details
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledPanelItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Name, {
      children: name
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(TypeAndStatus, {
      children: _utils__WEBPACK_IMPORTED_MODULE_13__.customRepoTypeLabel[type]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_10__["default"], {
      repositoryName: name,
      repositoryType: type,
      hasFeature: hasFeature,
      hasAccess: hasAccess,
      onDelete: () => onDelete(id),
      onEdit: () => onEdit(id)
    })]
  });
}

Repository.displayName = "Repository";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Repository);

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem,  true ? {
  target: "egeeyr43"
} : 0)("display:grid;align-items:flex-start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";grid-template-columns:max-content 1fr;@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:max-content 1fr max-content;}" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egeeyr42"
} : 0)("grid-column:2/2;@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:2/3;grid-row:1/2;}" + ( true ? "" : 0));

const TypeAndStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egeeyr41"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";display:flex;flex-wrap:wrap;align-items:center;grid-column:2/2;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-column:2/3;grid-row:2/2;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

const ToggleDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons_iconChevron__WEBPACK_IMPORTED_MODULE_5__.IconChevron,  true ? {
  target: "egeeyr40"
} : 0)( true ? {
  name: "e0dnmk",
  styles: "cursor:pointer"
} : 0);

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/status.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/status.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons_iconDownload__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons/iconDownload */ "./app/icons/iconDownload.tsx");
/* harmony import */ var sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons/iconRefresh */ "./app/icons/iconRefresh.tsx");
/* harmony import */ var sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons/iconWarning */ "./app/icons/iconWarning.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function Status(_ref) {
  let {
    details,
    onEditRepository
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.a)();

  if (!details) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_1__["default"], {
      height: "14px"
    });
  }

  const {
    pendingDownloads,
    credentials,
    lastCheckedBuilds
  } = details;

  if (credentials.status === 'invalid') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
      color: theme.red300,
      onClick: onEditRepository,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTooltip, {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Re-check your App Store Credentials'),
        containerDisplayMode: "inline-flex",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_6__.IconWarning, {
          size: "sm"
        })
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Authentication required')]
    });
  }

  if (pendingDownloads) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
      color: theme.gray400,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons_iconDownload__WEBPACK_IMPORTED_MODULE_4__.IconDownload, {
          size: "sm"
        })
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('%s build pending', '%s builds pending', pendingDownloads)]
    });
  }

  if (lastCheckedBuilds) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
      color: theme.gray400,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons_iconRefresh__WEBPACK_IMPORTED_MODULE_5__.IconRefresh, {
          size: "sm"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__["default"], {
        date: lastCheckedBuilds
      })]
    });
  }

  return null;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Status);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1i2rm1x2"
} : 0)("display:grid;grid-template-columns:repeat(2, max-content);align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";color:", p => p.color, ";font-size:", p => p.theme.fontSizeMedium, ";height:14px;", p => p.onClick && `cursor: pointer`, ";" + ( true ? "" : 0));

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1i2rm1x1"
} : 0)( true ? {
  name: "m44gc5",
  styles: "margin-top:-5px;height:14px"
} : 0);

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1i2rm1x0"
} : 0)( true ? {
  name: "m44gc5",
  styles: "margin-top:-5px;height:14px"
} : 0);

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/customRepositories/utils.tsx":
/*!***********************************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/customRepositories/utils.tsx ***!
  \***********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "customRepoTypeLabel": () => (/* binding */ customRepoTypeLabel),
/* harmony export */   "dropDownItems": () => (/* binding */ dropDownItems),
/* harmony export */   "expandKeys": () => (/* binding */ expandKeys),
/* harmony export */   "getRequestMessages": () => (/* binding */ getRequestMessages)
/* harmony export */ });
/* harmony import */ var lodash_forEach__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/forEach */ "../node_modules/lodash/forEach.js");
/* harmony import */ var lodash_forEach__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_forEach__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");




const customRepoTypeLabel = {
  [sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.APP_STORE_CONNECT]: 'App Store Connect',
  [sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.HTTP]: 'SymbolServer (HTTP)',
  [sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.S3]: 'Amazon S3',
  [sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.GCS]: 'Google Cloud Storage'
};
const dropDownItems = [{
  value: sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.S3,
  label: customRepoTypeLabel[sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.S3],
  searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('aws amazon s3 bucket')
}, {
  value: sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.GCS,
  label: customRepoTypeLabel[sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.GCS],
  searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('gcs google cloud storage bucket')
}, {
  value: sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.HTTP,
  label: customRepoTypeLabel[sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.HTTP],
  searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('http symbol server ssqp symstore symsrv')
}, {
  value: sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.APP_STORE_CONNECT,
  label: customRepoTypeLabel[sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_3__.CustomRepoType.APP_STORE_CONNECT],
  searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('apple store connect itunes ios')
}];
function getRequestMessages(updatedRepositoriesQuantity, repositoriesQuantity) {
  if (updatedRepositoriesQuantity > repositoriesQuantity) {
    return {
      successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Successfully added custom repository'),
      errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An error occurred while adding a new custom repository')
    };
  }

  if (updatedRepositoriesQuantity < repositoriesQuantity) {
    return {
      successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Successfully removed custom repository'),
      errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An error occurred while removing the custom repository')
    };
  }

  return {
    successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Successfully updated custom repository'),
    errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An error occurred while updating the custom repository')
  };
}
function expandKeys(obj) {
  const result = {};
  lodash_forEach__WEBPACK_IMPORTED_MODULE_0___default()(obj, (value, key) => {
    lodash_set__WEBPACK_IMPORTED_MODULE_1___default()(result, key.split('.'), value);
  });
  return result;
}

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/sources/index.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/sources/index.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _builtInRepositories__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./builtInRepositories */ "./app/views/settings/projectDebugFiles/sources/builtInRepositories.tsx");
/* harmony import */ var _customRepositories__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./customRepositories */ "./app/views/settings/projectDebugFiles/sources/customRepositories/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function Sources(_ref) {
  let {
    api,
    organization,
    customRepositories,
    builtinSymbolSources,
    builtinSymbolSourceOptions,
    projSlug,
    location,
    router,
    isLoading
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_builtInRepositories__WEBPACK_IMPORTED_MODULE_1__["default"], {
      api: api,
      organization: organization,
      builtinSymbolSources: builtinSymbolSources,
      builtinSymbolSourceOptions: builtinSymbolSourceOptions,
      projSlug: projSlug,
      isLoading: isLoading
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_customRepositories__WEBPACK_IMPORTED_MODULE_2__["default"], {
      api: api,
      location: location,
      router: router,
      organization: organization,
      customRepositories: customRepositories,
      projSlug: projSlug,
      isLoading: isLoading
    })]
  });
}

Sources.displayName = "Sources";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Sources);

/***/ }),

/***/ "./app/views/settings/projectDebugFiles/utils.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/projectDebugFiles/utils.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFeatureTooltip": () => (/* binding */ getFeatureTooltip),
/* harmony export */   "getFileType": () => (/* binding */ getFileType)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/types/debugFiles */ "./app/types/debugFiles.tsx");


function getFileType(dsym) {
  var _dsym$data;

  switch ((_dsym$data = dsym.data) === null || _dsym$data === void 0 ? void 0 : _dsym$data.type) {
    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.EXE:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('executable');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.DBG:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('debug companion');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileType.LIB:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('dynamic library');

    default:
      return null;
  }
}
function getFeatureTooltip(feature) {
  switch (feature) {
    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.SYMTAB:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Symbol tables are used as a fallback when full debug information is not available');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.DEBUG:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Debug information provides function names and resolves inlined frames during symbolication');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.UNWIND:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stack unwinding information improves the quality of stack traces extracted from minidumps');

    case sentry_types_debugFiles__WEBPACK_IMPORTED_MODULE_1__.DebugFileFeature.SOURCES:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Source code information allows Sentry to display source code context for stack frames');

    default:
      return null;
  }
}

/***/ }),

/***/ "../node_modules/lodash/_castFunction.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_castFunction.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var identity = __webpack_require__(/*! ./identity */ "../node_modules/lodash/identity.js");

/**
 * Casts `value` to `identity` if it's not a function.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Function} Returns cast function.
 */
function castFunction(value) {
  return typeof value == 'function' ? value : identity;
}

module.exports = castFunction;


/***/ }),

/***/ "../node_modules/lodash/forEach.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/forEach.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayEach = __webpack_require__(/*! ./_arrayEach */ "../node_modules/lodash/_arrayEach.js"),
    baseEach = __webpack_require__(/*! ./_baseEach */ "../node_modules/lodash/_baseEach.js"),
    castFunction = __webpack_require__(/*! ./_castFunction */ "../node_modules/lodash/_castFunction.js"),
    isArray = __webpack_require__(/*! ./isArray */ "../node_modules/lodash/isArray.js");

/**
 * Iterates over elements of `collection` and invokes `iteratee` for each element.
 * The iteratee is invoked with three arguments: (value, index|key, collection).
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length"
 * property are iterated like arrays. To avoid this behavior use `_.forIn`
 * or `_.forOwn` for object iteration.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @alias each
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 * @see _.forEachRight
 * @example
 *
 * _.forEach([1, 2], function(value) {
 *   console.log(value);
 * });
 * // => Logs `1` then `2`.
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
 *   console.log(key);
 * });
 * // => Logs 'a' then 'b' (iteration order is not guaranteed).
 */
function forEach(collection, iteratee) {
  var func = isArray(collection) ? arrayEach : baseEach;
  return func(collection, castFunction(iteratee));
}

module.exports = forEach;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectDebugFiles_index_tsx.a8ddb5429ef34274fd36c5f508e8b25f.js.map