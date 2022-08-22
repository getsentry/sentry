"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_components_settingsNavigation_tsx"],{

/***/ "./app/views/settings/components/settingsNavItem.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/components/settingsNavItem.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/badge */ "./app/components/badge.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const SettingsNavItem = _ref => {
  let {
    badge,
    label,
    index,
    id,
    ...props
  } = _ref;
  const LabelHook = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_5__["default"])({
    hookName: 'sidebar:item-label',
    defaultComponent: _ref2 => {
      let {
        children
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: children
      });
    }
  });
  let renderedBadge;

  if (badge === 'new') {
    renderedBadge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
      type: "new"
    });
  } else if (badge === 'beta') {
    renderedBadge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
      type: "beta"
    });
  } else if (badge === 'warning') {
    renderedBadge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This setting needs review'),
      position: "right",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledBadge, {
        text: badge,
        type: "warning"
      })
    });
  } else if (typeof badge === 'string' || typeof badge === 'number') {
    renderedBadge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledBadge, {
      text: badge
    });
  } else {
    renderedBadge = badge;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledNavItem, {
    onlyActiveOnIndex: index,
    activeClassName: "active",
    ...props,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(LabelHook, {
      id: id,
      children: label
    }), badge ? renderedBadge : null]
  });
};

SettingsNavItem.displayName = "SettingsNavItem";

const StyledNavItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(react_router__WEBPACK_IMPORTED_MODULE_2__.Link,  true ? {
  target: "e1xpglho1"
} : 0)("display:block;color:", p => p.theme.gray300, ";font-size:14px;line-height:30px;position:relative;&.active{color:", p => p.theme.textColor, ";&:before{background:", p => p.theme.active, ";}}&:hover,&:focus,&:active{color:", p => p.theme.textColor, ";outline:none;}&.focus-visible{outline:none;background:", p => p.theme.backgroundSecondary, ";padding-left:15px;margin-left:-15px;border-radius:3px;&:before{left:-15px;}}&:before{position:absolute;content:'';display:block;top:4px;left:-30px;height:20px;width:4px;background:transparent;border-radius:0 2px 2px 0;}" + ( true ? "" : 0));

const StyledBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1xpglho0"
} : 0)("font-weight:400;height:auto;line-height:1;font-size:", p => p.theme.fontSizeExtraSmall, ";padding:3px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(0.75), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsNavItem);

/***/ }),

/***/ "./app/views/settings/components/settingsNavigation.tsx":
/*!**************************************************************!*\
  !*** ./app/views/settings/components/settingsNavigation.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavigationGroup__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavigationGroup */ "./app/views/settings/components/settingsNavigationGroup.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class SettingsNavigation extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  componentDidCatch(error, errorInfo) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      Object.keys(errorInfo).forEach(key => {
        scope.setExtra(key, errorInfo[key]);
      });
      scope.setExtra('url', window.location.href);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(error);
    });
  }

  render() {
    const {
      navigationObjects,
      hooks,
      hookConfigs,
      stickyTop,
      ...otherProps
    } = this.props;
    const navWithHooks = navigationObjects.concat(hookConfigs);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(PositionStickyWrapper, {
      stickyTop: stickyTop,
      children: [navWithHooks.map(config => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsNavigationGroup__WEBPACK_IMPORTED_MODULE_4__["default"], { ...otherProps,
        ...config
      }, config.name)), hooks.map((Hook, i) => /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(Hook, {
        key: `hook-${i}`
      }))]
    });
  }

}

SettingsNavigation.displayName = "SettingsNavigation";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SettingsNavigation, "defaultProps", {
  hooks: [],
  hookConfigs: [],
  stickyTop: '69px'
});

const PositionStickyWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1v9qc1o0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(4), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){position:sticky;top:", p => p.stickyTop, ";overflow:scroll;-ms-overflow-style:none;scrollbar-width:none;&::-webkit-scrollbar{display:none;}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsNavigation);

/***/ }),

/***/ "./app/views/settings/components/settingsNavigationGroup.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/settings/components/settingsNavigationGroup.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var sentry_views_settings_components_settingsNavItem__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/settings/components/settingsNavItem */ "./app/views/settings/components/settingsNavItem.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const SettingsNavigationGroup = props => {
  const {
    organization,
    project,
    name,
    items
  } = props;
  const navLinks = items.map(_ref => {
    let {
      path,
      title,
      index,
      show,
      badge,
      id,
      recordAnalytics
    } = _ref;

    if (typeof show === 'function' && !show(props)) {
      return null;
    }

    if (typeof show !== 'undefined' && !show) {
      return null;
    }

    const badgeResult = typeof badge === 'function' ? badge(props) : null;
    const to = (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_2__["default"])(path, { ...(organization ? {
        orgId: organization.slug
      } : {}),
      ...(project ? {
        projectId: project.slug
      } : {})
    });

    const handleClick = () => {
      // only call the analytics event if the URL is changing
      if (recordAnalytics && to !== window.location.pathname) {
        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__.trackAnalyticsEvent)({
          organization_id: organization ? organization.id : null,
          project_id: project && project.id,
          eventName: 'Sidebar Item Clicked',
          eventKey: 'sidebar.item_clicked',
          sidebar_item_id: id,
          dest: path
        });
      }
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_views_settings_components_settingsNavItem__WEBPACK_IMPORTED_MODULE_3__["default"], {
      to: to,
      label: title,
      index: index,
      badge: badgeResult,
      id: id,
      onClick: handleClick
    }, title);
  });

  if (!navLinks.some(link => link !== null)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(NavSection, {
    "data-test-id": name,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SettingsHeading, {
      children: name
    }), navLinks]
  });
};

SettingsNavigationGroup.displayName = "SettingsNavigationGroup";

const NavSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14uzj5h1"
} : 0)( true ? {
  name: "1azpx8r",
  styles: "margin-bottom:20px"
} : 0);

const SettingsHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e14uzj5h0"
} : 0)("color:", p => p.theme.subText, ";font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:20px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsNavigationGroup);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_components_settingsNavigation_tsx.9bfbf0a5538854c15b07bb8438465c49.js.map