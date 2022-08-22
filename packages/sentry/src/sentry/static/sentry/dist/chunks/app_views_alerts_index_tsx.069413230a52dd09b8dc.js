"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_index_tsx"],{

/***/ "./app/views/alerts/index.tsx":
/*!************************************!*\
  !*** ./app/views/alerts/index.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function AlertsContainer(_ref) {
  let {
    children
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])();
  const hasMetricAlerts = organization.features.includes('incidents');
  const content = children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(children, {
    organization,
    hasMetricAlerts
  }) : children;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: content
  });
}

AlertsContainer.displayName = "AlertsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertsContainer);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_index_tsx.8a037d94ff4dc72f8d5bbb2986f1a800.js.map