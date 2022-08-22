"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_projects_tsx-app_components_modals_inviteMembersModal_index_tsx-app_stores-242ade"],{

/***/ "./app/actionCreators/projects.tsx":
/*!*****************************************!*\
  !*** ./app/actionCreators/projects.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "_debouncedLoadStats": () => (/* binding */ _debouncedLoadStats),
/* harmony export */   "addTeamToProject": () => (/* binding */ addTeamToProject),
/* harmony export */   "changeProjectSlug": () => (/* binding */ changeProjectSlug),
/* harmony export */   "createProject": () => (/* binding */ createProject),
/* harmony export */   "fetchAnyReleaseExistence": () => (/* binding */ fetchAnyReleaseExistence),
/* harmony export */   "fetchProjectsCount": () => (/* binding */ fetchProjectsCount),
/* harmony export */   "loadDocs": () => (/* binding */ loadDocs),
/* harmony export */   "loadStats": () => (/* binding */ loadStats),
/* harmony export */   "loadStatsForProject": () => (/* binding */ loadStatsForProject),
/* harmony export */   "removeProject": () => (/* binding */ removeProject),
/* harmony export */   "removeTeamFromProject": () => (/* binding */ removeTeamFromProject),
/* harmony export */   "sendSampleEvent": () => (/* binding */ sendSampleEvent),
/* harmony export */   "setActiveProject": () => (/* binding */ setActiveProject),
/* harmony export */   "transferProject": () => (/* binding */ transferProject),
/* harmony export */   "update": () => (/* binding */ update)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_chunk__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/chunk */ "../node_modules/lodash/chunk.js");
/* harmony import */ var lodash_chunk__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_chunk__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/projectsStatsStore */ "./app/stores/projectsStatsStore.tsx");








function update(api, params) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].update(params.projectId, params.data);
  const endpoint = `/projects/${params.orgId}/${params.projectId}/`;
  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: params.data
  }).then(data => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(data);
    return data;
  }, err => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateError(err, params.projectId);
    throw err;
  });
}
function loadStats(api, params) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStats(params.orgId, params.data);
  const endpoint = `/organizations/${params.orgId}/stats/`;
  api.request(endpoint, {
    query: params.query,
    success: data => {
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsSuccess(data);
    },
    error: data => {
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsError(data);
    }
  });
} // This is going to queue up a list of project ids we need to fetch stats for
// Will be cleared when debounced function fires

const _projectStatsToFetch = new Set(); // Max projects to query at a time, otherwise if we fetch too many in the same request
// it can timeout


const MAX_PROJECTS_TO_FETCH = 10;

const _queryForStats = (api, projects, orgId, additionalQuery) => {
  const idQueryParams = projects.map(project => `id:${project}`).join(' ');
  const endpoint = `/organizations/${orgId}/projects/`;
  const query = {
    statsPeriod: '24h',
    query: idQueryParams,
    ...additionalQuery
  };
  return api.requestPromise(endpoint, {
    query
  });
};

const _debouncedLoadStats = lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()((api, projectSet, params) => {
  const storedProjects = sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_7__["default"].getAll();
  const existingProjectStats = Object.values(storedProjects).map(_ref => {
    let {
      id
    } = _ref;
    return id;
  });
  const projects = Array.from(projectSet).filter(project => !existingProjectStats.includes(project));

  if (!projects.length) {
    _projectStatsToFetch.clear();

    return;
  } // Split projects into more manageable chunks to query, otherwise we can
  // potentially face server timeouts


  const queries = lodash_chunk__WEBPACK_IMPORTED_MODULE_2___default()(projects, MAX_PROJECTS_TO_FETCH).map(chunkedProjects => _queryForStats(api, chunkedProjects, params.orgId, params.query));
  Promise.all(queries).then(results => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadStatsForProjectSuccess(results.reduce((acc, result) => acc.concat(result), []));
  }).catch(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Unable to fetch all project stats'));
  }); // Reset projects list

  _projectStatsToFetch.clear();
}, 50);
function loadStatsForProject(api, project, params) {
  // Queue up a list of projects that we need stats for
  // and call a debounced function to fetch stats for list of projects
  _projectStatsToFetch.add(project);

  _debouncedLoadStats(api, _projectStatsToFetch, params);
}
function setActiveProject(project) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].setActive(project);
}
function removeProject(api, orgId, project) {
  const endpoint = `/projects/${orgId}/${project.slug}/`;
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProject(project);
  return api.requestPromise(endpoint, {
    method: 'DELETE'
  }).then(() => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProjectSuccess(project);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[project] was successfully removed', {
      project: project.slug
    }));
  }, err => {
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeProjectError(project);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error removing [project]', {
      project: project.slug
    }));
    throw err;
  });
}
function transferProject(api, orgId, project, email) {
  const endpoint = `/projects/${orgId}/${project.slug}/transfer/`;
  return api.requestPromise(endpoint, {
    method: 'POST',
    data: {
      email
    }
  }).then(() => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('A request was sent to move [project] to a different organization', {
      project: project.slug
    }));
  }, err => {
    let message = ''; // Handle errors with known failures

    if (err.status >= 400 && err.status < 500 && err.responseJSON) {
      var _err$responseJSON;

      message = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail;
    }

    if (message) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error transferring [project]. [message]', {
        project: project.slug,
        message
      }));
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Error transferring [project]', {
        project: project.slug
      }));
    }

    throw err;
  });
}
/**
 * Associate a team with a project
 */

/**
 *  Adds a team to a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param team Team data object
 */

function addTeamToProject(api, orgSlug, projectSlug, team) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${team.slug}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeam(team);
  return api.requestPromise(endpoint, {
    method: 'POST'
  }).then(project => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[team] has been added to the [project] project', {
      team: `#${team.slug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeamSuccess(team, projectSlug);
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(project);
  }, err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Unable to add [team] to the [project] project', {
      team: `#${team.slug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].addTeamError();
    throw err;
  });
}
/**
 * Removes a team from a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param teamSlug Team Slug
 */

function removeTeamFromProject(api, orgSlug, projectSlug, teamSlug) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/teams/${teamSlug}/`;
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)();
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeam(teamSlug);
  return api.requestPromise(endpoint, {
    method: 'DELETE'
  }).then(project => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('[team] has been removed from the [project] project', {
      team: `#${teamSlug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeamSuccess(teamSlug, projectSlug);
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].updateSuccess(project);
  }, err => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('Unable to remove [team] from the [project] project', {
      team: `#${teamSlug}`,
      project: projectSlug
    }));
    sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].removeTeamError(err);
    throw err;
  });
}
/**
 * Change a project's slug
 *
 * @param prev Previous slug
 * @param next New slug
 */

function changeProjectSlug(prev, next) {
  sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_5__["default"].changeSlug(prev, next);
}
/**
 * Send a sample event
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 */

function sendSampleEvent(api, orgSlug, projectSlug) {
  const endpoint = `/projects/${orgSlug}/${projectSlug}/create-sample/`;
  return api.requestPromise(endpoint, {
    method: 'POST'
  });
}
/**
 * Creates a project
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param team The team slug to assign the project to
 * @param name Name of the project
 * @param platform The platform key of the project
 * @param options Additional options such as creating default alert rules
 */

function createProject(api, orgSlug, team, name, platform) {
  let options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
  return api.requestPromise(`/teams/${orgSlug}/${team}/projects/`, {
    method: 'POST',
    data: {
      name,
      platform,
      default_rules: options.defaultRules
    }
  });
}
/**
 * Load platform documentation specific to the project. The DSN and various
 * other project specific secrets will be included in the documentation.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectSlug Project Slug
 * @param platform Project platform.
 */

function loadDocs(api, orgSlug, projectSlug, platform) {
  return api.requestPromise(`/projects/${orgSlug}/${projectSlug}/docs/${platform}/`);
}
/**
 * Load the counts of my projects and all projects for the current user
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 */

function fetchProjectsCount(api, orgSlug) {
  return api.requestPromise(`/organizations/${orgSlug}/projects-count/`);
}
/**
 * Check if there are any releases in the last 90 days.
 * Used for checking if project is using releases.
 *
 * @param api API Client
 * @param orgSlug Organization Slug
 * @param projectId Project Id
 */

