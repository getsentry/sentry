"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSecurity_accountSecurityWrapper_tsx"],{

/***/ "./app/views/settings/account/accountSecurity/accountSecurityWrapper.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/accountSecurityWrapper.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");







const ENDPOINT = '/users/me/authenticators/';

class AccountSecurityWrapper extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisable", async auth => {
      if (!auth || !auth.authId) {
        return;
      }

      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(`${ENDPOINT}${auth.authId}/`, {
          method: 'DELETE'
        });
        this.remountComponent();
      } catch (_err) {
        this.setState({
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Error disabling %s', auth.name));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRegenerateBackupCodes", async () => {
      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(`${ENDPOINT}${this.props.params.authId}/`, {
          method: 'PUT'
        });
        this.remountComponent();
      } catch (_err) {
        this.setState({
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Error regenerating backup codes'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRefresh", () => {
      this.fetchData();
    });
  }

  getEndpoints() {
    return [['authenticators', ENDPOINT], ['organizations', '/organizations/'], ['emails', '/users/me/emails/']];
  }

  renderBody() {
    const {
      children
    } = this.props;
    const {
      authenticators,
      organizations,
      emails
    } = this.state;
    const enrolled = (authenticators === null || authenticators === void 0 ? void 0 : authenticators.filter(auth => auth.isEnrolled && !auth.isBackupInterface)) || [];
    const countEnrolled = enrolled.length;
    const orgsRequire2fa = (organizations === null || organizations === void 0 ? void 0 : organizations.filter(org => org.require2FA)) || [];
    const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;
    const hasVerifiedEmail = !!(emails !== null && emails !== void 0 && emails.find(_ref => {
      let {
        isVerified
      } = _ref;
      return isVerified;
    })); // This happens when you switch between children views and the next child
    // view is lazy loaded, it can potentially be `null` while the code split
    // package is being fetched

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(children)) {
      return null;
    }

    return /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(this.props.children, {
      onDisable: this.handleDisable,
      onRegenerateBackupCodes: this.handleRegenerateBackupCodes,
      authenticators,
      deleteDisabled,
      orgsRequire2fa,
      countEnrolled,
      hasVerifiedEmail,
      handleRefresh: this.handleRefresh
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountSecurityWrapper);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSecurity_accountSecurityWrapper_tsx.ddc88279def1b26a1a6058087d7922e6.js.map