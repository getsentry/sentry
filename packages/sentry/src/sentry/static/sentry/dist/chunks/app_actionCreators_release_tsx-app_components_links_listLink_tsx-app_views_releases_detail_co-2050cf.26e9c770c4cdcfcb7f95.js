"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_release_tsx-app_components_links_listLink_tsx-app_views_releases_detail_co-2050cf"],{

/***/ "./app/actionCreators/release.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/release.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "archiveRelease": () => (/* binding */ archiveRelease),
/* harmony export */   "getProjectRelease": () => (/* binding */ getProjectRelease),
/* harmony export */   "getReleaseDeploys": () => (/* binding */ getReleaseDeploys),
/* harmony export */   "restoreRelease": () => (/* binding */ restoreRelease)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/releaseStore */ "./app/stores/releaseStore.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");






function getProjectRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(releaseVersion)}/`; // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRelease for the same
  // release to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.releaseLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getRelease-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function getReleaseDeploys(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/organizations/${orgSlug}/releases/${encodeURIComponent(releaseVersion)}/deploys/`; // HACK(leedongwei): Same as above

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.deploysLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploys(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getReleaseDeploys-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function archiveRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Archiving Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Archived,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully archived.'));
  }).catch(error => {
    var _error$responseJSON$d, _error$responseJSON;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail) !== null && _error$responseJSON$d !== void 0 ? _error$responseJSON$d : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be archived.'));
    throw error;
  });
}
function restoreRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Restoring Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Active,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully restored.'));
  }).catch(error => {
    var _error$responseJSON$d2, _error$responseJSON2;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d2 = (_error$responseJSON2 = error.responseJSON) === null || _error$responseJSON2 === void 0 ? void 0 : _error$responseJSON2.detail) !== null && _error$responseJSON$d2 !== void 0 ? _error$responseJSON$d2 : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be restored.'));
    throw error;
  });
}

/***/ }),

/***/ "./app/actionCreators/repositories.tsx":
/*!*********************************************!*\
  !*** ./app/actionCreators/repositories.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getRepositories": () => (/* binding */ getRepositories)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/stores/repositoryStore */ "./app/stores/repositoryStore.tsx");



function getRepositories(api, params) {
  const {
    orgSlug
  } = params;
  const path = `/organizations/${orgSlug}/repos/`; // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRepo for the same
  // repo to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.

  sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_1__["default"].state.repositoriesLoading = true;
  sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositories(orgSlug);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositoriesSuccess(res);
  }).catch(err => {
    sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_0__["default"].loadRepositoriesError(err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_2__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getRepositories-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_2__.captureException(err);
    });
  });
}

/***/ }),

/***/ "./app/actions/releaseActions.tsx":
/*!****************************************!*\
  !*** ./app/actions/releaseActions.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const ReleaseActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['loadRelease', // Singular as it loads 1 release
'loadReleaseError', 'loadReleaseSuccess', 'loadDeploys', // Plural as it loads all deploys related to a release
'loadDeploysError', 'loadDeploysSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseActions);

/***/ }),

/***/ "./app/actions/repositoryActions.tsx":
/*!*******************************************!*\
  !*** ./app/actions/repositoryActions.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const RepositoryActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['resetRepositories', 'loadRepositories', 'loadRepositoriesError', 'loadRepositoriesSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositoryActions);

/***/ }),

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/stores/releaseStore.tsx":
/*!*************************************!*\
  !*** ./app/stores/releaseStore.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getReleaseStoreKey": () => (/* binding */ getReleaseStoreKey)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const getReleaseStoreKey = (projectSlug, releaseVersion) => `${projectSlug}${releaseVersion}`;
const storeConfig = {
  state: {
    orgSlug: undefined,
    release: new Map(),
    releaseLoading: new Map(),
    releaseError: new Map(),
    deploys: new Map(),
    deploysLoading: new Map(),
    deploysError: new Map()
  },
  listenables: sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__["default"],
  unsubscribeListeners: [],

  init() {
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.updateOrganization));
    this.reset();
  },

  reset() {
    this.state = {
      orgSlug: undefined,
      release: new Map(),
      releaseLoading: new Map(),
      releaseError: new Map(),
      deploys: new Map(),
      deploysLoading: new Map(),
      deploysError: new Map()
    };
    this.trigger(this.state);
  },

  updateOrganization(org) {
    this.reset();
    this.state.orgSlug = org.slug;
    this.trigger(this.state);
  },

  loadRelease(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: true
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadReleaseError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadReleaseSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      release,
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      release: { ...release,
        [releaseKey]: data
      },
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploys(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: true
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploysError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadDeploysSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploys,
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploys: { ...deploys,
        [releaseKey]: data
      },
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  get(projectSlug, releaseVersion) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    return {
      release: this.state.release[releaseKey],
      releaseLoading: this.state.releaseLoading[releaseKey],
      releaseError: this.state.releaseError[releaseKey],
      deploys: this.state.deploys[releaseKey],
      deploysLoading: this.state.deploysLoading[releaseKey],
      deploysError: this.state.deploysError[releaseKey]
    };
  }

};
const ReleaseStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseStore);