async function fetchAnyReleaseExistence(api, orgSlug, projectId) {
  const data = await api.requestPromise(`/organizations/${orgSlug}/releases/stats/`, {
    method: 'GET',
    query: {
      statsPeriod: '90d',
      project: projectId,
      per_page: 1
    }
  });
  return data.length > 0;
}

/***/ }),

/***/ "./app/actions/organizationActions.tsx":
/*!*********************************************!*\
  !*** ./app/actions/organizationActions.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const OrganizationActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['reset', 'fetchOrgError', 'update']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationActions);

/***/ }),

/***/ "./app/actions/organizationsActions.tsx":
/*!**********************************************!*\
  !*** ./app/actions/organizationsActions.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const OrganizationsActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['update', 'setActive', 'changeSlug', 'remove', 'removeSuccess', 'removeError']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationsActions);

/***/ }),

/***/ "./app/actions/projectActions.tsx":
/*!****************************************!*\
  !*** ./app/actions/projectActions.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const ProjectActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['addTeam', 'addTeamError', 'addTeamSuccess', 'changeSlug', 'createSuccess', 'loadProjects', 'loadStats', 'loadStatsError', 'loadStatsForProjectSuccess', 'loadStatsSuccess', 'removeProject', 'removeProjectError', 'removeProjectSuccess', 'removeTeam', 'removeTeamError', 'removeTeamSuccess', 'reset', 'setActive', 'update', 'updateError', 'updateSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectActions);

/***/ }),

/***/ "./app/components/hookOrDefault.tsx":
/*!******************************************!*\
  !*** ./app/components/hookOrDefault.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Use this instead of the usual ternery operator when using getsentry hooks.
 * So in lieu of:
 *
 *  HookStore.get('component:org-auth-view').length
 *   ? HookStore.get('component:org-auth-view')[0]()
 *   : OrganizationAuth
 *
 * do this instead:
 *
 *   const HookedOrganizationAuth = HookOrDefault({
 *     hookName:'component:org-auth-view',
 *     defaultComponent: OrganizationAuth,
 *   })
 *
 * Note, you will need to add the hookstore function in getsentry [0] first and
 * then register the types [2] and validHookName [1] in sentry.
 *
 * [0] /getsentry/static/getsentry/gsApp/registerHooks.jsx
 * [1] /sentry/app/stores/hookStore.tsx
 * [2] /sentry/app/types/hooks.ts
 */
function HookOrDefault(_ref) {
  let {
    hookName,
    defaultComponent,
    defaultComponentPromise
  } = _ref;

  class HookOrDefaultComponent extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        hooks: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(hookName)
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unlistener", sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen((name, hooks) => name === hookName && this.setState({
        hooks
      }), undefined));
    }

    componentWillUnmount() {
      var _this$unlistener;

      (_this$unlistener = this.unlistener) === null || _this$unlistener === void 0 ? void 0 : _this$unlistener.call(this);
    }

    get defaultComponent() {
      // If `defaultComponentPromise` is passed, then return a Suspended component
      if (defaultComponentPromise) {
        const DefaultComponent = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.lazy)(defaultComponentPromise);
        return props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Suspense, {
          fallback: null,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(DefaultComponent, { ...props
          })
        });
      }

      return defaultComponent;
    }

    render() {
      var _this$state$hooks$, _this$state$hooks;

      const hookExists = this.state.hooks && this.state.hooks.length;
      const componentFromHook = (_this$state$hooks$ = (_this$state$hooks = this.state.hooks)[0]) === null || _this$state$hooks$ === void 0 ? void 0 : _this$state$hooks$.call(_this$state$hooks);
      const HookComponent = hookExists && componentFromHook ? componentFromHook : this.defaultComponent;
      return HookComponent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(HookComponent, { ...this.props
      }) : null;
    }

  }

  HookOrDefaultComponent.displayName = "HookOrDefaultComponent";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(HookOrDefaultComponent, "displayName", `HookOrDefaultComponent(${hookName})`);

  return HookOrDefaultComponent;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HookOrDefault);

/***/ }),

/***/ "./app/components/modals/inviteMembersModal/index.tsx":
/*!************************************************************!*\
  !*** ./app/components/modals/inviteMembersModal/index.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var _inviteRowControl__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./inviteRowControl */ "./app/components/modals/inviteMembersModal/inviteRowControl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const DEFAULT_ROLE = 'member';
const InviteModalHook = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__["default"])({
  hookName: 'member-invite-modal:customization',
  defaultComponent: _ref => {
    let {
      onSendInvites,
      children
    } = _ref;
    return children({
      sendInvites: onSendInvites,
      canSend: true
    });
  }
});

