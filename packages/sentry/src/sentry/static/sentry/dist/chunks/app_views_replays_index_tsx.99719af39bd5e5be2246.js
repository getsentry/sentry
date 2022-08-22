"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_replays_index_tsx"],{

/***/ "./app/views/replays/index.tsx":
/*!*************************************!*\
  !*** ./app/views/replays/index.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function ReplaysContainer(_ref) {
  let {
    organization,
    children
  } = _ref;

  function renderNoAccess() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("You don't have access to this feature")
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['session-replay-ui'],
    organization: organization,
    renderDisabled: renderNoAccess,
    children: children
  });
}

ReplaysContainer.displayName = "ReplaysContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])(ReplaysContainer));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_replays_index_tsx.04544c6ef869fd15a66f5684ae27955e.js.map