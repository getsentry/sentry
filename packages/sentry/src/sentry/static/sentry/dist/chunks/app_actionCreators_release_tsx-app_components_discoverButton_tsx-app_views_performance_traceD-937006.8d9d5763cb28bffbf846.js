"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_release_tsx-app_components_discoverButton_tsx-app_views_performance_traceD-937006"],{

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

/***/ "./app/components/discover/discoverFeature.tsx":
/*!*****************************************************!*\
  !*** ./app/components/discover/discoverFeature.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Provide a component that passes a prop to indicate if the current
 * organization doesn't have access to discover results.
 */
function DiscoverFeature(_ref) {
  let {
    children
  } = _ref;
  const noFeatureMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Requires discover feature.');

  const renderDisabled = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__.Hovercard, {
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], {
      features: p.features,
      hideHelpToggle: true,
      message: noFeatureMessage,
      featureName: noFeatureMessage
    }),
    children: p.children(p)
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    hookName: "feature-disabled:open-discover",
    features: ['organizations:discover-basic'],
    renderDisabled: renderDisabled,
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return children({
        hasFeature
      });
    }
  });
}

DiscoverFeature.displayName = "DiscoverFeature";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverFeature);

/***/ }),

/***/ "./app/components/discoverButton.tsx":
/*!*******************************************!*\
  !*** ./app/components/discoverButton.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/discover/discoverFeature */ "./app/components/discover/discoverFeature.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton(_ref) {
  let {
    children,
    ...buttonProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__["default"], {
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
        disabled: !hasFeature,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Open in Discover'),
        ...buttonProps,
        children: children
      });
    }
  });
}

DiscoverButton.displayName = "DiscoverButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverButton);

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

/***/ "./app/utils/discover/discoverQuery.tsx":
/*!**********************************************!*\
  !*** ./app/utils/discover/discoverQuery.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


/**
 * An individual row in a DiscoverQuery result
 */



function shouldRefetchData(prevProps, nextProps) {
  return prevProps.transactionName !== nextProps.transactionName || prevProps.transactionThreshold !== nextProps.transactionThreshold || prevProps.transactionThresholdMetric !== nextProps.transactionThresholdMetric;
}

function DiscoverQuery(props) {
  const endpoint = props.useEvents ? 'events' : 'eventsv2';
  const afterFetch = props.useEvents ? (data, _) => {
    var _data$meta;

    const {
      fields,
      ...otherMeta
    } = (_data$meta = data.meta) !== null && _data$meta !== void 0 ? _data$meta : {};
    return { ...data,
      meta: { ...fields,
        ...otherMeta
      }
    };
  } : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: endpoint,
    shouldRefetchData: shouldRefetchData,
    afterFetch: afterFetch,
    ...props
  });
}

DiscoverQuery.displayName = "DiscoverQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_0__["default"])(DiscoverQuery));

/***/ }),

/***/ "./app/views/performance/traceDetails/limitExceededMessage.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/performance/traceDetails/limitExceededMessage.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/discover/discoverFeature */ "./app/components/discover/discoverFeature.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_performance_waterfall_messageRow__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/waterfall/messageRow */ "./app/components/performance/waterfall/messageRow.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function LimitExceededMessage(_ref) {
  var _meta$transactions;

  let {
    traceInfo,
    traceEventView,
    organization,
    meta
  } = _ref;
  const count = traceInfo.transactions.size;
  const totalTransactions = (_meta$transactions = meta === null || meta === void 0 ? void 0 : meta.transactions) !== null && _meta$transactions !== void 0 ? _meta$transactions : count;

  if (totalTransactions === null || count >= totalTransactions) {
    return null;
  }

  const target = traceEventView.getResultsViewUrlTarget(organization.slug);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_performance_waterfall_messageRow__WEBPACK_IMPORTED_MODULE_2__.MessageRow, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Limited to a view of [count] transactions. To view the full list, [discover].', {
      count,
      discover: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_0__["default"], {
        children: _ref2 => {
          let {
            hasFeature
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
            disabled: !hasFeature,
            to: target,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Open in Discover')
          });
        }
      })
    })
  });
}

LimitExceededMessage.displayName = "LimitExceededMessage";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LimitExceededMessage);

/***/ }),

/***/ "./app/views/performance/traceDetails/styles.tsx":
/*!*******************************************************!*\
  !*** ./app/views/performance/traceDetails/styles.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectBadgeContainer": () => (/* binding */ ProjectBadgeContainer),
