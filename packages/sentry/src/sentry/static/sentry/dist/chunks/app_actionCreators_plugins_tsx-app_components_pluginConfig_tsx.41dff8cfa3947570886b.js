"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_plugins_tsx-app_components_pluginConfig_tsx"],{

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

/***/ "./app/components/pluginConfig.tsx":
/*!*****************************************!*\
  !*** ./app/components/pluginConfig.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PluginConfig": () => (/* binding */ PluginConfig),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/plugins */ "./app/plugins/index.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class PluginConfig extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: !sentry_plugins__WEBPACK_IMPORTED_MODULE_10__["default"].isLoaded(this.props.data),
      testResults: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisablePlugin", () => {
      this.props.onDisablePlugin(this.props.data);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTestPlugin", async () => {
      this.setState({
        testResults: ''
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Sending test...'));

      try {
        const data = await this.props.api.requestPromise(this.getPluginEndpoint(), {
          method: 'POST',
          data: {
            test: true
          }
        });
        this.setState({
          testResults: JSON.stringify(data.detail)
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Test Complete!'));
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('An unexpected error occurred while testing your plugin. Please try again.'));
      }
    });
  }

  componentDidMount() {
    this.loadPlugin(this.props.data);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.loadPlugin(nextProps.data);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(nextState, this.state) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(nextProps.data, this.props.data);
  }

  loadPlugin(data) {
    this.setState({
      loading: true
    }, () => {
      sentry_plugins__WEBPACK_IMPORTED_MODULE_10__["default"].load(data, () => {
        this.setState({
          loading: false
        });
      });
    });
  }

  getPluginEndpoint() {
    const {
      organization,
      project,
      data
    } = this.props;
    return `/projects/${organization.slug}/${project.slug}/plugins/${data.id}/`;
  }

  createMarkup() {
    return {
      __html: this.props.data.doc
    };
  }

  render() {
    const {
      data
    } = this.props; // If passed via props, use that value instead of from `data`

    const enabled = typeof this.props.enabled !== 'undefined' ? this.props.enabled : data.enabled;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.Panel, {
      className: `plugin-config ref-plugin-config-${data.id}`,
      "data-test-id": "plugin-config",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
        hasButtons: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(PluginName, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledPluginIcon, {
            pluginId: data.id
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("span", {
            children: data.name
          })]
        }), data.canDisable && enabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Actions, {
          children: [data.isTestable && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(TestPluginButton, {
            onClick: this.handleTestPlugin,
            size: "sm",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Test Plugin')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
            size: "sm",
            onClick: this.handleDisablePlugin,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Disable')
          })]
        })]
      }), data.status === 'beta' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelAlert, {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This plugin is considered beta and may change in the future.')
      }), this.state.testResults !== '' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelAlert, {
        type: "info",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("strong", {
          children: "Test Results"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
          children: this.state.testResults
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(StyledPanelBody, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
          dangerouslySetInnerHTML: this.createMarkup()
        }), this.state.loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {}) : sentry_plugins__WEBPACK_IMPORTED_MODULE_10__["default"].get(data).renderSettings({
          organization: this.props.organization,
          project: this.props.project
        })]
      })]
    });
  }

}

PluginConfig.displayName = "PluginConfig";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(PluginConfig, "defaultProps", {
  onDisablePlugin: () => {}
});


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_13__["default"])(PluginConfig));

const PluginName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1kqgtma4"
} : 0)( true ? {
  name: "y37upr",
  styles: "display:flex;align-items:center;flex:1"
} : 0);

const StyledPluginIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e1kqgtma3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1kqgtma2"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const TestPluginButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1kqgtma1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelBody,  true ? {
  target: "e1kqgtma0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";padding-bottom:0;" + ( true ? "" : 0));

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_plugins_tsx-app_components_pluginConfig_tsx.bde1c1685d9fc83e87c9d818973254f4.js.map