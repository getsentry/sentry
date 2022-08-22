"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_abstractIntegrationDetailedView_tsx"],{

/***/ "./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/startCase */ "../node_modules/lodash/startCase.js");
/* harmony import */ var lodash_startCase__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_startCase__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbTitle__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx");
/* harmony import */ var _integrationRequest_RequestIntegrationButton__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./integrationRequest/RequestIntegrationButton */ "./app/views/organizationIntegrations/integrationRequest/RequestIntegrationButton.tsx");
/* harmony import */ var _integrationStatus__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./integrationStatus */ "./app/views/organizationIntegrations/integrationStatus.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























class AbstractIntegrationDetailedView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tabs", ['overview', 'configurations']);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onTabChange", value => {
      this.trackIntegrationAnalytics('integrations.integration_tab_clicked', {
        integration_tab: value
      });
      this.setState({
        tab: value
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackIntegrationAnalytics", (eventKey, options) => {
      options = options || {}; // If we use this intermediate type we get type checking on the things we care about

      const params = {
        view: 'integrations_directory_integration_detail',
        integration: this.integrationSlug,
        integration_type: this.integrationType,
        already_installed: this.installationStatus !== 'Not Installed',
        // pending counts as installed here
        organization: this.props.organization,
        ...options
      };
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__.trackIntegrationAnalytics)(eventKey, params);
    });
  }

  componentDidMount() {
    const {
      location
    } = this.props;
    const value = location.query.tab === 'configurations' ? 'configurations' : 'overview'; // eslint-disable-next-line react/no-did-mount-set-state

    this.setState({
      tab: value
    });
  }

  onLoadAllEndpointsSuccess() {
    this.trackIntegrationAnalytics('integrations.integration_viewed', {
      integration_tab: this.state.tab
    });
  }
  /**
   * Abstract methods defined below
   */
  // The analytics type used in analytics which is snake case


  get integrationType() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get description() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get author() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get alerts() {
    // default is no alerts
    return [];
  } // Returns a list of the resources displayed at the bottom of the overview card


  get resourceLinks() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get installationStatus() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get integrationName() {
    // Allow children to implement this
    throw new Error('Not implemented');
  } // Checks to see if integration requires admin access to install, doc integrations don't


  get requiresAccess() {
    // default is integration requires access to install
    return true;
  } // Returns an array of RawIntegrationFeatures which is used in feature gating
  // and displaying what the integration does


  get featureData() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  getIcon(title) {
    switch (title) {
      case 'View Source':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconProject, {});

      case 'Report Issue':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconGithub, {});

      case 'Documentation':
      case 'Splunk Setup Instructions':
      case 'Trello Setup Instructions':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconDocs, {});

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconGeneric, {});
    }
  }

  // Returns the string that is shown as the title of a tab
  getTabDisplay(tab) {
    // default is return the tab
    return tab;
  } // Render the button at the top which is usually just an installation button


  renderTopButton(_disabledFromFeatures, // from the feature gate
  _userHasAccess) {
    // Allow children to implement this
    throw new Error('Not implemented');
  } // Returns the permission descriptions, only use by Sentry Apps


  renderPermissions() {
    // default is don't render permissions
    return null;
  }

  renderEmptyConfigurations() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)("You haven't set anything up yet"),
        description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('But that doesn’t have to be the case for long! Add an installation to get started.'),
        action: this.renderAddInstallButton(true)
      })
    });
  } // Returns the list of configurations for the integration


  renderConfigurations() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }
  /**
   * Actually implemented methods below
   */


  get integrationSlug() {
    return this.props.params.integrationSlug;
  } // Wrapper around trackIntegrationAnalytics that automatically provides many fields and the org


  // Returns the props as needed by the hooks integrations:feature-gates
  get featureProps() {
    const {
      organization
    } = this.props;
    const featureData = this.featureData; // Prepare the features list

    const features = featureData.map(f => ({
      featureGate: f.featureGate,
      description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(FeatureListItem, {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__.singleLineRenderer)(f.description)
        }
      })
    }));
    return {
      organization,
      features
    };
  }

  cleanTags() {
    return (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__.getCategories)(this.featureData);
  }

  renderAlert() {
    return null;
  }

  renderAdditionalCTA() {
    return null;
  }

  renderIntegrationIcon() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_15__["default"], {
      pluginId: this.integrationSlug,
      size: 50
    });
  }

  renderRequestIntegrationButton() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_integrationRequest_RequestIntegrationButton__WEBPACK_IMPORTED_MODULE_21__["default"], {
      organization: this.props.organization,
      name: this.integrationName,
      slug: this.integrationSlug,
      type: this.integrationType
    });
  }

  renderAddInstallButton() {
    let hideButtonIfDisabled = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    const {
      organization
    } = this.props;
    const {
      IntegrationFeatures
    } = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__.getIntegrationFeatureGate)();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(IntegrationFeatures, { ...this.featureProps,
      children: _ref => {
        let {
          disabled,
          disabledReason
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(DisableWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_6__["default"], {
            organization: organization,
            access: ['org:integrations'],
            children: _ref2 => {
              let {
                hasAccess
              } = _ref2;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('You must be an organization owner, manager or admin to install this.'),
                disabled: hasAccess || !this.requiresAccess,
                children: !hideButtonIfDisabled && disabled ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("div", {}) : this.renderTopButton(disabled, hasAccess)
              });
            }
          }), disabled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(DisabledNotice, {
            reason: disabledReason
          })]
        });
      }
    });
  } // Returns the content shown in the top section of the integration detail


  renderTopSection() {
    const tags = this.cleanTags();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(TopSectionWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Flex, {
        children: [this.renderIntegrationIcon(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(NameContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Flex, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Name, {
              children: this.integrationName
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StatusWrapper, {
              children: this.installationStatus && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_integrationStatus__WEBPACK_IMPORTED_MODULE_22__["default"], {
                status: this.installationStatus
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Flex, {
            children: tags.map(feature => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledTag, {
              children: lodash_startCase__WEBPACK_IMPORTED_MODULE_5___default()(feature)
            }, feature))
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Flex, {
        children: [this.renderAddInstallButton(), this.renderAdditionalCTA()]
      })]
    });
  } // Returns the tabs divider with the clickable tabs


  renderTabs() {
    // TODO: Convert to styled component
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("ul", {
      className: "nav nav-tabs border-bottom",
      style: {
        paddingTop: '30px'
      },
      children: this.tabs.map(tabName => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("li", {
        className: this.state.tab === tabName ? 'active' : '',
        onClick: () => this.onTabChange(tabName),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(CapitalizedLink, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(this.getTabDisplay(tabName))
        })
      }, tabName))
    });
  } // Returns the information about the integration description and features


  renderInformationCard() {
    const {
      FeatureList
    } = (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_17__.getIntegrationFeatureGate)();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Flex, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(FlexContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Description, {
            dangerouslySetInnerHTML: {
              __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__["default"])(this.description)
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(FeatureList, { ...this.featureProps,
            provider: {
              key: this.props.params.integrationSlug
            }
          }), this.renderPermissions(), this.alerts.map((alert, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
            type: alert.type,
            showIcon: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("span", {
              dangerouslySetInnerHTML: {
                __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_18__.singleLineRenderer)(alert.text)
              }
            })
          }, i))]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(Metadata, {
          children: [!!this.author && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(AuthorInfo, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(CreatedContainer, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Created By')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("div", {
              children: this.author
            })]
          }), this.resourceLinks.map(_ref3 => {
            let {
              title,
              url
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(ExternalLinkContainer, {
              children: [this.getIcon(title), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
                href: url,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(title)
              })]
            }, url);
          })]
        })]
      })
    });
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbTitle__WEBPACK_IMPORTED_MODULE_20__["default"], {
        routes: this.props.routes,
        title: this.integrationName
      }), this.renderAlert(), this.renderTopSection(), this.renderTabs(), this.state.tab === 'overview' ? this.renderInformationCard() : this.renderConfigurations()]
    });
  }

}

