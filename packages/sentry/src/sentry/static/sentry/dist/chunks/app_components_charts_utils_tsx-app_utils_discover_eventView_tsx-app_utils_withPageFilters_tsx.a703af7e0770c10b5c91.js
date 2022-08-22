"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_utils_tsx-app_utils_discover_eventView_tsx-app_utils_withPageFilters_tsx"],{

/***/ "./app/actionCreators/discoverSavedQueries.tsx":
/*!*****************************************************!*\
  !*** ./app/actionCreators/discoverSavedQueries.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createSavedQuery": () => (/* binding */ createSavedQuery),
/* harmony export */   "deleteSavedQuery": () => (/* binding */ deleteSavedQuery),
/* harmony export */   "fetchSavedQueries": () => (/* binding */ fetchSavedQueries),
/* harmony export */   "fetchSavedQuery": () => (/* binding */ fetchSavedQuery),
/* harmony export */   "updateSavedQuery": () => (/* binding */ updateSavedQuery),
/* harmony export */   "updateSavedQueryVisit": () => (/* binding */ updateSavedQueryVisit)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");



function fetchSavedQueries(api, orgId) {
  let query = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/`, {
    method: 'GET',
    query: {
      query: `version:2 ${query}`.trim()
    }
  });
  promise.catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to load saved queries'));
  });
  return promise;
}
function fetchSavedQuery(api, orgId, queryId) {
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/${queryId}/`, {
    method: 'GET'
  });
  promise.catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to load saved query'));
  });
  return promise;
}
function createSavedQuery(api, orgId, query) {
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/`, {
    method: 'POST',
    data: query
  });
  promise.catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to create your saved query'));
  });
  return promise;
}
function updateSavedQuery(api, orgId, query) {
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/${query.id}/`, {
    method: 'PUT',
    data: query
  });
  promise.catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to update your saved query'));
  });
  return promise;
}
function updateSavedQueryVisit(orgId, queryId) {
  // Create a new client so the request is not cancelled
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/${queryId}/visit/`, {
    method: 'POST'
  });
  return promise;
}
function deleteSavedQuery(api, orgId, queryId) {
  const promise = api.requestPromise(`/organizations/${orgId}/discover/saved/${queryId}/`, {
    method: 'DELETE'
  });
  promise.catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to delete the saved query'));
  });
  return promise;
}

/***/ }),

/***/ "./app/actionCreators/guides.tsx":
/*!***************************************!*\
  !*** ./app/actionCreators/guides.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "closeGuide": () => (/* binding */ closeGuide),
/* harmony export */   "dismissGuide": () => (/* binding */ dismissGuide),
/* harmony export */   "fetchGuides": () => (/* binding */ fetchGuides),
/* harmony export */   "nextStep": () => (/* binding */ nextStep),
/* harmony export */   "recordDismiss": () => (/* binding */ recordDismiss),
/* harmony export */   "recordFinish": () => (/* binding */ recordFinish),
/* harmony export */   "registerAnchor": () => (/* binding */ registerAnchor),
/* harmony export */   "setForceHide": () => (/* binding */ setForceHide),
/* harmony export */   "toStep": () => (/* binding */ toStep),
/* harmony export */   "unregisterAnchor": () => (/* binding */ unregisterAnchor)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/guideStore */ "./app/stores/guideStore.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");





const api = new sentry_api__WEBPACK_IMPORTED_MODULE_0__.Client();
async function fetchGuides() {
  try {
    const data = await api.requestPromise('/assistant/');
    sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].fetchSucceeded(data);
  } catch (err) {
    if (err.status !== 401 && err.status !== 403) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(err);
    }
  }
}
function registerAnchor(target) {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].registerAnchor(target);
}
function unregisterAnchor(target) {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].unregisterAnchor(target);
}
function nextStep() {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].nextStep();
}
function setForceHide(forceHide) {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].setForceHide(forceHide);
}
function toStep(step) {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].toStep(step);
}
function closeGuide(dismissed) {
  sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_2__["default"].closeGuide(dismissed);
}
function dismissGuide(guide, step, orgId) {
  recordDismiss(guide, step, orgId);
  closeGuide(true);
}
function recordFinish(guide, orgId) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide,
      status: 'viewed'
    }
  });
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_1__["default"].get('user');

  if (!user) {
    return;
  }

  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_3__["default"])('assistant.guide_finished', {
    organization: orgId,
    guide
  });
}
function recordDismiss(guide, step, orgId) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide,
      status: 'dismissed'
    }
  });
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_1__["default"].get('user');

  if (!user) {
    return;
  }

  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_3__["default"])('assistant.guide_dismissed', {
    organization: orgId,
    guide,
    step
  });
}

/***/ }),

/***/ "./app/actionCreators/performance.tsx":
/*!********************************************!*\
  !*** ./app/actionCreators/performance.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchTeamKeyTransactions": () => (/* binding */ fetchTeamKeyTransactions),
/* harmony export */   "toggleKeyTransaction": () => (/* binding */ toggleKeyTransaction)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");




async function fetchTeamKeyTransactions(api, orgSlug, teams, projects) {
  const url = `/organizations/${orgSlug}/key-transactions-list/`;
  const datas = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      var _payload$project;

      const payload = {
        cursor,
        team: teams,
        project: projects
      };

      if (!payload.cursor) {
        delete payload.cursor;
      }

      if (!((_payload$project = payload.project) !== null && _payload$project !== void 0 && _payload$project.length)) {
        delete payload.project;
      }

      const [data,, resp] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: payload
      });
      datas.push(data);
      const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

      if (pageLinks) {
        var _paginationObject$nex, _paginationObject$nex2, _paginationObject$nex3;

        const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_3__["default"])(pageLinks);
        hasMore = (_paginationObject$nex = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex2 = paginationObject.next) === null || _paginationObject$nex2 === void 0 ? void 0 : _paginationObject$nex2.results) !== null && _paginationObject$nex !== void 0 ? _paginationObject$nex : false;
        cursor = (_paginationObject$nex3 = paginationObject.next) === null || _paginationObject$nex3 === void 0 ? void 0 : _paginationObject$nex3.cursor;
      } else {
        hasMore = false;
      }
    } catch (err) {
      var _err$responseJSON$det, _err$responseJSON;

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((_err$responseJSON$det = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Error fetching team key transactions'));
      throw err;
    }
  }

  return datas.flat();
}
function toggleKeyTransaction(api, isKeyTransaction, orgId, projects, transactionName, teamIds) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Saving changes\u2026'));
  const promise = api.requestPromise(`/organizations/${orgId}/key-transactions/`, {
    method: isKeyTransaction ? 'DELETE' : 'POST',
    query: {
      project: projects.map(id => String(id))
    },
    data: {
      transaction: transactionName,
      team: teamIds
    }
  });
  promise.then(sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.clearIndicators);
  promise.catch(response => {
    var _responseJSON$detail;

    const responseJSON = response === null || response === void 0 ? void 0 : response.responseJSON;
    const errorDetails = (_responseJSON$detail = responseJSON === null || responseJSON === void 0 ? void 0 : responseJSON.detail) !== null && _responseJSON$detail !== void 0 ? _responseJSON$detail : responseJSON === null || responseJSON === void 0 ? void 0 : responseJSON.non_field_errors;

    if (Array.isArray(errorDetails) && errorDetails.length && errorDetails[0]) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errorDetails[0]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errorDetails !== null && errorDetails !== void 0 ? errorDetails : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Unable to update key transaction'));
    }
  });
  return promise;
}

/***/ }),

/***/ "./app/actions/pageFiltersActions.tsx":
/*!********************************************!*\
  !*** ./app/actions/pageFiltersActions.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const PageFiltersActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['reset', 'initializeUrlState', 'updateProjects', 'updateDateTime', 'updateEnvironments', 'updateDesyncedFilters', 'pin']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageFiltersActions);

/***/ }),

/***/ "./app/components/actions/menuHeader.tsx":
/*!***********************************************!*\
  !*** ./app/components/actions/menuHeader.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");




const MenuHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1v5j7f00"
} : 0)("text-transform:uppercase;font-weight:600;color:", p => p.theme.gray400, ";border-bottom:1px solid ", p => p.theme.innerBorder, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

MenuHeader.defaultProps = {
  header: true
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuHeader);

/***/ }),

/***/ "./app/components/assistant/getGuidesContent.tsx":
/*!*******************************************************!*\
  !*** ./app/components/assistant/getGuidesContent.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getGuidesContent)
/* harmony export */ });
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getGuidesContent(orgSlug) {
  if (sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('demoMode')) {
    return getDemoModeGuides();
  }

  return [{
    guide: 'issue',
    requiredTargets: ['issue_number', 'exception'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Identify Your Issues'),
      target: 'issue_number',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)(`You have Issues. That's fine. Use the Issue number in your commit message,
                and we'll automatically resolve the Issue when your code is deployed. [link:Learn more]`, {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
          href: "https://docs.sentry.io/product/releases/"
        })
      })
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Annoy the Right People'),
      target: 'owners',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)(`Notification overload makes it tempting to hurl your phone into the ocean.
                Define who is responsible for what, so alerts reach the right people and your
                devices stay on dry land. [link:Learn more]`, {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
          href: "https://docs.sentry.io/product/error-monitoring/issue-owners/"
        })
      })
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Narrow Down Suspects'),
      target: 'exception',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`We've got stack trace. See the exact sequence of function calls leading to the error
                in question, no detective skills necessary.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Retrace Your Steps'),
      target: 'breadcrumbs',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Not sure how you got here? Sentry automatically captures breadcrumbs for events in web
                frameworks to lead you straight to your error.`)
    }]
  }, {
    guide: 'issue_stream',
    requiredTargets: ['issue_stream'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issues'),
      target: 'issue_stream',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)(`Sentry automatically groups similar events together into an issue. Similarity is
            determined by stack trace and other factors. [link:Learn more].`, {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
          href: "https://docs.sentry.io/platform-redirect/?next=/data-management/event-grouping/"
        })
      })
    }]
  }, {
    guide: 'alerts_write_owner',
    requiredTargets: ['alerts_write_owner'],
    steps: [{
      target: 'alerts_write_owner',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)(`Today only admins in your organization can create alert rules but we recommend [link:allowing members to create alerts], too.`, {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: orgSlug ? `/settings/${orgSlug}` : `/settings`
        })
      }),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Allow`),
      hasNextGuide: true
    }]
  }, {
    guide: 'trace_view',
    requiredTargets: ['trace_view_guide_row', 'trace_view_guide_row_details'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Event Breakdown'),
      target: 'trace_view_guide_breakdown',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`The event breakdown shows you the breakdown of event types within a trace.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Transactions'),
      target: 'trace_view_guide_row',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`You can quickly see all the transactions in a trace alongside the project, transaction duration, and any related errors.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Transactions Details'),
      target: 'trace_view_guide_row_details',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Click on any transaction to see more details.`)
    }]
  }, {
    guide: 'span_op_breakdowns_and_tag_explorer',
    requiredTargets: ['span_op_breakdowns_filter'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter by Span Operation'),
      target: 'span_op_breakdowns_filter',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('You can now filter these transaction events based on http, db, browser or resource operation.')
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Suspect Tags'),
      target: 'tag_explorer',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)("See which tags often correspond to slower transactions. You'll want to investigate these more. [link:Learn more]", {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
          href: "https://docs.sentry.io/product/performance/transaction-summary/#suspect-tags"
        })
      })
    }]
  }, {
    guide: 'project_transaction_threshold',
    requiredTargets: ['project_transaction_threshold'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Project Thresholds'),
      target: 'project_transaction_threshold',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Gauge performance using different metrics for each project. Set response time thresholds, per project, for the Apdex and User Misery Scores in each project’s Performance settings.')
    }]
  }, {
    guide: 'project_transaction_threshold_override',
    requiredTargets: ['project_transaction_threshold_override'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Response Time Thresholds'),
      target: 'project_transaction_threshold_override',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Use this menu to adjust each transaction’s satisfactory response time threshold, which can vary across transactions. These thresholds are used to calculate Apdex and User Misery, metrics that indicate how satisfied and miserable users are, respectively.')
    }]
  }, {
    guide: 'semver',
    requiredTargets: ['releases_search'],
    dateThreshold: new Date('2021-05-01'),
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter by Semver'),
      target: 'releases_search',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('You can now filter releases by semver. For example: release.version:>14.0 [br] [link:View the docs]', {
        br: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("br", {}),
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_0__["default"], {
          href: "https://docs.sentry.io/product/releases/usage/sorting-filtering/#filtering-releases"
        })
      }),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Leave me alone')
    }]
  }, {
    guide: 'new_page_filters',
    requiredTargets: ['new_page_filter_button'],
    expectedTargets: ['new_page_filter_pin'],
    dateThreshold: new Date('2022-04-05'),
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Selection filters here now!'),
      target: 'new_page_filter_button',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("Selection filters were at the top of the page. Now they're here. Because this is what's getting filtered. Obvi."),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sounds Good')
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Pin your filters'),
      target: 'new_page_filter_pin',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("Want to keep the same filters between searches and sessions? Click this button. Don't want to? Don't click this button."),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Got It')
    }]
  }, {
    guide: 'releases_widget',
    requiredTargets: ['releases_widget'],
    dateThreshold: new Date('2022-06-22'),
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Releases are here!'),
      target: 'releases_widget',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Want to know how your latest release is doing? Monitor release health and crash rates in Dashboards.'),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sounds Good')
    }]
  }, {
    guide: 'activate_sampling_rule',
    requiredTargets: ['sampling_rule_toggle'],
    dateThreshold: new Date('2022-07-05'),
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Activate your first rule'),
      target: 'sampling_rule_toggle',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Activating a rule will take immediate effect, as well as any changes given to an active rule.'),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Activate Rule'),
      dismissText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Later'),
      hasNextGuide: true
    }]
  }, {
    guide: 'create_conditional_rule',
    requiredTargets: ['add_conditional_rule'],
    dateThreshold: new Date('2022-07-05'),
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Create a new sample rule'),
      target: 'add_conditional_rule',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sample transactions under specific conditions, keeping what you need and dropping what you don’t.'),
      dismissText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Enough already')
    }]
  }];
}

function getDemoModeGuides() {
  return [{
    guide: 'sidebar',
    requiredTargets: ['projects', 'issues'],
    priority: 1,
    // lower number means higher priority
    markOthersAsSeen: true,
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Projects'),
      target: 'projects',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Create a project for any type of application you want to monitor.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issues'),
      target: 'issues',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Here's a list of what's broken with your application. And everything you need to know to fix it.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Performance'),
      target: 'performance',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`See slow faster. Trace slow-loading pages back to their API calls as well as surface all related errors.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Releases'),
      target: 'releases',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Track the health of every release, see differences between releases from crash analytics to adoption rates.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover'),
      target: 'discover',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Query and unlock insights into the health of your entire system and get answers to critical business questions all in one place.`),
      nextText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Got it`)
    }]
  }, {
    guide: 'issue_stream_v2',
    requiredTargets: ['issue_stream_title'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issue'),
      target: 'issue_stream_title',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Click here to get a full error report down to the line of code that caused the error.`)
    }]
  }, {
    guide: 'issue_v2',
    requiredTargets: ['issue_details', 'exception'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Details'),
      target: 'issue_details',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`See the who, what, and where of every error right at the top`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Exception'),
      target: 'exception',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Source code right in the stack trace, so you don’t need to find it yourself.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Tags'),
      target: 'tags',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Tags help you quickly access related events and view the tag distribution for a set of events.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Breadcrumbs'),
      target: 'breadcrumbs',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Check out the play by play of what your user experienced till they encountered the exception.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover'),
      target: 'open_in_discover',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Uncover trends with Discover — analyze errors by URL, geography, device, browser, etc.`)
    }]
  }, {
    guide: 'releases',
    requiredTargets: ['release_version'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release'),
      target: 'release_version',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Click here to easily identify new issues, regressions, and track the health of every release.`)
    }]
  }, {
    guide: 'release_details',
    requiredTargets: ['release_chart'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Chart'),
      target: 'release_chart',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Click and drag to zoom in on a specific section of the chart.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover'),
      target: 'release_issues_open_in_discover',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Analyze these errors by URL, geography, device, browser, etc.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover'),
      target: 'release_transactions_open_in_discover',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Analyze these performance issues by URL, geography, device, browser, etc.`)
    }]
  }, {
    guide: 'discover_landing',
    requiredTargets: ['discover_landing_header'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover'),
      target: 'discover_landing_header',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Click into any of the queries below to identify trends in event data.`)
    }]
  }, {
    guide: 'discover_event_view',
    requiredTargets: ['create_alert_from_discover'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Create Alert'),
      target: 'create_alert_from_discover',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Create an alert based on this query to get notified when an event exceeds user-defined thresholds.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Columns'),
      target: 'columns_header_button',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`There's a whole lot more to... _discover_. View all the query conditions.`)
    }]
  }, {
    guide: 'transaction_details',
    requiredTargets: ['span_tree'],
    steps: [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Span Tree'),
      target: 'span_tree',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Expand the spans to see span details from start date, end date to the operation.`)
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Breadcrumbs'),
      target: 'breadcrumbs',
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(`Check out the play by play of what your user experienced till they encountered the performance issue.`)
    }]
  }];
}

/***/ }),

/***/ "./app/components/assistant/guideAnchor.tsx":
/*!**************************************************!*\
  !*** ./app/components/assistant/guideAnchor.tsx ***!
  \**************************************************/
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
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/guides */ "./app/actionCreators/guides.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/guideStore */ "./app/stores/guideStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















class BaseGuideAnchor extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      active: false,
      step: 0,
      orgId: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_guideStore__WEBPACK_IMPORTED_MODULE_8__["default"].listen(data => this.onGuideStateChange(data), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "containerElement", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFinish", e => {
      var _this$props$onStepCom, _this$props, _this$props$onFinish, _this$props2;

      e.stopPropagation();
      (_this$props$onStepCom = (_this$props = this.props).onStepComplete) === null || _this$props$onStepCom === void 0 ? void 0 : _this$props$onStepCom.call(_this$props, e);
      (_this$props$onFinish = (_this$props2 = this.props).onFinish) === null || _this$props$onFinish === void 0 ? void 0 : _this$props$onFinish.call(_this$props2, e);
      const {
        currentGuide,
        orgId
      } = this.state;

      if (currentGuide) {
        (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.recordFinish)(currentGuide.guide, orgId);
      }

      (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.closeGuide)();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleNextStep", e => {
      var _this$props$onStepCom2, _this$props3;

      e.stopPropagation();
      (_this$props$onStepCom2 = (_this$props3 = this.props).onStepComplete) === null || _this$props$onStepCom2 === void 0 ? void 0 : _this$props$onStepCom2.call(_this$props3, e);
      (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.nextStep)();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDismiss", e => {
      e.stopPropagation();
      const {
        currentGuide,
        step,
        orgId
      } = this.state;

      if (currentGuide) {
        (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.dismissGuide)(currentGuide.guide, step, orgId);
      }
    });
  }

  componentDidMount() {
    const {
      target
    } = this.props;
    (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.registerAnchor)(target);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (this.containerElement.current && !prevState.active && this.state.active) {
      try {
        const {
          top
        } = this.containerElement.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset;
        const centerElement = top + scrollTop - window.innerHeight / 2;
        window.scrollTo({
          top: centerElement
        });
      } catch (err) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(err);
      }
    }
  }

  componentWillUnmount() {
    const {
      target
    } = this.props;
    (0,sentry_actionCreators_guides__WEBPACK_IMPORTED_MODULE_4__.unregisterAnchor)(target);
    this.unsubscribe();
  }

  onGuideStateChange(data) {
    var _data$currentGuide, _data$currentGuide$st, _data$currentGuide2;

    const active = ((_data$currentGuide = data.currentGuide) === null || _data$currentGuide === void 0 ? void 0 : (_data$currentGuide$st = _data$currentGuide.steps[data.currentStep]) === null || _data$currentGuide$st === void 0 ? void 0 : _data$currentGuide$st.target) === this.props.target && !data.forceHide;
    this.setState({
      active,
      currentGuide: (_data$currentGuide2 = data.currentGuide) !== null && _data$currentGuide2 !== void 0 ? _data$currentGuide2 : undefined,
      step: data.currentStep,
      orgId: data.orgId
    });
  }
  /**
   * Terminology:
   *
   *  - A guide can be FINISHED by clicking one of the buttons in the last step
   *  - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x)
   *  - In both cases we consider it CLOSED
   */


  getHovercardBody() {
    const {
      to
    } = this.props;
    const {
      currentGuide,
      step
    } = this.state;

    if (!currentGuide) {
      return null;
    }

    const totalStepCount = currentGuide.steps.length;
    const currentStepCount = step + 1;
    const currentStep = currentGuide.steps[step];
    const lastStep = currentStepCount === totalStepCount;
    const hasManySteps = totalStepCount > 1; // to clear `#assistant` from the url

    const href = window.location.hash === '#assistant' ? '#' : '';

    const dismissButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DismissButton, {
      size: "sm",
      translucentBorder: true,
      href: href,
      onClick: this.handleDismiss,
      priority: "link",
      children: currentStep.dismissText || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Dismiss')
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(GuideContainer, {
      "data-test-id": "guide-container",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(GuideContent, {
        children: [currentStep.title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(GuideTitle, {
          children: currentStep.title
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(GuideDescription, {
          children: currentStep.description
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(GuideAction, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
          children: lastStep ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledButton, {
              size: "sm",
              translucentBorder: true,
              to: to,
              onClick: this.handleFinish,
              children: currentStep.nextText || (hasManySteps ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enough Already') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Got It'))
            }), currentStep.hasNextGuide && dismissButton]
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledButton, {
              size: "sm",
              translucentBorder: true,
              onClick: this.handleNextStep,
              to: to,
              children: currentStep.nextText || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Next')
            }), !currentStep.cantDismiss && dismissButton]
          })
        }), hasManySteps && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StepCount, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[currentStepCount] of [totalStepCount]', {
            currentStepCount,
            totalStepCount
          })
        })]
      })]
    });
  }

  render() {
    const {
      children,
      position,
      offset,
      containerClassName
    } = this.props;
    const {
      active
    } = this.state;

    if (!active) {
      return children ? children : null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledHovercard, {
      forceVisible: true,
      body: this.getHovercardBody(),
      tipColor: "purple300",
      position: position,
      offset: offset,
      containerClassName: containerClassName,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("span", {
        ref: this.containerElement,
        children: children
      })
    });
  }

}

BaseGuideAnchor.displayName = "BaseGuideAnchor";

/**
 * A GuideAnchor puts an informative hovercard around an element. Guide anchors
 * register with the GuideStore, which uses registrations from one or more
 * anchors on the page to determine which guides can be shown on the page.
 */
function GuideAnchor(_ref) {
  let {
    disabled,
    children,
    ...rest
  } = _ref;

  if (disabled) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: children
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(BaseGuideAnchor, { ...rest,
    children: children
  });
}

GuideAnchor.displayName = "GuideAnchor";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GuideAnchor);

const GuideContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn818"
} : 0)("display:grid;grid-template-rows:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";text-align:center;line-height:1.5;background-color:", p => p.theme.purple300, ";border-color:", p => p.theme.purple300, ";color:", p => p.theme.white, ";" + ( true ? "" : 0));

const GuideContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn817"
} : 0)("display:grid;grid-template-rows:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";a{color:", p => p.theme.white, ";text-decoration:underline;}" + ( true ? "" : 0));

const GuideTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn816"
} : 0)("font-weight:bold;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const GuideDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn815"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const GuideAction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn814"
} : 0)("display:grid;grid-template-rows:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "emyn813"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";min-width:40%;" + ( true ? "" : 0));

const DismissButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(StyledButton,  true ? {
  target: "emyn812"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";&:hover,&:focus,&:active{color:", p => p.theme.white, ";}color:", p => p.theme.white, ";" + ( true ? "" : 0));

const StepCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emyn811"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-weight:bold;text-transform:uppercase;" + ( true ? "" : 0));

const StyledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_6__.Hovercard,  true ? {
  target: "emyn810"
} : 0)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_6__.Body, "{background-color:", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__["default"].purple300, ";margin:-1px;border-radius:", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__["default"].borderRadius, ";width:300px;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/autoSelectText.tsx":
/*!*******************************************!*\
  !*** ./app/components/autoSelectText.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/selectText */ "./app/utils/selectText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const AutoSelectText = (_ref, forwardedRef) => {
  let {
    children,
    className,
    ...props
  } = _ref;
  const element = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null); // We need to expose a selectText method to parent components
  // and need an imperative ref handle.

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useImperativeHandle)(forwardedRef, () => ({
    selectText: () => handleClick()
  }));

  function handleClick() {
    if (!element.current) {
      return;
    }

    (0,sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_2__.selectText)(element.current);
  } // use an inner span here for the selection as otherwise the selectText
  // function will create a range that includes the entire part of the
  // div (including the div itself) which causes newlines to be selected
  // in chrome.


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", { ...props,
    onClick: handleClick,
    className: classnames__WEBPACK_IMPORTED_MODULE_1___default()('auto-select-text', className),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
      ref: element,
      children: children
    })
  });
};

AutoSelectText.displayName = "AutoSelectText";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.forwardRef)(AutoSelectText));

/***/ }),

/***/ "./app/components/charts/utils.tsx":
/*!*****************************************!*\
  !*** ./app/components/charts/utils.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ONE_HOUR": () => (/* binding */ ONE_HOUR),
/* harmony export */   "ONE_WEEK": () => (/* binding */ ONE_WEEK),
/* harmony export */   "RELEASE_LINES_THRESHOLD": () => (/* binding */ RELEASE_LINES_THRESHOLD),
/* harmony export */   "SIXTY_DAYS": () => (/* binding */ SIXTY_DAYS),
/* harmony export */   "SIX_HOURS": () => (/* binding */ SIX_HOURS),
/* harmony export */   "THIRTY_DAYS": () => (/* binding */ THIRTY_DAYS),
/* harmony export */   "TWENTY_FOUR_HOURS": () => (/* binding */ TWENTY_FOUR_HOURS),
/* harmony export */   "TWO_WEEKS": () => (/* binding */ TWO_WEEKS),
/* harmony export */   "canIncludePreviousPeriod": () => (/* binding */ canIncludePreviousPeriod),
/* harmony export */   "getDiffInMinutes": () => (/* binding */ getDiffInMinutes),
/* harmony export */   "getDimensionValue": () => (/* binding */ getDimensionValue),
/* harmony export */   "getInterval": () => (/* binding */ getInterval),
/* harmony export */   "getPreviousSeriesName": () => (/* binding */ getPreviousSeriesName),
/* harmony export */   "getSeriesApiInterval": () => (/* binding */ getSeriesApiInterval),
/* harmony export */   "getSeriesSelection": () => (/* binding */ getSeriesSelection),
/* harmony export */   "isMultiSeriesStats": () => (/* binding */ isMultiSeriesStats),
/* harmony export */   "lightenHexToRgb": () => (/* binding */ lightenHexToRgb),
/* harmony export */   "processTableResults": () => (/* binding */ processTableResults),
/* harmony export */   "shouldFetchPreviousPeriod": () => (/* binding */ shouldFetchPreviousPeriod),
/* harmony export */   "truncationFormatter": () => (/* binding */ truncationFormatter),
/* harmony export */   "useShortInterval": () => (/* binding */ useShortInterval)
/* harmony export */ });
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");





const DEFAULT_TRUNCATE_LENGTH = 80; // In minutes

const SIXTY_DAYS = 86400;
const THIRTY_DAYS = 43200;
const TWO_WEEKS = 20160;
const ONE_WEEK = 10080;
const TWENTY_FOUR_HOURS = 1440;
const SIX_HOURS = 360;
const ONE_HOUR = 60;
/**
 * If there are more releases than this number we hide "Releases" series by default
 */

const RELEASE_LINES_THRESHOLD = 50;
function truncationFormatter(value, truncate) {
  if (!truncate) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.escape)(value);
  }

  const truncationLength = truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  const truncated = value.length > truncationLength ? value.substring(0, truncationLength) + '…' : value;
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.escape)(truncated);
}
/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */

function useShortInterval(datetimeObj) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);
  return diffInMinutes <= TWENTY_FOUR_HOURS;
}
function getInterval(datetimeObj) {
  let fidelity = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'medium';
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    if (fidelity === 'high') {
      return '4h';
    }

    if (fidelity === 'medium') {
      return '1d';
    }

    return '2d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    if (fidelity === 'high') {
      return '1h';
    }

    if (fidelity === 'medium') {
      return '4h';
    }

    return '1d';
  }

  if (diffInMinutes >= TWO_WEEKS) {
    if (fidelity === 'high') {
      return '30m';
    }

    if (fidelity === 'medium') {
      return '1h';
    }

    return '12h';
  }

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    // Greater than 24 hours
    if (fidelity === 'high') {
      return '30m';
    }

    if (fidelity === 'medium') {
      return '1h';
    }

    return '6h';
  }

  if (diffInMinutes > ONE_HOUR) {
    // Between 1 hour and 24 hours
    if (fidelity === 'high') {
      return '5m';
    }

    if (fidelity === 'medium') {
      return '15m';
    }

    return '1h';
  } // Less than or equal to 1 hour


  if (fidelity === 'high') {
    return '1m';
  }

  if (fidelity === 'medium') {
    return '5m';
  }

  return '10m';
}
/**
 * Duplicate of getInterval, except that we do not support <1h granularity
 * Used by OrgStatsV2 API
 */

function getSeriesApiInterval(datetimeObj) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    return '1d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    return '4h';
  }

  return '1h';
}
function getDiffInMinutes(datetimeObj) {
  const {
    period,
    start,
    end
  } = datetimeObj;

  if (start && end) {
    return moment__WEBPACK_IMPORTED_MODULE_0___default()(end).diff(start, 'minutes');
  }

  return (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.parsePeriodToHours)(typeof period === 'string' ? period : sentry_constants__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_STATS_PERIOD) * 60;
} // Max period (in hours) before we can no long include previous period

const MAX_PERIOD_HOURS_INCLUDE_PREVIOUS = 45 * 24;
function canIncludePreviousPeriod(includePrevious, period) {
  if (!includePrevious) {
    return false;
  }

  if (period && (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.parsePeriodToHours)(period) > MAX_PERIOD_HOURS_INCLUDE_PREVIOUS) {
    return false;
  } // otherwise true


  return !!includePrevious;
}
function shouldFetchPreviousPeriod(_ref) {
  let {
    includePrevious = true,
    period,
    start,
    end
  } = _ref;
  return !start && !end && canIncludePreviousPeriod(includePrevious, period);
}
/**
 * Generates a series selection based on the query parameters defined by the location.
 */

function getSeriesSelection(location) {
  const unselectedSeries = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeList)(location === null || location === void 0 ? void 0 : location.query.unselectedSeries);
  return unselectedSeries.reduce((selection, series) => {
    selection[series] = false;
    return selection;
  }, {});
}

function isSingleSeriesStats(data) {
  return ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data.data) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data.totals)) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data.start) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data.end);
}

function isMultiSeriesStats(data, isTopN) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data) && (data.data === undefined && data.totals === undefined || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(isTopN) && isTopN && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(data) && !!!isSingleSeriesStats(data)) // the isSingleSeriesStats check is for topN queries returning null data
  ;
} // If dimension is a number convert it to pixels, otherwise use dimension
// without transform

const getDimensionValue = dimension => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  if (dimension === null) {
    return undefined;
  }

  return dimension;
};
const RGB_LIGHTEN_VALUE = 30;
const lightenHexToRgb = colors => colors.map(hex => {
  const rgb = [Math.min(parseInt(hex.slice(1, 3), 16) + RGB_LIGHTEN_VALUE, 255), Math.min(parseInt(hex.slice(3, 5), 16) + RGB_LIGHTEN_VALUE, 255), Math.min(parseInt(hex.slice(5, 7), 16) + RGB_LIGHTEN_VALUE, 255)];
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
});
const DEFAULT_GEO_DATA = {
  title: '',
  data: []
};
const processTableResults = tableResults => {
  var _tableResult$title;

  if (!tableResults || !tableResults.length) {
    return DEFAULT_GEO_DATA;
  }

  const tableResult = tableResults[0];
  const {
    data
  } = tableResult;

  if (!data || !data.length) {
    return DEFAULT_GEO_DATA;
  }

  const preAggregate = Object.keys(data[0]).find(column => {
    return column !== 'geo.country_code';
  });

  if (!preAggregate) {
    return DEFAULT_GEO_DATA;
  }

  return {
    title: (_tableResult$title = tableResult.title) !== null && _tableResult$title !== void 0 ? _tableResult$title : '',
    data: data.map(row => {
      return {
        name: row['geo.country_code'],
        value: row[preAggregate]
      };
    })
  };
};
const getPreviousSeriesName = seriesName => {
  return `previous ${seriesName}`;
};

/***/ }),

/***/ "./app/components/checkboxFancy/checkboxFancy.tsx":
/*!********************************************************!*\
  !*** ./app/components/checkboxFancy/checkboxFancy.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const disabledStyles = p => p.isDisabled && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_2__.css)("background:", p.isChecked || p.isIndeterminate ? p.theme.gray200 : p.theme.backgroundSecondary, ";border-color:", p.theme.border, ";" + ( true ? "" : 0),  true ? "" : 0);

const hoverStyles = p => !p.isDisabled && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_2__.css)("border:2px solid ", p.isChecked || p.isIndeterminate ? p.theme.active : p.theme.textColor, ";" + ( true ? "" : 0),  true ? "" : 0);

const CheckboxFancy = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    isDisabled,
    isChecked,
    isIndeterminate,
    size: _size,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    "data-test-id": "checkbox-fancy",
    role: "checkbox",
    "aria-disabled": isDisabled,
    "aria-checked": isIndeterminate ? 'mixed' : isChecked,
    ...props,
    children: [isIndeterminate && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconSubtract, {
      size: "70%",
      color: "white"
    }), !isIndeterminate && isChecked && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconCheckmark, {
      size: "70%",
      color: "white"
    })]
  });
},  true ? {
  target: "e89w7c00"
} : 0)("display:flex;align-items:center;justify-content:center;box-shadow:1px 1px 5px 0px rgba(0, 0, 0, 0.05) inset;width:", p => p.size, ";height:", p => p.size, ";border-radius:5px;background:", p => p.isChecked || p.isIndeterminate ? p.theme.active : 'transparent', ";border:2px solid ", p => p.isChecked || p.isIndeterminate ? p.theme.active : p.theme.gray200, ";cursor:", p => p.isDisabled ? 'not-allowed' : 'pointer', ";", p => (!p.isChecked || !p.isIndeterminate) && 'transition: 500ms border ease-out', ";&:hover{", hoverStyles, ";}", disabledStyles, ";" + ( true ? "" : 0));

CheckboxFancy.defaultProps = {
  size: '16px',
  isChecked: false,
  isIndeterminate: false
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CheckboxFancy);

/***/ }),

/***/ "./app/components/count.tsx":
/*!**********************************!*\
  !*** ./app/components/count.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function Count(_ref) {
  let {
    value,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("span", {
    className: className,
    title: value === null || value === void 0 ? void 0 : value.toLocaleString(),
    children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__.formatAbbreviatedNumber)(value)
  });
}

Count.displayName = "Count";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Count);

/***/ }),

/***/ "./app/components/dateTime.tsx":
/*!*************************************!*\
  !*** ./app/components/dateTime.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getDateFormat(_ref) {
  let {
    year
  } = _ref;
  // "Jan 1, 2022" or "Jan 1"
  return year ? 'MMM D, YYYY' : 'MMM D';
}

function getTimeFormat(_ref2) {
  let {
    clock24Hours,
    seconds,
    timeZone
  } = _ref2;
  const substrings = [clock24Hours ? 'HH' : 'h', // hour – "23" (24h format) or "11" (12h format)
  ':mm', // minute
  seconds ? ':ss' : '', // second
  clock24Hours ? '' : ' A', // AM/PM
  timeZone ? ' z' : '' // time zone
  ];
  return substrings.join('');
}

function getFormat(_ref3) {
  let {
    dateOnly,
    timeOnly,
    year,
    seconds,
    timeZone,
    clock24Hours
  } = _ref3;

  if (dateOnly) {
    return getDateFormat({
      year
    });
  }

  if (timeOnly) {
    return getTimeFormat({
      clock24Hours,
      seconds,
      timeZone
    });
  }

  const dateFormat = getDateFormat({
    year
  });
  const timeFormat = getTimeFormat({
    clock24Hours,
    seconds,
    timeZone
  }); // If the year is shown, then there's already a comma in dateFormat ("Jan 1, 2020"),
  // so we don't need to add another comma between the date and time

  return year ? `${dateFormat} ${timeFormat}` : `${dateFormat}, ${timeFormat}`;
}

function DateTime(_ref4) {
  var _options$timezone;

  let {
    format,
    date,
    utc,
    dateOnly,
    timeOnly,
    year,
    timeZone,
    seconds = false,
    ...props
  } = _ref4;
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('user');
  const options = user === null || user === void 0 ? void 0 : user.options;
  const formatString = format !== null && format !== void 0 ? format : getFormat({
    dateOnly,
    timeOnly,
    // If the year prop is defined, then use it. Otherwise only show the year if `date`
    // is in the current year.
    year: year !== null && year !== void 0 ? year : moment__WEBPACK_IMPORTED_MODULE_0___default()().year() !== moment__WEBPACK_IMPORTED_MODULE_0___default()(date).year(),
    // If timeZone is defined, use it. Otherwise only show the time zone if we're using
    // UTC time.
    timeZone: timeZone !== null && timeZone !== void 0 ? timeZone : utc,
    seconds,
    ...options
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("time", { ...props,
    children: utc ? moment__WEBPACK_IMPORTED_MODULE_0___default().utc(date).format(formatString) : moment_timezone__WEBPACK_IMPORTED_MODULE_1___default().tz(date, (_options$timezone = options === null || options === void 0 ? void 0 : options.timezone) !== null && _options$timezone !== void 0 ? _options$timezone : '').format(formatString)
  });
}

DateTime.displayName = "DateTime";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DateTime);

/***/ }),

