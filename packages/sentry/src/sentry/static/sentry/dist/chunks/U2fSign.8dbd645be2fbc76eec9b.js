"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["U2fSign"],{

/***/ "./app/components/u2f/u2finterface.tsx":
/*!*********************************************!*\
  !*** ./app/components/u2f/u2finterface.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var cbor_web__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! cbor-web */ "../node_modules/cbor-web/dist/cbor.js");
/* harmony import */ var cbor_web__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(cbor_web__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/u2f/webAuthnHelper */ "./app/components/u2f/webAuthnHelper.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class U2fInterface extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isSupported: null,
      formElement: null,
      challengeElement: null,
      hasBeenTapped: false,
      deviceFailure: null,
      responseElement: null,
      isSafari: false,
      failCount: 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onTryAgain", () => {
      this.setState({
        hasBeenTapped: false,
        deviceFailure: null
      }, () => void this.invokeU2fFlow());
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "bindChallengeElement", ref => {
      this.setState({
        challengeElement: ref,
        formElement: ref && ref.form
      });

      if (ref) {
        ref.value = JSON.stringify(this.props.challengeData);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "bindResponseElement", ref => this.setState({
      responseElement: ref
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderSafariWebAuthn", () => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("a", {
        onClick: this.onTryAgain,
        className: "btn btn-primary",
        children: this.props.flowMode === 'enroll' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enroll with WebAuthn') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sign in with WebAuthn')
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderFailure", () => {
      const {
        deviceFailure
      } = this.state;
      const supportMail = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('supportEmail');
      const support = supportMail ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("a", {
        href: 'mailto:' + supportMail,
        children: supportMail
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Support')
      });

      if (this.state.isSafari && this.state.failCount === 0) {
        return this.renderSafariWebAuthn();
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
        className: "failure-message",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error: ')
          }), ' ', {
            UNKNOWN_ERROR: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('There was an unknown problem, please try again'),
            DEVICE_ERROR: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Your U2F device reported an error.'),
            DUPLICATE_DEVICE: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This device is already registered with Sentry.'),
            UNKNOWN_DEVICE: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('The device you used for sign-in is unknown.'),
            BAD_APPID: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[p1:The Sentry server administrator modified the ' + 'device registrations.]' + '[p2:You need to remove and re-add the device to continue ' + 'using your U2F device. Use a different sign-in method or ' + 'contact [support] for assistance.]', {
              p1: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {}),
              p2: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {}),
              support
            })
          }[deviceFailure || '']]
        }), this.canTryAgain && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
          style: {
            marginTop: 18
          },
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("a", {
            onClick: this.onTryAgain,
            className: "btn btn-primary",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Try Again')
          })
        })]
      });
    });
  }

  componentDidMount() {
    const supported = !!window.PublicKeyCredential; // eslint-disable-next-line react/no-did-mount-set-state

    this.setState({
      isSupported: supported
    });
    const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');

    if (isSafari) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        deviceFailure: 'safari: requires interaction',
        isSafari,
        hasBeenTapped: false
      });
    }

    if (supported && !isSafari) {
      this.invokeU2fFlow();
    }
  }

  getU2FResponse(data) {
    if (!data.response) {
      return JSON.stringify(data);
    }

    if (this.props.flowMode === 'sign') {
      const authenticatorData = {
        keyHandle: data.id,
        clientData: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.response.clientDataJSON),
        signatureData: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.response.signature),
        authenticatorData: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.response.authenticatorData)
      };
      return JSON.stringify(authenticatorData);
    }

    if (this.props.flowMode === 'enroll') {
      const authenticatorData = {
        id: data.id,
        rawId: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.rawId),
        response: {
          attestationObject: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.response.attestationObject),
          clientDataJSON: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.response.clientDataJSON)
        },
        type: (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.bufferToBase64url)(data.type)
      };
      return JSON.stringify(authenticatorData);
    }

    throw new Error(`Unsupported flow mode '${this.props.flowMode}'`);
  }

  submitU2fResponse(promise) {
    promise.then(data => {
      this.setState({
        hasBeenTapped: true
      }, () => {
        const u2fResponse = this.getU2FResponse(data);
        const challenge = JSON.stringify(this.props.challengeData);

        if (this.state.responseElement) {
          // eslint-disable-next-line react/no-direct-mutation-state
          this.state.responseElement.value = u2fResponse;
        }

        if (!this.props.onTap) {
          var _this$state$formEleme;

          (_this$state$formEleme = this.state.formElement) === null || _this$state$formEleme === void 0 ? void 0 : _this$state$formEleme.submit();
          return;
        }

        this.props.onTap({
          response: u2fResponse,
          challenge
        }).catch(() => {
          // This is kind of gross but I want to limit the amount of changes to this component
          this.setState({
            deviceFailure: 'UNKNOWN_ERROR',
            hasBeenTapped: false
          });
        });
      });
    }).catch(err => {
      let failure = 'DEVICE_ERROR'; // in some rare cases there is no metadata on the error which
      // causes this to blow up badly.

      if (err.metaData) {
        if (err.metaData.type === 'DEVICE_INELIGIBLE') {
          if (this.props.flowMode === 'enroll') {
            failure = 'DUPLICATE_DEVICE';
          } else {
            failure = 'UNKNOWN_DEVICE';
          }
        } else if (err.metaData.type === 'BAD_REQUEST') {
          failure = 'BAD_APPID';
        }
      } // we want to know what is happening here.  There are some indicators
      // that users are getting errors that should not happen through the
      // regular u2f flow.


      _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(err);
      this.setState({
        deviceFailure: failure,
        hasBeenTapped: false,
        failCount: this.state.failCount + 1
      });
    });
  }

  webAuthnSignIn(publicKeyCredentialRequestOptions) {
    const promise = navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });
    this.submitU2fResponse(promise);
  }

  webAuthnRegister(publicKey) {
    const promise = navigator.credentials.create({
      publicKey
    });
    this.submitU2fResponse(promise);
  }

  invokeU2fFlow() {
    if (this.props.flowMode === 'sign') {
      const challengeArray = (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.base64urlToBuffer)(this.props.challengeData.webAuthnAuthenticationData);
      const challenge = cbor_web__WEBPACK_IMPORTED_MODULE_5__.decodeFirst(challengeArray);
      challenge.then(data => {
        this.webAuthnSignIn(data);
      }).catch(err => {
        const failure = 'DEVICE_ERROR';
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(err);
        this.setState({
          deviceFailure: failure,
          hasBeenTapped: false
        });
      });
    } else if (this.props.flowMode === 'enroll') {
      const challengeArray = (0,sentry_components_u2f_webAuthnHelper__WEBPACK_IMPORTED_MODULE_6__.base64urlToBuffer)(this.props.challengeData.webAuthnRegisterData);
      const challenge = cbor_web__WEBPACK_IMPORTED_MODULE_5__.decodeFirst(challengeArray); // challenge contains a PublicKeyCredentialRequestOptions object for webauthn registration

      challenge.then(data => {
        this.webAuthnRegister(data.publicKey);
      }).catch(err => {
        const failure = 'DEVICE_ERROR';
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(err);
        this.setState({
          deviceFailure: failure,
          hasBeenTapped: false
        });
      });
    } else {
      throw new Error(`Unsupported flow mode '${this.props.flowMode}'`);
    }
  }

  renderUnsupported() {
    return this.props.silentIfUnsupported ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      className: "u2f-box",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
        className: "inner",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
          className: "error",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`
             Unfortunately your browser does not support U2F. You need to use
             a different two-factor method or switch to a browser that supports
             it (Google Chrome or Microsoft Edge).`)
        })
      })
    });
  }

  get canTryAgain() {
    return this.state.deviceFailure !== 'BAD_APPID';
  }

  renderBody() {
    return this.state.deviceFailure ? this.renderFailure() : this.props.children;
  }

  renderPrompt() {
    const {
      style
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
      style: style,
      className: 'u2f-box' + (this.state.hasBeenTapped ? ' tapped' : '') + (this.state.deviceFailure ? this.state.failCount === 0 && this.state.isSafari ? ' loading-dots' : ' device-failure' : ''),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
        className: "device-animation-frame",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
          className: "device-failed"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
          className: "device-animation"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
          className: "loading-dots",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
            className: "dot"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
            className: "dot"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
            className: "dot"
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("input", {
        type: "hidden",
        name: "challenge",
        ref: this.bindChallengeElement
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("input", {
        type: "hidden",
        name: "response",
        ref: this.bindResponseElement
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
        className: "inner",
        children: this.renderBody()
      })]
    });
  }

  render() {
    const {
      isSupported
    } = this.state; // if we are still waiting for the browser to tell us if we can do u2f this
    // will be null.

    if (isSupported === null) {
      return null;
    }

    if (!isSupported) {
      return this.renderUnsupported();
    }

    return this.renderPrompt();
  }

}

