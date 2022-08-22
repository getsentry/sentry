"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_components_settingsLayout_tsx"],{

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_dropdownAutoComplete_menu__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete/menu */ "./app/components/dropdownAutoComplete/menu.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_crumb__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/crumb */ "./app/views/settings/components/settingsBreadcrumb/crumb.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_divider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/divider */ "./app/views/settings/components/settingsBreadcrumb/divider.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const EXIT_DELAY = 0;

class BreadcrumbDropdown extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isOpen: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "enteringTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "leavingTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "open", () => {
      this.setState({
        isOpen: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "close", () => {
      this.setState({
        isOpen: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleStateChange", () => {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseEnterActor", () => {
      var _this$props$enterDela;

      window.clearTimeout(this.leavingTimeout);
      window.clearTimeout(this.enteringTimeout);
      this.enteringTimeout = window.setTimeout(() => this.open(), (_this$props$enterDela = this.props.enterDelay) !== null && _this$props$enterDela !== void 0 ? _this$props$enterDela : 0);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseEnter", () => {
      window.clearTimeout(this.leavingTimeout);
      window.clearTimeout(this.enteringTimeout);
      this.open();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseLeave", () => {
      window.clearTimeout(this.enteringTimeout);
      this.leavingTimeout = window.setTimeout(() => this.close(), EXIT_DELAY);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickActor", () => {
      this.close();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClose", () => {
      this.close();
    });
  }

  componentWillUnmount() {
    window.clearTimeout(this.enteringTimeout);
    window.clearTimeout(this.leavingTimeout);
  }

  render() {
    const {
      hasMenu,
      route,
      isLast,
      name,
      items,
      onSelect,
      ...dropdownProps
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_dropdownAutoComplete_menu__WEBPACK_IMPORTED_MODULE_3__["default"], {
      blendCorner: false,
      onOpen: this.handleMouseEnter,
      onClose: this.close,
      isOpen: this.state.isOpen,
      menuProps: {
        onMouseEnter: this.handleMouseEnter,
        onMouseLeave: this.handleMouseLeave
      },
      items: items,
      onSelect: onSelect,
      virtualizedHeight: 41,
      ...dropdownProps,
      children: _ref => {
        let {
          getActorProps,
          actions,
          isOpen
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_views_settings_components_settingsBreadcrumb_crumb__WEBPACK_IMPORTED_MODULE_4__["default"], { ...getActorProps({
            onClick: this.handleClickActor.bind(this, actions),
            onMouseEnter: this.handleMouseEnterActor.bind(this, actions),
            onMouseLeave: this.handleMouseLeave.bind(this, actions)
          }),
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
            children: [name || route.name, " "]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_settingsBreadcrumb_divider__WEBPACK_IMPORTED_MODULE_5__["default"], {
            isHover: hasMenu && isOpen,
            isLast: isLast
          })]
        });
      }
    });
  }

}

BreadcrumbDropdown.displayName = "BreadcrumbDropdown";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BreadcrumbDropdown);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/crumb.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/crumb.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");



const Crumb = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3099yz0"
} : 0)("display:flex;align-items:center;position:relative;font-size:18px;color:", p => p.theme.subText, ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";cursor:pointer;white-space:nowrap;&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Crumb);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/divider.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/divider.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const Divider = _ref => {
  let {
    isHover,
    isLast
  } = _ref;
  return isLast ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(StyledDivider, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(StyledIconChevron, {
      direction: isHover ? 'down' : 'right',
      size: "14px"
    })
  });
};

const StyledIconChevron = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconChevron,  true ? {
  target: "et9m4il1"
} : 0)( true ? {
  name: "4zleql",
  styles: "display:block"
} : 0);

