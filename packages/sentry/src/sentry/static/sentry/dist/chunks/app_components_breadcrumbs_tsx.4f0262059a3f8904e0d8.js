"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_breadcrumbs_tsx"],{

/***/ "./app/components/breadcrumbs.tsx":
/*!****************************************!*\
  !*** ./app/components/breadcrumbs.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown */ "./app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const BreadcrumbList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11qg6053"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " 0;" + ( true ? "" : 0));

function isCrumbDropdown(crumb) {
  return crumb.items !== undefined;
}
/**
 * Page breadcrumbs used for navigation, not to be confused with sentry's event breadcrumbs
 */


const Breadcrumbs = _ref => {
  let {
    crumbs,
    linkLastItem = false,
    ...props
  } = _ref;

  if (crumbs.length === 0) {
    return null;
  }

  if (!linkLastItem) {
    const lastCrumb = crumbs[crumbs.length - 1];

    if (!isCrumbDropdown(lastCrumb)) {
      lastCrumb.to = null;
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(BreadcrumbList, { ...props,
    children: crumbs.map((crumb, index) => {
      if (isCrumbDropdown(crumb)) {
        const {
          label,
          ...crumbProps
        } = crumb;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_settings_components_settingsBreadcrumb_breadcrumbDropdown__WEBPACK_IMPORTED_MODULE_6__["default"], {
          isLast: index >= crumbs.length - 1,
          route: {},
          name: label,
          ...crumbProps
        }, index);
      }

      const {
        label,
        to,
        preservePageFilters,
        key
      } = crumb;
      const labelKey = typeof label === 'string' ? label : '';
      const mapKey = (key !== null && key !== void 0 ? key : typeof to === 'string') ? `${labelKey}${to}` : `${labelKey}${index}`;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [to ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(BreadcrumbLink, {
          to: to,
          preservePageFilters: preservePageFilters,
          "data-test-id": "breadcrumb-link",
          children: label
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(BreadcrumbItem, {
          children: label
        }), index < crumbs.length - 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(BreadcrumbDividerIcon, {
          size: "xs",
          direction: "right"
        })]
      }, mapKey);
    })
  });
};

Breadcrumbs.displayName = "Breadcrumbs";

const getBreadcrumbListItemStyles = p => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.css)(p.theme.overflowEllipsis, " font-size:", p.theme.fontSizeLarge, ";color:", p.theme.gray300, ";width:auto;&:last-child{color:", p.theme.textColor, ";}" + ( true ? "" : 0),  true ? "" : 0);

const BreadcrumbLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    preservePageFilters,
    to,
    ...props
  } = _ref2;
  return preservePageFilters ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
    to: to,
    ...props
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"], {
    to: to,
    ...props
  });
},  true ? {
  target: "e11qg6052"
} : 0)(getBreadcrumbListItemStyles, " &:hover,&:active{color:", p => p.theme.subText, ";}" + ( true ? "" : 0));

const BreadcrumbItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e11qg6051"
} : 0)(getBreadcrumbListItemStyles, " max-width:400px;" + ( true ? "" : 0));

const BreadcrumbDividerIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron,  true ? {
  target: "e11qg6050"
} : 0)("color:", p => p.theme.gray300, ";margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";flex-shrink:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Breadcrumbs);

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_breadcrumbs_tsx.0c6b3cebd4722a349edfdbe7ce508a31.js.map