/* harmony export */   "Row": () => (/* reexport safe */ sentry_components_events_interfaces_spans_spanDetail__WEBPACK_IMPORTED_MODULE_10__.Row),
/* harmony export */   "Tags": () => (/* binding */ Tags),
/* harmony export */   "TraceDetailBody": () => (/* binding */ TraceDetailBody),
/* harmony export */   "TraceDetailHeader": () => (/* binding */ TraceDetailHeader),
/* harmony export */   "TracePanel": () => (/* binding */ TracePanel),
/* harmony export */   "TraceSearchBar": () => (/* binding */ TraceSearchBar),
/* harmony export */   "TraceSearchContainer": () => (/* binding */ TraceSearchContainer),
/* harmony export */   "TraceViewContainer": () => (/* binding */ TraceViewContainer),
/* harmony export */   "TraceViewHeaderContainer": () => (/* binding */ TraceViewHeaderContainer),
/* harmony export */   "TransactionDetails": () => (/* reexport safe */ sentry_components_events_interfaces_spans_spanDetail__WEBPACK_IMPORTED_MODULE_10__.SpanDetails),
/* harmony export */   "TransactionDetailsContainer": () => (/* reexport safe */ sentry_components_events_interfaces_spans_spanDetail__WEBPACK_IMPORTED_MODULE_10__.SpanDetailContainer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_eventTags_eventTagsPill__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/eventTags/eventTagsPill */ "./app/components/events/eventTags/eventTagsPill.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_header__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/header */ "./app/components/events/interfaces/spans/header.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_pills__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/pills */ "./app/components/pills.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* harmony import */ var sentry_components_events_interfaces_spans_spanDetail__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/spanDetail */ "./app/components/events/interfaces/spans/spanDetail.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const TraceSearchContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "euzgho58"
} : 0)( true ? {
  name: "7whenc",
  styles: "display:flex;width:100%"
} : 0);
const TraceSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "euzgho57"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);
const TraceViewHeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_interfaces_spans_header__WEBPACK_IMPORTED_MODULE_2__.SecondaryHeader,  true ? {
  target: "euzgho56"
} : 0)("position:static;top:auto;border-top:none;border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));
const TraceDetailHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "euzgho55"
} : 0)("display:grid;grid-template-columns:1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:max-content max-content;grid-row-gap:0;}" + ( true ? "" : 0));
const TraceDetailBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "euzgho54"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";" + ( true ? "" : 0));
const TraceViewContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "euzgho53"
} : 0)( true ? {
  name: "1wr20zt",
  styles: "overflow-x:hidden;border-bottom-left-radius:3px;border-bottom-right-radius:3px"
} : 0);
const TracePanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel,  true ? {
  target: "euzgho52"
} : 0)( true ? {
  name: "d3v9zr",
  styles: "overflow:hidden"
} : 0);
const ProjectBadgeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "euzgho51"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";display:flex;flex-direction:column;justify-content:center;" + ( true ? "" : 0));

const StyledPills = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pills__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "euzgho50"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";" + ( true ? "" : 0));

function Tags(_ref) {
  let {
    location,
    organization,
    transaction
  } = _ref;
  const {
    tags
  } = transaction;

  if (!tags || tags.length <= 0) {
    return null;
  }

  const orgSlug = organization.slug;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("tr", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("td", {
      className: "key",
      children: "Tags"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("td", {
      className: "value",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledPills, {
        children: tags.map((tag, index) => {
          const {
            pathname: streamPath,
            query
          } = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_9__.transactionSummaryRouteWithQuery)({
            orgSlug,
            transaction: transaction.transaction,
            projectID: String(transaction.project_id),
            query: { ...location.query,
              query: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.appendTagCondition)(location.query.query, tag.key, tag.value)
            }
          });
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_events_eventTags_eventTagsPill__WEBPACK_IMPORTED_MODULE_1__["default"], {
            tag: tag,
            projectId: transaction.project_slug,
            organization: organization,
            query: query,
            streamPath: streamPath
          }, !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(tag.key) ? `tag-pill-${index}` : tag.key);
        })
      })
    })]
  });
}
Tags.displayName = "Tags";

/***/ }),

/***/ "./app/views/performance/traceDetails/traceNotFound.tsx":
/*!**************************************************************!*\
  !*** ./app/views/performance/traceDetails/traceNotFound.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowDetails */ "./app/components/performance/waterfall/rowDetails.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function TraceNotFound(_ref) {
  var _meta$transactions, _meta$errors;

  let {
    meta,
    traceEventView,
    traceSlug,
    organization,
    location
  } = _ref;
  const transactions = (_meta$transactions = meta === null || meta === void 0 ? void 0 : meta.transactions) !== null && _meta$transactions !== void 0 ? _meta$transactions : 0;
  const errors = (_meta$errors = meta === null || meta === void 0 ? void 0 : meta.errors) !== null && _meta$errors !== void 0 ? _meta$errors : 0;

  if (transactions === 0 && errors > 0) {
    const errorsEventView = traceEventView.withColumns([{
      kind: 'field',
      field: 'project'
    }, {
      kind: 'field',
      field: 'title'
    }, {
      kind: 'field',
      field: 'issue.id'
    }, {
      kind: 'field',
      field: 'level'
    }]);
    errorsEventView.query = `trace:${traceSlug} !event.type:transaction `;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_9__["default"], {
      eventView: errorsEventView,
      orgSlug: organization.slug,
      location: location,
      referrer: "api.trace-view.errors-view",
      useEvents: true,
      children: _ref2 => {
        let {
          isLoading,
          tableData,
          error
        } = _ref2;

        if (isLoading) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {});
        }

        if (error) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
            type: "error",
            showIcon: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ErrorLabel, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('The trace cannot be shown when all events are errors. An error occurred when attempting to fetch these error events: [error]', {
                error: error.message
              })
            })
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
          type: "error",
          showIcon: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ErrorLabel, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('The trace cannot be shown when all events are errors.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_6__.ErrorMessageContent, {
            "data-test-id": "trace-view-errors",
            children: tableData === null || tableData === void 0 ? void 0 : tableData.data.map(data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_6__.ErrorDot, {
                level: data.level
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_6__.ErrorLevel, {
                children: data.level
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_6__.ErrorTitle, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
                  to: `/organizations/${organization.slug}/issues/${data['issue.id']}/events/${data.id}`,
                  children: data.title
                })
              })]
            }, data.id))
          })]
        });
      }
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
    message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('The trace you are looking for was not found.')
  });
}

