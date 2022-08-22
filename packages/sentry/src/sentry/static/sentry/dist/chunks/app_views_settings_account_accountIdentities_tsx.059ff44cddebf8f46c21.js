"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountIdentities_tsx"],{

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

/***/ "./app/views/settings/account/accountIdentities.tsx":
/*!**********************************************************!*\
  !*** ./app/views/settings/account/accountIdentities.tsx ***!
  \**********************************************************/
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
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_identityIcon__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/identityIcon */ "./app/views/settings/components/identityIcon.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const ENDPOINT = '/users/me/user-identities/';

class AccountIdentities extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderItem", identity => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(IdentityPanelItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(InternalContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_identityIcon__WEBPACK_IMPORTED_MODULE_17__["default"], {
            providerId: identity.provider.key
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(IdentityText, {
            isSingleLine: !identity.dateAdded,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(IdentityName, {
              children: identity.provider.name
            }), identity.dateAdded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(IdentityDateTime, {
              date: moment__WEBPACK_IMPORTED_MODULE_4___default()(identity.dateAdded)
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(InternalContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(TagWrapper, {
            children: [identity.category === sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.SOCIAL_IDENTITY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__["default"], {
              type: "default",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Legacy')
            }), identity.category !== sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.ORG_IDENTITY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__["default"], {
              type: "default",
              children: identity.isLogin ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sign In') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Integration')
            }), identity.organization && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__["default"], {
              type: "highlight",
              children: identity.organization.slug
            })]
          }), this.renderButton(identity)]
        })]
      }, `${identity.category}:${identity.id}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisconnect", identity => {
      (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_5__.disconnectIdentity)(identity, () => this.reloadData());
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "itemOrder", (a, b) => {
      var _a$organization$name, _a$organization, _b$organization$name, _b$organization;

      function categoryRank(c) {
        return [sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.GLOBAL_IDENTITY, sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.SOCIAL_IDENTITY, sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.ORG_IDENTITY].indexOf(c.category);
      }

      if (a.provider.name !== b.provider.name) {
        return a.provider.name < b.provider.name ? -1 : 1;
      }

      if (a.category !== b.category) {
        return categoryRank(a) - categoryRank(b);
      }

      if (((_a$organization$name = (_a$organization = a.organization) === null || _a$organization === void 0 ? void 0 : _a$organization.name) !== null && _a$organization$name !== void 0 ? _a$organization$name : '') !== ((_b$organization$name = (_b$organization = b.organization) === null || _b$organization === void 0 ? void 0 : _b$organization.name) !== null && _b$organization$name !== void 0 ? _b$organization$name : '')) {
        var _a$organization$name2, _a$organization2, _b$organization$name2, _b$organization2;

        return ((_a$organization$name2 = (_a$organization2 = a.organization) === null || _a$organization2 === void 0 ? void 0 : _a$organization2.name) !== null && _a$organization$name2 !== void 0 ? _a$organization$name2 : '') < ((_b$organization$name2 = (_b$organization2 = b.organization) === null || _b$organization2 === void 0 ? void 0 : _b$organization2.name) !== null && _b$organization$name2 !== void 0 ? _b$organization$name2 : '') ? -1 : 1;
      }

      return 0;
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      identities: []
    };
  }

  getEndpoints() {
    return [['identities', ENDPOINT]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Identities');
  }

  renderButton(identity) {
    return identity.status === sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityStatus.CAN_DISCONNECT ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
      onConfirm: () => this.handleDisconnect(identity),
      priority: "danger",
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Disconnect'),
      message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Disconnect Your [provider] Identity?', {
            provider: identity.provider.name
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_19__["default"], {
          children: identity.isLogin ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('After disconnecting, you will need to use a password or another identity to sign in.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("This action can't be undone.")
        })]
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: "sm",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Disconnect')
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
      size: "sm",
      disabled: true,
      title: identity.status === sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You need this identity to sign into your account. If you want to disconnect it, set a password first.') : identity.status === sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityStatus.NEEDED_FOR_ORG_AUTH ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You need this identity to access your organization.') : null,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Disconnect')
    });
  }

  renderBody() {
    var _this$state$identitie, _this$state$identitie2;

    const appIdentities = (_this$state$identitie = this.state.identities) === null || _this$state$identitie === void 0 ? void 0 : _this$state$identitie.filter(identity => identity.category !== sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.ORG_IDENTITY).sort(this.itemOrder);
    const orgIdentities = (_this$state$identitie2 = this.state.identities) === null || _this$state$identitie2 === void 0 ? void 0 : _this$state$identitie2.filter(identity => identity.category === sentry_types__WEBPACK_IMPORTED_MODULE_14__.UserIdentityCategory.ORG_IDENTITY).sort(this.itemOrder);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_18__["default"], {
        title: "Identities"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Application Identities')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
          children: !(appIdentities !== null && appIdentities !== void 0 && appIdentities.length) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('There are no application identities associated with your Sentry account')
          }) : appIdentities.map(this.renderItem)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Organization Identities')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
          children: !(orgIdentities !== null && orgIdentities !== void 0 && orgIdentities.length) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_16__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('There are no organization identities associated with your Sentry account')
          }) : orgIdentities.map(this.renderItem)
        })]
      })]
    });
  }

}

const IdentityPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelItem,  true ? {
  target: "e1mvbtt45"
} : 0)( true ? {
  name: "1tz8p38",
  styles: "align-items:center;justify-content:space-between"
} : 0);

const InternalContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1mvbtt44"
} : 0)( true ? {
  name: "jor0o8",
  styles: "display:flex;flex-direction:row;justify-content:center"
} : 0);

const IdentityText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1mvbtt43"
} : 0)("height:36px;display:flex;flex-direction:column;justify-content:", p => p.isSingleLine ? 'center' : 'space-between', ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";" + ( true ? "" : 0));

const IdentityName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1mvbtt42"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const IdentityDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1mvbtt41"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const TagWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1mvbtt40"
} : 0)("display:flex;align-items:center;justify-content:flex-start;flex-grow:1;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountIdentities);

/***/ }),

/***/ "./app/views/settings/components/identityIcon.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/components/identityIcon.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_ICON": () => (/* binding */ DEFAULT_ICON),
/* harmony export */   "ICON_PATHS": () => (/* binding */ ICON_PATHS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_logos_logo_asana_svg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry-logos/logo-asana.svg */ "../src/sentry/static/sentry/images/logos/logo-asana.svg");
/* harmony import */ var sentry_logos_logo_auth0_svg__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry-logos/logo-auth0.svg */ "../src/sentry/static/sentry/images/logos/logo-auth0.svg");
/* harmony import */ var sentry_logos_logo_azure_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-logos/logo-azure.svg */ "../src/sentry/static/sentry/images/logos/logo-azure.svg");
/* harmony import */ var sentry_logos_logo_bitbucket_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-logos/logo-bitbucket.svg */ "../src/sentry/static/sentry/images/logos/logo-bitbucket.svg");
/* harmony import */ var sentry_logos_logo_bitbucket_server_svg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry-logos/logo-bitbucket-server.svg */ "../src/sentry/static/sentry/images/logos/logo-bitbucket-server.svg");
/* harmony import */ var sentry_logos_logo_default_svg__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry-logos/logo-default.svg */ "../src/sentry/static/sentry/images/logos/logo-default.svg");
/* harmony import */ var sentry_logos_logo_github_svg__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry-logos/logo-github.svg */ "../src/sentry/static/sentry/images/logos/logo-github.svg");
/* harmony import */ var sentry_logos_logo_github_enterprise_svg__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry-logos/logo-github-enterprise.svg */ "../src/sentry/static/sentry/images/logos/logo-github-enterprise.svg");
/* harmony import */ var sentry_logos_logo_gitlab_svg__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry-logos/logo-gitlab.svg */ "../src/sentry/static/sentry/images/logos/logo-gitlab.svg");
/* harmony import */ var sentry_logos_logo_google_svg__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry-logos/logo-google.svg */ "../src/sentry/static/sentry/images/logos/logo-google.svg");
/* harmony import */ var sentry_logos_logo_jira_server_svg__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry-logos/logo-jira-server.svg */ "../src/sentry/static/sentry/images/logos/logo-jira-server.svg");
/* harmony import */ var sentry_logos_logo_jumpcloud_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry-logos/logo-jumpcloud.svg */ "../src/sentry/static/sentry/images/logos/logo-jumpcloud.svg");
/* harmony import */ var sentry_logos_logo_msteams_svg__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry-logos/logo-msteams.svg */ "../src/sentry/static/sentry/images/logos/logo-msteams.svg");
/* harmony import */ var sentry_logos_logo_okta_svg__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry-logos/logo-okta.svg */ "../src/sentry/static/sentry/images/logos/logo-okta.svg");
/* harmony import */ var sentry_logos_logo_onelogin_svg__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry-logos/logo-onelogin.svg */ "../src/sentry/static/sentry/images/logos/logo-onelogin.svg");
/* harmony import */ var sentry_logos_logo_rippling_svg__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry-logos/logo-rippling.svg */ "../src/sentry/static/sentry/images/logos/logo-rippling.svg");
/* harmony import */ var sentry_logos_logo_saml2_svg__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry-logos/logo-saml2.svg */ "../src/sentry/static/sentry/images/logos/logo-saml2.svg");
/* harmony import */ var sentry_logos_logo_slack_svg__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry-logos/logo-slack.svg */ "../src/sentry/static/sentry/images/logos/logo-slack.svg");
/* harmony import */ var sentry_logos_logo_visualstudio_svg__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry-logos/logo-visualstudio.svg */ "../src/sentry/static/sentry/images/logos/logo-visualstudio.svg");



















 // Map of plugin id -> logo filename

const DEFAULT_ICON = sentry_logos_logo_default_svg__WEBPACK_IMPORTED_MODULE_6__;
const ICON_PATHS = {
  _default: DEFAULT_ICON,
  'active-directory': sentry_logos_logo_azure_svg__WEBPACK_IMPORTED_MODULE_3__,
  asana: sentry_logos_logo_asana_svg__WEBPACK_IMPORTED_MODULE_1__,
  auth0: sentry_logos_logo_auth0_svg__WEBPACK_IMPORTED_MODULE_2__,
  bitbucket: sentry_logos_logo_bitbucket_svg__WEBPACK_IMPORTED_MODULE_4__,
  bitbucket_server: sentry_logos_logo_bitbucket_server_svg__WEBPACK_IMPORTED_MODULE_5__,
  github: sentry_logos_logo_github_svg__WEBPACK_IMPORTED_MODULE_7__,
  github_enterprise: sentry_logos_logo_github_enterprise_svg__WEBPACK_IMPORTED_MODULE_8__,
  gitlab: sentry_logos_logo_gitlab_svg__WEBPACK_IMPORTED_MODULE_9__,
  google: sentry_logos_logo_google_svg__WEBPACK_IMPORTED_MODULE_10__,
  jira_server: sentry_logos_logo_jira_server_svg__WEBPACK_IMPORTED_MODULE_11__,
  jumpcloud: sentry_logos_logo_jumpcloud_svg__WEBPACK_IMPORTED_MODULE_12__,
  msteams: sentry_logos_logo_msteams_svg__WEBPACK_IMPORTED_MODULE_13__,
  okta: sentry_logos_logo_okta_svg__WEBPACK_IMPORTED_MODULE_14__,
  onelogin: sentry_logos_logo_onelogin_svg__WEBPACK_IMPORTED_MODULE_15__,
  rippling: sentry_logos_logo_rippling_svg__WEBPACK_IMPORTED_MODULE_16__,
  saml2: sentry_logos_logo_saml2_svg__WEBPACK_IMPORTED_MODULE_17__,
  slack: sentry_logos_logo_slack_svg__WEBPACK_IMPORTED_MODULE_18__,
  visualstudio: sentry_logos_logo_visualstudio_svg__WEBPACK_IMPORTED_MODULE_19__,
  vsts: sentry_logos_logo_azure_svg__WEBPACK_IMPORTED_MODULE_3__
};

const IdentityIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey6d5bz0"
} : 0)("position:relative;height:", p => p.size, "px;width:", p => p.size, "px;border-radius:2px;border:0;display:inline-block;background-size:contain;background-position:center center;background-repeat:no-repeat;background-image:url(", p => p.providerId !== undefined && ICON_PATHS[p.providerId] || DEFAULT_ICON, ");" + ( true ? "" : 0));

IdentityIcon.defaultProps = {
  providerId: '_default',
  size: 36
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IdentityIcon);

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-auth0.svg":
/*!***************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-auth0.svg ***!
  \***************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTYxIDY0LjU2TDUzIDM5LjlsMjEtMTUuMjNINDhMNDAgMGgyNS45M2w4IDI0LjY2YTM1LjY5IDM1LjY5IDAgMDEtMTMgMzkuOXptLTQyIDBsMjEgMTUuMjUgMjEtMTUuMjUtMjEtMTUuMjR6TTYgMjQuNjZhMzUuNzIgMzUuNzIgMCAwMDEzIDM5LjkxbDgtMjQuNjdMNiAyNC42N2gyNkw0MCAwSDE0LjA3eiIgZmlsbD0iI2ViNTQyNCIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+";

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-google.svg":
/*!****************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-google.svg ***!
  \****************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTc4LjUyIDMyLjc2QzgxIDQ5LjQyIDc2LjE1IDYyLjMgNjcuMjQgNzAuMzlsLTEyLjYyLTkuODNhMjAuNzQgMjAuNzQgMCAwMDguMTktMTIuMzdINDAuOTJWMzIuNzZ6IiBmaWxsPSIjNDI4NmY1Ii8+PHBhdGggZD0iTTY3LjY4IDEwLjMzbC0xMS41IDExLjM2YTIyLjA1IDIyLjA1IDAgMDAtMTUuMzMtNiAyNCAyNCAwIDAwLTIyLjcgMTYuNThMNS4wOCAyMi4wOWE0MCA0MCAwIDAxNjIuNi0xMS43NnoiIGZpbGw9IiNlYTQyMzUiLz48cGF0aCBkPSJNNTQuNjIgNjAuNTZsMTIuNjIgOS44M0M2MC4zNiA3Ni42NCA1MS4wNSA4MCA0MC44NSA4MEE0MCA0MCAwIDAxNS4wOCA1Ny45MWwxMy4wNy0xMC4xNGEyNCAyNCAwIDAwMjIuNyAxNi41N2M1LjcxIDAgMTAuMjctMS4zNCAxMy43Ny0zLjc4eiIgZmlsbD0iIzM0YTg1MyIvPjxwYXRoIGQ9Ik01LjA4IDIyLjA5bDEzLjA3IDEwLjE1YTI0Ljc0IDI0Ljc0IDAgMDAwIDE1LjUzTDUuMDggNTcuOTFhNDAgNDAgMCAwMTAtMzUuODJ6IiBmaWxsPSIjZmJiYzA1Ii8+PC9zdmc+";

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-okta.svg":
/*!**************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-okta.svg ***!
  \**************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTgwIDQwQTQwIDQwIDAgMTE0MCAwYTQwIDQwIDAgMDE0MCA0MHpNNDAgMTkuNzlBMjAuMjEgMjAuMjEgMCAxMDYwLjIxIDQwIDIwLjIxIDIwLjIxIDAgMDA0MCAxOS43OXoiIGZpbGw9IiMwMDdkYzEiLz48L3N2Zz4=";

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-onelogin.svg":
/*!******************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-onelogin.svg ***!
  \******************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTQwIDBhNDAgNDAgMCAxMDQwIDQwQTQwIDQwIDAgMDA0MCAweiIgZmlsbD0iIzFjMWYyYSIvPjxwYXRoIGQ9Ik00NiA1NC4xNWExIDEgMCAwMS0xLjE1IDEuMTVoLTcuMjJhMSAxIDAgMDEtMS4xNS0xLjE1VjM2LjgySDMxYTEgMSAwIDAxLTEuMTYtMS4xNXYtNy4xOUExIDEgMCAwMTMxIDI3LjMzaDE0Yy43NSAwIC45My4zOS45My45M3YyNS44OXoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=";

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-rippling.svg":
/*!******************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-rippling.svg ***!
  \******************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTgwIDQwQTQwIDQwIDAgMTE0MCAwYTQwIDQwIDAgMDE0MCA0MHpNNDAgOC42OEEzMS4zMiAzMS4zMiAwIDEwNzEuMzIgNDAgMzEuMzIgMzEuMzIgMCAwMDQwIDguNjh6Ii8+PHBhdGggZD0iTTY2LjQ0IDQwQTI2LjQ0IDI2LjQ0IDAgMTE0MCAxMy41NiAyNi40NCAyNi40NCAwIDAxNjYuNDQgNDB6TTQwIDE4LjkyQTIxLjA4IDIxLjA4IDAgMTA2MS4wOCA0MCAyMS4wOCAyMS4wOCAwIDAwNDAgMTguOTJ6Ii8+PHBhdGggZD0iTTU1LjI0IDQwQTE1LjI0IDE1LjI0IDAgMTE0MCAyNC43NiAxNS4yNCAxNS4yNCAwIDAxNTUuMjQgNDB6TTQwIDI5YTExIDExIDAgMTAxMSAxMSAxMSAxMSAwIDAwLTExLTExeiIvPjwvc3ZnPg==";

/***/ }),

/***/ "../src/sentry/static/sentry/images/logos/logo-saml2.svg":
/*!***************************************************************!*\
  !*** ../src/sentry/static/sentry/images/logos/logo-saml2.svg ***!
  \***************************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MCA4MCI+PHBhdGggZD0iTTc5LjQ1IDU1Ljc5YS4yNS4yNSAwIDAxLS4yMS0uMTJjLS4yNC0uMzktMjQuMTctMzkuNTItMzguMi0zNi0uMTQgMC0xMS45MyAyLTE3Ljg3IDI3LjgzYS4yNC4yNCAwIDAxLS4yOS4xOS4yNS4yNSAwIDAxLS4yLS4yOGMuMDUtLjMgNC43Ni0zMC4wNiAxNS4zNS00NC44YS4yNS4yNSAwIDAxLjM0LS4wN2MuMjMuMTYgMjMuMTEgMTUuNzUgNDEuMzEgNTNhLjI0LjI0IDAgMDEtLjExLjMyLjI3LjI3IDAgMDEtLjEyLS4wN3oiIGZpbGw9IiNlZDAwMDAiLz48cGF0aCBkPSJNMjUuOTIgNWEuMjUuMjUgMCAwMTAgLjI1Yy0uMjIuNC0yMi4xNSA0MC42OS0xMi4xMyA1MS4xLjA5LjEyIDcuNzMgOS4zMiAzMyAxLjU3YS4yNC4yNCAwIDAxLjMxLjE1LjI1LjI1IDAgMDEtLjE0LjMyQzQ2LjY3IDU4LjUgMTguNTQgNjkuMy40OCA2Ny41YS4yNS4yNSAwIDAxLS4yMi0uMjdDLjMyIDY2LjkzIDIuMzggMzkuMzIgMjUuNSA1YS4yNS4yNSAwIDAxLjM0LS4wNy4yLjIgMCAwMS4wOC4wN3oiIGZpbGw9IiNlZDAwMDAiLz48cGF0aCBkPSJNOC42NCA3Ni43NGEuMjQuMjQgMCAwMS4yMS0uMTJjLjQ2IDAgNDYuMzEtMS4xNyA1MC4zMi0xNS4wNiAwLS4xMyA0LjItMTEuMzUtMTUuMTctMjkuMzlhLjI0LjI0IDAgMDEwLS4zNS4yNi4yNiAwIDAxLjM1IDBjLjIxLjE4IDIzLjY1IDE5LjEyIDMxLjEgMzUuNjdhLjI0LjI0IDAgMDEtLjExLjMyYy0uMjUuMTItMjUuMTkgMTIuMTUtNjYuNTEgOS4zYS4yNC4yNCAwIDAxLS4yMy0uMjUuMjguMjggMCAwMS4wNC0uMTJ6IiBmaWxsPSIjZWQwMDAwIi8+PC9zdmc+";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountIdentities_tsx.dca6c6fe4bdcd8fddb1cb102ae5a5776.js.map