(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_search_index_tsx"],{

/***/ "./app/actionCreators/formSearch.tsx":
/*!*******************************************!*\
  !*** ./app/actionCreators/formSearch.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "loadSearchMap": () => (/* binding */ loadSearchMap)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_flatMap__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/flatMap */ "../node_modules/lodash/flatMap.js");
/* harmony import */ var lodash_flatMap__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_flatMap__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_stores_formSearchStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/formSearchStore */ "./app/stores/formSearchStore.tsx");





/**
 * Creates a list of objects to be injected by a search source
 *
 * @param route The route a form field belongs on
 * @param formGroups An array of `FormGroup: {title: String, fields: [Field]}`
 * @param fields An object whose key is field name and value is a `Field`
 */
const createSearchMap = _ref => {
  let {
    route,
    formGroups,
    fields,
    ...other
  } = _ref;
  // There are currently two ways to define forms (TODO(billy): Turn this into one):
  // If `formGroups` is defined, then return a flattened list of fields in all formGroups
  // Otherwise `fields` is a map of fieldName -> fieldObject -- create a list of fields
  const listOfFields = formGroups ? lodash_flatMap__WEBPACK_IMPORTED_MODULE_1___default()(formGroups, formGroup => formGroup.fields) : Object.keys(fields).map(fieldName => fields[fieldName]);
  return listOfFields.map(field => ({ ...other,
    route,
    title: typeof field !== 'function' ? field.label : undefined,
    description: typeof field !== 'function' ? field.help : undefined,
    field
  }));
};

function loadSearchMap() {
  // Load all form configuration files via webpack that export a named `route`
  // as well as either `fields` or `formGroups`
  const context = __webpack_require__("./app/data/forms sync recursive \\.[tj]sx?$"); // Get a list of all form fields defined in `../data/forms`


  const allFormFields = lodash_flatten__WEBPACK_IMPORTED_MODULE_2___default()(context.keys().map(key => {
    const mod = context(key); // Since we're dynamically importing an entire directly, there could be malformed modules defined?

    if (!mod) {
      return null;
    } // Only look for module that have `route` exported


    if (!mod.route) {
      return null;
    }

    return createSearchMap({
      // `formGroups` can be a default export or a named export :<
      formGroups: mod.default || mod.formGroups,
      fields: mod.fields,
      route: mod.route
    });
  }).filter(function (i) {
    return i !== null;
  }));
  sentry_stores_formSearchStore__WEBPACK_IMPORTED_MODULE_3__["default"].loadSearchMap(allFormFields);
}

/***/ }),

/***/ "./app/components/search/index.tsx":
/*!*****************************************!*\
  !*** ./app/components/search/index.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Search": () => (/* binding */ WithRouterSearch)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_autoComplete__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/autoComplete */ "./app/components/autoComplete.tsx");
/* harmony import */ var sentry_components_search_sources__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/search/sources */ "./app/components/search/sources/index.tsx");
/* harmony import */ var sentry_components_search_sources_apiSource__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/search/sources/apiSource */ "./app/components/search/sources/apiSource.tsx");
/* harmony import */ var sentry_components_search_sources_commandSource__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/search/sources/commandSource */ "./app/components/search/sources/commandSource.tsx");
/* harmony import */ var sentry_components_search_sources_formSource__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/search/sources/formSource */ "./app/components/search/sources/formSource.tsx");
/* harmony import */ var sentry_components_search_sources_routeSource__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/search/sources/routeSource */ "./app/components/search/sources/routeSource.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var _list__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./list */ "./app/components/search/list.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports


















function Search(_ref) {
  let {
    entryPoint,
    maxResults,
    minSearch,
    renderInput,
    renderItem,
    closeOnSelect,
    dropdownClassName,
    resultFooter,
    searchOptions,
    sources,
    router,
    params
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])(`${entryPoint}.open`, {
      organization: null
    });
  }, [entryPoint]);
  const handleSelectItem = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((item, state) => {
    if (!item) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])(`${entryPoint}.select`, {
      query: state === null || state === void 0 ? void 0 : state.inputValue,
      result_type: item.resultType,
      source_type: item.sourceType,
      organization: null
    }); // `action` refers to a callback function while
    // `to` is a react-router route

    if (typeof item.action === 'function') {
      item.action(item, state);
      return;
    }

    if (!item.to) {
      return;
    }

    if (item.to.startsWith('http')) {
      const open = window.open();

      if (open) {
        open.opener = null;
        open.location.href = item.to;
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unable to open search result (a popup blocker may have caused this).'));
      return;
    }

    const nextPath = (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_14__["default"])(item.to, params);
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_5__.navigateTo)(nextPath, router, item.configUrl);
  }, [entryPoint, router, params]);
  const saveQueryMetrics = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(query => {
    if (!query) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])(`${entryPoint}.query`, {
      query,
      organization: null
    });
  }, [entryPoint]);
  const debouncedSaveQueryMetrics = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()(saveQueryMetrics, 200), [saveQueryMetrics]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_autoComplete__WEBPACK_IMPORTED_MODULE_6__["default"], {
    defaultHighlightedIndex: 0,
    onSelect: handleSelectItem,
    closeOnSelect: closeOnSelect !== null && closeOnSelect !== void 0 ? closeOnSelect : true,
    children: _ref2 => {
      let {
        getInputProps,
        isOpen,
        inputValue,
        ...autocompleteProps
      } = _ref2;
      const searchQuery = inputValue.toLowerCase().trim();
      const isValidSearch = inputValue.length >= minSearch;
      debouncedSaveQueryMetrics(searchQuery);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(SearchWrapper, {
        children: [renderInput({
          getInputProps
        }), isValidSearch && isOpen ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_search_sources__WEBPACK_IMPORTED_MODULE_7__["default"], {
          searchOptions: searchOptions,
          query: searchQuery,
          params: params,
          sources: sources !== null && sources !== void 0 ? sources : [sentry_components_search_sources_apiSource__WEBPACK_IMPORTED_MODULE_8__["default"], sentry_components_search_sources_formSource__WEBPACK_IMPORTED_MODULE_10__["default"], sentry_components_search_sources_routeSource__WEBPACK_IMPORTED_MODULE_11__["default"], sentry_components_search_sources_commandSource__WEBPACK_IMPORTED_MODULE_9__["default"]],
          children: _ref3 => {
            let {
              isLoading,
              results,
              hasAnyResults
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_list__WEBPACK_IMPORTED_MODULE_15__["default"], {
              isLoading,
              results,
              hasAnyResults,
              maxResults,
              resultFooter,
              dropdownClassName,
              renderItem,
              ...autocompleteProps
            });
          }
        }) : null]
      });
    }
  });
}

Search.displayName = "Search";
const WithRouterSearch = (0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(Search);


const SearchWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebntwz10"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

/***/ }),

/***/ "./app/components/search/list.tsx":
/*!****************************************!*\
  !*** ./app/components/search/list.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _searchResult__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./searchResult */ "./app/components/search/searchResult.tsx");
/* harmony import */ var _searchResultWrapper__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./searchResultWrapper */ "./app/components/search/searchResultWrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function defaultItemRenderer(_ref) {
  let {
    item,
    highlighted,
    itemProps,
    matches
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_searchResultWrapper__WEBPACK_IMPORTED_MODULE_6__["default"], {
    highlighted: highlighted,
    ...itemProps,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_searchResult__WEBPACK_IMPORTED_MODULE_5__["default"], {
      highlighted: highlighted,
      item: item,
      matches: matches
    })
  });
}

defaultItemRenderer.displayName = "defaultItemRenderer";

function List(_ref2) {
  let {
    dropdownClassName,
    isLoading,
    hasAnyResults,
    results,
    maxResults,
    getItemProps,
    highlightedIndex,
    resultFooter,
    registerItemCount,
    registerVisibleItem,
    renderItem = defaultItemRenderer
  } = _ref2;
  const resultList = results.slice(0, maxResults);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => registerItemCount(resultList.length), [registerItemCount, resultList.length]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(DropdownBox, {
    className: dropdownClassName,
    children: [isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(LoadingWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_2__["default"], {
        mini: true,
        hideMessage: true,
        relative: true
      })
    }) : !hasAnyResults ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(EmptyItem, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('No results found')
    }) : resultList.map((result, index) => {
      const {
        item,
        matches,
        refIndex
      } = result;
      const highlighted = index === highlightedIndex;
      const resultProps = {
        renderItem,
        registerVisibleItem,
        getItemProps,
        highlighted,
        index,
        item,
        matches
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ResultRow, { ...resultProps
      }, `${index}-${refIndex}`);
    }), !isLoading && resultFooter ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ResultFooter, {
      children: resultFooter
    }) : null]
  });
}

List.displayName = "List";
// XXX(epurkhiser): We memoize the ResultRow component since there will be many
// of them, we do not want them re-rendering every time we change the
// highlightedIndex in the parent List.

/**
 * Search item is used to call `registerVisibleItem` any time the item changes
 */
const ResultRow = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.memo)(_ref3 => {
  let {
    renderItem,
    registerVisibleItem,
    getItemProps,
    ...renderItemProps
  } = _ref3;
  const {
    item,
    index
  } = renderItemProps;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => registerVisibleItem(index, item), [registerVisibleItem, item]);
  const itemProps = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => getItemProps({
    item,
    index
  }), [getItemProps, item, index]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: renderItem({
      itemProps,
      ...renderItemProps
    })
  });
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (List);

const DropdownBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eltbwc33"
} : 0)("background:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";box-shadow:", p => p.theme.dropShadowHeavy, ";position:absolute;top:36px;right:0;width:400px;border-radius:5px;overflow:auto;max-height:60vh;" + ( true ? "" : 0));

const ResultFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eltbwc32"
} : 0)( true ? {
  name: "13w4h6y",
  styles: "position:sticky;bottom:0;left:0;right:0"
} : 0);

const EmptyItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_searchResultWrapper__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "eltbwc31"
} : 0)( true ? {
  name: "bxdknz",
  styles: "text-align:center;padding:16px;opacity:0.5"
} : 0);

const LoadingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eltbwc30"
} : 0)("display:flex;justify-content:center;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/search/searchResult.tsx":
/*!************************************************!*\
  !*** ./app/components/search/searchResult.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/docIntegrationAvatar */ "./app/components/avatar/docIntegrationAvatar.tsx");
/* harmony import */ var sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/avatar/sentryAppAvatar */ "./app/components/avatar/sentryAppAvatar.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_highlightFuseMatches__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/highlightFuseMatches */ "./app/utils/highlightFuseMatches.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports












function renderResultType(_ref) {
  let {
    resultType,
    model
  } = _ref;

  switch (resultType) {
    case 'settings':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconSettings, {});

    case 'field':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconInput, {});

    case 'route':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconLink, {});

    case 'integration':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledPluginIcon, {
        pluginId: model.slug
      });

    case 'sentryApp':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_avatar_sentryAppAvatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        sentryApp: model
      });

    case 'docIntegration':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_avatar_docIntegrationAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
        docIntegration: model
      });

    default:
      return null;
  }
}

function SearchResult(_ref2) {
  let {
    item,
    matches,
    params,
    highlighted
  } = _ref2;
  const {
    sourceType,
    model,
    extra
  } = item;

  function renderContent() {
    let {
      title,
      description
    } = item;

    if (matches) {
      // TODO(ts) Type this better.
      const HighlightedMarker = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HighlightMarker, {
        "data-test-id": "highlight",
        highlighted: highlighted,
        ...p
      });

      const matchedTitle = matches && matches.find(_ref3 => {
        let {
          key
        } = _ref3;
        return key === 'title';
      });
      const matchedDescription = matches && matches.find(_ref4 => {
        let {
          key
        } = _ref4;
        return key === 'description';
      });
      title = matchedTitle ? (0,sentry_utils_highlightFuseMatches__WEBPACK_IMPORTED_MODULE_10__["default"])(matchedTitle, HighlightedMarker) : title;
      description = matchedDescription ? (0,sentry_utils_highlightFuseMatches__WEBPACK_IMPORTED_MODULE_10__["default"])(matchedDescription, HighlightedMarker) : description;
    }

    if (['organization', 'member', 'project', 'team'].includes(sourceType)) {
      const DescriptionNode = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(BadgeDetail, {
        highlighted: highlighted,
        children: description
      });

      const badgeProps = {
        displayName: title,
        displayEmail: DescriptionNode,
        description: DescriptionNode,
        useLink: false,
        orgId: params.orgId,
        avatarSize: 32,
        [sourceType]: model
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__["default"], { ...badgeProps
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
        children: title
      }), description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(SearchDetail, {
        children: description
      }), extra && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ExtraDetail, {
        children: extra
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Content, {
      children: renderContent()
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
      children: renderResultType(item)
    })]
  });
}

SearchResult.displayName = "SearchResult";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(SearchResult));

const SearchDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewh1nus6"
} : 0)( true ? {
  name: "1dp7hwz",
  styles: "font-size:0.8em;line-height:1.3;margin-top:4px;opacity:0.8"
} : 0);

const ExtraDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewh1nus5"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.gray300, ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";" + ( true ? "" : 0));

const BadgeDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewh1nus4"
} : 0)("line-height:1.3;color:", p => p.highlighted ? p.theme.purple300 : null, ";" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewh1nus3"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewh1nus2"
} : 0)( true ? {
  name: "1fttcpj",
  styles: "display:flex;flex-direction:column"
} : 0);

const StyledPluginIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ewh1nus1"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const HighlightMarker = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('mark',  true ? {
  target: "ewh1nus0"
} : 0)("padding:0;background:transparent;font-weight:bold;color:", p => p.theme.active, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/search/searchResultWrapper.tsx":
/*!*******************************************************!*\
  !*** ./app/components/search/searchResultWrapper.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function scrollIntoView(element) {
  var _element$scrollIntoVi;

  element === null || element === void 0 ? void 0 : (_element$scrollIntoVi = element.scrollIntoView) === null || _element$scrollIntoVi === void 0 ? void 0 : _element$scrollIntoVi.call(element, {
    block: 'nearest'
  });
}

const SearchResultWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    highlighted,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", { ...props,
    ref: highlighted ? scrollIntoView : undefined
  });
},  true ? {
  target: "e1yel3av0"
} : 0)("cursor:pointer;display:block;color:", p => p.theme.textColor, ";padding:10px;scroll-margin:120px;", p => p.highlighted && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_2__.css)("color:", p.theme.purple300, ";background:", p.theme.backgroundSecondary, ";" + ( true ? "" : 0),  true ? "" : 0), ";&:not(:first-child){border-top:1px solid ", p => p.theme.innerBorder, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchResultWrapper);

/***/ }),

/***/ "./app/components/search/sources/apiSource.tsx":
/*!*****************************************************!*\
  !*** ./app/components/search/sources/apiSource.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ApiSource": () => (/* binding */ ApiSource),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/fuzzySearch */ "./app/utils/fuzzySearch.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./utils */ "./app/components/search/sources/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




 // eslint-disable-next-line no-restricted-imports











 // event ids must have string length of 32



const shouldSearchEventIds = query => typeof query === 'string' && query.length === 32; // STRING-HEXVAL


const shouldSearchShortIds = query => /[\w\d]+-[\w\d]+/.test(query); // Helper functions to create result objects