TraceNotFound.displayName = "TraceNotFound";

const ErrorLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etqb06g0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TraceNotFound);

/***/ }),

/***/ "./app/views/performance/traceDetails/traceView.tsx":
/*!**********************************************************!*\
  !*** ./app/views/performance/traceDetails/traceView.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TraceView)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/hub.js");
/* harmony import */ var sentry_components_events_interfaces_spans_anchorLinkManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/anchorLinkManager */ "./app/components/events/interfaces/spans/anchorLinkManager.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/dividerHandlerManager */ "./app/components/events/interfaces/spans/dividerHandlerManager.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/scrollbarManager */ "./app/components/events/interfaces/spans/scrollbarManager.tsx");
/* harmony import */ var sentry_components_performance_waterfall_messageRow__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/performance/waterfall/messageRow */ "./app/components/performance/waterfall/messageRow.tsx");
/* harmony import */ var sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/performance/waterfall/miniHeader */ "./app/components/performance/waterfall/miniHeader.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/traceDetails/styles */ "./app/views/performance/traceDetails/styles.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_transactionGroup__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/performance/traceDetails/transactionGroup */ "./app/views/performance/traceDetails/transactionGroup.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");
/* harmony import */ var _limitExceededMessage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./limitExceededMessage */ "./app/views/performance/traceDetails/limitExceededMessage.tsx");
/* harmony import */ var _traceNotFound__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./traceNotFound */ "./app/views/performance/traceDetails/traceNotFound.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function TraceHiddenMessage(_ref) {
  let {
    isVisible,
    numberOfHiddenTransactionsAbove
  } = _ref;

  if (!isVisible || numberOfHiddenTransactionsAbove < 1) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_performance_waterfall_messageRow__WEBPACK_IMPORTED_MODULE_5__.MessageRow, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
      children: numberOfHiddenTransactionsAbove === 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[numOfTransaction] hidden transaction', {
        numOfTransaction: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("strong", {
          children: numberOfHiddenTransactionsAbove
        })
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[numOfTransaction] hidden transactions', {
        numOfTransaction: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("strong", {
          children: numberOfHiddenTransactionsAbove
        })
      })
    }, "trace-info-message")
  });
}

TraceHiddenMessage.displayName = "TraceHiddenMessage";

function isTransactionVisible(transaction, filteredTransactionIds) {
  return filteredTransactionIds ? filteredTransactionIds.has(transaction.event_id) : true;
}

