"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_monitors_index_tsx"],{

/***/ "./app/views/monitors/index.tsx":
/*!**************************************!*\
  !*** ./app/views/monitors/index.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "et4neli0"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";flex-direction:column;flex:1;" + ( true ? "" : 0));

const MonitorsContainer = _ref => {
  let {
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__["default"], {
    features: ['monitors'],
    renderDisabled: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Body, {
          children: children
        })
      })
    })
  });
};

MonitorsContainer.displayName = "MonitorsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_4__["default"])(MonitorsContainer));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_monitors_index_tsx.d97c824152a75f3d469367e357ddf54f.js.map