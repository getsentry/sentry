"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_pluginDetailedView_tsx"],{

/***/ "./app/views/organizationIntegrations/installedPlugin.tsx":
/*!****************************************************************!*\
  !*** ./app/views/organizationIntegrations/installedPlugin.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "InstalledPlugin": () => (/* binding */ InstalledPlugin),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class InstalledPlugin extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pluginUpdate", async function (data) {
      let method = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'POST';
      const {
        organization,
        projectItem,
        plugin
      } = _this.props; // no try/catch so the caller will have to have it

      await _this.props.api.requestPromise(`/projects/${organization.slug}/${projectItem.projectSlug}/plugins/${plugin.id}/`, {
        method,
        data
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updatePluginEnableStatus", async enabled => {
      if (enabled) {
        await this.pluginUpdate({
          enabled
        });
      } else {
        await this.pluginUpdate({}, 'DELETE');
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReset", async () => {
      try {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Removing...'));
        await this.pluginUpdate({
          reset: true
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configuration was removed'));
        this.props.onResetConfiguration(this.projectId);
        this.props.trackIntegrationAnalytics('integrations.uninstall_completed');
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to remove configuration'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUninstallClick", () => {
      this.props.trackIntegrationAnalytics('integrations.uninstall_clicked');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleEnablePlugin", async function (projectId) {
      let status = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

      try {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Enabling...'));
        await _this.updatePluginEnableStatus(status);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)(status ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configuration was enabled.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configuration was disabled.'));

        _this.props.onPluginEnableStatusChange(projectId, status);

        _this.props.trackIntegrationAnalytics(status ? 'integrations.enabled' : 'integrations.disabled');
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(status ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to enable configuration.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to disable configuration.'));
      }
    });
  }

  get projectId() {
    return this.props.projectItem.projectId;
  }

  getConfirmMessage() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Deleting this installation will disable the integration for this project and remove any configurations.')
      })
    });
  }

  get projectForBadge() {
    // this function returns the project as needed for the ProjectBadge component
    const {
      projectItem
    } = this.props;
    return {
      slug: projectItem.projectSlug,
      platform: projectItem.projectPlatform ? projectItem.projectPlatform : undefined
    };
  }

  render() {
    const {
      className,
      plugin,
      organization,
      projectItem
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Container, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
        access: ['org:integrations'],
        children: _ref => {
          let {
            hasAccess
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(IntegrationFlex, {
            className: className,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(IntegrationItemBox, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
                project: this.projectForBadge
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledButton, {
                borderless: true,
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSettings, {}),
                disabled: !hasAccess,
                to: `/settings/${organization.slug}/projects/${projectItem.projectSlug}/plugins/${plugin.id}/`,
                "data-test-id": "integration-configure-button",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Configure')
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
                priority: "danger",
                onConfirming: this.handleUninstallClick,
                disabled: !hasAccess,
                confirmText: "Delete Installation",
                onConfirm: () => this.handleReset(),
                message: this.getConfirmMessage(),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledButton, {
                  disabled: !hasAccess,
                  borderless: true,
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDelete, {}),
                  "data-test-id": "integration-remove-button",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Uninstall')
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_10__["default"], {
              isActive: projectItem.enabled,
              toggle: () => this.toggleEnablePlugin(projectItem.projectId, !projectItem.enabled),
              isDisabled: !hasAccess
            })]
          });
        }
      })
    });
  }

}
InstalledPlugin.displayName = "InstalledPlugin";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__["default"])(InstalledPlugin));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emrs3rl3"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";border:1px solid ", p => p.theme.border, ";border-bottom:none;background-color:", p => p.theme.background, ";&:last-child{border-bottom:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "emrs3rl2"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const IntegrationFlex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emrs3rl1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IntegrationItemBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "emrs3rl0"
} : 0)( true ? {
  name: "m4hdlm",
  styles: "flex:1 0 fit-content;box-sizing:border-box;display:flex;flex-direction:row;min-width:0"
} : 0);

/***/ }),

/***/ "./app/views/organizationIntegrations/pluginDeprecationAlert.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/organizationIntegrations/pluginDeprecationAlert.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class PluginDeprecationAlert extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  render() {
    const {
      organization,
      plugin
    } = this.props; // Short-circuit if not deprecated.

    if (!plugin.deprecationDate) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {});
    }

    const resource = plugin.altIsSentryApp ? 'sentry-apps' : 'integrations';
    const upgradeUrl = `/settings/${organization.slug}/${resource}/${plugin.firstPartyAlternative}/`;
    const queryParams = `?${plugin.altIsSentryApp ? '' : 'tab=configurations&'}referrer=directory_upgrade_now`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "warning",
        showIcon: true,
        trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(UpgradeNowButton, {
          href: `${upgradeUrl}${queryParams}`,
          size: "xs",
          onClick: () => (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_5__.trackIntegrationAnalytics)('integrations.resolve_now_clicked', {
            integration_type: 'plugin',
            integration: plugin.slug,
            organization
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Upgrade Now')
        }),
        children: `This integration is being deprecated on ${plugin.deprecationDate}. Please upgrade to avoid any disruption.`
      })
    });
  }

}

