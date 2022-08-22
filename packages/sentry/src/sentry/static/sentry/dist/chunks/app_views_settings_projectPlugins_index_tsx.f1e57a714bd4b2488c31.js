"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectPlugins_index_tsx"],{

/***/ "./app/actionCreators/plugins.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/plugins.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disablePlugin": () => (/* binding */ disablePlugin),
/* harmony export */   "enablePlugin": () => (/* binding */ enablePlugin),
/* harmony export */   "fetchPlugins": () => (/* binding */ fetchPlugins)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/pluginsStore */ "./app/stores/pluginsStore.tsx");






const activeFetch = {}; // PluginsStore always exists, so api client should be independent of component lifecycle

const api = new sentry_api__WEBPACK_IMPORTED_MODULE_3__.Client();

function doUpdate(_ref) {
  let {
    orgId,
    projectId,
    pluginId,
    update,
    ...params
  } = _ref;
  sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onUpdate(pluginId, update);
  const request = api.requestPromise(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, { ...params
  }); // This is intentionally not chained because we want the unhandled promise to be returned

  request.then(() => {
    sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onUpdateSuccess(pluginId, update);
  }).catch(resp => {
    const err = resp && resp.responseJSON && typeof resp.responseJSON.detail === 'string' ? new Error(resp.responseJSON.detail) : new Error('Unable to update plugin');
    sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onUpdateError(pluginId, update, err);
  });
  return request;
}

/**
 * Fetches list of available plugins for a project
 */
function fetchPlugins(_ref2, options) {
  let {
    orgId,
    projectId
  } = _ref2;
  const path = `/projects/${orgId}/${projectId}/plugins/`; // Make sure we throttle fetches

  if (activeFetch[path]) {
    return activeFetch[path];
  }

  sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onFetchAll(options);
  const request = api.requestPromise(path, {
    method: 'GET',
    includeAllArgs: true
  });
  activeFetch[path] = request; // This is intentionally not chained because we want the unhandled promise to be returned

  request.then(_ref3 => {
    var _resp$getResponseHead;

    let [data, _, resp] = _ref3;
    sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onFetchAllSuccess(data, {
      pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : undefined
    });
    return data;
  }).catch(err => {
    sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_5__["default"].onFetchAllError(err);
    throw new Error('Unable to fetch plugins');
  }).then(() => activeFetch[path] = null);
  return request;
}

/**
 * Enables a plugin
 */
function enablePlugin(params) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Enabling...'));
  return doUpdate({ ...params,
    update: {
      enabled: true
    },
    method: 'POST'
  }).then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Plugin was enabled'))).catch(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to enable plugin')));
}
/**
 * Disables a plugin
 */

function disablePlugin(params) {
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Disabling...'));
  return doUpdate({ ...params,
    update: {
      enabled: false
    },
    method: 'DELETE'
  }).then(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Plugin was disabled'))).catch(() => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unable to disable plugin')));
}

/***/ }),

/***/ "./app/stores/pluginsStore.tsx":
/*!*************************************!*\
  !*** ./app/stores/pluginsStore.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);


const defaultState = {
  loading: true,
  plugins: [],
  error: null,
  pageLinks: null
};
const storeConfig = {
  plugins: null,
  state: { ...defaultState
  },
  updating: new Map(),

  reset() {
    // reset our state
    this.plugins = null;
    this.state = { ...defaultState
    };
    this.updating = new Map();
    return this.state;
  },

  getInitialState() {
    return this.getState();
  },

  getState() {
    const {
      plugins: _plugins,
      ...state
    } = this.state;
    return { ...state,
      plugins: this.plugins ? Array.from(this.plugins.values()) : []
    };
  },

  init() {
    this.reset();
  },

  triggerState() {
    this.trigger(this.getState());
  },

  onFetchAll() {
    let {
      resetLoading
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    if (resetLoading) {
      this.state.loading = true;
      this.state.error = null;
      this.plugins = null;
    }

    this.triggerState();
  },

  onFetchAllSuccess(data, _ref) {
    let {
      pageLinks
    } = _ref;
    this.plugins = new Map(data.map(plugin => [plugin.id, plugin]));
    this.state.pageLinks = pageLinks || null;
    this.state.loading = false;
    this.triggerState();
  },

  onFetchAllError(err) {
    this.plugins = null;
    this.state.loading = false;
    this.state.error = err;
    this.triggerState();
  },

  onUpdate(id, updateObj) {
    if (!this.plugins) {
      return;
    }

    const plugin = this.plugins.get(id);

    if (!plugin) {
      return;
    }

    const newPlugin = { ...plugin,
      ...updateObj
    };
    this.plugins.set(id, newPlugin);
    this.updating.set(id, plugin);
    this.triggerState();
  },

  onUpdateSuccess(id, _updateObj) {
    this.updating.delete(id);
  },

  onUpdateError(id, _updateObj, err) {
    const origPlugin = this.updating.get(id);

    if (!origPlugin || !this.plugins) {
      return;
    }

    this.plugins.set(id, origPlugin);
    this.updating.delete(id);
    this.state.error = err;
    this.triggerState();
  }

};
const PluginStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)(storeConfig);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PluginStore);

/***/ }),

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

