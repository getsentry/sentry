"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSettingsLayout_tsx"],{

/***/ "./app/views/settings/account/accountSettingsLayout.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/account/accountSettingsLayout.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var sentry_views_settings_account_accountSettingsNavigation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/account/accountSettingsNavigation */ "./app/views/settings/account/accountSettingsNavigation.tsx");
/* harmony import */ var sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsLayout */ "./app/views/settings/components/settingsLayout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class AccountSettingsLayout extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  getChildContext() {
    return {
      organization: this.props.organization
    };
  }

  componentDidUpdate(prevProps) {
    const {
      organization
    } = this.props;

    if (prevProps.organization === organization) {
      return;
    } // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info


    if (organization && typeof organization.access === 'undefined') {
      (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_2__.fetchOrganizationDetails)(organization.slug, {
        setActive: true,
        loadProjects: true
      });
    }
  }

  render() {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_6__["default"], { ...this.props,
      renderNavigation: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_account_accountSettingsNavigation__WEBPACK_IMPORTED_MODULE_5__["default"], {
        organization: organization
      }),
      children: this.props.children
    });
  }

}

AccountSettingsLayout.displayName = "AccountSettingsLayout";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AccountSettingsLayout, "childContextTypes", {
  organization: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_3__["default"].Organization
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_4__["default"])(AccountSettingsLayout));

/***/ }),

/***/ "./app/views/settings/account/accountSettingsNavigation.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/account/accountSettingsNavigation.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_views_settings_account_navigationConfiguration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/views/settings/account/navigationConfiguration */ "./app/views/settings/account/navigationConfiguration.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavigation */ "./app/views/settings/components/settingsNavigation.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const AccountSettingsNavigation = _ref => {
  let {
    organization
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_1__["default"], {
    navigationObjects: (0,sentry_views_settings_account_navigationConfiguration__WEBPACK_IMPORTED_MODULE_0__["default"])({
      organization
    })
  });
};

AccountSettingsNavigation.displayName = "AccountSettingsNavigation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountSettingsNavigation);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSettingsLayout_tsx.0c77d2554c769de45f46e554cda7ca84.js.map