async function createOrganizationResults(organizationsPromise) {
  const organizations = (await organizationsPromise) || [];
  return lodash_flatten__WEBPACK_IMPORTED_MODULE_7___default()(organizations.map(org => [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Dashboard', org.slug),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Organization Dashboard'),
    model: org,
    sourceType: 'organization',
    resultType: 'route',
    to: `/${org.slug}/`
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Settings', org.slug),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Organization Settings'),
    model: org,
    sourceType: 'organization',
    resultType: 'settings',
    to: `/settings/${org.slug}/`
  }]));
}

async function createProjectResults(projectsPromise, orgId) {
  const projects = (await projectsPromise) || [];
  return lodash_flatten__WEBPACK_IMPORTED_MODULE_7___default()(projects.map(project => {
    const projectResults = [{
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Settings', project.slug),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Project Settings'),
      model: project,
      sourceType: 'project',
      resultType: 'settings',
      to: `/settings/${orgId}/projects/${project.slug}/`
    }, {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Alerts', project.slug),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('List of project alert rules'),
      model: project,
      sourceType: 'project',
      resultType: 'route',
      to: `/organizations/${orgId}/alerts/rules/?project=${project.id}`
    }];
    projectResults.unshift({
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('%s Dashboard', project.slug),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Project Details'),
      model: project,
      sourceType: 'project',
      resultType: 'route',
      to: `/organizations/${orgId}/projects/${project.slug}/?project=${project.id}`
    });
    return projectResults;
  }));
}

async function createTeamResults(teamsPromise, orgId) {
  const teams = (await teamsPromise) || [];
  return teams.map(team => ({
    title: `#${team.slug}`,
    description: 'Team Settings',
    model: team,
    sourceType: 'team',
    resultType: 'settings',
    to: `/settings/${orgId}/teams/${team.slug}/`
  }));
}

async function createMemberResults(membersPromise, orgId) {
  const members = (await membersPromise) || [];
  return members.map(member => ({
    title: member.name,
    description: member.email,
    model: member,
    sourceType: 'member',
    resultType: 'settings',
    to: `/settings/${orgId}/members/${member.id}/`
  }));
}

async function createPluginResults(pluginsPromise, orgId) {
  const plugins = (await pluginsPromise) || [];
  return plugins.filter(plugin => {
    // show a plugin if it is not hidden (aka legacy) or if we have projects with it configured
    return !plugin.isHidden || !!plugin.projectList.length;
  }).map(plugin => {
    var _plugin$description;

    return {
      title: plugin.isHidden ? `${plugin.name} (Legacy)` : plugin.name,
      description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
        dangerouslySetInnerHTML: {
          __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_12__.singleLineRenderer)((_plugin$description = plugin.description) !== null && _plugin$description !== void 0 ? _plugin$description : '')
        }
      }),
      model: plugin,
      sourceType: 'plugin',
      resultType: 'integration',
      to: `/settings/${orgId}/plugins/${plugin.id}/`
    };
  });
}

async function createIntegrationResults(integrationsPromise, orgId) {
  const {
    providers
  } = (await integrationsPromise) || {};
  return providers && providers.map(provider => ({
    title: provider.name,
    description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
      dangerouslySetInnerHTML: {
        __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_12__.singleLineRenderer)(provider.metadata.description)
      }
    }),
    model: provider,
    sourceType: 'integration',
    resultType: 'integration',
    to: `/settings/${orgId}/integrations/${provider.slug}/`,
    configUrl: `/api/0/organizations/${orgId}/integrations/?provider_key=${provider.slug}&includeConfig=0`
  })) || [];
}

async function createSentryAppResults(sentryAppPromise, orgId) {
  const sentryApps = (await sentryAppPromise) || [];
  return sentryApps.map(sentryApp => ({
    title: sentryApp.name,
    description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
      dangerouslySetInnerHTML: {
        __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_12__.singleLineRenderer)(sentryApp.overview || '')
      }
    }),
    model: sentryApp,
    sourceType: 'sentryApp',
    resultType: 'sentryApp',
    to: `/settings/${orgId}/sentry-apps/${sentryApp.slug}/`
  }));
}

async function createDocIntegrationResults(docIntegrationPromise, orgId) {
  const docIntegrations = (await docIntegrationPromise) || [];
  return docIntegrations.map(docIntegration => ({
    title: docIntegration.name,
    description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
      dangerouslySetInnerHTML: {
        __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_12__.singleLineRenderer)(docIntegration.description || '')
      }
    }),
    model: docIntegration,
    sourceType: 'docIntegration',
    resultType: 'docIntegration',
    to: `/settings/${orgId}/document-integrations/${docIntegration.slug}/`
  }));
}

async function createShortIdLookupResult(shortIdLookupPromise) {
  const shortIdLookup = await shortIdLookupPromise;

  if (!shortIdLookup) {
    return null;
  }

  const issue = shortIdLookup && shortIdLookup.group;
  return {
    item: {
      title: `${issue && issue.metadata && issue.metadata.type || shortIdLookup.shortId}`,
      description: `${issue && issue.metadata && issue.metadata.value || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Issue')}`,
      model: shortIdLookup.group,
      sourceType: 'issue',
      resultType: 'issue',
      to: `/${shortIdLookup.organizationSlug}/${shortIdLookup.projectSlug}/issues/${shortIdLookup.groupId}/`
    },
    score: 1,
    refIndex: 0
  };
}

async function createEventIdLookupResult(eventIdLookupPromise) {
  const eventIdLookup = await eventIdLookupPromise;

  if (!eventIdLookup) {
    return null;
  }

  const event = eventIdLookup && eventIdLookup.event;
  return {
    item: {
      title: `${event && event.metadata && event.metadata.type || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Event')}`,
      description: `${event && event.metadata && event.metadata.value}`,
      sourceType: 'event',
      resultType: 'event',
      to: `/${eventIdLookup.organizationSlug}/${eventIdLookup.projectSlug}/issues/${eventIdLookup.groupId}/events/${eventIdLookup.eventId}/`
    },
    score: 1,
    refIndex: 0
  };
}

class ApiSource extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      searchResults: null,
      directResults: null,
      fuzzy: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "api", new sentry_api__WEBPACK_IMPORTED_MODULE_8__.Client());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "doSearch", lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()(query => {
      const {
        params,
        organization
      } = this.props;
      const orgId = params && params.orgId || organization && organization.slug;
      let searchUrls = ['/organizations/'];
      let directUrls = []; // Only run these queries when we have an org in context

      if (orgId) {
        searchUrls = [...searchUrls, `/organizations/${orgId}/projects/`, `/organizations/${orgId}/teams/`, `/organizations/${orgId}/members/`, `/organizations/${orgId}/plugins/configs/`, `/organizations/${orgId}/config/integrations/`, '/sentry-apps/?status=published', '/doc-integrations/'];
        directUrls = [shouldSearchShortIds(query) ? `/organizations/${orgId}/shortids/${query}/` : null, shouldSearchEventIds(query) ? `/organizations/${orgId}/eventids/${query}/` : null];
      }

      const searchRequests = searchUrls.map(url => this.api.requestPromise(url, {
        query: {
          query
        }
      }).then(resp => resp, err => {
        this.handleRequestError(err, {
          orgId,
          url
        });
        return null;
      }));
      const directRequests = directUrls.map(url => {
        if (!url) {
          return Promise.resolve(null);
        }

        return this.api.requestPromise(url).then(resp => resp, err => {
          // No need to log 404 errors
          if (err && err.status === 404) {
            return null;
          }

          this.handleRequestError(err, {
            orgId,
            url
          });
          return null;
        });
      });
      this.handleSearchRequest(searchRequests, directRequests);
    }, 150));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRequestError", (err, _ref) => {
      let {
        url,
        orgId
      } = _ref;
      _sentry_react__WEBPACK_IMPORTED_MODULE_16__.withScope(scope => {
        var _err$responseJSON;

        scope.setExtra('url', url.replace(`/organizations/${orgId}/`, '/organizations/:orgId/'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_16__.captureException(new Error(`API Source Failed: ${err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail}`));
      });
    });
  }

  componentDidMount() {
    if (typeof this.props.query !== 'undefined') {
      this.doSearch(this.props.query);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // Limit the number of times we perform API queries by only attempting API queries
    // using first two characters, otherwise perform in-memory search.
    //
    // Otherwise it'd be constant :spinning_loading_wheel:
    if (nextProps.query.length <= 2 && nextProps.query.substr(0, 2) !== this.props.query.substr(0, 2) || // Also trigger a search if next query value satisfies an eventid/shortid query
    shouldSearchShortIds(nextProps.query) || shouldSearchEventIds(nextProps.query)) {
      this.setState({
        loading: true
      });
      this.doSearch(nextProps.query);
    }
  }

  // Handles a list of search request promises, and then updates state with response objects
  async handleSearchRequest(searchRequests, directRequests) {
    const {
      searchOptions
    } = this.props; // Note we don't wait for all requests to resolve here (e.g. `await Promise.all(reqs)`)
    // so that we can start processing before all API requests are resolved
    //
    // This isn't particularly helpful in its current form because we still wait for all requests to finish before
    // updating state, but you could potentially optimize rendering direct results before all requests are finished.

    const [organizations, projects, teams, members, plugins, integrations, sentryApps, docIntegrations] = searchRequests;
    const [shortIdLookup, eventIdLookup] = directRequests;
    const [searchResults, directResults] = await Promise.all([this.getSearchableResults([organizations, projects, teams, members, plugins, integrations, sentryApps, docIntegrations]), this.getDirectResults([shortIdLookup, eventIdLookup])]); // TODO(XXX): Might consider adding logic to maintain consistent ordering
    // of results so things don't switch positions

    const fuzzy = await (0,sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_11__.createFuzzySearch)(searchResults, { ...searchOptions,
      keys: ['title', 'description'],
      getFn: _utils__WEBPACK_IMPORTED_MODULE_14__.strGetFn
    });
    this.setState({
      loading: false,
      fuzzy,
      directResults
    });
  } // Process API requests that create result objects that should be searchable


  async getSearchableResults(requests) {
    const {
      params,
      organization
    } = this.props;
    const orgId = params && params.orgId || organization && organization.slug;
    const [organizations, projects, teams, members, plugins, integrations, sentryApps, docIntegrations] = requests;
    const searchResults = lodash_flatten__WEBPACK_IMPORTED_MODULE_7___default()(await Promise.all([createOrganizationResults(organizations), createProjectResults(projects, orgId), createTeamResults(teams, orgId), createMemberResults(members, orgId), createIntegrationResults(integrations, orgId), createPluginResults(plugins, orgId), createSentryAppResults(sentryApps, orgId), createDocIntegrationResults(docIntegrations, orgId)]));
    return searchResults;
  } // Create result objects from API requests that do not require fuzzy search
  // i.e. these responses only return 1 object or they should always be displayed regardless of query input


  async getDirectResults(requests) {
    const [shortIdLookup, eventIdLookup] = requests;
    const directResults = (await Promise.all([createShortIdLookupResult(shortIdLookup), createEventIdLookupResult(eventIdLookup)])).filter(sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined);

    if (!directResults.length) {
      return [];
    }

    return directResults;
  }

  render() {
    var _fuzzy$search;

    const {
      children,
      query
    } = this.props;
    const {
      fuzzy,
      directResults
    } = this.state;
    const results = (_fuzzy$search = fuzzy === null || fuzzy === void 0 ? void 0 : fuzzy.search(query)) !== null && _fuzzy$search !== void 0 ? _fuzzy$search : [];
    return children({
      isLoading: this.state.loading,
      results: lodash_flatten__WEBPACK_IMPORTED_MODULE_7___default()([results, directResults].filter(sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)) || []
    });
  }

}

ApiSource.displayName = "ApiSource";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ApiSource, "defaultProps", {
  searchOptions: {}
});


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_13__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)(ApiSource)));

/***/ }),

/***/ "./app/components/search/sources/commandSource.tsx":
/*!*********************************************************!*\
  !*** ./app/components/search/sources/commandSource.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CommandSource": () => (/* binding */ CommandSource),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/fuzzySearch */ "./app/utils/fuzzySearch.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const ACTIONS = [{
  title: 'Open Sudo Modal',
  description: 'Open Sudo Modal to re-identify yourself.',
  requiresSuperuser: false,
  action: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openSudo)({
    sudo: true
  })
}, {
  title: 'Open Superuser Modal',
  description: 'Open Superuser Modal to re-identify yourself.',
  requiresSuperuser: true,
  action: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openSudo)({
    isSuperuser: true
  })
}, {
  title: 'Toggle dark mode',
  description: 'Toggle dark mode (superuser only atm)',
  requiresSuperuser: true,
  action: () => sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_6__["default"].set('theme', sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_6__["default"].get('theme') === 'dark' ? 'light' : 'dark')
}, {
  title: 'Toggle Translation Markers',
  description: 'Toggles translation markers on or off in the application',
  requiresSuperuser: true,
  action: () => {
    (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.toggleLocaleDebug)();
    window.location.reload();
  }
}, {
  title: 'Search Documentation and FAQ',
  description: 'Open the Documentation and FAQ search modal.',
  requiresSuperuser: false,
  action: () => {
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openHelpSearchModal)();
  }
}];

/**
 * This source is a hardcoded list of action creators and/or routes maybe
 */
class CommandSource extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      fuzzy: null
    });
  }

  componentDidMount() {
    this.createSearch(ACTIONS);
  }

  async createSearch(searchMap) {
    const options = { ...this.props.searchOptions,
      keys: ['title', 'description']
    };
    this.setState({
      fuzzy: await (0,sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_7__.createFuzzySearch)(searchMap || [], options)
    });
  }

  render() {
    var _fuzzy$search$filter$;

    const {
      searchMap,
      query,
      isSuperuser,
      children
    } = this.props;
    const {
      fuzzy
    } = this.state;
    const results = (_fuzzy$search$filter$ = fuzzy === null || fuzzy === void 0 ? void 0 : fuzzy.search(query).filter(_ref => {
      let {
        item
      } = _ref;
      return !item.requiresSuperuser || isSuperuser;
    }).map(value => {
      const {
        item,
        ...rest
      } = value;
      return {
        item: { ...item,
          sourceType: 'command',
          resultType: 'command'
        },
        ...rest
      };
    })) !== null && _fuzzy$search$filter$ !== void 0 ? _fuzzy$search$filter$ : [];
    return children({
      isLoading: searchMap === null,
      results
    });
  }

}

CommandSource.displayName = "CommandSource";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(CommandSource, "defaultProps", {
  searchMap: [],
  searchOptions: {}
});

const CommandSourceWithFeature = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_4__["default"], {
  isSuperuser: true,
  children: _ref2 => {
    let {
      hasSuperuser
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(CommandSource, { ...props,
      isSuperuser: hasSuperuser
    });
  }
});

CommandSourceWithFeature.displayName = "CommandSourceWithFeature";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommandSourceWithFeature);


/***/ }),

/***/ "./app/components/search/sources/formSource.tsx":
/*!******************************************************!*\
  !*** ./app/components/search/sources/formSource.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_formSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/formSearch */ "./app/actionCreators/formSearch.tsx");
/* harmony import */ var sentry_stores_formSearchStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/formSearchStore */ "./app/stores/formSearchStore.tsx");
/* harmony import */ var sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/fuzzySearch */ "./app/utils/fuzzySearch.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./utils */ "./app/components/search/sources/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // eslint-disable-next-line no-restricted-imports









