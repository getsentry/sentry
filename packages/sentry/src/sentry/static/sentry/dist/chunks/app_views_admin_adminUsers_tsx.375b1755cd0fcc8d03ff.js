"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminUsers_tsx"],{

/***/ "./app/views/admin/adminUsers.tsx":
/*!****************************************!*\
  !*** ./app/views/admin/adminUsers.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AdminUsers),
/* harmony export */   "prettyDate": () => (/* binding */ prettyDate)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/resultGrid */ "./app/components/resultGrid.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const prettyDate = function (x) {
  return moment__WEBPACK_IMPORTED_MODULE_2___default()(x).format('ll');
};
class AdminUsers extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getRow", row => [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("td", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("strong", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
          to: `/manage/users/${row.id}/`,
          children: row.username
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("br", {}), row.email !== row.username && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("small", {
        children: row.email
      })]
    }, "username"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("td", {
      style: {
        textAlign: 'center'
      },
      children: prettyDate(row.dateJoined)
    }, "dateJoined"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("td", {
      style: {
        textAlign: 'center'
      },
      children: prettyDate(row.lastLogin)
    }, "lastLogin")]);
  }

  render() {
    const columns = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("th", {
      children: "User"
    }, "username"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("th", {
      style: {
        textAlign: 'center',
        width: 150
      },
      children: "Joined"
    }, "dateJoined"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("th", {
      style: {
        textAlign: 'center',
        width: 150
      },
      children: "Last Login"
    }, "lastLogin")];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Users')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_4__["default"], {
        path: "/manage/users/",
        endpoint: "/users/",
        method: "GET",
        columns: columns,
        columnsForRow: this.getRow,
        hasSearch: true,
        filters: {
          status: {
            name: 'Status',
            options: [['active', 'Active'], ['disabled', 'Disabled']]
          }
        },
        sortOptions: [['date', 'Date Joined']],
        defaultSort: "date",
        ...this.props
      })]
    });
  }

}
AdminUsers.displayName = "AdminUsers";

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminUsers_tsx.96fbe18a7a344e722709580587c2e1f6.js.map