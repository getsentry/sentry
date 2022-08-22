"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_useTeams_tsx"],{

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_useTeams_tsx.ff65a03ef898c2a13a6cffd8574d167d.js.map