class FormSource extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      fuzzy: null
    });
  }

  componentDidMount() {
    this.createSearch(this.props.searchMap);
  }

  componentDidUpdate(prevProps) {
    if (this.props.searchMap !== prevProps.searchMap) {
      this.createSearch(this.props.searchMap);
    }
  }

  async createSearch(searchMap) {
    this.setState({
      fuzzy: await (0,sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_6__.createFuzzySearch)(searchMap || [], { ...this.props.searchOptions,
        keys: ['title', 'description'],
        getFn: _utils__WEBPACK_IMPORTED_MODULE_8__.strGetFn
      })
    });
  }

  render() {
    var _fuzzy$search$map;

    const {
      searchMap,
      query,
      params,
      children
    } = this.props;
    const {
      fuzzy
    } = this.state;
    const results = (_fuzzy$search$map = fuzzy === null || fuzzy === void 0 ? void 0 : fuzzy.search(query).map(value => {
      const {
        item,
        ...rest
      } = value;
      return {
        item: { ...item,
          sourceType: 'field',
          resultType: 'field',
          to: `${(0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_7__["default"])(item.route, params)}#${encodeURIComponent(item.field.name)}`
        },
        ...rest
      };
    })) !== null && _fuzzy$search$map !== void 0 ? _fuzzy$search$map : [];
    return children({
      isLoading: searchMap === null,
      results
    });
  }

}

FormSource.displayName = "FormSource";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(FormSource, "defaultProps", {
  searchOptions: {}
});

class FormSourceContainer extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      searchMap: sentry_stores_formSearchStore__WEBPACK_IMPORTED_MODULE_5__["default"].get()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_formSearchStore__WEBPACK_IMPORTED_MODULE_5__["default"].listen(searchMap => this.setState({
      searchMap
    }), undefined));
  }

  componentDidMount() {
    // Loads form fields
    (0,sentry_actionCreators_formSearch__WEBPACK_IMPORTED_MODULE_4__.loadSearchMap)();
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(FormSource, {
      searchMap: this.state.searchMap,
      ...this.props
    });
  }

}

FormSourceContainer.displayName = "FormSourceContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(FormSourceContainer));

/***/ }),

/***/ "./app/components/search/sources/index.tsx":
/*!*************************************************!*\
  !*** ./app/components/search/sources/index.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




class SearchSources extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  // `allSources` will be an array of all result objects from each source
  renderResults(allSources) {
    const {
      children
    } = this.props; // loading means if any result has `isLoading` OR any result is null

    const isLoading = !!allSources.find(arg => arg.isLoading || arg.results === null);
    const foundResults = isLoading ? [] : lodash_flatten__WEBPACK_IMPORTED_MODULE_1___default()(allSources.map(_ref => {
      let {
        results
      } = _ref;
      return results || [];
    })).sort((a, b) => {
      var _a$score, _b$score;

      return ((_a$score = a.score) !== null && _a$score !== void 0 ? _a$score : 0) - ((_b$score = b.score) !== null && _b$score !== void 0 ? _b$score : 0);
    });
    const hasAnyResults = !!foundResults.length;
    return children({
      isLoading,
      results: foundResults,
      hasAnyResults
    });
  }

  renderSources(sources, results, idx) {
    if (idx >= sources.length) {
      return this.renderResults(results);
    }

    const Source = sources[idx];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Source, { ...this.props,
      children: args => {
        // Mutate the array instead of pushing because we don't know how often
        // this child function will be called and pushing will cause duplicate
        // results to be pushed for all calls down the chain.
        results[idx] = args;
        return this.renderSources(sources, results, idx + 1);
      }
    });
  }

  render() {
    return this.renderSources(this.props.sources, new Array(this.props.sources.length), 0);
  }

}

SearchSources.displayName = "SearchSources";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchSources);

/***/ }),

/***/ "./app/components/search/sources/routeSource.tsx":
/*!*******************************************************!*\
  !*** ./app/components/search/sources/routeSource.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RouteSource": () => (/* binding */ RouteSource),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_flattenDepth__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/flattenDepth */ "../node_modules/lodash/flattenDepth.js");
/* harmony import */ var lodash_flattenDepth__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_flattenDepth__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/fuzzySearch */ "./app/utils/fuzzySearch.tsx");
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");
/* harmony import */ var sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withLatestContext */ "./app/utils/withLatestContext.tsx");
/* harmony import */ var sentry_views_settings_account_navigationConfiguration__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/settings/account/navigationConfiguration */ "./app/views/settings/account/navigationConfiguration.tsx");
/* harmony import */ var sentry_views_settings_organization_navigationConfiguration__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/organization/navigationConfiguration */ "./app/views/settings/organization/navigationConfiguration.tsx");
/* harmony import */ var sentry_views_settings_project_navigationConfiguration__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/settings/project/navigationConfiguration */ "./app/views/settings/project/navigationConfiguration.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/components/search/sources/utils.tsx");












/**
 * navigation configuration can currently be either:
 *
 *  - an array of {name: string, items: Array<{NavItem}>} OR
 *  - a function that returns the above
 *    (some navigation items require additional context, e.g. a badge based on
 *    a `project` property)
 *
 * We need to go through all navigation configurations and get a flattened list
 * of all navigation item objects
 */
const mapFunc = function (config) {
  let context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  return (Array.isArray(config) ? config : context !== null ? config(context) : []).map(_ref => {
    let {
      items
    } = _ref;
    return items.filter(_ref2 => {
      let {
        show
      } = _ref2;
      return typeof show === 'function' && context !== null ? show(context) : true;
    });
  });
};

class RouteSource extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      fuzzy: undefined
    });
  }

  componentDidMount() {
    this.createSearch();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.project === this.props.project && prevProps.organization === this.props.organization) {
      return;
    }

    this.createSearch();
  }

  async createSearch() {
    var _organization$access, _project$features;

    const {
      project,
      organization
    } = this.props;
    const context = {
      project,
      organization,
      access: new Set((_organization$access = organization === null || organization === void 0 ? void 0 : organization.access) !== null && _organization$access !== void 0 ? _organization$access : []),
      features: new Set((_project$features = project === null || project === void 0 ? void 0 : project.features) !== null && _project$features !== void 0 ? _project$features : [])
    };
    const searchMap = lodash_flattenDepth__WEBPACK_IMPORTED_MODULE_3___default()([mapFunc(sentry_views_settings_account_navigationConfiguration__WEBPACK_IMPORTED_MODULE_7__["default"], context), mapFunc(sentry_views_settings_project_navigationConfiguration__WEBPACK_IMPORTED_MODULE_9__["default"], context), mapFunc(sentry_views_settings_organization_navigationConfiguration__WEBPACK_IMPORTED_MODULE_8__["default"], context)], 2);
    const options = { ...this.props.searchOptions,
      keys: ['title', 'description'],
      getFn: _utils__WEBPACK_IMPORTED_MODULE_10__.strGetFn
    };
    const fuzzy = await (0,sentry_utils_fuzzySearch__WEBPACK_IMPORTED_MODULE_4__.createFuzzySearch)(searchMap !== null && searchMap !== void 0 ? searchMap : [], options);
    this.setState({
      fuzzy
    });
  }

  render() {
    var _fuzzy$search$map;

    const {
      query,
      params,
      children
    } = this.props;
    const {
      fuzzy
    } = this.state;
    const results = (_fuzzy$search$map = fuzzy === null || fuzzy === void 0 ? void 0 : fuzzy.search(query).map(_ref3 => {
      let {
        item,
        ...rest
      } = _ref3;
      return {
        item: { ...item,
          sourceType: 'route',
          resultType: 'route',
          to: (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_5__["default"])(item.path, params)
        },
        ...rest
      };
    })) !== null && _fuzzy$search$map !== void 0 ? _fuzzy$search$map : [];
    return children({
      isLoading: this.state.fuzzy === undefined,
      results
    });
  }

}

RouteSource.displayName = "RouteSource";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(RouteSource, "defaultProps", {
  searchOptions: {}
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withLatestContext__WEBPACK_IMPORTED_MODULE_6__["default"])(RouteSource));


/***/ }),

/***/ "./app/components/search/sources/utils.tsx":
/*!*************************************************!*\
  !*** ./app/components/search/sources/utils.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "strGetFn": () => (/* binding */ strGetFn)
/* harmony export */ });
/* harmony import */ var lodash_get__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/get */ "../node_modules/lodash/get.js");
/* harmony import */ var lodash_get__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_get__WEBPACK_IMPORTED_MODULE_0__);
// Override the lint rule for this, we actually need the path lookup feature,
// which `?.` does not magically give us.
// eslint-disable-next-line no-restricted-imports


/**
 * A value getter for fuse that will ensure the result is a string.
 *
 * This is useful since we sometimes will pass in react nodes, which fuse will
 * not index.
 */
const strGetFn = (value, path) => {
  const valueAtPath = lodash_get__WEBPACK_IMPORTED_MODULE_0___default()(value, path);
  return typeof valueAtPath === 'string' ? valueAtPath : '';
};

/***/ }),

/***/ "./app/data/forms/accountDetails.tsx":
/*!*******************************************!*\
  !*** ./app/data/forms/accountDetails.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
const route = '/settings/account/details/'; // For fields that are

const getUserIsManaged = _ref => {
  let {
    user
  } = _ref;
  return user.isManaged;
};

const formGroups = [{
  // Form "section"/"panel"
  title: 'Account Details',
  fields: [{
    name: 'name',
    type: 'string',
    required: true,
    // additional data/props that is related to rendering of form field rather than data
    label: 'Name',
    placeholder: 'e.g. John Doe',
    help: 'Your full name'
  }, {
    name: 'username',
    type: 'string',
    required: true,
    autoComplete: 'username',
    label: 'Username',
    placeholder: 'e.g. name@example.com',
    help: '',
    disabled: getUserIsManaged,
    visible: _ref2 => {
      let {
        user
      } = _ref2;
      return user.email !== user.username;
    }
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/accountEmails.tsx":
/*!******************************************!*\
  !*** ./app/data/forms/accountEmails.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
// Export route to make these forms searchable by label/help
const route = '/settings/account/emails/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Add Secondary Emails',
  fields: [{
    name: 'email',
    type: 'string',
    // additional data/props that is related to rendering of form field rather than data
    label: 'Additional Email',
    placeholder: 'e.g. secondary@example.com',
    help: 'Designate an alternative email for this account',
    showReturnButton: true
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/accountNotificationSettings.tsx":
/*!********************************************************!*\
  !*** ./app/data/forms/accountNotificationSettings.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
 // TODO: cleanup unused fields and exports
// Export route to make these forms searchable by label/help

const route = '/settings/account/notifications/';
const fields = {
  subscribeByDefault: {
    name: 'subscribeByDefault',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Alerts'),
    // TODO(billy): Make this a real link
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable this to receive notifications for Alerts sent to your teams. You will always receive alerts configured to be sent directly to you.')
  },
  workflowNotifications: {
    name: 'workflowNotifications',
    type: 'radio',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Workflow Notifications'),
    choices: [[0, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')], [1, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only On Issues I Subscribe To')], [2, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('E.g. changes in issue assignment, resolution status, and comments.')
  },
  weeklyReports: {
    // Form is not visible because currently not implemented
    name: 'weeklyReports',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Weekly Reports'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Reports contain a summary of what's happened within your organization."),
    disabled: true
  },
  deployNotifications: {
    name: 'deployNotifications',
    type: 'radio',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Send Me Deploy Notifications'),
    choices: [[2, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Always')], [3, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only On Deploys With My Commits')], [4, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Never')]],
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Deploy emails include release, environment and commit overviews.')
  },
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notify Me About My Own Activity'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable this to receive notifications about your own actions on Sentry.')
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Claim Unassigned Issues I've Resolved"),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("You'll receive notifications about any changes that happen afterwards.")
  }
};

/***/ }),

/***/ "./app/data/forms/accountPassword.tsx":
/*!********************************************!*\
  !*** ./app/data/forms/accountPassword.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
const getUserIsNotManaged = _ref => {
  let {
    user
  } = _ref;
  return !user.isManaged;
};

const formGroups = [{
  // Form "section"/"panel"
  title: 'Password',
  fields: [{
    name: 'password',
    type: 'secret',
    autoComplete: 'current-password',
    label: 'Current Password',
    placeholder: '',
    help: 'Your current password',
    visible: getUserIsNotManaged,
    required: true
  }, {
    name: 'passwordNew',
    type: 'secret',
    autoComplete: 'new-password',
    label: 'New Password',
    placeholder: '',
    help: '',
    required: true,
    visible: getUserIsNotManaged,
    validate: _ref2 => {
      let {
        id,
        form
      } = _ref2;
      return form[id] !== form.passwordVerify ? [[id, '']] : [];
    }
  }, {
    name: 'passwordVerify',
    type: 'secret',
    autoComplete: 'new-password',
    label: 'Verify New Password',
    placeholder: '',
    help: 'Verify your new password',
    required: true,
    visible: getUserIsNotManaged,
    validate: _ref3 => {
      let {
        id,
        form
      } = _ref3;

      // If password is set, and passwords don't match, then return an error
      if (form.passwordNew && form.passwordNew !== form[id]) {
        return [[id, 'Passwords do not match']];
      }

      return [];
    }
  }]
}];
const route = '/settings/account/security/';
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/accountPreferences.tsx":
/*!***********************************************!*\
  !*** ./app/data/forms/accountPreferences.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_data_languages__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/data/languages */ "./app/data/languages.tsx");
/* harmony import */ var sentry_data_timezones__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/data/timezones */ "./app/data/timezones.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");


 // Export route to make these forms searchable by label/help

const route = '/settings/account/details/'; // Called before sending API request, these fields need to be sent as an
// `options` object

const transformOptions = data => ({
  options: data
});

