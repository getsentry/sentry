"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectOwnership_ownerInput_tsx"],{

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

/***/ "./app/components/deprecatedforms/multiSelectControl.tsx":
/*!***************************************************************!*\
  !*** ./app/components/deprecatedforms/multiSelectControl.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.forwardRef)(function MultiSelectControl(props, ref) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__["default"], {
    forwardedRef: ref,
    ...props,
    multiple: true
  });
}));

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

/***/ "./app/stores/projectsStore.tsx":
/*!**************************************!*\
  !*** ./app/stores/projectsStore.tsx ***!
  \**************************************/
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
/* harmony import */ var sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/teamActions */ "./app/actions/teamActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const storeConfig = {
  itemsById: {},
  loading: true,
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].addTeamSuccess, this.onAddTeam));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].changeSlug, this.onChangeSlug));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].createSuccess, this.onCreateSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadProjects, this.loadInitialData));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].loadStatsSuccess, this.onStatsLoadSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].removeTeamSuccess, this.onRemoveTeam));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].reset, this.reset));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess, this.onUpdateSuccess));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_teamActions__WEBPACK_IMPORTED_MODULE_3__["default"].removeTeamSuccess, this.onDeleteTeam));
  },

  reset() {
    this.itemsById = {};
    this.loading = true;
  },

  loadInitialData(items) {
    const mapping = items.map(project => [project.id, project]);
    this.itemsById = Object.fromEntries(mapping);
    this.loading = false;
    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onChangeSlug(prevSlug, newSlug) {
    const prevProject = this.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = { ...prevProject,
      slug: newSlug
    };
    this.itemsById = { ...this.itemsById,
      [newProject.id]: newProject
    };
    this.trigger(new Set([prevProject.id]));
  },

  onCreateSuccess(project) {
    this.itemsById = { ...this.itemsById,
      [project.id]: project
    };
    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data) {
    const project = this.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = { ...project,
      ...data
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
    this.trigger(new Set([data.id]));
  },

  onStatsLoadSuccess(data) {
    const entries = Object.entries(data || {}).filter(_ref => {
      let [projectId] = _ref;
      return projectId in this.itemsById;
    }); // Assign stats into projects

    entries.forEach(_ref2 => {
      let [projectId, stats] = _ref2;
      this.itemsById[projectId].stats = stats;
    });
    const touchedIds = entries.map(_ref3 => {
      let [projectId] = _ref3;
      return projectId;
    });
    this.trigger(new Set(touchedIds));
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug) {
    // Look for team in all projects
    const projects = this.getAll().filter(_ref4 => {
      let {
        teams
      } = _ref4;
      return teams.find(_ref5 => {
        let {
          slug
        } = _ref5;
        return slug === teamSlug;
      });
    });
    projects.forEach(project => this.removeTeamFromProject(teamSlug, project));
    const affectedProjectIds = projects.map(project => project.id);
    this.trigger(new Set(affectedProjectIds));
  },

  onRemoveTeam(teamSlug, projectSlug) {
    const project = this.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    this.removeTeamFromProject(teamSlug, project);
    this.trigger(new Set([project.id]));
  },

  onAddTeam(team, projectSlug) {
    const project = this.getBySlug(projectSlug); // Don't do anything if we can't find a project

    if (!project) {
      return;
    }

    const newProject = { ...project,
      teams: [...project.teams, team]
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
    this.trigger(new Set([project.id]));
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug, project) {
    const newTeams = project.teams.filter(_ref6 => {
      let {
        slug
      } = _ref6;
      return slug !== teamSlug;
    });
    const newProject = { ...project,
      teams: newTeams
    };
    this.itemsById = { ...this.itemsById,
      [project.id]: newProject
    };
  },

  isLoading() {
    return this.loading;
  },

  getAll() {
    return Object.values(this.itemsById).sort((a, b) => a.slug.localeCompare(b.slug));
  },

  getById(id) {
    return this.getAll().find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(project => project.slug === slug);
  },

  getState() {
    return {
      projects: this.getAll(),
      loading: this.loading
    };
  }

};
const ProjectsStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectsStore);

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

/***/ "./app/utils/useProjects.tsx":
/*!***********************************!*\
  !*** ./app/utils/useProjects.tsx ***!
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");











/**
 * Helper function to actually load projects
 */
async function fetchProjects(api, orgId) {
  let {
    slugs,
    search,
    limit,
    lastSearch,
    cursor
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const query = {
    // Never return latestDeploys project property from api
    collapse: ['latestDeploys']
  };

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    var _query$query;

    query.query = `${(_query$query = query.query) !== null && _query$query !== void 0 ? _query$query : ''}${search}`.trim();
  }

  const prevSearchMatches = !lastSearch && !search || lastSearch === search;

  if (prevSearchMatches && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore = false;
  let nextCursor = null;
  const [data,, resp] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
    includeAllArgs: true,
    query
  });
  const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

  if (pageLinks) {
    var _paginationObject$nex, _paginationObject$pre, _paginationObject$nex2;

    const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_8__["default"])(pageLinks);
    hasMore = (paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex = paginationObject.next) === null || _paginationObject$nex === void 0 ? void 0 : _paginationObject$nex.results) || (paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$pre = paginationObject.previous) === null || _paginationObject$pre === void 0 ? void 0 : _paginationObject$pre.results);
    nextCursor = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex2 = paginationObject.next) === null || _paginationObject$nex2 === void 0 ? void 0 : _paginationObject$nex2.cursor;
  }

  return {
    results: data,
    hasMore,
    nextCursor
  };
}
/**
 * Provides projects from the ProjectStore
 *
 * This hook also provides a way to select specific project slugs, and search
 * (type-ahead) for more projects that may not be in the project store.
 *
 * NOTE: Currently ALL projects are always loaded, but this hook is designed
 * for future-compat in a world where we do _not_ load all projects.
 */