class InviteMembersModal extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sessionId", '');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "reset", () => {
      this.setState({
        pendingInvites: [this.inviteTemplate],
        inviteStatus: {},
        complete: false,
        sendingInvites: false
      });
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('invite_modal.add_more', {
        organization: this.props.organization,
        modal_session: this.sessionId
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sendInvite", async invite => {
      const {
        slug
      } = this.props.organization;
      const data = {
        email: invite.email,
        teams: [...invite.teams],
        role: invite.role
      };
      this.setState(state => ({
        inviteStatus: { ...state.inviteStatus,
          [invite.email]: {
            sent: false
          }
        }
      }));
      const endpoint = this.willInvite ? `/organizations/${slug}/members/` : `/organizations/${slug}/invite-requests/`;

      try {
        await this.api.requestPromise(endpoint, {
          method: 'POST',
          data
        });
      } catch (err) {
        const errorResponse = err.responseJSON; // Use the email error message if available. This inconsistently is
        // returned as either a list of errors for the field, or a single error.

        const emailError = !errorResponse || !errorResponse.email ? false : Array.isArray(errorResponse.email) ? errorResponse.email[0] : errorResponse.email;
        const error = emailError || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Could not invite user');
        this.setState(state => ({
          inviteStatus: { ...state.inviteStatus,
            [invite.email]: {
              sent: false,
              error
            }
          }
        }));
        return;
      }

      this.setState(state => ({
        inviteStatus: { ...state.inviteStatus,
          [invite.email]: {
            sent: true
          }
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sendInvites", async () => {
      this.setState({
        sendingInvites: true
      });
      await Promise.all(this.invites.map(this.sendInvite));
      this.setState({
        sendingInvites: false,
        complete: true
      });
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])(this.willInvite ? 'invite_modal.invites_sent' : 'invite_modal.requests_sent', {
        organization: this.props.organization,
        modal_session: this.sessionId
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "addInviteRow", () => this.setState(state => ({
      pendingInvites: [...state.pendingInvites, this.inviteTemplate]
    })));
  }

  get inviteTemplate() {
    return {
      emails: new Set(),
      teams: new Set(),
      role: DEFAULT_ROLE
    };
  }
  /**
   * Used for analytics tracking of the modals usage.
   */


  componentDidMount() {
    this.sessionId = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_15__.uniqueId)();
    const {
      organization,
      source
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('invite_modal.opened', {
      organization,
      modal_session: this.sessionId,
      can_invite: this.willInvite,
      source
    });
  }

  getEndpoints() {
    const orgId = this.props.organization.slug;
    return [['member', `/organizations/${orgId}/members/me/`]];
  }

  getDefaultState() {
    const state = super.getDefaultState();
    const {
      initialData
    } = this.props;
    const pendingInvites = initialData ? initialData.map(initial => ({ ...this.inviteTemplate,
      ...initial
    })) : [this.inviteTemplate];
    return { ...state,
      pendingInvites,
      inviteStatus: {},
      complete: false,
      sendingInvites: false
    };
  }

  setEmails(emails, index) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = { ...pendingInvites[index],
        emails: new Set(emails)
      };
      return {
        pendingInvites
      };
    });
  }

  setTeams(teams, index) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = { ...pendingInvites[index],
        teams: new Set(teams)
      };
      return {
        pendingInvites
      };
    });
  }

  setRole(role, index) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = { ...pendingInvites[index],
        role
      };
      return {
        pendingInvites
      };
    });
  }

  removeInviteRow(index) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites.splice(index, 1);
      return {
        pendingInvites
      };
    });
  }

  get invites() {
    return this.state.pendingInvites.reduce((acc, row) => [...acc, ...[...row.emails].map(email => ({
      email,
      teams: row.teams,
      role: row.role
    }))], []);
  }

  get hasDuplicateEmails() {
    const emails = this.invites.map(inv => inv.email);
    return emails.length !== new Set(emails).size;
  }

  get isValidInvites() {
    return this.invites.length > 0 && !this.hasDuplicateEmails;
  }

  get statusMessage() {
    const {
      sendingInvites,
      complete,
      inviteStatus
    } = this.state;

    if (sendingInvites) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StatusMessage, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {
          mini: true,
          relative: true,
          hideMessage: true,
          size: 16
        }), this.willInvite ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sending organization invitations...') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Sending invite requests...')]
      });
    }

    if (complete) {
      const statuses = Object.values(inviteStatus);
      const sentCount = statuses.filter(i => i.sent).length;
      const errorCount = statuses.filter(i => i.error).length;

      if (this.willInvite) {
        const invites = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tn)('%s invite', '%s invites', sentCount)
        });

        const tctComponents = {
          invites,
          failed: errorCount
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StatusMessage, {
          status: "success",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconCheckmark, {
            size: "sm"
          }), errorCount > 0 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Sent [invites], [failed] failed to send.', tctComponents) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Sent [invites]', tctComponents)]
        });
      }

      const inviteRequests = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("strong", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tn)('%s invite request', '%s invite requests', sentCount)
      });

      const tctComponents = {
        inviteRequests,
        failed: errorCount
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StatusMessage, {
        status: "success",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconCheckmark, {
          size: "sm"
        }), errorCount > 0 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[inviteRequests] pending approval, [failed] failed to send.', tctComponents) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[inviteRequests] pending approval', tctComponents)]
      });
    }

    if (this.hasDuplicateEmails) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StatusMessage, {
        status: "error",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconWarning, {
          size: "sm"
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Duplicate emails between invite rows.')]
      });
    }

    return null;
  }

  get willInvite() {
    var _this$props$organizat;

    return (_this$props$organizat = this.props.organization.access) === null || _this$props$organizat === void 0 ? void 0 : _this$props$organizat.includes('member:write');
  }

  get inviteButtonLabel() {
    if (this.invites.length > 0) {
      const numberInvites = this.invites.length; // Note we use `t()` here because `tn()` expects the same # of string formatters

      const inviteText = numberInvites === 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invite') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invites (%s)', numberInvites);
      const requestText = numberInvites === 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invite request') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invite requests (%s)', numberInvites);
      return this.willInvite ? inviteText : requestText;
    }

    return this.willInvite ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invite') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send invite request');
  }

  render() {
    const {
      Footer,
      closeModal,
      organization
    } = this.props;
    const {
      pendingInvites,
      sendingInvites,
      complete,
      inviteStatus,
      member
    } = this.state;
    const disableInputs = sendingInvites || complete; // eslint-disable-next-line react/prop-types

    const hookRenderer = _ref2 => {
      let {
        sendInvites,
        canSend,
        headerInfo
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(Heading, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Invite New Members'), !this.willInvite && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`You do not have permission to directly invite members. Email
                 addresses entered here will be forwarded to organization
                 managers and owners; they will be prompted to approve the
                 invitation.`),
            size: "sm",
            position: "bottom"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Subtext, {
          children: this.willInvite ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Invite new members by email to join your organization.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(`You don’t have permission to directly invite users, but we'll send a request to your organization owner and manager for review.`)
        }), headerInfo, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(InviteeHeadings, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Email addresses')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Role')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add to team')
          })]
        }), pendingInvites.map((_ref3, i) => {
          let {
            emails,
            role,
            teams
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledInviteRow, {
            disabled: disableInputs,
            emails: [...emails],
            role: role,
            teams: [...teams],
            roleOptions: member ? member.roles : sentry_constants__WEBPACK_IMPORTED_MODULE_10__.ORG_ROLES,
            roleDisabledUnallowed: this.willInvite,
            inviteStatus: inviteStatus,
            onRemove: () => this.removeInviteRow(i),
            onChangeEmails: opts => {
              var _opts$map;

              return this.setEmails((_opts$map = opts === null || opts === void 0 ? void 0 : opts.map(v => v.value)) !== null && _opts$map !== void 0 ? _opts$map : [], i);
            },
            onChangeRole: value => this.setRole(value === null || value === void 0 ? void 0 : value.value, i),
            onChangeTeams: opts => this.setTeams(opts ? opts.map(v => v.value) : [], i),
            disableRemove: disableInputs || pendingInvites.length === 1
          }, i);
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(AddButton, {
          disabled: disableInputs,
          priority: "link",
          onClick: this.addInviteRow,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconAdd, {
            size: "xs",
            isCircled: true
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add another')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Footer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(FooterContent, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
              children: this.statusMessage
            }), complete ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                "data-test-id": "send-more",
                size: "sm",
                onClick: this.reset,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Send more invites')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                "data-test-id": "close",
                priority: "primary",
                size: "sm",
                onClick: () => {
                  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('invite_modal.closed', {
                    organization: this.props.organization,
                    modal_session: this.sessionId
                  });
                  closeModal();
                },
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Close')
              })]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                "data-test-id": "cancel",
                size: "sm",
                onClick: closeModal,
                disabled: disableInputs,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Cancel')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                size: "sm",
                "data-test-id": "send-invites",
                priority: "primary",
                disabled: !canSend || !this.isValidInvites || disableInputs,
                onClick: sendInvites,
                children: this.inviteButtonLabel
              })]
            })]
          })
        })]
      });
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(InviteModalHook, {
      organization: organization,
      willInvite: this.willInvite,
      onSendInvites: this.sendInvites,
      children: hookRenderer
    });
  }

}

InviteMembersModal.displayName = "InviteMembersModal";

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h1',  true ? {
  target: "e1rmyp3r6"
} : 0)("display:inline-grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";grid-auto-flow:column;align-items:center;font-weight:400;font-size:", p => p.theme.headerFontSize, ";margin-top:0;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.75), ";" + ( true ? "" : 0));

const Subtext = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "e1rmyp3r5"
} : 0)("color:", p => p.theme.subText, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3), ";" + ( true ? "" : 0));

const inviteRowGrid = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_19__.css)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";grid-template-columns:3fr 180px 2fr max-content;" + ( true ? "" : 0),  true ? "" : 0);

const InviteeHeadings = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1rmyp3r4"
} : 0)(inviteRowGrid, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";font-weight:600;text-transform:uppercase;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const StyledInviteRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_inviteRowControl__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "e1rmyp3r3"
} : 0)(inviteRowGrid, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";" + ( true ? "" : 0));

const AddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1rmyp3r2"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3), ";" + ( true ? "" : 0));

const FooterContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1rmyp3r1"
} : 0)("width:100%;display:grid;grid-template-columns:1fr max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const StatusMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1rmyp3r0"
} : 0)("display:grid;grid-template-columns:max-content max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";align-items:center;font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.status === 'error' ? p.theme.red300 : p.theme.gray400, ";>:first-child{", p => p.status === 'success' && `color: ${p.theme.green300}`, ";}" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "onfzye",
  styles: "width:100%;max-width:800px;margin:50px auto"
} : 0;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_16__["default"])(InviteMembersModal));

/***/ }),

/***/ "./app/components/modals/inviteMembersModal/inviteRowControl.tsx":
/*!***********************************************************************!*\
  !*** ./app/components/modals/inviteMembersModal/inviteRowControl.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/roleSelectControl */ "./app/components/roleSelectControl.tsx");
/* harmony import */ var sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons/iconClose */ "./app/icons/iconClose.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _renderEmailValue__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./renderEmailValue */ "./app/components/modals/inviteMembersModal/renderEmailValue.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














function ValueComponent(props, inviteStatus) {
  return (0,_renderEmailValue__WEBPACK_IMPORTED_MODULE_9__["default"])(inviteStatus[props.data.value], props);
}