const formGroups = [{
  // Form "section"/"panel"
  title: 'Preferences',
  fields: [{
    name: 'theme',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Theme'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)("Select your theme preference. It can be synced to your system's theme, always light mode, or always dark mode."),
    choices: [['light', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Light')], ['dark', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Dark')], ['system', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Default to system')]],
    getData: transformOptions
  }, {
    name: 'language',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Language'),
    choices: sentry_data_languages__WEBPACK_IMPORTED_MODULE_0__["default"],
    getData: transformOptions
  }, {
    name: 'timezone',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Timezone'),
    choices: sentry_data_timezones__WEBPACK_IMPORTED_MODULE_1__["default"],
    getData: transformOptions
  }, {
    name: 'clock24Hours',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Use a 24-hour clock'),
    getData: transformOptions
  }, {
    name: 'stacktraceOrder',
    type: 'select',
    required: false,
    choices: [[-1, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Default (let Sentry decide)')], [1, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Most recent call last')], [2, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Most recent call first')]],
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Stack Trace Order'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Choose the default ordering of frames in stack traces'),
    getData: transformOptions
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/apiApplication.tsx":
/*!*******************************************!*\
  !*** ./app/data/forms/apiApplication.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");


const forms = [{
  // Form "section"/"panel"
  title: 'Application Details',
  fields: [{
    name: 'name',
    type: 'string',
    required: true,
    // additional data/props that is related to rendering of form field rather than data
    label: 'Name',
    help: 'e.g. My Application',
    setValue: value => (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_1__["default"])({
      value,
      fixed: 'CI_APPLICATION_NAME'
    })
  }, {
    name: 'homepageUrl',
    type: 'string',
    required: false,
    label: 'Homepage',
    placeholder: 'e.g. https://example.com/',
    help: "An optional link to your application's homepage"
  }, {
    name: 'privacyUrl',
    type: 'string',
    label: 'Privacy Policy',
    placeholder: 'e.g. https://example.com/privacy',
    help: 'An optional link to your Privacy Policy'
  }, {
    name: 'termsUrl',
    type: 'string',
    label: 'Terms of Service',
    placeholder: 'e.g. https://example.com/terms',
    help: 'An optional link to your Terms of Service agreement'
  }]
}, {
  title: 'Security',
  fields: [{
    name: 'redirectUris',
    type: 'string',
    multiline: true,
    placeholder: 'e.g. https://example.com/oauth/complete',
    label: 'Authorized Redirect URIs',
    help: 'Separate multiple entries with a newline.',
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.convertMultilineFieldValue)(val)
  }, {
    name: 'allowedOrigins',
    type: 'string',
    multiline: true,
    placeholder: 'e.g. example.com',
    label: 'Authorized JavaScript Origins',
    help: 'Separate multiple entries with a newline.',
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.convertMultilineFieldValue)(val)
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (forms);

/***/ }),

/***/ "./app/data/forms/cspReports.tsx":
/*!***************************************!*\
  !*** ./app/data/forms/cspReports.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
// Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/csp/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'CSP Settings',
  fields: [{
    name: 'sentry:csp_ignored_sources_defaults',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Use default ignored sources'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Our default list will attempt to ignore common issues and reduce noise.'),
    getData: data => ({
      options: data
    })
  }, // XXX: Org details endpoints accept these multiline inputs as a list,
  // where as it looks like project details accepts it as a string with newlines
  {
    name: 'sentry:csp_ignored_sources',
    type: 'string',
    multiline: true,
    autosize: true,
    rows: 4,
    placeholder: 'e.g.\nfile://*\n*.example.com\nexample.com',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Additional ignored sources'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Discard reports about requests from the given sources. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Separate multiple entries with a newline.'),
    getData: data => ({
      options: data
    })
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/inboundFilters.tsx":
/*!*******************************************!*\
  !*** ./app/data/forms/inboundFilters.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "customFilterFields": () => (/* binding */ customFilterFields),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // Export route to make these forms searchable by label/help



const route = '/settings/:orgId/projects/:projectId/filters/';
const newLineHelpText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Separate multiple entries with a newline.');
const globHelpText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Allows [link:glob pattern matching].', {
  link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
    href: "https://en.wikipedia.org/wiki/Glob_(programming)"
  })
});

const getOptionsData = data => ({
  options: data
});

const formGroups = [{
  // Form "section"/"panel"
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Custom Filters'),
  fields: [{
    name: 'filters:blacklisted_ips',
    type: 'string',
    multiline: true,
    autosize: true,
    rows: 1,
    maxRows: 10,
    placeholder: 'e.g. 127.0.0.1 or 10.0.0.0/8',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('IP Addresses'),
    help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events from these IP addresses. '), newLineHelpText]
    }),
    getData: getOptionsData
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups); // These require a feature flag

const customFilterFields = [{
  name: 'filters:releases',
  type: 'string',
  multiline: true,
  autosize: true,
  maxRows: 10,
  rows: 1,
  placeholder: 'e.g. 1.* or [!3].[0-9].*',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Releases'),
  help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events from these releases. '), newLineHelpText, " ", globHelpText]
  }),
  getData: getOptionsData
}, {
  name: 'filters:error_messages',
  type: 'string',
  multiline: true,
  autosize: true,
  maxRows: 10,
  rows: 1,
  placeholder: 'e.g. TypeError* or *: integer division or modulo by zero',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Error Message'),
  help: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Filter events by error messages. '), newLineHelpText, " ", globHelpText]
  }),
  getData: getOptionsData
}];

/***/ }),

/***/ "./app/data/forms/organizationGeneralSettings.tsx":
/*!********************************************************!*\
  !*** ./app/data/forms/organizationGeneralSettings.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");

 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/';
const formGroups = [{
  // Form "section"/"panel"
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('General'),
  fields: [{
    name: 'slug',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Organization Slug'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A unique ID used to identify this organization'),
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__["default"],
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('You will be redirected to the new organization slug after saving')
  }, {
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Display Name'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A human-friendly name for the organization')
  }, {
    name: 'isEarlyAdopter',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Early Adopter'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Opt-in to new features before they're released to the public")
  }]
}, {
  title: 'Membership',
  fields: [{
    name: 'defaultRole',
    type: 'select',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Default Role'),
    // seems weird to have choices in initial form data
    choices: function () {
      var _initialData$orgRoleL, _initialData$orgRoleL2;

      let {
        initialData
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      return (_initialData$orgRoleL = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL2 = initialData.orgRoleList) === null || _initialData$orgRoleL2 === void 0 ? void 0 : _initialData$orgRoleL2.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL !== void 0 ? _initialData$orgRoleL : [];
    },
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The default role new members will receive'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('org:admin');
    }
  }, {
    name: 'openMembership',
    type: 'boolean',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Open Membership'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow organization members to freely join or leave any team')
  }, {
    name: 'eventsMemberAdmin',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Let Members Delete Events'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.')
  }, {
    name: 'alertsMemberWrite',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Let Members Create and Edit Alerts'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.')
  }, {
    name: 'attachmentsRole',
    type: 'select',
    choices: _ref2 => {
      var _initialData$orgRoleL3, _initialData$orgRoleL4;

      let {
        initialData = {}
      } = _ref2;
      return (_initialData$orgRoleL3 = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL4 = initialData.orgRoleList) === null || _initialData$orgRoleL4 === void 0 ? void 0 : _initialData$orgRoleL4.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL3 !== void 0 ? _initialData$orgRoleL3 : [];
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Attachments Access'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Role required to download event attachments, such as native crash reports or log files.'),
    visible: _ref3 => {
      let {
        features
      } = _ref3;
      return features.has('event-attachments');
    }
  }, {
    name: 'debugFilesRole',
    type: 'select',
    choices: _ref4 => {
      var _initialData$orgRoleL5, _initialData$orgRoleL6;

      let {
        initialData = {}
      } = _ref4;
      return (_initialData$orgRoleL5 = initialData === null || initialData === void 0 ? void 0 : (_initialData$orgRoleL6 = initialData.orgRoleList) === null || _initialData$orgRoleL6 === void 0 ? void 0 : _initialData$orgRoleL6.map(r => [r.id, r.name])) !== null && _initialData$orgRoleL5 !== void 0 ? _initialData$orgRoleL5 : [];
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Debug Files Access'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Role required to download debug information files, proguard mappings and source maps.')
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/organizationSecurityAndPrivacyGroups.tsx":
/*!*****************************************************************!*\
  !*** ./app/data/forms/organizationSecurityAndPrivacyGroups.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/crashReports */ "./app/utils/crashReports.tsx");


 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/security-and-privacy/';
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Security & Privacy'),
  fields: [{
    name: 'require2FA',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Two-Factor Authentication'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require and enforce two-factor authentication for all members'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This will remove all members without two-factor authentication' + ' from your organization. It will also send them an email to setup 2FA' + ' and reinstate their access and settings. Do you want to continue?'),
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to access your organization without having two-factor authentication enabled?')
    }
  }, {
    name: 'requireEmailVerification',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Email Verification'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require and enforce email address verification for all members'),
    visible: _ref => {
      let {
        features
      } = _ref;
      return features.has('required-email-verification');
    },
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This will remove all members whose email addresses are not verified' + ' from your organization. It will also send them an email to verify their address' + ' and reinstate their access and settings. Do you want to continue?'),
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to access your organization without verifying their email address?')
    }
  }, {
    name: 'allowSharedIssues',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Shared Issues'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable sharing of limited details on issues to anonymous users'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow sharing issues to anonymous users?')
    }
  }, {
    name: 'enhancedPrivacy',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enhanced Privacy'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'scrapeJavaScript',
    type: 'boolean',
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Are you sure you want to disable sourcecode fetching for JavaScript events? This will affect Sentry's ability to aggregate issues if you're not already uploading sourcemaps as artifacts.")
    },
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow JavaScript Source Fetching'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Sentry to scrape missing JavaScript source context when possible')
  }, {
    name: 'storeCrashReports',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Store Native Crash Reports'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Store native crash reports such as Minidumps for improved processing and download in issue details'),
    visible: _ref2 => {
      let {
        features
      } = _ref2;
      return features.has('event-attachments');
    },
    // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
    // we therefore display it in a placeholder
    placeholder: _ref3 => {
      let {
        value
      } = _ref3;
      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.formatStoreCrashReports)(value);
    },
    choices: () => (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.getStoreCrashReportsValues)(sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.SettingScope.Organization).map(value => [value, (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_2__.formatStoreCrashReports)(value)])
  }, {
    name: 'allowJoinRequests',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow Join Requests'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Allow users to request to join your organization'),
    confirm: {
      true: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Are you sure you want to allow users to request to join your organization?')
    },
    visible: _ref4 => {
      let {
        hasSsoEnabled
      } = _ref4;
      return !hasSsoEnabled;
    }
  }]
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Data Scrubbing'),
  fields: [{
    name: 'dataScrubber',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Data Scrubber'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require server-side data scrubbing be enabled for all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'dataScrubberDefaults',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require Using Default Scrubbers'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }, {
    name: 'sensitiveFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: 'e.g. email',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Global Sensitive Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Note: These fields will be used in addition to project specific fields.'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.convertMultilineFieldValue)(val)
  }, {
    name: 'safeFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('e.g. business-email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Global Safe Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Field names which data scrubbers should ignore. Separate multiple entries with a newline.'),
    extraHelp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Note: These fields will be used in addition to project specific fields'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.convertMultilineFieldValue)(val)
  }, {
    name: 'scrubIPAddresses',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Prevent Storing of IP Addresses'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Preventing IP addresses from being stored for new events on all projects'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabling this can have privacy implications for ALL projects, are you sure you want to continue?')
    }
  }]
}]);

/***/ }),

/***/ "./app/data/forms/processingIssues.tsx":
/*!*********************************************!*\
  !*** ./app/data/forms/processingIssues.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
// Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/processing-issues/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Settings',
  fields: [{
    name: 'sentry:reprocessing_active',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Reprocessing active'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('project:write');
    },
    disabledReason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only admins may change reprocessing settings'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)(`If reprocessing is enabled, Events with fixable issues will be
                held back until you resolve them. Processing issues will then
                show up in the list above with hints how to fix them.
                If reprocessing is disabled, Events with unresolved issues will
                also show up in the stream.
                `),
    saveOnBlur: false,
    saveMessage: _ref2 => {
      let {
        value
      } = _ref2;
      return value ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Reprocessing applies to future events only.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)(`All events with errors will be flushed into your issues stream.
                Beware that this process may take some time and cannot be undone.`);
    },
    getData: form => ({
      options: form
    })
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/projectAlerts.tsx":
/*!******************************************!*\
  !*** ./app/data/forms/projectAlerts.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/alerts/';

const formatMinutes = value => {
  value = Number(value) / 60;
  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tn)('%s minute', '%s minutes', value);
};

const fields = {
  subjectTemplate: {
    name: 'subjectTemplate',
    type: 'string',
    // additional data/props that is related to rendering of form field rather than data
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Subject Template'),
    placeholder: 'e.g. $shortID - $title',
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $title, $shortID, $projectID, $orgID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.')
  },
  digestsMinDelay: {
    name: 'digestsMinDelay',
    type: 'range',
    min: 60,
    max: 3600,
    step: 60,
    defaultValue: 300,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Minimum delivery interval'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications will be delivered at most this often.'),
    formatLabel: formatMinutes
  },
  digestsMaxDelay: {
    name: 'digestsMaxDelay',
    type: 'range',
    min: 60,
    max: 3600,
    step: 60,
    defaultValue: 300,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Maximum delivery interval'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notifications will be delivered at least this often.'),
    formatLabel: formatMinutes
  }
};

/***/ }),

/***/ "./app/data/forms/projectGeneralSettings.tsx":
/*!***************************************************!*\
  !*** ./app/data/forms/projectGeneralSettings.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fields": () => (/* binding */ fields),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/Select-9fdb8cd0.browser.esm.js");
/* harmony import */ var platformicons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! platformicons */ "../node_modules/platformicons/build/index.js");
/* harmony import */ var sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/data/platforms */ "./app/data/platforms.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








 // Export route to make these forms searchable by label/help



const route = '/settings/:orgId/projects/:projectId/';

const getResolveAgeAllowedValues = () => {
  let i = 0;
  const values = [];

  while (i <= 720) {
    values.push(i);

    if (i < 12) {
      i += 1;
    } else if (i < 24) {
      i += 3;
    } else if (i < 36) {
      i += 6;
    } else if (i < 48) {
      i += 12;
    } else {
      i += 24;
    }
  }

  return values;
};

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();
const ORG_DISABLED_REASON = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("This option is enforced by your organization's settings and cannot be customized per-project.");

const PlatformWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "er783381"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledPlatformIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(platformicons__WEBPACK_IMPORTED_MODULE_1__.PlatformIcon,  true ? {
  target: "er783380"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const fields = {
  name: {
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Name'),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('my-awesome-project'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('A name for this project'),
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_7__["default"],
    getData: data => {
      return {
        name: data.name,
        slug: data.name
      };
    },
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('You will be redirected to the new project slug after saving')
  },
  platform: {
    name: 'platform',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Platform'),
    options: sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__["default"].map(_ref => {
      let {
        id,
        name
      } = _ref;
      return {
        value: id,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(PlatformWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledPlatformIcon, {
            platform: id
          }), name]
        }, id)
      };
    }),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('The primary platform for this project'),
    filterOption: (0,react_select__WEBPACK_IMPORTED_MODULE_9__.c)({
      stringify: option => {
        const matchedPlatform = sentry_data_platforms__WEBPACK_IMPORTED_MODULE_2__["default"].find(_ref2 => {
          let {
            id
          } = _ref2;
          return id === option.value;
        });
        return `${matchedPlatform === null || matchedPlatform === void 0 ? void 0 : matchedPlatform.name} ${option.value}`;
      }
    })
  },
  subjectPrefix: {
    name: 'subjectPrefix',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Subject Prefix'),
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('e.g. [my-org]'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Choose a custom prefix for emails from this project')
  },
  resolveAge: {
    name: 'resolveAge',
    type: 'range',
    allowedValues: RESOLVE_AGE_ALLOWED_VALUES,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Auto Resolve'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)("Automatically resolve an issue if it hasn't been seen for this amount of time"),
    formatLabel: val => {
      val = Number(val);

      if (val === 0) {
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Disabled');
      }

      if (val > 23 && val % 24 === 0) {
        // Based on allowed values, val % 24 should always be true
        val = val / 24;
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tn)('%s day', '%s days', val);
      }

      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tn)('%s hour', '%s hours', val);
    },
    saveOnBlur: false,
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('[Caution]: Enabling auto resolve will immediately resolve anything that has ' + 'not been seen within this period of time. There is no undo!', {
      Caution: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("strong", {
        children: "Caution"
      })
    }),
    saveMessageAlertType: 'warning'
  },
  allowedDomains: {
    name: 'allowedDomains',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('https://example.com or example.com'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allowed Domains'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.convertMultilineFieldValue)(val)
  },
  scrapeJavaScript: {
    name: 'scrapeJavaScript',
    type: 'boolean',
    // if this is off for the organization, it cannot be enabled for the project
    disabled: _ref3 => {
      let {
        organization,
        name
      } = _ref3;
      return !organization[name];
    },
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] && val,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Enable JavaScript source fetching'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Allow Sentry to scrape missing JavaScript source context when possible')
  },
  securityToken: {
    name: 'securityToken',
    type: 'string',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Security Token'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'),
    setValue: value => (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_6__["default"])({
      value,
      fixed: '__SECURITY_TOKEN__'
    })
  },
  securityTokenHeader: {
    name: 'securityTokenHeader',
    type: 'string',
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('X-Sentry-Token'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Security Token Header'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended')
  },
  verifySSL: {
    name: 'verifySSL',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Verify TLS/SSL'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Outbound requests will verify TLS (sometimes known as SSL) connections')
  }
};