function TraceView(_ref2) {
  var _Sentry$getCurrentHub;

  let {
    location,
    meta,
    organization,
    traces,
    traceSlug,
    traceEventView,
    filteredTransactionIds,
    ...props
  } = _ref2;
  const sentryTransaction = (_Sentry$getCurrentHub = _sentry_react__WEBPACK_IMPORTED_MODULE_16__.getCurrentHub().getScope()) === null || _Sentry$getCurrentHub === void 0 ? void 0 : _Sentry$getCurrentHub.getTransaction();
  const sentrySpan = sentryTransaction === null || sentryTransaction === void 0 ? void 0 : sentryTransaction.startChild({
    op: 'trace.render',
    description: 'trace-view-content'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('performance_views.trace_view.view', {
      organization
    });
  }, [organization]);

  function renderTransaction(transaction, _ref3) {
    let {
      continuingDepths,
      isOrphan,
      isLast,
      index,
      numberOfHiddenTransactionsAbove,
      traceInfo,
      hasGuideAnchor
    } = _ref3;
    const {
      children,
      event_id: eventId
    } = transaction; // Add 1 to the generation to make room for the "root trace"

    const generation = transaction.generation + 1;
    const isVisible = isTransactionVisible(transaction, filteredTransactionIds);
    const accumulated = children.reduce((acc, child, idx) => {
      const isLastChild = idx === children.length - 1;
      const hasChildren = child.children.length > 0;
      const result = renderTransaction(child, {
        continuingDepths: !isLastChild && hasChildren ? [...continuingDepths, {
          depth: generation,
          isOrphanDepth: isOrphan
        }] : continuingDepths,
        isOrphan,
        isLast: isLastChild,
        index: acc.lastIndex + 1,
        numberOfHiddenTransactionsAbove: acc.numberOfHiddenTransactionsAbove,
        traceInfo,
        hasGuideAnchor: false
      });
      acc.lastIndex = result.lastIndex;
      acc.numberOfHiddenTransactionsAbove = result.numberOfHiddenTransactionsAbove;
      acc.renderedChildren.push(result.transactionGroup);
      return acc;
    }, {
      renderedChildren: [],
      lastIndex: index,
      numberOfHiddenTransactionsAbove: isVisible ? 0 : numberOfHiddenTransactionsAbove + 1
    });
    return {
      transactionGroup: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(TraceHiddenMessage, {
          isVisible: isVisible,
          numberOfHiddenTransactionsAbove: numberOfHiddenTransactionsAbove
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_performance_traceDetails_transactionGroup__WEBPACK_IMPORTED_MODULE_11__["default"], {
          location: location,
          organization: organization,
          traceInfo: traceInfo,
          transaction: { ...transaction,
            generation
          },
          continuingDepths: continuingDepths,
          isOrphan: isOrphan,
          isLast: isLast,
          index: index,
          isVisible: isVisible,
          hasGuideAnchor: hasGuideAnchor,
          renderedChildren: accumulated.renderedChildren,
          barColor: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.pickBarColor)(transaction['transaction.op'])
        })]
      }, eventId),
      lastIndex: accumulated.lastIndex,
      numberOfHiddenTransactionsAbove: accumulated.numberOfHiddenTransactionsAbove
    };
  }

  const traceViewRef = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createRef)();
  const virtualScrollbarContainerRef = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createRef)();

  if (traces === null || traces.length <= 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_traceNotFound__WEBPACK_IMPORTED_MODULE_14__["default"], {
      meta: meta,
      traceEventView: traceEventView,
      traceSlug: traceSlug,
      location: location,
      organization: organization
    });
  }

  const traceInfo = props.traceInfo || (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_12__.getTraceInfo)(traces);
  const accumulator = {
    index: 1,
    numberOfHiddenTransactionsAbove: 0,
    traceInfo,
    transactionGroups: []
  };
  const {
    transactionGroups,
    numberOfHiddenTransactionsAbove
  } = traces.reduce((acc, trace, index) => {
    const isLastTransaction = index === traces.length - 1;
    const hasChildren = trace.children.length > 0;
    const isNextChildOrphaned = !isLastTransaction && traces[index + 1].parent_span_id !== null;
    const result = renderTransaction(trace, { ...acc,
      // if the root of a subtrace has a parent_span_id, then it must be an orphan
      isOrphan: !(0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_12__.isRootTransaction)(trace),
      isLast: isLastTransaction,
      continuingDepths: !isLastTransaction && hasChildren ? [{
        depth: 0,
        isOrphanDepth: isNextChildOrphaned
      }] : [],
      hasGuideAnchor: index === 0
    });
    acc.index = result.lastIndex + 1;
    acc.numberOfHiddenTransactionsAbove = result.numberOfHiddenTransactionsAbove;
    acc.transactionGroups.push(result.transactionGroup);
    return acc;
  }, accumulator);

  const traceView = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_performance_traceDetails_styles__WEBPACK_IMPORTED_MODULE_10__.TraceDetailBody, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_interfaces_spans_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_3__.Provider, {
      interactiveLayerRef: traceViewRef,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_interfaces_spans_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_3__.Consumer, {
        children: _ref4 => {
          let {
            dividerPosition
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_4__.Provider, {
            dividerPosition: dividerPosition,
            interactiveLayerRef: virtualScrollbarContainerRef,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_views_performance_traceDetails_styles__WEBPACK_IMPORTED_MODULE_10__.TracePanel, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_views_performance_traceDetails_styles__WEBPACK_IMPORTED_MODULE_10__.TraceViewHeaderContainer, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_4__.Consumer, {
                  children: _ref5 => {
                    let {
                      virtualScrollbarRef,
                      scrollBarAreaRef,
                      onDragStart,
                      onScroll
                    } = _ref5;
                    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.ScrollbarContainer, {
                      ref: virtualScrollbarContainerRef,
                      style: {
                        // the width of this component is shrunk to compensate for half of the width of the divider line
                        width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.toPercent)(dividerPosition)} - 0.5px)`
                      },
                      onScroll: onScroll,
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
                        style: {
                          width: 0,
                          height: '1px'
                        },
                        ref: scrollBarAreaRef
                      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.VirtualScrollbar, {
                        "data-type": "virtual-scrollbar",
                        ref: virtualScrollbarRef,
                        onMouseDown: onDragStart,
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.VirtualScrollbarGrip, {})
                      })]
                    });
                  }
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_performance_waterfall_miniHeader__WEBPACK_IMPORTED_MODULE_6__.DividerSpacer, {})]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_views_performance_traceDetails_styles__WEBPACK_IMPORTED_MODULE_10__.TraceViewContainer, {
                ref: traceViewRef,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_interfaces_spans_anchorLinkManager__WEBPACK_IMPORTED_MODULE_2__.Provider, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_performance_traceDetails_transactionGroup__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    location: location,
                    organization: organization,
                    traceInfo: traceInfo,
                    transaction: {
                      traceSlug,
                      generation: 0,
                      'transaction.duration': traceInfo.endTimestamp - traceInfo.startTimestamp,
                      children: traces,
                      start_timestamp: traceInfo.startTimestamp,
                      timestamp: traceInfo.endTimestamp
                    },
                    continuingDepths: [],
                    isOrphan: false,
                    isLast: false,
                    index: 0,
                    isVisible: true,
                    hasGuideAnchor: false,
                    renderedChildren: transactionGroups,
                    barColor: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_7__.pickBarColor)('')
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(TraceHiddenMessage, {
                  isVisible: true,
                  numberOfHiddenTransactionsAbove: numberOfHiddenTransactionsAbove
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_limitExceededMessage__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  traceInfo: traceInfo,
                  organization: organization,
                  traceEventView: traceEventView,
                  meta: meta
                })]
              })]
            })
          });
        }
      })
    })
  });

  sentrySpan === null || sentrySpan === void 0 ? void 0 : sentrySpan.finish();
  return traceView;
}

/***/ }),

/***/ "./app/views/performance/traceDetails/transactionBar.tsx":
/*!***************************************************************!*\
  !*** ./app/views/performance/traceDetails/transactionBar.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_anchorLinkManager__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/anchorLinkManager */ "./app/components/events/interfaces/spans/anchorLinkManager.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/dividerHandlerManager */ "./app/components/events/interfaces/spans/dividerHandlerManager.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/scrollbarManager */ "./app/components/events/interfaces/spans/scrollbarManager.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");
/* harmony import */ var sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/performance/waterfall/row */ "./app/components/performance/waterfall/row.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowBar */ "./app/components/performance/waterfall/rowBar.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowDivider */ "./app/components/performance/waterfall/rowDivider.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowTitle */ "./app/components/performance/waterfall/rowTitle.tsx");
/* harmony import */ var sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/performance/waterfall/treeConnector */ "./app/components/performance/waterfall/treeConnector.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./styles */ "./app/views/performance/traceDetails/styles.tsx");
/* harmony import */ var _transactionDetail__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./transactionDetail */ "./app/views/performance/traceDetails/transactionDetail.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");























const MARGIN_LEFT = 0;

class TransactionBar extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showDetail: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "transactionRowDOMRef", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleDisplayDetail", () => {
      const {
        transaction
      } = this.props;

      if ((0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction)) {
        this.setState(state => ({
          showDetail: !state.showDetail
        }));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollIntoView", () => {
      const element = this.transactionRowDOMRef.current;

      if (!element) {
        return;
      }

      const boundingRect = element.getBoundingClientRect();
      const offset = boundingRect.top + window.scrollY;
      this.setState({
        showDetail: true
      }, () => window.scrollTo(0, offset));
    });
  }

  getCurrentOffset() {
    const {
      transaction
    } = this.props;
    const {
      generation
    } = transaction;
    return getOffset(generation);
  }

  renderConnector(hasToggle) {
    const {
      continuingDepths,
      isExpanded,
      isOrphan,
      isLast,
      transaction
    } = this.props;
    const {
      generation
    } = transaction;
    const eventId = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction) ? transaction.event_id : transaction.traceSlug;

    if (generation === 0) {
      if (hasToggle) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.ConnectorBar, {
          style: {
            right: '15px',
            height: '10px',
            bottom: '-5px',
            top: 'auto'
          },
          orphanBranch: false
        });
      }

      return null;
    }

    const connectorBars = continuingDepths.map(_ref => {
      let {
        depth,
        isOrphanDepth
      } = _ref;

      if (generation - depth <= 1) {
        // If the difference is less than or equal to 1, then it means that the continued
        // bar is from its direct parent. In this case, do not render a connector bar
        // because the tree connector below will suffice.
        return null;
      }

      const left = -1 * getOffset(generation - depth - 1) - 2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.ConnectorBar, {
        style: {
          left
        },
        orphanBranch: isOrphanDepth
      }, `${eventId}-${depth}`);
    });

    if (hasToggle && isExpanded) {
      connectorBars.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.ConnectorBar, {
        style: {
          right: '15px',
          height: '10px',
          bottom: isLast ? `-${sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_9__.ROW_HEIGHT / 2 + 1}px` : '0',
          top: 'auto'
        },
        orphanBranch: false
      }, `${eventId}-last`));
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TreeConnector, {
      isLast: isLast,
      hasToggler: hasToggle,
      orphanBranch: isOrphan,
      children: connectorBars
    });
  }

  renderToggle(errored) {
    const {
      isExpanded,
      transaction,
      toggleExpandedState
    } = this.props;
    const {
      children,
      generation
    } = transaction;
    const left = this.getCurrentOffset();

    if (children.length <= 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TreeToggleContainer, {
        style: {
          left: `${left}px`
        },
        children: this.renderConnector(false)
      });
    }

    const isRoot = generation === 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TreeToggleContainer, {
      style: {
        left: `${left}px`
      },
      hasToggler: true,
      children: [this.renderConnector(true), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TreeToggle, {
        disabled: isRoot,
        isExpanded: isExpanded,
        errored: errored,
        onClick: event => {
          event.stopPropagation();

          if (isRoot) {
            return;
          }

          toggleExpandedState();
        },
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"], {
          value: children.length
        }), !isRoot && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TreeToggleIcon, {
            direction: isExpanded ? 'up' : 'down'
          })
        })]
      })]
    });
  }

  renderTitle(scrollbarManagerChildrenProps) {
    const {
      generateContentSpanBarRef
    } = scrollbarManagerChildrenProps;
    const {
      organization,
      transaction
    } = this.props;
    const left = this.getCurrentOffset();
    const errored = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction) ? transaction.errors.length > 0 : false;
    const content = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_18__["default"], {
        orgId: organization.slug,
        slugs: [transaction.project_slug],
        children: _ref2 => {
          let {
            projects
          } = _ref2;
          const project = projects.find(p => p.slug === transaction.project_slug);
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_19__.ProjectBadgeContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
              title: transaction.project_slug,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
                project: project ? project : {
                  slug: transaction.project_slug
                },
                avatarSize: 16,
                hideName: true
              })
            })
          });
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_rowTitle__WEBPACK_IMPORTED_MODULE_13__.RowTitleContent, {
        errored: errored,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)("strong", {
          children: [transaction['transaction.op'], ' \u2014 ']
        }), transaction.transaction]
      })]
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_rowTitle__WEBPACK_IMPORTED_MODULE_13__.RowTitleContent, {
      errored: false,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)("strong", {
        children: 'Trace \u2014 '
      }), transaction.traceSlug]
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_rowTitle__WEBPACK_IMPORTED_MODULE_13__.RowTitleContainer, {
      ref: generateContentSpanBarRef(),
      children: [this.renderToggle(errored), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowTitle__WEBPACK_IMPORTED_MODULE_13__.RowTitle, {
        style: {
          left: `${left}px`,
          width: '100%'
        },
        children: content
      })]
    });
  }

  renderDivider(dividerHandlerChildrenProps) {
    if (this.state.showDetail) {
      // Mock component to preserve layout spacing
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.DividerLine, {
        showDetail: true,
        style: {
          position: 'absolute'
        }
      });
    }

    const {
      addDividerLineRef
    } = dividerHandlerChildrenProps;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.DividerLine, {
      ref: addDividerLineRef(),
      style: {
        position: 'absolute'
      },
      onMouseEnter: () => {
        dividerHandlerChildrenProps.setHover(true);
      },
      onMouseLeave: () => {
        dividerHandlerChildrenProps.setHover(false);
      },
      onMouseOver: () => {
        dividerHandlerChildrenProps.setHover(true);
      },
      onMouseDown: dividerHandlerChildrenProps.onDragStart,
      onClick: event => {
        // we prevent the propagation of the clicks from this component to prevent
        // the span detail from being opened.
        event.stopPropagation();
      }
    });
  }

  renderGhostDivider(dividerHandlerChildrenProps) {
    const {
      dividerPosition,
      addGhostDividerLineRef
    } = dividerHandlerChildrenProps;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.DividerLineGhostContainer, {
      style: {
        width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.toPercent)(dividerPosition)} + 0.5px)`,
        display: 'none'
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.DividerLine, {
        ref: addGhostDividerLineRef(),
        style: {
          right: 0
        },
        className: "hovering",
        onClick: event => {
          // the ghost divider line should not be interactive.
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }
      })
    });
  }

  renderErrorBadge() {
    const {
      transaction
    } = this.props;

    if (!(0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction) || !transaction.errors.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.ErrorBadge, {});
  }

  renderRectangle() {
    const {
      transaction,
      traceInfo,
      barColor
    } = this.props;
    const {
      showDetail
    } = this.state; // Use 1 as the difference in the event that startTimestamp === endTimestamp

    const delta = Math.abs(traceInfo.endTimestamp - traceInfo.startTimestamp) || 1;
    const startPosition = Math.abs(transaction.start_timestamp - traceInfo.startTimestamp);
    const startPercentage = startPosition / delta;
    const duration = Math.abs(transaction.timestamp - transaction.start_timestamp);
    const widthPercentage = duration / delta;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowBar__WEBPACK_IMPORTED_MODULE_11__.RowRectangle, {
      spanBarHatch: false,
      style: {
        backgroundColor: barColor,
        left: `min(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.toPercent)(startPercentage || 0)}, calc(100% - 1px))`,
        width: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.toPercent)(widthPercentage || 0)
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_rowBar__WEBPACK_IMPORTED_MODULE_11__.DurationPill, {
        durationDisplay: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.getDurationDisplay)({
          left: startPercentage,
          width: widthPercentage
        }),
        showDetail: showDetail,
        spanBarHatch: false,
        children: (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.getHumanDuration)(duration)
      })
    });
  }

  renderHeader(_ref3) {
    let {
      dividerHandlerChildrenProps,
      scrollbarManagerChildrenProps
    } = _ref3;
    const {
      hasGuideAnchor,
      index
    } = this.props;
    const {
      showDetail
    } = this.state;
    const {
      dividerPosition
    } = dividerHandlerChildrenProps;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_10__.RowCellContainer, {
      showDetail: showDetail,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_10__.RowCell, {
        "data-test-id": "transaction-row-title",
        "data-type": "span-row-cell",
        style: {
          width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.toPercent)(dividerPosition)} - 0.5px)`,
          paddingTop: 0
        },
        showDetail: showDetail,
        onClick: this.toggleDisplayDetail,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_3__["default"], {
          target: "trace_view_guide_row",
          disabled: !hasGuideAnchor,
          children: this.renderTitle(scrollbarManagerChildrenProps)
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_rowDivider__WEBPACK_IMPORTED_MODULE_12__.DividerContainer, {
        children: [this.renderDivider(dividerHandlerChildrenProps), this.renderErrorBadge()]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_10__.RowCell, {
        "data-test-id": "transaction-row-duration",
        "data-type": "span-row-cell",
        showStriping: index % 2 !== 0,
        style: {
          width: `calc(${(0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_15__.toPercent)(1 - dividerPosition)} - 0.5px)`,
          paddingTop: 0
        },
        showDetail: showDetail,
        onClick: this.toggleDisplayDetail,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_3__["default"], {
          target: "trace_view_guide_row_details",
          disabled: !hasGuideAnchor,
          children: this.renderRectangle()
        })
      }), !showDetail && this.renderGhostDivider(dividerHandlerChildrenProps)]
    });
  }

  renderDetail() {
    const {
      location,
      organization,
      isVisible,
      transaction
    } = this.props;
    const {
      showDetail
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_events_interfaces_spans_anchorLinkManager__WEBPACK_IMPORTED_MODULE_5__.Consumer, {
      children: _ref4 => {
        let {
          registerScrollFn,
          scrollToHash
        } = _ref4;

        if (!(0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction)) {
          return null;
        }

        registerScrollFn(`#txn-${transaction.event_id}`, this.scrollIntoView, false);

        if (!isVisible || !showDetail) {
          return null;
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_transactionDetail__WEBPACK_IMPORTED_MODULE_20__["default"], {
          location: location,
          organization: organization,
          transaction: transaction,
          scrollToHash: scrollToHash
        });
      }
    });
  }

  render() {
    const {
      isVisible,
      transaction
    } = this.props;
    const {
      showDetail
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(sentry_components_performance_waterfall_row__WEBPACK_IMPORTED_MODULE_10__.Row, {
      ref: this.transactionRowDOMRef,
      visible: isVisible,
      showBorder: showDetail,
      cursor: (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_17__.isTraceFullDetailed)(transaction) ? 'pointer' : 'default',
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_7__.Consumer, {
        children: scrollbarManagerChildrenProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(sentry_components_events_interfaces_spans_dividerHandlerManager__WEBPACK_IMPORTED_MODULE_6__.Consumer, {
          children: dividerHandlerChildrenProps => this.renderHeader({
            dividerHandlerChildrenProps,
            scrollbarManagerChildrenProps
          })
        })
      }), this.renderDetail()]
    });
  }

}