function useProjects() {
  var _slugs$filter;

  let {
    limit,
    slugs,
    orgId: propOrgId
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const {
    organization
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__.useLegacyStore)(sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_5__["default"]);
  const store = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_7__.useLegacyStore)(sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_6__["default"]);
  const orgId = propOrgId !== null && propOrgId !== void 0 ? propOrgId : organization === null || organization === void 0 ? void 0 : organization.slug;
  const storeSlugs = new Set(store.projects.map(t => t.slug));
  const slugsToLoad = (_slugs$filter = slugs === null || slugs === void 0 ? void 0 : slugs.filter(slug => !storeSlugs.has(slug))) !== null && _slugs$filter !== void 0 ? _slugs$filter : [];
  const shouldLoadSlugs = slugsToLoad.length > 0;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    initiallyLoaded: !store.loading && !shouldLoadSlugs,
    fetching: shouldLoadSlugs,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null
  });
  const slugsRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null); // Only initialize slugsRef.current once and modify it when we receive new
  // slugs determined through set equality

  if (slugs !== undefined) {
    if (slugsRef.current === null) {
      slugsRef.current = new Set(slugs);
    }

    if (slugs.length !== slugsRef.current.size || slugs.some(slug => {
      var _slugsRef$current;

      return !((_slugsRef$current = slugsRef.current) !== null && _slugsRef$current !== void 0 && _slugsRef$current.has(slug));
    })) {
      slugsRef.current = new Set(slugs);
    }
  }

  async function loadProjectsBySlug() {
    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useProjects({slugs}) without an organization in context');
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
      } = await fetchProjects(api, orgId, {
        slugs: slugsToLoad,
        limit
      });
      const fetchedProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...store.projects, ...results], _ref => {
        let {
          slug
        } = _ref;
        return slug;
      });
      sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].loadProjects(fetchedProjects);
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
        initiallyLoaded: !store.loading,
        fetchError: err
      });
    }
  }

  async function handleSearch(search) {
    const {
      lastSearch
    } = state;
    const cursor = state.nextCursor;

    if (search === '') {
      return;
    }

    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useProjects.onSearch without an organization in context');
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
      } = await fetchProjects(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor
      });
      const fetchedProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()([...store.projects, ...results], _ref2 => {
        let {
          slug
        } = _ref2;
        return slug;
      }); // Only update the store if we have more items

      if (fetchedProjects.length > store.projects.length) {
        sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_4__["default"].loadProjects(fetchedProjects);
      }

      setState({ ...state,
        hasMore,
        fetching: false,
        lastSearch: search,
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
    if (shouldLoadSlugs) {
      loadProjectsBySlug();
      return;
    }
  }, [slugsRef.current]); // Update initiallyLoaded when we finish loading within the projectStore

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const storeLoaded = !store.loading;

    if (state.initiallyLoaded === storeLoaded) {
      return;
    }

    if (shouldLoadSlugs) {
      return;
    }

    setState({ ...state,
      initiallyLoaded: storeLoaded
    });
  }, [store.loading]);
  const {
    initiallyLoaded,
    fetching,
    fetchError,
    hasMore
  } = state;
  const filteredProjects = slugs ? store.projects.filter(t => slugs.includes(t.slug)) : store.projects;
  const placeholders = slugsToLoad.map(slug => ({
    slug
  }));
  const result = {
    projects: filteredProjects,
    placeholders,
    fetching: fetching || store.loading,
    initiallyLoaded,
    fetchError,
    hasMore,
    onSearch: handleSearch
  };
  return result;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useProjects);

