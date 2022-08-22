"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_alertLink_tsx"],{

/***/ "./app/components/alertLink.tsx":
/*!**************************************!*\
  !*** ./app/components/alertLink.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function AlertLink(_ref) {
  let {
    size = 'normal',
    priority = 'warning',
    icon,
    children,
    onClick,
    withoutMarginBottom = false,
    openInNewTab = false,
    to,
    href,
    ['data-test-id']: dataTestId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StyledLink, {
    "data-test-id": dataTestId,
    to: to,
    href: href,
    onClick: onClick,
    size: size,
    priority: priority,
    withoutMarginBottom: withoutMarginBottom,
    openInNewTab: openInNewTab,
    children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(IconWrapper, {
      children: icon
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(AlertLinkText, {
      children: children
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(IconLink, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
        direction: "right"
      })
    })]
  });
}

AlertLink.displayName = "AlertLink";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertLink);

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    openInNewTab,
    to,
    href,
    ...props
  } = _ref2;
  const linkProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['withoutMarginBottom', 'priority', 'size']);

  if (href) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], { ...linkProps,
      href: href,
      openInNewTab: openInNewTab
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], { ...linkProps,
    to: to || ''
  });
},  true ? {
  target: "ear9tuy3"
} : 0)("display:flex;align-items:center;background-color:", p => p.theme.alert[p.priority].backgroundLight, ";color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeMedium, ";border:1px dashed ", p => p.theme.alert[p.priority].border, ";padding:", p => p.size === 'small' ? `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1.5)}` : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";margin-bottom:", p => p.withoutMarginBottom ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), ";border-radius:0.25em;transition:0.2s border-color;&.focus-visible{outline:none;box-shadow:", p => p.theme.alert[p.priority].border, "7f 0 0 0 2px;}" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ear9tuy2"
} : 0)("display:flex;height:calc(", p => p.theme.fontSizeMedium, " * ", p => p.theme.text.lineHeightBody, ");margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const IconLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(IconWrapper,  true ? {
  target: "ear9tuy1"
} : 0)("margin-right:0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

const AlertLinkText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ear9tuy0"
} : 0)("line-height:", p => p.theme.text.lineHeightBody, ";flex-grow:1;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_alertLink_tsx.e49b6065bad6e1b85e517364333b479a.js.map