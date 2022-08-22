"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminLayout_tsx"],{

/***/ "./app/views/admin/adminLayout.tsx":
/*!*****************************************!*\
  !*** ./app/views/admin/adminLayout.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_context__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/context */ "./app/views/settings/components/settingsBreadcrumb/context.tsx");
/* harmony import */ var sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsLayout */ "./app/views/settings/components/settingsLayout.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavigation */ "./app/views/settings/components/settingsNavigation.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const AdminNavigation = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsNavigation__WEBPACK_IMPORTED_MODULE_5__["default"], {
  stickyTop: "0",
  navigationObjects: [{
    name: 'System Status',
    items: [{
      path: '/manage/',
      index: true,
      title: 'Overview'
    }, {
      path: '/manage/buffer/',
      title: 'Buffer'
    }, {
      path: '/manage/queue/',
      title: 'Queue'
    }, {
      path: '/manage/quotas/',
      title: 'Quotas'
    }, {
      path: '/manage/status/environment/',
      title: 'Environment'
    }, {
      path: '/manage/status/packages/',
      title: 'Packages'
    }, {
      path: '/manage/status/mail/',
      title: 'Mail'
    }, {
      path: '/manage/status/warnings/',
      title: 'Warnings'
    }, {
      path: '/manage/settings/',
      title: 'Settings'
    }]
  }, {
    name: 'Manage',
    items: [{
      path: '/manage/organizations/',
      title: 'Organizations'
    }, {
      path: '/manage/projects/',
      title: 'Projects'
    }, {
      path: '/manage/users/',
      title: 'Users'
    }]
  }]
});

AdminNavigation.displayName = "AdminNavigation";

function AdminLayout(_ref) {
  let {
    children,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
    noSuffix: true,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sentry Admin'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Page, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsBreadcrumb_context__WEBPACK_IMPORTED_MODULE_3__.BreadcrumbProvider, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsLayout__WEBPACK_IMPORTED_MODULE_4__["default"], {
          renderNavigation: AdminNavigation,
          ...props,
          children: children
        })
      })
    })
  });
}

AdminLayout.displayName = "AdminLayout";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AdminLayout);

const Page = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8z52870"
} : 0)( true ? {
  name: "5thnkd",
  styles: "display:flex;flex-grow:1"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminLayout_tsx.72e016635fe1ce06ead083e97b7c231b.js.map