TransactionBar.displayName = "TransactionBar";

function getOffset(generation) {
  return generation * (sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_14__.TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionBar);

/***/ }),

/***/ "./app/views/performance/traceDetails/transactionDetail.tsx":
/*!******************************************************************!*\
  !*** ./app/views/performance/traceDetails/transactionDetail.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/performance/waterfall/rowDetails */ "./app/components/performance/waterfall/rowDetails.tsx");
/* harmony import */ var sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/quickTrace/utils */ "./app/components/quickTrace/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/performanceForSentry */ "./app/utils/performanceForSentry.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./styles */ "./app/views/performance/traceDetails/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





























class TransactionDetail extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "scrollBarIntoView", transactionId => e => {
      // do not use the default anchor behaviour
      // because it will be hidden behind the minimap
      e.preventDefault();
      const hash = `#txn-${transactionId}`;
      this.props.scrollToHash(hash); // TODO(txiao): This is causing a rerender of the whole page,
      // which can be slow.
      //
      // make sure to update the location

      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({ ...this.props.location,
        hash
      });
    });
  }

  componentDidMount() {
    const {
      organization,
      transaction
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('performance_views.trace_view.open_transaction_details', {
      organization,
      operation: transaction['transaction.op'],
      transaction: transaction.transaction
    });
  }

  renderTransactionErrors() {
    const {
      organization,
      transaction
    } = this.props;
    const {
      errors
    } = transaction;

    if (errors.length === 0) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
      system: true,
      type: "error",
      expand: errors.map(error => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__.ErrorMessageContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__.ErrorDot, {
          level: error.level
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__.ErrorLevel, {
          children: error.level
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__.ErrorTitle, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__["default"], {
            to: (0,sentry_components_quickTrace_utils__WEBPACK_IMPORTED_MODULE_13__.generateIssueEventTarget)(error, organization),
            children: error.title
          })
        })]
      }, error.event_id)),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_performance_waterfall_rowDetails__WEBPACK_IMPORTED_MODULE_12__.ErrorMessageTitle, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tn)('An error event occurred in this transaction.', '%s error events occurred in this transaction.', errors.length)
      })
    });
  }

  renderGoToTransactionButton() {
    const {
      location,
      organization,
      transaction
    } = this.props;
    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_19__.generateEventSlug)({
      id: transaction.event_id,
      project: transaction.project_slug
    });
    const target = (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_21__.getTransactionDetailsUrl)(organization.slug, eventSlug, transaction.transaction, lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__.PAGE_URL_PARAM)));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledButton, {
      size: "xs",
      to: target,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('View Event')
    });
  }

  renderGoToSummaryButton() {
    const {
      location,
      organization,
      transaction
    } = this.props;
    const target = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_24__.transactionSummaryRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transaction.transaction,
      query: lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__.PAGE_URL_PARAM)),
      projectID: String(transaction.project_id)
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledButton, {
      size: "xs",
      to: target,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('View Summary')
    });
  }

  renderMeasurements() {
    const {
      transaction
    } = this.props;
    const {
      measurements = {}
    } = transaction;
    const measurementKeys = Object.keys(measurements).filter(name => Boolean(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_22__.WEB_VITAL_DETAILS[`measurements.${name}`])).sort();

    if (measurementKeys.length <= 0) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: measurementKeys.map(measurement => {
        var _WEB_VITAL_DETAILS;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
          title: (_WEB_VITAL_DETAILS = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_22__.WEB_VITAL_DETAILS[`measurements.${measurement}`]) === null || _WEB_VITAL_DETAILS === void 0 ? void 0 : _WEB_VITAL_DETAILS.name,
          children: `${Number(measurements[measurement].value.toFixed(3)).toLocaleString()}ms`
        }, measurement);
      })
    });
  }

  renderTransactionDetail() {
    const {
      location,
      organization,
      transaction
    } = this.props;
    const startTimestamp = Math.min(transaction.start_timestamp, transaction.timestamp);
    const endTimestamp = Math.max(transaction.start_timestamp, transaction.timestamp);
    const duration = (endTimestamp - startTimestamp) * 1000;
    const durationString = `${Number(duration.toFixed(3)).toLocaleString()}ms`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.TransactionDetails, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("table", {
        className: "table key-value",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("tbody", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(TransactionIdTitle, {
              onClick: this.scrollBarIntoView(transaction.event_id),
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Event ID'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_9__["default"], {
                value: `${window.location.href.replace(window.location.hash, '')}#txn-${transaction.event_id}`,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledIconLink, {})
              })]
            }),
            extra: this.renderGoToTransactionButton(),
            children: transaction.event_id
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Transaction",
            extra: this.renderGoToSummaryButton(),
            children: transaction.transaction
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Transaction Status",
            children: transaction['transaction.status']
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Span ID",
            children: transaction.span_id
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Project",
            children: transaction.project_slug
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Start Date",
            children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__["default"])({
              fixed: 'Mar 19, 2021 11:06:27 AM UTC',
              value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  date: startTimestamp * 1000
                }), ` (${startTimestamp})`]
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "End Date",
            children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__["default"])({
              fixed: 'Mar 19, 2021 11:06:28 AM UTC',
              value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  date: endTimestamp * 1000
                }), ` (${endTimestamp})`]
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Duration",
            children: durationString
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Row, {
            title: "Operation",
            children: transaction['transaction.op'] || ''
          }), this.renderMeasurements(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_25__.Tags, {
            location: location,
            organization: organization,
            transaction: transaction
          })]
        })
      })
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_23__.CustomerProfiler, {
      id: "TransactionDetail",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_25__.TransactionDetailsContainer, {
        onClick: event => {
          // prevent toggling the transaction detail
          event.stopPropagation();
        },
        children: [this.renderTransactionErrors(), this.renderTransactionDetail()]
      })
    });
  }

}