/***/ }),

/***/ "./app/utils/withProjects.tsx":
/*!************************************!*\
  !*** ./app/utils/withProjects.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
function withProjects(WrappedComponent) {
  const Wrapper = props => {
    const {
      projects,
      initiallyLoaded
    } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_1__["default"])();
    const loadingProjects = !initiallyLoaded;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      projects,
      loadingProjects
    });
  };

  Wrapper.displayName = `withProjects(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return Wrapper;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProjects);

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/ownerInput.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/ownerInput.tsx ***!
  \********************************************************************/
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
/* harmony import */ var react_autosize_textarea__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-autosize-textarea */ "../node_modules/react-autosize-textarea/lib/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _ruleBuilder__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./ruleBuilder */ "./app/views/settings/project/projectOwnership/ruleBuilder.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














const defaultProps = {
  urls: [],
  paths: [],
  disabled: false
};

class OwnerInput extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      hasChanges: false,
      text: null,
      error: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateOwnership", () => {
      const {
        organization,
        project,
        onSave
      } = this.props;
      const {
        text
      } = this.state;
      this.setState({
        error: null
      });
      const api = new sentry_api__WEBPACK_IMPORTED_MODULE_6__.Client();
      const request = api.requestPromise(`/projects/${organization.slug}/${project.slug}/ownership/`, {
        method: 'PUT',
        data: {
          raw: text || ''
        }
      });
      request.then(() => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Updated issue ownership rules'));
        this.setState({
          hasChanges: false,
          text
        }, () => onSave && onSave(text));
      }).catch(error => {
        this.setState({
          error: error.responseJSON
        });

        if (error.status === 403) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)("You don't have permission to modify issue ownership rules for this project"));
        } else if (error.status === 400 && error.responseJSON.raw && error.responseJSON.raw[0].startsWith('Invalid rule owners:')) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unable to save issue ownership rule changes: ' + error.responseJSON.raw[0]));
        } else {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Unable to save issue ownership rule changes'));
        }
      });
      return request;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", e => {
      this.setState({
        hasChanges: true,
        text: e.target.value
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddRule", rule => {
      const {
        initialText
      } = this.props;
      this.setState(_ref => {
        let {
          text
        } = _ref;
        return {
          text: (text || initialText) + '\n' + rule
        };
      }, this.handleUpdateOwnership);
    });
  }

  parseError(error) {
    var _error$raw, _text$match$, _text$match;

    const text = error === null || error === void 0 ? void 0 : (_error$raw = error.raw) === null || _error$raw === void 0 ? void 0 : _error$raw[0];

    if (!text) {
      return null;
    }

    if (text.startsWith('Invalid rule owners:')) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(InvalidOwners, {
        children: text
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SyntaxOverlay, {
      line: parseInt((_text$match$ = (_text$match = text.match(/line (\d*),/)) === null || _text$match === void 0 ? void 0 : _text$match[1]) !== null && _text$match$ !== void 0 ? _text$match$ : '', 10) - 1
    });
  }

  mentionableUsers() {
    return sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__["default"].getAll().map(member => ({
      id: member.id,
      display: member.email,
      email: member.email
    }));
  }

  mentionableTeams() {
    const {
      project
    } = this.props;
    const projectWithTeams = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_10__["default"].getBySlug(project.slug);

    if (!projectWithTeams) {
      return [];
    }

    return projectWithTeams.teams.map(team => ({
      id: team.id,
      display: `#${team.slug}`,
      email: team.id
    }));
  }

  render() {
    const {
      project,
      organization,
      disabled,
      urls,
      paths,
      initialText
    } = this.props;
    const {
      hasChanges,
      text,
      error
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_ruleBuilder__WEBPACK_IMPORTED_MODULE_13__["default"], {
        urls: urls,
        paths: paths,
        organization: organization,
        project: project,
        onAddRule: this.handleAddRule.bind(this),
        disabled: disabled
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
        style: {
          position: 'relative'
        },
        onKeyDown: e => {
          if (e.metaKey && e.key === 'Enter') {
            this.handleUpdateOwnership();
          }
        },
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledTextArea, {
          placeholder: '#example usage\n' + 'path:src/example/pipeline/* person@sentry.io #infra\n' + 'module:com.module.name.example #sdks\n' + 'url:http://example.com/settings/* #product\n' + 'tags.sku_class:enterprise #enterprise',
          onChange: this.handleChange,
          disabled: disabled,
          value: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(text) ? text : initialText,
          spellCheck: "false",
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "off"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ActionBar, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
            children: this.parseError(error)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(SaveButton, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              size: "sm",
              priority: "primary",
              onClick: this.handleUpdateOwnership,
              disabled: disabled || !hasChanges,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Save Changes')
            })
          })]
        })]
      })]
    });
  }

}

