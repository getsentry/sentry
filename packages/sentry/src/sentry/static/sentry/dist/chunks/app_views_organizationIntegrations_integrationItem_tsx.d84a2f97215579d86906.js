"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_integrationItem_tsx"],{

/***/ "./app/views/organizationIntegrations/integrationItem.tsx":
/*!****************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationItem.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ IntegrationItem)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/organizationIntegrations/integrationIcon */ "./app/views/organizationIntegrations/integrationIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






class IntegrationItem extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      integration,
      compact
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Flex, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_views_organizationIntegrations_integrationIcon__WEBPACK_IMPORTED_MODULE_4__["default"], {
          size: compact ? 22 : 32,
          integration: integration
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Labels, {
        compact: compact,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(IntegrationName, {
          "data-test-id": "integration-name",
          children: integration.name
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DomainName, {
          compact: compact,
          children: integration.domainName
        })]
      })]
    });
  }

}
IntegrationItem.displayName = "IntegrationItem";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(IntegrationItem, "defaultProps", {
  compact: false
});

const Flex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f03"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const Labels = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f02"
} : 0)("box-sizing:border-box;display:flex;", p => p.compact ? 'align-items: center;' : '', ";flex-direction:", p => p.compact ? 'row' : 'column', ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";min-width:0;justify-content:center;" + ( true ? "" : 0));

const IntegrationName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f01"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";font-weight:bold;" + ( true ? "" : 0)); // Not using the overflowEllipsis style import here
// as it sets width 100% which causes layout issues in the
// integration list.


const DomainName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1k6l1f00"
} : 0)("color:", p => p.theme.subText, ";margin-left:", p => p.compact ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1) : 'inherit', ";margin-top:", p => !p.compact ? 0 : 'inherit', ";font-size:", p => p.theme.fontSizeSmall, ";overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_integrationItem_tsx.ee74bde5ead563a760e1ef6dd848692f.js.map