/***/ }),

/***/ "./app/data/forms/projectSecurityAndPrivacyGroups.tsx":
/*!************************************************************!*\
  !*** ./app/data/forms/projectSecurityAndPrivacyGroups.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/crashReports */ "./app/utils/crashReports.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // Export route to make these forms searchable by label/help


const route = '/settings/:orgId/projects/:projectId/security-and-privacy/';
const ORG_DISABLED_REASON = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)("This option is enforced by your organization's settings and cannot be customized per-project."); // Check if a field has been set AND IS TRUTHY at the organization level.

const hasOrgOverride = _ref => {
  let {
    organization,
    name
  } = _ref;
  return organization[name];
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Security & Privacy'),
  fields: [{
    name: 'storeCrashReports',
    type: 'select',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Store Native Crash Reports'),
    help: _ref2 => {
      let {
        organization
      } = _ref2;
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('Store native crash reports such as Minidumps for improved processing and download in issue details. Overrides [organizationSettingsLink: organization settings].', {
        organizationSettingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__["default"], {
          to: `/settings/${organization.slug}/security-and-privacy/`
        })
      });
    },
    visible: _ref3 => {
      let {
        features
      } = _ref3;
      return features.has('event-attachments');
    },
    placeholder: _ref4 => {
      let {
        organization,
        value
      } = _ref4;

      // empty value means that this project should inherit organization settings
      if (value === '') {
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('Inherit organization settings ([organizationValue])', {
          organizationValue: (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(organization.storeCrashReports)
        });
      } // HACK: some organization can have limit of stored crash reports a number that's not in the options (legacy reasons),
      // we therefore display it in a placeholder


      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(value);
    },
    choices: _ref5 => {
      let {
        organization
      } = _ref5;
      return (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.getStoreCrashReportsValues)(sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.SettingScope.Project).map(value => [value, (0,sentry_utils_crashReports__WEBPACK_IMPORTED_MODULE_3__.formatStoreCrashReports)(value, organization.storeCrashReports)]);
    }
  }]
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Data Scrubbing'),
  fields: [{
    name: 'dataScrubber',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Data Scrubber'),
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Enable server-side data scrubbing'),
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable server-side data scrubbing?')
    }
  }, {
    name: 'dataScrubberDefaults',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Use Default Scrubbers'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apply default scrubbers to prevent things like passwords and credit cards from being stored'),
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable using default scrubbers?')
    }
  }, {
    name: 'scrubIPAddresses',
    type: 'boolean',
    disabled: hasOrgOverride,
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization && props.organization[props.name] || val,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Prevent Storing of IP Addresses'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Preventing IP addresses from being stored for new events'),
    confirm: {
      false: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Are you sure you want to disable scrubbing IP addresses?')
    }
  }, {
    name: 'sensitiveFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Additional Sensitive Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Additional field names to match against when scrubbing data. Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.convertMultilineFieldValue)(val)
  }, {
    name: 'safeFields',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('business-email'),
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Safe Fields'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Field names which data scrubbers should ignore. Separate multiple entries with a newline'),
    getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.extractMultilineFields)(val),
    setValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.convertMultilineFieldValue)(val)
  }]
}]);

/***/ }),

/***/ "./app/data/forms/sentryApplication.tsx":
/*!**********************************************!*\
  !*** ./app/data/forms/sentryApplication.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "internalIntegrationForms": () => (/* binding */ internalIntegrationForms),
/* harmony export */   "publicIntegrationForms": () => (/* binding */ publicIntegrationForms)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const getPublicFormFields = () => [{
  name: 'name',
  type: 'string',
  required: true,
  placeholder: 'e.g. My Integration',
  label: 'Name',
  help: 'Human readable name of your Integration.'
}, {
  name: 'author',
  type: 'string',
  required: true,
  placeholder: 'e.g. Acme Software',
  label: 'Author',
  help: 'The company or person who built and maintains this Integration.'
}, {
  name: 'webhookUrl',
  type: 'string',
  required: true,
  label: 'Webhook URL',
  placeholder: 'e.g. https://example.com/sentry/webhook/',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('All webhook requests for your integration will be sent to this URL. Visit the [webhook_docs:documentation] to see the different types and payloads.', {
    webhook_docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/integrations/integration-platform/webhooks/"
    })
  })
}, {
  name: 'redirectUrl',
  type: 'string',
  label: 'Redirect URL',
  placeholder: 'e.g. https://example.com/sentry/setup/',
  help: 'The URL Sentry will redirect users to after installation.'
}, {
  name: 'verifyInstall',
  label: 'Verify Installation',
  type: 'boolean',
  help: 'If enabled, installations will need to be verified before becoming installed.'
}, {
  name: 'isAlertable',
  type: 'boolean',
  label: 'Alert Rule Action',
  disabled: _ref => {
    let {
      webhookDisabled
    } = _ref;
    return webhookDisabled;
  },
  disabledReason: 'Cannot enable alert rule action without a webhook url',
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('If enabled, this integration will be available in Issue Alert rules and Metric Alert rules in Sentry. The notification destination is the Webhook URL specified above. More on actions [learn_more:here].', {
    learn_more: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/alerts-notifications/notifications/"
    })
  })
}, {
  name: 'schema',
  type: 'textarea',
  label: 'Schema',
  autosize: true,
  rows: 1,
  help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('Schema for your UI components. Click [schema_docs:here] for documentation.', {
    schema_docs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "https://docs.sentry.io/product/integrations/integration-platform/ui-components/"
    })
  }),
  getValue: val => val === '' ? {} : JSON.parse(val),
  setValue: val => {
    const schema = JSON.stringify(val, null, 2);

    if (schema === '{}') {
      return '';
    }

    return schema;
  },
  validate: _ref2 => {
    let {
      id,
      form
    } = _ref2;

    if (!form.schema) {
      return [];
    }

    try {
      JSON.parse(form.schema);
    } catch (e) {
      return [[id, 'Invalid JSON']];
    }

    return [];
  }
}, {
  name: 'overview',
  type: 'textarea',
  label: 'Overview',
  autosize: true,
  rows: 1,
  help: 'Description of your Integration and its functionality.'
}, {
  name: 'allowedOrigins',
  type: 'string',
  multiline: true,
  placeholder: 'e.g. example.com',
  label: 'Authorized JavaScript Origins',
  help: 'Separate multiple entries with a newline.',
  getValue: val => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.extractMultilineFields)(val),
  setValue: val => val && typeof val.join === 'function' && val.join('\n') || ''
}];

const publicIntegrationForms = [{
  title: 'Public Integration Details',
  fields: getPublicFormFields()
}];

const getInternalFormFields = () => {
  // Generate internal form fields copy copying the public form fields and
  // making adjustments:
  //
  //   1. remove fields not needed for internal integrations
  //   2. make webhookUrl optional
  const internalFormFields = getPublicFormFields().filter(formField => !['redirectUrl', 'verifyInstall', 'author'].includes(formField.name || ''));
  const webhookField = internalFormFields.find(field => field.name === 'webhookUrl');

  if (webhookField) {
    webhookField.required = false;
  }

  return internalFormFields;
};

const internalIntegrationForms = [{
  title: 'Internal Integration Details',
  fields: getInternalFormFields()
}];

/***/ }),

/***/ "./app/data/forms/teamSettingsFields.tsx":
/*!***********************************************!*\
  !*** ./app/data/forms/teamSettingsFields.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/slugify */ "./app/utils/slugify.tsx");

 // Export route to make these forms searchable by label/help

const route = '/settings/:orgId/teams/:teamId/settings/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Team Settings',
  fields: [{
    name: 'slug',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Name'),
    placeholder: 'e.g. api-team',
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A unique ID used to identify the team'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('team:write');
    },
    transformInput: sentry_utils_slugify__WEBPACK_IMPORTED_MODULE_1__["default"],
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('You will be redirected to the new team slug after saving')
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/forms/userFeedback.tsx":
/*!*****************************************!*\
  !*** ./app/data/forms/userFeedback.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
// Export route to make these forms searchable by label/help
const route = '/settings/:orgId/projects/:projectId/user-feedback/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Settings',
  fields: [{
    name: 'feedback:branding',
    type: 'boolean',
    // additional data/props that is related to rendering of form field rather than data
    label: 'Show Sentry Branding',
    placeholder: 'e.g. secondary@example.com',
    help: 'Show "powered by Sentry within the feedback dialog. We appreciate you helping get the word out about Sentry! <3',
    getData: data => ({
      options: data
    })
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/data/languages.tsx":
/*!********************************!*\
  !*** ./app/data/languages.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([['ja', 'Japanese'], ['it', 'Italian'], ['zh-tw', 'Traditional Chinese'], ['cs', 'Czech'], ['ru', 'Russian'], ['zh-cn', 'Simplified Chinese'], ['bg', 'Bulgarian'], ['de', 'German'], ['fi', 'Finnish'], ['fr', 'French'], ['es', 'Spanish'], ['en', 'English']]);

/***/ }),

