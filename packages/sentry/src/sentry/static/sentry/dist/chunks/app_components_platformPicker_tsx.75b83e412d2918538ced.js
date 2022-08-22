"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_platformPicker_tsx"],{

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/platformPicker.tsx":
/*!*******************************************!*\
  !*** ./app/components/platformPicker.tsx ***!
  \*******************************************/
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const PLATFORM_CATEGORIES = [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__["default"], {
  id: 'all',
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('All')
}];

const PlatformList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e183m2bh6"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";grid-template-columns:repeat(auto-fill, 112px);margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));

class PlatformPicker extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    var _this$props$defaultCa;

    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      category: (_this$props$defaultCa = this.props.defaultCategory) !== null && _this$props$defaultCa !== void 0 ? _this$props$defaultCa : PLATFORM_CATEGORIES[0].id,
      filter: this.props.noAutoFilter ? '' : (this.props.platform || '').split('-')[0]
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "logSearch", lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default()(() => {
      if (this.state.filter) {
        var _this$props$organizat;

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.platformpicker_search', {
          search: this.state.filter.toLowerCase(),
          num_results: this.platformList.length,
          source: this.props.source,
          organization: (_this$props$organizat = this.props.organization) !== null && _this$props$organizat !== void 0 ? _this$props$organizat : null
        });
      }
    }, sentry_constants__WEBPACK_IMPORTED_MODULE_11__.DEFAULT_DEBOUNCE_DURATION));
  }

  get platformList() {
    const {
      category
    } = this.state;
    const currentCategory = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__["default"].find(_ref => {
      let {
        id
      } = _ref;
      return id === category;
    });
    const filter = this.state.filter.toLowerCase();

    const subsetMatch = platform => {
      var _filterAliases;

      return platform.id.includes(filter) || platform.name.toLowerCase().includes(filter) || ((_filterAliases = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__.filterAliases[platform.id]) === null || _filterAliases === void 0 ? void 0 : _filterAliases.some(alias => alias.includes(filter)));
    };

    const categoryMatch = platform => {
      var _currentCategory$plat;

      return category === 'all' || (currentCategory === null || currentCategory === void 0 ? void 0 : (_currentCategory$plat = currentCategory.platforms) === null || _currentCategory$plat === void 0 ? void 0 : _currentCategory$plat.includes(platform.id));
    };

    const filtered = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__["default"].filter(this.state.filter ? subsetMatch : categoryMatch).sort((a, b) => a.id.localeCompare(b.id));
    return this.props.showOther ? filtered : filtered.filter(_ref2 => {
      let {
        id
      } = _ref2;
      return id !== 'other';
    });
  }

  render() {
    const platformList = this.platformList;
    const {
      setPlatform,
      listProps,
      listClassName
    } = this.props;
    const {
      filter,
      category
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(NavContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(CategoryNav, {
          children: PLATFORM_CATEGORIES.map(_ref3 => {
            let {
              id,
              name
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
              onClick: e => {
                var _this$props$organizat2;

                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.platformpicker_category', {
                  category: id,
                  source: this.props.source,
                  organization: (_this$props$organizat2 = this.props.organization) !== null && _this$props$organizat2 !== void 0 ? _this$props$organizat2 : null
                });
                this.setState({
                  category: id,
                  filter: ''
                });
                e.preventDefault();
              },
              to: "",
              isActive: () => id === (filter ? 'all' : category),
              children: name
            }, id);
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(SearchBar, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconSearch, {
            size: "xs"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("input", {
            type: "text",
            value: filter,
            placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Filter Platforms'),
            onChange: e => this.setState({
              filter: e.target.value
            }, this.logSearch)
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(PlatformList, {
        className: listClassName,
        ...listProps,
        children: platformList.map(platform => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(PlatformCard, {
          "data-test-id": `platform-${platform.id}`,
          platform: platform,
          selected: this.props.platform === platform.id,
          onClear: e => {
            setPlatform(null);
            e.stopPropagation();
          },
          onClick: () => {
            var _this$props$organizat3;

            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.select_platform', {
              platform_id: platform.id,
              source: this.props.source,
              organization: (_this$props$organizat3 = this.props.organization) !== null && _this$props$organizat3 !== void 0 ? _this$props$organizat3 : null
            });
            setPlatform(platform.id);
          }
        }, platform.id))
      }), platformList.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconProject, {
          size: "xl"
        }),
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)("We don't have an SDK for that yet!"),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`Not finding your platform? You can still create your project,
              but looks like we don't have an official SDK for your platform
              yet. However, there's a rich ecosystem of community supported
              SDKs (including Perl, CFML, Clojure, and ActionScript). Try
              [search:searching for Sentry clients] or contacting support.`, {
          search: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            href: "https://github.com/search?q=-org%3Agetsentry+topic%3Asentry&type=Repositories"
          })
        })
      })]
    });
  }

}

PlatformPicker.displayName = "PlatformPicker";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(PlatformPicker, "defaultProps", {
  showOther: true
});

const NavContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e183m2bh5"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";grid-template-columns:1fr minmax(0, 300px);align-items:start;border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const SearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e183m2bh4"
} : 0)(p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_16__.inputStyles)(p), ";padding:0 8px;color:", p => p.theme.subText, ";display:flex;align-items:center;font-size:15px;margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.75), ";input{border:none;background:none;padding:2px 4px;width:100%;line-height:24px;&:focus{outline:none;}}" + ( true ? "" : 0));

const CategoryNav = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e183m2bh3"
} : 0)( true ? {
  name: "1py8pn",
  styles: "margin:0;margin-top:4px;white-space:nowrap;>li{float:none;display:inline-block;}"
} : 0);

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_6__.PlatformIcon,  true ? {
  target: "e183m2bh2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));

const ClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e183m2bh1"
} : 0)("position:absolute;top:-6px;right:-6px;min-height:0;height:22px;width:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:", p => p.theme.background, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

ClearButton.defaultProps = {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconClose, {
    isCircled: true,
    size: "xs"
  }),
  borderless: true,
  size: 'xs'
};

const PlatformCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref4 => {
  let {
    platform,
    selected,
    onClear,
    ...props
  } = _ref4;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", { ...props,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPlatformIcon, {
      platform: platform.id,
      size: 56,
      radius: 5,
      withLanguageIcon: true,
      format: "lg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h3", {
      children: platform.name
    }), selected && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ClearButton, {
      onClick: onClear,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Clear')
    })]
  });
},  true ? {
  target: "e183m2bh0"
} : 0)("position:relative;display:flex;flex-direction:column;align-items:center;padding:0 0 14px;border-radius:4px;cursor:pointer;background:", p => p.selected && p.theme.alert.info.backgroundLight, ";&:hover{background:", p => p.theme.alert.muted.backgroundLight, ";}h3{flex-grow:1;display:flex;align-items:center;justify-content:center;width:100%;color:", p => p.selected ? p.theme.textColor : p.theme.subText, ";text-align:center;font-size:", p => p.theme.fontSizeExtraSmall, ";text-transform:uppercase;margin:0;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";line-height:1.2;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PlatformPicker);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_platformPicker_tsx.48d010da675498abccdb96dc3ef66484.js.map