function mapToOptions(values) {
  return values.map(value => ({
    value,
    label: value
  }));
}

class InviteRowControl extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      inputValue: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInputChange", inputValue => {
      this.setState({
        inputValue
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyDown", event => {
      const {
        onChangeEmails,
        emails
      } = this.props;
      const {
        inputValue
      } = this.state;

      switch (event.key) {
        case 'Enter':
        case ',':
        case ' ':
          onChangeEmails([...mapToOptions(emails), {
            label: inputValue,
            value: inputValue
          }]);
          this.setState({
            inputValue: ''
          });
          event.preventDefault();
          break;

        default: // do nothing.

      }
    });
  }

  render() {
    const {
      className,
      disabled,
      emails,
      role,
      teams,
      roleOptions,
      roleDisabledUnallowed,
      inviteStatus,
      onRemove,
      onChangeEmails,
      onChangeRole,
      onChangeTeams,
      disableRemove,
      theme
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
      className: className,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_4__["default"], {
        "data-test-id": "select-emails",
        disabled: disabled,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Enter one or more emails'),
        inputValue: this.state.inputValue,
        value: emails,
        components: {
          MultiValue: props => ValueComponent(props, inviteStatus),
          DropdownIndicator: () => null
        },
        options: mapToOptions(emails),
        onBlur: e => e.target.value && onChangeEmails([...mapToOptions(emails), {
          label: e.target.value,
          value: e.target.value
        }]),
        styles: getStyles(theme, inviteStatus),
        onInputChange: this.handleInputChange,
        onKeyDown: this.handleKeyDown,
        onChange: onChangeEmails,
        multiple: true,
        creatable: true,
        clearable: true,
        menuIsOpen: false
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_roleSelectControl__WEBPACK_IMPORTED_MODULE_6__["default"], {
        "data-test-id": "select-role",
        disabled: disabled,
        value: role,
        roles: roleOptions,
        disableUnallowed: roleDisabledUnallowed,
        onChange: onChangeRole
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__["default"], {
        "data-test-id": "select-teams",
        disabled: disabled,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Add to teams\u2026'),
        value: teams,
        onChange: onChangeTeams,
        multiple: true,
        clearable: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        borderless: true,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__.IconClose, {}),
        size: "zero",
        onClick: onRemove,
        disabled: disableRemove,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Remove')
      })]
    });
  }

}

InviteRowControl.displayName = "InviteRowControl";

/**
 * The email select control has custom selected item states as items
 * show their delivery status after the form is submitted.
 */
function getStyles(theme, inviteStatus) {
  return {
    multiValue: (provided, _ref) => {
      let {
        data
      } = _ref;
      const status = inviteStatus[data.value];
      return { ...provided,
        ...(status !== null && status !== void 0 && status.error ? {
          color: theme.red300,
          border: `1px solid ${theme.red300}`,
          backgroundColor: theme.red100
        } : {})
      };
    },
    multiValueLabel: (provided, _ref2) => {
      let {
        data
      } = _ref2;
      const status = inviteStatus[data.value];
      return { ...provided,
        pointerEvents: 'all',
        ...(status !== null && status !== void 0 && status.error ? {
          color: theme.red300
        } : {})
      };
    },
    multiValueRemove: (provided, _ref3) => {
      let {
        data
      } = _ref3;
      const status = inviteStatus[data.value];
      return { ...provided,
        ...(status !== null && status !== void 0 && status.error ? {
          borderLeft: `1px solid ${theme.red300}`,
          ':hover': {
            backgroundColor: theme.red100,
            color: theme.red300
          }
        } : {})
      };
    }
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.d)(InviteRowControl));

/***/ }),

/***/ "./app/components/modals/inviteMembersModal/renderEmailValue.tsx":
/*!***********************************************************************!*\
  !*** ./app/components/modals/inviteMembersModal/renderEmailValue.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function renderEmailValue(status, valueProps) {
  const {
    children,
    ...props
  } = valueProps;
  const error = status && status.error;
  const emailLabel = status === undefined ? children : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
    disabled: !error,
    title: error,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(EmailLabel, {
      children: [children, !status.sent && !status.error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(SendingIndicator, {}), status.error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconWarning, {
        size: "10px"
      }), status.sent && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconCheckmark, {
        size: "10px",
        color: "success"
      })]
    })
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_6__.y.MultiValue, { ...props,
    children: emailLabel
  });
}

renderEmailValue.displayName = "renderEmailValue";

const EmailLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em6kqk41"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";align-items:center;" + ( true ? "" : 0));

const SendingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "em6kqk40"
} : 0)( true ? {
  name: "440peb",
  styles: "margin:0;.loading-indicator{border-width:2px;}"
} : 0);

SendingIndicator.defaultProps = {
  hideMessage: true,
  size: 14
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (renderEmailValue);

/***/ }),

/***/ "./app/components/roleSelectControl.tsx":
/*!**********************************************!*\
  !*** ./app/components/roleSelectControl.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




function RoleSelectControl(_ref) {
  let {
    roles,
    disableUnallowed,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__["default"], {
    options: roles === null || roles === void 0 ? void 0 : roles.map(r => ({
      value: r.id,
      label: r.name,
      disabled: disableUnallowed && !r.allowed,
      details: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Details, {
        children: r.desc
      })
    })),
    showDividers: true,
    ...props
  });
}

RoleSelectControl.displayName = "RoleSelectControl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RoleSelectControl);

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1cjlayn0"
} : 0)( true ? {
  name: "vad6xm",
  styles: "display:inline-block;width:20rem"
} : 0);

/***/ }),

/***/ "./app/stores/latestContextStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/latestContextStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationsActions */ "./app/actions/organizationsActions.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");






/**
 * Keeps track of last usable project/org this currently won't track when users
 * navigate out of a org/project completely, it tracks only if a user switches
 * into a new org/project.
 *
 * Only keep slug so that people don't get the idea to access org/project data
 * here Org/project data is currently in organizationsStore/projectsStore
 */
const storeConfig = {
  unsubscribeListeners: [],
  state: {
    project: null,
    lastProject: null,
    organization: null,
    environment: null
  },

  get() {
    return this.state;
  },

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].setActive, this.onSetActiveProject));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_3__["default"].updateSuccess, this.onUpdateProject));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"].setActive, this.onSetActiveOrganization));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdateOrganization));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_1__["default"].update, this.onUpdateOrganization));
  },

  reset() {
    this.state = {
      project: null,
      lastProject: null,
      organization: null,
      environment: null
    };
    return this.state;
  },

  onUpdateOrganization(org) {
    // Don't do anything if base/target orgs are falsey
    if (!this.state.organization) {
      return;
    }

    if (!org) {
      return;
    } // Check to make sure current active org is what has been updated


    if (org.slug !== this.state.organization.slug) {
      return;
    }

    this.state = { ...this.state,
      organization: org
    };
    this.trigger(this.state);
  },

  onSetActiveOrganization(org) {
    if (!org) {
      this.state = { ...this.state,
        organization: null,
        project: null
      };
    } else if (!this.state.organization || this.state.organization.slug !== org.slug) {
      // Update only if different
      this.state = { ...this.state,
        organization: org,
        project: null
      };
    }

    this.trigger(this.state);
  },

  onSetActiveProject(project) {
    if (!project) {
      this.state = { ...this.state,
        lastProject: this.state.project,
        project: null
      };
    } else if (!this.state.project || this.state.project.slug !== project.slug) {
      // Update only if different
      this.state = { ...this.state,
        lastProject: this.state.project,
        project
      };
    }

    this.trigger(this.state);
  },

  onUpdateProject(project) {
    this.state = { ...this.state,
      project
    };
    this.trigger(this.state);
  }

};
const LatestContextStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LatestContextStore);

/***/ }),