/***/ "./app/components/duration.tsx":
/*!*************************************!*\
  !*** ./app/components/duration.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const Duration = _ref => {
  let {
    seconds,
    fixedDigits,
    abbreviation,
    exact,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("span", { ...props,
    children: exact ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__.getExactDuration)(seconds, abbreviation) : (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_0__.getDuration)(seconds, fixedDigits, abbreviation)
  });
};

Duration.displayName = "Duration";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Duration);

/***/ }),

/***/ "./app/components/fileSize.tsx":
/*!*************************************!*\
  !*** ./app/components/fileSize.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function FileSize(props) {
  const {
    className,
    bytes,
    base
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Span, {
    className: className,
    children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_2__["default"])({
      value: base === 10 ? (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.formatBytesBase10)(bytes) : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.formatBytesBase2)(bytes),
      fixed: 'xx KB'
    })
  });
}

FileSize.displayName = "FileSize";

const Span = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1xn0mc30"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FileSize);

/***/ }),

/***/ "./app/components/gridEditable/index.tsx":
/*!***********************************************!*\
  !*** ./app/components/gridEditable/index.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COL_WIDTH_MINIMUM": () => (/* binding */ COL_WIDTH_MINIMUM),
/* harmony export */   "COL_WIDTH_UNDEFINED": () => (/* binding */ COL_WIDTH_UNDEFINED),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/performanceForSentry */ "./app/utils/performanceForSentry.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./styles */ "./app/components/gridEditable/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








 // Auto layout width.



const COL_WIDTH_UNDEFINED = -1; // Set to 90 as the edit/trash icons need this much space.

const COL_WIDTH_MINIMUM = 90; // For GridEditable, there are 2 generic types for the component, T and K
//
// - T is an element/object that represents the data to be displayed
// - K is a key of T/
//   - columnKey should have the same set of values as K

class GridEditable extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      numColumn: 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "refGrid", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "resizeMetadata", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "resizeWindowLifecycleEvents", {
      mousemove: [],
      mouseup: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onResetColumnSize", (e, i) => {
      e.stopPropagation();
      const nextColumnOrder = [...this.props.columnOrder];
      nextColumnOrder[i] = { ...nextColumnOrder[i],
        width: COL_WIDTH_UNDEFINED
      };
      this.setGridTemplateColumns(nextColumnOrder);
      const onResizeColumn = this.props.grid.onResizeColumn;

      if (onResizeColumn) {
        onResizeColumn(i, { ...nextColumnOrder[i],
          width: COL_WIDTH_UNDEFINED
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onResizeMouseDown", function (e) {
      let i = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
      e.stopPropagation(); // Block right-click and other funky stuff

      if (i === -1 || e.type === 'contextmenu') {
        return;
      } // <GridResizer> is nested 1 level down from <GridHeadCell>


      const cell = e.currentTarget.parentElement;

      if (!cell) {
        return;
      } // HACK: Do not put into state to prevent re-rendering of component


      _this.resizeMetadata = {
        columnIndex: i,
        columnWidth: cell.offsetWidth,
        cursorX: e.clientX
      };
      window.addEventListener('mousemove', _this.onResizeMouseMove);

      _this.resizeWindowLifecycleEvents.mousemove.push(_this.onResizeMouseMove);

      window.addEventListener('mouseup', _this.onResizeMouseUp);

      _this.resizeWindowLifecycleEvents.mouseup.push(_this.onResizeMouseUp);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onResizeMouseUp", e => {
      const metadata = this.resizeMetadata;
      const onResizeColumn = this.props.grid.onResizeColumn;

      if (metadata && onResizeColumn) {
        const {
          columnOrder
        } = this.props;
        const widthChange = e.clientX - metadata.cursorX;
        onResizeColumn(metadata.columnIndex, { ...columnOrder[metadata.columnIndex],
          width: metadata.columnWidth + widthChange
        });
      }

      this.resizeMetadata = undefined;
      this.clearWindowLifecycleEvents();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onResizeMouseMove", e => {
      const {
        resizeMetadata
      } = this;

      if (!resizeMetadata) {
        return;
      }

      window.requestAnimationFrame(() => this.resizeGridColumn(e, resizeMetadata));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "redrawGridColumn", () => {
      this.setGridTemplateColumns(this.props.columnOrder);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderGridBodyRow", (dataRow, row) => {
      const {
        columnOrder,
        grid
      } = this.props;
      const prependColumns = grid.renderPrependColumns ? grid.renderPrependColumns(false, dataRow, row) : [];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridRow, {
        children: [prependColumns && prependColumns.map((item, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBodyCell, {
          "data-test-id": "grid-body-cell",
          children: item
        }, `prepend-${i}`)), columnOrder.map((col, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBodyCell, {
          "data-test-id": "grid-body-cell",
          children: grid.renderBodyCell ? grid.renderBodyCell(col, dataRow, row, i) : dataRow[col.key]
        }, `${col.key}${i}`))]
      }, row);
    });
  }

  // Static methods do not allow the use of generics bounded to the parent class
  // For more info: https://github.com/microsoft/TypeScript/issues/14600
  static getDerivedStateFromProps(props, prevState) {
    return { ...prevState,
      numColumn: props.columnOrder.length
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.redrawGridColumn);
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentDidUpdate() {
    // Redraw columns whenever new props are received
    this.setGridTemplateColumns(this.props.columnOrder);
  }

  componentWillUnmount() {
    this.clearWindowLifecycleEvents();
    window.removeEventListener('resize', this.redrawGridColumn);
  }

  clearWindowLifecycleEvents() {
    Object.keys(this.resizeWindowLifecycleEvents).forEach(e => {
      this.resizeWindowLifecycleEvents[e].forEach(c => window.removeEventListener(e, c));
      this.resizeWindowLifecycleEvents[e] = [];
    });
  }

  resizeGridColumn(e, metadata) {
    const grid = this.refGrid.current;

    if (!grid) {
      return;
    }

    const widthChange = e.clientX - metadata.cursorX;
    const nextColumnOrder = [...this.props.columnOrder];
    nextColumnOrder[metadata.columnIndex] = { ...nextColumnOrder[metadata.columnIndex],
      width: Math.max(metadata.columnWidth + widthChange, 0)
    };
    this.setGridTemplateColumns(nextColumnOrder);
  }
  /**
   * Recalculate the dimensions of Grid and Columns and redraws them
   */


  /**
   * Set the CSS for Grid Column
   */
  setGridTemplateColumns(columnOrder) {
    const grid = this.refGrid.current;

    if (!grid) {
      return;
    }

    const prependColumns = this.props.grid.prependColumnWidths || [];
    const prepend = prependColumns.join(' ');
    const widths = columnOrder.map((item, index) => {
      if (item.width === COL_WIDTH_UNDEFINED) {
        return `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
      }

      if (typeof item.width === 'number' && item.width > COL_WIDTH_MINIMUM) {
        if (index === columnOrder.length - 1) {
          return `minmax(${item.width}px, auto)`;
        }

        return `${item.width}px`;
      }

      if (index === columnOrder.length - 1) {
        return `minmax(${COL_WIDTH_MINIMUM}px, auto)`;
      }

      return `${COL_WIDTH_MINIMUM}px`;
    }); // The last column has no resizer and should always be a flexible column
    // to prevent underflows.

    grid.style.gridTemplateColumns = `${prepend} ${widths.join(' ')}`;
  }

  renderGridHead() {
    const {
      error,
      isLoading,
      columnOrder,
      grid,
      data
    } = this.props; // Ensure that the last column cannot be removed

    const numColumn = columnOrder.length;
    const prependColumns = grid.renderPrependColumns ? grid.renderPrependColumns(true) : [];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridRow, {
      "data-test-id": "grid-head-row",
      children: [prependColumns && prependColumns.map((item, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridHeadCellStatic, {
        children: item
      }, `prepend-${i}`)),
      /* Note that this.onResizeMouseDown assumes GridResizer is nested
        1 levels under GridHeadCell */
      columnOrder.map((column, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridHeadCell, {
        "data-test-id": "grid-head-cell",
        isFirst: i === 0,
        children: [grid.renderHeadCell ? grid.renderHeadCell(column, i) : column.name, i !== numColumn - 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridResizer, {
          dataRows: !error && !isLoading && data ? data.length : 0,
          onMouseDown: e => this.onResizeMouseDown(e, i),
          onDoubleClick: e => this.onResetColumnSize(e, i),
          onContextMenu: this.onResizeMouseDown
        })]
      }, `${i}.${column.key}`))]
    });
  }

  renderGridBody() {
    const {
      data,
      error,
      isLoading
    } = this.props;

    if (error) {
      return this.renderError();
    }

    if (isLoading) {
      return this.renderLoading();
    }

    if (!data || data.length === 0) {
      return this.renderEmptyData();
    }

    return data.map(this.renderGridBodyRow);
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBodyCellStatus, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconWarning, {
          color: "gray300",
          size: "lg"
        })
      })
    });
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBodyCellStatus, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {})
      })
    });
  }

  renderEmptyData() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBodyCellStatus, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_3__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('No results found for your query')
          })
        })
      })
    });
  }

  render() {
    const {
      title,
      headerButtons
    } = this.props;
    const showHeader = title || headerButtons;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Profiler, {
        id: "GridEditable",
        onRender: sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_7__.onRenderCallback,
        children: [showHeader && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_8__.Header, {
          children: [title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.HeaderTitle, {
            children: title
          }), headerButtons && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.HeaderButtonContainer, {
            children: headerButtons()
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_8__.Grid, {
            "data-test-id": "grid-editable",
            ref: this.refGrid,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridHead, {
              children: this.renderGridHead()
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_8__.GridBody, {
              children: this.renderGridBody()
            })]
          })
        })]
      })
    });
  }

}

GridEditable.displayName = "GridEditable";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GridEditable);

/***/ }),

/***/ "./app/components/gridEditable/styles.tsx":
/*!************************************************!*\
  !*** ./app/components/gridEditable/styles.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Body": () => (/* binding */ Body),
/* harmony export */   "GRID_BODY_ROW_HEIGHT": () => (/* binding */ GRID_BODY_ROW_HEIGHT),
/* harmony export */   "GRID_HEAD_ROW_HEIGHT": () => (/* binding */ GRID_HEAD_ROW_HEIGHT),
/* harmony export */   "GRID_STATUS_MESSAGE_HEIGHT": () => (/* binding */ GRID_STATUS_MESSAGE_HEIGHT),
/* harmony export */   "Grid": () => (/* binding */ Grid),
/* harmony export */   "GridBody": () => (/* binding */ GridBody),
/* harmony export */   "GridBodyCell": () => (/* binding */ GridBodyCell),
/* harmony export */   "GridBodyCellStatus": () => (/* binding */ GridBodyCellStatus),
/* harmony export */   "GridHead": () => (/* binding */ GridHead),
/* harmony export */   "GridHeadCell": () => (/* binding */ GridHeadCell),
/* harmony export */   "GridHeadCellStatic": () => (/* binding */ GridHeadCellStatic),
/* harmony export */   "GridResizer": () => (/* binding */ GridResizer),
/* harmony export */   "GridRow": () => (/* binding */ GridRow),
/* harmony export */   "Header": () => (/* binding */ Header),
/* harmony export */   "HeaderButtonContainer": () => (/* binding */ HeaderButtonContainer),
/* harmony export */   "HeaderTitle": () => (/* binding */ HeaderTitle)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const GRID_HEAD_ROW_HEIGHT = 45;
const GRID_BODY_ROW_HEIGHT = 40;
const GRID_STATUS_MESSAGE_HEIGHT = GRID_BODY_ROW_HEIGHT * 4;
/**
 * Local z-index stacking context
 * https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
 */
// Parent context is Panel

const Z_INDEX_PANEL = 1;
const Z_INDEX_GRID_STATUS = -1;
const Z_INDEX_GRID = 5; // Parent context is GridHeadCell

const Z_INDEX_GRID_RESIZER = 1;
const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e17psx6813"
} : 0)("display:flex;justify-content:space-between;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));
const HeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h4',  true ? {
  target: "e17psx6812"
} : 0)("margin:0;font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));
const HeaderButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e17psx6811"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";grid-auto-flow:column;grid-auto-columns:auto;justify-items:end;&>span{display:flex;flex-direction:row;}" + ( true ? "" : 0));
const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    children,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
      children: children
    })
  });
},  true ? {
  target: "e17psx6810"
} : 0)("overflow:hidden;z-index:", Z_INDEX_PANEL, ";" + ( true ? "" : 0));
/**
 * Grid is the parent element for the tableResizable component.
 *
 * On newer browsers, it will use CSS Grids to implement its layout.
 *
 * However, it is based on <table>, which has a distinction between header/body
 * HTML elements, which allows CSS selectors to its full potential. This has
 * the added advantage that older browsers will still have a chance of
 * displaying the data correctly (but this is untested).
 *
 * <thead>, <tbody>, <tr> are ignored by CSS Grid.
 * The entire layout is determined by the usage of <th> and <td>.
 */

const Grid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('table',  true ? {
  target: "e17psx689"
} : 0)("position:inherit;display:grid;grid-template-columns:repeat(auto-fill, minmax(50px, auto));box-sizing:border-box;border-collapse:collapse;margin:0;z-index:", Z_INDEX_GRID, ";overflow-x:auto;overflow-y:hidden;" + ( true ? "" : 0));
const GridRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('tr',  true ? {
  target: "e17psx688"
} : 0)("display:contents;&:last-child,&:last-child>td:first-child,&:last-child>td:last-child{border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";}" + ( true ? "" : 0));
/**
 * GridHead is the collection of elements that builds the header section of the
 * Grid. As the entirety of the add/remove/resize actions are performed on the
 * header, most of the elements behave different for each stage.
 */

const GridHead = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('thead',  true ? {
  target: "e17psx687"
} : 0)( true ? {
  name: "49aokf",
  styles: "display:contents"
} : 0);
const GridHeadCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('th',  true ? {
  target: "e17psx686"
} : 0)("position:relative;height:", GRID_HEAD_ROW_HEIGHT, "px;display:flex;align-items:center;min-width:24px;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";border-right:1px solid transparent;border-left:1px solid transparent;background-color:", p => p.theme.backgroundSecondary, ";color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeSmall, ";font-weight:600;text-transform:uppercase;user-select:none;a,div,span{line-height:1.1;color:inherit;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;}&:first-child{border-top-left-radius:", p => p.theme.borderRadius, ";}&:last-child{border-top-right-radius:", p => p.theme.borderRadius, ";border-right:none;}&:hover{border-left-color:", p => p.isFirst ? 'transparent' : p.theme.border, ";border-right-color:", p => p.theme.border, ";}" + ( true ? "" : 0));
/**
 * Create spacing/padding similar to GridHeadCellWrapper but
 * without interactive aspects.
 */

const GridHeadCellStatic = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('th',  true ? {
  target: "e17psx685"
} : 0)("height:", GRID_HEAD_ROW_HEIGHT, "px;display:flex;align-items:center;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";background-color:", p => p.theme.backgroundSecondary, ";font-size:", p => p.theme.fontSizeSmall, ";font-weight:600;line-height:1;text-transform:uppercase;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;&:first-child{border-top-left-radius:", p => p.theme.borderRadius, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";}" + ( true ? "" : 0));
/**
 * GridBody are the collection of elements that contains and display the data
 * of the Grid. They are rather simple.
 */

const GridBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('tbody',  true ? {
  target: "e17psx684"
} : 0)("display:contents;>tr:first-child td{border-top:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));
const GridBodyCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('td',  true ? {
  target: "e17psx683"
} : 0)("min-width:0;min-height:", GRID_BODY_ROW_HEIGHT, "px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";background-color:", p => p.theme.background, ";border-top:1px solid ", p => p.theme.innerBorder, ";display:flex;flex-direction:column;justify-content:center;font-size:", p => p.theme.fontSizeMedium, ";&:first-child{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";}&:last-child{border-right:none;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";}" + ( true ? "" : 0));

const GridStatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(GridBodyCell,  true ? {
  target: "e17psx682"
} : 0)("grid-column:1/-1;width:100%;height:", GRID_STATUS_MESSAGE_HEIGHT, "px;background-color:transparent;" + ( true ? "" : 0));

const GridStatusFloat = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e17psx681"
} : 0)("position:absolute;top:45px;left:0;display:flex;justify-content:center;align-items:center;width:100%;height:", GRID_STATUS_MESSAGE_HEIGHT, "px;z-index:", Z_INDEX_GRID_STATUS, ";background:", p => p.theme.background, ";" + ( true ? "" : 0));

const GridBodyCellStatus = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(GridStatusWrapper, {
  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(GridStatusFloat, {
    children: props.children
  })
});
GridBodyCellStatus.displayName = "GridBodyCellStatus";

/**
 * We have a fat GridResizer and we use the ::after pseudo-element to draw
 * a thin 1px border.
 *
 * The right most cell does not have a resizer as resizing from that side does strange things.
 */
const GridResizer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e17psx680"
} : 0)("position:absolute;top:0px;right:-6px;width:11px;height:", p => {
  const numOfRows = p.dataRows;
  let height = GRID_HEAD_ROW_HEIGHT + numOfRows * GRID_BODY_ROW_HEIGHT;

  if (numOfRows >= 1) {
    // account for border-bottom height
    height += numOfRows;
  }

  return height;
}, "px;padding-left:5px;padding-right:5px;cursor:col-resize;z-index:", Z_INDEX_GRID_RESIZER, ";&::after{content:' ';display:block;width:100%;height:100%;}&:hover::after{background-color:", p => p.theme.gray200, ";}&:active::after,&:focus::after{background-color:", p => p.theme.purple300, ";}&:hover::before{position:absolute;top:0;left:2px;content:' ';display:block;width:7px;height:", GRID_HEAD_ROW_HEIGHT, "px;background-color:", p => p.theme.purple300, ";opacity:0.4;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/menuItem.tsx":
/*!*************************************!*\
  !*** ./app/components/menuItem.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const MenuItem = _ref => {
  let {
    header,
    icon,
    divider,
    isActive,
    noAnchor,
    className,
    children,
    ...props
  } = _ref;
  const {
    to,
    href,
    title,
    withBorder,
    disabled,
    onSelect,
    eventKey,
    allowDefaultEvent,
    stopPropagation
  } = props;

  const handleClick = e => {
    if (disabled) {
      return;
    }

    if (onSelect) {
      if (allowDefaultEvent !== true) {
        e.preventDefault();
      }

      if (stopPropagation) {
        e.stopPropagation();
      }

      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_5__.callIfFunction)(onSelect, eventKey);
    }
  };

  const renderAnchor = () => {
    const linkProps = {
      onClick: handleClick,
      tabIndex: -1,
      isActive,
      disabled,
      withBorder
    };

    if (to) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(MenuLink, {
        to: to,
        ...linkProps,
        title: title,
        "data-test-id": "menu-item",
        children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(MenuIcon, {
          children: icon
        }), children]
      });
    }

    if (href) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(MenuAnchor, { ...linkProps,
        href: href,
        "data-test-id": "menu-item",
        children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(MenuIcon, {
          children: icon
        }), children]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(MenuTarget, {
      role: "button",
      ...linkProps,
      title: title,
      "data-test-id": "menu-item",
      children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(MenuIcon, {
        children: icon
      }), children]
    });
  };

  let renderChildren = null;

  if (noAnchor) {
    renderChildren = children;
  } else if (header) {
    renderChildren = children;
  } else if (!divider) {
    renderChildren = renderAnchor();
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(MenuListItem, {
    className: className,
    role: "presentation",
    isActive: isActive,
    divider: divider,
    noAnchor: noAnchor,
    header: header,
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(props, ['href', 'title', 'onSelect', 'eventKey', 'to', 'as']),
    children: renderChildren
  });
};

MenuItem.displayName = "MenuItem";

function getListItemStyles(props) {
  const common = `
    display: block;
    padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2)};
    &:focus {
      outline: none;
    }
  `;

  if (props.disabled) {
    return `
      ${common}
      color: ${props.theme.disabled};
      background: transparent;
      cursor: not-allowed;
    `;
  }

  if (props.isActive) {
    return `
      ${common}
      color: ${props.theme.white};
      background: ${props.theme.active};

      &:hover {
        background: ${props.theme.activeHover};
      }
    `;
  }

  return `
    ${common}

    &:hover {
      background: ${props.theme.hover};
    }
  `;
}

function getChildStyles(props) {
  if (!props.noAnchor) {
    return '';
  }

  return `
    & a {
      ${getListItemStyles(props)}
    }
  `;
}

const shouldForwardProp = p => typeof p === 'string' && ['isActive', 'disabled', 'withBorder'].includes(p) === false;

const MenuAnchor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('a',  true ? {
  shouldForwardProp,
  target: "e1g67xf44"
} : 0)(getListItemStyles, ";" + ( true ? "" : 0));

const MenuListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1g67xf43"
} : 0)("display:block;", p => p.withBorder && `
    border-bottom: 1px solid ${p.theme.innerBorder};

    &:last-child {
      border-bottom: none;
    }
  `, ";", p => p.divider && `
    height: 1px;
    margin: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5)} 0;
    overflow: hidden;
    background-color: ${p.theme.innerBorder};
  `, " ", p => p.header && `
    padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5)};
    font-size: ${p.theme.fontSizeSmall};
    line-height: 1.4;
    color: ${p.theme.gray300};
  `, " ", getChildStyles, ";" + ( true ? "" : 0));

const MenuTarget = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1g67xf42"
} : 0)(getListItemStyles, " display:flex;align-items:center;" + ( true ? "" : 0));

const MenuIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1g67xf41"
} : 0)("display:flex;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const MenuLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  shouldForwardProp,
  target: "e1g67xf40"
} : 0)(getListItemStyles, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItem);

/***/ }),

/***/ "./app/components/organizations/pageFilters/parse.tsx":
/*!************************************************************!*\
  !*** ./app/components/organizations/pageFilters/parse.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDatetimeFromState": () => (/* binding */ getDatetimeFromState),
/* harmony export */   "getStateFromQuery": () => (/* binding */ getStateFromQuery),
/* harmony export */   "normalizeDateTimeParams": () => (/* binding */ normalizeDateTimeParams),
/* harmony export */   "normalizeDateTimeString": () => (/* binding */ normalizeDateTimeString),
/* harmony export */   "parseStatsPeriod": () => (/* binding */ parseStatsPeriod)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");







const STATS_PERIOD_PATTERN = '^(\\d+)([hdmsw])?$';
/**
 * Parses a stats period into `period` and `periodLength`
 */

function parseStatsPeriod(input) {
  const result = input.match(STATS_PERIOD_PATTERN);

  if (!result) {
    return undefined;
  }

  const period = result[1]; // default to seconds. this behaviour is based on src/sentry/utils/dates.py

  const periodLength = result[2] || 's';
  return {
    period,
    periodLength
  };
}
/**
 * Normalizes a stats period string
 */

function coerceStatsPeriod(input) {
  const result = parseStatsPeriod(input);
  return result ? `${result.period}${result.periodLength}` : undefined;
}
/**
 * Normalizes a string or string[] into a standard stats period string.
 *
 * Undefined and null inputs are returned as undefined.
 */


function getStatsPeriodValue(maybe) {
  if (Array.isArray(maybe)) {
    const result = maybe.find(coerceStatsPeriod);
    return result ? coerceStatsPeriod(result) : undefined;
  }

  if (typeof maybe === 'string') {
    return coerceStatsPeriod(maybe);
  }

  return undefined;
}
/**
 * We normalize potential datetime strings into the form that would be valid if
 * it was to be parsed by datetime.strptime using the format
 * %Y-%m-%dT%H:%M:%S.%f
 *
 * This format was transformed to the form that moment.js understands using [0]
 *
 * [0]: https://gist.github.com/asafge/0b13c5066d06ae9a4446
 */


function normalizeDateTimeString(input) {
  if (!input) {
    return undefined;
  }

  const parsed = moment__WEBPACK_IMPORTED_MODULE_2___default().utc(input);

  if (!parsed.isValid()) {
    return undefined;
  }

  return parsed.format('YYYY-MM-DDTHH:mm:ss.SSS');
}
/**
 * Normalizes a string or string[] into the date time string.
 *
 * Undefined and null inputs are returned as undefined.
 */

function getDateTimeString(maybe) {
  const result = Array.isArray(maybe) ? maybe.find(needle => moment__WEBPACK_IMPORTED_MODULE_2___default().utc(needle).isValid()) : maybe;
  return normalizeDateTimeString(result);
}
/**
 * Normalize a UTC parameter
 */


function parseUtcValue(utc) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(utc)) {
    return undefined;
  }

  return utc === true || utc === 'true' ? 'true' : 'false';
}
/**
 * Normalizes a string or string[] into the UTC parameter.
 *
 * Undefined and null inputs are returned as undefined.
 */


function getUtcValue(maybe) {
  const result = Array.isArray(maybe) ? maybe.find(needle => !!parseUtcValue(needle)) : maybe;
  return parseUtcValue(result);
}
/**
 * Normalizes a string or string[] into the project list parameter
 */


function getProject(maybe) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(maybe)) {
    return undefined;
  }

  if (Array.isArray(maybe)) {
    return maybe.map(p => parseInt(p, 10));
  }

  const projectFromQueryIdInt = parseInt(maybe, 10);
  return isNaN(projectFromQueryIdInt) ? [] : [projectFromQueryIdInt];
}
/*
 * Normalizes a string or string[] into the environment list parameter
 */


function getEnvironment(maybe) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(maybe)) {
    return undefined;
  }

  if (Array.isArray(maybe)) {
    return maybe;
  }

  return [maybe];
}

/**
 * Normalizes the DateTime components of the page filters.
 *
 * NOTE: This has some additional functionality for handling `page*` filters
 *       that will override the standard `start`/`end`/`statsPeriod` filters.
 *
 * NOTE: This does *NOT* normalize the `project` or `environment` components of
 *       the page filter parameters. See `getStateFromQuery` for normalization
 *       of the project and environment parameters.
 */
function normalizeDateTimeParams(params) {
  var _getDateTimeString, _getDateTimeString2;

  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const {
    allowEmptyPeriod = false,
    allowAbsoluteDatetime = true,
    allowAbsolutePageDatetime = false,
    defaultStatsPeriod = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_STATS_PERIOD
  } = options;
  const {
    pageStatsPeriod,
    pageStart,
    pageEnd,
    pageUtc,
    start,
    end,
    period,
    statsPeriod,
    utc,
    ...otherParams
  } = params; // `statsPeriod` takes precedence for now. `period` is legacy.

  let coercedPeriod = getStatsPeriodValue(pageStatsPeriod) || getStatsPeriodValue(statsPeriod) || getStatsPeriodValue(period) || null;
  const dateTimeStart = allowAbsoluteDatetime ? allowAbsolutePageDatetime ? (_getDateTimeString = getDateTimeString(pageStart)) !== null && _getDateTimeString !== void 0 ? _getDateTimeString : getDateTimeString(start) : getDateTimeString(start) : null;
  const dateTimeEnd = allowAbsoluteDatetime ? allowAbsolutePageDatetime ? (_getDateTimeString2 = getDateTimeString(pageEnd)) !== null && _getDateTimeString2 !== void 0 ? _getDateTimeString2 : getDateTimeString(end) : getDateTimeString(end) : null;

  if ((!dateTimeStart || !dateTimeEnd) && !coercedPeriod && !allowEmptyPeriod) {
    coercedPeriod = defaultStatsPeriod;
  }

  const object = {
    statsPeriod: coercedPeriod,
    start: coercedPeriod ? null : dateTimeStart !== null && dateTimeStart !== void 0 ? dateTimeStart : null,
    end: coercedPeriod ? null : dateTimeEnd !== null && dateTimeEnd !== void 0 ? dateTimeEnd : null,
    // coerce utc into a string (it can be both: a string representation from
    // router, or a boolean from time range picker)
    utc: getUtcValue(pageUtc !== null && pageUtc !== void 0 ? pageUtc : utc),
    ...otherParams
  }; // Filter null values

  const paramEntries = Object.entries(object).filter(_ref => {
    let [_, value] = _ref;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value);
  });
  return Object.fromEntries(paramEntries);
}
/**
 * Parses and normalizes all page filter relevant parameters from a location
 * query.
 *
 * This includes the following operations
 *
 *  - Normalizes `project` and `environment` into a consistent list object.
 *  - Normalizes date time filter parameters (using normalizeDateTimeParams).
 *  - Parses `start` and `end` into Date objects.
 */

function getStateFromQuery(query) {
  var _getProject, _getEnvironment;

  let normalizeOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const {
    allowAbsoluteDatetime
  } = normalizeOptions;
  const project = (_getProject = getProject(query[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_4__.URL_PARAM.PROJECT])) !== null && _getProject !== void 0 ? _getProject : null;
  const environment = (_getEnvironment = getEnvironment(query[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_4__.URL_PARAM.ENVIRONMENT])) !== null && _getEnvironment !== void 0 ? _getEnvironment : null;
  const dateTimeParams = normalizeDateTimeParams(query, normalizeOptions);
  const hasAbsolute = allowAbsoluteDatetime && !!dateTimeParams.start && !!dateTimeParams.end;
  const start = hasAbsolute ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcToLocalDateObject)(dateTimeParams.start) : null;
  const end = hasAbsolute ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcToLocalDateObject)(dateTimeParams.end) : null;
  const period = dateTimeParams.statsPeriod;
  const utc = dateTimeParams.utc;
  const state = {
    project,
    environment,
    period: period || null,
    start: start || null,
    end: end || null,
    utc: typeof utc !== 'undefined' ? utc === 'true' : null
  };
  return state;
}
/**
 * Extract the datetime component from the page filter state object
 */

function getDatetimeFromState(state) {
  return Object.fromEntries(Object.entries(state).filter(_ref2 => {
    let [key] = _ref2;
    return sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_4__.DATE_TIME_KEYS.includes(key);
  }));
}

/***/ }),

/***/ "./app/components/performance/teamKeyTransaction.tsx":
/*!***********************************************************!*\
  !*** ./app/components/performance/teamKeyTransaction.tsx ***!
  \***********************************************************/
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
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Popper.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Manager.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Reference.js");
/* harmony import */ var sentry_components_actions_menuHeader__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/actions/menuHeader */ "./app/components/actions/menuHeader.tsx");
/* harmony import */ var sentry_components_checkboxFancy_checkboxFancy__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/checkboxFancy/checkboxFancy */ "./app/components/checkboxFancy/checkboxFancy.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/performance/constants */ "./app/utils/performance/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class TeamKeyTransaction extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isOpen: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "menuEl", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickOutside", event => {
      if (!this.menuEl) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      if (this.menuEl.contains(event.target)) {
        return;
      }

      this.setState({
        isOpen: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleOpen", () => {
      this.setState(_ref => {
        let {
          isOpen
        } = _ref;
        return {
          isOpen: !isOpen
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleSelection", (enabled, selection) => () => {
      const {
        handleToggleKeyTransaction,
        organization
      } = this.props;
      const {
        action
      } = selection;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('performance_views.team_key_transaction.set', {
        organization,
        action
      });
      return enabled ? handleToggleKeyTransaction(selection) : undefined;
    });
  }

  componentDidUpdate(_props, prevState) {
    if (this.state.isOpen && prevState.isOpen === false) {
      document.addEventListener('click', this.handleClickOutside, true);
    }

    if (this.state.isOpen === false && prevState.isOpen) {
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  partitionTeams(counts, keyedTeams) {
    const {
      teams,
      project
    } = this.props;
    const enabledTeams = [];
    const disabledTeams = [];
    const noAccessTeams = [];
    const projectTeams = new Set(project.teams.map(_ref2 => {
      let {
        id
      } = _ref2;
      return id;
    }));

    for (const team of teams) {
      var _counts$get;

      if (!projectTeams.has(team.id)) {
        noAccessTeams.push(team);
      } else if (keyedTeams.has(team.id) || ((_counts$get = counts.get(team.id)) !== null && _counts$get !== void 0 ? _counts$get : 0) < sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_12__.MAX_TEAM_KEY_TRANSACTIONS) {
        enabledTeams.push(team);
      } else {
        disabledTeams.push(team);
      }
    }

    return {
      enabledTeams,
      disabledTeams,
      noAccessTeams
    };
  }

  renderMenuContent(counts, keyedTeams) {
    const {
      teams,
      project,
      transactionName
    } = this.props;
    const {
      enabledTeams,
      disabledTeams,
      noAccessTeams
    } = this.partitionTeams(counts, keyedTeams);
    const isMyTeamsEnabled = enabledTeams.length > 0;
    const myTeamsHandler = this.toggleSelection(isMyTeamsEnabled, {
      action: enabledTeams.length === keyedTeams.size ? 'unkey' : 'key',
      teamIds: enabledTeams.map(_ref3 => {
        let {
          id
        } = _ref3;
        return id;
      }),
      project,
      transactionName
    });
    const hasTeamsWithAccess = enabledTeams.length + disabledTeams.length > 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(DropdownContent, {
      children: [hasTeamsWithAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(DropdownMenuHeader, {
          first: true,
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('My Teams with Access'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_checkboxFancy_checkboxFancy__WEBPACK_IMPORTED_MODULE_6__["default"], {
              isDisabled: !isMyTeamsEnabled,
              isChecked: teams.length === keyedTeams.size,
              isIndeterminate: teams.length > keyedTeams.size && keyedTeams.size > 0,
              onClick: myTeamsHandler
            })
          })]
        }), enabledTeams.map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TeamKeyTransactionItem, {
          team: team,
          isKeyed: keyedTeams.has(team.id),
          disabled: false,
          onSelect: this.toggleSelection(true, {
            action: keyedTeams.has(team.id) ? 'unkey' : 'key',
            teamIds: [team.id],
            project,
            transactionName
          })
        }, team.slug)), disabledTeams.map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TeamKeyTransactionItem, {
          team: team,
          isKeyed: keyedTeams.has(team.id),
          disabled: true,
          onSelect: this.toggleSelection(true, {
            action: keyedTeams.has(team.id) ? 'unkey' : 'key',
            teamIds: [team.id],
            project,
            transactionName
          })
        }, team.slug))]
      }), noAccessTeams.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DropdownMenuHeader, {
          first: !hasTeamsWithAccess,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('My Teams without Access')
        }), noAccessTeams.map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TeamKeyTransactionItem, {
          team: team,
          disabled: true
        }, team.slug))]
      })]
    });
  }

  renderMenu() {
    const {
      isLoading,
      counts,
      keyedTeams
    } = this.props;

    if (isLoading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(counts) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(keyedTeams)) {
      return null;
    }

    const modifiers = [{
      name: 'hide',
      enabled: false
    }, {
      name: 'preventOverflow',
      enabled: true,
      options: {
        padding: 10
      }
    }];
    return /*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_4__.createPortal)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react_popper__WEBPACK_IMPORTED_MODULE_14__.Popper, {
      placement: "top",
      modifiers: modifiers,
      children: _ref4 => {
        let {
          ref: popperRef,
          style,
          placement
        } = _ref4;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DropdownWrapper, {
          ref: ref => {
            popperRef(ref);
            this.menuEl = ref;
          },
          style: style,
          "data-placement": placement,
          children: this.renderMenuContent(counts, keyedTeams)
        });
      }
    }), document.body);
  }

  render() {
    const {
      isLoading,
      error,
      title: Title,
      keyedTeams,
      initialValue,
      teams
    } = this.props;
    const {
      isOpen
    } = this.state;
    const menu = isOpen ? this.renderMenu() : null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react_popper__WEBPACK_IMPORTED_MODULE_15__.Manager, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react_popper__WEBPACK_IMPORTED_MODULE_16__.Reference, {
        children: _ref5 => {
          let {
            ref
          } = _ref5;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StarWrapper, {
            ref: ref,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Title, {
              isOpen: isOpen,
              disabled: isLoading || Boolean(error),
              keyedTeams: keyedTeams ? teams.filter(_ref6 => {
                let {
                  id
                } = _ref6;
                return keyedTeams.has(id);
              }) : null,
              initialValue: initialValue,
              onClick: this.toggleOpen
            })
          });
        }
      }), menu]
    });
  }

}

TeamKeyTransaction.displayName = "TeamKeyTransaction";

function TeamKeyTransactionItem(_ref7) {
  let {
    team,
    isKeyed,
    disabled,
    onSelect
  } = _ref7;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DropdownMenuItem, {
    disabled: disabled,
    onSelect: onSelect,
    stopPropagation: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(MenuItemContent, {
      children: [team.slug, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
        children: !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(isKeyed) ? null : disabled ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Max %s', sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_12__.MAX_TEAM_KEY_TRANSACTIONS) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_checkboxFancy_checkboxFancy__WEBPACK_IMPORTED_MODULE_6__["default"], {
          isChecked: isKeyed
        })
      })]
    })
  }, team.slug);
}

TeamKeyTransactionItem.displayName = "TeamKeyTransactionItem";

const StarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1nwfj6j6"
} : 0)( true ? {
  name: "ugbj7z",
  styles: "display:flex;&>span{display:flex;}"
} : 0);

const DropdownWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1nwfj6j5"
} : 0)("border:none;border-radius:2px;box-shadow:0 0 0 1px rgba(52, 60, 69, 0.2),0 1px 3px rgba(70, 82, 98, 0.25);background-clip:padding-box;background-color:", p => p.theme.background, ";width:220px;overflow:visible;z-index:", p => p.theme.zIndex.tooltip, ";&:before,&:after{width:0;height:0;content:'';display:block;position:absolute;right:auto;}&:before{border-left:9px solid transparent;border-right:9px solid transparent;left:calc(50% - 9px);z-index:-2;}&:after{border-left:8px solid transparent;border-right:8px solid transparent;left:calc(50% - 8px);z-index:-1;}&[data-placement*='bottom']{margin-top:9px;&:before{border-bottom:9px solid ", p => p.theme.border, ";top:-9px;}&:after{border-bottom:8px solid ", p => p.theme.background, ";top:-8px;}}&[data-placement*='top']{margin-bottom:9px;&:before{border-top:9px solid ", p => p.theme.border, ";bottom:-9px;}&:after{border-top:8px solid ", p => p.theme.background, ";bottom:-8px;}}" + ( true ? "" : 0));

const DropdownContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1nwfj6j4"
} : 0)( true ? {
  name: "9t7tbb",
  styles: "max-height:250px;pointer-events:auto;overflow-y:auto"
} : 0);

const DropdownMenuHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_actions_menuHeader__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1nwfj6j3"
} : 0)("display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";background:", p => p.theme.backgroundSecondary, ";", p => p.first && 'border-radius: 2px', ";" + ( true ? "" : 0));

const DropdownMenuItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1nwfj6j2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const MenuItemContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1nwfj6j1"
} : 0)( true ? {
  name: "fxdlmq",
  styles: "display:flex;flex-direction:row;justify-content:space-between;align-items:center;width:100%"
} : 0);

const ActionItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e1nwfj6j0"
} : 0)("min-width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamKeyTransaction);

/***/ }),

/***/ "./app/components/performance/teamKeyTransactionsManager.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/performance/teamKeyTransactionsManager.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Consumer": () => (/* binding */ Consumer),
/* harmony export */   "Provider": () => (/* binding */ Provider)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_performance__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/performance */ "./app/actionCreators/performance.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const TeamKeyTransactionsManagerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)({
  teams: [],
  isLoading: false,
  error: null,
  counts: null,
  getKeyedTeams: () => null,
  handleToggleKeyTransaction: () => {}
});

class UnwrappedProvider extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      keyFetchID: null,
      isLoading: true,
      error: null,
      teamKeyTransactions: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getKeyedTeams", (projectId, transactionName) => {
      const {
        teamKeyTransactions
      } = this.state;
      const keyedTeams = new Set();
      teamKeyTransactions.forEach(_ref => {
        let {
          team,
          keyed
        } = _ref;
        const isKeyedByTeam = keyed.find(keyedTeam => keyedTeam.project_id === projectId && keyedTeam.transaction === transactionName);

        if (isKeyedByTeam) {
          keyedTeams.add(team);
        }
      });
      return keyedTeams;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleKeyTransaction", async selection => {
      const {
        api,
        organization
      } = this.props;
      const {
        teamKeyTransactions
      } = this.state;
      const {
        action,
        project,
        transactionName,
        teamIds
      } = selection;
      const isKeyTransaction = action === 'unkey';
      const teamIdSet = new Set(teamIds);
      const newTeamKeyTransactions = teamKeyTransactions.map(_ref2 => {
        let {
          team,
          count,
          keyed
        } = _ref2;

        if (!teamIdSet.has(team)) {
          return {
            team,
            count,
            keyed
          };
        }

        if (isKeyTransaction) {
          return {
            team,
            count: count - 1,
            keyed: keyed.filter(keyTransaction => keyTransaction.project_id !== project.id || keyTransaction.transaction !== transactionName)
          };
        }

        return {
          team,
          count: count + 1,
          keyed: [...keyed, {
            project_id: project.id,
            transaction: transactionName
          }]
        };
      });

      try {
        await (0,sentry_actionCreators_performance__WEBPACK_IMPORTED_MODULE_4__.toggleKeyTransaction)(api, isKeyTransaction, organization.slug, [project.id], transactionName, teamIds);
        this.setState({
          teamKeyTransactions: newTeamKeyTransactions
        });
      } catch (err) {
        var _err$responseJSON$det, _err$responseJSON;

        this.setState({
          error: (_err$responseJSON$det = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : null
        });
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;
    const selectedTeamsChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(prevProps.selectedTeams, this.props.selectedTeams);
    const selectedProjectsChanged = !lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(prevProps.selectedProjects, this.props.selectedProjects);

    if (orgSlugChanged || selectedTeamsChanged || selectedProjectsChanged) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {
      api,
      organization,
      selectedTeams,
      selectedProjects
    } = this.props;
    const keyFetchID = Symbol('keyFetchID');
    this.setState({
      isLoading: true,
      keyFetchID
    });
    let teamKeyTransactions = [];
    let error = null;

    try {
      teamKeyTransactions = await (0,sentry_actionCreators_performance__WEBPACK_IMPORTED_MODULE_4__.fetchTeamKeyTransactions)(api, organization.slug, selectedTeams, selectedProjects);
    } catch (err) {
      var _err$responseJSON$det2, _err$responseJSON2;

      error = (_err$responseJSON$det2 = (_err$responseJSON2 = err.responseJSON) === null || _err$responseJSON2 === void 0 ? void 0 : _err$responseJSON2.detail) !== null && _err$responseJSON$det2 !== void 0 ? _err$responseJSON$det2 : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Error fetching team key transactions');
    }

    this.setState({
      isLoading: false,
      keyFetchID: undefined,
      error,
      teamKeyTransactions
    });
  }

  getCounts() {
    const {
      teamKeyTransactions
    } = this.state;
    const counts = new Map();
    teamKeyTransactions.forEach(_ref3 => {
      let {
        team,
        count
      } = _ref3;
      counts.set(team, count);
    });
    return counts;
  }

  render() {
    const {
      teams
    } = this.props;
    const {
      isLoading,
      error
    } = this.state;
    const childrenProps = {
      teams,
      isLoading,
      error,
      counts: this.getCounts(),
      getKeyedTeams: this.getKeyedTeams,
      handleToggleKeyTransaction: this.handleToggleKeyTransaction
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(TeamKeyTransactionsManagerContext.Provider, {
      value: childrenProps,
      children: this.props.children
    });
  }

}

UnwrappedProvider.displayName = "UnwrappedProvider";
const Provider = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__["default"])(UnwrappedProvider);
const Consumer = TeamKeyTransactionsManagerContext.Consumer;

/***/ }),

/***/ "./app/components/performance/waterfall/constants.tsx":
/*!************************************************************!*\
  !*** ./app/components/performance/waterfall/constants.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ROW_HEIGHT": () => (/* binding */ ROW_HEIGHT),
/* harmony export */   "ROW_PADDING": () => (/* binding */ ROW_PADDING)
/* harmony export */ });
const ROW_HEIGHT = 24;
const ROW_PADDING = 4;

/***/ }),

/***/ "./app/components/performance/waterfall/rowBar.tsx":
/*!*********************************************************!*\
  !*** ./app/components/performance/waterfall/rowBar.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DurationPill": () => (/* binding */ DurationPill),
/* harmony export */   "RowRectangle": () => (/* binding */ RowRectangle)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");



const RowRectangle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "enpozew1"
} : 0)("position:absolute;height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT - 2 * sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_PADDING, "px;left:0;min-width:1px;user-select:none;transition:border-color 0.15s ease-in-out;", p => (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__.getHatchPattern)(p, '#dedae3', '#f4f2f7'), ";" + ( true ? "" : 0));
const DurationPill = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "enpozew0"
} : 0)("position:absolute;top:50%;display:flex;align-items:center;transform:translateY(-50%);white-space:nowrap;font-size:", p => p.theme.fontSizeExtraSmall, ";color:", p => p.showDetail === true ? p.theme.gray200 : p.theme.gray300, ";font-variant-numeric:tabular-nums;line-height:1;", sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__.getDurationPillAlignment, "@media (max-width: ", p => p.theme.breakpoints.medium, "){font-size:10px;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/waterfall/utils.tsx":
/*!********************************************************!*\
  !*** ./app/components/performance/waterfall/utils.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "barColors": () => (/* binding */ barColors),
/* harmony export */   "clamp": () => (/* binding */ clamp),
/* harmony export */   "getBackgroundColor": () => (/* binding */ getBackgroundColor),
/* harmony export */   "getDurationDisplay": () => (/* binding */ getDurationDisplay),
/* harmony export */   "getDurationPillAlignment": () => (/* binding */ getDurationPillAlignment),
/* harmony export */   "getHatchPattern": () => (/* binding */ getHatchPattern),
/* harmony export */   "getHumanDuration": () => (/* binding */ getHumanDuration),
/* harmony export */   "getOffsetOfElement": () => (/* binding */ getOffsetOfElement),
/* harmony export */   "getToggleTheme": () => (/* binding */ getToggleTheme),
/* harmony export */   "pickBarColor": () => (/* binding */ pickBarColor),
/* harmony export */   "rectOfContent": () => (/* binding */ rectOfContent),
/* harmony export */   "toPercent": () => (/* binding */ toPercent)
/* harmony export */ });
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


const getBackgroundColor = _ref => {
  let {
    showStriping,
    showDetail,
    theme
  } = _ref;

  if (showDetail) {
    return theme.textColor;
  }

  if (showStriping) {
    return theme.backgroundSecondary;
  }

  return theme.background;
};
function getHatchPattern(_ref2, primary, alternate) {
  let {
    spanBarHatch
  } = _ref2;

  if (spanBarHatch === true) {
    return `
      background-image: linear-gradient(135deg,
        ${alternate},
        ${alternate} 2.5px,
        ${primary} 2.5px,
        ${primary} 5px,
        ${alternate} 6px,
        ${alternate} 8px,
        ${primary} 8px,
        ${primary} 11px,
        ${alternate} 11px,
        ${alternate} 14px,
        ${primary} 14px,
        ${primary} 16.5px,
        ${alternate} 16.5px,
        ${alternate} 19px,
        ${primary} 20px
      );
      background-size: 16px 16px;
    `;
  }

  return null;
}
const getDurationPillAlignment = _ref3 => {
  let {
    durationDisplay,
    theme,
    spanBarHatch
  } = _ref3;

  switch (durationDisplay) {
    case 'left':
      return `right: calc(100% + ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5)});`;

    case 'right':
      return `left: calc(100% + ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.75)});`;

    default:
      return `
        right: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.75)};
        color: ${spanBarHatch === true ? theme.gray300 : theme.white};
      `;
  }
};
const getToggleTheme = _ref4 => {
  let {
    theme,
    isExpanded,
    disabled,
    errored,
    isSpanGroupToggler
  } = _ref4;
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;
  const errorTheme = theme.button.danger;
  const background = errored ? isExpanded ? buttonTheme.background : errorTheme.background : buttonTheme.background;
  const border = errored ? errorTheme.background : buttonTheme.border;
  const color = errored ? isExpanded ? errorTheme.background : buttonTheme.color : buttonTheme.color;

  if (isSpanGroupToggler) {
    return `
    background: ${theme.blue300};
    border: 1px solid ${theme.button.default.border};
    color: ${color};
    cursor: pointer;
  `;
  }

  if (disabled) {
    return `
    background: ${background};
    border: 1px solid ${border};
    color: ${color};
    cursor: default;
  `;
  }

  return `
    background: ${background};
    border: 1px solid ${border};
    color: ${color};
  `;
};
const getDurationDisplay = _ref5 => {
  let {
    width,
    left
  } = _ref5;
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }

  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }

  if (left > spaceNeeded) {
    return 'left';
  }

  return 'inset';
};
const getHumanDuration = duration => {
  // note: duration is assumed to be in seconds
  const durationMs = duration * 1000;
  return `${durationMs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}ms`;
};
const toPercent = value => `${(value * 100).toFixed(3)}%`;
// get position of element relative to top/left of document
const getOffsetOfElement = element => {
  // left and top are relative to viewport
  const {
    left,
    top
  } = element.getBoundingClientRect(); // get values that the document is currently scrolled by

  const scrollLeft = window.pageXOffset;
  const scrollTop = window.pageYOffset;
  return {
    x: left + scrollLeft,
    y: top + scrollTop
  };
};
const rectOfContent = element => {
  const {
    x,
    y
  } = getOffsetOfElement(element); // offsets for the border and any scrollbars (clientLeft and clientTop),
  // and if the element was scrolled (scrollLeft and scrollTop)
  //
  // NOTE: clientLeft and clientTop does not account for any margins nor padding

  const contentOffsetLeft = element.clientLeft - element.scrollLeft;
  const contentOffsetTop = element.clientTop - element.scrollTop;
  return {
    x: x + contentOffsetLeft,
    y: y + contentOffsetTop,
    width: element.scrollWidth,
    height: element.scrollHeight
  };
};
const clamp = (value, min, max) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const getLetterIndex = letter => {
  const index = 'abcdefghijklmnopqrstuvwxyz'.indexOf(letter) || 0;
  return index === -1 ? 0 : index;
};

const colorsAsArray = Object.keys(sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"]).map(key => sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][key]);
const barColors = {
  default: sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][4],
  transaction: sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][8],
  http: sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][10],
  db: sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][17]
};
const pickBarColor = input => {
  // We pick the color for span bars using the first three letters of the op name.
  // That way colors stay consistent between transactions.
  if (!input || input.length < 3) {
    return sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_0__["default"][17][4];
  }

  if (barColors[input]) {
    return barColors[input];
  }

  const letterIndex1 = getLetterIndex(input.slice(0, 1));
  const letterIndex2 = getLetterIndex(input.slice(1, 2));
  const letterIndex3 = getLetterIndex(input.slice(2, 3));
  const letterIndex4 = getLetterIndex(input.slice(3, 4));
  return colorsAsArray[(letterIndex1 + letterIndex2 + letterIndex3 + letterIndex4) % colorsAsArray.length];
};

/***/ }),

/***/ "./app/components/scoreBar.tsx":
/*!*************************************!*\
  !*** ./app/components/scoreBar.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const BaseScoreBar = _ref => {
  let {
    score,
    className,
    vertical,
    size = 40,
    thickness = 4,
    radius = 3,
    palette = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_2__["default"].similarity.colors
  } = _ref;
  const maxScore = palette.length; // Make sure score is between 0 and maxScore

  const scoreInBounds = score >= maxScore ? maxScore : score <= 0 ? 0 : score; // Make sure paletteIndex is 0 based

  const paletteIndex = scoreInBounds - 1; // Size of bar, depends on orientation, although we could just apply a transformation via css

  const barProps = {
    vertical,
    thickness,
    size,
    radius
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: className,
    children: [[...Array(scoreInBounds)].map((_j, i) => (0,_emotion_react__WEBPACK_IMPORTED_MODULE_4__.createElement)(Bar, { ...barProps,
      key: i,
      color: palette[paletteIndex]
    })), [...Array(maxScore - scoreInBounds)].map((_j, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Bar, { ...barProps,
      empty: true
    }, `empty-${i}`))]
  });
};

BaseScoreBar.displayName = "BaseScoreBar";

const ScoreBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseScoreBar,  true ? {
  target: "e1bnnx291"
} : 0)("display:flex;", p => p.vertical ? `flex-direction: column-reverse;
    justify-content: flex-end;` : 'min-width: 80px;', ";" + ( true ? "" : 0));

const Bar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1bnnx290"
} : 0)("border-radius:", p => p.radius, "px;margin:2px;", p => p.empty && `background-color: ${p.theme.similarity.empty};`, ";", p => p.color && `background-color: ${p.color};`, ";width:", p => !p.vertical ? p.thickness : p.size, "px;height:", p => !p.vertical ? p.size : p.thickness, "px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ScoreBar);

/***/ }),

/***/ "./app/components/shortId.tsx":
/*!************************************!*\
  !*** ./app/components/shortId.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function ShortId(_ref) {
  let {
    shortId,
    avatar,
    onClick,
    to,
    className
  } = _ref;

  if (!shortId) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(StyledShortId, {
    onClick: onClick,
    className: className,
    children: [avatar, to ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
      to: to,
      children: shortId
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledAutoSelectText, {
      children: shortId
    })]
  });
}

ShortId.displayName = "ShortId";

const StyledShortId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k2zj7b1"
} : 0)("font-family:", p => p.theme.text.familyMono, ";display:grid;grid-auto-flow:column;gap:0.5em;align-items:center;justify-content:flex-end;" + ( true ? "" : 0));

const StyledAutoSelectText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1k2zj7b0"
} : 0)("min-width:0;a &{color:", p => p.theme.linkColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ShortId);

/***/ }),

/***/ "./app/components/userMisery.tsx":
/*!***************************************!*\
  !*** ./app/components/userMisery.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/scoreBar */ "./app/components/scoreBar.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function UserMisery(props) {
  const {
    bars,
    barHeight,
    userMisery,
    miseryLimit,
    totalUsers,
    miserableUsers
  } = props; // User Misery will always be > 0 because of the maximum a posteriori estimate
  // and below 5% will always be an overestimation of the actual proportion
  // of miserable to total unique users. We are going to visualize it as
  // 0 User Misery while still preserving the actual value for sorting purposes.

  const adjustedMisery = userMisery > 0.05 ? userMisery : 0;
  const palette = new Array(bars).fill([sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_2__["default"][0][0]]);
  const score = Math.round(adjustedMisery * palette.length);
  let title;

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(miserableUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(totalUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(miseryLimit)) {
    title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[miserableUsers] out of [totalUsers] unique users waited more than [duration]ms (4x the response time threshold)', {
      miserableUsers,
      totalUsers,
      duration: 4 * miseryLimit
    });
  } else if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(miseryLimit)) {
    title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('User Misery score is [userMisery], representing users who waited more than [duration]ms (4x the response time threshold)', {
      duration: 4 * miseryLimit,
      userMisery: userMisery.toFixed(3)
    });
  } else if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(miserableUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(totalUsers)) {
    title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('User Misery score is [userMisery], because [miserableUsers] out of [totalUsers] unique users had a miserable experience.', {
      miserableUsers,
      totalUsers,
      userMisery: userMisery.toFixed(3)
    });
  } else {
    title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('User Misery score is [userMisery].', {
      userMisery: userMisery.toFixed(3)
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: title,
    containerDisplayMode: "block",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: barHeight,
      score: score,
      palette: palette,
      radius: 0
    })
  });
}

UserMisery.displayName = "UserMisery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UserMisery);

/***/ }),

/***/ "./app/components/version.tsx":
/*!************************************!*\
  !*** ./app/components/version.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

// eslint-disable-next-line no-restricted-imports














const Version = _ref => {
  let {
    version,
    organization,
    anchor = true,
    preservePageFilters,
    tooltipRawVersion,
    withPackage,
    projectId,
    truncate,
    className,
    location
  } = _ref;
  const versionToDisplay = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__.formatVersion)(version, withPackage);
  let releaseDetailProjectId;

  if (projectId) {
    // we can override preservePageFilters's project id
    releaseDetailProjectId = projectId;
  } else if (!(organization !== null && organization !== void 0 && organization.features.includes('global-views'))) {
    // we need this for users without global-views, otherwise they might get `This release may not be in your selected project`
    releaseDetailProjectId = location === null || location === void 0 ? void 0 : location.query.project;
  }

  const renderVersion = () => {
    if (anchor && organization !== null && organization !== void 0 && organization.slug) {
      const props = {
        to: {
          pathname: `/organizations/${organization === null || organization === void 0 ? void 0 : organization.slug}/releases/${encodeURIComponent(version)}/`,
          query: releaseDetailProjectId ? {
            project: releaseDetailProjectId
          } : undefined
        },
        className
      };

      if (preservePageFilters) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_4__["default"], { ...props,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(VersionText, {
            truncate: truncate,
            children: versionToDisplay
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], { ...props,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(VersionText, {
          truncate: truncate,
          children: versionToDisplay
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(VersionText, {
      className: className,
      truncate: truncate,
      children: versionToDisplay
    });
  };

  const renderTooltipContent = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TooltipContent, {
    onClick: e => {
      e.stopPropagation();
    },
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(TooltipVersionWrapper, {
      children: version
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_3__["default"], {
      value: version,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(TooltipClipboardIconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCopy, {
          size: "xs"
        })
      })
    })]
  });

  const getOverlayStyle = () => {
    // if the version name is not a hash (sha1 or sha265) and we are not on
    // mobile, allow tooltip to be as wide as 500px
    if (/(^[a-f0-9]{40}$)|(^[a-f0-9]{64}$)/.test(version)) {
      return undefined;
    }

    return /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_13__.css)("@media (min-width: ", sentry_utils_theme__WEBPACK_IMPORTED_MODULE_10__["default"].breakpoints.small, "){max-width:500px;}" + ( true ? "" : 0),  true ? "" : 0);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: renderTooltipContent(),
    disabled: !tooltipRawVersion,
    isHoverable: true,
    containerDisplayMode: truncate ? 'block' : 'inline-block',
    overlayStyle: getOverlayStyle(),
    children: renderVersion()
  });
};

Version.displayName = "Version";

// TODO(matej): try to wrap version with this when truncate prop is true (in separate PR)
// const VersionWrapper = styled('div')`
//   ${p => p.theme.overflowEllipsis};
//   max-width: 100%;
//   width: auto;
//   display: inline-block;
// `;
const VersionText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqmhduc3"
} : 0)(p => p.truncate && `max-width: 100%;
    display: block;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;`, ";" + ( true ? "" : 0));

const TooltipContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqmhduc2"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const TooltipVersionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqmhduc1"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const TooltipClipboardIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eqmhduc0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";position:relative;bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.25), ";&:hover{cursor:pointer;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(Version)));

/***/ }),

/***/ "./app/stores/guideStore.tsx":
/*!***********************************!*\
  !*** ./app/stores/guideStore.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/organizationsActions */ "./app/actions/organizationsActions.tsx");
/* harmony import */ var sentry_components_assistant_getGuidesContent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/assistant/getGuidesContent */ "./app/components/assistant/getGuidesContent.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");












function guidePrioritySort(a, b) {
  var _a$priority, _b$priority;

  const a_priority = (_a$priority = a.priority) !== null && _a$priority !== void 0 ? _a$priority : Number.MAX_SAFE_INTEGER;
  const b_priority = (_b$priority = b.priority) !== null && _b$priority !== void 0 ? _b$priority : Number.MAX_SAFE_INTEGER;

  if (a_priority === b_priority) {
    return a.guide.localeCompare(b.guide);
  } // lower number takes priority


  return a_priority - b_priority;
}

const defaultState = {
  forceHide: false,
  guides: [],
  anchors: new Set(),
  currentGuide: null,
  currentStep: 0,
  orgId: null,
  orgSlug: null,
  forceShow: false,
  prevGuide: null
};
const storeConfig = {
  state: defaultState,
  unsubscribeListeners: [],
  browserHistoryListener: null,

  init() {
    this.state = defaultState;
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_4__["default"].setActive, this.onSetActiveOrganization));
    window.addEventListener('load', this.onURLChange, false);
    this.browserHistoryListener = react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.listen(() => this.onURLChange());
  },

  teardown() {
    (0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_10__.cleanupActiveRefluxSubscriptions)(this.unsubscribeListeners);
    window.removeEventListener('load', this.onURLChange);

    if (this.browserHistoryListener) {
      this.browserHistoryListener();
    }
  },

  onURLChange() {
    this.state.forceShow = window.location.hash === '#assistant';
    this.updateCurrentGuide();
  },

  onSetActiveOrganization(data) {
    this.state.orgId = data ? data.id : null;
    this.state.orgSlug = data ? data.slug : null;
    this.updateCurrentGuide();
  },

  fetchSucceeded(data) {
    // It's possible we can get empty responses (seems to be Firefox specific)
    // Do nothing if `data` is empty
    // also, temporarily check data is in the correct format from the updated
    // assistant endpoint
    if (!data || !Array.isArray(data)) {
      return;
    }

    const guidesContent = (0,sentry_components_assistant_getGuidesContent__WEBPACK_IMPORTED_MODULE_5__["default"])(this.state.orgSlug); // map server guide state (i.e. seen status) with guide content

    const guides = guidesContent.reduce((acc, content) => {
      const serverGuide = data.find(guide => guide.guide === content.guide);
      serverGuide && acc.push({ ...content,
        ...serverGuide
      });
      return acc;
    }, []);
    this.state.guides = guides;
    this.updateCurrentGuide();
  },

  closeGuide(dismissed) {
    const {
      currentGuide,
      guides
    } = this.state; // update the current guide seen to true or all guides
    // if markOthersAsSeen is true and the user is dismissing

    guides.filter(guide => guide.guide === (currentGuide === null || currentGuide === void 0 ? void 0 : currentGuide.guide) || (currentGuide === null || currentGuide === void 0 ? void 0 : currentGuide.markOthersAsSeen) && dismissed).forEach(guide => guide.seen = true);
    this.state.forceShow = false;
    this.updateCurrentGuide();
  },

  nextStep() {
    this.state.currentStep += 1;
    this.trigger(this.state);
  },

  toStep(step) {
    this.state.currentStep = step;
    this.trigger(this.state);
  },

  registerAnchor(target) {
    this.state.anchors.add(target);
    this.updateCurrentGuide();
  },

  unregisterAnchor(target) {
    this.state.anchors.delete(target);
    this.updateCurrentGuide();
  },

  setForceHide(forceHide) {
    this.state.forceHide = forceHide;
    this.trigger(this.state);
  },

  recordCue(guide) {
    const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__["default"].get('user');

    if (!user) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('assistant.guide_cued', {
      organization: this.state.orgId,
      guide
    });
  },

  updatePrevGuide(nextGuide) {
    const {
      prevGuide
    } = this.state;

    if (!nextGuide) {
      return;
    }

    if (!prevGuide || prevGuide.guide !== nextGuide.guide) {
      this.recordCue(nextGuide.guide);
      this.state.prevGuide = nextGuide;
    }
  },

  /**
   * Logic to determine if a guide is shown:
   *
   *  - If any required target is missing, don't show the guide
   *  - If the URL ends with #assistant, show the guide
   *  - If the user has already seen the guide, don't show the guide
   *  - Otherwise show the guide
   */
  updateCurrentGuide(dismissed) {
    const {
      anchors,
      guides,
      forceShow
    } = this.state;
    let guideOptions = guides.sort(guidePrioritySort).filter(guide => guide.requiredTargets.every(target => anchors.has(target)));
    const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_7__["default"].get('user');
    const assistantThreshold = new Date(2019, 6, 1);
    const userDateJoined = new Date(user === null || user === void 0 ? void 0 : user.dateJoined);

    if (!forceShow) {
      guideOptions = guideOptions.filter(_ref => {
        let {
          seen,
          dateThreshold
        } = _ref;

        if (seen) {
          return false;
        }

        if (user !== null && user !== void 0 && user.isSuperuser && !sentry_constants__WEBPACK_IMPORTED_MODULE_6__.IS_ACCEPTANCE_TEST) {
          return true;
        }

        if (dateThreshold) {
          // Show the guide to users who've joined before the date threshold
          return userDateJoined < dateThreshold;
        }

        return userDateJoined > assistantThreshold;
      });
    } // Remove steps that are missing anchors, unless the anchor is included in
    // the expectedTargets and will appear at the step.


    const nextGuide = guideOptions.length > 0 ? { ...guideOptions[0],
      steps: guideOptions[0].steps.filter(step => {
        var _guideOptions$, _guideOptions$$expect;

        return anchors.has(step.target) || ((_guideOptions$ = guideOptions[0]) === null || _guideOptions$ === void 0 ? void 0 : (_guideOptions$$expect = _guideOptions$.expectedTargets) === null || _guideOptions$$expect === void 0 ? void 0 : _guideOptions$$expect.includes(step.target));
      })
    } : null;
    this.updatePrevGuide(nextGuide);
    this.state.currentStep = this.state.currentGuide && nextGuide && this.state.currentGuide.guide === nextGuide.guide ? this.state.currentStep : 0;
    this.state.currentGuide = nextGuide;
    this.trigger(this.state);
    sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('callback:on-guide-update').map(cb => cb(nextGuide, {
      dismissed
    }));
  }

};
const GuideStore = (0,reflux__WEBPACK_IMPORTED_MODULE_3__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_10__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GuideStore);

/***/ }),

/***/ "./app/stores/pageFiltersStore.tsx":
/*!*****************************************!*\
  !*** ./app/stores/pageFiltersStore.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/pageFiltersActions */ "./app/actions/pageFiltersActions.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_utils_isEqualWithDates__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/isEqualWithDates */ "./app/utils/isEqualWithDates.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");







const storeConfig = {
  selection: (0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_4__.getDefaultSelection)(),
  pinnedFilters: new Set(),
  desyncedFilters: new Set(),
  hasInitialState: false,
  unsubscribeListeners: [],

  init() {
    this.reset(this.selection);
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].reset, this.onReset));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].initializeUrlState, this.onInitializeUrlState));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateProjects, this.updateProjects));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateDateTime, this.updateDateTime));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateEnvironments, this.updateEnvironments));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateDesyncedFilters, this.updateDesyncedFilters));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_3__["default"].pin, this.pin));
  },

  reset(selection) {
    this._isReady = false;
    this.selection = selection || (0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_4__.getDefaultSelection)();
    this.pinnedFilters = new Set();
  },

  /**
   * Initializes the page filters store data
   */
  onInitializeUrlState(newSelection, pinned) {
    this._isReady = true;
    this.selection = newSelection;
    this.pinnedFilters = pinned;
    this.trigger(this.getState());
  },

  getState() {
    return {
      selection: this.selection,
      pinnedFilters: this.pinnedFilters,
      desyncedFilters: this.desyncedFilters,
      isReady: this._isReady
    };
  },

  onReset() {
    this.reset();
    this.trigger(this.getState());
  },

  updateDesyncedFilters(filters) {
    this.desyncedFilters = filters;
    this.trigger(this.getState());
  },

  updateProjects() {
    let projects = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    let environments = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default()(this.selection.projects, projects)) {
      return;
    }

    this.selection = { ...this.selection,
      projects,
      environments: environments === null ? this.selection.environments : environments
    };
    this.trigger(this.getState());
  },

  updateDateTime(datetime) {
    if ((0,sentry_utils_isEqualWithDates__WEBPACK_IMPORTED_MODULE_5__.isEqualWithDates)(this.selection.datetime, datetime)) {
      return;
    }

    this.selection = { ...this.selection,
      datetime
    };
    this.trigger(this.getState());
  },

  updateEnvironments(environments) {
    if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default()(this.selection.environments, environments)) {
      return;
    }

    this.selection = { ...this.selection,
      environments: environments !== null && environments !== void 0 ? environments : []
    };
    this.trigger(this.getState());
  },

  pin(filter, pin) {
    if (pin) {
      this.pinnedFilters.add(filter);
    } else {
      this.pinnedFilters.delete(filter);
    }

    this.trigger(this.getState());
  }

};
const PageFiltersStore = (0,reflux__WEBPACK_IMPORTED_MODULE_2__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_6__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageFiltersStore);

/***/ }),

/***/ "./app/types/utils.tsx":
/*!*****************************!*\
  !*** ./app/types/utils.tsx ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "assert": () => (/* binding */ assert),
/* harmony export */   "assertType": () => (/* binding */ assertType),
/* harmony export */   "isNotSharedOrganization": () => (/* binding */ isNotSharedOrganization)
/* harmony export */ });
// from:
// - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
// - https://www.typescriptlang.org/play/#example/assertion-functions
// This declares a function which asserts that the expression called
// value is true:
// eslint-disable-next-line prettier/prettier
function assert(_value) {} // This declares a function which asserts that the expression called
// value is of type Type:
// eslint-disable-next-line prettier/prettier

function assertType(_value) {}
function isNotSharedOrganization(maybe) {
  return typeof maybe.id !== 'undefined';
}

/***/ }),

/***/ "./app/utils/dates.tsx":
/*!*****************************!*\
  !*** ./app/utils/dates.tsx ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_DAY_END_TIME": () => (/* binding */ DEFAULT_DAY_END_TIME),
/* harmony export */   "DEFAULT_DAY_START_TIME": () => (/* binding */ DEFAULT_DAY_START_TIME),
/* harmony export */   "getDateWithTimezoneInUtc": () => (/* binding */ getDateWithTimezoneInUtc),
/* harmony export */   "getEndOfDay": () => (/* binding */ getEndOfDay),
/* harmony export */   "getFormattedDate": () => (/* binding */ getFormattedDate),
/* harmony export */   "getInternalDate": () => (/* binding */ getInternalDate),
/* harmony export */   "getLocalToSystem": () => (/* binding */ getLocalToSystem),
/* harmony export */   "getPeriodAgo": () => (/* binding */ getPeriodAgo),
/* harmony export */   "getStartOfDay": () => (/* binding */ getStartOfDay),
/* harmony export */   "getStartOfPeriodAgo": () => (/* binding */ getStartOfPeriodAgo),
/* harmony export */   "getTimeFormat": () => (/* binding */ getTimeFormat),
/* harmony export */   "getUserTimezone": () => (/* binding */ getUserTimezone),
/* harmony export */   "getUtcDateString": () => (/* binding */ getUtcDateString),
/* harmony export */   "getUtcToLocalDateObject": () => (/* binding */ getUtcToLocalDateObject),
/* harmony export */   "getUtcToSystem": () => (/* binding */ getUtcToSystem),
/* harmony export */   "intervalToMilliseconds": () => (/* binding */ intervalToMilliseconds),
/* harmony export */   "isValidTime": () => (/* binding */ isValidTime),
/* harmony export */   "parsePeriodToHours": () => (/* binding */ parsePeriodToHours),
/* harmony export */   "setDateToTime": () => (/* binding */ setDateToTime),
/* harmony export */   "shouldUse24Hours": () => (/* binding */ shouldUse24Hours),
/* harmony export */   "statsPeriodToDays": () => (/* binding */ statsPeriodToDays)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");




// TODO(billy): Move to TimeRangeSelector specific utils
const DEFAULT_DAY_START_TIME = '00:00:00';
const DEFAULT_DAY_END_TIME = '23:59:59';
const DATE_FORMAT_NO_TIMEZONE = 'YYYY/MM/DD HH:mm:ss';

function getParser() {
  let local = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  return local ? (moment__WEBPACK_IMPORTED_MODULE_1___default()) : (moment__WEBPACK_IMPORTED_MODULE_1___default().utc);
}
/**
 * Checks if string is valid time. Only accepts 24 hour format.
 *
 * Chrome's time input will (at least for US locale), allow you to input 12
 * hour format with AM/PM but the raw value is in 24 hour.
 *
 * Safari does not do any validation so you could get a value of > 24 hours
 */


function isValidTime(str) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default()(str, 'HH:mm', true).isValid();
}
/**
 * Given a date object, format in datetime in UTC
 * given: Tue Oct 09 2018 00:00:00 GMT-0700 (Pacific Daylight Time)
 * returns: "2018-10-09T07:00:00.000"
 */

function getUtcDateString(dateObj) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default().utc(dateObj).format((moment__WEBPACK_IMPORTED_MODULE_1___default().HTML5_FMT.DATETIME_LOCAL_SECONDS));
}
function getFormattedDate(dateObj, format) {
  let {
    local
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  return getParser(local)(dateObj).format(format);
}
/**
 * Returns user timezone from their account preferences
 */

function getUserTimezone() {
  var _ConfigStore$get, _ConfigStore$get$opti;

  return (_ConfigStore$get = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('user')) === null || _ConfigStore$get === void 0 ? void 0 : (_ConfigStore$get$opti = _ConfigStore$get.options) === null || _ConfigStore$get$opti === void 0 ? void 0 : _ConfigStore$get$opti.timezone;
}
/**
 * Given a UTC date, return a Date object in local time
 */

function getUtcToLocalDateObject(date) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default().utc(date).local().toDate();
}
/**
 * Sets time (hours + minutes) of the current date object
 *
 * @param {String} timeStr Time in 24hr format (HH:mm)
 */

function setDateToTime(dateObj, timeStr) {
  let {
    local
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const [hours, minutes, seconds] = timeStr.split(':').map(t => parseInt(t, 10));
  const date = new Date(+dateObj);

  if (local) {
    date.setHours(hours, minutes);
  } else {
    date.setUTCHours(hours, minutes);
  }

  if (typeof seconds !== 'undefined') {
    date.setSeconds(seconds);
  }

  return date;
}
/**
 * Given a UTC timestamp, return a system date object with the same date
 * e.g. given: system is -0700 (PST),
 * 1/1/2001 @ 22:00 UTC, return:  1/1/2001 @ 22:00 -0700 (PST)
 */

function getUtcToSystem(dateObj) {
  // This is required because if your system timezone !== user configured timezone
  // then there will be a mismatch of dates with `react-date-picker`
  //
  // We purposely strip the timezone when formatting from the utc timezone
  return new Date(moment__WEBPACK_IMPORTED_MODULE_1___default().utc(dateObj).format(DATE_FORMAT_NO_TIMEZONE));
}
/**
 * Given a timestamp, format to user preference timezone, and strip timezone to
 * return a system date object with the same date
 *
 * e.g. given: system is -0700 (PST) and user preference is -0400 (EST),
 * 1/1/2001 @ 22:00 UTC --> 1/1/2001 @ 18:00 -0400 (EST) -->
 * return:  1/1/2001 @ 18:00 -0700 (PST)
 */

function getLocalToSystem(dateObj) {
  // This is required because if your system timezone !== user configured timezone
  // then there will be a mismatch of dates with `react-date-picker`
  //
  // We purposely strip the timezone when formatting from the utc timezone
  return new Date(moment__WEBPACK_IMPORTED_MODULE_1___default()(dateObj).format(DATE_FORMAT_NO_TIMEZONE));
} // Get the beginning of day (e.g. midnight)

function getStartOfDay(date) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default()(date).startOf('day').startOf('hour').startOf('minute').startOf('second').local().toDate();
} // Get tomorrow at midnight so that default endtime
// is inclusive of today

