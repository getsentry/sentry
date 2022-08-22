"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSecurity_index_tsx"],{

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
  \*******************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/data/forms/accountPassword.tsx":
/*!********************************************!*\
  !*** ./app/data/forms/accountPassword.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
const getUserIsNotManaged = _ref => {
  let {
    user
  } = _ref;
  return !user.isManaged;
};

const formGroups = [{
  // Form "section"/"panel"
  title: 'Password',
  fields: [{
    name: 'password',
    type: 'secret',
    autoComplete: 'current-password',
    label: 'Current Password',
    placeholder: '',
    help: 'Your current password',
    visible: getUserIsNotManaged,
    required: true
  }, {
    name: 'passwordNew',
    type: 'secret',
    autoComplete: 'new-password',
    label: 'New Password',
    placeholder: '',
    help: '',
    required: true,
    visible: getUserIsNotManaged,
    validate: _ref2 => {
      let {
        id,
        form
      } = _ref2;
      return form[id] !== form.passwordVerify ? [[id, '']] : [];
    }
  }, {
    name: 'passwordVerify',
    type: 'secret',
    autoComplete: 'new-password',
    label: 'Verify New Password',
    placeholder: '',
    help: 'Verify your new password',
    required: true,
    visible: getUserIsNotManaged,
    validate: _ref3 => {
      let {
        id,
        form
      } = _ref3;

      // If password is set, and passwords don't match, then return an error
      if (form.passwordNew && form.passwordNew !== form[id]) {
        return [[id, 'Passwords do not match']];
      }

      return [];
    }
  }]
}];
const route = '/settings/account/security/';
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/utils/getPendingInvite.tsx":
/*!****************************************!*\
  !*** ./app/utils/getPendingInvite.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getPendingInvite)
/* harmony export */ });
/* harmony import */ var js_cookie__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! js-cookie */ "../node_modules/js-cookie/dist/js.cookie.mjs");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");


function getPendingInvite() {
  const data = js_cookie__WEBPACK_IMPORTED_MODULE_0__["default"].get('pending-invite');

  if (!data) {
    return null;
  }

  return query_string__WEBPACK_IMPORTED_MODULE_1__.parse(data);
}

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

/***/ "./app/views/settings/account/accountSecurity/components/confirmHeader.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/confirmHeader.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

const ConfirmHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1er9gj10"
} : 0)( true ? {
  name: "73b5fw",
  styles: "font-size:1.2em;margin-bottom:10px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConfirmHeader);

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/components/removeConfirm.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/removeConfirm.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/confirmHeader */ "./app/views/settings/account/accountSecurity/components/confirmHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_3__["default"], {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Do you want to remove this method?')
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_4__["default"], {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Removing the last authentication method will disable two-factor authentication completely.')
  })]
});

const RemoveConfirm = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
  message: message
});

RemoveConfirm.displayName = "RemoveConfirm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RemoveConfirm);

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/components/twoFactorRequired.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/twoFactorRequired.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getPendingInvite__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getPendingInvite */ "./app/utils/getPendingInvite.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const TwoFactorRequired = () => !(0,sentry_utils_getPendingInvite__WEBPACK_IMPORTED_MODULE_5__["default"])() ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledAlert, {
  "data-test-id": "require-2fa",
  type: "error",
  showIcon: true,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('You have been invited to an organization that requires [link:two-factor authentication].' + ' Setup two-factor authentication below to join your organization.', {
    link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
      href: "https://docs.sentry.io/accounts/require-2fa/"
    })
  })
});

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "em89xh0"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), " 0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TwoFactorRequired);

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/index.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/index.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/removeConfirm */ "./app/views/settings/account/accountSecurity/components/removeConfirm.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_twoFactorRequired__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/twoFactorRequired */ "./app/views/settings/account/accountSecurity/components/twoFactorRequired.tsx");
/* harmony import */ var sentry_views_settings_account_passwordForm__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/account/passwordForm */ "./app/views/settings/account/passwordForm.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
























/**
 * Lists 2fa devices + password change form
 */
