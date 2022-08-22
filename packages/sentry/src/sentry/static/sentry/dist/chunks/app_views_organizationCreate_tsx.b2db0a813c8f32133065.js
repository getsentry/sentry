"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationCreate_tsx"],{

/***/ "./app/components/narrowLayout.tsx":
/*!*****************************************!*\
  !*** ./app/components/narrowLayout.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function NarrowLayout(_ref) {
  let {
    maxWidth,
    showLogout,
    children
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    document.body.classList.add('narrow');
    return () => document.body.classList.remove('narrow');
  }, []);

  async function handleLogout() {
    await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__.logout)(api);
    window.location.assign('/auth/login');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "app",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "pattern-bg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "container",
      style: {
        maxWidth
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
        className: "box box-modal",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "box-header",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            href: "/",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry, {
              size: "lg"
            })
          }), showLogout && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            className: "logout pull-right",
            onClick: handleLogout,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Logout, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sign out')
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
          className: "box-content with-padding",
          children: children
        })]
      })
    })]
  });
}

NarrowLayout.displayName = "NarrowLayout";

const Logout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eaq1ri90"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NarrowLayout);

/***/ }),

/***/ "./app/views/organizationCreate.tsx":
/*!******************************************!*\
  !*** ./app/views/organizationCreate.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/narrowLayout */ "./app/components/narrowLayout.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function OrganizationCreate() {
  const termsUrl = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"].get('termsUrl');
  const privacyUrl = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_4__["default"].get('privacyUrl');
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create Organization'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_1__["default"], {
      showLogout: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create a New Organization')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_0__.ApiForm, {
        initialData: {
          defaultTeam: true
        },
        submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create Organization'),
        apiEndpoint: "/organizations/",
        apiMethod: "POST",
        onSubmitSuccess: data => {
          // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
          // browserHistory.pushState(null, `/organizations/${data.slug}/projects/new/`);
          window.location.href = `/organizations/${data.slug}/projects/new/`;
        },
        requireChanges: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_0__.TextField, {
          id: "organization-name",
          name: "name",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Organization Name'),
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('e.g. My Company'),
          inline: false,
          flexibleControlStateSize: true,
          stacked: true,
          required: true
        }), termsUrl && privacyUrl && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_0__.CheckboxField, {
          id: "agreeTerms",
          name: "agreeTerms",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]', {
            termsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
              href: termsUrl
            }),
            privacyLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
              href: privacyUrl
            })
          }),
          inline: false,
          stacked: true,
          required: true
        })]
      })]
    })
  });
}

OrganizationCreate.displayName = "OrganizationCreate";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationCreate);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationCreate_tsx.f29e1f63af143aa9593b67db62e29eef.js.map