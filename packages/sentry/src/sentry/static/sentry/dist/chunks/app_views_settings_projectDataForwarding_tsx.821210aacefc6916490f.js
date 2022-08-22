"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_projectDataForwarding_tsx"],{

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

/***/ "./app/views/settings/projectDataForwarding.tsx":
/*!******************************************************!*\
  !*** ./app/views/settings/projectDataForwarding.tsx ***!
  \******************************************************/
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
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pluginList */ "./app/components/pluginList.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/project/permissionAlert */ "./app/views/settings/project/permissionAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















class DataForwardingStats extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    const options = {
      query: {
        since,
        until,
        resolution: '1d',
        stat: 'forwarded'
      }
    };
    return [['stats', `/projects/${orgId}/${projectId}/stats/`, options]];
  }

  renderBody() {
    const {
      projectId
    } = this.props.params;
    const {
      stats
    } = this.state;
    const series = {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Forwarded'),
      data: stats.map(_ref => {
        let [timestamp, value] = _ref;
        return {
          name: timestamp * 1000,
          value
        };
      })
    };
    const forwardedAny = series.data.some(_ref2 => {
      let {
        value
      } = _ref2;
      return value > 0;
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Data Forwarding'),
        projectSlug: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Forwarded events in the last 30 days (by day)')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
        withPadding: true,
        children: forwardedAny ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_8__["default"], {
          isGroupedByDate: true,
          showTimeInTooltip: true,
          labelYAxisExtents: true,
          series: [series],
          height: 150
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Nothing forwarded in the last 30 days.'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Total events forwarded to third party integrations.')
        })
      })]
    });
  }

}

class ProjectDataForwarding extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onEnablePlugin", plugin => this.updatePlugin(plugin, true));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDisablePlugin", plugin => this.updatePlugin(plugin, false));
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params;
    return [['plugins', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  get forwardingPlugins() {
    return this.state.plugins.filter(p => p.type === 'data-forwarding' && p.hasConfiguration);
  }

  updatePlugin(plugin, enabled) {
    const plugins = this.state.plugins.map(p => ({ ...p,
      enabled: p.id === plugin.id ? enabled : p.enabled
    }));
    this.setState({
      plugins
    });
  }

  renderBody() {
    const {
      params,
      organization,
      project
    } = this.props;
    const plugins = this.forwardingPlugins;
    const hasAccess = organization.access.includes('project:write');
    const pluginsPanel = plugins.length > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_11__["default"], {
      organization: organization,
      project: project,
      pluginList: plugins,
      onEnablePlugin: this.onEnablePlugin,
      onDisablePlugin: this.onDisablePlugin
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('There are no integrations available for data forwarding')
      })
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("div", {
      "data-test-id": "data-forwarding-settings",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
        features: ['projects:data-forwarding'],
        hookName: "feature-disabled:data-forwarding",
        children: _ref3 => {
          let {
            hasFeature,
            features
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_16__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Data Forwarding')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_17__["default"], {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)(`Data Forwarding allows processed events to be sent to your
                favorite business intelligence tools. The exact payload and
                types of data depend on the integration you're using. Learn
                more about this functionality in our [link:documentation].`, {
                link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  href: "https://docs.sentry.io/product/data-management-settings/data-forwarding/"
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_project_permissionAlert__WEBPACK_IMPORTED_MODULE_18__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
              showIcon: true,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)(`Sentry forwards [em:all applicable error events] to the provider, in
                some cases this may be a significant volume of data.`, {
                em: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("strong", {})
              })
            }), !hasFeature && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_5__["default"], {
              alert: true,
              featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Data Forwarding'),
              features: features
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(DataForwardingStats, {
              params: params
            }), hasAccess && hasFeature && pluginsPanel]
          });
        }
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])(ProjectDataForwarding));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_projectDataForwarding_tsx.87104e6175c42f86599e376ba5a89933.js.map