/***/ }),

/***/ "./app/stores/repositoryStore.tsx":
/*!****************************************!*\
  !*** ./app/stores/repositoryStore.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");



const storeConfig = {
  listenables: sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_1__["default"],
  state: {
    orgSlug: undefined,
    repositories: undefined,
    repositoriesLoading: undefined,
    repositoriesError: undefined
  },

  init() {
    this.resetRepositories();
  },

  resetRepositories() {
    this.state = {
      orgSlug: undefined,
      repositories: undefined,
      repositoriesLoading: undefined,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  loadRepositories(orgSlug) {
    this.state = {
      orgSlug,
      repositories: orgSlug === this.state.orgSlug ? this.state.repositories : undefined,
      repositoriesLoading: true,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  loadRepositoriesError(err) {
    this.state = { ...this.state,
      repositories: undefined,
      repositoriesLoading: false,
      repositoriesError: err
    };
    this.trigger(this.state);
  },

  loadRepositoriesSuccess(data) {
    this.state = { ...this.state,
      repositories: data,
      repositoriesLoading: false,
      repositoriesError: undefined
    };
    this.trigger(this.state);
  },

  get() {
    return { ...this.state
    };
  }

};
const RepositoryStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_2__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositoryStore);

/***/ }),

/***/ "./app/utils/withRepositories.tsx":
/*!****************************************!*\
  !*** ./app/utils/withRepositories.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_repositories__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/repositories */ "./app/actionCreators/repositories.tsx");
/* harmony import */ var sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/repositoryActions */ "./app/actions/repositoryActions.tsx");
/* harmony import */ var sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/repositoryStore */ "./app/stores/repositoryStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const INITIAL_STATE = {
  repositories: undefined,
  repositoriesLoading: undefined,
  repositoriesError: undefined
};

function withRepositories(WrappedComponent) {
  class WithRepositories extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    constructor(props, context) {
      super(props, context);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(() => this.onStoreUpdate(), undefined));

      const {
        organization
      } = this.props;
      const orgSlug = organization.slug;
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get();

      if (repoData.orgSlug !== orgSlug) {
        sentry_actions_repositoryActions__WEBPACK_IMPORTED_MODULE_3__["default"].resetRepositories();
      }

      this.state = repoData.orgSlug === orgSlug ? { ...INITIAL_STATE,
        ...repoData
      } : { ...INITIAL_STATE
      };
    }

    componentDidMount() {
      // XXX(leedongwei): Do not move this function call unless you modify the
      // unit test named "prevents repeated calls"
      this.fetchRepositories();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    fetchRepositories() {
      const {
        api,
        organization
      } = this.props;
      const orgSlug = organization.slug;
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get(); // XXX(leedongwei): Do not check the orgSlug here. It would have been
      // verified at `getInitialState`. The short-circuit hack in actionCreator
      // does not update the orgSlug in the store.

      if (!repoData.repositories && !repoData.repositoriesLoading || repoData.repositoriesError) {
        (0,sentry_actionCreators_repositories__WEBPACK_IMPORTED_MODULE_2__.getRepositories)(api, {
          orgSlug
        });
      }
    }

    onStoreUpdate() {
      const repoData = sentry_stores_repositoryStore__WEBPACK_IMPORTED_MODULE_4__["default"].get();
      this.setState({ ...repoData
      });
    }

    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(WrappedComponent, { ...this.props,
        ...this.state
      });
    }

  }

  WithRepositories.displayName = "WithRepositories";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithRepositories, "displayName", `withRepositories(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__["default"])(WrappedComponent)})`);

  return WithRepositories;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withRepositories);

/***/ }),

/***/ "./app/views/releases/detail/commitsAndFiles/emptyState.tsx":
/*!******************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/emptyState.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const EmptyState = _ref => {
  let {
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
          children: children
        })
      })
    })
  });
};

EmptyState.displayName = "EmptyState";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmptyState);

/***/ }),

