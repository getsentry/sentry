"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_teamAccessRequestModal_tsx"],{

/***/ "./app/components/modals/teamAccessRequestModal.tsx":
/*!**********************************************************!*\
  !*** ./app/components/modals/teamAccessRequestModal.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class CreateTeamAccessRequest extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      createBusy: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClick", async () => {
      const {
        api,
        memberId,
        orgId,
        teamId,
        closeModal
      } = this.props;
      this.setState({
        createBusy: true
      });

      try {
        await api.requestPromise(`/organizations/${orgId}/members/${memberId}/teams/${teamId}/`, {
          method: 'POST'
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Team request sent for approval'));
      } catch (err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Unable to send team request'));
      }

      this.setState({
        createBusy: false
      });
      closeModal();
    });
  }

  render() {
    const {
      Body,
      Footer,
      closeModal,
      teamId
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Body, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('You do not have permission to add members to the #[team] team, but we will send a request to your organization admins for approval.', {
          team: teamId
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ButtonGroup, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onClick: closeModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Cancel')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "primary",
            onClick: this.handleClick,
            busy: this.state.createBusy,
            autoFocus: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Continue')
          })]
        })
      })]
    });
  }

}

CreateTeamAccessRequest.displayName = "CreateTeamAccessRequest";

const ButtonGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e8l8h990"
} : 0)("display:grid;grid-template-columns:max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])(CreateTeamAccessRequest));

/***/ }),

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");



/**
 * Returns an API client that will have it's requests canceled when the owning
 * React component is unmounted (may be disabled via options).
 */
function useApi() {
  let {
    persistInFlight,
    api: providedApi
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const localApi = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(); // Lazily construct the client if we weren't provided with one

  if (localApi.current === undefined && providedApi === undefined) {
    localApi.current = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  } // Use the provided client if available


  const api = providedApi !== null && providedApi !== void 0 ? providedApi : localApi.current; // Clear API calls on unmount (if persistInFlight is disabled

  const clearOnUnmount = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!persistInFlight) {
      api.clear();
    }
  }, [api, persistInFlight]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => clearOnUnmount, [clearOnUnmount]);
  return api;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApi);

/***/ }),

/***/ "./app/utils/withApi.tsx":
/*!*******************************!*\
  !*** ./app/utils/withApi.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * XXX: Prefer useApi if you are wrapping a Function Component!
 *
 * React Higher-Order Component (HoC) that provides "api" client when mounted,
 * and clears API requests when component is unmounted.
 *
 * If an `api` prop is provided when the component is invoked it will be passed
 * through.
 */
const withApi = function (WrappedComponent) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const WithApi = _ref => {
    let {
      api: propsApi,
      ...props
    } = _ref;
    const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__["default"])({
      api: propsApi,
      ...options
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      api: api
    });
  };

  WithApi.displayName = `withApi(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return WithApi;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withApi);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_teamAccessRequestModal_tsx.8f2b570e87a67131395f08381e83a83e.js.map