OwnerInput.displayName = "OwnerInput";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(OwnerInput, "defaultProps", defaultProps);

const TEXTAREA_PADDING = 4;
const TEXTAREA_LINE_HEIGHT = 24;

const ActionBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "elg57ml4"
} : 0)( true ? {
  name: "bcffy2",
  styles: "display:flex;align-items:center;justify-content:space-between"
} : 0);

const SyntaxOverlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "elg57ml3"
} : 0)(sentry_styles_input__WEBPACK_IMPORTED_MODULE_11__.inputStyles, ";width:100%;height:", TEXTAREA_LINE_HEIGHT, "px;background-color:red;opacity:0.1;pointer-events:none;position:absolute;top:", _ref2 => {
  let {
    line
  } = _ref2;
  return TEXTAREA_PADDING + line * 24;
}, "px;" + ( true ? "" : 0));

const SaveButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "elg57ml2"
} : 0)( true ? {
  name: "1cw129c",
  styles: "text-align:end;padding-top:10px"
} : 0);

const StyledTextArea = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(react_autosize_textarea__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "elg57ml1"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_11__.inputStyles)(p), ";min-height:140px;overflow:auto;outline:0;width:100%;resize:none;margin:0;font-family:", p => p.theme.text.familyMono, ";word-break:break-all;white-space:pre-wrap;padding-top:", TEXTAREA_PADDING, "px;line-height:", TEXTAREA_LINE_HEIGHT, "px;" + ( true ? "" : 0));

