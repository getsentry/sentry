"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectPlugins_details_tsx"],{

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

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "./app/views/settings/projectPlugins/details.tsx":
/*!*******************************************************!*\
  !*** ./app/views/settings/projectPlugins/details.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectPluginDetails": () => (/* binding */ ProjectPluginDetails),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/plugins */ "./app/actionCreators/plugins.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_pluginConfig__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pluginConfig */ "./app/components/pluginConfig.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withPlugins */ "./app/utils/withPlugins.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















/**
 * There are currently two sources of truths for plugin details:
 *
 * 1) PluginsStore has a list of plugins, and this is where ENABLED state lives
 * 2) We fetch "plugin details" via API and save it to local state as `pluginDetails`.
 *    This is because "details" call contains form `config` and the "list" endpoint does not.
 *    The more correct way would be to pass `config` to PluginConfig and use plugin from
 *    PluginsStore
 */
class ProjectPluginDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_12__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReset", () => {
      const {
        projectId,
        orgId,
        pluginId
      } = this.props.params;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Saving changes\u2026'));
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)('integrations.uninstall_clicked', {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization: this.props.organization
      });
      this.api.request(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
        method: 'POST',
        data: {
          reset: true
        },
        success: pluginDetails => {
          this.setState({
            pluginDetails
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Plugin was reset'));
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)('integrations.uninstall_completed', {
            integration: pluginId,
            integration_type: 'plugin',
            view: 'plugin_details',
            organization: this.props.organization
          });
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('An error occurred'));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEnable", () => {
      (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_4__.enablePlugin)(this.props.params);
      this.analyticsChangeEnableStatus(true);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisable", () => {
      (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_4__.disablePlugin)(this.props.params);
      this.analyticsChangeEnableStatus(false);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "analyticsChangeEnableStatus", enabled => {
      const {
        pluginId
      } = this.props.params;
      const eventKey = enabled ? 'integrations.enabled' : 'integrations.disabled';
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)(eventKey, {
        integration: pluginId,
        integration_type: 'plugin',
        view: 'plugin_details',
        organization: this.props.organization
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevProps.params.pluginId !== this.props.params.pluginId) {
      this.recordDetailsViewed();
    }
  }

  componentDidMount() {
    this.recordDetailsViewed();
  }

  recordDetailsViewed() {
    const {
      pluginId
    } = this.props.params;
    (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)('integrations.details_viewed', {
      integration: pluginId,
      integration_type: 'plugin',
      view: 'plugin_details',
      organization: this.props.organization
    });
  }

  getTitle() {
    const {
      plugin
    } = this.state;

    if (plugin && plugin.name) {
      return plugin.name;
    }

    return 'Sentry';
  }

  getEndpoints() {
    const {
      projectId,
      orgId,
      pluginId
    } = this.props.params;
    return [['pluginDetails', `/projects/${orgId}/${projectId}/plugins/${pluginId}/`]];
  }

  trimSchema(value) {
    return value.split('//')[1];
  }

  // Enabled state is handled via PluginsStore and not via plugins detail
  getEnabled() {
    const {
      pluginDetails
    } = this.state;
    const {
      plugins
    } = this.props;
    const plugin = plugins && plugins.plugins && plugins.plugins.find(_ref => {
      let {
        slug
      } = _ref;
      return slug === this.props.params.pluginId;
    });
    return plugin ? plugin.enabled : pluginDetails && pluginDetails.enabled;
  }

  renderActions() {
    const {
      pluginDetails
    } = this.state;

    if (!pluginDetails) {
      return null;
    }

    const enabled = this.getEnabled();

    const enable = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledButton, {
      size: "sm",
      onClick: this.handleEnable,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Enable Plugin')
    });

    const disable = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledButton, {
      size: "sm",
      priority: "danger",
      onClick: this.handleDisable,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Disable Plugin')
    });

    const toggleEnable = enabled ? disable : enable;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
      className: "pull-right",
      children: [pluginDetails.canDisable && toggleEnable, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        size: "sm",
        onClick: this.handleReset,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Reset Configuration')
      })]
    });
  }

  renderBody() {
    var _pluginDetails$author, _pluginDetails$author2;

    const {
      organization,
      project
    } = this.props;
    const {
      pluginDetails
    } = this.state;

    if (!pluginDetails) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_13__["default"], {
        title: pluginDetails.name,
        action: this.renderActions()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
        className: "row",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
          className: "col-md-7",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_pluginConfig__WEBPACK_IMPORTED_MODULE_7__["default"], {
            organization: organization,
            project: project,
            data: pluginDetails,
            enabled: this.getEnabled(),
            onDisablePlugin: this.handleDisable
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("div", {
          className: "col-md-4 col-md-offset-1",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
            className: "pluginDetails-meta",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h4", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Plugin Information')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("dl", {
              className: "flat",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dt", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Name')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dd", {
                children: pluginDetails.name
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dt", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Author')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dd", {
                children: (_pluginDetails$author = pluginDetails.author) === null || _pluginDetails$author === void 0 ? void 0 : _pluginDetails$author.name
              }), ((_pluginDetails$author2 = pluginDetails.author) === null || _pluginDetails$author2 === void 0 ? void 0 : _pluginDetails$author2.url) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dt", {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('URL')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dd", {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
                    href: pluginDetails.author.url,
                    children: this.trimSchema(pluginDetails.author.url)
                  })
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dt", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Version')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dd", {
                children: pluginDetails.version
              })]
            }), pluginDetails.description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h4", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Description')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
                className: "description",
                children: pluginDetails.description
              })]
            }), pluginDetails.resourceLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)("div", {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("h4", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Resources')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dl", {
                className: "flat",
                children: pluginDetails.resourceLinks.map(_ref2 => {
                  let {
                    title,
                    url
                  } = _ref2;
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("dd", {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
                      href: url,
                      children: title
                    })
                  }, url);
                })
              })]
            })]
          })
        })]
      })]
    });
  }

}


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_11__["default"])(ProjectPluginDetails));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eq4tbyn0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.75), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectPlugins_details_tsx.e0743269a00824c59a19d78011d40975.js.map