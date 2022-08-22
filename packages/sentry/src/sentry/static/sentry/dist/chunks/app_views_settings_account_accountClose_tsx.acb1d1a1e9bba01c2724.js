"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountClose_tsx"],{

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

/***/ "./app/views/settings/account/accountClose.tsx":
/*!*****************************************************!*\
  !*** ./app/views/settings/account/accountClose.tsx ***!
  \*****************************************************/
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
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const BYE_URL = '/';

const leaveRedirect = () => window.location.href = BYE_URL;

const Important = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1tikij10"
} : 0)( true ? {
  name: "14rp7vr",
  styles: "font-weight:bold;font-size:1.2em"
} : 0);

const GoodbyeModalContent = _ref => {
  let {
    Header,
    Body,
    Footer
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Closing Account')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Your account has been deactivated and scheduled for removal.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Thanks for using Sentry! We hope to see you again soon!')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        href: BYE_URL,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Goodbye')
      })
    })]
  });
};

GoodbyeModalContent.displayName = "GoodbyeModalContent";

class AccountClose extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "leaveRedirectTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (_ref2, isSingle, event) => {
      let {
        slug
      } = _ref2;
      const checked = event.target.checked; // Can't unselect an org where you are the single owner

      if (isSingle) {
        return;
      }

      this.setState(state => {
        const set = state.orgsToRemove || new Set(this.singleOwnerOrgs);

        if (checked) {
          set.add(slug);
        } else {
          set.delete(slug);
        }

        return {
          orgsToRemove: set
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemoveAccount", async () => {
      const {
        orgsToRemove
      } = this.state;
      const orgs = orgsToRemove === null ? this.singleOwnerOrgs : Array.from(orgsToRemove);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)('Closing account\u2026');

      try {
        await this.api.requestPromise('/users/me/', {
          method: 'DELETE',
          data: {
            organizations: orgs
          }
        });
        (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(GoodbyeModalContent, {
          onClose: leaveRedirect
        }); // Redirect after 10 seconds

        window.clearTimeout(this.leaveRedirectTimeout);
        this.leaveRedirectTimeout = window.setTimeout(leaveRedirect, 10000);
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)('Error closing account');
      }
    });
  }

  componentWillUnmount() {
    window.clearTimeout(this.leaveRedirectTimeout);
  }

  getEndpoints() {
    return [['organizations', '/organizations/?owner=1']];
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      orgsToRemove: null
    };
  }

  get singleOwnerOrgs() {
    var _this$state$organizat, _this$state$organizat2;

    return (_this$state$organizat = this.state.organizations) === null || _this$state$organizat === void 0 ? void 0 : (_this$state$organizat2 = _this$state$organizat.filter(_ref3 => {
      let {
        singleOwner
      } = _ref3;
      return singleOwner;
    })) === null || _this$state$organizat2 === void 0 ? void 0 : _this$state$organizat2.map(_ref4 => {
      let {
        organization
      } = _ref4;
      return organization.slug;
    });
  }

  renderBody() {
    const {
      organizations,
      orgsToRemove
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
        title: "Close Account"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_12__["default"], {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This will permanently remove all associated data for your user'), "."]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "error",
        showIcon: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Important, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Closing your account is permanent and cannot be undone'), "!"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Remove the following organizations')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelAlert, {
            type: "info",
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Ownership will remain with other organization owners if an organization is not deleted.'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("br", {}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)("Boxes which can't be unchecked mean that you are the only organization owner and the organization [strong:will be deleted].", {
              strong: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("strong", {})
            })]
          }), organizations === null || organizations === void 0 ? void 0 : organizations.map(_ref5 => {
            let {
              organization,
              singleOwner
            } = _ref5;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelItem, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("label", {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("input", {
                  style: {
                    marginRight: 6
                  },
                  type: "checkbox",
                  value: organization.slug,
                  onChange: this.handleChange.bind(this, organization, singleOwner),
                  name: "organizations",
                  checked: orgsToRemove === null ? singleOwner : orgsToRemove.has(organization.slug),
                  disabled: singleOwner
                }), organization.slug]
              })
            }, organization.slug);
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__["default"], {
        priority: "danger",
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This is permanent and cannot be undone, are you really sure you want to do this?'),
        onConfirm: this.handleRemoveAccount,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          priority: "danger",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Close Account')
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountClose);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountClose_tsx.e7166026d9a702f869b4ee411712cec4.js.map