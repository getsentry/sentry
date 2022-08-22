"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationIntegrations_docIntegrationDetailedView_tsx"],{

/***/ "./app/views/organizationIntegrations/docIntegrationDetailedView.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/organizationIntegrations/docIntegrationDetailedView.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/docIntegrationAvatar */ "./app/components/avatar/docIntegrationAvatar.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./abstractIntegrationDetailedView */ "./app/views/organizationIntegrations/abstractIntegrationDetailedView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













class DocIntegrationDetailedView extends _abstractIntegrationDetailedView__WEBPACK_IMPORTED_MODULE_10__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tabs", ['overview']);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackClick", () => {
      this.trackIntegrationAnalytics('integrations.installation_start');
    });
  }

  getEndpoints() {
    const {
      params: {
        integrationSlug
      }
    } = this.props;
    return [['doc', `/doc-integrations/${integrationSlug}/`]];
  }

  get integrationType() {
    return 'document';
  }

  get integration() {
    return this.state.doc;
  }

  get description() {
    return this.integration.description;
  }

  get author() {
    return this.integration.author;
  }

  get resourceLinks() {
    var _this$integration$res;

    return (_this$integration$res = this.integration.resources) !== null && _this$integration$res !== void 0 ? _this$integration$res : [];
  }

  get installationStatus() {
    return null;
  }

  get integrationName() {
    return this.integration.name;
  }

  get featureData() {
    var _this$integration$fea;

    return (_this$integration$fea = this.integration.features) !== null && _this$integration$fea !== void 0 ? _this$integration$fea : [];
  }

  get requiresAccess() {
    return false;
  }

  componentDidMount() {
    super.componentDidMount();
    this.trackIntegrationAnalytics('integrations.integration_viewed', {
      integration_tab: 'overview'
    });
  }

  renderTopButton() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
      href: this.integration.url,
      onClick: this.trackClick,
      "data-test-id": "learn-more",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(LearnMoreButton, {
        size: "sm",
        priority: "primary",
        style: {
          marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1)
        },
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledIconOpen, {
          size: "xs"
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Learn More')
      })
    });
  }

  renderIntegrationIcon() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_3__["default"], {
      docIntegration: this.integration,
      size: 50
    });
  } // No configurations.


  renderConfigurations() {
    return null;
  }

}

const LearnMoreButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ezrkktf1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

const StyledIconOpen = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconOpen,  true ? {
  target: "ezrkktf0"
} : 0)("transition:0.1s linear color;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.5), ";position:relative;top:1px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(DocIntegrationDetailedView));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationIntegrations_docIntegrationDetailedView_tsx.505434f44dd563a92c25b0aec7ae54d6.js.map