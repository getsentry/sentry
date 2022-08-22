"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_builder_projectProvider_tsx"],{

/***/ "./app/views/alerts/builder/projectProvider.tsx":
/*!******************************************************!*\
  !*** ./app/views/alerts/builder/projectProvider.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_useScrollToTop__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useScrollToTop */ "./app/utils/useScrollToTop.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function AlertBuilderProjectProvider(props) {
  var _projects$find;

  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__["default"])();
  (0,sentry_utils_useScrollToTop__WEBPACK_IMPORTED_MODULE_8__["default"])({
    location: props.location
  });
  const {
    children,
    params,
    organization,
    ...other
  } = props;
  const projectId = params.projectId || props.location.query.project;
  const useFirstProject = projectId === undefined; // calling useProjects() without args fetches all projects

  const {
    projects,
    initiallyLoaded,
    fetching,
    fetchError
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_7__["default"])(useFirstProject ? undefined : {
    slugs: [projectId]
  });
  const project = useFirstProject ? (_projects$find = projects.find(p => p.isMember)) !== null && _projects$find !== void 0 ? _projects$find : projects.length && projects[0] : projects.find(_ref => {
    let {
      slug
    } = _ref;
    return slug === projectId;
  });
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!project) {
      return;
    } // fetch members list for mail action fields


    (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_1__.fetchOrgMembers)(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  if (!initiallyLoaded || fetching) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
  } // If there's no project show the project selector modal


  if (!project && !fetchError) {
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_2__.navigateTo)(`/organizations/${organization.slug}/alerts/wizard/?referrer=${props.location.query.referrer}&project=:projectId`, props.router);
  } // if loaded, but project fetching states incomplete or project can't be found, project doesn't exist


  if (!project || fetchError) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "warning",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('The project you were looking for was not found.')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.cloneElement)(children, { ...other,
      ...children.props,
      project,
      projectId: useFirstProject ? project.slug : projectId,
      organization
    }) : children
  });
}

AlertBuilderProjectProvider.displayName = "AlertBuilderProjectProvider";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertBuilderProjectProvider);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_builder_projectProvider_tsx.0bdbe1abbca61706c57360c3b0d947ce.js.map