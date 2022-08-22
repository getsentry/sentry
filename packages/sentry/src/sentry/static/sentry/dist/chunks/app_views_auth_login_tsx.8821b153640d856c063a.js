"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_auth_login_tsx"],{

/***/ "./app/views/auth/login.tsx":
/*!**********************************!*\
  !*** ./app/views/auth/login.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "formFooterClass": () => (/* binding */ formFooterClass)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _loginForm__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./loginForm */ "./app/views/auth/loginForm.tsx");
/* harmony import */ var _registerForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./registerForm */ "./app/views/auth/registerForm.tsx");
/* harmony import */ var _ssoForm__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./ssoForm */ "./app/views/auth/ssoForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const FORM_COMPONENTS = {
  login: _loginForm__WEBPACK_IMPORTED_MODULE_10__["default"],
  register: _registerForm__WEBPACK_IMPORTED_MODULE_11__["default"],
  sso: _ssoForm__WEBPACK_IMPORTED_MODULE_12__["default"]
};

class Login extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      error: null,
      activeTab: 'login',
      authConfig: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSetTab", (activeTab, event) => {
      this.setState({
        activeTab
      });
      event.preventDefault();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api
      } = this.props;

      try {
        const response = await api.requestPromise('/auth/config/');
        const {
          vsts_login_link,
          github_login_link,
          google_login_link,
          ...config
        } = response;
        const authConfig = { ...config,
          vstsLoginLink: vsts_login_link,
          githubLoginLink: github_login_link,
          googleLoginLink: google_login_link
        };
        this.setState({
          authConfig
        });
      } catch (e) {
        this.setState({
          error: true
        });
      }

      this.setState({
        loading: false
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  get hasAuthProviders() {
    if (this.state.authConfig === null) {
      return false;
    }

    const {
      githubLoginLink,
      googleLoginLink,
      vstsLoginLink
    } = this.state.authConfig;
    return !!(githubLoginLink || vstsLoginLink || googleLoginLink);
  }

  render() {
    const {
      api
    } = this.props;
    const {
      loading,
      error,
      activeTab,
      authConfig
    } = this.state;
    const FormComponent = FORM_COMPONENTS[activeTab];
    const tabs = [['login', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Login')], ['sso', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Single Sign-On')], ['register', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Register'), !(authConfig !== null && authConfig !== void 0 && authConfig.canRegister)]];

    const renderTab = _ref => {
      let [key, label, disabled] = _ref;
      return !disabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("li", {
        className: activeTab === key ? 'active' : '',
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("a", {
          href: "#",
          onClick: e => this.handleSetTab(key, e),
          children: label
        })
      }, key);
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Heading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sign in to continue')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(AuthNavTabs, {
          children: tabs.map(renderTab)
        })]
      }), loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {}), error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledLoadingError, {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to load authentication configuration'),
        onRetry: this.fetchData
      }), !loading && authConfig !== null && !error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(FormWrapper, {
        hasAuthProviders: this.hasAuthProviders,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(FormComponent, {
          api,
          authConfig
        })
      })]
    });
  }

}

Login.displayName = "Login";

const StyledLoadingError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1omfq4b4"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1omfq4b3"
} : 0)("border-bottom:1px solid ", p => p.theme.border, ";padding:20px 40px 0;" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h3',  true ? {
  target: "e1omfq4b2"
} : 0)( true ? {
  name: "cqisp1",
  styles: "font-size:24px;margin:0 0 20px 0"
} : 0);

const AuthNavTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1omfq4b1"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const FormWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1omfq4b0"
} : 0)("padding:35px;width:", p => p.hasAuthProviders ? '600px' : '490px', ";" + ( true ? "" : 0));

const formFooterClass = `
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1)};
  align-items: center;
  justify-items: end;
  border-top: none;
  margin-bottom: 0;
  padding: 0;
`;

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])(Login));

/***/ }),

/***/ "./app/views/auth/loginForm.tsx":
/*!**************************************!*\
  !*** ./app/views/auth/loginForm.tsx ***!
  \**************************************/
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/deprecatedforms/form */ "./app/components/deprecatedforms/form.tsx");
/* harmony import */ var sentry_components_deprecatedforms_passwordField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/deprecatedforms/passwordField */ "./app/components/deprecatedforms/passwordField.tsx");
/* harmony import */ var sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/deprecatedforms/textField */ "./app/components/deprecatedforms/textField.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_auth_login__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/auth/login */ "./app/views/auth/login.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















