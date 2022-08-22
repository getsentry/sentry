"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationDeveloperSettings_subscriptionBox_tsx"],{

/***/ "./app/views/settings/organizationDeveloperSettings/constants.tsx":
/*!************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/constants.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DESCRIPTIONS": () => (/* binding */ DESCRIPTIONS),
/* harmony export */   "EVENT_CHOICES": () => (/* binding */ EVENT_CHOICES),
/* harmony export */   "PERMISSIONS_MAP": () => (/* binding */ PERMISSIONS_MAP)
/* harmony export */ });
const EVENT_CHOICES = ['issue', 'error', 'comment'];
const DESCRIPTIONS = {
  issue: 'created, resolved, assigned, ignored',
  error: 'created',
  comment: 'created, edited, deleted'
};
const PERMISSIONS_MAP = {
  issue: 'Event',
  error: 'Event',
  comment: 'Event'
};

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/subscriptionBox.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/subscriptionBox.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SubscriptionBox": () => (/* binding */ SubscriptionBox),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/organizationDeveloperSettings/constants */ "./app/views/settings/organizationDeveloperSettings/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











class SubscriptionBox extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onChange", evt => {
      const checked = evt.target.checked;
      const {
        resource
      } = this.props;
      this.props.onChange(resource, checked);
    });
  }

  render() {
    const {
      resource,
      organization,
      webhookDisabled,
      checked,
      isNew
    } = this.props;
    const features = new Set(organization.features);
    let disabled = this.props.disabledFromPermissions || webhookDisabled;
    let message = `Must have at least 'Read' permissions enabled for ${sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_10__.PERMISSIONS_MAP[resource]}`;

    if (resource === 'error' && !features.has('integrations-event-hooks')) {
      disabled = true;
      message = 'Your organization does not have access to the error subscription resource.';
    }

    if (webhookDisabled) {
      message = 'Cannot enable webhook subscription without specifying a webhook url';
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
        disabled: !disabled,
        title: message,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SubscriptionGridItem, {
          disabled: disabled,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SubscriptionInfo, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(SubscriptionTitle, {
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`${resource}`), isNew && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
                type: "new"
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(SubscriptionDescription, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`${sentry_views_settings_organizationDeveloperSettings_constants__WEBPACK_IMPORTED_MODULE_10__.DESCRIPTIONS[resource]}`)
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_4__["default"], {
            disabled: disabled,
            id: resource,
            value: resource,
            checked: checked,
            onChange: this.onChange
          }, `${resource}${checked}`)]
        })
      }, resource)
    });
  }

}
SubscriptionBox.displayName = "SubscriptionBox";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SubscriptionBox, "defaultProps", {
  webhookDisabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(SubscriptionBox));

const SubscriptionGridItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eosxblu3"
} : 0)("display:flex;justify-content:space-between;background:", p => p.theme.backgroundSecondary, ";opacity:", p => p.disabled ? 0.3 : 1, ";border-radius:", p => p.theme.borderRadius, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";box-sizing:border-box;" + ( true ? "" : 0));

const SubscriptionInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eosxblu2"
} : 0)( true ? {
  name: "1vb1k60",
  styles: "display:flex;flex-direction:column;align-self:center"
} : 0);

const SubscriptionDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eosxblu1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";line-height:1;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const SubscriptionTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eosxblu0"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";line-height:1;color:", p => p.theme.textColor, ";white-space:nowrap;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationDeveloperSettings_subscriptionBox_tsx.6c9e8688a649448ab41de08fb3b1e005.js.map