/***/ "./app/views/releases/detail/commitsAndFiles/repositorySwitcher.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/repositorySwitcher.tsx ***!
  \**************************************************************************/
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
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class RepositorySwitcher extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRepoFilterChange", activeRepo => {
      const {
        router,
        location
      } = this.props;
      router.push({ ...location,
        query: { ...location.query,
          cursor: undefined,
          activeRepo
        }
      });
    });
  }

  render() {
    const {
      activeRepository,
      repositories
    } = this.props;
    const activeRepo = activeRepository === null || activeRepository === void 0 ? void 0 : activeRepository.name;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledCompactSelect, {
      triggerLabel: activeRepo,
      triggerProps: {
        prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Filter')
      },
      value: activeRepo,
      options: repositories.map(repo => ({
        value: repo.name,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(RepoLabel, {
          children: repo.name
        })
      })),
      onChange: opt => this.handleRepoFilterChange(opt === null || opt === void 0 ? void 0 : opt.value)
    });
  }

}

RepositorySwitcher.displayName = "RepositorySwitcher";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RepositorySwitcher);

const StyledCompactSelect = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e17qagoc1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const RepoLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e17qagoc0"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/releases/detail/commitsAndFiles/withReleaseRepos.tsx":
/*!************************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/withReleaseRepos.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withRepositories__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withRepositories */ "./app/utils/withRepositories.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! .. */ "./app/views/releases/detail/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















 // These props are required when using this HoC



function withReleaseRepos(WrappedComponent) {
  class WithReleaseRepos extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        releaseRepos: [],
        isLoading: true
      });
    }

    componentDidMount() {
      this.fetchReleaseRepos();
    }

    componentDidUpdate(prevProps, prevState) {
      var _prevProps$location$q, _this$props$location$;

      if (this.props.params.release !== prevProps.params.release || !!prevProps.repositoriesLoading && !this.props.repositoriesLoading) {
        this.fetchReleaseRepos();
        return;
      }

      if (prevState.releaseRepos.length !== this.state.releaseRepos.length || ((_prevProps$location$q = prevProps.location.query) === null || _prevProps$location$q === void 0 ? void 0 : _prevProps$location$q.activeRepo) !== ((_this$props$location$ = this.props.location.query) === null || _this$props$location$ === void 0 ? void 0 : _this$props$location$.activeRepo)) {
        this.setActiveReleaseRepo(this.props);
      }
    }

    setActiveReleaseRepo(props) {
      var _props$location$query;

      const {
        releaseRepos,
        activeReleaseRepo
      } = this.state;

      if (!releaseRepos.length) {
        return;
      }

      const activeCommitRepo = (_props$location$query = props.location.query) === null || _props$location$query === void 0 ? void 0 : _props$location$query.activeRepo;

      if (!activeCommitRepo) {
        var _releaseRepos$;

        this.setState({
          activeReleaseRepo: (_releaseRepos$ = releaseRepos[0]) !== null && _releaseRepos$ !== void 0 ? _releaseRepos$ : null
        });
        return;
      }

      if (activeCommitRepo === (activeReleaseRepo === null || activeReleaseRepo === void 0 ? void 0 : activeReleaseRepo.name)) {
        return;
      }

      const matchedRepository = releaseRepos.find(commitRepo => commitRepo.name === activeCommitRepo);

      if (matchedRepository) {
        this.setState({
          activeReleaseRepo: matchedRepository
        });
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('The repository you were looking for was not found.'));
    }

    async fetchReleaseRepos() {
      const {
        params,
        api,
        repositories,
        repositoriesLoading
      } = this.props;

      if (repositoriesLoading === undefined || repositoriesLoading === true) {
        return;
      }

      if (!(repositories !== null && repositories !== void 0 && repositories.length)) {
        this.setState({
          isLoading: false
        });
        return;
      }

      const {
        release,
        orgId
      } = params;
      const {
        project
      } = this.context;
      this.setState({
        isLoading: true
      });

      try {
        const releasePath = encodeURIComponent(release);
        const releaseRepos = await api.requestPromise(`/projects/${orgId}/${project.slug}/releases/${releasePath}/repositories/`);
        this.setState({
          releaseRepos,
          isLoading: false
        });
        this.setActiveReleaseRepo(this.props);
      } catch (error) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_16__.captureException(error);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An error occurred while trying to fetch the repositories of the release: %s', release));
      }
    }

    render() {
      const {
        isLoading,
        activeReleaseRepo,
        releaseRepos
      } = this.state;
      const {
        repositoriesLoading,
        repositories,
        params,
        router,
        location,
        organization
      } = this.props;

      if (isLoading || repositoriesLoading) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__["default"], {});
      }

      const noRepositoryOrgRelatedFound = !(repositories !== null && repositories !== void 0 && repositories.length);

      if (noRepositoryOrgRelatedFound) {
        const {
          orgId
        } = params;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Main, {
            fullWidth: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
              dashedBorder: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconCommit, {
                  size: "xl"
                }),
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Releases are better with commit data!'),
                description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Connect a repository to see commit info, files changed, and authors involved in future releases.'),
                action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  priority: "primary",
                  to: `/settings/${orgId}/repos/`,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Connect a repository')
                })
              })
            })
          })
        });
      }

      const noReleaseReposFound = !releaseRepos.length;

      if (noReleaseReposFound) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Main, {
            fullWidth: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
              dashedBorder: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_14__["default"], {
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconCommit, {
                  size: "xl"
                }),
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Releases are better with commit data!'),
                description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No commits associated with this release have been found.')
              })
            })
          })
        });
      }

      if (activeReleaseRepo === undefined) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_6__["default"], {});
      }

      const {
        release
      } = params;
      const orgSlug = organization.slug;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(WrappedComponent, { ...this.props,
        orgSlug: orgSlug,
        projectSlug: this.context.project.slug,
        release: release,
        router: router,
        location: location,
        releaseRepos: releaseRepos,
        activeReleaseRepo: activeReleaseRepo
      });
    }

  }

  WithReleaseRepos.displayName = "WithReleaseRepos";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithReleaseRepos, "displayName", `withReleaseRepos(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_10__["default"])(WrappedComponent)})`);

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithReleaseRepos, "contextType", ___WEBPACK_IMPORTED_MODULE_15__.ReleaseContext);

  return (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])((0,sentry_utils_withRepositories__WEBPACK_IMPORTED_MODULE_13__["default"])(WithReleaseRepos)));
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withReleaseRepos);