/***/ "./app/utils/withPlugins.tsx":
/*!***********************************!*\
  !*** ./app/utils/withPlugins.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/plugins */ "./app/actionCreators/plugins.tsx");
/* harmony import */ var sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/pluginsStore */ "./app/stores/pluginsStore.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
function withPlugins(WrappedComponent) {
  class WithPlugins extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        plugins: [],
        loading: true
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_pluginsStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(_ref => {
        let {
          plugins,
          loading
        } = _ref;
        // State is destructured as store updates contain additional keys
        // that are not exposed by this HoC
        this.setState({
          plugins,
          loading
        });
      }, undefined));
    }

    componentDidMount() {
      this.fetchPlugins();
    }

    componentDidUpdate(prevProps, _prevState, prevContext) {
      const {
        organization,
        project
      } = this.props; // Only fetch plugins when a org slug or project slug has changed

      const prevOrg = prevProps.organization || (prevContext === null || prevContext === void 0 ? void 0 : prevContext.organization);
      const prevProject = prevProps.project || (prevContext === null || prevContext === void 0 ? void 0 : prevContext.project); // If previous org/project is undefined then it means:
      // the HoC has mounted, `fetchPlugins` has been called (via cDM), and
      // store was updated. We don't need to fetchPlugins again (or it will cause an infinite loop)
      //
      // This is for the unusual case where component is mounted and receives a new org/project prop
      // e.g. when switching projects via breadcrumbs in settings.

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(prevProject) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(prevOrg)) {
        return;
      }

      const isOrgSame = prevOrg.slug === organization.slug;
      const isProjectSame = prevProject.slug === (project === null || project === void 0 ? void 0 : project.slug); // Don't do anything if org and project are the same

      if (isOrgSame && isProjectSame) {
        return;
      }

      this.fetchPlugins();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    fetchPlugins() {
      const {
        organization,
        project
      } = this.props;

      if (!project || !organization) {
        return;
      }

      (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__.fetchPlugins)({
        projectId: project.slug,
        orgId: organization.slug
      });
    }

    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(WrappedComponent, { ...this.props,
        plugins: this.state
      });
    }

  }

  WithPlugins.displayName = "WithPlugins";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithPlugins, "displayName", `withPlugins(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_6__["default"])(WrappedComponent)})`);

  return (0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_8__["default"])(WithPlugins));
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withPlugins);

/***/ }),

/***/ "./app/views/settings/project/permissionAlert.tsx":
/*!********************************************************!*\
  !*** ./app/views/settings/project/permissionAlert.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const PermissionAlert = _ref => {
  let {
    access = ['project:write'],
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_0__["default"], {
    access: access,
    children: _ref2 => {
      let {
        hasAccess
      } = _ref2;
      return !hasAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        ...props,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner, manager, or admin role.')
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/projectPlugins/index.tsx":
/*!*****************************************************!*\
  !*** ./app/views/settings/projectPlugins/index.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/plugins */ "./app/actionCreators/plugins.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withPlugins */ "./app/utils/withPlugins.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _projectPlugins__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./projectPlugins */ "./app/views/settings/projectPlugins/projectPlugins.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














class ProjectPluginsContainer extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const plugins = await (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__.fetchPlugins)(this.props.params);
      const installCount = plugins.filter(plugin => plugin.hasConfiguration && plugin.enabled).length;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.index_viewed', {
        integrations_installed: installCount,
        view: 'legacy_integrations',
        organization: this.props.organization
      }, {
        startSession: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (pluginId, shouldEnable) => {
      const {
        projectId,
        orgId
      } = this.props.params;
      const actionCreator = shouldEnable ? sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__.enablePlugin : sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_3__.disablePlugin;
      actionCreator({
        projectId,
        orgId,
        pluginId
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    const {
      loading,
      error,
      plugins
    } = this.props.plugins || {};
    const {
      orgId
    } = this.props.params;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Legacy Integrations');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_4__["default"], {
        title: title,
        orgSlug: orgId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__["default"], {
        title: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_9__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_projectPlugins__WEBPACK_IMPORTED_MODULE_10__["default"], { ...this.props,
        onChange: this.handleChange,
        loading: loading,
        error: error,
        plugins: plugins
      })]
    });
  }

}

ProjectPluginsContainer.displayName = "ProjectPluginsContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_7__["default"])(ProjectPluginsContainer));

