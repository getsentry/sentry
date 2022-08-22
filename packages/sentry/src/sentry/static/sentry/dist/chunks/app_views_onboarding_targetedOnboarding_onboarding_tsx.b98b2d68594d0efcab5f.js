"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_onboarding_targetedOnboarding_onboarding_tsx"],{

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

/***/ "./app/components/multiPlatformPicker.tsx":
/*!************************************************!*\
  !*** ./app/components/multiPlatformPicker.tsx ***!
  \************************************************/
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
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















const PLATFORM_CATEGORIES = [{
  id: 'all',
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('All')
}, ...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__["default"]]; // Category needs the all option while CategoryObj does not

// create a lookup table for each platform
const indexByPlatformByCategory = {};
sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__["default"].forEach(category => {
  const indexByPlatform = {};
  indexByPlatformByCategory[category.id] = indexByPlatform;
  category.platforms.forEach((platform, index) => {
    indexByPlatform[platform] = index;
  });
});

const getIndexOfPlatformInCategory = (category, platform) => {
  const indexByPlatform = indexByPlatformByCategory[category];
  return indexByPlatform[platform.id];
};

const isPopular = platform => sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__.popularPlatformCategories.includes(platform.id);

const popularIndex = platform => getIndexOfPlatformInCategory('popular', platform);

const PlatformList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ee972oi6"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";grid-template-columns:repeat(auto-fill, 112px);justify-content:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

function PlatformPicker(props) {
  var _props$defaultCategor;

  const {
    organization,
    source
  } = props;
  const [category, setCategory] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)((_props$defaultCategor = props.defaultCategory) !== null && _props$defaultCategor !== void 0 ? _props$defaultCategor : PLATFORM_CATEGORIES[0].id);
  const [filter, setFilter] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(props.noAutoFilter ? '' : (props.platforms[0] || '').split('-')[0]);

  function getPlatformList() {
    const currentCategory = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__["default"].find(_ref => {
      let {
        id
      } = _ref;
      return id === category;
    });
    const filterLowerCase = filter.toLowerCase();

    const subsetMatch = platform => {
      var _filterAliases$platfo;

      return platform.id.includes(filterLowerCase) || platform.name.toLowerCase().includes(filterLowerCase) || ((_filterAliases$platfo = sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_12__.filterAliases[platform.id]) === null || _filterAliases$platfo === void 0 ? void 0 : _filterAliases$platfo.some(alias => alias.includes(filterLowerCase)));
    };

    const categoryMatch = platform => {
      var _currentCategory$plat;

      return category === 'all' || (currentCategory === null || currentCategory === void 0 ? void 0 : (_currentCategory$plat = currentCategory.platforms) === null || _currentCategory$plat === void 0 ? void 0 : _currentCategory$plat.includes(platform.id));
    };

    const customCompares = (a, b) => {
      // the all category and serverless category both require custom sorts
      if (category === 'all') {
        return popularTopOfAllCompare(a, b);
      }

      if (category === 'serverless') {
        return serverlessCompare(a, b);
      } // maintain ordering otherwise


      return getIndexOfPlatformInCategory(category, a) - getIndexOfPlatformInCategory(category, b);
    };

    const popularTopOfAllCompare = (a, b) => {
      // for the all category, put popular ones at the top in the order they appear in the popular list
      if (isPopular(a) && isPopular(b)) {
        // if both popular, maintain ordering from popular list
        return popularIndex(a) - popularIndex(b);
      } // if one popular, that one should be first


      if (isPopular(a) !== isPopular(b)) {
        return isPopular(a) ? -1 : 1;
      } // since the all list is coming from a different source (platforms.json)
      // we can't go off the index of the item in platformCategories.tsx since there is no all list


      return a.id.localeCompare(b.id);
    };

    const serverlessCompare = (a, b) => {
      // for the serverless category, sort by service, then language
      // the format of the ids is language-service
      const aProvider = a.id.split('-')[1];
      const bProvider = b.id.split('-')[1]; // if either of the ids are not hyphenated, standard sort

      if (!aProvider || !bProvider) {
        return a.id.localeCompare(b.id);
      } // compare the portions after the hyphen


      const compareServices = aProvider.localeCompare(bProvider); // if they have the same service provider

      if (!compareServices) {
        return a.id.localeCompare(b.id);
      }

      return compareServices;
    };

    const filtered = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__["default"].filter(filterLowerCase ? subsetMatch : categoryMatch).sort(customCompares);
    return props.showOther ? filtered : filtered.filter(_ref2 => {
      let {
        id
      } = _ref2;
      return id !== 'other';
    });
  }

  const platformList = getPlatformList();
  const {
    addPlatform,
    removePlatform,
    listProps,
    listClassName
  } = props;
  const logSearch = lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()(() => {
    if (filter) {
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('growth.platformpicker_search', {
        search: filter.toLowerCase(),
        num_results: platformList.length,
        source,
        organization
      });
    }
  }, sentry_constants__WEBPACK_IMPORTED_MODULE_11__.DEFAULT_DEBOUNCE_DURATION);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(logSearch, [filter, logSearch]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(NavContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(CategoryNav, {
        children: PLATFORM_CATEGORIES.map(_ref3 => {
          let {
            id,
            name
          } = _ref3;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
            onClick: e => {
              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('growth.platformpicker_category', {
                category: id,
                source,
                organization
              });
              setCategory(id);
              setFilter('');
              e.preventDefault();
            },
            to: "",
            isActive: () => id === (filter ? 'all' : category),
            children: name
          }, id);
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledSearchBar, {
        size: "sm",
        query: filter,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Filter Platforms'),
        onChange: setFilter
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(PlatformList, {
      className: listClassName,
      ...listProps,
      children: platformList.map(platform => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(PlatformCard, {
        "data-test-id": `platform-${platform.id}`,
        platform: platform,
        selected: props.platforms.includes(platform.id),
        onClear: e => {
          removePlatform(platform.id);
          e.stopPropagation();
        },
        onClick: () => {
          // do nothing if already selected
          if (props.platforms.includes(platform.id)) {
            return;
          }

          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('growth.select_platform', {
            platform_id: platform.id,
            source,
            organization
          });
          addPlatform(platform.id);
        }
      }, platform.id))
    }), platformList.length === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_18__["default"], {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconProject, {
        size: "xl"
      }),
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)("We don't have an SDK for that yet!"),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`Not finding your platform? You can still create your project,
            but looks like we don't have an official SDK for your platform
            yet. However, there's a rich ecosystem of community supported
            SDKs (including Perl, CFML, Clojure, and ActionScript). Try
            [search:searching for Sentry clients] or contacting support.`, {
        search: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
          href: "https://github.com/search?q=-org%3Agetsentry+topic%3Asentry&type=Repositories"
        })
      })
    })]
  });
}

PlatformPicker.displayName = "PlatformPicker";

const NavContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ee972oi5"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";display:flex;flex-direction:row;align-items:start;border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ee972oi4"
} : 0)("max-width:300px;min-width:150px;margin-top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.25), ";margin-left:auto;flex-shrink:0;flex-basis:0;flex-grow:1;" + ( true ? "" : 0));

const CategoryNav = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ee972oi3"
} : 0)("margin:0;margin-top:4px;white-space:nowrap;overflow-x:scroll;overflow-y:hidden;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";flex-shrink:1;flex-grow:0;>li{float:none;display:inline-block;}::-webkit-scrollbar{display:none;}-ms-overflow-style:none;scrollbar-width:none;" + ( true ? "" : 0));

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_5__.PlatformIcon,  true ? {
  target: "ee972oi2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

const ClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ee972oi1"
} : 0)("position:absolute;top:-6px;right:-6px;min-height:0;height:22px;width:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:", p => p.theme.background, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

ClearButton.defaultProps = {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconClose, {
    isCircled: true,
    size: "xs"
  }),
  borderless: true,
  size: 'xs'
};

const PlatformCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref4 => {
  let {
    platform,
    selected,
    onClear,
    ...props
  } = _ref4;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("div", { ...props,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledPlatformIcon, {
      platform: platform.id,
      size: 56,
      radius: 5,
      withLanguageIcon: true,
      format: "lg"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("h3", {
      children: platform.name
    }), selected && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(ClearButton, {
      onClick: onClear,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Clear')
    })]
  });
},  true ? {
  target: "ee972oi0"
} : 0)("position:relative;display:flex;flex-direction:column;align-items:center;padding:0 0 14px;border-radius:4px;cursor:pointer;background:", p => p.selected && p.theme.alert.info.backgroundLight, ";&:hover{background:", p => p.theme.alert.muted.backgroundLight, ";}h3{flex-grow:1;display:flex;align-items:center;justify-content:center;width:100%;color:", p => p.selected ? p.theme.textColor : p.theme.subText, ";text-align:center;font-size:", p => p.theme.fontSizeExtraSmall, ";text-transform:uppercase;margin:0;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";line-height:1.2;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PlatformPicker);

/***/ }),

/***/ "./app/views/onboarding/components/fallingError.tsx":
/*!**********************************************************!*\
  !*** ./app/views/onboarding/components/fallingError.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class FallingError extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isFalling: false,
      fallCount: 0
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "triggerFall", countIt => this.setState(s => {
      var _this$props$onFall, _this$props;

      const fallCount = s.fallCount + (countIt ? 1 : 0);
      (_this$props$onFall = (_this$props = this.props).onFall) === null || _this$props$onFall === void 0 ? void 0 : _this$props$onFall.call(_this$props, fallCount);
      return { ...s,
        isFalling: true,
        fallCount
      };
    }));
  }

  render() {
    const {
      isFalling,
      fallCount
    } = this.state;

    const fallingError = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_5__.motion.div, {
      animate: isFalling ? 'falling' : 'hanging',
      variants: {
        initial: {
          opacity: 0
        },
        hanging: {
          originX: '50%',
          originY: '0',
          opacity: [1, 1, 1],
          rotateZ: [8, -8, 8],
          transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_3__["default"])({
            repeat: Infinity,
            repeatType: 'loop',
            duration: 4
          })
        },
        falling: {
          originY: '50%',
          y: 200,
          rotate: -20,
          scale: 0.5,
          opacity: 0,
          transition: {
            duration: 3
          },
          transitionEnd: {
            originY: '0',
            scale: 1,
            rotate: 0,
            y: '-10px'
          }
        }
      },
      onAnimationComplete: variant => variant === 'falling' && this.setState({
        isFalling: false
      }),
      children: !isFalling ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("svg", {
        width: "38",
        height: "77",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        onClick: () => this.triggerFall(true),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M17.1 56.4L13.5 73 6 60c-.9.7-1.7 1.4-2.3 2.3C3 63 2.6 64 2.4 65c.6.3 1.3.5 2 .4a1.7 1.7 0 001.6-.9l7.1 11.7c.5.9 1.2 1 1.6-.1.3-1.1 3.5-20 3.5-20l-1 .4zM26.7 54.7L30.2 72l-7.5-12.9c-1 .6-1.7 1.4-2.4 2.3-.6.7-1 1.5-1.2 2.5.6.3 1.2.5 1.9.5a1.7 1.7 0 001.7-1L30.4 75a1.1 1.1 0 001.9-1c-.2-1.5-4.6-19.6-4.6-19.6l-1 .4zM27.7 39.7l2.2-31.4-1.6-1.5c0-.7 0-1.3-.3-2l-.3-.8 1-.2 1 2 .7-4.7 1 .1-.3 4.1L32.5 0l1.2.4-1 4.3 1.4-3 .8.6-1.7 5.8-.8.6-4 32.2-.7-1.2zM11.2 39.2L6.6 11.8l.6-.6v-3l.1-1-1-.4a2 2 0 00-.6 1v1.5L4.4 7.4 4.1 6l.1-1.4-1.2.2-.2 1.5.5 1.6L2 6.8 1 5.3.1 6l.7 1.3-.8.9L1.8 10l2.4 1.9 6.5 29.4.5-2z",
          fill: "#2F1D4A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M17.2 26.4a1.8 1.8 0 00-1.9 1.7l-4 28.3c-.3 1.4.4 3 2.7 2.4l21.5-5.5c1.2-.3 2.1-1.3 1-3-1-1.8-16.1-21.3-16.9-22.3-.8-1-1.3-1.8-2.4-1.6z",
          fill: "#E0557A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M22.8 48.7l-5.6-12 4.3-1.5 2.7 13-1.4.5z",
          fill: "#2F1D4A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M17.9 27l-.3-.3-.2-.3h-.2c-.4 0-.7 0-1 .2l.7.7.2.3a1086 1086 0 0117.2 23v.7a1.4 1.4 0 01-1 .8l-21.5 5.5h-.4c0 .4.3.8.6 1a9139.6 9139.6 0 0122.5-6c.3-.3.6-.6.7-1a2.6 2.6 0 00-.4-2.3c-1-1.7-16-21.2-17-22.3z",
          fill: "#9D3565"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M11.4 57.7a1.6 1.6 0 01-1.3-.3 1.7 1.7 0 01-.4-1.6l1.5-10.3 2.5-18c.2-1.2.7-1.2 1.2-1.3h.5a1.2 1.2 0 01.8.4l1-.2h.2a2.4 2.4 0 00-2.4-1.1h-.2a2.2 2.2 0 00-2 2l-2.6 18-1.4 10.3a2.7 2.7 0 00.6 2.5 2.2 2.2 0 001.6.6l1-.1c-.3-.2-.5-.5-.6-.9z",
          fill: "#E0557A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M24.5 53.8a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z",
          fill: "#2F1D4A"
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("svg", {
        width: "47",
        height: "77",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M21.1 18.4a1.8 1.8 0 00-1.8 1.7l-4 28.3c-.3 1.4.3 3 2.7 2.4l21.5-5.6c1.1-.3 2-1.3 1-3-1.1-1.7-16.1-21.3-17-22.2-.7-1-1.2-1.9-2.4-1.6z",
          fill: "#E0557A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M26.8 40.6l-5.7-12 4.4-1.4 2.7 13-1.4.4zM28.6 45.9a1.8 1.8 0 100-3.7 1.8 1.8 0 000 3.7z",
          fill: "#2F1D4A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M21.9 19l-.3-.3-.3-.4h-.2a3 3 0 00-.9.3l.6.7.3.3a1086 1086 0 0117.2 22.9v.8a1.3 1.3 0 01-1 .7l-21.6 5.6h-.4c.1.4.4.7.7 1a9139.6 9139.6 0 0122.5-6l.7-1a2.5 2.5 0 00-.5-2.4C37.7 39.6 22.7 20 22 19z",
          fill: "#9D3565"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M15.3 49.7a1.6 1.6 0 01-1.3-.3 1.8 1.8 0 01-.3-1.6L15 37.4l2.6-18c.2-1.1.7-1.2 1.2-1.2h.4a1.2 1.2 0 01.9.4 3 3 0 011-.2h.1a2.4 2.4 0 00-2.4-1.2h-.1a2.2 2.2 0 00-2.1 2l-2.6 18-1.4 10.3a2.7 2.7 0 00.6 2.6 2.2 2.2 0 001.6.6c.4 0 .7 0 1-.2-.2-.2-.5-.5-.6-.8z",
          fill: "#E0557A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M32.3 33L40 2.8 42.3.7l2.7.1 1.6 1.9-1.3.1-1.2-1-1 .2 1.2 1.2-.5.8-1.3-.3L33 34.5l-.8-1.5zM14.4 34.6L1 35.1s-1.3.2-.7 1c.5 1 7.1 10 7.1 10l.9.5c.6 0 1.1-.1 1.7-.3l1 1.5.7-.4-1.2-1.8 1-.4 1.6 2 .6-.6-1.5-2.2 1-.2 1.2.4.5-1.1-1.5-.6-3.8 1L3 36.4l11.4-.7v-1zM22 49l-3.6 16.5-7.6-13c-.9.7-1.7 1.4-2.3 2.3-.7.7-1.1 1.6-1.3 2.5a2 2 0 002 .5c.6 0 1.2-.4 1.6-.9l7 11.7c.4.7 1.5.8 1.7-.1l3.5-20-1 .4z",
          fill: "#2F1D4A"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("path", {
          d: "M31.3 46.5l-1 15.2-12.4 9.5c-.5 1-.9 2.2-1 3.4 0 .7.1 1.4.5 2a4 4 0 002.2-1.5 8 8 0 00.8-2.4L31.2 63a1.7 1.7 0 00.8-1.7l.2-15.2-1 .3z",
          fill: "#2F1D4A"
        })]
      })
    });

    return this.props.children({
      fallCount,
      fallingError,
      triggerFall: this.triggerFall,
      isFalling
    });
  }

}

FallingError.displayName = "FallingError";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FallingError);

/***/ }),