/***/ "./app/stores/organizationStore.tsx":
/*!******************************************!*\
  !*** ./app/stores/organizationStore.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const storeConfig = {
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdate));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].reset, this.reset));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchOrgError, this.onFetchOrgError));
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
    this.dirty = false;
    this.trigger(this.get());
  },

  onUpdate(updatedOrg) {
    let {
      replace = false
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = replace ? updatedOrg : { ...this.organization,
      ...updatedOrg
    };
    this.dirty = false;
    this.trigger(this.get());
  },

  onFetchOrgError(err) {
    this.organization = null;
    this.errorType = null;

    switch (err === null || err === void 0 ? void 0 : err.status) {
      case 401:
        this.errorType = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS;
        break;

      case 404:
        this.errorType = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;

      default:
    }

    this.loading = false;
    this.error = err;
    this.dirty = false;
    this.trigger(this.get());
  },

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
      dirty: this.dirty
    };
  },

  getState() {
    return this.get();
  }

};
const OrganizationStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationStore);

/***/ }),

/***/ "./app/stores/organizationsStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/organizationsStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationsActions */ "./app/actions/organizationsActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");




const storeConfig = {
  listenables: [sentry_actions_organizationsActions__WEBPACK_IMPORTED_MODULE_2__["default"]],
  state: [],
  loaded: false,

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.state;
  },

  init() {
    this.state = [];
    this.loaded = false;
  },

  onUpdate(org) {
    this.add(org);
  },

  onChangeSlug(prev, next) {
    if (prev.slug === next.slug) {
      return;
    }

    this.remove(prev.slug);
    this.add(next);
  },

  onRemoveSuccess(slug) {
    this.remove(slug);
  },

  get(slug) {
    return this.state.find(item => item.slug === slug);
  },

  getAll() {
    return this.state;
  },

  remove(slug) {
    this.state = this.state.filter(item => slug !== item.slug);
    this.trigger(this.state);
  },

  add(item) {
    let match = false;
    this.state.forEach((existing, idx) => {
      if (existing.id === item.id) {
        item = { ...existing,
          ...item
        };
        this.state[idx] = item;
        match = true;
      }
    });

    if (!match) {
      this.state = [...this.state, item];
    }

    this.trigger(this.state);
  },

  load(items) {
    this.state = items;
    this.loaded = true;
    this.trigger(items);
  }

};
const OrganizationsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationsStore);

/***/ }),

/***/ "./app/stores/projectsStatsStore.tsx":
/*!*******************************************!*\
  !*** ./app/stores/projectsStatsStore.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const storeConfig = {
  itemsBySlug: {},
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadStatsForProjectSuccess, this.onStatsLoadSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdate));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError, this.onUpdateError));
  },

  getInitialState() {
    return this.itemsBySlug;
  },

  reset() {
    this.itemsBySlug = {};
    this.updatingItems = new Map();
  },

  onStatsLoadSuccess(projects) {
    projects.forEach(project => {
      this.itemsBySlug[project.slug] = project;
    });
    this.trigger(this.itemsBySlug);
  },

  /**
   * Optimistic updates
   * @param projectSlug Project slug
   * @param data Project data
   */
  onUpdate(projectSlug, data) {
    const project = this.getBySlug(projectSlug);
    this.updatingItems.set(projectSlug, project);

    if (!project) {
      return;
    }

    const newProject = { ...project,
      ...data
    };
    this.itemsBySlug = { ...this.itemsBySlug,
      [project.slug]: newProject
    };
    this.trigger(this.itemsBySlug);
  },

  onUpdateSuccess(data) {
    // Remove project from updating map
    this.updatingItems.delete(data.slug);
  },

  /**
   * Revert project data when there was an error updating project details
   * @param err Error object
   * @param data Previous project data
   */
  onUpdateError(_err, projectSlug) {
    const project = this.updatingItems.get(projectSlug);

    if (!project) {
      return;
    }

    this.updatingItems.delete(projectSlug); // Restore old project

    this.itemsBySlug = { ...this.itemsBySlug,
      [project.slug]: { ...project
      }
    };
    this.trigger(this.itemsBySlug);
  },

  getAll() {
    return this.itemsBySlug;
  },

  getBySlug(slug) {
    return this.itemsBySlug[slug];
  }

};
const ProjectsStatsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectsStatsStore);

/***/ }),

/***/ "./app/utils/analytics/coreuiAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/coreuiAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "coreUIEventMap": () => (/* binding */ coreUIEventMap)
/* harmony export */ });
const coreUIEventMap = {
  'page_filters.pin_click': 'Page Filters: Pin Button Clicked'
};

/***/ }),

/***/ "./app/utils/analytics/dashboardsAnalyticsEvents.tsx":
/*!***********************************************************!*\
  !*** ./app/utils/analytics/dashboardsAnalyticsEvents.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dashboardsEventMap": () => (/* binding */ dashboardsEventMap)
/* harmony export */ });
// The add/edit widget modal is currently being ported to the widget builder full-page and
// this will be removed once that is done.
const dashboardsEventMapAddWidgetModal = {
  'dashboards_views.edit_widget_modal.confirm': 'Dashboards2: Edit Dashboard Widget modal form submitted',
  'dashboards_views.edit_widget_modal.opened': 'Dashboards2: Edit Widget Modal Opened',
  'dashboards_views.add_widget_modal.opened': 'Dashboards2: Add Widget Modal opened',
  'dashboards_views.add_widget_modal.change': 'Dashboards2: Field changed in Add Widget Modal',
  'dashboards_views.add_widget_modal.confirm': 'Dashboards2: Add Widget to Dashboard modal form submitted',
  'dashboards_views.add_widget_modal.save': 'Dashboards2: Widget saved directly to Dashboard from Add Widget to Dashboard modal'
}; // Used in the full-page widget builder

const dashboardsEventMapWidgetBuilder = {
  'dashboards_views.widget_builder.change': 'Widget Builder: Field changed',
  'dashboards_views.widget_builder.save': 'Widget Builder: Form submitted',
  'dashboards_views.widget_builder.opened': 'Widget Builder: Page opened'
};
const dashboardsEventMap = {
  'dashboards_views.query_selector.opened': 'Dashboards2: Query Selector opened for Widget',
  'dashboards_views.query_selector.selected': 'Dashboards2: Query selected in Query Selector',
  'dashboards_views.open_in_discover.opened': 'Dashboards2: Widget Opened In Discover',
  'dashboards_views.widget_library.add': 'Dashboards2: Number of prebuilt widgets added',
  'dashboards_views.widget_library.add_widget': 'Dashboards2: Title of prebuilt widget added',
  'dashboards_views.widget_library.switch_tab': 'Dashboards2: Widget Library tab switched',
  'dashboards_views.widget_library.opened': 'Dashboards2: Add Widget Library opened',
  'dashboards_manage.search': 'Dashboards Manager: Search',
  'dashboards_manage.change_sort': 'Dashboards Manager: Sort By Changed',
  'dashboards_manage.create.start': 'Dashboards Manager: Dashboard Create Started',
  'dashboards_manage.templates.toggle': 'Dashboards Manager: Template Toggle Changed',
  'dashboards_manage.templates.add': 'Dashboards Manager: Template Added',
  'dashboards_manage.templates.preview': 'Dashboards Manager: Template Previewed',
  'dashboards_views.widget_viewer.edit': 'Widget Viewer: Edit Widget Modal Opened',
  'dashboards_views.widget_viewer.open': 'Widget Viewer: Opened',
  'dashboards_views.widget_viewer.open_source': 'Widget Viewer: Opened in Discover/Issues',
  'dashboards_views.widget_viewer.paginate': 'Widget Viewer: Paginate',
  'dashboards_views.widget_viewer.select_query': 'Widget Viewer: Query Selected',
  'dashboards_views.widget_viewer.sort': 'Widget Viewer: Table Sorted',
  'dashboards_views.widget_viewer.toggle_legend': 'Widget Viewer: Legend Toggled',
  'dashboards_views.widget_viewer.zoom': 'Widget Viewer: Chart zoomed',
  ...dashboardsEventMapAddWidgetModal,
  ...dashboardsEventMapWidgetBuilder
};

/***/ }),

/***/ "./app/utils/analytics/discoverAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/discoverAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "discoverEventMap": () => (/* binding */ discoverEventMap)
/* harmony export */ });
const discoverEventMap = {
  'discover_views.add_to_dashboard.modal_open': 'Discover2: Add to Dashboard modal opened',
  'discover_views.add_to_dashboard.confirm': 'Discover2: Add to Dashboard modal form submitted'
};

