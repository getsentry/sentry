"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectGeneralSettings_tsx"],{

/***/ "./app/data/forms/projectGeneralSettings.tsx":
/*!***************************************************!*\
  !*** ./app/data/forms/projectGeneralSettings.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/Select-9fdb8cd0.browser.esm.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








 // Export route to make these forms searchable by label/help



const route = '/settings/:orgId/projects/:projectId/';

const getResolveAgeAllowedValues = () => {
  let i = 0;
  const values = [];

  while (i <= 720) {
    values.push(i);

    if (i < 12) {
      i += 1;
    } else if (i < 24) {
      i += 3;
    } else if (i < 36) {
      i += 6;
    } else if (i < 48) {
      i += 12;
    } else {
      i += 24;
    }
  }

  return values;
};

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();
const ORG_DISABLED_REASON = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("This option is enforced by your organization's settings and cannot be customized per-project.");

const PlatformWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "er783381"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_1__.PlatformIcon,  true ? {
  target: "er783380"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const fields = {
  name: {
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Name'),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('my-awesome-project'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('A name for this project'),
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_7__["default"],
    getData: data => {
      return {
        name: data.name,
        slug: data.name
      };
    },
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('You will be redirected to the new project slug after saving')
  },
  platform: {
    name: 'platform',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Platform'),
    options: sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__["default"].map(_ref => {
      let {
        id,
        name
      } = _ref;
      return {
        value: id,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(PlatformWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledPlatformIcon, {
            platform: id
          }), name]
        }, id)
      };
    }),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The primary platform for this project'),
    filterOption: (0,react_select__WEBPACK_IMPORTED_MODULE_9__.c)({
      stringify: option => {
        const matchedPlatform = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__["default"].find(_ref2 => {
          let {
            id
          } = _ref2;
          return id === option.value;
        });
        return `${matchedPlatform === null || matchedPlatform === void 0 ? void 0 : matchedPlatform.name} ${option.value}`;
      }
    })
  },
  subjectPrefix: {
    name: 'subjectPrefix',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Subject Prefix'),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('e.g. [my-org]'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Choose a custom prefix for emails from this project')
  },
  resolveAge: {
    name: 'resolveAge',
    type: 'range',
    allowedValues: RESOLVE_AGE_ALLOWED_VALUES,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Auto Resolve'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("Automatically resolve an issue if it hasn't been seen for this amount of time"),
    formatLabel: val => {
      val = Number(val);

      if (val === 0) {
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Disabled');
      }

      if (val > 23 && val % 24 === 0) {
        // Based on allowed values, val % 24 should always be true
        val = val / 24;
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tn)('%s day', '%s days', val);
      }

      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tn)('%s hour', '%s hours', val);
    },
    saveOnBlur: false,
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[Caution]: Enabling auto resolve will immediately resolve anything that has ' + 'not been seen within this period of time. There is no undo!', {
      Caution: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("strong", {
        children: "Caution"
      })
    }),
    saveMessageAlertType: 'warning'
  },
  allowedDomains: {
    name: 'allowedDomains',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('https://example.com or example.com'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allowed Domains'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.convertMultilineFieldValue)(val)
  },
  scrapeJavaScript: {
    name: 'scrapeJavaScript',
    type: 'boolean',
    // if this is off for the organization, it cannot be enabled for the project
    disabled: _ref3 => {
      let {
        organization,
        name
      } = _ref3;
      return !organization[name];
    },
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] && val,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Enable JavaScript source fetching'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allow Sentry to scrape missing JavaScript source context when possible')
  },
  securityToken: {
    name: 'securityToken',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Security Token'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'),
    setValue: value => (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_6__["default"])({
      value,
      fixed: '__SECURITY_TOKEN__'
    })
  },
  securityTokenHeader: {
    name: 'securityTokenHeader',
    type: 'string',
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('X-Sentry-Token'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Security Token Header'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended')
  },
  verifySSL: {
    name: 'verifySSL',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Verify TLS/SSL'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests will verify TLS (sometimes known as SSL) connections')
  }
};

/***/ }),

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

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

/***/ "./app/utils/slugify.tsx":
/*!*******************************!*\
  !*** ./app/utils/slugify.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ slugify)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);

// XXX: This is NOT an exhaustive slugify function
// Only forces lowercase and replaces spaces with hyphens
function slugify(str) {
  return typeof str === 'string' ? str.toLowerCase().replace(' ', '-') : '';
}

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

/***/ "./app/views/settings/project/permissionAlert.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/project/permissionAlert.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/settings/projectGeneralSettings.tsx":
/*!*******************************************************!*\
  !*** ./app/views/settings/projectGeneralSettings.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/persistence */ "./app/components/organizations/pageFilters/persistence.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/data/forms/projectGeneralSettings */ "./app/data/forms/projectGeneralSettings.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





























class ProjectGeneralSettings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_22__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_form", {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTransferFieldChange", (id, value) => {
      this._form[id] = value;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveProject", () => {
      const {
        orgId
      } = this.props.params;
      const project = this.state.data;
      (0,sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_13__.removePageFiltersStorage)(orgId);

      if (!project) {
        return;
      }

      (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.removeProject)(this.api, orgId, project).then(() => {
        // Need to hard reload because lots of components do not listen to Projects Store
        window.location.assign('/');
      }, (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_18__["default"])('Unable to remove project'));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTransferProject", async () => {
      const {
        orgId
      } = this.props.params;
      const project = this.state.data;

      if (!project) {
        return;
      }