/***/ "./app/views/onboarding/components/pageCorners.tsx":
/*!*********************************************************!*\
  !*** ./app/views/onboarding/components/pageCorners.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const PageCorners = _ref => {
  let {
    animateVariant,
    ...rest
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(Container, { ...rest,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(TopRight, {
      width: "874",
      height: "203",
      viewBox: "0 0 874 203",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      animate: animateVariant,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M36.5 0H874v203l-288.7-10-7-114-180.2-4.8-3.6-35.2-351.1 2.5L36.5 0z",
        fill: "currentColor"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M535.5 111.5v-22l31.8 1 .7 21.5-32.5-.5zM4 43.5L0 21.6 28.5 18l4.2 24.7-28.7.8z",
        fill: "currentColor"
      })]
    }, "tr"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(BottomLeft, {
      width: "494",
      height: "141",
      viewBox: "0 0 494 141",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      animate: animateVariant,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M494 141H-1V7l140-7v19h33l5 82 308 4 9 36z",
        fill: "currentColor"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M219 88h-30l-1-19 31 3v16z",
        fill: "currentColor"
      })]
    }, "bl"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(TopLeft, {
      width: "414",
      height: "118",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      animate: animateVariant,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fillRule: "evenodd",
        clipRule: "evenodd",
        d: "M414 0H0v102h144l5-69 257-3 8-30zM0 112v-10h117v16L0 112z",
        fill: "currentColor"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M184 44h-25l-1 16 26-2V44z",
        fill: "currentColor"
      })]
    }, "tl"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)(BottomRight, {
      width: "650",
      height: "151",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      animate: animateVariant,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        fillRule: "evenodd",
        clipRule: "evenodd",
        d: "M27 151h623V0L435 7l-5 85-134 4-3 26-261-2-5 31z",
        fill: "currentColor"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("path", {
        d: "M398 68v16h24l1-16h-25zM3 119l-3 16 21 3 3-19H3z",
        fill: "currentColor"
      })]
    }, "br")]
  });
};

PageCorners.displayName = "PageCorners";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageCorners);
const transition = (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
  type: 'spring',
  duration: 0.8
});

const TopLeft = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.svg,  true ? {
  target: "eqycsm24"
} : 0)( true ? {
  name: "14fvduy",
  styles: "position:absolute;top:0;left:0"
} : 0);

TopLeft.defaultProps = {
  initial: {
    x: '-40px',
    opacity: 0,
    originX: 0,
    originY: 0,
    scale: 'var(--corner-scale)'
  },
  variants: {
    none: {
      x: '-40px',
      opacity: 0
    },
    'top-right': {
      x: '-40px',
      opacity: 0
    },
    'top-left': {
      x: 0,
      opacity: 1
    }
  },
  transition
};

const TopRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.svg,  true ? {
  target: "eqycsm23"
} : 0)( true ? {
  name: "1lby940",
  styles: "position:absolute;top:0;right:0"
} : 0);

TopRight.defaultProps = {
  initial: {
    x: '40px',
    opacity: 0,
    originX: '100%',
    originY: 0,
    scale: 'var(--corner-scale)'
  },
  variants: {
    none: {
      x: '40px',
      opacity: 0
    },
    'top-left': {
      x: '40px',
      opacity: 0
    },
    'top-right': {
      x: 0,
      opacity: 1
    }
  },
  transition
};

const BottomLeft = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.svg,  true ? {
  target: "eqycsm22"
} : 0)( true ? {
  name: "ui49t7",
  styles: "position:absolute;bottom:0;left:0"
} : 0);

BottomLeft.defaultProps = {
  initial: {
    x: '-40px',
    opacity: 0,
    originX: 0,
    originY: '100%',
    scale: 'var(--corner-scale)'
  },
  variants: {
    none: {
      x: '-40px',
      opacity: 0
    },
    'top-left': {
      x: '-40px',
      opacity: 0
    },
    'top-right': {
      x: 0,
      opacity: 1
    }
  },
  transition
};

const BottomRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.svg,  true ? {
  target: "eqycsm21"
} : 0)( true ? {
  name: "1kfrk40",
  styles: "position:absolute;bottom:0;right:0"
} : 0);

BottomRight.defaultProps = {
  initial: {
    x: '40px',
    opacity: 0,
    originX: '100%',
    originY: '100%',
    scale: 'var(--corner-scale)'
  },
  variants: {
    none: {
      x: '40px',
      opacity: 0
    },
    'top-right': {
      x: '40px',
      opacity: 0
    },
    'top-left': {
      x: 0,
      opacity: 1
    }
  },
  transition
};

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eqycsm20"
} : 0)("pointer-events:none;position:absolute;top:0;left:0;right:0;bottom:0;color:", p => p.theme.purple200, ";opacity:0.4;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/onboarding/components/stepHeading.tsx":
/*!*********************************************************!*\
  !*** ./app/views/onboarding/components/stepHeading.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");





const StepHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.h2,  true ? {
  target: "etjt43n0"
} : 0)("margin-left:calc(-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " - 30px);position:relative;display:inline-grid;grid-template-columns:max-content auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";align-items:center;&:before{content:'", p => p.step, "';display:flex;align-items:center;justify-content:center;width:30px;height:30px;background-color:", p => p.theme.yellow300, ";border-radius:50%;color:", p => p.theme.textColor, ";font-size:1rem;}" + ( true ? "" : 0));

StepHeading.defaultProps = {
  variants: {
    initial: {
      clipPath: 'inset(0% 100% 0% 0%)',
      opacity: 1
    },
    animate: {
      clipPath: 'inset(0% 0% 0% 0%)',
      opacity: 1
    },
    exit: {
      opacity: 0
    }
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_2__["default"])({
    duration: 0.3
  })
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StepHeading);

/***/ }),