function getEndOfDay(date) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default()(date).add(1, 'day').startOf('hour').startOf('minute').startOf('second').subtract(1, 'second').local().toDate();
}
function getPeriodAgo(period, unit) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default()().local().subtract(unit, period);
} // Get the start of the day (midnight) for a period ago
//
// e.g. 2 weeks ago at midnight

function getStartOfPeriodAgo(period, unit) {
  return getStartOfDay(getPeriodAgo(period, unit));
}
/**
 * Convert an interval string into a number of seconds.
 * This allows us to create end timestamps from starting ones
 * enabling us to find events in narrow windows.
 *
 * @param {String} interval The interval to convert.
 * @return {Integer}
 */

function intervalToMilliseconds(interval) {
  const pattern = /^(\d+)(d|h|m)$/;
  const matches = pattern.exec(interval);

  if (!matches) {
    return 0;
  }

  const [, value, unit] = matches;
  const multipliers = {
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60
  };
  return parseInt(value, 10) * multipliers[unit] * 1000;
}
/**
 * This parses our period shorthand strings (e.g. <int><unit>)
 * and converts it into hours
 */

function parsePeriodToHours(str) {
  const result = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.parseStatsPeriod)(str);

  if (!result) {
    return -1;
  }

  const {
    period,
    periodLength
  } = result;
  const periodNumber = parseInt(period, 10);

  switch (periodLength) {
    case 's':
      return periodNumber / (60 * 60);

    case 'm':
      return periodNumber / 60;

    case 'h':
      return periodNumber;

    case 'd':
      return periodNumber * 24;

    case 'w':
      return periodNumber * 24 * 7;

    default:
      return -1;
  }
}
function statsPeriodToDays(statsPeriod, start, end) {
  if (statsPeriod && statsPeriod.endsWith('d')) {
    return parseInt(statsPeriod.slice(0, -1), 10);
  }

  if (statsPeriod && statsPeriod.endsWith('h')) {
    return parseInt(statsPeriod.slice(0, -1), 10) / 24;
  }

  if (start && end) {
    return (new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000);
  }

  return 0;
}
function shouldUse24Hours() {
  var _ConfigStore$get2, _ConfigStore$get2$opt;

  return (_ConfigStore$get2 = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('user')) === null || _ConfigStore$get2 === void 0 ? void 0 : (_ConfigStore$get2$opt = _ConfigStore$get2.options) === null || _ConfigStore$get2$opt === void 0 ? void 0 : _ConfigStore$get2$opt.clock24Hours;
}
function getTimeFormat() {
  let {
    displaySeconds = false
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  if (shouldUse24Hours()) {
    return displaySeconds ? 'HH:mm:ss' : 'HH:mm';
  }

  return displaySeconds ? 'LTS' : 'LT';
}
function getInternalDate(date, utc) {
  if (utc) {
    return getUtcToSystem(date);
  }

  return new Date(moment__WEBPACK_IMPORTED_MODULE_1___default().tz(moment__WEBPACK_IMPORTED_MODULE_1___default().utc(date), getUserTimezone()).format('YYYY/MM/DD HH:mm:ss'));
}
/**
 * Strips timezone from local date, creates a new moment date object with timezone
 * returns the moment as a Date object
 */

function getDateWithTimezoneInUtc(date, utc) {
  return moment__WEBPACK_IMPORTED_MODULE_1___default().tz(moment__WEBPACK_IMPORTED_MODULE_1___default()(date).local().format('YYYY-MM-DD HH:mm:ss'), utc ? 'UTC' : getUserTimezone()).utc().toDate();
}

/***/ }),

/***/ "./app/utils/discover/arrayValue.tsx":
/*!*******************************************!*\
  !*** ./app/utils/discover/arrayValue.tsx ***!
  \*******************************************/
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
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _fieldRenderers__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








class ArrayValue extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      expanded: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggle", () => {
      this.setState(prevState => ({
        expanded: !prevState.expanded
      }));
    });
  }

  render() {
    const {
      expanded
    } = this.state;
    const {
      value
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(ArrayContainer, {
      expanded: expanded,
      children: [expanded && value.slice(0, value.length - 1).map((item, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ArrayItem, {
        children: (0,_fieldRenderers__WEBPACK_IMPORTED_MODULE_6__.nullableValue)(item)
      }, `${i}:${item}`)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ArrayItem, {
        children: (0,_fieldRenderers__WEBPACK_IMPORTED_MODULE_6__.nullableValue)(value.slice(-1)[0])
      }), value.length > 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ButtonContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("button", {
          onClick: this.handleToggle,
          children: expanded ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('[collapse]') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('[+%s more]', value.length - 1)
        })
      }) : null]
    });
  }

}

ArrayValue.displayName = "ArrayValue";

const ArrayContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e536ad12"
} : 0)("display:flex;flex-direction:", p => p.expanded ? 'column' : 'row', ";& button{background:none;border:0;outline:none;padding:0;cursor:pointer;color:", p => p.theme.blue300, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";}" + ( true ? "" : 0));

const ArrayItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e536ad11"
} : 0)("flex-shrink:1;display:block;", p => p.theme.overflowEllipsis, ";width:unset;" + ( true ? "" : 0));

const ButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e536ad10"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ArrayValue);

/***/ }),

/***/ "./app/utils/discover/eventView.tsx":
/*!******************************************!*\
  !*** ./app/utils/discover/eventView.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "encodeSort": () => (/* binding */ encodeSort),
/* harmony export */   "fromSorts": () => (/* binding */ fromSorts),
/* harmony export */   "isAPIPayloadSimilar": () => (/* binding */ isAPIPayloadSimilar),
/* harmony export */   "isFieldSortable": () => (/* binding */ isFieldSortable),
/* harmony export */   "pickRelevantLocationQueryStrings": () => (/* binding */ pickRelevantLocationQueryStrings)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _dates__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../dates */ "./app/utils/dates.tsx");
/* harmony import */ var _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _fieldRenderers__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");























 // Metadata mapping for discover results.

const DATETIME_QUERY_STRING_KEYS = ['start', 'end', 'utc', 'statsPeriod'];
const EXTERNAL_QUERY_STRING_KEYS = [...DATETIME_QUERY_STRING_KEYS, 'cursor'];

const setSortOrder = (sort, kind) => ({
  kind,
  field: sort.field
});

const reverseSort = sort => ({
  kind: sort.kind === 'desc' ? 'asc' : 'desc',
  field: sort.field
});

const isSortEqualToField = (sort, field, tableMeta) => {
  const sortKey = getSortKeyFromField(field, tableMeta);
  return sort.field === sortKey;
};

const fieldToSort = (field, tableMeta, kind, useFunctionFormat) => {
  const sortKey = getSortKeyFromField(field, tableMeta, useFunctionFormat);

  if (!sortKey) {
    return void 0;
  }

  return {
    kind: kind || 'desc',
    field: sortKey
  };
};

function getSortKeyFromField(field, tableMeta, useFunctionFormat) {
  const fieldString = useFunctionFormat ? field.field : (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getAggregateAlias)(field.field);
  return (0,_fieldRenderers__WEBPACK_IMPORTED_MODULE_23__.getSortField)(fieldString, tableMeta);
}

function isFieldSortable(field, tableMeta) {
  return !!getSortKeyFromField(field, tableMeta);
}

const decodeFields = location => {
  const {
    query
  } = location;

  if (!query || !query.field) {
    return [];
  }

  const fields = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeList)(query.field);
  const widths = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeList)(query.widths);
  const parsed = [];
  fields.forEach((field, i) => {
    const w = Number(widths[i]);
    const width = !isNaN(w) ? w : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED;
    parsed.push({
      field,
      width
    });
  });
  return parsed;
};

const parseSort = sort => {
  sort = sort.trim();

  if (sort.startsWith('-')) {
    return {
      kind: 'desc',
      field: sort.substring(1)
    };
  }

  return {
    kind: 'asc',
    field: sort
  };
};

const fromSorts = sorts => {
  if (sorts === undefined) {
    return [];
  }

  sorts = lodash_isString__WEBPACK_IMPORTED_MODULE_6___default()(sorts) ? [sorts] : sorts; // NOTE: sets are iterated in insertion order

  const uniqueSorts = [...new Set(sorts)];
  return uniqueSorts.reduce((acc, sort) => {
    acc.push(parseSort(sort));
    return acc;
  }, []);
};

const decodeSorts = location => {
  const {
    query
  } = location;

  if (!query || !query.sort) {
    return [];
  }

  const sorts = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeList)(query.sort);
  return fromSorts(sorts);
};

const encodeSort = sort => {
  switch (sort.kind) {
    case 'desc':
      {
        return `-${sort.field}`;
      }

    case 'asc':
      {
        return String(sort.field);
      }

    default:
      {
        throw new Error('Unexpected sort type');
      }
  }
};

const encodeSorts = sorts => sorts.map(encodeSort);

const collectQueryStringByKey = (query, key) => {
  const needle = query[key];
  const collection = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeList)(needle);
  return collection.reduce((acc, item) => {
    item = item.trim();

    if (item.length > 0) {
      acc.push(item);
    }

    return acc;
  }, []);
};

const decodeQuery = location => {
  if (!location.query || !location.query.query) {
    return '';
  }

  const queryParameter = location.query.query;
  return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(queryParameter, '').trim();
};

const decodeTeam = value => {
  if (value === 'myteams') {
    return value;
  }

  return parseInt(value, 10);
};

const decodeTeams = location => {
  if (!location.query || !location.query.team) {
    return [];
  }

  const value = location.query.team;
  return (Array.isArray(value) ? value.map(decodeTeam) : [decodeTeam(value)]).filter(team => team === 'myteams' || !isNaN(team));
};

const decodeProjects = location => {
  if (!location.query || !location.query.project) {
    return [];
  }

  const value = location.query.project;
  return Array.isArray(value) ? value.map(i => parseInt(i, 10)) : [parseInt(value, 10)];
};

const queryStringFromSavedQuery = saved => {
  if (saved.query) {
    return saved.query || '';
  }

  return '';
};

function validateTableMeta(tableMeta) {
  return tableMeta && Object.keys(tableMeta).length > 0 ? tableMeta : undefined;
}

class EventView {
  // This allows views to always add additional conditions to the query to get specific data. It should not show up in the UI unless explicitly called.
  constructor(props) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "id", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "name", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fields", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sorts", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "query", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "team", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "project", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "start", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "end", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "statsPeriod", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "utc", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "environment", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "yAxis", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "display", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "topEvents", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "interval", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "expired", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createdBy", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "additionalConditions", void 0);

    const fields = Array.isArray(props.fields) ? props.fields : [];
    let sorts = Array.isArray(props.sorts) ? props.sorts : [];
    const team = Array.isArray(props.team) ? props.team : [];
    const project = Array.isArray(props.project) ? props.project : [];
    const environment = Array.isArray(props.environment) ? props.environment : []; // only include sort keys that are included in the fields

    let equations = 0;
    const sortKeys = fields.map(field => {
      if (field.field && (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation)(field.field)) {
        const sortKey = getSortKeyFromField({
          field: `equation[${equations}]`
        }, undefined);
        equations += 1;
        return sortKey;
      }

      return getSortKeyFromField(field, undefined);
    }).filter(sortKey => !!sortKey);
    const sort = sorts.find(currentSort => sortKeys.includes(currentSort.field));
    sorts = sort ? [sort] : [];
    const id = props.id !== null && props.id !== void 0 ? String(props.id) : void 0;
    this.id = id;
    this.name = props.name;
    this.fields = fields;
    this.sorts = sorts;
    this.query = typeof props.query === 'string' ? props.query : '';
    this.team = team;
    this.project = project;
    this.start = props.start;
    this.end = props.end;
    this.statsPeriod = props.statsPeriod;
    this.utc = props.utc;
    this.environment = environment;
    this.yAxis = props.yAxis;
    this.display = props.display;
    this.topEvents = props.topEvents;
    this.interval = props.interval;
    this.createdBy = props.createdBy;
    this.expired = props.expired;
    this.additionalConditions = props.additionalConditions ? props.additionalConditions.copy() : new _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__.MutableSearch([]);
  }

  static fromLocation(location) {
    const {
      start,
      end,
      statsPeriod
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(location.query);
    return new EventView({
      id: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.id),
      name: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.name),
      fields: decodeFields(location),
      sorts: decodeSorts(location),
      query: decodeQuery(location),
      team: decodeTeams(location),
      project: decodeProjects(location),
      start: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(start),
      end: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(end),
      statsPeriod: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(statsPeriod),
      environment: collectQueryStringByKey(location.query, 'environment'),
      yAxis: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.yAxis),
      display: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.display),
      topEvents: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.topEvents),
      interval: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.interval),
      createdBy: undefined,
      additionalConditions: new _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__.MutableSearch([])
    });
  }

  static fromNewQueryWithLocation(newQuery, location) {
    const query = location.query; // apply global selection header values from location whenever possible

    const environment = Array.isArray(newQuery.environment) && newQuery.environment.length > 0 ? newQuery.environment : collectQueryStringByKey(query, 'environment');
    const project = Array.isArray(newQuery.projects) && newQuery.projects.length > 0 ? newQuery.projects : decodeProjects(location);
    const saved = { ...newQuery,
      environment,
      projects: project,
      // datetime selection
      start: newQuery.start || (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(query.start),
      end: newQuery.end || (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(query.end),
      range: newQuery.range || (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(query.statsPeriod)
    };
    return EventView.fromSavedQuery(saved);
  }

  static getFields(saved) {
    return saved.fields.map((field, i) => {
      const width = saved.widths && saved.widths[i] ? Number(saved.widths[i]) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED;
      return {
        field,
        width
      };
    });
  }

  static fromSavedQuery(saved) {
    var _saved$teams;

    const fields = EventView.getFields(saved); // normalize datetime selection

    const {
      start,
      end,
      statsPeriod,
      utc
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)({
      start: saved.start,
      end: saved.end,
      statsPeriod: saved.range,
      utc: saved.utc
    });
    return new EventView({
      id: saved.id,
      name: saved.name,
      fields,
      query: queryStringFromSavedQuery(saved),
      team: (_saved$teams = saved.teams) !== null && _saved$teams !== void 0 ? _saved$teams : [],
      project: saved.projects,
      start: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(start),
      end: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(end),
      statsPeriod: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(statsPeriod),
      utc,
      sorts: fromSorts(saved.orderby),
      environment: collectQueryStringByKey({
        environment: saved.environment
      }, 'environment'),
      // Workaround to only use the first yAxis since eventView yAxis doesn't accept string[]
      yAxis: Array.isArray(saved.yAxis) ? saved.yAxis[0] : saved.yAxis,
      display: saved.display,
      topEvents: saved.topEvents ? saved.topEvents.toString() : undefined,
      createdBy: saved.createdBy,
      expired: saved.expired,
      additionalConditions: new _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__.MutableSearch([])
    });
  }

  static fromSavedQueryOrLocation(saved, location) {
    let fields = decodeFields(location);
    const {
      start,
      end,
      statsPeriod,
      utc
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(location.query);
    const id = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.id);
    const teams = decodeTeams(location);
    const projects = decodeProjects(location);
    const sorts = decodeSorts(location);
    const environments = collectQueryStringByKey(location.query, 'environment');

    if (saved) {
      if (fields.length === 0) {
        fields = EventView.getFields(saved);
      }

      return new EventView({
        id: id || saved.id,
        name: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.name) || saved.name,
        fields,
        query: 'query' in location.query ? decodeQuery(location) : queryStringFromSavedQuery(saved),
        sorts: sorts.length === 0 ? fromSorts(saved.orderby) : sorts,
        yAxis: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.yAxis) || ( // Workaround to only use the first yAxis since eventView yAxis doesn't accept string[]
        Array.isArray(saved.yAxis) ? saved.yAxis[0] : saved.yAxis),
        display: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.display) || saved.display,
        topEvents: ((0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.topEvents) || saved.topEvents || sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.TOP_N).toString(),
        interval: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.interval),
        createdBy: saved.createdBy,
        expired: saved.expired,
        additionalConditions: new _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__.MutableSearch([]),
        // Always read team from location since they can be set by other parts
        // of the UI
        team: teams,
        // Always read project and environment from location since they can
        // be set by the GlobalSelectionHeaders.
        project: projects,
        environment: environments,
        start: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(start),
        end: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(end),
        statsPeriod: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(statsPeriod),
        utc
      });
    }

    return EventView.fromLocation(location);
  }

  isEqualTo(other) {
    const defaults = {
      id: undefined,
      name: undefined,
      query: undefined,
      statsPeriod: undefined,
      fields: undefined,
      sorts: undefined,
      project: undefined,
      environment: undefined,
      yAxis: 'count()',
      display: sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DEFAULT,
      topEvents: '5'
    };
    const keys = Object.keys(defaults);

    for (const key of keys) {
      var _this$key, _other$key;

      const currentValue = (_this$key = this[key]) !== null && _this$key !== void 0 ? _this$key : defaults[key];
      const otherValue = (_other$key = other[key]) !== null && _other$key !== void 0 ? _other$key : defaults[key];

      if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentValue, otherValue)) {
        return false;
      }
    } // compare datetime selections using moment


    const dateTimeKeys = ['start', 'end'];

    for (const key of dateTimeKeys) {
      const currentValue = this[key];
      const otherValue = other[key];

      if (currentValue && otherValue) {
        const currentDateTime = moment__WEBPACK_IMPORTED_MODULE_10___default().utc(currentValue);
        const otherDateTime = moment__WEBPACK_IMPORTED_MODULE_10___default().utc(otherValue);

        if (!currentDateTime.isSame(otherDateTime)) {
          return false;
        }
      }
    }

    return true;
  }

  toNewQuery() {
    const orderby = this.sorts.length > 0 ? encodeSorts(this.sorts)[0] : undefined;
    const newQuery = {
      version: 2,
      id: this.id,
      name: this.name || '',
      fields: this.getFields(),
      widths: this.getWidths().map(w => String(w)),
      orderby,
      query: this.query || '',
      projects: this.project,
      start: this.start,
      end: this.end,
      range: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis ? [this.yAxis] : undefined,
      display: this.display,
      topEvents: this.topEvents
    };

    if (!newQuery.query) {
      // if query is an empty string, then it cannot be saved, so we omit it
      // from the payload
      delete newQuery.query;
    }

    return newQuery;
  }

  getPageFilters() {
    var _this$start, _this$end, _this$statsPeriod;

    return {
      projects: this.project,
      environments: this.environment,
      datetime: {
        start: (_this$start = this.start) !== null && _this$start !== void 0 ? _this$start : null,
        end: (_this$end = this.end) !== null && _this$end !== void 0 ? _this$end : null,
        period: (_this$statsPeriod = this.statsPeriod) !== null && _this$statsPeriod !== void 0 ? _this$statsPeriod : null,
        // TODO(tony) Add support for the Use UTC option from the global
        // headers, currently, that option is not supported and all times are
        // assumed to be UTC
        utc: true
      }
    };
  }

  getPageFiltersQuery() {
    const {
      environments: environment,
      projects,
      datetime: {
        start,
        end,
        period,
        utc
      }
    } = this.getPageFilters();
    return {
      project: projects.map(proj => proj.toString()),
      environment,
      utc: utc ? 'true' : 'false',
      // since these values are from `getGlobalSelection`
      // we know they have type `string | null`
      start: start !== null && start !== void 0 ? start : undefined,
      end: end !== null && end !== void 0 ? end : undefined,
      // we can't use the ?? operator here as we want to
      // convert the empty string to undefined
      statsPeriod: period ? period : undefined
    };
  }

  generateBlankQueryStringObject() {
    const output = {
      id: undefined,
      name: undefined,
      field: undefined,
      widths: undefined,
      sort: undefined,
      tag: undefined,
      query: undefined,
      yAxis: undefined,
      display: undefined,
      topEvents: undefined,
      interval: undefined
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      output[field] = undefined;
    }

    return output;
  }

  generateQueryStringObject() {
    const output = {
      id: this.id,
      name: this.name,
      field: this.getFields(),
      widths: this.getWidths(),
      sort: encodeSorts(this.sorts),
      environment: this.environment,
      project: this.project,
      query: this.query,
      yAxis: this.yAxis || this.getYAxis(),
      display: this.display,
      topEvents: this.topEvents,
      interval: this.interval
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }

    return lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(output);
  }

  isValid() {
    return this.fields.length > 0;
  }

  getWidths() {
    const result = this.fields.map(field => field.width ? field.width : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED);

    while (result.length > 0) {
      const width = result[result.length - 1];

      if (width === sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED) {
        result.pop();
        continue;
      }

      break;
    }

    return result;
  }

  getFields() {
    return this.fields.map(field => field.field);
  }

  getEquations() {
    return this.fields.filter(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation)(field.field)).map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getEquation)(field.field));
  }

  getAggregateFields() {
    return this.fields.filter(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isAggregateField)(field.field) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isAggregateEquation)(field.field));
  }

  hasAggregateField() {
    return this.fields.some(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isAggregateField)(field.field));
  }

  hasIdField() {
    return this.fields.some(field => field.field === 'id');
  }

  numOfColumns() {
    return this.fields.length;
  }

  getColumns(useFullEquationAsKey) {
    return (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_20__.decodeColumnOrder)(this.fields, useFullEquationAsKey);
  }

  getDays() {
    const statsPeriod = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(this.statsPeriod);
    return (0,_dates__WEBPACK_IMPORTED_MODULE_21__.statsPeriodToDays)(statsPeriod, this.start, this.end);
  }

  clone() {
    // NOTE: We rely on usage of Readonly from TypeScript to ensure we do not mutate
    //       the attributes of EventView directly. This enables us to quickly
    //       clone new instances of EventView.
    return new EventView({
      id: this.id,
      name: this.name,
      fields: this.fields,
      sorts: this.sorts,
      query: this.query,
      team: this.team,
      project: this.project,
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod,
      environment: this.environment,
      yAxis: this.yAxis,
      display: this.display,
      topEvents: this.topEvents,
      interval: this.interval,
      expired: this.expired,
      createdBy: this.createdBy,
      additionalConditions: this.additionalConditions.copy()
    });
  }

  withSorts(sorts) {
    const newEventView = this.clone();
    const fields = newEventView.fields.map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getAggregateAlias)(field.field));
    newEventView.sorts = sorts.filter(sort => fields.includes(sort.field));
    return newEventView;
  }

  withColumns(columns) {
    const newEventView = this.clone();
    const fields = columns.filter(col => (col.kind === 'field' || col.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_19__.FieldValueKind.EQUATION) && col.field || col.kind === 'function' && col.function[0]).map(col => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.generateFieldAsString)(col)).map((field, i) => {
      // newly added field
      if (!newEventView.fields[i]) {
        return {
          field,
          width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED
        };
      } // Existing columns that were not re ordered should retain
      // their old widths.


      const existing = newEventView.fields[i];
      const width = existing.field === field && existing.width !== undefined ? existing.width : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED;
      return {
        field,
        width
      };
    });
    newEventView.fields = fields; // Update sorts as sorted fields may have been removed.

    if (newEventView.sorts) {
      // Filter the sort fields down to those that are still selected.
      const sortKeys = fields.map(field => {
        var _fieldToSort;

        return (_fieldToSort = fieldToSort(field, undefined)) === null || _fieldToSort === void 0 ? void 0 : _fieldToSort.field;
      });
      const newSort = newEventView.sorts.filter(sort => sort && sortKeys.includes(sort.field)); // If the sort field was removed, try and find a new sortable column.

      if (newSort.length === 0) {
        const sortField = fields.find(field => isFieldSortable(field, undefined));

        if (sortField) {
          newSort.push({
            field: sortField.field,
            kind: 'desc'
          });
        }
      }

      newEventView.sorts = newSort;
    }

    newEventView.yAxis = newEventView.getYAxis();
    return newEventView;
  }

  withNewColumn(newColumn) {
    const fieldAsString = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.generateFieldAsString)(newColumn);
    const newField = {
      field: fieldAsString,
      width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED
    };
    const newEventView = this.clone();
    newEventView.fields = [...newEventView.fields, newField];
    return newEventView;
  }

  withResizedColumn(columnIndex, newWidth) {
    const field = this.fields[columnIndex];
    const newEventView = this.clone();

    if (!field) {
      return newEventView;
    }

    const updateWidth = field.width !== newWidth;

    if (updateWidth) {
      const fields = [...newEventView.fields];
      fields[columnIndex] = { ...field,
        width: newWidth
      };
      newEventView.fields = fields;
    }

    return newEventView;
  }

  withUpdatedColumn(columnIndex, updatedColumn, tableMeta) {
    const columnToBeUpdated = this.fields[columnIndex];
    const fieldAsString = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.generateFieldAsString)(updatedColumn);
    const updateField = columnToBeUpdated.field !== fieldAsString;

    if (!updateField) {
      return this;
    } // ensure tableMeta is non-empty


    tableMeta = validateTableMeta(tableMeta);
    const newEventView = this.clone();
    const updatedField = {
      field: fieldAsString,
      width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED
    };
    const fields = [...newEventView.fields];
    fields[columnIndex] = updatedField;
    newEventView.fields = fields; // if the updated column is one of the sorted columns, we may need to remove
    // it from the list of sorts

    const needleSortIndex = this.sorts.findIndex(sort => isSortEqualToField(sort, columnToBeUpdated, tableMeta));

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];
      const numOfColumns = this.fields.reduce((sum, currentField) => {
        if (isSortEqualToField(needleSort, currentField, tableMeta)) {
          return sum + 1;
        }

        return sum;
      }, 0); // do not bother deleting the sort key if there are more than one columns
      // of it in the table.

      if (numOfColumns <= 1) {
        if (isFieldSortable(updatedField, tableMeta)) {
          // use the current updated field as the sort key
          const sort = fieldToSort(updatedField, tableMeta); // preserve the sort kind

          sort.kind = needleSort.kind;
          const sorts = [...newEventView.sorts];
          sorts[needleSortIndex] = sort;
          newEventView.sorts = sorts;
        } else {
          const sorts = [...newEventView.sorts];
          sorts.splice(needleSortIndex, 1);
          newEventView.sorts = [...new Set(sorts)];
        }
      }

      if (newEventView.sorts.length <= 0 && newEventView.fields.length > 0) {
        // establish a default sort by finding the first sortable field
        if (isFieldSortable(updatedField, tableMeta)) {
          // use the current updated field as the sort key
          const sort = fieldToSort(updatedField, tableMeta); // preserve the sort kind

          sort.kind = needleSort.kind;
          newEventView.sorts = [sort];
        } else {
          const sortableFieldIndex = newEventView.fields.findIndex(currentField => isFieldSortable(currentField, tableMeta));

          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableMeta);
            newEventView.sorts = [sort];
          }
        }
      }
    }

    newEventView.yAxis = newEventView.getYAxis();
    return newEventView;
  }

  withDeletedColumn(columnIndex, tableMeta) {
    // Disallow removal of the orphan column, and check for out-of-bounds
    if (this.fields.length <= 1 || this.fields.length <= columnIndex || columnIndex < 0) {
      return this;
    } // ensure tableMeta is non-empty


    tableMeta = validateTableMeta(tableMeta); // delete the column

    const newEventView = this.clone();
    const fields = [...newEventView.fields];
    fields.splice(columnIndex, 1);
    newEventView.fields = fields; // Ensure there is at least one auto width column
    // To ensure a well formed table results.

    const hasAutoIndex = fields.find(field => field.width === sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED);

    if (!hasAutoIndex) {
      newEventView.fields[0].width = sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_11__.COL_WIDTH_UNDEFINED;
    } // if the deleted column is one of the sorted columns, we need to remove
    // it from the list of sorts


    const columnToBeDeleted = this.fields[columnIndex];
    const needleSortIndex = this.sorts.findIndex(sort => isSortEqualToField(sort, columnToBeDeleted, tableMeta));

    if (needleSortIndex >= 0) {
      const needleSort = this.sorts[needleSortIndex];
      const numOfColumns = this.fields.reduce((sum, field) => {
        if (isSortEqualToField(needleSort, field, tableMeta)) {
          return sum + 1;
        }

        return sum;
      }, 0); // do not bother deleting the sort key if there are more than one columns
      // of it in the table.

      if (numOfColumns <= 1) {
        const sorts = [...newEventView.sorts];
        sorts.splice(needleSortIndex, 1);
        newEventView.sorts = [...new Set(sorts)];

        if (newEventView.sorts.length <= 0 && newEventView.fields.length > 0) {
          // establish a default sort by finding the first sortable field
          const sortableFieldIndex = newEventView.fields.findIndex(field => isFieldSortable(field, tableMeta));

          if (sortableFieldIndex >= 0) {
            const fieldToBeSorted = newEventView.fields[sortableFieldIndex];
            const sort = fieldToSort(fieldToBeSorted, tableMeta);
            newEventView.sorts = [sort];
          }
        }
      }
    }

    newEventView.yAxis = newEventView.getYAxis();
    return newEventView;
  }

  withTeams(teams) {
    const newEventView = this.clone();
    newEventView.team = teams;
    return newEventView;
  }

  getSorts() {
    return this.sorts.map(sort => ({
      key: sort.field,
      order: sort.kind
    }));
  } // returns query input for the search


  getQuery(inputQuery) {
    const queryParts = [];

    if (this.query) {
      if (this.additionalConditions) {
        queryParts.push(this.getQueryWithAdditionalConditions());
      } else {
        queryParts.push(this.query);
      }
    }

    if (inputQuery) {
      // there may be duplicate query in the query string
      // e.g. query=hello&query=world
      if (Array.isArray(inputQuery)) {
        inputQuery.forEach(query => {
          if (typeof query === 'string' && !queryParts.includes(query)) {
            queryParts.push(query);
          }
        });
      }

      if (typeof inputQuery === 'string' && !queryParts.includes(inputQuery)) {
        queryParts.push(inputQuery);
      }
    }

    return queryParts.join(' ');
  }

  getFacetsAPIPayload(location) {
    const payload = this.getEventsAPIPayload(location);
    const remove = ['id', 'name', 'per_page', 'sort', 'cursor', 'field', 'equation', 'interval'];

    for (const key of remove) {
      delete payload[key];
    }

    return payload;
  }

  normalizeDateSelection(location) {
    const query = location && location.query || {}; // pick only the query strings that we care about

    const picked = pickRelevantLocationQueryStrings(location);
    const hasDateSelection = this.statsPeriod || this.start && this.end; // an eventview's date selection has higher precedence than the date selection in the query string

    const dateSelection = hasDateSelection ? {
      start: this.start,
      end: this.end,
      statsPeriod: this.statsPeriod
    } : {
      start: picked.start,
      end: picked.end,
      period: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(query.period),
      statsPeriod: picked.statsPeriod
    }; // normalize datetime selection

    return (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)({ ...dateSelection,
      utc: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(query.utc)
    });
  } // Takes an EventView instance and converts it into the format required for the events API


  getEventsAPIPayload(location, forceAppendRawQueryString) {
    // pick only the query strings that we care about
    const picked = pickRelevantLocationQueryStrings(location); // normalize datetime selection

    const normalizedTimeWindowParams = this.normalizeDateSelection(location);
    const sort = this.sorts.length <= 0 ? undefined : this.sorts.length > 1 ? encodeSorts(this.sorts) : encodeSort(this.sorts[0]);
    const fields = this.getFields();
    const team = this.team.map(proj => String(proj));
    const project = this.project.map(proj => String(proj));
    const environment = this.environment;
    let queryString = this.getQueryWithAdditionalConditions();

    if (forceAppendRawQueryString) {
      queryString += ' ' + forceAppendRawQueryString;
    } // generate event query


    const eventQuery = Object.assign(lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(picked, DATETIME_QUERY_STRING_KEYS), normalizedTimeWindowParams, {
      team,
      project,
      environment,
      field: [...new Set(fields)],
      sort,
      per_page: sentry_constants__WEBPACK_IMPORTED_MODULE_13__.DEFAULT_PER_PAGE,
      query: queryString
    });

    if (eventQuery.team && !eventQuery.team.length) {
      delete eventQuery.team;
    }

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  }

  getResultsViewUrlTarget(slug) {
    return {
      pathname: `/organizations/${slug}/discover/results/`,
      query: this.generateQueryStringObject()
    };
  }

  getResultsViewShortUrlTarget(slug) {
    const output = {
      id: this.id
    };

    for (const field of [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__.URL_PARAM), 'cursor']) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }

    return {
      pathname: `/organizations/${slug}/discover/results/`,
      query: lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(output)
    };
  }

  getPerformanceTransactionEventsViewUrlTarget(slug, options) {
    const {
      showTransactions,
      breakdown,
      webVital
    } = options;
    const output = {
      sort: encodeSorts(this.sorts),
      project: this.project,
      query: this.query,
      transaction: this.name,
      showTransactions,
      breakdown,
      webVital
    };

    for (const field of EXTERNAL_QUERY_STRING_KEYS) {
      if (this[field] && this[field].length) {
        output[field] = this[field];
      }
    }

    const query = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(output);
    return {
      pathname: `/organizations/${slug}/performance/summary/events/`,
      query
    };
  }

  sortForField(field, tableMeta) {
    if (!tableMeta) {
      return undefined;
    }

    return this.sorts.find(sort => isSortEqualToField(sort, field, tableMeta));
  }

  sortOnField(field, tableMeta, kind, useFunctionFormat) {
    // check if field can be sorted
    if (!isFieldSortable(field, tableMeta)) {
      return this;
    }

    const needleIndex = this.sorts.findIndex(sort => isSortEqualToField(sort, field, tableMeta));

    if (needleIndex >= 0) {
      const newEventView = this.clone();
      const currentSort = this.sorts[needleIndex];
      const sorts = [...newEventView.sorts];
      sorts[needleIndex] = kind ? setSortOrder({ ...currentSort,
        ...(useFunctionFormat ? {
          field: field.field
        } : {})
      }, kind) : reverseSort({ ...currentSort,
        ...(useFunctionFormat ? {
          field: field.field
        } : {})
      });
      newEventView.sorts = sorts;
      return newEventView;
    } // field is currently not sorted; so, we sort on it


    const newEventView = this.clone(); // invariant: this is not falsey, since sortKey exists

    const sort = fieldToSort(field, tableMeta, kind, useFunctionFormat);
    newEventView.sorts = [sort];
    return newEventView;
  }

  getYAxisOptions() {
    // Make option set and add the default options in.
    return lodash_uniqBy__WEBPACK_IMPORTED_MODULE_9___default()(this.getAggregateFields() // Only include aggregates that make sense to be graphable (eg. not string or date)
    .filter(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isLegalYAxisType)((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.aggregateOutputType)(field.field)) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isAggregateEquation)(field.field)).map(field => ({
      label: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation)(field.field) ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.getEquation)(field.field) : field.field,
      value: field.field
    })).concat(sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.CHART_AXIS_OPTIONS), 'value');
  }

  getYAxis() {
    const yAxisOptions = this.getYAxisOptions();
    const yAxis = this.yAxis;
    const defaultOption = yAxisOptions[0].value;

    if (!yAxis) {
      return defaultOption;
    } // ensure current selected yAxis is one of the items in yAxisOptions


    const result = yAxisOptions.findIndex(option => option.value === yAxis);

    if (result >= 0) {
      return yAxis;
    }

    return defaultOption;
  }

  getDisplayOptions() {
    return sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DISPLAY_MODE_OPTIONS.map(item => {
      if (item.value === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.PREVIOUS) {
        if (this.start || this.end) {
          return { ...item,
            disabled: true
          };
        }
      }

      if (item.value === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.TOP5 || item.value === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DAILYTOP5) {
        if (this.getAggregateFields().length === 0) {
          return { ...item,
            disabled: true,
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add a function that groups events to use this view.')
          };
        }
      }

      if (item.value === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DAILY || item.value === sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DAILYTOP5) {
        if (this.getDays() < 1) {
          return { ...item,
            disabled: true,
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Change the date rage to at least 1 day to use this view.')
          };
        }
      }

      return item;
    });
  }

  getDisplayMode() {
    var _this$display;

    const mode = (_this$display = this.display) !== null && _this$display !== void 0 ? _this$display : sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DEFAULT;
    const displayOptions = this.getDisplayOptions();
    let display = Object.values(sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes).includes(mode) ? mode : sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DEFAULT;

    const cond = option => option.value === display; // Just in case we define a fallback chain that results in an infinite loop.
    // The number 5 isn't anything special, its just larger than the longest fallback
    // chain that exists and isn't too big.


    for (let i = 0; i < 5; i++) {
      const selectedOption = displayOptions.find(cond);

      if (selectedOption && !selectedOption.disabled) {
        return display;
      }

      display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DISPLAY_MODE_FALLBACK_OPTIONS[display];
    } // after trying to find an enabled display mode and failing to find one,
    // we just use the default display mode


    return sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_17__.DisplayModes.DEFAULT;
  }

  getQueryWithAdditionalConditions() {
    const {
      query
    } = this;

    if (this.additionalConditions.isEmpty()) {
      return query;
    }

    const conditions = new _tokenizeSearch__WEBPACK_IMPORTED_MODULE_22__.MutableSearch(query);
    Object.entries(this.additionalConditions.filters).forEach(_ref => {
      let [tag, tagValues] = _ref;
      const existingTagValues = conditions.getFilterValues(tag);
      const newTagValues = tagValues.filter(tagValue => !existingTagValues.includes(tagValue));

      if (newTagValues.length) {
        conditions.addFilterValues(tag, newTagValues);
      }
    });
    return conditions.formatString();
  }

}

