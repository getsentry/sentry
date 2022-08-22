"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationApiKeys_organizationApiKeyDetails_tsx"],{

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

/***/ "./app/views/settings/organizationApiKeys/organizationApiKeyDetails.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/organizationApiKeys/organizationApiKeyDetails.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/apiForm */ "./app/components/forms/apiForm.tsx");
/* harmony import */ var sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/controls/multipleCheckbox */ "./app/components/forms/controls/multipleCheckbox.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/textareaField */ "./app/components/forms/textareaField.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const API_CHOICES = sentry_constants__WEBPACK_IMPORTED_MODULE_10__.API_ACCESS_SCOPES.map(s => [s, s]);

class OrganizationApiKeyDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)('Saved changes'); // Go back to API list

      react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__["default"])('', {
        stepBack: -1,
        routes: this.props.routes,
        params: this.props.params
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitError", () => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)('Unable to save changes. Please try again.');
    });
  }

  getEndpoints() {
    return [['apiKey', `/organizations/${this.props.params.orgId}/api-keys/${this.props.params.apiKey}/`]];
  }

  getTitle() {
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_13__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Edit API Key'), this.props.organization.slug, false);
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Edit API Key')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('API Key')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_apiForm__WEBPACK_IMPORTED_MODULE_4__["default"], {
          apiMethod: "PUT",
          apiEndpoint: `/organizations/${this.props.params.orgId}/api-keys/${this.props.params.apiKey}/`,
          initialData: this.state.apiKey,
          onSubmitSuccess: this.handleSubmitSuccess,
          onSubmitError: this.handleSubmitError,
          onCancel: () => react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__["default"])('', {
            stepBack: -1,
            routes: this.props.routes,
            params: this.props.params
          })),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Label'),
              name: "label"
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('API Key'),
              name: "key",
              disabled: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__["default"], {
              name: "scope_list",
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Scopes'),
              inline: false,
              required: true,
              children: _ref => {
                let {
                  value,
                  onChange
                } = _ref;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_controls_multipleCheckbox__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  value: value,
                  onChange: onChange,
                  choices: API_CHOICES
                });
              }
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_7__["default"], {
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Allowed Domains'),
              name: "allowed_origins",
              placeholder: "e.g. example.com or https://example.com",
              help: "Separate multiple entries with a newline"
            })]
          })
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])(OrganizationApiKeyDetails));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationApiKeys_organizationApiKeyDetails_tsx.1ffb9501fbcbd375adb85dbb17245d97.js.map