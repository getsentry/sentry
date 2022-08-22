"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["SuperuserAccessForm"],{

/***/ "./app/components/superuserAccessForm.tsx":
/*!************************************************!*\
  !*** ./app/components/superuserAccessForm.tsx ***!
  \************************************************/
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
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_hook__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hook */ "./app/components/hook.tsx");
/* harmony import */ var sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/themeAndStyleProvider */ "./app/components/themeAndStyleProvider.tsx");
/* harmony import */ var sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants/superuserAccessErrors */ "./app/constants/superuserAccessErrors.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./button */ "./app/components/button.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class SuperuserAccessForm extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      error: false,
      errorType: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async () => {
      const {
        api
      } = this.props;
      const data = {
        isSuperuserModal: true,
        superuserAccessCategory: 'cops_csm',
        superuserReason: 'COPS and CSM use'
      };

      try {
        await api.requestPromise('/auth/', {
          method: 'PUT',
          data
        });
        this.handleSuccess();
      } catch (err) {
        this.handleError(err);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSuccess", () => {
      window.location.reload();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleError", err => {
      let errorType = '';

      if (err.status === 403) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__.ErrorCodes.invalidPassword;
      } else if (err.status === 401) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__.ErrorCodes.invalidSSOSession;
      } else if (err.status === 400) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__.ErrorCodes.invalidAccessCategory;
      } else {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__.ErrorCodes.unknownError;
      }

      this.setState({
        error: true,
        errorType
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLogout", async () => {
      const {
        api
      } = this.props;

      try {
        await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_4__.logout)(api);
      } catch {// ignore errors
      }

      window.location.assign('/auth/login/');
    });
  }

  render() {
    const {
      error,
      errorType
    } = this.state;

    if (errorType === sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_9__.ErrorCodes.invalidSSOSession) {
      this.handleLogout();
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_themeAndStyleProvider__WEBPACK_IMPORTED_MODULE_8__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_6__["default"], {
        apiMethod: "PUT",
        apiEndpoint: "/auth/",
        submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Continue'),
        onSubmitSuccess: this.handleSuccess,
        onSubmitError: this.handleError,
        initialData: {
          isSuperuserModal: true
        },
        extraButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(BackWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_button__WEBPACK_IMPORTED_MODULE_13__["default"], {
            onClick: this.handleSubmit,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('COPS/CSM')
          })
        }),
        resetOnError: true,
        children: [error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledAlert, {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(errorType)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_hook__WEBPACK_IMPORTED_MODULE_7__["default"], {
          name: "component:superuser-access-category"
        })]
      })
    });
  }

}

SuperuserAccessForm.displayName = "SuperuserAccessForm";

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eul11zl1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const BackWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eul11zl0"
} : 0)("width:100%;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(4), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_12__["default"])(SuperuserAccessForm));

/***/ }),

/***/ "./app/constants/superuserAccessErrors.tsx":
/*!*************************************************!*\
  !*** ./app/constants/superuserAccessErrors.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorCodes": () => (/* binding */ ErrorCodes)
/* harmony export */ });
let ErrorCodes;

(function (ErrorCodes) {
  ErrorCodes["invalidPassword"] = "Incorrect password";
  ErrorCodes["invalidSSOSession"] = "Your SSO Session has expired, please reauthenticate";
  ErrorCodes["invalidAccessCategory"] = "Please fill out the access category and reason correctly";
  ErrorCodes["unknownError"] = "An error ocurred, please try again";
})(ErrorCodes || (ErrorCodes = {}));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/SuperuserAccessForm.05cdc7cfc14595c8603493f29773c031.js.map