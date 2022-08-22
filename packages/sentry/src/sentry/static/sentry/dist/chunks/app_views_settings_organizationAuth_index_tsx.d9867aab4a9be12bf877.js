"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationAuth_index_tsx"],{

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

/***/ "./app/views/settings/organization/permissionAlert.tsx":
/*!*************************************************************!*\
  !*** ./app/views/settings/organization/permissionAlert.tsx ***!
  \*************************************************************/
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
    access = ['org:write'],
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('These settings can only be edited by users with the organization owner or manager role.'),
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
        showIcon: true,
        ...props,
        children: message
      });
    }
  });
};

PermissionAlert.displayName = "PermissionAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PermissionAlert);

/***/ }),

/***/ "./app/views/settings/organizationAuth/index.tsx":
/*!*******************************************************!*\
  !*** ./app/views/settings/organizationAuth/index.tsx ***!
  \*******************************************************/
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
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _organizationAuthList__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./organizationAuthList */ "./app/views/settings/organizationAuth/organizationAuthList.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class OrganizationAuth extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSendReminders", _provider => {
      this.setState({
        sendRemindersBusy: true
      });
      this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/send-reminders/`, {
        method: 'POST',
        data: {},
        success: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Sent reminders to members')),
        error: () => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Failed to send reminders')),
        complete: () => this.setState({
          sendRemindersBusy: false
        })
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleConfigure", provider => {
      this.setState({
        busy: true
      });
      this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
        method: 'POST',
        data: {
          provider,
          init: true
        },
        success: data => {
          // Redirect to auth provider URL
          if (data && data.auth_url) {
            window.location.href = data.auth_url;
          }
        },
        error: () => {
          this.setState({
            busy: false
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisableProvider", provider => {
      this.setState({
        busy: true
      });
      this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
        method: 'DELETE',
        data: {
          provider
        },
        success: () => {
          this.setState({
            provider: null,
            busy: false
          });
        },
        error: () => {
          this.setState({
            busy: false
          });
        }
      });
    });
  }

  UNSAFE_componentWillUpdate(_nextProps, nextState) {
    const access = this.props.organization.access;

    if (nextState.provider && access.includes('org:write')) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      const path = `/organizations/${this.props.params.orgId}/auth/configure/`; // Don't break the back button by first replacing the current history
      // state so pressing back skips this react view.

      this.props.router.replace(path);
      window.location.assign(path);
    }
  }

  getEndpoints() {
    return [['providerList', `/organizations/${this.props.params.orgId}/auth-providers/`], ['provider', `/organizations/${this.props.params.orgId}/auth-provider/`]];
  }

  getTitle() {
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_6__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Auth Settings'), this.props.organization.slug, false);
  }
  /**
   * TODO(epurkhiser): This does not work right now as we still fallback to the
   * old SSO auth configuration page
   */


  renderBody() {
    const {
      providerList,
      provider
    } = this.state;

    if (providerList === null) {
      return null;
    }

    if (this.props.organization.access.includes('org:write') && provider) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      return this.renderLoading();
    }

    const activeProvider = providerList === null || providerList === void 0 ? void 0 : providerList.find(p => p.key === (provider === null || provider === void 0 ? void 0 : provider.key));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_organizationAuthList__WEBPACK_IMPORTED_MODULE_9__["default"], {
      activeProvider: activeProvider,
      providerList: providerList
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])(OrganizationAuth));

/***/ }),

/***/ "./app/views/settings/organizationAuth/organizationAuthList.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/organizationAuth/organizationAuthList.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getCsrfToken__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getCsrfToken */ "./app/utils/getCsrfToken.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/organization/permissionAlert */ "./app/views/settings/organization/permissionAlert.tsx");
/* harmony import */ var _providerItem__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./providerItem */ "./app/views/settings/organizationAuth/providerItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const PROVIDER_POPULARITY = {
  google: 0,
  github: 1,
  okta: 2,
  'active-directory': 3,
  saml2: 4,
  onelogin: 5,
  rippling: 6,
  auth0: 7,
  jumpcloud: 8
};

const OrganizationAuthList = _ref => {
  let {
    organization,
    providerList,
    activeProvider
  } = _ref;
  const features = organization.features; // Sort provider list twice: first, by popularity,
  // and then a second time, to sort unavailable providers for the current plan to the end of the list.

  const sortedByPopularity = (providerList !== null && providerList !== void 0 ? providerList : []).sort((a, b) => {
    if (!(a.key in PROVIDER_POPULARITY)) {
      return -1;
    }

    if (!(b.key in PROVIDER_POPULARITY)) {
      return 1;
    }

    if (PROVIDER_POPULARITY[a.key] === PROVIDER_POPULARITY[b.key]) {
      return 0;
    }

    return PROVIDER_POPULARITY[a.key] > PROVIDER_POPULARITY[b.key] ? 1 : -1;
  });
  const list = sortedByPopularity.sort((a, b) => {
    const aEnabled = features.includes((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.descopeFeatureName)(a.requiredFeature));
    const bEnabled = features.includes((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.descopeFeatureName)(b.requiredFeature));

    if (aEnabled === bEnabled) {
      return 0;
    }

    return aEnabled ? -1 : 1;
  });
  const warn2FADisable = organization.require2FA && list.some(_ref2 => {
    let {
      requiredFeature
    } = _ref2;
    return features.includes((0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.descopeFeatureName)(requiredFeature));
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
    className: "sso",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_8__["default"], {
      title: "Authentication"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_organization_permissionAlert__WEBPACK_IMPORTED_MODULE_9__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Choose a provider')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
        children: [!activeProvider && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelAlert, {
          type: "info",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Get started with Single Sign-on for your organization by selecting a provider. Read more in our [link:SSO documentation].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
              href: "https://docs.sentry.io/product/accounts/sso/"
            })
          })
        }), warn2FADisable && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelAlert, {
          type: "warning",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Require 2FA will be disabled if you enable SSO.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("form", {
          action: `/organizations/${organization.slug}/auth/configure/`,
          method: "POST",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("input", {
            type: "hidden",
            name: "csrfmiddlewaretoken",
            value: (0,sentry_utils_getCsrfToken__WEBPACK_IMPORTED_MODULE_5__["default"])()
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("input", {
            type: "hidden",
            name: "init",
            value: "1"
          }), list.map(provider => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_providerItem__WEBPACK_IMPORTED_MODULE_10__["default"], {
            provider: provider,
            active: !!activeProvider && provider.key === activeProvider.key
          }, provider.key)), list.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_7__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('No authentication providers are available.')
          })]
        })]
      })]
    })]
  });
};

OrganizationAuthList.displayName = "OrganizationAuthList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(OrganizationAuthList));

/***/ }),

/***/ "./app/views/settings/organizationAuth/providerItem.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/organizationAuth/providerItem.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const ProviderItem = _ref => {
  let {
    provider,
    active,
    onConfigure
  } = _ref;

  const handleConfigure = e => {
    onConfigure === null || onConfigure === void 0 ? void 0 : onConfigure(provider.key, e);
  };

  const renderDisabledLock = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(LockedFeature, {
    provider: p.provider,
    features: p.features
  });

  const defaultRenderInstallButton = _ref2 => {
    let {
      hasFeature
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_2__["default"], {
      access: ['org:write'],
      children: _ref3 => {
        let {
          hasAccess
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          type: "submit",
          name: "provider",
          size: "sm",
          value: provider.key,
          disabled: !hasFeature || !hasAccess,
          onClick: handleConfigure,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Configure')
        });
      }
    });
  }; // TODO(epurkhiser): We should probably use a more explicit hook name,
  // instead of just the feature names (sso-basic, sso-saml2, etc).


  const featureKey = provider.requiredFeature;
  const hookName = featureKey ? `feature-disabled:${(0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.descopeFeatureName)(featureKey)}` : null;
  const featureProps = hookName ? {
    hookName
  } : {};

  const getProviderDescription = providerName => {
    if (providerName === 'SAML2') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('your preferred SAML2 compliant provider like Ping Identity, Google SAML, Keycloak, or VMware Identity Manager');
    }

    if (providerName === 'Google') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Google (OAuth)');
    }

    return providerName;
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__["default"], { ...featureProps,
    features: [featureKey].filter(f => f),
    renderDisabled: _ref4 => {
      let {
        children,
        ...props
      } = _ref4;
      return typeof children === 'function' && // TODO(ts): the Feature component isn't correctly templatized to allow
      // for custom props in the renderDisabled function
      children({ ...props,
        renderDisabled: renderDisabledLock
      });
    },
    children: _ref5 => {
      let {
        hasFeature,
        features,
        renderDisabled,
        renderInstallButton
      } = _ref5;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelItem, {
        center: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(ProviderInfo, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ProviderLogo, {
            className: `provider-logo ${provider.name.replace(/\s/g, '-').toLowerCase()}`
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ProviderName, {
              children: provider.name
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ProviderDescription, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Enable your organization to sign in with %s.', getProviderDescription(provider.name))
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(FeatureBadge, {
          children: !hasFeature && renderDisabled({
            provider,
            features
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
          children: active ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActiveIndicator, {}) : (renderInstallButton !== null && renderInstallButton !== void 0 ? renderInstallButton : defaultRenderInstallButton)({
            provider,
            hasFeature
          })
        })]
      });
    }
  });
};

ProviderItem.displayName = "ProviderItem";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProviderItem);

const ProviderInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc6"
} : 0)("flex:1;display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";" + ( true ? "" : 0));

const ProviderLogo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc5"
} : 0)( true ? {
  name: "182h23h",
  styles: "height:36px;width:36px;border-radius:3px;margin-right:0;top:auto"
} : 0);

const ProviderName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc4"
} : 0)( true ? {
  name: "1efi8gv",
  styles: "font-weight:bold"
} : 0);

const ProviderDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const FeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc2"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const ActiveIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehb8hzc1"
} : 0)("background:", p => p.theme.green300, ";color:", p => p.theme.white, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";border-radius:2px;font-size:0.8em;" + ( true ? "" : 0));

ActiveIndicator.defaultProps = {
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Active')
};

const DisabledHovercard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_6__.Hovercard,  true ? {
  target: "ehb8hzc0"
} : 0)( true ? {
  name: "lee4ct",
  styles: "width:350px"
} : 0);

const LockedFeature = _ref6 => {
  let {
    provider,
    features,
    className
  } = _ref6;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DisabledHovercard, {
    containerClassName: className,
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_4__["default"], {
      features: features,
      hideHelpToggle: true,
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('%s SSO is disabled.', provider.name),
      featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('SSO Auth')
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_8__["default"], {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconLock, {
        isSolid: true
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('disabled')
    })
  });
};

LockedFeature.displayName = "LockedFeature";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationAuth_index_tsx.fd15479246da6f25f6934a927926c2a8.js.map