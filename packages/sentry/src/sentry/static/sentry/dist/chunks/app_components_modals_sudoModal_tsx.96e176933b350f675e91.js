"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_sudoModal_tsx"],{

/***/ "./app/actionCreators/account.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/account.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disconnectIdentity": () => (/* binding */ disconnectIdentity),
/* harmony export */   "logout": () => (/* binding */ logout),
/* harmony export */   "removeAuthenticator": () => (/* binding */ removeAuthenticator),
/* harmony export */   "updateUser": () => (/* binding */ updateUser)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");



async function disconnectIdentity(identity, onSuccess) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();

  try {
    await api.requestPromise(`/users/me/user-identities/${identity.category}/${identity.id}/`, {
      method: 'DELETE'
    });
  } catch {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)('Error disconnecting identity');
    return;
  }

  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)(`Disconnected ${identity.provider.name}`);
  onSuccess();
}
function updateUser(user) {
  const previousUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('user'); // If the user changed their theme preferences, we should also update
  // the config store

  if (previousUser.options.theme !== user.options.theme && user.options.theme !== 'system') {
    sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].set('theme', user.options.theme);
  } // Ideally we'd fire an action but this is gonna get refactored soon anyway


  sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].set('user', user);
}
function logout(api) {
  return api.requestPromise('/auth/', {
    method: 'DELETE'
  });
}
function removeAuthenticator(api, userId, authId) {
  return api.requestPromise(`/users/${userId}/authenticators/${authId}/`, {
    method: 'DELETE'
  });
}

/***/ }),

/***/ "./app/components/hook.tsx":
/*!*********************************!*\
  !*** ./app/components/hook.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Instead of accessing the HookStore directly, use this.
 *
 * If the hook slot needs to perform anything w/ the hooks, you can pass a
 * function as a child and you will receive an object with a `hooks` key
 *
 * Example:
 *
 *   <Hook name="my-hook">
 *     {({hooks}) => hooks.map(hook => (
 *       <Wrapper>{hook}</Wrapper>
 *     ))}
 *   </Hook>
 */
function Hook(_ref) {
  let {
    name,
    ...props
  } = _ref;

  class HookComponent extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        hooks: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(name).map(cb => cb(props))
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen((hookName, hooks) => this.handleHooks(hookName, hooks), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    handleHooks(hookName, hooks) {
      // Make sure that the incoming hook update matches this component's hook name
      if (hookName !== name) {
        return;
      }

      this.setState({
        hooks: hooks.map(cb => cb(props))
      });
    }

    render() {
      const {
        children
      } = props;

      if (!this.state.hooks || !this.state.hooks.length) {
        return null;
      }

      if (typeof children === 'function') {
        return children({
          hooks: this.state.hooks
        });
      }

      return this.state.hooks;
    }

  }

  HookComponent.displayName = "HookComponent";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(HookComponent, "displayName", `Hook(${name})`);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(HookComponent, {});
}

Hook.displayName = "Hook";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Hook);

/***/ }),

/***/ "./app/components/modals/sudoModal.tsx":
/*!*********************************************!*\
  !*** ./app/components/modals/sudoModal.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SudoModal": () => (/* binding */ SudoModal),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var sentry_components_hook__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/hook */ "./app/components/hook.tsx");
/* harmony import */ var sentry_components_u2f_u2fContainer__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/u2f/u2fContainer */ "./app/components/u2f/u2fContainer.tsx");
/* harmony import */ var sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants/superuserAccessErrors */ "./app/constants/superuserAccessErrors.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports


















