"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationApiKeys_index_tsx"],{

/***/ "./app/components/links/linkWithConfirmation.tsx":
/*!*******************************************************!*\
  !*** ./app/components/links/linkWithConfirmation.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var _anchor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./anchor */ "./app/components/links/anchor.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * <Confirm> is a more generic version of this component
 */
function LinkWithConfirmation(_ref) {
  let {
    className,
    disabled,
    title,
    children,
    ...otherProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__["default"], { ...otherProps,
    disabled: disabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_anchor__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "#",
      className: className,
      disabled: disabled,
      title: title,
      children: children
    })
  });
}

LinkWithConfirmation.displayName = "LinkWithConfirmation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LinkWithConfirmation);

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

/***/ "./app/views/settings/organizationApiKeys/index.tsx":
/*!**********************************************************!*\
  !*** ./app/views/settings/organizationApiKeys/index.tsx ***!
  \**********************************************************/
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
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _organizationApiKeysList__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./organizationApiKeysList */ "./app/views/settings/organizationApiKeys/organizationApiKeysList.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
class OrganizationApiKeys extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", async id => {
      const oldKeys = [...this.state.keys];
      this.setState(state => ({
        keys: state.keys.filter(_ref => {
          let {
            id: existingId
          } = _ref;
          return existingId !== id;
        })
      }));

      try {
        await this.api.requestPromise(`/organizations/${this.props.params.orgId}/api-keys/${id}/`, {
          method: 'DELETE',
          data: {}
        });
      } catch {
        this.setState({
          keys: oldKeys,
          busy: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Error removing key'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddApiKey", async () => {
      this.setState({
        busy: true
      });

      try {
        const data = await this.api.requestPromise(`/organizations/${this.props.params.orgId}/api-keys/`, {
          method: 'POST',
          data: {}
        });

        if (data) {
          this.setState({
            busy: false
          });
          react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_5__["default"])(`${data.id}/`, {
            params: this.props.params,
            routes: this.props.routes
          }));
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Created a new API key "${data.label}"`));
        }
      } catch {
        this.setState({
          busy: false
        });
      }
    });
  }

  getEndpoints() {
    return [['keys', `/organizations/${this.props.params.orgId}/api-keys/`]];
  }

  getTitle() {
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('API Keys'), this.props.organization.slug, false);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_organizationApiKeysList__WEBPACK_IMPORTED_MODULE_9__["default"], {
      loading: this.state.loading,
      busy: this.state.busy,
      keys: this.state.keys,
      onRemove: this.handleRemove,
      onAddApiKey: this.handleAddApiKey,
      ...this.props
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])(OrganizationApiKeys));

/***/ }),

/***/ "./app/views/settings/organizationApiKeys/organizationApiKeysList.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/settings/organizationApiKeys/organizationApiKeysList.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/linkWithConfirmation */ "./app/components/links/linkWithConfirmation.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















var _ref3 =  true ? {
  name: "1lo1a34",
  styles: "position:relative;top:2px"
} : 0;

function OrganizationApiKeysList(_ref) {
  let {
    params,
    routes,
    keys,
    busy,
    loading,
    onAddApiKey,
    onRemove
  } = _ref;
  const hasKeys = keys && keys.length;

  const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
    priority: "primary",
    size: "sm",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconAdd, {
      size: "xs",
      isCircled: true
    }),
    busy: busy,
    disabled: busy,
    onClick: onAddApiKey,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('New API Key')
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('API Keys'),
      action: action
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_15__["default"], {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)(`API keys grant access to the [api:developer web API].
          If you're looking to configure a Sentry client, you'll need a
          client key which is available in your project settings.`, {
        api: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
          href: "https://docs.sentry.io/api/"
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
      to: "/settings/account/api/auth-tokens/",
      priority: "info",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Until Sentry supports OAuth, you might want to switch to using [tokens:Auth Tokens] instead.', {
        tokens: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("u", {})
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelTable, {
      isLoading: loading,
      isEmpty: !hasKeys,
      emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No API keys for this organization'),
      headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Name'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Key'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Actions')],
      children: keys && keys.map(_ref2 => {
        let {
          id,
          key,
          label
        } = _ref2;
        const apiDetailsUrl = (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_13__["default"])(`${id}/`, {
          params,
          routes
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
              to: apiDetailsUrl,
              children: label
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(AutoSelectTextInput, {
              readOnly: true,
              children: key
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_8__["default"], {
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Remove API Key'),
              className: "btn btn-default btn-sm",
              onConfirm: () => onRemove(id),
              message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Are you sure you want to remove this API key?'),
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Remove API Key?'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconDelete, {
                size: "xs",
                css: _ref3
              })
            })
          })]
        }, key);
      })
    })]
  });
}

OrganizationApiKeysList.displayName = "OrganizationApiKeysList";

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9c1bws1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const AutoSelectTextInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e9c1bws0"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_12__.inputStyles)(p), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationApiKeysList);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationApiKeys_index_tsx.6f4963066e62f1a1fcd95c89aad8375d.js.map