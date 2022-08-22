"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_integrationDetailedView_tsx"],{

/***/ "./app/views/organizationIntegrations/addIntegration.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationIntegrations/addIntegration.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddIntegration)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");







class AddIntegration extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "dialog", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openDialog", urlParams => {
      const {
        account,
        analyticsParams,
        modalParams,
        organization,
        provider
      } = this.props;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_start', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      const name = 'sentryAddIntegration';
      const {
        url,
        width,
        height
      } = provider.setupDialog;
      const {
        left,
        top
      } = this.computeCenteredWindow(width, height);
      let query = { ...urlParams
      };

      if (account) {
        query.account = account;
      }

      if (modalParams) {
        query = { ...query,
          ...modalParams
        };
      }

      const installUrl = `${url}?${query_string__WEBPACK_IMPORTED_MODULE_3__.stringify(query)}`;
      const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;
      this.dialog = window.open(installUrl, name, opts);
      this.dialog && this.dialog.focus();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "didReceiveMessage", message => {
      const {
        analyticsParams,
        onInstall,
        organization,
        provider
      } = this.props;

      if (message.origin !== document.location.origin) {
        return;
      }

      if (message.source !== this.dialog) {
        return;
      }

      const {
        success,
        data
      } = message.data;
      this.dialog = null;

      if (!success) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(data.error);
        return;
      }

      if (!data) {
        return;
      }

      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_6__.trackIntegrationAnalytics)('integrations.installation_complete', {
        integration: provider.key,
        integration_type: 'first_party',
        organization,
        ...analyticsParams
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('%s added', provider.name));
      onInstall(data);
    });
  }

  componentDidMount() {
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog && this.dialog.close();
  }

  computeCenteredWindow(width, height) {
    // Taken from: https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const innerWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    const innerHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
    const left = innerWidth / 2 - width / 2 + screenLeft;
    const top = innerHeight / 2 - height / 2 + screenTop;
    return {
      left,
      top
    };
  }

  render() {
    const {
      children
    } = this.props;
    return children(this.openDialog);
  }

}
AddIntegration.displayName = "AddIntegration";

/***/ }),

/***/ "./app/views/organizationIntegrations/addIntegrationButton.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/organizationIntegrations/addIntegrationButton.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AddIntegrationButton)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _addIntegration__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./addIntegration */ "./app/views/organizationIntegrations/addIntegration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






