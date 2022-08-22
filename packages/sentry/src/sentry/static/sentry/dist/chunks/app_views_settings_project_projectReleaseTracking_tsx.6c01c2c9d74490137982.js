"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectReleaseTracking_tsx"],{

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function routeTitleGen(routeName, orgSlug) {
  let withSentry = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let projectSlug = arguments.length > 3 ? arguments[3] : undefined;
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (routeTitleGen);

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

/***/ "./app/views/settings/project/projectReleaseTracking.tsx":
/*!***************************************************************!*\
  !*** ./app/views/settings/project/projectReleaseTracking.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectReleaseTracking": () => (/* binding */ ProjectReleaseTracking),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pluginList */ "./app/components/pluginList.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withPlugins */ "./app/utils/withPlugins.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















const TOKEN_PLACEHOLDER = 'YOUR_TOKEN';
const WEBHOOK_PLACEHOLDER = 'YOUR_WEBHOOK_URL';
const placeholderData = {
  token: TOKEN_PLACEHOLDER,
  webhookUrl: WEBHOOK_PLACEHOLDER
};

class ProjectReleaseTracking extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_18__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRegenerateToken", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.api.request(`/projects/${orgId}/${projectId}/releases/token/`, {
        method: 'POST',
        data: {
          project: projectId
        },
        success: data => {
          this.setState({
            data: {
              token: data.token,
              webhookUrl: data.webhookUrl
            }
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Your deploy token has been regenerated. You will need to update any existing deploy hooks.'));
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Unable to regenerate deploy token, please try again'));
        }
      });
    });
  }

  getTitle() {
    const {
      projectId
    } = this.props.params;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Releases'), projectId, false);
  }

  getEndpoints() {
    const {
      orgId,
      projectId
    } = this.props.params; // Allow 403s

    return [['data', `/projects/${orgId}/${projectId}/releases/token/`, {}, {
      allowError: err => err && err.status === 403
    }]];
  }

  getReleaseWebhookIntructions() {
    const {
      webhookUrl
    } = this.state.data || placeholderData;
    return 'curl ' + webhookUrl + ' \\' + '\n  ' + '-X POST \\' + '\n  ' + "-H 'Content-Type: application/json' \\" + '\n  ' + '-d \'{"version": "abcdefg"}\'';
  }

  renderBody() {
    const {
      organization,
      project,
      plugins
    } = this.props;
    const hasWrite = organization.access.includes('project:write');

    if (plugins.loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {});
    }

    const pluginList = plugins.plugins.filter(p => p.type === 'release-tracking' && p.hasConfiguration);
    let {
      token,
      webhookUrl
    } = this.state.data || placeholderData;
    token = (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__["default"])({
      value: token,
      fixed: '__TOKEN__'
    });
    webhookUrl = (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__["default"])({
      value: webhookUrl,
      fixed: '__WEBHOOK_URL__'
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Release Tracking')
      }), !hasWrite && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You do not have sufficient permissions to access Release tokens, placeholders are displayed below.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Configure release tracking for this project to automatically record new releases of your application.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Client Configuration')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Start by binding the [release] attribute in your application, take a look at [link] to see how to configure this for the SDK you are using.', {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                href: "https://docs.sentry.io/platform-redirect/?next=/configuration/releases/",
                children: "our docs"
              }),
              release: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("code", {
                children: "release"
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)("This will annotate each event with the version of your application, as well as automatically create a release entity in the system the first time it's seen.")
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('In addition you may configure a release hook (or use our API) to push a release and include additional metadata with it.')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Deploy Token')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__["default"], {
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Token'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('A unique secret which is used to generate deploy hook URLs'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_9__["default"], {
              children: token
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_8__["default"], {
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Regenerate Token'),
            help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('If a service becomes compromised, you should regenerate the token and re-configure any deploy hooks with the newly generated URL.'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__["default"], {
                disabled: !hasWrite,
                priority: "danger",
                onConfirm: this.handleRegenerateToken,
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Are you sure you want to regenerate your token? Your current token will no longer be usable.'),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
                  type: "button",
                  priority: "danger",
                  disabled: !hasWrite,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Regenerate Token')
                })
              })
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Webhook')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_5__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("pre", {
              children: webhookUrl
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('The release webhook accepts the same parameters as the "Create a new Release" API endpoint.')
          }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_15__["default"])({
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_5__["default"], {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("pre", {
                children: this.getReleaseWebhookIntructions()
              })
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("pre", {
              children: `curl __WEBHOOK_URL__ \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d \'{"version": "abcdefg"}\'`
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pluginList__WEBPACK_IMPORTED_MODULE_13__["default"], {
        organization: organization,
        project: project,
        pluginList: pluginList
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('API')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You can notify Sentry when you release new versions of your application via our HTTP API.')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('See the [link:releases documentation] for more information.', {
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                href: "https://docs.sentry.io/workflow/releases/"
              })
            })
          })]
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPlugins__WEBPACK_IMPORTED_MODULE_17__["default"])(ProjectReleaseTracking)); // Export for tests



/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectReleaseTracking_tsx.29da5cf9c406da52cc442c5b8316caae.js.map