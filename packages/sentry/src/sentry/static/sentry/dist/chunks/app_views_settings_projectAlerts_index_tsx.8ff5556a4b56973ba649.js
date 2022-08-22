"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectAlerts_index_tsx"],{

/***/ "./app/views/settings/projectAlerts/index.tsx":
/*!****************************************************!*\
  !*** ./app/views/settings/projectAlerts/index.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const ProjectAlerts = _ref => {
  let {
    children,
    organization
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__["default"], {
    organization: organization,
    access: ['project:write'],
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(children) && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.cloneElement)(children, {
          organization,
          canEditRule: hasAccess
        })
      });
    }
  });
};

ProjectAlerts.displayName = "ProjectAlerts";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectAlerts);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectAlerts_index_tsx.33e3fc1f785eb0e4769f31d01b3e22ac.js.map