PluginDeprecationAlert.displayName = "PluginDeprecationAlert";

const UpgradeNowButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1otf8d90"
} : 0)("color:", p => p.theme.subText, ";float:right;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PluginDeprecationAlert);

/***/ }),

/***/ "./app/views/organizationIntegrations/pluginDetailedView.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/organizationIntegrations/pluginDetailedView.tsx ***!
  \*******************************************************************/
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
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/contextPickerModal */ "./app/components/contextPickerModal.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./abstractIntegrationDetailedView */ "./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx");
/* harmony import */ var _installedPlugin__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./installedPlugin */ "./app/views/organizationIntegrations/installedPlugin.tsx");
/* harmony import */ var _pluginDeprecationAlert__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./pluginDeprecationAlert */ "./app/views/organizationIntegrations/pluginDeprecationAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class PluginDetailedView extends _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetConfiguration", projectId => {
      // make a copy of our project list
      const projectList = this.plugin.projectList.slice(); // find the index of the project

      const index = projectList.findIndex(item => item.projectId === projectId); // should match but quit if it doesn't

      if (index < 0) {
        return;
      } // remove from array


      projectList.splice(index, 1); // update state

      this.setState({
        plugins: [{ ...this.state.plugins[0],
          projectList
        }]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handlePluginEnableStatus", function (projectId) {
      let enable = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

      // make a copy of our project list
      const projectList = _this.plugin.projectList.slice(); // find the index of the project


      const index = projectList.findIndex(item => item.projectId === projectId); // should match but quit if it doesn't

      if (index < 0) {
        return;
      } // update item in array


      projectList[index] = { ...projectList[index],
        enabled: enable
      }; // update state

      _this.setState({
        plugins: [{ ..._this.state.plugins[0],
          projectList
        }]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddToProject", () => {
      const plugin = this.plugin;
      const {
        organization,
        router
      } = this.props;
      this.trackIntegrationAnalytics('integrations.plugin_add_to_project_clicked');
      sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_6__["default"], { ...modalProps,
        nextPath: `/settings/${organization.slug}/projects/:projectId/plugins/${plugin.id}/`,
        needProject: true,
        needOrg: false,
        onFinish: path => {
          modalProps.closeModal();
          router.push(path);
        }
      }), {
        allowClickClose: false
      });
    });
  }

  getEndpoints() {
    const {
      orgId,
      integrationSlug
    } = this.props.params;
    return [['plugins', `/organizations/${orgId}/plugins/configs/?plugins=${integrationSlug}`]];
  }

  get integrationType() {
    return 'plugin';
  }

  get plugin() {
    return this.state.plugins[0];
  }

  get description() {
    return this.plugin.description || '';
  }

  get author() {
    var _this$plugin$author;

    return (_this$plugin$author = this.plugin.author) === null || _this$plugin$author === void 0 ? void 0 : _this$plugin$author.name;
  }

  get resourceLinks() {
    return this.plugin.resourceLinks || [];
  }

  get installationStatus() {
    return this.plugin.projectList.length > 0 ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return `${this.plugin.name}${this.plugin.isHidden ? ' (Legacy)' : ''}`;
  }

  get featureData() {
    return this.plugin.featureDescriptions;
  }

  getTabDisplay(tab) {
    // we want to show project configurations to make it more clear
    if (tab === 'configurations') {
      return 'project configurations';
    }

    return 'overview';
  }

  renderTopButton(disabledFromFeatures, userHasAccess) {
    if (userHasAccess) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(AddButton, {
        "data-test-id": "install-button",
        disabled: disabledFromFeatures,
        onClick: this.handleAddToProject,
        size: "sm",
        priority: "primary",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Add to Project')
      });
    }

    return this.renderRequestIntegrationButton();
  }

  renderConfigurations() {
    const plugin = this.plugin;
    const {
      organization
    } = this.props;

    if (plugin.projectList.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_pluginDeprecationAlert__WEBPACK_IMPORTED_MODULE_12__["default"], {
          organization: organization,
          plugin: plugin
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
          children: plugin.projectList.map(projectItem => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_installedPlugin__WEBPACK_IMPORTED_MODULE_11__["default"], {
            organization: organization,
            plugin: plugin,
            projectItem: projectItem,
            onResetConfiguration: this.handleResetConfiguration,
            onPluginEnableStatusChange: this.handlePluginEnableStatus,
            trackIntegrationAnalytics: this.trackIntegrationAnalytics
          }, projectItem.projectId))
        })]
      });
    }

    return this.renderEmptyConfigurations();
  }

}

const AddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e13hh9ci0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(PluginDetailedView));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_pluginDetailedView_tsx.aed79de1745605c9d6a93439c7603db1.js.map