const Flex = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync516"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const FlexContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync515"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const CapitalizedLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "e15zync514"
} : 0)( true ? {
  name: "kff9ir",
  styles: "text-transform:capitalize"
} : 0);

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e15zync513"
} : 0)("text-transform:none;&:not(:first-child){margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";}" + ( true ? "" : 0));

const NameContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync512"
} : 0)("display:flex;align-items:flex-start;flex-direction:column;justify-content:center;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync511"
} : 0)("font-weight:bold;font-size:1.4em;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";" + ( true ? "" : 0));

const IconCloseCircle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconClose,  true ? {
  target: "e15zync510"
} : 0)("color:", p => p.theme.red300, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const DisabledNotice = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref4 => {
  let {
    reason,
    ...p
  } = _ref4;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    },
    ...p,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(IconCloseCircle, {
      isCircled: true
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("span", {
      children: reason
    })]
  });
},  true ? {
  target: "e15zync59"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";font-size:0.9em;" + ( true ? "" : 0));

const FeatureListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e15zync58"
} : 0)( true ? {
  name: "1gt2cgk",
  styles: "line-height:24px"
} : 0);

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync57"
} : 0)( true ? {
  name: "w60nif",
  styles: "li{margin-bottom:6px;}"
} : 0);