class SudoModal extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      error: false,
      errorType: '',
      busy: false,
      superuserAccessCategory: '',
      superuserReason: '',
      authenticators: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async () => {
      const {
        api,
        isSuperuser
      } = this.props;
      const data = {
        isSuperuserModal: isSuperuser,
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
      const {
        closeModal,
        isSuperuser,
        location,
        needsReload,
        router,
        retryRequest
      } = this.props;

      if (!retryRequest) {
        closeModal();
        return;
      }

      if (isSuperuser) {
        router.replace({
          pathname: location.pathname,
          state: {
            forceUpdate: new Date()
          }
        });

        if (needsReload) {
          window.location.reload();
        }

        return;
      }

      this.setState({
        busy: true
      }, () => {
        retryRequest().then(() => {
          this.setState({
            busy: false
          }, closeModal);
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleError", err => {
      let errorType = '';

      if (err.status === 403) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__.ErrorCodes.invalidPassword;
      } else if (err.status === 401) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__.ErrorCodes.invalidSSOSession;
      } else if (err.status === 400) {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__.ErrorCodes.invalidAccessCategory;
      } else {
        errorType = sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__.ErrorCodes.unknownError;
      }

      this.setState({
        busy: false,
        error: true,
        errorType
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleU2fTap", async data => {
      this.setState({
        busy: true
      });
      const {
        api,
        isSuperuser
      } = this.props;

      try {
        data.isSuperuserModal = isSuperuser;
        data.superuserAccessCategory = this.state.superuserAccessCategory;
        data.superuserReason = this.state.superuserReason;
        await api.requestPromise('/auth/', {
          method: 'PUT',
          data
        });
        this.handleSuccess();
      } catch (err) {
        this.setState({
          busy: false
        }); // u2fInterface relies on this

        throw err;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLogout", async () => {
      const {
        api
      } = this.props;

      try {
        await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__.logout)(api);
      } catch {// ignore errors
      }

      window.location.assign(`/auth/login/?next=${encodeURIComponent(location.pathname)}`);
    });
  }

  componentDidMount() {
    this.getAuthenticators();
  }

  async getAuthenticators() {
    const {
      api
    } = this.props;

    try {
      const authenticators = await api.requestPromise('/authenticators/');
      this.setState({
        authenticators: authenticators !== null && authenticators !== void 0 ? authenticators : []
      });
    } catch {// ignore errors
    }
  }

  renderBodyContent() {
    const {
      isSuperuser
    } = this.props;
    const {
      authenticators,
      error,
      errorType
    } = this.state;
    const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_15__["default"].get('user');
    const isSelfHosted = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_15__["default"].get('isSelfHosted');
    const validateSUForm = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_15__["default"].get('validateSUForm');

    if (errorType === sentry_constants_superuserAccessErrors__WEBPACK_IMPORTED_MODULE_13__.ErrorCodes.invalidSSOSession) {
      this.handleLogout();
      return null;
    }

    if (!user.hasPasswordAuth && authenticators.length === 0 || isSuperuser && !isSelfHosted && validateSUForm) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledTextBlock, {
          children: isSuperuser ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You will need to reauthenticate to continue')
        }), error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledAlert, {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(errorType)
        }), isSuperuser ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__["default"], {
          apiMethod: "PUT",
          apiEndpoint: "/auth/",
          submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Re-authenticate'),
          onSubmitSuccess: this.handleSuccess,
          onSubmitError: this.handleError,
          initialData: {
            isSuperuserModal: isSuperuser
          },
          extraButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(BackWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              onClick: this.handleSubmit,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('COPS/CSM')
            })
          }),
          resetOnError: true,
          children: !isSelfHosted && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_hook__WEBPACK_IMPORTED_MODULE_11__["default"], {
            name: "component:superuser-access-category"
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          priority: "primary",
          href: `/auth/login/?next=${encodeURIComponent(location.pathname)}`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Continue')
        })]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledTextBlock, {
        children: isSuperuser ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You are attempting to access a resource that requires superuser access, please re-authenticate as a superuser.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Help us keep your account safe by confirming your identity.')
      }), error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledAlert, {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(errorType)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__["default"], {
        apiMethod: "PUT",
        apiEndpoint: "/auth/",
        submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Confirm Password'),
        onSubmitSuccess: this.handleSuccess,
        onSubmitError: this.handleError,
        hideFooter: !user.hasPasswordAuth && authenticators.length === 0,
        initialData: {
          isSuperuserModal: isSuperuser
        },
        resetOnError: true,
        children: [user.hasPasswordAuth && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledInputField, {
          type: "password",
          inline: false,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Password'),
          name: "password",
          autoFocus: true,
          flexibleControlStateSize: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_u2f_u2fContainer__WEBPACK_IMPORTED_MODULE_12__["default"], {
          authenticators: authenticators,
          displayMode: "sudo",
          onTap: this.handleU2fTap
        })]
      })]
    });
  }

  render() {
    const {
      Header,
      Body
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Header, {
        closeButton: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Confirm Password to Continue')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Body, {
        children: this.renderBodyContent()
      })]
    });
  }

}

SudoModal.displayName = "SudoModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__["default"])(SudoModal)));


const StyledTextBlock = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "egngqnr3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const StyledInputField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_inputField__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "egngqnr2"
} : 0)( true ? {
  name: "1408f10",
  styles: "padding-left:0"
} : 0);

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "egngqnr1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const BackWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "egngqnr0"
} : 0)("width:100%;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(4), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/u2f/u2fContainer.tsx":
/*!*********************************************!*\
  !*** ./app/components/u2f/u2fContainer.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _u2fsign__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./u2fsign */ "./app/components/u2f/u2fsign.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function U2fContainer(_ref) {
  let {
    className,
    authenticators,
    ...props
  } = _ref;

  if (!authenticators.length) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
    className: className,
    children: authenticators.map(auth => auth.id === 'u2f' && auth.challenge ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(_u2fsign__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
      challengeData: auth.challenge
    }, auth.id) : null)
  });
}

U2fContainer.displayName = "U2fContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (U2fContainer);

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

/***/ }),

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");



/**
 * Returns an API client that will have it's requests canceled when the owning
 * React component is unmounted (may be disabled via options).
 */
function useApi() {
  let {
    persistInFlight,
    api: providedApi
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const localApi = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(); // Lazily construct the client if we weren't provided with one

  if (localApi.current === undefined && providedApi === undefined) {
    localApi.current = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  } // Use the provided client if available


  const api = providedApi !== null && providedApi !== void 0 ? providedApi : localApi.current; // Clear API calls on unmount (if persistInFlight is disabled

  const clearOnUnmount = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!persistInFlight) {
      api.clear();
    }
  }, [api, persistInFlight]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => clearOnUnmount, [clearOnUnmount]);
  return api;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApi);

/***/ }),

/***/ "./app/utils/withApi.tsx":
/*!*******************************!*\
  !*** ./app/utils/withApi.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * XXX: Prefer useApi if you are wrapping a Function Component!
 *
 * React Higher-Order Component (HoC) that provides "api" client when mounted,
 * and clears API requests when component is unmounted.
 *
 * If an `api` prop is provided when the component is invoked it will be passed
 * through.
 */
const withApi = function (WrappedComponent) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const WithApi = _ref => {
    let {
      api: propsApi,
      ...props
    } = _ref;
    const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__["default"])({
      api: propsApi,
      ...options
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      api: api
    });
  };

  WithApi.displayName = `withApi(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return WithApi;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withApi);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_sudoModal_tsx.7102c1f5727b43d028df949167b40823.js.map