      if (typeof this._form.email !== 'string' || this._form.email.length < 1) {
        return;
      }

      try {
        await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.transferProject)(this.api, orgId, project, this._form.email); // Need to hard reload because lots of components do not listen to Projects Store

        window.location.assign('/');
      } catch (err) {
        if (err.status >= 500) {
          (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_18__["default"])('Unable to transfer project')(err);
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isProjectAdmin", () => new Set(this.props.organization.access).has('project:admin'));
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project Settings'), projectId, false);
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/`]];
  }

  renderRemoveProject() {
    const project = this.state.data;
    const isProjectAdmin = this.isProjectAdmin();
    const {
      isInternal
    } = project;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove Project'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Remove the [project] project and all related data. [linebreak] Careful, this action cannot be undone.', {
        project: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("strong", {
          children: project.slug
        }),
        linebreak: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("br", {})
      }),
      children: [!isProjectAdmin && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('You do not have the required permission to remove this project.'), isInternal && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This project cannot be removed. It is used internally by the Sentry server.'), isProjectAdmin && !isInternal && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
        onConfirm: this.handleRemoveProject,
        priority: "danger",
        confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove project'),
        message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("strong", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Removing this project is permanent and cannot be undone!')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This will also remove all associated event data.')
          })]
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            className: "ref-remove-project",
            type: "button",
            priority: "danger",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove Project')
          })
        })
      })]
    });
  }

  renderTransferProject() {
    const project = this.state.data;
    const isProjectAdmin = this.isProjectAdmin();
    const {
      isInternal
    } = project;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Transfer Project'),
      help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Transfer the [project] project and all related data. [linebreak] Careful, this action cannot be undone.', {
        project: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("strong", {
          children: project.slug
        }),
        linebreak: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("br", {})
      }),
      children: [!isProjectAdmin && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('You do not have the required permission to transfer this project.'), isInternal && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This project cannot be transferred. It is used internally by the Sentry server.'), isProjectAdmin && !isInternal && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
        onConfirm: this.handleTransferProject,
        priority: "danger",
        confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Transfer project'),
        renderMessage: _ref => {
          let {
            confirm
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("strong", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Transferring this project is permanent and cannot be undone!')
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Please enter the email of an organization owner to whom you would like to transfer this project.')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
                hideFooter: true,
                onFieldChange: this.handleTransferFieldChange,
                onSubmit: (_data, _onSuccess, _onError, e) => {
                  e.stopPropagation();
                  confirm();
                },
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  name: "email",
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Organization Owner'),
                  placeholder: "admin@example.com",
                  required: true,
                  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('A request will be emailed to this address, asking the organization owner to accept the project transfer.')
                })
              })
            })]
          });
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            className: "ref-transfer-project",
            type: "button",
            priority: "danger",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Transfer Project')
          })
        })
      })]
    });
  }

  renderBody() {
    var _project$teams;

    const {
      organization
    } = this.props;
    const project = this.state.data;
    const {
      orgId,
      projectId
    } = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write')
    };
    const team = project.teams.length ? (_project$teams = project.teams) === null || _project$teams === void 0 ? void 0 : _project$teams[0] : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_23__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_25__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
        saveOnBlur: true,
        allowUndo: true,
        initialData: { ...project,
          team
        },
        apiMethod: "PUT",
        apiEndpoint: endpoint,
        onSubmitSuccess: resp => {
          this.setState({
            data: resp
          });

          if (projectId !== resp.slug) {
            (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.changeProjectSlug)(projectId, resp.slug); // Container will redirect after stores get updated with new slug

            this.props.onChangeSlug(resp.slug);
          } // This will update our project context


          sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__["default"].updateSuccess(resp);
        },
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project Details'),
          fields: [sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.name, sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.platform]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Email'),
          fields: [sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.subjectPrefix]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Event Settings'),
          fields: [sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.resolveAge]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], { ...jsonFormProps,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Client Security'),
          fields: [sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.allowedDomains, sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.scrapeJavaScript, sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.securityToken, sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.securityTokenHeader, sentry_data_forms_projectGeneralSettings__WEBPACK_IMPORTED_MODULE_15__.fields.verifySSL],
          renderHeader: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.PanelAlert, {
            type: "info",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_24__["default"], {
              noMargin: true,
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].', {
                link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("a", {
                  href: "https://github.com/getsentry/sentry-javascript",
                  children: "sentry-javascript"
                })
              }), ' ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('This will restrict requests based on the [Origin] and [Referer] headers.', {
                Origin: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("code", {
                  children: "Origin"
                }),
                Referer: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("code", {
                  children: "Referer"
                })
              })]
            })
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Project Administration')
        }), this.renderRemoveProject(), this.renderTransferProject()]
      })]
    });
  }

}

class ProjectGeneralSettingsContainer extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "changedSlug", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].listen(() => this.onProjectsUpdate(), undefined));
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  onProjectsUpdate() {
    if (!this.changedSlug) {
      return;
    }

    const project = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].getBySlug(this.changedSlug);

    if (!project) {
      return;
    }

    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_19__["default"])('', { ...this.props,
      params: { ...this.props.params,
        projectId: this.changedSlug
      }
    }));
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(ProjectGeneralSettings, {
      onChangeSlug: newSlug => this.changedSlug = newSlug,
      ...this.props
    });
  }

}

ProjectGeneralSettingsContainer.displayName = "ProjectGeneralSettingsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])(ProjectGeneralSettingsContainer));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectGeneralSettings_tsx.4cf48515c97312c8bdaae07c9ab5394a.js.map