TransactionDetail.displayName = "TransactionDetail";

const TransactionIdTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "eykqe522"
} : 0)("display:flex;color:", p => p.theme.textColor, ";:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

const StyledIconLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconLink,  true ? {
  target: "eykqe521"
} : 0)("display:block;color:", p => p.theme.gray300, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "eykqe520"
} : 0)("position:absolute;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.75), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionDetail);

/***/ }),

/***/ "./app/views/performance/traceDetails/transactionGroup.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/performance/traceDetails/transactionGroup.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/scrollbarManager */ "./app/components/events/interfaces/spans/scrollbarManager.tsx");
/* harmony import */ var _transactionBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./transactionBar */ "./app/views/performance/traceDetails/transactionBar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class TransactionGroup extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isExpanded: true
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleExpandedState", () => {
      this.setState(_ref => {
        let {
          isExpanded
        } = _ref;
        return {
          isExpanded: !isExpanded
        };
      });
    });
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.isExpanded !== this.state.isExpanded) {
      this.props.updateScrollState();
    }
  }

  render() {
    const {
      location,
      organization,
      transaction,
      traceInfo,
      continuingDepths,
      isOrphan,
      isLast,
      index,
      isVisible,
      hasGuideAnchor,
      renderedChildren,
      barColor
    } = this.props;
    const {
      isExpanded
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_transactionBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
        location: location,
        organization: organization,
        index: index,
        transaction: transaction,
        traceInfo: traceInfo,
        continuingDepths: continuingDepths,
        isOrphan: isOrphan,
        isLast: isLast,
        isExpanded: isExpanded,
        toggleExpandedState: this.toggleExpandedState,
        isVisible: isVisible,
        hasGuideAnchor: hasGuideAnchor,
        barColor: barColor
      }), isExpanded && renderedChildren]
    });
  }

}

TransactionGroup.displayName = "TransactionGroup";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_components_events_interfaces_spans_scrollbarManager__WEBPACK_IMPORTED_MODULE_3__.withScrollbarManager)(TransactionGroup));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_release_tsx-app_components_discoverButton_tsx-app_views_performance_traceD-937006.d1a1f312f6efcca61bce94ce9d3a2a6f.js.map