const StyledDivider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "et9m4il0"
} : 0)("display:inline-block;margin-left:6px;color:", p => p.theme.gray200, ";position:relative;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Divider);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ findFirstRouteWithoutRouteParam)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);


/**
 * For all routes with a `path`, find the first route without a route param (e.g. :apiKey)
 *
 * @param routes A list of react-router route objects
 * @param route If given, will only take into account routes between `route` and end of the routes list
 * @return Object Returns a react-router route object
 */
function findFirstRouteWithoutRouteParam(routes, route) {
  const routeIndex = route !== undefined ? routes.indexOf(route) : -1;
  const routesToSearch = route && routeIndex > -1 ? routes.slice(routeIndex) : routes;
  return routesToSearch.filter(_ref => {
    let {
      path
    } = _ref;
    return !!path;
  }).find(_ref2 => {
    let {
      path
    } = _ref2;
    return !(path !== null && path !== void 0 && path.includes(':'));
  }) || route;
}

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/index.tsx":
/*!********************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/index.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CrumbLink": () => (/* binding */ CrumbLink),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/getRouteStringFromRoutes */ "./app/utils/getRouteStringFromRoutes.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_crumb__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/crumb */ "./app/views/settings/components/settingsBreadcrumb/crumb.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_divider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/divider */ "./app/views/settings/components/settingsBreadcrumb/divider.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_organizationCrumb__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/organizationCrumb */ "./app/views/settings/components/settingsBreadcrumb/organizationCrumb.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_projectCrumb__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/projectCrumb */ "./app/views/settings/components/settingsBreadcrumb/projectCrumb.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_teamCrumb__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/teamCrumb */ "./app/views/settings/components/settingsBreadcrumb/teamCrumb.tsx");
/* harmony import */ var _context__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./context */ "./app/views/settings/components/settingsBreadcrumb/context.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const MENUS = {
  Organization: sentry_views_settings_components_settingsBreadcrumb_organizationCrumb__WEBPACK_IMPORTED_MODULE_6__["default"],
  Project: sentry_views_settings_components_settingsBreadcrumb_projectCrumb__WEBPACK_IMPORTED_MODULE_7__["default"],
  Team: sentry_views_settings_components_settingsBreadcrumb_teamCrumb__WEBPACK_IMPORTED_MODULE_8__["default"]
};

function SettingsBreadcrumb(_ref) {
  let {
    className,
    routes,
    params
  } = _ref;
  const pathMap = (0,_context__WEBPACK_IMPORTED_MODULE_9__.useBreadcrumbsPathmap)();
  const lastRouteIndex = routes.map(r => !!r.name).lastIndexOf(true);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Breadcrumbs, {
    className: className,
    children: routes.map((route, i) => {
      if (!route.name) {
        return null;
      }

      const pathTitle = pathMap[(0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_2__["default"])(routes.slice(0, i + 1))];
      const isLast = i === lastRouteIndex;
      const createMenu = MENUS[route.name];
      const Menu = typeof createMenu === 'function' && createMenu;
      const hasMenu = !!Menu;
      const CrumbItem = hasMenu ? Menu : () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_views_settings_components_settingsBreadcrumb_crumb__WEBPACK_IMPORTED_MODULE_4__["default"], {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(CrumbLink, {
          to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_3__["default"])(route, {
            routes,
            params
          }),
          children: [pathTitle || route.name, ' ']
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_settings_components_settingsBreadcrumb_divider__WEBPACK_IMPORTED_MODULE_5__["default"], {
          isLast: isLast
        })]
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(CrumbItem, {
        routes: routes,
        params: params,
        route: route,
        isLast: isLast
      }, `${route.name}:${route.path}`);
    })
  });
}

SettingsBreadcrumb.displayName = "SettingsBreadcrumb";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsBreadcrumb);

const CrumbLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e8a6wdo1"
} : 0)("display:block;&.focus-visible{outline:none;box-shadow:", p => p.theme.blue300, " 0 2px 0;}color:", p => p.theme.subText, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));



const Breadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8a6wdo0"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/menuItem.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/menuItem.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const MenuItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e17hbpgs0"
} : 0)("font-size:14px;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItem);

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/organizationCrumb.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/organizationCrumb.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "OrganizationCrumb": () => (/* binding */ OrganizationCrumb),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_findFirstRouteWithoutRouteParam__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam */ "./app/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/menuItem */ "./app/views/settings/components/settingsBreadcrumb/menuItem.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! . */ "./app/views/settings/components/settingsBreadcrumb/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











const OrganizationCrumb = _ref => {
  let {
    organization,
    organizations,
    params,
    routes,
    route,
    ...props
  } = _ref;

  const handleSelect = item => {
    // If we are currently in a project context, and we're attempting to switch organizations,
    // then we need to default to index route (e.g. `route`)
    //
    // Otherwise, find the last route without a router param
    // e.g. if you are on API details, we want the API listing
    // This fails if our route tree is not nested
    const hasProjectParam = !!params.projectId;
    let destination = hasProjectParam ? route : (0,sentry_views_settings_components_settingsBreadcrumb_findFirstRouteWithoutRouteParam__WEBPACK_IMPORTED_MODULE_6__["default"])(routes.slice(routes.indexOf(route))); // It's possible there is no route without route params (e.g. organization settings index),
    // in which case, we can use the org settings index route (e.g. `route`)

    if (!hasProjectParam && typeof destination === 'undefined') {
      destination = route;
    }

    if (destination === undefined) {
      return;
    }

    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_3__["default"])(destination, {
      routes,
      params: { ...params,
        orgId: item.value
      }
    }));
  };

  if (!organization) {
    return null;
  }

  const hasMenu = organizations.length > 1;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_5__["default"], {
    name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(___WEBPACK_IMPORTED_MODULE_8__.CrumbLink, {
      to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_3__["default"])(route, {
        routes,
        params: { ...params,
          orgId: organization.slug
        }
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(BadgeWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          avatarSize: 18,
          organization: organization
        })
      })
    }),
    onSelect: handleSelect,
    hasMenu: hasMenu,
    route: route,
    items: organizations.map((org, index) => ({
      index,
      value: org.slug,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_7__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          organization: org
        })
      })
    })),
    ...props
  });
};

