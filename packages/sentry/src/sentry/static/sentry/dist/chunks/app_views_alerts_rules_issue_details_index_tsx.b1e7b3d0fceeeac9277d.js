"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_rules_issue_details_index_tsx"],{

/***/ "./app/views/alerts/rules/issue/details/index.tsx":
/*!********************************************************!*\
  !*** ./app/views/alerts/rules/issue/details/index.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function RuleDetailsContainer(_ref) {
  let {
    children,
    params
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])();
  const {
    projects,
    fetching
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_3__["default"])({
    slugs: [params.projectId]
  }); // Should almost never need to fetch project

  if (fetching) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__["default"], {});
  }

  return children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.cloneElement)(children, {
    organization,
    project: projects[0]
  }) : null;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RuleDetailsContainer);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_rules_issue_details_index_tsx.0b69879eef6443e468f0e81affe200f9.js.map