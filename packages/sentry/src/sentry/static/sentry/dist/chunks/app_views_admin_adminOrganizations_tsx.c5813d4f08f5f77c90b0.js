"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminOrganizations_tsx"],{

/***/ "./app/views/admin/adminOrganizations.tsx":
/*!************************************************!*\
  !*** ./app/views/admin/adminOrganizations.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/resultGrid */ "./app/components/resultGrid.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const getRow = row => [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("td", {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("strong", {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__["default"], {
      to: `/${row.slug}/`,
      children: row.name
    })
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("small", {
    children: row.slug
  })]
}, row.id)];

const AdminOrganizations = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h3", {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Organizations')
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_1__["default"], {
    path: "/manage/organizations/",
    endpoint: "/organizations/?show=all",
    method: "GET",
    columns: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("th", {
      children: "Organization"
    }, "column-org")],
    columnsForRow: getRow,
    hasSearch: true,
    sortOptions: [['date', 'Date Joined'], ['members', 'Members'], ['events', 'Events'], ['projects', 'Projects'], ['employees', 'Employees']],
    defaultSort: "date",
    ...props
  })]
});

AdminOrganizations.displayName = "AdminOrganizations";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AdminOrganizations);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminOrganizations_tsx.25c85bb720243ef295e82f03807eef17.js.map