/***/ }),

/***/ "./app/views/settings/projectPlugins/projectPluginRow.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/projectPlugins/projectPluginRow.tsx ***!
  \****************************************************************/
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
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const grayText =  true ? {
  name: "is2cq7",
  styles: "color:#979ba0"
} : 0;

class ProjectPluginRow extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", () => {
      const {
        onChange,
        id,
        enabled
      } = this.props;
      onChange(id, !enabled);
      const eventKey = !enabled ? 'integrations.enabled' : 'integrations.disabled';
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.trackIntegrationAnalytics)(eventKey, {
        integration: id,
        integration_type: 'plugin',
        view: 'legacy_integrations',
        organization: this.props.organization
      });
    });
  }

  render() {
    const {
      id,
      name,
      slug,
      version,
      author,
      hasConfiguration,
      enabled,
      canDisable
    } = this.props;
    const configureUrl = (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_12__["default"])(id, this.props);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
      access: ['project:write'],
      children: _ref => {
        let {
          hasAccess
        } = _ref;
        const LinkOrSpan = hasAccess ? sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"] : 'span';
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(PluginItem, {
          className: slug,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(PluginInfo, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPluginIcon, {
              size: 48,
              pluginId: id
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(PluginDescription, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(PluginName, {
                children: [`${name} `, (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
                  value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Version, {
                    children: version ? `v${version}` : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("em", {
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('n/a')
                    })
                  }),
                  fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Version, {
                    children: "v10"
                  })
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
                children: [author && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
                  css: grayText,
                  href: author.url,
                  children: author.name
                }), hasConfiguration && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("span", {
                  children: [' ', "\xB7", ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(LinkOrSpan, {
                    css: grayText,
                    to: configureUrl,
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Configure plugin')
                  })]
                })]
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_7__["default"], {
            size: "lg",
            isDisabled: !hasAccess || !canDisable,
            isActive: enabled,
            toggle: this.handleChange
          })]
        }, id);
      }
    });
  }

}

ProjectPluginRow.displayName = "ProjectPluginRow";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_13__["default"])(ProjectPluginRow));

const PluginItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "evund0f5"
} : 0)( true ? {
  name: "zol16h",
  styles: "display:flex;flex:1;align-items:center"
} : 0);

const PluginDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "evund0f4"
} : 0)( true ? {
  name: "1cepywk",
  styles: "display:flex;justify-content:center;flex-direction:column"
} : 0);

const PluginInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "evund0f3"
} : 0)( true ? {
  name: "1l1txui",
  styles: "display:flex;flex:1;line-height:24px"
} : 0);

const PluginName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "evund0f2"
} : 0)( true ? {
  name: "11g4mt0",
  styles: "font-size:16px"
} : 0);

const StyledPluginIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "evund0f1"
} : 0)( true ? {
  name: "o7nnmj",
  styles: "margin-right:16px"
} : 0); // Keeping these colors the same from old integrations page


const Version = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "evund0f0"
} : 0)( true ? {
  name: "qhuumn",
  styles: "color:#babec2"
} : 0);

/***/ }),

/***/ "./app/views/settings/projectPlugins/projectPlugins.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/projectPlugins/projectPlugins.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_routeError__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/routeError */ "./app/views/routeError.tsx");
/* harmony import */ var _projectPluginRow__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./projectPluginRow */ "./app/views/settings/projectPlugins/projectPluginRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class ProjectPlugins extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    const {
      plugins,
      loading,
      error,
      onChange,
      routes,
      params,
      project
    } = this.props;
    const {
      orgId
    } = this.props.params;
    const hasError = error;
    const isLoading = !hasError && loading;

    if (hasError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_routeError__WEBPACK_IMPORTED_MODULE_6__["default"], {
        error: error
      });
    }

    if (isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {});
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Legacy Integration')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Enabled')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelBody, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelAlert, {
          type: "warning",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_1__["default"], {
            access: ['org:integrations'],
            children: _ref => {
              let {
                hasAccess
              } = _ref;
              return hasAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tct)("Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available. Visit the [link:organization integrations] settings to manage them.", {
                link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
                  to: `/settings/${orgId}/integrations`
                })
              }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)("Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available.");
            }
          })
        }), plugins.filter(p => {
          return !p.isHidden;
        }).map(plugin => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_projectPluginRow__WEBPACK_IMPORTED_MODULE_7__["default"], {
            params: params,
            routes: routes,
            project: project,
            ...plugin,
            onChange: onChange
          })
        }, plugin.id))]
      })]
    });
  }

}

ProjectPlugins.displayName = "ProjectPlugins";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectPlugins);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectPlugins_index_tsx.4f9e99156e74f23ff002d397089ad45e.js.map