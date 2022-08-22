"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["PasswordStrength"],{

/***/ "./app/components/passwordStrength.tsx":
/*!*********************************************!*\
  !*** ./app/components/passwordStrength.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "attachTo": () => (/* binding */ attachTo),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/throttle */ "../node_modules/lodash/throttle.js");
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_throttle__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var zxcvbn__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! zxcvbn */ "../node_modules/zxcvbn/lib/main.js");
/* harmony import */ var zxcvbn__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(zxcvbn__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









/**
 * NOTE: Do not import this component synchronously. The zxcvbn library is
 * relatively large. This component should be loaded async as a split chunk.
 */

/**
 * The maximum score that zxcvbn reports
 */



const MAX_SCORE = 5;

const PasswordStrength = _ref => {
  let {
    value,
    labels = ['Very Weak', 'Very Weak', 'Weak', 'Strong', 'Very Strong'],
    colors = [sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].red300, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].red300, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].yellow300, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].green300, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].green300]
  } = _ref;

  if (value === '') {
    return null;
  }

  const result = zxcvbn__WEBPACK_IMPORTED_MODULE_4___default()(value);

  if (!result) {
    return null;
  }

  const {
    score
  } = result;
  const percent = Math.round((score + 1) / MAX_SCORE * 100);
  const styles = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.css)("background:", colors[score], ";width:", percent, "%;" + ( true ? "" : 0),  true ? "" : 0);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StrengthProgress, {
      role: "progressbar",
      "aria-valuenow": score,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StrengthProgressBar, {
        css: styles
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StrengthLabel, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tct)('Strength: [textScore]', {
        textScore: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ScoreText, {
          children: labels[score]
        })
      })
    })]
  });
};

PasswordStrength.displayName = "PasswordStrength";

const StrengthProgress = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8wd7kr3"
} : 0)("background:", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].gray200, ";height:8px;border-radius:2px;overflow:hidden;" + ( true ? "" : 0));

const StrengthProgressBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8wd7kr2"
} : 0)( true ? {
  name: "13udsys",
  styles: "height:100%"
} : 0);

const StrengthLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8wd7kr1"
} : 0)("font-size:0.8em;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";color:", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].gray400, ";" + ( true ? "" : 0));

const ScoreText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('strong',  true ? {
  target: "e8wd7kr0"
} : 0)("color:", p => p.theme.black, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PasswordStrength);
/**
 * This is a shim that allows the password strength component to be used
 * outside of our main react application. Mostly useful since all of our
 * registration pages aren't in the react app.
 */

const attachTo = _ref2 => {
  let {
    input,
    element
  } = _ref2;
  return element && input && input.addEventListener('input', lodash_throttle__WEBPACK_IMPORTED_MODULE_3___default()(e => {
    (0,react_dom__WEBPACK_IMPORTED_MODULE_2__.render)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(PasswordStrength, {
      value: e.target.value
    }), element);
  }));
};

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/PasswordStrength.b09acfbb87431ff73cc93ff4ceb37596.js.map