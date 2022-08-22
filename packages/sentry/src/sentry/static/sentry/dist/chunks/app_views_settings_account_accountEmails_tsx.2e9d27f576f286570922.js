"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountEmails_tsx"],{

/***/ "./app/data/forms/accountEmails.tsx":
/*!******************************************!*\
  !*** ./app/data/forms/accountEmails.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
// Export route to make these forms searchable by label/help
const route = '/settings/account/emails/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Add Secondary Emails',
  fields: [{
    name: 'email',
    type: 'string',
    // additional data/props that is related to rendering of form field rather than data
    label: 'Additional Email',
    placeholder: 'e.g. secondary@example.com',
    help: 'Designate an alternative email for this account',
    showReturnButton: true
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

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

/***/ }),

/***/ "./app/views/settings/account/accountEmails.tsx":
/*!******************************************************!*\
  !*** ./app/views/settings/account/accountEmails.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EmailAddresses": () => (/* binding */ EmailAddresses),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_data_forms_accountEmails__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/data/forms/accountEmails */ "./app/data/forms/accountEmails.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const ENDPOINT = '/users/me/emails/';

class AccountEmails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", (_change, model, id) => {
      if (id === undefined) {
        return;
      }

      model.setValue(id, '');
      this.remountComponent();
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Emails');
  }

  getEndpoints() {
    return [];
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Email Addresses')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(EmailAddresses, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__["default"], {
        apiMethod: "POST",
        apiEndpoint: ENDPOINT,
        saveOnBlur: true,
        allowUndo: false,
        onSubmitSuccess: this.handleSubmitSuccess,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_10__["default"], {
          forms: sentry_data_forms_accountEmails__WEBPACK_IMPORTED_MODULE_14__["default"]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: "/settings/account/notifications",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconStack, {}),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Want to change how many emails you get? Use the notifications panel.')
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountEmails);
class EmailAddresses extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSetPrimary", email => this.doApiCall(ENDPOINT, {
      method: 'PUT',
      data: {
        email
      }
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", email => this.doApiCall(ENDPOINT, {
      method: 'DELETE',
      data: {
        email
      }
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleVerify", email => this.doApiCall(`${ENDPOINT}confirm/`, {
      method: 'POST',
      data: {
        email
      }
    }));
  }

  getEndpoints() {
    return [['emails', ENDPOINT]];
  }

  doApiCall(endpoint, requestParams) {
    this.setState({
      loading: true,
      emails: []
    }, () => this.api.requestPromise(endpoint, requestParams).then(() => this.remountComponent()).catch(err => {
      var _err$responseJSON;

      this.remountComponent();

      if (err !== null && err !== void 0 && (_err$responseJSON = err.responseJSON) !== null && _err$responseJSON !== void 0 && _err$responseJSON.email) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(err.responseJSON.email);
      }
    }));
  }

  render() {
    const {
      emails,
      loading
    } = this.state;
    const primary = emails === null || emails === void 0 ? void 0 : emails.find(_ref => {
      let {
        isPrimary
      } = _ref;
      return isPrimary;
    });
    const secondary = emails === null || emails === void 0 ? void 0 : emails.filter(_ref2 => {
      let {
        isPrimary
      } = _ref2;
      return !isPrimary;
    });

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Email Addresses')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {})
        })]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Email Addresses')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
        children: [primary && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(EmailRow, {
          onRemove: this.handleRemove,
          onVerify: this.handleVerify,
          ...primary
        }), secondary === null || secondary === void 0 ? void 0 : secondary.map(emailObj => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(EmailRow, {
          onSetPrimary: this.handleSetPrimary,
          onRemove: this.handleRemove,
          onVerify: this.handleVerify,
          ...emailObj
        }, emailObj.email))]
      })]
    });
  }

}
EmailAddresses.displayName = "EmailAddresses";

const EmailRow = _ref3 => {
  let {
    email,
    onRemove,
    onVerify,
    onSetPrimary,
    isVerified,
    isPrimary,
    hideRemove
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(EmailItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(EmailTags, {
      children: [email, !isVerified && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_13__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unverified')
      }), isPrimary && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_13__["default"], {
        type: "success",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Primary')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
      gap: 1,
      children: [!isPrimary && isVerified && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: "sm",
        onClick: e => onSetPrimary === null || onSetPrimary === void 0 ? void 0 : onSetPrimary(email, e),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Set as primary')
      }), !isVerified && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: "sm",
        onClick: e => onVerify(email, e),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Resend verification')
      }), !hideRemove && !isPrimary && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Remove email'),
        "data-test-id": "remove",
        priority: "danger",
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconDelete, {}),
        onClick: e => onRemove(email, e)
      })]
    })]
  });
};

EmailRow.displayName = "EmailRow";

const EmailTags = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "etbgoaq1"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const EmailItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelItem,  true ? {
  target: "etbgoaq0"
} : 0)( true ? {
  name: "2o6p8u",
  styles: "justify-content:space-between"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountEmails_tsx.6f4705d8a0260828d351eeaed78af801.js.map