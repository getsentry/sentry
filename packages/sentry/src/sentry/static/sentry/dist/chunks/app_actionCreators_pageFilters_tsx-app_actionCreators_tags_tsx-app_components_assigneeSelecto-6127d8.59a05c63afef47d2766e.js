"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_pageFilters_tsx-app_actionCreators_tags_tsx-app_components_assigneeSelecto-6127d8"],{

/***/ "./app/actionCreators/group.tsx":
/*!**************************************!*\
  !*** ./app/actionCreators/group.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "assignToActor": () => (/* binding */ assignToActor),
/* harmony export */   "assignToUser": () => (/* binding */ assignToUser),
/* harmony export */   "bulkDelete": () => (/* binding */ bulkDelete),
/* harmony export */   "bulkUpdate": () => (/* binding */ bulkUpdate),
/* harmony export */   "clearAssignment": () => (/* binding */ clearAssignment),
/* harmony export */   "createNote": () => (/* binding */ createNote),
/* harmony export */   "deleteNote": () => (/* binding */ deleteNote),
/* harmony export */   "mergeGroups": () => (/* binding */ mergeGroups),
/* harmony export */   "paramsToQueryArgs": () => (/* binding */ paramsToQueryArgs),
/* harmony export */   "updateNote": () => (/* binding */ updateNote)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isNil__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isNil */ "../node_modules/lodash/isNil.js");
/* harmony import */ var lodash_isNil__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isNil__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");







function assignToUser(params) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_2__.Client();
  const endpoint = `/issues/${params.id}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignTo(id, params.id, {
    email: params.member && params.member.email || ''
  });
  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear",
    // so if no member exists, that implies that we want to clear the
    // current assignee.
    data: {
      assignedTo: params.user ? (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.buildUserId)(params.user.id) : '',
      assignedBy: params.assignedBy
    }
  });
  request.then(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToSuccess(id, params.id, data);
  }).catch(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToError(id, params.id, data);
  });
  return request;
}
function clearAssignment(groupId, assignedBy) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_2__.Client();
  const endpoint = `/issues/${groupId}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignTo(id, groupId, {
    email: ''
  });
  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear"
    data: {
      assignedTo: '',
      assignedBy
    }
  });
  request.then(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToSuccess(id, groupId, data);
  }).catch(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToError(id, groupId, data);
  });
  return request;
}
function assignToActor(_ref) {
  let {
    id,
    actor,
    assignedBy
  } = _ref;
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_2__.Client();
  const endpoint = `/issues/${id}/`;
  const guid = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  let actorId = '';
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignTo(guid, id, {
    email: ''
  });

  switch (actor.type) {
    case 'user':
      actorId = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.buildUserId)(actor.id);
      break;

    case 'team':
      actorId = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.buildTeamId)(actor.id);
      break;

    default:
      _sentry_react__WEBPACK_IMPORTED_MODULE_6__.withScope(scope => {
        scope.setExtra('actor', actor);
        _sentry_react__WEBPACK_IMPORTED_MODULE_6__.captureException('Unknown assignee type');
      });
  }

  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: {
      assignedTo: actorId,
      assignedBy
    }
  }).then(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToSuccess(guid, id, data);
  }).catch(data => {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onAssignToSuccess(guid, id, data);
  });
}
function deleteNote(api, group, id, _oldText) {
  const restore = group.activity.find(activity => activity.id === id);
  const index = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].removeActivity(group.id, id);

  if (index === -1 || restore === undefined) {
    // I dunno, the id wasn't found in the GroupStore
    return Promise.reject(new Error('Group was not found in store'));
  }

  const promise = api.requestPromise(`/issues/${group.id}/comments/${id}/`, {
    method: 'DELETE'
  });
  promise.catch(() => sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].addActivity(group.id, restore, index));
  return promise;
}
function createNote(api, group, note) {
  const promise = api.requestPromise(`/issues/${group.id}/comments/`, {
    method: 'POST',
    data: note
  });
  promise.then(data => sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].addActivity(group.id, data));
  return promise;
}
function updateNote(api, group, note, id, oldText) {
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].updateActivity(group.id, id, {
    data: {
      text: note.text
    }
  });
  const promise = api.requestPromise(`/issues/${group.id}/comments/${id}/`, {
    method: 'PUT',
    data: note
  });
  promise.catch(() => sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].updateActivity(group.id, id, {
    data: {
      text: oldText
    }
  }));
  return promise;
}

/**
 * Converts input parameters to API-compatible query arguments
 */
function paramsToQueryArgs(params) {
  var _params$project;

  const p = params.itemIds ? {
    id: params.itemIds
  } // items matching array of itemids
  : params.query ? {
    query: params.query
  } // items matching search query
  : {}; // all items
  // only include environment if it is not null/undefined

  if (params.query && !lodash_isNil__WEBPACK_IMPORTED_MODULE_1___default()(params.environment)) {
    p.environment = params.environment;
  } // only include projects if it is not null/undefined/an empty array


  if ((_params$project = params.project) !== null && _params$project !== void 0 && _params$project.length) {
    p.project = params.project;
  } // only include date filters if they are not null/undefined


  if (params.query) {
    ['start', 'end', 'period', 'utc'].forEach(prop => {
      if (!lodash_isNil__WEBPACK_IMPORTED_MODULE_1___default()(params[prop])) {
        p[prop === 'period' ? 'statsPeriod' : prop] = params[prop];
      }
    });
  }

  return p;
}

function getUpdateUrl(_ref2) {
  let {
    projectId,
    orgId
  } = _ref2;
  return projectId ? `/projects/${orgId}/${projectId}/issues/` : `/organizations/${orgId}/issues/`;
}

function chainUtil() {
  for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  const filteredFuncs = funcs.filter(f => typeof f === 'function');
  return function () {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    filteredFuncs.forEach(func => {
      func.apply(funcs, args);
    });
  };
}

function wrapRequest(api, path, options) {
  let extraParams = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  options.success = chainUtil(options.success, extraParams.success);
  options.error = chainUtil(options.error, extraParams.error);
  options.complete = chainUtil(options.complete, extraParams.complete);
  return api.request(path, options);
}

function bulkDelete(api, params, options) {
  const {
    itemIds
  } = params;
  const path = getUpdateUrl(params);
  const query = paramsToQueryArgs(params);
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onDelete(id, itemIds);
  return wrapRequest(api, path, {
    query,
    method: 'DELETE',
    success: response => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onDeleteSuccess(id, itemIds, response);
    },
    error: error => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onDeleteError(id, itemIds, error);
    }
  }, options);
}
function bulkUpdate(api, params, options) {
  const {
    itemIds,
    failSilently,
    data
  } = params;
  const path = getUpdateUrl(params);
  const query = paramsToQueryArgs(params);
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onUpdate(id, itemIds, data);
  return wrapRequest(api, path, {
    query,
    method: 'PUT',
    data,
    success: response => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onUpdateSuccess(id, itemIds, response);
    },
    error: () => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onUpdateError(id, itemIds, !!failSilently);
    }
  }, options);
}
function mergeGroups(api, params, options) {
  const {
    itemIds
  } = params;
  const path = getUpdateUrl(params);
  const query = paramsToQueryArgs(params);
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onMerge(id, itemIds);
  return wrapRequest(api, path, {
    query,
    method: 'PUT',
    data: {
      merge: 1
    },
    success: response => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onMergeSuccess(id, itemIds, response);
    },
    error: error => {
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_3__["default"].onMergeError(id, itemIds, error);
    }
  }, options);
}

/***/ }),

/***/ "./app/actionCreators/pageFilters.tsx":
/*!********************************************!*\
  !*** ./app/actionCreators/pageFilters.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "initializeUrlState": () => (/* binding */ initializeUrlState),
/* harmony export */   "pinFilter": () => (/* binding */ pinFilter),
/* harmony export */   "resetPageFilters": () => (/* binding */ resetPageFilters),
/* harmony export */   "revertToPinnedFilters": () => (/* binding */ revertToPinnedFilters),
/* harmony export */   "updateDateTime": () => (/* binding */ updateDateTime),
/* harmony export */   "updateEnvironments": () => (/* binding */ updateEnvironments),
/* harmony export */   "updateProjects": () => (/* binding */ updateProjects)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isInteger__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isInteger */ "../node_modules/lodash/isInteger.js");
/* harmony import */ var lodash_isInteger__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isInteger__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actions/pageFiltersActions */ "./app/actions/pageFiltersActions.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/persistence */ "./app/components/organizations/pageFilters/persistence.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/stores/pageFiltersStore */ "./app/stores/pageFiltersStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");

















/**
 * NOTE: this is the internal project.id, NOT the slug
 */

/**
 * Reset values in the page filters store
 */
function resetPageFilters() {
  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].reset();
}

function getProjectIdFromProject(project) {
  return parseInt(project.id, 10);
}
/**
 * Merges two date time objects, where the `base` object takes precedence, and
 * the `fallback` values are used when the base values are null or undefined.
 */


function mergeDatetime(base, fallback) {
  var _ref, _base$start, _ref2, _base$end, _ref3, _base$period, _ref4, _base$utc;

  const datetime = {
    start: (_ref = (_base$start = base.start) !== null && _base$start !== void 0 ? _base$start : fallback === null || fallback === void 0 ? void 0 : fallback.start) !== null && _ref !== void 0 ? _ref : null,
    end: (_ref2 = (_base$end = base.end) !== null && _base$end !== void 0 ? _base$end : fallback === null || fallback === void 0 ? void 0 : fallback.end) !== null && _ref2 !== void 0 ? _ref2 : null,
    period: (_ref3 = (_base$period = base.period) !== null && _base$period !== void 0 ? _base$period : fallback === null || fallback === void 0 ? void 0 : fallback.period) !== null && _ref3 !== void 0 ? _ref3 : null,
    utc: (_ref4 = (_base$utc = base.utc) !== null && _base$utc !== void 0 ? _base$utc : fallback === null || fallback === void 0 ? void 0 : fallback.utc) !== null && _ref4 !== void 0 ? _ref4 : null
  };
  return datetime;
}

function initializeUrlState(_ref5) {
  var _pageFilters$datetime, _pageFilters$datetime2, _storedPageFilters$pi;

  let {
    organization,
    queryParams,
    router,
    memberProjects,
    skipLoadLastUsed,
    shouldForceProject,
    shouldEnforceSingleProject,
    defaultSelection,
    forceProject,
    showAbsolute = true,
    skipInitializeUrlParams = false
  } = _ref5;
  const orgSlug = organization.slug;
  const parsed = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.getStateFromQuery)(queryParams, {
    allowAbsoluteDatetime: showAbsolute,
    allowEmptyPeriod: true
  });
  const {
    datetime: defaultDatetime,
    ...defaultFilters
  } = (0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_10__.getDefaultSelection)();
  const {
    datetime: customDatetime,
    ...customDefaultFilters
  } = defaultSelection !== null && defaultSelection !== void 0 ? defaultSelection : {};
  const pageFilters = { ...defaultFilters,
    ...customDefaultFilters,
    datetime: mergeDatetime(parsed, customDatetime)
  }; // Use period from default if we don't have a period set

  (_pageFilters$datetime2 = (_pageFilters$datetime = pageFilters.datetime).period) !== null && _pageFilters$datetime2 !== void 0 ? _pageFilters$datetime2 : _pageFilters$datetime.period = defaultDatetime.period; // Do not set a period if we have absolute start and end

  if (pageFilters.datetime.start && pageFilters.datetime.end) {
    pageFilters.datetime.period = null;
  }

  const hasDatetimeInUrl = Object.keys(lodash_pick__WEBPACK_IMPORTED_MODULE_5___default()(queryParams, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.DATE_TIME_KEYS)).length > 0;
  const hasProjectOrEnvironmentInUrl = Object.keys(lodash_pick__WEBPACK_IMPORTED_MODULE_5___default()(queryParams, [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM.PROJECT, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM.ENVIRONMENT])).length > 0;

  if (hasProjectOrEnvironmentInUrl) {
    pageFilters.projects = parsed.project || [];
    pageFilters.environments = parsed.environment || [];
  }

  const storedPageFilters = skipLoadLastUsed ? null : (0,sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_9__.getPageFilterStorage)(orgSlug);
  let shouldUsePinnedDatetime = false; // We may want to restore some page filters from local storage. In the new
  // world when they are pinned, and in the old world as long as
  // skipLoadLastUsed is not set to true.

  if (storedPageFilters) {
    const {
      state: storedState,
      pinnedFilters
    } = storedPageFilters;

    if (!hasProjectOrEnvironmentInUrl && pinnedFilters.has('projects')) {
      var _storedState$project;

      pageFilters.projects = (_storedState$project = storedState.project) !== null && _storedState$project !== void 0 ? _storedState$project : [];
    }

    if (!hasProjectOrEnvironmentInUrl && pinnedFilters.has('environments')) {
      var _storedState$environm;

      pageFilters.environments = (_storedState$environm = storedState.environment) !== null && _storedState$environm !== void 0 ? _storedState$environm : [];
    }

    if (!hasDatetimeInUrl && pinnedFilters.has('datetime')) {
      pageFilters.datetime = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.getDatetimeFromState)(storedState);
      shouldUsePinnedDatetime = true;
    }
  }

  const {
    projects,
    environments: environment,
    datetime
  } = pageFilters;
  let newProject = null;
  let project = projects; // Skip enforcing a single project if `shouldForceProject` is true, since a
  // component is controlling what that project needs to be. This is true
  // regardless if user has access to multi projects

  if (shouldForceProject && forceProject) {
    newProject = [getProjectIdFromProject(forceProject)];
  } else if (shouldEnforceSingleProject && !shouldForceProject) {
    // If user does not have access to `global-views` (e.g. multi project
    // select) *and* there is no `project` URL parameter, then we update URL
    // params with:
    //
    //  1) the first project from the list of requested projects from URL params
    //  2) first project user is a member of from org
    //
    // Note this is intentionally skipped if `shouldForceProject == true` since
    // we want to initialize store and wait for the forced project
    //
    if (projects && projects.length > 0) {
      // If there is a list of projects from URL params, select first project
      // from that list
      newProject = typeof projects === 'string' ? [Number(projects)] : [projects[0]];
    } else {
      // When we have finished loading the organization into the props,  i.e.
      // the organization slug is consistent with the URL param--Sentry will
      // get the first project from the organization that the user is a member
      // of.
      newProject = [...memberProjects].slice(0, 1).map(getProjectIdFromProject);
    }
  }

  if (newProject) {
    pageFilters.projects = newProject;
    project = newProject;
  }

  const pinnedFilters = (_storedPageFilters$pi = storedPageFilters === null || storedPageFilters === void 0 ? void 0 : storedPageFilters.pinnedFilters) !== null && _storedPageFilters$pi !== void 0 ? _storedPageFilters$pi : new Set();
  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].initializeUrlState(pageFilters, pinnedFilters);
  updateDesyncedUrlState(router, shouldForceProject);
  const newDatetime = { ...datetime,
    period: parsed.start || parsed.end || parsed.period || shouldUsePinnedDatetime ? datetime.period : null,
    utc: parsed.utc || shouldUsePinnedDatetime ? datetime.utc : null
  };

  if (!skipInitializeUrlParams) {
    updateParams({
      project,
      environment,
      ...newDatetime
    }, router, {
      replace: true,
      keepCursor: true
    });
  }
}

function isProjectsValid(projects) {
  return Array.isArray(projects) && projects.every((lodash_isInteger__WEBPACK_IMPORTED_MODULE_3___default()));
}
/**
 * Updates store and selection URL param if `router` is supplied
 *
 * This accepts `environments` from `options` to also update environments
 * simultaneously as environments are tied to a project, so if you change
 * projects, you may need to clear environments.
 */


function updateProjects(projects, router, options) {
  if (!isProjectsValid(projects)) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_16__.withScope(scope => {
      scope.setExtra('projects', projects);
      _sentry_react__WEBPACK_IMPORTED_MODULE_16__.captureException(new Error('Invalid projects selected'));
    });
    return;
  }

  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].updateProjects(projects, options === null || options === void 0 ? void 0 : options.environments);
  updateParams({
    project: projects,
    environment: options === null || options === void 0 ? void 0 : options.environments
  }, router, options);
  persistPageFilters('projects', options);

  if (options !== null && options !== void 0 && options.environments) {
    persistPageFilters('environments', options);
  }

  updateDesyncedUrlState(router);
}
/**
 * Updates store and updates global environment selection URL param if `router` is supplied
 *
 * @param {String[]} environments List of environments
 * @param {Object} [router] Router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */

function updateEnvironments(environment, router, options) {
  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].updateEnvironments(environment);
  updateParams({
    environment
  }, router, options);
  persistPageFilters('environments', options);
  updateDesyncedUrlState(router);
}
/**
 * Updates store and global datetime selection URL param if `router` is supplied
 *
 * @param {Object} datetime Object with start, end, range keys
 * @param {Object} [router] Router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */

function updateDateTime(datetime, router, options) {
  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].updateDateTime(datetime);
  updateParams(datetime, router, options);
  persistPageFilters('datetime', options);
  updateDesyncedUrlState(router);
}
/**
 * Pins a particular filter so that it is read out of local storage
 */

function pinFilter(filter, pin) {
  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].pin(filter, pin);
  persistPageFilters(null, {
    save: true
  });
}
/**
 * Updates router/URL with new query params
 *
 * @param obj New query params
 * @param [router] React router object
 * @param [options] Options object
 */

function updateParams(obj, router, options) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options); // Only push new location if query params has changed because this will cause a heavy re-render

  if (query_string__WEBPACK_IMPORTED_MODULE_6__.stringify(newQuery) === query_string__WEBPACK_IMPORTED_MODULE_6__.stringify(router.location.query)) {
    return;
  }

  const routerAction = options !== null && options !== void 0 && options.replace ? router.replace : router.push;
  routerAction({
    pathname: router.location.pathname,
    query: newQuery
  });
}
/**
 * Save a specific page filter to local storage.
 *
 * Pinned state is always persisted.
 */


async function persistPageFilters(filter, options) {
  var _organization$slug;

  if (!(options !== null && options !== void 0 && options.save)) {
    return;
  } // XXX(epurkhiser): Since this is called immediately after updating the
  // store, wait for a tick since stores are not updated fully synchronously.
  // A bit goofy, but it works fine.


  await new Promise(resolve => window.setTimeout(resolve, 0));
  const {
    organization
  } = sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_12__["default"].getState();
  const orgSlug = (_organization$slug = organization === null || organization === void 0 ? void 0 : organization.slug) !== null && _organization$slug !== void 0 ? _organization$slug : null; // Can't do anything if we don't have an organization

  if (orgSlug === null) {
    return;
  }

  const targetFilter = filter !== null ? [filter] : [];
  (0,sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_9__.setPageFiltersStorage)(orgSlug, new Set(targetFilter));
}
/**
 * Checks if the URL state has changed in synchronization from the local
 * storage state, and persists that check into the store.
 *
 * If shouldForceProject is enabled, then we do not record any url desync
 * for the project.
 */


async function updateDesyncedUrlState(router, shouldForceProject) {
  var _currentQuery$start, _storedState$start, _currentQuery$end, _storedState$end;

  // Cannot compare URL state without the router
  if (!router) {
    return;
  }

  const {
    query
  } = router.location; // XXX(epurkhiser): Since this is called immediately after updating the
  // store, wait for a tick since stores are not updated fully synchronously.
  // This function *should* be called only after persistPageFilters has been
  // called as well This function *should* be called only after
  // persistPageFilters has been called as well

  await new Promise(resolve => window.setTimeout(resolve, 0));
  const {
    organization
  } = sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_12__["default"].getState(); // Can't do anything if we don't have an organization

  if (organization === null) {
    return;
  }

  const storedPageFilters = (0,sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_9__.getPageFilterStorage)(organization.slug); // If we don't have any stored page filters then we do not check desynced state

  if (!storedPageFilters) {
    sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].updateDesyncedFilters(new Set());
    return;
  }

  const currentQuery = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.getStateFromQuery)(query, {
    allowAbsoluteDatetime: true,
    allowEmptyPeriod: true
  });
  const differingFilters = new Set();
  const {
    pinnedFilters,
    state: storedState
  } = storedPageFilters; // Are selected projects different?

  if (pinnedFilters.has('projects') && currentQuery.project !== null && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_14__.valueIsEqual)(currentQuery.project, storedState.project) && !shouldForceProject) {
    differingFilters.add('projects');
  } // Are selected environments different?


  if (pinnedFilters.has('environments') && currentQuery.environment !== null && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_14__.valueIsEqual)(currentQuery.environment, storedState.environment)) {
    differingFilters.add('environments');
  }

  const dateTimeInQuery = currentQuery.end !== null || currentQuery.start !== null || currentQuery.utc !== null || currentQuery.period !== null; // Is the datetime filter different?

  if (pinnedFilters.has('datetime') && dateTimeInQuery && (currentQuery.period !== storedState.period || ((_currentQuery$start = currentQuery.start) === null || _currentQuery$start === void 0 ? void 0 : _currentQuery$start.getTime()) !== ((_storedState$start = storedState.start) === null || _storedState$start === void 0 ? void 0 : _storedState$start.getTime()) || ((_currentQuery$end = currentQuery.end) === null || _currentQuery$end === void 0 ? void 0 : _currentQuery$end.getTime()) !== ((_storedState$end = storedState.end) === null || _storedState$end === void 0 ? void 0 : _storedState$end.getTime()) || currentQuery.utc !== storedState.utc)) {
    differingFilters.add('datetime');
  }

  sentry_actions_pageFiltersActions__WEBPACK_IMPORTED_MODULE_7__["default"].updateDesyncedFilters(differingFilters);
}
/**
 * Merges an UpdateParams object into a Location['query'] object. Results in a
 * PageFilterQuery
 *
 * Preserves the old query params, except for `cursor` (can be overridden with
 * keepCursor option)
 *
 * @param obj New query params
 * @param currentQuery The current query parameters
 * @param [options] Options object
 */


function getNewQueryParams(obj, currentQuery) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const {
    resetParams,
    keepCursor
  } = options;
  const cleanCurrentQuery = !!(resetParams !== null && resetParams !== void 0 && resetParams.length) ? lodash_omit__WEBPACK_IMPORTED_MODULE_4___default()(currentQuery, resetParams) : currentQuery; // Normalize existing query parameters

  const currentQueryState = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.getStateFromQuery)(cleanCurrentQuery, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true
  }); // Extract non page filter parameters.

  const cursorParam = !keepCursor ? 'cursor' : null;
  const omittedParameters = [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM), cursorParam].filter(sentry_utils__WEBPACK_IMPORTED_MODULE_14__.defined);
  const extraParams = lodash_omit__WEBPACK_IMPORTED_MODULE_4___default()(cleanCurrentQuery, omittedParameters); // Override parameters

  const {
    project,
    environment,
    start,
    end,
    utc
  } = { ...currentQueryState,
    ...obj
  }; // Only set a stats period if we don't have an absolute date

  const statsPeriod = !start && !end ? obj.period || currentQueryState.period : null;
  const newQuery = {
    project: project === null || project === void 0 ? void 0 : project.map(String),
    environment,
    start: statsPeriod ? null : start instanceof Date ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__.getUtcDateString)(start) : start,
    end: statsPeriod ? null : end instanceof Date ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_15__.getUtcDateString)(end) : end,
    utc: utc ? 'true' : null,
    statsPeriod,
    ...extraParams
  };
  const paramEntries = Object.entries(newQuery).filter(_ref6 => {
    let [_, value] = _ref6;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_14__.defined)(value);
  });
  return Object.fromEntries(paramEntries);
}

function revertToPinnedFilters(orgSlug, router) {
  var _getPageFilterStorage;

  const {
    selection,
    desyncedFilters
  } = sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_13__["default"].getState();
  const storedFilterState = (_getPageFilterStorage = (0,sentry_components_organizations_pageFilters_persistence__WEBPACK_IMPORTED_MODULE_9__.getPageFilterStorage)(orgSlug)) === null || _getPageFilterStorage === void 0 ? void 0 : _getPageFilterStorage.state;

  if (!storedFilterState) {
    return;
  }

  const newParams = {
    project: desyncedFilters.has('projects') ? storedFilterState.project : selection.projects,
    environment: desyncedFilters.has('environments') ? storedFilterState.environment : selection.environments,
    ...(desyncedFilters.has('datetime') ? lodash_pick__WEBPACK_IMPORTED_MODULE_5___default()(storedFilterState, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.DATE_TIME_KEYS) : selection.datetime)
  };
  updateParams(newParams, router, {
    keepCursor: true
  });
  updateDesyncedUrlState(router);
}

/***/ }),

/***/ "./app/actionCreators/savedSearches.tsx":
/*!**********************************************!*\
  !*** ./app/actionCreators/savedSearches.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createSavedSearch": () => (/* binding */ createSavedSearch),
/* harmony export */   "deleteSavedSearch": () => (/* binding */ deleteSavedSearch),
/* harmony export */   "fetchProjectSavedSearches": () => (/* binding */ fetchProjectSavedSearches),
/* harmony export */   "fetchRecentSearches": () => (/* binding */ fetchRecentSearches),
/* harmony export */   "fetchSavedSearches": () => (/* binding */ fetchSavedSearches),
/* harmony export */   "pinSearch": () => (/* binding */ pinSearch),
/* harmony export */   "resetSavedSearches": () => (/* binding */ resetSavedSearches),
/* harmony export */   "saveRecentSearch": () => (/* binding */ saveRecentSearch),
/* harmony export */   "unpinSearch": () => (/* binding */ unpinSearch)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/savedSearchesActions */ "./app/actions/savedSearchesActions.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");






function resetSavedSearches() {
  sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].resetSavedSearches();
}
function fetchSavedSearches(api, orgSlug) {
  const url = `/organizations/${orgSlug}/searches/`;
  sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].startFetchSavedSearches();
  const promise = api.requestPromise(url, {
    method: 'GET'
  });
  promise.then(resp => {
    sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchSavedSearchesSuccess(resp);
  }).catch(err => {
    sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].fetchSavedSearchesError(err);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to load saved searches'));
  });
  return promise;
}
function fetchProjectSavedSearches(api, orgSlug, projectId) {
  const url = `/projects/${orgSlug}/${projectId}/searches/`;
  return api.requestPromise(url, {
    method: 'GET'
  });
}

const getRecentSearchUrl = orgSlug => `/organizations/${orgSlug}/recent-searches/`;
/**
 * Saves search term for `user` + `orgSlug`
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query The search term that was used
 */


function saveRecentSearch(api, orgSlug, type, query) {
  const url = getRecentSearchUrl(orgSlug);
  const promise = api.requestPromise(url, {
    method: 'POST',
    data: {
      query,
      type
    }
  });
  promise.catch((0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__["default"])('Unable to save a recent search'));
  return promise;
}
/**
 * Creates a saved search
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param name Saved search name
 * @param query Query to save
 */

function createSavedSearch(api, orgSlug, name, query, sort) {
  const promise = api.requestPromise(`/organizations/${orgSlug}/searches/`, {
    method: 'POST',
    data: {
      type: sentry_types__WEBPACK_IMPORTED_MODULE_4__.SavedSearchType.ISSUE,
      query,
      name,
      sort
    }
  }); // Need to wait for saved search to save unfortunately because we need to redirect
  // to saved search URL

  promise.then(resp => {
    sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].createSavedSearchSuccess(resp);
  });
  return promise;
}
/**
 * Fetches a list of recent search terms conducted by `user` for `orgSlug`
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param type Context for where search happened, 0 for issue, 1 for event
 * @param query A query term used to filter results
 *
 * @return Returns a list of objects of recent search queries performed by user
 */

function fetchRecentSearches(api, orgSlug, type, query) {
  const url = getRecentSearchUrl(orgSlug);
  const promise = api.requestPromise(url, {
    query: {
      query,
      type,
      limit: sentry_constants__WEBPACK_IMPORTED_MODULE_2__.MAX_AUTOCOMPLETE_RECENT_SEARCHES
    }
  });
  promise.catch(resp => {
    if (resp.status !== 401 && resp.status !== 403) {
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__["default"])('Unable to fetch recent searches')(resp);
    }
  });
  return promise;
}

const getPinSearchUrl = orgSlug => `/organizations/${orgSlug}/pinned-searches/`;

function pinSearch(api, orgSlug, type, query, sort) {
  const url = getPinSearchUrl(orgSlug); // Optimistically update store

  sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].pinSearch(type, query, sort);
  const promise = api.requestPromise(url, {
    method: 'PUT',
    data: {
      query,
      type,
      sort
    }
  });
  promise.then(sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].pinSearchSuccess);
  promise.catch((0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__["default"])('Unable to pin search'));
  promise.catch(() => {
    sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].unpinSearch(type);
  });
  return promise;
}
function unpinSearch(api, orgSlug, type, pinnedSearch) {
  const url = getPinSearchUrl(orgSlug); // Optimistically update store

  sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].unpinSearch(type);
  const promise = api.requestPromise(url, {
    method: 'DELETE',
    data: {
      type
    }
  });
  promise.catch((0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__["default"])('Unable to un-pin search'));
  promise.catch(() => {
    const {
      type: pinnedType,
      query
    } = pinnedSearch;
    sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].pinSearch(pinnedType, query);
  });
  return promise;
}
/**
 * Send a DELETE request to remove a saved search
 *
 * @param api API client
 * @param orgSlug Organization slug
 * @param search The search to remove.
 */

function deleteSavedSearch(api, orgSlug, search) {
  const url = `/organizations/${orgSlug}/searches/${search.id}/`;
  const promise = api.requestPromise(url, {
    method: 'DELETE'
  }).then(() => sentry_actions_savedSearchesActions__WEBPACK_IMPORTED_MODULE_1__["default"].deleteSavedSearchSuccess(search)).catch((0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_5__["default"])('Unable to delete a saved search'));
  return promise;
}

/***/ }),

/***/ "./app/actionCreators/tags.tsx":
/*!*************************************!*\
  !*** ./app/actionCreators/tags.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchOrganizationTags": () => (/* binding */ fetchOrganizationTags),
/* harmony export */   "fetchTagValues": () => (/* binding */ fetchTagValues),
/* harmony export */   "loadOrganizationTags": () => (/* binding */ loadOrganizationTags)
/* harmony export */ });
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_alertStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/alertStore */ "./app/stores/alertStore.tsx");
/* harmony import */ var sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/tagStore */ "./app/stores/tagStore.tsx");




const MAX_TAGS = 1000;

function tagFetchSuccess(tags) {
  // We occasionally get undefined passed in when APIs are having a bad time.
  tags = tags || [];
  const trimmedTags = tags.slice(0, MAX_TAGS);

  if (tags.length > MAX_TAGS) {
    sentry_stores_alertStore__WEBPACK_IMPORTED_MODULE_2__["default"].addAlert({
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('You have too many unique tags and some have been truncated'),
      type: 'warning'
    });
  }

  sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].loadTagsSuccess(trimmedTags);
}
/**
 * Load an organization's tags based on a global selection value.
 */


function loadOrganizationTags(api, orgId, selection) {
  sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].reset();
  const url = `/organizations/${orgId}/tags/`;
  const query = selection.datetime ? { ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__.normalizeDateTimeParams)(selection.datetime)
  } : {};
  query.use_cache = '1';

  if (selection.projects) {
    query.project = selection.projects.map(String);
  }

  const promise = api.requestPromise(url, {
    method: 'GET',
    query
  });
  promise.then(tagFetchSuccess);
  return promise;
}
/**
 * Fetch tags for an organization or a subset or projects.
 */

function fetchOrganizationTags(api, orgId) {
  let projectIds = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].reset();
  const url = `/organizations/${orgId}/tags/`;
  const query = {
    use_cache: '1'
  };

  if (projectIds) {
    query.project = projectIds;
  }

  const promise = api.requestPromise(url, {
    method: 'GET',
    query
  });
  promise.then(tagFetchSuccess);
  return promise;
}
/**
 * Fetch tag values for an organization.
 * The `projectIds` argument can be used to subset projects.
 */

function fetchTagValues(api, orgId, tagKey) {
  let search = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  let projectIds = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
  let endpointParams = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;
  let includeTransactions = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : false;
  let includeSessions = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : false;
  let sort = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : null;
  const url = `/organizations/${orgId}/tags/${tagKey}/values/`;
  const query = {};

  if (search) {
    query.query = search;
  }

  if (projectIds) {
    query.project = projectIds;
  }

  if (endpointParams) {
    if (endpointParams.start) {
      query.start = endpointParams.start;
    }

    if (endpointParams.end) {
      query.end = endpointParams.end;
    }

    if (endpointParams.statsPeriod) {
      query.statsPeriod = endpointParams.statsPeriod;
    }
  }

  if (includeTransactions) {
    query.includeTransactions = '1';
  }

  if (includeSessions) {
    query.includeSessions = '1';
  }

  if (sort) {
    query.sort = sort;
  }

  return api.requestPromise(url, {
    method: 'GET',
    query
  });
}

/***/ }),

/***/ "./app/actionCreators/teams.tsx":
/*!**************************************!*\
  !*** ./app/actionCreators/teams.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createTeam": () => (/* binding */ createTeam),
/* harmony export */   "fetchTeamDetails": () => (/* binding */ fetchTeamDetails),
/* harmony export */   "fetchTeams": () => (/* binding */ fetchTeams),
/* harmony export */   "fetchUserTeams": () => (/* binding */ fetchUserTeams),
/* harmony export */   "joinTeam": () => (/* binding */ joinTeam),
/* harmony export */   "leaveTeam": () => (/* binding */ leaveTeam),
/* harmony export */   "removeTeam": () => (/* binding */ removeTeam),
/* harmony export */   "updateTeamSuccess": () => (/* binding */ updateTeamSuccess)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");







const doCallback = function () {
  let params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  let name = arguments.length > 1 ? arguments[1] : undefined;

  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_4__.callIfFunction)(params[name], ...args);
};
/**
 * Note these are both slugs
 */


// Fetch teams for org
function fetchTeams(api, params, options) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAll(params.orgId);
  return api.request(`/teams/${params.orgId}/`, {
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAllSuccess(params.orgId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchAllError(params.orgId, error);
      doCallback(options, 'error', error);
    }
  });
} // Fetch user teams for current org and place them in the team store

async function fetchUserTeams(api, params) {
  const teams = await api.requestPromise(`/organizations/${params.orgId}/user-teams/`);
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadUserTeams(teams);
}
function fetchTeamDetails(api, params, options) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetails(params.teamId);
  return api.request(`/teams/${params.orgId}/${params.teamId}/`, {
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetailsSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchDetailsError(params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function updateTeamSuccess(teamId, data) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(teamId, data);
}
function joinTeam(api, params, options) {
  var _params$memberId;

  const endpoint = `/organizations/${params.orgId}/members/${(_params$memberId = params.memberId) !== null && _params$memberId !== void 0 ? _params$memberId : 'me'}/teams/${params.teamId}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].update(id, params.teamId);
  return api.request(endpoint, {
    method: 'POST',
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function leaveTeam(api, params, options) {
  const endpoint = `/organizations/${params.orgId}/members/${params.memberId || 'me'}/teams/${params.teamId}/`;
  const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_5__.uniqueId)();
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].update(id, params.teamId);
  return api.request(endpoint, {
    method: 'DELETE',
    success: data => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    }
  });
}
function createTeam(api, team, params) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeam(team);
  return api.requestPromise(`/organizations/${params.orgId}/teams/`, {
    method: 'POST',
    data: team
  }).then(data => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeamSuccess(data);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[team] has been added to the [organization] organization', {
      team: `#${data.slug}`,
      organization: params.orgId
    }));
    return data;
  }, err => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].createTeamError(team.slug, err);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Unable to create [team] in the [organization] organization', {
      team: `#${team.slug}`,
      organization: params.orgId
    }));
    throw err;
  });
}
function removeTeam(api, params) {
  sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeam(params.teamId);
  return api.requestPromise(`/teams/${params.orgId}/${params.teamId}/`, {
    method: 'DELETE'
  }).then(data => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamSuccess(params.teamId, data);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[team] has been removed from the [organization] organization', {
      team: `#${params.teamId}`,
      organization: params.orgId
    }));
    return data;
  }, err => {
    sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamError(params.teamId, err);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Unable to remove [team] from the [organization] organization', {
      team: `#${params.teamId}`,
      organization: params.orgId
    }));
    throw err;
  });
}

/***/ }),

/***/ "./app/actions/savedSearchesActions.tsx":
/*!**********************************************!*\
  !*** ./app/actions/savedSearchesActions.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const SavedSearchActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['resetSavedSearches', 'startFetchSavedSearches', 'fetchSavedSearchesSuccess', 'fetchSavedSearchesError', 'createSavedSearchSuccess', 'deleteSavedSearchSuccess', 'pinSearch', 'pinSearchSuccess', 'unpinSearch']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SavedSearchActions);

/***/ }),

/***/ "./app/components/assigneeSelector.tsx":
/*!*********************************************!*\
  !*** ./app/components/assigneeSelector.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "putSessionUserFirst": () => (/* binding */ putSessionUserFirst)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_avatar_suggestedAvatarStack__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/avatar/suggestedAvatarStack */ "./app/components/avatar/suggestedAvatarStack.tsx");
/* harmony import */ var sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/avatar/teamAvatar */ "./app/components/avatar/teamAvatar.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownBubble__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dropdownBubble */ "./app/components/dropdownBubble.tsx");
/* harmony import */ var sentry_components_highlight__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/highlight */ "./app/components/highlight.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



























class AssigneeSelector extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unlisteners", [sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].listen(itemIds => this.onGroupChange(itemIds), undefined), sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_22__["default"].listen(users => {
      this.handleMemberListUpdate(users);
    }, undefined)]);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMemberListUpdate", members => {
      if (members === this.state.memberList) {
        return;
      }

      this.setState({
        memberList: members
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAssign", (_ref, _state, e) => {
      let {
        value: {
          type,
          assignee
        }
      } = _ref;

      if (type === 'member') {
        this.assignToUser(assignee);
      }

      if (type === 'team') {
        this.assignToTeam(assignee);
      }

      e === null || e === void 0 ? void 0 : e.stopPropagation();
      const {
        onAssign
      } = this.props;

      if (onAssign) {
        const suggestionType = type === 'member' ? 'user' : type;
        const suggestion = this.getSuggestedAssignees().find(actor => actor.type === suggestionType && actor.id === assignee.id);
        onAssign === null || onAssign === void 0 ? void 0 : onAssign(type, assignee, suggestion);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "clearAssignTo", e => {
      // clears assignment
      (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.clearAssignment)(this.props.id, 'assignee_selector');
      this.setState({
        loading: true
      });
      e.stopPropagation();
    });
  }

  getInitialState() {
    const group = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].get(this.props.id);
    const memberList = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_22__["default"].loaded ? sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_22__["default"].getAll() : undefined;
    const loading = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].hasStatus(this.props.id, 'assignTo');
    const suggestedOwners = group === null || group === void 0 ? void 0 : group.owners;
    return {
      assignedTo: group === null || group === void 0 ? void 0 : group.assignedTo,
      memberList,
      loading,
      suggestedOwners
    };
  }

  componentWillReceiveProps(nextProps) {
    const loading = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].hasStatus(nextProps.id, 'assignTo');

    if (nextProps.id !== this.props.id || loading !== this.state.loading) {
      const group = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].get(this.props.id);
      this.setState({
        loading,
        assignedTo: group === null || group === void 0 ? void 0 : group.assignedTo,
        suggestedOwners: group === null || group === void 0 ? void 0 : group.owners
      });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.loading !== this.state.loading) {
      return true;
    } // If the memberList in props has changed, re-render as
    // props have updated, and we won't use internal state anyways.


    if (nextProps.memberList && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_25__.valueIsEqual)(this.props.memberList, nextProps.memberList)) {
      return true;
    }

    const currentMembers = this.memberList(); // XXX(billyvg): this means that once `memberList` is not-null, this component will never update due to `memberList` changes
    // Note: this allows us to show a "loading" state for memberList, but only before `MemberListStore.loadInitialData`
    // is called

    if (currentMembers === undefined && nextState.memberList !== currentMembers) {
      return true;
    }

    return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_25__.valueIsEqual)(nextState.assignedTo, this.state.assignedTo, true);
  }

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener === null || unlistener === void 0 ? void 0 : unlistener());
  }

  memberList() {
    return this.props.memberList ? this.props.memberList : this.state.memberList;
  }

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }

    const group = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].get(this.props.id);
    this.setState({
      assignedTo: group === null || group === void 0 ? void 0 : group.assignedTo,
      suggestedOwners: group === null || group === void 0 ? void 0 : group.owners,
      loading: sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].hasStatus(this.props.id, 'assignTo')
    });
  }

  assignableTeams() {
    var _ProjectsStore$getByS, _ProjectsStore$getByS2;

    const group = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].get(this.props.id);

    if (!group) {
      return [];
    }

    const teams = (_ProjectsStore$getByS = (_ProjectsStore$getByS2 = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_23__["default"].getBySlug(group.project.slug)) === null || _ProjectsStore$getByS2 === void 0 ? void 0 : _ProjectsStore$getByS2.teams) !== null && _ProjectsStore$getByS !== void 0 ? _ProjectsStore$getByS : [];
    return teams.sort((a, b) => a.slug.localeCompare(b.slug)).map(team => ({
      id: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_25__.buildTeamId)(team.id),
      display: `#${team.slug}`,
      email: team.id,
      team
    }));
  }

  assignToUser(user) {
    (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.assignToUser)({
      id: this.props.id,
      user,
      assignedBy: 'assignee_selector'
    });
    this.setState({
      loading: true
    });
  }

  assignToTeam(team) {
    (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.assignToActor)({
      actor: {
        id: team.id,
        type: 'team'
      },
      id: this.props.id,
      assignedBy: 'assignee_selector'
    });
    this.setState({
      loading: true
    });
  }

  renderMemberNode(member, suggestedReason) {
    const {
      size
    } = this.props;
    const sessionUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_20__["default"].get('user');

    const handleSelect = () => this.assignToUser(member);

    return {
      value: {
        type: 'member',
        assignee: member
      },
      searchKey: `${member.email} ${member.name}`,
      label: _ref2 => {
        let {
          inputValue
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(MenuItemWrapper, {
          "data-test-id": "assignee-option",
          onSelect: handleSelect,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(IconContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_9__["default"], {
              user: member,
              size: size
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(Label, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_highlight__WEBPACK_IMPORTED_MODULE_12__["default"], {
              text: inputValue,
              children: sessionUser.id === member.id ? `${member.name || member.email} ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('(You)')}` : member.name || member.email
            }), suggestedReason && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(SuggestedReason, {
              children: suggestedReason
            })]
          })]
        }, (0,sentry_utils__WEBPACK_IMPORTED_MODULE_25__.buildUserId)(member.id));
      }
    };
  }

  renderNewMemberNodes() {
    const members = putSessionUserFirst(this.memberList());
    return members.map(member => this.renderMemberNode(member));
  }

  renderTeamNode(assignableTeam, suggestedReason) {
    const {
      size
    } = this.props;
    const {
      id,
      display,
      team
    } = assignableTeam;

    const handleSelect = () => this.assignToTeam(team);

    return {
      value: {
        type: 'team',
        assignee: team
      },
      searchKey: team.slug,
      label: _ref3 => {
        let {
          inputValue
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(MenuItemWrapper, {
          "data-test-id": "assignee-option",
          onSelect: handleSelect,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(IconContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_8__["default"], {
              team: team,
              size: size
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(Label, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_highlight__WEBPACK_IMPORTED_MODULE_12__["default"], {
              text: inputValue,
              children: display
            }), suggestedReason && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(SuggestedReason, {
              children: suggestedReason
            })]
          })]
        }, id);
      }
    };
  }

  renderNewTeamNodes() {
    return this.assignableTeams().map(team => this.renderTeamNode(team));
  }

  renderSuggestedAssigneeNodes() {
    const {
      assignedTo
    } = this.state; // filter out suggested assignees if a suggestion is already selected

    return this.getSuggestedAssignees().filter(_ref4 => {
      let {
        type,
        id
      } = _ref4;
      return !(type === (assignedTo === null || assignedTo === void 0 ? void 0 : assignedTo.type) && id === (assignedTo === null || assignedTo === void 0 ? void 0 : assignedTo.id));
    }).filter(_ref5 => {
      let {
        type
      } = _ref5;
      return type === 'user' || type === 'team';
    }).map(_ref6 => {
      let {
        type,
        suggestedReason,
        assignee
      } = _ref6;
      const reason = suggestedReason === 'suspectCommit' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('(Suspect Commit)') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('(Issue Owner)');

      if (type === 'user') {
        return this.renderMemberNode(assignee, reason);
      }

      return this.renderTeamNode(assignee, reason);
    });
  }

  renderDropdownGroupLabel(label) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(GroupHeader, {
      children: label
    });
  }

  renderNewDropdownItems() {
    var _this$renderSuggested;

    const teams = this.renderNewTeamNodes();
    const members = this.renderNewMemberNodes();
    const sessionUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_20__["default"].get('user');
    const suggestedAssignees = (_this$renderSuggested = this.renderSuggestedAssigneeNodes()) !== null && _this$renderSuggested !== void 0 ? _this$renderSuggested : [];
    const filteredSessionUser = members.filter(member => member.value.assignee.id === sessionUser.id); // filter out session user from Suggested

    const filteredSuggestedAssignees = suggestedAssignees.filter(assignee => {
      return assignee.value.type === 'member' ? assignee.value.assignee.id !== sessionUser.id : assignee;
    });
    const assigneeIds = new Set(filteredSuggestedAssignees.map(assignee => `${assignee.value.type}:${assignee.value.assignee.id}`)); // filter out duplicates of Team/Member if also a Suggested Assignee

    const filteredTeams = teams.filter(team => {
      return !assigneeIds.has(`${team.value.type}:${team.value.assignee.id}`);
    });
    const filteredMembers = members.filter(member => {
      return !assigneeIds.has(`${member.value.type}:${member.value.assignee.id}`) && member.value.assignee.id !== sessionUser.id;
    });
    const dropdownItems = [{
      label: this.renderDropdownGroupLabel((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Teams')),
      id: 'team-header',
      items: filteredTeams
    }, {
      label: this.renderDropdownGroupLabel((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('People')),
      id: 'members-header',
      items: filteredMembers
    }]; // session user is first on dropdown

    if (suggestedAssignees.length || filteredSessionUser.length) {
      dropdownItems.unshift({
        label: this.renderDropdownGroupLabel((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Suggested')),
        id: 'suggested-header',
        items: filteredSessionUser
      }, {
        hideGroupLabel: true,
        id: 'suggested-list',
        items: filteredSuggestedAssignees
      });
    }

    return dropdownItems;
  }

  renderInviteMemberLink() {
    const {
      loading
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(InviteMemberLink, {
      to: "",
      "data-test-id": "invite-member",
      disabled: loading,
      onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openInviteMembersModal)({
        source: 'assignee_selector'
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(MenuItemFooterWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(IconContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconAdd, {
            color: "purple300",
            isCircled: true,
            size: "14px"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(Label, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Invite Member')
        })]
      })
    });
  }

  getSuggestedAssignees() {
    var _this$memberList;

    const {
      suggestedOwners
    } = this.state;

    if (!suggestedOwners) {
      return [];
    }

    const assignableTeams = this.assignableTeams();
    const memberList = (_this$memberList = this.memberList()) !== null && _this$memberList !== void 0 ? _this$memberList : [];
    const suggestedAssignees = suggestedOwners.map(owner => {
      // converts a backend suggested owner to a suggested assignee
      const [ownerType, id] = owner.owner.split(':');

      if (ownerType === 'user') {
        const member = memberList.find(user => user.id === id);

        if (member) {
          return {
            type: 'user',
            id,
            name: member.name,
            suggestedReason: owner.type,
            assignee: member
          };
        }
      } else if (ownerType === 'team') {
        const matchingTeam = assignableTeams.find(assignableTeam => assignableTeam.id === owner.owner);

        if (matchingTeam) {
          return {
            type: 'team',
            id,
            name: matchingTeam.team.name,
            suggestedReason: owner.type,
            assignee: matchingTeam
          };
        }
      }

      return null;
    });
    return suggestedAssignees.filter(owner => !!owner);
  }

  render() {
    const {
      disabled,
      noDropdown
    } = this.props;
    const {
      loading,
      assignedTo
    } = this.state;
    const memberList = this.memberList();
    const suggestedActors = this.getSuggestedAssignees();
    const suggestedReasons = {
      suspectCommit: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('Based on [commit:commit data]', {
        commit: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(TooltipSubExternalLink, {
          href: "https://docs.sentry.io/product/sentry-basics/integrate-frontend/configure-scms/"
        })
      }),
      ownershipRule: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Matching Issue Owners Rule')
    };
    const assignedToSuggestion = suggestedActors.find(actor => actor.id === (assignedTo === null || assignedTo === void 0 ? void 0 : assignedTo.id));
    const avatarElement = assignedTo ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_6__["default"], {
      actor: assignedTo,
      className: "avatar",
      size: 24,
      tooltip: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(TooltipWrapper, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('Assigned to [name]', {
          name: assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name
        }), assignedToSuggestion && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(TooltipSubtext, {
          children: suggestedReasons[assignedToSuggestion.suggestedReason]
        })]
      })
    }) : suggestedActors && suggestedActors.length > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_avatar_suggestedAvatarStack__WEBPACK_IMPORTED_MODULE_7__["default"], {
      size: 24,
      owners: suggestedActors,
      tooltipOptions: {
        isHoverable: true
      },
      tooltip: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(TooltipWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('Suggestion: [name]', {
            name: suggestedActors[0].type === 'team' ? `#${suggestedActors[0].name}` : suggestedActors[0].name
          }), suggestedActors.length > 1 && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tn)(' + %s other', ' + %s others', suggestedActors.length - 1)]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(TooltipSubtext, {
          children: suggestedReasons[suggestedActors[0].suggestedReason]
        })]
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_17__["default"], {
      isHoverable: true,
      skipWrapper: true,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(TooltipWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Unassigned')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(TooltipSubtext, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('You can auto-assign issues by adding [issueOwners:Issue Owner rules].', {
            issueOwners: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(TooltipSubExternalLink, {
              href: "https://docs.sentry.io/product/error-monitoring/issue-owners/"
            })
          })
        })]
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledIconUser, {
        "data-test-id": "unassigned",
        size: "20px",
        color: "gray400"
      })
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(AssigneeWrapper, {
      children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_15__["default"], {
        mini: true,
        style: {
          height: '24px',
          margin: 0,
          marginRight: 11
        }
      }), !loading && !noDropdown && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__["default"], {
        disabled: disabled,
        maxHeight: 400,
        onOpen: e => {
          // This can be called multiple times and does not always have `event`
          e === null || e === void 0 ? void 0 : e.stopPropagation();
        },
        busy: memberList === undefined,
        items: memberList !== undefined ? this.renderNewDropdownItems() : null,
        alignMenu: "right",
        onSelect: this.handleAssign,
        itemSize: "small",
        searchPlaceholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Filter teams and people'),
        menuFooter: assignedTo ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(MenuItemFooterWrapper, {
            role: "button",
            onClick: this.clearAssignTo,
            py: 0,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(IconContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconClose, {
                color: "purple300",
                isCircled: true,
                size: "14px"
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(Label, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Clear Assignee')
            })]
          }), this.renderInviteMemberLink()]
        }) : this.renderInviteMemberLink(),
        disableLabelPadding: true,
        emptyHidesInput: true,
        children: _ref7 => {
          let {
            getActorProps,
            isOpen
          } = _ref7;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(DropdownButton, {
            "data-test-id": "assignee-selector",
            ...getActorProps({}),
            children: [avatarElement, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledChevron, {
              direction: isOpen ? 'up' : 'down',
              size: "xs"
            })]
          });
        }
      }), !loading && noDropdown && avatarElement]
    });
  }

}

AssigneeSelector.displayName = "AssigneeSelector";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AssigneeSelector, "defaultProps", {
  size: 20
});

function putSessionUserFirst(members) {
  // If session user is in the filtered list of members, put them at the top
  if (!members) {
    return [];
  }

  const sessionUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_20__["default"].get('user');
  const sessionUserIndex = members.findIndex(member => member.id === (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id));

  if (sessionUserIndex === -1) {
    return members;
  }

  const arrangedMembers = [members[sessionUserIndex]];
  arrangedMembers.push(...members.slice(0, sessionUserIndex));
  arrangedMembers.push(...members.slice(sessionUserIndex + 1));
  return arrangedMembers;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AssigneeSelector);

const AssigneeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c13"
} : 0)("display:flex;justify-content:flex-end;", sentry_components_dropdownBubble__WEBPACK_IMPORTED_MODULE_11__["default"], "{right:-14px;}" + ( true ? "" : 0));

const StyledIconUser = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconUser,  true ? {
  target: "exyuw1c12"
} : 0)( true ? {
  name: "2bhlo8",
  styles: "margin-right:2px"
} : 0);

const IconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c11"
} : 0)( true ? {
  name: "ksp8pg",
  styles: "display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0"
} : 0);

const MenuItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c10"
} : 0)("cursor:", p => p.disabled ? 'not-allowed' : 'pointer', ";display:flex;align-items:center;font-size:13px;", p => typeof p.py !== 'undefined' && `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `, ";" + ( true ? "" : 0));

const MenuItemFooterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(MenuItemWrapper,  true ? {
  target: "exyuw1c9"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(1), ";border-top:1px solid ", p => p.theme.innerBorder, ";background-color:", p => p.theme.tag.highlight.background, ";color:", p => p.theme.active, ";:hover{color:", p => p.theme.activeHover, ";svg{fill:", p => p.theme.activeHover, ";}}" + ( true ? "" : 0));

const InviteMemberLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "exyuw1c8"
} : 0)("color:", p => p.disabled ? p.theme.disabled : p.theme.textColor, ";" + ( true ? "" : 0));

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "exyuw1c7"
} : 0)( true ? {
  name: "18jsklt",
  styles: "margin-left:6px"
} : 0);

const StyledChevron = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconChevron,  true ? {
  target: "exyuw1c6"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(1), ";" + ( true ? "" : 0));

const DropdownButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c5"
} : 0)( true ? {
  name: "1nfrdh1",
  styles: "display:flex;align-items:center;font-size:20px"
} : 0);

const GroupHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c4"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-weight:600;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(1), " 0;color:", p => p.theme.subText, ";line-height:", p => p.theme.fontSizeSmall, ";text-align:left;" + ( true ? "" : 0));

const SuggestedReason = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "exyuw1c3"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(0.5), ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const TooltipWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c2"
} : 0)( true ? {
  name: "1flj9lk",
  styles: "text-align:left"
} : 0);

const TooltipSubtext = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exyuw1c1"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const TooltipSubExternalLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "exyuw1c0"
} : 0)("color:", p => p.theme.subText, ";text-decoration:underline;:hover{color:", p => p.theme.subText, ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/avatar/actorAvatar.tsx":
/*!***********************************************!*\
  !*** ./app/components/avatar/actorAvatar.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/teamAvatar */ "./app/components/avatar/teamAvatar.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class ActorAvatar extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      actor,
      ...props
    } = this.props;

    if (actor.type === 'user') {
      var _MemberListStore$getB;

      const user = actor.id ? (_MemberListStore$getB = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_6__["default"].getById(actor.id)) !== null && _MemberListStore$getB !== void 0 ? _MemberListStore$getB : actor : actor;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
        user: user,
        ...props
      });
    }

    if (actor.type === 'team') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_7__["default"], {
        ids: [actor.id],
        children: _ref => {
          let {
            initiallyLoaded,
            teams
          } = _ref;
          return initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_3__["default"], {
            team: teams[0],
            ...props
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {
            mini: true
          });
        }
      });
    }

    _sentry_react__WEBPACK_IMPORTED_MODULE_9__.withScope(scope => {
      scope.setExtra('actor', actor);
      _sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException(new Error('Unknown avatar type'));
    });
    return null;
  }

}

ActorAvatar.displayName = "ActorAvatar";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ActorAvatar, "defaultProps", {
  size: 24,
  hasTooltip: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActorAvatar);

/***/ }),

/***/ "./app/components/avatar/suggestedAvatarStack.tsx":
/*!********************************************************!*\
  !*** ./app/components/avatar/suggestedAvatarStack.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_avatar_baseAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/baseAvatar */ "./app/components/avatar/baseAvatar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 5;

const SuggestedAvatarStack = _ref => {
  let {
    owners,
    tooltip,
    tooltipOptions,
    ...props
  } = _ref;
  const backgroundAvatarProps = { ...props,
    round: owners[0].type === 'user',
    suggested: true
  };
  const numAvatars = Math.min(owners.length, MAX_SUGGESTIONS);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(AvatarStack, {
    "data-test-id": "suggested-avatar-stack",
    children: [[...Array(numAvatars - 1)].map((_, i) => (0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.createElement)(BackgroundAvatar, { ...backgroundAvatarProps,
      key: i,
      type: "background",
      index: i,
      hasTooltip: false
    })), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Avatar, { ...props,
      suggested: true,
      actor: owners[0],
      index: numAvatars - 1,
      tooltip: tooltip,
      tooltipOptions: { ...tooltipOptions,
        skipWrapper: true
      }
    })]
  });
};

SuggestedAvatarStack.displayName = "SuggestedAvatarStack";

const AvatarStack = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1n2deln2"
} : 0)( true ? {
  name: "a1dw9d",
  styles: "display:flex;align-content:center;flex-direction:row-reverse"
} : 0);

const translateStyles = props => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.css)("transform:translateX(", 60 * props.index, "%);" + ( true ? "" : 0),  true ? "" : 0);

const Avatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1n2deln1"
} : 0)(translateStyles, ";" + ( true ? "" : 0));

const BackgroundAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_avatar_baseAvatar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1n2deln0"
} : 0)(translateStyles, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SuggestedAvatarStack);

/***/ }),

/***/ "./app/components/calendar/index.tsx":
/*!*******************************************!*\
  !*** ./app/components/calendar/index.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DatePicker": () => (/* binding */ DatePicker),
/* harmony export */   "DateRangePicker": () => (/* binding */ DateRangePicker)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _loadingIndicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var _placeholder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const LazyDatePicker = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.lazy)(() => Promise.all(/*! import() */[__webpack_require__.e("vendors-node_modules_react-date-range_dist_index_js-node_modules_react-date-range_dist_styles-4538a7"), __webpack_require__.e("app_components_calendar_datePicker_tsx")]).then(__webpack_require__.bind(__webpack_require__, /*! ./datePicker */ "./app/components/calendar/datePicker.tsx")));
const LazyDateRangePicker = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.lazy)(() => Promise.all(/*! import() */[__webpack_require__.e("vendors-node_modules_react-date-range_dist_index_js-node_modules_react-date-range_dist_styles-4538a7"), __webpack_require__.e("app_components_calendar_dateRangePicker_tsx")]).then(__webpack_require__.bind(__webpack_require__, /*! ./dateRangePicker */ "./app/components/calendar/dateRangePicker.tsx")));

const CalendarSuspenseWrapper = _ref => {
  let {
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Suspense, {
    fallback: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
      width: "342px",
      height: "254px",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_loadingIndicator__WEBPACK_IMPORTED_MODULE_2__["default"], {})
    }),
    children: children
  });
};

CalendarSuspenseWrapper.displayName = "CalendarSuspenseWrapper";
const DatePicker = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(CalendarSuspenseWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(LazyDatePicker, { ...props
    })
  });
};
DatePicker.displayName = "DatePicker";
const DateRangePicker = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(CalendarSuspenseWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(LazyDateRangePicker, { ...props
    })
  });
};
DateRangePicker.displayName = "DateRangePicker";

/***/ }),

/***/ "./app/components/charts/barChart.tsx":
/*!********************************************!*\
  !*** ./app/components/charts/barChart.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BarChart": () => (/* binding */ BarChart)
/* harmony export */ });
/* harmony import */ var _series_barSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/barSeries */ "./app/components/charts/series/barSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function BarChart(_ref) {
  let {
    series,
    stacked,
    xAxis,
    animation,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    xAxis: xAxis !== null ? { ...(xAxis || {})
    } : null,
    series: series.map(_ref2 => {
      let {
        seriesName,
        data,
        ...options
      } = _ref2;
      return (0,_series_barSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({
        name: seriesName,
        stack: stacked ? 'stack1' : undefined,
        data: data.map(_ref3 => {
          let {
            value,
            name,
            itemStyle
          } = _ref3;

          if (itemStyle === undefined) {
            return [name, value];
          }

          return {
            value: [name, value],
            itemStyle
          };
        }),
        animation,
        ...options
      });
    })
  });
}
BarChart.displayName = "BarChart";

/***/ }),

/***/ "./app/components/charts/baseChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/baseChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var echarts_lib_component_grid__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! echarts/lib/component/grid */ "../node_modules/echarts/lib/component/grid.js");
/* harmony import */ var echarts_lib_component_graphic__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! echarts/lib/component/graphic */ "../node_modules/echarts/lib/component/graphic.js");
/* harmony import */ var echarts_lib_component_toolbox__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! echarts/lib/component/toolbox */ "../node_modules/echarts/lib/component/toolbox.js");
/* harmony import */ var zrender_lib_svg_svg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! zrender/lib/svg/svg */ "../node_modules/zrender/lib/svg/svg.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/core.js");
/* harmony import */ var echarts_for_react_lib_core__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! echarts-for-react/lib/core */ "../node_modules/echarts-for-react/lib/core.js");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _components_grid__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./components/grid */ "./app/components/charts/components/grid.tsx");
/* harmony import */ var _components_legend__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./components/legend */ "./app/components/charts/components/legend.tsx");
/* harmony import */ var _components_tooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./components/tooltip */ "./app/components/charts/components/tooltip.tsx");
/* harmony import */ var _components_xAxis__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./components/xAxis */ "./app/components/charts/components/xAxis.tsx");
/* harmony import */ var _components_yAxis__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./components/yAxis */ "./app/components/charts/components/yAxis.tsx");
/* harmony import */ var _series_lineSeries__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















 // TODO(ts): What is the series type? EChartOption.Series's data cannot have
// `onClick` since it's typically an array.
//
// Handle series item clicks (e.g. Releases mark line or a single series
// item) This is different than when you hover over an "axis" line on a chart
// (e.g.  if there are 2 series for an axis and you're not directly hovered
// over an item)
//
// Calls "onClick" inside of series data



const handleClick = (clickSeries, instance) => {
  if (clickSeries.data) {
    var _clickSeries$data$onC, _clickSeries$data;

    (_clickSeries$data$onC = (_clickSeries$data = clickSeries.data).onClick) === null || _clickSeries$data$onC === void 0 ? void 0 : _clickSeries$data$onC.call(_clickSeries$data, clickSeries, instance);
  }
};

function BaseChartUnwrapped(_ref) {
  var _ref2, _previousPeriod$map, _series$, _options$animation;

  let {
    colors,
    grid,
    tooltip,
    legend,
    dataZoom,
    toolBox,
    graphic,
    axisPointer,
    previousPeriod,
    echartsTheme,
    devicePixelRatio,
    minutesThresholdToDisplaySeconds,
    showTimeInTooltip,
    useShortDate,
    start,
    end,
    period,
    utc,
    yAxes,
    xAxes,
    style,
    forwardedRef,
    onClick,
    onLegendSelectChanged,
    onHighlight,
    onMouseOut,
    onMouseOver,
    onDataZoom,
    onRestore,
    onFinished,
    onRendered,
    options = {},
    series = [],
    additionalSeries = [],
    yAxis = {},
    xAxis = {},
    autoHeightResize = false,
    height = 200,
    width,
    renderer = 'svg',
    notMerge = true,
    lazyUpdate = false,
    isGroupedByDate = false,
    transformSinglePointToBar = false,
    transformSinglePointToLine = false,
    onChartReady = () => {},
    'data-test-id': dataTestId
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_19__.a)();
  const hasSinglePoints = series === null || series === void 0 ? void 0 : series.every(s => Array.isArray(s.data) && s.data.length <= 1);
  const resolveColors = colors !== undefined ? Array.isArray(colors) ? colors : colors(theme) : null;
  const color = resolveColors || (series.length ? theme.charts.getColorPalette(series.length) : theme.charts.colors);
  const previousPeriodColors = previousPeriod && previousPeriod.length > 1 ? (0,_utils__WEBPACK_IMPORTED_MODULE_18__.lightenHexToRgb)(color) : undefined;
  const transformedSeries = (_ref2 = hasSinglePoints && transformSinglePointToBar ? series === null || series === void 0 ? void 0 : series.map(s => {
    var _s$areaStyle;

    return { ...s,
      type: 'bar',
      barWidth: 40,
      barGap: 0,
      itemStyle: { ...((_s$areaStyle = s.areaStyle) !== null && _s$areaStyle !== void 0 ? _s$areaStyle : {})
      }
    };
  }) : hasSinglePoints && transformSinglePointToLine ? series === null || series === void 0 ? void 0 : series.map(s => {
    var _s$lineStyle, _s$data, _s$data$, _s$data2, _s$data2$;

    return { ...s,
      type: 'line',
      itemStyle: { ...((_s$lineStyle = s.lineStyle) !== null && _s$lineStyle !== void 0 ? _s$lineStyle : {})
      },
      markLine: (s === null || s === void 0 ? void 0 : (_s$data = s.data) === null || _s$data === void 0 ? void 0 : (_s$data$ = _s$data[0]) === null || _s$data$ === void 0 ? void 0 : _s$data$[1]) !== undefined ? (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_8__["default"])({
        silent: true,
        lineStyle: {
          type: 'solid',
          width: 1.5
        },
        data: [{
          yAxis: s === null || s === void 0 ? void 0 : (_s$data2 = s.data) === null || _s$data2 === void 0 ? void 0 : (_s$data2$ = _s$data2[0]) === null || _s$data2$ === void 0 ? void 0 : _s$data2$[1]
        }],
        label: {
          show: false
        }
      }) : undefined
    };
  }) : series) !== null && _ref2 !== void 0 ? _ref2 : [];
  const transformedPreviousPeriod = (_previousPeriod$map = previousPeriod === null || previousPeriod === void 0 ? void 0 : previousPeriod.map((previous, seriesIndex) => (0,_series_lineSeries__WEBPACK_IMPORTED_MODULE_17__["default"])({
    name: previous.seriesName,
    data: previous.data.map(_ref3 => {
      let {
        name,
        value
      } = _ref3;
      return [name, value];
    }),
    lineStyle: {
      color: previousPeriodColors ? previousPeriodColors[seriesIndex] : theme.gray200,
      type: 'dotted'
    },
    itemStyle: {
      color: previousPeriodColors ? previousPeriodColors[seriesIndex] : theme.gray200
    },
    stack: 'previous',
    animation: false
  }))) !== null && _previousPeriod$map !== void 0 ? _previousPeriod$map : [];
  const resolvedSeries = !previousPeriod ? [...transformedSeries, ...additionalSeries] : [...transformedSeries, ...transformedPreviousPeriod, ...additionalSeries];
  const defaultAxesProps = {
    theme
  };
  const yAxisOrCustom = !yAxes ? yAxis !== null ? (0,_components_yAxis__WEBPACK_IMPORTED_MODULE_16__["default"])({
    theme,
    ...yAxis
  }) : undefined : Array.isArray(yAxes) ? yAxes.map(axis => (0,_components_yAxis__WEBPACK_IMPORTED_MODULE_16__["default"])({ ...axis,
    theme
  })) : [(0,_components_yAxis__WEBPACK_IMPORTED_MODULE_16__["default"])(defaultAxesProps), (0,_components_yAxis__WEBPACK_IMPORTED_MODULE_16__["default"])(defaultAxesProps)];
  /**
   * If true seconds will be added to the time format in the tooltips and chart xAxis
   */

  const addSecondsToTimeFormat = isGroupedByDate && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(minutesThresholdToDisplaySeconds) ? (0,_utils__WEBPACK_IMPORTED_MODULE_18__.getDiffInMinutes)({
    start,
    end,
    period
  }) <= minutesThresholdToDisplaySeconds : false;
  const xAxisOrCustom = !xAxes ? xAxis !== null ? (0,_components_xAxis__WEBPACK_IMPORTED_MODULE_15__["default"])({ ...xAxis,
    theme,
    useShortDate,
    start,
    end,
    period,
    isGroupedByDate,
    addSecondsToTimeFormat,
    utc
  }) : undefined : Array.isArray(xAxes) ? xAxes.map(axis => (0,_components_xAxis__WEBPACK_IMPORTED_MODULE_15__["default"])({ ...axis,
    theme,
    useShortDate,
    start,
    end,
    period,
    isGroupedByDate,
    addSecondsToTimeFormat,
    utc
  })) : [(0,_components_xAxis__WEBPACK_IMPORTED_MODULE_15__["default"])(defaultAxesProps), (0,_components_xAxis__WEBPACK_IMPORTED_MODULE_15__["default"])(defaultAxesProps)];
  const seriesData = Array.isArray(series === null || series === void 0 ? void 0 : (_series$ = series[0]) === null || _series$ === void 0 ? void 0 : _series$.data) && series[0].data.length > 1 ? series[0].data : undefined;
  const bucketSize = seriesData ? seriesData[1][0] - seriesData[0][0] : undefined;
  const tooltipOrNone = tooltip !== null ? (0,_components_tooltip__WEBPACK_IMPORTED_MODULE_14__["default"])({
    showTimeInTooltip,
    isGroupedByDate,
    addSecondsToTimeFormat,
    utc,
    bucketSize,
    ...tooltip
  }) : undefined;
  const chartOption = { ...options,
    animation: sentry_constants__WEBPACK_IMPORTED_MODULE_9__.IS_ACCEPTANCE_TEST ? false : (_options$animation = options.animation) !== null && _options$animation !== void 0 ? _options$animation : true,
    useUTC: utc,
    color,
    grid: Array.isArray(grid) ? grid.map(_components_grid__WEBPACK_IMPORTED_MODULE_12__["default"]) : (0,_components_grid__WEBPACK_IMPORTED_MODULE_12__["default"])(grid),
    tooltip: tooltipOrNone,
    legend: legend ? (0,_components_legend__WEBPACK_IMPORTED_MODULE_13__["default"])({
      theme,
      ...legend
    }) : undefined,
    yAxis: yAxisOrCustom,
    xAxis: xAxisOrCustom,
    series: resolvedSeries,
    toolbox: toolBox,
    axisPointer,
    dataZoom,
    graphic
  };
  const chartStyles = {
    height: autoHeightResize ? '100%' : (0,_utils__WEBPACK_IMPORTED_MODULE_18__.getDimensionValue)(height),
    width: (0,_utils__WEBPACK_IMPORTED_MODULE_18__.getDimensionValue)(width),
    ...style
  }; // XXX(epurkhiser): Echarts can become unhappy if one of these event handlers
  // causes the chart to re-render and be passed a whole different instance of
  // event handlers.
  //
  // We use React.useMemo to keep the value across renders
  //

  const eventsMap = (0,react__WEBPACK_IMPORTED_MODULE_6__.useMemo)(() => ({
    click: (props, instance) => {
      handleClick(props, instance);
      onClick === null || onClick === void 0 ? void 0 : onClick(props, instance);
    },
    highlight: (props, instance) => onHighlight === null || onHighlight === void 0 ? void 0 : onHighlight(props, instance),
    mouseout: (props, instance) => onMouseOut === null || onMouseOut === void 0 ? void 0 : onMouseOut(props, instance),
    mouseover: (props, instance) => onMouseOver === null || onMouseOver === void 0 ? void 0 : onMouseOver(props, instance),
    datazoom: (props, instance) => onDataZoom === null || onDataZoom === void 0 ? void 0 : onDataZoom(props, instance),
    restore: (props, instance) => onRestore === null || onRestore === void 0 ? void 0 : onRestore(props, instance),
    finished: (props, instance) => onFinished === null || onFinished === void 0 ? void 0 : onFinished(props, instance),
    rendered: (props, instance) => onRendered === null || onRendered === void 0 ? void 0 : onRendered(props, instance),
    legendselectchanged: (props, instance) => onLegendSelectChanged === null || onLegendSelectChanged === void 0 ? void 0 : onLegendSelectChanged(props, instance)
  }), [onClick, onHighlight, onLegendSelectChanged, onMouseOut, onMouseOver, onDataZoom, onRestore, onFinished, onRendered]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ChartContainer, {
    autoHeightResize: autoHeightResize,
    "data-test-id": dataTestId,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(echarts_for_react_lib_core__WEBPACK_IMPORTED_MODULE_7__["default"], {
      ref: forwardedRef,
      echarts: echarts_core__WEBPACK_IMPORTED_MODULE_21__,
      notMerge: notMerge,
      lazyUpdate: lazyUpdate,
      theme: echartsTheme,
      onChartReady: onChartReady,
      onEvents: eventsMap,
      style: chartStyles,
      opts: {
        height: autoHeightResize ? undefined : height,
        width,
        renderer,
        devicePixelRatio
      },
      option: chartOption
    })
  });
}

BaseChartUnwrapped.displayName = "BaseChartUnwrapped";

// Contains styling for chart elements as we can't easily style those
// elements directly
const ChartContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1d3yu8b0"
} : 0)(p => p.autoHeightResize && 'height: 100%;', ".tooltip-series,.tooltip-date{color:", p => p.theme.subText, ";font-family:", p => p.theme.text.family, ";font-variant-numeric:tabular-nums;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";border-radius:", p => p.theme.borderRadius, " ", p => p.theme.borderRadius, " 0 0;}.tooltip-series{border-bottom:none;}.tooltip-series-solo{border-radius:", p => p.theme.borderRadius, ";}.tooltip-label{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}.tooltip-label strong{font-weight:normal;color:", p => p.theme.textColor, ";}.tooltip-label-indent{margin-left:18px;}.tooltip-series>div{display:flex;justify-content:space-between;align-items:baseline;}.tooltip-date{border-top:solid 1px ", p => p.theme.innerBorder, ";text-align:center;position:relative;width:auto;border-radius:", p => p.theme.borderRadiusBottom, ";}.tooltip-arrow{top:100%;left:50%;position:absolute;pointer-events:none;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ", p => p.theme.backgroundElevated, ";margin-left:-8px;&:before{border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ", p => p.theme.translucentBorder, ";content:'';display:block;position:absolute;top:-7px;left:-8px;z-index:-1;}}.echarts-for-react div:first-of-type{width:100%!important;}.echarts-for-react text{font-variant-numeric:tabular-nums!important;}.tooltip-description{color:", p => p.theme.white, ";border-radius:", p => p.theme.borderRadius, ";background:#000;opacity:0.9;padding:5px 10px;position:relative;font-weight:bold;font-size:", p => p.theme.fontSizeSmall, ";line-height:1.4;font-family:", p => p.theme.text.family, ";max-width:230px;min-width:230px;white-space:normal;text-align:center;:after{content:'';position:absolute;top:100%;left:50%;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #000;transform:translateX(-50%);}}" + ( true ? "" : 0));

const BaseChart = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_6__.forwardRef)((props, ref) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(BaseChartUnwrapped, {
  forwardedRef: ref,
  ...props
}));
BaseChart.displayName = 'forwardRef(BaseChart)';
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BaseChart);

/***/ }),

/***/ "./app/components/charts/components/grid.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/components/grid.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Grid)
/* harmony export */ });
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/merge */ "../node_modules/lodash/merge.js");
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_merge__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Drawing grid in rectangular coordinates
 *
 * e.g. alignment of your chart?
 */

function Grid() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return lodash_merge__WEBPACK_IMPORTED_MODULE_0___default()({
    top: 20,
    bottom: 20,
    // This should allow for sufficient space for Y-axis labels
    left: 4,
    right: '0%',
    containLabel: true
  }, props);
}

/***/ }),

/***/ "./app/components/charts/components/legend.tsx":
/*!*****************************************************!*\
  !*** ./app/components/charts/components/legend.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Legend)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_legend__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/legend */ "../node_modules/echarts/lib/component/legend.js");
/* harmony import */ var echarts_lib_component_legendScroll__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! echarts/lib/component/legendScroll */ "../node_modules/echarts/lib/component/legendScroll.js");
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/merge */ "../node_modules/lodash/merge.js");
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_merge__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./app/components/charts/utils.tsx");




function Legend(props) {
  const {
    truncate,
    theme,
    ...rest
  } = props !== null && props !== void 0 ? props : {};

  const formatter = value => (0,_utils__WEBPACK_IMPORTED_MODULE_3__.truncationFormatter)(value, truncate !== null && truncate !== void 0 ? truncate : 0);

  return lodash_merge__WEBPACK_IMPORTED_MODULE_2___default()({
    show: true,
    type: 'scroll',
    padding: 0,
    formatter,
    icon: 'circle',
    itemHeight: 14,
    itemWidth: 8,
    itemGap: 12,
    align: 'left',
    textStyle: {
      color: theme.textColor,
      verticalAlign: 'top',
      fontSize: 11,
      fontFamily: theme.text.family,
      lineHeight: 14
    },
    inactiveColor: theme.inactive
  }, rest);
}

/***/ }),

/***/ "./app/components/charts/components/markLine.tsx":
/*!*******************************************************!*\
  !*** ./app/components/charts/components/markLine.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MarkLine)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_markLine__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/markLine */ "../node_modules/echarts/lib/component/markLine.js");


/**
 * eCharts markLine
 *
 * See https://echarts.apache.org/en/option.html#series-line.markLine
 */
function MarkLine(props) {
  return {
    // The second symbol is a very ugly arrow, we don't want it
    symbol: ['none', 'none'],
    ...props
  };
}

/***/ }),

/***/ "./app/components/charts/components/tooltip.tsx":
/*!******************************************************!*\
  !*** ./app/components/charts/components/tooltip.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Tooltip),
/* harmony export */   "defaultFormatAxisLabel": () => (/* binding */ defaultFormatAxisLabel)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var echarts_lib_component_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! echarts/lib/component/tooltip */ "../node_modules/echarts/lib/component/tooltip.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./app/components/charts/utils.tsx");






function defaultFormatAxisLabel(value, isTimestamp, utc, showTimeInTooltip, addSecondsToTimeFormat, bucketSize) {
  if (!isTimestamp) {
    return value;
  }

  if (!bucketSize) {
    const format = `MMM D, YYYY ${showTimeInTooltip ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getTimeFormat)({
      displaySeconds: addSecondsToTimeFormat
    }) : ''}`.trim();
    return (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getFormattedDate)(value, format, {
      local: !utc
    });
  }

  const now = moment__WEBPACK_IMPORTED_MODULE_2___default()();
  const bucketStart = moment__WEBPACK_IMPORTED_MODULE_2___default()(value);
  const bucketEnd = moment__WEBPACK_IMPORTED_MODULE_2___default()(value + bucketSize);
  const showYear = now.year() !== bucketStart.year() || now.year() !== bucketEnd.year();
  const showEndDate = bucketStart.date() !== bucketEnd.date();
  const formatStart = `MMM D${showYear ? ', YYYY' : ''} ${showTimeInTooltip ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getTimeFormat)({
    displaySeconds: addSecondsToTimeFormat
  }) : ''}`.trim();
  const formatEnd = `${showEndDate ? `MMM D${showYear ? ', YYYY' : ''} ` : ''}${showTimeInTooltip ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getTimeFormat)({
    displaySeconds: addSecondsToTimeFormat
  }) : ''}`.trim();
  return `${(0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getFormattedDate)(bucketStart, formatStart, {
    local: !utc
  })} — ${(0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_3__.getFormattedDate)(bucketEnd, formatEnd, {
    local: !utc
  })}`;
}

function defaultValueFormatter(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value;
}

function defaultNameFormatter(value) {
  return value;
}

function defaultMarkerFormatter(value) {
  return value;
}

function getSeriesValue(series, offset) {
  if (!series.data) {
    return undefined;
  }

  if (Array.isArray(series.data)) {
    return series.data[offset];
  }

  if (Array.isArray(series.data.value)) {
    return series.data.value[offset];
  }

  return undefined;
}

function getFormatter(_ref) {
  let {
    filter,
    isGroupedByDate,
    showTimeInTooltip,
    truncate,
    formatAxisLabel,
    utc,
    bucketSize,
    valueFormatter = defaultValueFormatter,
    nameFormatter = defaultNameFormatter,
    markerFormatter = defaultMarkerFormatter,
    subLabels = [],
    addSecondsToTimeFormat = false
  } = _ref;

  const getFilter = seriesParam => {
    // Series do not necessarily have `data` defined, e.g. releases don't have `data`, but rather
    // has a series using strictly `markLine`s.
    // However, real series will have `data` as a tuple of (label, value) or be
    // an object with value/label keys.
    const value = getSeriesValue(seriesParam, 0);

    if (typeof filter === 'function') {
      return filter(value, seriesParam);
    }

    return true;
  };

  return seriesParamsOrParam => {
    // If this is a tooltip for the axis, it will include all series for that axis item.
    // In this case seriesParamsOrParam will be of type `Object[]`
    //
    // Otherwise, it will be an `Object`, and is a tooltip for a single item
    const axisFormatterOrDefault = formatAxisLabel || defaultFormatAxisLabel; // Special tooltip if component is a `markPoint`

    if (!Array.isArray(seriesParamsOrParam) && // TODO(ts): The EChart types suggest that this can _only_ be `series`,
    //           but assuming this code is correct (which I have not
    //           verified) their types may be wrong.
    seriesParamsOrParam.componentType === 'markPoint') {
      const timestamp = seriesParamsOrParam.data.coord[0];
      const label = axisFormatterOrDefault(timestamp, !!isGroupedByDate, !!utc, !!showTimeInTooltip, addSecondsToTimeFormat, bucketSize, seriesParamsOrParam); // eCharts sets seriesName as null when `componentType` !== 'series'

      const truncatedName = (0,_utils__WEBPACK_IMPORTED_MODULE_4__.truncationFormatter)(seriesParamsOrParam.data.labelForValue, truncate);
      const formattedValue = valueFormatter(seriesParamsOrParam.data.coord[1], seriesParamsOrParam.name);
      return ['<div class="tooltip-series">', `<div>
          <span class="tooltip-label"><strong>${seriesParamsOrParam.name}</strong></span>
          ${truncatedName}: ${formattedValue}
        </div>`, '</div>', `<div class="tooltip-date">${label}</div>`, '</div>'].join('');
    }

    const seriesParams = Array.isArray(seriesParamsOrParam) ? seriesParamsOrParam : [seriesParamsOrParam]; // If axis, timestamp comes from axis, otherwise for a single item it is defined in the data attribute.
    // The data attribute is usually a list of [name, value] but can also be an object of {name, value} when
    // there is item specific formatting being used.

    const timestamp = Array.isArray(seriesParamsOrParam) ? seriesParams[0].value[0] : getSeriesValue(seriesParams[0], 0);
    const date = seriesParams.length && axisFormatterOrDefault(timestamp, !!isGroupedByDate, !!utc, !!showTimeInTooltip, addSecondsToTimeFormat, bucketSize, seriesParamsOrParam);
    return ['<div class="tooltip-series">', seriesParams.filter(getFilter).map(s => {
      var _s$seriesName, _s$marker;

      const formattedLabel = nameFormatter((0,_utils__WEBPACK_IMPORTED_MODULE_4__.truncationFormatter)((_s$seriesName = s.seriesName) !== null && _s$seriesName !== void 0 ? _s$seriesName : '', truncate));
      const value = valueFormatter(getSeriesValue(s, 1), s.seriesName, s);
      const marker = markerFormatter((_s$marker = s.marker) !== null && _s$marker !== void 0 ? _s$marker : '', s.seriesName);
      const filteredSubLabels = subLabels.filter(subLabel => subLabel.parentLabel === s.seriesName);

      if (!!filteredSubLabels.length) {
        const labelWithSubLabels = [`<div><span class="tooltip-label">${marker} <strong>${formattedLabel}</strong></span> ${value}</div>`];

        for (const subLabel of filteredSubLabels) {
          labelWithSubLabels.push(`<div><span class="tooltip-label tooltip-label-indent"><strong>${subLabel.label}</strong></span> ${valueFormatter(subLabel.data[s.dataIndex].value)}</div>`);
        }

        return labelWithSubLabels.join('');
      }

      return `<div><span class="tooltip-label">${marker} <strong>${formattedLabel}</strong></span> ${value}</div>`;
    }).join(''), '</div>', `<div class="tooltip-date">${date}</div>`, '<div class="tooltip-arrow"></div>'].join('');
  };
}

function Tooltip() {
  let {
    filter,
    isGroupedByDate,
    showTimeInTooltip,
    addSecondsToTimeFormat,
    formatter,
    truncate,
    utc,
    bucketSize,
    formatAxisLabel,
    valueFormatter,
    nameFormatter,
    markerFormatter,
    hideDelay,
    subLabels,
    ...props
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.a)();
  formatter = formatter || getFormatter({
    filter,
    isGroupedByDate,
    showTimeInTooltip,
    addSecondsToTimeFormat,
    truncate,
    utc,
    bucketSize,
    formatAxisLabel,
    valueFormatter,
    nameFormatter,
    markerFormatter,
    subLabels
  });
  return {
    show: true,
    trigger: 'item',
    backgroundColor: `${theme.backgroundElevated}`,
    borderWidth: 0,
    extraCssText: `box-shadow: 0 0 0 1px ${theme.translucentBorder}, ${theme.dropShadowHeavy}`,
    transitionDuration: 0,
    padding: 0,
    className: 'tooltip-container',
    // Default hideDelay in echarts docs is 100ms
    hideDelay: hideDelay || 100,

    /**
     * @link https://echarts.apache.org/en/option.html#tooltip.position
     *
     * @param pos mouse position
     * @param _params same as formatter
     * @param dom dom object of tooltip
     * @param _rec graphic elements
     * @param _size The size of dom echarts container.
     */
    position(pos, _params, dom, _rec, size) {
      // Types seem to be broken on dom
      dom = dom; // Center the tooltip slightly above the cursor.

      const [tipWidth, tipHeight] = size.contentSize; // Get the left offset of the tip container (the chart)
      // so that we can estimate overflows

      const chartLeft = dom.parentNode instanceof Element ? dom.parentNode.getBoundingClientRect().left : 0; // Determine the new left edge.

      let leftPos = Number(pos[0]) - tipWidth / 2; // And the right edge taking into account the chart left offset

      const rightEdge = chartLeft + Number(pos[0]) + tipWidth / 2;
      let arrowPosition;

      if (rightEdge >= window.innerWidth - 20) {
        // If the tooltip would leave viewport on the right, pin it.
        leftPos -= rightEdge - window.innerWidth + 20;
        arrowPosition = `${Number(pos[0]) - leftPos}px`;
      } else if (leftPos + chartLeft - 20 <= 0) {
        // If the tooltip would leave viewport on the left, pin it.
        leftPos = chartLeft * -1 + 20;
        arrowPosition = `${Number(pos[0]) - leftPos}px`;
      } else {
        // Tooltip not near the window edge, reset position
        arrowPosition = '50%';
      }

      const arrow = dom.querySelector('.tooltip-arrow');

      if (arrow) {
        arrow.style.left = arrowPosition;
      }

      return {
        left: leftPos,
        top: Number(pos[1]) - tipHeight - 20
      };
    },

    formatter,
    ...props
  };
}

/***/ }),

/***/ "./app/components/charts/components/xAxis.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/components/xAxis.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/merge */ "../node_modules/lodash/merge.js");
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_merge__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");




function XAxis(_ref) {
  let {
    isGroupedByDate,
    useShortDate,
    theme,
    start,
    end,
    period,
    utc,
    addSecondsToTimeFormat = false,
    ...props
  } = _ref;

  const AxisLabelFormatter = (value, index) => {
    const timeFormat = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getTimeFormat)({
      displaySeconds: addSecondsToTimeFormat
    });
    const dateFormat = useShortDate ? 'MMM Do' : `MMM D ${timeFormat}`;
    const firstItem = index === 0;
    const format = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__.useShortInterval)({
      start,
      end,
      period
    }) && !firstItem ? timeFormat : dateFormat;

    if (isGroupedByDate) {
      return (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getFormattedDate)(value, format, {
        local: !utc
      });
    }

    if (props.truncate) {
      return (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__.truncationFormatter)(value, props.truncate);
    }

    return undefined;
  };

  const defaults = {
    type: isGroupedByDate ? 'time' : 'category',
    splitNumber: 4,
    axisLine: {
      lineStyle: {
        color: theme.chartLabel
      }
    },
    axisTick: {
      lineStyle: {
        color: theme.chartLabel
      }
    },
    splitLine: {
      show: false
    },
    axisLabel: {
      hideOverlap: true,
      color: theme.chartLabel,
      fontFamily: theme.text.family,
      margin: 12,
      // This was default with ChartZoom, we are making it default for all charts now
      // Otherwise the xAxis can look congested when there is always a min/max label
      showMaxLabel: false,
      showMinLabel: false,
      // @ts-expect-error formatter type is missing
      formatter: AxisLabelFormatter
    },
    axisPointer: {
      show: true,
      type: 'line',
      label: {
        show: false
      },
      lineStyle: {
        type: 'solid',
        width: 0.5
      }
    }
  };
  return lodash_merge__WEBPACK_IMPORTED_MODULE_0___default()(defaults, props);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (XAxis);

/***/ }),

/***/ "./app/components/charts/components/yAxis.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/components/yAxis.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ YAxis)
/* harmony export */ });
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/merge */ "../node_modules/lodash/merge.js");
/* harmony import */ var lodash_merge__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_merge__WEBPACK_IMPORTED_MODULE_0__);

function YAxis(_ref) {
  let {
    theme,
    ...props
  } = _ref;
  return lodash_merge__WEBPACK_IMPORTED_MODULE_0___default()({
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    axisLabel: {
      color: theme.chartLabel,
      fontFamily: theme.text.family
    },
    splitLine: {
      lineStyle: {
        color: theme.chartLineColor,
        opacity: 0.3
      }
    }
  }, props);
}

/***/ }),

/***/ "./app/components/charts/series/barSeries.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/series/barSeries.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_bar__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/bar */ "../node_modules/echarts/lib/chart/bar.js");


function barSeries(props) {
  return { ...props,
    type: 'bar'
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (barSeries);

/***/ }),

/***/ "./app/components/charts/series/lineSeries.tsx":
/*!*****************************************************!*\
  !*** ./app/components/charts/series/lineSeries.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LineSeries)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_line__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/line */ "../node_modules/echarts/lib/chart/line.js");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");


function LineSeries(props) {
  var _props$areaStyle$colo, _props$areaStyle, _props$areaStyle2;

  return {
    showSymbol: false,
    symbolSize: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__["default"].charts.symbolSize,
    ...props,
    type: 'line',
    emphasis: { ...props.emphasis,
      scale: false,
      lineStyle: {
        // disable color highlight on hover
        color: props.color,
        width: undefined
      },
      areaStyle: {
        // Disable AreaSeries highlight on hover
        color: (_props$areaStyle$colo = (_props$areaStyle = props.areaStyle) === null || _props$areaStyle === void 0 ? void 0 : _props$areaStyle.color) !== null && _props$areaStyle$colo !== void 0 ? _props$areaStyle$colo : props.color,
        opacity: (_props$areaStyle2 = props.areaStyle) === null || _props$areaStyle2 === void 0 ? void 0 : _props$areaStyle2.opacity
      }
    }
  };
}

/***/ }),

/***/ "./app/components/checkbox.tsx":
/*!*************************************!*\
  !*** ./app/components/checkbox.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


const Checkbox = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("input", {
  type: "checkbox",
  ...props
});

Checkbox.displayName = "Checkbox";
Checkbox.defaultProps = {
  checked: false
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Checkbox);

/***/ }),

/***/ "./app/components/dropdownLink.tsx":
/*!*****************************************!*\
  !*** ./app/components/dropdownLink.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/deprecatedDropdownMenu */ "./app/components/deprecatedDropdownMenu.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const getRootCss = theme => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_3__.css)(".dropdown-menu{&>li>a{color:", theme.textColor, ";&:hover,&:focus{color:inherit;background-color:", theme.hover, ";}}& .disabled{cursor:not-allowed;&:hover{background:inherit;color:inherit;}}}.dropdown-submenu:hover>span{color:", theme.textColor, ";background:", theme.hover, ";}" + ( true ? "" : 0),  true ? "" : 0); // .dropdown-actor-title = flexbox to fix vertical alignment on firefox Need
// the extra container because dropdown-menu alignment is off if
// `dropdown-actor` is a flexbox


function DropdownLink(_ref) {
  let {
    anchorMiddle,
    title,
    customTitle,
    children,
    menuClasses,
    className,
    topLevelClasses,
    anchorRight = false,
    disabled = false,
    caret = true,
    alwaysRenderMenu = true,
    ...otherProps
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_4__.a)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_1__["default"], {
    alwaysRenderMenu: alwaysRenderMenu,
    ...otherProps,
    children: _ref2 => {
      let {
        isOpen,
        getRootProps,
        getActorProps,
        getMenuProps
      } = _ref2;
      const shouldRenderMenu = alwaysRenderMenu || isOpen;
      const cx = classnames__WEBPACK_IMPORTED_MODULE_0___default()('dropdown-actor', className, {
        'dropdown-menu-right': anchorRight,
        'dropdown-toggle': true,
        hover: isOpen,
        disabled
      });
      const topLevelCx = classnames__WEBPACK_IMPORTED_MODULE_0___default()('dropdown', topLevelClasses, {
        'pull-right': anchorRight,
        'anchor-right': anchorRight,
        'anchor-middle': anchorMiddle,
        open: isOpen
      });
      const {
        onClick: onClickActor,
        ...actorProps
      } = getActorProps({
        className: cx
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
        css: getRootCss(theme),
        ...getRootProps({
          className: topLevelCx
        }),
        "data-test-id": "dropdown-link",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
          onClick: disabled ? undefined : onClickActor,
          ...actorProps,
          children: customTitle || (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            className: "dropdown-actor-title",
            children: [title, caret && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconChevron, {
              direction: isOpen ? 'up' : 'down',
              size: "xs"
            })]
          })
        }), shouldRenderMenu && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("ul", { ...getMenuProps({
            className: classnames__WEBPACK_IMPORTED_MODULE_0___default()(menuClasses, 'dropdown-menu')
          }),
          children: children
        })]
      });
    }
  });
}

DropdownLink.displayName = "DropdownLink";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DropdownLink);

/***/ }),

/***/ "./app/components/forms/apiForm.tsx":
/*!******************************************!*\
  !*** ./app/components/forms/apiForm.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ApiForm)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class ApiForm extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "api", new sentry_api__WEBPACK_IMPORTED_MODULE_4__.Client());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmit", (data, onSuccess, onError) => {
      this.props.onSubmit && this.props.onSubmit(data);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Saving changes\u2026'));
      this.api.request(this.props.apiEndpoint, {
        method: this.props.apiMethod,
        data,
        success: response => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.clearIndicators)();
          onSuccess(response);
        },
        error: error => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.clearIndicators)();
          onError(error);
        }
      });
    });
  }

  componentWillUnmount() {
    this.api.clear();
  }

  render() {
    const {
      onSubmit: _onSubmit,
      apiMethod: _apiMethod,
      apiEndpoint: _apiEndpoint,
      ...otherProps
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onSubmit: this.onSubmit,
      ...otherProps
    });
  }

}
ApiForm.displayName = "ApiForm";

/***/ }),

/***/ "./app/components/forms/checkboxField.tsx":
/*!************************************************!*\
  !*** ./app/components/forms/checkboxField.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_forms_field_fieldDescription__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/field/fieldDescription */ "./app/components/forms/field/fieldDescription.tsx");
/* harmony import */ var sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/field/fieldHelp */ "./app/components/forms/field/fieldHelp.tsx");
/* harmony import */ var sentry_components_forms_field_fieldLabel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/field/fieldLabel */ "./app/components/forms/field/fieldLabel.tsx");
/* harmony import */ var sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/field/fieldRequiredBadge */ "./app/components/forms/field/fieldRequiredBadge.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function CheckboxField(props) {
  const {
    name,
    disabled,
    stacked,
    id,
    required,
    label,
    help
  } = props;
  const helpElement = typeof help === 'function' ? help(props) : help;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_6__["default"], {
    name: name,
    inline: false,
    stacked: stacked,
    children: _ref => {
      let {
        onChange,
        value
      } = _ref;

      function handleChange(e) {
        const newValue = e.target.checked;
        onChange === null || onChange === void 0 ? void 0 : onChange(newValue, e);
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FieldLayout, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ControlWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_1__["default"], {
            id: id,
            name: name,
            disabled: disabled,
            checked: value === true,
            onChange: handleChange
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_forms_field_fieldDescription__WEBPACK_IMPORTED_MODULE_2__["default"], {
          htmlFor: id,
          children: [label && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms_field_fieldLabel__WEBPACK_IMPORTED_MODULE_4__["default"], {
            disabled: disabled,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("span", {
              children: [label, required && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms_field_fieldRequiredBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {})]
            })
          }), helpElement && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_3__["default"], {
            stacked: stacked,
            inline: true,
            children: helpElement
          })]
        })]
      });
    }
  });
}

CheckboxField.displayName = "CheckboxField";

const ControlWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "etw9sv71"
} : 0)("align-self:flex-start;display:flex;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";& input{margin:0;}" + ( true ? "" : 0));

const FieldLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etw9sv70"
} : 0)( true ? {
  name: "ho1qnd",
  styles: "display:flex;flex-direction:row"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CheckboxField);

/***/ }),

/***/ "./app/components/forms/controls/radioBoolean.tsx":
/*!********************************************************!*\
  !*** ./app/components/forms/controls/radioBoolean.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const Option = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.forwardRef)(function Option(_ref, ref) {
  let {
    name,
    disabled,
    label,
    value,
    checked,
    onChange,
    onBlur
  } = _ref;

  function handleChange(e) {
    const isTrue = e.target.value === 'true';
    onChange === null || onChange === void 0 ? void 0 : onChange(isTrue, e); // Manually trigger blur to trigger saving on change

    onBlur === null || onBlur === void 0 ? void 0 : onBlur(e);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
    className: "radio",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("label", {
      style: {
        fontWeight: 'normal'
      },
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("input", {
        ref: ref,
        type: "radio",
        value: value,
        name: name,
        checked: checked,
        onChange: handleChange,
        disabled: disabled
      }), ' ', label]
    })
  });
});
const RadioBoolean = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.forwardRef)(function RadioBoolean(_ref2, ref) {
  let {
    disabled,
    name,
    onChange,
    onBlur,
    value,
    yesFirst = true,
    yesLabel = 'Yes',
    noLabel = 'No'
  } = _ref2;

  const yesOption = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Option, {
    ref: ref,
    value: "true",
    checked: value === true,
    name: name,
    disabled: disabled,
    label: yesLabel,
    onChange: onChange,
    onBlur: onBlur
  });

  const noOption = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Option, {
    value: "false",
    checked: value === false,
    name: name,
    disabled: disabled,
    label: noLabel,
    onChange: onChange,
    onBlur: onBlur
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
    children: [yesFirst ? yesOption : noOption, yesFirst ? noOption : yesOption]
  });
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RadioBoolean);

/***/ }),

/***/ "./app/components/forms/datePickerField.tsx":
/*!**************************************************!*\
  !*** ./app/components/forms/datePickerField.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DatePickerField)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/deprecatedDropdownMenu */ "./app/components/deprecatedDropdownMenu.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _calendar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../calendar */ "./app/components/calendar/index.tsx");
/* harmony import */ var _inputField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function handleChangeDate(onChange, onBlur, date, close) {
  onChange(date);
  onBlur(date); // close dropdown menu

  close();
}

function DatePickerField(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_inputField__WEBPACK_IMPORTED_MODULE_7__["default"], { ...props,
    field: _ref => {
      let {
        onChange,
        onBlur,
        value,
        id
      } = _ref;
      const dateObj = new Date(value);
      const inputValue = !isNaN(dateObj.getTime()) ? dateObj : new Date();
      const dateString = moment__WEBPACK_IMPORTED_MODULE_1___default()(inputValue).format('LL');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_deprecatedDropdownMenu__WEBPACK_IMPORTED_MODULE_2__["default"], {
        keepMenuOpen: true,
        children: _ref2 => {
          let {
            isOpen,
            getRootProps,
            getActorProps,
            getMenuProps,
            actions
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", { ...getRootProps(),
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(InputWrapper, {
              id: id,
              ...getActorProps(),
              isOpen: isOpen,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledInput, {
                readOnly: true,
                value: dateString
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(CalendarIcon, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconCalendar, {})
              })]
            }), isOpen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(CalendarMenu, { ...getMenuProps(),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_calendar__WEBPACK_IMPORTED_MODULE_6__.DatePicker, {
                date: inputValue,
                onChange: date => handleChangeDate(onChange, onBlur, date, actions.close)
              })
            })]
          });
        }
      });
    }
  });
}
DatePickerField.displayName = "DatePickerField";

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1t1jh4q3"
} : 0)(sentry_styles_input__WEBPACK_IMPORTED_MODULE_4__.inputStyles, " cursor:text;display:flex;z-index:", p => p.theme.zIndex.dropdownAutocomplete.actor, ";", p => p.isOpen && 'border-bottom-left-radius: 0', ";" + ( true ? "" : 0));

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('input',  true ? {
  target: "e1t1jh4q2"
} : 0)( true ? {
  name: "4100xq",
  styles: "border:none;outline:none;flex:1"
} : 0);

const CalendarMenu = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1t1jh4q1"
} : 0)("display:flex;background:", p => p.theme.background, ";position:absolute;left:0;border:1px solid ", p => p.theme.border, ";border-top:none;z-index:", p => p.theme.zIndex.dropdownAutocomplete.menu, ";margin-top:-1px;.rdrMonthAndYearWrapper{height:50px;padding-top:0;}" + ( true ? "" : 0));

const CalendarIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1t1jh4q0"
} : 0)("display:flex;align-items:center;justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/forms/index.tsx":
/*!****************************************!*\
  !*** ./app/components/forms/index.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ApiForm": () => (/* reexport safe */ _apiForm__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   "BooleanField": () => (/* reexport safe */ _booleanField__WEBPACK_IMPORTED_MODULE_1__["default"]),
/* harmony export */   "CheckboxField": () => (/* reexport safe */ _checkboxField__WEBPACK_IMPORTED_MODULE_2__["default"]),
/* harmony export */   "ChoiceMapperField": () => (/* reexport safe */ _choiceMapperField__WEBPACK_IMPORTED_MODULE_3__["default"]),
/* harmony export */   "DatePickerField": () => (/* reexport safe */ _datePickerField__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   "DateTimeField": () => (/* reexport safe */ _dateTimeField__WEBPACK_IMPORTED_MODULE_5__["default"]),
/* harmony export */   "EmailField": () => (/* reexport safe */ _emailField__WEBPACK_IMPORTED_MODULE_6__["default"]),
/* harmony export */   "FieldFromConfig": () => (/* reexport safe */ _fieldFromConfig__WEBPACK_IMPORTED_MODULE_7__["default"]),
/* harmony export */   "FieldSeparator": () => (/* reexport safe */ _fieldSeparator__WEBPACK_IMPORTED_MODULE_8__["default"]),
/* harmony export */   "Form": () => (/* reexport safe */ _form__WEBPACK_IMPORTED_MODULE_9__["default"]),
/* harmony export */   "FormPanel": () => (/* reexport safe */ _formPanel__WEBPACK_IMPORTED_MODULE_10__["default"]),
/* harmony export */   "HiddenField": () => (/* reexport safe */ _hiddenField__WEBPACK_IMPORTED_MODULE_11__["default"]),
/* harmony export */   "InputField": () => (/* reexport safe */ _inputField__WEBPACK_IMPORTED_MODULE_12__["default"]),
/* harmony export */   "JSONForm": () => (/* reexport safe */ _jsonForm__WEBPACK_IMPORTED_MODULE_13__["default"]),
/* harmony export */   "NumberField": () => (/* reexport safe */ _numberField__WEBPACK_IMPORTED_MODULE_14__["default"]),
/* harmony export */   "RadioBooleanField": () => (/* reexport safe */ _radioBooleanField__WEBPACK_IMPORTED_MODULE_15__["default"]),
/* harmony export */   "RangeField": () => (/* reexport safe */ _rangeField__WEBPACK_IMPORTED_MODULE_16__["default"]),
/* harmony export */   "SelectField": () => (/* reexport safe */ _selectField__WEBPACK_IMPORTED_MODULE_17__["default"]),
/* harmony export */   "TestCopyInput": () => (/* reexport safe */ _textCopyInput__WEBPACK_IMPORTED_MODULE_19__["default"]),
/* harmony export */   "TextField": () => (/* reexport safe */ _textField__WEBPACK_IMPORTED_MODULE_20__["default"]),
/* harmony export */   "TextareaField": () => (/* reexport safe */ _textareaField__WEBPACK_IMPORTED_MODULE_18__["default"])
/* harmony export */ });
/* harmony import */ var _apiForm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./apiForm */ "./app/components/forms/apiForm.tsx");
/* harmony import */ var _booleanField__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./booleanField */ "./app/components/forms/booleanField.tsx");
/* harmony import */ var _checkboxField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./checkboxField */ "./app/components/forms/checkboxField.tsx");
/* harmony import */ var _choiceMapperField__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./choiceMapperField */ "./app/components/forms/choiceMapperField.tsx");
/* harmony import */ var _datePickerField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./datePickerField */ "./app/components/forms/datePickerField.tsx");
/* harmony import */ var _dateTimeField__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./dateTimeField */ "./app/components/forms/dateTimeField.tsx");
/* harmony import */ var _emailField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./emailField */ "./app/components/forms/emailField.tsx");
/* harmony import */ var _fieldFromConfig__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var _fieldSeparator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./fieldSeparator */ "./app/components/forms/fieldSeparator.tsx");
/* harmony import */ var _form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./form */ "./app/components/forms/form.tsx");
/* harmony import */ var _formPanel__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./formPanel */ "./app/components/forms/formPanel.tsx");
/* harmony import */ var _hiddenField__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./hiddenField */ "./app/components/forms/hiddenField.tsx");
/* harmony import */ var _inputField__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var _jsonForm__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var _numberField__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./numberField */ "./app/components/forms/numberField.tsx");
/* harmony import */ var _radioBooleanField__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./radioBooleanField */ "./app/components/forms/radioBooleanField.tsx");
/* harmony import */ var _rangeField__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./rangeField */ "./app/components/forms/rangeField.tsx");
/* harmony import */ var _selectField__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var _textareaField__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./textareaField */ "./app/components/forms/textareaField.tsx");
/* harmony import */ var _textCopyInput__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var _textField__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./textField */ "./app/components/forms/textField.tsx");






















/***/ }),

/***/ "./app/components/forms/radioBooleanField.tsx":
/*!****************************************************!*\
  !*** ./app/components/forms/radioBooleanField.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RadioBooleanField)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _controls_radioBoolean__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./controls/radioBoolean */ "./app/components/forms/controls/radioBoolean.tsx");
/* harmony import */ var _inputField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./inputField */ "./app/components/forms/inputField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function RadioBooleanField(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_inputField__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
    field: fieldProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_controls_radioBoolean__WEBPACK_IMPORTED_MODULE_1__["default"], { ...lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(fieldProps, ['onKeyDown', 'children'])
    })
  });
}
RadioBooleanField.displayName = "RadioBooleanField";

/***/ }),

/***/ "./app/components/highlight.tsx":
/*!**************************************!*\
  !*** ./app/components/highlight.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HighlightComponent": () => (/* binding */ HighlightComponent),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const HighlightComponent = _ref => {
  let {
    className,
    children,
    disabled,
    text
  } = _ref;

  // There are instances when children is not string in breadcrumbs but not caught by TS
  if (!text || disabled || typeof children !== 'string') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: children
    });
  }

  const highlightText = text.toLowerCase();
  const idx = children.toLowerCase().indexOf(highlightText);

  if (idx === -1) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: children
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [children.substr(0, idx), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      className: className,
      children: children.substr(idx, highlightText.length)
    }), children.substr(idx + highlightText.length)]
  });
};

HighlightComponent.displayName = "HighlightComponent";

const Highlight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(HighlightComponent,  true ? {
  target: "e1l51eu00"
} : 0)("font-weight:normal;background-color:", p => p.theme.yellow200, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Highlight);


/***/ }),

/***/ "./app/components/hotkeysLabel.tsx":
/*!*****************************************!*\
  !*** ./app/components/hotkeysLabel.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getKeyCode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/getKeyCode */ "./app/utils/getKeyCode.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const macModifiers = {
  18: '⌥',
  17: '⌃',
  91: '⌘'
};
const normalModifiers = {
  18: 'ALT',
  17: 'CTRL'
};
const genericGlyphs = {
  16: '⇧',
  8: '⌫',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  107: '+'
};

const keyToDisplay = (key, isMac) => {
  var _ref, _modifierMap$keyCode;

  const keyCode = (0,sentry_utils_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)(key); // Not a special key

  if (!keyCode) {
    return {
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
        children: key.toUpperCase()
      }),
      specificToOs: 'generic'
    };
  }

  const modifierMap = isMac ? macModifiers : normalModifiers;
  const keyStr = (_ref = (_modifierMap$keyCode = modifierMap[keyCode]) !== null && _modifierMap$keyCode !== void 0 ? _modifierMap$keyCode : genericGlyphs[keyCode]) !== null && _ref !== void 0 ? _ref : key.toUpperCase();
  const specificToOs = keyCode === (0,sentry_utils_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)('command') ? 'macos' : 'generic';
  return {
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
      children: keyStr
    }, keyStr),
    specificToOs
  };
};

const HotkeysLabel = _ref2 => {
  var _window$navigator$pla, _window, _window$navigator, _window$navigator$pla2;

  let {
    value,
    forcePlatform
  } = _ref2;
  // Split by commas and then split by +, but allow escaped /+
  const hotkeySets = (Array.isArray(value) ? value : [value]).map(o => o.trim().split('+'));
  const isMac = forcePlatform ? forcePlatform === 'macos' : (_window$navigator$pla = (_window = window) === null || _window === void 0 ? void 0 : (_window$navigator = _window.navigator) === null || _window$navigator === void 0 ? void 0 : (_window$navigator$pla2 = _window$navigator.platform) === null || _window$navigator$pla2 === void 0 ? void 0 : _window$navigator$pla2.toLowerCase().startsWith('mac')) !== null && _window$navigator$pla !== void 0 ? _window$navigator$pla : false; // If we're not using mac find the first key set that is generic.
  // Otherwise show whatever the first hotkey is.

  const finalKeySet = hotkeySets.map(keySet => keySet.map(key => keyToDisplay(key, isMac))).find(keySet => !isMac ? keySet.every(key => key.specificToOs === 'generic') : true); // No key available for the OS. Don't show a hotkey

  if (finalKeySet === undefined) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(HotkeysContainer, {
    children: finalKeySet.map(key => key.label)
  });
};

HotkeysLabel.displayName = "HotkeysLabel";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HotkeysLabel);

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1ixr2t71"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const HotkeysContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ixr2t70"
} : 0)("font-family:", p => p.theme.text.family, ";display:flex;flex-direction:row;align-items:center;>*{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/organizations/pageFilters/persistence.tsx":
/*!******************************************************************!*\
  !*** ./app/components/organizations/pageFilters/persistence.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getPageFilterStorage": () => (/* binding */ getPageFilterStorage),
/* harmony export */   "removePageFiltersStorage": () => (/* binding */ removePageFiltersStorage),
/* harmony export */   "setPageFiltersStorage": () => (/* binding */ setPageFiltersStorage)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/pageFiltersStore */ "./app/stores/pageFiltersStore.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var _parse__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./parse */ "./app/components/organizations/pageFilters/parse.tsx");







function makeLocalStorageKey(orgSlug) {
  return `global-selection:${orgSlug}`;
}

/**
 * Updates the localstorage page filters data for the specified filters.
 *
 * e.g. if localstorage is empty, user loads issue details for project "foo"
 * this should not consider "foo" as last used and should not save to local
 * storage.
 *
 * However, if user then changes environment, it should...? Currently it will
 * save the current project alongside environment to local storage. It's
 * debatable if this is the desired behavior.
 */
function setPageFiltersStorage(orgSlug, updateFilters) {
  var _getPageFilterStorage, _currentStoredState$p, _currentStoredState$e, _currentStoredState$p2;

  const {
    selection,
    pinnedFilters
  } = sentry_stores_pageFiltersStore__WEBPACK_IMPORTED_MODULE_1__["default"].getState();
  const {
    state: currentStoredState
  } = (_getPageFilterStorage = getPageFilterStorage(orgSlug)) !== null && _getPageFilterStorage !== void 0 ? _getPageFilterStorage : {
    state: null
  };
  const projects = updateFilters.has('projects') ? selection.projects : (_currentStoredState$p = currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.project) !== null && _currentStoredState$p !== void 0 ? _currentStoredState$p : [];
  const environments = updateFilters.has('environments') ? selection.environments : (_currentStoredState$e = currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.environment) !== null && _currentStoredState$e !== void 0 ? _currentStoredState$e : [];
  const shouldUpdateDatetime = updateFilters.has('datetime');
  const currentStart = shouldUpdateDatetime ? selection.datetime.start : currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.start;
  const currentEnd = shouldUpdateDatetime ? selection.datetime.end : currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.end;
  const currentPeriod = shouldUpdateDatetime ? selection.datetime.period : (_currentStoredState$p2 = currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.period) !== null && _currentStoredState$p2 !== void 0 ? _currentStoredState$p2 : null;
  const currentUtc = shouldUpdateDatetime ? selection.datetime.utc : currentStoredState === null || currentStoredState === void 0 ? void 0 : currentStoredState.utc;
  const start = currentStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(currentStart) : null;
  const end = currentEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(currentEnd) : null;
  const period = !start && !end ? currentPeriod : null;
  const utc = currentUtc ? 'true' : null; // XXX(epurkhiser): For legacy reasons the page filter state is stored
  // similarly to how the URL query state is stored, but with different keys
  // (projects, instead of project).

  const dataToSave = {
    projects,
    environments,
    start,
    end,
    period,
    utc,
    pinnedFilters: Array.from(pinnedFilters)
  };
  const localStorageKey = makeLocalStorageKey(orgSlug);

  try {
    sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__["default"].setItem(localStorageKey, JSON.stringify(dataToSave));
  } catch (ex) {// Do nothing
  }
}
/**
 * Retrieves the page filters from local storage
 */

function getPageFilterStorage(orgSlug) {
  const localStorageKey = makeLocalStorageKey(orgSlug);
  const value = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__["default"].getItem(localStorageKey);

  if (!value) {
    return null;
  }

  let decoded;

  try {
    decoded = JSON.parse(value);
  } catch (err) {
    // use default if invalid
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    console.error(err); // eslint-disable-line no-console

    return null;
  }

  const {
    projects,
    environments,
    start,
    end,
    period,
    utc,
    pinnedFilters
  } = decoded;
  const state = (0,_parse__WEBPACK_IMPORTED_MODULE_4__.getStateFromQuery)({
    project: projects.map(String),
    environment: environments,
    start,
    end,
    period,
    utc
  }, {
    allowAbsoluteDatetime: true
  });
  return {
    state,
    pinnedFilters: new Set(pinnedFilters)
  };
}
/**
 * Removes page filters from localstorage
 */

function removePageFiltersStorage(orgSlug) {
  sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__["default"].removeItem(makeLocalStorageKey(orgSlug));
}

/***/ }),

/***/ "./app/components/organizations/timeRangeSelector/timeRangeItemLabel.tsx":
/*!*******************************************************************************!*\
  !*** ./app/components/organizations/timeRangeSelector/timeRangeItemLabel.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");



const TimeRangeItemLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epuysw20"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TimeRangeItemLabel);

/***/ }),

/***/ "./app/components/organizations/timeRangeSelector/utils.tsx":
/*!******************************************************************!*\
  !*** ./app/components/organizations/timeRangeSelector/utils.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getRelativeSummary": () => (/* binding */ getRelativeSummary),
/* harmony export */   "parseStatsPeriod": () => (/* binding */ parseStatsPeriod),
/* harmony export */   "timeRangeAutoCompleteFilter": () => (/* binding */ timeRangeAutoCompleteFilter)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_dropdownAutoComplete_autoCompleteFilter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete/autoCompleteFilter */ "./app/components/dropdownAutoComplete/autoCompleteFilter.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _timeRangeItemLabel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./timeRangeItemLabel */ "./app/components/organizations/timeRangeSelector/timeRangeItemLabel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';
const STATS_PERIOD_REGEX = /^(\d+)([smhdw]{1})$/;
const SUPPORTED_RELATIVE_PERIOD_UNITS = {
  s: {
    label: num => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('Last second', 'Last %s seconds', num),
    searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('seconds'),
    momentUnit: 'seconds'
  },
  m: {
    label: num => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('Last minute', 'Last %s minutes', num),
    searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('minutes'),
    momentUnit: 'minutes'
  },
  h: {
    label: num => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('Last hour', 'Last %s hours', num),
    searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('hours'),
    momentUnit: 'hours'
  },
  d: {
    label: num => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('Last day', 'Last %s days', num),
    searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('days'),
    momentUnit: 'days'
  },
  w: {
    label: num => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tn)('Last week', 'Last %s weeks', num),
    searchKey: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('weeks'),
    momentUnit: 'weeks'
  }
};
const SUPPORTED_RELATIVE_UNITS_LIST = Object.keys(SUPPORTED_RELATIVE_PERIOD_UNITS);

const parseStatsPeriodString = statsPeriodString => {
  const result = STATS_PERIOD_REGEX.exec(statsPeriodString);

  if (result === null) {
    throw new Error('Invalid stats period');
  }

  const value = parseInt(result[1], 10);
  const unit = result[2];
  return {
    value,
    unit
  };
};
/**
 * Converts a relative stats period, e.g. `1h` to an object containing a start
 * and end date, with the end date as the current time and the start date as the
 * time that is the current time less the statsPeriod.
 *
 * @param statsPeriod Relative stats period
 * @param outputFormat Format of outputted start/end date
 * @return Object containing start and end date as YYYY-MM-DDTHH:mm:ss
 *
 */


function parseStatsPeriod(statsPeriod) {
  let outputFormat = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DATE_TIME_FORMAT;
  const {
    value,
    unit
  } = parseStatsPeriodString(statsPeriod);
  const momentUnit = SUPPORTED_RELATIVE_PERIOD_UNITS[unit].momentUnit;
  const format = outputFormat === null ? undefined : outputFormat;
  return {
    start: moment__WEBPACK_IMPORTED_MODULE_1___default()().subtract(value, momentUnit).format(format),
    end: moment__WEBPACK_IMPORTED_MODULE_1___default()().format(format)
  };
}
/**
 * Given a relative stats period, e.g. `1h`, return a pretty string if it
 * is a default stats period. Otherwise if it's a valid period (can be any number
 * followed by a single character s|m|h|d) display "Other" or "Invalid period" if invalid
 *
 * @param relative Relative stats period
 * @return either one of the default "Last x days" string, "Other" if period is valid on the backend, or "Invalid period" otherwise
 */

function getRelativeSummary(relative, relativeOptions) {
  try {
    var _relativeOptions$rela;

    const defaultRelativePeriodString = (_relativeOptions$rela = relativeOptions === null || relativeOptions === void 0 ? void 0 : relativeOptions[relative]) !== null && _relativeOptions$rela !== void 0 ? _relativeOptions$rela : sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_RELATIVE_PERIODS[relative];

    if (defaultRelativePeriodString) {
      return defaultRelativePeriodString;
    }

    const {
      value,
      unit
    } = parseStatsPeriodString(relative);
    return SUPPORTED_RELATIVE_PERIOD_UNITS[unit].label(value);
  } catch {
    return 'Invalid period';
  }
}

function makeItem(amount, unit, index) {
  return {
    value: `${amount}${unit}`,
    ['data-test-id']: `${amount}${unit}`,
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_timeRangeItemLabel__WEBPACK_IMPORTED_MODULE_5__["default"], {
      children: SUPPORTED_RELATIVE_PERIOD_UNITS[unit].label(amount)
    }),
    searchKey: `${amount}${unit}`,
    index
  };
}
/**
 * A custom autocomplete implementation for <TimeRangeSelector />
 * This function generates relative time ranges based on the user's input (not limited to those present in the initial set).
 *
 * When the user begins their input with a number, we provide all unit options for them to choose from:
 * "5" => ["Last 5 seconds", "Last 5 minutes", "Last 5 hours", "Last 5 days", "Last 5 weeks"]
 *
 * When the user adds text after the number, we filter those options to the matching unit:
 * "5d" => ["Last 5 days"]
 * "5 days" => ["Last 5 days"]
 *
 * If the input does not begin with a number, we do a simple filter of the preset options.
 */


const timeRangeAutoCompleteFilter = function (items, filterValue) {
  var _match$groups, _match$groups$string, _match$groups2;

  if (!items) {
    return [];
  }

  const match = filterValue.match(/(?<digits>\d+)\s*(?<string>\w*)/);
  const userSuppliedAmount = Number(match === null || match === void 0 ? void 0 : (_match$groups = match.groups) === null || _match$groups === void 0 ? void 0 : _match$groups.digits);
  const userSuppliedUnits = ((_match$groups$string = match === null || match === void 0 ? void 0 : (_match$groups2 = match.groups) === null || _match$groups2 === void 0 ? void 0 : _match$groups2.string) !== null && _match$groups$string !== void 0 ? _match$groups$string : '').trim().toLowerCase();
  const userSuppliedAmountIsValid = !isNaN(userSuppliedAmount) && userSuppliedAmount > 0; // If there is a number w/o units, show all unit options

  if (userSuppliedAmountIsValid && !userSuppliedUnits) {
    return SUPPORTED_RELATIVE_UNITS_LIST.map((unit, index) => makeItem(userSuppliedAmount, unit, index));
  } // If there is a number followed by units, show the matching number/unit option


  if (userSuppliedAmountIsValid && userSuppliedUnits) {
    const matchingUnit = SUPPORTED_RELATIVE_UNITS_LIST.find(unit => {
      if (userSuppliedUnits.length === 1) {
        return unit === userSuppliedUnits;
      }

      return SUPPORTED_RELATIVE_PERIOD_UNITS[unit].searchKey.startsWith(userSuppliedUnits);
    });

    if (matchingUnit) {
      return [makeItem(userSuppliedAmount, matchingUnit, 0)];
    }
  } // Otherwise, do a normal filter search


  return (0,sentry_components_dropdownAutoComplete_autoCompleteFilter__WEBPACK_IMPORTED_MODULE_2__["default"])(items, filterValue);
};

/***/ }),

/***/ "./app/components/placeholder.tsx":
/*!****************************************!*\
  !*** ./app/components/placeholder.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const defaultProps = {
  shape: 'rect',
  bottomGutter: 0,
  width: '100%',
  height: '60px',
  testId: 'loading-placeholder'
};

const Placeholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    className,
    children,
    error,
    testId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", {
    "data-test-id": testId,
    className: className,
    children: error || children
  });
},  true ? {
  target: "e18pl72u0"
} : 0)("display:flex;flex-direction:column;flex-shrink:0;justify-content:center;align-items:center;background-color:", p => p.error ? p.theme.red100 : p.theme.backgroundSecondary, ";", p => p.error && `color: ${p.theme.red200};`, " width:", p => p.width, ";height:", p => p.height, ";", p => p.shape === 'circle' ? 'border-radius: 100%;' : '', " ", p => typeof p.bottomGutter === 'number' && p.bottomGutter > 0 ? `margin-bottom: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(p.bottomGutter)};` : '', ";" + ( true ? "" : 0));

Placeholder.defaultProps = defaultProps;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Placeholder);

/***/ }),

/***/ "./app/components/searchSyntax/parser.tsx":
/*!************************************************!*\
  !*** ./app/components/searchSyntax/parser.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BooleanOperator": () => (/* binding */ BooleanOperator),
/* harmony export */   "FilterType": () => (/* binding */ FilterType),
/* harmony export */   "TermOperator": () => (/* binding */ TermOperator),
/* harmony export */   "Token": () => (/* binding */ Token),
/* harmony export */   "TokenConverter": () => (/* binding */ TokenConverter),
/* harmony export */   "allOperators": () => (/* binding */ allOperators),
/* harmony export */   "filterTypeConfig": () => (/* binding */ filterTypeConfig),
/* harmony export */   "interchangeableFilterOperators": () => (/* binding */ interchangeableFilterOperators),
/* harmony export */   "joinQuery": () => (/* binding */ joinQuery),
/* harmony export */   "parseSearch": () => (/* binding */ parseSearch)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _grammar_pegjs__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./grammar.pegjs */ "./app/components/searchSyntax/grammar.pegjs");
/* harmony import */ var _grammar_pegjs__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_grammar_pegjs__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/components/searchSyntax/utils.tsx");









const listJoiner = _ref => {
  let [s1, comma, s2, _, value] = _ref;
  return {
    separator: [s1.value, comma, s2.value].join(''),
    value
  };
};
/**
 * A token represents a node in the syntax tree. These are all extrapolated
 * from the grammar and may not be named exactly the same.
 */


let Token;
/**
 * An operator in a key value term
 */

(function (Token) {
  Token["Spaces"] = "spaces";
  Token["Filter"] = "filter";
  Token["FreeText"] = "freeText";
  Token["LogicGroup"] = "logicGroup";
  Token["LogicBoolean"] = "logicBoolean";
  Token["KeySimple"] = "keySimple";
  Token["KeyExplicitTag"] = "keyExplicitTag";
  Token["KeyAggregate"] = "keyAggregate";
  Token["KeyAggregateArgs"] = "keyAggregateArgs";
  Token["KeyAggregateParam"] = "keyAggregateParam";
  Token["ValueIso8601Date"] = "valueIso8601Date";
  Token["ValueRelativeDate"] = "valueRelativeDate";
  Token["ValueDuration"] = "valueDuration";
  Token["ValuePercentage"] = "valuePercentage";
  Token["ValueBoolean"] = "valueBoolean";
  Token["ValueNumber"] = "valueNumber";
  Token["ValueText"] = "valueText";
  Token["ValueNumberList"] = "valueNumberList";
  Token["ValueTextList"] = "valueTextList";
})(Token || (Token = {}));

let TermOperator;
/**
 * Logic operators
 */

(function (TermOperator) {
  TermOperator["Default"] = "";
  TermOperator["GreaterThanEqual"] = ">=";
  TermOperator["LessThanEqual"] = "<=";
  TermOperator["GreaterThan"] = ">";
  TermOperator["LessThan"] = "<";
  TermOperator["Equal"] = "=";
  TermOperator["NotEqual"] = "!=";
})(TermOperator || (TermOperator = {}));

let BooleanOperator;
/**
 * The Token.Filter may be one of many types of filters. This enum declares the
 * each variant filter type.
 */

(function (BooleanOperator) {
  BooleanOperator["And"] = "AND";
  BooleanOperator["Or"] = "OR";
})(BooleanOperator || (BooleanOperator = {}));

let FilterType;

(function (FilterType) {
  FilterType["Text"] = "text";
  FilterType["TextIn"] = "textIn";
  FilterType["Date"] = "date";
  FilterType["SpecificDate"] = "specificDate";
  FilterType["RelativeDate"] = "relativeDate";
  FilterType["Duration"] = "duration";
  FilterType["Numeric"] = "numeric";
  FilterType["NumericIn"] = "numericIn";
  FilterType["Boolean"] = "boolean";
  FilterType["AggregateDuration"] = "aggregateDuration";
  FilterType["AggregatePercentage"] = "aggregatePercentage";
  FilterType["AggregateNumeric"] = "aggregateNumeric";
  FilterType["AggregateDate"] = "aggregateDate";
  FilterType["AggregateRelativeDate"] = "aggregateRelativeDate";
  FilterType["Has"] = "has";
  FilterType["Is"] = "is";
})(FilterType || (FilterType = {}));

const allOperators = [TermOperator.Default, TermOperator.GreaterThanEqual, TermOperator.LessThanEqual, TermOperator.GreaterThan, TermOperator.LessThan, TermOperator.Equal, TermOperator.NotEqual];
const basicOperators = [TermOperator.Default, TermOperator.NotEqual];
/**
 * Map of certain filter types to other filter types with applicable operators
 * e.g. SpecificDate can use the operators from Date to become a Date filter.
 */

const interchangeableFilterOperators = {
  [FilterType.SpecificDate]: [FilterType.Date],
  [FilterType.Date]: [FilterType.SpecificDate]
};
const textKeys = [Token.KeySimple, Token.KeyExplicitTag];
const numberUnits = {
  b: 1_000_000_000,
  m: 1_000_000,
  k: 1_000
};
/**
 * This constant-type configuration object declares how each filter type
 * operates. Including what types of keys, operators, and values it may
 * receive.
 *
 * This configuration is used to generate the discriminate Filter type that is
 * returned from the tokenFilter converter.
 */

const filterTypeConfig = {
  [FilterType.Text]: {
    validKeys: textKeys,
    validOps: basicOperators,
    validValues: [Token.ValueText],
    canNegate: true
  },
  [FilterType.TextIn]: {
    validKeys: textKeys,
    validOps: [],
    validValues: [Token.ValueTextList],
    canNegate: true
  },
  [FilterType.Date]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueIso8601Date],
    canNegate: false
  },
  [FilterType.SpecificDate]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueIso8601Date],
    canNegate: false
  },
  [FilterType.RelativeDate]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueRelativeDate],
    canNegate: false
  },
  [FilterType.Duration]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueDuration],
    canNegate: true
  },
  [FilterType.Numeric]: {
    validKeys: [Token.KeySimple],
    validOps: allOperators,
    validValues: [Token.ValueNumber],
    canNegate: true
  },
  [FilterType.NumericIn]: {
    validKeys: [Token.KeySimple],
    validOps: [],
    validValues: [Token.ValueNumberList],
    canNegate: true
  },
  [FilterType.Boolean]: {
    validKeys: [Token.KeySimple],
    validOps: basicOperators,
    validValues: [Token.ValueBoolean],
    canNegate: true
  },
  [FilterType.AggregateDuration]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueDuration],
    canNegate: true
  },
  [FilterType.AggregateNumeric]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueNumber],
    canNegate: true
  },
  [FilterType.AggregatePercentage]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValuePercentage],
    canNegate: true
  },
  [FilterType.AggregateDate]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueIso8601Date],
    canNegate: true
  },
  [FilterType.AggregateRelativeDate]: {
    validKeys: [Token.KeyAggregate],
    validOps: allOperators,
    validValues: [Token.ValueRelativeDate],
    canNegate: true
  },
  [FilterType.Has]: {
    validKeys: [Token.KeySimple],
    validOps: basicOperators,
    validValues: [],
    canNegate: true
  },
  [FilterType.Is]: {
    validKeys: [Token.KeySimple],
    validOps: basicOperators,
    validValues: [Token.ValueText],
    canNegate: true
  }
};

/**
 * Used to construct token results via the token grammar
 */
class TokenConverter {
  constructor(_ref2) {
    let {
      text,
      location,
      config
    } = _ref2;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "text", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "location", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "config", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "keyValidation", {
      isNumeric: key => this.config.numericKeys.has(key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_5__.isMeasurement)(key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_5__.isSpanOperationBreakdownField)(key),
      isBoolean: key => this.config.booleanKeys.has(key),
      isPercentage: key => this.config.percentageKeys.has(key),
      isDate: key => this.config.dateKeys.has(key),
      isDuration: key => this.config.durationKeys.has(key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_5__.isSpanOperationBreakdownField)(key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_5__.measurementType)(key) === 'duration'
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenSpaces", value => ({ ...this.defaultTokenFields,
      type: Token.Spaces,
      value
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenFilter", (filter, key, value, operator, negated) => {
      const filterToken = {
        type: Token.Filter,
        filter,
        key,
        value,
        negated,
        operator: operator !== null && operator !== void 0 ? operator : TermOperator.Default,
        invalid: this.checkInvalidFilter(filter, key, value)
      };
      return { ...this.defaultTokenFields,
        ...filterToken
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenFreeText", (value, quoted) => ({ ...this.defaultTokenFields,
      type: Token.FreeText,
      value,
      quoted
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenLogicGroup", inner => ({ ...this.defaultTokenFields,
      type: Token.LogicGroup,
      inner
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenLogicBoolean", bool => ({ ...this.defaultTokenFields,
      type: Token.LogicBoolean,
      value: bool
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenKeySimple", (value, quoted) => ({ ...this.defaultTokenFields,
      type: Token.KeySimple,
      value,
      quoted
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenKeyExplicitTag", (prefix, key) => ({ ...this.defaultTokenFields,
      type: Token.KeyExplicitTag,
      prefix,
      key
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenKeyAggregateParam", (value, quoted) => ({ ...this.defaultTokenFields,
      type: Token.KeyAggregateParam,
      value,
      quoted
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenKeyAggregate", (name, args, argsSpaceBefore, argsSpaceAfter) => ({ ...this.defaultTokenFields,
      type: Token.KeyAggregate,
      name,
      args,
      argsSpaceBefore,
      argsSpaceAfter
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenKeyAggregateArgs", (arg1, args) => ({ ...this.defaultTokenFields,
      type: Token.KeyAggregateArgs,
      args: [{
        separator: '',
        value: arg1
      }, ...args.map(listJoiner)]
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueIso8601Date", value => ({ ...this.defaultTokenFields,
      type: Token.ValueIso8601Date,
      value: moment__WEBPACK_IMPORTED_MODULE_3___default()(value)
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueRelativeDate", (value, sign, unit) => ({ ...this.defaultTokenFields,
      type: Token.ValueRelativeDate,
      value: Number(value),
      sign,
      unit
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueDuration", (value, unit) => ({ ...this.defaultTokenFields,
      type: Token.ValueDuration,
      value: Number(value),
      unit
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValuePercentage", value => ({ ...this.defaultTokenFields,
      type: Token.ValuePercentage,
      value: Number(value)
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueBoolean", value => ({ ...this.defaultTokenFields,
      type: Token.ValueBoolean,
      value: ['1', 'true'].includes(value.toLowerCase())
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueNumber", (value, unit) => {
      var _numberUnits$unit;

      return { ...this.defaultTokenFields,
        type: Token.ValueNumber,
        value,
        rawValue: Number(value) * ((_numberUnits$unit = numberUnits[unit]) !== null && _numberUnits$unit !== void 0 ? _numberUnits$unit : 1),
        unit
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueNumberList", (item1, items) => ({ ...this.defaultTokenFields,
      type: Token.ValueNumberList,
      items: [{
        separator: '',
        value: item1
      }, ...items.map(listJoiner)]
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueTextList", (item1, items) => ({ ...this.defaultTokenFields,
      type: Token.ValueTextList,
      items: [{
        separator: '',
        value: item1
      }, ...items.map(listJoiner)]
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenValueText", (value, quoted) => ({ ...this.defaultTokenFields,
      type: Token.ValueText,
      value,
      quoted
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "predicateFilter", (type, key) => {
      // @ts-expect-error Unclear why this isn’t resolving correctly
      const keyName = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.getKeyName)(key);
      const aggregateKey = key;
      const {
        isNumeric,
        isDuration,
        isBoolean,
        isDate,
        isPercentage
      } = this.keyValidation;

      const checkAggregate = check => {
        var _aggregateKey$args;

        return (_aggregateKey$args = aggregateKey.args) === null || _aggregateKey$args === void 0 ? void 0 : _aggregateKey$args.args.some(arg => {
          var _arg$value$value, _arg$value;

          return check((_arg$value$value = arg === null || arg === void 0 ? void 0 : (_arg$value = arg.value) === null || _arg$value === void 0 ? void 0 : _arg$value.value) !== null && _arg$value$value !== void 0 ? _arg$value$value : '');
        });
      };

      switch (type) {
        case FilterType.Numeric:
        case FilterType.NumericIn:
          return isNumeric(keyName);

        case FilterType.Duration:
          return isDuration(keyName);

        case FilterType.Boolean:
          return isBoolean(keyName);

        case FilterType.Date:
        case FilterType.RelativeDate:
        case FilterType.SpecificDate:
          return isDate(keyName);

        case FilterType.AggregateDuration:
          return checkAggregate(isDuration);

        case FilterType.AggregateDate:
          return checkAggregate(isDate);

        case FilterType.AggregatePercentage:
          return checkAggregate(isPercentage);

        default:
          return true;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "predicateTextOperator", key => this.config.textOperatorKeys.has((0,_utils__WEBPACK_IMPORTED_MODULE_7__.getKeyName)(key)));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "checkInvalidFilter", (filter, key, value) => {
      // Text filter is the "fall through" filter that will match when other
      // filter predicates fail.
      if (filter === FilterType.Text) {
        return this.checkInvalidTextFilter(key, value);
      }

      if (filter === FilterType.Is || filter === FilterType.Has) {
        return this.checkInvalidTextValue(value);
      }

      if ([FilterType.TextIn, FilterType.NumericIn].includes(filter)) {
        return this.checkInvalidInFilter(value);
      }

      return null;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "checkInvalidTextFilter", (key, value) => {
      // Explicit tag keys will always be treated as text filters
      if (key.type === Token.KeyExplicitTag) {
        return this.checkInvalidTextValue(value);
      }

      const keyName = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.getKeyName)(key);

      if (this.keyValidation.isDuration(keyName)) {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Invalid duration. Expected number followed by duration unit suffix'),
          expectedType: [FilterType.Duration]
        };
      }

      if (this.keyValidation.isDate(keyName)) {
        const date = new Date();
        date.setSeconds(0);
        date.setMilliseconds(0);
        const example = date.toISOString();
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Invalid date format. Expected +/-duration (e.g. +1h) or ISO 8601-like (e.g. %s or %s)', example.slice(0, 10), example),
          expectedType: [FilterType.Date, FilterType.SpecificDate, FilterType.RelativeDate]
        };
      }

      if (this.keyValidation.isBoolean(keyName)) {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Invalid boolean. Expected true, 1, false, or 0.'),
          expectedType: [FilterType.Boolean]
        };
      }

      if (this.keyValidation.isNumeric(keyName)) {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Invalid number. Expected number then optional k, m, or b suffix (e.g. 500k)'),
          expectedType: [FilterType.Numeric, FilterType.NumericIn]
        };
      }

      return this.checkInvalidTextValue(value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "checkInvalidTextValue", value => {
      if (!value.quoted && /(^|[^\\])"/.test(value.value)) {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Quotes must enclose text or be escaped')
        };
      }

      if (!value.quoted && value.value === '') {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Filter must have a value')
        };
      }

      return null;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "checkInvalidInFilter", _ref3 => {
      let {
        items
      } = _ref3;
      const hasEmptyValue = items.some(item => item.value === null);

      if (hasEmptyValue) {
        return {
          reason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Lists should not have empty values')
        };
      }

      return null;
    });

    this.text = text;
    this.location = location;
    this.config = config;
  }
  /**
   * Validates various types of keys
   */


  /**
   * Creates shared `text` and `location` keys.
   */
  get defaultTokenFields() {
    return {
      text: this.text(),
      location: this.location()
    };
  }

}
/**
 * Maps token conversion methods to their result types
 */

const defaultConfig = {
  textOperatorKeys: new Set(['release.version', 'release.build', 'release.package', 'release.stage']),
  durationKeys: new Set(['transaction.duration']),
  percentageKeys: new Set(['percentage']),
  // do not put functions in this Set
  numericKeys: new Set(['project_id', 'project.id', 'issue.id', 'stack.colno', 'stack.lineno', 'stack.stack_level', 'transaction.duration']),
  dateKeys: new Set(['start', 'end', 'firstSeen', 'lastSeen', 'last_seen()', 'time', 'event.timestamp', 'timestamp', 'timestamp.to_hour', 'timestamp.to_day']),
  booleanKeys: new Set(['error.handled', 'error.unhandled', 'stack.in_app', 'team_key_transaction']),
  allowBoolean: true
};
const options = {
  TokenConverter,
  TermOperator,
  FilterType,
  config: defaultConfig
};
/**
 * Parse a search query into a ParseResult. Failing to parse the search query
 * will result in null.
 */

function parseSearch(query) {
  try {
    return _grammar_pegjs__WEBPACK_IMPORTED_MODULE_6___default().parse(query, options);
  } catch (e) {// TODO(epurkhiser): Should we capture these errors somewhere?
  }

  return null;
}
/**
 * Join a parsed query array into a string.
 * Should handle null cases to chain easily with parseSearch.
 * Option to add a leading space when applicable (e.g. to combine with other strings).
 * Option to add a space between elements (e.g. for when no Token.Spaces present).
 */

function joinQuery(parsedTerms, leadingSpace, additionalSpaceBetween) {
  if (!parsedTerms || !parsedTerms.length) {
    return '';
  }

  return (leadingSpace ? ' ' : '') + (parsedTerms.length === 1 ? parsedTerms[0].text : parsedTerms.map(p => p.text).join(additionalSpaceBetween ? ' ' : ''));
}

/***/ }),

/***/ "./app/components/searchSyntax/renderer.tsx":
/*!**************************************************!*\
  !*** ./app/components/searchSyntax/renderer.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HighlightQuery)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/utils/use-reduced-motion.mjs");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _parser__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./utils */ "./app/components/searchSyntax/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











/**
 * Renders the parsed query with syntax highlighting.
 */
function HighlightQuery(_ref3) {
  let {
    parsedQuery,
    cursorPosition
  } = _ref3;
  const result = renderResult(parsedQuery, cursorPosition !== null && cursorPosition !== void 0 ? cursorPosition : -1);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: result
  });
}
HighlightQuery.displayName = "HighlightQuery";

function renderResult(result, cursor) {
  return result.map(t => renderToken(t, cursor)).map((renderedToken, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: renderedToken
  }, i));
}

function renderToken(token, cursor) {
  switch (token.type) {
    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.Spaces:
      return token.value;

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.Filter:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(FilterToken, {
        filter: token,
        cursor: cursor
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.ValueTextList:
    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.ValueNumberList:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ListToken, {
        token: token,
        cursor: cursor
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.ValueNumber:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(NumberToken, {
        token: token
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.ValueBoolean:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Boolean, {
        children: token.text
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.ValueIso8601Date:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(DateTime, {
        children: token.text
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.LogicGroup:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(LogicGroup, {
        children: renderResult(token.inner, cursor)
      });

    case _parser__WEBPACK_IMPORTED_MODULE_5__.Token.LogicBoolean:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(LogicBoolean, {
        children: token.value
      });

    default:
      return token.text;
  }
} // XXX(epurkhiser): We have to animate `left` here instead of `transform` since
// inline elements cannot be transformed. The filter _must_ be inline to
// support text wrapping.


const shakeAnimation = _emotion_react__WEBPACK_IMPORTED_MODULE_8__.keyframes`
  ${new Array(4).fill(0).map((_, i) => `${i * (100 / 4)}% { left: ${3 * (i % 2 === 0 ? 1 : -1)}px; }`).join('\n')}
`;

const FilterToken = _ref4 => {
  var _filter$invalid;

  let {
    filter,
    cursor
  } = _ref4;
  const isActive = (0,_utils__WEBPACK_IMPORTED_MODULE_6__.isWithinToken)(filter, cursor); // This state tracks if the cursor has left the filter token. We initialize it
  // to !isActive in the case where the filter token is rendered without the
  // cursor initially being in it.

  const [hasLeft, setHasLeft] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(!isActive); // Used to trigger the shake animation when the element becomes invalid

  const filterElementRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null); // Trigger the effect when isActive changes to updated whether the cursor has
  // left the token.

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!isActive && !hasLeft) {
      setHasLeft(true);
    }
  }, [hasLeft, isActive]);
  const showInvalid = hasLeft && !!filter.invalid;
  const showTooltip = showInvalid && isActive;
  const reduceMotion = (0,framer_motion__WEBPACK_IMPORTED_MODULE_9__.useReducedMotion)(); // Trigger the shakeAnimation when showInvalid is set to true. We reset the
  // animation by clearing the style, set it to running, and re-applying the
  // animation

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!filterElementRef.current || !showInvalid || reduceMotion) {
      return;
    }

    const style = filterElementRef.current.style;
    style.animation = 'none';
    void filterElementRef.current.offsetTop;
    window.requestAnimationFrame(() => style.animation = `${shakeAnimation.name} 300ms`);
  }, [reduceMotion, showInvalid]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
    disabled: !showTooltip,
    title: (_filter$invalid = filter.invalid) === null || _filter$invalid === void 0 ? void 0 : _filter$invalid.reason,
    overlayStyle: {
      maxWidth: '350px'
    },
    forceVisible: true,
    skipWrapper: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Filter, {
      ref: filterElementRef,
      active: isActive,
      invalid: showInvalid,
      children: [filter.negated && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Negation, {
        children: "!"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(KeyToken, {
        token: filter.key,
        negated: filter.negated
      }), filter.operator && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Operator, {
        children: filter.operator
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Value, {
        children: renderToken(filter.value, cursor)
      })]
    })
  });
};

FilterToken.displayName = "FilterToken";

const KeyToken = _ref5 => {
  let {
    token,
    negated
  } = _ref5;
  let value = token.text;

  if (token.type === _parser__WEBPACK_IMPORTED_MODULE_5__.Token.KeyExplicitTag) {
    value = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ExplicitKey, {
      prefix: token.prefix,
      children: token.key.quoted ? `"${token.key.value}"` : token.key.value
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Key, {
    negated: !!negated,
    children: [value, ":"]
  });
};

KeyToken.displayName = "KeyToken";

const ListToken = _ref6 => {
  let {
    token,
    cursor
  } = _ref6;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(InList, {
    children: token.items.map(_ref7 => {
      let {
        value,
        separator
      } = _ref7;
      return [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ListComma, {
        children: separator
      }, "comma"), value && renderToken(value, cursor)];
    })
  });
};

ListToken.displayName = "ListToken";

const NumberToken = _ref8 => {
  let {
    token
  } = _ref8;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [token.value, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Unit, {
      children: token.unit
    })]
  });
};

NumberToken.displayName = "NumberToken";

const colorType = p => `${p.invalid ? 'invalid' : 'valid'}${p.active ? 'Active' : ''}`;

const Filter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf12"
} : 0)("--token-bg:", p => p.theme.searchTokenBackground[colorType(p)], ";--token-border:", p => p.theme.searchTokenBorder[colorType(p)], ";--token-value-color:", p => p.invalid ? p.theme.red300 : p.theme.blue300, ";position:relative;animation-name:", shakeAnimation, ";" + ( true ? "" : 0));

const filterCss = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.css)("background:var(--token-bg);border:0.5px solid var(--token-border);padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25), " 0;" + ( true ? "" : 0),  true ? "" : 0);

const Negation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf11"
} : 0)(filterCss, ";border-right:none;padding-left:1px;margin-left:-2px;font-weight:bold;border-radius:2px 0 0 2px;color:", p => p.theme.red300, ";" + ( true ? "" : 0));

var _ref =  true ? {
  name: "12gnbi",
  styles: "border-left:none;margin-left:0"
} : 0;

var _ref2 =  true ? {
  name: "1h2r5pb",
  styles: "border-radius:2px 0 0 2px;padding-left:1px;margin-left:-2px"
} : 0;

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf10"
} : 0)(filterCss, ";border-right:none;font-weight:bold;", p => !p.negated ? _ref2 : _ref, ";" + ( true ? "" : 0));

const ExplicitKey = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf9"
} : 0)("&:before,&:after{color:", p => p.theme.subText, ";}&:before{content:'", p => p.prefix, "[';}&:after{content:']';}" + ( true ? "" : 0));

const Operator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf8"
} : 0)(filterCss, ";border-left:none;border-right:none;margin:-1px 0;color:", p => p.theme.pink300, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf7"
} : 0)(filterCss, ";border-left:none;border-radius:0 2px 2px 0;color:var(--token-value-color);margin:-1px -2px -1px 0;padding-right:1px;" + ( true ? "" : 0));

const Unit = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf6"
} : 0)("font-weight:bold;color:", p => p.theme.green300, ";" + ( true ? "" : 0));

const LogicBoolean = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf5"
} : 0)("font-weight:bold;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const Boolean = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf4"
} : 0)("color:", p => p.theme.pink300, ";" + ( true ? "" : 0));

const DateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf3"
} : 0)("color:", p => p.theme.green300, ";" + ( true ? "" : 0));

const ListComma = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf2"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const InList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1t4m3bf1"
} : 0)("&:before{content:'[';font-weight:bold;color:", p => p.theme.purple300, ";}&:after{content:']';font-weight:bold;color:", p => p.theme.purple300, ";}", Value, "{color:", p => p.theme.purple300, ";}" + ( true ? "" : 0));

const LogicGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref9 => {
  let {
    children,
    ...props
  } = _ref9;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("span", { ...props,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("span", {
      children: "("
    }), children, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("span", {
      children: ")"
    })]
  });
},  true ? {
  target: "e1t4m3bf0"
} : 0)(">span:first-child,>span:last-child{position:relative;color:transparent;&:before{position:absolute;top:-5px;color:", p => p.theme.pink300, ";font-size:16px;font-weight:bold;}}>span:first-child:before{left:-3px;content:'(';}>span:last-child:before{right:-3px;content:')';}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/searchSyntax/utils.tsx":
/*!***********************************************!*\
  !*** ./app/components/searchSyntax/utils.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getKeyName": () => (/* binding */ getKeyName),
/* harmony export */   "isOperator": () => (/* binding */ isOperator),
/* harmony export */   "isWithinToken": () => (/* binding */ isWithinToken),
/* harmony export */   "treeResultLocator": () => (/* binding */ treeResultLocator),
/* harmony export */   "treeTransformer": () => (/* binding */ treeTransformer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _parser__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./parser */ "./app/components/searchSyntax/parser.tsx");



/**
 * Used internally within treeResultLocator to stop recursion once we've
 * located a matched result.
 */

class TokenResultFound extends Error {
  constructor(result) {
    super();

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "result", void 0);

    this.result = result;
  }

}
/**
 * Used as the marker to skip token traversal in treeResultLocator
 */


const skipTokenMarker = Symbol('Returned to skip visiting a token');

/**
 * Utility function to visit every Token node within an AST tree (in DFS order)
 * and apply a test method that may choose to return some value from that node.
 *
 * You must call the `returnValue` method for a result to be returned.
 *
 * When returnValue is never called and all nodes of the search tree have been
 * visited the noResultValue will be returned.
 */
function treeResultLocator(_ref) {
  let {
    tree,
    visitorTest,
    noResultValue
  } = _ref;

  const returnResult = result => new TokenResultFound(result);

  const nodeVisitor = token => {
    if (token === null) {
      return;
    }

    const result = visitorTest({
      token,
      returnResult,
      skipToken: skipTokenMarker
    }); // Bubble the result back up.
    //
    // XXX: Using a throw here is a bit easier than threading the return value
    // back up through the recursive call tree.

    if (result instanceof TokenResultFound) {
      throw result;
    } // Don't traverse into any nested tokens


    if (result === skipTokenMarker) {
      return;
    }

    switch (token.type) {
      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.Filter:
        nodeVisitor(token.key);
        nodeVisitor(token.value);
        break;

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyExplicitTag:
        nodeVisitor(token.key);
        break;

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyAggregate:
        nodeVisitor(token.name);
        token.args && nodeVisitor(token.args);
        nodeVisitor(token.argsSpaceBefore);
        nodeVisitor(token.argsSpaceAfter);
        break;

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.LogicGroup:
        token.inner.forEach(nodeVisitor);
        break;

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyAggregateArgs:
        token.args.forEach(v => nodeVisitor(v.value));
        break;

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.ValueNumberList:
      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.ValueTextList:
        token.items.forEach(v => nodeVisitor(v.value));
        break;

      default:
    }
  };

  try {
    tree.forEach(nodeVisitor);
  } catch (error) {
    if (error instanceof TokenResultFound) {
      return error.result;
    }

    throw error;
  }

  return noResultValue;
}

/**
 * Utility function to visit every Token node within an AST tree and apply
 * a transform to those nodes.
 */
function treeTransformer(_ref2) {
  let {
    tree,
    transform
  } = _ref2;

  const nodeVisitor = token => {
    if (token === null) {
      return null;
    }

    switch (token.type) {
      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.Filter:
        return transform({ ...token,
          key: nodeVisitor(token.key),
          value: nodeVisitor(token.value)
        });

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyExplicitTag:
        return transform({ ...token,
          key: nodeVisitor(token.key)
        });

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyAggregate:
        return transform({ ...token,
          name: nodeVisitor(token.name),
          args: token.args ? nodeVisitor(token.args) : token.args,
          argsSpaceBefore: nodeVisitor(token.argsSpaceBefore),
          argsSpaceAfter: nodeVisitor(token.argsSpaceAfter)
        });

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.LogicGroup:
        return transform({ ...token,
          inner: token.inner.map(nodeVisitor)
        });

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyAggregateArgs:
        return transform({ ...token,
          args: token.args.map(v => ({ ...v,
            value: nodeVisitor(v.value)
          }))
        });

      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.ValueNumberList:
      case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.ValueTextList:
        return transform({ ...token,
          // TODO(ts): Not sure why `v` cannot be inferred here
          items: token.items.map(v => ({ ...v,
            value: nodeVisitor(v.value)
          }))
        });

      default:
        return transform(token);
    }
  };

  return tree.map(nodeVisitor);
}

/**
 * Utility to get the string name of any type of key.
 */
const getKeyName = function (key) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const {
    aggregateWithArgs
  } = options;

  switch (key.type) {
    case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeySimple:
      return key.value;

    case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyExplicitTag:
      return key.key.value;

    case _parser__WEBPACK_IMPORTED_MODULE_2__.Token.KeyAggregate:
      return aggregateWithArgs ? `${key.name.value}(${key.args ? key.args.text : ''})` : key.name.value;

    default:
      return '';
  }
};
function isWithinToken(node, position) {
  if (!node) {
    return false;
  }

  return position >= node.location.start.offset && position <= node.location.end.offset;
}
function isOperator(value) {
  return _parser__WEBPACK_IMPORTED_MODULE_2__.allOperators.some(op => op === value);
}

/***/ }),

/***/ "./app/components/smartSearchBar/actions.tsx":
/*!***************************************************!*\
  !*** ./app/components/smartSearchBar/actions.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionButton": () => (/* binding */ ActionButton),
/* harmony export */   "makePinSearchAction": () => (/* binding */ makePinSearchAction),
/* harmony export */   "makeSaveSearchAction": () => (/* binding */ makeSaveSearchAction),
/* harmony export */   "makeSearchBuilderAction": () => (/* binding */ makeSearchBuilderAction)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/savedSearches */ "./app/actionCreators/savedSearches.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_issueList_createSavedSearchModal__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/issueList/createSavedSearchModal */ "./app/views/issueList/createSavedSearchModal.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./utils */ "./app/components/smartSearchBar/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

// eslint-disable-next-line no-restricted-imports














/**
 * The Pin Search action toggles the current as a pinned search
 */
function makePinSearchAction(_ref) {
  let {
    pinnedSearch,
    sort
  } = _ref;

  const PinSearchAction = _ref2 => {
    let {
      menuItemVariant,
      savedSearchType,
      organization,
      api,
      query,
      location
    } = _ref2;

    const onTogglePinnedSearch = async evt => {
      var _pinnedSearch$query;

      evt.preventDefault();
      evt.stopPropagation();

      if (savedSearchType === undefined) {
        return;
      }

      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('search.pin', {
        organization,
        action: !!pinnedSearch ? 'unpin' : 'pin',
        search_type: savedSearchType === sentry_types__WEBPACK_IMPORTED_MODULE_9__.SavedSearchType.ISSUE ? 'issues' : 'events',
        query: (_pinnedSearch$query = pinnedSearch === null || pinnedSearch === void 0 ? void 0 : pinnedSearch.query) !== null && _pinnedSearch$query !== void 0 ? _pinnedSearch$query : query
      });

      if (!!pinnedSearch) {
        (0,sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_3__.unpinSearch)(api, organization.slug, savedSearchType, pinnedSearch).then(() => {
          react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({ ...location,
            pathname: `/organizations/${organization.slug}/issues/`,
            query: { ...currentQuery,
              query: pinnedSearch.query,
              sort: pinnedSearch.sort
            }
          });
        });
        return;
      }

      const resp = await (0,sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_3__.pinSearch)(api, organization.slug, savedSearchType, (0,_utils__WEBPACK_IMPORTED_MODULE_12__.removeSpace)(query), sort);

      if (!resp || !resp.id) {
        return;
      }

      react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({ ...location,
        pathname: `/organizations/${organization.slug}/issues/searches/${resp.id}/`,
        query: currentQuery
      });
    };

    const pinTooltip = !!pinnedSearch ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unpin this search') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Pin this search');
    return menuItemVariant ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_6__["default"], {
      withBorder: true,
      "data-test-id": "pin-icon",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconPin, {
        isSolid: !!pinnedSearch,
        size: "xs"
      }),
      onClick: onTogglePinnedSearch,
      children: !!pinnedSearch ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unpin Search') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Pin Search')
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionButton, {
      title: pinTooltip,
      disabled: !query,
      "aria-label": pinTooltip,
      onClick: onTogglePinnedSearch,
      isActive: !!pinnedSearch,
      "data-test-id": "pin-icon",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconPin, {
        isSolid: !!pinnedSearch,
        size: "xs"
      })
    });
  };

  return {
    key: 'pinSearch',
    Action: (0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(PinSearchAction)
  };
}

/**
 * The Save Search action triggers the create saved search modal from the
 * current query.
 */
function makeSaveSearchAction(_ref3) {
  let {
    sort
  } = _ref3;

  const SavedSearchAction = _ref4 => {
    let {
      menuItemVariant,
      query,
      organization
    } = _ref4;

    const onClick = () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_2__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_issueList_createSavedSearchModal__WEBPACK_IMPORTED_MODULE_11__["default"], { ...deps,
      organization,
      query,
      sort
    }));

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      access: ['org:write'],
      children: _ref5 => {
        let {
          hasAccess
        } = _ref5;
        const title = hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Add to organization saved searches') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('You do not have permission to create a saved search');
        return menuItemVariant ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_6__["default"], {
          onClick: onClick,
          disabled: !hasAccess,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconAdd, {
            size: "xs"
          }),
          title: !hasAccess ? title : undefined,
          withBorder: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Create Saved Search')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionButton, {
          onClick: onClick,
          disabled: !hasAccess,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconAdd, {
            size: "xs"
          }),
          title: title,
          "aria-label": title,
          "data-test-id": "save-current-search"
        });
      }
    });
  };

  return {
    key: 'saveSearch',
    Action: SavedSearchAction
  };
}

/**
 * The Search Builder action toggles the Issue Stream search builder
 */
function makeSearchBuilderAction(_ref6) {
  let {
    onSidebarToggle
  } = _ref6;

  const SearchBuilderAction = _ref7 => {
    let {
      menuItemVariant
    } = _ref7;
    return menuItemVariant ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_6__["default"], {
      withBorder: true,
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconSliders, {
        size: "xs"
      }),
      onClick: onSidebarToggle,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Toggle sidebar')
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionButton, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Toggle search builder'),
      tooltipProps: {
        containerDisplayMode: 'inline-flex'
      },
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Toggle search builder'),
      onClick: onSidebarToggle,
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconSliders, {
        size: "xs"
      })
    });
  };

  return {
    key: 'searchBuilder',
    Action: SearchBuilderAction
  };
}
const ActionButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e491rhv0"
} : 0)("color:", p => p.isActive ? p.theme.blue300 : p.theme.gray300, ";width:18px;&,&:hover,&:focus{background:transparent;}&:hover{color:", p => p.theme.gray400, ";}" + ( true ? "" : 0));
ActionButton.defaultProps = {
  type: 'button',
  borderless: true,
  size: 'zero'
};

/***/ }),

/***/ "./app/components/smartSearchBar/index.tsx":
/*!*************************************************!*\
  !*** ./app/components/smartSearchBar/index.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SmartSearchBar": () => (/* binding */ SmartSearchBar),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_autosize_textarea__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-autosize-textarea */ "../node_modules/react-autosize-textarea/lib/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/actionCreators/savedSearches */ "./app/actionCreators/savedSearches.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/searchSyntax/renderer */ "./app/components/searchSyntax/renderer.tsx");
/* harmony import */ var sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/searchSyntax/utils */ "./app/components/searchSyntax/utils.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_getDynamicComponent__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/getDynamicComponent */ "./app/utils/getDynamicComponent.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _actions__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./actions */ "./app/components/smartSearchBar/actions.tsx");
/* harmony import */ var _searchBarDatePicker__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ./searchBarDatePicker */ "./app/components/smartSearchBar/searchBarDatePicker.tsx");
/* harmony import */ var _searchDropdown__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./searchDropdown */ "./app/components/smartSearchBar/searchDropdown.tsx");
/* harmony import */ var _searchHotkeysListener__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./searchHotkeysListener */ "./app/components/smartSearchBar/searchHotkeysListener.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./types */ "./app/components/smartSearchBar/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./utils */ "./app/components/smartSearchBar/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


 // eslint-disable-next-line no-restricted-imports
































/**
 * The max width in pixels of the search bar at which the buttons will
 * have overflowed into the dropdown.
 */



const ACTION_OVERFLOW_WIDTH = 400;
/**
 * Actions are moved to the overflow dropdown after each pixel step is reached.
 */

const ACTION_OVERFLOW_STEPS = 75;

const makeQueryState = query => ({
  query,
  parsedQuery: (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.parseSearch)(query)
});

const generateOpAutocompleteGroup = (validOps, tagName) => {
  const operatorMap = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.generateOperatorEntryMap)(tagName);
  const operatorItems = validOps.map(op => operatorMap[op]);
  return {
    searchItems: operatorItems,
    recentSearchItems: undefined,
    tagName: '',
    type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_OPERATOR
  };
};

const escapeValue = value => {
  // Wrap in quotes if there is a space
  return value.includes(' ') || value.includes('"') ? `"${value.replace(/"/g, '\\"')}"` : value;
};

class SmartSearchBar extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    var _this$props$actionBar, _this$props$actionBar2;

    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      query: this.initialQuery,
      showDropdown: false,
      parsedQuery: (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.parseSearch)(this.initialQuery),
      searchTerm: '',
      searchGroups: [],
      flatSearchItems: [],
      activeSearchItem: -1,
      tags: {},
      inputHasFocus: false,
      loading: false,
      numActionsVisible: (_this$props$actionBar = (_this$props$actionBar2 = this.props.actionBarItems) === null || _this$props$actionBar2 === void 0 ? void 0 : _this$props$actionBar2.length) !== null && _this$props$actionBar !== void 0 ? _this$props$actionBar : 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "searchInput", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "containerRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "inputResizeObserver", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onBackgroundPointerUp", e => {
      var _this$containerRef$cu;

      if ((_this$containerRef$cu = this.containerRef.current) !== null && _this$containerRef$cu !== void 0 && _this$containerRef$cu.contains(e.target)) {
        return;
      }

      this.close();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateActionsVisible", entries => {
      var _this$props$actionBar3, _this$props$actionBar4;

      if (entries.length === 0) {
        return;
      }

      const entry = entries[0];
      const {
        width
      } = entry.contentRect;
      const actionCount = (_this$props$actionBar3 = (_this$props$actionBar4 = this.props.actionBarItems) === null || _this$props$actionBar4 === void 0 ? void 0 : _this$props$actionBar4.length) !== null && _this$props$actionBar3 !== void 0 ? _this$props$actionBar3 : 0;
      const numActionsVisible = Math.min(actionCount, Math.floor(Math.max(0, width - ACTION_OVERFLOW_WIDTH) / ACTION_OVERFLOW_STEPS));

      if (this.state.numActionsVisible === numActionsVisible) {
        return;
      }

      this.setState({
        numActionsVisible
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "moveToNextToken", filterTokens => {
      const token = this.cursorToken;

      if (this.searchInput.current && filterTokens.length > 0) {
        this.searchInput.current.focus();
        let offset = filterTokens[0].location.end.offset;

        if (token) {
          const tokenIndex = filterTokens.findIndex(tok => tok === token);

          if (tokenIndex !== -1 && tokenIndex + 1 < filterTokens.length) {
            offset = filterTokens[tokenIndex + 1].location.end.offset;
          }
        }

        this.searchInput.current.selectionStart = offset;
        this.searchInput.current.selectionEnd = offset;
        this.updateAutoCompleteItems();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "deleteToken", () => {
      var _this$cursorToken;

      const {
        query
      } = this.state;
      const token = (_this$cursorToken = this.cursorToken) !== null && _this$cursorToken !== void 0 ? _this$cursorToken : undefined;
      const filterTokens = this.filterTokens;
      const hasExecCommand = typeof document.execCommand === 'function';

      if (token && filterTokens.length > 0) {
        var _filterTokens$findInd;

        const index = (_filterTokens$findInd = filterTokens.findIndex(tok => tok === token)) !== null && _filterTokens$findInd !== void 0 ? _filterTokens$findInd : -1;
        const newQuery = // We trim to remove any remaining spaces
        query.slice(0, token.location.start.offset).trim() + (index > 0 && index < filterTokens.length - 1 ? ' ' : '') + query.slice(token.location.end.offset).trim();

        if (this.searchInput.current) {
          // Only use exec command if exists
          this.searchInput.current.focus();
          this.searchInput.current.selectionStart = 0;
          this.searchInput.current.selectionEnd = query.length; // Because firefox doesn't support inserting an empty string, we insert a newline character instead
          // But because of this, only on firefox, if you delete the last token you won't be able to undo.

          if (navigator.userAgent.toLowerCase().includes('firefox') && newQuery.length === 0 || !hasExecCommand || !document.execCommand('insertText', false, newQuery)) {
            // This will run either when newQuery is empty on firefox or when execCommand fails.
            this.updateQuery(newQuery);
          }
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "negateToken", () => {
      var _this$cursorToken2;

      const {
        query
      } = this.state;
      const token = (_this$cursorToken2 = this.cursorToken) !== null && _this$cursorToken2 !== void 0 ? _this$cursorToken2 : undefined;
      const hasExecCommand = typeof document.execCommand === 'function';

      if (token && token.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter) {
        if (token.negated) {
          if (this.searchInput.current) {
            this.searchInput.current.focus();
            const tokenCursorOffset = this.cursorPosition - token.key.location.start.offset; // Select the whole token so we can replace it.

            this.searchInput.current.selectionStart = token.location.start.offset;
            this.searchInput.current.selectionEnd = token.location.end.offset; // We can't call insertText with an empty string on Firefox, so we have to do this.

            if (!hasExecCommand || !document.execCommand('insertText', false, token.text.slice(1))) {
              // Fallback when execCommand fails
              const newQuery = query.slice(0, token.location.start.offset) + query.slice(token.key.location.start.offset);
              this.updateQuery(newQuery, this.cursorPosition - 1);
            } // Return the cursor to where it should be


            const newCursorPosition = token.location.start.offset + tokenCursorOffset;
            this.searchInput.current.selectionStart = newCursorPosition;
            this.searchInput.current.selectionEnd = newCursorPosition;
          }
        } else {
          if (this.searchInput.current) {
            this.searchInput.current.focus();
            const tokenCursorOffset = this.cursorPosition - token.key.location.start.offset;
            this.searchInput.current.selectionStart = token.location.start.offset;
            this.searchInput.current.selectionEnd = token.location.start.offset;

            if (!hasExecCommand || !document.execCommand('insertText', false, '!')) {
              // Fallback when execCommand fails
              const newQuery = query.slice(0, token.key.location.start.offset) + '!' + query.slice(token.key.location.start.offset);
              this.updateQuery(newQuery, this.cursorPosition + 1);
            } // Return the cursor to where it should be, +1 for the ! character we added


            const newCursorPosition = token.location.start.offset + tokenCursorOffset + 1;
            this.searchInput.current.selectionStart = newCursorPosition;
            this.searchInput.current.selectionEnd = newCursorPosition;
          }
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "logShortcutEvent", (shortcutType, shortcutMethod) => {
      const {
        searchSource,
        savedSearchType,
        organization
      } = this.props;
      const {
        query
      } = this.state;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.shortcut_used', {
        organization,
        search_type: savedSearchType === 0 ? 'issues' : 'events',
        search_source: searchSource,
        shortcut_method: shortcutMethod,
        shortcut_type: shortcutType,
        query
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "runShortcutOnClick", shortcut => {
      this.runShortcut(shortcut);
      this.logShortcutEvent(shortcut.shortcutType, 'click');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "runShortcutOnHotkeyPress", shortcut => {
      this.runShortcut(shortcut);
      this.logShortcutEvent(shortcut.shortcutType, 'hotkey');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "runShortcut", shortcut => {
      const token = this.cursorToken;
      const filterTokens = this.filterTokens;
      const {
        shortcutType,
        canRunShortcut
      } = shortcut;

      if (canRunShortcut(token, this.filterTokens.length)) {
        switch (shortcutType) {
          case _types__WEBPACK_IMPORTED_MODULE_35__.ShortcutType.Delete:
            {
              this.deleteToken();
              break;
            }

          case _types__WEBPACK_IMPORTED_MODULE_35__.ShortcutType.Negate:
            {
              this.negateToken();
              break;
            }

          case _types__WEBPACK_IMPORTED_MODULE_35__.ShortcutType.Next:
            {
              this.moveToNextToken(filterTokens);
              break;
            }

          case _types__WEBPACK_IMPORTED_MODULE_35__.ShortcutType.Previous:
            {
              this.moveToNextToken(filterTokens.reverse());
              break;
            }

          default:
            break;
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmit", evt => {
      evt.preventDefault();
      this.doSearch();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "clearSearch", () => {
      this.setState(makeQueryState(''), () => {
        this.close();
        (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(this.props.onSearch, this.state.query);
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "close", () => {
      this.setState({
        showDropdown: false
      });
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(this.props.onClose, this.state.query);
      document.removeEventListener('pointerup', this.onBackgroundPointerUp);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "open", () => {
      this.setState({
        showDropdown: true
      });
      document.addEventListener('pointerup', this.onBackgroundPointerUp);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onQueryFocus", () => {
      this.open();
      this.setState({
        inputHasFocus: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onQueryBlur", e => {
      this.setState({
        inputHasFocus: false
      });
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(this.props.onBlur, e.target.value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onQueryChange", evt => {
      const query = evt.target.value.replace('\n', '');
      this.setState(makeQueryState(query), this.updateAutoCompleteItems);
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(this.props.onChange, evt.target.value, evt);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onPaste", evt => {
      // Cancel paste
      evt.preventDefault(); // Get text representation of clipboard

      const text = evt.clipboardData.getData('text/plain').replace('\n', '').trim(); // Create new query

      const currentQuery = this.state.query;
      const cursorPosStart = this.searchInput.current.selectionStart;
      const cursorPosEnd = this.searchInput.current.selectionEnd;
      const textBefore = currentQuery.substring(0, cursorPosStart);
      const textAfter = currentQuery.substring(cursorPosEnd, currentQuery.length);
      const mergedText = `${textBefore}${text}${textAfter}`; // Insert text manually

      this.setState(makeQueryState(mergedText), () => {
        this.updateAutoCompleteItems(); // Update cursor position after updating text

        const newCursorPosition = cursorPosStart + text.length;
        this.searchInput.current.selectionStart = newCursorPosition;
        this.searchInput.current.selectionEnd = newCursorPosition;
      });
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(this.props.onChange, mergedText, evt);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onInputClick", () => {
      this.open();
      this.updateAutoCompleteItems();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onKeyDown", evt => {
      const {
        onKeyDown
      } = this.props;
      const {
        key
      } = evt;
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(onKeyDown, evt);
      const hasSearchGroups = this.state.searchGroups.length > 0;
      const isSelectingDropdownItems = this.state.activeSearchItem !== -1;

      if (!this.state.showDropdown && key !== 'Escape') {
        this.open();
      }

      if ((key === 'ArrowDown' || key === 'ArrowUp') && hasSearchGroups) {
        evt.preventDefault();
        const {
          flatSearchItems,
          activeSearchItem
        } = this.state;
        let searchGroups = [...this.state.searchGroups];
        const currIndex = isSelectingDropdownItems ? activeSearchItem : 0;
        const totalItems = flatSearchItems.length; // Move the selected index up/down

        const nextActiveSearchItem = key === 'ArrowUp' ? (currIndex - 1 + totalItems) % totalItems : isSelectingDropdownItems ? (currIndex + 1) % totalItems : 0; // Clear previous selection

        const prevItem = flatSearchItems[currIndex];
        searchGroups = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getSearchGroupWithItemMarkedActive)(searchGroups, prevItem, false); // Set new selection

        const activeItem = flatSearchItems[nextActiveSearchItem];
        searchGroups = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getSearchGroupWithItemMarkedActive)(searchGroups, activeItem, true);
        this.setState({
          searchGroups,
          activeSearchItem: nextActiveSearchItem
        });
      }

      if ((key === 'Tab' || key === 'Enter') && isSelectingDropdownItems && hasSearchGroups) {
        evt.preventDefault();
        const {
          activeSearchItem,
          flatSearchItems
        } = this.state;
        const item = flatSearchItems[activeSearchItem];

        if (item) {
          if (item.callback) {
            item.callback();
          } else {
            var _item$value;

            this.onAutoComplete((_item$value = item.value) !== null && _item$value !== void 0 ? _item$value : '', item);
          }
        }

        return;
      } // If not selecting an item, allow tab to exit search and close the dropdown


      if (key === 'Tab' && !isSelectingDropdownItems) {
        this.close();
        return;
      }

      if (key === 'Enter' && !isSelectingDropdownItems) {
        this.doSearch();
        return;
      }

      const cursorToken = this.cursorToken;

      if (key === '[' && (cursorToken === null || cursorToken === void 0 ? void 0 : cursorToken.type) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter && cursorToken.value.text.length === 0 && (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(cursorToken.value, this.cursorPosition)) {
        const {
          query
        } = this.state;
        evt.preventDefault();
        let clauseStart = null;
        let clauseEnd = null; // the new text that will exist between clauseStart and clauseEnd

        const replaceToken = '[]';
        const location = cursorToken.value.location;
        const keyLocation = cursorToken.key.location; // Include everything after the ':'

        clauseStart = keyLocation.end.offset + 1;
        clauseEnd = location.end.offset + 1;
        const beforeClause = query.substring(0, clauseStart);
        let endClause = query.substring(clauseEnd); // Add space before next clause if it exists

        if (endClause) {
          endClause = ` ${endClause}`;
        }

        const newQuery = `${beforeClause}${replaceToken}${endClause}`; // Place cursor between inserted brackets

        this.updateQuery(newQuery, beforeClause.length + replaceToken.length - 1);
        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onKeyUp", evt => {
      if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        this.updateAutoCompleteItems();
      } // Other keys are managed at onKeyDown function


      if (evt.key !== 'Escape') {
        return;
      }

      evt.preventDefault();

      if (!this.state.showDropdown) {
        this.blur();
        return;
      }

      const {
        flatSearchItems,
        activeSearchItem
      } = this.state;
      const isSelectingDropdownItems = this.state.activeSearchItem > -1;
      let searchGroups = [...this.state.searchGroups];

      if (isSelectingDropdownItems) {
        searchGroups = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getSearchGroupWithItemMarkedActive)(searchGroups, flatSearchItems[activeSearchItem], false);
      }

      this.setState({
        activeSearchItem: -1,
        searchGroups
      });
      this.close();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTagValues", lodash_debounce__WEBPACK_IMPORTED_MODULE_9___default()(async (tag, query) => {
      // Strip double quotes if there are any
      query = query.replace(/"/g, '').trim();

      if (!this.props.onGetTagValues) {
        return [];
      }

      if (this.state.noValueQuery !== undefined && query.startsWith(this.state.noValueQuery)) {
        return [];
      }

      const {
        location
      } = this.props;
      const endpointParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__.normalizeDateTimeParams)(location.query);
      this.setState({
        loading: true
      });
      let values = [];

      try {
        values = await this.props.onGetTagValues(tag, query, endpointParams);
        this.setState({
          loading: false
        });
      } catch (err) {
        this.setState({
          loading: false
        });
        _sentry_react__WEBPACK_IMPORTED_MODULE_37__.captureException(err);
        return [];
      }

      if (tag.key === 'release:' && !values.includes('latest')) {
        values.unshift('latest');
      }

      const noValueQuery = values.length === 0 && query.length > 0 ? query : undefined;
      this.setState({
        noValueQuery
      });
      return values.map(value => {
        const escapedValue = escapeValue(value);
        return {
          value: escapedValue,
          desc: escapedValue,
          type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_VALUE
        };
      });
    }, sentry_constants__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_DEBOUNCE_DURATION, {
      leading: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getPredefinedTagValues", (tag, query) => {
      var _tag$values;

      return ((_tag$values = tag.values) !== null && _tag$values !== void 0 ? _tag$values : []).filter(value => value.indexOf(query) > -1).map((value, i) => {
        const escapedValue = escapeValue(value);
        return {
          value: escapedValue,
          desc: escapedValue,
          type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_VALUE,
          ignoreMaxSearchItems: tag.maxSuggestedValues ? i < tag.maxSuggestedValues : false
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getRecentSearches", lodash_debounce__WEBPACK_IMPORTED_MODULE_9___default()(async () => {
      const {
        savedSearchType,
        hasRecentSearches,
        onGetRecentSearches
      } = this.props; // `savedSearchType` can be 0

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_24__.defined)(savedSearchType) || !hasRecentSearches) {
        return [];
      }

      const fetchFn = onGetRecentSearches || this.fetchRecentSearches;
      return await fetchFn(this.state.query);
    }, sentry_constants__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_DEBOUNCE_DURATION, {
      leading: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchRecentSearches", async fullQuery => {
      const {
        api,
        organization,
        savedSearchType
      } = this.props;

      if (savedSearchType === undefined) {
        return [];
      }

      try {
        const recentSearches = await (0,sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_11__.fetchRecentSearches)(api, organization.slug, savedSearchType, fullQuery); // If `recentSearches` is undefined or not an array, the function will
        // return an array anyway

        return recentSearches.map(searches => ({
          desc: searches.query,
          value: searches.query,
          type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.RECENT_SEARCH
        }));
      } catch (e) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_37__.captureException(e);
      }

      return [];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getReleases", lodash_debounce__WEBPACK_IMPORTED_MODULE_9___default()(async (tag, query) => {
      const releasePromise = this.fetchReleases(query);
      const tags = this.getPredefinedTagValues(tag, query);
      const tagValues = tags.map(v => ({ ...v,
        type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.FIRST_RELEASE
      }));
      const releases = await releasePromise;
      const releaseValues = releases.map(r => ({
        value: r.shortVersion,
        desc: r.shortVersion,
        type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.FIRST_RELEASE
      }));
      return [...tagValues, ...releaseValues];
    }, sentry_constants__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_DEBOUNCE_DURATION, {
      leading: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchReleases", async releaseVersion => {
      const {
        api,
        location,
        organization
      } = this.props;
      const project = location && location.query ? location.query.projectId : undefined;
      const url = `/organizations/${organization.slug}/releases/`;
      const fetchQuery = {
        per_page: sentry_constants__WEBPACK_IMPORTED_MODULE_18__.MAX_AUTOCOMPLETE_RELEASES
      };

      if (releaseVersion) {
        fetchQuery.query = releaseVersion;
      }

      if (project) {
        fetchQuery.project = project;
      }

      try {
        return await api.requestPromise(url, {
          method: 'GET',
          query: fetchQuery
        });
      } catch (e) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Unable to fetch releases'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_37__.captureException(e);
      }

      return [];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "generateValueAutocompleteGroup", async (tagName, query) => {
      var _this$props$supported;

      const {
        prepareQuery,
        excludeEnvironment,
        organization,
        savedSearchType,
        searchSource
      } = this.props;
      const supportedTags = (_this$props$supported = this.props.supportedTags) !== null && _this$props$supported !== void 0 ? _this$props$supported : {};
      const preparedQuery = typeof prepareQuery === 'function' ? prepareQuery(query) : query; // filter existing items immediately, until API can return
      // with actual tag value results

      const filteredSearchGroups = !preparedQuery ? this.state.searchGroups : this.state.searchGroups.filter(item => item.value && item.value.indexOf(preparedQuery) !== -1);
      this.setState({
        searchTerm: query,
        searchGroups: filteredSearchGroups
      });
      const tag = supportedTags[tagName];

      if (!tag) {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.invalid_field', {
          organization,
          search_type: savedSearchType === 0 ? 'issues' : 'events',
          search_source: searchSource,
          attempted_field_name: tagName
        });
        return {
          searchItems: [{
            type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.INVALID_TAG,
            desc: tagName,
            callback: () => window.open('https://docs.sentry.io/product/sentry-basics/search/searchable-properties/')
          }],
          recentSearchItems: [],
          tagName,
          type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.INVALID_TAG
        };
      } // Ignore the environment tag if the feature is active and
      // excludeEnvironment = true


      if (excludeEnvironment && tagName === 'environment') {
        return null;
      }

      const fetchTagValuesFn = tag.key === 'firstRelease' ? this.getReleases : tag.predefined ? this.getPredefinedTagValues : this.getTagValues;
      const [tagValues, recentSearches] = await Promise.all([fetchTagValuesFn(tag, preparedQuery), this.getRecentSearches()]);
      return {
        searchItems: tagValues !== null && tagValues !== void 0 ? tagValues : [],
        recentSearchItems: recentSearches !== null && recentSearches !== void 0 ? recentSearches : [],
        tagName: tag.key,
        type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_VALUE
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "showDefaultSearches", async () => {
      const {
        query
      } = this.state;
      const [defaultSearchItems, defaultRecentItems] = this.props.defaultSearchItems; // Always clear searchTerm on showing default state.

      this.setState({
        searchTerm: ''
      });

      if (!defaultSearchItems.length) {
        // Update searchTerm, otherwise <SearchDropdown> will have wrong state
        // (e.g. if you delete a query, the last letter will be highlighted if `searchTerm`
        // does not get updated)
        const [tagKeys, tagType] = this.getTagKeys('');
        const recentSearches = await this.getRecentSearches();

        if (this.state.query === query) {
          this.updateAutoCompleteState(tagKeys, recentSearches !== null && recentSearches !== void 0 ? recentSearches : [], '', tagType);
        }

        return;
      }

      this.updateAutoCompleteState(defaultSearchItems, defaultRecentItems, '', _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.DEFAULT);
      return;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateAutoCompleteFromAst", async () => {
      const cursor = this.cursorPosition;
      const cursorToken = this.cursorToken;

      if (!cursorToken) {
        this.showDefaultSearches();
        return;
      }

      if (cursorToken.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter) {
        const tagName = (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.getKeyName)(cursorToken.key, {
          aggregateWithArgs: true
        }); // check if we are on the tag, value, or operator

        if ((0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(cursorToken.value, cursor)) {
          var _cursorValue$text;

          const node = cursorToken.value;
          const cursorValue = this.cursorValue;
          let searchText = (_cursorValue$text = cursorValue === null || cursorValue === void 0 ? void 0 : cursorValue.text) !== null && _cursorValue$text !== void 0 ? _cursorValue$text : node.text;

          if (searchText === '[]' || cursorValue === null) {
            searchText = '';
          }

          const fieldDefinition = (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_27__.getFieldDefinition)(tagName);
          const isDate = (fieldDefinition === null || fieldDefinition === void 0 ? void 0 : fieldDefinition.valueType) === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_27__.FieldValueType.DATE;

          if (isDate) {
            const groups = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getDateTagAutocompleteGroups)(tagName);
            this.updateAutoCompleteStateMultiHeader(groups);
            return;
          }

          const valueGroup = await this.generateValueAutocompleteGroup(tagName, searchText);
          const autocompleteGroups = valueGroup ? [valueGroup] : []; // show operator group if at beginning of value

          if (cursor === node.location.start.offset) {
            const opGroup = generateOpAutocompleteGroup((0,_utils__WEBPACK_IMPORTED_MODULE_36__.getValidOps)(cursorToken), tagName);

            if ((valueGroup === null || valueGroup === void 0 ? void 0 : valueGroup.type) !== _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.INVALID_TAG && !isDate) {
              autocompleteGroups.unshift(opGroup);
            }
          }

          if (cursor === this.cursorPosition) {
            this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
          }

          return;
        }

        if ((0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(cursorToken.key, cursor)) {
          const node = cursorToken.key;
          const autocompleteGroups = [await this.generateTagAutocompleteGroup(tagName)]; // show operator group if at end of key

          if (cursor === node.location.end.offset) {
            const opGroup = generateOpAutocompleteGroup((0,_utils__WEBPACK_IMPORTED_MODULE_36__.getValidOps)(cursorToken), tagName);
            autocompleteGroups.unshift(opGroup);
          }

          if (cursor === this.cursorPosition) {
            this.setState({
              searchTerm: tagName
            });
            this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
          }

          return;
        } // show operator autocomplete group


        const opGroup = generateOpAutocompleteGroup((0,_utils__WEBPACK_IMPORTED_MODULE_36__.getValidOps)(cursorToken), tagName);
        this.updateAutoCompleteStateMultiHeader([opGroup]);
        return;
      }

      const cursorSearchTerm = this.cursorSearchTerm;

      if (cursorToken.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.FreeText && cursorSearchTerm) {
        const autocompleteGroups = [await this.generateTagAutocompleteGroup(cursorSearchTerm.searchTerm)];

        if (cursor === this.cursorPosition) {
          this.setState({
            searchTerm: cursorSearchTerm.searchTerm
          });
          this.updateAutoCompleteStateMultiHeader(autocompleteGroups);
        }

        return;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateAutoCompleteItems", () => {
      this.updateAutoCompleteFromAst();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateAutoCompleteStateMultiHeader", groups => {
      const {
        hasRecentSearches,
        maxSearchItems,
        maxQueryLength
      } = this.props;
      const {
        query
      } = this.state;
      const queryCharsLeft = maxQueryLength && query ? maxQueryLength - query.length : undefined;
      const searchGroups = groups.map(_ref => {
        let {
          searchItems,
          recentSearchItems,
          tagName,
          type
        } = _ref;
        return (0,_utils__WEBPACK_IMPORTED_MODULE_36__.createSearchGroups)(searchItems, hasRecentSearches ? recentSearchItems : undefined, tagName, type, maxSearchItems, queryCharsLeft, false);
      }).reduce((acc, item) => ({
        searchGroups: [...acc.searchGroups, ...item.searchGroups],
        flatSearchItems: [...acc.flatSearchItems, ...item.flatSearchItems],
        activeSearchItem: -1
      }), {
        searchGroups: [],
        flatSearchItems: [],
        activeSearchItem: -1
      });
      this.setState(searchGroups);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateQuery", (newQuery, cursorPosition) => this.setState(makeQueryState(newQuery), () => {
      var _this$props$onChange, _this$props;

      // setting a new input value will lose focus; restore it
      if (this.searchInput.current) {
        this.searchInput.current.focus();

        if (cursorPosition) {
          this.searchInput.current.selectionStart = cursorPosition;
          this.searchInput.current.selectionEnd = cursorPosition;
        }
      } // then update the autocomplete box with new items


      this.updateAutoCompleteItems();
      (_this$props$onChange = (_this$props = this.props).onChange) === null || _this$props$onChange === void 0 ? void 0 : _this$props$onChange.call(_this$props, newQuery, new MouseEvent('click'));
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAutoCompleteFromAst", (replaceText, item) => {
      const cursor = this.cursorPosition;
      const {
        query
      } = this.state;
      const cursorToken = this.cursorToken;

      if (!cursorToken) {
        this.updateQuery(`${query}${replaceText}`);
        return;
      } // the start and end of what to replace


      let clauseStart = null;
      let clauseEnd = null; // the new text that will exist between clauseStart and clauseEnd

      let replaceToken = replaceText;

      if (cursorToken.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter) {
        if (item.type === _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_OPERATOR) {
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.operator_autocompleted', {
            organization: this.props.organization,
            query: (0,_utils__WEBPACK_IMPORTED_MODULE_36__.removeSpace)(query),
            search_operator: replaceText,
            search_type: this.props.savedSearchType === 0 ? 'issues' : 'events'
          });
          const valueLocation = cursorToken.value.location;
          clauseStart = cursorToken.location.start.offset;
          clauseEnd = valueLocation.start.offset;

          if (replaceText === '!:') {
            replaceToken = `!${cursorToken.key.text}:`;
          } else {
            replaceToken = `${cursorToken.key.text}${replaceText}`;
          }
        } else if ((0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(cursorToken.value, cursor)) {
          var _this$cursorValue;

          const valueToken = (_this$cursorValue = this.cursorValue) !== null && _this$cursorValue !== void 0 ? _this$cursorValue : cursorToken.value;
          const location = valueToken.location;

          if (cursorToken.filter === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.FilterType.TextIn) {
            // Current value can be null when adding a 2nd value
            //             ▼ cursor
            // key:[value1, ]
            const currentValueNull = this.cursorValue === null;
            clauseStart = currentValueNull ? this.cursorPosition : valueToken.location.start.offset;
            clauseEnd = currentValueNull ? this.cursorPosition : valueToken.location.end.offset;
          } else {
            const keyLocation = cursorToken.key.location;
            clauseStart = keyLocation.end.offset + 1;
            clauseEnd = location.end.offset + 1; // The user tag often contains : within its value and we need to quote it.

            if ((0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.getKeyName)(cursorToken.key) === 'user') {
              replaceToken = `"${replaceText.trim()}"`;
            } // handle using autocomplete with key:[]


            if (valueToken.text === '[]') {
              clauseStart += 1;
              clauseEnd -= 2; // For ISO date values, we want to keep the cursor within the token
            } else if (item.type !== _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_VALUE_ISO_DATE) {
              replaceToken += ' ';
            }
          }
        } else if ((0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(cursorToken.key, cursor)) {
          const location = cursorToken.key.location;
          clauseStart = location.start.offset; // If the token is a key, then trim off the end to avoid duplicate ':'

          clauseEnd = location.end.offset + 1;
        }
      }

      const cursorSearchTerm = this.cursorSearchTerm;

      if (cursorToken.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.FreeText && cursorSearchTerm) {
        clauseStart = cursorSearchTerm.start;
        clauseEnd = cursorSearchTerm.end;
      }

      if (clauseStart !== null && clauseEnd !== null) {
        const beforeClause = query.substring(0, clauseStart);
        const endClause = query.substring(clauseEnd); // Adds a space between the replaceToken and endClause when necessary

        const replaceTokenEndClauseJoiner = !endClause || endClause.startsWith(' ') || replaceToken.endsWith(' ') || replaceToken.endsWith(':') ? '' : ' ';
        const newQuery = `${beforeClause}${replaceToken}${replaceTokenEndClauseJoiner}${endClause}`;
        this.updateQuery(newQuery, beforeClause.length + replaceToken.length);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAutoComplete", (replaceText, item) => {
      if (item.type === _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.RECENT_SEARCH) {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.searched', {
          organization: this.props.organization,
          query: replaceText,
          search_type: this.props.savedSearchType === 0 ? 'issues' : 'events',
          search_source: 'recent_search'
        });
        this.setState(makeQueryState(replaceText), () => {
          // Propagate onSearch and save to recent searches
          this.doSearch();
        });
        return;
      }

      this.onAutoCompleteFromAst(replaceText, item);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onAutoCompleteIsoDate", isoDate => {
      var _this$cursorFilter, _this$cursorFilter2, _this$cursorFilter3;

      const dateItem = {
        type: _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_VALUE_ISO_DATE
      };

      if (((_this$cursorFilter = this.cursorFilter) === null || _this$cursorFilter === void 0 ? void 0 : _this$cursorFilter.filter) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.FilterType.Date || ((_this$cursorFilter2 = this.cursorFilter) === null || _this$cursorFilter2 === void 0 ? void 0 : _this$cursorFilter2.filter) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.FilterType.SpecificDate) {
        this.onAutoCompleteFromAst(`${this.cursorFilter.operator}${isoDate}`, dateItem);
      } else if (((_this$cursorFilter3 = this.cursorFilter) === null || _this$cursorFilter3 === void 0 ? void 0 : _this$cursorFilter3.filter) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.FilterType.Text) {
        const valueText = this.cursorFilter.value.text;

        if (valueText && (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isOperator)(valueText)) {
          this.onAutoCompleteFromAst(`${valueText}${isoDate}`, dateItem);
        }
      }
    });
  }

  componentDidMount() {
    if (!window.ResizeObserver) {
      return;
    }

    if (this.containerRef.current === null) {
      return;
    }

    this.inputResizeObserver = new ResizeObserver(this.updateActionsVisible);
    this.inputResizeObserver.observe(this.containerRef.current);
  }

  componentDidUpdate(prevProps) {
    const {
      query
    } = this.props;
    const {
      query: lastQuery
    } = prevProps;

    if (query !== lastQuery && ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_24__.defined)(query) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_24__.defined)(lastQuery))) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(makeQueryState((0,_utils__WEBPACK_IMPORTED_MODULE_36__.addSpace)(query !== null && query !== void 0 ? query : undefined)));
    }
  }

  componentWillUnmount() {
    var _this$inputResizeObse;

    (_this$inputResizeObse = this.inputResizeObserver) === null || _this$inputResizeObse === void 0 ? void 0 : _this$inputResizeObse.disconnect();
    document.removeEventListener('pointerup', this.onBackgroundPointerUp);
  }

  get initialQuery() {
    const {
      query,
      defaultQuery
    } = this.props;
    return query !== null ? (0,_utils__WEBPACK_IMPORTED_MODULE_36__.addSpace)(query) : defaultQuery !== null && defaultQuery !== void 0 ? defaultQuery : '';
  }
  /**
   * Ref to the search element itself
   */


  blur() {
    if (!this.searchInput.current) {
      return;
    }

    this.searchInput.current.blur();
    this.close();
  }

  async doSearch() {
    this.blur();
    const query = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.removeSpace)(this.state.query);
    const {
      organization,
      savedSearchType,
      searchSource
    } = this.props;

    if (!this.hasValidSearch) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.search_with_invalid', {
        organization,
        query,
        search_type: savedSearchType === 0 ? 'issues' : 'events',
        search_source: searchSource
      });
      return;
    }

    const {
      onSearch,
      onSavedRecentSearch,
      api
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_25__["default"])('search.searched', {
      organization,
      query,
      search_type: savedSearchType === 0 ? 'issues' : 'events',
      search_source: searchSource
    });
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_26__.callIfFunction)(onSearch, query); // Only save recent search query if we have a savedSearchType (also 0 is a valid value)
    // Do not save empty string queries (i.e. if they clear search)

    if (typeof savedSearchType === 'undefined' || !query) {
      return;
    }

    try {
      await (0,sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_11__.saveRecentSearch)(api, organization.slug, savedSearchType, query);

      if (onSavedRecentSearch) {
        onSavedRecentSearch(query);
      }
    } catch (err) {
      // Silently capture errors if it fails to save
      _sentry_react__WEBPACK_IMPORTED_MODULE_37__.captureException(err);
    }
  }

  /**
   * Check if any filters are invalid within the search query
   */
  get hasValidSearch() {
    const {
      parsedQuery
    } = this.state; // If we fail to parse be optimistic that it's valid

    if (parsedQuery === null) {
      return true;
    }

    return (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.treeResultLocator)({
      tree: parsedQuery,
      noResultValue: true,
      visitorTest: _ref2 => {
        let {
          token,
          returnResult,
          skipToken
        } = _ref2;
        return token.type !== sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter ? null : token.invalid ? returnResult(false) : skipToken;
      }
    });
  }
  /**
   * Get the active filter or free text actively focused.
   */


  get cursorToken() {
    const matchedTokens = [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter, sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.FreeText];
    return this.findTokensAtCursor(matchedTokens);
  }
  /**
   * Get the active parsed text value
   */


  get cursorValue() {
    const matchedTokens = [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.ValueText];
    return this.findTokensAtCursor(matchedTokens);
  }
  /**
   * Get the active filter
   */


  get cursorFilter() {
    const matchedTokens = [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter];
    return this.findTokensAtCursor(matchedTokens);
  }

  get cursorValueIsoDate() {
    const matchedTokens = [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.ValueIso8601Date];
    return this.findTokensAtCursor(matchedTokens);
  }

  get cursorValueRelativeDate() {
    const matchedTokens = [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.ValueRelativeDate];
    return this.findTokensAtCursor(matchedTokens);
  }

  get currentFieldDefinition() {
    if (!this.cursorToken || this.cursorToken.type !== sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter) {
      return null;
    }

    const tagName = (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.getKeyName)(this.cursorToken.key, {
      aggregateWithArgs: true
    });
    return (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_27__.getFieldDefinition)(tagName);
  }
  /**
   * Determines when the date picker should be shown instead of normal dropdown options.
   * This should return true when the cursor is within a date tag value and the user has
   * typed in an operator (or already has a date value).
   */


  get shouldShowDatePicker() {
    var _this$currentFieldDef, _this$cursorFilter$va, _this$cursorFilter4, _this$cursorFilter4$v, _this$cursorFilter5;

    if (!this.state.showDropdown || !this.cursorToken || ((_this$currentFieldDef = this.currentFieldDefinition) === null || _this$currentFieldDef === void 0 ? void 0 : _this$currentFieldDef.valueType) !== sentry_utils_fields__WEBPACK_IMPORTED_MODULE_27__.FieldValueType.DATE || this.cursorValueRelativeDate || !(this.cursorToken.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter && (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(this.cursorToken.value, this.cursorPosition))) {
      return false;
    }

    const textValue = (_this$cursorFilter$va = (_this$cursorFilter4 = this.cursorFilter) === null || _this$cursorFilter4 === void 0 ? void 0 : (_this$cursorFilter4$v = _this$cursorFilter4.value) === null || _this$cursorFilter4$v === void 0 ? void 0 : _this$cursorFilter4$v.text) !== null && _this$cursorFilter$va !== void 0 ? _this$cursorFilter$va : '';

    if ( // Cursor is in a valid ISO date value
    this.cursorValueIsoDate || // Cursor is in a value that has an operator
    (_this$cursorFilter5 = this.cursorFilter) !== null && _this$cursorFilter5 !== void 0 && _this$cursorFilter5.operator || // Cursor is in raw text value that matches one of the non-empty operators
    textValue && (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isOperator)(textValue)) {
      return true;
    }

    return false;
  }

  get shouldShowAutocomplete() {
    return this.state.showDropdown && !this.shouldShowDatePicker;
  }
  /**
   * Get the current cursor position within the input
   */


  get cursorPosition() {
    var _this$searchInput$cur;

    if (!this.searchInput.current) {
      return -1;
    }

    return (_this$searchInput$cur = this.searchInput.current.selectionStart) !== null && _this$searchInput$cur !== void 0 ? _this$searchInput$cur : -1;
  }
  /**
   * Get the search term at the current cursor position
   */


  get cursorSearchTerm() {
    const cursorPosition = this.cursorPosition;
    const cursorToken = this.cursorToken;

    if (!cursorToken) {
      return null;
    }

    const LIMITER_CHARS = [' ', ':'];
    const innerStart = cursorPosition - cursorToken.location.start.offset;
    let tokenStart = innerStart;

    while (tokenStart > 0 && !LIMITER_CHARS.includes(cursorToken.text[tokenStart - 1])) {
      tokenStart--;
    }

    let tokenEnd = innerStart;

    while (tokenEnd < cursorToken.text.length && !LIMITER_CHARS.includes(cursorToken.text[tokenEnd])) {
      tokenEnd++;
    }

    let searchTerm = cursorToken.text.slice(tokenStart, tokenEnd);

    if (searchTerm.startsWith(sentry_constants__WEBPACK_IMPORTED_MODULE_18__.NEGATION_OPERATOR)) {
      tokenStart++;
    }

    searchTerm = searchTerm.replace(new RegExp(`^${sentry_constants__WEBPACK_IMPORTED_MODULE_18__.NEGATION_OPERATOR}`), '');
    return {
      end: cursorToken.location.start.offset + tokenEnd,
      searchTerm,
      start: cursorToken.location.start.offset + tokenStart
    };
  }

  get filterTokens() {
    var _this$state$parsedQue, _this$state$parsedQue2;

    return (_this$state$parsedQue = (_this$state$parsedQue2 = this.state.parsedQuery) === null || _this$state$parsedQue2 === void 0 ? void 0 : _this$state$parsedQue2.filter(tok => tok.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_15__.Token.Filter)) !== null && _this$state$parsedQue !== void 0 ? _this$state$parsedQue : [];
  }
  /**
   * Finds tokens that exist at the current cursor position
   * @param matchedTokens acceptable list of tokens
   */


  findTokensAtCursor(matchedTokens) {
    const {
      parsedQuery
    } = this.state;

    if (parsedQuery === null) {
      return null;
    }

    const cursor = this.cursorPosition;
    return (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.treeResultLocator)({
      tree: parsedQuery,
      noResultValue: null,
      visitorTest: _ref3 => {
        let {
          token,
          returnResult,
          skipToken
        } = _ref3;
        return !matchedTokens.includes(token.type) ? null : (0,sentry_components_searchSyntax_utils__WEBPACK_IMPORTED_MODULE_17__.isWithinToken)(token, cursor) ? returnResult(token) : skipToken;
      }
    });
  }
  /**
   * Returns array of possible key values that substring match `query`
   */


  getTagKeys(searchTerm) {
    var _this$props$supported2;

    const {
      prepareQuery,
      supportedTagType
    } = this.props;
    const supportedTags = (_this$props$supported2 = this.props.supportedTags) !== null && _this$props$supported2 !== void 0 ? _this$props$supported2 : {};
    let tagKeys = Object.keys(supportedTags).sort((a, b) => a.localeCompare(b));

    if (searchTerm) {
      const preparedSearchTerm = prepareQuery ? prepareQuery(searchTerm) : searchTerm;
      tagKeys = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.filterKeysFromQuery)(tagKeys, preparedSearchTerm);
    } // If the environment feature is active and excludeEnvironment = true
    // then remove the environment key


    if (this.props.excludeEnvironment) {
      tagKeys = tagKeys.filter(key => key !== 'environment');
    }

    const tagItems = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getTagItemsFromKeys)(tagKeys, supportedTags);
    return [tagItems, supportedTagType !== null && supportedTagType !== void 0 ? supportedTagType : _types__WEBPACK_IMPORTED_MODULE_35__.ItemType.TAG_KEY];
  }
  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */


  async generateTagAutocompleteGroup(tagName) {
    const [tagKeys, tagType] = this.getTagKeys(tagName);
    const recentSearches = await this.getRecentSearches();
    return {
      searchItems: tagKeys,
      recentSearchItems: recentSearches !== null && recentSearches !== void 0 ? recentSearches : [],
      tagName,
      type: tagType
    };
  }

  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param searchItems List of search item objects with keys: title, desc, value
   * @param recentSearchItems List of recent search items, same format as searchItem
   * @param tagName The current tag name in scope
   * @param type Defines the type/state of the dropdown menu items
   */
  updateAutoCompleteState(searchItems, recentSearchItems, tagName, type) {
    const {
      hasRecentSearches,
      maxSearchItems,
      maxQueryLength
    } = this.props;
    const {
      query
    } = this.state;
    const queryCharsLeft = maxQueryLength && query ? maxQueryLength - query.length : undefined;
    const searchGroups = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.createSearchGroups)(searchItems, hasRecentSearches ? recentSearchItems : undefined, tagName, type, maxSearchItems, queryCharsLeft, true);
    this.setState(searchGroups);
  }
  /**
   * Updates autocomplete dropdown items and autocomplete index state
   *
   * @param groups Groups that will be used to populate the autocomplete dropdown
   */


  get showSearchDropdown() {
    return this.state.loading || this.state.searchGroups.length > 0;
  }

  render() {
    var _this$cursorValueIsoD, _this$cursorValueIsoD2;

    const {
      api,
      className,
      savedSearchType,
      dropdownClassName,
      actionBarItems,
      organization,
      placeholder,
      disabled,
      useFormWrapper,
      inlineLabel,
      maxQueryLength,
      maxMenuHeight
    } = this.props;
    const {
      query,
      parsedQuery,
      searchGroups,
      searchTerm,
      inputHasFocus,
      numActionsVisible,
      loading
    } = this.state;

    const input = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(SearchInput, {
      type: "text",
      placeholder: placeholder,
      id: "smart-search-input",
      "data-test-id": "smart-search-input",
      name: "query",
      ref: this.searchInput,
      autoComplete: "off",
      value: query,
      onFocus: this.onQueryFocus,
      onBlur: this.onQueryBlur,
      onKeyUp: this.onKeyUp,
      onKeyDown: this.onKeyDown,
      onChange: this.onQueryChange,
      onClick: this.onInputClick,
      onPaste: this.onPaste,
      disabled: disabled,
      maxLength: maxQueryLength,
      spellCheck: false
    }); // Segment actions into visible and overflowed groups


    const actionItems = actionBarItems !== null && actionBarItems !== void 0 ? actionBarItems : [];
    const actionProps = {
      api,
      organization,
      query,
      savedSearchType
    };
    const visibleActions = actionItems.slice(0, numActionsVisible).map(_ref4 => {
      let {
        key,
        Action
      } = _ref4;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(Action, { ...actionProps
      }, key);
    });
    const overflowedActions = actionItems.slice(numActionsVisible).map(_ref5 => {
      let {
        key,
        Action
      } = _ref5;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(Action, { ...actionProps,
        menuItemVariant: true
      }, key);
    });
    const cursor = this.cursorPosition;
    const visibleShortcuts = _utils__WEBPACK_IMPORTED_MODULE_36__.shortcuts.filter(shortcut => shortcut.hotkeys && shortcut.canRunShortcut(this.cursorToken, this.filterTokens.length));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsxs)(Container, {
      ref: this.containerRef,
      className: className,
      inputHasFocus: inputHasFocus,
      "data-test-id": "smart-search-bar",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(_searchHotkeysListener__WEBPACK_IMPORTED_MODULE_34__["default"], {
        visibleShortcuts: visibleShortcuts,
        runShortcut: this.runShortcutOnHotkeyPress
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsxs)(SearchLabel, {
        htmlFor: "smart-search-input",
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Search events'),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconSearch, {}), inlineLabel]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsxs)(InputWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(Highlight, {
          children: parsedQuery !== null ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_16__["default"], {
            parsedQuery: parsedQuery,
            cursorPosition: this.state.showDropdown ? cursor : -1
          }) : query
        }), useFormWrapper ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)("form", {
          onSubmit: this.onSubmit,
          children: input
        }) : input]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsxs)(ActionsBar, {
        gap: 0.5,
        children: [query !== '' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_31__.ActionButton, {
          onClick: this.clearSearch,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconClose, {
            size: "xs"
          }),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Clear search'),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Clear search')
        }), visibleActions, overflowedActions.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_13__["default"], {
          anchorRight: true,
          caret: false,
          title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_31__.ActionButton, {
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Show more'),
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(VerticalEllipsisIcon, {
              size: "xs"
            })
          }),
          children: overflowedActions
        })]
      }), this.shouldShowDatePicker && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(_searchBarDatePicker__WEBPACK_IMPORTED_MODULE_32__["default"], {
        date: (_this$cursorValueIsoD = this.cursorValueIsoDate) === null || _this$cursorValueIsoD === void 0 ? void 0 : _this$cursorValueIsoD.value,
        dateString: (_this$cursorValueIsoD2 = this.cursorValueIsoDate) === null || _this$cursorValueIsoD2 === void 0 ? void 0 : _this$cursorValueIsoD2.text,
        handleSelectDateTime: value => {
          this.onAutoCompleteIsoDate(value);
        }
      }), this.shouldShowAutocomplete && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(_searchDropdown__WEBPACK_IMPORTED_MODULE_33__["default"], {
        className: dropdownClassName,
        items: searchGroups,
        onClick: this.onAutoComplete,
        loading: loading,
        searchSubstring: searchTerm,
        runShortcut: this.runShortcutOnClick,
        visibleShortcuts: visibleShortcuts,
        maxMenuHeight: maxMenuHeight
      })]
    });
  }

}

SmartSearchBar.displayName = "SmartSearchBar";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SmartSearchBar, "defaultProps", {
  defaultQuery: '',
  query: null,
  onSearch: function () {},
  excludeEnvironment: false,
  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Search for events, users, tags, and more'),
  supportedTags: {},
  defaultSearchItems: [[], []],
  useFormWrapper: true,
  savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_23__.SavedSearchType.ISSUE
});

class SmartSearchBarContainer extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      members: sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_21__["default"].getAll()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_21__["default"].listen(members => this.setState({
      members
    }), undefined));
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    // SmartSearchBar doesn't use members, but we forward it to cause a re-render.
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_38__.jsx)(SmartSearchBar, { ...this.props,
      members: this.state.members
    });
  }

}

SmartSearchBarContainer.displayName = "SmartSearchBarContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_7__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_30__["default"])(SmartSearchBarContainer))));


const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e683cn6"
} : 0)("border:1px solid ", p => p.theme.border, ";box-shadow:inset ", p => p.theme.dropShadowLight, ";background:", p => p.theme.background, ";padding:7px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";position:relative;display:grid;grid-template-columns:max-content 1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";align-items:start;border-radius:", p => p.theme.borderRadius, ";.show-sidebar &{background:", p => p.theme.backgroundSecondary, ";}", p => p.inputHasFocus && `
    border-color: ${p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p.theme.focusBorder};
  `, ";" + ( true ? "" : 0));

const SearchLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('label',  true ? {
  target: "e1e683cn5"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5), " 0;margin:0;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const InputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e683cn4"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const Highlight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e683cn3"
} : 0)("position:absolute;top:0;left:0;right:0;bottom:0;user-select:none;white-space:pre-wrap;word-break:break-word;line-height:25px;font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.familyMono, ";" + ( true ? "" : 0));

const SearchInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])((0,sentry_utils_getDynamicComponent__WEBPACK_IMPORTED_MODULE_28__["default"])({
  value: react_autosize_textarea__WEBPACK_IMPORTED_MODULE_6__["default"],
  fixed: 'textarea'
}),  true ? {
  shouldForwardProp: prop => typeof prop === 'string' && (0,_emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_8__["default"])(prop),
  target: "e1e683cn2"
} : 0)("position:relative;display:flex;resize:none;outline:none;border:0;width:100%;padding:0;line-height:25px;margin-bottom:-1px;background:transparent;font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.familyMono, ";caret-color:", p => p.theme.subText, ";color:transparent;&::selection{background:rgba(0, 0, 0, 0.2);}&::placeholder{color:", p => p.theme.formPlaceholder, ";}[disabled]{color:", p => p.theme.disabled, ";}" + ( true ? "" : 0));

const ActionsBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e1e683cn1"
} : 0)("height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5), " 0;" + ( true ? "" : 0));

const VerticalEllipsisIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconEllipsis,  true ? {
  target: "e1e683cn0"
} : 0)( true ? {
  name: "jbgpyq",
  styles: "transform:rotate(90deg)"
} : 0);

/***/ }),

/***/ "./app/components/smartSearchBar/searchBarDatePicker.tsx":
/*!***************************************************************!*\
  !*** ./app/components/smartSearchBar/searchBarDatePicker.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var date_fns_format__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! date-fns/format */ "../node_modules/date-fns/format/index.js");
/* harmony import */ var date_fns_format__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(date_fns_format__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var _calendar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../calendar */ "./app/components/calendar/index.tsx");
/* harmony import */ var _checkbox__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var _searchBarFlyout__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./searchBarFlyout */ "./app/components/smartSearchBar/searchBarFlyout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const TZ_OFFSET_REGEX = /[+-]\d\d:\d\d$/;
const TIME_REGEX = /T\d\d:\d\d:\d\d/;
const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const ISO_FORMAT_WITH_TIMEZONE = ISO_FORMAT + 'xxx';

const isUtcIsoDate = isoDateTime => {
  if (!isoDateTime) {
    return false;
  }

  return !TZ_OFFSET_REGEX.test(isoDateTime);
};

const applyChanges = _ref => {
  let {
    date = new Date(),
    timeString = sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.DEFAULT_DAY_START_TIME,
    handleSelectDateTime,
    utc = false
  } = _ref;
  const newDate = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.setDateToTime)(date, timeString, {
    local: true
  });
  handleSelectDateTime(date_fns_format__WEBPACK_IMPORTED_MODULE_10___default()(newDate, utc ? ISO_FORMAT : ISO_FORMAT_WITH_TIMEZONE));
};

const parseIncomingDateString = incomingDateString => {
  if (!incomingDateString) {
    return undefined;
  } // For consistent date parsing, remove timezone from the incoming date string


  const strippedTimeZone = incomingDateString.replace(TZ_OFFSET_REGEX, '').replace(/Z$/, '');

  if (TIME_REGEX.test(incomingDateString)) {
    return new Date(strippedTimeZone);
  }

  return new Date(strippedTimeZone + 'T00:00:00');
};

const SearchBarDatePicker = _ref2 => {
  let {
    dateString,
    handleSelectDateTime
  } = _ref2;
  const incomingDate = parseIncomingDateString(dateString);
  const time = incomingDate ? date_fns_format__WEBPACK_IMPORTED_MODULE_10___default()(incomingDate, 'HH:mm:ss') : sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.DEFAULT_DAY_START_TIME;
  const utc = isUtcIsoDate(dateString);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_searchBarFlyout__WEBPACK_IMPORTED_MODULE_9__["default"], {
    onMouseDown: e => e.stopPropagation(),
    "data-test-id": "search-bar-date-picker",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_calendar__WEBPACK_IMPORTED_MODULE_7__.DatePicker, {
      date: incomingDate,
      onChange: newDate => {
        if (newDate instanceof Date) {
          applyChanges({
            date: newDate,
            timeString: time,
            utc,
            handleSelectDateTime
          });
        }
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(DatePickerFooter, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(TimeInput, {
        time: time,
        setTime: newTime => {
          applyChanges({
            date: incomingDate,
            timeString: newTime,
            utc,
            handleSelectDateTime
          });
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(UtcPickerLabel, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Use UTC'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_checkbox__WEBPACK_IMPORTED_MODULE_8__["default"], {
          onChange: e => {
            applyChanges({
              date: incomingDate,
              timeString: time,
              utc: e.target.checked,
              handleSelectDateTime
            });
          },
          checked: utc
        })]
      })]
    })]
  });
};

SearchBarDatePicker.displayName = "SearchBarDatePicker";

/**
 * This component keeps track of its own state because updates bring focus
 * back to the search bar. We make sure to keep focus within the input
 * until the user is done making changes.
 */
const TimeInput = _ref3 => {
  let {
    time,
    setTime
  } = _ref3;
  const [localTime, setLocalTime] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(time);
  const [isFocused, setIsFocused] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const timeInputRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    setLocalTime(time);
  }, [time]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Input, {
    ref: timeInputRef,
    "aria-label": "Time",
    type: "time",
    "data-test-id": "search-bar-date-picker-time-input",
    onChange: e => {
      const newStartTime = e.target.value || sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.DEFAULT_DAY_START_TIME;
      setLocalTime(newStartTime);

      if (!isFocused) {
        setTime(newStartTime);
      }
    },
    onBlur: () => {
      setIsFocused(false);
      setTime(localTime);
    },
    onFocus: () => setIsFocused(true),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        var _timeInputRef$current;

        (_timeInputRef$current = timeInputRef.current) === null || _timeInputRef$current === void 0 ? void 0 : _timeInputRef$current.blur();
      }
    },
    onClick: e => {
      e.stopPropagation();
    },
    value: localTime,
    step: 1
  });
};

TimeInput.displayName = "TimeInput";

const Input = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('input',  true ? {
  target: "e1t1gacb2"
} : 0)("border-radius:4px;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";background:", p => p.theme.backgroundSecondary, ";border:1px solid ", p => p.theme.border, ";color:", p => p.theme.gray300, ";box-shadow:none;" + ( true ? "" : 0));

const DatePickerFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1t1gacb1"
} : 0)("display:flex;align-items:center;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), ";" + ( true ? "" : 0));

const UtcPickerLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e1t1gacb0"
} : 0)("color:", p => p.theme.gray300, ";white-space:nowrap;display:flex;align-items:center;justify-content:flex-end;margin:0;font-weight:normal;user-select:none;cursor:pointer;input{margin:0 0 0 0.5em;cursor:pointer;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchBarDatePicker);

/***/ }),

/***/ "./app/components/smartSearchBar/searchBarFlyout.tsx":
/*!***********************************************************!*\
  !*** ./app/components/smartSearchBar/searchBarFlyout.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");



const SearchBarFlyout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11318qo0"
} : 0)("position:absolute;top:100%;left:-1px;", p => p.fullWidth ? 'right: -1px' : '', ";z-index:", p => p.theme.zIndex.dropdown, ";overflow:hidden;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";background:", p => p.theme.background, ";box-shadow:", p => p.theme.dropShadowHeavy, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchBarFlyout);

/***/ }),

/***/ "./app/components/smartSearchBar/searchDropdown.tsx":
/*!**********************************************************!*\
  !*** ./app/components/smartSearchBar/searchDropdown.tsx ***!
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
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_17___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_17__);
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/searchSyntax/renderer */ "./app/components/searchSyntax/renderer.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../button */ "./app/components/button.tsx");
/* harmony import */ var _hotkeysLabel__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../hotkeysLabel */ "./app/components/hotkeysLabel.tsx");
/* harmony import */ var _tag__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../tag */ "./app/components/tag.tsx");
/* harmony import */ var _searchBarFlyout__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./searchBarFlyout */ "./app/components/smartSearchBar/searchBarFlyout.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./types */ "./app/components/smartSearchBar/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const getDropdownItemKey = item => `${item.value || item.desc || item.title}-${item.children && item.children.length > 0 ? getDropdownItemKey(item.children[0]) : ''}`;

class SearchDropdown extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  render() {
    const {
      className,
      loading,
      items,
      runShortcut,
      visibleShortcuts,
      maxMenuHeight,
      searchSubstring,
      onClick,
      onIconClick
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(_searchBarFlyout__WEBPACK_IMPORTED_MODULE_14__["default"], {
      className: className,
      fullWidth: true,
      children: [loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(LoadingWrapper, {
        "data-test-id": "search-autocomplete-loading",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {
          mini: true
        })
      }, "loading") : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SearchItemsList, {
        maxMenuHeight: maxMenuHeight,
        children: items.map(item => {
          const isEmpty = item.children && !item.children.length; // Hide header if `item.children` is defined, an array, and is empty

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [item.type === 'header' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HeaderItem, {
              group: item
            }), item.children && item.children.map(child => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DropdownItem, {
              item: child,
              searchSubstring: searchSubstring,
              onClick: onClick,
              onIconClick: onIconClick
            }, getDropdownItemKey(child))), isEmpty && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Info, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No items found')
            })]
          }, item.title);
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(DropdownFooter, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ShortcutsRow, {
          children: runShortcut && (visibleShortcuts === null || visibleShortcuts === void 0 ? void 0 : visibleShortcuts.map(shortcut => {
            var _ref, _shortcut$hotkeys$dis, _shortcut$hotkeys, _shortcut$hotkeys2;

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(ShortcutButtonContainer, {
              onClick: () => runShortcut(shortcut),
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HotkeyGlyphWrapper, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_hotkeysLabel__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  value: (_ref = (_shortcut$hotkeys$dis = (_shortcut$hotkeys = shortcut.hotkeys) === null || _shortcut$hotkeys === void 0 ? void 0 : _shortcut$hotkeys.display) !== null && _shortcut$hotkeys$dis !== void 0 ? _shortcut$hotkeys$dis : (_shortcut$hotkeys2 = shortcut.hotkeys) === null || _shortcut$hotkeys2 === void 0 ? void 0 : _shortcut$hotkeys2.actual) !== null && _ref !== void 0 ? _ref : []
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(IconWrapper, {
                children: shortcut.icon
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HotkeyTitle, {
                children: shortcut.text
              })]
            }, shortcut.text);
          }))
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
          size: "xs",
          href: "https://docs.sentry.io/product/sentry-basics/search/",
          children: "Read the docs"
        })]
      })]
    });
  }

}

SearchDropdown.displayName = "SearchDropdown";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SearchDropdown, "defaultProps", {
  searchSubstring: '',
  onClick: function () {}
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchDropdown);

const HeaderItem = _ref2 => {
  let {
    group
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SearchDropdownGroup, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SearchDropdownGroupTitle, {
      children: [group.icon, group.title && group.title, group.desc && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
        children: group.desc
      })]
    })
  }, group.title);
};

HeaderItem.displayName = "HeaderItem";

const HighlightedRestOfWords = _ref3 => {
  let {
    combinedRestWords,
    searchSubstring,
    firstWord,
    isFirstWordHidden,
    hasSplit
  } = _ref3;
  const remainingSubstr = searchSubstring.indexOf(firstWord) === -1 ? searchSubstring : searchSubstring.slice(firstWord.length + 1);
  const descIdx = combinedRestWords.indexOf(remainingSubstr);

  if (descIdx > -1) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(RestOfWordsContainer, {
      isFirstWordHidden: isFirstWordHidden,
      hasSplit: hasSplit,
      children: [".", combinedRestWords.slice(0, descIdx), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
        children: combinedRestWords.slice(descIdx, descIdx + remainingSubstr.length)
      }), combinedRestWords.slice(descIdx + remainingSubstr.length)]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(RestOfWordsContainer, {
    isFirstWordHidden: isFirstWordHidden,
    hasSplit: hasSplit,
    children: [".", combinedRestWords]
  });
};

HighlightedRestOfWords.displayName = "HighlightedRestOfWords";

const ItemTitle = _ref4 => {
  let {
    item,
    searchSubstring,
    isChild
  } = _ref4;

  if (!item.title) {
    return null;
  }

  const fullWord = item.title;
  const words = item.kind !== sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FUNCTION ? fullWord.split('.') : [fullWord];
  const [firstWord, ...restWords] = words;
  const isFirstWordHidden = isChild;
  const combinedRestWords = restWords.length > 0 ? restWords.join('.') : null;
  const hasSingleField = item.type === _types__WEBPACK_IMPORTED_MODULE_15__.ItemType.LINK;

  if (searchSubstring) {
    const idx = restWords.length === 0 ? fullWord.toLowerCase().indexOf(searchSubstring.split('.')[0]) : fullWord.toLowerCase().indexOf(searchSubstring); // Below is the logic to make the current query bold inside the result.

    if (idx !== -1) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SearchItemTitleWrapper, {
        hasSingleField: hasSingleField,
        children: [!isFirstWordHidden && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(FirstWordWrapper, {
          children: [firstWord.slice(0, idx), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
            children: firstWord.slice(idx, idx + searchSubstring.length)
          }), firstWord.slice(idx + searchSubstring.length)]
        }), combinedRestWords && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HighlightedRestOfWords, {
          firstWord: firstWord,
          isFirstWordHidden: isFirstWordHidden,
          searchSubstring: searchSubstring,
          combinedRestWords: combinedRestWords,
          hasSplit: words.length > 1
        })]
      });
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SearchItemTitleWrapper, {
    children: [!isFirstWordHidden && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FirstWordWrapper, {
      children: firstWord
    }), combinedRestWords && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(RestOfWordsContainer, {
      isFirstWordHidden: isFirstWordHidden,
      hasSplit: words.length > 1,
      children: [".", combinedRestWords]
    })]
  });
};

ItemTitle.displayName = "ItemTitle";

const KindTag = _ref5 => {
  let {
    kind,
    deprecated
  } = _ref5;
  let text, tagType;

  switch (kind) {
    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FUNCTION:
      text = 'f(x)';
      tagType = 'success';
      break;

    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.MEASUREMENT:
      text = 'field';
      tagType = 'highlight';
      break;

    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.BREAKDOWN:
      text = 'field';
      tagType = 'highlight';
      break;

    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.TAG:
      text = kind;
      tagType = 'warning';
      break;

    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.NUMERIC_METRICS:
      text = 'f(x)';
      tagType = 'success';
      break;

    case sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FIELD:
    default:
      text = kind;
  }

  if (deprecated) {
    text = 'deprecated';
    tagType = 'error';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_tag__WEBPACK_IMPORTED_MODULE_13__["default"], {
    type: tagType,
    children: text
  });
};

KindTag.displayName = "KindTag";

const DropdownItem = _ref6 => {
  var _item$callback, _item$children;

  let {
    item,
    isChild,
    searchSubstring,
    onClick,
    onIconClick
  } = _ref6;
  const isDisabled = item.value === null;
  let children;

  if (item.type === _types__WEBPACK_IMPORTED_MODULE_15__.ItemType.RECENT_SEARCH) {
    children = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(QueryItem, {
      item: item
    });
  } else if (item.type === _types__WEBPACK_IMPORTED_MODULE_15__.ItemType.INVALID_TAG) {
    children = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Invalid, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)("The field [field] isn't supported here. ", {
        field: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
          children: item.desc
        })
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[highlight:See all searchable properties in the docs.]', {
        highlight: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Highlight, {})
      })]
    });
  } else if (item.type === _types__WEBPACK_IMPORTED_MODULE_15__.ItemType.LINK) {
    children = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ItemTitle, {
        item: item,
        isChild: isChild,
        searchSubstring: searchSubstring
      }), onIconClick && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconOpen, {
        onClick: e => {
          // stop propagation so the item-level onClick doesn't get called
          e.stopPropagation();
          onIconClick(item.value);
        }
      })]
    });
  } else {
    children = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ItemTitle, {
        item: item,
        isChild: isChild,
        searchSubstring: searchSubstring
      }), item.desc && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Value, {
        hasDocs: !!item.documentation,
        children: item.desc
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DropdownDocumentation, {
        documentation: item.documentation,
        searchSubstring: searchSubstring
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TagWrapper, {
        children: item.kind && !isChild && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(KindTag, {
          kind: item.kind,
          deprecated: item.deprecated
        })
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SearchListItem, {
      className: `${isChild ? 'group-child' : ''} ${item.active ? 'active' : ''}`,
      "data-test-id": "search-autocomplete-item",
      onClick: !isDisabled ? (_item$callback = item.callback) !== null && _item$callback !== void 0 ? _item$callback : onClick.bind(undefined, item.value, item) : undefined,
      ref: element => {
        var _element$scrollIntoVi;

        return item.active && (element === null || element === void 0 ? void 0 : (_element$scrollIntoVi = element.scrollIntoView) === null || _element$scrollIntoVi === void 0 ? void 0 : _element$scrollIntoVi.call(element, {
          block: 'nearest'
        }));
      },
      isGrouped: isChild,
      isDisabled: isDisabled,
      children: children
    }), !isChild && ((_item$children = item.children) === null || _item$children === void 0 ? void 0 : _item$children.map(child => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DropdownItem, {
      item: child,
      onClick: onClick,
      searchSubstring: searchSubstring,
      isChild: true
    }, getDropdownItemKey(child))))]
  });
};

DropdownItem.displayName = "DropdownItem";

const DropdownDocumentation = _ref7 => {
  let {
    documentation,
    searchSubstring
  } = _ref7;

  if (documentation && typeof documentation === 'string') {
    var _documentation$toLoca;

    const startIndex = (_documentation$toLoca = documentation.toLocaleLowerCase().indexOf(searchSubstring.toLocaleLowerCase())) !== null && _documentation$toLoca !== void 0 ? _documentation$toLoca : -1;

    if (startIndex !== -1) {
      const endIndex = startIndex + searchSubstring.length;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Documentation, {
        children: [documentation.slice(0, startIndex), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("strong", {
          children: documentation.slice(startIndex, endIndex)
        }), documentation.slice(endIndex)]
      });
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Documentation, {
    children: documentation
  });
};

DropdownDocumentation.displayName = "DropdownDocumentation";

const QueryItem = _ref8 => {
  let {
    item
  } = _ref8;

  if (!item.value) {
    return null;
  }

  const parsedQuery = (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_5__.parseSearch)(item.value);

  if (!parsedQuery) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(QueryItemWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_6__["default"], {
      parsedQuery: parsedQuery
    })
  });
};

QueryItem.displayName = "QueryItem";

const LoadingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7s74sr21"
} : 0)("display:flex;justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const Info = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7s74sr20"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";font-size:", p => p.theme.fontSizeLarge, ";color:", p => p.theme.gray300, ";&:not(:last-child){border-bottom:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const ListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  target: "e7s74sr19"
} : 0)("&:not(:first-child):not(.group-child){border-top:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

const SearchDropdownGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ListItem,  true ? {
  target: "e7s74sr18"
} : 0)( true ? "" : 0);

const SearchDropdownGroupTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('header',  true ? {
  target: "e7s74sr17"
} : 0)("display:flex;align-items:center;background-color:", p => p.theme.backgroundSecondary, ";color:", p => p.theme.gray300, ";font-weight:normal;font-size:", p => p.theme.fontSizeMedium, ";margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";&>svg{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";}" + ( true ? "" : 0));

const SearchItemsList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('ul',  true ? {
  target: "e7s74sr16"
} : 0)("padding-left:0;list-style:none;margin-bottom:0;", p => {
  if (p.maxMenuHeight !== undefined) {
    return `
        max-height: ${p.maxMenuHeight}px;
        overflow-y: scroll;
      `;
  }

  return `
      height: auto;
    `;
}, ";" + ( true ? "" : 0));

const SearchListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ListItem,  true ? {
  target: "e7s74sr15"
} : 0)("scroll-margin:40px 0;font-size:", p => p.theme.fontSizeLarge, ";padding:4px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";min-height:", p => p.isGrouped ? '30px' : '36px', ";", p => {
  if (!p.isDisabled) {
    return `
        cursor: pointer;

        &:hover,
        &.active {
          background: ${p.theme.hover};
        }
      `;
  }

  return '';
}, " display:flex;flex-direction:row;justify-content:space-between;align-items:center;width:100%;" + ( true ? "" : 0));

const SearchItemTitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7s74sr14"
} : 0)("display:flex;flex-grow:1;flex-shrink:0;max-width:", p => p.hasSingleField ? '75%' : 'min(280px, 50%)', ";color:", p => p.theme.textColor, ";font-weight:normal;font-size:", p => p.theme.fontSizeMedium, ";margin:0;line-height:", p => p.theme.text.lineHeightHeading, ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const RestOfWordsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr13"
} : 0)("color:", p => p.hasSplit ? p.theme.blue400 : p.theme.textColor, ";margin-left:", p => p.isFirstWordHidden ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1) : '0px', ";" + ( true ? "" : 0));

const FirstWordWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr12"
} : 0)( true ? {
  name: "1lkgjg0",
  styles: "font-weight:medium"
} : 0);

const TagWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr11"
} : 0)( true ? {
  name: "mb06ny",
  styles: "width:5%;display:flex;flex-direction:row;align-items:center;justify-content:flex-end"
} : 0);

const Documentation = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr10"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";font-family:", p => p.theme.text.family, ";color:", p => p.theme.gray300, ";display:flex;flex:2;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";white-space:pre;@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

const DropdownFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(`div`,  true ? {
  target: "e7s74sr9"
} : 0)("width:100%;min-height:45px;background-color:", p => p.theme.backgroundSecondary, ";border-top:1px solid ", p => p.theme.innerBorder, ";flex-direction:row;display:flex;align-items:center;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";flex-wrap:wrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const ShortcutsRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7s74sr8"
} : 0)( true ? {
  name: "12zklrs",
  styles: "flex-direction:row;display:flex;align-items:center"
} : 0);

const ShortcutButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7s74sr7"
} : 0)("display:flex;flex-direction:row;align-items:center;height:auto;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), ";cursor:pointer;:hover{border-radius:", p => p.theme.borderRadius, ";background-color:", p => color__WEBPACK_IMPORTED_MODULE_17___default()(p.theme.hover).darken(0.02).string(), ";}" + ( true ? "" : 0));

const HotkeyGlyphWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr6"
} : 0)("color:", p => p.theme.gray300, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr5"
} : 0)("display:none;@media (max-width: ", p => p.theme.breakpoints.small, "){display:flex;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";align-items:center;justify-content:center;}" + ( true ? "" : 0));

const HotkeyTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(`span`,  true ? {
  target: "e7s74sr4"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Invalid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(`span`,  true ? {
  target: "e7s74sr3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.family, ";color:", p => p.theme.gray400, ";display:flex;flex-direction:row;flex-wrap:wrap;span{white-space:pre;}" + ( true ? "" : 0));

const Highlight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(`strong`,  true ? {
  target: "e7s74sr2"
} : 0)("color:", p => p.theme.linkColor, ";" + ( true ? "" : 0));

const QueryItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr1"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";width:100%;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";display:flex;white-space:nowrap;word-break:normal;font-family:", p => p.theme.text.familyMono, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7s74sr0"
} : 0)("font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeSmall, ";max-width:", p => p.hasDocs ? '280px' : 'none', ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/smartSearchBar/searchHotkeysListener.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/smartSearchBar/searchHotkeysListener.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_useHotkeys__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useHotkeys */ "./app/utils/useHotkeys.tsx");


const SearchHotkeysListener = _ref => {
  let {
    visibleShortcuts,
    runShortcut
  } = _ref;
  (0,sentry_utils_useHotkeys__WEBPACK_IMPORTED_MODULE_0__.useHotkeys)(visibleShortcuts.filter(shortcut => typeof shortcut.hotkeys !== 'undefined').map(shortcut => {
    var _shortcut$hotkeys$act, _shortcut$hotkeys;

    return {
      match: (_shortcut$hotkeys$act = (_shortcut$hotkeys = shortcut.hotkeys) === null || _shortcut$hotkeys === void 0 ? void 0 : _shortcut$hotkeys.actual) !== null && _shortcut$hotkeys$act !== void 0 ? _shortcut$hotkeys$act : [],
      callback: e => {
        e.preventDefault();
        runShortcut(shortcut);
      }
    };
  }), [visibleShortcuts]);
  return null;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchHotkeysListener);

/***/ }),

/***/ "./app/components/smartSearchBar/types.tsx":
/*!*************************************************!*\
  !*** ./app/components/smartSearchBar/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ItemType": () => (/* binding */ ItemType),
/* harmony export */   "ShortcutType": () => (/* binding */ ShortcutType)
/* harmony export */ });
let ItemType;

(function (ItemType) {
  ItemType["DEFAULT"] = "default";
  ItemType["TAG_KEY"] = "tag-key";
  ItemType["TAG_VALUE"] = "tag-value";
  ItemType["TAG_VALUE_ISO_DATE"] = "tag-value-iso-date";
  ItemType["TAG_OPERATOR"] = "tag-operator";
  ItemType["FIRST_RELEASE"] = "first-release";
  ItemType["INVALID_TAG"] = "invalid-tag";
  ItemType["RECENT_SEARCH"] = "recent-search";
  ItemType["PROPERTY"] = "property";
  ItemType["LINK"] = "link";
})(ItemType || (ItemType = {}));

let ShortcutType;

(function (ShortcutType) {
  ShortcutType["Delete"] = "delete";
  ShortcutType["Negate"] = "negate";
  ShortcutType["Next"] = "next";
  ShortcutType["Previous"] = "previous";
})(ShortcutType || (ShortcutType = {}));

/***/ }),

/***/ "./app/components/smartSearchBar/utils.tsx":
/*!*************************************************!*\
  !*** ./app/components/smartSearchBar/utils.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addSpace": () => (/* binding */ addSpace),
/* harmony export */   "createSearchGroups": () => (/* binding */ createSearchGroups),
/* harmony export */   "filterKeysFromQuery": () => (/* binding */ filterKeysFromQuery),
/* harmony export */   "generateOperatorEntryMap": () => (/* binding */ generateOperatorEntryMap),
/* harmony export */   "getDateTagAutocompleteGroups": () => (/* binding */ getDateTagAutocompleteGroups),
/* harmony export */   "getLastTermIndex": () => (/* binding */ getLastTermIndex),
/* harmony export */   "getQueryTerms": () => (/* binding */ getQueryTerms),
/* harmony export */   "getSearchGroupWithItemMarkedActive": () => (/* binding */ getSearchGroupWithItemMarkedActive),
/* harmony export */   "getTagItemsFromKeys": () => (/* binding */ getTagItemsFromKeys),
/* harmony export */   "getValidOps": () => (/* binding */ getValidOps),
/* harmony export */   "removeSpace": () => (/* binding */ removeSpace),
/* harmony export */   "shortcuts": () => (/* binding */ shortcuts)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.at.js */ "../node_modules/core-js/modules/es.array.at.js");
/* harmony import */ var core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_at_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.at-alternative.js */ "../node_modules/core-js/modules/es.string.at-alternative.js");
/* harmony import */ var core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_at_alternative_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace-all.js */ "../node_modules/core-js/modules/es.string.replace-all.js");
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./types */ "./app/components/smartSearchBar/types.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






// eslint-disable-next-line simple-import-sort/imports






function addSpace() {
  let query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  if (query.length !== 0 && query[query.length - 1] !== ' ') {
    return query + ' ';
  }

  return query;
}
function removeSpace() {
  let query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  if (query[query.length - 1] === ' ') {
    return query.slice(0, query.length - 1);
  }

  return query;
}
/**
 * Given a query, and the current cursor position, return the string-delimiting
 * index of the search term designated by the cursor.
 */

function getLastTermIndex(query, cursor) {
  // TODO: work with quoted-terms
  const cursorOffset = query.slice(cursor).search(/\s|$/);
  return cursor + (cursorOffset === -1 ? 0 : cursorOffset);
}
/**
 * Returns an array of query terms, including incomplete terms
 *
 * e.g. ["is:unassigned", "browser:\"Chrome 33.0\"", "assigned"]
 */

function getQueryTerms(query, cursor) {
  return query.slice(0, cursor).match(/\S+:"[^"]*"?|\S+/g);
}

function getTitleForType(type) {
  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Values');
  }

  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.RECENT_SEARCH) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Recent Searches');
  }

  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.DEFAULT) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Common Search Terms');
  }

  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Operator Helpers');
  }

  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.PROPERTY) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Properties');
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Keys');
}

function getIconForTypeAndTag(type, tagName) {
  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.RECENT_SEARCH) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClock, {
      size: "xs"
    });
  }

  if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.DEFAULT) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconStar, {
      size: "xs"
    });
  } // Change based on tagName and default to "icon-tag"


  switch (tagName) {
    case 'is':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconToggle, {
        size: "xs"
      });

    case 'assigned':
    case 'bookmarks':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconUser, {
        size: "xs"
      });

    case 'firstSeen':
    case 'lastSeen':
    case 'event.timestamp':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClock, {
        size: "xs"
      });

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconTag, {
        size: "xs"
      });
  }
}

const filterSearchItems = (searchItems, recentSearchItems, maxSearchItems, queryCharsLeft) => {
  if (maxSearchItems && maxSearchItems > 0) {
    searchItems = searchItems.filter((value, index) => index < maxSearchItems || value.ignoreMaxSearchItems);
  }

  if (queryCharsLeft || queryCharsLeft === 0) {
    searchItems = searchItems.flatMap(item => {
      if (!item.children) {
        if (!item.value || item.value.length <= queryCharsLeft) {
          return [item];
        }

        return [];
      }

      const newItem = { ...item,
        children: item.children.filter(child => !child.value || child.value.length <= queryCharsLeft)
      };

      if (newItem.children.length === 0) {
        return [];
      }

      return [newItem];
    });
    searchItems = searchItems.filter(value => !value.value || value.value.length <= queryCharsLeft);

    if (recentSearchItems) {
      recentSearchItems = recentSearchItems.filter(value => !value.value || value.value.length <= queryCharsLeft);
    }
  }

  return {
    searchItems,
    recentSearchItems
  };
};

function createSearchGroups(searchItems, recentSearchItems, tagName, type, maxSearchItems, queryCharsLeft, isDefaultState) {
  const fieldDefinition = (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.getFieldDefinition)(tagName);
  const activeSearchItem = 0;
  const {
    searchItems: filteredSearchItems,
    recentSearchItems: filteredRecentSearchItems
  } = filterSearchItems(searchItems, recentSearchItems, maxSearchItems, queryCharsLeft);
  const searchGroup = {
    title: getTitleForType(type),
    type: type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.INVALID_TAG ? type : 'header',
    icon: getIconForTypeAndTag(type, tagName),
    children: [...filteredSearchItems]
  };
  const recentSearchGroup = filteredRecentSearchItems && filteredRecentSearchItems.length > 0 ? {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Recent Searches'),
    type: 'header',
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClock, {
      size: "xs"
    }),
    children: [...filteredRecentSearchItems]
  } : undefined;

  if (searchGroup.children && !!searchGroup.children.length) {
    searchGroup.children[activeSearchItem] = { ...searchGroup.children[activeSearchItem]
    };
  }

  const flatSearchItems = filteredSearchItems.flatMap(item => {
    if (item.children) {
      if (!item.value) {
        return [...item.children];
      }

      return [item, ...item.children];
    }

    return [item];
  });

  if ((fieldDefinition === null || fieldDefinition === void 0 ? void 0 : fieldDefinition.valueType) === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldValueType.DATE) {
    if (type === _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR) {
      return {
        searchGroups: [],
        flatSearchItems: [],
        activeSearchItem: -1
      };
    }
  }

  if (isDefaultState) {
    // Recent searches first in default state.
    return {
      searchGroups: [...(recentSearchGroup ? [recentSearchGroup] : []), searchGroup],
      flatSearchItems: [...(recentSearchItems ? recentSearchItems : []), ...flatSearchItems],
      activeSearchItem: -1
    };
  }

  return {
    searchGroups: [searchGroup, ...(recentSearchGroup ? [recentSearchGroup] : [])],
    flatSearchItems: [...flatSearchItems, ...(recentSearchItems ? recentSearchItems : [])],
    activeSearchItem: -1
  };
}
function generateOperatorEntryMap(tag) {
  return {
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.Default]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('[value]')}`,
      documentation: 'is equal to'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.GreaterThanEqual]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':>=',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('>=[value]')}`,
      documentation: 'is greater than or equal to'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.LessThanEqual]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':<=',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('<=[value]')}`,
      documentation: 'is less than or equal to'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.GreaterThan]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':>',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('>[value]')}`,
      documentation: 'is greater than'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.LessThan]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':<',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('<[value]')}`,
      documentation: 'is less than'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.Equal]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: ':=',
      desc: `${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('=[value]')}`,
      documentation: 'is equal to'
    },
    [sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.TermOperator.NotEqual]: {
      type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_OPERATOR,
      value: '!:',
      desc: `!${tag}:${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('[value]')}`,
      documentation: 'is not equal to'
    }
  };
}
function getValidOps(filterToken) {
  var _filterToken$invalid$, _filterToken$invalid;

  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = (_filterToken$invalid$ = (_filterToken$invalid = filterToken.invalid) === null || _filterToken$invalid === void 0 ? void 0 : _filterToken$invalid.expectedType) !== null && _filterToken$invalid$ !== void 0 ? _filterToken$invalid$ : [filterToken.filter]; // Determine any interchangeable filter types for our valid types

  const interchangeableTypes = validTypes.map(type => {
    var _interchangeableFilte;

    return (_interchangeableFilte = sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.interchangeableFilterOperators[type]) !== null && _interchangeableFilte !== void 0 ? _interchangeableFilte : [];
  }); // Combine all types

  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])]; // Find all valid operations

  const validOps = new Set(allValidTypes.map(type => sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.filterTypeConfig[type].validOps).flat());
  return [...validOps];
}
const shortcuts = [{
  text: 'Delete',
  shortcutType: _types__WEBPACK_IMPORTED_MODULE_9__.ShortcutType.Delete,
  hotkeys: {
    actual: 'ctrl+option+backspace'
  },
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconDelete, {
    size: "xs",
    color: "gray300"
  }),
  canRunShortcut: token => {
    return (token === null || token === void 0 ? void 0 : token.type) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.Token.Filter;
  }
}, {
  text: 'Exclude',
  shortcutType: _types__WEBPACK_IMPORTED_MODULE_9__.ShortcutType.Negate,
  hotkeys: {
    actual: 'ctrl+option+1'
  },
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconExclamation, {
    size: "xs",
    color: "gray300"
  }),
  canRunShortcut: token => {
    return (token === null || token === void 0 ? void 0 : token.type) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.Token.Filter && !token.negated;
  }
}, {
  text: 'Include',
  shortcutType: _types__WEBPACK_IMPORTED_MODULE_9__.ShortcutType.Negate,
  hotkeys: {
    actual: 'ctrl+option+1'
  },
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconExclamation, {
    size: "xs",
    color: "gray300"
  }),
  canRunShortcut: token => {
    return (token === null || token === void 0 ? void 0 : token.type) === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.Token.Filter && token.negated;
  }
}, {
  text: 'Previous',
  shortcutType: _types__WEBPACK_IMPORTED_MODULE_9__.ShortcutType.Previous,
  hotkeys: {
    actual: 'ctrl+option+left'
  },
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconArrow, {
    direction: "left",
    size: "xs",
    color: "gray300"
  }),
  canRunShortcut: (token, count) => {
    return count > 1 || count > 0 && (token === null || token === void 0 ? void 0 : token.type) !== sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.Token.Filter;
  }
}, {
  text: 'Next',
  shortcutType: _types__WEBPACK_IMPORTED_MODULE_9__.ShortcutType.Next,
  hotkeys: {
    actual: 'ctrl+option+right'
  },
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconArrow, {
    direction: "right",
    size: "xs",
    color: "gray300"
  }),
  canRunShortcut: (token, count) => {
    return count > 1 || count > 0 && (token === null || token === void 0 ? void 0 : token.type) !== sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_6__.Token.Filter;
  }
}];

const getItemTitle = (key, kind) => {
  if (kind === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FUNCTION) {
    // Replace the function innards with ... for cleanliness
    return key.replace(/\(.*\)/g, '(...)');
  }

  return key;
};
/**
 * Groups tag keys based on the "." character in their key.
 * For example, "device.arch" and "device.name" will be grouped together as children of "device", a non-interactive parent.
 * The parent will become interactive if there exists a key "device".
 */


const getTagItemsFromKeys = (tagKeys, supportedTags) => {
  return [...tagKeys].reduce((groups, key) => {
    var _supportedTags$key, _ref, _supportedTags$key$ki, _supportedTags$key2, _definition$desc;

    const keyWithColon = `${key}:`;
    const sections = key.split('.');
    const definition = ((_supportedTags$key = supportedTags[key]) === null || _supportedTags$key === void 0 ? void 0 : _supportedTags$key.kind) === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FUNCTION ? (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.getFieldDefinition)(key.split('(')[0]) : (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.getFieldDefinition)(key);
    const kind = (_ref = (_supportedTags$key$ki = (_supportedTags$key2 = supportedTags[key]) === null || _supportedTags$key2 === void 0 ? void 0 : _supportedTags$key2.kind) !== null && _supportedTags$key$ki !== void 0 ? _supportedTags$key$ki : definition === null || definition === void 0 ? void 0 : definition.kind) !== null && _ref !== void 0 ? _ref : sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FIELD;
    const item = {
      value: keyWithColon,
      title: getItemTitle(key, kind),
      documentation: (_definition$desc = definition === null || definition === void 0 ? void 0 : definition.desc) !== null && _definition$desc !== void 0 ? _definition$desc : '-',
      kind,
      deprecated: definition === null || definition === void 0 ? void 0 : definition.deprecated
    };
    const lastGroup = groups.at(-1);
    const [title] = sections;

    if (kind !== sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.FieldKind.FUNCTION && lastGroup) {
      if (lastGroup.children && lastGroup.title === title) {
        lastGroup.children.push(item);
        return groups;
      }

      if (lastGroup.title && lastGroup.title.split('.')[0] === title) {
        if (lastGroup.title === title) {
          return [...groups.slice(0, -1), {
            title,
            value: lastGroup.value,
            documentation: lastGroup.documentation,
            kind: lastGroup.kind,
            children: [item]
          }];
        } // Add a blank parent if the last group's full key is not the same as the title


        return [...groups.slice(0, -1), {
          title,
          value: null,
          documentation: '-',
          kind: lastGroup.kind,
          children: [lastGroup, item]
        }];
      }
    }

    return [...groups, item];
  }, []);
};
/**
 * Sets an item as active within a search group array and returns new search groups without mutating.
 * the item is compared via value, so this function assumes that each value is unique.
 */

const getSearchGroupWithItemMarkedActive = (searchGroups, currentItem, active) => {
  return searchGroups.map(group => {
    var _group$children;

    return { ...group,
      children: (_group$children = group.children) === null || _group$children === void 0 ? void 0 : _group$children.map(item => {
        if (item.value === currentItem.value) {
          return { ...item,
            active
          };
        }

        if (item.children && item.children.length > 0) {
          return { ...item,
            children: item.children.map(child => {
              if (child.value === currentItem.value) {
                return { ...child,
                  active
                };
              }

              return child;
            })
          };
        }

        return item;
      })
    };
  });
};
/**
 * Filter tag keys based on the query and the key, description, and associated keywords of each tag.
 */

const filterKeysFromQuery = (tagKeys, searchTerm) => tagKeys.flatMap(key => {
  var _definition$keywords;

  const keyWithoutFunctionPart = key.replaceAll(/\(.*\)/g, '');
  const definition = (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.getFieldDefinition)(keyWithoutFunctionPart);
  const lowerCasedSearchTerm = searchTerm.toLocaleLowerCase();
  const combinedKeywords = [...(definition !== null && definition !== void 0 && definition.desc ? [definition.desc] : []), ...((_definition$keywords = definition === null || definition === void 0 ? void 0 : definition.keywords) !== null && _definition$keywords !== void 0 ? _definition$keywords : [])].join(' ').toLocaleLowerCase();
  const matchedInKey = keyWithoutFunctionPart.includes(lowerCasedSearchTerm);
  const matchedInKeywords = combinedKeywords.includes(lowerCasedSearchTerm);

  if (!matchedInKey && !matchedInKeywords) {
    return [];
  }

  return [{
    matchedInKey,
    matchedInKeywords,
    key
  }];
}).sort((a, b) => {
  // Sort by matched in key first, then by matched in keywords
  if (a.matchedInKey && !b.matchedInKey) {
    return -1;
  }

  if (b.matchedInKey && !a.matchedInKey) {
    return 1;
  }

  return a.key < b.key ? -1 : 1;
}).map(_ref2 => {
  let {
    key
  } = _ref2;
  return key;
});
const DATE_SUGGESTED_VALUES = [{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last hour'),
  value: '-1h',
  desc: '-1h',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 24 hours'),
  value: '-24h',
  desc: '-24h',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 7 days'),
  value: '-7d',
  desc: '-7d',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 14 days'),
  value: '-14d',
  desc: '-14d',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Last 30 days'),
  value: '-30d',
  desc: '-30d',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('After a custom datetime'),
  value: '>',
  desc: '>YYYY-MM-DDThh:mm:ss',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE_ISO_DATE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Before a custom datetime'),
  value: '<',
  desc: '<YYYY-MM-DDThh:mm:ss',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE_ISO_DATE
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('At a custom datetime'),
  value: '=',
  desc: '=YYYY-MM-DDThh:mm:ss',
  type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE_ISO_DATE
}];
const getDateTagAutocompleteGroups = tagName => {
  return [{
    searchItems: DATE_SUGGESTED_VALUES,
    recentSearchItems: [],
    tagName,
    type: _types__WEBPACK_IMPORTED_MODULE_9__.ItemType.TAG_VALUE
  }];
};

/***/ }),

/***/ "./app/components/textOverflow.tsx":
/*!*****************************************!*\
  !*** ./app/components/textOverflow.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const TextOverflow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    children,
    className,
    ellipsisDirection,
    isParagraph,
    ['data-test-id']: dataTestId
  } = _ref;
  const Component = isParagraph ? 'p' : 'div';

  if (ellipsisDirection === 'left') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Component, {
      className: className,
      "data-test-id": dataTestId,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("bdi", {
        children: children
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Component, {
    className: className,
    "data-test-id": dataTestId,
    children: children
  });
},  true ? {
  target: "eyxbn6j0"
} : 0)(p => p.theme.overflowEllipsis, " ", p => p.ellipsisDirection === 'left' && `
      direction: rtl;
      text-align: left;
    `, ";width:auto;line-height:1.2;" + ( true ? "" : 0));

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TextOverflow);

/***/ }),

/***/ "./app/stores/alertStore.tsx":
/*!***********************************!*\
  !*** ./app/stores/alertStore.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");



const storeConfig = {
  alerts: [],
  count: 0,

  init() {
    this.alerts = [];
    this.count = 0;
  },

  addAlert(alert) {
    const alertAlreadyExists = this.alerts.some(a => a.id === alert.id);

    if (alertAlreadyExists && alert.noDuplicates) {
      return;
    }

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(alert.id)) {
      const mutedData = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].getItem('alerts:muted');

      if (typeof mutedData === 'string' && mutedData.length) {
        const expirations = JSON.parse(mutedData); // Remove any objects that have passed their mute duration.

        const now = Math.floor(new Date().valueOf() / 1000);

        for (const key in expirations) {
          if (expirations.hasOwnProperty(key) && expirations[key] < now) {
            delete expirations[key];
          }
        }

        sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].setItem('alerts:muted', JSON.stringify(expirations));

        if (expirations.hasOwnProperty(alert.id)) {
          return;
        }
      }
    } else {
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(alert.expireAfter)) {
        alert.expireAfter = 5000;
      }
    }

    if (alert.expireAfter && !alert.neverExpire) {
      window.setTimeout(() => {
        this.closeAlert(alert);
      }, alert.expireAfter);
    }

    alert.key = this.count++; // intentionally recreate array via concat because of Reflux
    // "bug" where React components are given same reference to tracked
    // data objects, and don't *see* that values have changed

    this.alerts = this.alerts.concat([alert]);
    this.trigger(this.alerts);
  },

  closeAlert(alert) {
    let duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 60 * 60 * 7 * 24;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(alert.id) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(duration)) {
      const expiry = Math.floor(new Date().valueOf() / 1000) + duration;
      const mutedData = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].getItem('alerts:muted');
      let expirations = {};

      if (typeof mutedData === 'string' && expirations.length) {
        expirations = JSON.parse(mutedData);
      }

      expirations[alert.id] = expiry;
      sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_2__["default"].setItem('alerts:muted', JSON.stringify(expirations));
    } // TODO(dcramer): we need some animations here for closing alerts


    this.alerts = this.alerts.filter(item => alert !== item);
    this.trigger(this.alerts);
  },

  getState() {
    return this.alerts;
  }

};
const AlertStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)(storeConfig);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertStore);

/***/ }),

/***/ "./app/stores/groupStore.tsx":
/*!***********************************!*\
  !*** ./app/stores/groupStore.tsx ***!
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
/* harmony import */ var lodash_isArray__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isArray */ "../node_modules/lodash/isArray.js");
/* harmony import */ var lodash_isArray__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isArray__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/indicatorStore */ "./app/stores/indicatorStore.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");








function showAlert(msg, type) {
  sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_5__["default"].addMessage(msg, type, {
    duration: 4000
  });
}

const storeConfig = {
  pendingChanges: new Map(),
  items: [],
  statuses: {},

  init() {
    this.reset();
  },

  reset() {
    this.pendingChanges = new Map();
    this.items = [];
    this.statuses = {};
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.reset();
    const itemIds = new Set();
    items.forEach(item => {
      itemIds.add(item.id);
      this.items.push(item);
    });
    this.trigger(itemIds);
  },

  add(items) {
    if (!lodash_isArray__WEBPACK_IMPORTED_MODULE_2___default()(items)) {
      items = [items];
    }

    const itemsById = {};
    const itemIds = new Set();
    items.forEach(item => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    }); // See if any existing items are updated by this new set of items

    this.items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = { ...item,
          ...itemsById[item.id]
        };
        delete itemsById[item.id];
      }
    }); // New items

    const newItems = items.filter(item => itemsById.hasOwnProperty(item.id));
    this.items = this.items.concat(newItems);
    this.trigger(itemIds);
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  itemIdsOrAll(itemIds) {
    return itemIds === undefined ? this.getAllItemIds() : itemIds;
  },

  remove(itemIds) {
    this.items = this.items.filter(item => !(itemIds !== null && itemIds !== void 0 && itemIds.includes(item.id)));
    this.trigger(new Set(itemIds));
  },

  addStatus(id, status) {
    if (this.statuses[id] === undefined) {
      this.statuses[id] = {};
    }

    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (this.statuses[id] === undefined) {
      return;
    }

    this.statuses[id][status] = false;
  },

  hasStatus(id, status) {
    var _this$statuses$id;

    return ((_this$statuses$id = this.statuses[id]) === null || _this$statuses$id === void 0 ? void 0 : _this$statuses$id[status]) || false;
  },

  indexOfActivity(groupId, id) {
    const group = this.get(groupId);

    if (!group) {
      return -1;
    }

    for (let i = 0; i < group.activity.length; i++) {
      if (group.activity[i].id === id) {
        return i;
      }
    }

    return -1;
  },

  addActivity(id, data) {
    let index = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    const group = this.get(id);

    if (!group) {
      return;
    } // insert into beginning by default


    if (index === -1) {
      group.activity.unshift(data);
    } else {
      group.activity.splice(index, 0, data);
    }

    if (data.type === 'note') {
      group.numComments++;
    }

    this.trigger(new Set([id]));
  },

  updateActivity(groupId, id, data) {
    const group = this.get(groupId);

    if (!group) {
      return;
    }

    const index = this.indexOfActivity(groupId, id);

    if (index === -1) {
      return;
    } // Here, we want to merge the new `data` being passed in
    // into the existing `data` object. This effectively
    // allows passing in an object of only changes.


    group.activity[index].data = Object.assign(group.activity[index].data, data);
    this.trigger(new Set([group.id]));
  },

  removeActivity(groupId, id) {
    const group = this.get(groupId);

    if (!group) {
      return -1;
    }

    const index = this.indexOfActivity(group.id, id);

    if (index === -1) {
      return -1;
    }

    const activity = group.activity.splice(index, 1);

    if (activity[0].type === 'note') {
      group.numComments--;
    }

    this.trigger(new Set([group.id]));
    return index;
  },

  get(id) {
    return this.getAllItems().find(item => item.id === id);
  },

  getAllItemIds() {
    return this.items.map(item => item.id);
  },

  getAllItems() {
    // Merge pending changes into the existing group items. This gives the
    // apperance of optimistic updates
    const pendingById = {};
    this.pendingChanges.forEach(change => {
      var _pendingById$change$i;

      const existing = (_pendingById$change$i = pendingById[change.itemId]) !== null && _pendingById$change$i !== void 0 ? _pendingById$change$i : [];
      pendingById[change.itemId] = [...existing, change];
    }); // Merge pending changes into the item if it has them

    return this.items.map(item => pendingById[item.id] === undefined ? item : { ...item,
      ...pendingById[item.id].reduce((a, change) => ({ ...a,
        ...change.data
      }), {})
    });
  },

  getState() {
    return this.getAllItems();
  },

  onAssignTo(_changeId, itemId, _data) {
    this.addStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(_changeId, itemId, _error) {
    this.clearStatus(itemId, 'assignTo');
    showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to change assignee. Please try again.'), 'error');
  },

  onAssignToSuccess(_changeId, itemId, response) {
    const item = this.get(itemId);

    if (!item) {
      return;
    }

    item.assignedTo = response.assignedTo;
    this.clearStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  onDelete(_changeId, itemIds) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.addStatus(itemId, 'delete'));
    this.trigger(new Set(ids));
  },

  onDeleteError(_changeId, itemIds, _response) {
    showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to delete events. Please try again.'), 'error');

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => this.clearStatus(itemId, 'delete'));
    this.trigger(new Set(itemIds));
  },

  onDeleteSuccess(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    if (ids.length > 1) {
      showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Deleted ${ids.length} Issues`), 'success');
    } else {
      const shortId = ids.map(item => {
        var _GroupStore$get;

        return (_GroupStore$get = GroupStore.get(item)) === null || _GroupStore$get === void 0 ? void 0 : _GroupStore$get.shortId;
      }).join('');
      showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Deleted ${shortId}`), 'success');
    }

    const itemIdSet = new Set(ids);
    ids.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter(item => !itemIdSet.has(item.id));
    this.trigger(new Set(ids));
  },

  onDiscard(_changeId, itemId) {
    this.addStatus(itemId, 'discard');
    this.trigger(new Set([itemId]));
  },

  onDiscardError(_changeId, itemId, _response) {
    this.clearStatus(itemId, 'discard');
    showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to discard event. Please try again.'), 'error');
    this.trigger(new Set([itemId]));
  },

  onDiscardSuccess(_changeId, itemId, _response) {
    delete this.statuses[itemId];
    this.clearStatus(itemId, 'discard');
    this.items = this.items.filter(item => item.id !== itemId);
    showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Similar events will be filtered and discarded.'), 'success');
    this.trigger(new Set([itemId]));
  },

  onMerge(_changeId, itemIds) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.addStatus(itemId, 'merge')); // XXX(billy): Not sure if this is a bug or not but do we need to publish all itemIds?
    // Seems like we only need to publish parent id

    this.trigger(new Set(ids));
  },

  onMergeError(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.clearStatus(itemId, 'merge'));
    showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to merge events. Please try again.'), 'error');
    this.trigger(new Set(ids));
  },

  onMergeSuccess(_changeId, itemIds, response) {
    const ids = this.itemIdsOrAll(itemIds); // everything on page

    ids.forEach(itemId => this.clearStatus(itemId, 'merge')); // Remove all but parent id (items were merged into this one)

    const mergedIdSet = new Set(ids); // Looks like the `PUT /api/0/projects/:orgId/:projectId/issues/` endpoint
    // actually returns a 204, so there is no `response` body

    this.items = this.items.filter(item => !mergedIdSet.has(item.id) || response && response.merge && item.id === response.merge.parent);

    if (ids.length > 0) {
      showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)(`Merged ${ids.length} Issues`), 'success');
    }

    this.trigger(new Set(ids));
  },

  onUpdate(changeId, itemIds, data) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => {
      this.addStatus(itemId, 'update');
      this.pendingChanges.set(changeId, {
        itemId,
        data
      });
    });
    this.trigger(new Set(ids));
  },

  onUpdateError(changeId, itemIds, failSilently) {
    const ids = this.itemIdsOrAll(itemIds);
    this.pendingChanges.delete(changeId);
    ids.forEach(itemId => this.clearStatus(itemId, 'update'));

    if (!failSilently) {
      showAlert((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to update events. Please try again.'), 'error');
    }

    this.trigger(new Set(ids));
  },

  onUpdateSuccess(changeId, itemIds, response) {
    const ids = this.itemIdsOrAll(itemIds);
    this.items.forEach((item, idx) => {
      if (ids.includes(item.id)) {
        this.items[idx] = { ...item,
          ...response
        };
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.delete(changeId);
    this.trigger(new Set(ids));
  },

  onPopulateStats(itemIds, response) {
    // Organize stats by id
    const groupStatsMap = response.reduce((map, stats) => ({ ...map,
      [stats.id]: stats
    }), {});
    this.items.forEach((item, idx) => {
      if (itemIds !== null && itemIds !== void 0 && itemIds.includes(item.id)) {
        this.items[idx] = { ...item,
          ...groupStatsMap[item.id]
        };
      }
    });
    this.trigger(new Set(itemIds));
  },

  onPopulateReleases(itemId, releaseData) {
    this.items.forEach((item, idx) => {
      if (item.id === itemId) {
        this.items[idx] = { ...item,
          ...releaseData
        };
      }
    });
    this.trigger(new Set([itemId]));
  }

};
const GroupStore = (0,reflux__WEBPACK_IMPORTED_MODULE_3__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_6__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupStore);

/***/ }),

/***/ "./app/stores/memberListStore.tsx":
/*!****************************************!*\
  !*** ./app/stores/memberListStore.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


const storeConfig = {
  // listenables: MemberActions,
  loaded: false,
  state: [],

  init() {
    this.state = [];
    this.loaded = false;
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.state = items;
    this.loaded = true;
    this.trigger(this.state, 'initial');
  },

  isLoaded() {
    return this.loaded;
  },

  getById(id) {
    if (!this.state) {
      return undefined;
    }

    id = '' + id;

    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i].id === id) {
        return this.state[i];
      }
    }

    return undefined;
  },

  getByEmail(email) {
    if (!this.state) {
      return undefined;
    }

    email = email.toLowerCase();

    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i].email.toLowerCase() === email) {
        return this.state[i];
      }
    }

    return undefined;
  },

  getAll() {
    return this.state;
  }

};
const MemberListStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MemberListStore);

/***/ }),

/***/ "./app/stores/tagStore.tsx":
/*!*********************************!*\
  !*** ./app/stores/tagStore.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");




// This list is only used on issues. Events/discover
// have their own field list that exists elsewhere.
// contexts.key and contexts.value omitted on purpose.
const BUILTIN_TAGS = sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.ISSUE_FIELDS.reduce((acc, tag) => {
  acc[tag] = {
    key: tag,
    name: tag
  };
  return acc;
}, {});
const storeConfig = {
  state: {},
  unsubscribeListeners: [],

  init() {
    this.state = {};
  },

  /**
   * Gets only predefined issue attributes
   */
  getIssueAttributes() {
    // TODO(mitsuhiko): what do we do with translations here?
    const isSuggestions = ['resolved', 'unresolved', 'ignored', 'assigned', 'for_review', 'unassigned', 'linked', 'unlinked'];
    const sortedTagKeys = Object.keys(this.state).sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return {
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.IS]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.IS,
        name: 'Status',
        values: isSuggestions,
        maxSuggestedValues: isSuggestions.length,
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.HAS]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.HAS,
        name: 'Has Tag',
        values: sortedTagKeys,
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.ASSIGNED]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.ASSIGNED,
        name: 'Assigned To',
        values: [],
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.BOOKMARKS]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.BOOKMARKS,
        name: 'Bookmarked By',
        values: [],
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.LAST_SEEN]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.LAST_SEEN,
        name: 'Last Seen',
        values: [],
        predefined: false
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.FIRST_SEEN]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.FIRST_SEEN,
        name: 'First Seen',
        values: [],
        predefined: false
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.FIRST_RELEASE]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.FIRST_RELEASE,
        name: 'First Release',
        values: ['latest'],
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.EVENT_TIMESTAMP]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.EVENT_TIMESTAMP,
        name: 'Event Timestamp',
        values: [],
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.TIMES_SEEN]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.TIMES_SEEN,
        name: 'Times Seen',
        isInput: true,
        // Below values are required or else SearchBar will attempt to get values // This is required or else SearchBar will attempt to get values
        values: [],
        predefined: true
      },
      [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.ASSIGNED_OR_SUGGESTED]: {
        key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.FieldKey.ASSIGNED_OR_SUGGESTED,
        name: 'Assigned or Suggested',
        isInput: true,
        values: [],
        predefined: true
      }
    };
  },

  /**
   * Get all tags including builtin issue tags and issue attributes
   */
  getIssueTags() {
    return { ...BUILTIN_TAGS,
      ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.SEMVER_TAGS,
      // State tags should overwrite built ins.
      ...this.state,
      // We want issue attributes to overwrite any built in and state tags
      ...this.getIssueAttributes()
    };
  },

  /**
   * Get only tags loaded from the backend
   */
  getStateTags() {
    return this.getState();
  },

  getState() {
    return this.state;
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  loadTagsSuccess(data) {
    const newTags = data.reduce((acc, tag) => {
      acc[tag.key] = {
        values: [],
        ...tag
      };
      return acc;
    }, {});
    this.state = { ...this.state,
      ...newTags
    };
    this.trigger(this.state);
  }

};
const TagStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_3__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagStore);

/***/ }),

/***/ "./app/utils/discover/urls.tsx":
/*!*************************************!*\
  !*** ./app/utils/discover/urls.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "eventDetailsRoute": () => (/* binding */ eventDetailsRoute),
/* harmony export */   "eventDetailsRouteWithEventView": () => (/* binding */ eventDetailsRouteWithEventView),
/* harmony export */   "generateEventSlug": () => (/* binding */ generateEventSlug),
/* harmony export */   "getDiscoverLandingUrl": () => (/* binding */ getDiscoverLandingUrl)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Create a slug that can be used with discover details views
 * or as a reference event for event-stats requests
 */
function generateEventSlug(eventData) {
  const id = eventData.id || eventData.latest_event;
  const projectSlug = eventData.project || eventData['project.name'];
  return `${projectSlug}:${id}`;
}
/**
 * Create a URL to an event details view.
 */

function eventDetailsRoute(_ref) {
  let {
    eventSlug,
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/discover/${eventSlug}/`;
}
/**
 * Create a URL target to event details with an event view in the query string.
 */

function eventDetailsRouteWithEventView(_ref2) {
  let {
    orgSlug,
    eventSlug,
    eventView
  } = _ref2;
  const pathname = eventDetailsRoute({
    orgSlug,
    eventSlug
  });
  return {
    pathname,
    query: eventView.generateQueryStringObject()
  };
}
/**
 * Get the URL for the discover entry page which changes based on organization
 * feature flags.
 */

function getDiscoverLandingUrl(organization) {
  if (organization.features.includes('discover-query')) {
    return `/organizations/${organization.slug}/discover/queries/`;
  }

  return `/organizations/${organization.slug}/discover/results/`;
}

/***/ }),

/***/ "./app/utils/getDynamicComponent.tsx":
/*!*******************************************!*\
  !*** ./app/utils/getDynamicComponent.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getDynamicComponent)
/* harmony export */ });
/**
 * Returns a replacement component, this function is mocked in tests and will use the second argument.
 * (This only happens during tests)
 */
function getDynamicComponent(_ref) {
  let {
    value
  } = _ref;
  // Overridden with fixed in tests.
  return value;
}

/***/ }),

/***/ "./app/utils/getKeyCode.ts":
/*!*********************************!*\
  !*** ./app/utils/getKeyCode.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getKeyCode": () => (/* binding */ getKeyCode)
/* harmony export */ });
// key maps and utils retrieved from https://github.com/jaywcjlove/hotkeys

/**
 * Includes a lot of leftover unused codes for the future in case we
 * want glyphs for them
 */
const keyNameCodeMapping = {
  backspace: 8,
  tab: 9,
  clear: 12,
  enter: 13,
  return: 13,
  esc: 27,
  escape: 27,
  space: 32,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
  del: 46,
  delete: 46,
  ins: 45,
  insert: 45,
  home: 36,
  end: 35,
  pageup: 33,
  pagedown: 34,
  capslock: 20,
  num_0: 96,
  num_1: 97,
  num_2: 98,
  num_3: 99,
  num_4: 100,
  num_5: 101,
  num_6: 102,
  num_7: 103,
  num_8: 104,
  num_9: 105,
  num_multiply: 106,
  num_add: 107,
  num_enter: 108,
  num_subtract: 109,
  num_decimal: 110,
  num_divide: 111,
  '⇪': 20,
  ',': 188,
  '.': 190,
  '/': 191,
  '`': 192,
  '-': 189,
  '=': 187,
  ';': 186,
  "'": 222,
  '[': 219,
  ']': 221,
  '\\': 220
}; // Modifier Keys

const modifierNameKeyCodeMapping = {
  // shiftKey
  '⇧': 16,
  shift: 16,
  // altKey
  '⌥': 18,
  alt: 18,
  option: 18,
  // ctrlKey
  '⌃': 17,
  ctrl: 17,
  control: 17,
  // metaKey
  '⌘': 91,
  cmd: 91,
  command: 91
};
const getKeyCode = x => keyNameCodeMapping[x.toLowerCase()] || modifierNameKeyCodeMapping[x.toLowerCase()] || x.toUpperCase().charCodeAt(0);

/***/ }),

/***/ "./app/utils/isActiveSuperuser.tsx":
/*!*****************************************!*\
  !*** ./app/utils/isActiveSuperuser.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isActiveSuperuser": () => (/* binding */ isActiveSuperuser)
/* harmony export */ });
/* harmony import */ var js_cookie__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! js-cookie */ "../node_modules/js-cookie/dist/js.cookie.mjs");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");


const SUPERUSER_COOKIE_NAME = 'su';
/**
 * Checking for just isSuperuser on a config object may not be enough as backend often checks for *active* superuser.
 * We therefore check both isSuperuser flag AND superuser session cookie.
 */

function isActiveSuperuser() {
  const {
    isSuperuser
  } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_1__["default"].get('user') || {};

  if (isSuperuser) {
    /**
     * Superuser cookie cannot be checked for existence as it is HttpOnly.
     * As a workaround, we try to change it to something else and if that fails we can assume that it's being present.
     * There may be an edgecase where it's present and expired but for current usage it's not a big deal.
     */
    js_cookie__WEBPACK_IMPORTED_MODULE_0__["default"].set(SUPERUSER_COOKIE_NAME, 'test');

    if (js_cookie__WEBPACK_IMPORTED_MODULE_0__["default"].get(SUPERUSER_COOKIE_NAME) === undefined) {
      return true;
    }
  }

  return false;
}

/***/ }),

/***/ "./app/utils/teams.tsx":
/*!*****************************!*\
  !*** ./app/utils/teams.tsx ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * This is a utility component to leverage the useTeams hook to provide
 * a render props component which returns teams through a variety of inputs
 * such as a list of slugs or user teams.
 */
function Teams(_ref) {
  let {
    children,
    ...props
  } = _ref;
  const renderProps = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_1__["default"])(props);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: children(renderProps)
  });
}

Teams.displayName = "Teams";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Teams);

/***/ }),

/***/ "./app/utils/useHotkeys.tsx":
/*!**********************************!*\
  !*** ./app/utils/useHotkeys.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useHotkeys": () => (/* binding */ useHotkeys)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _getKeyCode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./getKeyCode */ "./app/utils/getKeyCode.ts");




const isKeyPressed = (key, evt) => {
  const keyCode = (0,_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)(key);

  switch (keyCode) {
    case (0,_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)('command'):
      return evt.metaKey;

    case (0,_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)('shift'):
      return evt.shiftKey;

    case (0,_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)('ctrl'):
      return evt.ctrlKey;

    case (0,_getKeyCode__WEBPACK_IMPORTED_MODULE_2__.getKeyCode)('alt'):
      return evt.altKey;

    default:
      return keyCode === evt.keyCode;
  }
};
/**
 * Pass in the hotkey combinations under match and the corresponding callback function to be called.
 * Separate key names with +. For example, 'command+alt+shift+x'
 * Alternate matchings as an array: ['command+alt+backspace', 'ctrl+alt+delete']
 *
 * Note: you can only use one non-modifier (keys other than shift, ctrl, alt, command) key at a time.
 */


function useHotkeys(hotkeys, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHotkeys = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => hotkeys, deps);
  const onKeyDown = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(evt => {
    for (const set of memoizedHotkeys) {
      const keysets = Array.isArray(set.match) ? set.match : [set.match];

      for (const keyset of keysets) {
        const keys = keyset.split('+');

        if (keys.every(key => isKeyPressed(key, evt))) {
          set.callback(evt);
          return;
        }
      }
    }
  }, [memoizedHotkeys]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);
}

/***/ }),

/***/ "./app/utils/useTeams.tsx":
/*!********************************!*\
  !*** ./app/utils/useTeams.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/teams */ "./app/actionCreators/teams.tsx");
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");













/**
 * Helper function to actually load teams
 */
async function fetchTeams(api, orgId) {
  let {
    slugs,
    ids,
    search,
    limit,
    lastSearch,
    cursor
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const query = {};

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (ids !== undefined && ids.length > 0) {
    query.query = ids.map(id => `id:${id}`).join(' ');
  }

  if (search) {
    var _query$query;

    query.query = `${(_query$query = query.query) !== null && _query$query !== void 0 ? _query$query : ''} ${search}`.trim();
  }

  const isSameSearch = lastSearch === search || !lastSearch && !search;

  if (isSameSearch && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore = false;
  let nextCursor = null;
  const [data,, resp] = await api.requestPromise(`/organizations/${orgId}/teams/`, {
    includeAllArgs: true,
    query
  });
  const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

  if (pageLinks) {
    var _paginationObject$nex, _paginationObject$nex2;

    const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_10__["default"])(pageLinks);
    hasMore = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex = paginationObject.next) === null || _paginationObject$nex === void 0 ? void 0 : _paginationObject$nex.results;
    nextCursor = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex2 = paginationObject.next) === null || _paginationObject$nex2 === void 0 ? void 0 : _paginationObject$nex2.cursor;
  }

  return {
    results: data,
    hasMore,
    nextCursor
  };
} // TODO: Paging for items which have already exist in the store is not
// correctly implemented.

/**
 * Provides teams from the TeamStore
 *
 * This hook also provides a way to select specific slugs to ensure they are
 * loaded, as well as search (type-ahead) for more slugs that may not be in the
 * TeamsStore.
 *
 * NOTE: It is NOT guaranteed that all teams for an organization will be
 * loaded, so you should use this hook with the intention of providing specific
 * slugs, or loading more through search.
 *
 */


function useTeams() {
  var _slugs$filter, _ids$filter, _state$hasMore;

  let {
    limit,
    slugs,
    ids,
    provideUserTeams
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const {
    organization
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_8__.useLegacyStore)(sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_6__["default"]);
  const store = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_8__.useLegacyStore)(sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_7__["default"]);
  const orgId = organization === null || organization === void 0 ? void 0 : organization.slug;
  const storeSlugs = new Set(store.teams.map(t => t.slug));
  const slugsToLoad = (_slugs$filter = slugs === null || slugs === void 0 ? void 0 : slugs.filter(slug => !storeSlugs.has(slug))) !== null && _slugs$filter !== void 0 ? _slugs$filter : [];
  const storeIds = new Set(store.teams.map(t => t.id));
  const idsToLoad = (_ids$filter = ids === null || ids === void 0 ? void 0 : ids.filter(id => !storeIds.has(id))) !== null && _ids$filter !== void 0 ? _ids$filter : [];
  const shouldLoadSlugs = slugsToLoad.length > 0;
  const shouldLoadIds = idsToLoad.length > 0;
  const shouldLoadTeams = provideUserTeams && !store.loadedUserTeams; // If we don't need to make a request either for slugs or user teams, set
  // initiallyLoaded to true

  const initiallyLoaded = !shouldLoadSlugs && !shouldLoadTeams && !shouldLoadIds;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    initiallyLoaded,
    fetching: false,
    hasMore: store.hasMore,
    lastSearch: null,
    nextCursor: store.cursor,
    fetchError: null
  });
  const slugOrIdRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null); // Only initialize slugOrIdRef.current once and modify it when we receive new
  // slugs or ids determined through set equality

  if (slugs !== undefined || ids !== undefined) {
    var _ref;

    const slugsOrIds = (_ref = slugs || ids) !== null && _ref !== void 0 ? _ref : [];

    if (slugOrIdRef.current === null) {
      slugOrIdRef.current = new Set(slugsOrIds);
    }

    if (slugsOrIds.length !== slugOrIdRef.current.size || slugsOrIds.some(slugOrId => {
      var _slugOrIdRef$current;

      return !((_slugOrIdRef$current = slugOrIdRef.current) !== null && _slugOrIdRef$current !== void 0 && _slugOrIdRef$current.has(slugOrId));
    })) {
      slugOrIdRef.current = new Set(slugsOrIds);
    }
  }

  async function loadUserTeams() {
    if (orgId === undefined) {
      return;
    }

    setState({ ...state,
      fetching: true
    });

    try {
      await (0,sentry_actionCreators_teams__WEBPACK_IMPORTED_MODULE_4__.fetchUserTeams)(api, {
        orgId
      });
      setState({ ...state,
        fetching: false,
        initiallyLoaded: true
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({ ...state,
        fetching: false,
        initiallyLoaded: true,
        fetchError: err
      });
    }
  }

  async function loadTeamsBySlugOrId() {
    if (orgId === undefined) {
      return;
    }

    setState({ ...state,
      fetching: true
    });

    try {
      const {
        results,
        hasMore,
        nextCursor
      } = await fetchTeams(api, orgId, {
        slugs: slugsToLoad,
        ids: idsToLoad,
        limit
      }); // Unique by `id` to avoid duplicates due to renames and state store data

      const fetchedTeams = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...results, ...store.teams], _ref2 => {
        let {
          id
        } = _ref2;
        return id;
      });
      sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadTeams(fetchedTeams);
      setState({ ...state,
        hasMore,
        fetching: false,
        initiallyLoaded: true,
        nextCursor
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({ ...state,
        fetching: false,
        initiallyLoaded: true,
        fetchError: err
      });
    }
  }

  function handleSearch(search) {
    if (search !== '') {
      return handleFetchAdditionalTeams(search);
    } // Reset pagination state to match store if doing an empty search


    if (state.hasMore !== store.hasMore || state.nextCursor !== store.cursor) {
      setState({ ...state,
        lastSearch: search,
        hasMore: store.hasMore,
        nextCursor: store.cursor
      });
    }

    return Promise.resolve();
  }

  async function handleFetchAdditionalTeams(search) {
    const {
      lastSearch
    } = state; // Use the store cursor if there is no search keyword provided

    const cursor = search ? state.nextCursor : store.cursor;

    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot fetch teams without an organization in context');
      return;
    }

    setState({ ...state,
      fetching: true
    });

    try {
      api.clear();
      const {
        results,
        hasMore,
        nextCursor
      } = await fetchTeams(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor
      });
      const fetchedTeams = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...store.teams, ...results], _ref3 => {
        let {
          slug
        } = _ref3;
        return slug;
      });

      if (search) {
        // Only update the store if we have more items
        if (fetchedTeams.length > store.teams.length) {
          sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadTeams(fetchedTeams);
        }
      } else {
        // If we fetched a page of teams without a search query, add cursor data to the store
        sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_5__["default"].loadTeams(fetchedTeams, hasMore, nextCursor);
      }

      setState({ ...state,
        hasMore: hasMore && store.hasMore,
        fetching: false,
        lastSearch: search !== null && search !== void 0 ? search : null,
        nextCursor
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({ ...state,
        fetching: false,
        fetchError: err
      });
    }
  }

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    // Load specified team slugs
    if (shouldLoadSlugs || shouldLoadIds) {
      loadTeamsBySlugOrId();
      return;
    } // Load user teams


    if (shouldLoadTeams) {
      loadUserTeams();
    }
  }, [slugOrIdRef.current, provideUserTeams]);
  const isSuperuser = (0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_9__.isActiveSuperuser)();
  const filteredTeams = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    return slugs ? store.teams.filter(t => slugs.includes(t.slug)) : ids ? store.teams.filter(t => ids.includes(t.id)) : provideUserTeams && !isSuperuser ? store.teams.filter(t => t.isMember) : store.teams;
  }, [store.teams, ids, slugs, provideUserTeams, isSuperuser]);
  const result = {
    teams: filteredTeams,
    fetching: state.fetching || store.loading,
    initiallyLoaded: state.initiallyLoaded,
    fetchError: state.fetchError,
    hasMore: (_state$hasMore = state.hasMore) !== null && _state$hasMore !== void 0 ? _state$hasMore : store.hasMore,
    onSearch: handleSearch,
    loadMore: handleFetchAdditionalTeams
  };
  return result;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useTeams);

/***/ }),

/***/ "./app/utils/withIssueTags.tsx":
/*!*************************************!*\
  !*** ./app/utils/withIssueTags.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/tagStore */ "./app/stores/tagStore.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const uuidPattern = /[0-9a-f]{32}$/;

const getUsername = _ref => {
  let {
    isManaged,
    username,
    email
  } = _ref;

  // Users created via SAML receive unique UUID usernames. Use
  // their email in these cases, instead.
  if (username && uuidPattern.test(username)) {
    return email;
  }

  return !isManaged && username ? username : email;
};

/**
 * HOC for getting tags and many useful issue attributes as 'tags' for use
 * in autocomplete selectors or condition builders.
 */
function withIssueTags(WrappedComponent) {
  function ComponentWithTags(props) {
    const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
      tags: sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].getIssueTags(),
      users: sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__["default"].getAll(),
      teams: sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_4__["default"].getAll()
    });
    const setAssigned = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(newState => {
      setState(oldState => {
        var _ref2, _newState$tags$assign, _newState$tags, _oldState$tags, _ref3, _newState$tags$bookma, _newState$tags2, _oldState$tags2, _ref4, _newState$tags$assign2, _newState$tags3;

        const usernames = newState.users ? newState.users.map(getUsername) : oldState.users.map(getUsername);
        const teamnames = (newState.teams ? newState.teams : oldState.teams).filter(team => team.isMember).map(team => `#${team.slug}`);
        const allAssigned = ['[me, none]', ...usernames, ...teamnames];
        allAssigned.unshift('me');
        usernames.unshift('me');
        return { ...oldState,
          ...newState,
          tags: { ...oldState.tags,
            ...newState.tags,
            assigned: { ...((_ref2 = (_newState$tags$assign = (_newState$tags = newState.tags) === null || _newState$tags === void 0 ? void 0 : _newState$tags.assigned) !== null && _newState$tags$assign !== void 0 ? _newState$tags$assign : (_oldState$tags = oldState.tags) === null || _oldState$tags === void 0 ? void 0 : _oldState$tags.assigned) !== null && _ref2 !== void 0 ? _ref2 : {}),
              values: allAssigned
            },
            bookmarks: { ...((_ref3 = (_newState$tags$bookma = (_newState$tags2 = newState.tags) === null || _newState$tags2 === void 0 ? void 0 : _newState$tags2.bookmarks) !== null && _newState$tags$bookma !== void 0 ? _newState$tags$bookma : (_oldState$tags2 = oldState.tags) === null || _oldState$tags2 === void 0 ? void 0 : _oldState$tags2.bookmarks) !== null && _ref3 !== void 0 ? _ref3 : {}),
              values: usernames
            },
            assigned_or_suggested: { ...((_ref4 = (_newState$tags$assign2 = (_newState$tags3 = newState.tags) === null || _newState$tags3 === void 0 ? void 0 : _newState$tags3.assigned_or_suggested) !== null && _newState$tags$assign2 !== void 0 ? _newState$tags$assign2 : oldState.tags.assigned_or_suggested) !== null && _ref4 !== void 0 ? _ref4 : {}),
              values: allAssigned
            }
          }
        };
      });
    }, []); // Listen to team store updates and cleanup listener on unmount

    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
      const unsubscribeTeam = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(() => {
        setAssigned({
          teams: sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_4__["default"].getAll()
        });
      }, undefined);
      return () => unsubscribeTeam();
    }, [setAssigned]); // Listen to tag store updates and cleanup listener on unmount

    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
      const unsubscribeTags = sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(() => {
        setAssigned({
          tags: sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].getIssueTags()
        });
      }, undefined);
      return () => unsubscribeTags();
    }, [setAssigned]); // Listen to member store updates and cleanup listener on unmount

    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
      const unsubscribeMembers = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__["default"].listen(users => {
        setAssigned({
          users
        });
      }, undefined);
      return () => unsubscribeMembers();
    }, [setAssigned]);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(WrappedComponent, { ...props,
      tags: state.tags
    });
  }

  ComponentWithTags.displayName = `withIssueTags(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__["default"])(WrappedComponent)})`;
  return ComponentWithTags;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withIssueTags);

/***/ }),

/***/ "./app/views/issueList/createSavedSearchModal.tsx":
/*!********************************************************!*\
  !*** ./app/views/issueList/createSavedSearchModal.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/savedSearches */ "./app/actionCreators/savedSearches.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms */ "./app/components/forms/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const DEFAULT_SORT_OPTIONS = [_utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.DATE, _utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.NEW, _utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.FREQ, _utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.PRIORITY, _utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.USER];

class CreateSavedSearchModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isSaving: false,
      error: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", (data, onSubmitSuccess, onSubmitError, event) => {
      const {
        api,
        organization
      } = this.props;
      const sort = this.validateSortOption(data.sort);
      event.preventDefault();
      this.setState({
        isSaving: true
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Saving Changes'));
      (0,sentry_actionCreators_savedSearches__WEBPACK_IMPORTED_MODULE_5__.createSavedSearch)(api, organization.slug, data.name, data.query, sort).then(_data => {
        this.props.closeModal();
        this.setState({
          error: null,
          isSaving: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.clearIndicators)();
        onSubmitSuccess(data);
      }).catch(err => {
        let error = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unable to save your changes.');

        if (err.responseJSON && err.responseJSON.detail) {
          error = err.responseJSON.detail;
        }

        this.setState({
          error,
          isSaving: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.clearIndicators)();
        onSubmitError(error);
      });
    });
  }

  /** Handle "date added" sort not being available for saved searches */
  validateSortOption(sort) {
    if (this.sortOptions().find(option => option === sort)) {
      return sort;
    }

    return _utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.DATE;
  }

  sortOptions() {
    var _organization$feature;

    const {
      organization
    } = this.props;
    const options = [...DEFAULT_SORT_OPTIONS];

    if (organization !== null && organization !== void 0 && (_organization$feature = organization.features) !== null && _organization$feature !== void 0 && _organization$feature.includes('issue-list-trend-sort')) {
      options.push(_utils__WEBPACK_IMPORTED_MODULE_10__.IssueSortOptions.TREND);
    }

    return options;
  }

  render() {
    const {
      error
    } = this.state;
    const {
      Header,
      Body,
      closeModal,
      query,
      sort
    } = this.props;
    const sortOptions = this.sortOptions().map(sortOption => ({
      value: sortOption,
      label: (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getSortLabel)(sortOption)
    }));
    const initialData = {
      name: '',
      query,
      sort: this.validateSortOption(sort)
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__.Form, {
      onSubmit: this.handleSubmit,
      onCancel: closeModal,
      saveOnBlur: false,
      initialData: initialData,
      submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Save'),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Save Current Search')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Body, {
        children: [this.state.error && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
          type: "error",
          children: error
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('All team members will now have access to this search.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__.TextField, {
          name: "name",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Name'),
          placeholder: "e.g. My Search Results",
          inline: false,
          stacked: true,
          flexibleControlStateSize: true,
          required: true
        }, "name"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__.TextField, {
          name: "query",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Query'),
          inline: false,
          stacked: true,
          flexibleControlStateSize: true,
          required: true
        }, "query"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms__WEBPACK_IMPORTED_MODULE_7__.SelectField, {
          name: "sort",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sort By'),
          options: sortOptions,
          required: true,
          clearable: false,
          inline: false,
          stacked: true,
          flexibleControlStateSize: true
        }, "sort")]
      })]
    });
  }

}

CreateSavedSearchModal.displayName = "CreateSavedSearchModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])(CreateSavedSearchModal));

/***/ }),

/***/ "./app/views/issueList/searchBar.tsx":
/*!*******************************************!*\
  !*** ./app/views/issueList/searchBar.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_components_smartSearchBar_actions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/smartSearchBar/actions */ "./app/components/smartSearchBar/actions.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const getSupportedTags = supportedTags => Object.fromEntries(Object.keys(supportedTags).map(key => {
  var _getFieldDefinition$k, _getFieldDefinition;

  return [key, { ...supportedTags[key],
    kind: (_getFieldDefinition$k = (_getFieldDefinition = (0,sentry_utils_fields__WEBPACK_IMPORTED_MODULE_4__.getFieldDefinition)(key)) === null || _getFieldDefinition === void 0 ? void 0 : _getFieldDefinition.kind) !== null && _getFieldDefinition$k !== void 0 ? _getFieldDefinition$k : supportedTags[key].predefined ? sentry_utils_fields__WEBPACK_IMPORTED_MODULE_4__.FieldKind.FIELD : sentry_utils_fields__WEBPACK_IMPORTED_MODULE_4__.FieldKind.TAG
  }];
}));

function IssueListSearchBar(_ref) {
  let {
    onSidebarToggle,
    sort,
    supportedTags,
    tagValueLoader,
    savedSearch,
    ...props
  } = _ref;
  const getTagValues = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (tag, query) => {
    const values = await tagValueLoader(tag.key, query);
    return values.map(_ref2 => {
      let {
        value
      } = _ref2;
      return value;
    });
  }, [tagValueLoader]);
  const pinnedSearch = savedSearch !== null && savedSearch !== void 0 && savedSearch.isPinned ? savedSearch : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    searchSource: "main_search",
    hasRecentSearches: true,
    savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SavedSearchType.ISSUE,
    onGetTagValues: getTagValues,
    actionBarItems: [(0,sentry_components_smartSearchBar_actions__WEBPACK_IMPORTED_MODULE_2__.makePinSearchAction)({
      sort,
      pinnedSearch
    }), (0,sentry_components_smartSearchBar_actions__WEBPACK_IMPORTED_MODULE_2__.makeSaveSearchAction)({
      sort
    }), (0,sentry_components_smartSearchBar_actions__WEBPACK_IMPORTED_MODULE_2__.makeSearchBuilderAction)({
      onSidebarToggle
    })],
    ...props,
    maxMenuHeight: 500,
    supportedTags: getSupportedTags(supportedTags)
  });
}

IssueListSearchBar.displayName = "IssueListSearchBar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueListSearchBar);

/***/ }),

/***/ "./app/views/issueList/utils.tsx":
/*!***************************************!*\
  !*** ./app/views/issueList/utils.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DISCOVER_EXCLUSION_FIELDS": () => (/* binding */ DISCOVER_EXCLUSION_FIELDS),
/* harmony export */   "IssueSortOptions": () => (/* binding */ IssueSortOptions),
/* harmony export */   "Query": () => (/* binding */ Query),
/* harmony export */   "TAB_MAX_COUNT": () => (/* binding */ TAB_MAX_COUNT),
/* harmony export */   "getSortLabel": () => (/* binding */ getSortLabel),
/* harmony export */   "getTabs": () => (/* binding */ getTabs),
/* harmony export */   "getTabsWithCounts": () => (/* binding */ getTabsWithCounts),
/* harmony export */   "isForReviewQuery": () => (/* binding */ isForReviewQuery)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





let Query;

(function (Query) {
  Query["FOR_REVIEW"] = "is:unresolved is:for_review assigned_or_suggested:[me, none]";
  Query["UNRESOLVED"] = "is:unresolved";
  Query["IGNORED"] = "is:ignored";
  Query["REPROCESSING"] = "is:reprocessing";
})(Query || (Query = {}));

/**
 * Get a list of currently active tabs
 */
function getTabs(organization) {
  const tabs = [[Query.UNRESOLVED, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('All Unresolved'),
    analyticsName: 'unresolved',
    count: true,
    enabled: true,
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`All unresolved issues.`)
  }], [Query.FOR_REVIEW, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('For Review'),
    analyticsName: 'needs_review',
    count: true,
    enabled: true,
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`Issues are marked for review when they are created, unresolved, or unignored.
          Mark an issue reviewed to move it out of this list.
          Issues are automatically marked reviewed in 7 days.`)
  }], [Query.IGNORED, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Ignored'),
    analyticsName: 'ignored',
    count: true,
    enabled: true,
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`Ignored issues don’t trigger alerts. When their ignore
        conditions are met they become Unresolved and are flagged for review.`)
  }], [Query.REPROCESSING, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Reprocessing'),
    analyticsName: 'reprocessing',
    count: true,
    enabled: organization.features.includes('reprocessing-v2'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)(`These [link:reprocessing issues] will take some time to complete.
        Any new issues that are created during reprocessing will be flagged for review.`, {
      link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
        href: "https://docs.sentry.io/product/error-monitoring/reprocessing/"
      })
    }),
    tooltipHoverable: true
  }]];
  return tabs.filter(_ref => {
    let [_query, tab] = _ref;
    return tab.enabled;
  });
}
/**
 * @returns queries that should have counts fetched
 */

function getTabsWithCounts(organization) {
  const tabs = getTabs(organization);
  return tabs.filter(_ref2 => {
    let [_query, tab] = _ref2;
    return tab.count;
  }).map(_ref3 => {
    let [query] = _ref3;
    return query;
  });
}
function isForReviewQuery(query) {
  return !!query && /\bis:for_review\b/.test(query);
} // the tab counts will look like 99+

const TAB_MAX_COUNT = 99;
let IssueSortOptions;

(function (IssueSortOptions) {
  IssueSortOptions["DATE"] = "date";
  IssueSortOptions["NEW"] = "new";
  IssueSortOptions["PRIORITY"] = "priority";
  IssueSortOptions["FREQ"] = "freq";
  IssueSortOptions["USER"] = "user";
  IssueSortOptions["TREND"] = "trend";
  IssueSortOptions["INBOX"] = "inbox";
})(IssueSortOptions || (IssueSortOptions = {}));

function getSortLabel(key) {
  switch (key) {
    case IssueSortOptions.NEW:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('First Seen');

    case IssueSortOptions.PRIORITY:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Priority');

    case IssueSortOptions.FREQ:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Events');

    case IssueSortOptions.USER:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Users');

    case IssueSortOptions.TREND:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Relative Change');

    case IssueSortOptions.INBOX:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Date Added');

    case IssueSortOptions.DATE:
    default:
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Last Seen');
  }
}
const DISCOVER_EXCLUSION_FIELDS = ['query', 'status', 'bookmarked_by', 'assigned', 'assigned_to', 'unassigned', 'subscribed_by', 'active_at', 'first_release', 'first_seen', 'is', '__text'];

/***/ }),

/***/ "./app/components/searchSyntax/grammar.pegjs":
/*!***************************************************!*\
  !*** ./app/components/searchSyntax/grammar.pegjs ***!
  \***************************************************/
/***/ ((module) => {

/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */



function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { search: peg$parsesearch },
      peg$startRuleFunction  = peg$parsesearch,

      peg$c0 = function(space, terms) {
            return [space, ...terms.flat()];
          },
      peg$c1 = function() {
            return tc.tokenLogicBoolean(text().toUpperCase());
          },
      peg$c2 = function(spaces, inner) {
            return tc.tokenLogicGroup([spaces, ...inner].flat());
          },
      peg$c3 = /^[^()\n ]/,
      peg$c4 = peg$classExpectation(["(", ")", "\n", " "], true, false),
      peg$c5 = function() {
            return tc.tokenFreeText(text(), false);
          },
      peg$c6 = function(value) {
            return tc.tokenFreeText(value.value, true);
          },
      peg$c7 = function(key, op, value) {
            return tc.predicateFilter(FilterType.Date, key, value, op)
          },
      peg$c8 = function(key, op, value) {
            return tc.tokenFilter(FilterType.Date, key, value, op, false);
          },
      peg$c9 = function(key, value) {
            return tc.predicateFilter(FilterType.SpecificDate, key)
          },
      peg$c10 = function(key, value) {
            return tc.tokenFilter(FilterType.SpecificDate, key, value, opDefault, false);
          },
      peg$c11 = function(key, value) {
            return tc.predicateFilter(FilterType.RelativeDate, key)
          },
      peg$c12 = function(key, value) {
            return tc.tokenFilter(FilterType.RelativeDate, key, value, opDefault, false);
          },
      peg$c13 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.Duration, key)
          },
      peg$c14 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.Duration, key, value, op, !!negation);
          },
      peg$c15 = function(negation, key, value) {
            return tc.predicateFilter(FilterType.Boolean, key)
          },
      peg$c16 = function(negation, key, value) {
            return tc.tokenFilter(FilterType.Boolean, key, value, opDefault, !!negation);
          },
      peg$c17 = function(negation, key, value) {
            return tc.predicateFilter(FilterType.NumericIn, key)
          },
      peg$c18 = function(negation, key, value) {
            return tc.tokenFilter(FilterType.NumericIn, key, value, opDefault, !!negation);
          },
      peg$c19 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.Numeric, key)
          },
      peg$c20 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.Numeric, key, value, op, !!negation);
          },
      peg$c21 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.AggregateDuration, key)
        },
      peg$c22 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.AggregateDuration, key, value, op, !!negation);
          },
      peg$c23 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.AggregatePercentage, key)
          },
      peg$c24 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.AggregatePercentage, key, value, op, !!negation);
          },
      peg$c25 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.AggregateNumeric, key)
          },
      peg$c26 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.AggregateNumeric, key, value, op, !!negation);
          },
      peg$c27 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.AggregateDate, key)
          },
      peg$c28 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.AggregateDate, key, value, op, !!negation);
          },
      peg$c29 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.AggregateRelativeDate, key)
          },
      peg$c30 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.AggregateRelativeDate, key, value, op, !!negation);
          },
      peg$c31 = "has:",
      peg$c32 = peg$literalExpectation("has:", false),
      peg$c33 = function(negation, key, value) {
            return tc.predicateFilter(FilterType.Has, key)
          },
      peg$c34 = function(negation, key, value) {
            return tc.tokenFilter(FilterType.Has, key, value, opDefault, !!negation);
          },
      peg$c35 = "is:",
      peg$c36 = peg$literalExpectation("is:", false),
      peg$c37 = function(negation, key, value) {
            return tc.predicateFilter(FilterType.Is, key)
          },
      peg$c38 = function(negation, key, value) {
            return tc.tokenFilter(FilterType.Is, key, value, opDefault, !!negation);
          },
      peg$c39 = function(negation, key, value) {
            return tc.predicateFilter(FilterType.TextIn, key)
          },
      peg$c40 = function(negation, key, value) {
            return tc.tokenFilter(FilterType.TextIn, key, value, opDefault, !!negation);
          },
      peg$c41 = function(negation, key) { return tc.predicateTextOperator(key); },
      peg$c42 = function(negation, key, op, value) {
            return tc.predicateFilter(FilterType.Text, key)
          },
      peg$c43 = function(negation, key, op, value) {
            return tc.tokenFilter(FilterType.Text, key, value, op ? op[0] : opDefault, !!negation);
          },
      peg$c44 = /^[a-zA-Z0-9_.\-]/,
      peg$c45 = peg$classExpectation([["a", "z"], ["A", "Z"], ["0", "9"], "_", ".", "-"], false, false),
      peg$c46 = function(value) {
            return tc.tokenKeySimple(value.join(''), false);
          },
      peg$c47 = "\"",
      peg$c48 = peg$literalExpectation("\"", false),
      peg$c49 = /^[a-zA-Z0-9_.:\-]/,
      peg$c50 = peg$classExpectation([["a", "z"], ["A", "Z"], ["0", "9"], "_", ".", ":", "-"], false, false),
      peg$c51 = function(key) {
            return tc.tokenKeySimple(key.join(''), true);
          },
      peg$c52 = "tags",
      peg$c53 = peg$literalExpectation("tags", false),
      peg$c54 = function(prefix, key) {
            return tc.tokenKeyExplicitTag(prefix, key);
          },
      peg$c55 = function(name, s1, args, s2) {
            return tc.tokenKeyAggregate(name, args, s1, s2);
          },
      peg$c56 = function(arg1, args) {
            return tc.tokenKeyAggregateArgs(arg1, args);
          },
      peg$c57 = /^[^()\t\n, "]/,
      peg$c58 = peg$classExpectation(["(", ")", "\t", "\n", ",", " ", "\""], true, false),
      peg$c59 = function(param) {
            return tc.tokenKeyAggregateParam(param.join(''), false);
          },
      peg$c60 = "\\\"",
      peg$c61 = peg$literalExpectation("\\\"", false),
      peg$c62 = /^[^\t\n"]/,
      peg$c63 = peg$classExpectation(["\t", "\n", "\""], true, false),
      peg$c64 = function(param) {
            return tc.tokenKeyAggregateParam(`"${param.join('')}"`, true);
          },
      peg$c65 = /^[^()\t\n ]/,
      peg$c66 = peg$classExpectation(["(", ")", "\t", "\n", " "], true, false),
      peg$c67 = function(value) {
            return tc.tokenValueText(value.join(''), false);
          },
      peg$c68 = /^[^"]/,
      peg$c69 = peg$classExpectation(["\""], true, false),
      peg$c70 = function(value) {
            return tc.tokenValueText(value.join(''), true);
          },
      peg$c71 = function() {
              return tc.tokenValueText(text(), false);
          },
      peg$c72 = "-",
      peg$c73 = peg$literalExpectation("-", false),
      peg$c74 = /^[kmb]/,
      peg$c75 = peg$classExpectation(["k", "m", "b"], false, false),
      peg$c76 = function(value, unit) {
            return tc.tokenValueNumber(value.join(''), unit);
          },
      peg$c77 = "true",
      peg$c78 = peg$literalExpectation("true", true),
      peg$c79 = "1",
      peg$c80 = peg$literalExpectation("1", false),
      peg$c81 = "false",
      peg$c82 = peg$literalExpectation("false", true),
      peg$c83 = "0",
      peg$c84 = peg$literalExpectation("0", false),
      peg$c85 = function(value) {
            return tc.tokenValueBoolean(value);
          },
      peg$c86 = function(item1, items) {
            return tc.tokenValueTextList(item1, items);
          },
      peg$c87 = function(item1, items) {
            return tc.tokenValueNumberList(item1, items);
          },
      peg$c88 = /^[^(), ]/,
      peg$c89 = peg$classExpectation(["(", ")", ",", " "], true, false),
      peg$c90 = /^[0-9]/,
      peg$c91 = peg$classExpectation([["0", "9"]], false, false),
      peg$c92 = "T",
      peg$c93 = peg$literalExpectation("T", false),
      peg$c94 = ":",
      peg$c95 = peg$literalExpectation(":", false),
      peg$c96 = ".",
      peg$c97 = peg$literalExpectation(".", false),
      peg$c98 = /^[+\-]/,
      peg$c99 = peg$classExpectation(["+", "-"], false, false),
      peg$c100 = "Z",
      peg$c101 = peg$literalExpectation("Z", false),
      peg$c102 = function() {
            return tc.tokenValueIso8601Date(text());
          },
      peg$c103 = /^[wdhm]/,
      peg$c104 = peg$classExpectation(["w", "d", "h", "m"], false, false),
      peg$c105 = function(sign, value, unit) {
            return tc.tokenValueRelativeDate(value.join(''), sign, unit);
          },
      peg$c106 = "ms",
      peg$c107 = peg$literalExpectation("ms", false),
      peg$c108 = "s",
      peg$c109 = peg$literalExpectation("s", false),
      peg$c110 = "min",
      peg$c111 = peg$literalExpectation("min", false),
      peg$c112 = "m",
      peg$c113 = peg$literalExpectation("m", false),
      peg$c114 = "hr",
      peg$c115 = peg$literalExpectation("hr", false),
      peg$c116 = "h",
      peg$c117 = peg$literalExpectation("h", false),
      peg$c118 = "day",
      peg$c119 = peg$literalExpectation("day", false),
      peg$c120 = "d",
      peg$c121 = peg$literalExpectation("d", false),
      peg$c122 = "wk",
      peg$c123 = peg$literalExpectation("wk", false),
      peg$c124 = "w",
      peg$c125 = peg$literalExpectation("w", false),
      peg$c126 = function(value, unit) {
            return tc.tokenValueDuration(value, unit);
          },
      peg$c127 = "%",
      peg$c128 = peg$literalExpectation("%", false),
      peg$c129 = function(value) {
            return tc.tokenValuePercentage(value);
          },
      peg$c130 = ">=",
      peg$c131 = peg$literalExpectation(">=", false),
      peg$c132 = "<=",
      peg$c133 = peg$literalExpectation("<=", false),
      peg$c134 = ">",
      peg$c135 = peg$literalExpectation(">", false),
      peg$c136 = "<",
      peg$c137 = peg$literalExpectation("<", false),
      peg$c138 = "=",
      peg$c139 = peg$literalExpectation("=", false),
      peg$c140 = "!=",
      peg$c141 = peg$literalExpectation("!=", false),
      peg$c142 = "or",
      peg$c143 = peg$literalExpectation("OR", true),
      peg$c144 = "and",
      peg$c145 = peg$literalExpectation("AND", true),
      peg$c146 = function() { return text(); },
      peg$c147 = "(",
      peg$c148 = peg$literalExpectation("(", false),
      peg$c149 = ")",
      peg$c150 = peg$literalExpectation(")", false),
      peg$c151 = "[",
      peg$c152 = peg$literalExpectation("[", false),
      peg$c153 = "]",
      peg$c154 = peg$literalExpectation("]", false),
      peg$c155 = "!",
      peg$c156 = peg$literalExpectation("!", false),
      peg$c157 = ",",
      peg$c158 = peg$literalExpectation(",", false),
      peg$c159 = " ",
      peg$c160 = peg$literalExpectation(" ", false),
      peg$c161 = function() { return tc.tokenSpaces(text()) },
      peg$c162 = /^[\t\n )]/,
      peg$c163 = peg$classExpectation(["\t", "\n", " ", ")"], false, false),
      peg$c164 = peg$anyExpectation(),

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parsesearch() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsespaces();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseterm();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseterm();
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c0(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseterm() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseboolean_operator();
    if (s1 === peg$FAILED) {
      s1 = peg$parseparen_group();
      if (s1 === peg$FAILED) {
        s1 = peg$parsefilter();
        if (s1 === peg$FAILED) {
          s1 = peg$parsefree_text();
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsespaces();
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseboolean_operator() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseor_operator();
    if (s1 === peg$FAILED) {
      s1 = peg$parseand_operator();
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c1();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseparen_group() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseopen_paren();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsespaces();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseterm();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseterm();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseclosed_paren();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c2(s2, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefree_text() {
    var s0;

    s0 = peg$parsefree_text_quoted();
    if (s0 === peg$FAILED) {
      s0 = peg$parsefree_text_unquoted();
    }

    return s0;
  }

  function peg$parsefree_text_unquoted() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    s3 = peg$currPos;
    peg$silentFails++;
    s4 = peg$parsefilter();
    peg$silentFails--;
    if (s4 === peg$FAILED) {
      s3 = void 0;
    } else {
      peg$currPos = s3;
      s3 = peg$FAILED;
    }
    if (s3 !== peg$FAILED) {
      s4 = peg$currPos;
      peg$silentFails++;
      s5 = peg$parseboolean_operator();
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsefree_parens();
        if (s5 === peg$FAILED) {
          s5 = [];
          if (peg$c3.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c4); }
          }
          if (s6 !== peg$FAILED) {
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              if (peg$c3.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c4); }
              }
            }
          } else {
            s5 = peg$FAILED;
          }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$parsespaces();
          if (s6 !== peg$FAILED) {
            s3 = [s3, s4, s5, s6];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$currPos;
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parsefilter();
        peg$silentFails--;
        if (s4 === peg$FAILED) {
          s3 = void 0;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          peg$silentFails++;
          s5 = peg$parseboolean_operator();
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = void 0;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsefree_parens();
            if (s5 === peg$FAILED) {
              s5 = [];
              if (peg$c3.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c4); }
              }
              if (s6 !== peg$FAILED) {
                while (s6 !== peg$FAILED) {
                  s5.push(s6);
                  if (peg$c3.test(input.charAt(peg$currPos))) {
                    s6 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s6 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c4); }
                  }
                }
              } else {
                s5 = peg$FAILED;
              }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parsespaces();
              if (s6 !== peg$FAILED) {
                s3 = [s3, s4, s5, s6];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c5();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefree_text_quoted() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parsequoted_value();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c6(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefree_parens() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseopen_paren();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsefree_text();
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseclosed_paren();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefilter() {
    var s0;

    s0 = peg$parsedate_filter();
    if (s0 === peg$FAILED) {
      s0 = peg$parsespecific_date_filter();
      if (s0 === peg$FAILED) {
        s0 = peg$parserel_date_filter();
        if (s0 === peg$FAILED) {
          s0 = peg$parseduration_filter();
          if (s0 === peg$FAILED) {
            s0 = peg$parseboolean_filter();
            if (s0 === peg$FAILED) {
              s0 = peg$parsenumeric_in_filter();
              if (s0 === peg$FAILED) {
                s0 = peg$parsenumeric_filter();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseaggregate_duration_filter();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseaggregate_numeric_filter();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseaggregate_percentage_filter();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseaggregate_date_filter();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parseaggregate_rel_date_filter();
                          if (s0 === peg$FAILED) {
                            s0 = peg$parsehas_filter();
                            if (s0 === peg$FAILED) {
                              s0 = peg$parseis_filter();
                              if (s0 === peg$FAILED) {
                                s0 = peg$parsetext_in_filter();
                                if (s0 === peg$FAILED) {
                                  s0 = peg$parsetext_filter();
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsedate_filter() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsesearch_key();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesep();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseoperator();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseiso_8601_date_format();
          if (s4 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s5 = peg$c7(s1, s3, s4);
            if (s5) {
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c8(s1, s3, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsespecific_date_filter() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parsesearch_key();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesep();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseiso_8601_date_format();
        if (s3 !== peg$FAILED) {
          peg$savedPos = peg$currPos;
          s4 = peg$c9(s1, s3);
          if (s4) {
            s4 = void 0;
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c10(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parserel_date_filter() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parsesearch_key();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesep();
      if (s2 !== peg$FAILED) {
        s3 = peg$parserel_date_format();
        if (s3 !== peg$FAILED) {
          peg$savedPos = peg$currPos;
          s4 = peg$c11(s1, s3);
          if (s4) {
            s4 = void 0;
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c12(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseduration_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesearch_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseduration_format();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c13(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c14(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseboolean_filter() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesearch_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseboolean_value();
          if (s4 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s5 = peg$c15(s1, s2, s4);
            if (s5) {
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c16(s1, s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenumeric_in_filter() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesearch_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsenumeric_in_list();
          if (s4 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s5 = peg$c17(s1, s2, s4);
            if (s5) {
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c18(s1, s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenumeric_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesearch_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsenumeric_value();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c19(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c20(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_duration_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseaggregate_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseduration_format();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c21(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c22(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_percentage_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseaggregate_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsepercentage_format();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c23(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c24(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_numeric_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseaggregate_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsenumeric_value();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c25(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c26(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_date_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseaggregate_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseiso_8601_date_format();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c27(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c28(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_rel_date_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseaggregate_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoperator();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parserel_date_format();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c29(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c30(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsehas_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 4) === peg$c31) {
        s3 = peg$c31;
        peg$currPos += 4;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c32); }
      }
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesearch_key();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsesep();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsesearch_key();
            if (s5 === peg$FAILED) {
              s5 = peg$parsesearch_value();
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c33(s1, s3, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c34(s1, s3, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseis_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 3) === peg$c35) {
        s3 = peg$c35;
        peg$currPos += 3;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c36); }
      }
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesearch_key();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsesep();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsesearch_value();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c37(s1, s3, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c38(s1, s3, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetext_in_filter() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsetext_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsetext_in_list();
          if (s4 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s5 = peg$c39(s1, s2, s4);
            if (s5) {
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c40(s1, s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetext_filter() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsenegation();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsetext_key();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesep();
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          s5 = peg$parseoperator();
          if (s5 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s6 = peg$c41(s1, s2);
            if (s6) {
              s6 = void 0;
            } else {
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              s5 = [s5, s6];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsesearch_value();
            if (s5 !== peg$FAILED) {
              peg$savedPos = peg$currPos;
              s6 = peg$c42(s1, s2, s4, s5);
              if (s6) {
                s6 = void 0;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c43(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsekey() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    if (peg$c44.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c45); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c44.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c45); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c46(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsequoted_key() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c47;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c48); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c49.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c50); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c49.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c50); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c47;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c51(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseexplicit_tag_key() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c52) {
      s1 = peg$c52;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c53); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseopen_bracket();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsesearch_key();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseclosed_bracket();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c54(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_key() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parsekey();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseopen_paren();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsefunction_args();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsespaces();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseclosed_paren();
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c55(s1, s3, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefunction_args() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$parseaggregate_param();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parsespaces();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsecomma();
        if (s5 !== peg$FAILED) {
          s6 = peg$parsespaces();
          if (s6 !== peg$FAILED) {
            s7 = peg$currPos;
            peg$silentFails++;
            s8 = peg$parsecomma();
            peg$silentFails--;
            if (s8 === peg$FAILED) {
              s7 = void 0;
            } else {
              peg$currPos = s7;
              s7 = peg$FAILED;
            }
            if (s7 !== peg$FAILED) {
              s8 = peg$parseaggregate_param();
              if (s8 === peg$FAILED) {
                s8 = null;
              }
              if (s8 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7, s8];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parsespaces();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsecomma();
          if (s5 !== peg$FAILED) {
            s6 = peg$parsespaces();
            if (s6 !== peg$FAILED) {
              s7 = peg$currPos;
              peg$silentFails++;
              s8 = peg$parsecomma();
              peg$silentFails--;
              if (s8 === peg$FAILED) {
                s7 = void 0;
              } else {
                peg$currPos = s7;
                s7 = peg$FAILED;
              }
              if (s7 !== peg$FAILED) {
                s8 = peg$parseaggregate_param();
                if (s8 === peg$FAILED) {
                  s8 = null;
                }
                if (s8 !== peg$FAILED) {
                  s4 = [s4, s5, s6, s7, s8];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c56(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_param() {
    var s0;

    s0 = peg$parsequoted_aggregate_param();
    if (s0 === peg$FAILED) {
      s0 = peg$parseraw_aggregate_param();
    }

    return s0;
  }

  function peg$parseraw_aggregate_param() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    if (peg$c57.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c58); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c57.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c58); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c59(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsequoted_aggregate_param() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c47;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c48); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (input.substr(peg$currPos, 2) === peg$c60) {
        s3 = peg$c60;
        peg$currPos += 2;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c61); }
      }
      if (s3 === peg$FAILED) {
        if (peg$c62.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c63); }
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (input.substr(peg$currPos, 2) === peg$c60) {
          s3 = peg$c60;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c61); }
        }
        if (s3 === peg$FAILED) {
          if (peg$c62.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c63); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c47;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c64(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsesearch_key() {
    var s0;

    s0 = peg$parsekey();
    if (s0 === peg$FAILED) {
      s0 = peg$parsequoted_key();
    }

    return s0;
  }

  function peg$parsetext_key() {
    var s0;

    s0 = peg$parseexplicit_tag_key();
    if (s0 === peg$FAILED) {
      s0 = peg$parsesearch_key();
    }

    return s0;
  }

  function peg$parsevalue() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    if (peg$c65.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c66); }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      if (peg$c65.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c66); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c67(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsequoted_value() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c47;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c48); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (input.substr(peg$currPos, 2) === peg$c60) {
        s3 = peg$c60;
        peg$currPos += 2;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c61); }
      }
      if (s3 === peg$FAILED) {
        if (peg$c68.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c69); }
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (input.substr(peg$currPos, 2) === peg$c60) {
          s3 = peg$c60;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c61); }
        }
        if (s3 === peg$FAILED) {
          if (peg$c68.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c69); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c47;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c70(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsein_value() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$currPos;
    s3 = peg$currPos;
    peg$silentFails++;
    s4 = peg$parsein_value_termination();
    peg$silentFails--;
    if (s4 !== peg$FAILED) {
      peg$currPos = s3;
      s3 = void 0;
    } else {
      s3 = peg$FAILED;
    }
    if (s3 !== peg$FAILED) {
      s4 = peg$parsein_value_char();
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$currPos;
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parsein_value_termination();
        peg$silentFails--;
        if (s4 !== peg$FAILED) {
          peg$currPos = s3;
          s3 = void 0;
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsein_value_char();
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c71();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsetext_in_value() {
    var s0;

    s0 = peg$parsequoted_value();
    if (s0 === peg$FAILED) {
      s0 = peg$parsein_value();
    }

    return s0;
  }

  function peg$parsesearch_value() {
    var s0;

    s0 = peg$parsequoted_value();
    if (s0 === peg$FAILED) {
      s0 = peg$parsevalue();
    }

    return s0;
  }

  function peg$parsenumeric_value() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s2 = peg$c72;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c73); }
    }
    if (s2 === peg$FAILED) {
      s2 = null;
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parsenumeric();
      if (s3 !== peg$FAILED) {
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      if (peg$c74.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c75); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parseend_value();
        if (s4 === peg$FAILED) {
          s4 = peg$parsecomma();
          if (s4 === peg$FAILED) {
            s4 = peg$parseclosed_bracket();
          }
        }
        peg$silentFails--;
        if (s4 !== peg$FAILED) {
          peg$currPos = s3;
          s3 = void 0;
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c76(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseboolean_value() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c77) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c78); }
    }
    if (s1 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 49) {
        s1 = peg$c79;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c80); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c81) {
          s1 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c82); }
        }
        if (s1 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 48) {
            s1 = peg$c83;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c84); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseend_value();
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c85(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetext_in_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    s1 = peg$parseopen_bracket();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsetext_in_value();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        s5 = peg$parsespaces();
        if (s5 !== peg$FAILED) {
          s6 = peg$parsecomma();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsespaces();
            if (s7 !== peg$FAILED) {
              s8 = peg$currPos;
              peg$silentFails++;
              s9 = peg$parsecomma();
              peg$silentFails--;
              if (s9 === peg$FAILED) {
                s8 = void 0;
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
              if (s8 !== peg$FAILED) {
                s9 = peg$parsetext_in_value();
                if (s9 === peg$FAILED) {
                  s9 = null;
                }
                if (s9 !== peg$FAILED) {
                  s5 = [s5, s6, s7, s8, s9];
                  s4 = s5;
                } else {
                  peg$currPos = s4;
                  s4 = peg$FAILED;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$currPos;
          s5 = peg$parsespaces();
          if (s5 !== peg$FAILED) {
            s6 = peg$parsecomma();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsespaces();
              if (s7 !== peg$FAILED) {
                s8 = peg$currPos;
                peg$silentFails++;
                s9 = peg$parsecomma();
                peg$silentFails--;
                if (s9 === peg$FAILED) {
                  s8 = void 0;
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
                if (s8 !== peg$FAILED) {
                  s9 = peg$parsetext_in_value();
                  if (s9 === peg$FAILED) {
                    s9 = null;
                  }
                  if (s9 !== peg$FAILED) {
                    s5 = [s5, s6, s7, s8, s9];
                    s4 = s5;
                  } else {
                    peg$currPos = s4;
                    s4 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s4;
                  s4 = peg$FAILED;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseclosed_bracket();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseend_value();
            peg$silentFails--;
            if (s6 !== peg$FAILED) {
              peg$currPos = s5;
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c86(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenumeric_in_list() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    s1 = peg$parseopen_bracket();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsenumeric_value();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        s5 = peg$parsespaces();
        if (s5 !== peg$FAILED) {
          s6 = peg$parsecomma();
          if (s6 !== peg$FAILED) {
            s7 = peg$parsespaces();
            if (s7 !== peg$FAILED) {
              s8 = peg$currPos;
              peg$silentFails++;
              s9 = peg$parsecomma();
              peg$silentFails--;
              if (s9 === peg$FAILED) {
                s8 = void 0;
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
              if (s8 !== peg$FAILED) {
                s9 = peg$parsenumeric_value();
                if (s9 === peg$FAILED) {
                  s9 = null;
                }
                if (s9 !== peg$FAILED) {
                  s5 = [s5, s6, s7, s8, s9];
                  s4 = s5;
                } else {
                  peg$currPos = s4;
                  s4 = peg$FAILED;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$currPos;
          s5 = peg$parsespaces();
          if (s5 !== peg$FAILED) {
            s6 = peg$parsecomma();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsespaces();
              if (s7 !== peg$FAILED) {
                s8 = peg$currPos;
                peg$silentFails++;
                s9 = peg$parsecomma();
                peg$silentFails--;
                if (s9 === peg$FAILED) {
                  s8 = void 0;
                } else {
                  peg$currPos = s8;
                  s8 = peg$FAILED;
                }
                if (s8 !== peg$FAILED) {
                  s9 = peg$parsenumeric_value();
                  if (s9 === peg$FAILED) {
                    s9 = null;
                  }
                  if (s9 !== peg$FAILED) {
                    s5 = [s5, s6, s7, s8, s9];
                    s4 = s5;
                  } else {
                    peg$currPos = s4;
                    s4 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s4;
                  s4 = peg$FAILED;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseclosed_bracket();
          if (s4 !== peg$FAILED) {
            s5 = peg$currPos;
            peg$silentFails++;
            s6 = peg$parseend_value();
            peg$silentFails--;
            if (s6 !== peg$FAILED) {
              peg$currPos = s5;
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c87(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsein_value_termination() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsein_value_char();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      s5 = peg$parsein_value_end();
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsein_value_char();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parsein_value_end();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parsein_value_char();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsein_value_end();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsein_value_char() {
    var s0;

    if (peg$c88.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c89); }
    }

    return s0;
  }

  function peg$parsein_value_end() {
    var s0, s1, s2;

    s0 = peg$parseclosed_bracket();
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsespaces();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsecomma();
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsenum2() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (peg$c90.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c91); }
    }
    if (s1 !== peg$FAILED) {
      if (peg$c90.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c91); }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenum4() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (peg$c90.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c91); }
    }
    if (s1 !== peg$FAILED) {
      if (peg$c90.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c91); }
      }
      if (s2 !== peg$FAILED) {
        if (peg$c90.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
        if (s3 !== peg$FAILED) {
          if (peg$c90.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c91); }
          }
          if (s4 !== peg$FAILED) {
            s1 = [s1, s2, s3, s4];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsedate_format() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsenum4();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c72;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c73); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenum2();
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 45) {
            s4 = peg$c72;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c73); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsenum2();
            if (s5 !== peg$FAILED) {
              s1 = [s1, s2, s3, s4, s5];
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetime_format() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 84) {
      s1 = peg$c92;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c93); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsenum2();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 58) {
          s3 = peg$c94;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c95); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsenum2();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 58) {
              s5 = peg$c94;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c95); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parsenum2();
              if (s6 !== peg$FAILED) {
                s7 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 46) {
                  s8 = peg$c96;
                  peg$currPos++;
                } else {
                  s8 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c97); }
                }
                if (s8 !== peg$FAILED) {
                  s9 = peg$parsems_format();
                  if (s9 !== peg$FAILED) {
                    s8 = [s8, s9];
                    s7 = s8;
                  } else {
                    peg$currPos = s7;
                    s7 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s7;
                  s7 = peg$FAILED;
                }
                if (s7 === peg$FAILED) {
                  s7 = null;
                }
                if (s7 !== peg$FAILED) {
                  s1 = [s1, s2, s3, s4, s5, s6, s7];
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsems_format() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    if (peg$c90.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c91); }
    }
    if (s1 !== peg$FAILED) {
      if (peg$c90.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c91); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        if (peg$c90.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          if (peg$c90.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c91); }
          }
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            if (peg$c90.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c91); }
            }
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              if (peg$c90.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c91); }
              }
              if (s6 === peg$FAILED) {
                s6 = null;
              }
              if (s6 !== peg$FAILED) {
                s1 = [s1, s2, s3, s4, s5, s6];
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsetz_format() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (peg$c98.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c99); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsenum2();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 58) {
          s3 = peg$c94;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c95); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsenum2();
          if (s4 !== peg$FAILED) {
            s1 = [s1, s2, s3, s4];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseiso_8601_date_format() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsedate_format();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsetime_format();
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 90) {
          s3 = peg$c100;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c101); }
        }
        if (s3 === peg$FAILED) {
          s3 = peg$parsetz_format();
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          peg$silentFails++;
          s5 = peg$parseend_value();
          peg$silentFails--;
          if (s5 !== peg$FAILED) {
            peg$currPos = s4;
            s4 = void 0;
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c102();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parserel_date_format() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (peg$c98.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c99); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c90.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c91); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c90.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c91); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (peg$c103.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c104); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          peg$silentFails++;
          s5 = peg$parseend_value();
          peg$silentFails--;
          if (s5 !== peg$FAILED) {
            peg$currPos = s4;
            s4 = void 0;
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c105(s1, s2, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseduration_format() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parsenumeric();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c106) {
        s2 = peg$c106;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c107); }
      }
      if (s2 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 115) {
          s2 = peg$c108;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c109); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c110) {
            s2 = peg$c110;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c111); }
          }
          if (s2 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 109) {
              s2 = peg$c112;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c113); }
            }
            if (s2 === peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c114) {
                s2 = peg$c114;
                peg$currPos += 2;
              } else {
                s2 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c115); }
              }
              if (s2 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 104) {
                  s2 = peg$c116;
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c117); }
                }
                if (s2 === peg$FAILED) {
                  if (input.substr(peg$currPos, 3) === peg$c118) {
                    s2 = peg$c118;
                    peg$currPos += 3;
                  } else {
                    s2 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c119); }
                  }
                  if (s2 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 100) {
                      s2 = peg$c120;
                      peg$currPos++;
                    } else {
                      s2 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c121); }
                    }
                    if (s2 === peg$FAILED) {
                      if (input.substr(peg$currPos, 2) === peg$c122) {
                        s2 = peg$c122;
                        peg$currPos += 2;
                      } else {
                        s2 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c123); }
                      }
                      if (s2 === peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 119) {
                          s2 = peg$c124;
                          peg$currPos++;
                        } else {
                          s2 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c125); }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        peg$silentFails++;
        s4 = peg$parseend_value();
        peg$silentFails--;
        if (s4 !== peg$FAILED) {
          peg$currPos = s3;
          s3 = void 0;
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c126(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsepercentage_format() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parsenumeric();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 37) {
        s2 = peg$c127;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c128); }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c129(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoperator() {
    var s0;

    if (input.substr(peg$currPos, 2) === peg$c130) {
      s0 = peg$c130;
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c131); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c132) {
        s0 = peg$c132;
        peg$currPos += 2;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c133); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 62) {
          s0 = peg$c134;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c135); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 60) {
            s0 = peg$c136;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c137); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 61) {
              s0 = peg$c138;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c139); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c140) {
                s0 = peg$c140;
                peg$currPos += 2;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c141); }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseor_operator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c142) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c143); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseend_value();
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseand_operator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c144) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c145); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseend_value();
      peg$silentFails--;
      if (s3 !== peg$FAILED) {
        peg$currPos = s2;
        s2 = void 0;
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenumeric() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = [];
    if (peg$c90.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c91); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c90.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s3 = peg$c96;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c97); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        if (peg$c90.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          if (peg$c90.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c91); }
          }
        }
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c146();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseopen_paren() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 40) {
      s0 = peg$c147;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c148); }
    }

    return s0;
  }

  function peg$parseclosed_paren() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 41) {
      s0 = peg$c149;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c150); }
    }

    return s0;
  }

  function peg$parseopen_bracket() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 91) {
      s0 = peg$c151;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c152); }
    }

    return s0;
  }

  function peg$parseclosed_bracket() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 93) {
      s0 = peg$c153;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c154); }
    }

    return s0;
  }

  function peg$parsesep() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 58) {
      s0 = peg$c94;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c95); }
    }

    return s0;
  }

  function peg$parsenegation() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 33) {
      s0 = peg$c155;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c156); }
    }

    return s0;
  }

  function peg$parsecomma() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 44) {
      s0 = peg$c157;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c158); }
    }

    return s0;
  }

  function peg$parsespaces() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    if (input.charCodeAt(peg$currPos) === 32) {
      s2 = peg$c159;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c160); }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      if (input.charCodeAt(peg$currPos) === 32) {
        s2 = peg$c159;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c160); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c161();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseend_value() {
    var s0, s1;

    if (peg$c162.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c163); }
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      peg$silentFails++;
      if (input.length > peg$currPos) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c164); }
      }
      peg$silentFails--;
      if (s1 === peg$FAILED) {
        s0 = void 0;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }


    const {TokenConverter, TermOperator, FilterType, config} = options;
    const tc = new TokenConverter({text, location, config});

    const opDefault = TermOperator.Default;


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_pageFilters_tsx-app_actionCreators_tags_tsx-app_components_assigneeSelecto-6127d8.62e8f75809911f0a0ed6269822ae0b62.js.map