const Metadata = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Flex,  true ? {
  target: "e15zync56"
} : 0)("display:grid;grid-auto-rows:max-content;grid-auto-flow:row;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";font-size:0.9em;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(4), ";margin-right:100px;align-self:flex-start;" + ( true ? "" : 0));

const AuthorInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync55"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(3), ";" + ( true ? "" : 0));

const ExternalLinkContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync54"
} : 0)("display:grid;grid-template-columns:max-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const StatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync53"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const DisableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync52"
} : 0)( true ? {
  name: "ur67by",
  styles: "margin-left:auto;align-self:center;display:flex;flex-direction:column;align-items:center"
} : 0);

const CreatedContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync51"
} : 0)("text-transform:uppercase;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";color:", p => p.theme.gray300, ";font-weight:600;font-size:12px;" + ( true ? "" : 0));

const TopSectionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e15zync50"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AbstractIntegrationDetailedView);

/***/ }),

/***/ "./app/views/organizationIntegrations/constants.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationIntegrations/constants.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COLORS": () => (/* binding */ COLORS),
/* harmony export */   "DISABLED": () => (/* binding */ DISABLED),
/* harmony export */   "INSTALLED": () => (/* binding */ INSTALLED),
/* harmony export */   "LEARN_MORE": () => (/* binding */ LEARN_MORE),
/* harmony export */   "NOT_INSTALLED": () => (/* binding */ NOT_INSTALLED),
/* harmony export */   "PENDING": () => (/* binding */ PENDING),
/* harmony export */   "POPULARITY_WEIGHT": () => (/* binding */ POPULARITY_WEIGHT)
/* harmony export */ });
const INSTALLED = 'Installed';
const NOT_INSTALLED = 'Not Installed';
const PENDING = 'Pending';
const DISABLED = 'Disabled';
const LEARN_MORE = 'Learn More';
const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray300',
  [DISABLED]: 'gray300',
  [PENDING]: 'pink300',
  [LEARN_MORE]: 'gray300'
};
/**
 * Integrations in the integration directory should be sorted by their popularity (weight).
 * The weights should reflect the relative popularity of each integration are hardcoded, except for
 * Sentry-apps which read popularity from the db.
 */

const POPULARITY_WEIGHT = {
  // First-party-integrations
  slack: 50,
  github: 20,
  jira: 10,
  bitbucket: 10,
  gitlab: 10,
  pagerduty: 10,
  vsts: 10,
  jira_server: 10,
  bitbucket_server: 10,
  github_enterprise: 10,
  vercel: 10,
  msteams: 10,
  aws_lambda: 10,
  // Plugins
  webhooks: 10,
  asana: 8,
  trello: 8,
  heroku: 8,
  pivotal: 8,
  twilio: 8,
  pushover: 5,
  redmine: 5,
  phabricator: 5,
  opsgenie: 5,
  victorops: 5,
  sessionstack: 5,
  segment: 2,
  'amazon-sqs': 2,
  splunk: 2
};

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationRequest/RequestIntegrationButton.tsx":
/*!********************************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationRequest/RequestIntegrationButton.tsx ***!
  \********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RequestIntegrationButton)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _RequestIntegrationModal__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./RequestIntegrationModal */ "./app/views/organizationIntegrations/integrationRequest/RequestIntegrationModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class RequestIntegrationButton extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isOpen: false,
      isSent: false
    });
  }

  openRequestModal() {
    this.setState({
      isOpen: true
    });
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(renderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_RequestIntegrationModal__WEBPACK_IMPORTED_MODULE_8__["default"], { ...this.props,
      ...renderProps,
      onSuccess: () => this.setState({
        isSent: true
      })
    }), {
      onClose: () => this.setState({
        isOpen: false
      })
    });
  }

  render() {
    const {
      isOpen,
      isSent
    } = this.state;
    let buttonText;

    if (isOpen) {
      buttonText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Requesting Installation');
    } else if (isSent) {
      buttonText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Installation Requested');
    } else {
      buttonText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Request Installation');
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledRequestIntegrationButton, {
      "data-test-id": "request-integration-button",
      disabled: isOpen || isSent,
      onClick: () => this.openRequestModal(),
      priority: "primary",
      size: "sm",
      children: buttonText
    });
  }

}
RequestIntegrationButton.displayName = "RequestIntegrationButton";

const StyledRequestIntegrationButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e40bwsh0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationRequest/RequestIntegrationModal.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationRequest/RequestIntegrationModal.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RequestIntegrationModal)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/textareaField */ "./app/components/forms/textareaField.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













/**
 * This modal serves as a non-owner's confirmation step before sending
 * organization owners an email requesting a new organization integration. It
 * lets the user attach an optional message to be included in the email.
 */
class RequestIntegrationModal extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", { ...this.getDefaultState(),
      isSending: false,
      message: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sendRequest", () => {
      const {
        organization,
        slug,
        type
      } = this.props;
      const {
        message
      } = this.state;
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_8__.trackIntegrationAnalytics)('integrations.request_install', {
        integration_type: type,
        integration: slug,
        organization
      });
      const endpoint = `/organizations/${organization.slug}/integration-requests/`;
      this.api.request(endpoint, {
        method: 'POST',
        data: {
          providerSlug: slug,
          providerType: type,
          message
        },
        success: this.handleSubmitSuccess,
        error: this.handleSubmitError
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitSuccess", () => {
      const {
        closeModal,
        onSuccess
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Request successfully sent.'));
      this.setState({
        isSending: false
      });
      onSuccess();
      closeModal();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitError", () => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)('Error sending the request');
      this.setState({
        isSending: false
      });
    });
  }

  render() {
    const {
      Header,
      Body,
      Footer,
      name
    } = this.props;
    const buttonText = this.state.isSending ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sending Request') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Send Request');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Request %s Installation', name)
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Looks like your organization owner, manager, or admin needs to install %s. Want to send them a request?', name)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('(Optional) You’ve got good reasons for installing the %s Integration. Share them with your organization owner.', name)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms_textareaField__WEBPACK_IMPORTED_MODULE_6__["default"], {
          inline: false,
          flexibleControlStateSize: true,
          stacked: true,
          name: "message",
          type: "string",
          onChange: value => this.setState({
            message: value
          }),
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Optional message…')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('When you click “Send Request”, we’ll email your request to your organization’s owners. So just keep that in mind.')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          onClick: this.sendRequest,
          children: buttonText
        })
      })]
    });
  }

}
RequestIntegrationModal.displayName = "RequestIntegrationModal";

/***/ }),

/***/ "./app/views/organizationIntegrations/integrationStatus.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationIntegrations/integrationStatus.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./constants */ "./app/views/organizationIntegrations/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const StatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tnl65t1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IntegrationStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    status,
    ...p
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_5__.a)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(StatusWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_1__["default"], {
      size: 6,
      color: theme[_constants__WEBPACK_IMPORTED_MODULE_4__.COLORS[status]]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", { ...p,
      children: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)(status)}`
    })]
  });
},  true ? {
  target: "e1tnl65t0"
} : 0)("color:", p => p.theme[_constants__WEBPACK_IMPORTED_MODULE_4__.COLORS[p.status]], ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";font-weight:light;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.75), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IntegrationStatus);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/breadcrumbTitle.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./context */ "./app/views/settings/components/settingsBreadcrumb/context.tsx");


/**
 * Breadcrumb title sets the breadcrumb label for the provided route match
 */
function BreadcrumbTitle(props) {
  (0,_context__WEBPACK_IMPORTED_MODULE_0__.useBreadcrumbTitleEffect)(props);
  return null;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BreadcrumbTitle);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_abstractIntegrationDetailedView_tsx.2c22cec4e16f4ff8b510eae3c4c7a4b2.js.map