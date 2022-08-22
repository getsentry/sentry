"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_userFeedback_index_tsx"],{

/***/ "./app/views/userFeedback/index.tsx":
/*!******************************************!*\
  !*** ./app/views/userFeedback/index.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/react/esm/profiler.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_userFeedback__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/userFeedback */ "./app/components/events/userFeedback.tsx");
/* harmony import */ var sentry_components_issues_compactIssue__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/issues/compactIssue */ "./app/components/issues/compactIssue.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _userFeedbackEmpty__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./userFeedbackEmpty */ "./app/views/userFeedback/userFeedbackEmpty.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./utils */ "./app/views/userFeedback/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























class OrganizationUserFeedback extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_20__["default"] {
  getEndpoints() {
    const {
      organization,
      location: {
        search
      }
    } = this.props;
    return [['reportList', `/organizations/${organization.slug}/user-feedback/`, {
      query: (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getQuery)(search)
    }]];
  }

  getTitle() {
    return `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('User Feedback')} - ${this.props.organization.slug}`;
  }

  get projectIds() {
    const {
      project
    } = this.props.location.query;
    return Array.isArray(project) ? project : typeof project === 'string' ? [project] : [];
  }

  renderResults() {
    const {
      orgId
    } = this.props.params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
      className: "issue-list",
      "data-test-id": "user-feedback-list",
      children: this.state.reportList.map(item => {
        const issue = item.issue;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_issues_compactIssue__WEBPACK_IMPORTED_MODULE_7__["default"], {
          id: issue.id,
          data: issue,
          eventId: item.eventID,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledEventUserFeedback, {
            report: item,
            orgId: orgId,
            issueId: issue.id
          })
        }, item.id);
      })
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_userFeedbackEmpty__WEBPACK_IMPORTED_MODULE_21__.UserFeedbackEmpty, {
      projectIds: this.projectIds
    });
  }

  renderLoading() {
    return this.renderBody();
  }

  renderStreamBody() {
    const {
      loading,
      reportList
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {})
      });
    }

    if (!reportList.length) {
      return this.renderEmpty();
    }

    return this.renderResults();
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      location
    } = this.props;
    const {
      pathname,
      search,
      query
    } = location;
    const {
      status
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getQuery)(search);
    const {
      reportListPageLinks
    } = this.state;
    const unresolvedQuery = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(query, 'status');
    const allIssuesQuery = { ...query,
      status: ''
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_11__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_9__["default"], {
          organization: organization,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
            "data-test-id": "user-feedback",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Header, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_12__["default"], {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('User Feedback')
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Filters, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_10__["default"], {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_15__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_5__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  alignDropdown: "right"
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
                active: !Array.isArray(status) ? status || '' : '',
                merged: true,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
                  barId: "unresolved",
                  to: {
                    pathname,
                    query: unresolvedQuery
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unresolved')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
                  barId: "",
                  to: {
                    pathname,
                    query: allIssuesQuery
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All Issues')
                })]
              })]
            }), this.renderStreamBody(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__["default"], {
              pageLinks: reportListPageLinks
            })]
          })
        })
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__["default"])((0,_sentry_react__WEBPACK_IMPORTED_MODULE_24__.withProfiler)(OrganizationUserFeedback)));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9pbchc2"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";" + ( true ? "" : 0));

const Filters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e9pbchc1"
} : 0)("display:grid;grid-template-columns:minmax(0, max-content) max-content;justify-content:start;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:minmax(0, 1fr) max-content;}@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:minmax(0, 1fr);}" + ( true ? "" : 0));

const StyledEventUserFeedback = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_userFeedback__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e9pbchc0"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), " 0 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/userFeedback/utils.tsx":
/*!******************************************!*\
  !*** ./app/views/userFeedback/utils.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getQuery": () => (/* binding */ getQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");




const DEFAULT_STATUS = 'unresolved';
/**
 * Get query for API given the current location.search string
 */

function getQuery(search) {
  const query = query_string__WEBPACK_IMPORTED_MODULE_2__.parse(search);
  const status = typeof query.status !== 'undefined' ? query.status : DEFAULT_STATUS;
  const queryParams = {
    status,
    ...lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, ['cursor', ...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_3__.URL_PARAM)])
  };
  return queryParams;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_userFeedback_index_tsx.ac117299dc967390324644a9c5f8207e.js.map