const isFieldsSimilar = (currentValue, otherValue) => {
  // For equation's their order matters because we alias them based on index
  const currentEquations = currentValue.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation);
  const otherEquations = otherValue.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation); // Field orders don't matter, so using a set for comparison

  const currentFields = new Set(currentValue.filter(value => !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation)(value)));
  const otherFields = new Set(otherValue.filter(value => !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.isEquation)(value)));

  if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentEquations, otherEquations)) {
    return false;
  }

  if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentFields, otherFields)) {
    return false;
  }

  return true;
};

const isAPIPayloadSimilar = (current, other) => {
  const currentKeys = new Set(Object.keys(current));
  const otherKeys = new Set(Object.keys(other));

  if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentKeys, otherKeys)) {
    return false;
  }

  for (const key of currentKeys) {
    const currentValue = current[key];
    const otherValue = other[key];

    if (key === 'field') {
      if (!isFieldsSimilar(currentValue, otherValue)) {
        return false;
      }
    } else {
      const currentTarget = Array.isArray(currentValue) ? new Set(currentValue) : currentValue;
      const otherTarget = Array.isArray(otherValue) ? new Set(otherValue) : otherValue;

      if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentTarget, otherTarget)) {
        return false;
      }
    }
  }

  return true;
};
function pickRelevantLocationQueryStrings(location) {
  const query = location.query || {};
  const picked = lodash_pick__WEBPACK_IMPORTED_MODULE_8___default()(query || {}, EXTERNAL_QUERY_STRING_KEYS);
  return picked;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventView);

/***/ }),

/***/ "./app/utils/discover/fieldRenderers.tsx":
/*!***********************************************!*\
  !*** ./app/utils/discover/fieldRenderers.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ABYTE_UNITS": () => (/* binding */ ABYTE_UNITS),
/* harmony export */   "DURATION_UNITS": () => (/* binding */ DURATION_UNITS),
/* harmony export */   "FIELD_FORMATTERS": () => (/* binding */ FIELD_FORMATTERS),
/* harmony export */   "PERCENTAGE_UNITS": () => (/* binding */ PERCENTAGE_UNITS),
/* harmony export */   "SIZE_UNITS": () => (/* binding */ SIZE_UNITS),
/* harmony export */   "getFieldFormatter": () => (/* binding */ getFieldFormatter),
/* harmony export */   "getFieldRenderer": () => (/* binding */ getFieldRenderer),
/* harmony export */   "getSortField": () => (/* binding */ getSortField),
/* harmony export */   "nullableValue": () => (/* binding */ nullableValue)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_partial__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/partial */ "../node_modules/lodash/partial.js");
/* harmony import */ var lodash_partial__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_partial__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/idBadge/userBadge */ "./app/components/idBadge/userBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowBar */ "./app/components/performance/waterfall/rowBar.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_userMisery__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/userMisery */ "./app/components/userMisery.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_filter__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _arrayValue__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./arrayValue */ "./app/utils/discover/arrayValue.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var _teamKeyTransactionField__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./teamKeyTransactionField */ "./app/utils/discover/teamKeyTransactionField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























/**
 * Types, functions and definitions for rendering fields in discover results.
 */




const EmptyValueContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ettn0cm3"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const emptyValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(EmptyValueContainer, {
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('(no value)')
});

const emptyStringValue = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(EmptyValueContainer, {
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('(empty string)')
});

function nullableValue(value) {
  switch (value) {
    case null:
      return emptyValue;

    case '':
      return emptyStringValue;

    default:
      return value;
  }
}
const SIZE_UNITS = {
  bit: 1 / 8,
  byte: 1,
  kibibyte: 1024,
  mebibyte: 1024 ** 2,
  gibibyte: 1024 ** 3,
  tebibyte: 1024 ** 4,
  pebibyte: 1024 ** 5,
  exbibyte: 1024 ** 6,
  kilobyte: 1000,
  megabyte: 1000 ** 2,
  gigabyte: 1000 ** 3,
  terabyte: 1000 ** 4,
  petabyte: 1000 ** 5,
  exabyte: 1000 ** 6
};
const ABYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte', 'exabyte'];
const DURATION_UNITS = {
  nanosecond: 1 / 1000 ** 2,
  microsecond: 1 / 1000,
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7
};
const PERCENTAGE_UNITS = ['ratio', 'percent'];
/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * and the field is not being coerced to a link.
 *
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */

const FIELD_FORMATTERS = {
  boolean: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = data[field] ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('true') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('false');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: value
      });
    }
  },
  date: {
    isSortable: true,
    renderFunc: (field, data) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
      children: data[field] ? (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_22__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.FieldDateTime, {
          date: data[field],
          year: true,
          seconds: true,
          timeZone: true
        }),
        fixed: 'timestamp'
      }) : emptyValue
    })
  },
  duration: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      var _ref;

      const {
        unit
      } = baggage !== null && baggage !== void 0 ? baggage : {};
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
        children: typeof data[field] === 'number' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_6__["default"], {
          seconds: data[field] * ((_ref = unit && DURATION_UNITS[unit]) !== null && _ref !== void 0 ? _ref : 1) / 1000,
          fixedDigits: 2,
          abbreviation: true
        }) : emptyValue
      });
    }
  },
  integer: {
    isSortable: true,
    renderFunc: (field, data) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
      children: typeof data[field] === 'number' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_5__["default"], {
        value: data[field]
      }) : emptyValue
    })
  },
  number: {
    isSortable: true,
    renderFunc: (field, data) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
      children: typeof data[field] === 'number' ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_21__.formatFloat)(data[field], 4) : emptyValue
    })
  },
  percentage: {
    isSortable: true,
    renderFunc: (field, data) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
      children: typeof data[field] === 'number' ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_21__.formatPercentage)(data[field]) : emptyValue
    })
  },
  size: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {
        unit
      } = baggage !== null && baggage !== void 0 ? baggage : {};
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
        children: unit && SIZE_UNITS[unit] && typeof data[field] === 'number' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_7__["default"], {
          bytes: data[field] * SIZE_UNITS[unit],
          base: ABYTE_UNITS.includes(unit) ? 10 : 2
        }) : emptyValue
      });
    }
  },
  string: {
    isSortable: true,
    renderFunc: (field, data) => {
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field]) ? data[field].slice(-1) : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.defined)(data[field]) ? data[field] : emptyValue;

      if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.isUrl)(value)) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: value,
            "data-test-id": "group-tag-url",
            children: value
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: nullableValue(value)
      });
    }
  },
  array: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = Array.isArray(data[field]) ? data[field] : [data[field]];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_arrayValue__WEBPACK_IMPORTED_MODULE_25__["default"], {
        value: value
      });
    }
  }
};

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS = {
  id: {
    sortField: 'id',
    renderFunc: data => {
      const id = data === null || data === void 0 ? void 0 : data.id;

      if (typeof id !== 'string') {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_20__.getShortEventId)(id)
      });
    }
  },
  trace: {
    sortField: 'trace',
    renderFunc: data => {
      const id = data === null || data === void 0 ? void 0 : data.trace;

      if (typeof id !== 'string') {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_20__.getShortEventId)(id)
      });
    }
  },
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, _ref2) => {
      let {
        organization
      } = _ref2;
      const target = {
        pathname: `/organizations/${organization.slug}/issues/${data['issue.id']}/`
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.OverflowLink, {
          to: target,
          "aria-label": data['issue.id'],
          children: data['issue.id']
        })
      });
    }
  },
  issue: {
    sortField: null,
    renderFunc: (data, _ref3) => {
      let {
        organization
      } = _ref3;
      const issueID = data['issue.id'];

      if (!issueID) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.FieldShortId, {
            shortId: `${data.issue}`
          })
        });
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.OverflowLink, {
          to: target,
          "aria-label": issueID,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.FieldShortId, {
            shortId: `${data.issue}`
          })
        })
      });
    }
  },
  project: {
    sortField: 'project',
    renderFunc: (data, _ref4) => {
      let {
        organization
      } = _ref4;
      let slugs = undefined;
      let projectIds = undefined;

      if (typeof data.project === 'number') {
        projectIds = [data.project];
      } else {
        slugs = [data.project];
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_23__["default"], {
          orgId: organization.slug,
          slugs: slugs,
          projectIds: projectIds,
          children: _ref5 => {
            let {
              projects
            } = _ref5;
            let project;

            if (typeof data.project === 'number') {
              project = projects.find(p => p.id === data.project.toString());
            } else {
              project = projects.find(p => p.slug === data.project);
            }

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
              project: project ? project : {
                slug: data.project
              },
              avatarSize: 16
            });
          }
        })
      });
    }
  },
  user: {
    sortField: 'user',
    renderFunc: data => {
      if (data.user) {
        const [key, value] = data.user.split(':');
        const userObj = {
          id: '',
          name: '',
          email: '',
          username: '',
          ip_address: ''
        };
        userObj[key] = value;

        const badge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
          user: userObj,
          hideEmail: true,
          avatarSize: 16
        });

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
          children: badge
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: emptyValue
      });
    }
  },
  'user.display': {
    sortField: 'user.display',
    renderFunc: data => {
      if (data['user.display']) {
        const userObj = {
          id: '',
          name: data['user.display'],
          email: '',
          username: '',
          ip_address: ''
        };

        const badge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
          user: userObj,
          hideEmail: true,
          avatarSize: 16
        });

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
          children: badge
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: emptyValue
      });
    }
  },
  'count_unique(user)': {
    sortField: 'count_unique(user)',
    renderFunc: data => {
      var _data$count_unique_us;

      const count = (_data$count_unique_us = data.count_unique_user) !== null && _data$count_unique_us !== void 0 ? _data$count_unique_us : data['count_unique(user)'];

      if (typeof count === 'number') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_26__.FlexContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_5__["default"], {
              value: count
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.UserIcon, {
            size: "20"
          })]
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: emptyValue
      });
    }
  },
  release: {
    sortField: 'release',
    renderFunc: data => data.release ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.VersionContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_15__["default"], {
        version: data.release,
        anchor: false,
        tooltipRawVersion: true,
        truncate: true
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
      children: emptyValue
    })
  },
  'error.handled': {
    sortField: 'error.handled',
    renderFunc: data => {
      const values = data['error.handled']; // Transactions will have null, and default events have no handled attributes.

      if (values === null || (values === null || values === void 0 ? void 0 : values.length) === 0) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
          children: emptyValue
        });
      }

      const value = Array.isArray(values) ? values : [values];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: value.every(v => [1, null].includes(v)) ? 'true' : 'false'
      });
    }
  },
  team_key_transaction: {
    sortField: null,
    renderFunc: (data, _ref6) => {
      var _data$team_key_transa;

      let {
        organization
      } = _ref6;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_teamKeyTransactionField__WEBPACK_IMPORTED_MODULE_27__["default"], {
          isKeyTransaction: ((_data$team_key_transa = data.team_key_transaction) !== null && _data$team_key_transa !== void 0 ? _data$team_key_transa : 0) !== 0,
          organization: organization,
          projectSlug: data.project,
          transactionName: data.transaction
        })
      });
    }
  },
  'trend_percentage()': {
    sortField: 'trend_percentage()',
    renderFunc: data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
      children: typeof data.trend_percentage === 'number' ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_21__.formatPercentage)(data.trend_percentage - 1) : emptyValue
    })
  },
  'timestamp.to_hour': {
    sortField: 'timestamp.to_hour',
    renderFunc: data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
      children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_22__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.FieldDateTime, {
          date: data['timestamp.to_hour'],
          year: true,
          timeZone: true
        }),
        fixed: 'timestamp.to_hour'
      })
    })
  },
  'timestamp.to_day': {
    sortField: 'timestamp.to_day',
    renderFunc: data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.Container, {
      children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_22__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.FieldDateTime, {
          date: data['timestamp.to_day'],
          dateOnly: true,
          year: true,
          utc: true
        }),
        fixed: 'timestamp.to_day'
      })
    })
  }
};

/**
 * "Special functions" are functions whose values either do not map 1:1 to a single column,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FUNCTIONS = {
  user_misery: fieldName => data => {
    var _userMiseryField$spli;

    const userMiseryField = fieldName;

    if (!(userMiseryField in data)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
        children: emptyValue
      });
    }

    const userMisery = data[userMiseryField];

    if (userMisery === null || isNaN(userMisery)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.NumberContainer, {
        children: emptyValue
      });
    }

    const projectThresholdConfig = 'project_threshold_config';
    let countMiserableUserField = '';
    let miseryLimit = parseInt(((_userMiseryField$spli = userMiseryField.split('(').pop()) === null || _userMiseryField$spli === void 0 ? void 0 : _userMiseryField$spli.slice(0, -1)) || '', 10);

    if (isNaN(miseryLimit)) {
      countMiserableUserField = 'count_miserable(user)';

      if (projectThresholdConfig in data) {
        miseryLimit = data[projectThresholdConfig][1];
      } else {
        miseryLimit = undefined;
      }
    } else {
      countMiserableUserField = `count_miserable(user,${miseryLimit})`;
    }

    const uniqueUsers = data['count_unique(user)'];
    let miserableUsers;

    if (countMiserableUserField in data) {
      var _userMiseryField$spli2;

      const countMiserableMiseryLimit = parseInt(((_userMiseryField$spli2 = userMiseryField.split('(').pop()) === null || _userMiseryField$spli2 === void 0 ? void 0 : _userMiseryField$spli2.slice(0, -1)) || '', 10);
      miserableUsers = countMiserableMiseryLimit === miseryLimit || isNaN(countMiserableMiseryLimit) && projectThresholdConfig ? data[countMiserableUserField] : undefined;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_26__.BarContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_userMisery__WEBPACK_IMPORTED_MODULE_14__["default"], {
        bars: 10,
        barHeight: 20,
        miseryLimit: miseryLimit,
        totalUsers: uniqueUsers,
        userMisery: userMisery,
        miserableUsers: miserableUsers
      })
    });
  }
};
/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */

function getSortField(field, tableMeta) {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].sortField;
  }

  if (!tableMeta) {
    return field;
  }

  if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.isEquation)(field)) {
    return field;
  }

  for (const alias in sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.AGGREGATIONS) {
    if (field.startsWith(alias)) {
      return sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.AGGREGATIONS[alias].isSortable ? field : null;
    }
  }

  const fieldType = tableMeta[field];

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return FIELD_FORMATTERS[fieldType].isSortable ? field : null;
  }

  return null;
}

const isDurationValue = (data, field) => {
  return field in data && typeof data[field] === 'number';
};

const spanOperationRelativeBreakdownRenderer = (data, _ref7) => {
  var _eventView$sorts, _eventView$sorts$;

  let {
    location,
    organization,
    eventView
  } = _ref7;
  const sumOfSpanTime = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS.reduce((prev, curr) => isDurationValue(data, curr) ? prev + data[curr] : prev, 0);
  const cumulativeSpanOpBreakdown = Math.max(sumOfSpanTime, data['transaction.duration']);

  if (sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS.every(field => !isDurationValue(data, field)) || cumulativeSpanOpBreakdown === 0) {
    return FIELD_FORMATTERS.duration.renderFunc(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_RELATIVE_BREAKDOWN_FIELD, data);
  }

  let otherPercentage = 1;
  let orderedSpanOpsBreakdownFields;
  const sortingOnField = eventView === null || eventView === void 0 ? void 0 : (_eventView$sorts = eventView.sorts) === null || _eventView$sorts === void 0 ? void 0 : (_eventView$sorts$ = _eventView$sorts[0]) === null || _eventView$sorts$ === void 0 ? void 0 : _eventView$sorts$.field;

  if (sortingOnField && sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS.includes(sortingOnField)) {
    orderedSpanOpsBreakdownFields = [sortingOnField, ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS.filter(op => op !== sortingOnField)];
  } else {
    orderedSpanOpsBreakdownFields = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(RelativeOpsBreakdown, {
    children: [orderedSpanOpsBreakdownFields.map(field => {
      var _getSpanOperationName;

      if (!isDurationValue(data, field)) {
        return null;
      }

      const operationName = (_getSpanOperationName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.getSpanOperationName)(field)) !== null && _getSpanOperationName !== void 0 ? _getSpanOperationName : 'op';
      const spanOpDuration = data[field];
      const widthPercentage = spanOpDuration / cumulativeSpanOpBreakdown;
      otherPercentage = otherPercentage - widthPercentage;

      if (widthPercentage === 0) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
        style: {
          width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_12__.toPercent)(widthPercentage || 0)
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
              children: operationName
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_6__["default"], {
                seconds: spanOpDuration / 1000,
                fixedDigits: 2,
                abbreviation: true
              })
            })]
          }),
          containerDisplayMode: "block",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(RectangleRelativeOpsBreakdown, {
            spanBarHatch: false,
            style: {
              backgroundColor: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_12__.pickBarColor)(operationName),
              cursor: 'pointer'
            },
            onClick: event => {
              event.stopPropagation();
              const filter = (0,sentry_views_performance_transactionSummary_filter__WEBPACK_IMPORTED_MODULE_24__.stringToFilter)(operationName);

              if (filter === sentry_views_performance_transactionSummary_filter__WEBPACK_IMPORTED_MODULE_24__.SpanOperationBreakdownFilter.None) {
                return;
              }

              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('performance_views.relative_breakdown.selection', {
                action: filter,
                organization
              });
              react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
                pathname: location.pathname,
                query: { ...location.query,
                  ...(0,sentry_views_performance_transactionSummary_filter__WEBPACK_IMPORTED_MODULE_24__.filterToLocationQuery)(filter)
                }
              });
            }
          })
        })
      }, operationName);
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
      style: {
        width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_12__.toPercent)(otherPercentage || 0)
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
        title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Other')
        }),
        containerDisplayMode: "block",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(OtherRelativeOpsBreakdown, {
          spanBarHatch: false
        })
      })
    }, "other")]
  });
};

spanOperationRelativeBreakdownRenderer.displayName = "spanOperationRelativeBreakdownRenderer";

const RelativeOpsBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ettn0cm2"
} : 0)( true ? {
  name: "8k1832",
  styles: "position:relative;display:flex"
} : 0);

const RectangleRelativeOpsBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_performance_waterfall_rowBar__WEBPACK_IMPORTED_MODULE_11__.RowRectangle,  true ? {
  target: "ettn0cm1"
} : 0)( true ? {
  name: "pw7jst",
  styles: "position:relative;width:100%"
} : 0);

const OtherRelativeOpsBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(RectangleRelativeOpsBreakdown,  true ? {
  target: "ettn0cm0"
} : 0)("background-color:", p => p.theme.gray100, ";" + ( true ? "" : 0));
/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @param {boolean} isAlias convert the name with getAggregateAlias
 * @returns {Function}
 */


function getFieldRenderer(field, meta) {
  let isAlias = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }

  if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.isRelativeSpanOperationBreakdownField)(field)) {
    return spanOperationRelativeBreakdownRenderer;
  }

  const fieldName = isAlias ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.getAggregateAlias)(field) : field;
  const fieldType = meta[fieldName];

  for (const alias in SPECIAL_FUNCTIONS) {
    if (fieldName.startsWith(alias)) {
      return SPECIAL_FUNCTIONS[alias](fieldName);
    }
  }

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return lodash_partial__WEBPACK_IMPORTED_MODULE_4___default()(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }

  return lodash_partial__WEBPACK_IMPORTED_MODULE_4___default()(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

/**
 * Get the field renderer for the named field only based on its type from the given
 * metadata.
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @param {boolean} isAlias convert the name with getAggregateAlias
 * @returns {Function}
 */
function getFieldFormatter(field, meta) {
  let isAlias = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  const fieldName = isAlias ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.getAggregateAlias)(field) : field;
  const fieldType = meta[fieldName];

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return lodash_partial__WEBPACK_IMPORTED_MODULE_4___default()(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }

  return lodash_partial__WEBPACK_IMPORTED_MODULE_4___default()(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

/***/ }),

/***/ "./app/utils/discover/fields.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/fields.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AGGREGATIONS": () => (/* binding */ AGGREGATIONS),
/* harmony export */   "ALIASES": () => (/* binding */ ALIASES),
/* harmony export */   "CALCULATED_FIELD_PREFIX": () => (/* binding */ CALCULATED_FIELD_PREFIX),
/* harmony export */   "DEPRECATED_FIELDS": () => (/* binding */ DEPRECATED_FIELDS),
/* harmony export */   "EQUATION_PREFIX": () => (/* binding */ EQUATION_PREFIX),
/* harmony export */   "FIELD_TAGS": () => (/* binding */ FIELD_TAGS),
/* harmony export */   "MEASUREMENT_PATTERN": () => (/* binding */ MEASUREMENT_PATTERN),
/* harmony export */   "SEMVER_TAGS": () => (/* binding */ SEMVER_TAGS),
/* harmony export */   "SPAN_OP_BREAKDOWN_FIELDS": () => (/* binding */ SPAN_OP_BREAKDOWN_FIELDS),
/* harmony export */   "SPAN_OP_BREAKDOWN_PATTERN": () => (/* binding */ SPAN_OP_BREAKDOWN_PATTERN),
/* harmony export */   "SPAN_OP_RELATIVE_BREAKDOWN_FIELD": () => (/* binding */ SPAN_OP_RELATIVE_BREAKDOWN_FIELD),
/* harmony export */   "TRACING_FIELDS": () => (/* binding */ TRACING_FIELDS),
/* harmony export */   "aggregateFunctionOutputType": () => (/* binding */ aggregateFunctionOutputType),
/* harmony export */   "aggregateMultiPlotType": () => (/* binding */ aggregateMultiPlotType),
/* harmony export */   "aggregateOutputType": () => (/* binding */ aggregateOutputType),
/* harmony export */   "errorsAndTransactionsAggregateFunctionOutputType": () => (/* binding */ errorsAndTransactionsAggregateFunctionOutputType),
/* harmony export */   "explodeField": () => (/* binding */ explodeField),
/* harmony export */   "explodeFieldString": () => (/* binding */ explodeFieldString),
/* harmony export */   "fieldAlignment": () => (/* binding */ fieldAlignment),
/* harmony export */   "formatTagKey": () => (/* binding */ formatTagKey),
/* harmony export */   "generateAggregateFields": () => (/* binding */ generateAggregateFields),
/* harmony export */   "generateFieldAsString": () => (/* binding */ generateFieldAsString),
/* harmony export */   "getAggregateAlias": () => (/* binding */ getAggregateAlias),
/* harmony export */   "getAggregateArg": () => (/* binding */ getAggregateArg),
/* harmony export */   "getAggregateFields": () => (/* binding */ getAggregateFields),
/* harmony export */   "getColumnType": () => (/* binding */ getColumnType),
/* harmony export */   "getColumnsAndAggregates": () => (/* binding */ getColumnsAndAggregates),
/* harmony export */   "getColumnsAndAggregatesAsStrings": () => (/* binding */ getColumnsAndAggregatesAsStrings),
/* harmony export */   "getEquation": () => (/* binding */ getEquation),
/* harmony export */   "getEquationAliasIndex": () => (/* binding */ getEquationAliasIndex),
/* harmony export */   "getMeasurementSlug": () => (/* binding */ getMeasurementSlug),
/* harmony export */   "getSpanOperationName": () => (/* binding */ getSpanOperationName),
/* harmony export */   "hasDuplicate": () => (/* binding */ hasDuplicate),
/* harmony export */   "isAggregateEquation": () => (/* binding */ isAggregateEquation),
/* harmony export */   "isAggregateField": () => (/* binding */ isAggregateField),
/* harmony export */   "isAggregateFieldOrEquation": () => (/* binding */ isAggregateFieldOrEquation),
/* harmony export */   "isDerivedMetric": () => (/* binding */ isDerivedMetric),
/* harmony export */   "isEquation": () => (/* binding */ isEquation),
/* harmony export */   "isEquationAlias": () => (/* binding */ isEquationAlias),
/* harmony export */   "isLegalEquationColumn": () => (/* binding */ isLegalEquationColumn),
/* harmony export */   "isLegalYAxisType": () => (/* binding */ isLegalYAxisType),
/* harmony export */   "isMeasurement": () => (/* binding */ isMeasurement),
/* harmony export */   "isNumericMetrics": () => (/* binding */ isNumericMetrics),
/* harmony export */   "isRelativeSpanOperationBreakdownField": () => (/* binding */ isRelativeSpanOperationBreakdownField),
/* harmony export */   "isSpanOperationBreakdownField": () => (/* binding */ isSpanOperationBreakdownField),
/* harmony export */   "maybeEquationAlias": () => (/* binding */ maybeEquationAlias),
/* harmony export */   "measurementType": () => (/* binding */ measurementType),
/* harmony export */   "parseArguments": () => (/* binding */ parseArguments),
/* harmony export */   "parseFunction": () => (/* binding */ parseFunction),
/* harmony export */   "sessionsAggregateFunctionOutputType": () => (/* binding */ sessionsAggregateFunctionOutputType),
/* harmony export */   "stripDerivedMetricsPrefix": () => (/* binding */ stripDerivedMetricsPrefix),
/* harmony export */   "stripEquationPrefix": () => (/* binding */ stripEquationPrefix)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_types_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/types/utils */ "./app/types/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _fields__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../fields */ "./app/utils/fields/index.ts");








const CONDITIONS_ARGUMENTS = [{
  label: 'is equal to',
  value: 'equals'
}, {
  label: 'is not equal to',
  value: 'notEquals'
}, {
  label: 'is less than',
  value: 'less'
}, {
  label: 'is greater than',
  value: 'greater'
}, {
  label: 'is less than or equal to',
  value: 'lessOrEquals'
}, {
  label: 'is greater than or equal to',
  value: 'greaterOrEquals'
}];
const WEB_VITALS_QUALITY = [{
  label: 'good',
  value: 'good'
}, {
  label: 'meh',
  value: 'meh'
}, {
  label: 'poor',
  value: 'poor'
}, {
  label: 'any',
  value: 'any'
}];

const getDocsAndOutputType = key => {
  return {
    documentation: _fields__WEBPACK_IMPORTED_MODULE_7__.AGGREGATION_FIELDS[key].desc,
    outputType: _fields__WEBPACK_IMPORTED_MODULE_7__.AGGREGATION_FIELDS[key].valueType
  };
}; // Refer to src/sentry/search/events/fields.py
// Try to keep functions logically sorted, ie. all the count functions are grouped together


const AGGREGATIONS = {
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Count]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Count),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountUnique]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountUnique),
    parameters: [{
      kind: 'column',
      columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
      defaultValue: 'user',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountMiserable]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountMiserable),

    getFieldOverrides(_ref) {
      let {
        parameter
      } = _ref;

      if (parameter.kind === 'column') {
        return {
          defaultValue: 'user'
        };
      }

      return {
        defaultValue: parameter.defaultValue
      };
    },

    parameters: [{
      kind: 'column',
      columnTypes: validateAllowedColumns(['user']),
      defaultValue: 'user',
      required: true
    }, {
      kind: 'value',
      dataType: 'number',
      defaultValue: '300',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountIf]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountIf),
    parameters: [{
      kind: 'column',
      columnTypes: validateDenyListColumns(['string', 'duration', 'number'], ['id', 'issue', 'user.display']),
      defaultValue: 'transaction.duration',
      required: true
    }, {
      kind: 'dropdown',
      options: CONDITIONS_ARGUMENTS,
      dataType: 'string',
      defaultValue: CONDITIONS_ARGUMENTS[0].value,
      required: true
    }, {
      kind: 'value',
      dataType: 'string',
      defaultValue: '300',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountWebVitals]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountWebVitals),
    parameters: [{
      kind: 'column',
      columnTypes: validateAllowedColumns([_fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP, _fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FP, _fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FCP, _fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.FID, _fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.CLS]),
      defaultValue: _fields__WEBPACK_IMPORTED_MODULE_7__.WebVital.LCP,
      required: true
    }, {
      kind: 'dropdown',
      options: WEB_VITALS_QUALITY,
      dataType: 'string',
      defaultValue: WEB_VITALS_QUALITY[0].value,
      required: true
    }],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Eps]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Eps),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Epm]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Epm),
    parameters: [],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.FailureCount]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.FailureCount),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Min]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Min),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['integer', 'number', 'duration', 'date', 'percentage']),
      defaultValue: 'transaction.duration',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Max]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Max),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['integer', 'number', 'duration', 'date', 'percentage']),
      defaultValue: 'transaction.duration',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Sum]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Sum),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      required: true,
      defaultValue: 'transaction.duration'
    }],
    isSortable: true,
    multiPlotType: 'area'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Any]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Any),
    parameters: [{
      kind: 'column',
      columnTypes: ['string', 'integer', 'number', 'duration', 'date', 'boolean'],
      required: true,
      defaultValue: 'transaction.duration'
    }],
    isSortable: true
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P50]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P50),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: false
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P75]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P75),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: false
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P95]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P95),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: false
    }],
    type: [],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P99]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P99),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: false
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P100]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P100),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: false
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Percentile]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Percentile),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: true
    }, {
      kind: 'value',
      dataType: 'number',
      defaultValue: '0.5',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Avg]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Avg),
    parameters: [{
      kind: 'column',
      columnTypes: validateForNumericAggregate(['duration', 'number', 'percentage']),
      defaultValue: 'transaction.duration',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Apdex]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Apdex),
    parameters: [{
      kind: 'value',
      dataType: 'number',
      defaultValue: '300',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.UserMisery]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.UserMisery),
    parameters: [{
      kind: 'value',
      dataType: 'number',
      defaultValue: '300',
      required: true
    }],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.FailureRate]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.FailureRate),
    parameters: [],
    isSortable: true,
    multiPlotType: 'line'
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.LastSeen]: { ...getDocsAndOutputType(_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.LastSeen),
    parameters: [],
    isSortable: true
  }
}; // TPM and TPS are aliases that are only used in Performance

const ALIASES = {
  tpm: _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Epm,
  tps: _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Eps
};
(0,sentry_types_utils__WEBPACK_IMPORTED_MODULE_5__.assert)(AGGREGATIONS);
const DEPRECATED_FIELDS = [_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.CULPRIT];
const FIELD_TAGS = Object.freeze(Object.fromEntries(_fields__WEBPACK_IMPORTED_MODULE_7__.DISCOVER_FIELDS.map(item => [item, {
  key: item,
  name: item
}])));
const SEMVER_TAGS = {
  [_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_VERSION]: {
    key: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_VERSION,
    name: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_VERSION
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_BUILD]: {
    key: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_BUILD,
    name: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_BUILD
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_PACKAGE]: {
    key: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_PACKAGE,
    name: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_PACKAGE
  },
  [_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_STAGE]: {
    key: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_STAGE,
    name: _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.RELEASE_STAGE,
    predefined: true,
    values: sentry_constants__WEBPACK_IMPORTED_MODULE_4__.RELEASE_ADOPTION_STAGES
  }
};
/**
 * Some tag keys should never be formatted as `tag[...]`
 * when used as a filter because they are predefined.
 */

const EXCLUDED_TAG_KEYS = new Set(['release']);
function formatTagKey(key) {
  // Some tags may be normalized from context, but not all of them are.
  // This supports a user making a custom tag with the same name as one
  // that comes from context as all of these are also tags.
  if (key in FIELD_TAGS && !EXCLUDED_TAG_KEYS.has(key)) {
    return `tags[${key}]`;
  }

  return key;
} // Allows for a less strict field key definition in cases we are returning custom strings as fields

function isSpanOperationBreakdownField(field) {
  return field.startsWith('spans.');
}
const SPAN_OP_RELATIVE_BREAKDOWN_FIELD = 'span_ops_breakdown.relative';
function isRelativeSpanOperationBreakdownField(field) {
  return field === SPAN_OP_RELATIVE_BREAKDOWN_FIELD;
}
const SPAN_OP_BREAKDOWN_FIELDS = Object.values(_fields__WEBPACK_IMPORTED_MODULE_7__.SpanOpBreakdown); // This list contains fields/functions that are available with performance-view feature.

const TRACING_FIELDS = [_fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Avg, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Sum, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.TRANSACTION_DURATION, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.TRANSACTION_OP, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.TRANSACTION_STATUS, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P50, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P75, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P95, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P99, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.P100, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Percentile, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.FailureRate, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Apdex, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.CountMiserable, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.UserMisery, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Eps, _fields__WEBPACK_IMPORTED_MODULE_7__.AggregationKey.Epm, 'team_key_transaction', ...Object.keys(_fields__WEBPACK_IMPORTED_MODULE_7__.MEASUREMENT_FIELDS), ...SPAN_OP_BREAKDOWN_FIELDS, SPAN_OP_RELATIVE_BREAKDOWN_FIELD];
const MEASUREMENT_PATTERN = /^measurements\.([a-zA-Z0-9-_.]+)$/;
const SPAN_OP_BREAKDOWN_PATTERN = /^spans\.([a-zA-Z0-9-_.]+)$/;
function isMeasurement(field) {
  const results = field.match(MEASUREMENT_PATTERN);
  return !!results;
}
function measurementType(field) {
  if (_fields__WEBPACK_IMPORTED_MODULE_7__.MEASUREMENT_FIELDS.hasOwnProperty(field)) {
    return _fields__WEBPACK_IMPORTED_MODULE_7__.MEASUREMENT_FIELDS[field].valueType;
  }

  return _fields__WEBPACK_IMPORTED_MODULE_7__.FieldValueType.NUMBER;
}
function getMeasurementSlug(field) {
  const results = field.match(MEASUREMENT_PATTERN);

  if (results && results.length >= 2) {
    return results[1];
  }

  return null;
}
const AGGREGATE_PATTERN = /^(\w+)\((.*)?\)$/; // Identical to AGGREGATE_PATTERN, but without the $ for newline, or ^ for start of line

const AGGREGATE_BASE = /(\w+)\((.*)?\)/g;
function getAggregateArg(field) {
  // only returns the first argument if field is an aggregate
  const result = parseFunction(field);

  if (result && result.arguments.length > 0) {
    return result.arguments[0];
  }

  return null;
}
function parseFunction(field) {
  const results = field.match(AGGREGATE_PATTERN);

  if (results && results.length === 3) {
    return {
      name: results[1],
      arguments: parseArguments(results[1], results[2])
    };
  }

  return null;
}
function parseArguments(functionText, columnText) {
  // Some functions take a quoted string for their arguments that may contain commas
  // This function attempts to be identical with the similarly named parse_arguments
  // found in src/sentry/search/events/fields.py
  if (functionText !== 'to_other' && functionText !== 'count_if' && functionText !== 'spans_histogram' || columnText.length === 0) {
    return columnText ? columnText.split(',').map(result => result.trim()) : [];
  }

  const args = [];
  let quoted = false;
  let escaped = false;
  let i = 0;
  let j = 0;

  while (j < columnText.length) {
    if (i === j && columnText[j] === '"') {
      // when we see a quote at the beginning of
      // an argument, then this is a quoted string
      quoted = true;
    } else if (i === j && columnText[j] === ' ') {
      // argument has leading spaces, skip over them
      i += 1;
    } else if (quoted && !escaped && columnText[j] === '\\') {
      // when we see a slash inside a quoted string,
      // the next character is an escape character
      escaped = true;
    } else if (quoted && !escaped && columnText[j] === '"') {
      // when we see a non-escaped quote while inside
      // of a quoted string, we should end it
      quoted = false;
    } else if (quoted && escaped) {
      // when we are inside a quoted string and have
      // begun an escape character, we should end it
      escaped = false;
    } else if (quoted && columnText[j] === ',') {// when we are inside a quoted string and see
      // a comma, it should not be considered an
      // argument separator
    } else if (columnText[j] === ',') {
      // when we see a comma outside of a quoted string
      // it is an argument separator
      args.push(columnText.substring(i, j).trim());
      i = j + 1;
    }

    j += 1;
  }

  if (i !== j) {
    // add in the last argument if any
    args.push(columnText.substring(i).trim());
  }

  return args;
} // `|` is an invalid field character, so it is used to determine whether a field is an equation or not

