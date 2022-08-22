"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_integrationOrganizationLink_tsx"],{

/***/ "./app/components/narrowLayout.tsx":
/*!*****************************************!*\
  !*** ./app/components/narrowLayout.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/account */ "./app/actionCreators/account.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function NarrowLayout(_ref) {
  let {
    maxWidth,
    showLogout,
    children
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    document.body.classList.add('narrow');
    return () => document.body.classList.remove('narrow');
  }, []);

  async function handleLogout() {
    await (0,sentry_actionCreators_account__WEBPACK_IMPORTED_MODULE_2__.logout)(api);
    window.location.assign('/auth/login');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "app",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "pattern-bg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
      className: "container",
      style: {
        maxWidth
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
        className: "box box-modal",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "box-header",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            href: "/",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry, {
              size: "lg"
            })
          }), showLogout && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("a", {
            className: "logout pull-right",
            onClick: handleLogout,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Logout, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Sign out')
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
          className: "box-content with-padding",
          children: children
        })]
      })
    })]
  });
}

NarrowLayout.displayName = "NarrowLayout";

const Logout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eaq1ri90"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NarrowLayout);

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

/***/ "./app/views/integrationOrganizationLink.tsx":
/*!***************************************************!*\
  !*** ./app/views/integrationOrganizationLink.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ IntegrationOrganizationLink)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var _sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @sentry/utils */ "../node_modules/@sentry/utils/esm/object.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/narrowLayout */ "./app/components/narrowLayout.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_addIntegration__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/organizationIntegrations/addIntegration */ "./app/views/organizationIntegrations/addIntegration.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















 // installationId present for Github flow



