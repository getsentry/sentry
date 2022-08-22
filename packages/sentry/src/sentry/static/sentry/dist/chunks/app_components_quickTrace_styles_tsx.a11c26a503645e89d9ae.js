"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_quickTrace_styles_tsx"],{

/***/ "./app/components/quickTrace/styles.tsx":
/*!**********************************************!*\
  !*** ./app/components/quickTrace/styles.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DropdownContainer": () => (/* binding */ DropdownContainer),
/* harmony export */   "DropdownItem": () => (/* binding */ DropdownItem),
/* harmony export */   "DropdownItemSubContainer": () => (/* binding */ DropdownItemSubContainer),
/* harmony export */   "DropdownMenuHeader": () => (/* binding */ DropdownMenuHeader),
/* harmony export */   "ErrorNodeContent": () => (/* binding */ ErrorNodeContent),
/* harmony export */   "EventNode": () => (/* binding */ EventNode),
/* harmony export */   "ExternalDropdownLink": () => (/* binding */ ExternalDropdownLink),
/* harmony export */   "QuickTraceContainer": () => (/* binding */ QuickTraceContainer),
/* harmony export */   "QuickTraceValue": () => (/* binding */ QuickTraceValue),
/* harmony export */   "SectionSubtext": () => (/* binding */ SectionSubtext),
/* harmony export */   "SingleEventHoverText": () => (/* binding */ SingleEventHoverText),
/* harmony export */   "TraceConnector": () => (/* binding */ TraceConnector)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_actions_menuHeader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/actions/menuHeader */ "./app/components/actions/menuHeader.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










const SectionSubtext = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk11"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));
const QuickTraceContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk10"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const nodeColors = theme => ({
  error: {
    color: theme.white,
    background: theme.red300,
    border: theme.red300
  },
  warning: {
    color: theme.red300,
    background: theme.background,
    border: theme.red300
  },
  white: {
    color: theme.textColor,
    background: theme.background,
    border: theme.textColor
  },
  black: {
    color: theme.background,
    background: theme.textColor,
    border: theme.textColor
  }
});

const EventNode = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "evhzmqk9"
} : 0)("span{display:flex;color:", p => nodeColors(p.theme)[p.type || 'white'].color, ";}& ",
/* sc-selector */
sentry_components_tag__WEBPACK_IMPORTED_MODULE_4__.Background, "{background-color:", p => nodeColors(p.theme)[p.type || 'white'].background, ";border:1px solid ", p => nodeColors(p.theme)[p.type || 'white'].border, ";}" + ( true ? "" : 0));
const TraceConnector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk8"
} : 0)("width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";border-top:1px solid ", p => p.theme.textColor, ";" + ( true ? "" : 0));
/**
 * The DropdownLink component is styled directly with less and the way the
 * elements are laid out within means we can't apply any styles directly
 * using emotion. Instead, we wrap it all inside a span and indirectly
 * style it here.
 */

const DropdownContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "evhzmqk7"
} : 0)( true ? {
  name: "nprss9",
  styles: ".dropdown-menu{padding:0;}"
} : 0);
const DropdownMenuHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_actions_menuHeader__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "evhzmqk6"
} : 0)("background:", p => p.theme.backgroundSecondary, ";", p => p.first && 'border-radius: 2px', ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";" + ( true ? "" : 0));

const StyledMenuItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "evhzmqk5"
} : 0)("width:", p => p.width === 'large' ? '350px' : '200px', ";&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const MenuItemContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk4"
} : 0)( true ? {
  name: "unrh3l",
  styles: "display:flex;justify-content:space-between;width:100%"
} : 0);

function DropdownItem(_ref) {
  let {
    children,
    onSelect,
    allowDefaultEvent,
    to,
    width = 'large'
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledMenuItem, {
    to: to,
    onSelect: onSelect,
    width: width,
    allowDefaultEvent: allowDefaultEvent,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(MenuItemContent, {
      children: children
    })
  });
}
DropdownItem.displayName = "DropdownItem";
const DropdownItemSubContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk3"
} : 0)( true ? {
  name: "1qz4178",
  styles: "display:flex;flex-direction:row;>a{padding-left:0!important;}"
} : 0);
const QuickTraceValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "evhzmqk2"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";white-space:nowrap;" + ( true ? "" : 0));
const ErrorNodeContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "evhzmqk1"
} : 0)("display:grid;grid-template-columns:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), ";align-items:center;" + ( true ? "" : 0));
const ExternalDropdownLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "evhzmqk0"
} : 0)("display:inherit!important;padding:0!important;color:", p => p.theme.textColor, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));
function SingleEventHoverText(_ref2) {
  let {
    event
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__["default"], {
      value: event.transaction,
      maxLength: 30,
      leftTrim: true,
      trimRegex: /\.|\//g,
      expandable: false
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
      children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_7__.getDuration)(event['transaction.duration'] / 1000, event['transaction.duration'] < 1000 ? 0 : 2, true)
    })]
  });
}
SingleEventHoverText.displayName = "SingleEventHoverText";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_quickTrace_styles_tsx.7c206a6b7a207ee097649ed0de1bba7e.js.map