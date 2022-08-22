"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSecurity_accountSecurityEnroll_tsx"],{

/***/ "./app/utils/getPendingInvite.tsx":
/*!****************************************!*\
  !*** ./app/utils/getPendingInvite.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getPendingInvite)
/* harmony export */ });
/* harmony import */ var js_cookie__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! js-cookie */ "../node_modules/js-cookie/dist/js.cookie.mjs");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");


function getPendingInvite() {
  const data = js_cookie__WEBPACK_IMPORTED_MODULE_0__["default"].get('pending-invite');

  if (!data) {
    return null;
  }

  return query_string__WEBPACK_IMPORTED_MODULE_1__.parse(data);
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

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/accountSecurityEnroll.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/accountSecurityEnroll.tsx ***!
  \******************************************************************************/
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
/* harmony import */ var qrcode_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! qrcode.react */ "../node_modules/qrcode.react/lib/esm/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/organizations */ "./app/actionCreators/organizations.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_u2f_u2fsign__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/u2f/u2fsign */ "./app/components/u2f/u2fsign.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getPendingInvite__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/getPendingInvite */ "./app/utils/getPendingInvite.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/removeConfirm */ "./app/views/settings/account/accountSecurity/components/removeConfirm.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports



























/**
 * Retrieve additional form fields (or modify ones) based on 2fa method
 */
const getFields = _ref => {
  let {
    authenticator,
    hasSentCode,
    sendingCode,
    onSmsReset,
    onU2fTap
  } = _ref;
  const {
    form
  } = authenticator;

  if (!form) {
    return null;
  }

  if (authenticator.id === 'totp') {
    return [() => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(CodeContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledQRCode, {
        value: authenticator.qrcode,
        size: 228
      })
    }, "qrcode"), () => {
      var _authenticator$secret;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_13__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Authenticator secret'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_17__["default"], {
          children: (_authenticator$secret = authenticator.secret) !== null && _authenticator$secret !== void 0 ? _authenticator$secret : ''
        })
      }, "secret");
    }, ...form, () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Actions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
        priority: "primary",
        type: "submit",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Confirm')
      })
    }, "confirm")];
  } // Sms Form needs a start over button + confirm button
  // Also inputs being disabled vary based on hasSentCode


  if (authenticator.id === 'sms') {
    // Ideally we would have greater flexibility when rendering footer
    return [{ ...form[0],
      disabled: sendingCode || hasSentCode
    }, ...(hasSentCode ? [{ ...form[1],
      required: true
    }] : []), () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(Actions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_11__["default"], {
        gap: 1,
        children: [hasSentCode && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          onClick: onSmsReset,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Start Over')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          priority: "primary",
          type: "submit",
          children: hasSentCode ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Confirm') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Send Code')
        })]
      })
    }, "sms-footer")];
  } // Need to render device name field + U2f component


  if (authenticator.id === 'u2f') {
    const deviceNameField = form.find(_ref2 => {
      let {
        name
      } = _ref2;
      return name === 'deviceName';
    });
    return [deviceNameField, () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_u2f_u2fsign__WEBPACK_IMPORTED_MODULE_19__["default"], {
      style: {
        marginBottom: 0
      },
      challengeData: authenticator.challenge,
      displayMode: "enroll",
      onTap: onU2fTap
    }, "u2f-enroll")];
  }

  return null;
};

var _ref4 =  true ? {
  name: "18jsklt",
  styles: "margin-left:6px"
} : 0;

/**
 * Renders necessary forms in order to enroll user in 2fa
 */