/***/ "./app/data/timezones.tsx":
/*!********************************!*\
  !*** ./app/data/timezones.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ([['Pacific/Midway', '(UTC-1100) Pacific/Midway'], ['Pacific/Niue', '(UTC-1100) Pacific/Niue'], ['Pacific/Pago_Pago', '(UTC-1100) Pacific/Pago_Pago'], ['America/Adak', '(UTC-1000) America/Adak'], ['Pacific/Honolulu', '(UTC-1000) Pacific/Honolulu'], ['Pacific/Johnston', '(UTC-1000) Pacific/Johnston'], ['Pacific/Rarotonga', '(UTC-1000) Pacific/Rarotonga'], ['Pacific/Tahiti', '(UTC-1000) Pacific/Tahiti'], ['US/Hawaii', '(UTC-1000) US/Hawaii'], ['Pacific/Marquesas', '(UTC-0930) Pacific/Marquesas'], ['America/Anchorage', '(UTC-0900) America/Anchorage'], ['America/Juneau', '(UTC-0900) America/Juneau'], ['America/Metlakatla', '(UTC-0900) America/Metlakatla'], ['America/Nome', '(UTC-0900) America/Nome'], ['America/Sitka', '(UTC-0900) America/Sitka'], ['America/Yakutat', '(UTC-0900) America/Yakutat'], ['Pacific/Gambier', '(UTC-0900) Pacific/Gambier'], ['US/Alaska', '(UTC-0900) US/Alaska'], ['America/Dawson', '(UTC-0800) America/Dawson'], ['America/Los_Angeles', '(UTC-0800) America/Los_Angeles'], ['America/Tijuana', '(UTC-0800) America/Tijuana'], ['America/Vancouver', '(UTC-0800) America/Vancouver'], ['America/Whitehorse', '(UTC-0800) America/Whitehorse'], ['Canada/Pacific', '(UTC-0800) Canada/Pacific'], ['Pacific/Pitcairn', '(UTC-0800) Pacific/Pitcairn'], ['US/Pacific', '(UTC-0800) US/Pacific'], ['America/Boise', '(UTC-0700) America/Boise'], ['America/Cambridge_Bay', '(UTC-0700) America/Cambridge_Bay'], ['America/Chihuahua', '(UTC-0700) America/Chihuahua'], ['America/Creston', '(UTC-0700) America/Creston'], ['America/Dawson_Creek', '(UTC-0700) America/Dawson_Creek'], ['America/Denver', '(UTC-0700) America/Denver'], ['America/Edmonton', '(UTC-0700) America/Edmonton'], ['America/Fort_Nelson', '(UTC-0700) America/Fort_Nelson'], ['America/Hermosillo', '(UTC-0700) America/Hermosillo'], ['America/Inuvik', '(UTC-0700) America/Inuvik'], ['America/Mazatlan', '(UTC-0700) America/Mazatlan'], ['America/Ojinaga', '(UTC-0700) America/Ojinaga'], ['America/Phoenix', '(UTC-0700) America/Phoenix'], ['America/Yellowknife', '(UTC-0700) America/Yellowknife'], ['Canada/Mountain', '(UTC-0700) Canada/Mountain'], ['US/Arizona', '(UTC-0700) US/Arizona'], ['US/Mountain', '(UTC-0700) US/Mountain'], ['America/Bahia_Banderas', '(UTC-0600) America/Bahia_Banderas'], ['America/Belize', '(UTC-0600) America/Belize'], ['America/Chicago', '(UTC-0600) America/Chicago'], ['America/Costa_Rica', '(UTC-0600) America/Costa_Rica'], ['America/El_Salvador', '(UTC-0600) America/El_Salvador'], ['America/Guatemala', '(UTC-0600) America/Guatemala'], ['America/Indiana/Knox', '(UTC-0600) America/Indiana/Knox'], ['America/Indiana/Tell_City', '(UTC-0600) America/Indiana/Tell_City'], ['America/Managua', '(UTC-0600) America/Managua'], ['America/Matamoros', '(UTC-0600) America/Matamoros'], ['America/Menominee', '(UTC-0600) America/Menominee'], ['America/Merida', '(UTC-0600) America/Merida'], ['America/Mexico_City', '(UTC-0600) America/Mexico_City'], ['America/Monterrey', '(UTC-0600) America/Monterrey'], ['America/North_Dakota/Beulah', '(UTC-0600) America/North_Dakota/Beulah'], ['America/North_Dakota/Center', '(UTC-0600) America/North_Dakota/Center'], ['America/North_Dakota/New_Salem', '(UTC-0600) America/North_Dakota/New_Salem'], ['America/Rainy_River', '(UTC-0600) America/Rainy_River'], ['America/Rankin_Inlet', '(UTC-0600) America/Rankin_Inlet'], ['America/Regina', '(UTC-0600) America/Regina'], ['America/Resolute', '(UTC-0600) America/Resolute'], ['America/Swift_Current', '(UTC-0600) America/Swift_Current'], ['America/Tegucigalpa', '(UTC-0600) America/Tegucigalpa'], ['America/Winnipeg', '(UTC-0600) America/Winnipeg'], ['Canada/Central', '(UTC-0600) Canada/Central'], ['Pacific/Galapagos', '(UTC-0600) Pacific/Galapagos'], ['US/Central', '(UTC-0600) US/Central'], ['America/Atikokan', '(UTC-0500) America/Atikokan'], ['America/Bogota', '(UTC-0500) America/Bogota'], ['America/Cancun', '(UTC-0500) America/Cancun'], ['America/Cayman', '(UTC-0500) America/Cayman'], ['America/Detroit', '(UTC-0500) America/Detroit'], ['America/Eirunepe', '(UTC-0500) America/Eirunepe'], ['America/Grand_Turk', '(UTC-0500) America/Grand_Turk'], ['America/Guayaquil', '(UTC-0500) America/Guayaquil'], ['America/Havana', '(UTC-0500) America/Havana'], ['America/Indiana/Indianapolis', '(UTC-0500) America/Indiana/Indianapolis'], ['America/Indiana/Marengo', '(UTC-0500) America/Indiana/Marengo'], ['America/Indiana/Petersburg', '(UTC-0500) America/Indiana/Petersburg'], ['America/Indiana/Vevay', '(UTC-0500) America/Indiana/Vevay'], ['America/Indiana/Vincennes', '(UTC-0500) America/Indiana/Vincennes'], ['America/Indiana/Winamac', '(UTC-0500) America/Indiana/Winamac'], ['America/Iqaluit', '(UTC-0500) America/Iqaluit'], ['America/Jamaica', '(UTC-0500) America/Jamaica'], ['America/Kentucky/Louisville', '(UTC-0500) America/Kentucky/Louisville'], ['America/Kentucky/Monticello', '(UTC-0500) America/Kentucky/Monticello'], ['America/Lima', '(UTC-0500) America/Lima'], ['America/Nassau', '(UTC-0500) America/Nassau'], ['America/New_York', '(UTC-0500) America/New_York'], ['America/Nipigon', '(UTC-0500) America/Nipigon'], ['America/Panama', '(UTC-0500) America/Panama'], ['America/Pangnirtung', '(UTC-0500) America/Pangnirtung'], ['America/Port-au-Prince', '(UTC-0500) America/Port-au-Prince'], ['America/Rio_Branco', '(UTC-0500) America/Rio_Branco'], ['America/Thunder_Bay', '(UTC-0500) America/Thunder_Bay'], ['America/Toronto', '(UTC-0500) America/Toronto'], ['Canada/Eastern', '(UTC-0500) Canada/Eastern'], ['Pacific/Easter', '(UTC-0500) Pacific/Easter'], ['US/Eastern', '(UTC-0500) US/Eastern'], ['America/Caracas', '(UTC-0400) America/Caracas'], ['America/Anguilla', '(UTC-0400) America/Anguilla'], ['America/Antigua', '(UTC-0400) America/Antigua'], ['America/Aruba', '(UTC-0400) America/Aruba'], ['America/Barbados', '(UTC-0400) America/Barbados'], ['America/Blanc-Sablon', '(UTC-0400) America/Blanc-Sablon'], ['America/Boa_Vista', '(UTC-0400) America/Boa_Vista'], ['America/Curacao', '(UTC-0400) America/Curacao'], ['America/Dominica', '(UTC-0400) America/Dominica'], ['America/Glace_Bay', '(UTC-0400) America/Glace_Bay'], ['America/Goose_Bay', '(UTC-0400) America/Goose_Bay'], ['America/Grenada', '(UTC-0400) America/Grenada'], ['America/Guadeloupe', '(UTC-0400) America/Guadeloupe'], ['America/Guyana', '(UTC-0400) America/Guyana'], ['America/Halifax', '(UTC-0400) America/Halifax'], ['America/Kralendijk', '(UTC-0400) America/Kralendijk'], ['America/La_Paz', '(UTC-0400) America/La_Paz'], ['America/Lower_Princes', '(UTC-0400) America/Lower_Princes'], ['America/Manaus', '(UTC-0400) America/Manaus'], ['America/Marigot', '(UTC-0400) America/Marigot'], ['America/Martinique', '(UTC-0400) America/Martinique'], ['America/Moncton', '(UTC-0400) America/Moncton'], ['America/Montserrat', '(UTC-0400) America/Montserrat'], ['America/Port_of_Spain', '(UTC-0400) America/Port_of_Spain'], ['America/Porto_Velho', '(UTC-0400) America/Porto_Velho'], ['America/Puerto_Rico', '(UTC-0400) America/Puerto_Rico'], ['America/Santo_Domingo', '(UTC-0400) America/Santo_Domingo'], ['America/St_Barthelemy', '(UTC-0400) America/St_Barthelemy'], ['America/St_Kitts', '(UTC-0400) America/St_Kitts'], ['America/St_Lucia', '(UTC-0400) America/St_Lucia'], ['America/St_Thomas', '(UTC-0400) America/St_Thomas'], ['America/St_Vincent', '(UTC-0400) America/St_Vincent'], ['America/Thule', '(UTC-0400) America/Thule'], ['America/Tortola', '(UTC-0400) America/Tortola'], ['Atlantic/Bermuda', '(UTC-0400) Atlantic/Bermuda'], ['Canada/Atlantic', '(UTC-0400) Canada/Atlantic'], ['America/St_Johns', '(UTC-0330) America/St_Johns'], ['Canada/Newfoundland', '(UTC-0330) Canada/Newfoundland'], ['America/Araguaina', '(UTC-0300) America/Araguaina'], ['America/Argentina/Buenos_Aires', '(UTC-0300) America/Argentina/Buenos_Aires'], ['America/Argentina/Catamarca', '(UTC-0300) America/Argentina/Catamarca'], ['America/Argentina/Cordoba', '(UTC-0300) America/Argentina/Cordoba'], ['America/Argentina/Jujuy', '(UTC-0300) America/Argentina/Jujuy'], ['America/Argentina/La_Rioja', '(UTC-0300) America/Argentina/La_Rioja'], ['America/Argentina/Mendoza', '(UTC-0300) America/Argentina/Mendoza'], ['America/Argentina/Rio_Gallegos', '(UTC-0300) America/Argentina/Rio_Gallegos'], ['America/Argentina/Salta', '(UTC-0300) America/Argentina/Salta'], ['America/Argentina/San_Juan', '(UTC-0300) America/Argentina/San_Juan'], ['America/Argentina/San_Luis', '(UTC-0300) America/Argentina/San_Luis'], ['America/Argentina/Tucuman', '(UTC-0300) America/Argentina/Tucuman'], ['America/Argentina/Ushuaia', '(UTC-0300) America/Argentina/Ushuaia'], ['America/Asuncion', '(UTC-0300) America/Asuncion'], ['America/Bahia', '(UTC-0300) America/Bahia'], ['America/Belem', '(UTC-0300) America/Belem'], ['America/Campo_Grande', '(UTC-0300) America/Campo_Grande'], ['America/Cayenne', '(UTC-0300) America/Cayenne'], ['America/Cuiaba', '(UTC-0300) America/Cuiaba'], ['America/Fortaleza', '(UTC-0300) America/Fortaleza'], ['America/Godthab', '(UTC-0300) America/Godthab'], ['America/Maceio', '(UTC-0300) America/Maceio'], ['America/Miquelon', '(UTC-0300) America/Miquelon'], ['America/Montevideo', '(UTC-0300) America/Montevideo'], ['America/Paramaribo', '(UTC-0300) America/Paramaribo'], ['America/Recife', '(UTC-0300) America/Recife'], ['America/Santarem', '(UTC-0300) America/Santarem'], ['America/Santiago', '(UTC-0300) America/Santiago'], ['America/Sao_Paulo', '(UTC-0300) America/Sao_Paulo'], ['Antarctica/Palmer', '(UTC-0300) Antarctica/Palmer'], ['Antarctica/Rothera', '(UTC-0300) Antarctica/Rothera'], ['Atlantic/Stanley', '(UTC-0300) Atlantic/Stanley'], ['America/Noronha', '(UTC-0200) America/Noronha'], ['Atlantic/South_Georgia', '(UTC-0200) Atlantic/South_Georgia'], ['America/Scoresbysund', '(UTC-0100) America/Scoresbysund'], ['Atlantic/Azores', '(UTC-0100) Atlantic/Azores'], ['Atlantic/Cape_Verde', '(UTC-0100) Atlantic/Cape_Verde'], ['Africa/Abidjan', '(UTC+0000) Africa/Abidjan'], ['Africa/Accra', '(UTC+0000) Africa/Accra'], ['Africa/Bamako', '(UTC+0000) Africa/Bamako'], ['Africa/Banjul', '(UTC+0000) Africa/Banjul'], ['Africa/Bissau', '(UTC+0000) Africa/Bissau'], ['Africa/Casablanca', '(UTC+0000) Africa/Casablanca'], ['Africa/Conakry', '(UTC+0000) Africa/Conakry'], ['Africa/Dakar', '(UTC+0000) Africa/Dakar'], ['Africa/El_Aaiun', '(UTC+0000) Africa/El_Aaiun'], ['Africa/Freetown', '(UTC+0000) Africa/Freetown'], ['Africa/Lome', '(UTC+0000) Africa/Lome'], ['Africa/Monrovia', '(UTC+0000) Africa/Monrovia'], ['Africa/Nouakchott', '(UTC+0000) Africa/Nouakchott'], ['Africa/Ouagadougou', '(UTC+0000) Africa/Ouagadougou'], ['Africa/Sao_Tome', '(UTC+0000) Africa/Sao_Tome'], ['America/Danmarkshavn', '(UTC+0000) America/Danmarkshavn'], ['Antarctica/Troll', '(UTC+0000) Antarctica/Troll'], ['Atlantic/Canary', '(UTC+0000) Atlantic/Canary'], ['Atlantic/Faroe', '(UTC+0000) Atlantic/Faroe'], ['Atlantic/Madeira', '(UTC+0000) Atlantic/Madeira'], ['Atlantic/Reykjavik', '(UTC+0000) Atlantic/Reykjavik'], ['Atlantic/St_Helena', '(UTC+0000) Atlantic/St_Helena'], ['Europe/Dublin', '(UTC+0000) Europe/Dublin'], ['Europe/Guernsey', '(UTC+0000) Europe/Guernsey'], ['Europe/Isle_of_Man', '(UTC+0000) Europe/Isle_of_Man'], ['Europe/Jersey', '(UTC+0000) Europe/Jersey'], ['Europe/Lisbon', '(UTC+0000) Europe/Lisbon'], ['Europe/London', '(UTC+0000) Europe/London'], ['GMT', '(UTC+0000) GMT'], ['UTC', '(UTC+0000) UTC'], ['Africa/Algiers', '(UTC+0100) Africa/Algiers'], ['Africa/Bangui', '(UTC+0100) Africa/Bangui'], ['Africa/Brazzaville', '(UTC+0100) Africa/Brazzaville'], ['Africa/Ceuta', '(UTC+0100) Africa/Ceuta'], ['Africa/Douala', '(UTC+0100) Africa/Douala'], ['Africa/Kinshasa', '(UTC+0100) Africa/Kinshasa'], ['Africa/Lagos', '(UTC+0100) Africa/Lagos'], ['Africa/Libreville', '(UTC+0100) Africa/Libreville'], ['Africa/Luanda', '(UTC+0100) Africa/Luanda'], ['Africa/Malabo', '(UTC+0100) Africa/Malabo'], ['Africa/Ndjamena', '(UTC+0100) Africa/Ndjamena'], ['Africa/Niamey', '(UTC+0100) Africa/Niamey'], ['Africa/Porto-Novo', '(UTC+0100) Africa/Porto-Novo'], ['Africa/Tunis', '(UTC+0100) Africa/Tunis'], ['Arctic/Longyearbyen', '(UTC+0100) Arctic/Longyearbyen'], ['Europe/Amsterdam', '(UTC+0100) Europe/Amsterdam'], ['Europe/Andorra', '(UTC+0100) Europe/Andorra'], ['Europe/Belgrade', '(UTC+0100) Europe/Belgrade'], ['Europe/Berlin', '(UTC+0100) Europe/Berlin'], ['Europe/Bratislava', '(UTC+0100) Europe/Bratislava'], ['Europe/Brussels', '(UTC+0100) Europe/Brussels'], ['Europe/Budapest', '(UTC+0100) Europe/Budapest'], ['Europe/Busingen', '(UTC+0100) Europe/Busingen'], ['Europe/Copenhagen', '(UTC+0100) Europe/Copenhagen'], ['Europe/Gibraltar', '(UTC+0100) Europe/Gibraltar'], ['Europe/Ljubljana', '(UTC+0100) Europe/Ljubljana'], ['Europe/Luxembourg', '(UTC+0100) Europe/Luxembourg'], ['Europe/Madrid', '(UTC+0100) Europe/Madrid'], ['Europe/Malta', '(UTC+0100) Europe/Malta'], ['Europe/Monaco', '(UTC+0100) Europe/Monaco'], ['Europe/Oslo', '(UTC+0100) Europe/Oslo'], ['Europe/Paris', '(UTC+0100) Europe/Paris'], ['Europe/Podgorica', '(UTC+0100) Europe/Podgorica'], ['Europe/Prague', '(UTC+0100) Europe/Prague'], ['Europe/Rome', '(UTC+0100) Europe/Rome'], ['Europe/San_Marino', '(UTC+0100) Europe/San_Marino'], ['Europe/Sarajevo', '(UTC+0100) Europe/Sarajevo'], ['Europe/Skopje', '(UTC+0100) Europe/Skopje'], ['Europe/Stockholm', '(UTC+0100) Europe/Stockholm'], ['Europe/Tirane', '(UTC+0100) Europe/Tirane'], ['Europe/Vaduz', '(UTC+0100) Europe/Vaduz'], ['Europe/Vatican', '(UTC+0100) Europe/Vatican'], ['Europe/Vienna', '(UTC+0100) Europe/Vienna'], ['Europe/Warsaw', '(UTC+0100) Europe/Warsaw'], ['Europe/Zagreb', '(UTC+0100) Europe/Zagreb'], ['Europe/Zurich', '(UTC+0100) Europe/Zurich'], ['Africa/Blantyre', '(UTC+0200) Africa/Blantyre'], ['Africa/Bujumbura', '(UTC+0200) Africa/Bujumbura'], ['Africa/Cairo', '(UTC+0200) Africa/Cairo'], ['Africa/Gaborone', '(UTC+0200) Africa/Gaborone'], ['Africa/Harare', '(UTC+0200) Africa/Harare'], ['Africa/Johannesburg', '(UTC+0200) Africa/Johannesburg'], ['Africa/Juba', '(UTC+0200) Africa/Juba'], ['Africa/Khartoum', '(UTC+0200) Africa/Khartoum'], ['Africa/Kigali', '(UTC+0200) Africa/Kigali'], ['Africa/Lubumbashi', '(UTC+0200) Africa/Lubumbashi'], ['Africa/Lusaka', '(UTC+0200) Africa/Lusaka'], ['Africa/Maputo', '(UTC+0200) Africa/Maputo'], ['Africa/Maseru', '(UTC+0200) Africa/Maseru'], ['Africa/Mbabane', '(UTC+0200) Africa/Mbabane'], ['Africa/Tripoli', '(UTC+0200) Africa/Tripoli'], ['Africa/Windhoek', '(UTC+0200) Africa/Windhoek'], ['Asia/Amman', '(UTC+0200) Asia/Amman'], ['Asia/Beirut', '(UTC+0200) Asia/Beirut'], ['Asia/Damascus', '(UTC+0200) Asia/Damascus'], ['Asia/Gaza', '(UTC+0200) Asia/Gaza'], ['Asia/Hebron', '(UTC+0200) Asia/Hebron'], ['Asia/Jerusalem', '(UTC+0200) Asia/Jerusalem'], ['Asia/Nicosia', '(UTC+0200) Asia/Nicosia'], ['Europe/Athens', '(UTC+0200) Europe/Athens'], ['Europe/Bucharest', '(UTC+0200) Europe/Bucharest'], ['Europe/Chisinau', '(UTC+0200) Europe/Chisinau'], ['Europe/Helsinki', '(UTC+0200) Europe/Helsinki'], ['Europe/Kaliningrad', '(UTC+0200) Europe/Kaliningrad'], ['Europe/Mariehamn', '(UTC+0200) Europe/Mariehamn'], ['Europe/Riga', '(UTC+0200) Europe/Riga'], ['Europe/Sofia', '(UTC+0200) Europe/Sofia'], ['Europe/Tallinn', '(UTC+0200) Europe/Tallinn'], ['Europe/Uzhgorod', '(UTC+0200) Europe/Uzhgorod'], ['Europe/Vilnius', '(UTC+0200) Europe/Vilnius'], ['Europe/Zaporozhye', '(UTC+0200) Europe/Zaporozhye'], ['Africa/Addis_Ababa', '(UTC+0300) Africa/Addis_Ababa'], ['Africa/Asmara', '(UTC+0300) Africa/Asmara'], ['Africa/Dar_es_Salaam', '(UTC+0300) Africa/Dar_es_Salaam'], ['Africa/Djibouti', '(UTC+0300) Africa/Djibouti'], ['Africa/Kampala', '(UTC+0300) Africa/Kampala'], ['Africa/Mogadishu', '(UTC+0300) Africa/Mogadishu'], ['Africa/Nairobi', '(UTC+0300) Africa/Nairobi'], ['Antarctica/Syowa', '(UTC+0300) Antarctica/Syowa'], ['Asia/Aden', '(UTC+0300) Asia/Aden'], ['Asia/Baghdad', '(UTC+0300) Asia/Baghdad'], ['Asia/Bahrain', '(UTC+0300) Asia/Bahrain'], ['Asia/Kuwait', '(UTC+0300) Asia/Kuwait'], ['Asia/Qatar', '(UTC+0300) Asia/Qatar'], ['Asia/Riyadh', '(UTC+0300) Asia/Riyadh'], ['Europe/Istanbul', '(UTC+0300) Europe/Istanbul'], ['Europe/Kiev', '(UTC+0300) Europe/Kiev'], ['Europe/Minsk', '(UTC+0300) Europe/Minsk'], ['Europe/Moscow', '(UTC+0300) Europe/Moscow'], ['Europe/Simferopol', '(UTC+0300) Europe/Simferopol'], ['Indian/Antananarivo', '(UTC+0300) Indian/Antananarivo'], ['Indian/Comoro', '(UTC+0300) Indian/Comoro'], ['Indian/Mayotte', '(UTC+0300) Indian/Mayotte'], ['Asia/Tehran', '(UTC+0330) Asia/Tehran'], ['Asia/Baku', '(UTC+0400) Asia/Baku'], ['Asia/Dubai', '(UTC+0400) Asia/Dubai'], ['Asia/Muscat', '(UTC+0400) Asia/Muscat'], ['Asia/Tbilisi', '(UTC+0400) Asia/Tbilisi'], ['Asia/Yerevan', '(UTC+0400) Asia/Yerevan'], ['Europe/Samara', '(UTC+0400) Europe/Samara'], ['Europe/Volgograd', '(UTC+0400) Europe/Volgograd'], ['Indian/Mahe', '(UTC+0400) Indian/Mahe'], ['Indian/Mauritius', '(UTC+0400) Indian/Mauritius'], ['Indian/Reunion', '(UTC+0400) Indian/Reunion'], ['Asia/Kabul', '(UTC+0430) Asia/Kabul'], ['Antarctica/Mawson', '(UTC+0500) Antarctica/Mawson'], ['Asia/Aqtau', '(UTC+0500) Asia/Aqtau'], ['Asia/Aqtobe', '(UTC+0500) Asia/Aqtobe'], ['Asia/Ashgabat', '(UTC+0500) Asia/Ashgabat'], ['Asia/Dushanbe', '(UTC+0500) Asia/Dushanbe'], ['Asia/Karachi', '(UTC+0500) Asia/Karachi'], ['Asia/Oral', '(UTC+0500) Asia/Oral'], ['Asia/Samarkand', '(UTC+0500) Asia/Samarkand'], ['Asia/Tashkent', '(UTC+0500) Asia/Tashkent'], ['Asia/Yekaterinburg', '(UTC+0500) Asia/Yekaterinburg'], ['Indian/Kerguelen', '(UTC+0500) Indian/Kerguelen'], ['Indian/Maldives', '(UTC+0500) Indian/Maldives'], ['Asia/Colombo', '(UTC+0530) Asia/Colombo'], ['Asia/Kolkata', '(UTC+0530) Asia/Kolkata'], ['Asia/Kathmandu', '(UTC+0545) Asia/Kathmandu'], ['Antarctica/Vostok', '(UTC+0600) Antarctica/Vostok'], ['Asia/Almaty', '(UTC+0600) Asia/Almaty'], ['Asia/Bishkek', '(UTC+0600) Asia/Bishkek'], ['Asia/Dhaka', '(UTC+0600) Asia/Dhaka'], ['Asia/Novosibirsk', '(UTC+0600) Asia/Novosibirsk'], ['Asia/Omsk', '(UTC+0600) Asia/Omsk'], ['Asia/Qyzylorda', '(UTC+0600) Asia/Qyzylorda'], ['Asia/Thimphu', '(UTC+0600) Asia/Thimphu'], ['Asia/Urumqi', '(UTC+0600) Asia/Urumqi'], ['Indian/Chagos', '(UTC+0600) Indian/Chagos'], ['Asia/Rangoon', '(UTC+0630) Asia/Rangoon'], ['Indian/Cocos', '(UTC+0630) Indian/Cocos'], ['Antarctica/Davis', '(UTC+0700) Antarctica/Davis'], ['Asia/Bangkok', '(UTC+0700) Asia/Bangkok'], ['Asia/Ho_Chi_Minh', '(UTC+0700) Asia/Ho_Chi_Minh'], ['Asia/Hovd', '(UTC+0700) Asia/Hovd'], ['Asia/Jakarta', '(UTC+0700) Asia/Jakarta'], ['Asia/Krasnoyarsk', '(UTC+0700) Asia/Krasnoyarsk'], ['Asia/Novokuznetsk', '(UTC+0700) Asia/Novokuznetsk'], ['Asia/Phnom_Penh', '(UTC+0700) Asia/Phnom_Penh'], ['Asia/Pontianak', '(UTC+0700) Asia/Pontianak'], ['Asia/Vientiane', '(UTC+0700) Asia/Vientiane'], ['Indian/Christmas', '(UTC+0700) Indian/Christmas'], ['Antarctica/Casey', '(UTC+0800) Antarctica/Casey'], ['Asia/Brunei', '(UTC+0800) Asia/Brunei'], ['Asia/Choibalsan', '(UTC+0800) Asia/Choibalsan'], ['Asia/Hong_Kong', '(UTC+0800) Asia/Hong_Kong'], ['Asia/Irkutsk', '(UTC+0800) Asia/Irkutsk'], ['Asia/Kuala_Lumpur', '(UTC+0800) Asia/Kuala_Lumpur'], ['Asia/Kuching', '(UTC+0800) Asia/Kuching'], ['Asia/Macau', '(UTC+0800) Asia/Macau'], ['Asia/Makassar', '(UTC+0800) Asia/Makassar'], ['Asia/Manila', '(UTC+0800) Asia/Manila'], ['Asia/Shanghai', '(UTC+0800) Asia/Shanghai'], ['Asia/Singapore', '(UTC+0800) Asia/Singapore'], ['Asia/Taipei', '(UTC+0800) Asia/Taipei'], ['Asia/Ulaanbaatar', '(UTC+0800) Asia/Ulaanbaatar'], ['Australia/Perth', '(UTC+0800) Australia/Perth'], ['Australia/Eucla', '(UTC+0845) Australia/Eucla'], ['Asia/Chita', '(UTC+0900) Asia/Chita'], ['Asia/Dili', '(UTC+0900) Asia/Dili'], ['Asia/Jayapura', '(UTC+0900) Asia/Jayapura'], ['Asia/Khandyga', '(UTC+0900) Asia/Khandyga'], ['Asia/Pyongyang', '(UTC+0900) Asia/Pyongyang'], ['Asia/Seoul', '(UTC+0900) Asia/Seoul'], ['Asia/Tokyo', '(UTC+0900) Asia/Tokyo'], ['Asia/Yakutsk', '(UTC+0900) Asia/Yakutsk'], ['Pacific/Palau', '(UTC+0900) Pacific/Palau'], ['Australia/Darwin', '(UTC+0930) Australia/Darwin'], ['Antarctica/DumontDUrville', '(UTC+1000) Antarctica/DumontDUrville'], ['Asia/Magadan', '(UTC+1000) Asia/Magadan'], ['Asia/Sakhalin', '(UTC+1000) Asia/Sakhalin'], ['Asia/Ust-Nera', '(UTC+1000) Asia/Ust-Nera'], ['Asia/Vladivostok', '(UTC+1000) Asia/Vladivostok'], ['Australia/Brisbane', '(UTC+1000) Australia/Brisbane'], ['Australia/Lindeman', '(UTC+1000) Australia/Lindeman'], ['Pacific/Chuuk', '(UTC+1000) Pacific/Chuuk'], ['Pacific/Guam', '(UTC+1000) Pacific/Guam'], ['Pacific/Port_Moresby', '(UTC+1000) Pacific/Port_Moresby'], ['Pacific/Saipan', '(UTC+1000) Pacific/Saipan'], ['Australia/Adelaide', '(UTC+1030) Australia/Adelaide'], ['Australia/Broken_Hill', '(UTC+1030) Australia/Broken_Hill'], ['Antarctica/Macquarie', '(UTC+1100) Antarctica/Macquarie'], ['Asia/Srednekolymsk', '(UTC+1100) Asia/Srednekolymsk'], ['Australia/Currie', '(UTC+1100) Australia/Currie'], ['Australia/Hobart', '(UTC+1100) Australia/Hobart'], ['Australia/Lord_Howe', '(UTC+1100) Australia/Lord_Howe'], ['Australia/Melbourne', '(UTC+1100) Australia/Melbourne'], ['Australia/Sydney', '(UTC+1100) Australia/Sydney'], ['Pacific/Bougainville', '(UTC+1100) Pacific/Bougainville'], ['Pacific/Efate', '(UTC+1100) Pacific/Efate'], ['Pacific/Guadalcanal', '(UTC+1100) Pacific/Guadalcanal'], ['Pacific/Kosrae', '(UTC+1100) Pacific/Kosrae'], ['Pacific/Norfolk', '(UTC+1100) Pacific/Norfolk'], ['Pacific/Noumea', '(UTC+1100) Pacific/Noumea'], ['Pacific/Pohnpei', '(UTC+1100) Pacific/Pohnpei'], ['Asia/Anadyr', '(UTC+1200) Asia/Anadyr'], ['Asia/Kamchatka', '(UTC+1200) Asia/Kamchatka'], ['Pacific/Funafuti', '(UTC+1200) Pacific/Funafuti'], ['Pacific/Kwajalein', '(UTC+1200) Pacific/Kwajalein'], ['Pacific/Majuro', '(UTC+1200) Pacific/Majuro'], ['Pacific/Nauru', '(UTC+1200) Pacific/Nauru'], ['Pacific/Tarawa', '(UTC+1200) Pacific/Tarawa'], ['Pacific/Wake', '(UTC+1200) Pacific/Wake'], ['Pacific/Wallis', '(UTC+1200) Pacific/Wallis'], ['Antarctica/McMurdo', '(UTC+1300) Antarctica/McMurdo'], ['Pacific/Auckland', '(UTC+1300) Pacific/Auckland'], ['Pacific/Enderbury', '(UTC+1300) Pacific/Enderbury'], ['Pacific/Fakaofo', '(UTC+1300) Pacific/Fakaofo'], ['Pacific/Fiji', '(UTC+1300) Pacific/Fiji'], ['Pacific/Tongatapu', '(UTC+1300) Pacific/Tongatapu'], ['Pacific/Chatham', '(UTC+1345) Pacific/Chatham'], ['Pacific/Apia', '(UTC+1400) Pacific/Apia'], ['Pacific/Kiritimati', '(UTC+1400) Pacific/Kiritimati']]);

/***/ }),