/***/ }),

/***/ "./app/views/releases/detail/utils.tsx":
/*!*********************************************!*\
  !*** ./app/views/releases/detail/utils.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateReleaseMarkLines": () => (/* binding */ generateReleaseMarkLines),
/* harmony export */   "getCommitsByRepository": () => (/* binding */ getCommitsByRepository),
/* harmony export */   "getFilesByRepository": () => (/* binding */ getFilesByRepository),
/* harmony export */   "getQuery": () => (/* binding */ getQuery),
/* harmony export */   "getReposToRender": () => (/* binding */ getReposToRender),
/* harmony export */   "releaseComparisonChartHelp": () => (/* binding */ releaseComparisonChartHelp),
/* harmony export */   "releaseComparisonChartLabels": () => (/* binding */ releaseComparisonChartLabels),
/* harmony export */   "releaseComparisonChartTitles": () => (/* binding */ releaseComparisonChartTitles),
/* harmony export */   "releaseMarkLinesLabels": () => (/* binding */ releaseMarkLinesLabels)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector/utils */ "./app/components/organizations/timeRangeSelector/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");












/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 */
function getFilesByRepository(fileList) {
  return fileList.reduce((filesByRepository, file) => {
    const {
      filename,
      repoName,
      author,
      type
    } = file;

    if (!filesByRepository.hasOwnProperty(repoName)) {
      filesByRepository[repoName] = {};
    }

    if (!filesByRepository[repoName].hasOwnProperty(filename)) {
      filesByRepository[repoName][filename] = {
        authors: {},
        types: new Set()
      };
    }

    if (author.email) {
      filesByRepository[repoName][filename].authors[author.email] = author;
    }

    filesByRepository[repoName][filename].types.add(type);
    return filesByRepository;
  }, {});
}
/**
 * Convert list of individual commits into a summary grouped by repository
 */

function getCommitsByRepository(commitList) {
  return commitList.reduce((commitsByRepository, commit) => {
    var _commit$repository$na, _commit$repository;

    const repositoryName = (_commit$repository$na = (_commit$repository = commit.repository) === null || _commit$repository === void 0 ? void 0 : _commit$repository.name) !== null && _commit$repository$na !== void 0 ? _commit$repository$na : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('unknown');

    if (!commitsByRepository.hasOwnProperty(repositoryName)) {
      commitsByRepository[repositoryName] = [];
    }

    commitsByRepository[repositoryName].push(commit);
    return commitsByRepository;
  }, {});
}
/**
 * Get request query according to the url params and active repository
 */

