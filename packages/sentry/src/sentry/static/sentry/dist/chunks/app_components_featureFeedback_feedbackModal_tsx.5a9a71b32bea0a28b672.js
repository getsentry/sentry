"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_featureFeedback_feedbackModal_tsx"],{

/***/ "./app/components/featureFeedback/feedbackModal.tsx":
/*!**********************************************************!*\
  !*** ./app/components/featureFeedback/feedbackModal.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FeedbackModal": () => (/* binding */ FeedbackModal),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/client.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/transports/fetch.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/stack-parsers.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/sdk.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/controls/textarea */ "./app/components/forms/controls/textarea.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _buttonBar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var _forms_field__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var _links_externalLink__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const feedbackClient = new _sentry_react__WEBPACK_IMPORTED_MODULE_16__.BrowserClient({
  // feedback project under Sentry organization
  dsn: 'https://3c5ef4e344a04a0694d187a1272e96de@o1.ingest.sentry.io/6356259',
  transport: _sentry_react__WEBPACK_IMPORTED_MODULE_17__.makeFetchTransport,
  stackParser: _sentry_react__WEBPACK_IMPORTED_MODULE_18__.defaultStackParser,
  integrations: _sentry_react__WEBPACK_IMPORTED_MODULE_19__.defaultIntegrations
});
const defaultFeedbackTypes = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("I don't like this feature"), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('I like this feature'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Other reason')];
function FeedbackModal(_ref) {
  let {
    Header,
    Body,
    Footer,
    closeModal,
    feedbackTypes = defaultFeedbackTypes,
    featureName
  } = _ref;
  const {
    organization
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_9__.useLegacyStore)(sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_8__["default"]);
  const {
    projects,
    initiallyLoaded: projectsLoaded
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_11__.useLocation)();
  const {
    user,
    isSelfHosted
  } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__["default"].getConfig();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    subject: undefined,
    additionalInfo: undefined
  });
  const project = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (projectsLoaded && location.query.project) {
      return projects.find(p => p.id === location.query.project);
    }

    return undefined;
  }, [projectsLoaded, projects, location.query.project]);

  function handleSubmit() {
    var _organization$feature, _organization$access, _project$features;

    const {
      subject,
      additionalInfo
    } = state;

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(subject)) {
      return;
    }

    feedbackClient.captureEvent({
      message: additionalInfo !== null && additionalInfo !== void 0 && additionalInfo.trim() ? `Feedback: ${feedbackTypes[subject]} - ${additionalInfo}` : `Feedback: ${feedbackTypes[subject]}`,
      request: {
        url: location.pathname
      },
      extra: {
        orgFeatures: (_organization$feature = organization === null || organization === void 0 ? void 0 : organization.features) !== null && _organization$feature !== void 0 ? _organization$feature : [],
        orgAccess: (_organization$access = organization === null || organization === void 0 ? void 0 : organization.access) !== null && _organization$access !== void 0 ? _organization$access : [],
        projectFeatures: (_project$features = project === null || project === void 0 ? void 0 : project.features) !== null && _project$features !== void 0 ? _project$features : []
      },
      tags: {
        featureName
      },
      user,
      level: 'info'
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Thanks for taking the time to provide us feedback!'));
    closeModal();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Submit Feedback')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_5__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Type of feedback'),
        name: "subject",
        inline: false,
        options: feedbackTypes.map((feedbackType, index) => ({
          value: index,
          label: feedbackType
        })),
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Select type of feedback'),
        value: state.subject,
        onChange: value => setState({ ...state,
          subject: value
        }),
        flexibleControlStateSize: true,
        stacked: true,
        required: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_forms_field__WEBPACK_IMPORTED_MODULE_14__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Additional feedback'),
        inline: false,
        required: false,
        flexibleControlStateSize: true,
        stacked: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_controls_textarea__WEBPACK_IMPORTED_MODULE_4__["default"], {
          name: "additional-feedback",
          value: state.additionalInfo,
          rows: 5,
          autosize: true,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('What did you expect?'),
          onChange: event => setState({ ...state,
            additionalInfo: event.target.value
          })
        })
      }), isSelfHosted && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)("You agree that any feedback you submit is subject to Sentry's [privacyPolicy:Privacy Policy] and Sentry may use such feedback without restriction or obligation.", {
          privacyPolicy: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_links_externalLink__WEBPACK_IMPORTED_MODULE_15__["default"], {
            href: "https://sentry.io/privacy/"
          })
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(_buttonBar__WEBPACK_IMPORTED_MODULE_13__["default"], {
        gap: 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          onClick: closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Cancel')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          priority: "primary",
          onClick: handleSubmit,
          disabled: !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(state.subject),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Submit Feedback')
        })]
      })
    })]
  });
}
FeedbackModal.displayName = "FeedbackModal";
const modalCss =  true ? {
  name: "16o92yp",
  styles: "width:100%;max-width:680px"
} : 0;

/***/ }),

/***/ "./app/utils/useLocation.tsx":
/*!***********************************!*\
  !*** ./app/utils/useLocation.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocation": () => (/* binding */ useLocation)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useLocation() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.location;
}

/***/ }),

/***/ "./app/utils/useRouteContext.tsx":
/*!***************************************!*\
  !*** ./app/utils/useRouteContext.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useRouteContext": () => (/* binding */ useRouteContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_views_routeContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/routeContext */ "./app/views/routeContext.tsx");



function useRouteContext() {
  const route = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_views_routeContext__WEBPACK_IMPORTED_MODULE_2__.RouteContext);

  if (route === null) {
    throw new Error(`useRouteContext called outside of routes provider`);
  }

  return route;
}

/***/ }),

/***/ "./app/views/routeContext.tsx":
/*!************************************!*\
  !*** ./app/views/routeContext.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RouteContext": () => (/* binding */ RouteContext)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

// TODO(nisanthan): Better types. Context will be the `props` arg from the RouterProps render method. This is typed as `any` by react-router
const RouteContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)(null);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_featureFeedback_feedbackModal_tsx.12059d8a1d797883b9cfebd60fff723a.js.map