/***/ "./app/stores/formSearchStore.tsx":
/*!****************************************!*\
  !*** ./app/stores/formSearchStore.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");


/**
 * Processed form field metadata.
 */

/**
 * Store for "form" searches, but probably will include more
 */
const storeConfig = {
  searchMap: null,
  unsubscribeListeners: [],

  init() {
    this.reset();
  },

  get() {
    return this.searchMap;
  },

  reset() {
    // `null` means it hasn't been loaded yet
    this.searchMap = null;
  },

  /**
   * Adds to search map
   */
  loadSearchMap(searchMap) {
    // Only load once
    if (this.searchMap !== null) {
      return;
    }

    this.searchMap = searchMap;
    this.trigger(this.searchMap);
  }

};
const FormSearchStore = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_1__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FormSearchStore);

/***/ }),

/***/ "./app/utils/crashReports.tsx":
/*!************************************!*\
  !*** ./app/utils/crashReports.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SettingScope": () => (/* binding */ SettingScope),
/* harmony export */   "formatStoreCrashReports": () => (/* binding */ formatStoreCrashReports),
/* harmony export */   "getStoreCrashReportsValues": () => (/* binding */ getStoreCrashReportsValues)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function formatStoreCrashReports(value, organizationValue) {
  if (value === null && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(organizationValue)) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tct)('Inherit organization settings ([organizationValue])', {
      organizationValue: formatStoreCrashReports(organizationValue)
    });
  }

  if (value === -1) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unlimited');
  }

  if (value === 0) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Disabled');
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.tct)('[value] per issue', {
    value
  });
}
let SettingScope;

(function (SettingScope) {
  SettingScope[SettingScope["Organization"] = 0] = "Organization";
  SettingScope[SettingScope["Project"] = 1] = "Project";
})(SettingScope || (SettingScope = {}));

function getStoreCrashReportsValues(settingScope) {
  const values = [0, // disabled
  1, // limited per issue
  5, 10, 20, 50, 100, -1 // unlimited
  ];

  if (settingScope === SettingScope.Project) {
    values.unshift(null); // inherit option
  }

  return values;
}

/***/ }),

/***/ "./app/utils/fuzzySearch.tsx":
/*!***********************************!*\
  !*** ./app/utils/fuzzySearch.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createFuzzySearch": () => (/* binding */ createFuzzySearch)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);


// See http://fusejs.io/ for more information
const DEFAULT_FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4,
  location: 0,
  distance: 75,
  minMatchCharLength: 2
};
async function createFuzzySearch(objects, options) {
  if (!options.keys) {
    throw new Error('You need to define `options.keys`');
  }

  const fuseImported = await __webpack_require__.e(/*! import() */ "vendors-node_modules_fuse_js_dist_fuse_esm_js").then(__webpack_require__.bind(__webpack_require__, /*! fuse.js */ "../node_modules/fuse.js/dist/fuse.esm.js"));
  const fuse = {
    Fuse: fuseImported.default
  };
  return new fuse.Fuse(objects, { ...DEFAULT_FUSE_OPTIONS,
    ...options
  });
} // re-export fuse type to make it easier to use

/***/ }),