const EQUATION_PREFIX = 'equation|';
const EQUATION_ALIAS_PATTERN = /^equation\[(\d+)\]$/;
const CALCULATED_FIELD_PREFIX = 'calculated|';
function isEquation(field) {
  return field.startsWith(EQUATION_PREFIX);
}
function isEquationAlias(field) {
  return EQUATION_ALIAS_PATTERN.test(field);
}
function maybeEquationAlias(field) {
  return field.includes(EQUATION_PREFIX);
}
function stripEquationPrefix(field) {
  return field.replace(EQUATION_PREFIX, '');
}
function getEquationAliasIndex(field) {
  const results = field.match(EQUATION_ALIAS_PATTERN);

  if (results && results.length === 2) {
    return parseInt(results[1], 10);
  }

  return -1;
}
function getEquation(field) {
  return field.slice(EQUATION_PREFIX.length);
}
function isAggregateEquation(field) {
  const results = field.match(AGGREGATE_BASE);
  return isEquation(field) && results !== null && results.length > 0;
}
function isLegalEquationColumn(column) {
  // Any isn't allowed in arithmetic
  if (column.kind === 'function' && column.function[0] === 'any') {
    return false;
  }

  const columnType = getColumnType(column);
  return columnType === 'number' || columnType === 'integer' || columnType === 'duration';
}
function generateAggregateFields(organization, eventFields) {
  let excludeFields = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  const functions = Object.keys(AGGREGATIONS);
  const fields = Object.values(eventFields).map(field => field.field);
  functions.forEach(func => {
    const parameters = AGGREGATIONS[func].parameters.map(param => {
      const overrides = AGGREGATIONS[func].getFieldOverrides;

      if (typeof overrides === 'undefined') {
        return param;
      }

      return { ...param,
        ...overrides({
          parameter: param,
          organization
        })
      };
    });

    if (parameters.every(param => typeof param.defaultValue !== 'undefined')) {
      const newField = `${func}(${parameters.map(param => param.defaultValue).join(',')})`;

      if (fields.indexOf(newField) === -1 && excludeFields.indexOf(newField) === -1) {
        fields.push(newField);
      }
    }
  });
  return fields.map(field => ({
    field
  }));
}
function isDerivedMetric(field) {
  return field.startsWith(CALCULATED_FIELD_PREFIX);
}
function stripDerivedMetricsPrefix(field) {
  return field.replace(CALCULATED_FIELD_PREFIX, '');
}
function explodeFieldString(field, alias) {
  if (isEquation(field)) {
    return {
      kind: 'equation',
      field: getEquation(field),
      alias
    };
  }

  if (isDerivedMetric(field)) {
    return {
      kind: 'calculatedField',
      field: stripDerivedMetricsPrefix(field),
      alias
    };
  }

  const results = parseFunction(field);

  if (results) {
    var _results$arguments$;

    return {
      kind: 'function',
      function: [results.name, (_results$arguments$ = results.arguments[0]) !== null && _results$arguments$ !== void 0 ? _results$arguments$ : '', results.arguments[1], results.arguments[2]],
      alias
    };
  }

  return {
    kind: 'field',
    field,
    alias
  };
}
function generateFieldAsString(value) {
  if (value.kind === 'field') {
    return value.field;
  }

  if (value.kind === 'calculatedField') {
    return `${CALCULATED_FIELD_PREFIX}${value.field}`;
  }

  if (value.kind === 'equation') {
    return `${EQUATION_PREFIX}${value.field}`;
  }

  const aggregation = value.function[0];
  const parameters = value.function.slice(1).filter(i => i);
  return `${aggregation}(${parameters.join(',')})`;
}
function explodeField(field) {
  return explodeFieldString(field.field, field.alias);
}
/**
 * Get the alias that the API results will have for a given aggregate function name
 */

function getAggregateAlias(field) {
  const result = parseFunction(field);

  if (!result) {
    return field;
  }

  let alias = result.name;

  if (result.arguments.length > 0) {
    alias += '_' + result.arguments.join('_');
  }

  return alias.replace(/[^\w]/g, '_').replace(/^_+/g, '').replace(/_+$/, '');
}
/**
 * Check if a field name looks like an aggregate function or known aggregate alias.
 */

function isAggregateField(field) {
  return parseFunction(field) !== null;
}
function isAggregateFieldOrEquation(field) {
  return isAggregateField(field) || isAggregateEquation(field) || isNumericMetrics(field);
}
/**
 * Temporary hardcoded hack to enable testing derived metrics.
 * Can be removed after we get rid of getAggregateFields
 */

function isNumericMetrics(field) {
  return ['session.crash_free_rate', 'session.crashed', 'session.errored_preaggregated', 'session.errored_set', 'session.init'].includes(field);
}
function getAggregateFields(fields) {
  return fields.filter(field => isAggregateField(field) || isAggregateEquation(field) || isNumericMetrics(field));
}
function getColumnsAndAggregates(fields) {
  const aggregates = getAggregateFields(fields);
  const columns = fields.filter(field => !!!aggregates.includes(field));
  return {
    columns,
    aggregates
  };
}
function getColumnsAndAggregatesAsStrings(fields) {
  // TODO(dam): distinguish between metrics, derived metrics and tags
  const aggregateFields = [];
  const nonAggregateFields = [];
  const fieldAliases = [];

  for (const field of fields) {
    var _field$alias;

    const fieldString = generateFieldAsString(field);

    if (field.kind === 'function' || field.kind === 'calculatedField') {
      aggregateFields.push(fieldString);
    } else if (field.kind === 'equation') {
      if (isAggregateEquation(fieldString)) {
        aggregateFields.push(fieldString);
      } else {
        nonAggregateFields.push(fieldString);
      }
    } else {
      nonAggregateFields.push(fieldString);
    }

    fieldAliases.push((_field$alias = field.alias) !== null && _field$alias !== void 0 ? _field$alias : '');
  }

  return {
    aggregates: aggregateFields,
    columns: nonAggregateFields,
    fieldAliases
  };
}
/**
 * Convert a function string into type it will output.
 * This is useful when you need to format values in tooltips,
 * or in series markers.
 */

function aggregateOutputType(field) {
  if (!field) {
    return 'number';
  }

  const result = parseFunction(field);

  if (!result) {
    return 'number';
  }

  const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);

  if (outputType === null) {
    return 'number';
  }

  return outputType;
}
/**
 * Converts a function string and its first argument into its output type.
 * - If the function has a fixed output type, that will be the result.
 * - If the function does not define an output type, the output type will be equal to
 *   the type of its first argument.
 * - If the function has an optional first argument, and it was not defined, make sure
 *   to use the default argument as the first argument.
 * - If the type could not be determined, return null.
 */

function aggregateFunctionOutputType(funcName, firstArg) {
  var _AGGREGATIONS, _aggregate$parameters;

  const aggregate = (_AGGREGATIONS = AGGREGATIONS[ALIASES[funcName] || funcName]) !== null && _AGGREGATIONS !== void 0 ? _AGGREGATIONS : sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_OPERATIONS[funcName]; // Attempt to use the function's outputType.

  if (aggregate !== null && aggregate !== void 0 && aggregate.outputType) {
    return aggregate.outputType;
  } // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.


  if (!firstArg && aggregate !== null && aggregate !== void 0 && (_aggregate$parameters = aggregate.parameters) !== null && _aggregate$parameters !== void 0 && _aggregate$parameters[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  }

  if (firstArg && sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_FIELDS.hasOwnProperty(firstArg)) {
    return sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_FIELDS[firstArg].type;
  } // If the function is an inherit type it will have a field as
  // the first parameter and we can use that to get the type.


  if (firstArg && _fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS.hasOwnProperty(firstArg)) {
    return _fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS[firstArg].valueType;
  }

  if (firstArg && isMeasurement(firstArg)) {
    return measurementType(firstArg);
  }

  if (firstArg && isSpanOperationBreakdownField(firstArg)) {
    return 'duration';
  }

  return null;
}
function errorsAndTransactionsAggregateFunctionOutputType(funcName, firstArg) {
  var _aggregate$parameters2;

  const aggregate = AGGREGATIONS[ALIASES[funcName] || funcName]; // Attempt to use the function's outputType.

  if (aggregate !== null && aggregate !== void 0 && aggregate.outputType) {
    return aggregate.outputType;
  } // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.


  if (!firstArg && aggregate !== null && aggregate !== void 0 && (_aggregate$parameters2 = aggregate.parameters) !== null && _aggregate$parameters2 !== void 0 && _aggregate$parameters2[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  } // If the function is an inherit type it will have a field as
  // the first parameter and we can use that to get the type.


  if (firstArg && _fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS.hasOwnProperty(firstArg)) {
    return _fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS[firstArg].valueType;
  }

  if (firstArg && isMeasurement(firstArg)) {
    return measurementType(firstArg);
  }

  if (firstArg && isSpanOperationBreakdownField(firstArg)) {
    return 'duration';
  }

  return null;
}
function sessionsAggregateFunctionOutputType(funcName, firstArg) {
  var _aggregate$parameters3;

  const aggregate = sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_OPERATIONS[funcName]; // Attempt to use the function's outputType.

  if (aggregate !== null && aggregate !== void 0 && aggregate.outputType) {
    return aggregate.outputType;
  } // If the first argument is undefined and it is not required,
  // then we attempt to get the default value.


  if (!firstArg && aggregate !== null && aggregate !== void 0 && (_aggregate$parameters3 = aggregate.parameters) !== null && _aggregate$parameters3 !== void 0 && _aggregate$parameters3[0]) {
    if (aggregate.parameters[0].required === false) {
      firstArg = aggregate.parameters[0].defaultValue;
    }
  }

  if (firstArg && sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_FIELDS.hasOwnProperty(firstArg)) {
    return sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_6__.SESSIONS_FIELDS[firstArg].type;
  }

  return null;
}
/**
 * Get the multi-series chart type for an aggregate function.
 */

function aggregateMultiPlotType(field) {
  if (isEquation(field)) {
    return 'line';
  }

  const result = parseFunction(field); // Handle invalid data.

  if (!result) {
    return 'area';
  }

  if (!AGGREGATIONS.hasOwnProperty(result.name)) {
    return 'area';
  }

  return AGGREGATIONS[result.name].multiPlotType;
}

function validateForNumericAggregate(validColumnTypes) {
  return function (_ref2) {
    let {
      name,
      dataType
    } = _ref2;

    // these built-in columns cannot be applied to numeric aggregates such as percentile(...)
    if ([_fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.DEVICE_BATTERY_LEVEL, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.STACK_COLNO, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.STACK_LINENO, _fields__WEBPACK_IMPORTED_MODULE_7__.FieldKey.STACK_STACK_LEVEL].includes(name)) {
      return false;
    }

    return validColumnTypes.includes(dataType);
  };
}

function validateDenyListColumns(validColumnTypes, deniedColumns) {
  return function (_ref3) {
    let {
      name,
      dataType
    } = _ref3;
    return validColumnTypes.includes(dataType) && !deniedColumns.includes(name);
  };
}

function validateAllowedColumns(validColumns) {
  return function (_ref4) {
    let {
      name
    } = _ref4;
    return validColumns.includes(name);
  };
}

const alignedTypes = ['number', 'duration', 'integer', 'percentage'];
function fieldAlignment(columnName, columnType, metadata) {
  let align = 'left';

  if (columnType) {
    align = alignedTypes.includes(columnType) ? 'right' : 'left';
  }

  if (columnType === undefined || columnType === 'never') {
    // fallback to align the column based on the table metadata
    const maybeType = metadata ? metadata[getAggregateAlias(columnName)] : undefined;

    if (maybeType !== undefined && alignedTypes.includes(maybeType)) {
      align = 'right';
    }
  }

  return align;
}
/**
 * Match on types that are legal to show on a timeseries chart.
 */

function isLegalYAxisType(match) {
  return ['number', 'integer', 'duration', 'percentage'].includes(match);
}
function getSpanOperationName(field) {
  const results = field.match(SPAN_OP_BREAKDOWN_PATTERN);

  if (results && results.length >= 2) {
    return results[1];
  }

  return null;
}
function getColumnType(column) {
  if (column.kind === 'function') {
    const outputType = aggregateFunctionOutputType(column.function[0], column.function[1]);

    if (outputType !== null) {
      return outputType;
    }
  } else if (column.kind === 'field') {
    if (_fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS.hasOwnProperty(column.field)) {
      return _fields__WEBPACK_IMPORTED_MODULE_7__.FIELDS[column.field].valueType;
    }

    if (isMeasurement(column.field)) {
      return measurementType(column.field);
    }

    if (isSpanOperationBreakdownField(column.field)) {
      return 'duration';
    }
  }

  return 'string';
}
function hasDuplicate(columnList, column) {
  if (column.kind !== 'function' && column.kind !== 'field') {
    return false;
  }

  return columnList.filter(newColumn => lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(newColumn, column)).length > 1;
}

/***/ }),

/***/ "./app/utils/discover/styles.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/styles.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActorContainer": () => (/* binding */ ActorContainer),
/* harmony export */   "BarContainer": () => (/* binding */ BarContainer),
/* harmony export */   "Container": () => (/* binding */ Container),
/* harmony export */   "FieldDateTime": () => (/* binding */ FieldDateTime),
/* harmony export */   "FieldShortId": () => (/* binding */ FieldShortId),
/* harmony export */   "FlexContainer": () => (/* binding */ FlexContainer),
/* harmony export */   "NumberContainer": () => (/* binding */ NumberContainer),
/* harmony export */   "OverflowLink": () => (/* binding */ OverflowLink),
/* harmony export */   "UserIcon": () => (/* binding */ UserIcon),
/* harmony export */   "VersionContainer": () => (/* binding */ VersionContainer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_shortId__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/shortId */ "./app/components/shortId.tsx");
/* harmony import */ var sentry_icons_iconUser__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons/iconUser */ "./app/icons/iconUser.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





 // Styled components used to render discover result sets.

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif39"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));
const VersionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif38"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);
const NumberContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif37"
} : 0)("text-align:right;font-variant-numeric:tabular-nums;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));
const FieldDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "ej0iif36"
} : 0)("color:", p => p.theme.gray300, ";font-variant-numeric:tabular-nums;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));
const OverflowLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "ej0iif35"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));
const FieldShortId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_shortId__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "ej0iif34"
} : 0)( true ? {
  name: "1rg9myb",
  styles: "justify-content:flex-start;display:block"
} : 0);
const BarContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif33"
} : 0)( true ? {
  name: "1h1hi12",
  styles: "max-width:80px;margin-left:auto"
} : 0);
const FlexContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif32"
} : 0)( true ? {
  name: "c4ysgb",
  styles: "display:flex;align-items:center;justify-content:flex-end;width:100%"
} : 0);
const UserIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons_iconUser__WEBPACK_IMPORTED_MODULE_4__.IconUser,  true ? {
  target: "ej0iif31"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";color:", p => p.theme.gray400, ";" + ( true ? "" : 0));
const ActorContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ej0iif30"
} : 0)( true ? {
  name: "azw8yl",
  styles: "display:flex;justify-content:center;:hover{cursor:default;}"
} : 0);

/***/ }),

/***/ "./app/utils/discover/teamKeyTransactionField.tsx":
/*!********************************************************!*\
  !*** ./app/utils/discover/teamKeyTransactionField.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransaction__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransaction */ "./app/components/performance/teamKeyTransaction.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransactionsManager */ "./app/components/performance/teamKeyTransactionsManager.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class TitleStar extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    var _ref, _keyedTeams$length;

    const {
      isOpen,
      keyedTeams,
      initialValue,
      ...props
    } = this.props;
    const keyedTeamsCount = (_ref = (_keyedTeams$length = keyedTeams === null || keyedTeams === void 0 ? void 0 : keyedTeams.length) !== null && _keyedTeams$length !== void 0 ? _keyedTeams$length : initialValue) !== null && _ref !== void 0 ? _ref : 0;

    const star = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconStar, {
      color: keyedTeamsCount ? 'yellow300' : 'gray200',
      isSolid: keyedTeamsCount > 0,
      "data-test-id": "team-key-transaction-column"
    });

    const button = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
      icon: star,
      borderless: true,
      size: "zero",
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Toggle star for team')
    });

    if (!isOpen && keyedTeams !== null && keyedTeams !== void 0 && keyedTeams.length) {
      const teamSlugs = keyedTeams.map(_ref2 => {
        let {
          slug
        } = _ref2;
        return slug;
      }).join(', ');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
        title: teamSlugs,
        children: button
      });
    }

    return button;
  }

}

TitleStar.displayName = "TitleStar";

function TeamKeyTransactionField(_ref3) {
  let {
    isKeyTransaction,
    counts,
    getKeyedTeams,
    project,
    transactionName,
    ...props
  } = _ref3;
  const keyedTeams = getKeyedTeams(project.id, transactionName);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_performance_teamKeyTransaction__WEBPACK_IMPORTED_MODULE_2__["default"], {
    counts: counts,
    keyedTeams: keyedTeams,
    title: TitleStar,
    project: project,
    transactionName: transactionName,
    initialValue: Number(isKeyTransaction),
    ...props
  });
}

TeamKeyTransactionField.displayName = "TeamKeyTransactionField";

function TeamKeyTransactionFieldWrapper(_ref4) {
  let {
    isKeyTransaction,
    projects,
    projectSlug,
    transactionName,
    ...props
  } = _ref4;
  const project = projects.find(proj => proj.slug === projectSlug); // All these fields need to be defined in order to toggle a team key
  // transaction. Since they are not defined, just render a plain star
  // with no interactions.

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(project) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(transactionName)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(TitleStar, {
      isOpen: false,
      disabled: true,
      keyedTeams: null,
      initialValue: Number(isKeyTransaction)
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_3__.Consumer, {
    children: results => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(TeamKeyTransactionField, {
      isKeyTransaction: isKeyTransaction,
      project: project,
      transactionName: transactionName,
      ...props,
      ...results
    })
  });
}

TeamKeyTransactionFieldWrapper.displayName = "TeamKeyTransactionFieldWrapper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__["default"])(TeamKeyTransactionFieldWrapper));

/***/ }),

/***/ "./app/utils/discover/types.tsx":
/*!**************************************!*\
  !*** ./app/utils/discover/types.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CHART_AXIS_OPTIONS": () => (/* binding */ CHART_AXIS_OPTIONS),
/* harmony export */   "DISPLAY_MODE_FALLBACK_OPTIONS": () => (/* binding */ DISPLAY_MODE_FALLBACK_OPTIONS),
/* harmony export */   "DISPLAY_MODE_OPTIONS": () => (/* binding */ DISPLAY_MODE_OPTIONS),
/* harmony export */   "DisplayModes": () => (/* binding */ DisplayModes),
/* harmony export */   "MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES": () => (/* binding */ MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES),
/* harmony export */   "TOP_EVENT_MODES": () => (/* binding */ TOP_EVENT_MODES),
/* harmony export */   "TOP_N": () => (/* binding */ TOP_N)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const TOP_N = 5;
let DisplayModes;

(function (DisplayModes) {
  DisplayModes["DEFAULT"] = "default";
  DisplayModes["PREVIOUS"] = "previous";
  DisplayModes["TOP5"] = "top5";
  DisplayModes["DAILY"] = "daily";
  DisplayModes["DAILYTOP5"] = "dailytop5";
  DisplayModes["WORLDMAP"] = "worldmap";
  DisplayModes["BAR"] = "bar";
})(DisplayModes || (DisplayModes = {}));

const TOP_EVENT_MODES = [DisplayModes.TOP5, DisplayModes.DAILYTOP5];
const DISPLAY_MODE_OPTIONS = [{
  value: DisplayModes.DEFAULT,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Period')
}, {
  value: DisplayModes.PREVIOUS,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Previous Period')
}, {
  value: DisplayModes.TOP5,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Period')
}, {
  value: DisplayModes.DAILY,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Daily')
}, {
  value: DisplayModes.DAILYTOP5,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Daily')
}, {
  value: DisplayModes.WORLDMAP,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('World Map')
}, {
  value: DisplayModes.BAR,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Bar Chart')
}];
/**
 * The chain of fallback display modes to try to use when one is disabled.
 *
 * Make sure that the chain always leads to a display mode that is enabled.
 * There is a fail safe to fall back to the default display mode, but it likely
 * won't be creating results you expect.
 */

const DISPLAY_MODE_FALLBACK_OPTIONS = {
  [DisplayModes.DEFAULT]: DisplayModes.DEFAULT,
  [DisplayModes.PREVIOUS]: DisplayModes.DEFAULT,
  [DisplayModes.TOP5]: DisplayModes.DEFAULT,
  [DisplayModes.DAILY]: DisplayModes.DEFAULT,
  [DisplayModes.DAILYTOP5]: DisplayModes.DAILY,
  [DisplayModes.WORLDMAP]: DisplayModes.DEFAULT,
  [DisplayModes.BAR]: DisplayModes.DEFAULT
}; // default list of yAxis options

const CHART_AXIS_OPTIONS = [{
  label: 'count()',
  value: 'count()'
}, {
  label: 'count_unique(user)',
  value: 'count_unique(user)'
}];
const MULTI_Y_AXIS_SUPPORTED_DISPLAY_MODES = [DisplayModes.DEFAULT, DisplayModes.DAILY, DisplayModes.PREVIOUS, DisplayModes.BAR];

/***/ }),

/***/ "./app/utils/fields/index.ts":
/*!***********************************!*\
  !*** ./app/utils/fields/index.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AGGREGATION_FIELDS": () => (/* binding */ AGGREGATION_FIELDS),
/* harmony export */   "AggregationKey": () => (/* binding */ AggregationKey),
/* harmony export */   "DISCOVER_FIELDS": () => (/* binding */ DISCOVER_FIELDS),
/* harmony export */   "FIELDS": () => (/* binding */ FIELDS),
/* harmony export */   "FieldKey": () => (/* binding */ FieldKey),
/* harmony export */   "FieldKind": () => (/* binding */ FieldKind),
/* harmony export */   "FieldValueType": () => (/* binding */ FieldValueType),
/* harmony export */   "ISSUE_FIELDS": () => (/* binding */ ISSUE_FIELDS),
/* harmony export */   "MEASUREMENT_FIELDS": () => (/* binding */ MEASUREMENT_FIELDS),
/* harmony export */   "MobileVital": () => (/* binding */ MobileVital),
/* harmony export */   "SPAN_OP_FIELDS": () => (/* binding */ SPAN_OP_FIELDS),
/* harmony export */   "SpanOpBreakdown": () => (/* binding */ SpanOpBreakdown),
/* harmony export */   "WebVital": () => (/* binding */ WebVital),
/* harmony export */   "getFieldDefinition": () => (/* binding */ getFieldDefinition)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let FieldKind;

(function (FieldKind) {
  FieldKind["TAG"] = "tag";
  FieldKind["MEASUREMENT"] = "measurement";
  FieldKind["BREAKDOWN"] = "breakdown";
  FieldKind["FIELD"] = "field";
  FieldKind["FUNCTION"] = "function";
  FieldKind["EQUATION"] = "equation";
  FieldKind["METRICS"] = "metric";
  FieldKind["NUMERIC_METRICS"] = "numeric_metric";
})(FieldKind || (FieldKind = {}));

let FieldKey;

(function (FieldKey) {
  FieldKey["AGE"] = "age";
  FieldKey["ASSIGNED"] = "assigned";
  FieldKey["ASSIGNED_OR_SUGGESTED"] = "assigned_or_suggested";
  FieldKey["BOOKMARKS"] = "bookmarks";
  FieldKey["CULPRIT"] = "culprit";
  FieldKey["DEVICE_ARCH"] = "device.arch";
  FieldKey["DEVICE_BATTERY_LEVEL"] = "device.battery_level";
  FieldKey["DEVICE_BRAND"] = "device.brand";
  FieldKey["DEVICE_CHARGING"] = "device.charging";
  FieldKey["DEVICE_FAMILY"] = "device.family";
  FieldKey["DEVICE_LOCALE"] = "device.locale";
  FieldKey["DEVICE_MODEL_ID"] = "device.model_id";
  FieldKey["DEVICE_NAME"] = "device.name";
  FieldKey["DEVICE_ONLINE"] = "device.online";
  FieldKey["DEVICE_ORIENTATION"] = "device.orientation";
  FieldKey["DEVICE_SIMULATOR"] = "device.simulator";
  FieldKey["DEVICE_UUID"] = "device.uuid";
  FieldKey["DIST"] = "dist";
  FieldKey["ENVIRONMENT"] = "environment";
  FieldKey["ERROR_HANDLED"] = "error.handled";
  FieldKey["ERROR_MECHANISM"] = "error.mechanism";
  FieldKey["ERROR_TYPE"] = "error.type";
  FieldKey["ERROR_UNHANDLED"] = "error.unhandled";
  FieldKey["ERROR_VALUE"] = "error.value";
  FieldKey["EVENT_TIMESTAMP"] = "event.timestamp";
  FieldKey["EVENT_TYPE"] = "event.type";
  FieldKey["FIRST_RELEASE"] = "firstRelease";
  FieldKey["FIRST_SEEN"] = "firstSeen";
  FieldKey["GEO_CITY"] = "geo.city";
  FieldKey["GEO_COUNTRY_CODE"] = "geo.country_code";
  FieldKey["GEO_REGION"] = "geo.region";
  FieldKey["HAS"] = "has";
  FieldKey["HTTP_METHOD"] = "http.method";
  FieldKey["HTTP_REFERER"] = "http.referer";
  FieldKey["HTTP_STATUS_CODE"] = "http.status_code";
  FieldKey["HTTP_URL"] = "http.url";
  FieldKey["ID"] = "id";
  FieldKey["IS"] = "is";
  FieldKey["ISSUE"] = "issue";
  FieldKey["LAST_SEEN"] = "lastSeen";
  FieldKey["LEVEL"] = "level";
  FieldKey["LOCATION"] = "location";
  FieldKey["MESSAGE"] = "message";
  FieldKey["OS"] = "os";
  FieldKey["OS_BUILD"] = "os.build";
  FieldKey["OS_KERNEL_VERSION"] = "os.kernel_version";
  FieldKey["PLATFORM"] = "platform";
  FieldKey["PLATFORM_NAME"] = "platform.name";
  FieldKey["PROJECT"] = "project";
  FieldKey["RELEASE"] = "release";
  FieldKey["RELEASE_BUILD"] = "release.build";
  FieldKey["RELEASE_PACKAGE"] = "release.package";
  FieldKey["RELEASE_STAGE"] = "release.stage";
  FieldKey["RELEASE_VERSION"] = "release.version";
  FieldKey["SDK_NAME"] = "sdk.name";
  FieldKey["SDK_VERSION"] = "sdk.version";
  FieldKey["STACK_ABS_PATH"] = "stack.abs_path";
  FieldKey["STACK_COLNO"] = "stack.colno";
  FieldKey["STACK_FILENAME"] = "stack.filename";
  FieldKey["STACK_FUNCTION"] = "stack.function";
  FieldKey["STACK_IN_APP"] = "stack.in_app";
  FieldKey["STACK_LINENO"] = "stack.lineno";
  FieldKey["STACK_MODULE"] = "stack.module";
  FieldKey["STACK_PACKAGE"] = "stack.package";
  FieldKey["STACK_RESOURCE"] = "stack.resource";
  FieldKey["STACK_STACK_LEVEL"] = "stack.stack_level";
  FieldKey["TIMESTAMP"] = "timestamp";
  FieldKey["TIMESTAMP_TO_DAY"] = "timestamp.to_day";
  FieldKey["TIMESTAMP_TO_HOUR"] = "timestamp.to_hour";
  FieldKey["TIMES_SEEN"] = "timesSeen";
  FieldKey["TITLE"] = "title";
  FieldKey["TRACE"] = "trace";
  FieldKey["TRACE_PARENT_SPAN"] = "trace.parent_span";
  FieldKey["TRACE_SPAN"] = "trace.span";
  FieldKey["TRANSACTION"] = "transaction";
  FieldKey["TRANSACTION_DURATION"] = "transaction.duration";
  FieldKey["TRANSACTION_OP"] = "transaction.op";
  FieldKey["TRANSACTION_STATUS"] = "transaction.status";
  FieldKey["USER"] = "user";
  FieldKey["USER_DISPLAY"] = "user.display";
  FieldKey["USER_EMAIL"] = "user.email";
  FieldKey["USER_ID"] = "user.id";
  FieldKey["USER_IP"] = "user.ip";
  FieldKey["USER_USERNAME"] = "user.username";
})(FieldKey || (FieldKey = {}));

let FieldValueType;

(function (FieldValueType) {
  FieldValueType["BOOLEAN"] = "boolean";
  FieldValueType["DATE"] = "date";
  FieldValueType["DURATION"] = "duration";
  FieldValueType["INTEGER"] = "integer";
  FieldValueType["NUMBER"] = "number";
  FieldValueType["PERCENTAGE"] = "percentage";
  FieldValueType["STRING"] = "string";
  FieldValueType["NEVER"] = "never";
  FieldValueType["SIZE"] = "size";
})(FieldValueType || (FieldValueType = {}));

let WebVital;

(function (WebVital) {
  WebVital["FP"] = "measurements.fp";
  WebVital["FCP"] = "measurements.fcp";
  WebVital["LCP"] = "measurements.lcp";
  WebVital["FID"] = "measurements.fid";
  WebVital["CLS"] = "measurements.cls";
  WebVital["TTFB"] = "measurements.ttfb";
  WebVital["RequestTime"] = "measurements.ttfb.requesttime";
})(WebVital || (WebVital = {}));

let MobileVital;

(function (MobileVital) {
  MobileVital["AppStartCold"] = "measurements.app_start_cold";
  MobileVital["AppStartWarm"] = "measurements.app_start_warm";
  MobileVital["FramesTotal"] = "measurements.frames_total";
  MobileVital["FramesSlow"] = "measurements.frames_slow";
  MobileVital["FramesFrozen"] = "measurements.frames_frozen";
  MobileVital["FramesSlowRate"] = "measurements.frames_slow_rate";
  MobileVital["FramesFrozenRate"] = "measurements.frames_frozen_rate";
  MobileVital["StallCount"] = "measurements.stall_count";
  MobileVital["StallTotalTime"] = "measurements.stall_total_time";
  MobileVital["StallLongestTime"] = "measurements.stall_longest_time";
  MobileVital["StallPercentage"] = "measurements.stall_percentage";
})(MobileVital || (MobileVital = {}));

let SpanOpBreakdown;

(function (SpanOpBreakdown) {
  SpanOpBreakdown["SpansBrowser"] = "spans.browser";
  SpanOpBreakdown["SpansDb"] = "spans.db";
  SpanOpBreakdown["SpansHttp"] = "spans.http";
  SpanOpBreakdown["SpansResource"] = "spans.resource";
  SpanOpBreakdown["SpansUi"] = "spans.ui";
})(SpanOpBreakdown || (SpanOpBreakdown = {}));

let AggregationKey;

(function (AggregationKey) {
  AggregationKey["Count"] = "count";
  AggregationKey["CountUnique"] = "count_unique";
  AggregationKey["CountMiserable"] = "count_miserable";
  AggregationKey["CountIf"] = "count_if";
  AggregationKey["CountWebVitals"] = "count_web_vitals";
  AggregationKey["Eps"] = "eps";
  AggregationKey["Epm"] = "epm";
  AggregationKey["FailureCount"] = "failure_count";
  AggregationKey["Min"] = "min";
  AggregationKey["Max"] = "max";
  AggregationKey["Sum"] = "sum";
  AggregationKey["Any"] = "any";
  AggregationKey["P50"] = "p50";
  AggregationKey["P75"] = "p75";
  AggregationKey["P95"] = "p95";
  AggregationKey["P99"] = "p99";
  AggregationKey["P100"] = "p100";
  AggregationKey["Percentile"] = "percentile";
  AggregationKey["Avg"] = "avg";
  AggregationKey["Apdex"] = "apdex";
  AggregationKey["UserMisery"] = "user_misery";
  AggregationKey["FailureRate"] = "failure_rate";
  AggregationKey["LastSeen"] = "last_seen";
})(AggregationKey || (AggregationKey = {}));

const AGGREGATION_FIELDS = {
  [AggregationKey.Count]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('count of events'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.CountUnique]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique count of the field values'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.INTEGER
  },
  [AggregationKey.CountMiserable]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Count of unique miserable users'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.CountIf]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Count of events matching the parameter conditions'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.CountWebVitals]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Count of web vitals with a specific status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.Eps]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events per second'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.Epm]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events per minute'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.FailureRate]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Failed event percentage based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.PERCENTAGE
  },
  [AggregationKey.FailureCount]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Failed event count based on transaction.status'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.NUMBER
  },
  [AggregationKey.Min]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the minimum value of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Max]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns maximum value of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Sum]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the total value for the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Any]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Not Recommended, a random field value'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.P50]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the 50th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.P75]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the 75th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.P95]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the 95th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.P99]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the 99th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.P100]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the 100th percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Percentile]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns the percentile of the selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Avg]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Returns averages for a selected field'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.Apdex]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Performance score based on a duration threshold'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.UserMisery]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('User-weighted performance metric that counts the number of unique users who were frustrated'),
    kind: FieldKind.FUNCTION,
    valueType: null
  },
  [AggregationKey.LastSeen]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues last seen at a date and time'),
    kind: FieldKind.FUNCTION,
    valueType: FieldValueType.DATE
  }
};
const MEASUREMENT_FIELDS = {
  [WebVital.FP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital First Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [WebVital.FCP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital First Contentful Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [WebVital.LCP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital Largest Contentful Paint'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [WebVital.FID]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital First Input Delay'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [WebVital.CLS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital Cumulative Layout Shift'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.NUMBER
  },
  [WebVital.TTFB]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vital Time To First Byte'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [WebVital.RequestTime]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Time between start of request to start of response'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [MobileVital.AppStartCold]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First launch (not in memory and no process exists)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [MobileVital.AppStartWarm]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Already launched (partial memory and process may exist)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [MobileVital.FramesTotal]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total number of frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER
  },
  [MobileVital.FramesSlow]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of slow frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER
  },
  [MobileVital.FramesFrozen]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of frozen frames'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER
  },
  [MobileVital.FramesSlowRate]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of slow frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE
  },
  [MobileVital.FramesFrozenRate]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of frozen frames out of the total'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE
  },
  [MobileVital.StallCount]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Count of slow Javascript event loops (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER
  },
  [MobileVital.StallTotalTime]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total stall duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE
  },
  [MobileVital.StallLongestTime]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Duration of slowest Javascript event loop (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.INTEGER
  },
  [MobileVital.StallPercentage]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total stall duration out of the total transaction duration (React Native)'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.PERCENTAGE
  }
};
const SPAN_OP_FIELDS = {
  [SpanOpBreakdown.SpansBrowser]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative time based on the browser operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [SpanOpBreakdown.SpansDb]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative time based on the database operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [SpanOpBreakdown.SpansHttp]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative time based on the http operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [SpanOpBreakdown.SpansResource]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative time based on the resource operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  },
  [SpanOpBreakdown.SpansUi]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative time based on the ui operation'),
    kind: FieldKind.METRICS,
    valueType: FieldValueType.DURATION
  }
};
const FIELDS = { ...AGGREGATION_FIELDS,
  ...MEASUREMENT_FIELDS,
  ...SPAN_OP_FIELDS,
  [FieldKey.AGE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The age of the issue in relative time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION
  },
  [FieldKey.ASSIGNED]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Assignee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.ASSIGNED_OR_SUGGESTED]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Assignee or suggestee of the issue as a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.CULPRIT]: {
    deprecated: true,
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.BOOKMARKS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The issues bookmarked by a user ID'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_ARCH]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('CPU architecture'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_BATTERY_LEVEL]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Indicates remaining battery life'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_BRAND]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Brand of device'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_CHARGING]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Charging at the time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.DEVICE_FAMILY]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Model name across generations'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_LOCALE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("The locale of the user's device"),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_MODEL_ID]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Internal hardware revision'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_NAME]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Descriptor details'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_ONLINE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Online at the time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.DEVICE_ORIENTATION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Portrait or landscape view '),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DEVICE_SIMULATOR]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Indicates if it occured on a simulator'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.DEVICE_UUID]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique device identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.DIST]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Distinguishes between build or deployment variants of the same release of an application.'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.ERROR_HANDLED]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Determines handling status of the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.ERROR_MECHANISM]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The mechanism that created the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.ERROR_TYPE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The type of exception'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.ERROR_UNHANDLED]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Determines unhandling status of the error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.ERROR_VALUE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Original value that exhibits error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.EVENT_TIMESTAMP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Date and time of the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.EVENT_TYPE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Type of event (Errors, transactions, csp and default)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.GEO_CITY]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Full name of the city'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.GEO_COUNTRY_CODE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Country code based on ISO 3166-1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.GEO_REGION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Full name of the country'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.HTTP_METHOD]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Method of the request that created the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.HTTP_REFERER]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The web page the resource was requested from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.HTTP_STATUS_CODE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Type of response (i.e., 200, 404)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.HTTP_URL]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Full URL of the request without parameters'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.ID]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The event identification number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.IS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The properties of an issue (i.e. Resolved, unresolved)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    keywords: ['ignored', 'assigned', 'for_review', 'unassigned', 'linked', 'unlinked']
  },
  [FieldKey.ISSUE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The issue identification code'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.LAST_SEEN]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues last seen at a given time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.LEVEL]: {
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.LOCATION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Location of error'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.MESSAGE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Error message or transaction name'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.OS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Build and kernel version'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.OS_BUILD]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name of the build'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.OS_KERNEL_VERSION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Version number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.PLATFORM]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name of the platform'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.PLATFORM_NAME]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name of the platform'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.PROJECT]: {
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.FIRST_RELEASE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues first seen in a given release'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.FIRST_SEEN]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues first seen at a given time'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.HAS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Determines if a tag or field exists in an event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.RELEASE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The version of your code deployed to an environment'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.RELEASE_BUILD]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The full version number that identifies the iteration'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.RELEASE_PACKAGE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The identifier unique to the project or application'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.RELEASE_STAGE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stage of usage (i.e., adopted, replaced, low)'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.RELEASE_VERSION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An abbreviated version number of the build'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.SDK_NAME]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name of the platform that sent the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.SDK_VERSION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Version of the platform that sent the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_ABS_PATH]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Absolute path to the source file'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_COLNO]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Column number of the call starting at 1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER
  },
  [FieldKey.STACK_FILENAME]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Relative path to the source file from the root directory'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_FUNCTION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name of function being called'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_IN_APP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Indicates if frame is related to relevant code in stack trace'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.BOOLEAN
  },
  [FieldKey.STACK_LINENO]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Line number of the call starting at 1'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER
  },
  [FieldKey.STACK_MODULE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Platform specific module path'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_PACKAGE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The package the frame is from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_RESOURCE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The package the frame is from'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.STACK_STACK_LEVEL]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of frames per stacktrace'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER
  },
  [FieldKey.TIMES_SEEN]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total number of events'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.NUMBER,
    keywords: ['count']
  },
  [FieldKey.TIMESTAMP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The time an event finishes'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.TIMESTAMP_TO_HOUR]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Rounded down to the nearest hour'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.TIMESTAMP_TO_DAY]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Rounded down to the nearest day'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DATE
  },
  [FieldKey.TITLE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRACE]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The trace identification number'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRACE_PARENT_SPAN]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Span identification number of the parent to the event'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRACE_SPAN]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Span identification number of the root span'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRANSACTION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Error or transaction name identifier'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRANSACTION_OP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Short code identifying the type of operation the span is measuring'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.TRANSACTION_DURATION]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Duration, in milliseconds, of the transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.DURATION
  },
  [FieldKey.TRANSACTION_STATUS]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Describes the status of the span/transaction'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('User identification value'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER_DISPLAY]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The first user field available of email, username, ID, and IP'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER_EMAIL]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Email address of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER_ID]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Application specific internal identifier of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER_IP]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('IP Address of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  },
  [FieldKey.USER_USERNAME]: {
    desc: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Username of the user'),
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING
  }
};
const ISSUE_FIELDS = [FieldKey.AGE, FieldKey.ASSIGNED, FieldKey.ASSIGNED_OR_SUGGESTED, FieldKey.BOOKMARKS, FieldKey.DEVICE_ARCH, FieldKey.DEVICE_BRAND, FieldKey.DEVICE_FAMILY, FieldKey.DEVICE_LOCALE, FieldKey.DEVICE_LOCALE, FieldKey.DEVICE_MODEL_ID, FieldKey.DEVICE_ORIENTATION, FieldKey.DEVICE_UUID, FieldKey.DIST, FieldKey.ERROR_HANDLED, FieldKey.ERROR_MECHANISM, FieldKey.ERROR_TYPE, FieldKey.ERROR_UNHANDLED, FieldKey.ERROR_VALUE, FieldKey.EVENT_TIMESTAMP, FieldKey.EVENT_TYPE, FieldKey.FIRST_RELEASE, FieldKey.FIRST_SEEN, FieldKey.GEO_CITY, FieldKey.GEO_COUNTRY_CODE, FieldKey.GEO_REGION, FieldKey.HAS, FieldKey.HTTP_METHOD, FieldKey.HTTP_REFERER, FieldKey.HTTP_STATUS_CODE, FieldKey.HTTP_URL, FieldKey.ID, FieldKey.IS, FieldKey.LAST_SEEN, FieldKey.LOCATION, FieldKey.MESSAGE, FieldKey.OS_BUILD, FieldKey.OS_KERNEL_VERSION, FieldKey.PLATFORM, FieldKey.RELEASE, FieldKey.RELEASE_BUILD, FieldKey.RELEASE_PACKAGE, FieldKey.RELEASE_STAGE, FieldKey.RELEASE_VERSION, FieldKey.SDK_NAME, FieldKey.SDK_VERSION, FieldKey.STACK_ABS_PATH, FieldKey.STACK_FILENAME, FieldKey.STACK_FUNCTION, FieldKey.STACK_MODULE, FieldKey.STACK_PACKAGE, FieldKey.STACK_STACK_LEVEL, FieldKey.TIMESTAMP, FieldKey.TIMES_SEEN, FieldKey.TITLE, FieldKey.TRACE, FieldKey.TRANSACTION, FieldKey.USER_EMAIL, FieldKey.USER_ID, FieldKey.USER_IP, FieldKey.USER_USERNAME];
/**
 * Refer to src/sentry/snuba/events.py, search for Columns
 */