U2fInterface.displayName = "U2fInterface";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(U2fInterface));

/***/ }),

/***/ "./app/components/u2f/u2fsign.tsx":
/*!****************************************!*\
  !*** ./app/components/u2f/u2fsign.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _u2finterface__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./u2finterface */ "./app/components/u2f/u2finterface.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const MESSAGES = {
  signin: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Insert your U2F device or tap the button on it to confirm the sign-in request.'),
  sudo: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Alternatively you can use your U2F device to confirm the action.'),
  enroll: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('To enroll your U2F device insert it now or tap the button on it to activate it.')
};

function U2fSign(_ref) {
  var _MESSAGES$displayMode;

  let {
    displayMode = 'signin',
    ...props
  } = _ref;
  const flowMode = displayMode === 'enroll' ? 'enroll' : 'sign';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_u2finterface__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    silentIfUnsupported: displayMode === 'sudo',
    flowMode: flowMode,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
      children: (_MESSAGES$displayMode = MESSAGES[displayMode]) !== null && _MESSAGES$displayMode !== void 0 ? _MESSAGES$displayMode : null
    })
  });
}

U2fSign.displayName = "U2fSign";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (U2fSign);

/***/ }),

/***/ "./app/components/u2f/webAuthnHelper.tsx":
/*!***********************************************!*\
  !*** ./app/components/u2f/webAuthnHelper.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "base64urlToBuffer": () => (/* binding */ base64urlToBuffer),