OrganizationCrumb.displayName = "OrganizationCrumb";

const BadgeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lzct9b0"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_4__["default"])(OrganizationCrumb));

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/projectCrumb.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/projectCrumb.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectCrumb": () => (/* binding */ ProjectCrumb),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_findFirstRouteWithoutRouteParam__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam */ "./app/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/menuItem */ "./app/views/settings/components/settingsBreadcrumb/menuItem.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! . */ "./app/views/settings/components/settingsBreadcrumb/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const ProjectCrumb = _ref => {
  let {
    organization: latestOrganization,
    project: latestProject,
    projects,
    params,
    routes,
    route,
    ...props
  } = _ref;

  const handleSelect = item => {
    // We have to make exceptions for routes like "Project Alerts Rule Edit" or "Client Key Details"
    // Since these models are project specific, we need to traverse up a route when switching projects
    //
    // we manipulate `routes` so that it doesn't include the current project's route
    // which, unlike the org version, does not start with a route param
    const returnTo = (0,sentry_views_settings_components_settingsBreadcrumb_findFirstRouteWithoutRouteParam__WEBPACK_IMPORTED_MODULE_10__["default"])(routes.slice(routes.indexOf(route) + 1), route);

    if (returnTo === undefined) {
      return;
    }

    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_5__["default"])(returnTo, {
      routes,
      params: { ...params,
        projectId: item.value
      }
    }));
  };

  if (!latestOrganization) {
    return null;
  }

  if (!projects) {
    return null;
  }

  const hasMenu = projects && projects.length > 1;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_9__["default"], {
    hasMenu: hasMenu,
    route: route,
    name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ProjectName, {
      children: !latestProject ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {
        mini: true
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(___WEBPACK_IMPORTED_MODULE_12__.CrumbLink, {
        to: (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_6__["default"])('/settings/:orgId/projects/:projectId/', {
          orgId: latestOrganization.slug,
          projectId: latestProject.slug
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          project: latestProject,
          avatarSize: 18,
          disableLink: true
        })
      })
    }),
    onSelect: handleSelect,
    items: projects.map((project, index) => ({
      index,
      value: project.slug,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_11__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          project: project,
          avatarProps: {
            consistentWidth: true
          },
          avatarSize: 18,
          disableLink: true
        })
      })
    })),
    ...props
  });
};

ProjectCrumb.displayName = "ProjectCrumb";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__["default"])((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_7__["default"])(ProjectCrumb))); // Set height of crumb because of spinner

const SPINNER_SIZE = '24px';

