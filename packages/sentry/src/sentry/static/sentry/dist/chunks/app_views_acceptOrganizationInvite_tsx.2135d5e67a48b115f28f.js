"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_acceptOrganizationInvite_tsx"],{

/***/ "./app/components/narrowLayout.tsx":
/*!*****************************************!*\
  !*** ./app/components/narrowLayout.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function NarrowLayout(_ref) {
  let {
    maxWidth,
    showLogout,
    children
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    document.body.classList.add('narrow');
    return () => document.body.classList.remove('narrow');
  }, []);

  async function handleLogout() {
    await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__.logout)(api);
    window.location.assign('/auth/login');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "app",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "pattern-bg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "container",
      style: {
        maxWidth
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
        className: "box box-modal",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "box-header",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            href: "/",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry, {
              size: "lg"
            })
          }), showLogout && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            className: "logout pull-right",
            onClick: handleLogout,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Logout, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sign out')
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
          className: "box-content with-padding",
          children: children
        })]
      })
    })]
  });
}

NarrowLayout.displayName = "NarrowLayout";

const Logout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eaq1ri90"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NarrowLayout);

/***/ }),

/***/ "./app/views/acceptOrganizationInvite.tsx":
/*!************************************************!*\
  !*** ./app/views/acceptOrganizationInvite.tsx ***!
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
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @sentry/utils */ "../node_modules/@sentry/utils/esm/object.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/narrowLayout */ "./app/components/narrowLayout.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class AcceptOrganizationInvite extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLogout", async e => {
      e.preventDefault();
      await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_6__.logout)(this.api);
      window.location.replace(this.makeNextUrl('/auth/login/'));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAcceptInvite", async () => {
      const {
        memberId,
        token
      } = this.props.params;
      this.setState({
        accepting: true
      });

      try {
        await this.api.requestPromise(`/accept-invite/${memberId}/${token}/`, {
          method: 'POST'
        });
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace(`/${this.state.inviteDetails.orgSlug}/`);
      } catch {
        this.setState({
          acceptError: true
        });
      }

      this.setState({
        accepting: false
      });
    });
  }

  getEndpoints() {
    const {
      memberId,
      token
    } = this.props.params;
    return [['inviteDetails', `/accept-invite/${memberId}/${token}/`]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Accept Organization Invite');
  }

  makeNextUrl(path) {
    return `${path}?${(0,_sentry_utils__WEBPACK_IMPORTED_MODULE_17__.urlEncode)({
      next: window.location.pathname
    })}`;
  }

  get existingMemberAlert() {
    const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_13__["default"].get('user');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
      type: "warning",
      "data-test-id": "existing-member",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Your account ([email]) is already a member of this organization. [switchLink:Switch accounts]?', {
        email: user.email,
        switchLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__["default"], {
          to: "",
          "data-test-id": "existing-member-link",
          onClick: this.handleLogout
        })
      })
    });
  }

  get authenticationActions() {
    const {
      inviteDetails
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [!inviteDetails.requireSso && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
        "data-test-id": "action-info-general",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`To continue, you must either create a new account, or login to an
              existing Sentry account.`)
      }), inviteDetails.hasAuthProvider && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
        "data-test-id": "action-info-sso",
        children: inviteDetails.requireSso ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)(`Note that [orgSlug] has required Single Sign-On (SSO) using
               [authProvider]. You may create an account by authenticating with
               the organization's SSO provider.`, {
          orgSlug: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
            children: inviteDetails.orgSlug
          }),
          authProvider: inviteDetails.ssoProvider
        }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)(`Note that [orgSlug] has enabled Single Sign-On (SSO) using
               [authProvider]. You may create an account by authenticating with
               the organization's SSO provider.`, {
          orgSlug: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
            children: inviteDetails.orgSlug
          }),
          authProvider: inviteDetails.ssoProvider
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Actions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ActionsLeft, {
          children: [inviteDetails.hasAuthProvider && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            "aria-label": "sso-login",
            priority: "primary",
            href: this.makeNextUrl(`/auth/login/${inviteDetails.orgSlug}/`),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Join with %s', inviteDetails.ssoProvider)
          }), !inviteDetails.requireSso && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            "aria-label": "create-account",
            priority: "primary",
            href: this.makeNextUrl('/auth/register/'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Create a new account')
          })]
        }), !inviteDetails.requireSso && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
          href: this.makeNextUrl('/auth/login/'),
          openInNewTab: false,
          "data-test-id": "link-with-existing",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Login using an existing account')
        })]
      })]
    });
  }

  get warning2fa() {
    const {
      inviteDetails
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
        "data-test-id": "2fa-warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('To continue, [orgSlug] requires all members to configure two-factor authentication.', {
          orgSlug: inviteDetails.orgSlug
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          priority: "primary",
          to: "/settings/account/security/",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configure Two-Factor Auth')
        })
      })]
    });
  }

  get warningEmailVerification() {
    const {
      inviteDetails
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
        "data-test-id": "email-verification-warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('To continue, [orgSlug] requires all members to verify their email address.', {
          orgSlug: inviteDetails.orgSlug
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          priority: "primary",
          to: "/settings/account/emails/",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Verify Email Address')
        })
      })]
    });
  }

  get acceptActions() {
    const {
      inviteDetails,
      accepting
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [inviteDetails.hasAuthProvider && !inviteDetails.requireSso && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
        "data-test-id": "action-info-sso",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)(`Note that [orgSlug] has enabled Single Sign-On (SSO) using
               [authProvider]. You may join the organization by authenticating with
               the organization's SSO provider or via your standard account authentication.`, {
          orgSlug: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
            children: inviteDetails.orgSlug
          }),
          authProvider: inviteDetails.ssoProvider
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ActionsLeft, {
          children: [inviteDetails.hasAuthProvider && !inviteDetails.requireSso && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            "aria-label": "sso-login",
            priority: "primary",
            href: this.makeNextUrl(`/auth/login/${inviteDetails.orgSlug}/`),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Join with %s', inviteDetails.ssoProvider)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            "aria-label": "join-organization",
            priority: "primary",
            disabled: accepting,
            onClick: this.handleAcceptInvite,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Join the %s organization', inviteDetails.orgSlug)
          })]
        })
      })]
    });
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_11__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This organization invite link is no longer valid.')
      })
    });
  }

  renderBody() {
    const {
      inviteDetails,
      acceptError
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_11__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Accept organization invite')
      }), acceptError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "error",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Failed to join this organization. Please try again')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(InviteDescription, {
        "data-test-id": "accept-invite",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[orgSlug] is using Sentry to track and debug errors.', {
          orgSlug: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
            children: inviteDetails.orgSlug
          })
        })
      }), inviteDetails.needsAuthentication ? this.authenticationActions : inviteDetails.existingMember ? this.existingMemberAlert : inviteDetails.needs2fa ? this.warning2fa : inviteDetails.needsEmailVerification ? this.warningEmailVerification : inviteDetails.requireSso ? this.authenticationActions : this.acceptActions]
    });
  }

}

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1adv0ef2"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), ";" + ( true ? "" : 0));

const ActionsLeft = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1adv0ef1"
} : 0)(">a{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";}" + ( true ? "" : 0));

const InviteDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1adv0ef0"
} : 0)( true ? {
  name: "1elbn1z",
  styles: "font-size:1.2em"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AcceptOrganizationInvite);

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_acceptOrganizationInvite_tsx.5b3f6c629d8cdc65288549c154e6a910.js.map