/***/ "./app/views/onboarding/components/welcomeBackground.tsx":
/*!***************************************************************!*\
  !*** ./app/views/onboarding/components/welcomeBackground.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const Light = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.g,  true ? {
  target: "e1p7ryr24"
} : 0)( true ? {
  name: "1x1ief8",
  styles: "transform-box:fill-box"
} : 0);

Light.defaultProps = {
  initial: {
    originX: '50%',
    originY: '0'
  },
  animate: {
    rotate: [-5, 8, -5],
    transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
      duration: 3,
      repeat: Infinity,
      repeatType: 'loop'
    })
  }
};

const WelcomeBackground = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Compass, {
    xmlns: "http://www.w3.org/2000/svg",
    width: "150",
    viewBox: "0 0 143.7 123.4",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M141 47c-2-10-18-22-26-26s-21-9-40-8-31 8-31 8l-2-1c7-5 8-11 8-13s-4-6-13-6-22 2-29 9-10 19 0 21 24-4 24-4l4 2-7 11-7 28c-2 17 5 26 12 33 8 8 32 23 68 19 29-3 34-15 37-18s3-10 3-10l1-32c0-6 0-7-2-13ZM39 15s-8 1-9 7l1 1s-10 3-16 2-9-2-6-8S22 7 22 7a49 49 0 0 1 14-2c7-1 9 2 9 3s0 5-4 10Z",
      fill: "#fff"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "m20 79 7-18s7 38 67 38c30 1 44-13 50-27l-1 27s-10 21-44 24c-30 3-72-11-79-44Z",
      fill: "#b29dd2",
      opacity: ".5"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M31 23a10 10 0 0 1 4-5s6 6 6 6a36 36 0 0 0-5 4Z",
      fill: "#e7e1ec"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M31 26s-13 3-22 0c-9-4 0-12 5-15a36 36 0 0 1 29-4c2 0 4 2 3 0-1-3-6-5-15-4-7 0-18 5-22 8-7 5-11 11-8 16 2 7 13 6 17 5s11-3 13-6Zm7 29s-4-12 9-24 38-10 55-5c20 6 29 19 30 26 2 6 0 13 0 13s-3-19-21-27c-19-8-33-8-44-6s-20 7-29 23Z",
      fill: "#b29dd2",
      opacity: ".5"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#ebb432",
      d: "M62 33v17l21-9-21-8zm35 41 18-9 2 15-20-6z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#e1557a",
      d: "m102 48 5 5 6-1 6-3-1-4-4-4-6 1-5 1-1 5zM52 72l1-5 5-2h7l4 4-1 5-5 3h-5l-6-5z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M12 32a17 17 0 0 1-6-1c-3-1-5-3-6-7 0-5 4-12 11-17 10-7 25-8 31-6 6 1 9 4 9 7s-4 8-8 12a1 1 0 0 1-1 0 1 1 0 0 1 0-1c5-4 8-9 8-11 0-3-3-5-8-6-6-2-21 0-30 6C5 12 1 19 1 24c1 3 2 5 5 6 10 4 28-5 29-5a1 1 0 0 1 0 1c-1 0-13 6-23 6Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M16 26c-5 0-8-2-9-5a1 1 0 0 1 1 0c0 3 4 4 9 4 11-1 16-3 16-3a3 3 0 0 1 2 0 3 3 0 0 1 1 1 1 1 0 0 1 0 1 2 2 0 0 0-1-1 2 2 0 0 0-1 0l-17 3Zm-7-8H8a1 1 0 0 1 0-1c3-5 10-10 17-11 8-2 18-3 20 1 2 2 0 6-2 9a1 1 0 0 1-1 1v-1c1-2 4-7 2-9-2-3-11-2-18 0-8 1-14 6-17 11Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M30 23a1 1 0 0 1-1-1s2-7 10-8l5 7a1 1 0 0 1 0 1 1 1 0 0 1-1 0l-4-7c-8 1-9 7-9 7a1 1 0 0 1 0 1Zm6 6a1 1 0 0 1-1 0l-1-1v-1l2 1a1 1 0 0 1 0 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M94 98a119 119 0 0 1-22-3c-42-7-46-40-46-40-1-9 3-23 16-33 10-8 28-12 47-9a80 80 0 0 1 11 2 1 1 0 0 1 0 1 1 1 0 0 1-1 0 78 78 0 0 0-10-2c-19-3-36 1-47 9a37 37 0 0 0-15 32s4 32 45 39c35 7 51-2 60-10 13-11 12-31 7-41s-18-19-34-25v-1c16 6 30 16 35 26a36 36 0 0 1 3 25c-2 7-6 13-10 17-7 6-19 13-39 13Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M89 90a98 98 0 0 1-11-1c-6-1-23-5-33-17-8-8-10-21-9-26 1-6 5-12 11-17 8-6 19-9 32-9 31 0 49 17 52 23 5 7 10 21-3 35-9 10-27 12-39 12ZM79 21c-14 0-39 5-42 25-1 5 1 18 9 26 10 11 26 15 32 16 0 0 35 5 49-11 13-13 8-26 4-33-4-6-21-23-52-23Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M85 58a10 10 0 0 1-2 0 7 7 0 0 1-4-3 4 4 0 0 1-1-3c1-2 5-3 8-2 5 1 4 5 4 5a3 3 0 0 1-1 2 7 7 0 0 1-4 1Zm-1-8-5 2a3 3 0 0 0 1 3 6 6 0 0 0 3 2 7 7 0 0 0 5 0 2 2 0 0 0 1-2c0-1 1-3-3-4a7 7 0 0 0-2-1Zm-5 2Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "m89 53-3-16-6 15a1 1 0 0 1-1-1l7-16h1l3 18a1 1 0 0 1-1 0Zm26 29-23-8 20-10a1 1 0 0 1 1 1l3 16-1 1Zm-21-8 20 7-2-15ZM60 50l-1-15v-1a1 1 0 0 1 1 0l20 7h1l-1 1-19 8h-1Zm0-15 1 14 18-8Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M133 71h-1v-1c1-4 2-9-4-18s-18-17-31-21c-21-5-39 0-48 6-6 5-9 10-10 14a1 1 0 0 1-1 0c1-4 4-10 11-15 9-6 27-11 48-6 14 4 26 12 32 22 6 9 5 14 4 19Zm10 3a1 1 0 0 1-1 0l1-14a1 1 0 1 1 1 0l-1 14Zm-1 11v-4a1 1 0 0 1 1 0v4h-1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M91 121c-17 0-35-4-51-14-12-9-16-19-18-26a33 33 0 0 1-1-13l7-28h1l-7 28s-4 22 19 38c21 15 49 16 67 13 16-3 32-12 33-26v-4a1 1 0 0 1 1-1 1 1 0 0 1 0 1v4c-1 15-18 24-33 27a99 99 0 0 1-18 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M93 103h-4c-21-1-38-7-51-19a40 40 0 0 1-13-29 1 1 0 0 1 1 0 39 39 0 0 0 13 28c12 12 29 18 50 19 23 1 49-9 53-28a1 1 0 0 1 1-1 1 1 0 0 1 0 1c-2 9-8 16-19 22-9 4-20 7-31 7Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M45 59a1 1 0 0 1 0-1h6a1 1 0 0 1 1 0 1 1 0 0 1-1 1h-6Zm7-13-5-2a1 1 0 0 1 1-1l5 2a1 1 0 0 1-1 1Zm30-10a1 1 0 0 1-1 0v-4a1 1 0 0 1 1 0v4Zm15 3h-1a1 1 0 0 1 0-1l3-3a1 1 0 0 1 0 1l-2 3Zm21 17a1 1 0 0 1 0-1l6-1a1 1 0 0 1 0 1l-6 1Zm8 11-6-2a1 1 0 0 1-1-1 1 1 0 0 1 1 0l6 2v1ZM97 84a1 1 0 0 1-1 0l-2-4a1 1 0 0 1 0-1h1l2 4a1 1 0 0 1 0 1Zm-26-3a1 1 0 0 1-1-1l3-4a1 1 0 0 1 1 1l-3 3a1 1 0 0 1 0 1Zm-10-4-6-1a1 1 0 0 1-1 0l-5-4 1-6a1 1 0 0 1 1 0l6-3 6 1 1 1 4 3a1 1 0 0 1 0 1l-1 5h-1l-5 3Zm-6-2 6 1 5-3 1-4-4-4-6-1-6 3-1 5Zm50-23h-1l-5-4a1 1 0 0 1 0-1l1-4 6-3 6 1 5 3v5l-5 3a1 1 0 0 1-1 0h-6Zm-5-5 5 4h6l5-3v-3l-4-3-6-1-5 3Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#2f1d4a",
      d: "m54 71 1 1 4-2-1-1-4 2z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "61.4",
      cy: "68.2",
      rx: "1.4",
      ry: "1",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "105.1",
      cy: "47.1",
      rx: "1.4",
      ry: "1",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#2f1d4a",
      d: "m107 45 5-2 2 1-5 2-2-1zm-41-4-4-3h2l3 3h-1z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "68.1",
      cy: "42.6",
      rx: "1.4",
      ry: "1",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#2f1d4a",
      d: "m107 74 3 4 2-1-4-4-1 1z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "105.2",
      cy: "71.4",
      rx: "1.4",
      ry: "1",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M83 58a6 6 0 0 1-4-3l2 24 8-22-6 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "m81 79-2-24a1 1 0 0 1 1 0 6 6 0 0 0 3 2c3 1 5 0 6-1a1 1 0 0 1 1 1l-8 22a1 1 0 0 1-1 0Zm-1-22 2 19 6-18a8 8 0 0 1-5 0 7 7 0 0 1-3-1Z",
      fill: "#2f1d4a"
    })]
  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Log, {
    xmlns: "http://www.w3.org/2000/svg",
    width: "225",
    viewBox: "0 0 243.3 103.5",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M13 51s-3 6-2 20a45 45 0 0 0 7 24l14 8h154s15-7 15-36a54 54 0 0 0-2-13c-4-19-16-24-16-24h-7a16 16 0 0 0 1-12l-5-4a17 17 0 0 0-8 1l-15 14-116 1s-12 5-20 21Z",
      fill: "#fff"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#ebb432",
      d: "m81 19 16 4-4-18-12 14z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#e1557a",
      d: "m121 1-4 16 17-2-13-14z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#f58452",
      d: "m54 20 3-15 14 8-17 7z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "m52 32 96 1-9 24a2 2 0 0 1-3 0l-4-5-8 17a2 2 0 0 1-4 0l-9-27-10 19a2 2 0 0 1-4 0L85 40 69 55a2 2 0 0 1-3-1c-2-6-5-18-14-22Zm121 12 8 16 7-14 6 7 4-9s-4-8-9-11h-12Z",
      fill: "#b29dd2",
      opacity: ".5"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M243 104H0a1 1 0 0 1 0-1h243a1 1 0 0 1 1 0 1 1 0 0 1-1 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M16 104a1 1 0 0 1-1-1 61 61 0 0 0-3-7 29 29 0 0 0-1 5 1 1 0 0 1-1 0l-5-9a48 48 0 0 0 3 9 1 1 0 0 1 0 1H7a74 74 0 0 0-6-6 76 76 0 0 0 5 7 1 1 0 0 1-1 0l-5-8a1 1 0 0 1 0-1l6 5c-2-7-1-8-1-8l5 8 2-4 4 8a1 1 0 0 1 0 1Zm-4-8Zm38 8a1 1 0 0 1 0-1c5-2 10-8 11-11s4-18 3-24-2-23-9-30-22-8-22-8c-2 0-19 13-21 26-2 10-1 19 1 27l5 10 11 7a1 1 0 0 1 0 1c-1 0-10-5-11-7-1-1-11-14-7-38 2-13 19-27 22-27 0 0 15 1 23 8s9 25 10 31-3 22-4 25c-2 2-6 9-12 11Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "m45 100-14-1-12-8c-2-2-6-21-6-30 0-10 13-27 22-27s18 6 20 8 6 16 6 20v21c-1 6-6 14-10 16a1 1 0 0 1 0-1c4-2 8-10 9-15V62c0-4-5-18-6-20-1-1-11-7-19-7S14 52 14 61s4 27 6 29l11 8 16 1a1 1 0 0 1 0 1h-2Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M55 60a1 1 0 0 1 0-1s-2-11-8-16c-6-4-13-1-13-1a1 1 0 0 1 0-1s7-4 13 1c7 5 8 16 9 17a1 1 0 0 1-1 1ZM41 93a17 17 0 0 1-4-1c-6-1-15-9-16-14s-3-13 0-21 9-13 9-14a1 1 0 0 1 1 0v1s-7 6-9 13-1 17 0 21 9 12 15 13h9a4 4 0 0 0 2 0l7-7a52 52 0 0 0 0-5 1 1 0 0 1 1-1 1 1 0 0 1 0 1 52 52 0 0 1 0 5c-1 3-5 6-7 7a5 5 0 0 1-3 1l-5 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M39 85a5 5 0 0 1-1 0c-4-1-10-8-11-13s3-16 5-19c1-2 5-5 8-5 2 0 6 3 7 7 0 0 4 18 0 27-1 0-5 3-8 3Zm0-36-7 4c-1 4-5 15-4 19 1 5 7 11 10 12s7-2 8-3c4-9 0-26 0-26-1-4-5-6-7-6Zm7 32Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M40 72a4 4 0 0 1-2-1 1 1 0 0 1 1 0 3 3 0 0 0 2 0l1-6c0-2-2-4-3-4a5 5 0 0 0-2 2 19 19 0 0 0 0 5 1 1 0 1 1-1 0v-5a6 6 0 0 1 2-3 2 2 0 0 1 2 0l3 5c0 3 0 7-2 7a3 3 0 0 1-1 0Zm32-3H61a1 1 0 0 1 0-1h11a1 1 0 0 1 1 0 1 1 0 0 1-1 1Zm7 10h-4a1 1 0 0 1 0-1h4a1 1 0 0 1 1 0 1 1 0 0 1-1 1Zm14 5h-8a1 1 0 1 1 0-1h8l9-2a1 1 0 0 1 0 1ZM82 96l-9-1h-1a1 1 0 0 1 1-1l9 1h1a1 1 0 0 1-1 1Zm58 1-15-1-6-3-12 4a1 1 0 0 1-1-1l13-4 6 3 15 1a1 1 0 0 1 0 1Zm43-21h-8a1 1 0 0 1 0-1h8a1 1 0 0 1 0 1Zm-37 0h-17a1 1 0 0 1 0-1h17l12-3 8 3h5a1 1 0 0 1 0 1h-5l-8-3-12 3Zm10 9h-16a1 1 0 0 1-1-1 1 1 0 0 1 1 0h16a1 1 0 1 1 0 1Zm19 8v-1l12-1a1 1 0 0 1 0 1l-12 1Zm7-63h-6a1 1 0 0 1 0-1h6a1 1 0 0 1 0 1Zm-37 0H33a1 1 0 0 1 0-1h112a1 1 0 0 1 0 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M168 51h-1a1 1 0 0 1 0-1l10-23c2-4 1-7 0-8a8 8 0 0 0-6-4 13 13 0 0 0-7 0l-21 21a1 1 0 0 1-1 0v-1l22-21a13 13 0 0 1 7 0 9 9 0 0 1 7 4c1 2 2 5 0 10l-10 23Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M172 30a10 10 0 0 1-2 0c-2 0-5-2-7-6-1-4 1-9 1-9a1 1 0 1 1 1 0s-2 5-1 9c2 4 4 5 6 5s6 1 8-4v-1a1 1 0 0 1 1 1 6 6 0 0 1-7 5Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M169 27s-4-2-4-7a4 4 0 0 1 3-3 7 7 0 0 1 5 0c2 2 3 5 1 8a1 1 0 0 1 0-1c1-2 0-4-2-6a6 6 0 0 0-4 0 3 3 0 0 0-2 2 5 5 0 0 0 4 6l-1 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M171 24a2 2 0 0 1-3-2 2 2 0 0 1 1-2 2 2 0 0 1 1 0 1 1 0 0 1 0 1 1 1 0 0 0-1 1 1 1 0 0 0 2 1 1 1 0 0 1 0 1Zm15 80v-1s8-6 11-13a63 63 0 0 0 3-23 74 74 0 0 0-5-23c-3-8-11-13-12-13a1 1 0 0 1 0-1 1 1 0 0 1 1 0s9 6 12 14a75 75 0 0 1 5 23 65 65 0 0 1-3 23c-3 8-11 13-11 13l-1 1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M200 60h-6a1 1 0 0 1 0-1h6a1 1 0 0 1 1 0 1 1 0 0 1-1 1Zm-2 27h-8a1 1 0 0 1 0-1h8a1 1 0 0 1 1 1 1 1 0 0 1-1 0Zm-20-29a2 2 0 0 1-1 0l-6-11a1 1 0 1 1 1 0l6 10a1 1 0 0 0 1 0l6-12h1l5 7 4-9h1l-4 9a1 1 0 0 1-1 1 1 1 0 0 1-1-1l-5-6-5 12a2 2 0 0 1-2 0Zm-59 13a2 2 0 0 1-2-1l-9-28-11 19a2 2 0 0 1-1 1 2 2 0 0 1-1-1L82 40h-1L67 54a1 1 0 1 1-1-1l14-14a2 2 0 0 1 3 0l12 21a1 1 0 0 0 1 1 1 1 0 0 0 1-1l10-18a1 1 0 0 1 1-1 1 1 0 0 1 1 1l9 28a1 1 0 0 0 2 0l11-21a1 1 0 0 1 0-1l5 7v-1l6-16h1l-6 17a1 1 0 0 1-2 0l-4-5-11 20a2 2 0 0 1-1 1Zm33-29v-1l6-7a1 1 0 1 1 1 1l-6 7a1 1 0 0 1-1 0Zm5 4h-1v-1l2-3a1 1 0 0 1 1 0 1 1 0 0 1 0 1l-2 3Zm-92-4a2 2 0 0 1 0-1 4 4 0 0 1-3-2 3 3 0 0 1 1-3 2 2 0 0 1 3 0 3 3 0 0 1 1 3 3 3 0 0 1-1 2 1 1 0 0 1-1 1Zm-2-3a3 3 0 0 0 2 2 2 2 0 0 0 1-2 2 2 0 0 0-1-2 1 1 0 0 0-1 0 2 2 0 0 0-1 2Zm8 5a2 2 0 0 1-1 0l-2-2a1 1 0 0 1 1-1 3 3 0 0 1 2 0c1 0 2 1 1 2a2 2 0 0 1-1 1Zm-1-2a1 1 0 0 0-1 0l2 1h1l-1-1a4 4 0 0 0-1 0Zm30-6-3-1a1 1 0 0 1 0-1l4-2a6 6 0 0 1 3 1 1 1 0 0 1 1 1l-3 2a7 7 0 0 1-2 0Zm-2-1h3a4 4 0 0 0 3-1 5 5 0 0 0-3-1l-3 1v1Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M120 50a3 3 0 0 1-2-1 2 2 0 0 1 0-2 2 2 0 0 1 2-1 1 1 0 0 1 0 1 1 1 0 0 0-2 0 1 1 0 0 0 0 1 2 2 0 0 0 2 1 1 1 0 0 0 1 0 1 1 0 0 0 0-1 1 1 0 0 1 1 0 2 2 0 0 1-1 1 2 2 0 0 1-1 1Zm15-11 1 2 1-2h-2Zm1-2a2 2 0 0 1-1-1 1 1 0 0 1 0-1h1l1 1a1 1 0 0 0 1-1 1 1 0 0 0-1-1l-1 1a1 1 0 0 1-1 0v-1a2 2 0 0 1 3-1 2 2 0 0 1 1 2 2 2 0 0 1-2 2 3 3 0 0 1-1 0Zm82 67a1 1 0 0 1-1-1 44 44 0 0 0 5-6 46 46 0 0 0-7 4 1 1 0 0 1 0-1 21 21 0 0 0 2-5 41 41 0 0 0-6 6 1 1 0 0 1-1-1l3-9-6 9a1 1 0 0 1-1 0 45 45 0 0 0-1-8 37 37 0 0 0-1 8 1 1 0 0 1-1 0l1-9a1 1 0 0 1 1 0l2 7 6-8a1 1 0 0 1 1 0l-2 8 6-4a1 1 0 0 1 0 1l-1 4 6-3a1 1 0 0 1 1 1l-6 6v1ZM67 30a1 1 0 0 1-1 0s-1-9-6-14a1 1 0 1 1 1-1c5 6 6 14 6 15Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M52 19a1 1 0 0 1 0-1l2-13a1 1 0 0 1 1 0l13 7 1 1a1 1 0 0 1-1 0l-16 6Zm3-13-2 12 14-5Zm40 15-15-4a1 1 0 0 1-1 0L91 4a1 1 0 0 1 1 0l4 17h-1Zm-14-4 14 3-4-15Zm34-1v-1l3-15h1l13 13a1 1 0 0 1 0 1l-17 2Zm4-14-3 13 15-2Z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      d: "M125 30a75 75 0 0 0-2-15 1 1 0 0 1 0-1l1 1a76 76 0 0 1 2 15h-1Zm-40 0a1 1 0 0 1-1 0 59 59 0 0 1 2-12 1 1 0 0 1 1 0v1a60 60 0 0 0-2 11ZM58 11l-2-3h1l2 3h-1z",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "59.2",
      cy: "12.8",
      rx: "1",
      ry: ".8",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#2f1d4a",
      d: "m88 13 1-4h2l-2 5-1-1z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "87.8",
      cy: "15.6",
      rx: "1.2",
      ry: "1.1",
      transform: "rotate(-8 88 16)",
      fill: "#2f1d4a"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("path", {
      fill: "#2f1d4a",
      d: "m122 9-2-4h1l1 4z"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("ellipse", {
      cx: "122.9",
      cy: "11.4",
      rx: "1",
      ry: "1.2",
      transform: "rotate(-71 123 11)",
      fill: "#2f1d4a"
    })]
  })]
});

WelcomeBackground.displayName = "WelcomeBackground";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WelcomeBackground);

const Illustration = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.svg,  true ? {
  target: "e1p7ryr23"
} : 0)( true ? {
  name: "18fdm0a",
  styles: "position:absolute;overflow:visible!important"
} : 0);

const Compass = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Illustration,  true ? {
  target: "e1p7ryr22"
} : 0)( true ? {
  name: "glqs5i",
  styles: "left:24px;top:32px"
} : 0);

Compass.defaultProps = {
  variants: {
    initial: {
      opacity: 0,
      scale: 0.9
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
        duration: 0.5
      })
    },
    exit: {
      y: -120,
      opacity: 0
    }
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
    duration: 0.9
  })
};

const Log = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Illustration,  true ? {
  target: "e1p7ryr21"
} : 0)( true ? {
  name: "191kljj",
  styles: "right:-60px;bottom:0"
} : 0);

Log.defaultProps = {
  variants: {
    initial: {
      opacity: 0,
      scale: 0.9
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
        duration: 0.5
      })
    },
    exit: {
      y: -200,
      opacity: 0
    }
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
    duration: 1.1
  })
};

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.div,  true ? {
  target: "e1p7ryr20"
} : 0)("pointer-events:none;position:absolute;height:150%;max-width:100vw;width:300%;top:-25%;@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

Container.defaultProps = {
  variants: {
    animate: {},
    exit: {}
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
    staggerChildren: 0.2
  })
};

/***/ }),

