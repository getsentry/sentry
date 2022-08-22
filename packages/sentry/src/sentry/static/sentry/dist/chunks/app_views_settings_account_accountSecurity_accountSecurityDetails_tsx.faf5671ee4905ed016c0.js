"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_account_accountSecurity_accountSecurityDetails_tsx"],{

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

/***/ "./app/views/settings/account/accountSecurity/accountSecurityDetails.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/accountSecurityDetails.tsx ***!
  \*******************************************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_recoveryCodes__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/recoveryCodes */ "./app/views/settings/account/accountSecurity/components/recoveryCodes.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/removeConfirm */ "./app/views/settings/account/accountSecurity/components/removeConfirm.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_u2fEnrolledDetails__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/u2fEnrolledDetails */ "./app/views/settings/account/accountSecurity/components/u2fEnrolledDetails.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

/**
 * AccountSecurityDetails is only displayed when user is enrolled in the 2fa method.
 * It displays created + last used time of the 2fa method.
 *
 * Also displays 2fa method specific details.
 */
















const ENDPOINT = '/users/me/authenticators/';

function AuthenticatorDate(_ref) {
  let {
    label,
    date
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(DateLabel, {
      children: label
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
      children: date ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
        date: date
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('never')
    })]
  });
}

AuthenticatorDate.displayName = "AuthenticatorDate";

class AccountSecurityDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRemove", async device => {
      const {
        authenticator
      } = this.state;

      if (!authenticator || !authenticator.authId) {
        return;
      } // if the device is defined, it means that U2f is being removed
      // reason for adding a trailing slash is a result of the endpoint on line 109 needing it but it can't be set there as if deviceId is None, the route will end with '//'


      const deviceId = device ? `${device.key_handle}/` : '';
      const deviceName = device ? device.name : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Authenticator');
      this.setState({
        loading: true
      });

      try {
        await this.api.requestPromise(`${ENDPOINT}${authenticator.authId}/${deviceId}`, {
          method: 'DELETE'
        });
        this.props.router.push('/settings/account/security');
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s has been removed', deviceName));
      } catch {
        // Error deleting authenticator
        this.setState({
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Error removing %s', deviceName));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRename", async (device, deviceName) => {
      const {
        authenticator
      } = this.state;

      if (!(authenticator !== null && authenticator !== void 0 && authenticator.authId)) {
        return;
      } // if the device is defined, it means that U2f is being renamed
      // reason for adding a trailing slash is a result of the endpoint on line 109 needing it but it can't be set there as if deviceId is None, the route will end with '//'


      const deviceId = device ? `${device.key_handle}/` : '';
      this.setState({
        loading: true
      });
      const data = {
        name: deviceName
      };

      try {
        await this.api.requestPromise(`${ENDPOINT}${authenticator.authId}/${deviceId}`, {
          method: 'PUT',
          data
        });
        this.props.router.push(`/settings/account/security/mfa/${authenticator.authId}`);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Device was renamed'));
      } catch {
        this.setState({
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Error renaming the device'));
      }
    });
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Security');
  }

  getEndpoints() {
    const {
      params
    } = this.props;
    const {
      authId
    } = params;
    return [['authenticator', `${ENDPOINT}${authId}/`]];
  }

  renderBody() {
    const {
      authenticator
    } = this.state;

    if (!authenticator) {
      return null;
    }

    const {
      deleteDisabled,
      onRegenerateBackupCodes
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("span", {
            children: authenticator.name
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AuthenticatorStatus, {
            enabled: authenticator.isEnrolled
          })]
        }),
        action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AuthenticatorActions, {
          children: [authenticator.isEnrolled && authenticator.allowRotationInPlace && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: `/settings/account/security/mfa/${authenticator.id}/enroll/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Rotate Secret Key')
          }), authenticator.isEnrolled && authenticator.removeButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("Two-factor authentication is required for at least one organization you're a member of."),
            disabled: !deleteDisabled,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_account_accountSecurity_components_removeConfirm__WEBPACK_IMPORTED_MODULE_13__["default"], {
              onConfirm: this.handleRemove,
              disabled: deleteDisabled,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                priority: "danger",
                children: authenticator.removeButton
              })
            })
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_16__["default"], {
        children: authenticator.description
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AuthenticatorDates, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AuthenticatorDate, {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Created at'),
          date: authenticator.createdAt
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AuthenticatorDate, {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last used'),
          date: authenticator.lastUsedAt
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_account_accountSecurity_components_u2fEnrolledDetails__WEBPACK_IMPORTED_MODULE_14__["default"], {
        isEnrolled: authenticator.isEnrolled,
        id: authenticator.id,
        devices: authenticator.devices,
        onRemoveU2fDevice: this.handleRemove,
        onRenameU2fDevice: this.handleRename
      }), authenticator.isEnrolled && authenticator.phone && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(PhoneWrapper, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Confirmation codes are sent to the following phone number'), ":", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Phone, {
          children: authenticator.phone
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_account_accountSecurity_components_recoveryCodes__WEBPACK_IMPORTED_MODULE_12__["default"], {
        onRegenerateBackupCodes: onRegenerateBackupCodes,
        isEnrolled: authenticator.isEnrolled,
        codes: authenticator.codes
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AccountSecurityDetails);

const AuthenticatorStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e19qrwsm5"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const AuthenticatorActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e19qrwsm4"
} : 0)("display:flex;justify-content:center;align-items:center;>*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}" + ( true ? "" : 0));

const AuthenticatorDates = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e19qrwsm3"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";grid-template-columns:max-content auto;" + ( true ? "" : 0));

const DateLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e19qrwsm2"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const PhoneWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e19qrwsm1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(4), ";" + ( true ? "" : 0));

const Phone = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e19qrwsm0"
} : 0)("font-weight:bold;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

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

/***/ "./app/views/settings/account/accountSecurity/components/recoveryCodes.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/recoveryCodes.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const RecoveryCodes = _ref => {
  let {
    className,
    isEnrolled,
    codes,
    onRegenerateBackupCodes
  } = _ref;

  const printCodes = () => {
    // eslint-disable-next-line dot-notation
    const iframe = window.frames['printable'];
    iframe.document.write(codes.join('<br>'));
    iframe.print();
    iframe.document.close();
  };

  if (!isEnrolled || !codes) {
    return null;
  }

  const formattedCodes = codes.join(' \n');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(CodeContainer, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelHeader, {
      hasButtons: true,
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Unused Codes'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Actions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_2__["default"], {
          hideUnsupported: true,
          value: formattedCodes,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
            size: "sm",
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('copy'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconCopy, {})
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          size: "sm",
          onClick: printCodes,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('print'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconPrint, {})
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          size: "sm",
          download: "sentry-recovery-codes.txt",
          href: `data:text/plain;charset=utf-8,${formattedCodes}`,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('download'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconDownload, {})
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_3__["default"], {
          onConfirm: onRegenerateBackupCodes,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Are you sure you want to regenerate recovery codes? Your old codes will no longer work.'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
            priority: "danger",
            size: "sm",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Regenerate Codes')
          })
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelBody, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelAlert, {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Make sure to save a copy of your recovery codes and store them in a safe place.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
        children: !!codes.length && codes.map(code => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Code, {
          children: code
        }, code))
      }), !codes.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('You have no more recovery codes to use')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("iframe", {
      name: "printable",
      style: {
        display: 'none'
      }
    })]
  });
};

RecoveryCodes.displayName = "RecoveryCodes";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RecoveryCodes);

const CodeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel,  true ? {
  target: "e1nntg9l2"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(4), ";" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nntg9l1"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Code = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem,  true ? {
  target: "e1nntg9l0"
} : 0)("font-family:", p => p.theme.text.familyMono, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

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

/***/ }),

/***/ "./app/views/settings/account/accountSecurity/components/u2fEnrolledDetails.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/settings/account/accountSecurity/components/u2fEnrolledDetails.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/account/accountSecurity/components/confirmHeader */ "./app/views/settings/account/accountSecurity/components/confirmHeader.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const U2fEnrolledDetails = props => {
  const {
    className,
    isEnrolled,
    devices,
    id,
    onRemoveU2fDevice,
    onRenameU2fDevice
  } = props;

  if (id !== 'u2f' || !isEnrolled) {
    return null;
  }

  const hasDevices = devices === null || devices === void 0 ? void 0 : devices.length; // Note Tooltip doesn't work because of bootstrap(?) pointer events for disabled buttons

  const isLastDevice = hasDevices === 1;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Device name')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
      children: [!hasDevices && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_13__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('You have not added any U2F devices')
      }), hasDevices && (devices === null || devices === void 0 ? void 0 : devices.map((device, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Device, {
        device: device,
        isLastDevice: isLastDevice,
        onRenameU2fDevice: onRenameU2fDevice,
        onRemoveU2fDevice: onRemoveU2fDevice
      }, i))), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(AddAnotherPanelItem, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          type: "button",
          to: "/settings/account/security/mfa/u2f/enroll/",
          size: "sm",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Add Another Device')
        })
      })]
    })]
  });
};

U2fEnrolledDetails.displayName = "U2fEnrolledDetails";

const Device = props => {
  const {
    device,
    isLastDevice,
    onRenameU2fDevice,
    onRemoveU2fDevice
  } = props;
  const [deviceName, setDeviceName] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(device.name);
  const [isEditing, setEditting] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  if (!isEditing) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(DevicePanelItem, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(DeviceInformation, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Name, {
          children: device.name
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(FadedDateTime, {
          date: device.timestamp
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          size: "sm",
          onClick: () => setEditting(true),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Rename Device')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Actions, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_4__["default"], {
          onConfirm: () => onRemoveU2fDevice(device),
          disabled: isLastDevice,
          message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_account_accountSecurity_components_confirmHeader__WEBPACK_IMPORTED_MODULE_12__["default"], {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Do you want to remove U2F device?')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_14__["default"], {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)(`Are you sure you want to remove the U2F device "${device.name}"?`)
            })]
          }),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            size: "sm",
            priority: "danger",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
              disabled: !isLastDevice,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Can not remove last U2F device'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconDelete, {
                size: "xs"
              })
            })
          })
        })
      })]
    }, device.name);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(DevicePanelItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(DeviceInformation, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(DeviceNameInput, {
        type: "text",
        value: deviceName,
        onChange: e => {
          setDeviceName(e.target.value);
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(FadedDateTime, {
        date: device.timestamp
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Actions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        priority: "primary",
        size: "sm",
        onClick: () => {
          onRenameU2fDevice(device, deviceName);
          setEditting(false);
        },
        children: "Rename Device"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Actions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        title: "Cancel rename",
        onClick: () => {
          setDeviceName(device.name);
          setEditting(false);
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconClose, {
          size: "xs"
        })
      })
    })]
  }, device.name);
};

Device.displayName = "Device";

const DeviceNameInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "eisv0kh7"
} : 0)("width:50%;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const DevicePanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem,  true ? {
  target: "eisv0kh6"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const DeviceInformation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eisv0kh5"
} : 0)("display:flex;align-items:center;justify-content:space-between;flex:1 1;height:72px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";padding-right:0;" + ( true ? "" : 0));

const FadedDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eisv0kh4"
} : 0)("font-size:", p => p.theme.fontSizeRelativeSmall, ";opacity:0.6;" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eisv0kh3"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eisv0kh2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const AddAnotherPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem,  true ? {
  target: "eisv0kh1"
} : 0)("justify-content:flex-end;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(U2fEnrolledDetails, {
  target: "eisv0kh0"
})("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(4), ";" + ( true ? "" : 0)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_account_accountSecurity_accountSecurityDetails_tsx.9ef0054c38a07f55c5f3a9163468b12f.js.map