class AccountSecurity extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSessionClose", async () => {
      try {
        await this.api.requestPromise('/auth/', {
          method: 'DELETE',
          data: {
            all: true
          }
        });
        window.location.assign('/auth/login/');
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('There was a problem closing all sessions'));
        throw err;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formatOrgSlugs", () => {
      const {
        orgsRequire2fa
      } = this.props;
      const slugs = orgsRequire2fa.map(_ref => {
        let {
          slug
        } = _ref;
        return slug;
      });
      return [slugs.slice(0, -1).join(', '), slugs.slice(-1)[0]].join(slugs.length > 1 ? ' and ' : '');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAdd2FAClicked", () => {
      const {
        handleRefresh
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openEmailVerification)({
        onClose: () => {
          handleRefresh();
        },
        actionMessage: 'enrolling a 2FA device'
      });
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Security');
  }

  getEndpoints() {
    return [];
  }

  renderBody() {
    const {
      authenticators,
      countEnrolled,
      deleteDisabled,
      onDisable,
      hasVerifiedEmail
    } = this.props;
    const isEmpty = !(authenticators !== null && authenticators !== void 0 && authenticators.length);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_21__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Security'),
        tabs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_9__["default"], {
          underlined: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_15__["default"])('', this.props),
            index: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Settings')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_15__["default"])('session-history/', this.props),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Session History')
          })]
        })
      }), !isEmpty && countEnrolled === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_account_accountSecurity_components_twoFactorRequired__WEBPACK_IMPORTED_MODULE_18__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_account_passwordForm__WEBPACK_IMPORTED_MODULE_19__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Sessions')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_7__["default"], {
            alignRight: true,
            flexibleControlStateSize: true,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Sign out of all devices'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Signing out of all devices will sign you out of this device as well.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              "data-test-id": "signoutAll",
              onClick: this.handleSessionClose,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Sign out of all devices')
            })
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Two-Factor Authentication')
        }), isEmpty && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_20__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No available authenticators to add')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
          children: !isEmpty && (authenticators === null || authenticators === void 0 ? void 0 : authenticators.map(auth => {
            const {
              id,
              authId,
              description,
              isBackupInterface,
              isEnrolled,
              disallowNewEnrollment,
              configureButton,
              name
            } = auth;

            if (disallowNewEnrollment && !isEnrolled) {
              return null;
            }

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(AuthenticatorPanelItem, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(AuthenticatorHeader, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(AuthenticatorTitle, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AuthenticatorStatus, {
                    enabled: isEnrolled
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AuthenticatorName, {
                    children: name
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Actions, {
                  children: [!isBackupInterface && !isEnrolled && hasVerifiedEmail && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    to: `/settings/account/security/mfa/${id}/enroll/`,
                    size: "sm",
                    priority: "primary",
                    className: "enroll-button",
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add')
                  }), !isBackupInterface && !isEnrolled && !hasVerifiedEmail && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    onClick: this.handleAdd2FAClicked,
                    size: "sm",
                    priority: "primary",
                    className: "enroll-button",
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Add')
                  }), isEnrolled && authId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    to: `/settings/account/security/mfa/${authId}/`,
                    size: "sm",
                    className: "details-button",
                    children: configureButton
                  }), !isBackupInterface && isEnrolled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)(`Two-factor authentication is required for organization(s): ${this.formatOrgSlugs()}.`),
                    disabled: !deleteDisabled,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_17__["default"], {
                      onConfirm: () => onDisable(auth),
                      disabled: deleteDisabled,
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                        size: "sm",
                        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('delete'),
                        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {})
                      })
                    })
                  })]
                }), isBackupInterface && !isEnrolled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('requires 2FA') : null]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Description, {
                children: description
              })]
            }, id);
          }))
        })]
      })]
    });
  }

}

const AuthenticatorName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7qdl2c6"
} : 0)( true ? {
  name: "1elbn1z",
  styles: "font-size:1.2em"
} : 0);

const AuthenticatorPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelItem,  true ? {
  target: "e7qdl2c5"
} : 0)( true ? {
  name: "qdeacm",
  styles: "flex-direction:column"
} : 0);

const AuthenticatorHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7qdl2c4"
} : 0)( true ? {
  name: "zol16h",
  styles: "display:flex;flex:1;align-items:center"
} : 0);

const AuthenticatorTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7qdl2c3"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7qdl2c2"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const AuthenticatorStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e7qdl2c1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_22__["default"],  true ? {
  target: "e7qdl2c0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";margin-bottom:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountSecurity);

/***/ }),

/***/ "./app/views/settings/account/passwordForm.tsx":
/*!*****************************************************!*\
  !*** ./app/views/settings/account/passwordForm.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_data_forms_accountPassword__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/data/forms/accountPassword */ "./app/data/forms/accountPassword.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function PasswordForm() {
  function handleSubmitSuccess(_change, model) {
    // Reset form on success
    model.resetForm();
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)('Password has been changed');
  }

  function handleSubmitError() {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)('Error changing password');
  }

  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('user');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__["default"], {
    apiMethod: "PUT",
    apiEndpoint: "/users/me/password/",
    initialData: {},
    onSubmitSuccess: handleSubmitSuccess,
    onSubmitError: handleSubmitError,
    hideFooter: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_4__["default"], {
      forms: sentry_data_forms_accountPassword__WEBPACK_IMPORTED_MODULE_6__["default"],
      additionalFieldProps: {
        user
      },
      renderFooter: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          type: "submit",
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Change password')
        })
      }),
      renderHeader: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelAlert, {
        type: "info",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Changing your password will invalidate all logged in sessions.')
      })
    })
  });
}

PasswordForm.displayName = "PasswordForm";

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_5__.PanelItem,  true ? {
  target: "e1otu15i0"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PasswordForm);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSecurity_index_tsx.700fbdd55bac915cfc9531c5479d634f.js.map