const ProjectName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eeafyie0"
} : 0)("display:flex;.loading{width:", SPINNER_SIZE, ";height:", SPINNER_SIZE, ";margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25), " 0 0;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/components/settingsBreadcrumb/teamCrumb.tsx":
/*!************************************************************************!*\
  !*** ./app/views/settings/components/settingsBreadcrumb/teamCrumb.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/menuItem */ "./app/views/settings/components/settingsBreadcrumb/menuItem.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! . */ "./app/views/settings/components/settingsBreadcrumb/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const TeamCrumb = _ref => {
  let {
    params,
    routes,
    route,
    ...props
  } = _ref;
  const {
    teams,
    onSearch,
    fetching
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const team = teams.find(_ref2 => {
    let {
      slug
    } = _ref2;
    return slug === params.teamId;
  });
  const hasMenu = teams.length > 1;

  const handleSearchChange = e => {
    onSearch(e.target.value);
  };

  const debouncedHandleSearch = lodash_debounce__WEBPACK_IMPORTED_MODULE_1___default()(handleSearchChange, sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_DEBOUNCE_DURATION);

  if (!team) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_6__["default"], {
    name: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(___WEBPACK_IMPORTED_MODULE_8__.CrumbLink, {
      to: (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_4__["default"])(route, {
        routes,
        params: { ...params,
          teamId: team.slug
        }
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
        avatarSize: 18,
        team: team
      })
    }),
    onSelect: item => {
      react_router__WEBPACK_IMPORTED_MODULE_0__.browserHistory.push((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_4__["default"])('', {
        routes,
        params: { ...params,
          teamId: item.value
        }
      }));
    },
    hasMenu: hasMenu,
    route: route,
    items: teams.map((teamItem, index) => ({
      index,
      value: teamItem.slug,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_settingsBreadcrumb_menuItem__WEBPACK_IMPORTED_MODULE_7__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
          team: teamItem
        })
      })
    })),
    onChange: debouncedHandleSearch,
    busyItemsStillVisible: fetching,
    ...props
  });
};

TeamCrumb.displayName = "TeamCrumb";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamCrumb);

/***/ }),

/***/ "./app/views/settings/components/settingsLayout.tsx":
/*!**********************************************************!*\
  !*** ./app/views/settings/components/settingsLayout.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_animations__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/animations */ "./app/styles/animations.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _settingsBreadcrumb__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./settingsBreadcrumb */ "./app/views/settings/components/settingsBreadcrumb/index.tsx");
/* harmony import */ var _settingsHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./settingsHeader */ "./app/views/settings/components/settingsHeader.tsx");
/* harmony import */ var _settingsSearch__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./settingsSearch */ "./app/views/settings/components/settingsSearch/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















function SettingsLayout(props) {
  // This is used when the screen is small enough that the navigation should
  // be hidden
  //
  // [!!] On large screens this state is totally unused!
  const [navVisible, setNavVisible] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false); // Offset mobile settings navigation by the height of main navigation,
  // settings breadcrumbs and optional warnings.

  const [navOffsetTop, setNavOffsetTop] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(0);
  const headerRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);

  function toggleNav(visible) {
    var _window$scrollTo, _window, _headerRef$current$ge, _headerRef$current;

    const bodyElement = document.getElementsByTagName('body')[0];
    (_window$scrollTo = (_window = window).scrollTo) === null || _window$scrollTo === void 0 ? void 0 : _window$scrollTo.call(_window, 0, 0);
    bodyElement.classList[visible ? 'add' : 'remove']('scroll-lock');
    setNavVisible(visible);
    setNavOffsetTop((_headerRef$current$ge = (_headerRef$current = headerRef.current) === null || _headerRef$current === void 0 ? void 0 : _headerRef$current.getBoundingClientRect().bottom) !== null && _headerRef$current$ge !== void 0 ? _headerRef$current$ge : 0);
  } // Close menu when navigating away


  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.listen(() => toggleNav(false)), []);
  const {
    renderNavigation,
    children,
    params,
    routes,
    route
  } = props; // We want child's view's props

  const childProps = children && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.isValidElement)(children) ? children.props : props;
  const childRoutes = childProps.routes || routes || [];
  const childRoute = childProps.route || route || {};
  const shouldRenderNavigation = typeof renderNavigation === 'function';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(SettingsColumn, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_settingsHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
      ref: headerRef,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(HeaderContent, {
        children: [shouldRenderNavigation && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(NavMenuToggle, {
          priority: "link",
          "aria-label": navVisible ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Close the menu') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Open the menu'),
          icon: navVisible ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconClose, {
            "aria-hidden": true
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconMenu, {
            "aria-hidden": true
          }),
          onClick: () => toggleNav(!navVisible)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledSettingsBreadcrumb, {
          params: params,
          routes: childRoutes,
          route: childRoute
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_settingsSearch__WEBPACK_IMPORTED_MODULE_12__["default"], {})]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(MaxWidthContainer, {
      children: [shouldRenderNavigation && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(SidebarWrapper, {
        isVisible: navVisible,
        offsetTop: navOffsetTop,
        children: renderNavigation()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(NavMask, {
        isVisible: navVisible,
        onClick: () => toggleNav(false)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Content, {
        children: children
      })]
    })]
  });
}

SettingsLayout.displayName = "SettingsLayout";

const SettingsColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md7"
} : 0)( true ? {
  name: "50ooqw",
  styles: "display:flex;flex-direction:column;flex:1;min-width:0;footer{margin-top:0;}"
} : 0);

const HeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md6"
} : 0)( true ? {
  name: "bcffy2",
  styles: "display:flex;align-items:center;justify-content:space-between"
} : 0);

const NavMenuToggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1ur80md5"
} : 0)("display:none;margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " -", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " -", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";color:", p => p.theme.subText, ";&:hover,&:focus,&:active{color:", p => p.theme.textColor, ";}@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

const StyledSettingsBreadcrumb = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_settingsBreadcrumb__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1ur80md4"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const MaxWidthContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md3"
} : 0)("display:flex;max-width:", p => p.theme.settings.containerWidth, ";flex:1;" + ( true ? "" : 0));

const SidebarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md2"
} : 0)("flex-shrink:0;width:", p => p.theme.settings.sidebarWidth, ";background:", p => p.theme.background, ";border-right:1px solid ", p => p.theme.border, ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:", p => p.isVisible ? 'block' : 'none', ";position:fixed;top:", p => p.offsetTop, "px;bottom:0;overflow-y:auto;animation:", sentry_styles_animations__WEBPACK_IMPORTED_MODULE_7__.slideInLeft, " 100ms ease-in-out;z-index:", p => p.theme.zIndex.settingsSidebarNav, ";box-shadow:", p => p.theme.dropShadowHeavy, ";}" + ( true ? "" : 0));

const NavMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md1"
} : 0)("display:none;@media (max-width: ", p => p.theme.breakpoints.small, "){display:", p => p.isVisible ? 'block' : 'none', ";background:rgba(0, 0, 0, 0.35);height:100%;width:100%;position:absolute;z-index:", p => p.theme.zIndex.settingsSidebarNavMask, ";animation:", sentry_styles_animations__WEBPACK_IMPORTED_MODULE_7__.fadeIn, " 250ms ease-in-out;}" + ( true ? "" : 0));
/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */


const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ur80md0"
} : 0)("flex:1;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";min-width:0;", sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__.PageContent, "{padding:0;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsLayout);

/***/ }),

/***/ "./app/views/settings/components/settingsSearch/index.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/components/settingsSearch/index.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_hotkeys_hook__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-hotkeys-hook */ "../node_modules/react-hotkeys-hook/dist/react-hotkeys-hook.esm.js");
/* harmony import */ var sentry_components_search__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/search */ "./app/components/search/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

function SettingsSearch() {
  const searchInput = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  (0,react_hotkeys_hook__WEBPACK_IMPORTED_MODULE_2__.useHotkeys)('/', e => {
    var _searchInput$current;

    e.preventDefault();
    (_searchInput$current = searchInput.current) === null || _searchInput$current === void 0 ? void 0 : _searchInput$current.focus();
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_search__WEBPACK_IMPORTED_MODULE_3__.Search, {
    entryPoint: "settings_search",
    minSearch: MIN_SEARCH_LENGTH,
    maxResults: MAX_RESULTS,
    renderInput: _ref => {
      let {
        getInputProps
      } = _ref;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(SearchInputWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(SearchInputIcon, {
          size: "14px"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(SearchInput, { ...getInputProps({
            type: 'text',
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Search')
          }),
          ref: searchInput
        })]
      });
    }
  });
}

SettingsSearch.displayName = "SettingsSearch";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SettingsSearch);

const SearchInputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ep9h6jq2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const SearchInputIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconSearch,  true ? {
  target: "ep9h6jq1"
} : 0)("color:", p => p.theme.gray300, ";position:absolute;left:10px;top:8px;" + ( true ? "" : 0));

const SearchInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('input',  true ? {
  target: "ep9h6jq0"
} : 0)("color:", p => p.theme.formText, ";background-color:", p => p.theme.background, ";transition:border-color 0.15s ease;font-size:14px;width:260px;line-height:1;padding:5px 8px 4px 28px;border:1px solid ", p => p.theme.border, ";border-radius:30px;height:28px;box-shadow:inset ", p => p.theme.dropShadowLight, ";&:focus{outline:none;border:1px solid ", p => p.theme.border, ";}&::placeholder{color:", p => p.theme.formPlaceholder, ";}" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_components_settingsLayout_tsx.ead972acfa5cb8ffe78ca9264e59a327.js.map