"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminMail_tsx"],{

/***/ "./app/views/admin/adminMail.tsx":
/*!***************************************!*\
  !*** ./app/views/admin/adminMail.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AdminMail)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class AdminMail extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sendTestEmail", async () => {
      const testMailEmail = this.state.data.testMailEmail;

      try {
        await this.api.requestPromise('/internal/mail/', {
          method: 'POST'
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('A test email has been sent to %s', testMailEmail));
      } catch (error) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)(error.responseJSON ? error.responseJSON.error : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to send test email. Check your server logs'));
      }
    });
  }

  getEndpoints() {
    return [['data', '/internal/mail/']];
  }

  renderBody() {
    const {
      data
    } = this.state;
    const {
      mailHost,
      mailPassword,
      mailUsername,
      mailPort,
      mailUseTls,
      mailUseSsl,
      mailFrom,
      mailListNamespace,
      testMailEmail
    } = data;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('SMTP Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("dl", {
        className: "vars",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('From Address')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailFrom
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Host')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("pre", {
            className: "val",
            children: [mailHost, ":", mailPort]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Username')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailUsername || (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("em", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('not set')
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Password')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailPassword ? '********' : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("em", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('not set')
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('STARTTLS?')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailUseTls ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Yes') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('No')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('SSL?')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailUseSsl ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Yes') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('No')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dt", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Mailing List Namespace')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("dd", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("pre", {
            className: "val",
            children: mailListNamespace
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Test Settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("Send an email to your account's email address to confirm that everything is configured correctly.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        onClick: this.sendTestEmail,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Send a test email to %s', testMailEmail)
      })]
    });
  }

}

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
//# sourceMappingURL=../sourcemaps/app_views_admin_adminMail_tsx.1193fff5e337e624d1bae7e7951cf78b.js.map