"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationTeams_teamNotifications_tsx"],{

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

/***/ "./app/views/settings/organizationTeams/teamNotifications.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/organizationTeams/teamNotifications.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const DOCS_LINK = 'https://docs.sentry.io/product/integrations/notification-incidents/slack/#team-notifications';
const NOTIFICATION_PROVIDERS = ['slack'];

class TeamNotificationSettings extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_16__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDelete", async mapping => {
      try {
        const {
          organization,
          team
        } = this.props;
        const endpoint = `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`;
        await this.api.requestPromise(endpoint, {
          method: 'DELETE'
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Deletion successful'));
        this.fetchData();
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('An error occurred'));
      }
    });
  }

  getTitle() {
    return 'Team Notification Settings';
  }

  getEndpoints() {
    const {
      organization,
      team
    } = this.props;
    return [['teamDetails', `/teams/${organization.slug}/${team.slug}/`, {
      query: {
        expand: ['externalTeams']
      }
    }], ['integrations', `/organizations/${organization.slug}/integrations/`, {
      query: {
        includeConfig: 0
      }
    }]];
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Notifications')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
        children: this.renderPanelBody()
      })]
    });
  }

  renderPanelBody() {
    const {
      organization
    } = this.props;
    const {
      teamDetails,
      integrations
    } = this.state;
    const notificationIntegrations = integrations.filter(integration => NOTIFICATION_PROVIDERS.includes(integration.provider.key));

    if (!notificationIntegrations.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_17__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('No Notification Integrations have been installed yet.')
      });
    }

    const externalTeams = (teamDetails.externalTeams || []).filter(externalTeam => NOTIFICATION_PROVIDERS.includes(externalTeam.provider));

    if (!externalTeams.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_17__["default"], {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("div", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('No teams have been linked yet.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NotDisabledSubText, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Head over to Slack and type [code] to get started. [link].', {
            code: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("code", {
              children: "/sentry link team"
            }),
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
              href: DOCS_LINK,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Learn more')
            })
          })
        })]
      });
    }

    const integrationsById = Object.fromEntries(notificationIntegrations.map(integration => [integration.id, integration]));
    const access = new Set(organization.access);
    const hasAccess = access.has('team:write');
    return externalTeams.map(externalTeam => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(FormFieldWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledFormField, {
        disabled: true,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(NotDisabledText, {
            children: [(0,sentry_utils__WEBPACK_IMPORTED_MODULE_14__.toTitleCase)(externalTeam.provider), ":", integrationsById[externalTeam.integrationId].name]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(NotDisabledSubText, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Unlink this channel in Slack with [code]. [link].', {
              code: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("code", {
                children: "/sentry unlink team"
              }),
              link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
                href: DOCS_LINK,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Learn more')
              })
            })
          })]
        }),
        name: "externalName",
        value: externalTeam.externalName
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(DeleteButtonWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You must be an organization owner, manager or admin to remove a Slack team link'),
          disabled: hasAccess,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__["default"], {
            disabled: !hasAccess,
            onConfirm: () => this.handleDelete(externalTeam),
            message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Are you sure you want to remove this Slack team link?'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              size: "sm",
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconDelete, {
                size: "md"
              }),
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('delete'),
              disabled: !hasAccess
            })
          })
        })
      })]
    }, externalTeam.id));
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])(TeamNotificationSettings));

const NotDisabledText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edknbzx4"
} : 0)("color:", p => p.theme.textColor, ";line-height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";" + ( true ? "" : 0));

const NotDisabledSubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edknbzx3"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeRelativeSmall, ";line-height:1.4;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const FormFieldWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edknbzx2"
} : 0)( true ? {
  name: "1dmiggy",
  styles: "display:flex;align-items:center;justify-content:flex-start"
} : 0);

const StyledFormField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "edknbzx1"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const DeleteButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "edknbzx0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationTeams_teamNotifications_tsx.e85c6d616cd71084297b911e75cdf090.js.map