/***/ "./app/views/onboarding/createSampleEventButton.tsx":
/*!**********************************************************!*\
  !*** ./app/views/onboarding/createSampleEventButton.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const EVENT_POLL_RETRIES = 30;
const EVENT_POLL_INTERVAL = 1000;

async function latestEventAvailable(api, groupID) {
  let retries = 0; // eslint-disable-next-line no-constant-condition

  while (true) {
    if (retries > EVENT_POLL_RETRIES) {
      return {
        eventCreated: false,
        retries: retries - 1
      };
    }

    await new Promise(resolve => window.setTimeout(resolve, EVENT_POLL_INTERVAL));

    try {
      await api.requestPromise(`/issues/${groupID}/events/latest/`);
      return {
        eventCreated: true,
        retries
      };
    } catch {
      ++retries;
    }
  }
}

class CreateSampleEventButton extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      creating: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createSampleGroup", async () => {
      // TODO(dena): swap out for action creator
      const {
        api,
        organization,
        project
      } = this.props;
      let eventData;

      if (!project) {
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('growth.onboarding_view_sample_event', {
        platform: project.platform,
        organization
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Processing sample event...'), {
        duration: EVENT_POLL_RETRIES * EVENT_POLL_INTERVAL
      });
      this.setState({
        creating: true
      });

      try {
        const url = `/projects/${organization.slug}/${project.slug}/create-sample/`;
        eventData = await api.requestPromise(url, {
          method: 'POST'
        });
      } catch (error) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setExtra('error', error);
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(new Error('Failed to create sample event'));
        });
        this.setState({
          creating: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to create a new sample event'));
        return;
      } // Wait for the event to be fully processed and available on the group
      // before redirecting.


      const t0 = performance.now();
      const {
        eventCreated,
        retries
      } = await latestEventAvailable(api, eventData.groupID);
      const t1 = performance.now();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      this.setState({
        creating: false
      });
      const duration = Math.ceil(t1 - t0);
      this.recordAnalytics({
        eventCreated,
        retries,
        duration
      });

      if (!eventCreated) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to load sample event'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setTag('groupID', eventData.groupID);
          scope.setTag('platform', project.platform || '');
          scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
          scope.setTag('retries', retries.toString());
          scope.setTag('duration', duration.toString());
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureMessage('Failed to load sample event');
        });
        return;
      }

      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/organizations/${organization.slug}/issues/${eventData.groupID}/?project=${project.id}`);
    });
  }

  componentDidMount() {
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sample_event.button_viewed', {
      organization,
      project_id: project.id,
      source
    });
  }

  recordAnalytics(_ref) {
    let {
      eventCreated,
      retries,
      duration
    } = _ref;
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    const eventKey = `sample_event.${eventCreated ? 'created' : 'failed'}`;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])(eventKey, {
      organization,
      project_id: project.id,
      platform: project.platform || '',
      interval: EVENT_POLL_INTERVAL,
      retries,
      duration,
      source
    });
  }

  render() {
    const {
      api: _api,
      organization: _organization,
      project: _project,
      source: _source,
      ...props
    } = this.props;
    const {
      creating
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], { ...props,
      disabled: props.disabled || creating,
      onClick: this.createSampleGroup
    });
  }

}

CreateSampleEventButton.displayName = "CreateSampleEventButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(CreateSampleEventButton)));

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/createProjectsFooter.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/createProjectsFooter.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ CreateProjectsFooter)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/projectActions */ "./app/actions/projectActions.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _genericFooter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./genericFooter */ "./app/views/onboarding/targetedOnboarding/components/genericFooter.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















function CreateProjectsFooter(_ref) {
  let {
    organization,
    platforms,
    onComplete,
    genSkipOnboardingLink,
    clearPlatforms
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const {
    teams
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_13__["default"])();
  const [persistedOnboardingState, setPersistedOnboardingState] = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.usePersistedOnboardingState)();

  const createProjects = async () => {
    if (!persistedOnboardingState) {
      // Do nothing if client state is not loaded yet.
      return;
    }

    try {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Creating projects'));
      const responses = await Promise.all(platforms.filter(platform => !persistedOnboardingState.platformToProjectIdMap[platform]).map(platform => (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.createProject)(api, organization.slug, teams[0].slug, platform, platform, {
        defaultRules: false
      })));
      const nextState = {
        platformToProjectIdMap: persistedOnboardingState.platformToProjectIdMap,
        selectedPlatforms: platforms,
        state: 'projects_selected',
        url: 'setup-docs/'
      };
      responses.forEach(p => nextState.platformToProjectIdMap[p.platform] = p.slug);
      setPersistedOnboardingState(nextState);
      responses.forEach(sentry_actions_projectActions__WEBPACK_IMPORTED_MODULE_6__["default"].createSuccess);
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('growth.onboarding_set_up_your_projects', {
        platforms: platforms.join(','),
        platform_count: platforms.length,
        organization
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.clearIndicators)();
      setTimeout(onComplete);
    } catch (err) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Failed to create projects'));
      _sentry_react__WEBPACK_IMPORTED_MODULE_16__.captureException(err);
    }
  };

  const renderPlatform = platform => {
    platform = platform || 'other';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SelectedPlatformIcon, {
      platform: platform,
      size: 23
    }, platform);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(_genericFooter__WEBPACK_IMPORTED_MODULE_15__["default"], {
    children: [genSkipOnboardingLink(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(SelectionWrapper, {
      children: platforms.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("div", {
          children: platforms.map(renderPlatform)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(PlatformSelected, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('%s platform selected', '%s platforms selected', platforms.length), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ClearButton, {
            priority: "link",
            onClick: clearPlatforms,
            size: "zero",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Clear')
          })]
        })]
      }) : null
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ButtonWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        priority: "primary",
        onClick: createProjects,
        disabled: platforms.length === 0,
        "data-test-id": "platform-select-next",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('Create Project', 'Create Projects', platforms.length)
      })
    })]
  });
}
CreateProjectsFooter.displayName = "CreateProjectsFooter";

const SelectionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div,  true ? {
  target: "ep9bkfl4"
} : 0)("display:flex;flex-direction:column;justify-content:center;align-items:center;@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

SelectionWrapper.defaultProps = {
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_11__["default"])({
    duration: 1.8
  })
};

const ButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div,  true ? {
  target: "ep9bkfl3"
} : 0)("display:flex;height:100%;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";" + ( true ? "" : 0));

ButtonWrapper.defaultProps = {
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_11__["default"])({
    duration: 1.3
  })
};

const SelectedPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_3__.PlatformIcon,  true ? {
  target: "ep9bkfl2"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const PlatformSelected = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ep9bkfl1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const ClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ep9bkfl0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/firstEventFooter.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/firstEventFooter.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FirstEventFooter)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/pulsingIndicator */ "./app/styles/pulsingIndicator.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_eventWaiter__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/eventWaiter */ "./app/utils/eventWaiter.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/onboarding/createSampleEventButton */ "./app/views/onboarding/createSampleEventButton.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _genericFooter__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./genericFooter */ "./app/views/onboarding/targetedOnboarding/components/genericFooter.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function FirstEventFooter(_ref) {
  let {
    organization,
    project,
    onClickSetupLater,
    isLast,
    hasFirstEvent,
    handleFirstIssueReceived
  } = _ref;
  const source = 'targeted_onboarding_first_event_footer';
  const [clientState, setClientState] = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.usePersistedOnboardingState)();

  const getSecondaryCta = () => {
    // if hasn't sent first event, allow skiping.
    // if last, no secondary cta
    if (!hasFirstEvent && !isLast) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        onClick: onClickSetupLater,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Next Platform')
      });
    }

    return null;
  };

  const getPrimaryCta = _ref2 => {
    let {
      firstIssue
    } = _ref2;

    // if hasn't sent first event, allow creation of sample error
    if (!hasFirstEvent) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_13__["default"], {
        project: project,
        source: "targted-onboarding",
        priority: "primary",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View Sample Error')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
      to: `/organizations/${organization.slug}/issues/${firstIssue !== true && firstIssue !== null ? `${firstIssue.id}/` : ''}`,
      priority: "primary",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Take me to my error')
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(GridFooter, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SkipOnboardingLink, {
      onClick: () => {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('growth.onboarding_clicked_skip', {
          organization,
          source
        });

        if (clientState) {
          setClientState({ ...clientState,
            state: 'skipped'
          });
        }
      },
      to: `/organizations/${organization.slug}/issues/`,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Skip Onboarding')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_eventWaiter__WEBPACK_IMPORTED_MODULE_11__["default"], {
      eventType: "error",
      onIssueReceived: handleFirstIssueReceived,
      project,
      organization,
      children: _ref3 => {
        let {
          firstIssue
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StatusWrapper, {
            children: [hasFirstEvent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconCheckmark, {
              isCircled: true,
              color: "green400"
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(WaitingIndicator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(AnimatedText, {
              errorReceived: hasFirstEvent,
              children: hasFirstEvent ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error Received') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Waiting for error')
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(OnboardingButtonBar, {
            gap: 2,
            children: [getSecondaryCta(), getPrimaryCta({
              firstIssue
            })]
          })]
        });
      }
    })]
  });
}
FirstEventFooter.displayName = "FirstEventFooter";

const OnboardingButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1mxao8k5"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";justify-self:end;margin-left:auto;" + ( true ? "" : 0));

const AnimatedText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_17__.motion.div,  true ? {
  shouldForwardProp: prop => prop !== 'errorReceived',
  target: "e1mxao8k4"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";color:", p => p.errorReceived ? p.theme.successText : p.theme.pink300, ";" + ( true ? "" : 0));

const indicatorAnimation = {
  initial: {
    opacity: 0,
    y: -10
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: 10
  }
};
AnimatedText.defaultProps = {
  variants: indicatorAnimation,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_12__["default"])()
};

const WaitingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_17__.motion.div,  true ? {
  target: "e1mxao8k3"
} : 0)(sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], ";background-color:", p => p.theme.pink300, ";" + ( true ? "" : 0));

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_12__["default"])()
};

const StatusWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_17__.motion.div,  true ? {
  target: "e1mxao8k2"
} : 0)("display:flex;align-items:center;font-size:", p => p.theme.fontSizeMedium, ";justify-content:center;@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

StatusWrapper.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    initial: {
      opacity: 0,
      y: -10
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_12__["default"])({
        when: 'beforeChildren',
        staggerChildren: 0.35
      })
    },
    exit: {
      opacity: 0,
      y: 10
    }
  }
};

const SkipOnboardingLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1mxao8k1"
} : 0)("margin:auto ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";white-space:nowrap;@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

const GridFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_genericFooter__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e1mxao8k0"
} : 0)("display:grid;grid-template-columns:1fr 1fr 1fr;@media (max-width: ", p => p.theme.breakpoints.small, "){display:flex;flex-direction:row;justify-content:end;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/fullIntroduction.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/fullIntroduction.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FullIntroduction)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _setupIntroduction__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./setupIntroduction */ "./app/views/onboarding/targetedOnboarding/components/setupIntroduction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function FullIntroduction(_ref) {
  var _platforms$find$name, _platforms$find;

  let {
    currentPlatform
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_setupIntroduction__WEBPACK_IMPORTED_MODULE_3__["default"], {
      stepHeaderText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Prepare the %s SDK', (_platforms$find$name = (_platforms$find = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_1__["default"].find(p => p.id === currentPlatform)) === null || _platforms$find === void 0 ? void 0 : _platforms$find.name) !== null && _platforms$find$name !== void 0 ? _platforms$find$name : ''),
      platform: currentPlatform
    })
  });
}
FullIntroduction.displayName = "FullIntroduction";

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/genericFooter.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/genericFooter.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");




const GenericFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.div,  true ? {
  target: "e1jz35jh0"
} : 0)("width:100%;position:fixed;bottom:0;left:0;height:72px;z-index:100;display:flex;background-color:", p => p.theme.background, ";justify-content:space-between;box-shadow:0px -4px 24px rgba(43, 34, 51, 0.08);" + ( true ? "" : 0));

GenericFooter.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    animate: {}
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_1__["default"])({
    staggerChildren: 0.2
  })
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GenericFooter);

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/projectSidebarSection.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/projectSidebarSection.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/pulsingIndicator */ "./app/styles/pulsingIndicator.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function ProjectSidebarSection(_ref) {
  let {
    projects,
    activeProject,
    selectProject,
    checkProjectHasFirstEvent,
    selectedPlatformToProjectIdMap
  } = _ref;

  const oneProject = (platformOnCreate, projectSlug) => {
    var _platforms$find$name, _platforms$find;

    const project = projects.find(p => p.slug === projectSlug);
    const platform = project ? project.platform || 'other' : platformOnCreate;
    const platformName = (_platforms$find$name = (_platforms$find = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_4__["default"].find(p => p.id === platform)) === null || _platforms$find === void 0 ? void 0 : _platforms$find.name) !== null && _platforms$find$name !== void 0 ? _platforms$find$name : '';
    const isActive = !!project && (activeProject === null || activeProject === void 0 ? void 0 : activeProject.id) === project.id;
    const errorReceived = !!project && checkProjectHasFirstEvent(project);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ProjectWrapper, {
      isActive: isActive,
      onClick: () => project && selectProject(project.id),
      disabled: !project,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledPlatformIcon, {
        platform: platform,
        size: 36
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MiddleWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NameWrapper, {
          children: platformName
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(SubHeader, {
          errorReceived: errorReceived,
          "data-test-id": "sidebar-error-indicator",
          children: !project ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Project Deleted') : errorReceived ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Error Received') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Waiting for error')
        })]
      }), errorReceived ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledIconCheckmark, {
        isCircled: true,
        color: "green400"
      }) : isActive && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(WaitingIndicator, {})]
    }, projectSlug);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Title, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Projects to Setup')
    }), Object.entries(selectedPlatformToProjectIdMap).map(_ref2 => {
      let [platformOnCreate, projectSlug] = _ref2;
      return oneProject(platformOnCreate, projectSlug);
    })]
  });
}

ProjectSidebarSection.displayName = "ProjectSidebarSection";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectSidebarSection);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e41atsl7"
} : 0)("font-size:12px;font-weight:600;text-transform:uppercase;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

const SubHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e41atsl6"
} : 0)("color:", p => p.errorReceived ? p.theme.successText : p.theme.pink300, ";" + ( true ? "" : 0));

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_3__.PlatformIcon,  true ? {
  target: "e41atsl5"
} : 0)( true ? "" : 0);

const ProjectWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e41atsl4"
} : 0)("display:flex;flex-direction:row;align-items:center;background-color:", p => p.isActive && p.theme.gray100, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";cursor:pointer;border-radius:4px;user-select:none;", p => p.disabled && `
    cursor: not-allowed;
    ${StyledPlatformIcon} {
      filter: grayscale(1);
    }
    ${SubHeader} {
      color: ${p.theme.gray400};
    }
    ${NameWrapper} {
      text-decoration-line: line-through;
    }
  `, ";" + ( true ? "" : 0));

const indicatorAnimation = {
  initial: {
    opacity: 0,
    y: -10
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: 10
  }
};

const WaitingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_11__.motion.div,  true ? {
  target: "e41atsl3"
} : 0)("margin:0 6px;flex-shrink:0;", sentry_styles_pulsingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], ";background-color:", p => p.theme.pink300, ";" + ( true ? "" : 0));

const StyledIconCheckmark = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconCheckmark,  true ? {
  target: "e41atsl2"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_9__["default"])()
};

const MiddleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e41atsl1"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";flex-grow:1;overflow:hidden;" + ( true ? "" : 0));

const NameWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e41atsl0"
} : 0)( true ? {
  name: "ucb1au",
  styles: "overflow:hidden;white-space:nowrap;text-overflow:ellipsis"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/setupIntroduction.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/setupIntroduction.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SetupIntroduction)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _components_stepHeading__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../components/stepHeading */ "./app/views/onboarding/components/stepHeading.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SetupIntroduction(_ref) {
  let {
    stepHeaderText,
    platform
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(TitleContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components_stepHeading__WEBPACK_IMPORTED_MODULE_3__["default"], {
      step: 2,
      children: stepHeaderText
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(IconWrapper, {
      variants: {
        initial: {
          opacity: 0,
          x: 20
        },
        animate: {
          opacity: 1,
          x: 0
        },
        exit: {
          opacity: 0
        }
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(platformicons__WEBPACK_IMPORTED_MODULE_1__.PlatformIcon, {
        size: 48,
        format: "lg",
        platform: platform
      })
    })]
  });
}
SetupIntroduction.displayName = "SetupIntroduction";

const TitleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "elfo8ua1"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";", _components_stepHeading__WEBPACK_IMPORTED_MODULE_3__["default"], "{margin-bottom:0;min-width:0;}" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_5__.motion.div,  true ? {
  target: "elfo8ua0"
} : 0)( true ? {
  name: "6p0xhm",
  styles: "margin-left:auto;flex-shrink:0"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/components/stepper.tsx":
/*!************************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/components/stepper.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const StepperContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eg87yl62"
} : 0)("display:flex;flex-direction:row;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";border-radius:4px;position:relative;overflow:hidden;" + ( true ? "" : 0));

const StepperIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eg87yl61"
} : 0)("height:8px;width:80px;background-color:", p => p.theme.progressBackground, ";cursor:", p => p.clickable ? 'pointer' : 'default', ";" + ( true ? "" : 0));

const StepperTransitionIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_3__.motion.span,  true ? {
  target: "eg87yl60"
} : 0)("height:8px;width:80px;background-color:", p => p.theme.progressBar, ";position:absolute;" + ( true ? "" : 0));

StepperTransitionIndicator.defaultProps = {
  layout: true,
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_2__["default"])({
    type: 'spring',
    stiffness: 175,
    damping: 18
  })
};

function Stepper(_ref) {
  let {
    currentStepIndex,
    numSteps,
    onClick,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StepperContainer, { ...props,
    children: Array(numSteps).fill(0).map((_, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StepperIndicator, {
      onClick: () => i < currentStepIndex && onClick(i),
      clickable: i < currentStepIndex,
      children: currentStepIndex === i && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StepperTransitionIndicator, {
        initial: false,
        layoutId: "animation"
      })
    }, i))
  });
}

Stepper.displayName = "Stepper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Stepper);

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/onboarding.tsx":
/*!****************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/onboarding.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/animation/use-animation.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_hook__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/hook */ "./app/components/hook.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_logoSentry__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/logoSentry */ "./app/components/logoSentry.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_redirect__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/redirect */ "./app/utils/redirect.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_onboarding_components_pageCorners__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/onboarding/components/pageCorners */ "./app/views/onboarding/components/pageCorners.tsx");
/* harmony import */ var _components_stepper__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./components/stepper */ "./app/views/onboarding/targetedOnboarding/components/stepper.tsx");
/* harmony import */ var _platform__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./platform */ "./app/views/onboarding/targetedOnboarding/platform.tsx");
/* harmony import */ var _setupDocs__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./setupDocs */ "./app/views/onboarding/targetedOnboarding/setupDocs.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _welcome__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./welcome */ "./app/views/onboarding/targetedOnboarding/welcome.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























function getOrganizationOnboardingSteps() {
  return [{
    id: 'welcome',
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Welcome'),
    Component: _welcome__WEBPACK_IMPORTED_MODULE_23__["default"],
    cornerVariant: 'top-right'
  }, {
    id: 'select-platform',
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Select platforms'),
    Component: _platform__WEBPACK_IMPORTED_MODULE_20__["default"],
    hasFooter: true,
    cornerVariant: 'top-left'
  }, {
    id: 'setup-docs',
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Install the Sentry SDK'),
    Component: _setupDocs__WEBPACK_IMPORTED_MODULE_21__["default"],
    hasFooter: true,
    cornerVariant: 'top-left'
  }];
}

function Onboarding(props) {
  const {
    organization,
    params: {
      step: stepId
    }
  } = props;
  const cornerVariantTimeoutRed = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(undefined);
  const [clientState, setClientState] = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.usePersistedOnboardingState)();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);
  const onboardingSteps = getOrganizationOnboardingSteps();
  const stepObj = onboardingSteps.find(_ref => {
    let {
      id
    } = _ref;
    return stepId === id;
  });
  const stepIndex = onboardingSteps.findIndex(_ref2 => {
    let {
      id
    } = _ref2;
    return stepId === id;
  });
  const cornerVariantControl = (0,framer_motion__WEBPACK_IMPORTED_MODULE_24__.useAnimation)();

  const updateCornerVariant = () => {
    // TODO: find better way to delay the corner animation
    window.clearTimeout(cornerVariantTimeoutRed.current);
    cornerVariantTimeoutRed.current = window.setTimeout(() => cornerVariantControl.start(stepIndex === 0 ? 'top-right' : 'top-left'), 1000);
  };

  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(updateCornerVariant, [stepIndex, cornerVariantControl]);
  const [containerHasFooter, setContainerHasFooter] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);

  const updateAnimationState = () => {
    var _stepObj$hasFooter;

    if (!stepObj) {
      return;
    }

    setContainerHasFooter((_stepObj$hasFooter = stepObj.hasFooter) !== null && _stepObj$hasFooter !== void 0 ? _stepObj$hasFooter : false);
    cornerVariantControl.start(stepObj.cornerVariant);
  };

  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(updateAnimationState, [stepObj, cornerVariantControl]);

  const goToStep = step => {
    if (!stepObj) {
      return;
    }

    if (step.cornerVariant !== stepObj.cornerVariant) {
      cornerVariantControl.start('none');
    }

    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/onboarding/${props.params.orgId}/${step.id}/`);
  };

  const goNextStep = step => {
    const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
    const nextStep = onboardingSteps[currentStepIndex + 1];

    if (step.cornerVariant !== nextStep.cornerVariant) {
      cornerVariantControl.start('none');
    }

    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/onboarding/${props.params.orgId}/${nextStep.id}/`);
  };

  const handleGoBack = () => {
    if (!stepObj) {
      return;
    }

    const previousStep = onboardingSteps[stepIndex - 1];

    if (stepObj.cornerVariant !== previousStep.cornerVariant) {
      cornerVariantControl.start('none');
    }

    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace(`/onboarding/${props.params.orgId}/${previousStep.id}/`);
  };

  const genSkipOnboardingLink = () => {
    const source = `targeted-onboarding-${stepId}`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(SkipOnboardingLink, {
      onClick: () => {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])('growth.onboarding_clicked_skip', {
          organization,
          source
        });

        if (clientState) {
          setClientState({ ...clientState,
            state: 'skipped'
          });
        }
      },
      to: `/organizations/${organization.slug}/issues/`,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Skip Onboarding')
    });
  };

  if (!stepObj || stepIndex === -1) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_redirect__WEBPACK_IMPORTED_MODULE_14__["default"], {
      to: `/onboarding/${organization.slug}/${onboardingSteps[0].id}/`
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(OnboardingWrapper, {
    "data-test-id": "targeted-onboarding",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__["default"], {
      title: stepObj.title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(Header, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(LogoSvg, {}), stepIndex !== -1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledStepper, {
        numSteps: onboardingSteps.length,
        currentStepIndex: stepIndex,
        onClick: i => goToStep(onboardingSteps[i])
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(UpsellWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_hook__WEBPACK_IMPORTED_MODULE_6__["default"], {
          name: "onboarding:targeted-onboarding-header",
          source: "targeted-onboarding"
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(Container, {
      hasFooter: containerHasFooter,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Back, {
        animate: stepIndex > 0 ? 'visible' : 'hidden',
        onClick: handleGoBack
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_26__.AnimatePresence, {
        exitBeforeEnter: true,
        onExitComplete: updateAnimationState,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(OnboardingStep, {
          "data-test-id": `onboarding-step-${stepObj.id}`,
          children: stepObj.Component && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(stepObj.Component, {
            active: true,
            "data-test-id": `onboarding-step-${stepObj.id}`,
            stepIndex: stepIndex,
            onComplete: () => stepObj && goNextStep(stepObj),
            orgId: props.params.orgId,
            organization: props.organization,
            search: props.location.search,
            genSkipOnboardingLink
          })
        }, stepObj.id)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AdaptivePageCorners, {
        animateVariant: cornerVariantControl
      })]
    })]
  });
}

Onboarding.displayName = "Onboarding";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebx9nou10"
} : 0)("flex-grow:1;display:flex;flex-direction:column;position:relative;background:", p => p.theme.background, ";padding:120px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3), ";width:100%;margin:0 auto;padding-bottom:", p => p.hasFooter && '72px', ";margin-bottom:", p => p.hasFooter && '72px', ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('header',  true ? {
  target: "ebx9nou9"
} : 0)("background:", p => p.theme.background, ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";position:sticky;height:80px;align-items:center;top:0;z-index:100;box-shadow:0 5px 10px rgba(0, 0, 0, 0.05);display:grid;grid-template-columns:1fr 1fr 1fr;justify-items:stretch;" + ( true ? "" : 0));

const LogoSvg = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_logoSentry__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ebx9nou8"
} : 0)("width:130px;height:30px;color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const OnboardingStep = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_27__.motion.div,  true ? {
  target: "ebx9nou7"
} : 0)( true ? {
  name: "1lh7kdz",
  styles: "flex-grow:1;display:flex;flex-direction:column"
} : 0);

OnboardingStep.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    animate: {}
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_15__["default"])({
    staggerChildren: 0.2
  })
};

const Sidebar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_27__.motion.div,  true ? {
  target: "ebx9nou6"
} : 0)( true ? {
  name: "1fggdak",
  styles: "width:850px;display:flex;flex-direction:column;align-items:center"
} : 0);

Sidebar.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    animate: {}
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_15__["default"])({
    staggerChildren: 0.2
  })
};

const AdaptivePageCorners = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_onboarding_components_pageCorners__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "ebx9nou5"
} : 0)("--corner-scale:1;@media (max-width: ", p => p.theme.breakpoints.small, "){--corner-scale:0.5;}" + ( true ? "" : 0));

const StyledStepper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_components_stepper__WEBPACK_IMPORTED_MODULE_19__["default"],  true ? {
  target: "ebx9nou4"
} : 0)("justify-self:center;@media (max-width: ", p => p.theme.breakpoints.medium, "){display:none;}" + ( true ? "" : 0));

const Back = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref3 => {
  let {
    className,
    animate,
    ...props
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_27__.motion.div, {
    className: className,
    animate: animate,
    transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_15__["default"])(),
    variants: {
      initial: {
        opacity: 0,
        visibility: 'hidden'
      },
      visible: {
        opacity: 1,
        visibility: 'visible',
        transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_15__["default"])({
          delay: 1
        })
      },
      hidden: {
        opacity: 0,
        transitionEnd: {
          visibility: 'hidden'
        }
      }
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], { ...props,
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconArrow, {
        direction: "left",
        size: "sm"
      }),
      priority: "link",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Back')
    })
  });
},  true ? {
  target: "ebx9nou3"
} : 0)("position:absolute;top:40px;left:20px;button{font-size:", p => p.theme.fontSizeSmall, ";}" + ( true ? "" : 0));

const SkipOnboardingLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ebx9nou2"
} : 0)("margin:auto ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";" + ( true ? "" : 0));

const UpsellWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebx9nou1"
} : 0)( true ? {
  name: "14crho2",
  styles: "grid-column:3;margin-left:auto"
} : 0);

const OnboardingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('main',  true ? {
  target: "ebx9nou0"
} : 0)( true ? {
  name: "1lh7kdz",
  styles: "flex-grow:1;display:flex;flex-direction:column"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__["default"])(Onboarding)));

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/platform.tsx":
/*!**************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/platform.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_multiPlatformPicker__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/multiPlatformPicker */ "./app/components/multiPlatformPicker.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var sentry_views_onboarding_components_stepHeading__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/onboarding/components/stepHeading */ "./app/views/onboarding/components/stepHeading.tsx");
/* harmony import */ var _components_createProjectsFooter__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./components/createProjectsFooter */ "./app/views/onboarding/targetedOnboarding/components/createProjectsFooter.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function OnboardingPlatform(props) {
  const [selectedPlatforms, setSelectedPlatforms] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);

  const addPlatform = platform => {
    setSelectedPlatforms([...selectedPlatforms, platform]);
  };

  const removePlatform = platform => {
    setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
  };

  const [clientState] = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.usePersistedOnboardingState)();
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (clientState) {
      setSelectedPlatforms(clientState.selectedPlatforms);
    }
  }, [clientState]);

  const clearPlatforms = () => setSelectedPlatforms([]);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_views_onboarding_components_stepHeading__WEBPACK_IMPORTED_MODULE_7__["default"], {
      step: props.stepIndex,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Select the platforms you want to monitor')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_11__.motion.div, {
      transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_6__["default"])(),
      variants: {
        initial: {
          y: 30,
          opacity: 0
        },
        animate: {
          y: 0,
          opacity: 1
        },
        exit: {
          opacity: 0
        }
      },
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.tct)(`Variety is the spice of application monitoring. Identify what’s broken
          faster by selecting all the platforms that support your application.
           [link:View the full list].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
            href: "https://docs.sentry.io/platforms/"
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_multiPlatformPicker__WEBPACK_IMPORTED_MODULE_4__["default"], {
        noAutoFilter: true,
        source: "targeted-onboarding",
        ...props,
        removePlatform: removePlatform,
        addPlatform: addPlatform,
        platforms: selectedPlatforms
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_components_createProjectsFooter__WEBPACK_IMPORTED_MODULE_8__["default"], { ...props,
      clearPlatforms: clearPlatforms,
      platforms: selectedPlatforms
    })]
  });
}

OnboardingPlatform.displayName = "OnboardingPlatform";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OnboardingPlatform);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "exbfvg30"
} : 0)( true ? {
  name: "1jpiqyc",
  styles: "max-width:850px;margin-left:auto;margin-right:auto;width:100%"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/setupDocs.tsx":
/*!***************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/setupDocs.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.url-search-params.js */ "../node_modules/core-js/modules/web.url-search-params.js");
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var prism_sentry_index_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! prism-sentry/index.css */ "../node_modules/prism-sentry/index.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _components_firstEventFooter__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./components/firstEventFooter */ "./app/views/onboarding/targetedOnboarding/components/firstEventFooter.tsx");
/* harmony import */ var _components_fullIntroduction__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./components/fullIntroduction */ "./app/views/onboarding/targetedOnboarding/components/fullIntroduction.tsx");
/* harmony import */ var _components_projectSidebarSection__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./components/projectSidebarSection */ "./app/views/onboarding/targetedOnboarding/components/projectSidebarSection.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */



const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

function ProjecDocs(props) {
  var _props$platformDocs3, _props$project, _ref, _props$platform, _props$project2;

  const testOnlyAlert = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
    type: "warning",
    children: "Platform documentation is not rendered in for tests in CI"
  });

  const missingExampleWarning = () => {
    var _props$platformDocs, _platforms$find;

    const missingExample = props.platformDocs && props.platformDocs.html.includes(INCOMPLETE_DOC_FLAG);

    if (!missingExample) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__["default"], {
      type: "warning",
      showIcon: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`Looks like this getting started example is still undergoing some
           work and doesn't include an example for triggering an event quite
           yet. If you have trouble sending your first event be sure to consult
           the [docsLink:full documentation] for [platform].`, {
        docsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
          href: (_props$platformDocs = props.platformDocs) === null || _props$platformDocs === void 0 ? void 0 : _props$platformDocs.link
        }),
        platform: (_platforms$find = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_13__["default"].find(p => p.id === props.platform)) === null || _platforms$find === void 0 ? void 0 : _platforms$find.name
      })
    });
  };

  (0,react__WEBPACK_IMPORTED_MODULE_5__.useEffect)(() => {
    var _props$platformDocs2;

    ((_props$platformDocs2 = props.platformDocs) === null || _props$platformDocs2 === void 0 ? void 0 : _props$platformDocs2.wizardSetup) && (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__.logExperiment)({
      key: 'OnboardingHighlightWizardExperiment',
      organization: props.organization
    });
  }, [props.organization, (_props$platformDocs3 = props.platformDocs) === null || _props$platformDocs3 === void 0 ? void 0 : _props$platformDocs3.wizardSetup]);
  const showWizardSetup = props.organization.experiments.OnboardingHighlightWizardExperiment;
  const [wizardSetupDetailsCollapsed, setWizardSetupDetailsCollapsed] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(true);
  const [interacted, setInteracted] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(false);
  const docs = props.platformDocs !== null && (showWizardSetup && props.platformDocs.wizardSetup ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(DocsWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(Content, {
      dangerouslySetInnerHTML: {
        __html: props.platformDocs.wizardSetup
      },
      onMouseDown: () => {
        !interacted && (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.onboarding_wizard_interacted', {
          organization: props.organization,
          project_id: props.project.id,
          platform: props.platform || 'unknown',
          wizard_instructions: true
        });
        setInteracted(true);
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
      priority: "link",
      onClick: () => {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.onboarding_wizard_clicked_more_details', {
          organization: props.organization,
          project_id: props.project.id,
          platform: props.platform || 'unknown'
        });
        setWizardSetupDetailsCollapsed(!wizardSetupDetailsCollapsed);
      },
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconChevron, {
        direction: wizardSetupDetailsCollapsed ? 'down' : 'up',
        style: {
          marginRight: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1)
        }
      }), wizardSetupDetailsCollapsed ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('More Details') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Less Details')]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_27__.AnimatePresence, {
      children: !wizardSetupDetailsCollapsed && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(AnimatedContentWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(Content, {
          dangerouslySetInnerHTML: {
            __html: props.platformDocs.html
          }
        }), missingExampleWarning()]
      })
    })]
  }, props.platformDocs.html) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(DocsWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(Content, {
      dangerouslySetInnerHTML: {
        __html: props.platformDocs.html
      },
      onMouseDown: () => {
        !interacted && (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.onboarding_wizard_interacted', {
          organization: props.organization,
          project_id: props.project.id,
          platform: props.platform || undefined,
          wizard_instructions: false
        });
        setInteracted(true);
      }
    }), missingExampleWarning()]
  }, props.platformDocs.html));

  const loadingError = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_12__["default"], {
    message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Failed to load documentation for the %s platform.', (_props$project = props.project) === null || _props$project === void 0 ? void 0 : _props$project.platform),
    onRetry: props.onRetry
  });

  const currentPlatform = (_ref = (_props$platform = props.platform) !== null && _props$platform !== void 0 ? _props$platform : (_props$project2 = props.project) === null || _props$project2 === void 0 ? void 0 : _props$project2.platform) !== null && _ref !== void 0 ? _ref : 'other';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_components_fullIntroduction__WEBPACK_IMPORTED_MODULE_23__["default"], {
      currentPlatform: currentPlatform,
      organization: props.organization
    }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_19__["default"])({
      value: !props.hasError ? docs : loadingError,
      fixed: testOnlyAlert
    })]
  });
}

ProjecDocs.displayName = "ProjecDocs";

function SetupDocs(_ref2) {
  var _ref3;

  let {
    organization,
    projects: rawProjects,
    search,
    loadingProjects
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_20__["default"])();
  const [clientState, setClientState] = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.usePersistedOnboardingState)();
  const selectedPlatforms = (clientState === null || clientState === void 0 ? void 0 : clientState.selectedPlatforms) || [];
  const platformToProjectIdMap = (clientState === null || clientState === void 0 ? void 0 : clientState.platformToProjectIdMap) || {}; // id is really slug here

  const projectSlugs = selectedPlatforms.map(platform => platformToProjectIdMap[platform]).filter(slug => slug !== undefined);
  const selectedProjectsSet = new Set(projectSlugs); // get projects in the order they appear in selectedPlatforms

  const projects = projectSlugs.map(slug => rawProjects.find(project => project.slug === slug)).filter(project => project !== undefined); // SDK instrumentation

  const [hasError, setHasError] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(false);
  const [platformDocs, setPlatformDocs] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(null);
  const [loadedPlatform, setLoadedPlatform] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(null); // store what projects have sent first event in state based project.firstEvent

  const [hasFirstEventMap, setHasFirstEventMap] = (0,react__WEBPACK_IMPORTED_MODULE_5__.useState)(projects.reduce((accum, project) => {
    accum[project.id] = !!project.firstEvent;
    return accum;
  }, {}));

  const checkProjectHasFirstEvent = project => {
    return !!hasFirstEventMap[project.id];
  };

  const {
    project_id: rawProjectId
  } = query_string__WEBPACK_IMPORTED_MODULE_7__.parse(search);
  const rawProjectIndex = projects.findIndex(p => p.id === rawProjectId);
  const firstProjectNoError = projects.findIndex(p => selectedProjectsSet.has(p.slug) && !checkProjectHasFirstEvent(p)); // Select a project based on search params. If non exist, use the first project without first event.

  const projectIndex = rawProjectIndex >= 0 ? rawProjectIndex : firstProjectNoError;
  const project = projects[projectIndex]; // find the next project that doesn't have a first event

  const nextProject = projects.find((p, i) => i > projectIndex && !checkProjectHasFirstEvent(p));
  (0,react__WEBPACK_IMPORTED_MODULE_5__.useEffect)(() => {
    // should not redirect if we don't have an active client state or projects aren't loaded
    if (!clientState || loadingProjects) {
      return;
    }

    if ( // If no projects remaining, then we can leave
    !project) {
      react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push('/');
    }
  });
  const currentPlatform = (_ref3 = loadedPlatform !== null && loadedPlatform !== void 0 ? loadedPlatform : project === null || project === void 0 ? void 0 : project.platform) !== null && _ref3 !== void 0 ? _ref3 : 'other';
  const fetchData = (0,react__WEBPACK_IMPORTED_MODULE_5__.useCallback)(async () => {
    // TODO: add better error handling logic
    if (!(project !== null && project !== void 0 && project.platform)) {
      return;
    }

    try {
      const loadedDocs = await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_8__.loadDocs)(api, organization.slug, project.slug, project.platform);
      setPlatformDocs(loadedDocs);
      setLoadedPlatform(project.platform);
      setHasError(false);
    } catch (error) {
      setHasError(error);
      throw error;
    }
  }, [project, api, organization]);
  (0,react__WEBPACK_IMPORTED_MODULE_5__.useEffect)(() => {
    fetchData();
  }, [fetchData]);

  if (!project) {
    return null;
  }

  const setNewProject = newProjectId => {
    const searchParams = new URLSearchParams({
      sub_step: 'project',
      project_id: newProjectId
    });
    react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push(`${window.location.pathname}?${searchParams}`);
    clientState && setClientState({ ...clientState,
      state: 'projects_selected',
      url: `setup-docs/?${searchParams}`
    });
  };

  const selectProject = newProjectId => {
    const matchedProject = projects.find(p => p.id === newProjectId);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.onboarding_clicked_project_in_sidebar', {
      organization,
      platform: (matchedProject === null || matchedProject === void 0 ? void 0 : matchedProject.platform) || 'unknown'
    });
    setNewProject(newProjectId);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(SidebarWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_components_projectSidebarSection__WEBPACK_IMPORTED_MODULE_24__["default"], {
          projects: projects,
          selectedPlatformToProjectIdMap: Object.fromEntries(selectedPlatforms.map(platform => [platform, platformToProjectIdMap[platform]])),
          activeProject: project,
          checkProjectHasFirstEvent,
          selectProject
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(MainContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(ProjecDocs, {
          platform: loadedPlatform,
          organization: organization,
          project: project,
          hasError: hasError,
          platformDocs: platformDocs,
          onRetry: fetchData
        })
      })]
    }), project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_components_firstEventFooter__WEBPACK_IMPORTED_MODULE_22__["default"], {
      project: project,
      organization: organization,
      isLast: !nextProject,
      hasFirstEvent: checkProjectHasFirstEvent(project),
      onClickSetupLater: () => {
        const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}`;
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('growth.onboarding_clicked_setup_platform_later', {
          organization,
          platform: currentPlatform,
          project_index: projectIndex
        });

        if (!project.platform || !clientState) {
          react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push(orgIssuesURL);
          return;
        } // if we have a next project, switch to that


        if (nextProject) {
          setNewProject(nextProject.id);
        } else {
          setClientState({ ...clientState,
            state: 'finished'
          });
          react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.push(orgIssuesURL);
        }
      },
      handleFirstIssueReceived: () => {
        const newHasFirstEventMap = { ...hasFirstEventMap,
          [project.id]: true
        };
        setHasFirstEventMap(newHasFirstEventMap);
      }
    })]
  });
}

SetupDocs.displayName = "SetupDocs";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_21__["default"])(SetupDocs));

const getAlertSelector = type => type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

const mapAlertStyles = (p, type) => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_28__.css)(getAlertSelector(type), "{", (0,sentry_components_alert__WEBPACK_IMPORTED_MODULE_9__.alertStyles)({
  theme: p.theme,
  type
}), ";display:block;}" + ( true ? "" : 0),  true ? "" : 0);

const AnimatedContentWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_29__.motion.div,  true ? {
  target: "eajqeu75"
} : 0)( true ? {
  name: "d3v9zr",
  styles: "overflow:hidden"
} : 0);

AnimatedContentWrapper.defaultProps = {
  initial: {
    height: 0
  },
  animate: {
    height: 'auto'
  },
  exit: {
    height: 0
  }
};

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_29__.motion.div,  true ? {
  target: "eajqeu74"
} : 0)("h1,h2,h3,h4,h5,h6,p{margin-bottom:18px;}div[data-language]{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";}code{font-size:87.5%;color:", p => p.theme.pink300, ";}pre code{color:inherit;font-size:inherit;white-space:pre;}h2{font-size:1.4em;}.alert h5{font-size:1em;margin-bottom:0.625rem;}.content-flush-bottom *:last-child{margin-bottom:0;}", p => Object.keys(p.theme.alert).map(type => mapAlertStyles(p, type)), ";" + ( true ? "" : 0));

const DocsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_29__.motion.div,  true ? {
  target: "eajqeu73"
} : 0)( true ? "" : 0);

DocsWrapper.defaultProps = {
  initial: {
    opacity: 0,
    y: 40
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0
  }
};

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eajqeu72"
} : 0)("display:flex;flex-direction:row;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";justify-content:center;" + ( true ? "" : 0));

const MainContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eajqeu71"
} : 0)( true ? {
  name: "nvkidi",
  styles: "max-width:850px;min-width:0;flex-grow:1"
} : 0); // the number icon will be space(2) + 30px to the left of the margin of center column
// so we need to offset the right margin by that much
// also hide the sidebar if the screen is too small


const SidebarWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eajqeu70"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), " calc(", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), " + 30px + ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(4), ") 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";@media (max-width: 1150px){display:none;}flex-basis:240px;flex-grow:0;flex-shrink:0;min-width:240px;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/onboarding/targetedOnboarding/welcome.tsx":
/*!*************************************************************!*\
  !*** ./app/views/onboarding/targetedOnboarding/welcome.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");
/* harmony import */ var sentry_images_spot_onboarding_install_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/onboarding-install.svg */ "./images/spot/onboarding-install.svg");
/* harmony import */ var sentry_images_spot_onboarding_setup_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/onboarding-setup.svg */ "./images/spot/onboarding-setup.svg");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/testableTransition */ "./app/utils/testableTransition.tsx");
/* harmony import */ var sentry_views_onboarding_components_fallingError__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/onboarding/components/fallingError */ "./app/views/onboarding/components/fallingError.tsx");
/* harmony import */ var sentry_views_onboarding_components_welcomeBackground__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/onboarding/components/welcomeBackground */ "./app/views/onboarding/components/welcomeBackground.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./utils */ "./app/views/onboarding/targetedOnboarding/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const fadeAway = {
  variants: {
    initial: {
      opacity: 0
    },
    animate: {
      opacity: 1,
      filter: 'blur(0px)'
    },
    exit: {
      opacity: 0,
      filter: 'blur(1px)'
    }
  },
  transition: (0,sentry_utils_testableTransition__WEBPACK_IMPORTED_MODULE_11__["default"])({
    duration: 0.8
  })
};

function InnerAction(_ref) {
  let {
    title,
    subText,
    cta,
    src
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActionImage, {
      src: src
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TextWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActionTitle, {
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SubText, {
        children: subText
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ButtonWrapper, {
      children: cta
    })]
  });
}

InnerAction.displayName = "InnerAction";