// TODO(epurkhiser): The abstraction here would be much nicer if we just
// exposed a configuration object telling us what auth providers there are.
const LoginProviders = _ref => {
  let {
    vstsLoginLink,
    githubLoginLink,
    googleLoginLink
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(ProviderWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ProviderHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('External Account Login')
    }), googleLoginLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      align: "left",
      size: "sm",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconGoogle, {
        size: "xs"
      }),
      href: googleLoginLink,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sign in with Google')
    }), githubLoginLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      align: "left",
      size: "sm",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconGithub, {
        size: "xs"
      }),
      href: githubLoginLink,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sign in with GitHub')
    }), vstsLoginLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      align: "left",
      size: "sm",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconVsts, {
        size: "xs"
      }),
      href: vstsLoginLink,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sign in with Azure DevOps')
    })]
  });
};

LoginProviders.displayName = "LoginProviders";

class LoginForm extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      errorMessage: null,
      errors: {}
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async (data, onSuccess, onError) => {
      try {
        const response = await this.props.api.requestPromise('/auth/login/', {
          method: 'POST',
          data
        });
        onSuccess(data); // TODO(epurkhiser): There is likely more that needs to happen to update
        // the application state after user login.

        sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_12__["default"].set('user', response.user); // TODO(epurkhiser): Reconfigure sentry SDK identity

        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
          pathname: response.nextUri
        });
      } catch (e) {
        if (!e.responseJSON || !e.responseJSON.errors) {
          onError(e);
          return;
        }

        let message = e.responseJSON.detail;

        if (e.responseJSON.errors.__all__) {
          message = e.responseJSON.errors.__all__;
        }

        this.setState({
          errorMessage: message,
          errors: e.responseJSON.errors || {}
        });
        onError(e);
      }
    });
  }

  render() {
    const {
      errorMessage,
      errors
    } = this.state;
    const {
      githubLoginLink,
      vstsLoginLink
    } = this.props.authConfig;
    const hasLoginProvider = !!(githubLoginLink || vstsLoginLink);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_16__.ClassNames, {
      children: _ref2 => {
        let {
          css
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(FormWrapper, {
          hasLoginProvider: hasLoginProvider,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_6__["default"], {
            submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Continue'),
            onSubmit: this.handleSubmit,
            footerClass: css`
                ${sentry_views_auth_login__WEBPACK_IMPORTED_MODULE_14__.formFooterClass}
              `,
            errorMessage: errorMessage,
            extraButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(LostPasswordLink, {
              to: "/account/recover/",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Lost your password?')
            }),
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
              name: "username",
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('username or email'),
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Account'),
              error: errors.username,
              required: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_deprecatedforms_passwordField__WEBPACK_IMPORTED_MODULE_7__["default"], {
              name: "password",
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('password'),
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Password'),
              error: errors.password,
              required: true
            })]
          }), hasLoginProvider && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(LoginProviders, {
            vstsLoginLink,
            githubLoginLink
          })]
        });
      }
    });
  }

}

LoginForm.displayName = "LoginForm";

const FormWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1f436793"
} : 0)("display:grid;gap:60px;grid-template-columns:", p => p.hasLoginProvider ? '1fr 0.8fr' : '1fr', ";" + ( true ? "" : 0));

const ProviderHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1f436792"
} : 0)( true ? {
  name: "1u5acre",
  styles: "margin:0;font-size:15px;font-weight:bold;line-height:24px"
} : 0);

const ProviderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1f436791"
} : 0)("position:relative;display:grid;grid-auto-rows:max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";&:before{position:absolute;display:block;content:'';top:0;bottom:0;left:-30px;border-left:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));

const LostPasswordLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1f436790"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoginForm);

/***/ }),

/***/ "./app/views/auth/registerForm.tsx":
/*!*****************************************!*\
  !*** ./app/views/auth/registerForm.tsx ***!
  \*****************************************/
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/deprecatedforms/form */ "./app/components/deprecatedforms/form.tsx");
/* harmony import */ var sentry_components_deprecatedforms_passwordField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/deprecatedforms/passwordField */ "./app/components/deprecatedforms/passwordField.tsx");
/* harmony import */ var sentry_components_deprecatedforms_radioBooleanField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/deprecatedforms/radioBooleanField */ "./app/components/deprecatedforms/radioBooleanField.tsx");
/* harmony import */ var sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/deprecatedforms/textField */ "./app/components/deprecatedforms/textField.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_views_auth_login__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/auth/login */ "./app/views/auth/login.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const SubscribeField = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_deprecatedforms_radioBooleanField__WEBPACK_IMPORTED_MODULE_7__["default"], {
  name: "subscribe",
  yesLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Yes, I would like to receive updates via email'),
  noLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)("No, I'd prefer not to receive these updates"),
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)(`We'd love to keep you updated via email with product and feature
           announcements, promotions, educational materials, and events. Our
           updates focus on relevant information, and we'll never sell your data
           to third parties. See our [link] for more details.`, {
    link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("a", {
      href: "https://sentry.io/privacy/",
      children: "Privacy Policy"
    })
  })
});