const DISCOVER_FIELDS = [FieldKey.ID, // issue.id and project.id are omitted on purpose.
// Customers should use `issue` and `project` instead.
FieldKey.TIMESTAMP, // time is omitted on purpose.
// Customers should use `timestamp` or `timestamp.to_hour`.
FieldKey.TIMESTAMP_TO_HOUR, FieldKey.TIMESTAMP_TO_DAY, FieldKey.CULPRIT, FieldKey.LOCATION, FieldKey.MESSAGE, FieldKey.PLATFORM_NAME, FieldKey.ENVIRONMENT, FieldKey.RELEASE, FieldKey.DIST, FieldKey.TITLE, FieldKey.EVENT_TYPE, // tags.key and tags.value are omitted on purpose as well.
FieldKey.TRANSACTION, FieldKey.USER, FieldKey.USER_ID, FieldKey.USER_EMAIL, FieldKey.USER_USERNAME, FieldKey.USER_IP, FieldKey.SDK_NAME, FieldKey.SDK_VERSION, FieldKey.HTTP_METHOD, FieldKey.HTTP_REFERER, FieldKey.HTTP_URL, FieldKey.OS_BUILD, FieldKey.OS_KERNEL_VERSION, FieldKey.DEVICE_NAME, FieldKey.DEVICE_BRAND, FieldKey.DEVICE_LOCALE, FieldKey.DEVICE_UUID, FieldKey.DEVICE_ARCH, FieldKey.DEVICE_FAMILY, FieldKey.DEVICE_BATTERY_LEVEL, FieldKey.DEVICE_ORIENTATION, FieldKey.DEVICE_SIMULATOR, FieldKey.DEVICE_ONLINE, FieldKey.DEVICE_CHARGING, FieldKey.GEO_COUNTRY_CODE, FieldKey.GEO_REGION, FieldKey.GEO_CITY, FieldKey.ERROR_TYPE, FieldKey.ERROR_VALUE, FieldKey.ERROR_MECHANISM, FieldKey.ERROR_HANDLED, FieldKey.ERROR_UNHANDLED, FieldKey.LEVEL, FieldKey.STACK_ABS_PATH, FieldKey.STACK_FILENAME, FieldKey.STACK_PACKAGE, FieldKey.STACK_MODULE, FieldKey.STACK_FUNCTION, FieldKey.STACK_IN_APP, FieldKey.STACK_COLNO, FieldKey.STACK_LINENO, FieldKey.STACK_STACK_LEVEL, // contexts.key and contexts.value omitted on purpose.
// Transaction event fields.
FieldKey.TRANSACTION_DURATION, FieldKey.TRANSACTION_OP, FieldKey.TRANSACTION_STATUS, FieldKey.TRACE, FieldKey.TRACE_SPAN, FieldKey.TRACE_PARENT_SPAN, // Field alises defined in src/sentry/api/event_search.py
FieldKey.PROJECT, FieldKey.ISSUE, FieldKey.USER_DISPLAY, // Span Op fields
SpanOpBreakdown.SpansBrowser, SpanOpBreakdown.SpansDb, SpanOpBreakdown.SpansHttp, SpanOpBreakdown.SpansResource, SpanOpBreakdown.SpansUi];
const getFieldDefinition = key => {
  var _FIELDS$key;

  return (_FIELDS$key = FIELDS[key]) !== null && _FIELDS$key !== void 0 ? _FIELDS$key : null;
};

/***/ }),

/***/ "./app/utils/isEqualWithDates.tsx":
/*!****************************************!*\
  !*** ./app/utils/isEqualWithDates.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isEqualWithDates": () => (/* binding */ isEqualWithDates)
/* harmony export */ });
/* harmony import */ var lodash_isDate__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/isDate */ "../node_modules/lodash/isDate.js");
/* harmony import */ var lodash_isDate__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_isDate__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_isEqualWith__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isEqualWith */ "../node_modules/lodash/isEqualWith.js");
/* harmony import */ var lodash_isEqualWith__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqualWith__WEBPACK_IMPORTED_MODULE_1__);

 // `lodash.isEqual` does not compare date objects

function dateComparator(value, other) {
  if (lodash_isDate__WEBPACK_IMPORTED_MODULE_0___default()(value) && lodash_isDate__WEBPACK_IMPORTED_MODULE_0___default()(other)) {
    return +value === +other;
  } // Loose checking


  if (!value && !other) {
    return true;
  } // returning undefined will use default comparator


  return undefined;
}

const isEqualWithDates = (a, b) => lodash_isEqualWith__WEBPACK_IMPORTED_MODULE_1___default()(a, b, dateComparator);

/***/ }),

/***/ "./app/utils/metrics/fields.tsx":
/*!**************************************!*\
  !*** ./app/utils/metrics/fields.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "METRICS_OPERATIONS": () => (/* binding */ METRICS_OPERATIONS),
/* harmony export */   "METRIC_TO_COLUMN_TYPE": () => (/* binding */ METRIC_TO_COLUMN_TYPE),
/* harmony export */   "SessionMetric": () => (/* binding */ SessionMetric),
/* harmony export */   "TransactionMetric": () => (/* binding */ TransactionMetric)
/* harmony export */ });
let SessionMetric;

(function (SessionMetric) {
  SessionMetric["SESSION"] = "sentry.sessions.session";
  SessionMetric["SESSION_DURATION"] = "sentry.sessions.session.duration";
  SessionMetric["SESSION_ERROR"] = "sentry.sessions.session.error";
  SessionMetric["SESSION_CRASH_FREE_RATE"] = "session.crash_free_rate";
  SessionMetric["USER_CRASH_FREE_RATE"] = "session.crash_free_user_rate";
  SessionMetric["SESSION_CRASH_RATE"] = "session.crash_rate";
  SessionMetric["USER_CRASH_RATE"] = "session.crash_user_rate";
  SessionMetric["USER"] = "sentry.sessions.user";
  SessionMetric["SESSION_HEALTHY"] = "session.healthy";
  SessionMetric["USER_HEALTHY"] = "session.healthy_user";
  SessionMetric["SESSION_ABNORMAL"] = "session.abnormal";
  SessionMetric["USER_ABNORMAL"] = "session.abnormal_user";
  SessionMetric["SESSION_CRASHED"] = "session.crashed";
  SessionMetric["USER_CRASHED"] = "session.crashed_user";
  SessionMetric["SESSION_ERRORED"] = "session.errored";
  SessionMetric["USER_ERRORED"] = "session.errored_user";
})(SessionMetric || (SessionMetric = {}));

let TransactionMetric;

(function (TransactionMetric) {
  TransactionMetric["MEASUREMENTS_FP"] = "sentry.transactions.measurements.fp";
  TransactionMetric["MEASUREMENTS_FCP"] = "sentry.transactions.measurements.fcp";
  TransactionMetric["MEASUREMENTS_LCP"] = "sentry.transactions.measurements.lcp";
  TransactionMetric["MEASUREMENTS_FID"] = "sentry.transactions.measurements.fid";
  TransactionMetric["MEASUREMENTS_CLS"] = "sentry.transactions.measurements.cls";
  TransactionMetric["MEASUREMENTS_TTFB"] = "sentry.transactions.measurements.ttfb";
  TransactionMetric["MEASUREMENTS_TTFB_REQUESTTIME"] = "sentry.transactions.measurements.ttfb.requesttime";
  TransactionMetric["MEASUREMENTS_APP_START_COLD"] = "sentry.transactions.measurements.app_start_cold";
  TransactionMetric["MEASUREMENTS_APP_START_WARM"] = "sentry.transactions.measurements.app_start_warm";
  TransactionMetric["MEASUREMENTS_FRAMES_TOTAL"] = "sentry.transactions.measurements.frames_total";
  TransactionMetric["MEASUREMENTS_FRAMES_SLOW"] = "sentry.transactions.measurements.frames_slow";
  TransactionMetric["MEASUREMENTS_FRAMES_FROZEN"] = "sentry.transactions.measurements.frames_frozen";
  TransactionMetric["MEASUREMENTS_FRAMES_SLOW_RATE"] = "sentry.transactions.measurements.frames_slow_rate";
  TransactionMetric["MEASUREMENTS_FRAMES_FROZEN_RATE"] = "sentry.transactions.measurements.frames_frozen_rate";
  TransactionMetric["MEASUREMENTS_STALL_COUNT"] = "sentry.transactions.measurements.stall_count";
  TransactionMetric["MEASUREMENTS_STALL_TOTAL_TIME"] = "sentry.transactions.measurements.stall_total_time";
  TransactionMetric["MEASUREMENTS_STALL_LONGEST_TIME"] = "sentry.transactions.measurements.stall_longest_time";
  TransactionMetric["MEASUREMENTS_STALL_PERCENTAGE"] = "sentry.transactions.measurements.stall_percentage";
  TransactionMetric["TRANSACTION_DURATION"] = "sentry.transactions.transaction.duration";
  TransactionMetric["USER"] = "sentry.transactions.user";
  TransactionMetric["TRANSACTION"] = "transaction";
})(TransactionMetric || (TransactionMetric = {}));

const METRIC_TO_COLUMN_TYPE = {
  // Session metrics
  [SessionMetric.USER]: 'integer',
  [SessionMetric.SESSION_ERROR]: 'integer',
  [SessionMetric.SESSION_DURATION]: 'duration',
  [SessionMetric.SESSION]: 'integer',
  [SessionMetric.SESSION_CRASH_FREE_RATE]: 'percentage',
  [SessionMetric.USER_CRASH_FREE_RATE]: 'percentage',
  [SessionMetric.SESSION_CRASH_RATE]: 'percentage',
  [SessionMetric.USER_CRASH_RATE]: 'percentage',
  [SessionMetric.SESSION_HEALTHY]: 'integer',
  [SessionMetric.USER_HEALTHY]: 'integer',
  [SessionMetric.SESSION_ABNORMAL]: 'integer',
  [SessionMetric.USER_ABNORMAL]: 'integer',
  [SessionMetric.SESSION_CRASHED]: 'integer',
  [SessionMetric.USER_CRASHED]: 'integer',
  [SessionMetric.SESSION_ERRORED]: 'integer',
  [SessionMetric.USER_ERRORED]: 'integer',
  // Transaction metrics
  [TransactionMetric.USER]: 'integer',
  [TransactionMetric.TRANSACTION]: 'string',
  [TransactionMetric.TRANSACTION_DURATION]: 'duration',
  [TransactionMetric.MEASUREMENTS_FP]: 'duration',
  [TransactionMetric.MEASUREMENTS_FCP]: 'duration',
  [TransactionMetric.MEASUREMENTS_LCP]: 'duration',
  [TransactionMetric.MEASUREMENTS_FID]: 'duration',
  [TransactionMetric.MEASUREMENTS_CLS]: 'number',
  [TransactionMetric.MEASUREMENTS_TTFB]: 'duration',
  [TransactionMetric.MEASUREMENTS_TTFB_REQUESTTIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_APP_START_COLD]: 'duration',
  [TransactionMetric.MEASUREMENTS_APP_START_WARM]: 'duration',
  [TransactionMetric.MEASUREMENTS_FRAMES_TOTAL]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_SLOW]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_FROZEN]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_SLOW_RATE]: 'percentage',
  [TransactionMetric.MEASUREMENTS_FRAMES_FROZEN_RATE]: 'percentage',
  [TransactionMetric.MEASUREMENTS_STALL_COUNT]: 'integer',
  [TransactionMetric.MEASUREMENTS_STALL_TOTAL_TIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_STALL_LONGEST_TIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_STALL_PERCENTAGE]: 'percentage'
};
const METRICS_OPERATIONS = {
  sum: {
    metricsTypes: ['counter'],
    defaultValue: SessionMetric.SESSION
  },
  count_unique: {
    metricsTypes: ['set'],
    defaultValue: SessionMetric.USER
  },
  avg: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  count: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  max: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  p50: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  p75: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  p95: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  },
  p99: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION
  }
};

/***/ }),

/***/ "./app/utils/performance/constants.tsx":
/*!*********************************************!*\
  !*** ./app/utils/performance/constants.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MAX_TEAM_KEY_TRANSACTIONS": () => (/* binding */ MAX_TEAM_KEY_TRANSACTIONS),
/* harmony export */   "PERFORMANCE_URL_PARAM": () => (/* binding */ PERFORMANCE_URL_PARAM)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");


const MAX_TEAM_KEY_TRANSACTIONS = 100;
const PERFORMANCE_URL_PARAM = ['team', ...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_1__.URL_PARAM)];

/***/ }),

/***/ "./app/utils/tokenizeSearch.tsx":
/*!**************************************!*\
  !*** ./app/utils/tokenizeSearch.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MutableSearch": () => (/* binding */ MutableSearch),
/* harmony export */   "TokenType": () => (/* binding */ TokenType),
/* harmony export */   "escapeFilterValue": () => (/* binding */ escapeFilterValue)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");





let TokenType;

(function (TokenType) {
  TokenType[TokenType["OPERATOR"] = 0] = "OPERATOR";
  TokenType[TokenType["FILTER"] = 1] = "FILTER";
  TokenType[TokenType["FREE_TEXT"] = 2] = "FREE_TEXT";
})(TokenType || (TokenType = {}));

function isOp(t) {
  return t.type === TokenType.OPERATOR;
}

function isBooleanOp(value) {
  return ['OR', 'AND'].includes(value.toUpperCase());
}

function isParen(token, character) {
  return token !== undefined && isOp(token) && ['(', ')'].includes(token.value) && token.value === character;
} // TODO(epurkhiser): This is legacy from before the existence of
// searchSyntax/parser. We should absolutely replace the internals of this API
// with `parseSearch`.


class MutableSearch {
  /**
   * Creates a MutableSearch from a string query
   */

  /**
   * Creates a mutable search query from a list of query parts
   */
  constructor(tokensOrQuery) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokens", void 0);

    const strTokens = Array.isArray(tokensOrQuery) ? tokensOrQuery : splitSearchIntoTokens(tokensOrQuery);
    this.tokens = [];

    for (let token of strTokens) {
      let tokenState = TokenType.FREE_TEXT;

      if (isBooleanOp(token)) {
        this.addOp(token.toUpperCase());
        continue;
      }

      if (token.startsWith('(')) {
        const parenMatch = token.match(/^\(+/g);

        if (parenMatch) {
          parenMatch[0].split('').map(paren => this.addOp(paren));
          token = token.replace(/^\(+/g, '');
        }
      } // Traverse the token and check if it's a filter condition or free text


      for (let i = 0, len = token.length; i < len; i++) {
        const char = token[i];

        if (i === 0 && (char === '"' || char === ':')) {
          break;
        } // We may have entered a filter condition


        if (char === ':') {
          const nextChar = token[i + 1] || '';

          if ([':', ' '].includes(nextChar)) {
            tokenState = TokenType.FREE_TEXT;
          } else {
            tokenState = TokenType.FILTER;
          }

          break;
        }
      }

      let trailingParen = '';

      if (token.endsWith(')') && !token.includes('(')) {
        const parenMatch = token.match(/\)+$/g);

        if (parenMatch) {
          trailingParen = parenMatch[0];
          token = token.replace(/\)+$/g, '');
        }
      }

      if (tokenState === TokenType.FREE_TEXT && token.length) {
        this.addFreeText(token);
      } else if (tokenState === TokenType.FILTER) {
        this.addStringFilter(token, false);
      }

      if (trailingParen !== '') {
        trailingParen.split('').map(paren => this.addOp(paren));
      }
    }
  }

  formatString() {
    const formattedTokens = [];

    for (const token of this.tokens) {
      switch (token.type) {
        case TokenType.FILTER:
          if (token.value === '' || token.value === null) {
            formattedTokens.push(`${token.key}:""`);
          } else if (/[\s\(\)\\"]/g.test(token.value)) {
            formattedTokens.push(`${token.key}:"${(0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.escapeDoubleQuotes)(token.value)}"`);
          } else {
            formattedTokens.push(`${token.key}:${token.value}`);
          }

          break;

        case TokenType.FREE_TEXT:
          if (/[\s\(\)\\"]/g.test(token.value)) {
            formattedTokens.push(`"${(0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.escapeDoubleQuotes)(token.value)}"`);
          } else {
            formattedTokens.push(token.value);
          }

          break;

        default:
          formattedTokens.push(token.value);
      }
    }

    return formattedTokens.join(' ').trim();
  }

  addStringFilter(filter) {
    let shouldEscape = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    const [key, value] = parseFilter(filter);
    this.addFilterValues(key, [value], shouldEscape);
    return this;
  }

  addFilterValues(key, values) {
    let shouldEscape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    for (const value of values) {
      // Filter values that we insert through the UI can contain special characters
      // that need to escaped. User entered filters should not be escaped.
      const escaped = shouldEscape ? escapeFilterValue(value) : value;
      const token = {
        type: TokenType.FILTER,
        key,
        value: escaped
      };
      this.tokens.push(token);
    }

    return this;
  }

  setFilterValues(key, values) {
    let shouldEscape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    this.removeFilter(key);
    this.addFilterValues(key, values, shouldEscape);
    return this;
  }

  get filters() {
    const reducer = (acc, token) => {
      var _acc;

      return { ...acc,
        [token.key]: [...((_acc = acc[token.key]) !== null && _acc !== void 0 ? _acc : []), token.value]
      };
    };

    return this.tokens.filter(t => t.type === TokenType.FILTER).reduce(reducer, {});
  }

  getFilterValues(key) {
    var _this$filters$key;

    return (_this$filters$key = this.filters[key]) !== null && _this$filters$key !== void 0 ? _this$filters$key : [];
  }

  getFilterKeys() {
    return Object.keys(this.filters);
  }

  hasFilter(key) {
    return this.getFilterValues(key).length > 0;
  }

  removeFilter(key) {
    this.tokens = this.tokens.filter(token => token.key !== key); // Now the really complicated part: removing parens that only have one element in them.
    // Since parens are themselves tokens, this gets tricky. In summary, loop through the
    // tokens until we find the innermost open paren. Then forward search through the rest of the tokens
    // to see if that open paren corresponds to a closed paren with one or fewer items inside.
    // If it does, delete those parens, and loop again until there are no more parens to delete.

    let parensToDelete = [];

    const cleanParens = (_, idx) => !parensToDelete.includes(idx);

    do {
      if (parensToDelete.length) {
        this.tokens = this.tokens.filter(cleanParens);
      }

      parensToDelete = [];

      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];

        if (!isOp(token) || token.value !== '(') {
          continue;
        }

        let alreadySeen = false;

        for (let j = i + 1; j < this.tokens.length; j++) {
          const nextToken = this.tokens[j];

          if (isOp(nextToken) && nextToken.value === '(') {
            // Continue down to the nested parens. We can skip i forward since we know
            // everything between i and j is NOT an open paren.
            i = j - 1;
            break;
          } else if (!isOp(nextToken)) {
            if (alreadySeen) {
              // This has more than one term, no need to delete
              break;
            }

            alreadySeen = true;
          } else if (isOp(nextToken) && nextToken.value === ')') {
            // We found another paren with zero or one terms inside. Delete the pair.
            parensToDelete = [i, j];
            break;
          }
        }

        if (parensToDelete.length > 0) {
          break;
        }
      }
    } while (parensToDelete.length > 0); // Now that all erroneous parens are removed we need to remove dangling OR/AND operators.
    // I originally removed all the dangling properties in a single loop, but that meant that
    // cases like `a OR OR b` would remove both operators, when only one should be removed. So
    // instead, we loop until we find an operator to remove, then go back to the start and loop
    // again.


    let toRemove = -1;

    do {
      if (toRemove >= 0) {
        this.tokens.splice(toRemove, 1);
        toRemove = -1;
      }

      for (let i = 0; i < this.tokens.length; i++) {
        const token = this.tokens[i];
        const prev = this.tokens[i - 1];
        const next = this.tokens[i + 1];

        if (isOp(token) && isBooleanOp(token.value)) {
          if (prev === undefined || isOp(prev) || next === undefined || isOp(next)) {
            // Want to avoid removing `(term) OR (term)`
            if (isParen(prev, ')') && isParen(next, '(')) {
              continue;
            }

            toRemove = i;
            break;
          }
        }
      }
    } while (toRemove >= 0);

    return this;
  }

  removeFilterValue(key, value) {
    const values = this.getFilterValues(key);

    if (Array.isArray(values) && values.length) {
      this.setFilterValues(key, values.filter(item => item !== value));
    }
  }

  addFreeText(value) {
    const token = {
      type: TokenType.FREE_TEXT,
      value: formatQuery(value)
    };
    this.tokens.push(token);
    return this;
  }

  addOp(value) {
    const token = {
      type: TokenType.OPERATOR,
      value
    };
    this.tokens.push(token);
    return this;
  }

  get freeText() {
    return this.tokens.filter(t => t.type === TokenType.FREE_TEXT).map(t => t.value);
  }

  set freeText(values) {
    this.tokens = this.tokens.filter(t => t.type !== TokenType.FREE_TEXT);

    for (const v of values) {
      this.addFreeText(v);
    }
  }

  copy() {
    const q = new MutableSearch([]);
    q.tokens = [...this.tokens];
    return q;
  }

  isEmpty() {
    return this.tokens.length === 0;
  }

}
/**
 * Splits search strings into tokens for parsing by tokenizeSearch.
 *
 * Should stay in sync with src.sentry.search.utils:split_query_into_tokens
 */

function splitSearchIntoTokens(query) {
  const queryChars = Array.from(query);
  const tokens = [];
  let token = '';
  let endOfPrevWord = '';
  let quoteType = '';
  let quoteEnclosed = false;

  for (let idx = 0; idx < queryChars.length; idx++) {
    const char = queryChars[idx];
    const nextChar = queryChars.length - 1 > idx ? queryChars[idx + 1] : null;
    token += char;

    if (nextChar !== null && !isSpace(char) && isSpace(nextChar)) {
      endOfPrevWord = char;
    }

    if (isSpace(char) && !quoteEnclosed && endOfPrevWord !== ':' && !isSpace(token)) {
      tokens.push(token.trim());
      token = '';
    }

    if (["'", '"'].includes(char) && (!quoteEnclosed || quoteType === char)) {
      quoteEnclosed = !quoteEnclosed;

      if (quoteEnclosed) {
        quoteType = char;
      }
    }

    if (quoteEnclosed && char === '\\' && nextChar === quoteType) {
      token += nextChar;
      idx++;
    }
  }

  const trimmedToken = token.trim();

  if (trimmedToken !== '') {
    tokens.push(trimmedToken);
  }

  return tokens;
}
/**
 * Checks if the string is only spaces
 */


function isSpace(s) {
  return s.trim() === '';
}
/**
 * Splits a filter on ':' and removes enclosing quotes if present, and returns
 * both sides of the split as strings.
 */


function parseFilter(filter) {
  const idx = filter.indexOf(':');
  const key = removeSurroundingQuotes(filter.slice(0, idx));
  const value = removeSurroundingQuotes(filter.slice(idx + 1));
  return [key, value];
}

function removeSurroundingQuotes(text) {
  const length = text.length;

  if (length <= 1) {
    return text;
  }

  let left = 0;

  for (; left <= length / 2; left++) {
    if (text.charAt(left) !== '"') {
      break;
    }
  }

  let right = length - 1;

  for (; right >= length / 2; right--) {
    if (text.charAt(right) !== '"' || text.charAt(right - 1) === '\\') {
      break;
    }
  }

  return text.slice(left, right + 1);
}
/**
 * Strips enclosing quotes and parens from a query, if present.
 */


function formatQuery(query) {
  return query.replace(/^["\(]+|["\)]+$/g, '');
}
/**
 * Some characters have special meaning in a filter value. So when they are
 * directly added as a value, we have to escape them to mean the literal.
 */


function escapeFilterValue(value) {
  // TODO(txiao): The types here are definitely wrong.
  // Need to dig deeper to see where exactly it's wrong.
  //
  // astericks (*) is used for wildcard searches
  return typeof value === 'string' ? value.replace(/([\*])/g, '\\$1') : value;
}

/***/ }),

/***/ "./app/utils/usePageFilters.tsx":
/*!**************************************!*\
  !*** ./app/utils/usePageFilters.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/stores/pageFiltersStore */ "./app/stores/pageFiltersStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");


/**
 * Custom hook that returns the state of page filters
 */

function usePageFilters() {
  return (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_1__.useLegacyStore)(sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_0__["default"]);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (usePageFilters);

/***/ }),

/***/ "./app/utils/withPageFilters.tsx":
/*!***************************************!*\
  !*** ./app/utils/withPageFilters.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _usePageFilters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * Higher order component that uses PageFiltersStore and provides the active
 * project
 */
function withPageFilters(WrappedComponent) {
  const WithPageFilters = props => {
    const {
      selection,
      isReady: isGlobalSelectionReady
    } = (0,_usePageFilters__WEBPACK_IMPORTED_MODULE_1__["default"])();
    const selectionProps = {
      selection,
      isGlobalSelectionReady
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...selectionProps,
      ...props
    });
  };

  const displayName = (0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent);
  WithPageFilters.displayName = `withPageFilters(${displayName})`;
  return WithPageFilters;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withPageFilters);

/***/ }),

/***/ "./app/views/dashboardsV2/types.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/types.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_TABLE_LIMIT": () => (/* binding */ DEFAULT_TABLE_LIMIT),
/* harmony export */   "DashboardFilterKeys": () => (/* binding */ DashboardFilterKeys),
/* harmony export */   "DashboardState": () => (/* binding */ DashboardState),
/* harmony export */   "DashboardWidgetSource": () => (/* binding */ DashboardWidgetSource),
/* harmony export */   "DisplayType": () => (/* binding */ DisplayType),
/* harmony export */   "MAX_WIDGETS": () => (/* binding */ MAX_WIDGETS),
/* harmony export */   "WidgetType": () => (/* binding */ WidgetType)
/* harmony export */ });
// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
const MAX_WIDGETS = 30;
const DEFAULT_TABLE_LIMIT = 5;
let DisplayType;

(function (DisplayType) {
  DisplayType["AREA"] = "area";
  DisplayType["BAR"] = "bar";
  DisplayType["LINE"] = "line";
  DisplayType["TABLE"] = "table";
  DisplayType["WORLD_MAP"] = "world_map";
  DisplayType["BIG_NUMBER"] = "big_number";
  DisplayType["TOP_N"] = "top_n";
})(DisplayType || (DisplayType = {}));

let WidgetType;

(function (WidgetType) {
  WidgetType["DISCOVER"] = "discover";
  WidgetType["ISSUE"] = "issue";
  WidgetType["RELEASE"] = "metrics";
})(WidgetType || (WidgetType = {}));

let DashboardFilterKeys;

(function (DashboardFilterKeys) {
  DashboardFilterKeys["RELEASE"] = "release";
})(DashboardFilterKeys || (DashboardFilterKeys = {}));

let DashboardState; // where we launch the dashboard widget from

(function (DashboardState) {
  DashboardState["VIEW"] = "view";
  DashboardState["EDIT"] = "edit";
  DashboardState["CREATE"] = "create";
  DashboardState["PENDING_DELETE"] = "pending_delete";
  DashboardState["PREVIEW"] = "preview";
})(DashboardState || (DashboardState = {}));

let DashboardWidgetSource;

(function (DashboardWidgetSource) {
  DashboardWidgetSource["DISCOVERV2"] = "discoverv2";
  DashboardWidgetSource["DASHBOARDS"] = "dashboards";
  DashboardWidgetSource["LIBRARY"] = "library";
  DashboardWidgetSource["ISSUE_DETAILS"] = "issueDetail";
})(DashboardWidgetSource || (DashboardWidgetSource = {}));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DERIVED_STATUS_METRICS_PATTERN": () => (/* binding */ DERIVED_STATUS_METRICS_PATTERN),
/* harmony export */   "DISABLED_SORT": () => (/* binding */ DISABLED_SORT),
/* harmony export */   "DerivedStatusFields": () => (/* binding */ DerivedStatusFields),
/* harmony export */   "FIELD_TO_METRICS_EXPRESSION": () => (/* binding */ FIELD_TO_METRICS_EXPRESSION),
/* harmony export */   "METRICS_EXPRESSION_TO_FIELD": () => (/* binding */ METRICS_EXPRESSION_TO_FIELD),
/* harmony export */   "SESSIONS_FIELDS": () => (/* binding */ SESSIONS_FIELDS),
/* harmony export */   "SESSIONS_FILTER_TAGS": () => (/* binding */ SESSIONS_FILTER_TAGS),
/* harmony export */   "SESSIONS_OPERATIONS": () => (/* binding */ SESSIONS_OPERATIONS),
/* harmony export */   "SESSIONS_TAGS": () => (/* binding */ SESSIONS_TAGS),
/* harmony export */   "SESSION_STATUSES": () => (/* binding */ SESSION_STATUSES),
/* harmony export */   "TAG_SORT_DENY_LIST": () => (/* binding */ TAG_SORT_DENY_LIST),
/* harmony export */   "generateReleaseWidgetFieldOptions": () => (/* binding */ generateReleaseWidgetFieldOptions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_invert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/invert */ "../node_modules/lodash/invert.js");
/* harmony import */ var lodash_invert__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_invert__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/metrics/fields */ "./app/utils/metrics/fields.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");







const DERIVED_STATUS_METRICS_PATTERN = /count_(abnormal|errored|crashed|healthy)\((user|session)\)/;
let DerivedStatusFields;

(function (DerivedStatusFields) {
  DerivedStatusFields["HEALTHY_SESSIONS"] = "count_healthy(session)";
  DerivedStatusFields["HEALTHY_USERS"] = "count_healthy(user)";
  DerivedStatusFields["ABNORMAL_SESSIONS"] = "count_abnormal(session)";
  DerivedStatusFields["ABNORMAL_USERS"] = "count_abnormal(user)";
  DerivedStatusFields["CRASHED_SESSIONS"] = "count_crashed(session)";
  DerivedStatusFields["CRASHED_USERS"] = "count_crashed(user)";
  DerivedStatusFields["ERRORED_SESSIONS"] = "count_errored(session)";
  DerivedStatusFields["ERRORED_USERS"] = "count_errored(user)";
})(DerivedStatusFields || (DerivedStatusFields = {}));