function TargetedOnboardingWelcome(_ref2) {
  let {
    organization,
    ...props
  } = _ref2;
  const source = 'targeted_onboarding';
  const [clientState, setClientState] = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.usePersistedOnboardingState)();
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('growth.onboarding_start_onboarding', {
      organization,
      source
    });
  });

  const onComplete = () => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('growth.onboarding_clicked_instrument_app', {
      organization,
      source
    });

    if (clientState) {
      setClientState({ ...clientState,
        url: 'select-platform/',
        state: 'started'
      });
    }

    props.onComplete();
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_onboarding_components_fallingError__WEBPACK_IMPORTED_MODULE_12__["default"], {
    children: _ref3 => {
      let {
        fallingError,
        fallCount,
        isFalling
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Wrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_onboarding_components_welcomeBackground__WEBPACK_IMPORTED_MODULE_13__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(framer_motion__WEBPACK_IMPORTED_MODULE_16__.motion.h1, { ...fadeAway,
          style: {
            marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5)
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Welcome to Sentry')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SubHeaderText, {
          style: {
            marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4)
          },
          ...fadeAway,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Your code is probably broken. Maybe not. Find out for sure. Get started below.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActionItem, { ...fadeAway,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InnerAction, {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Install Sentry'),
            subText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Select your languages or frameworks and install the SDKs to start tracking issues'),
            src: sentry_images_spot_onboarding_install_svg__WEBPACK_IMPORTED_MODULE_3__,
            cta: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ButtonWithFill, {
                onClick: () => {
                  // triggerFall();
                  onComplete();
                },
                priority: "primary",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Start')
              }), (fallCount === 0 || isFalling) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(PositionedFallingError, {
                children: fallingError
              })]
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActionItem, { ...fadeAway,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(InnerAction, {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Set up my team'),
            subText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Invite [friends] coworkers. You shouldn’t have to fix what you didn’t break', {
              friends: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Strike, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('friends')
              })
            }),
            src: sentry_images_spot_onboarding_setup_svg__WEBPACK_IMPORTED_MODULE_4__,
            cta: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ButtonWithFill, {
              onClick: () => {
                (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openInviteMembersModal)({
                  source
                });
              },
              priority: "primary",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Invite Team')
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_16__.motion.p, {
          style: {
            margin: 0
          },
          ...fadeAway,
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)("Gee, I've used Sentry before."), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("br", {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"], {
            onClick: () => {
              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_10__["default"])('growth.onboarding_clicked_skip', {
                organization,
                source
              });

              if (clientState) {
                setClientState({ ...clientState,
                  state: 'skipped'
                });
              }
            },
            to: `/organizations/${organization.slug}/issues/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Skip onboarding.')
          })]
        })]
      });
    }
  });
}

TargetedOnboardingWelcome.displayName = "TargetedOnboardingWelcome";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TargetedOnboardingWelcome);

const PositionedFallingError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1r7molb10"
} : 0)( true ? {
  name: "utvjik",
  styles: "display:block;position:absolute;right:0px;top:30px"
} : 0);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_16__.motion.div,  true ? {
  target: "e1r7molb9"
} : 0)( true ? {
  name: "4nxbxt",
  styles: "position:relative;margin-top:auto;margin-bottom:auto;max-width:400px;display:flex;flex-direction:column;align-items:center;text-align:center;margin-left:auto;margin-right:auto;h1{font-size:42px;}"
} : 0);

const ActionItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_16__.motion.div,  true ? {
  target: "e1r7molb8"
} : 0)("min-height:120px;border-radius:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";justify-content:space-around;border:1px solid ", p => p.theme.gray200, ";@media (min-width: ", p => p.theme.breakpoints.small, "){display:grid;grid-template-columns:125px auto 125px;width:680px;align-items:center;}@media (max-width: ", p => p.theme.breakpoints.small, "){display:flex;flex-direction:column;}" + ( true ? "" : 0));

const TextWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r7molb7"
} : 0)("text-align:left;margin:auto ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";min-height:70px;@media (max-width: ", p => p.theme.breakpoints.small, "){text-align:center;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";}" + ( true ? "" : 0));

const Strike = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1r7molb6"
} : 0)( true ? {
  name: "1rcj98u",
  styles: "text-decoration:line-through"
} : 0);

const ActionTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h5',  true ? {
  target: "e1r7molb5"
} : 0)("font-weight:900;margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";color:", p => p.theme.gray400, ";" + ( true ? "" : 0));

const SubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1r7molb4"
} : 0)("font-weight:400;color:", p => p.theme.gray400, ";" + ( true ? "" : 0));

const SubHeaderText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_16__.motion.h6,  true ? {
  target: "e1r7molb3"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const ButtonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r7molb2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";position:relative;" + ( true ? "" : 0));

const ActionImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('img',  true ? {
  target: "e1r7molb1"
} : 0)( true ? {
  name: "1hgqtge",
  styles: "height:100px"
} : 0);

const ButtonWithFill = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1r7molb0"
} : 0)( true ? {
  name: "1ayuow2",
  styles: "width:100%;position:relative;z-index:1"
} : 0);

/***/ }),

/***/ "./images/spot/onboarding-install.svg":
/*!********************************************!*\
  !*** ./images/spot/onboarding-install.svg ***!
  \********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAuNSIgaGVpZ2h0PSIxNTUuNSIgdmlld0JveD0iMCAwIDEzNS41IDExNi40Ij4KICA8cGF0aCBmaWxsPSIjZWJiNDMyIiBkPSJNOTYgMTA0aDZsLTIgMTEtNyAxIDMtMTJ6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0ibTQgMzIgNzYgNSAxOCA0OEgyM2wtMS0xTDQgMzJ6Ii8+CiAgPHBhdGggZD0iTTkxIDUzYTQgNCAwIDAgMCAyIDVsMTUtMTAtMy01WiIgZmlsbD0iI2ViYjQzMiIvPgogIDxwYXRoIGQ9Im03MCA4NSAyOSAxMC0yIDloNmwyLTEwYTEgMSAwIDAgMC0xLTJsLTMwLTdabTI0LTI2IDE4IDE2YTEgMSAwIDAgMCAyLTFsMS0yOS01IDQtMSAxIDEgMTctMTQtMTAtMS0xLTIgMlptLTUtOCAyIDItMiAyLTEtMSAxLTN6IiBmaWxsPSIjZWRlOWYxIi8+CiAgPHBhdGggZD0ibTExNSAxNyA1LTUgMSAxMyA5IDEyLTggNC0xMiA5cy01LTItNS02bDMtNC0yLTEgMS0yIDEwLTVhMTQ4IDE0OCAwIDAgMS0yLTE1WiIgZmlsbD0iI2IyOWRkMiIvPgogIDxwYXRoIGQ9Ik0xMDQgMzRhOCA4IDAgMCAxIDEtNmw5IDQtNyAzWk01MSA2NGwtMy0xIDE3LTMwaDJMNTEgNjR6TTIxIDgybDEgMnYxaDFsLTMgOSAxMSAxIDE1LTI5IDQgMS0xMyAyNi0yIDIySDZhMTYgMTYgMCAwIDEgMS01bDE0LTI4IiBmaWxsPSIjYjI5ZGQyIi8+CiAgPHBhdGggZD0ibTUxIDQxIDQtMS00IDRaIiBmaWxsPSIjZTE1NTdhIi8+CiAgPHBhdGggZD0ibTI3IDEzIDYtMTFoMTVsMiAxNGgydi00bDEyIDRjMyAyIDcgMTIgNyAxM3MwIDQtMiA0bC0xOS00LTktNi0xMy0xMFpNNyAyMGwzNSA1LTQtMy0xMS04LTE2IDItNCA0Wk0yIDMxbDMgN3MtNCAxLTUtMSAyLTYgMi02WiIgZmlsbD0iI2ViYjQzMiIvPgogIDxwYXRoIGQ9Ik0xMyAyOWMtMSAxLTMgMC00LTF2LTRjMS0xIDIgMCAzIDFsMSA0WiIgZmlsbD0iI2UxNTU3YSIvPgogIDxwYXRoIGQ9Im0yMyAzMC00LTF2LTRsMyAxIDEgNFoiIGZpbGw9IiNlYmI0MzIiLz4KICA8cGF0aCBkPSJtMzIgMzEtMy0xLTEtNCA0IDF2NFoiIGZpbGw9IiNmNTg0NTIiLz4KICA8cGF0aCBkPSJNOTMgNThhNCA0IDAgMCAxLTItNUw1MSA4NWgyWiIgZmlsbD0iI2VkZTlmMSIvPgogIDxwYXRoIGQ9Ik0xMDAgMzQgNTkgNjYgMTIgNTVsMSAxIDQ3IDE0IDMzLTI0IDIgMmExMyAxMyAwIDAgMCAzLTNsMiA0IDQtMmExIDEgMCAwIDAgMC0xbC0xLTEgNS01YTEgMSAwIDAgMCAwLTFoLTJsMS0zYTEgMSAwIDAgMCAwLTFjLTIgMC02LTItNy0xWiIgZmlsbD0iI2VkZTlmMSIvPgogIDxwYXRoIGQ9Ik03MCAzNGMtMyAwLTIwLTMtMjMtNUwyOCAxNGE0IDQgMCAwIDAtMiAwbC0xMCAxYTQgNCAwIDAgMC0zIDFsLTMgM2ExIDEgMCAxIDEgMC0xbDItM2E1IDUgMCAwIDEgNC0xbDktMmE1IDUgMCAwIDEgNCAxYzQgNCAxNiAxNCAxOSAxNSAzIDIgMTkgNSAyMiA1YTMgMyAwIDAgMCAzLTJsLTEtNWMtMi00LTYtMTAtOS0xMnMtOC0yLTEyLTJ2LTFjNCAwIDkgMSAxMyAzczcgOCA5IDExdjdhNCA0IDAgMCAxLTMgMloiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJNNTMgMjAgNTAgNmE0IDQgMCAwIDEtNCAwYy02IDAtMTEtNS0xMS01VjBzNiA1IDEyIDVhMyAzIDAgMCAwIDIgMCAyIDIgMCAwIDAgMC0xVjNhMSAxIDAgMCAxIDEgMGw0IDE2LTEgMVoiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJNMzAgMTBzOCA3IDIyIDVsMSAzdjJzLTUgMy0yMC0zbC01LTNaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0ibTQ4IDIxLTE1LTNoLTFsLTQtNCAyLTRhMSAxIDAgMCAxIDEgMHM3IDYgMjEgNWExIDEgMCAwIDEgMSAwbDEgNHYxbC02IDFabS0xNS00YzEzIDQgMTggMyAyMCAybC0xLTNjLTEyIDEtMjAtNC0yMi01bC0xIDNaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTI5IDE0YTEgMSAwIDAgMS0xIDBsNi0xM2ExIDEgMCAwIDEgMS0xczgtMSAxMyAxYTEgMSAwIDEgMSAwIDFjLTUtMi0xMS0xLTEzLTFsLTYgMTNabTIyIDM3YTEgMSAwIDAgMS0xIDBWNDBhMSAxIDAgMCAxIDEgMHYxMVpNMzYgMzdsMTEgNm0wIDEtMTEtN2ExIDEgMCAwIDEgMC0xbDExIDdhMSAxIDAgMCAxIDAgMVptLTEzLTIgMTEgNW0wIDAtMTEtNWExIDEgMCAwIDEgMC0xbDExIDVhMSAxIDAgMCAxIDAgMVptNDIgMTBhMSAxIDAgMCAxIDAtMWwtMi00YTEgMSAwIDAgMSAxIDBsMSA0YTEgMSAwIDAgMSAwIDFaTTUgNDBsLTQtM2ExMSAxMSAwIDAgMSAyLTQgMTAgMTAgMCAwIDAtMSA0bDMgMmExIDEgMCAwIDEgMSAwbC0xIDFabTk2IDYtMi0yLTEgMWExIDEgMCAxIDEtMSAwbDEtMmgxbDIgMmExIDEgMCAwIDEgMCAxWm0yLTEtMy01YTEgMSAwIDAgMSAxLTFsMiAyYTEgMSAwIDAgMSAxIDAgMSAxIDAgMCAxLTEgMWwtMS0xIDIgM2ExIDEgMCAwIDEtMSAxWm0zLTYtNS0yYTEgMSAwIDAgMSAxLTFsNCAyYTEgMSAwIDAgMSAxIDEgMSAxIDAgMCAxLTEgMFoiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJNNjAgNzEgMTIgNTdhMSAxIDAgMCAxIDAtMWwtMS0xIDEtMSA0NyAxMSA0MS0zMWMxLTEgNCAwIDcgMWExIDEgMCAwIDEgMSAxbC0xIDIgMSAxYTEgMSAwIDAgMSAwIDEgMSAxIDAgMCAxIDAgMWwtNCA0djFhMSAxIDAgMCAxIDAgMWwtNCAyYTEgMSAwIDAgMS0xIDBsLTEtMy0zIDJhMyAzIDAgMCAxLTItMUw2MCA3MVpNMTMgNTZsNDcgMTQgMzMtMjRoMWwxIDEgMi0yaDFsMiAzIDMtMnYtMmw0LTQtMS0xdi0xbDEtMmMtNC0xLTYtMi03LTFMNTkgNjYgMTMgNTVabTg3LTIyWiIgZmlsbD0iIzJmMWQ0YSIvPgogIDxwYXRoIGQ9Ik01MSA0NWExIDEgMCAwIDEtMS0xYzMtMSA1LTMgNS00YTMgMyAwIDAgMC0yIDEgMSAxIDAgMCAxLTEtMWwzLTFhMSAxIDAgMCAxIDEgMWMwIDItNCA0LTUgNVptLTE1IDU2YTIgMiAwIDAgMS0yLTFoMWEyIDIgMCAwIDEtMS0xIDIgMiAwIDAgMSAxLTEgMiAyIDAgMCAxIDIgMCAyIDIgMCAwIDEgMCAxIDIgMiAwIDAgMS0xIDJabTAtMmgtMWExIDEgMCAwIDAgMCAxIDEgMSAwIDAgMCAxIDAgMSAxIDAgMCAwIDAtMVptLTE5LTZhMSAxIDAgMCAxIDAtMWwzLTZhMSAxIDAgMSAxIDEgMGwtMyA3YTEgMSAwIDAgMS0xIDBabTUgMGExIDEgMCAwIDEtMS0xbDItNWExIDEgMCAwIDEgMSAxbC0yIDVaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTMwIDEwM2gtMWExMzkgMTM5IDAgMCAwLTE5LTF2LTFsNi05IDE4IDFhMSAxIDAgMCAxIDAgMSA0MiA0MiAwIDAgMC00IDlabS0xOS0yYTE0NCAxNDQgMCAwIDEgMTggMSA0MiA0MiAwIDAgMSA0LThsLTE3LTFaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTkgMTE0YTEgMSAwIDAgMS0xIDAgMTMgMTMgMCAwIDEgMS01bDQtOCAxIDEtNCA4YTEzIDEzIDAgMCAwLTEgNFptMjEgMGExIDEgMCAwIDEtMSAwbDItMTFhMSAxIDAgMSAxIDEgMGwtMiAxMVptNyAyYTEgMSAwIDAgMS0xLTF2LTExYTEgMSAwIDAgMSAxIDB2MTFhMSAxIDAgMCAxIDAgMVptLTYtMjNhMSAxIDAgMCAxIDAtMWwxLTdhMSAxIDAgMCAxIDEgMGwtMiA3djFabTI4IDdoLTFsLTEtN2gtNmExIDEgMCAwIDEgMC0xbC04LTdhMSAxIDAgMSAxIDEgMGw4IDdoNmwxIDV2LTZoMWw2LTV2LTFhMSAxIDAgMCAxIDEgMHYybC03IDUtMSA4WiIgZmlsbD0iIzJmMWQ0YSIvPgogIDxwYXRoIGQ9Im03MyAxMTYtMS0xLTYtMjlhMSAxIDAgMCAxIDEgMGw2IDI5YTEgMSAwIDAgMSAwIDFaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0ibTcwIDEwMyAyLTV2LTRsLTMgMmExIDEgMCAwIDEtMS0xbDQtMnYxbDEgNC0yIDVhMSAxIDAgMCAxLTEgMFptMjQgMTMgNS0yMC0zMC0xMHYtMWExIDEgMCAwIDEgMSAwbDI5IDEwYTEgMSAwIDAgMSAxIDBsLTUgMjFhMSAxIDAgMCAxLTEgMFoiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJNMTAxIDExNmExIDEgMCAwIDEgMC0xbDQtMjFhMSAxIDAgMCAwLTEtMWwtMzEtN3YtMWExIDEgMCAwIDEgMSAwbDMwIDdhMiAyIDAgMCAxIDEgMmwtNCAyMXYxWm0tMzgtNWExIDEgMCAwIDEtMSAwbC0xLTEwIDItOGExIDEgMCAxIDEgMSAwbC0yIDggMSAxMFptNCAxYTEgMSAwIDAgMS0xIDBsLTEtMTJhMSAxIDAgMCAxIDAtMWgxbDEgMTJhMSAxIDAgMCAxIDAgMVptLTEyLTFhMSAxIDAgMCAxIDAtMXYtMTBhMSAxIDAgMCAxIDEgMHYxMGExIDEgMCAwIDEtMSAxWm0tNyAzYTEgMSAwIDAgMSAwLTF2LTZoMXY2bC0xIDFabS0zLTExYTEgMSAwIDAgMS0xIDAgMSAxIDAgMCAxIDAtMWwyLTR2LTdhMSAxIDAgMCAxIDEtMXY4YTEgMSAwIDAgMSAwIDFsLTIgNFptLTUgOWExIDEgMCAwIDEgMC0xbDEtMTEgMi0zaDFsLTIgMy0xIDExYTEgMSAwIDAgMS0xIDFabTExLTExaC0xbDEtOWExIDEgMCAwIDEgMSAwbC0xIDlabTctMTAtNi0xLTQtM3YtMWExIDEgMCAwIDEgMSAwbDMgMyA1IDEgNC0zYTEgMSAwIDAgMSAxIDFsLTQgM1ptLTUtNWgtMmExIDEgMCAwIDEtMS0xIDEgMSAwIDAgMSAxIDBsNDctMzlhMSAxIDAgMCAxIDEgMUw1MiA4NWgxbDU1LTM4YTEgMSAwIDEgMSAwIDFMNTQgODZoLTFaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTEwMyAxMDVoLTZhMSAxIDAgMCAxIDAtMWg2YTEgMSAwIDAgMSAxIDAgMSAxIDAgMCAxLTEgMVptMCAyaC02YTEgMSAwIDAgMSAwLTFoNmExIDEgMCAwIDEgMCAxWm0tNiA1di0zYTEgMSAwIDAgMSAxLTEgMSAxIDAgMCAxIDAgMXYybC0xIDFabTIgMyAxLTd2LTFhMSAxIDAgMCAxIDEgMWwtMSA3YTEgMSAwIDAgMS0xIDBabTExLTY2YTEgMSAwIDAgMS0xIDBjLTQtMy00LTYtNC03YTEgMSAwIDEgMSAxIDBjMCAxIDAgNCA0IDZsMTEtOCAxMC01IDMtMy0xLTEgMS0yLTEtMWExIDEgMCAwIDEgMC0xbDEtMS0yLTIgMS0zLTItMSAxLTItMi0xaC0xbDEtM2gtMnYtM2gtMlY5YTEzIDEzIDAgMCAwLTQgMGwtNSA1YzAgMSAwIDEwIDIgMTVhMSAxIDAgMCAxLTEgMWwtMTEgNmExIDEgMCAxIDEgMC0xbDExLTZjLTItNi0yLTE1LTItMTVhMSAxIDAgMCAxIDAtMWw1LTRhMSAxIDAgMCAxIDEtMSAxNSAxNSAwIDAgMSA1IDB2MmgyYTEgMSAwIDAgMSAxIDFsLTEgMmgyYTEgMSAwIDAgMSAwIDF2MmwyIDFoMWExIDEgMCAwIDEgMCAxbC0yIDJoMmExIDEgMCAwIDEgMCAxbC0xIDMgMiAxYTEgMSAwIDAgMSAxIDEgMSAxIDAgMCAxLTEgMGwtMSAyaDF2MWwtMSAyIDEgMWExIDEgMCAwIDEgMSAwIDEgMSAwIDAgMS0xIDFsLTMgMy0xMCA0LTEyIDlaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTEzMSAzNmgtMXMtNi04LTgtMTQtMS0xMy0xLTEzYTEgMSAwIDEgMSAxIDBzLTEgOCAxIDEzbDggMTNhMSAxIDAgMCAxIDAgMVoiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJtMTI0IDIxIDEtMmgtMmExIDEgMCAwIDEgMC0xbDEtMWgtMWExIDEgMCAwIDEtMS0xIDEgMSAwIDAgMSAxIDBoMmExIDEgMCAwIDEgMSAwdjFsLTIgMSAyIDEtMSAyYTEgMSAwIDAgMS0xIDBabTMgNmExIDEgMCAwIDEtMS0xbDEtMWgtMWExIDEgMCAwIDEtMS0xIDEgMSAwIDAgMSAxIDBoMmwtMSAydjFabTIgMTBjLTEtMS03LTgtOS0xM2E5NiA5NiAwIDAgMS0xLTEzIDEgMSAwIDAgMSAxIDAgOTYgOTYgMCAwIDAgMSAxMmMxIDUgOCAxMyA4IDEzdjFaIiBmaWxsPSIjMmYxZDRhIi8+CiAgPHBhdGggZD0iTTEyMiA0MGExIDEgMCAwIDEtMSAwdi00YTIgMiAwIDAgMSAxLTFsNC0zYTEgMSAwIDAgMSAwIDFsLTMgMmExIDEgMCAwIDAtMSAxdjRabS0xNy01aC0xcy0xLTQgMy04bDkgM2ExIDEgMCAwIDEtMSAxbC04LTMtMiA3Wm02IDIzYTEgMSAwIDAgMSAwLTFWMzVhMSAxIDAgMCAxIDAtMSAxIDEgMCAwIDEgMSAxdjIyYTEgMSAwIDAgMS0xIDFabS0zLTRoLTJ2LTFsMi01aDJhMSAxIDAgMCAxIDAgMWwtMiA1Wm0tMS0xaDFsMS00Wm0tMTQgNWE1IDUgMCAwIDEtMy01IDEgMSAwIDAgMSAxIDAgNCA0IDAgMCAwIDIgNCAxIDEgMCAwIDEgMCAxWm0yLTFhNCA0IDAgMCAxLTItNiAxIDEgMCAxIDEgMSAwIDMgMyAwIDAgMCAyIDVsLTEgMVoiIGZpbGw9IiMyZjFkNGEiLz4KICA8cGF0aCBkPSJtOTUgNTIgMi0yYTEgMSAwIDEgMSAxIDFsLTIgMWExIDEgMCAwIDEtMSAwWm0xIDJhMSAxIDAgMCAxLTEtMWw5LTV2MWwtOCA1Wk02NiAzM2wtMTgtNC02LTUtNDAtNWExIDEgMCAwIDAtMSAybDMgMTEgNjAgNVptLTUzLTRjLTEgMS0zIDAtNC0xdi00YzEtMSAyIDAgMyAxbDEgNFptMTAgMS00LTF2LTRsMyAxIDEgNFptOSAxLTMtMS0xLTQgNCAxdjRabTM2IDItMSA0IDEzIDEtMy04YTIgMiAwIDAgMC0xLTJoLTJjMCAzLTEgNS00IDVhMTUgMTUgMCAwIDEtMSAwWm0tMSAwWiIgZmlsbD0iIzJmMWQ0YSIvPgogIDxjaXJjbGUgY3g9IjY3LjMiIGN5PSIzMi44IiByPSIuNSIgZmlsbD0iIzJmMWQ0YSIvPgogIDxwYXRoIGQ9Im01MyA2NS00LTF2LTFsMTYtMzFhMSAxIDAgMCAxIDEgMGgzdjFMNTMgNjVabS0zLTIgMiAxIDE2LTMxaC0yWm0tMTIgNDAtNi0xYTEgMSAwIDAgMSAwLTFsMi05YTMgMyAwIDAgMSAwLTFsMTMtMjVhMSAxIDAgMCAxIDEgMGwzIDFhMSAxIDAgMCAxIDAgMUw0MCA5MWEzIDMgMCAwIDAgMCAxbC0yIDExWm0tNS0yIDQgMSAyLTEwYTQgNCAwIDAgMSAwLTJsMTEtMjItMi0xLTEzIDI0YTMgMyAwIDAgMCAwIDFabTgwLTI2YTEgMSAwIDAgMS0xIDBMOTQgNjBhMSAxIDAgMCAxIDAtMWgxbDE4IDE1IDItMjl2LTFhMSAxIDAgMCAxIDEgMWwtMiAyOWExIDEgMCAwIDEtMSAxWk04OSA1NWExIDEgMCAwIDEtMSAwdi0xYTEgMSAwIDAgMS0xIDBoMmExIDEgMCAwIDEgMCAxWm0yLTItMy0xYTEgMSAwIDAgMSAxLTFsMiAyWiIgZmlsbD0iIzJmMWQ0YSIvPgogIDxwYXRoIGQ9Im0xMTAgNjgtMS0xLTEzLTlhMSAxIDAgMCAxIDEtMWwxMiA5VjUwaDF2MTdhMSAxIDAgMCAxIDAgMVptOS0yOWgtMXYtMWgxbC0xLTFhMyAzIDAgMCAwLTEgMXYxbC0xLTFoLTFhNSA1IDAgMCAxIDItMyA2IDYgMCAwIDAtMiAzaC0zdi0xbDMtNWgxbDEgMS0xIDF2LTFsLTMgNGgxYTYgNiAwIDAgMSAzLTNsMSAxdjFhNCA0IDAgMCAwLTIgMmgxYTMgMyAwIDAgMSAxLTJsMiAydjFoLTFaTTQ3IDVhMSAxIDAgMCAxLTEtMWwtMS0xaC00YTEgMSAwIDAgMSAwLTFoNWwxIDJhMSAxIDAgMCAxIDAgMVptNTAgODFIMjNhMiAyIDAgMCAxLTItMkw0IDMzIDAgMjFhMSAxIDAgMCAxIDAtMSAyIDIgMCAwIDEgMi0xbDQwIDUgNiA0YzMgMiAxOSA1IDIyIDVhMyAzIDAgMCAwIDItMSA0IDQgMCAwIDAgMS00aDNhMiAyIDAgMCAxIDEgMWw3IDE4YTEgMSAwIDAgMS0xIDBsLTctMTdhMSAxIDAgMCAwLTEtMWgtMWE1IDUgMCAwIDEtMSAzIDQgNCAwIDAgMS0zIDJjLTMgMC0yMC0zLTIzLTVsLTUtNC00MC01SDF2MWw0IDExIDE3IDUyYTEgMSAwIDAgMCAxIDFoNzR2LTFsLTgtMjFhMSAxIDAgMCAxIDAtMSAxIDEgMCAwIDEgMSAwbDggMjJhMSAxIDAgMCAxIDAgMSAxIDEgMCAwIDEtMSAxWiIgZmlsbD0iIzJmMWQ0YSIvPgo8L3N2Zz4K";

/***/ }),

/***/ "./images/spot/onboarding-setup.svg":
/*!******************************************!*\
  !*** ./images/spot/onboarding-setup.svg ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/onboarding-setup.83b8010970cff90ff9cc.svg";

/***/ }),

/***/ "../node_modules/framer-motion/dist/es/animation/animation-controls.mjs":
/*!******************************************************************************!*\
  !*** ../node_modules/framer-motion/dist/es/animation/animation-controls.mjs ***!
  \******************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "animationControls": () => (/* binding */ animationControls)
/* harmony export */ });
/* harmony import */ var tslib__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! tslib */ "../node_modules/tslib/tslib.es6.js");
/* harmony import */ var hey_listen__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! hey-listen */ "../node_modules/hey-listen/dist/hey-listen.es.js");
/* harmony import */ var _render_utils_animation_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../render/utils/animation.mjs */ "../node_modules/framer-motion/dist/es/render/utils/animation.mjs");
/* harmony import */ var _render_utils_setters_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../render/utils/setters.mjs */ "../node_modules/framer-motion/dist/es/render/utils/setters.mjs");





/**
 * @public
 */
function animationControls() {
    /**
     * Track whether the host component has mounted.
     */
    var hasMounted = false;
    /**
     * Pending animations that are started before a component is mounted.
     * TODO: Remove this as animations should only run in effects
     */
    var pendingAnimations = [];
    /**
     * A collection of linked component animation controls.
     */
    var subscribers = new Set();
    var controls = {
        subscribe: function (visualElement) {
            subscribers.add(visualElement);
            return function () { return void subscribers.delete(visualElement); };
        },
        start: function (definition, transitionOverride) {
            /**
             * TODO: We only perform this hasMounted check because in Framer we used to
             * encourage the ability to start an animation within the render phase. This
             * isn't behaviour concurrent-safe so when we make Framer concurrent-safe
             * we can ditch this.
             */
            if (hasMounted) {
                var animations_1 = [];
                subscribers.forEach(function (visualElement) {
                    animations_1.push((0,_render_utils_animation_mjs__WEBPACK_IMPORTED_MODULE_1__.animateVisualElement)(visualElement, definition, {
                        transitionOverride: transitionOverride,
                    }));
                });
                return Promise.all(animations_1);
            }
            else {
                return new Promise(function (resolve) {
                    pendingAnimations.push({
                        animation: [definition, transitionOverride],
                        resolve: resolve,
                    });
                });
            }
        },
        set: function (definition) {
            (0,hey_listen__WEBPACK_IMPORTED_MODULE_0__.invariant)(hasMounted, "controls.set() should only be called after a component has mounted. Consider calling within a useEffect hook.");
            return subscribers.forEach(function (visualElement) {
                (0,_render_utils_setters_mjs__WEBPACK_IMPORTED_MODULE_2__.setValues)(visualElement, definition);
            });
        },
        stop: function () {
            subscribers.forEach(function (visualElement) {
                (0,_render_utils_animation_mjs__WEBPACK_IMPORTED_MODULE_1__.stopAnimation)(visualElement);
            });
        },
        mount: function () {
            hasMounted = true;
            pendingAnimations.forEach(function (_a) {
                var animation = _a.animation, resolve = _a.resolve;
                controls.start.apply(controls, (0,tslib__WEBPACK_IMPORTED_MODULE_3__.__spreadArray)([], (0,tslib__WEBPACK_IMPORTED_MODULE_3__.__read)(animation), false)).then(resolve);
            });
            return function () {
                hasMounted = false;
                controls.stop();
            };
        },
    };
    return controls;
}




/***/ }),

/***/ "../node_modules/framer-motion/dist/es/animation/use-animation.mjs":
/*!*************************************************************************!*\
  !*** ../node_modules/framer-motion/dist/es/animation/use-animation.mjs ***!
  \*************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useAnimation": () => (/* binding */ useAnimation)
/* harmony export */ });
/* harmony import */ var _animation_controls_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./animation-controls.mjs */ "../node_modules/framer-motion/dist/es/animation/animation-controls.mjs");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _utils_use_constant_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/use-constant.mjs */ "../node_modules/framer-motion/dist/es/utils/use-constant.mjs");




/**
 * Creates `AnimationControls`, which can be used to manually start, stop
 * and sequence animations on one or more components.
 *
 * The returned `AnimationControls` should be passed to the `animate` property
 * of the components you want to animate.
 *
 * These components can then be animated with the `start` method.
 *
 * ```jsx
 * import * as React from 'react'
 * import { motion, useAnimation } from 'framer-motion'
 *
 * export function MyComponent(props) {
 *    const controls = useAnimation()
 *
 *    controls.start({
 *        x: 100,
 *        transition: { duration: 0.5 },
 *    })
 *
 *    return <motion.div animate={controls} />
 * }
 * ```
 *
 * @returns Animation controller with `start` and `stop` methods
 *
 * @public
 */
function useAnimation() {
    var controls = (0,_utils_use_constant_mjs__WEBPACK_IMPORTED_MODULE_1__.useConstant)(_animation_controls_mjs__WEBPACK_IMPORTED_MODULE_2__.animationControls);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(controls.mount, []);
    return controls;
}




/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_onboarding_targetedOnboarding_onboarding_tsx.69af170801ef120a6109421bf06e6c93.js.map