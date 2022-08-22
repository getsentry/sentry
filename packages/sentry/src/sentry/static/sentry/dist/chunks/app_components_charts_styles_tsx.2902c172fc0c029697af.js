"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_styles_tsx"],{

/***/ "./app/components/charts/styles.tsx":
/*!******************************************!*\
  !*** ./app/components/charts/styles.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ChartContainer": () => (/* binding */ ChartContainer),
/* harmony export */   "ChartControls": () => (/* binding */ ChartControls),
/* harmony export */   "HeaderTitle": () => (/* binding */ HeaderTitle),
/* harmony export */   "HeaderTitleLegend": () => (/* binding */ HeaderTitleLegend),
/* harmony export */   "HeaderValue": () => (/* binding */ HeaderValue),
/* harmony export */   "InlineContainer": () => (/* binding */ InlineContainer),
/* harmony export */   "SectionHeading": () => (/* binding */ SectionHeading),
/* harmony export */   "SectionValue": () => (/* binding */ SectionValue),
/* harmony export */   "SubHeading": () => (/* binding */ SubHeading)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


const SubHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "ey7s1vy8"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";font-weight:normal;color:", p => p.theme.textColor, ";margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" + ( true ? "" : 0));
const SectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h4',  true ? {
  target: "ey7s1vy7"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";align-items:center;color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " 0;" + ( true ? "" : 0));
const SectionValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ey7s1vy6"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";" + ( true ? "" : 0));
const InlineContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey7s1vy5"
} : 0)("display:grid;align-items:center;@media (min-width: ", p => p.theme.breakpoints.small, "){grid-auto-flow:column;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";}" + ( true ? "" : 0));
const ChartControls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey7s1vy4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";border-top:1px solid ", p => p.theme.border, ";@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;justify-content:space-between;flex-wrap:wrap;}" + ( true ? "" : 0)); // Header element for charts within panels.

const HeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey7s1vy3"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";", p => p.theme.text.cardTitle, ";color:", p => p.theme.headingColor, ";align-items:center;" + ( true ? "" : 0)); // Header element for charts within panels
// This header can be rendered while the chart is still loading

const HeaderTitleLegend = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(HeaderTitle,  true ? {
  target: "ey7s1vy2"
} : 0)("background-color:", p => p.theme.background, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";position:absolute;z-index:1;" + ( true ? "" : 0)); // Used for rendering total value of a chart right below the HeaderTitleLegend

const HeaderValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey7s1vy1"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";align-items:baseline;background-color:", p => p.theme.background, ";position:absolute;top:40px;z-index:1;font-size:", p => p.theme.headerFontSize, ";" + ( true ? "" : 0));
const ChartContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey7s1vy0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_styles_tsx.4981c4e01d7a1a51ff0a393670c4b553.js.map