class IntegrationOrganizationLink extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_17__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackIntegrationAnalytics", (eventName, startSession) => {
      const {
        organization,
        provider
      } = this.state; // should have these set but need to make TS happy

      if (!organization || !provider) {
        return;
      }

      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__.trackIntegrationAnalytics)(eventName, {
        integration_type: 'first_party',
        integration: provider.key,
        // We actually don't know if it's installed but neither does the user in the view and multiple installs is possible
        already_installed: false,
        view: 'external_install',
        organization
      }, {
        startSession: !!startSession
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getOrgBySlug", orgSlug => {
      return this.state.organizations.find(org => org.slug === orgSlug);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSelectOrg", async _ref => {
      let {
        value: orgSlug
      } = _ref;
      this.setState({
        selectedOrgSlug: orgSlug,
        reloading: true,
        organization: undefined
      });

      try {
        const [organization, {
          providers
        }] = await Promise.all([this.api.requestPromise(`/organizations/${orgSlug}/`), this.api.requestPromise(`/organizations/${orgSlug}/config/integrations/?provider_key=${this.integrationSlug}`)]); // should never happen with a valid provider

        if (providers.length === 0) {
          throw new Error('Invalid provider');
        }

        this.setState({
          organization,
          reloading: false,
          provider: providers[0]
        }, this.trackOpened);
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Failed to retrieve organization or integration details'));
        this.setState({
          reloading: false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasAccess", () => {
      const {
        organization
      } = this.state;
      return organization === null || organization === void 0 ? void 0 : organization.access.includes('org:integrations');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onInstallWithInstallationId", data => {
      const {
        organization
      } = this.state;
      const orgId = organization && organization.slug;
      this.props.router.push(`/settings/${orgId}/integrations/${data.provider.key}/${data.id}/`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "finishInstallation", () => {
      // add the selected org to the query parameters and then redirect back to configure
      const {
        selectedOrgSlug
      } = this.state;
      const query = {
        orgSlug: selectedOrgSlug,
        ...this.queryParams
      };
      this.trackInstallationStart();
      window.location.assign(`/extensions/${this.integrationSlug}/configure/?${(0,_sentry_utils__WEBPACK_IMPORTED_MODULE_19__.urlEncode)(query)}`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "customOption", orgProps => {
      const organization = this.getOrgBySlug(orgProps.value);

      if (!organization) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_21__.y.Option, { ...orgProps,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
          organization: organization,
          avatarSize: 20,
          displayName: organization.name,
          avatarProps: {
            consistentWidth: true
          }
        })
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "customValueContainer", containerProps => {
      const valueList = containerProps.getValue(); // if no value set, we want to return the default component that is rendered

      if (valueList.length === 0) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_21__.y.ValueContainer, { ...containerProps
        });
      }

      const orgSlug = valueList[0].value;
      const organization = this.getOrgBySlug(orgSlug);

      if (!organization) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_21__.y.ValueContainer, { ...containerProps
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_21__.y.ValueContainer, { ...containerProps,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
          organization: organization,
          avatarSize: 20,
          displayName: organization.name,
          avatarProps: {
            consistentWidth: true
          }
        })
      });
    });
  }

  getEndpoints() {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Choose Installation Organization');
  }

  trackOpened() {
    this.trackIntegrationAnalytics('integrations.integration_viewed', true);
  }

  trackInstallationStart() {
    this.trackIntegrationAnalytics('integrations.installation_start');
  }

  get integrationSlug() {
    return this.props.params.integrationSlug;
  }

  get queryParams() {
    return this.props.location.query;
  }

  onLoadAllEndpointsSuccess() {
    // auto select the org if there is only one
    const {
      organizations
    } = this.state;

    if (organizations.length === 1) {
      this.onSelectOrg({
        value: organizations[0].slug
      });
    }
  }

  renderAddButton() {
    const {
      installationId
    } = this.props.params;
    const {
      organization,
      provider
    } = this.state; // should never happen but we need this check for TS

    if (!provider || !organization) {
      return null;
    }

    const {
      features
    } = provider.metadata; // Prepare the features list

    const featuresComponents = features.map(f => ({
      featureGate: f.featureGate,
      description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(FeatureListItem, {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_16__.singleLineRenderer)(f.description)
        }
      })
    }));
    const {
      IntegrationFeatures
    } = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__.getIntegrationFeatureGate)(); // Github uses a different installation flow with the installationId as a parameter
    // We have to wrap our installation button with AddIntegration so we can get the
    // addIntegrationWithInstallationId callback.
    // if we don't hve an installationId, we need to use the finishInstallation callback.

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(IntegrationFeatures, {
      organization: organization,
      features: featuresComponents,
      children: _ref2 => {
        let {
          disabled
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_organizationIntegrations_addIntegration__WEBPACK_IMPORTED_MODULE_18__["default"], {
          provider: provider,
          onInstall: this.onInstallWithInstallationId,
          organization: organization,
          children: addIntegrationWithInstallationId => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ButtonWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              priority: "primary",
              disabled: !this.hasAccess() || disabled,
              onClick: () => installationId ? addIntegrationWithInstallationId({
                installation_id: installationId
              }) : this.finishInstallation(),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Install %s', provider.name)
            })
          })
        });
      }
    });
  }

  renderBottom() {
    const {
      organization,
      selectedOrgSlug,
      provider,
      reloading
    } = this.state;
    const {
      FeatureList
    } = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_15__.getIntegrationFeatureGate)();

    if (reloading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {});
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [selectedOrgSlug && organization && !this.hasAccess() && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
        type: "error",
        showIcon: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)(`You do not have permission to install integrations in
                [organization]. Ask an organization owner or manager to
                visit this page to finish installing this integration.`, {
            organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("strong", {
              children: organization.slug
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(InstallLink, {
          children: window.location.href
        })]
      }), provider && organization && this.hasAccess() && FeatureList && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('The following features will be available for [organization] when installed.', {
            organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("strong", {
              children: organization.slug
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(FeatureList, {
          organization: organization,
          features: provider.metadata.features,
          provider: provider
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
        className: "form-actions",
        children: this.renderAddButton()
      })]
    });
  }

  renderBody() {
    const {
      selectedOrgSlug
    } = this.state;
    const options = this.state.organizations.map(org => ({
      value: org.slug,
      label: org.name
    }));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_narrowLayout__WEBPACK_IMPORTED_MODULE_13__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Finish integration installation')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)(`Please pick a specific [organization:organization] to link with
            your integration installation of [integation].`, {
          organization: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("strong", {}),
          integation: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("strong", {
            children: this.integrationSlug
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Organization'),
        inline: false,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          onChange: this.onSelectOrg,
          value: selectedOrgSlug,
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Select an organization'),
          options: options,
          components: {
            Option: this.customOption,
            ValueContainer: this.customValueContainer
          }
        })
      }), this.renderBottom()]
    });
  }

}

const InstallLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('pre',  true ? {
  target: "e6s0axp2"
} : 0)( true ? {
  name: "1iee5id",
  styles: "margin-bottom:0;background:#fbe3e1"
} : 0);

const FeatureListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e6s0axp1"
} : 0)( true ? {
  name: "1gt2cgk",
  styles: "line-height:24px"
} : 0);

const ButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e6s0axp0"
} : 0)( true ? {
  name: "ur67by",
  styles: "margin-left:auto;align-self:center;display:flex;flex-direction:column;align-items:center"
} : 0);

/***/ }),

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_integrationOrganizationLink_tsx.b8dc7cd6ec03f5910074573d9747dabf.js.map