class AccountSecurityEnroll extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_23__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formModel", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_16__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pendingInvitation", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSmsReset", () => this.setState({
      hasSentCode: false
    }, this.remountComponent));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSmsSubmit", async dataModel => {
      const {
        authenticator,
        hasSentCode
      } = this.state;
      const {
        phone,
        otp
      } = dataModel; // Don't submit if empty

      if (!phone || !authenticator) {
        return;
      }

      const data = {
        phone,
        // Make sure `otp` is undefined if we are submitting OTP verification
        // Otherwise API will think that we are on verification step (e.g. after submitting phone)
        otp: hasSentCode ? otp : undefined,
        secret: authenticator.secret
      }; // Only show loading when submitting OTP

      this.setState({
        sendingCode: !hasSentCode
      });

      if (!hasSentCode) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Sending code to %s...', data.phone));
      } else {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Verifying OTP...'));
      }

      try {
        await this.api.requestPromise(this.enrollEndpoint, {
          data
        });
      } catch (error) {
        this.formModel.resetForm();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(this.state.hasSentCode ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Incorrect OTP') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Error sending SMS'));
        this.setState({
          hasSentCode: false,
          sendingCode: false
        }); // Re-mount because we want to fetch a fresh secret

        this.remountComponent();
        return;
      }

      if (!hasSentCode) {
        // Just successfully finished sending OTP to user
        this.setState({
          hasSentCode: true,
          sendingCode: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Sent code to %s', data.phone));
      } else {
        // OTP was accepted and SMS was added as a 2fa method
        this.handleEnrollSuccess();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleU2fTap", async tapData => {
      const data = {
        deviceName: this.formModel.getValue('deviceName'),
        ...tapData
      };
      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(this.enrollEndpoint, {
          data
        });
      } catch (err) {
        this.handleEnrollError();
        return;
      }

      this.handleEnrollSuccess();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTotpSubmit", async dataModel => {
      if (!this.state.authenticator) {
        return;
      }

      const data = { ...(dataModel !== null && dataModel !== void 0 ? dataModel : {}),
        secret: this.state.authenticator.secret
      };
      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(this.enrollEndpoint, {
          method: 'POST',
          data
        });
      } catch (err) {
        this.handleEnrollError();
        return;
      }

      this.handleEnrollSuccess();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", data => {
      var _this$state$authentic;

      const id = (_this$state$authentic = this.state.authenticator) === null || _this$state$authentic === void 0 ? void 0 : _this$state$authentic.id;

      if (id === 'totp') {
        this.handleTotpSubmit(data);
        return;
      }

      if (id === 'sms') {
        this.handleSmsSubmit(data);
        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", async () => {
      const {
        authenticator
      } = this.state;

      if (!authenticator || !authenticator.authId) {
        return;
      } // `authenticator.authId` is NOT the same as `props.params.authId` This is
      // for backwards compatibility with API endpoint


      try {
        await this.api.requestPromise(this.authenticatorEndpoint, {
          method: 'DELETE'
        });
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Error removing authenticator'));
        return;
      }

      this.props.router.push('/settings/account/security/');
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Authenticator has been removed'));
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Security');
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      hasSentCode: false
    };
  }

  get authenticatorEndpoint() {
    return `/users/me/authenticators/${this.props.params.authId}/`;
  }

  get enrollEndpoint() {
    return `${this.authenticatorEndpoint}enroll/`;
  }

  getEndpoints() {
    const errorHandler = err => {
      const alreadyEnrolled = err && err.status === 400 && err.responseJSON && err.responseJSON.details === 'Already enrolled';

      if (alreadyEnrolled) {
        this.props.router.push('/settings/account/security/');
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Already enrolled'));
      } // Allow the endpoint to fail if the user is already enrolled


      return alreadyEnrolled;
    };

    return [['authenticator', this.enrollEndpoint, {}, {
      allowError: errorHandler
    }]];
  }

  componentDidMount() {
    this.pendingInvitation = (0,sentry_utils_getPendingInvite__WEBPACK_IMPORTED_MODULE_22__["default"])();
  }

  get authenticatorName() {
    var _this$state$authentic2, _this$state$authentic3;

    return (_this$state$authentic2 = (_this$state$authentic3 = this.state.authenticator) === null || _this$state$authentic3 === void 0 ? void 0 : _this$state$authentic3.name) !== null && _this$state$authentic2 !== void 0 ? _this$state$authentic2 : 'Authenticator';
  } // This resets state so that user can re-enter their phone number again


  // Handler when we successfully add a 2fa device
  async handleEnrollSuccess() {
    // If we're pending approval of an invite, the user will have just joined
    // the organization when completing 2fa enrollment. We should reload the
    // organization context in that case to assign them to the org.
    if (this.pendingInvitation) {
      await (0,sentry_actionCreators_organizations__WEBPACK_IMPORTED_MODULE_8__.fetchOrganizationByMember)(this.pendingInvitation.memberId.toString(), {
        addOrg: true,
        fetchOrgDetails: true
      });
    }

    this.props.router.push('/settings/account/security/');
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openRecoveryOptions)({
      authenticatorName: this.authenticatorName
    });
  } // Handler when we failed to add a 2fa device


  handleEnrollError() {
    this.setState({
      loading: false
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Error adding %s authenticator', this.authenticatorName));
  } // Removes an authenticator


  renderBody() {
    var _authenticator$form;

    const {
      authenticator,
      hasSentCode,
      sendingCode
    } = this.state;

    if (!authenticator) {
      return null;
    }

    const fields = getFields({
      authenticator,
      hasSentCode,
      sendingCode,
      onSmsReset: this.handleSmsReset,
      onU2fTap: this.handleU2fTap
    }); // Attempt to extract `defaultValue` from server generated form fields

    const defaultValues = fields ? fields.filter(field => typeof field !== 'function' && typeof field.defaultValue !== 'undefined').map(field => [field.name, typeof field !== 'function' ? field.defaultValue : '']).reduce((acc, _ref3) => {
      let [name, value] = _ref3;
      acc[name] = value;
      return acc;
    }, {}) : {};
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_25__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("span", {
            children: authenticator.name
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {
            css: _ref4,
            enabled: authenticator.isEnrolled || authenticator.status === 'rotation'
          })]
        }),
        action: authenticator.isEnrolled && authenticator.removeButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_24__["default"], {
          onConfirm: this.handleRemove,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
            priority: "danger",
            children: authenticator.removeButton
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_26__["default"], {
        children: authenticator.description
      }), authenticator.rotationWarning && authenticator.status === 'rotation' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
        type: "warning",
        showIcon: true,
        children: authenticator.rotationWarning
      }), !!((_authenticator$form = authenticator.form) !== null && _authenticator$form !== void 0 && _authenticator$form.length) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_14__["default"], {
        model: this.formModel,
        apiMethod: "POST",
        apiEndpoint: this.authenticatorEndpoint,
        onSubmit: this.handleSubmit,
        initialData: { ...defaultValues,
          ...authenticator
        },
        hideFooter: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_15__["default"], {
          forms: [{
            title: 'Configuration',
            fields: fields !== null && fields !== void 0 ? fields : []
          }]
        })
      })]
    });
  }

}

const CodeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_18__.PanelItem,  true ? {
  target: "ehe56j12"
} : 0)( true ? {
  name: "f7ay7b",
  styles: "justify-content:center"
} : 0);

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_18__.PanelItem,  true ? {
  target: "ehe56j11"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

const StyledQRCode = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(qrcode_react__WEBPACK_IMPORTED_MODULE_5__.QRCodeCanvas,  true ? {
  target: "ehe56j10"
} : 0)("background:white;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(AccountSecurityEnroll));

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/components/confirmHeader.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/confirmHeader.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

const ConfirmHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1er9gj10"
} : 0)( true ? {
  name: "73b5fw",
  styles: "font-size:1.2em;margin-bottom:10px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ConfirmHeader);

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/components/removeConfirm.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/removeConfirm.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/confirmHeader */ "./app/views/settings/account/accountSecurity/components/confirmHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_3__["default"], {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Do you want to remove this method?')
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_4__["default"], {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Removing the last authentication method will disable two-factor authentication completely.')
  })]
});

const RemoveConfirm = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
  message: message
});

RemoveConfirm.displayName = "RemoveConfirm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RemoveConfirm);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSecurity_accountSecurityEnroll_tsx.0f1cefff748698a3d6ac27ede17b286a.js.map