"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_apiTokens_tsx"],{

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

/***/ "./app/views/settings/account/apiTokenRow.tsx":
/*!****************************************************!*\
  !*** ./app/views/settings/account/apiTokenRow.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function ApiTokenRow(_ref) {
  let {
    token,
    onRemove
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledPanelItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Controls, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(InputWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__["default"])({
            value: token.token,
            fixed: 'CI_AUTH_TOKEN'
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        size: "sm",
        onClick: () => onRemove(token),
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconSubtract, {
          isCircled: true,
          size: "xs"
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Remove')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Details, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ScopesWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Heading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Scopes')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ScopeList, {
          children: token.scopes.join(', ')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Heading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Created')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Time, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
            date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__["default"])({
              value: token.dateCreated,
              fixed: new Date(1508208080000) // National Pasta Day

            })
          })
        })]
      })]
    })]
  });
}

ApiTokenRow.displayName = "ApiTokenRow";

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem,  true ? {
  target: "eu9lu7u7"
} : 0)("flex-direction:column;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

const Controls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u6"
} : 0)("display:flex;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u5"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";flex:1;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u4"
} : 0)("display:flex;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const ScopesWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u3"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const ScopeList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u2"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";line-height:1.4;" + ( true ? "" : 0));

const Time = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('time',  true ? {
  target: "eu9lu7u1"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";line-height:1.4;" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eu9lu7u0"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";text-transform:uppercase;color:", p => p.theme.subText, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ApiTokenRow);

/***/ }),

/***/ "./app/views/settings/account/apiTokens.tsx":
/*!**************************************************!*\
  !*** ./app/views/settings/account/apiTokens.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ApiTokens": () => (/* binding */ ApiTokens),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_apiTokenRow__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/account/apiTokenRow */ "./app/views/settings/account/apiTokenRow.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class ApiTokens extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveToken", token => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)();
      const oldTokenList = this.state.tokenList;
      this.setState(state => {
        var _state$tokenList$filt, _state$tokenList;

        return {
          tokenList: (_state$tokenList$filt = (_state$tokenList = state.tokenList) === null || _state$tokenList === void 0 ? void 0 : _state$tokenList.filter(tk => tk.token !== token.token)) !== null && _state$tokenList$filt !== void 0 ? _state$tokenList$filt : []
        };
      }, async () => {
        try {
          await this.api.requestPromise('/api-tokens/', {
            method: 'DELETE',
            data: {
              token: token.token
            }
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Removed token'));
        } catch (_err) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to remove token. Please try again.'));
          this.setState({
            tokenList: oldTokenList
          });
        }
      });
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('API Tokens');
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      tokenList: []
    };
  }

  getEndpoints() {
    return [['tokenList', '/api-tokens/']];
  }

  renderBody() {
    var _organization$slug;

    const {
      organization
    } = this.props;
    const {
      tokenList
    } = this.state;
    const isEmpty = !Array.isArray(tokenList) || tokenList.length === 0;

    const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      priority: "primary",
      size: "sm",
      to: "/settings/account/api/auth-tokens/new-token/",
      "data-test-id": "create-token",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Create New Token')
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_12__["default"], {
        title: "Auth Tokens",
        action: action
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
        to: `/settings/${(_organization$slug = organization === null || organization === void 0 ? void 0 : organization.slug) !== null && _organization$slug !== void 0 ? _organization$slug : ''}/developer-settings/new-internal`,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)("Auth Tokens are tied to the logged in user, meaning they'll stop working if the user leaves the organization! We suggest using internal integrations to create/manage tokens tied to the organization instead.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)("Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_13__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('For more information on how to use the web API, see our [link:documentation].', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
            href: "https://docs.sentry.io/api/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Auth Token')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
          children: [isEmpty && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_11__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)("You haven't created any authentication tokens yet.")
          }), tokenList === null || tokenList === void 0 ? void 0 : tokenList.map(token => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_account_apiTokenRow__WEBPACK_IMPORTED_MODULE_10__["default"], {
            token: token,
            onRemove: this.handleRemoveToken
          }, token.token))]
        })]
      })]
    });
  }

}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(ApiTokens));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_apiTokens_tsx.0d3a2396e0226c239e63bf0d97a31e38.js.map