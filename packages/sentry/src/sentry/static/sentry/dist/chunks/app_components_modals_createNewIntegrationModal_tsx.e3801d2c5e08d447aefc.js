"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_createNewIntegrationModal_tsx"],{

/***/ "./app/components/modals/createNewIntegrationModal.tsx":
/*!*************************************************************!*\
  !*** ./app/components/modals/createNewIntegrationModal.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_exampleIntegrationButton__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/organizationIntegrations/exampleIntegrationButton */ "./app/views/organizationIntegrations/exampleIntegrationButton.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const analyticsView = 'new_integration_modal';

function CreateNewIntegrationModal(_ref) {
  let {
    Body,
    Header,
    Footer,
    closeModal,
    organization
  } = _ref;
  const [option, selectOption] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('internal');
  const choices = [['internal', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceHeader, {
    "data-test-id": "internal-integration",
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Internal Integration')
  }, "header-internal"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceDescription, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('Internal integrations are meant for custom integrations unique to your organization. See more info on [docsLink].', {
      docsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
        href: sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.platformEventLinkMap[sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.INTERNAL_DOCS],
        onClick: () => {
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.INTERNAL_DOCS, {
            organization,
            view: analyticsView
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Internal Integrations')
      })
    })
  }, "description-internal")], ['public', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceHeader, {
    "data-test-id": "public-integration",
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Public Integration')
  }, "header-public"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceDescription, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('A public integration will be available for all Sentry users for installation. See more info on [docsLink].', {
      docsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
        href: sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.platformEventLinkMap[sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.PUBLIC_DOCS],
        onClick: () => {
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.PUBLIC_DOCS, {
            organization,
            view: analyticsView
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Public Integrations')
      })
    })
  }, "description-public")]];

  if (organization.features.includes('sentry-functions')) {
    choices.push(['sentry-fx', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceHeader, {
      "data-test-id": "sentry-function",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sentry Function')
    }, "header-sentryfx"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(RadioChoiceDescription, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('A Sentry Function is a new type of integration leveraging the power of cloud functions.')
    }, "description-sentry-function")]);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(HeaderWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Choose Integration Type')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_organizationIntegrations_exampleIntegrationButton__WEBPACK_IMPORTED_MODULE_12__["default"], {
          analyticsView: analyticsView
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledRadioGroup, {
        choices: choices,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Avatar Type'),
        onChange: value => selectOption(value),
        value: option
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Footer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        size: "sm",
        onClick: () => closeModal(),
        style: {
          marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1)
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Cancel')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        priority: "primary",
        size: "sm",
        to: option === 'sentry-fx' ? `/settings/${organization.slug}/developer-settings/sentry-functions/new/` : `/settings/${organization.slug}/developer-settings/${option === 'public' ? 'new-public' : 'new-internal'}/`,
        onClick: () => {
          (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_10__.trackIntegrationAnalytics)(option === 'sentry-fx' ? sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.CHOSE_SENTRY_FX : option === 'public' ? sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.CHOSE_PUBLIC : sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.PlatformEvents.CHOSE_INTERNAL, {
            organization,
            view: analyticsView
          });
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Next')
      })]
    })]
  });
}

CreateNewIntegrationModal.displayName = "CreateNewIntegrationModal";

const StyledRadioGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e11bmja43"
} : 0)("grid-auto-columns:auto;&>label:not(:last-child)>div:last-child>*{padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

const RadioChoiceHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h6',  true ? {
  target: "e11bmja42"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const RadioChoiceDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bmja41"
} : 0)("color:", p => p.theme.gray400, ";font-size:", p => p.theme.fontSizeMedium, ";line-height:1.6em;" + ( true ? "" : 0));

const HeaderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11bmja40"
} : 0)( true ? {
  name: "ga3b11",
  styles: "display:flex;align-items:center;justify-content:space-between;width:100%"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])(CreateNewIntegrationModal));

/***/ }),

/***/ "./app/views/organizationIntegrations/exampleIntegrationButton.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationIntegrations/exampleIntegrationButton.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/analytics/integrations/platformAnalyticsEvents */ "./app/utils/analytics/integrations/platformAnalyticsEvents.ts");
/* harmony import */ var sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/integrationUtil */ "./app/utils/integrationUtil.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * Button to direct users to the Example App repository
 */
function ExampleIntegrationButton(_ref) {
  let {
    organization,
    analyticsView,
    ...buttonProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
    size: "sm",
    external: true,
    href: sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.platformEventLinkMap[sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.PlatformEvents.EXAMPLE_SOURCE],
    onClick: () => {
      (0,sentry_utils_integrationUtil__WEBPACK_IMPORTED_MODULE_4__.trackIntegrationAnalytics)(sentry_utils_analytics_integrations_platformAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.PlatformEvents.EXAMPLE_SOURCE, {
        organization,
        view: analyticsView
      });
    },
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconGithub, {}),
    ...buttonProps,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('View Example App')
  });
}

ExampleIntegrationButton.displayName = "ExampleIntegrationButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(ExampleIntegrationButton));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_createNewIntegrationModal_tsx.36ee478dcc012c264cffab4b6e8db567.js.map