class AddIntegrationButton extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    const {
      provider,
      buttonText,
      onAddIntegration,
      organization,
      reinstall,
      analyticsParams,
      modalParams,
      ...buttonProps
    } = this.props;
    const label = buttonText || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(reinstall ? 'Enable' : 'Add %s', provider.metadata.noun);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      disabled: provider.canAdd,
      title: `Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_addIntegration__WEBPACK_IMPORTED_MODULE_4__["default"], {
        provider: provider,
        onInstall: onAddIntegration,
        organization: organization,
        analyticsParams: analyticsParams,
        modalParams: modalParams,
        children: onClick => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          disabled: !provider.canAdd,
          ...buttonProps,
          onClick: () => onClick(),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Add integration'),
          children: label
        })
      })
    });
  }

}
AddIntegrationButton.displayName = "AddIntegrationButton";

/***/ }),

/***/ "./app/views/organizationIntegrations/installedIntegration.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/organizationIntegrations/installedIntegration.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ InstalledIntegration)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _addIntegrationButton__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./addIntegrationButton */ "./app/views/organizationIntegrations/addIntegrationButton.tsx");
/* harmony import */ var _integrationItem__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./integrationItem */ "./app/views/organizationIntegrations/integrationItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class InstalledIntegration extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUninstallClick", () => {
      this.props.trackIntegrationAnalytics('integrations.uninstall_clicked');
    });
  }

  getRemovalBodyAndText(aspects) {
    if (aspects && aspects.removal_dialog) {
      return {
        body: aspects.removal_dialog.body,
        actionText: aspects.removal_dialog.actionText
      };
    }

    return {
      body: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Deleting this integration will remove any project associated data. This action cannot be undone. Are you sure you want to delete this integration?'),
      actionText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Delete')
    };
  }

  handleRemove(integration) {
    this.props.onRemove(integration);
    this.props.trackIntegrationAnalytics('integrations.uninstall_completed');
  }

  get integrationStatus() {
    const {
      integration
    } = this.props; // there are multiple status fields for an integration we consider

    const statusList = [integration.status, integration.organizationIntegrationStatus];
    const firstNotActive = statusList.find(s => s !== 'active'); // Active if everything is active, otherwise the first inactive status

    return firstNotActive !== null && firstNotActive !== void 0 ? firstNotActive : 'active';
  }

  get removeConfirmProps() {
    const {
      integration
    } = this.props;
    const {
      body,
      actionText
    } = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Deleting this integration has consequences!')
      }), body]
    });

    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.handleRemove(integration)
    };
  }

  get disableConfirmProps() {
    const {
      integration
    } = this.props;
    const {
      body,
      actionText
    } = integration.provider.aspects.disable_dialog || {};

    const message = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "error",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('This integration cannot be removed in Sentry')
      }), body]
    });

    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.props.onDisable(integration)
    };
  }

  render() {
    const {
      integration,
      organization,
      provider,
      requiresUpgrade
    } = this.props;
    const removeConfirmProps = this.integrationStatus === 'active' && integration.provider.canDisable ? this.disableConfirmProps : this.removeConfirmProps;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
      access: ['org:integrations'],
      children: _ref => {
        let {
          hasAccess
        } = _ref;
        const disableAction = !(hasAccess && this.integrationStatus === 'active');
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(IntegrationItemBox, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_integrationItem__WEBPACK_IMPORTED_MODULE_14__["default"], {
              integration: integration
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
              disabled: hasAccess,
              position: "left",
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('You must be an organization owner, manager or admin to configure'),
              children: [requiresUpgrade && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_addIntegrationButton__WEBPACK_IMPORTED_MODULE_13__["default"], {
                analyticsParams: {
                  view: 'integrations_directory_integration_detail',
                  already_installed: true
                },
                buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Update Now'),
                "data-test-id": "integration-upgrade-button",
                disabled: disableAction,
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconWarning, {}),
                onAddIntegration: () => {},
                organization: organization,
                provider: provider,
                priority: "primary",
                size: "sm"
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledButton, {
                borderless: true,
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconSettings, {}),
                disabled: disableAction,
                to: `/settings/${organization.slug}/integrations/${provider.key}/${integration.id}/`,
                "data-test-id": "integration-configure-button",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Configure')
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
              disabled: hasAccess,
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('You must be an organization owner, manager or admin to uninstall'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_8__["default"], {
                priority: "danger",
                onConfirming: this.handleUninstallClick,
                disabled: !hasAccess,
                ...removeConfirmProps,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledButton, {
                  disabled: !hasAccess,
                  borderless: true,
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconDelete, {}),
                  "data-test-id": "integration-remove-button",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Uninstall')
                })
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledIntegrationStatus, {
            status: this.integrationStatus // Let the hook handle the alert for disabled org integrations
            ,
            hideTooltip: integration.organizationIntegrationStatus === 'disabled'
          })]
        });
      }
    });
  }

}
InstalledIntegration.displayName = "InstalledIntegration";

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e18ji42c3"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const IntegrationItemBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18ji42c2"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const IntegrationStatus = props => {
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_16__.a)();
  const {
    status,
    hideTooltip,
    ...p
  } = props;
  const color = status === 'active' ? theme.success : theme.gray300;

  const inner = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", { ...p,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {
      size: 6,
      color: color
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(IntegrationStatusText, {
      "data-test-id": "integration-status",
      children: `${status === 'active' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('enabled') : status === 'disabled' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('disabled') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('pending deletion')}`
    })]
  });

  return hideTooltip ? inner : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
    title: status === 'active' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('This integration can be disabled by clicking the Uninstall button') : status === 'disabled' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('This integration has been disconnected from the external provider') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('This integration is pending deletion.'),
    children: inner
  });
};

const StyledIntegrationStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(IntegrationStatus,  true ? {
  target: "e18ji42c1"
} : 0)("display:flex;align-items:center;color:", p => p.theme.gray300, ";font-weight:light;text-transform:capitalize;&:before{content:'|';color:", p => p.theme.gray200, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";font-weight:normal;}" + ( true ? "" : 0));

const IntegrationStatusText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18ji42c0"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.75), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationDetailedView.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationDetailedView.tsx ***!
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./abstractIntegrationDetailedView */ "./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx");
/* harmony import */ var _addIntegrationButton__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./addIntegrationButton */ "./app/views/organizationIntegrations/addIntegrationButton.tsx");
/* harmony import */ var _installedIntegration__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./installedIntegration */ "./app/views/organizationIntegrations/installedIntegration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const FirstPartyIntegrationAlert = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__["default"])({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null
});
const FirstPartyIntegrationAdditionalCTA = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_6__["default"])({
  hookName: 'component:first-party-integration-additional-cta',
  defaultComponent: () => null
});

class IntegrationDetailedView extends _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_13__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onInstall", integration => {
      // send the user to the configure integration view for that integration
      const {
        orgId
      } = this.props.params;
      this.props.router.push(`/settings/${orgId}/integrations/${integration.provider.key}/${integration.id}/`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRemove", integration => {
      const {
        orgId
      } = this.props.params;
      const origIntegrations = [...this.state.configurations];
      const integrations = this.state.configurations.map(i => i.id === integration.id ? { ...i,
        organizationIntegrationStatus: 'pending_deletion'
      } : i);
      this.setState({
        configurations: integrations
      });
      const options = {
        method: 'DELETE',
        error: () => {
          this.setState({
            configurations: origIntegrations
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Failed to remove Integration'));
        }
      };
      this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDisable", integration => {
      let url;
      const [domainName, orgName] = integration.domainName.split('/');

      if (integration.accountType === 'User') {
        url = `https://${domainName}/settings/installations/`;
      } else {
        url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
      }

      window.open(url, '_blank');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleExternalInstall", () => {
      this.trackIntegrationAnalytics('integrations.installation_start');
    });
  }

  getEndpoints() {
    const {
      orgId,
      integrationSlug
    } = this.props.params;
    return [['information', `/organizations/${orgId}/config/integrations/?provider_key=${integrationSlug}`], ['configurations', `/organizations/${orgId}/integrations/?provider_key=${integrationSlug}&includeConfig=0`]];
  }

  get integrationType() {
    return 'first_party';
  }

  get provider() {
    return this.state.information.providers[0];
  }

  get description() {
    return this.metadata.description;
  }

  get author() {
    return this.metadata.author;
  }

  get alerts() {
    const provider = this.provider;
    const metadata = this.metadata; // The server response for integration installations includes old icon CSS classes
    // We map those to the currently in use values to their react equivalents
    // and fallback to IconFlag just in case.

    const alerts = (metadata.aspects.alerts || []).map(item => ({ ...item,
      showIcon: true
    }));

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        showIcon: true,
        text: metadata.aspects.externalInstall.noticeText
      });
    }

    return alerts;
  }

  get resourceLinks() {
    const metadata = this.metadata;
    return [{
      url: metadata.source_url,
      title: 'View Source'
    }, {
      url: metadata.issue_url,
      title: 'Report Issue'
    }];
  }

  get metadata() {
    return this.provider.metadata;
  }

  get isEnabled() {
    return this.state.configurations.length > 0;
  }

  get installationStatus() {
    const {
      configurations
    } = this.state;

    if (configurations.filter(i => i.organizationIntegrationStatus === 'disabled').length) {
      return 'Disabled';
    }

    return configurations.length ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return this.provider.name;
  }

  get featureData() {
    return this.metadata.features;
  }

  renderAlert() {
    var _this$state$configura;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FirstPartyIntegrationAlert, {
      integrations: (_this$state$configura = this.state.configurations) !== null && _this$state$configura !== void 0 ? _this$state$configura : [],
      hideCTA: true
    });
  }

  renderAdditionalCTA() {
    var _this$state$configura2;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FirstPartyIntegrationAdditionalCTA, {
      integrations: (_this$state$configura2 = this.state.configurations) !== null && _this$state$configura2 !== void 0 ? _this$state$configura2 : []
    });
  }

  renderTopButton(disabledFromFeatures, userHasAccess) {
    const {
      organization
    } = this.props;
    const provider = this.provider;
    const {
      metadata
    } = provider;
    const size = 'sm';
    const priority = 'primary';
    const buttonProps = {
      style: {
        marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1)
      },
      size,
      priority,
      'data-test-id': 'install-button',
      disabled: disabledFromFeatures,
      organization
    };

    if (!userHasAccess) {
      return this.renderRequestIntegrationButton();
    }

    if (provider.canAdd) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_addIntegrationButton__WEBPACK_IMPORTED_MODULE_14__["default"], {
        provider: provider,
        onAddIntegration: this.onInstall,
        analyticsParams: {
          view: 'integrations_directory_integration_detail',
          already_installed: this.installationStatus !== 'Not Installed'
        },
        ...buttonProps
      });
    }

    if (metadata.aspects.externalInstall) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconOpen, {}),
        href: metadata.aspects.externalInstall.url,
        onClick: this.handleExternalInstall,
        external: true,
        ...buttonProps,
        children: metadata.aspects.externalInstall.buttonText
      });
    } // This should never happen but we can't return undefined without some refactoring.


    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {});
  }

  renderConfigurations() {
    const {
      configurations
    } = this.state;
    const {
      organization
    } = this.props;
    const provider = this.provider;

    if (!configurations.length) {
      return this.renderEmptyConfigurations();
    }

    const alertText = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_11__.getAlertText)(configurations);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [alertText && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "warning",
        showIcon: true,
        children: alertText
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
        children: configurations.map(integration => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_installedIntegration__WEBPACK_IMPORTED_MODULE_15__["default"], {
            organization: organization,
            provider: provider,
            integration: integration,
            onRemove: this.onRemove,
            onDisable: this.onDisable,
            "data-test-id": integration.id,
            trackIntegrationAnalytics: this.trackIntegrationAnalytics,
            requiresUpgrade: !!alertText
          })
        }, integration.id))
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])(IntegrationDetailedView));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_integrationDetailedView_tsx.bc77abb4ffe1622e2491979627ab0109.js.map