SubscribeField.displayName = "SubscribeField";

class RegisterForm extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      errorMessage: null,
      errors: {}
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async (data, onSuccess, onError) => {
      const {
        api
      } = this.props;

      try {
        const response = await api.requestPromise('/auth/register/', {
          method: 'POST',
          data
        });
        onSuccess(data); // TODO(epurkhiser): There is more we need to do to setup the user. but
        // definitely primarily we need to init our user.

        sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_11__["default"].set('user', response.user);
        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
          pathname: response.nextUri
        });
      } catch (e) {
        if (!e.responseJSON || !e.responseJSON.errors) {
          onError(e);
          return;
        }

        let message = e.responseJSON.detail;

        if (e.responseJSON.errors.__all__) {
          message = e.responseJSON.errors.__all__;
        }

        this.setState({
          errorMessage: message,
          errors: e.responseJSON.errors || {}
        });
        onError(e);
      }
    });
  }

  render() {
    const {
      hasNewsletter
    } = this.props.authConfig;
    const {
      errorMessage,
      errors
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_14__.ClassNames, {
      children: _ref => {
        let {
          css
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
          initialData: {
            subscribe: true
          },
          submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Continue'),
          onSubmit: this.handleSubmit,
          footerClass: css`
              ${sentry_views_auth_login__WEBPACK_IMPORTED_MODULE_12__.formFooterClass}
            `,
          errorMessage: errorMessage,
          extraButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(PrivacyPolicyLink, {
            href: "https://sentry.io/privacy/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Privacy Policy')
          }),
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
            name: "name",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Jane Bloggs'),
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Name'),
            error: errors.name,
            required: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_8__["default"], {
            name: "username",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('you@example.com'),
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Email'),
            error: errors.username,
            required: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_deprecatedforms_passwordField__WEBPACK_IMPORTED_MODULE_6__["default"], {
            name: "password",
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('something super secret'),
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Password'),
            error: errors.password,
            required: true
          }), hasNewsletter && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(SubscribeField, {})]
        });
      }
    });
  }

}

RegisterForm.displayName = "RegisterForm";

const PrivacyPolicyLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e138ohel0"
} : 0)("color:", p => p.theme.gray300, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RegisterForm);

/***/ }),

/***/ "./app/views/auth/ssoForm.tsx":
/*!************************************!*\
  !*** ./app/views/auth/ssoForm.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/deprecatedforms/form */ "./app/components/deprecatedforms/form.tsx");
/* harmony import */ var sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/deprecatedforms/textField */ "./app/components/deprecatedforms/textField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class SsoForm extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      errorMessage: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async (data, onSuccess, onError) => {
      const {
        api
      } = this.props;

      try {
        const response = await api.requestPromise('/auth/sso-locate/', {
          method: 'POST',
          data
        });
        onSuccess(data);
        react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
          pathname: response.nextUri
        });
      } catch (e) {
        if (!e.responseJSON) {
          onError(e);
          return;
        }

        const message = e.responseJSON.detail;
        this.setState({
          errorMessage: message
        });
        onError(e);
      }
    });
  }

  render() {
    const {
      serverHostname
    } = this.props.authConfig;
    const {
      errorMessage
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_deprecatedforms_form__WEBPACK_IMPORTED_MODULE_4__["default"], {
      className: "form-stacked",
      submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Continue'),
      onSubmit: this.handleSubmit,
      footerClass: "auth-footer",
      errorMessage: errorMessage,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_deprecatedforms_textField__WEBPACK_IMPORTED_MODULE_5__["default"], {
        name: "organization",
        placeholder: "acme",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Organization ID'),
        required: true,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Your ID is the slug after the hostname. e.g. [example] is [slug].', {
          slug: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("strong", {
            children: "acme"
          }),
          example: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(SlugExample, {
            slug: "acme",
            hostname: serverHostname
          })
        })
      })
    });
  }

}

SsoForm.displayName = "SsoForm";

const SlugExample = _ref => {
  let {
    hostname,
    slug
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("code", {
    children: [hostname, "/", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("strong", {
      children: slug
    })]
  });
};

SlugExample.displayName = "SlugExample";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SsoForm);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_auth_login_tsx.c4d687462170e584f93b9eeb8f58dfbb.js.map