function getQuery(_ref) {
  let {
    location,
    perPage = 40,
    activeRepository
  } = _ref;
  const query = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.URL_PARAM), 'cursor']),
    per_page: perPage
  };

  if (!activeRepository) {
    return query;
  }

  return { ...query,
    repo_name: activeRepository.name
  };
}
/**
 * Get repositories to render according to the activeRepository
 */

function getReposToRender(repos, activeRepository) {
  if (!activeRepository) {
    return repos;
  }

  return [activeRepository.name];
}
const releaseComparisonChartLabels = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_DURATION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Duration p50'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERROR_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Error Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.TRANSACTION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Transaction Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.FAILURE_RATE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Failure Rate')
};
const releaseComparisonChartTitles = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_DURATION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Duration'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERROR_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Error Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.TRANSACTION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Transaction Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.FAILURE_RATE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Failure Rate')
};
const releaseComparisonChartHelp = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.commonTermsDescription[_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.SessionTerm.CRASH_FREE_SESSIONS],
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.commonTermsDescription[_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.SessionTerm.CRASH_FREE_USERS],
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('The number of sessions in a given period.'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('The number of users in a given period.')
};

function generateReleaseMarkLine(title, position, theme, options) {
  const {
    hideLabel,
    axisIndex
  } = options || {};
  return {
    seriesName: title,
    type: 'line',
    data: [{
      name: position,
      value: null
    }],
    // TODO(ts): echart types
    yAxisIndex: axisIndex !== null && axisIndex !== void 0 ? axisIndex : undefined,
    xAxisIndex: axisIndex !== null && axisIndex !== void 0 ? axisIndex : undefined,
    color: theme.gray300,
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_3__["default"])({
      silent: true,
      lineStyle: {
        color: theme.gray300,
        type: 'solid'
      },
      label: {
        position: 'insideEndBottom',
        formatter: hideLabel ? '' : title,
        // @ts-expect-error weird echart types
        font: 'Rubik',
        fontSize: 11
      },
      data: [{
        xAxis: position
      }]
    })
  };
}

const releaseMarkLinesLabels = {
  created: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Release Created'),
  adopted: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Adopted'),
  unadopted: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Replaced')
};
function generateReleaseMarkLines(release, project, theme, location, options) {
  var _release$adoptionStag;

  const markLines = [];
  const adoptionStages = (_release$adoptionStag = release.adoptionStages) === null || _release$adoptionStag === void 0 ? void 0 : _release$adoptionStag[project.slug];
  const isSingleEnv = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeList)(location.query.environment).length === 1;
  const releaseBounds = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getReleaseBounds)(release);
  const {
    statsPeriod,
    ...releaseParamsRest
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getReleaseParams)({
    location,
    releaseBounds
  });
  let {
    start,
    end
  } = releaseParamsRest;
  const isDefaultPeriod = !(location.query.pageStart || location.query.pageEnd || location.query.pageStatsPeriod);

  if (statsPeriod) {
    const parsedStatsPeriod = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_4__.parseStatsPeriod)(statsPeriod, null);
    start = parsedStatsPeriod.start;
    end = parsedStatsPeriod.end;
  }

  const releaseCreated = moment__WEBPACK_IMPORTED_MODULE_2___default()(release.dateCreated).startOf('minute');

  if (releaseCreated.isBetween(start, end) || isDefaultPeriod && releaseBounds.type === 'normal') {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.created, releaseCreated.valueOf(), theme, options));
  }

  if (!isSingleEnv || !(0,_utils__WEBPACK_IMPORTED_MODULE_9__.isMobileRelease)(project.platform)) {
    // for now want to show marklines only on mobile platforms with single environment selected
    return markLines;
  }

  const releaseAdopted = (adoptionStages === null || adoptionStages === void 0 ? void 0 : adoptionStages.adopted) && moment__WEBPACK_IMPORTED_MODULE_2___default()(adoptionStages.adopted);

  if (releaseAdopted && releaseAdopted.isBetween(start, end)) {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.adopted, releaseAdopted.valueOf(), theme, options));
  }

  const releaseReplaced = (adoptionStages === null || adoptionStages === void 0 ? void 0 : adoptionStages.unadopted) && moment__WEBPACK_IMPORTED_MODULE_2___default()(adoptionStages.unadopted);

  if (releaseReplaced && releaseReplaced.isBetween(start, end)) {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.unadopted, releaseReplaced.valueOf(), theme, options));
  }

  return markLines;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_release_tsx-app_components_links_listLink_tsx-app_views_releases_detail_co-2050cf.3037b7ec8007a64a215a14f26606c839.js.map