/***/ }),

/***/ "./app/utils/analytics/growthAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/growthAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "growthEventMap": () => (/* binding */ growthEventMap)
/* harmony export */ });
// define the event key to payload mappings
const growthEventMap = {
  'assistant.guide_finished': 'Assistant Guide Finished',
  'assistant.guide_dismissed': 'Assistant Guide Dismissed',
  'growth.clicked_mobile_prompt_setup_project': 'Growth: Clicked Mobile Prompt Setup Project',
  'growth.clicked_mobile_prompt_ask_teammate': 'Growth: Clicked Mobile Prompt Ask Teammate',
  'growth.submitted_mobile_prompt_ask_teammate': 'Growth: Submitted Mobile Prompt Ask Teammate',
  'growth.demo_click_get_started': 'Growth: Demo Click Get Started',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
  'growth.clicked_sidebar': 'Growth: Clicked Sidebar',
  'growth.onboarding_load_choose_platform': 'Growth: Onboarding Load Choose Platform Page',
  'growth.onboarding_set_up_your_project': 'Growth: Onboarding Click Set Up Your Project',
  'growth.onboarding_set_up_your_projects': 'Growth: Onboarding Click Set Up Your Projects',
  'growth.select_platform': 'Growth: Onboarding Choose Platform',
  'growth.platformpicker_category': 'Growth: Onboarding Platform Category',
  'growth.platformpicker_search': 'Growth: Onboarding Platform Search',
  'growth.metric_alert_preset_use_template': 'Growth: Metric Alert Preset Use Template',
  'growth.metric_alert_preset_sidebar_clicked': 'Growth: Metric Alert Preset Sidebar Clicked',
  'growth.onboarding_start_onboarding': 'Growth: Onboarding Start Onboarding',
  'growth.onboarding_clicked_skip': 'Growth: Onboarding Clicked Skip',
  'growth.onboarding_take_to_error': 'Growth: Onboarding Take to Error',
  'growth.onboarding_view_full_docs': 'Growth: Onboarding View Full Docs',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
  'growth.onboarding_clicked_instrument_app': 'Growth: Onboarding Clicked Instrument App',
  'growth.onboarding_clicked_setup_platform_later': 'Growth: Onboarding Clicked Setup Platform Later',
  'growth.onboarding_quick_start_cta': 'Growth: Quick Start Onboarding CTA',
  'invite_request.approved': 'Invite Request Approved',
  'invite_request.denied': 'Invite Request Denied',
  'growth.demo_modal_clicked_signup': 'Growth: Demo Modal Clicked Signup',
  'growth.demo_modal_clicked_continue': 'Growth: Demo Modal Clicked Continue',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.onboarding_clicked_project_in_sidebar': 'Growth: Clicked Project Sidebar',
  'growth.sample_transaction_docs_link_clicked': 'Growth: Sample Transaction Docs Link Clicked',
  'growth.sample_error_onboarding_link_clicked': 'Growth: Sample Error Onboarding Link Clicked',
  'growth.issue_open_in_discover_btn_clicked': 'Growth: Open in Discover Button in Issue Details clicked',
  'member_settings_page.loaded': 'Member Settings Page Loaded',
  'invite_modal.opened': 'Invite Modal: Opened',
  'invite_modal.closed': 'Invite Modal: Closed',
  'invite_modal.add_more': 'Invite Modal: Add More',
  'invite_modal.invites_sent': 'Invite Modal: Invites Sent',
  'invite_modal.requests_sent': 'Invite Modal: Requests Sent',
  'sdk_updates.seen': 'SDK Updates: Seen',
  'sdk_updates.snoozed': 'SDK Updates: Snoozed',
  'sdk_updates.clicked': 'SDK Updates: Clicked',
  'onboarding.wizard_opened': 'Onboarding Wizard Opened',
  'onboarding.wizard_clicked': 'Onboarding Wizard Clicked',
  'sample_event.button_viewed': null,
  // high-volume event
  'sample_event.created': 'Sample Event Created',
  'sample_event.failed': 'Sample Event Failed',
  'vitals_alert.clicked_see_vitals': 'Vitals Alert: Clicked See Vitals',
  'vitals_alert.dismissed': 'Vitals Alert: Dismissed',
  'vitals_alert.clicked_docs': 'Vitals Alert: Clicked Docs',
  'vitals_alert.displayed': 'Vitals Alert: Displayed',
  'growth.onboarding_wizard_clicked_more_details': 'Onboarding Wizard: Clicked More Details',
  'growth.onboarding_wizard_interacted': 'Onboarding Wizard: Interacted',
  'assistant.guide_cued': 'Assistant Guide Cued'
};

/***/ }),

/***/ "./app/utils/analytics/issueAnalyticsEvents.tsx":
/*!******************************************************!*\
  !*** ./app/utils/analytics/issueAnalyticsEvents.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "issueEventMap": () => (/* binding */ issueEventMap)
/* harmony export */ });
const issueEventMap = {
  'event_cause.viewed': null,
  // send to main event store only due to high event volume
  'event_cause.docs_clicked': 'Event Cause Docs Clicked',
  'event_cause.snoozed': 'Event Cause Snoozed',
  'event_cause.dismissed': 'Event Cause Dismissed',
  'issue_error_banner.viewed': 'Issue Error Banner Viewed',
  'issues_tab.viewed': 'Viewed Issues Tab',
  // high volume but send to our secondary event store anyways
  'issue_search.failed': 'Issue Search: Failed',
  'issue_search.empty': 'Issue Search: Empty',
  'issue.search_sidebar_clicked': 'Issue Search Sidebar Clicked',
  'inbox_tab.issue_clicked': 'Clicked Issue from Inbox Tab',
  'issues_stream.realtime_clicked': 'Issues Stream: Realtime Clicked',
  'issues_stream.issue_clicked': 'Clicked Issue from Issues Stream',
  'issues_stream.issue_assigned': 'Assigned Issue from Issues Stream',
  'issues_stream.sort_changed': 'Changed Sort on Issues Stream',
  'issues_stream.paginate': 'Paginate Issues Stream',
  'issue.shared_publicly': 'Issue Shared Publicly',
  resolve_issue: 'Resolve Issue',
  'tag.clicked': 'Tag: Clicked',
  'issue.quick_trace_status': 'Issue Quick Trace Status',
  'span_view.embedded_child.hide': 'Span View: Hide Embedded Transaction',
  'span_view.embedded_child.show': 'Span View: Show Embedded Transaction'
};

/***/ }),

/***/ "./app/utils/analytics/performanceAnalyticsEvents.tsx":
/*!************************************************************!*\
  !*** ./app/utils/analytics/performanceAnalyticsEvents.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "performanceEventMap": () => (/* binding */ performanceEventMap)
