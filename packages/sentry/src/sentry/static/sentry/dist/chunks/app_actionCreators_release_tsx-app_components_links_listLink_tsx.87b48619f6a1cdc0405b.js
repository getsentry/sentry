"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_release_tsx-app_components_links_listLink_tsx"],{

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_release_tsx-app_components_links_listLink_tsx.661861f29aa76c92592859dcebe7b149.js.map