"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_featureBadge_tsx-app_components_modals_commandPalette_tsx"],{

/***/ "./app/components/circleIndicator.tsx":
/*!********************************************!*\
  !*** ./app/components/circleIndicator.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const defaultProps = {
  enabled: true,
  size: 14
};

const getBackgroundColor = p => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${p.enabled ? p.theme.success : p.theme.error};`;
};

const getSize = p => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

const CircleIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e13rus8i0"
} : 0)("display:inline-block;position:relative;border-radius:50%;", getSize, ";", getBackgroundColor, ";" + ( true ? "" : 0));

CircleIndicator.defaultProps = defaultProps;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CircleIndicator);

/***/ }),

/***/ "./app/components/featureBadge.tsx":
/*!*****************************************!*\
  !*** ./app/components/featureBadge.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tagDeprecated */ "./app/components/tagDeprecated.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const defaultTitles = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is internal and available for QA purposes'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is available for early adopters and may change'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is new! Try it out and let us know what you think')
};
const labels = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('alpha'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('beta'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('new')
};

function BaseFeatureBadge(_ref) {
  let {
    type,
    variant = 'badge',
    title,
    noTooltip,
    expiresAt,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.a)();

  if (expiresAt && expiresAt.valueOf() < Date.now()) {
    // Only get 1% of events as we don't need many to know that a badge needs to be cleaned up.
    if (Math.random() < 0.01) {
      (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.withScope)(scope => {
        scope.setTag('title', title);
        scope.setTag('type', type);
        scope.setLevel('warning');
        (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException)(new Error('Expired Feature Badge'));
      });
    }

    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: title !== null && title !== void 0 ? title : defaultTitles[type],
      disabled: noTooltip,
      position: "right",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [variant === 'badge' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTag, {
          priority: type,
          children: labels[type]
        }), variant === 'indicator' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {
          color: theme.badge[type].indicatorColor,
          size: 8
        })]
      })
    })
  });
}

BaseFeatureBadge.displayName = "BaseFeatureBadge";

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1g6bd531"
} : 0)("padding:3px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";" + ( true ? "" : 0));

const FeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseFeatureBadge,  true ? {
  target: "e1g6bd530"
} : 0)("display:inline-flex;align-items:center;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";position:relative;top:-1px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeatureBadge);

/***/ }),

/***/ "./app/components/modals/commandPalette.tsx":
/*!**************************************************!*\
  !*** ./app/components/modals/commandPalette.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_search__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/search */ "./app/components/search/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function CommandPalette(_ref) {
  let {
    Body
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_7__.a)();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => void (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.analytics)('omnisearch.open', {}), []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(Body, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_9__.ClassNames, {
      children: _ref2 => {
        let {
          css: injectedCss
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_search__WEBPACK_IMPORTED_MODULE_3__.Search, {
          entryPoint: "command_palette",
          minSearch: 1,
          maxResults: 10,
          dropdownClassName: injectedCss`
                width: 100%;
                border: transparent;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
                position: initial;
                box-shadow: none;
                border-top: 1px solid ${theme.border};
              `,
          renderInput: _ref3 => {
            let {
              getInputProps
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(InputWrapper, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledInput, {
                autoFocus: true,
                ...getInputProps({
                  type: 'text',
                  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Search for projects, teams, settings, etc...')
                })
              })
            });
          }
        });
      }
    })
  });
}

CommandPalette.displayName = "CommandPalette";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommandPalette);
const modalCss =  true ? {
  name: "1cwzvuz",
  styles: "[role='document']{padding:0;}"
} : 0;

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pb71cf1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.25), ";" + ( true ? "" : 0));

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1pb71cf0"
} : 0)("width:100%;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";border-radius:8px;outline:none;border:none;box-shadow:none;:focus,:active,:hover{outline:none;border:none;box-shadow:none;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/tagDeprecated.tsx":
/*!******************************************!*\
  !*** ./app/components/tagDeprecated.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Get priority from alerts or badge styles
 */
const getPriority = p => {
  if (p.priority) {
    var _ref, _p$theme$alert$p$prio;

    return (_ref = (_p$theme$alert$p$prio = p.theme.alert[p.priority]) !== null && _p$theme$alert$p$prio !== void 0 ? _p$theme$alert$p$prio : p.theme.badge[p.priority]) !== null && _ref !== void 0 ? _ref : null;
  }

  return null;
};

const getMarginLeft = p => p.inline ? `margin-left: ${p.size === 'small' ? '0.25em' : '0.5em'};` : '';

const getBorder = p => {
  var _getPriority$border, _getPriority;

  return p.border ? `border: 1px solid ${(_getPriority$border = (_getPriority = getPriority(p)) === null || _getPriority === void 0 ? void 0 : _getPriority.border) !== null && _getPriority$border !== void 0 ? _getPriority$border : p.theme.border};` : '';
};

const Tag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    children,
    icon,
    inline: _inline,
    priority: _priority,
    size: _size,
    border: _border,
    ...props
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", { ...props,
    children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IconWrapper, {
      children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(icon) && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(icon, {
        size: 'xs'
      })
    }), children]
  });
},  true ? {
  target: "ewer3pn1"
} : 0)("display:inline-flex;box-sizing:border-box;padding:", p => p.size === 'small' ? '0.1em 0.4em 0.2em' : '0.35em 0.8em 0.4em', ";font-size:", p => p.theme.fontSizeExtraSmall, ";line-height:1;color:", p => p.priority ? p.theme.background : p.theme.textColor, ";text-align:center;white-space:nowrap;vertical-align:middle;align-items:center;border-radius:", p => p.size === 'small' ? '0.25em' : '2em', ";text-transform:lowercase;font-weight:", p => p.size === 'small' ? 'bold' : 'normal', ";background:", p => {
  var _getPriority$backgrou, _getPriority2;

  return (_getPriority$backgrou = (_getPriority2 = getPriority(p)) === null || _getPriority2 === void 0 ? void 0 : _getPriority2.background) !== null && _getPriority$backgrou !== void 0 ? _getPriority$backgrou : p.theme.gray100;
}, ";", p => getBorder(p), ";", p => getMarginLeft(p), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewer3pn0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Tag);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_featureBadge_tsx-app_components_modals_commandPalette_tsx.b5893e1fcd35944eb7f1d1fd750c81b9.js.map