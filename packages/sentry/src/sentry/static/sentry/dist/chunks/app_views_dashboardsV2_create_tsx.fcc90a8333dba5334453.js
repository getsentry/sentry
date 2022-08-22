"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_create_tsx"],{

/***/ "./app/views/dashboardsV2/create.tsx":
/*!*******************************************!*\
  !*** ./app/views/dashboardsV2/create.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./data */ "./app/views/dashboardsV2/data.tsx");
/* harmony import */ var _detail__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./detail */ "./app/views/dashboardsV2/detail.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















function CreateDashboard(props) {
  const {
    location
  } = props;
  const {
    templateId
  } = props.params;
  const [newWidget, setNewWidget] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)();

  function renderDisabled() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)("You don't have access to this feature")
      })
    });
  }

  const template = templateId ? _data__WEBPACK_IMPORTED_MODULE_10__.DASHBOARDS_TEMPLATES.find(dashboardTemplate => dashboardTemplate.id === templateId) : undefined;
  const dashboard = template ? (0,_utils__WEBPACK_IMPORTED_MODULE_13__.cloneDashboard)(template) : (0,_utils__WEBPACK_IMPORTED_MODULE_13__.cloneDashboard)(_data__WEBPACK_IMPORTED_MODULE_10__.EMPTY_DASHBOARD);
  const initialState = template ? _types__WEBPACK_IMPORTED_MODULE_12__.DashboardState.PREVIEW : _types__WEBPACK_IMPORTED_MODULE_12__.DashboardState.CREATE;
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const constructedWidget = (0,_utils__WEBPACK_IMPORTED_MODULE_13__.constructWidgetFromQuery)(location.query);
    setNewWidget(constructedWidget);

    if (constructedWidget) {
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace(location.pathname);
    }
  }, [location.pathname]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
    features: ['dashboards-edit'],
    organization: props.organization,
    renderDisabled: renderDisabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_6__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_detail__WEBPACK_IMPORTED_MODULE_11__["default"], { ...props,
        initialState: initialState,
        dashboard: dashboard,
        dashboards: [],
        newWidget: newWidget,
        onSetNewWidget: () => setNewWidget(undefined)
      })
    })
  });
}

CreateDashboard.displayName = "CreateDashboard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(CreateDashboard));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_create_tsx.3d0d8e77e0042e13b1ad552ff3544940.js.map