"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_acceptProjectTransfer_tsx"],{

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

/***/ "./app/views/acceptProjectTransfer.tsx":
/*!*********************************************!*\
  !*** ./app/views/acceptProjectTransfer.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/narrowLayout */ "./app/components/narrowLayout.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class AcceptProjectTransfer extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", formData => {
      this.api.request('/accept-transfer/', {
        method: 'POST',
        data: {
          data: this.props.location.query.data,
          organization: formData.organization
        },
        success: () => {
          const orgSlug = formData.organization;
          this.props.router.push(`/${orgSlug}`);
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Project successfully transferred'));
        },
        error: error => {
          const errorMsg = error && error.responseJSON && typeof error.responseJSON.detail === 'string' ? error.responseJSON.detail : '';
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Unable to transfer project') + errorMsg ? `: ${errorMsg}` : '');
        }
      });
    });
  }

  getEndpoints() {
    const query = this.props.location.query;
    return [['transferDetails', '/accept-transfer/', {
      query
    }]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Accept Project Transfer');
  }

  renderError(error) {
    let disableLog = false; // Check if there is an error message with `transferDetails` endpoint
    // If so, show as toast and ignore, otherwise log to sentry

    if (error && error.responseJSON && typeof error.responseJSON.detail === 'string') {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)(error.responseJSON.detail);
      disableLog = true;
    }

    return super.renderError(error, disableLog);
  }

  renderBody() {
    var _options$;

    const {
      transferDetails
    } = this.state;
    const options = transferDetails === null || transferDetails === void 0 ? void 0 : transferDetails.organizations.map(org => ({
      label: org.slug,
      value: org.slug
    }));
    const organization = options === null || options === void 0 ? void 0 : (_options$ = options[0]) === null || _options$ === void 0 ? void 0 : _options$.value;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_5__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Approve Transfer Project Request')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Projects must be transferred to a specific [organization]. ' + 'You can grant specific teams access to the project later under the [projectSettings]. ' + '(Note that granting access to at least one team is necessary for the project to ' + 'appear in all parts of the UI.)', {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Organization')
          }),
          projectSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Project Settings')
          })
        })
      }), transferDetails && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Please select which [organization] you want for the project [project].', {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Organization')
          }),
          project: transferDetails.project.slug
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_3__["default"], {
        onSubmit: this.handleSubmit,
        submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Transfer Project'),
        submitPriority: "danger",
        initialData: organization ? {
          organization
        } : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_4__["default"], {
          options: options,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Organization'),
          name: "organization",
          style: {
            borderBottom: 'none'
          }
        })
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AcceptProjectTransfer);

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
//# sourceMappingURL=../sourcemaps/app_views_acceptProjectTransfer_tsx.55eeb128209ac87039c4dfb9c24e65dc.js.map