/* harmony export */   "bufferToBase64url": () => (/* binding */ bufferToBase64url)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_exception_stack_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-exception.stack.js */ "../node_modules/core-js/modules/web.dom-exception.stack.js");
/* harmony import */ var core_js_modules_web_dom_exception_stack_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_exception_stack_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_typed_array_uint8_array_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.typed-array.uint8-array.js */ "../node_modules/core-js/modules/es.typed-array.uint8-array.js");
/* harmony import */ var core_js_modules_es_typed_array_uint8_array_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_uint8_array_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.typed-array.at.js */ "../node_modules/core-js/modules/es.typed-array.at.js");
/* harmony import */ var core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.typed-array.fill.js */ "../node_modules/core-js/modules/es.typed-array.fill.js");
/* harmony import */ var core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.typed-array.set.js */ "../node_modules/core-js/modules/es.typed-array.set.js");
/* harmony import */ var core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.typed-array.sort.js */ "../node_modules/core-js/modules/es.typed-array.sort.js");
/* harmony import */ var core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7__);








// Copyright (c) 2019 GitHub, Inc.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
// below is from https://github.com/github/webauthn-json/tree/66322fc5c12184c5269691ab5abaac79545a3916
function base64urlToBuffer(baseurl64String) {
  // Base64url to Base64
  const padding = '=='.slice(0, (4 - baseurl64String.length % 4) % 4);
  const base64String = baseurl64String.replace(/-/g, '+').replace(/_/g, '/') + padding; // Base64 to binary string

  const str = atob(base64String); // Binary string to buffer

  const buffer = new ArrayBuffer(str.length);
  const byteView = new Uint8Array(buffer);

  for (let i = 0; i < str.length; i++) {
    byteView[i] = str.charCodeAt(i);
  }

  return buffer;
}
function bufferToBase64url(buffer) {
  // Buffer to binary string
  const byteView = new Uint8Array(buffer);
  let str = '';

  for (const charCode of byteView) {
    str += String.fromCharCode(charCode);
  } // Binary string to base64


  const base64String = btoa(str); // Base64 to base64url
  // We assume that the base64url string is well-formed.

  const base64urlString = base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return base64urlString;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/U2fSign.ffdcad4bb0f05eab406b0e4e684c6ce5.js.map