/* harmony export */ });
const performanceEventMap = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
  'performance_views.landingv2.transactions.sort': 'Performance Views: Landing Transactions Sorted',
  'performance_views.overview.navigate.summary': 'Performance Views: Overview view summary',
  'performance_views.overview.cellaction': 'Performance Views: Cell Action Clicked',
  'performance_views.landingv3.widget.interaction': 'Performance Views: Landing Widget Interaction',
  'performance_views.landingv3.widget.switch': 'Performance Views: Landing Widget Switched',
  'performance_views.landingv3.batch_queries': 'Performance Views: Landing Query Batching',
  'performance_views.landingv3.display_change': 'Performance Views: Switch Landing Tabs',
  'performance_views.landingv3.table_pagination': 'Performance Views: Landing Page Transactions Table Page Changed',
  'performance_views.span_summary.change_chart': 'Performance Views: Span Summary displayed chart changed',
  'performance_views.span_summary.view': 'Performance Views: Span Summary page viewed',
  'performance_views.spans.change_op': 'Performance Views: Change span operation name',
  'performance_views.spans.change_sort': 'Performance Views: Change span sort column',
  'performance_views.overview.view': 'Performance Views: Transaction overview view',
  'performance_views.overview.search': 'Performance Views: Transaction overview search',
  'performance_views.vital_detail.view': 'Performance Views: Vital Detail viewed',
  'performance_views.vital_detail.switch_vital': 'Performance Views: Vital Detail vital type switched',
  'performance_views.trace_view.view': 'Performance Views: Trace View viewed',
  'performance_views.trace_view.open_in_discover': 'Performance Views: Trace View open in Discover button clicked',
  'performance_views.trace_view.open_transaction_details': 'Performance Views: Trace View transaction details opened',
  'performance_views.transaction_summary.change_chart_display': 'Performance Views: Transaction Summary chart display changed',
  'performance_views.transaction_summary.status_breakdown_click': 'Performance Views: Transaction Summary status breakdown option clicked',
  'performance_views.all_events.open_in_discover': 'Performance Views: All Events page open in Discover button clicked',
  'performance_views.tags.change_aggregate_column': 'Performance Views: Tags page changed aggregate column',
  'performance_views.tags.change_tag': 'Performance Views: Tags Page changed selected tag',
  'performance_views.tags.jump_to_release': 'Performance Views: Tags Page link to release in table clicked',
  'performance_views.team_key_transaction.set': 'Performance Views: Set Team Key Transaction',
  'performance_views.trends.widget_interaction': 'Performance Views: Trends Widget Interaction',
  'performance_views.trends.widget_pagination': 'Performance Views: Trends Widget Page Changed',
  'performance_views.trends.change_duration': 'Performance Views: Trends Widget Duration Changed',
  'performance_views.event_details.filter_by_op': 'Performance Views: Event Details page operation filter applied',
  'performance_views.event_details.search_query': 'Performance Views: Event Details search query',
  'performance_views.event_details.open_span_details': 'Performance Views: Event Details span details opened',
  'performance_views.event_details.anchor_span': 'Performance Views: Event Details span anchored',
  'performance_views.event_details.json_button_click': 'Performance Views: Event Details JSON button clicked',
  'performance_views.transaction_summary.view': 'Performance Views: Transaction Summary View',
  'performance_views.filter_dropdown.selection': 'Performance Views: Filter Dropdown',
  'performance_views.vital_detail.comparison_viewed': 'Performance Views: Vital Detail Comparison Viewed',
  'performance_views.relative_breakdown.selection': 'Performance Views: Select Relative Breakdown'
};

/***/ }),

/***/ "./app/utils/analytics/profilingAnalyticsEvents.tsx":
/*!**********************************************************!*\
  !*** ./app/utils/analytics/profilingAnalyticsEvents.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "profilingEventMap": () => (/* binding */ profilingEventMap)
/* harmony export */ });
const profilingEventMap = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.onboarding': 'Profiling Views: Onboarding',
  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
  'profiling_views.profile_details': 'Profiling Views: Profile Details',
  'profiling_views.go_to_flamegraph': 'Profiling Views: Go to Flamegraph',
  'profiling_views.onboarding_action': 'Profiling Actions: Onboarding Action'
};

/***/ }),

/***/ "./app/utils/analytics/releasesAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/releasesAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "releasesEventMap": () => (/* binding */ releasesEventMap)
/* harmony export */ });
const releasesEventMap = {
  'releases.quickstart_viewed': 'Releases: Quickstart Viewed',
  'releases.quickstart_copied': 'Releases: Quickstart Copied',
  'releases.quickstart_create_integration.success': 'Releases: Quickstart Created Integration',
  'releases.quickstart_create_integration_modal.close': 'Releases: Quickstart Create Integration Modal Exit'
};

/***/ }),

/***/ "./app/utils/analytics/samplingAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/samplingAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "samplingEventMap": () => (/* binding */ samplingEventMap)
/* harmony export */ });
const samplingEventMap = {
  'sampling.sdk.client.rate.change.alert': 'Recommended sdk client rate change alert',
  'sampling.sdk.updgrades.alert': 'Recommended sdk upgrades alert',
  'sampling.sdk.incompatible.alert': 'Incompatible sdk upgrades alert',
  'sampling.settings.modal.recommended.next.steps_back': 'Go back to uniform rate step',
  'sampling.settings.modal.recommended.next.steps_cancel': 'Cancel at recommended next steps step ',
  'sampling.settings.modal.recommended.next.steps_done': 'Create uniform rule at recommended next steps step',
  'sampling.settings.modal.recommended.next.steps_read_docs': 'Read docs at recommended next steps step',
  'sampling.settings.rule.specific_activate': 'Activate specific rule',
  'sampling.settings.modal.uniform.rate_cancel': 'Cancel at uniform rate step',
  'sampling.settings.rule.specific_deactivate': 'Deactivate specific rule',
  'sampling.settings.modal.uniform.rate_done': 'Create uniform rule at uniform rate step',
  'sampling.settings.modal.uniform.rate_next': 'Go to recommended next steps step',
  'sampling.settings.modal.uniform.rate_read_docs': 'Read docs at uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_current': 'Switch to current uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_recommended': 'Switch to recommended next steps step',
  'sampling.settings.modal.specific.rule.condition_add': 'Add sampling condition',
  'sampling.settings.modal.specify.client.rate_read_docs': 'Read docs at specify client rate step',
  'sampling.settings.modal.specify.client.rate_cancel': 'Cancel at specify client rate step',
  'sampling.settings.modal.specify.client.rate_next': 'Go to uniform rate step',
  'sampling.settings.rule.specific_create': 'Create specific sampling rule',
  'sampling.settings.rule.specific_delete': 'Delete specific sampling rule',
  'sampling.settings.rule.specific_save': 'Save specific sampling rule',
  // fired for both create and update
  'sampling.settings.rule.specific_update': 'Update specific sampling rule',
  'sampling.settings.rule.uniform_activate': 'Activate uniform sampling rule',
  'sampling.settings.rule.uniform_create': 'Create uniform sampling rule',
  'sampling.settings.rule.uniform_deactivate': 'Deactivate uniform sampling rule',
  'sampling.settings.rule.uniform_save': 'Save uniform sampling rule',
  // fired for both create and update
  'sampling.settings.rule.uniform_update': 'Update uniform sampling rule',
  'sampling.settings.view': 'View sampling settings',
  'sampling.settings.view_get_started': 'Get started with sampling',
  'sampling.settings.view_read_docs': 'Read sampling docs' // fired for all read docs buttons

};

/***/ }),

/***/ "./app/utils/analytics/searchAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/searchAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "searchEventMap": () => (/* binding */ searchEventMap)
/* harmony export */ });
const searchEventMap = {
  'search.searched': 'Search: Performed search',
  'search.operator_autocompleted': 'Search: Operator Autocompleted',
  'search.shortcut_used': 'Search: Shortcut Used',
  'search.search_with_invalid': 'Search: Attempted Invalid Search',
  'search.invalid_field': 'Search: Unsupported Field Warning Shown',
  'organization_saved_search.selected': 'Organization Saved Search: Selected saved search',
  'settings_search.open': 'settings_search Open',
  'command_palette.open': 'command_palette Open',
  'sidebar_help.open': 'sidebar_help Open',
  'settings_search.select': 'settings_search Select',
  'command_palette.select': 'command_palette Select',
  'sidebar_help.select': 'sidebar_help Select',
  'settings_search.query': 'settings_search Query',
  'command_palette.query': 'command_palette Query',
  'sidebar_help.query': 'sidebar_help Query',
  'projectselector.direct_selection': 'Project Selector: Direct Selection',
  'projectselector.update': 'Project Selector: Update',
  'projectselector.clear': 'Project Selector: Clear',
  'projectselector.toggle': 'Project Selector: Toggle',
  'projectselector.multi_button_clicked': 'Project Selector: Multi Button Clicked',
  'search.pin': 'Search: Pin'
};

/***/ }),

/***/ "./app/utils/analytics/settingsAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/settingsAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "settingsEventMap": () => (/* binding */ settingsEventMap)
/* harmony export */ });
const settingsEventMap = {
  'notification_settings.index_page_viewed': 'Notification Settings: Index Page Viewed',
  'notification_settings.tuning_page_viewed': 'Notification Settings: Tuning Page Viewed',
  'notification_settings.updated_tuning_setting': 'Notification Settings: Updated Tuning Setting'
};

/***/ }),

