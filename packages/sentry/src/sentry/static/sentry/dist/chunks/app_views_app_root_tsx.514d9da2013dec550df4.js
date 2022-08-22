"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_app_root_tsx"],{

/***/ "./app/views/app/root.tsx":
/*!********************************!*\
  !*** ./app/views/app/root.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");







/**
 * This view is used when a user lands on the route `/` which historically
 * is a server-rendered route which redirects the user to their last selected organization
 *
 * However, this does not work when in the experimental SPA mode (e.g. developing against a remote API,
 * or a deploy preview), so we must replicate the functionality and redirect
 * the user to the proper organization.
 *
 * TODO: There might be an edge case where user does not have `lastOrganization` set,
 * in which case we should load their list of organizations and make a decision
 */

function AppRoot() {
  const config = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_5__.useLegacyStore)(sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!config.lastOrganization) {
      return;
    }

    const orgSlug = config.lastOrganization;
    const url = (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_6__["default"])(sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_APP_ROUTE, {
      orgSlug
    });
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.replace(url);
  }, [config]);
  return null;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AppRoot);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_app_root_tsx.7df19a1b8f829c5a3b43e73f4baae458.js.map