const FIELD_TO_METRICS_EXPRESSION = {
  'count_healthy(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_HEALTHY,
  'count_healthy(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_HEALTHY,
  'count_abnormal(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_ABNORMAL,
  'count_abnormal(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_ABNORMAL,
  'count_crashed(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_CRASHED,
  'count_crashed(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_CRASHED,
  'count_errored(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_ERRORED,
  'count_errored(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_ERRORED,
  'count_unique(user)': `count_unique(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER})`,
  'sum(session)': `sum(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION})`,
  'crash_free_rate(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_CRASH_FREE_RATE,
  'crash_free_rate(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_CRASH_FREE_RATE,
  'crash_rate(session)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_CRASH_RATE,
  'crash_rate(user)': sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.USER_CRASH_RATE,
  'avg(session.duration)': `avg(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  'max(session.duration)': `max(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  'p50(session.duration)': `p50(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  'p75(session.duration)': `p75(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  'p95(session.duration)': `p95(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  'p99(session.duration)': `p99(${sentry_utils_metrics_fields__WEBPACK_IMPORTED_MODULE_5__.SessionMetric.SESSION_DURATION})`,
  project: 'project_id'
};
const METRICS_EXPRESSION_TO_FIELD = lodash_invert__WEBPACK_IMPORTED_MODULE_2___default()(FIELD_TO_METRICS_EXPRESSION);
const DISABLED_SORT = ['count_errored(session)', 'count_errored(user)', 'count_healthy(session)', 'count_healthy(user)', 'session.status'];
const TAG_SORT_DENY_LIST = ['project', 'environment'];
const SESSIONS_FIELDS = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION]: {
    name: 'session',
    operations: ['sum', 'crash_rate', 'crash_free_rate', 'count_healthy', 'count_abnormal', 'count_crashed', 'count_errored'],
    type: 'integer'
  },
  [sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.USER]: {
    name: 'user',
    operations: ['count_unique', 'crash_rate', 'crash_free_rate', 'count_healthy', 'count_abnormal', 'count_crashed', 'count_errored'],
    type: 'string'
  },
  [sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION]: {
    name: 'session.duration',
    operations: ['avg', 'p50', 'p75', 'p95', 'p99', 'max'],
    type: 'duration'
  }
};
const SESSIONS_OPERATIONS = {
  sum: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  count_unique: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.USER,
      required: true
    }]
  },
  count_healthy: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  count_abnormal: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  count_crashed: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  count_errored: {
    outputType: 'integer',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  crash_rate: {
    outputType: 'percentage',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  crash_free_rate: {
    outputType: 'percentage',
    parameters: [{
      kind: 'column',
      columnTypes: ['integer', 'string'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION,
      required: true
    }]
  },
  avg: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  },
  max: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  },
  p50: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  },
  p75: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  },
  p95: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  },
  p99: {
    outputType: null,
    parameters: [{
      kind: 'column',
      columnTypes: ['duration'],
      defaultValue: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionField.SESSION_DURATION,
      required: true
    }]
  }
};
const SESSIONS_TAGS = ['environment', 'project', 'release', 'session.status'];
const SESSIONS_FILTER_TAGS = ['environment', 'project', 'release'];
const SESSION_STATUSES = Object.values(sentry_types__WEBPACK_IMPORTED_MODULE_3__.SessionStatus);
function generateReleaseWidgetFieldOptions() {
  let fields = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Object.values(SESSIONS_FIELDS);
  let tagKeys = arguments.length > 1 ? arguments[1] : undefined;
  const fieldOptions = {};
  const operations = new Set();
  const knownOperations = Object.keys(SESSIONS_OPERATIONS);
  fields.sort((a, b) => a.name.localeCompare(b.name)).forEach(field => {
    field.operations.forEach(operation => operations.add(operation));
    fieldOptions[`field:${field.name}`] = {
      label: field.name,
      value: {
        kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_6__.FieldValueKind.METRICS,
        meta: {
          name: field.name,
          dataType: field.type
        }
      }
    };
  });
  Array.from(operations).filter(operation => knownOperations.includes(operation)).sort((a, b) => a.localeCompare(b)).forEach(operation => {
    fieldOptions[`function:${operation}`] = {
      label: `${operation}(${'\u2026'})`,
      value: {
        kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_6__.FieldValueKind.FUNCTION,
        meta: {
          name: operation,
          parameters: SESSIONS_OPERATIONS[operation].parameters.map(param => param)
        }
      }
    };
  });

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(tagKeys)) {
    // Expose environment. session.status, project etc. as fields.
    tagKeys.sort((a, b) => a.localeCompare(b)).forEach(tag => {
      fieldOptions[`field:${tag}`] = {
        label: tag,
        value: {
          kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_6__.FieldValueKind.FIELD,
          meta: {
            name: tag,
            dataType: 'string'
          }
        }
      };
    });
  }

  return fieldOptions;
}

/***/ }),

/***/ "./app/views/eventsV2/data.tsx":
/*!*************************************!*\
  !*** ./app/views/eventsV2/data.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALL_VIEWS": () => (/* binding */ ALL_VIEWS),
/* harmony export */   "DEFAULT_EVENT_VIEW": () => (/* binding */ DEFAULT_EVENT_VIEW),
/* harmony export */   "TRANSACTION_VIEWS": () => (/* binding */ TRANSACTION_VIEWS),
/* harmony export */   "WEB_VITALS_VIEWS": () => (/* binding */ WEB_VITALS_VIEWS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const DEFAULT_EVENT_VIEW = {
  id: undefined,
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h'
};
const TRANSACTION_VIEWS = [{
  id: undefined,
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions by Volume'),
  fields: ['transaction', 'project', 'count()', 'avg(transaction.duration)', 'p75()', 'p95()'],
  orderby: '-count',
  query: 'event.type:transaction',
  projects: [],
  version: 2,
  range: '24h'
}];
const WEB_VITALS_VIEWS = [{
  id: undefined,
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Web Vitals'),
  fields: ['transaction', 'epm()', 'p75(measurements.fp)', 'p75(measurements.fcp)', 'p75(measurements.lcp)', 'p75(measurements.fid)', 'p75(measurements.cls)'],
  orderby: '-epm',
  query: 'event.type:transaction transaction.op:pageload',
  projects: [],
  version: 2,
  range: '24h',
  yAxis: ['epm()']
}];
const ALL_VIEWS = [DEFAULT_EVENT_VIEW, {
  id: undefined,
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Title'),
  fields: ['title', 'count()', 'count_unique(user)', 'project'],
  orderby: '-count',
  query: 'event.type:error',
  projects: [],
  version: 2,
  range: '24h',
  display: 'top5'
}, {
  id: undefined,
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by URL'),
  fields: ['url', 'count()', 'count_unique(issue)'],
  orderby: '-count',
  query: 'event.type:error has:url',
  projects: [],
  version: 2,
  range: '24h',
  display: 'top5'
}];

/***/ }),

/***/ "./app/views/eventsV2/savedQuery/utils.tsx":
/*!*************************************************!*\
  !*** ./app/views/eventsV2/savedQuery/utils.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "displayModeToDisplayType": () => (/* binding */ displayModeToDisplayType),
/* harmony export */   "extractAnalyticsQueryFields": () => (/* binding */ extractAnalyticsQueryFields),
/* harmony export */   "getAnalyticsCreateEventKeyName": () => (/* binding */ getAnalyticsCreateEventKeyName),
/* harmony export */   "handleCreateQuery": () => (/* binding */ handleCreateQuery),
/* harmony export */   "handleDeleteQuery": () => (/* binding */ handleDeleteQuery),
/* harmony export */   "handleUpdateQuery": () => (/* binding */ handleUpdateQuery),
/* harmony export */   "handleUpdateQueryName": () => (/* binding */ handleUpdateQueryName)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_discoverSavedQueries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/discoverSavedQueries */ "./app/actionCreators/discoverSavedQueries.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");






function handleCreateQuery(api, organization, eventView, yAxis) {
  let isNewQuery = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
  const payload = eventView.toNewQuery();
  payload.yAxis = yAxis;
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({ ...getAnalyticsCreateEventKeyName(isNewQuery, 'request'),
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload)
  });
  const promise = (0,sentry_actionCreators_discoverSavedQueries__WEBPACK_IMPORTED_MODULE_0__.createSavedQuery)(api, organization.slug, payload);
  promise.then(savedQuery => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query saved'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({ ...getAnalyticsCreateEventKeyName(isNewQuery, 'success'),
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload)
    });
    return savedQuery;
  }).catch(err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query not saved'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({ ...getAnalyticsCreateEventKeyName(isNewQuery, 'failed'),
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload),
      error: err && err.message || `Could not save a ${isNewQuery ? 'new' : 'existing'} query`
    });
  });
  return promise;
}
const EVENT_NAME_EXISTING_MAP = {
  request: 'Discoverv2: Request to save a saved query as a new query',
  success: 'Discoverv2: Successfully saved a saved query as a new query',
  failed: 'Discoverv2: Failed to save a saved query as a new query'
};
const EVENT_NAME_NEW_MAP = {
  request: 'Discoverv2: Request to save a new query',
  success: 'Discoverv2: Successfully saved a new query',
  failed: 'Discoverv2: Failed to save a new query'
};
function handleUpdateQuery(api, organization, eventView, yAxis) {
  const payload = eventView.toNewQuery();
  payload.yAxis = yAxis;

  if (!eventView.name) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Please name your query'));
    return Promise.reject();
  }

  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
    eventKey: 'discover_v2.update_query_request',
    eventName: 'Discoverv2: Request to update a saved query',
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload)
  });
  const promise = (0,sentry_actionCreators_discoverSavedQueries__WEBPACK_IMPORTED_MODULE_0__.updateSavedQuery)(api, organization.slug, payload);
  promise.then(savedQuery => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query updated'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.update_query_success',
      eventName: 'Discoverv2: Successfully updated a saved query',
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload)
    }); // NOTE: there is no need to convert _saved into an EventView and push it
    //       to the browser history, since this.props.eventView already
    //       derives from location.

    return savedQuery;
  }).catch(err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query not updated'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.update_query_failed',
      eventName: 'Discoverv2: Failed to update a saved query',
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload),
      error: err && err.message || 'Failed to update a query'
    });
  });
  return promise;
}
/**
 * Essentially the same as handleUpdateQuery, but specifically for changing the
 * name of the query
 */

function handleUpdateQueryName(api, organization, eventView) {
  const payload = eventView.toNewQuery();
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
    eventKey: 'discover_v2.update_query_name_request',
    eventName: "Discoverv2: Request to update a saved query's name",
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload)
  });
  const promise = (0,sentry_actionCreators_discoverSavedQueries__WEBPACK_IMPORTED_MODULE_0__.updateSavedQuery)(api, organization.slug, payload);
  promise.then(_saved => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query name saved'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.update_query_name_success',
      eventName: "Discoverv2: Successfully updated a saved query's name",
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload)
    });
  }).catch(err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query name not saved'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.update_query_failed',
      eventName: "Discoverv2: Failed to update a saved query's name",
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(payload),
      error: err && err.message || 'Failed to update a query name'
    });
  });
  return promise;
}
function handleDeleteQuery(api, organization, eventView) {
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
    eventKey: 'discover_v2.delete_query_request',
    eventName: 'Discoverv2: Request to delete a saved query',
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(eventView.toNewQuery())
  });
  const promise = (0,sentry_actionCreators_discoverSavedQueries__WEBPACK_IMPORTED_MODULE_0__.deleteSavedQuery)(api, organization.slug, eventView.id);
  promise.then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query deleted'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.delete_query_success',
      eventName: 'Discoverv2: Successfully deleted a saved query',
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(eventView.toNewQuery())
    });
  }).catch(err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Query not deleted'));
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_3__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.delete_query_failed',
      eventName: 'Discoverv2: Failed to delete a saved query',
      organization_id: parseInt(organization.id, 10),
      ...extractAnalyticsQueryFields(eventView.toNewQuery()),
      error: err && err.message || 'Failed to delete query'
    });
  });
  return promise;
}
function getAnalyticsCreateEventKeyName( // True if this is a brand new query being saved
// False if this is a modification from a saved query
isNewQuery, type) {
  const eventKey = isNewQuery ? 'discover_v2.save_new_query_' + type : 'discover_v2.save_existing_query_' + type;
  const eventName = isNewQuery ? EVENT_NAME_NEW_MAP[type] : EVENT_NAME_EXISTING_MAP[type];
  return {
    eventKey,
    eventName
  };
}
/**
 * Takes in a DiscoverV2 NewQuery object and returns a Partial containing
 * the desired fields to populate into reload analytics
 */

function extractAnalyticsQueryFields(payload) {
  const {
    projects,
    fields,
    query
  } = payload;
  return {
    projects,
    fields,
    query
  };
}
function displayModeToDisplayType(displayMode) {
  switch (displayMode) {
    case sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_4__.DisplayModes.BAR:
      return sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_5__.DisplayType.BAR;

    case sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_4__.DisplayModes.WORLDMAP:
      return sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_5__.DisplayType.WORLD_MAP;

    case sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_4__.DisplayModes.TOP5:
      return sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_5__.DisplayType.TOP_N;

    default:
      return sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_5__.DisplayType.LINE;
  }
}

/***/ }),

/***/ "./app/views/eventsV2/table/types.tsx":
/*!********************************************!*\
  !*** ./app/views/eventsV2/table/types.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FieldValueKind": () => (/* binding */ FieldValueKind)
/* harmony export */ });
/**
 * It is assumed that `aggregation` and `field` have the same ColumnValueType
 */
let FieldValueKind;

(function (FieldValueKind) {
  FieldValueKind["TAG"] = "tag";
  FieldValueKind["MEASUREMENT"] = "measurement";
  FieldValueKind["CUSTOM_MEASUREMENT"] = "custom_measurement";
  FieldValueKind["BREAKDOWN"] = "breakdown";
  FieldValueKind["FIELD"] = "field";
  FieldValueKind["FUNCTION"] = "function";
  FieldValueKind["EQUATION"] = "equation";
  FieldValueKind["METRICS"] = "metric";
  FieldValueKind["NUMERIC_METRICS"] = "numeric_metric";
})(FieldValueKind || (FieldValueKind = {}));

/***/ }),

/***/ "./app/views/eventsV2/utils.tsx":
/*!**************************************!*\
  !*** ./app/views/eventsV2/utils.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "constructAddQueryToDashboardLink": () => (/* binding */ constructAddQueryToDashboardLink),
/* harmony export */   "decodeColumnOrder": () => (/* binding */ decodeColumnOrder),
/* harmony export */   "downloadAsCsv": () => (/* binding */ downloadAsCsv),
/* harmony export */   "eventViewToWidgetQuery": () => (/* binding */ eventViewToWidgetQuery),
/* harmony export */   "generateFieldOptions": () => (/* binding */ generateFieldOptions),
/* harmony export */   "generateTitle": () => (/* binding */ generateTitle),
/* harmony export */   "getExpandedResults": () => (/* binding */ getExpandedResults),
/* harmony export */   "getPrebuiltQueries": () => (/* binding */ getPrebuiltQueries),
/* harmony export */   "handleAddQueryToDashboard": () => (/* binding */ handleAddQueryToDashboard),
/* harmony export */   "pushEventViewToLocation": () => (/* binding */ pushEventViewToLocation),
/* harmony export */   "setRenderPrebuilt": () => (/* binding */ setRenderPrebuilt),
/* harmony export */   "shouldRenderPrebuilt": () => (/* binding */ shouldRenderPrebuilt)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @sentry/utils */ "../node_modules/@sentry/utils/esm/object.js");
/* harmony import */ var papaparse__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! papaparse */ "../node_modules/papaparse/papaparse.min.js");
/* harmony import */ var papaparse__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(papaparse__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _savedQuery_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./savedQuery/utils */ "./app/views/eventsV2/savedQuery/utils.tsx");
/* harmony import */ var _table_types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./data */ "./app/views/eventsV2/data.tsx");





















const TEMPLATE_TABLE_COLUMN = {
  key: '',
  name: '',
  type: 'never',
  isSortable: false,
  column: Object.freeze({
    kind: 'field',
    field: ''
  }),
  width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__.COL_WIDTH_UNDEFINED
}; // TODO(mark) these types are coupled to the gridEditable component types and
// I'd prefer the types to be more general purpose but that will require a second pass.

function decodeColumnOrder(fields, useFullEquationAsKey) {
  let equations = 0;
  return fields.map(f => {
    const column = { ...TEMPLATE_TABLE_COLUMN
    };
    const col = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeFieldString)(f.field, f.alias);
    const columnName = f.field;

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.isEquation)(f.field)) {
      column.key = useFullEquationAsKey ? f.field : `equation[${equations}]`;
      column.name = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.getEquation)(columnName);
      equations += 1;
    } else {
      column.key = columnName;
      column.name = columnName;
    }

    column.width = f.width || sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_5__.COL_WIDTH_UNDEFINED;

    if (col.kind === 'function') {
      // Aggregations can have a strict outputType or they can inherit from their field.
      // Otherwise use the FIELDS data to infer types.
      const outputType = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.aggregateFunctionOutputType)(col.function[0], col.function[1]);

      if (outputType !== null) {
        column.type = outputType;
      }

      const aggregate = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.AGGREGATIONS[col.function[0]];
      column.isSortable = aggregate && aggregate.isSortable;
    } else if (col.kind === 'field') {
      if (sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.FIELDS.hasOwnProperty(col.field)) {
        column.type = sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.FIELDS[col.field].valueType;
      } else if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.isMeasurement)(col.field)) {
        column.type = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.measurementType)(col.field);
      } else if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.isSpanOperationBreakdownField)(col.field)) {
        column.type = 'duration';
      }
    }

    column.column = col;
    return column;
  });
}
function pushEventViewToLocation(props) {
  const {
    location,
    nextEventView
  } = props;
  const extraQuery = props.extraQuery || {};
  const queryStringObject = nextEventView.generateQueryStringObject();
  react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({ ...location,
    query: { ...extraQuery,
      ...queryStringObject
    }
  });
}
function generateTitle(_ref) {
  let {
    eventView,
    event,
    organization
  } = _ref;
  const titles = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Discover')];
  const eventViewName = eventView.name;

  if (typeof eventViewName === 'string' && String(eventViewName).trim().length > 0) {
    titles.push(String(eventViewName).trim());
  }

  const eventTitle = event ? (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_12__.getTitle)(event, organization === null || organization === void 0 ? void 0 : organization.features).title : undefined;

  if (eventTitle) {
    titles.push(eventTitle);
  }

  titles.reverse();
  return titles.join(' - ');
}
function getPrebuiltQueries(organization) {
  const views = [..._data__WEBPACK_IMPORTED_MODULE_19__.ALL_VIEWS];

  if (organization.features.includes('performance-view')) {
    // insert transactions queries at index 2
    views.splice(2, 0, ..._data__WEBPACK_IMPORTED_MODULE_19__.TRANSACTION_VIEWS);
    views.push(..._data__WEBPACK_IMPORTED_MODULE_19__.WEB_VITALS_VIEWS);
  }

  return views;
}

function disableMacros(value) {
  const unsafeCharacterRegex = /^[\=\+\-\@]/;

  if (typeof value === 'string' && `${value}`.match(unsafeCharacterRegex)) {
    return `'${value}`;
  }

  return value;
}

function downloadAsCsv(tableData, columnOrder, filename) {
  const {
    data
  } = tableData;
  const headings = columnOrder.map(column => column.name);
  const keys = columnOrder.map(column => column.key);
  const csvContent = papaparse__WEBPACK_IMPORTED_MODULE_3__.unparse({
    fields: headings,
    data: data.map(row => keys.map(key => {
      return disableMacros(row[key]);
    }))
  }); // Need to also manually replace # since encodeURI skips them

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`; // Create a download link then click it, this is so we can get a filename

  const link = document.createElement('a');
  const now = new Date();
  link.setAttribute('href', encodedDataUrl);
  link.setAttribute('download', `${filename} ${(0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_9__.getUtcDateString)(now)}.csv`);
  link.click();
  link.remove(); // Make testing easier

  return encodedDataUrl;
}
const ALIASED_AGGREGATES_COLUMN = {
  last_seen: 'timestamp',
  failure_count: 'transaction.status'
};
/**
 * Convert an aggregate into the resulting column from a drilldown action.
 * The result is null if the drilldown results in the aggregate being removed.
 */

function drilldownAggregate(func) {
  var _aggregation$paramete;

  const key = func.function[0];
  const aggregation = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.AGGREGATIONS[key];
  let column = func.function[1];

  if (ALIASED_AGGREGATES_COLUMN.hasOwnProperty(key)) {
    // Some aggregates are just shortcuts to other aggregates with
    // predefined arguments so we can directly map them to the result.
    column = ALIASED_AGGREGATES_COLUMN[key];
  } else if (aggregation !== null && aggregation !== void 0 && (_aggregation$paramete = aggregation.parameters) !== null && _aggregation$paramete !== void 0 && _aggregation$paramete[0]) {
    const parameter = aggregation.parameters[0];

    if (parameter.kind !== 'column') {
      // The aggregation does not accept a column as a parameter,
      // so we clear the column.
      column = '';
    } else if (!column && parameter.required === false) {
      // The parameter was not given for a non-required parameter,
      // so we fall back to the default.
      column = parameter.defaultValue;
    }
  } else {
    // The aggregation does not exist or does not have any parameters,
    // so we clear the column.
    column = '';
  }

  return column ? {
    kind: 'field',
    field: column
  } : null;
}
/**
 * Convert an aggregated query into one that does not have aggregates.
 * Will also apply additions conditions defined in `additionalConditions`
 * and generate conditions based on the `dataRow` parameter and the current fields
 * in the `eventView`.
 */


function getExpandedResults(eventView, additionalConditions, dataRow) {
  const fieldSet = new Set(); // Expand any functions in the resulting column, and dedupe the result.
  // Mark any column as null to remove it.

  const expandedColumns = eventView.fields.map(field => {
    const exploded = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeFieldString)(field.field, field.alias);
    const column = exploded.kind === 'function' ? drilldownAggregate(exploded) : exploded;

    if ( // if expanding the function failed
    column === null || // the new column is already present
    fieldSet.has(column.field) || // Skip aggregate equations, their functions will already be added so we just want to remove it
    (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.isAggregateEquation)(field.field)) {
      return null;
    }

    fieldSet.add(column.field);
    return column;
  }); // id should be default column when expanded results in no columns; but only if
  // the Discover query's columns is non-empty.
  // This typically occurs in Discover drilldowns.

  if (fieldSet.size === 0 && expandedColumns.length) {
    expandedColumns[0] = {
      kind: 'field',
      field: 'id'
    };
  } // update the columns according the the expansion above


  const nextView = expandedColumns.reduceRight((newView, column, index) => column === null ? newView.withDeletedColumn(index, undefined) : newView.withUpdatedColumn(index, column, undefined), eventView.clone());
  nextView.query = generateExpandedConditions(nextView, additionalConditions, dataRow);
  return nextView;
}
/**
 * Create additional conditions based on the fields in an EventView
 * and a datarow/event
 */

function generateAdditionalConditions(eventView, dataRow) {
  const specialKeys = Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_6__.URL_PARAM);
  const conditions = {};

  if (!dataRow) {
    return conditions;
  }

  eventView.fields.forEach(field => {
    const column = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeFieldString)(field.field, field.alias); // Skip aggregate fields

    if (column.kind === 'function') {
      return;
    }

    const dataKey = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.getAggregateAlias)(field.field); // Append the current field as a condition if it exists in the dataRow
    // Or is a simple key in the event. More complex deeply nested fields are
    // more challenging to get at as their location in the structure does not
    // match their name.

    if (dataRow.hasOwnProperty(dataKey)) {
      let value = dataRow[dataKey];

      if (Array.isArray(value)) {
        if (value.length > 1) {
          conditions[column.field] = value;
          return;
        } // An array with only one value is equivalent to the value itself.


        value = value[0];
      } // if the value will be quoted, then do not trim it as the whitespaces
      // may be important to the query and should not be trimmed


      const shouldQuote = value === null || value === undefined ? false : /[\s\(\)\\"]/g.test(String(value).trim());
      const nextValue = value === null || value === undefined ? '' : shouldQuote ? String(value) : String(value).trim();

      if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.isMeasurement)(column.field) && !nextValue) {
        // Do not add measurement conditions if nextValue is falsey.
        // It's expected that nextValue is a numeric value.
        return;
      }

      switch (column.field) {
        case 'timestamp':
          // normalize the "timestamp" field to ensure the payload works
          conditions[column.field] = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_9__.getUtcDateString)(nextValue);
          break;

        default:
          conditions[column.field] = nextValue;
      }
    } // If we have an event, check tags as well.


    if (dataRow.tags && Array.isArray(dataRow.tags)) {
      const tagIndex = dataRow.tags.findIndex(item => item.key === dataKey);

      if (tagIndex > -1) {
        const key = specialKeys.includes(column.field) ? `tags[${column.field}]` : column.field;
        const tagValue = dataRow.tags[tagIndex].value;
        conditions[key] = tagValue;
      }
    }
  });
  return conditions;
}

function generateExpandedConditions(eventView, additionalConditions, dataRow) {
  const parsedQuery = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_15__.MutableSearch(eventView.query); // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.

  for (const key in parsedQuery.filters) {
    const column = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeFieldString)(key);

    if (column.kind === 'function') {
      parsedQuery.removeFilter(key);
    }
  }

  const conditions = Object.assign({}, additionalConditions, generateAdditionalConditions(eventView, dataRow)); // Add additional conditions provided and generated.

  for (const key in conditions) {
    const value = conditions[key];

    if (Array.isArray(value)) {
      parsedQuery.setFilterValues(key, value);
      continue;
    }

    if (key === 'project.id') {
      eventView.project = [...eventView.project, parseInt(value, 10)];
      continue;
    }

    if (key === 'environment') {
      if (!eventView.environment.includes(value)) {
        eventView.environment = [...eventView.environment, value];
      }

      continue;
    }

    const column = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeFieldString)(key); // Skip aggregates as they will be invalid.

    if (column.kind === 'function') {
      continue;
    }

    parsedQuery.setFilterValues(key, [value]);
  }

  return parsedQuery.formatString();
}

function generateFieldOptions(_ref2) {
  let {
    organization,
    tagKeys,
    measurementKeys,
    spanOperationBreakdownKeys,
    customMeasurements,
    aggregations = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.AGGREGATIONS,
    fieldKeys = sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.DISCOVER_FIELDS
  } = _ref2;
  let functions = Object.keys(aggregations); // Strip tracing features if the org doesn't have access.

  if (!organization.features.includes('performance-view')) {
    fieldKeys = fieldKeys.filter(item => !sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.TRACING_FIELDS.includes(item));
    functions = functions.filter(item => !sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.TRACING_FIELDS.includes(item));
  }

  const fieldOptions = {}; // Index items by prefixed keys as custom tags can overlap both fields and
  // function names. Having a mapping makes finding the value objects easier
  // later as well.

  functions.forEach(func => {
    const ellipsis = aggregations[func].parameters.length ? '\u2026' : '';
    const parameters = aggregations[func].parameters.map(param => {
      const overrides = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.AGGREGATIONS[func].getFieldOverrides;

      if (typeof overrides === 'undefined') {
        return param;
      }

      return { ...param,
        ...overrides({
          parameter: param
        })
      };
    });
    fieldOptions[`function:${func}`] = {
      label: `${func}(${ellipsis})`,
      value: {
        kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.FUNCTION,
        meta: {
          name: func,
          parameters
        }
      }
    };
  });
  fieldKeys.forEach(field => {
    var _getFieldDefinition$v, _getFieldDefinition;

    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.FIELD,
        meta: {
          name: field,
          dataType: (_getFieldDefinition$v = (_getFieldDefinition = (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.getFieldDefinition)(field)) === null || _getFieldDefinition === void 0 ? void 0 : _getFieldDefinition.valueType) !== null && _getFieldDefinition$v !== void 0 ? _getFieldDefinition$v : sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.FieldValueType.STRING
        }
      }
    };
  });

  if (measurementKeys !== undefined && measurementKeys !== null) {
    measurementKeys.sort();
    measurementKeys.forEach(measurement => {
      fieldOptions[`measurement:${measurement}`] = {
        label: measurement,
        value: {
          kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.MEASUREMENT,
          meta: {
            name: measurement,
            dataType: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.measurementType)(measurement)
          }
        }
      };
    });
  }

  if (customMeasurements !== undefined && customMeasurements !== null) {
    customMeasurements.sort((_ref3, _ref4) => {
      let {
        key: currentKey
      } = _ref3;
      let {
        key: nextKey
      } = _ref4;
      return currentKey > nextKey ? 1 : currentKey === nextKey ? 0 : -1;
    });
    customMeasurements.forEach(_ref5 => {
      let {
        key,
        functions: supportedFunctions
      } = _ref5;
      fieldOptions[`measurement:${key}`] = {
        label: key,
        value: {
          kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.CUSTOM_MEASUREMENT,
          meta: {
            name: key,
            dataType: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.measurementType)(key),
            functions: supportedFunctions
          }
        }
      };
    });
  }

  if (Array.isArray(spanOperationBreakdownKeys)) {
    spanOperationBreakdownKeys.sort();
    spanOperationBreakdownKeys.forEach(breakdownField => {
      fieldOptions[`span_op_breakdown:${breakdownField}`] = {
        label: breakdownField,
        value: {
          kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.BREAKDOWN,
          meta: {
            name: breakdownField,
            dataType: 'duration'
          }
        }
      };
    });
  }

  if (tagKeys !== undefined && tagKeys !== null) {
    tagKeys.sort();
    tagKeys.forEach(tag => {
      const tagValue = fieldKeys.includes(tag) || sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.AGGREGATIONS.hasOwnProperty(tag) ? `tags[${tag}]` : tag;
      fieldOptions[`tag:${tag}`] = {
        label: tag,
        value: {
          kind: _table_types__WEBPACK_IMPORTED_MODULE_18__.FieldValueKind.TAG,
          meta: {
            name: tagValue,
            dataType: 'string'
          }
        }
      };
    });
  }

  return fieldOptions;
}
const RENDER_PREBUILT_KEY = 'discover-render-prebuilt';
function shouldRenderPrebuilt() {
  const shouldRender = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_14__["default"].getItem(RENDER_PREBUILT_KEY);
  return shouldRender === 'true' || shouldRender === null;
}
function setRenderPrebuilt(value) {
  sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_14__["default"].setItem(RENDER_PREBUILT_KEY, value ? 'true' : 'false');
}
function eventViewToWidgetQuery(_ref6) {
  let {
    eventView,
    yAxis,
    displayType,
    widgetBuilderNewDesign
  } = _ref6;
  const fields = eventView.fields.map(_ref7 => {
    let {
      field
    } = _ref7;
    return field;
  });
  const {
    columns,
    aggregates
  } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.getColumnsAndAggregates)(fields);
  const sort = eventView.sorts[0];
  const queryYAxis = typeof yAxis === 'string' ? [yAxis] : yAxis !== null && yAxis !== void 0 ? yAxis : ['count()'];
  let orderby = ''; // The orderby should only be set to sort.field if it is a Top N query
  // since the query uses all of the fields, or if the ordering is used in the y-axis

  if (sort && displayType !== _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.WORLD_MAP) {
    let orderbyFunction = '';
    const aggregateFields = [...queryYAxis, ...aggregates];

    for (let i = 0; i < aggregateFields.length; i++) {
      if (sort.field === (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.getAggregateAlias)(aggregateFields[i])) {
        orderbyFunction = aggregateFields[i];
        break;
      }
    }

    const bareOrderby = orderbyFunction === '' ? sort.field : orderbyFunction;

    if (displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N || bareOrderby) {
      orderby = `${sort.kind === 'desc' ? '-' : ''}${bareOrderby}`;
    }
  }

  let newAggregates = aggregates;

  if (widgetBuilderNewDesign && displayType !== _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TABLE) {
    newAggregates = queryYAxis;
  } else if (!widgetBuilderNewDesign) {
    newAggregates = [...(displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? aggregates : []), ...queryYAxis];
  }

  const widgetQuery = {
    name: '',
    aggregates: newAggregates,
    columns: [...(displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? columns : [])],
    fields: [...(displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? fields : []), ...queryYAxis],
    conditions: eventView.query,
    orderby
  };
  return widgetQuery;
}
function handleAddQueryToDashboard(_ref8) {
  var _query$name2;

  let {
    eventView,
    location,
    query,
    organization,
    router,
    yAxis
  } = _ref8;
  const displayType = (0,_savedQuery_utils__WEBPACK_IMPORTED_MODULE_17__.displayModeToDisplayType)(eventView.display);
  const defaultTableFields = eventView.fields.map(_ref9 => {
    let {
      field
    } = _ref9;
    return field;
  });
  const defaultWidgetQuery = eventViewToWidgetQuery({
    eventView,
    displayType,
    yAxis,
    widgetBuilderNewDesign: organization.features.includes('new-widget-builder-experience-design')
  });

  if (organization.features.includes('new-widget-builder-experience-design')) {
    var _query$name;

    const {
      query: widgetAsQueryParams
    } = constructAddQueryToDashboardLink({
      eventView,
      query,
      organization,
      yAxis,
      location
    });
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openAddToDashboardModal)({
      organization,
      selection: {
        projects: eventView.project,
        environments: eventView.environment,
        datetime: {
          start: eventView.start,
          end: eventView.end,
          period: eventView.statsPeriod,
          utc: eventView.utc
        }
      },
      widget: {
        title: (_query$name = query === null || query === void 0 ? void 0 : query.name) !== null && _query$name !== void 0 ? _query$name : eventView.name,
        displayType: organization.features.includes('new-widget-builder-experience-design') && displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.AREA : displayType,
        queries: [{ ...defaultWidgetQuery,
          aggregates: [...(typeof yAxis === 'string' ? [yAxis] : yAxis !== null && yAxis !== void 0 ? yAxis : ['count()'])]
        }],
        interval: eventView.interval,
        limit: organization.features.includes('new-widget-builder-experience-design') && displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? Number(eventView.topEvents) || sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_11__.TOP_N : undefined
      },
      router,
      widgetAsQueryParams,
      location
    });
    return;
  }

  (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openAddDashboardWidgetModal)({
    organization,
    start: eventView.start,
    end: eventView.end,
    statsPeriod: eventView.statsPeriod,
    source: _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DashboardWidgetSource.DISCOVERV2,
    defaultWidgetQuery,
    defaultTableColumns: defaultTableFields,
    defaultTitle: (_query$name2 = query === null || query === void 0 ? void 0 : query.name) !== null && _query$name2 !== void 0 ? _query$name2 : eventView.name !== 'All Events' ? eventView.name : undefined,
    displayType
  });
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('discover_views.add_to_dashboard.modal_open', {
    organization,
    saved_query: !!query
  });
}
function constructAddQueryToDashboardLink(_ref10) {
  var _query$name3;

  let {
    eventView,
    query,
    organization,
    yAxis,
    location
  } = _ref10;
  const displayType = (0,_savedQuery_utils__WEBPACK_IMPORTED_MODULE_17__.displayModeToDisplayType)(eventView.display);
  const defaultTableFields = eventView.fields.map(_ref11 => {
    let {
      field
    } = _ref11;
    return field;
  });
  const defaultWidgetQuery = eventViewToWidgetQuery({
    eventView,
    displayType,
    yAxis,
    widgetBuilderNewDesign: organization.features.includes('new-widget-builder-experience-design')
  });
  const defaultTitle = (_query$name3 = query === null || query === void 0 ? void 0 : query.name) !== null && _query$name3 !== void 0 ? _query$name3 : eventView.name !== 'All Events' ? eventView.name : undefined;
  return {
    pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      source: _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DashboardWidgetSource.DISCOVERV2,
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
      defaultWidgetQuery: (0,_sentry_utils__WEBPACK_IMPORTED_MODULE_20__.urlEncode)(defaultWidgetQuery),
      defaultTableColumns: defaultTableFields,
      defaultTitle,
      displayType: organization.features.includes('new-widget-builder-experience-design') && displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.AREA : displayType,
      limit: organization.features.includes('new-widget-builder-experience-design') && displayType === _dashboardsV2_types__WEBPACK_IMPORTED_MODULE_16__.DisplayType.TOP_N ? Number(eventView.topEvents) || sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_11__.TOP_N : undefined
    }
  };
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/filter.tsx":
/*!*************************************************************!*\
  !*** ./app/views/performance/transactionSummary/filter.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD": () => (/* binding */ SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD),
/* harmony export */   "SpanOperationBreakdownFilter": () => (/* binding */ SpanOperationBreakdownFilter),
/* harmony export */   "decodeFilterFromLocation": () => (/* binding */ decodeFilterFromLocation),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "filterToColor": () => (/* binding */ filterToColor),
/* harmony export */   "filterToField": () => (/* binding */ filterToField),
/* harmony export */   "filterToLocationQuery": () => (/* binding */ filterToLocationQuery),
/* harmony export */   "filterToSearchConditions": () => (/* binding */ filterToSearchConditions),
/* harmony export */   "spanOperationBreakdownSingleColumns": () => (/* binding */ spanOperationBreakdownSingleColumns),
/* harmony export */   "stringToFilter": () => (/* binding */ stringToFilter)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _transactionOverview_latencyChart_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./transactionOverview/latencyChart/utils */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










 // Make sure to update other instances like trends column fields, discover field types.


let SpanOperationBreakdownFilter;

(function (SpanOperationBreakdownFilter) {
  SpanOperationBreakdownFilter["None"] = "none";
  SpanOperationBreakdownFilter["Http"] = "http";
  SpanOperationBreakdownFilter["Db"] = "db";
  SpanOperationBreakdownFilter["Browser"] = "browser";
  SpanOperationBreakdownFilter["Resource"] = "resource";
  SpanOperationBreakdownFilter["Ui"] = "ui";
})(SpanOperationBreakdownFilter || (SpanOperationBreakdownFilter = {}));

const SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD = {
  [SpanOperationBreakdownFilter.Http]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__.SpanOpBreakdown.SpansHttp,
  [SpanOperationBreakdownFilter.Db]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__.SpanOpBreakdown.SpansDb,
  [SpanOperationBreakdownFilter.Browser]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__.SpanOpBreakdown.SpansBrowser,
  [SpanOperationBreakdownFilter.Resource]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__.SpanOpBreakdown.SpansResource,
  [SpanOperationBreakdownFilter.Ui]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_8__.SpanOpBreakdown.SpansUi
};
const OPTIONS = [SpanOperationBreakdownFilter.Http, SpanOperationBreakdownFilter.Db, SpanOperationBreakdownFilter.Browser, SpanOperationBreakdownFilter.Resource, SpanOperationBreakdownFilter.Ui];
const spanOperationBreakdownSingleColumns = OPTIONS.map(o => `spans.${o}`);

function Filter(props) {
  const {
    currentFilter,
    onChangeFilter,
    organization
  } = props;

  if (!organization.features.includes('performance-ops-breakdown')) {
    return null;
  }

  const menuOptions = OPTIONS.map(operationName => ({
    value: operationName,
    label: operationName,
    leadingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(OperationDot, {
      backgroundColor: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.pickBarColor)(operationName)
    })
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_2__["default"], {
    target: "span_op_breakdowns_filter",
    position: "top",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_3__["default"], {
      isClearable: true,
      menuTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Filter by operation'),
      options: menuOptions,
      value: currentFilter,
      onChange: opt => onChangeFilter(opt === null || opt === void 0 ? void 0 : opt.value),
      triggerProps: {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconFilter, {})
      },
      triggerLabel: currentFilter === SpanOperationBreakdownFilter.None ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Filter') : currentFilter
    })
  });
}

Filter.displayName = "Filter";

const OperationDot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lbjjs50"
} : 0)("display:block;width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";border-radius:100%;background-color:", p => p.backgroundColor, ";" + ( true ? "" : 0));

function filterToField(option) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return undefined;

    default:
      {
        return `spans.${option}`;
      }
  }
}
function filterToSearchConditions(option, location) {
  let field = filterToField(option);

  if (!field) {
    field = 'transaction.duration';
  } // Add duration search conditions implicitly


  const {
    min,
    max
  } = (0,_transactionOverview_latencyChart_utils__WEBPACK_IMPORTED_MODULE_10__.decodeHistogramZoom)(location);
  let query = '';

  if (typeof min === 'number') {
    query = `${query} ${field}:>${min}ms`;
  }

  if (typeof max === 'number') {
    query = `${query} ${field}:<${max}ms`;
  }

  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return query ? query.trim() : undefined;

    default:
      {
        return `${query} has:${filterToField(option)}`.trim();
      }
  }
}
function filterToColor(option) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.pickBarColor)('');

    default:
      {
        return (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_4__.pickBarColor)(option);
      }
  }
}
function stringToFilter(option) {
  if (Object.values(SpanOperationBreakdownFilter).includes(option)) {
    return option;
  }

  return SpanOperationBreakdownFilter.None;
}
function decodeFilterFromLocation(location) {
  return stringToFilter((0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.breakdown, SpanOperationBreakdownFilter.None));
}
function filterToLocationQuery(option) {
  return {
    breakdown: option
  };
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Filter);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ZOOM_END": () => (/* binding */ ZOOM_END),
/* harmony export */   "ZOOM_START": () => (/* binding */ ZOOM_START),
/* harmony export */   "decodeHistogramZoom": () => (/* binding */ decodeHistogramZoom)
/* harmony export */ });
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");

const ZOOM_START = 'startDuration';
const ZOOM_END = 'endDuration';
function decodeHistogramZoom(location) {
  let min = undefined;
  let max = undefined;

  if (ZOOM_START in location.query) {
    min = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_0__.decodeInteger)(location.query[ZOOM_START], 0);
  }

  if (ZOOM_END in location.query) {
    const decodedMax = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_0__.decodeInteger)(location.query[ZOOM_END]);

    if (typeof decodedMax === 'number') {
      max = decodedMax;
    }
  }

  return {
    min,
    max
  };
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_utils_tsx-app_utils_discover_eventView_tsx-app_utils_withPageFilters_tsx.422fd7fcf37806addd0676b3861915bf.js.map