/***/ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _coreuiAnalyticsEvents__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./coreuiAnalyticsEvents */ "./app/utils/analytics/coreuiAnalyticsEvents.tsx");
/* harmony import */ var _dashboardsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dashboardsAnalyticsEvents */ "./app/utils/analytics/dashboardsAnalyticsEvents.tsx");
/* harmony import */ var _discoverAnalyticsEvents__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./discoverAnalyticsEvents */ "./app/utils/analytics/discoverAnalyticsEvents.tsx");
/* harmony import */ var _growthAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./growthAnalyticsEvents */ "./app/utils/analytics/growthAnalyticsEvents.tsx");
/* harmony import */ var _issueAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./issueAnalyticsEvents */ "./app/utils/analytics/issueAnalyticsEvents.tsx");
/* harmony import */ var _makeAnalyticsFunction__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./makeAnalyticsFunction */ "./app/utils/analytics/makeAnalyticsFunction.tsx");
/* harmony import */ var _performanceAnalyticsEvents__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./performanceAnalyticsEvents */ "./app/utils/analytics/performanceAnalyticsEvents.tsx");
/* harmony import */ var _profilingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./profilingAnalyticsEvents */ "./app/utils/analytics/profilingAnalyticsEvents.tsx");
/* harmony import */ var _releasesAnalyticsEvents__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./releasesAnalyticsEvents */ "./app/utils/analytics/releasesAnalyticsEvents.tsx");
/* harmony import */ var _samplingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./samplingAnalyticsEvents */ "./app/utils/analytics/samplingAnalyticsEvents.tsx");
/* harmony import */ var _searchAnalyticsEvents__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./searchAnalyticsEvents */ "./app/utils/analytics/searchAnalyticsEvents.tsx");
/* harmony import */ var _settingsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./settingsAnalyticsEvents */ "./app/utils/analytics/settingsAnalyticsEvents.tsx");
/* harmony import */ var _workflowAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./workflowAnalyticsEvents */ "./app/utils/analytics/workflowAnalyticsEvents.tsx");













const allEventMap = { ..._coreuiAnalyticsEvents__WEBPACK_IMPORTED_MODULE_0__.coreUIEventMap,
  ..._dashboardsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_1__.dashboardsEventMap,
  ..._discoverAnalyticsEvents__WEBPACK_IMPORTED_MODULE_2__.discoverEventMap,
  ..._growthAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.growthEventMap,
  ..._issueAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__.issueEventMap,
  ..._performanceAnalyticsEvents__WEBPACK_IMPORTED_MODULE_6__.performanceEventMap,
  ..._profilingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_7__.profilingEventMap,
  ..._samplingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.samplingEventMap,
  ..._searchAnalyticsEvents__WEBPACK_IMPORTED_MODULE_10__.searchEventMap,
  ..._settingsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_11__.settingsEventMap,
  ..._workflowAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__.workflowEventMap,
  ..._releasesAnalyticsEvents__WEBPACK_IMPORTED_MODULE_8__.releasesEventMap
};
/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */

const trackAdvancedAnalyticsEvent = (0,_makeAnalyticsFunction__WEBPACK_IMPORTED_MODULE_5__["default"])(allEventMap);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (trackAdvancedAnalyticsEvent);

/***/ }),

/***/ "./app/utils/analytics/workflowAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/workflowAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "workflowEventMap": () => (/* binding */ workflowEventMap)
/* harmony export */ });
const workflowEventMap = {
  'alert_builder.filter': 'Alert Builder: Filter',
  'alert_details.viewed': 'Alert Details: Viewed',
  'alert_rule_details.viewed': 'Alert Rule Details: Viewed',
  'alert_rules.viewed': 'Alert Rules: Viewed',
  'alert_stream.viewed': 'Alert Stream: Viewed',
  'alert_wizard.option_selected': 'Alert Wizard: Option Selected',
  'alert_wizard.option_viewed': 'Alert Wizard: Option Viewed',
  'edit_alert_rule.add_row': 'Edit Alert Rule: Add Row',
  'edit_alert_rule.viewed': 'Edit Alert Rule: Viewed',
  'issue_alert_rule_details.edit_clicked': 'Issue Alert Rule Details: Edit Clicked',
  'issue_alert_rule_details.viewed': 'Issue Alert Rule Details: Viewed',
  'issue_details.action_clicked': 'Issue Details: Action Clicked',
  'issue_details.event_json_clicked': 'Issue Details: Event JSON Clicked',
  'issue_details.event_navigation_clicked': 'Issue Details: Event Navigation Clicked',
  'issue_details.viewed': 'Issue Details: Viewed',
  'new_alert_rule.viewed': 'New Alert Rule: Viewed',
  'team_insights.viewed': 'Team Insights: Viewed',
  'project_creation_page.viewed': 'Project Create: Creation page viewed',
  'project_creation_page.created': 'Project Create: Project Created'
};

/***/ }),

/***/ "./app/utils/parseLinkHeader.tsx":
/*!***************************************!*\
  !*** ./app/utils/parseLinkHeader.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ parseLinkHeader)
/* harmony export */ });
function parseLinkHeader(header) {
  if (header === null || header === '') {
    return {};
  }

  const headerValues = header.split(',');
  const links = {};
  headerValues.forEach(val => {
    const match = /<([^>]+)>; rel="([^"]+)"(?:; results="([^"]+)")?(?:; cursor="([^"]+)")?/g.exec(val);
    const hasResults = match[3] === 'true' ? true : match[3] === 'false' ? false : null;
    links[match[2]] = {
      href: match[1],
      results: hasResults,
      cursor: match[4]
    };
  });
  return links;
}

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

/***/ "./app/utils/withLatestContext.tsx":
/*!*****************************************!*\
  !*** ./app/utils/withLatestContext.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/latestContextStore */ "./app/stores/latestContextStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const fallbackContext = {
  organization: null,
  project: null
};

function withLatestContext(WrappedComponent) {
  class WithLatestContext extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        latestContext: sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__["default"].get()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(latestContext => this.setState({
        latestContext
      }), undefined));
    }

    componentWillUmount() {
      this.unsubscribe();
    }

    render() {
      const {
        organizations
      } = this.props;
      const {
        latestContext
      } = this.state;
      const {
        organization,
        project
      } = latestContext || fallbackContext; // Even though org details exists in LatestContextStore,
      // fetch organization from OrganizationsStore so that we can
      // expect consistent data structure because OrganizationsStore has a list
      // of orgs but not full org details

      const latestOrganization = organization || (organizations && organizations.length ? organizations.find(_ref => {
        let {
          slug
        } = _ref;
        return slug === sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('lastOrganization');
      }) || organizations[0] : null); // TODO(billy): Below is going to be wrong if component is passed project, it will override
      // project from `latestContext`

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(WrappedComponent, {
        project: project,
        ...this.props,
        organization: this.props.organization || latestOrganization
      });
    }

  }

  WithLatestContext.displayName = "WithLatestContext";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithLatestContext, "displayName", `withLatestContext(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__["default"])(WrappedComponent)})`);

  return (0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_6__["default"])(WithLatestContext);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withLatestContext);

/***/ }),

/***/ "./app/utils/withOrganizations.tsx":
/*!*****************************************!*\
  !*** ./app/utils/withOrganizations.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/organizationsStore */ "./app/stores/organizationsStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function withOrganizations(WrappedComponent) {
  class WithOrganizations extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        organizations: sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].getAll()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(organizations => this.setState({
        organizations
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        organizationsLoading,
        organizations,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        organizationsLoading: organizationsLoading !== null && organizationsLoading !== void 0 ? organizationsLoading : !sentry_stores_organizationsStore__WEBPACK_IMPORTED_MODULE_3__["default"].loaded,
        organizations: organizations !== null && organizations !== void 0 ? organizations : this.state.organizations,
        ...props
      });
    }

  }

  WithOrganizations.displayName = "WithOrganizations";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithOrganizations, "displayName", `withOrganizations(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithOrganizations;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withOrganizations);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_projects_tsx-app_components_modals_inviteMembersModal_index_tsx-app_stores-242ade.3a3a823ec6168b3e2e43eeb300ff242c.js.map