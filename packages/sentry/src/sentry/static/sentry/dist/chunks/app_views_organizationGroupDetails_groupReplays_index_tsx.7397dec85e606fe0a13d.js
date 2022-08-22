"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupReplays_index_tsx"],{

/***/ "./app/utils/useParams.tsx":
/*!*********************************!*\
  !*** ./app/utils/useParams.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useParams": () => (/* binding */ useParams)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useParams() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.params;
}

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupReplays/groupReplays.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupReplays/groupReplays.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayList */ "./app/utils/replays/hooks/useReplayList.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var sentry_views_replays_replayTable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/replays/replayTable */ "./app/views/replays/replayTable.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const GroupReplays = _ref => {
  let {
    group
  } = _ref;
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_8__.useLocation)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_10__.useParams)();
  const {
    project
  } = group;
  const eventView = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__.decodeScalar)(location.query.query, '');
    const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__.MutableSearch(query);
    conditions.addFilterValues('issue.id', params.groupId);
    return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_4__["default"].fromNewQueryWithLocation({
      id: '',
      name: '',
      version: 2,
      fields: sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_6__.REPLAY_LIST_FIELDS,
      projects: [Number(project.id)],
      query: conditions.formatString(),
      orderby: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__.decodeScalar)(location.query.sort, sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_6__.DEFAULT_SORT)
    }, location);
  }, [location, project.id, params.groupId]);
  const {
    replays,
    pageLinks,
    isFetching
  } = (0,sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_6__["default"])({
    organization,
    eventView
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledPageContent, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_replays_replayTable__WEBPACK_IMPORTED_MODULE_11__["default"], {
      isFetching: isFetching,
      replays: replays,
      showProjectColumn: false,
      sort: eventView.sorts[0]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_2__["default"], {
      pageLinks: pageLinks
    })]
  });
};

GroupReplays.displayName = "GroupReplays";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__.PageContent,  true ? {
  target: "e1g324zf0"
} : 0)("box-shadow:0px 0px 1px ", p => p.theme.gray200, ";background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupReplays);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupReplays/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupReplays/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _groupReplays__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./groupReplays */ "./app/views/organizationGroupDetails/groupReplays/groupReplays.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const GroupReplaysContainer = _ref => {
  let {
    group
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();

  function renderNoAccess() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_3__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("You don't have access to this feature")
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['session-replay-ui'],
    organization: organization,
    renderDisabled: renderNoAccess,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_groupReplays__WEBPACK_IMPORTED_MODULE_5__["default"], {
      group: group
    })
  });
};

GroupReplaysContainer.displayName = "GroupReplaysContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupReplaysContainer);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupReplays_index_tsx.1a1526e103fe28a87b41f544f0bc976d.js.map