/***/ "./app/utils/highlightFuseMatches.tsx":
/*!********************************************!*\
  !*** ./app/utils/highlightFuseMatches.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getFuseMatches": () => (/* binding */ getFuseMatches)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



/**
 * Parses matches from fuse.js library
 *
 * Example `match` would be
 *
 *   {
 *    value: 'Authentication tokens allow you to perform actions',
 *    indices: [[4, 6], [12, 13], [15, 16]],
 *   }
 *
 * So:
 *
 *   00-03 -> not highlighted,
 *   04-06 -> highlighted,
 *   07-11 -> not highlighted,
 *   12-13 -> highlighted,
 *   ...etc
 *
 * @param match The match object from fuse
 * @param match.value The entire string that has matches
 * @param match.indices Array of indices that represent matches
 */
const getFuseMatches = _ref => {
  let {
    value,
    indices
  } = _ref;

  if (value === undefined) {
    return [];
  }

  if (indices.length === 0) {
    return [{
      highlight: false,
      text: value
    }];
  }

  const strLength = value.length;
  const result = [];
  let prev = [0, -1];
  indices.forEach(_ref2 => {
    let [start, end] = _ref2;
    // Unhighlighted string before the match
    const stringBeforeMatch = value.substring(prev[1] + 1, start); // Only add to result if non-empty string

    if (!!stringBeforeMatch) {
      result.push({
        highlight: false,
        text: stringBeforeMatch
      });
    } // This is the matched string, which should be highlighted


    const matchedString = value.substring(start, end + 1);
    result.push({
      highlight: true,
      text: matchedString
    });
    prev = [start, end];
  }); // The rest of the string starting from the last match index

  const restOfString = value.substring(prev[1] + 1, strLength); // Only add to result if non-empty string

  if (!!restOfString) {
    result.push({
      highlight: false,
      text: restOfString
    });
  }

  return result;
};
/**
 * Given a match object from fuse.js, returns an array of components with
 * "highlighted" (bold) substrings.
 */


const highlightFuseMatches = function (matchObj) {
  let Marker = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'mark';
  return getFuseMatches(matchObj).map((_ref3, index) => {
    let {
      highlight,
      text
    } = _ref3;

    if (!text) {
      return null;
    }

    if (highlight) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(Marker, {
        children: text
      }, index);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("span", {
      children: text
    }, index);
  });
};


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (highlightFuseMatches);

/***/ }),

/***/ "./app/utils/slugify.tsx":
/*!*******************************!*\
  !*** ./app/utils/slugify.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ slugify)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);

// XXX: This is NOT an exhaustive slugify function
// Only forces lowercase and replaces spaces with hyphens
function slugify(str) {
  return typeof str === 'string' ? str.toLowerCase().replace(' ', '-') : '';
}

/***/ }),

/***/ "./app/utils/withLatestContext.tsx":
/*!*****************************************!*\
  !*** ./app/utils/withLatestContext.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/latestContextStore */ "./app/stores/latestContextStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganizations */ "./app/utils/withOrganizations.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const fallbackContext = {
  organization: null,
  project: null
};

function withLatestContext(WrappedComponent) {
  class WithLatestContext extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        latestContext: sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__["default"].get()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_latestContextStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(latestContext => this.setState({
        latestContext
      }), undefined));
    }

    componentWillUmount() {
      this.unsubscribe();
    }

    render() {
      const {
        organizations
      } = this.props;
      const {
        latestContext
      } = this.state;
      const {
        organization,
        project
      } = latestContext || fallbackContext; // Even though org details exists in LatestContextStore,
      // fetch organization from OrganizationsStore so that we can
      // expect consistent data structure because OrganizationsStore has a list
      // of orgs but not full org details

      const latestOrganization = organization || (organizations && organizations.length ? organizations.find(_ref => {
        let {
          slug
        } = _ref;
        return slug === sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('lastOrganization');
      }) || organizations[0] : null); // TODO(billy): Below is going to be wrong if component is passed project, it will override
      // project from `latestContext`

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(WrappedComponent, {
        project: project,
        ...this.props,
        organization: this.props.organization || latestOrganization
      });
    }

  }

  WithLatestContext.displayName = "WithLatestContext";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithLatestContext, "displayName", `withLatestContext(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_5__["default"])(WrappedComponent)})`);

  return (0,sentry_utils_withOrganizations__WEBPACK_IMPORTED_MODULE_6__["default"])(WithLatestContext);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withLatestContext);

/***/ }),

/***/ "./app/views/settings/account/navigationConfiguration.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/account/navigationConfiguration.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");



const pathPrefix = '/settings/account';

function getConfiguration(_ref) {
  let {
    organization
  } = _ref;
  return [{
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Account'),
    items: [{
      path: `${pathPrefix}/details/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Account Details'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Change your account details and preferences (e.g. timezone/clock, avatar, language)')
    }, {
      path: `${pathPrefix}/security/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Security'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Change your account password and/or two factor authentication')
    }, {
      path: `${pathPrefix}/notifications/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Notifications'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Configure what email notifications to receive')
    }, {
      path: `${pathPrefix}/emails/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Email Addresses'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Add or remove secondary emails, change your primary email, verify your emails')
    }, {
      path: `${pathPrefix}/subscriptions/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Subscriptions'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Change Sentry marketing subscriptions you are subscribed to (GDPR)')
    }, {
      path: `${pathPrefix}/authorizations/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Authorized Applications'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Manage third-party applications that have access to your Sentry account')
    }, {
      path: `${pathPrefix}/identities/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Identities'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Manage your third-party identities that are associated to Sentry')
    }, {
      path: `${pathPrefix}/close-account/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Close Account'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Permanently close your Sentry account')
    }]
  }, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('API'),
    items: [{
      path: `${pathPrefix}/api/applications/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Applications'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Add and configure OAuth2 applications')
    }, {
      path: `${pathPrefix}/api/auth-tokens/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Auth Tokens'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)("Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API.")
    }, ...sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('settings:api-navigation-config').flatMap(cb => cb(organization))]
  }];
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (getConfiguration);

/***/ }),

/***/ "./app/views/settings/organization/navigationConfiguration.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/settings/organization/navigationConfiguration.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const pathPrefix = '/settings/:orgId';
const organizationNavigation = [{
  name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Organization'),
  items: [{
    path: `${pathPrefix}/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('General Settings'),
    index: true,
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Configure general settings for an organization'),
    id: 'general'
  }, {
    path: `${pathPrefix}/projects/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Projects'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("View and manage an organization's projects"),
    id: 'projects'
  }, {
    path: `${pathPrefix}/teams/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Teams'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("Manage an organization's teams"),
    id: 'teams'
  }, {
    path: `${pathPrefix}/members/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Members'),
    show: _ref => {
      let {
        access
      } = _ref;
      return access.has('member:read');
    },
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Manage user membership for an organization'),
    id: 'members'
  }, {
    path: `${pathPrefix}/security-and-privacy/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Security & Privacy'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'),
    id: 'security-and-privacy'
  }, {
    path: `${pathPrefix}/auth/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Auth'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Configure single sign-on'),
    id: 'sso'
  }, {
    path: `${pathPrefix}/api-keys/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('API Keys'),
    show: _ref2 => {
      let {
        access,
        features
      } = _ref2;
      return features.has('api-keys') && access.has('org:admin');
    },
    id: 'api-keys'
  }, {
    path: `${pathPrefix}/audit-log/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Audit Log'),
    show: _ref3 => {
      let {
        access
      } = _ref3;
      return access.has('org:write');
    },
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('View the audit log for an organization'),
    id: 'audit-log'
  }, {
    path: `${pathPrefix}/rate-limits/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Rate Limits'),
    show: _ref4 => {
      let {
        access,
        features
      } = _ref4;
      return features.has('legacy-rate-limits') && access.has('org:write');
    },
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Configure rate limits for all projects in the organization'),
    id: 'rate-limits'
  }, {
    path: `${pathPrefix}/relay/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Relay'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Manage relays connected to the organization'),
    id: 'relay'
  }, {
    path: `${pathPrefix}/repos/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Repositories'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Manage repositories connected to the organization'),
    id: 'repos'
  }, {
    path: `${pathPrefix}/integrations/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Integrations'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Manage organization-level integrations, including: Slack, Github, Bitbucket, Jira, and Azure DevOps'),
    id: 'integrations',
    recordAnalytics: true
  }, {
    path: `${pathPrefix}/developer-settings/`,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Developer Settings'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Manage developer applications'),
    id: 'developer-settings'
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (organizationNavigation);

/***/ }),

/***/ "./app/views/settings/project/navigationConfiguration.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/project/navigationConfiguration.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getConfiguration)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const pathPrefix = '/settings/:orgId/projects/:projectId';
function getConfiguration(_ref) {
  let {
    project,
    organization,
    debugFilesNeedsReview
  } = _ref;
  const plugins = (project && project.plugins || []).filter(plugin => plugin.enabled);
  return [{
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Project'),
    items: [{
      path: `${pathPrefix}/`,
      index: true,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('General Settings'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Configure general settings for a project')
    }, {
      path: `${pathPrefix}/teams/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Project Teams'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Manage team access for a project')
    }, {
      path: `${pathPrefix}/alerts/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Alert Settings'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Project alert settings')
    }, {
      path: `${pathPrefix}/tags/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Tags'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("View and manage a  project's tags")
    }, {
      path: `${pathPrefix}/environments/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Environments'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Manage environments in a project')
    }, {
      path: `${pathPrefix}/ownership/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Issue Owners'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Manage issue ownership rules for a project')
    }, {
      path: `${pathPrefix}/data-forwarding/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Data Forwarding')
    }]
  }, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Processing'),
    items: [{
      path: `${pathPrefix}/filters/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Inbound Filters'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("Configure a project's inbound filters (e.g. browsers, messages)")
    }, {
      path: `${pathPrefix}/server-side-sampling/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Server-Side Sampling'),
      show: () => {
        var _organization$feature, _organization$feature2;

        return !!(organization !== null && organization !== void 0 && (_organization$feature = organization.features) !== null && _organization$feature !== void 0 && _organization$feature.includes('server-side-sampling')) && !!(organization !== null && organization !== void 0 && (_organization$feature2 = organization.features) !== null && _organization$feature2 !== void 0 && _organization$feature2.includes('server-side-sampling-ui'));
      },
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("Per-Project basis solution to configure sampling rules within Sentry's UI"),
      // hack to make the badge fit next to Server-Side Sampling
      badge: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(NarrowFeatureBadge, {
        type: "beta"
      })
    }, {
      path: `${pathPrefix}/security-and-privacy/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Security & Privacy'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing) for a project')
    }, {
      path: `${pathPrefix}/issue-grouping/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Issue Grouping')
    }, {
      path: `${pathPrefix}/processing-issues/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Processing Issues'),
      // eslint-disable-next-line @typescript-eslint/no-shadow
      badge: _ref2 => {
        let {
          project
        } = _ref2;

        if (!project) {
          return null;
        }

        if (project.processingIssues <= 0) {
          return null;
        }

        return project.processingIssues > 99 ? '99+' : project.processingIssues;
      }
    }, {
      path: `${pathPrefix}/debug-symbols/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Debug Files'),
      badge: debugFilesNeedsReview ? () => 'warning' : undefined
    }, {
      path: `${pathPrefix}/proguard/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('ProGuard')
    }, {
      path: `${pathPrefix}/source-maps/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Source Maps')
    }, {
      path: `${pathPrefix}/performance/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Performance'),
      show: () => {
        var _organization$feature3;

        return !!(organization !== null && organization !== void 0 && (_organization$feature3 = organization.features) !== null && _organization$feature3 !== void 0 && _organization$feature3.includes('performance-view'));
      }
    }]
  }, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('SDK Setup'),
    items: [{
      path: `${pathPrefix}/install/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Instrumentation')
    }, {
      path: `${pathPrefix}/keys/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Client Keys (DSN)'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("View and manage the project's client keys (DSN)")
    }, {
      path: `${pathPrefix}/release-tracking/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Releases')
    }, {
      path: `${pathPrefix}/security-headers/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Security Headers')
    }, {
      path: `${pathPrefix}/user-feedback/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('User Feedback'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Configure user feedback reporting feature')
    }]
  }, {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Legacy Integrations'),
    items: [{
      path: `${pathPrefix}/plugins/`,
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Legacy Integrations'),
      description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('View, enable, and disable all integrations for a project'),
      id: 'legacy_integrations',
      recordAnalytics: true
    }, ...plugins.map(plugin => ({
      path: `${pathPrefix}/plugins/${plugin.id}/`,
      title: plugin.name,
      show: opts => {
        var _opts$access;

        return (opts === null || opts === void 0 ? void 0 : (_opts$access = opts.access) === null || _opts$access === void 0 ? void 0 : _opts$access.has('project:write')) && !plugin.isDeprecated;
      },
      id: 'plugin_details',
      recordAnalytics: true
    }))]
  }];
}

const NarrowFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1ctra3l0"
} : 0)( true ? {
  name: "wmdjod",
  styles: "max-width:25px"
} : 0);

/***/ }),

/***/ "./app/data/forms sync recursive \\.[tj]sx?$":
/*!*****************************************!*\
  !*** ./app/data/forms/ sync \.[tj]sx?$ ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var map = {
	"./accountDetails.tsx": "./app/data/forms/accountDetails.tsx",
	"./accountEmails.tsx": "./app/data/forms/accountEmails.tsx",
	"./accountNotificationSettings.tsx": "./app/data/forms/accountNotificationSettings.tsx",
	"./accountPassword.tsx": "./app/data/forms/accountPassword.tsx",
	"./accountPreferences.tsx": "./app/data/forms/accountPreferences.tsx",
	"./apiApplication.tsx": "./app/data/forms/apiApplication.tsx",
	"./cspReports.tsx": "./app/data/forms/cspReports.tsx",
	"./inboundFilters.tsx": "./app/data/forms/inboundFilters.tsx",
	"./organizationGeneralSettings.tsx": "./app/data/forms/organizationGeneralSettings.tsx",
	"./organizationSecurityAndPrivacyGroups.tsx": "./app/data/forms/organizationSecurityAndPrivacyGroups.tsx",
	"./processingIssues.tsx": "./app/data/forms/processingIssues.tsx",
	"./projectAlerts.tsx": "./app/data/forms/projectAlerts.tsx",
	"./projectGeneralSettings.tsx": "./app/data/forms/projectGeneralSettings.tsx",
	"./projectIssueGrouping.tsx": "./app/data/forms/projectIssueGrouping.tsx",
	"./projectSecurityAndPrivacyGroups.tsx": "./app/data/forms/projectSecurityAndPrivacyGroups.tsx",
	"./sentryApplication.tsx": "./app/data/forms/sentryApplication.tsx",
	"./teamSettingsFields.tsx": "./app/data/forms/teamSettingsFields.tsx",
	"./userFeedback.tsx": "./app/data/forms/userFeedback.tsx"
};


function webpackContext(req) {
	var id = webpackContextResolve(req);
	return __webpack_require__(id);
}
function webpackContextResolve(req) {
	if(!__webpack_require__.o(map, req)) {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	}
	return map[req];
}
webpackContext.keys = function webpackContextKeys() {
	return Object.keys(map);
};
webpackContext.resolve = webpackContextResolve;
module.exports = webpackContext;
webpackContext.id = "./app/data/forms sync recursive \\.[tj]sx?$";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_search_index_tsx.11532ef81de867a2c751d9c553d10c8d.js.map