const InvalidOwners = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "elg57ml0"
} : 0)("color:", p => p.theme.error, ";font-weight:bold;margin-top:12px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OwnerInput);

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/ruleBuilder.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/ruleBuilder.tsx ***!
  \*********************************************************************/
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
/* harmony import */ var sentry_components_deprecatedforms_selectField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/deprecatedforms/selectField */ "./app/components/deprecatedforms/selectField.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_project_projectOwnership_selectOwners__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/project/projectOwnership/selectOwners */ "./app/views/settings/project/projectOwnership/selectOwners.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const initialState = {
  text: '',
  tagName: '',
  type: 'path',
  owners: [],
  isValid: false
};

function getMatchPlaceholder(type) {
  switch (type) {
    case 'path':
      return 'src/example/*';

    case 'module':
      return 'com.module.name.example';

    case 'url':
      return 'https://example.com/settings/*';

    case 'tag':
      return 'tag-value';

    default:
      return '';
  }
}

class RuleBuilder extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "checkIsValid", () => {
      this.setState(state => ({
        isValid: !!state.text && state.owners && !!state.owners.length
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTypeChange", val => {
      this.setState({
        type: val
      }); // TODO(ts): Add select value type as generic to select controls

      this.checkIsValid();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTagNameChangeValue", e => {
      this.setState({
        tagName: e.target.value
      }, this.checkIsValid);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeValue", e => {
      this.setState({
        text: e.target.value
      });
      this.checkIsValid();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeOwners", owners => {
      this.setState({
        owners
      });
      this.checkIsValid();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddRule", () => {
      const {
        type,
        text,
        tagName,
        owners,
        isValid
      } = this.state;

      if (!isValid) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)('A rule needs a type, a value, and one or more issue owners.');
        return;
      }

      const ownerText = owners.map(owner => {
        var _MemberListStore$getB;

        return owner.actor.type === 'team' ? `#${owner.actor.name}` : (_MemberListStore$getB = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_12__["default"].getById(owner.actor.id)) === null || _MemberListStore$getB === void 0 ? void 0 : _MemberListStore$getB.email;
      }).join(' ');
      const quotedText = text.match(/\s/) ? `"${text}"` : text;
      const rule = `${type === 'tag' ? `tags.${tagName}` : type}:${quotedText} ${ownerText}`;
      this.props.onAddRule(rule);
      this.setState(initialState);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSelectCandidate", (text, type) => {
      this.setState({
        text,
        type
      });
      this.checkIsValid();
    });
  }

  render() {
    const {
      urls,
      paths,
      disabled,
      project,
      organization
    } = this.props;
    const {
      type,
      text,
      tagName,
      owners,
      isValid
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(paths || urls) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Candidates, {
        children: [paths && paths.map(v => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(RuleCandidate, {
          onClick: () => this.handleSelectCandidate(v, 'path'),
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledIconAdd, {
            isCircled: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledTextOverflow, {
            children: v
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Path')
          })]
        }, v)), urls && urls.map(v => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(RuleCandidate, {
          onClick: () => this.handleSelectCandidate(v, 'url'),
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledIconAdd, {
            isCircled: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledTextOverflow, {
            children: v
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('URL')
          })]
        }, v))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(BuilderBar, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(BuilderSelect, {
          name: "select-type",
          value: type,
          onChange: this.handleTypeChange,
          options: [{
            value: 'path',
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Path')
          }, {
            value: 'module',
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Module')
          }, {
            value: 'tag',
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Tag')
          }, {
            value: 'url',
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('URL')
          }],
          style: {
            width: 140
          },
          clearable: false,
          disabled: disabled
        }), type === 'tag' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(BuilderTagNameInput, {
          value: tagName,
          onChange: this.handleTagNameChangeValue,
          disabled: disabled,
          placeholder: "tag-name"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(BuilderInput, {
          value: text,
          onChange: this.handleChangeValue,
          disabled: disabled,
          placeholder: getMatchPlaceholder(type)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Divider, {
          direction: "right"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SelectOwnersWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_project_projectOwnership_selectOwners__WEBPACK_IMPORTED_MODULE_14__["default"], {
            organization: organization,
            project: project,
            value: owners,
            onChange: this.handleChangeOwners,
            disabled: disabled
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(AddButton, {
          priority: "primary",
          disabled: !isValid,
          onClick: this.handleAddRule,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconAdd, {
            isCircled: true
          }),
          size: "sm",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Add rule')
        })]
      })]
    });
  }

}

RuleBuilder.displayName = "RuleBuilder";

const Candidates = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1oeciqa10"
} : 0)( true ? {
  name: "pr10xp",
  styles: "margin-bottom:10px"
} : 0);

const StyledTextOverflow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1oeciqa9"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const RuleCandidate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1oeciqa8"
} : 0)("font-family:", p => p.theme.text.familyMono, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";background-color:", p => p.theme.background, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";cursor:pointer;overflow:hidden;display:flex;align-items:center;" + ( true ? "" : 0));

const StyledIconAdd = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconAdd,  true ? {
  target: "e1oeciqa7"
} : 0)("color:", p => p.theme.border, ";margin-right:5px;flex-shrink:0;" + ( true ? "" : 0));

const BuilderBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1oeciqa6"
} : 0)("display:flex;height:40px;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";" + ( true ? "" : 0));

const BuilderSelect = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_deprecatedforms_selectField__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1oeciqa5"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";width:50px;flex-shrink:0;" + ( true ? "" : 0));

const BuilderInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1oeciqa4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";line-height:19px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

const BuilderTagNameInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1oeciqa3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";line-height:19px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";width:200px;" + ( true ? "" : 0));

const Divider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconChevron,  true ? {
  target: "e1oeciqa2"
} : 0)("color:", p => p.theme.border, ";flex-shrink:0;margin-right:5px;" + ( true ? "" : 0));

const SelectOwnersWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1oeciqa1"
} : 0)("display:flex;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const AddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1oeciqa0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RuleBuilder);

/***/ }),

/***/ "./app/views/settings/project/projectOwnership/selectOwners.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/project/projectOwnership/selectOwners.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_deprecatedforms_multiSelectControl__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/deprecatedforms/multiSelectControl */ "./app/components/deprecatedforms/multiSelectControl.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/projectsStore */ "./app/stores/projectsStore.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























function ValueComponent(_ref) {
  let {
    data,
    removeProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ValueWrapper, {
    onClick: removeProps.onClick,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_9__["default"], {
      actor: data.actor,
      size: 28
    })
  });
}

ValueComponent.displayName = "ValueComponent";

const getSearchKeyForUser = user => `${user.email && user.email.toLowerCase()} ${user.name && user.name.toLowerCase()}`;

var _ref6 =  true ? {
  name: "833hqy",
  styles: "width:200px"
} : 0;

