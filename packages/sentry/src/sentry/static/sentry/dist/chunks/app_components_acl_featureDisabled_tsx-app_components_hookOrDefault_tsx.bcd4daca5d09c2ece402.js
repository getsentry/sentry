"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_acl_featureDisabled_tsx-app_components_hookOrDefault_tsx"],{

/***/ "./app/components/acl/featureDisabled.tsx":
/*!************************************************!*\
  !*** ./app/components/acl/featureDisabled.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/selectText */ "./app/utils/selectText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














const installText = (features, featureName) => `# ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Enables the %s feature', featureName)}\n${features.map(f => `SENTRY_FEATURES['${f}'] = True`).join('\n')}`;

/**
 * DisabledInfo renders a component informing that a feature has been disabled.
 *
 * By default this component will render a help button which toggles more
 * information about why the feature is disabled, showing the missing feature
 * flag and linking to documentation for managing sentry server feature flags.
 */
function FeatureDisabled(_ref) {
  let {
    features,
    featureName,
    alert,
    hideHelpToggle,
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This feature is not enabled on your Sentry installation.')
  } = _ref;
  const [showHelp, setShowHelp] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  function renderHelp() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(HelpText, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)(`Enable this feature on your sentry installation by adding the
              following configuration into your [configFile:sentry.conf.py].
              See [configLink:the configuration documentation] for more
              details.`, {
          configFile: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("code", {}),
          configLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
            href: sentry_constants__WEBPACK_IMPORTED_MODULE_7__.CONFIG_DOCS_URL
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_5__["default"], {
        hideUnsupported: true,
        value: installText(features, featureName),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(CopyButton, {
          borderless: true,
          size: "xs",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconCopy, {
            size: "xs"
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Copy to Clipboard')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Pre, {
        onClick: e => (0,sentry_utils_selectText__WEBPACK_IMPORTED_MODULE_11__.selectText)(e.target),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("code", {
          children: installText(features, featureName)
        })
      })]
    });
  }

  if (!alert) {
    const showDescription = hideHelpToggle || showHelp;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(FeatureDisabledMessage, {
        children: [message, !hideHelpToggle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ToggleButton, {
          priority: "link",
          size: "xs",
          onClick: () => setShowHelp(!showHelp),
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Help'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconChevron, {
            direction: showDescription ? 'up' : 'down'
          })]
        })]
      }), showDescription && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(HelpDescription, {
        children: renderHelp()
      })]
    });
  }

  const AlertComponent = typeof alert === 'boolean' ? sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"] : alert;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(AlertComponent, {
    type: "warning",
    showIcon: true,
    expand: renderHelp(),
    children: message
  });
}

FeatureDisabled.displayName = "FeatureDisabled";

const FeatureDisabledMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey4q7ao5"
} : 0)("display:flex;justify-content:space-between;line-height:", p => p.theme.text.lineHeightBody, ";" + ( true ? "" : 0));

const HelpDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ey4q7ao4"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";pre,code{margin-bottom:0;white-space:pre;}button{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";}" + ( true ? "" : 0));

const HelpText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "ey4q7ao3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const ToggleButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ey4q7ao2"
} : 0)("color:", p => p.theme.active, ";height:", p => p.theme.text.lineHeightBody, "em;min-height:", p => p.theme.text.lineHeightBody, "em;&:hover{color:", p => p.theme.activeHover, ";}", sentry_components_button__WEBPACK_IMPORTED_MODULE_4__.ButtonLabel, "{display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}" + ( true ? "" : 0));

const CopyButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ey4q7ao1"
} : 0)( true ? {
  name: "1o3nkn",
  styles: "margin-left:auto"
} : 0);

const Pre = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "ey4q7ao0"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeatureDisabled);

/***/ }),

/***/ "./app/components/hookOrDefault.tsx":
/*!******************************************!*\
  !*** ./app/components/hookOrDefault.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Use this instead of the usual ternery operator when using getsentry hooks.
 * So in lieu of:
 *
 *  HookStore.get('component:org-auth-view').length
 *   ? HookStore.get('component:org-auth-view')[0]()
 *   : OrganizationAuth
 *
 * do this instead:
 *
 *   const HookedOrganizationAuth = HookOrDefault({
 *     hookName:'component:org-auth-view',
 *     defaultComponent: OrganizationAuth,
 *   })
 *
 * Note, you will need to add the hookstore function in getsentry [0] first and
 * then register the types [2] and validHookName [1] in sentry.
 *
 * [0] /getsentry/static/getsentry/gsApp/registerHooks.jsx
 * [1] /sentry/app/stores/hookStore.tsx
 * [2] /sentry/app/types/hooks.ts
 */
function HookOrDefault(_ref) {
  let {
    hookName,
    defaultComponent,
    defaultComponentPromise
  } = _ref;

  class HookOrDefaultComponent extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        hooks: sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(hookName)
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unlistener", sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen((name, hooks) => name === hookName && this.setState({
        hooks
      }), undefined));
    }

    componentWillUnmount() {
      var _this$unlistener;

      (_this$unlistener = this.unlistener) === null || _this$unlistener === void 0 ? void 0 : _this$unlistener.call(this);
    }

    get defaultComponent() {
      // If `defaultComponentPromise` is passed, then return a Suspended component
      if (defaultComponentPromise) {
        const DefaultComponent = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.lazy)(defaultComponentPromise);
        return props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Suspense, {
          fallback: null,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(DefaultComponent, { ...props
          })
        });
      }

      return defaultComponent;
    }

    render() {
      var _this$state$hooks$, _this$state$hooks;

      const hookExists = this.state.hooks && this.state.hooks.length;
      const componentFromHook = (_this$state$hooks$ = (_this$state$hooks = this.state.hooks)[0]) === null || _this$state$hooks$ === void 0 ? void 0 : _this$state$hooks$.call(_this$state$hooks);
      const HookComponent = hookExists && componentFromHook ? componentFromHook : this.defaultComponent;
      return HookComponent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(HookComponent, { ...this.props
      }) : null;
    }

  }

  HookOrDefaultComponent.displayName = "HookOrDefaultComponent";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(HookOrDefaultComponent, "displayName", `HookOrDefaultComponent(${hookName})`);

  return HookOrDefaultComponent;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HookOrDefault);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_acl_featureDisabled_tsx-app_components_hookOrDefault_tsx.9e6765217ecb726596daec69f3fba432.js.map