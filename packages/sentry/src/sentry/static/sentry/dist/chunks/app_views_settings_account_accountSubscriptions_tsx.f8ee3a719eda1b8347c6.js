"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSubscriptions_tsx"],{

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

/***/ "./app/views/settings/account/accountSubscriptions.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/account/accountSubscriptions.tsx ***!
  \*************************************************************/
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
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/groupBy */ "../node_modules/lodash/groupBy.js");
/* harmony import */ var lodash_groupBy__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_groupBy__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const ENDPOINT = '/users/me/subscriptions/';

class AccountSubscriptions extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggle", (subscription, index, _e) => {
      const subscribed = !subscription.subscribed;
      const oldSubscriptions = this.state.subscriptions;
      this.setState(state => {
        const newSubscriptions = state.subscriptions.slice();
        newSubscriptions[index] = { ...subscription,
          subscribed,
          subscribedDate: new Date().toString()
        };
        return { ...state,
          subscriptions: newSubscriptions
        };
      });
      this.api.request(ENDPOINT, {
        method: 'PUT',
        data: {
          listId: subscription.listId,
          subscribed
        },
        success: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)(`${subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.listName}`);
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(`Unable to ${subscribed ? '' : 'un'}subscribe to ${subscription.listName}`);
          this.setState({
            subscriptions: oldSubscriptions
          });
        }
      });
    });
  }

  getEndpoints() {
    return [['subscriptions', ENDPOINT]];
  }

  getTitle() {
    return 'Subscriptions';
  }

  renderBody() {
    const subGroups = Object.entries(lodash_groupBy__WEBPACK_IMPORTED_MODULE_4___default()(this.state.subscriptions, sub => sub.email));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: "Subscriptions"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`Sentry is committed to respecting your inbox. Our goal is to
              provide useful content and resources that make fixing errors less
              painful. Enjoyable even.`)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`As part of our compliance with the EU’s General Data Protection
              Regulation (GDPR), starting on 25 May 2018, we’ll only email you
              according to the marketing categories to which you’ve explicitly
              opted-in.`)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
        children: this.state.subscriptions.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Subscription')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody, {
            children: subGroups.map(_ref => {
              let [email, subscriptions] = _ref;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                children: [subGroups.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Heading, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconToggle, {}), " ", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Subscriptions for %s', email)]
                }), subscriptions.map((subscription, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelItem, {
                  center: true,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(SubscriptionDetails, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SubscriptionName, {
                      children: subscription.listName
                    }), subscription.listDescription && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Description, {
                      children: subscription.listDescription
                    }), subscription.subscribed ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SubscribedDescription, {
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
                        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('[email] on [date]', {
                          email: subscription.email,
                          date: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
                            date: moment__WEBPACK_IMPORTED_MODULE_5___default()(subscription.subscribedDate)
                          })
                        })
                      })
                    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SubscribedDescription, {
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Not currently subscribed')
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      isActive: subscription.subscribed,
                      size: "lg",
                      toggle: this.handleToggle.bind(this, subscription, index)
                    })
                  })]
                }, subscription.listId))]
              }, email);
            })
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("There's no subscription backend present.")
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)(`We’re applying GDPR consent and privacy policies to all Sentry
              contacts, regardless of location. You’ll be able to manage your
              subscriptions here and from an Unsubscribe link in the footer of
              all marketing emails.`)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Please contact [email:learn@sentry.io] with any questions or suggestions.', {
          email: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("a", {
            href: "mailto:learn@sentry.io"
          })
        })
      })]
    });
  }

}

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelItem,  true ? {
  target: "e1lg29ww4"
} : 0)("display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:center;font-size:", p => p.theme.fontSizeMedium, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";background:", p => p.theme.backgroundSecondary, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const SubscriptionDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lg29ww3"
} : 0)("width:50%;padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

const SubscriptionName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lg29ww2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1lg29ww1"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const SubscribedDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Description,  true ? {
  target: "e1lg29ww0"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountSubscriptions);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSubscriptions_tsx.23a52a46a1dc1a7a9a39da7d3e27c206.js.map