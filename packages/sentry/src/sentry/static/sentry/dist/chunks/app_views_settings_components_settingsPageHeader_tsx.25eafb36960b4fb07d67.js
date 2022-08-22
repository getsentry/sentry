"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_components_settingsPageHeader_tsx"],{

/***/ "./app/views/settings/components/settingsPageHeader.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/components/settingsPageHeader.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function UnstyledSettingsPageHeader(_ref) {
  let {
    icon,
    title,
    subtitle,
    action,
    body,
    tabs,
    noTitleStyles = false,
    ...props
  } = _ref;
  // If Header is narrow, use align-items to center <Action>.
  // Otherwise, use a fixed margin to prevent an odd alignment.
  // This is needed as Actions could be a button or a dropdown.
  const isNarrow = !subtitle;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", { ...props,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(TitleAndActions, {
      isNarrow: isNarrow,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(TitleWrapper, {
        children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Icon, {
          children: icon
        }), title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Title, {
          tabs: tabs,
          styled: noTitleStyles,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_1__.HeaderTitle, {
            children: title
          }), subtitle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Subtitle, {
            children: subtitle
          })]
        })]
      }), action && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Action, {
        isNarrow: isNarrow,
        children: action
      })]
    }), body && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(BodyWrapper, {
      children: body
    }), tabs && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TabsWrapper, {
      children: tabs
    })]
  });
}

UnstyledSettingsPageHeader.displayName = "UnstyledSettingsPageHeader";

const TitleAndActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc8"
} : 0)("display:flex;align-items:", p => p.isNarrow ? 'center' : 'flex-start', ";" + ( true ? "" : 0));

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc7"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc6"
} : 0)(p => !p.styled && `font-size: 20px; font-weight: 600;`, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), " 0;" + ( true ? "" : 0));

const Subtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc5"
} : 0)("color:", p => p.theme.gray400, ";font-weight:400;font-size:", p => p.theme.fontSizeLarge, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1.5), " 0 0;" + ( true ? "" : 0));

const Icon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc4"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Action = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc3"
} : 0)("margin-top:", p => p.isNarrow ? '0' : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";" + ( true ? "" : 0));

const SettingsPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(UnstyledSettingsPageHeader,  true ? {
  target: "e1nr98yc2"
} : 0)("font-size:14px;margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";" + ( true ? "" : 0));

const BodyWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc1"
} : 0)("flex:1;margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";" + ( true ? "" : 0));

const TabsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nr98yc0"
} : 0)( true ? {
  name: "rqdc5b",
  styles: "flex:1;margin:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsPageHeader);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_components_settingsPageHeader_tsx.8cab871f454b4559b25327c633c6416b.js.map