class SelectOwners extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      inputValue: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "selectRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderUserBadge", user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
      avatarSize: 24,
      user: user,
      hideEmail: true,
      useLink: false
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createMentionableUser", user => ({
      value: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_20__.buildUserId)(user.id),
      label: this.renderUserBadge(user),
      searchKey: getSearchKeyForUser(user),
      actor: {
        type: 'user',
        id: user.id,
        name: user.name
      }
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createUnmentionableUser", _ref2 => {
      let {
        user
      } = _ref2;
      return { ...this.createMentionableUser(user),
        disabled: true,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(DisabledLabel, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
            position: "left",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('%s is not a member of project', user.name || user.email),
            children: this.renderUserBadge(user)
          })
        })
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createMentionableTeam", team => ({
      value: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_20__.buildTeamId)(team.id),
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
        team: team
      }),
      searchKey: `#${team.slug}`,
      actor: {
        type: 'team',
        id: team.id,
        name: team.slug
      }
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createUnmentionableTeam", team => {
      const {
        organization
      } = this.props;
      const canAddTeam = organization.access.includes('project:write');
      return { ...this.createMentionableTeam(team),
        disabled: true,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Container, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(DisabledLabel, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
              position: "left",
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('%s is not a member of project', `#${team.slug}`),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
                team: team
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
            title: canAddTeam ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add %s to project', `#${team.slug}`) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('You do not have permission to add team to project.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AddToProjectButton, {
              size: "zero",
              borderless: true,
              disabled: !canAddTeam,
              onClick: this.handleAddTeamToProject.bind(this, team),
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconAdd, {
                isCircled: true
              }),
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add %s to project', `#${team.slug}`)
            })
          })]
        })
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", newValue => {
      this.props.onChange(newValue);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInputChange", inputValue => {
      this.setState({
        inputValue
      });

      if (this.props.onInputChange) {
        this.props.onInputChange(inputValue);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "queryMembers", lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()((query, cb) => {
      const {
        api,
        organization
      } = this.props; // Because this function is debounced, the component can potentially be
      // unmounted before this fires, in which case, `this.api` is null

      if (!api) {
        return null;
      }

      return api.requestPromise(`/organizations/${organization.slug}/members/`, {
        query: {
          query
        }
      }).then(data => cb(null, data), err => cb(err));
    }, 250));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLoadOptions", () => {
      const usersInProject = this.getMentionableUsers();
      const teamsInProject = this.getMentionableTeams();
      const teamsNotInProject = this.getTeamsNotInProject(teamsInProject);
      const usersInProjectById = usersInProject.map(_ref3 => {
        let {
          actor
        } = _ref3;
        return actor.id;
      }); // Return a promise for `react-select`

      return new Promise((resolve, reject) => {
        this.queryMembers(this.state.inputValue, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      }).then(members => // Be careful here as we actually want the `users` object, otherwise it means user
      // has not registered for sentry yet, but has been invited
      members ? members.filter(_ref4 => {
        let {
          user
        } = _ref4;
        return user && usersInProjectById.indexOf(user.id) === -1;
      }).map(this.createUnmentionableUser) : []).then(members => {
        return [...usersInProject, ...teamsInProject, ...teamsNotInProject, ...members];
      });
    });
  }

  componentDidUpdate(prevProps) {
    // Once a team has been added to the project the menu can be closed.
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()(this.props.projects, prevProps.projects)) {
      this.closeSelectMenu();
    }
  }

  getMentionableUsers() {
    return sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_16__["default"].getAll().map(this.createMentionableUser);
  }

  getMentionableTeams() {
    const {
      project
    } = this.props;
    const projectData = sentry_stores_projectsStore__WEBPACK_IMPORTED_MODULE_17__["default"].getBySlug(project.slug);

    if (!projectData) {
      return [];
    }

    return projectData.teams.map(this.createMentionableTeam);
  }
  /**
   * Get list of teams that are not in the current project, for use in `MultiSelectMenu`
   */


  getTeamsNotInProject() {
    let teamsInProject = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    const teams = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_18__["default"].getAll() || [];
    const excludedTeamIds = teamsInProject.map(_ref5 => {
      let {
        actor
      } = _ref5;
      return actor.id;
    });
    return teams.filter(team => excludedTeamIds.indexOf(team.id) === -1).map(this.createUnmentionableTeam);
  }
  /**
   * Closes the select menu by blurring input if possible since that seems to be the only
   * way to close it.
   */


  closeSelectMenu() {
    // Close select menu
    if (this.selectRef.current) {
      // eslint-disable-next-line react/no-find-dom-node
      const node = (0,react_dom__WEBPACK_IMPORTED_MODULE_5__.findDOMNode)(this.selectRef.current);
      const input = node === null || node === void 0 ? void 0 : node.querySelector('.Select-input input');

      if (input) {
        // I don't think there's another way to close `react-select`
        input.blur();
      }
    }
  }

  async handleAddTeamToProject(team) {
    const {
      api,
      organization,
      project,
      value
    } = this.props; // Copy old value

    const oldValue = [...value]; // Optimistic update

    this.props.onChange([...this.props.value, this.createMentionableTeam(team)]);

    try {
      // Try to add team to project
      // Note: we can't close select menu here because we have to wait for ProjectsStore to update first
      // The reason for this is because we have little control over `react-select`'s `AsyncSelect`
      // We can't control when `handleLoadOptions` gets called, but it gets called when select closes, so
      // wait for store to update before closing the menu. Otherwise, we'll have stale items in the select menu
      await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_8__.addTeamToProject)(api, organization.slug, project.slug, team);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange(oldValue);
      this.closeSelectMenu();
    }
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_deprecatedforms_multiSelectControl__WEBPACK_IMPORTED_MODULE_11__["default"], {
      name: "owners",
      filterOption: (option, filterText) => option.data.searchKey.indexOf(filterText) > -1,
      ref: this.selectRef,
      loadOptions: this.handleLoadOptions,
      defaultOptions: true,
      async: true,
      clearable: true,
      disabled: this.props.disabled,
      cache: false,
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('owners'),
      components: {
        MultiValue: ValueComponent
      },
      onInputChange: this.handleInputChange,
      onChange: this.handleChange,
      value: this.props.value,
      css: _ref6
    });
  }

}

SelectOwners.displayName = "SelectOwners";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__["default"])(SelectOwners)));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1t7855i3"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);

const DisabledLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1t7855i2"
} : 0)( true ? {
  name: "16ooxei",
  styles: "opacity:0.5;overflow:hidden"
} : 0);

const AddToProjectButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1t7855i1"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const ValueWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "e1t7855i0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectOwnership_ownerInput_tsx.2c490d32e64b7dc18a2de5db1b869313.js.map