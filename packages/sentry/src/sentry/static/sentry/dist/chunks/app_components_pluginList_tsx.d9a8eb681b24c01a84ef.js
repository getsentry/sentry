"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_pluginList_tsx"],{

/***/ "./app/components/inactivePlugins.tsx":
/*!********************************************!*\
  !*** ./app/components/inactivePlugins.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const InactivePlugins = _ref => {
  let {
    plugins,
    onEnablePlugin
  } = _ref;

  if (plugins.length === 0) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Inactive Integrations')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Plugins, {
        children: plugins.map(plugin => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(IntegrationButton, {
          onClick: () => onEnablePlugin(plugin),
          className: `ref-plugin-enable-${plugin.id}`,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Label, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledPluginIcon, {
              pluginId: plugin.id
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_2__["default"], {
              children: plugin.shortName || plugin.name
            })]
          })
        }, plugin.id))
      })
    })]
  });
};

InactivePlugins.displayName = "InactivePlugins";

const Plugins = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e4awzvo3"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";flex:1;flex-wrap:wrap;" + ( true ? "" : 0));

const IntegrationButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "e4awzvo2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";width:175px;text-align:center;font-size:", p => p.theme.fontSizeSmall, ";color:#889ab0;letter-spacing:0.1px;font-weight:600;text-transform:uppercase;border:1px solid #eee;background:inherit;border-radius:", p => p.theme.borderRadius, ";padding:10px;&:hover{border-color:#ccc;}" + ( true ? "" : 0));

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e4awzvo1"
} : 0)( true ? {
  name: "1wnowod",
  styles: "display:flex;align-items:center;justify-content:center"
} : 0);

const StyledPluginIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e4awzvo0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (InactivePlugins);

/***/ }),

/***/ "./app/components/pluginList.tsx":
/*!***************************************!*\
  !*** ./app/components/pluginList.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/plugins */ "./app/actionCreators/plugins.tsx");
/* harmony import */ var sentry_components_inactivePlugins__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/inactivePlugins */ "./app/components/inactivePlugins.tsx");
/* harmony import */ var sentry_components_pluginConfig__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/pluginConfig */ "./app/components/pluginConfig.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./panels */ "./app/components/panels/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const PluginList = _ref => {
  let {
    organization,
    project,
    pluginList,
    onDisablePlugin = () => {},
    onEnablePlugin = () => {}
  } = _ref;

  const handleEnablePlugin = plugin => {
    (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_0__.enablePlugin)({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug
    });
    onEnablePlugin(plugin);
  };

  const handleDisablePlugin = plugin => {
    (0,sentry_actionCreators_plugins__WEBPACK_IMPORTED_MODULE_0__.disablePlugin)({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug
    });
    onDisablePlugin(plugin);
  };

  if (!pluginList.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_panels__WEBPACK_IMPORTED_MODULE_4__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_panels__WEBPACK_IMPORTED_MODULE_4__.PanelItem, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("Oops! Looks like there aren't any available integrations installed.")
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
    children: [pluginList.filter(p => p.enabled).map(data => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_pluginConfig__WEBPACK_IMPORTED_MODULE_2__["default"], {
      data: data,
      organization: organization,
      project: project,
      onDisablePlugin: handleDisablePlugin
    }, data.id)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_inactivePlugins__WEBPACK_IMPORTED_MODULE_1__["default"], {
      plugins: pluginList.filter(p => !p.enabled && !p.isHidden),
      onEnablePlugin: handleEnablePlugin
    })]
  });
};

PluginList.displayName = "PluginList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PluginList);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_pluginList_tsx.1dff7c5a8bb08af13e664c9ba87b33cf.js.map