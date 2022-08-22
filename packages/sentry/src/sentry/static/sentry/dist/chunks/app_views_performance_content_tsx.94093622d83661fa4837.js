"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_content_tsx"],{

/***/ "./app/components/performance/layouts/index.tsx":
/*!******************************************************!*\
  !*** ./app/components/performance/layouts/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceLayoutBodyRow": () => (/* binding */ PerformanceLayoutBodyRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


/**
 * Common performance layouts
 */

const PerformanceLayoutBodyRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e13nlx020"
} : 0)("display:grid;grid-template-columns:1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(2, 1fr);}@media (min-width: ", p => p.theme.breakpoints.large, "){", p => p.columns ? `
    grid-template-columns: repeat(${p.columns}, 1fr);
    ` : `
    grid-template-columns: repeat(auto-fit, minmax(${p.minSize}px, 1fr));
    `, ";}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/performance/searchBar.tsx":
/*!**************************************************!*\
  !*** ./app/components/performance/searchBar.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _smartSearchBar_searchDropdown__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../smartSearchBar/searchDropdown */ "./app/components/smartSearchBar/searchDropdown.tsx");
/* harmony import */ var _smartSearchBar_types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../smartSearchBar/types */ "./app/components/smartSearchBar/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















function SearchBar(props) {
  var _searchResults$;

  const {
    organization,
    eventView: _eventView,
    onSearch,
    query: searchQuery
  } = props;
  const [searchResults, setSearchResults] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)([]);
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(false);
  const [searchString, setSearchString] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(searchQuery);
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__["default"])();

  const eventView = _eventView.clone();

  const prepareQuery = query => {
    const prependedChar = query[0] === '*' ? '' : '*';
    const appendedChar = query[query.length - 1] === '*' ? '' : '*';
    return `${prependedChar}${query}${appendedChar}`;
  };

  const getSuggestedTransactions = lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()(async query => {
    var _eventView$project;

    if (query.length === 0) {
      onSearch('');
    }

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearchString(query);
    const projectIdStrings = (_eventView$project = eventView.project) === null || _eventView$project === void 0 ? void 0 : _eventView$project.map(String);

    try {
      setLoading(true);
      const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_11__.MutableSearch('');
      conditions.addFilterValues('transaction', [prepareQuery(query)], false);
      conditions.addFilterValues('event.type', ['transaction']); // clear any active requests

      if (Object.keys(api.activeRequests).length) {
        api.clear();
      }

      const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
      const url = useEvents ? `/organizations/${organization.slug}/events/` : `/organizations/${organization.slug}/eventsv2/`;
      const [results] = await (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_10__.doDiscoverQuery)(api, url, {
        field: ['transaction', 'project_id', 'count()'],
        project: projectIdStrings,
        sort: '-count()',
        query: conditions.formatString(),
        statsPeriod: eventView.statsPeriod,
        referrer: 'api.performance.transaction-name-search-bar'
      });
      const parsedResults = results.data.reduce((searchGroup, item) => {
        searchGroup.children.push({
          value: `${item.transaction}:${item.project_id}`,
          title: item.transaction,
          type: _smartSearchBar_types__WEBPACK_IMPORTED_MODULE_15__.ItemType.LINK,
          desc: ''
        });
        return searchGroup;
      }, {
        title: 'All Transactions',
        children: [],
        icon: null,
        type: 'header'
      });
      setSearchResults([parsedResults]);
    } catch (_) {
      throw new Error('Unable to fetch event field values');
    } finally {
      setLoading(false);
    }
  }, sentry_constants__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_DEBOUNCE_DURATION, {
    leading: true
  });

  const handleSearch = query => {
    const lastIndex = query.lastIndexOf(':');
    const transactionName = query.slice(0, lastIndex);
    setSearchResults([]);
    setSearchString(transactionName);
    onSearch(`transaction:${transactionName}`);
  };

  const navigateToTransactionSummary = name => {
    const lastIndex = name.lastIndexOf(':');
    const transactionName = name.slice(0, lastIndex);
    const projectId = name.slice(lastIndex + 1);
    const query = eventView.generateQueryStringObject();
    setSearchResults([]);
    const next = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_13__.transactionSummaryRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: String(transactionName),
      projectID: projectId,
      query
    });
    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(next);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Container, {
    "data-test-id": "transaction-search-bar",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Search Transactions'),
      onChange: getSuggestedTransactions,
      query: searchString
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_smartSearchBar_searchDropdown__WEBPACK_IMPORTED_MODULE_14__["default"], {
      css: /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.css)({
        display: (_searchResults$ = searchResults[0]) !== null && _searchResults$ !== void 0 && _searchResults$.children.length ? 'block' : 'none',
        maxHeight: '300px',
        overflowY: 'auto'
      },  true ? "" : 0,  true ? "" : 0),
      searchSubstring: searchString,
      loading: loading,
      items: searchResults,
      onClick: handleSearch,
      onIconClick: navigateToTransactionSummary
    })]
  });
}

SearchBar.displayName = "SearchBar";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8fo1u0"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchBar);

/***/ }),

/***/ "./app/components/searchBar.tsx":
/*!**************************************!*\
  !*** ./app/components/searchBar.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons/iconClose */ "./app/icons/iconClose.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function SearchBar(_ref) {
  let {
    query: queryProp,
    defaultQuery = '',
    onChange,
    onSearch,
    width,
    size,
    className,
    ...inputProps
  } = _ref;
  const inputRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const [query, setQuery] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(queryProp !== null && queryProp !== void 0 ? queryProp : defaultQuery);
  const onQueryChange = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(e => {
    const {
      value
    } = e.target;
    setQuery(value);
    onChange === null || onChange === void 0 ? void 0 : onChange(value);
  }, [onChange]);
  const onSubmit = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(e => {
    var _inputRef$current;

    e.preventDefault();
    (_inputRef$current = inputRef.current) === null || _inputRef$current === void 0 ? void 0 : _inputRef$current.blur();
    onSearch === null || onSearch === void 0 ? void 0 : onSearch(query);
  }, [onSearch, query]);
  const clearSearch = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setQuery('');
    onChange === null || onChange === void 0 ? void 0 : onChange('');
    onSearch === null || onSearch === void 0 ? void 0 : onSearch('');
  }, [onChange, onSearch]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FormWrap, {
    onSubmit: onSubmit,
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledInput, { ...inputProps,
      ref: inputRef,
      type: "text",
      name: "query",
      autoComplete: "off",
      value: query,
      onChange: onQueryChange,
      width: width,
      size: size,
      showClearButton: !!query
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledIconSearch, {
      color: "subText",
      size: size === 'xs' ? 'xs' : 'sm',
      inputSize: size
    }), !!query && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SearchClearButton, {
      type: "button",
      priority: "link",
      onClick: clearSearch,
      size: "xs",
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons_iconClose__WEBPACK_IMPORTED_MODULE_7__.IconClose, {
        size: "xs"
      }),
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Clear'),
      inputSize: size
    })]
  });
}

SearchBar.displayName = "SearchBar";

const FormWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('form',  true ? {
  target: "e4xnwji3"
} : 0)( true ? {
  name: "4bgdod",
  styles: "display:block;position:relative"
} : 0);

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e4xnwji2"
} : 0)("width:", p => p.width ? p.width : undefined, ";padding-left:", p => {
  var _p$size;

  return `calc(
    ${p.theme.formPadding[(_p$size = p.size) !== null && _p$size !== void 0 ? _p$size : 'md'].paddingLeft}px * 1.5 +
    ${p.theme.iconSizes.sm}
  )`;
}, ";", p => {
  var _p$size2;

  return p.showClearButton && `
      padding-right: calc(
        ${p.theme.formPadding[(_p$size2 = p.size) !== null && _p$size2 !== void 0 ? _p$size2 : 'md'].paddingRight}px * 1.5 +
        ${p.theme.iconSizes.xs}
      );
    `;
}, ";" + ( true ? "" : 0));

const StyledIconSearch = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconSearch,  true ? {
  shouldForwardProp: prop => typeof prop === 'string' && (0,_emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_3__["default"])(prop),
  target: "e4xnwji1"
} : 0)("position:absolute;top:50%;left:", p => {
  var _p$inputSize;

  return p.theme.formPadding[(_p$inputSize = p.inputSize) !== null && _p$inputSize !== void 0 ? _p$inputSize : 'md'].paddingLeft;
}, "px;transform:translateY(-50%);pointer-events:none;" + ( true ? "" : 0));

const SearchClearButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e4xnwji0"
} : 0)("position:absolute;top:50%;transform:translateY(-50%);right:", p => {
  var _p$inputSize2;

  return p.theme.formPadding[(_p$inputSize2 = p.inputSize) !== null && _p$inputSize2 !== void 0 ? _p$inputSize2 : 'md'].paddingRight;
}, "px;font-size:", p => p.theme.fontSizeLarge, ";color:", p => p.theme.subText, ";&:hover{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SearchBar);

/***/ }),

/***/ "./app/utils/performance/contexts/performanceDisplayContext.tsx":
/*!**********************************************************************!*\
  !*** ./app/utils/performance/contexts/performanceDisplayContext.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceDisplayProvider": () => (/* binding */ PerformanceDisplayProvider),
/* harmony export */   "usePerformanceDisplayType": () => (/* binding */ usePerformanceDisplayType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");


const [PerformanceDisplayProvider, _usePerformanceDisplayType] = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.createDefinedContext)({
  name: 'CurrentPerformanceViewContext'
});

function usePerformanceDisplayType() {
  return _usePerformanceDisplayType().performanceType;
}

/***/ }),

/***/ "./app/views/performance/content.tsx":
/*!*******************************************!*\
  !*** ./app/views/performance/content.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/usePrevious */ "./app/utils/usePrevious.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./data */ "./app/views/performance/data.tsx");
/* harmony import */ var _landing__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./landing */ "./app/views/performance/landing/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

























function PerformanceContent(_ref) {
  let {
    selection,
    location,
    demoMode,
    router
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_17__["default"])();
  const mounted = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(false);
  const previousDateTime = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_16__["default"])(selection.datetime);
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)({
    error: undefined
  });
  const withStaticFilters = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_12__.canUseMetricsData)(organization);
  const eventView = (0,_data__WEBPACK_IMPORTED_MODULE_19__.generatePerformanceEventView)(location, projects, {
    withStaticFilters
  });

  function getOnboardingProject() {
    // XXX used by getsentry to bypass onboarding for the upsell demo state.
    if (demoMode) {
      return undefined;
    }

    if (projects.length === 0) {
      return undefined;
    } // Current selection is 'my projects' or 'all projects'


    if (eventView.project.length === 0 || eventView.project === [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_9__.ALL_ACCESS_PROJECTS]) {
      const filtered = projects.filter(p => p.firstTransactionEvent === false);

      if (filtered.length === projects.length) {
        return filtered[0];
      }
    } // Any other subset of projects.


    const filtered = projects.filter(p => eventView.project.includes(parseInt(p.id, 10)) && p.firstTransactionEvent === false);

    if (filtered.length === eventView.project.length) {
      return filtered[0];
    }

    return undefined;
  }

  const onboardingProject = getOnboardingProject();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (!mounted.current) {
      const selectedProjects = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getSelectedProjectPlatforms)(location, projects);
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('performance_views.overview.view', {
        organization,
        show_onboarding: onboardingProject !== undefined,
        project_platforms: selectedProjects
      });
      (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_6__.loadOrganizationTags)(api, organization.slug, selection);
      (0,_utils__WEBPACK_IMPORTED_MODULE_21__.addRoutePerformanceContext)(selection);
      mounted.current = true;
      return;
    }

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(previousDateTime, selection.datetime)) {
      (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_6__.loadOrganizationTags)(api, organization.slug, selection);
      (0,_utils__WEBPACK_IMPORTED_MODULE_21__.addRoutePerformanceContext)(selection);
    }
  }, [selection.datetime, previousDateTime, selection, api, organization, onboardingProject, location, projects]);

  function setError(newError) {
    if (typeof newError === 'object' || Array.isArray(newError) && typeof newError[0] === 'object') {
      _sentry_react__WEBPACK_IMPORTED_MODULE_22__.withScope(scope => {
        scope.setExtra('error', newError);
        _sentry_react__WEBPACK_IMPORTED_MODULE_22__.captureException(new Error('setError failed with error type.'));
      });
      return;
    }

    setState({ ...state,
      error: newError
    });
  }

  function handleSearch(searchQuery, currentMEPState) {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('performance_views.overview.search', {
      organization
    });
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
      pathname: location.pathname,
      query: { ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
        [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_12__.METRIC_SEARCH_SETTING_PARAM]: currentMEPState,
        isDefaultQuery: false
      }
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_8__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Performance'),
    orgSlug: organization.slug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_13__.PerformanceEventViewProvider, {
      value: {
        eventView
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_7__["default"], {
        defaultSelection: {
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: _data__WEBPACK_IMPORTED_MODULE_19__.DEFAULT_STATS_PERIOD
          }
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_landing__WEBPACK_IMPORTED_MODULE_20__.PerformanceLanding, {
          router: router,
          eventView: eventView,
          setError: setError,
          handleSearch: handleSearch,
          handleTrendsClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_21__.handleTrendsClick)({
            location,
            organization,
            projectPlatforms: (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getSelectedProjectPlatforms)(location, projects)
          }),
          onboardingProject: onboardingProject,
          organization: organization,
          location: location,
          projects: projects,
          selection: selection,
          withStaticFilters: withStaticFilters
        })
      })
    })
  });
}

PerformanceContent.displayName = "PerformanceContent";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_18__["default"])(PerformanceContent));

/***/ }),

/***/ "./app/views/performance/landing/chart/histogramChart.tsx":
/*!****************************************************************!*\
  !*** ./app/views/performance/landing/chart/histogramChart.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Chart": () => (/* binding */ Chart),
/* harmony export */   "HistogramChart": () => (/* binding */ HistogramChart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/barChartZoom */ "./app/components/charts/barChartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons/iconWarning */ "./app/icons/iconWarning.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/histogram/histogramQuery */ "./app/utils/performance/histogram/histogramQuery.tsx");
/* harmony import */ var sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/histogram/utils */ "./app/utils/performance/histogram/utils.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../../styles */ "./app/views/performance/styles.tsx");
/* harmony import */ var _display_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../display/utils */ "./app/views/performance/landing/display/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















const NUM_BUCKETS = 50;
const PRECISION = 0;
function HistogramChart(props) {
  const {
    location,
    onFilterChange,
    organization,
    eventView,
    field,
    title,
    titleTooltip,
    didReceiveMultiAxis,
    backupField,
    usingBackupAxis
  } = props;

  const _backupField = backupField ? [backupField] : [];

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_17__.DoubleHeaderContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.HeaderTitleLegend, {
        children: [title, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
          position: "top",
          size: "sm",
          title: titleTooltip
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_15__["default"], {
      location: location,
      orgSlug: organization.slug,
      eventView: eventView,
      numBuckets: NUM_BUCKETS,
      precision: PRECISION,
      fields: [field, ..._backupField],
      dataFilter: "exclude_outliers",
      didReceiveMultiAxis: didReceiveMultiAxis,
      children: results => {
        var _results$histograms;

        const _field = usingBackupAxis ? (0,_display_utils__WEBPACK_IMPORTED_MODULE_18__.getFieldOrBackup)(field, backupField) : field;

        const isLoading = results.isLoading;
        const isErrored = results.error !== null;
        const chartData = (_results$histograms = results.histograms) === null || _results$histograms === void 0 ? void 0 : _results$histograms[_field];

        if (isErrored) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
            height: "250px",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons_iconWarning__WEBPACK_IMPORTED_MODULE_10__.IconWarning, {
              color: "gray300",
              size: "lg"
            })
          });
        }

        if (!chartData) {
          return null;
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Chart, {
          isLoading: isLoading,
          isErrored: isErrored,
          chartData: chartData,
          location: location,
          onFilterChange: onFilterChange,
          field: _field
        });
      }
    })]
  });
}
HistogramChart.displayName = "HistogramChart";
function Chart(props) {
  const {
    isLoading,
    isErrored,
    chartData,
    location,
    field,
    onFilterChange,
    height,
    grid,
    disableXAxis,
    disableZoom,
    disableChartPadding,
    colors
  } = props;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_20__.a)();

  if (!chartData) {
    return null;
  }

  const series = {
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Count'),
    data: (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_16__.formatHistogramData)(chartData, {
      type: 'duration'
    })
  };
  const xAxis = {
    type: 'category',
    truncate: true,
    axisTick: {
      alignWithLabel: true
    }
  };
  const allSeries = [];

  if (!isLoading && !isErrored) {
    allSeries.push(series);
  }

  const yAxis = {
    type: 'value',
    axisLabel: {
      color: theme.chartLabel,
      formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatAbbreviatedNumber
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_4__["default"], {
      minZoomWidth: 10 ** -PRECISION * NUM_BUCKETS,
      location: location,
      paramStart: `${field}:>=`,
      paramEnd: `${field}:<=`,
      xAxisIndex: [0],
      buckets: (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_16__.computeBuckets)(chartData),
      onHistoryPush: onFilterChange,
      children: zoomRenderProps => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(BarChartContainer, {
          hasPadding: !disableChartPadding,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(MaskContainer, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_7__["default"], {
              visible: isLoading
            }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_14__["default"])({
              value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_3__.BarChart, {
                height: height !== null && height !== void 0 ? height : 250,
                series: allSeries,
                xAxis: disableXAxis ? {
                  show: false
                } : xAxis,
                yAxis: yAxis,
                colors: colors,
                grid: grid !== null && grid !== void 0 ? grid : {
                  left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3),
                  right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3),
                  top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(3),
                  bottom: isLoading ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4) : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5)
                },
                stacked: true,
                ...(disableZoom ? {} : zoomRenderProps)
              }),
              fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__["default"], {
                height: "250px",
                testId: "skeleton-ui"
              })
            })]
          })
        });
      }
    })
  });
}
Chart.displayName = "Chart";

const BarChartContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr7yxp1"
} : 0)("padding-top:", p => p.hasPadding ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1) : 0, ";position:relative;" + ( true ? "" : 0));

const MaskContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1kr7yxp0"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HistogramChart);

/***/ }),

/***/ "./app/views/performance/landing/data.tsx":
/*!************************************************!*\
  !*** ./app/views/performance/landing/data.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BACKEND_COLUMN_TITLES": () => (/* binding */ BACKEND_COLUMN_TITLES),
/* harmony export */   "FRONTEND_OTHER_COLUMN_TITLES": () => (/* binding */ FRONTEND_OTHER_COLUMN_TITLES),
/* harmony export */   "FRONTEND_PAGELOAD_COLUMN_TITLES": () => (/* binding */ FRONTEND_PAGELOAD_COLUMN_TITLES),
/* harmony export */   "MOBILE_COLUMN_TITLES": () => (/* binding */ MOBILE_COLUMN_TITLES),
/* harmony export */   "REACT_NATIVE_COLUMN_TITLES": () => (/* binding */ REACT_NATIVE_COLUMN_TITLES)
/* harmony export */ });
const FRONTEND_PAGELOAD_COLUMN_TITLES = ['transaction', 'project', 'tpm', 'FCP', 'LCP', 'FID', 'CLS', 'users', 'user misery'];
const FRONTEND_OTHER_COLUMN_TITLES = ['transaction', 'project', 'operation', 'tpm', 'p50()', 'p75()', 'p95()', 'users', 'user misery'];
const BACKEND_COLUMN_TITLES = ['transaction', 'project', 'operation', 'http method', 'tpm', 'p50', 'p95', 'failure rate', 'apdex', 'users', 'user misery'];
const MOBILE_COLUMN_TITLES = ['transaction', 'project', 'operation', 'tpm', 'slow frame %', 'frozen frame %', 'users', 'user misery'];
const REACT_NATIVE_COLUMN_TITLES = ['transaction', 'project', 'operation', 'tpm', 'slow frame %', 'frozen frame %', 'stall %', 'users', 'user misery'];

/***/ }),

/***/ "./app/views/performance/landing/display/utils.tsx":
/*!*********************************************************!*\
  !*** ./app/views/performance/landing/display/utils.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAxisOrBackupAxis": () => (/* binding */ getAxisOrBackupAxis),
/* harmony export */   "getBackupAxes": () => (/* binding */ getBackupAxes),
/* harmony export */   "getBackupAxisOption": () => (/* binding */ getBackupAxisOption),
/* harmony export */   "getBackupField": () => (/* binding */ getBackupField),
/* harmony export */   "getFieldOrBackup": () => (/* binding */ getFieldOrBackup)
/* harmony export */ });
function getAxisOrBackupAxis(axis, usingBackupAxis) {
  var _getBackupAxisOption;

  const displayedAxis = usingBackupAxis ? (_getBackupAxisOption = getBackupAxisOption(axis)) !== null && _getBackupAxisOption !== void 0 ? _getBackupAxisOption : axis : axis;
  return displayedAxis;
}
function getBackupAxisOption(axis) {
  return axis.backupOption;
}
function getBackupAxes(axes, usingBackupAxis) {
  return usingBackupAxis ? axes.map(axis => {
    var _getBackupAxisOption2;

    return (_getBackupAxisOption2 = getBackupAxisOption(axis)) !== null && _getBackupAxisOption2 !== void 0 ? _getBackupAxisOption2 : axis;
  }) : axes;
}
function getBackupField(axis) {
  const backupOption = getBackupAxisOption(axis);

  if (!backupOption) {
    return undefined;
  }

  return backupOption.field;
}
function getFieldOrBackup(field, backupField) {
  return backupField !== null && backupField !== void 0 ? backupField : field;
}

/***/ }),

/***/ "./app/views/performance/landing/index.tsx":
/*!*************************************************!*\
  !*** ./app/views/performance/landing/index.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceLanding": () => (/* binding */ PerformanceLanding)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_performance_searchBar__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/performance/searchBar */ "./app/components/performance/searchBar.tsx");
/* harmony import */ var sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/performance/teamKeyTransactionsManager */ "./app/components/performance/teamKeyTransactionsManager.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_genericQueryBatcher__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/performance/contexts/genericQueryBatcher */ "./app/utils/performance/contexts/genericQueryBatcher.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var _onboarding__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ../onboarding */ "./app/views/performance/onboarding.tsx");
/* harmony import */ var _transactionSummary_transactionOverview_metricEvents_metricsEventsDropdown__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ../transactionSummary/transactionOverview/metricEvents/metricsEventsDropdown */ "./app/views/performance/transactionSummary/transactionOverview/metricEvents/metricsEventsDropdown.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _views_allTransactionsView__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ./views/allTransactionsView */ "./app/views/performance/landing/views/allTransactionsView.tsx");
/* harmony import */ var _views_backendView__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./views/backendView */ "./app/views/performance/landing/views/backendView.tsx");
/* harmony import */ var _views_frontendOtherView__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./views/frontendOtherView */ "./app/views/performance/landing/views/frontendOtherView.tsx");
/* harmony import */ var _views_frontendPageloadView__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./views/frontendPageloadView */ "./app/views/performance/landing/views/frontendPageloadView.tsx");
/* harmony import */ var _views_mobileView__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./views/mobileView */ "./app/views/performance/landing/views/mobileView.tsx");
/* harmony import */ var _metricsDataSwitcher__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./metricsDataSwitcher */ "./app/views/performance/landing/metricsDataSwitcher.tsx");
/* harmony import */ var _metricsDataSwitcherAlert__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./metricsDataSwitcherAlert */ "./app/views/performance/landing/metricsDataSwitcherAlert.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







































const fieldToViewMap = {
  [_utils__WEBPACK_IMPORTED_MODULE_39__.LandingDisplayField.ALL]: _views_allTransactionsView__WEBPACK_IMPORTED_MODULE_32__.AllTransactionsView,
  [_utils__WEBPACK_IMPORTED_MODULE_39__.LandingDisplayField.BACKEND]: _views_backendView__WEBPACK_IMPORTED_MODULE_33__.BackendView,
  [_utils__WEBPACK_IMPORTED_MODULE_39__.LandingDisplayField.FRONTEND_OTHER]: _views_frontendOtherView__WEBPACK_IMPORTED_MODULE_34__.FrontendOtherView,
  [_utils__WEBPACK_IMPORTED_MODULE_39__.LandingDisplayField.FRONTEND_PAGELOAD]: _views_frontendPageloadView__WEBPACK_IMPORTED_MODULE_35__.FrontendPageloadView,
  [_utils__WEBPACK_IMPORTED_MODULE_39__.LandingDisplayField.MOBILE]: _views_mobileView__WEBPACK_IMPORTED_MODULE_36__.MobileView
};
function PerformanceLanding(props) {
  const {
    organization,
    location,
    eventView,
    projects,
    handleSearch,
    handleTrendsClick,
    onboardingProject
  } = props;
  const {
    teams,
    initiallyLoaded
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_28__["default"])({
    provideUserTeams: true
  });
  const hasMounted = (0,react__WEBPACK_IMPORTED_MODULE_4__.useRef)(false);
  const paramLandingDisplay = (0,_utils__WEBPACK_IMPORTED_MODULE_39__.getLandingDisplayFromParam)(location);
  const defaultLandingDisplayForProjects = (0,_utils__WEBPACK_IMPORTED_MODULE_39__.getDefaultDisplayForPlatform)(projects, eventView);
  const landingDisplay = paramLandingDisplay !== null && paramLandingDisplay !== void 0 ? paramLandingDisplay : defaultLandingDisplayForProjects;
  const showOnboarding = onboardingProject !== undefined;
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    if (hasMounted.current) {
      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace({
        pathname: location.pathname,
        query: { ...location.query,
          landingDisplay: undefined
        }
      });
    } // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [eventView.project.join('.')]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    hasMounted.current = true;
  }, []);

  const getFreeTextFromQuery = query => {
    const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_27__.MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');

    if (transactionValues.length) {
      return transactionValues[0];
    }

    return '';
  };

  const derivedQuery = (0,_utils__WEBPACK_IMPORTED_MODULE_31__.getTransactionSearchQuery)(location, eventView.query);
  const ViewComponent = fieldToViewMap[landingDisplay.field];

  let pageFilters = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_13__["default"], {
    condensed: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_17__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_8__["default"], {
      alignDropdown: "left"
    })]
  });

  if (showOnboarding) {
    pageFilters = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(SearchContainerWithFilter, {
      children: pageFilters
    });
  }

  const SearchFilterContainer = organization.features.includes('performance-use-metrics') ? SearchContainerWithFilterAndMetrics : SearchContainerWithFilter;
  const shouldShowTransactionNameOnlySearch = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__.canUseMetricsData)(organization);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(StyledPageContent, {
    "data-test-id": "performance-landing-v3",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_26__.PageErrorProvider, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.HeaderContent, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(StyledHeading, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Performance')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.HeaderActions, {
          children: !showOnboarding && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"], {
            gap: 3,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
              priority: "primary",
              "data-test-id": "landing-header-trends",
              onClick: () => handleTrendsClick(),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('View Trends')
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.HeaderNavTabs, {
          children: _utils__WEBPACK_IMPORTED_MODULE_39__.LANDING_DISPLAYS.map(_ref => {
            let {
              label,
              field
            } = _ref;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)("li", {
              className: landingDisplay.field === field ? 'active' : '',
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)("a", {
                href: "#",
                "data-test-id": `landing-tab-${field}`,
                onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_39__.handleLandingDisplayChange)(field, location, projects, organization, eventView),
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)(label)
              })
            }, label);
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Body, {
        "data-test-id": "performance-landing-body",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Main, {
          fullWidth: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_24__.MetricsCardinalityProvider, {
            organization: organization,
            location: location,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_metricsDataSwitcher__WEBPACK_IMPORTED_MODULE_37__.MetricsDataSwitcher, {
              organization: organization,
              eventView: eventView,
              location: location,
              children: metricsDataSide => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__.MEPSettingProvider, {
                location: location,
                forceTransactions: metricsDataSide.forceTransactionsOnly,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_metricsDataSwitcherAlert__WEBPACK_IMPORTED_MODULE_38__.MetricsDataSwitcherAlert, {
                  organization: organization,
                  eventView: eventView,
                  projects: projects,
                  location: location,
                  router: props.router,
                  ...metricsDataSide
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_26__.PageErrorAlert, {}), showOnboarding ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [pageFilters, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_onboarding__WEBPACK_IMPORTED_MODULE_29__["default"], {
                    organization: organization,
                    project: onboardingProject
                  })]
                }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(SearchFilterContainer, {
                    children: [pageFilters, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__.MEPConsumer, {
                      children: _ref2 => {
                        let {
                          metricSettingState
                        } = _ref2;
                        const searchQuery = metricSettingState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__.MEPState.metricsOnly ? getFreeTextFromQuery(derivedQuery) : derivedQuery;
                        return metricSettingState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_25__.MEPState.metricsOnly && shouldShowTransactionNameOnlySearch ? // TODO replace `handleSearch prop` with transaction name search once
                        // transaction name search becomes the default search bar
                        (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_performance_searchBar__WEBPACK_IMPORTED_MODULE_15__["default"], {
                          organization: organization,
                          location: location,
                          eventView: eventView,
                          onSearch: query => handleSearch(query, metricSettingState),
                          query: searchQuery
                        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_10__["default"], {
                          searchSource: "performance_landing",
                          organization: organization,
                          projectIds: eventView.project,
                          query: searchQuery,
                          fields: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.generateAggregateFields)(organization, [...eventView.fields, {
                            field: 'tps()'
                          }], ['epm()', 'eps()']),
                          onSearch: query => handleSearch(query, metricSettingState !== null && metricSettingState !== void 0 ? metricSettingState : undefined),
                          maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_18__.MAX_QUERY_LENGTH
                        });
                      }
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_transactionSummary_transactionOverview_metricEvents_metricsEventsDropdown__WEBPACK_IMPORTED_MODULE_30__.MetricsEventsDropdown, {})]
                  }), initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_performance_teamKeyTransactionsManager__WEBPACK_IMPORTED_MODULE_16__.Provider, {
                    organization: organization,
                    teams: teams,
                    selectedTeams: ['myteams'],
                    selectedProjects: eventView.project.map(String),
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_contexts_genericQueryBatcher__WEBPACK_IMPORTED_MODULE_23__.GenericQueryBatcher, {
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(ViewComponent, { ...props
                      })
                    })
                  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {})]
                })]
              })
            })
          })
        })
      })]
    })
  });
}
PerformanceLanding.displayName = "PerformanceLanding";

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_20__.PageContent,  true ? {
  target: "e1ce5rqc3"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const StyledHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e1ce5rqc2"
} : 0)( true ? {
  name: "ht6xsx",
  styles: "line-height:40px"
} : 0);

const SearchContainerWithFilter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ce5rqc1"
} : 0)("display:grid;grid-template-rows:auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-rows:auto;grid-template-columns:auto 1fr;}" + ( true ? "" : 0));

const SearchContainerWithFilterAndMetrics = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ce5rqc0"
} : 0)("display:grid;grid-template-rows:auto auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-rows:auto;grid-template-columns:auto 1fr auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/landing/metricsDataSwitcher.tsx":
/*!***************************************************************!*\
  !*** ./app/views/performance/landing/metricsDataSwitcher.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricsDataSwitcher": () => (/* binding */ MetricsDataSwitcher)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









/**
 * This component decides based on some stats about current projects whether to show certain views of the landing page.
 * It is primarily needed for the rollout during which time users, despite having the flag enabled,
 * may or may not have sampling rules, compatible sdk's etc. This can be simplified post rollout.
 */
function MetricsDataSwitcher(props) {
  const isUsingMetrics = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.canUseMetricsData)(props.organization);
  const metricsCardinality = (0,sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_4__.useMetricsCardinalityContext)();

  if (!isUsingMetrics) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: props.children({
        forceTransactionsOnly: true
      })
    });
  }

  if (metricsCardinality.isLoading && !props.hideLoadingIndicator) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(LoadingContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {})
      })
    });
  }

  if (!metricsCardinality.outcome) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: props.children({
        forceTransactionsOnly: true
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(MetricsSwitchHandler, {
      eventView: props.eventView,
      location: props.location,
      outcome: metricsCardinality.outcome,
      switcherChildren: props.children
    })
  });
}
MetricsDataSwitcher.displayName = "MetricsDataSwitcher";

function MetricsSwitchHandler(_ref) {
  let {
    switcherChildren,
    outcome,
    location,
    eventView
  } = _ref;
  const {
    query
  } = location;
  const mepSearchState = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(query[sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.METRIC_SEARCH_SETTING_PARAM], '');
  const hasQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_6__.decodeScalar)(query.query, '');
  const queryIsTransactionsBased = mepSearchState === sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.MEPState.transactionsOnly;
  const shouldAdjustQuery = hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (shouldAdjustQuery) {
      react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          cursor: undefined,
          query: undefined,
          [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_5__.METRIC_SEARCH_SETTING_PARAM]: undefined
        }
      });
    }
  }, [shouldAdjustQuery, location]);

  if (hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly) {
    eventView.query = ''; // TODO: Create switcher provider and move it to the route level to remove the need for this.
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: switcherChildren(outcome)
  });
}

MetricsSwitchHandler.displayName = "MetricsSwitchHandler";

const LoadingContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1r04u5n0"
} : 0)( true ? {
  name: "zl1inp",
  styles: "display:flex;justify-content:center"
} : 0);

/***/ }),

/***/ "./app/views/performance/landing/metricsDataSwitcherAlert.tsx":
/*!********************************************************************!*\
  !*** ./app/views/performance/landing/metricsDataSwitcherAlert.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricsDataSwitcherAlert": () => (/* binding */ MetricsDataSwitcherAlert)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/pageFilters */ "./app/actionCreators/pageFilters.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/globalSdkUpdateAlert */ "./app/components/globalSdkUpdateAlert.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sidebar/types */ "./app/components/sidebar/types.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/sidebarPanelStore */ "./app/stores/sidebarPanelStore.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













/**
 * From
 * https://github.com/getsentry/sentry-docs/blob/master/src/platforms/common/enriching-events/transaction-name.mdx
 */
const SUPPORTED_TRANSACTION_NAME_DOCS = ['javascript', 'node', 'python', 'ruby', 'native', 'react-native', 'dotnet', 'unity', 'flutter', 'dart', 'java', 'android'];
const UNSUPPORTED_TRANSACTION_NAME_DOCS = ['javascript.cordova', 'javascript.nextjs', 'native.minidumps'];
function MetricsDataSwitcherAlert(props) {
  const handleReviewUpdatesClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_9__["default"].activatePanel(sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_7__.SidebarPanelKey.Broadcasts);
  }, []);
  const docsLink = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const platforms = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.getSelectedProjectPlatformsArray)(props.location, props.projects);

    if (platforms.length < 1) {
      return null;
    }

    const platform = platforms[0];

    if (UNSUPPORTED_TRANSACTION_NAME_DOCS.includes(platform)) {
      return null;
    }

    const supportedPlatform = SUPPORTED_TRANSACTION_NAME_DOCS.find(platformBase => platform.includes(platformBase));

    if (!supportedPlatform) {
      return null;
    }

    return `https://docs.sentry.io/platforms/${supportedPlatform}/enriching-events/transaction-name/`;
  }, [props.location, props.projects]);
  const handleSwitchToCompatibleProjects = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    (0,sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_2__.updateProjects)(props.compatibleProjects || [], props.router);
  }, [props.compatibleProjects, props.router]);

  if (!props.shouldNotifyUnnamedTransactions && !props.shouldWarnIncompatibleSDK) {
    // Control showing generic sdk-alert here since stacking alerts is noisy.
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_4__.GlobalSdkUpdateAlert, {});
  }

  const discoverTarget = (0,_utils__WEBPACK_IMPORTED_MODULE_10__.createUnnamedTransactionsDiscoverTarget)(props);

  if (props.shouldWarnIncompatibleSDK) {
    const updateSDK = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: "",
      onClick: handleReviewUpdatesClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('update your SDK version')
    });

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_10__.areMultipleProjectsSelected)(props.eventView)) {
      var _props$compatibleProj;

      if (((_props$compatibleProj = props.compatibleProjects) !== null && _props$compatibleProj !== void 0 ? _props$compatibleProj : []).length === 0) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
          type: "warning",
          showIcon: true,
          "data-test-id": "landing-mep-alert-multi-project-all-incompatible",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`A few projects are incompatible with server side sampling. To enable this feature [updateSDK].`, {
            updateSDK
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "warning",
        showIcon: true,
        "data-test-id": "landing-mep-alert-multi-project-incompatible",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`A few projects are incompatible with server side sampling. You can either [updateSDK] or [onlyViewCompatible]`, {
          updateSDK,
          onlyViewCompatible: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
            to: "",
            onClick: handleSwitchToCompatibleProjects,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('only view compatible projects.')
          })
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "warning",
      showIcon: true,
      "data-test-id": "landing-mep-alert-single-project-incompatible",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`Your project has an outdated SDK which is incompatible with server side sampling. To enable this feature [updateSDK].`, {
        updateSDK
      })
    });
  }

  if (props.shouldNotifyUnnamedTransactions) {
    const discover = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: discoverTarget,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('open them in Discover.')
    });

    if (!docsLink) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "warning",
        showIcon: true,
        "data-test-id": "landing-mep-alert-unnamed-discover",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`You have some unparameterized transactions which are incompatible with server side sampling. You can [discover]`, {
          discover
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
      type: "warning",
      showIcon: true,
      "data-test-id": "landing-mep-alert-unnamed-discover-or-set",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)(`You have some unparameterized transactions which are incompatible with server side sampling. You can either [setNames] or [discover]`, {
        setNames: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
          href: docsLink,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('set names manually')
        }),
        discover
      })
    });
  }

  return null;
}

/***/ }),

/***/ "./app/views/performance/landing/views/allTransactionsView.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/performance/landing/views/allTransactionsView.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AllTransactionsView": () => (/* binding */ AllTransactionsView)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../table */ "./app/views/performance/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../widgets/components/widgetChartRow */ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx");
/* harmony import */ var _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function AllTransactionsView(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_1__.PerformanceDisplayProvider, {
    value: {
      performanceType: _utils__WEBPACK_IMPORTED_MODULE_3__.PROJECT_PERFORMANCE_TYPE.ANY
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      "data-test-id": "all-transactions-view",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_4__.TripleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.USER_MISERY_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.TPM_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.FAILURE_RATE_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.APDEX_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.P50_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.P75_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.P95_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.P99_DURATION_AREA]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_4__.DoubleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.MOST_RELATED_ISSUES, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.MOST_IMPROVED, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_5__.PerformanceWidgetSetting.MOST_REGRESSED]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_table__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
        setError: (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_0__.usePageError)().setPageError
      })]
    })
  });
}
AllTransactionsView.displayName = "AllTransactionsView";

/***/ }),

/***/ "./app/views/performance/landing/views/backendView.tsx":
/*!*************************************************************!*\
  !*** ./app/views/performance/landing/views/backendView.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BackendView": () => (/* binding */ BackendView)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../table */ "./app/views/performance/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../data */ "./app/views/performance/landing/data.tsx");
/* harmony import */ var _widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../widgets/components/widgetChartRow */ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx");
/* harmony import */ var _widgets_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function getAllowedChartsSmall(props, mepSetting) {
  const charts = [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.APDEX_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.TPM_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.FAILURE_RATE_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.USER_MISERY_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P50_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P75_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P95_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P99_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.DURATION_HISTOGRAM];
  return (0,_widgets_utils__WEBPACK_IMPORTED_MODULE_7__.filterAllowedChartsMetrics)(props.organization, charts, mepSetting);
}

function BackendView(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__.useMEPSettingContext)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__.PerformanceDisplayProvider, {
    value: {
      performanceType: _utils__WEBPACK_IMPORTED_MODULE_4__.PROJECT_PERFORMANCE_TYPE.ANY
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.TripleChartRow, { ...props,
        allowedCharts: getAllowedChartsSmall(props, mepSetting)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.DoubleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_HTTP_OPS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_DB_OPS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.MOST_IMPROVED, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.MOST_REGRESSED]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_table__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
        columnTitles: _data__WEBPACK_IMPORTED_MODULE_5__.BACKEND_COLUMN_TITLES,
        setError: (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__.usePageError)().setPageError
      })]
    })
  });
}
BackendView.displayName = "BackendView";

/***/ }),

/***/ "./app/views/performance/landing/views/frontendOtherView.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/performance/landing/views/frontendOtherView.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrontendOtherView": () => (/* binding */ FrontendOtherView)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../table */ "./app/views/performance/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../data */ "./app/views/performance/landing/data.tsx");
/* harmony import */ var _widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../widgets/components/widgetChartRow */ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx");
/* harmony import */ var _widgets_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function getAllowedChartsSmall(props, mepSetting) {
  const charts = [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.TPM_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.DURATION_HISTOGRAM, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P50_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P75_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P95_DURATION_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P99_DURATION_AREA];
  return (0,_widgets_utils__WEBPACK_IMPORTED_MODULE_7__.filterAllowedChartsMetrics)(props.organization, charts, mepSetting);
}

function FrontendOtherView(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__.useMEPSettingContext)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__.PerformanceDisplayProvider, {
    value: {
      performanceType: _utils__WEBPACK_IMPORTED_MODULE_4__.PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.TripleChartRow, { ...props,
        allowedCharts: getAllowedChartsSmall(props, mepSetting)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.DoubleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.MOST_RELATED_ISSUES, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_HTTP_OPS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_RESOURCE_OPS]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_table__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
        columnTitles: _data__WEBPACK_IMPORTED_MODULE_5__.FRONTEND_OTHER_COLUMN_TITLES,
        setError: (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__.usePageError)().setPageError
      })]
    })
  });
}
FrontendOtherView.displayName = "FrontendOtherView";

/***/ }),

/***/ "./app/views/performance/landing/views/frontendPageloadView.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/performance/landing/views/frontendPageloadView.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrontendPageloadView": () => (/* binding */ FrontendPageloadView)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../table */ "./app/views/performance/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../data */ "./app/views/performance/landing/data.tsx");
/* harmony import */ var _widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../widgets/components/widgetChartRow */ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx");
/* harmony import */ var _widgets_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function getAllowedChartsSmall(props, mepSetting) {
  const charts = [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.P75_LCP_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.LCP_HISTOGRAM, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.FCP_HISTOGRAM, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.USER_MISERY_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.TPM_AREA];
  return (0,_widgets_utils__WEBPACK_IMPORTED_MODULE_7__.filterAllowedChartsMetrics)(props.organization, charts, mepSetting);
}

function FrontendPageloadView(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_0__.useMEPSettingContext)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_2__.PerformanceDisplayProvider, {
    value: {
      performanceType: _utils__WEBPACK_IMPORTED_MODULE_4__.PROJECT_PERFORMANCE_TYPE.FRONTEND
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      "data-test-id": "frontend-pageload-view",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.TripleChartRow, { ...props,
        allowedCharts: getAllowedChartsSmall(props, mepSetting)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.DoubleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.WORST_LCP_VITALS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.WORST_FCP_VITALS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.WORST_FID_VITALS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.MOST_RELATED_ISSUES, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_HTTP_OPS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_BROWSER_OPS, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_8__.PerformanceWidgetSetting.SLOW_RESOURCE_OPS]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_table__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
        columnTitles: _data__WEBPACK_IMPORTED_MODULE_5__.FRONTEND_PAGELOAD_COLUMN_TITLES,
        setError: (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_1__.usePageError)().setPageError
      })]
    })
  });
}
FrontendPageloadView.displayName = "FrontendPageloadView";

/***/ }),

/***/ "./app/views/performance/landing/views/mobileView.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/landing/views/mobileView.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MobileView": () => (/* binding */ MobileView)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _table__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../table */ "./app/views/performance/table.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../data */ "./app/views/performance/landing/data.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../widgets/components/widgetChartRow */ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx");
/* harmony import */ var _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../widgets/widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function MobileView(props) {
  const columnTitles = (0,_utils__WEBPACK_IMPORTED_MODULE_5__.checkIsReactNative)(props.eventView) ? _data__WEBPACK_IMPORTED_MODULE_4__.REACT_NATIVE_COLUMN_TITLES : _data__WEBPACK_IMPORTED_MODULE_4__.MOBILE_COLUMN_TITLES;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_1__.PerformanceDisplayProvider, {
    value: {
      performanceType: _utils__WEBPACK_IMPORTED_MODULE_3__.PROJECT_PERFORMANCE_TYPE.ANY
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.TripleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.TPM_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.COLD_STARTUP_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.WARM_STARTUP_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.SLOW_FRAMES_AREA, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.FROZEN_FRAMES_AREA]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_widgets_components_widgetChartRow__WEBPACK_IMPORTED_MODULE_6__.DoubleChartRow, { ...props,
        allowedCharts: [_widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.MOST_SLOW_FRAMES, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.MOST_FROZEN_FRAMES, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.MOST_IMPROVED, _widgets_widgetDefinitions__WEBPACK_IMPORTED_MODULE_7__.PerformanceWidgetSetting.MOST_REGRESSED]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_table__WEBPACK_IMPORTED_MODULE_2__["default"], { ...props,
        columnTitles: columnTitles,
        setError: (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_0__.usePageError)().setPageError
      })]
    })
  });
}
MobileView.displayName = "MobileView";

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/widgetChartRow.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/widgetChartRow.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DoubleChartRow": () => (/* binding */ DoubleChartRow),
/* harmony export */   "TripleChartRow": () => (/* binding */ TripleChartRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_performance_layouts__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/performance/layouts */ "./app/components/performance/layouts/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgetContainer__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./widgetContainer */ "./app/views/performance/landing/widgets/components/widgetContainer.tsx");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function getInitialChartSettings(chartCount, chartHeight, performanceType, allowedCharts) {
  return new Array(chartCount).fill(0).map((_, index) => (0,_utils__WEBPACK_IMPORTED_MODULE_7__.getChartSetting)(index, chartHeight, performanceType, allowedCharts[index]));
}

const ChartRow = props => {
  const {
    chartCount,
    chartHeight,
    allowedCharts
  } = props;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.a)();
  const performanceType = (0,sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_6__.usePerformanceDisplayType)();
  const palette = theme.charts.getColorPalette(chartCount);
  const [chartSettings, setChartSettings] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(getInitialChartSettings(chartCount, chartHeight, performanceType, allowedCharts));

  if (props.allowedCharts.length < chartCount) {
    throw new Error('Not enough allowed chart types to show row.');
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledRow, {
    minSize: 200,
    children: new Array(chartCount).fill(0).map((_, index) => (0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.createElement)(_widgetContainer__WEBPACK_IMPORTED_MODULE_8__["default"], { ...props,
      key: index,
      index: index,
      chartHeight: chartHeight,
      chartColor: palette[index],
      defaultChartSetting: allowedCharts[index],
      rowChartSettings: chartSettings,
      setRowChartSettings: setChartSettings
    }))
  });
};

ChartRow.displayName = "ChartRow";
const TripleChartRow = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ChartRow, { ...props
});
TripleChartRow.displayName = "TripleChartRow";
TripleChartRow.defaultProps = {
  chartCount: 3,
  chartHeight: 100
};
const DoubleChartRow = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ChartRow, { ...props
});
DoubleChartRow.displayName = "DoubleChartRow";
DoubleChartRow.defaultProps = {
  chartCount: 2,
  chartHeight: 180
};

const StyledRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_performance_layouts__WEBPACK_IMPORTED_MODULE_4__.PerformanceLayoutBodyRow,  true ? {
  target: "e5t9wbo0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/landing/widgets/components/widgetContainer.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/components/widgetContainer.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetContainerActions": () => (/* binding */ WidgetContainerActions),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/compositeSelect */ "./app/components/forms/compositeSelect.tsx");
/* harmony import */ var sentry_icons_iconEllipsis__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons/iconEllipsis */ "./app/icons/iconEllipsis.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceDisplayContext */ "./app/utils/performance/contexts/performanceDisplayContext.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../types */ "./app/views/performance/landing/widgets/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgetDefinitions__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _widgets_histogramWidget__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../widgets/histogramWidget */ "./app/views/performance/landing/widgets/widgets/histogramWidget.tsx");
/* harmony import */ var _widgets_lineChartListWidget__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../widgets/lineChartListWidget */ "./app/views/performance/landing/widgets/widgets/lineChartListWidget.tsx");
/* harmony import */ var _widgets_singleFieldAreaWidget__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../widgets/singleFieldAreaWidget */ "./app/views/performance/landing/widgets/widgets/singleFieldAreaWidget.tsx");
/* harmony import */ var _widgets_trendsWidget__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../widgets/trendsWidget */ "./app/views/performance/landing/widgets/widgets/trendsWidget.tsx");
/* harmony import */ var _widgets_vitalWidget__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../widgets/vitalWidget */ "./app/views/performance/landing/widgets/widgets/vitalWidget.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























function trackChartSettingChange(previousChartSetting, chartSetting, fromDefault, organization) {
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__["default"])('performance_views.landingv3.widget.switch', {
    organization,
    from_widget: previousChartSetting,
    to_widget: chartSetting,
    from_default: fromDefault
  });
}

const _WidgetContainer = props => {
  const {
    organization,
    index,
    chartHeight,
    rowChartSettings,
    setRowChartSettings,
    ...rest
  } = props;
  const performanceType = (0,sentry_utils_performance_contexts_performanceDisplayContext__WEBPACK_IMPORTED_MODULE_15__.usePerformanceDisplayType)();

  let _chartSetting = (0,_utils__WEBPACK_IMPORTED_MODULE_19__.getChartSetting)(index, chartHeight, performanceType, rest.defaultChartSetting, rest.forceDefaultChartSetting);

  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_14__.useMEPSettingContext)();
  const allowedCharts = (0,_utils__WEBPACK_IMPORTED_MODULE_19__.filterAllowedChartsMetrics)(props.organization, props.allowedCharts, mepSetting);

  if (!allowedCharts.includes(_chartSetting)) {
    _chartSetting = rest.defaultChartSetting;
  }

  const [chartSetting, setChartSettingState] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(_chartSetting);

  const setChartSetting = setting => {
    if (!props.forceDefaultChartSetting) {
      (0,_utils__WEBPACK_IMPORTED_MODULE_19__._setChartSetting)(index, chartHeight, performanceType, setting);
    }

    setChartSettingState(setting);
    const newSettings = [...rowChartSettings];
    newSettings[index] = setting;
    setRowChartSettings(newSettings);
    trackChartSettingChange(chartSetting, setting, rest.defaultChartSetting === chartSetting, organization);
  };

  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    setChartSettingState(_chartSetting);
  }, [rest.defaultChartSetting, _chartSetting]);
  const chartDefinition = (0,_widgetDefinitions__WEBPACK_IMPORTED_MODULE_20__.WIDGET_DEFINITIONS)({
    organization
  })[chartSetting]; // Construct an EventView that matches this widget's definition. The
  // `eventView` from the props is the _landing page_ EventView, which is different

  const widgetEventView = makeEventViewForWidget(props.eventView, chartDefinition);
  const widgetProps = { ...chartDefinition,
    chartSetting,
    chartDefinition,
    ContainerActions: containerProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(WidgetContainerActions, { ...containerProps,
      eventView: widgetEventView,
      allowedCharts: allowedCharts,
      chartSetting: chartSetting,
      setChartSetting: setChartSetting,
      rowChartSettings: rowChartSettings
    })
  };
  const passedProps = lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(props, ['eventView', 'location', 'organization', 'chartHeight', 'withStaticFilters']);

  switch (widgetProps.dataType) {
    case _types__WEBPACK_IMPORTED_MODULE_18__.GenericPerformanceWidgetDataType.trends:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_widgets_trendsWidget__WEBPACK_IMPORTED_MODULE_24__.TrendsWidget, { ...passedProps,
        ...widgetProps
      });

    case _types__WEBPACK_IMPORTED_MODULE_18__.GenericPerformanceWidgetDataType.area:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_widgets_singleFieldAreaWidget__WEBPACK_IMPORTED_MODULE_23__.SingleFieldAreaWidget, { ...passedProps,
        ...widgetProps
      });

    case _types__WEBPACK_IMPORTED_MODULE_18__.GenericPerformanceWidgetDataType.vitals:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_widgets_vitalWidget__WEBPACK_IMPORTED_MODULE_25__.VitalWidget, { ...passedProps,
        ...widgetProps
      });

    case _types__WEBPACK_IMPORTED_MODULE_18__.GenericPerformanceWidgetDataType.line_list:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_widgets_lineChartListWidget__WEBPACK_IMPORTED_MODULE_22__.LineChartListWidget, { ...passedProps,
        ...widgetProps
      });

    case _types__WEBPACK_IMPORTED_MODULE_18__.GenericPerformanceWidgetDataType.histogram:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_widgets_histogramWidget__WEBPACK_IMPORTED_MODULE_21__.HistogramWidget, { ...passedProps,
        ...widgetProps
      });

    default:
      throw new Error(`Widget type "${widgetProps.dataType}" has no implementation.`);
  }
};

const WidgetContainerActions = _ref => {
  let {
    chartSetting,
    eventView,
    setChartSetting,
    allowedCharts,
    rowChartSettings
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])();
  const menuOptions = [];
  const settingsMap = (0,_widgetDefinitions__WEBPACK_IMPORTED_MODULE_20__.WIDGET_DEFINITIONS)({
    organization
  });

  for (const setting of allowedCharts) {
    const options = settingsMap[setting];
    menuOptions.push({
      value: setting,
      label: options.title,
      disabled: setting !== chartSetting && rowChartSettings.includes(setting)
    });
  }

  const chartDefinition = (0,_widgetDefinitions__WEBPACK_IMPORTED_MODULE_20__.WIDGET_DEFINITIONS)({
    organization
  })[chartSetting];

  function trigger(_ref2) {
    let {
      props,
      ref
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_8__["default"], {
      ref: ref,
      ...props,
      size: "xs",
      borderless: true,
      showChevron: false,
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons_iconEllipsis__WEBPACK_IMPORTED_MODULE_10__.IconEllipsis, {
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('More')
      })
    });
  }

  function handleWidgetActionChange(value) {
    if (value === 'open_in_discover') {
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(getEventViewDiscoverPath(organization, eventView));
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_9__["default"], {
    sections: [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Display'),
      options: menuOptions,
      value: chartSetting,
      onChange: setChartSetting
    }, chartDefinition.allowsOpenInDiscover ? {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Other'),
      options: [{
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Open in Discover'),
        value: 'open_in_discover'
      }],
      value: '',
      onChange: handleWidgetActionChange
    } : null].filter(Boolean),
    trigger: trigger,
    placement: "bottom right"
  });
};
WidgetContainerActions.displayName = "WidgetContainerActions";

const getEventViewDiscoverPath = (organization, eventView) => {
  const discoverUrlTarget = eventView.getResultsViewUrlTarget(organization.slug); // The landing page EventView has some additional conditions, but
  // `EventView#getResultsViewUrlTarget` omits those! Get them manually

  discoverUrlTarget.query.query = eventView.getQueryWithAdditionalConditions();
  return `${discoverUrlTarget.pathname}?${query_string__WEBPACK_IMPORTED_MODULE_7__.stringify(lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(discoverUrlTarget.query, ['widths']) // Column widths are not useful in this case
  )}`;
};
/**
 * Constructs an `EventView` that matches a widget's chart definition.
 * @param baseEventView Any valid event view. The easiest way to make a new EventView is to clone an existing one, because `EventView#constructor` takes too many abstract arguments
 * @param chartDefinition
 */


const makeEventViewForWidget = (baseEventView, chartDefinition) => {
  const widgetEventView = baseEventView.clone();
  widgetEventView.name = chartDefinition.title;
  widgetEventView.yAxis = chartDefinition.fields[0]; // All current widgets only have one field

  widgetEventView.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_13__.DisplayModes.PREVIOUS;
  widgetEventView.fields = ['transaction', 'project', ...chartDefinition.fields].map(fieldName => ({
    field: fieldName
  }));
  return widgetEventView;
};

const WidgetContainer = (0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__["default"])(_WidgetContainer);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetContainer);

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformDiscoverToList.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformDiscoverToList.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformDiscoverToList": () => (/* binding */ transformDiscoverToList)
/* harmony export */ });
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");




/**
 * Cleans up lists to remove 'null' transactions rows from metrics-backed data.
 */
function removeEmptyTransactionsFromList(data) {
  const transactionColumnExists = data.some(d => typeof d === 'object' && 'transaction' in d);
  return transactionColumnExists ? data.filter(d => typeof d === 'object' && 'transaction' in d ? d.transaction : true) : data;
}

function transformDiscoverToList(widgetProps, results, _) {
  var _results$tableData$da, _results$tableData;

  const {
    start,
    end,
    utc,
    interval,
    statsPeriod
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__.normalizeDateTimeParams)(widgetProps.location.query, {
    defaultStatsPeriod: sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_STATS_PERIOD
  });

  const _data = (_results$tableData$da = (_results$tableData = results.tableData) === null || _results$tableData === void 0 ? void 0 : _results$tableData.data) !== null && _results$tableData$da !== void 0 ? _results$tableData$da : [];

  const data = removeEmptyTransactionsFromList(_data);
  const childData = { ...results,
    isErrored: !!results.error,
    hasData: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(data) && !!data.length,
    data,
    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start !== null && start !== void 0 ? start : '',
    end: end !== null && end !== void 0 ? end : ''
  };
  return childData;
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformEventsToVitals.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformEventsToVitals.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformEventsRequestToVitals": () => (/* binding */ transformEventsRequestToVitals)
/* harmony export */ });
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function transformEventsRequestToVitals(widgetProps, results, _) {
  var _results$results;

  const {
    start,
    end,
    utc,
    interval,
    statsPeriod
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__.normalizeDateTimeParams)(widgetProps.location.query);
  const data = (_results$results = results.results) !== null && _results$results !== void 0 ? _results$results : [];
  const childData = { ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
    hasData: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(data) && !!data.length && !!data[0].data.length,
    data,
    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start !== null && start !== void 0 ? start : '',
    end: end !== null && end !== void 0 ? end : ''
  };
  return childData;
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformHistogramQuery.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformHistogramQuery.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformHistogramQuery": () => (/* binding */ transformHistogramQuery)
/* harmony export */ });
function transformHistogramQuery(_, results) {
  const {
    histograms
  } = results;
  return { ...results,
    data: histograms,
    isLoading: results.isLoading,
    isErrored: results.error !== null,
    hasData: !!Object.values(histograms || {}).length
  };
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformTrendsDiscover.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformTrendsDiscover.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformTrendsDiscover": () => (/* binding */ transformTrendsDiscover)
/* harmony export */ });
/* harmony import */ var sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/views/performance/trends/utils */ "./app/views/performance/trends/utils.tsx");

function transformTrendsDiscover(_, props) {
  var _trendsData$events;

  const {
    trendsData
  } = props;
  const events = trendsData ? (0,sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_0__.normalizeTrends)(trendsData && trendsData.events && trendsData.events.data || []) : [];
  return { ...props,
    data: trendsData,
    hasData: !!(trendsData !== null && trendsData !== void 0 && (_trendsData$events = trendsData.events) !== null && _trendsData$events !== void 0 && _trendsData$events.data.length),
    loading: props.isLoading,
    isLoading: props.isLoading,
    isErrored: !!props.error,
    errored: props.error,
    statsData: trendsData ? trendsData.stats : {},
    transactionsList: events && events.slice ? events.slice(0, 3) : [],
    events
  };
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgets/histogramWidget.tsx":
/*!***************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgets/histogramWidget.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HistogramWidget": () => (/* binding */ HistogramWidget)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/histogram/histogramQuery */ "./app/utils/performance/histogram/histogramQuery.tsx");
/* harmony import */ var sentry_views_performance_landing_chart_histogramChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/landing/chart/histogramChart */ "./app/views/performance/landing/chart/histogramChart.tsx");
/* harmony import */ var _components_performanceWidget__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _transforms_transformHistogramQuery__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../transforms/transformHistogramQuery */ "./app/views/performance/landing/widgets/transforms/transformHistogramQuery.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function HistogramWidget(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.useMEPSettingContext)();
  const {
    ContainerActions,
    location
  } = props;
  const globalSelection = props.eventView.getPageFilters();
  const Queries = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return {
      chart: {
        fields: props.fields,
        component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_4__["default"], { ...provided,
          eventView: provided.eventView,
          location: props.location,
          numBuckets: 20,
          dataFilter: "exclude_outliers",
          queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_8__.getMEPQueryParams)(mepSetting)
        }),
        transform: _transforms_transformHistogramQuery__WEBPACK_IMPORTED_MODULE_7__.transformHistogramQuery
      }
    };
  }, [props.chartSetting, mepSetting.memoizationKey]);

  const onFilterChange = () => {};

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_components_performanceWidget__WEBPACK_IMPORTED_MODULE_6__.GenericPerformanceWidget, { ...props,
    Subtitle: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Subtitle, {
      children: globalSelection.datetime.period ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('In the last %s ', globalSelection.datetime.period) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('In the last period')
    }),
    HeaderActions: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ContainerActions, { ...provided.widgetData.chart
      })
    }),
    Queries: Queries,
    Visualizations: [{
      component: provided => {
        var _provided$widgetData$, _provided$widgetData$2;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_performance_landing_chart_histogramChart__WEBPACK_IMPORTED_MODULE_5__.Chart, { ...provided,
          colors: props.chartColor ? [props.chartColor] : undefined,
          location: location,
          isLoading: false,
          isErrored: false,
          onFilterChange: onFilterChange,
          field: props.fields[0],
          chartData: (_provided$widgetData$ = provided.widgetData.chart) === null || _provided$widgetData$ === void 0 ? void 0 : (_provided$widgetData$2 = _provided$widgetData$.data) === null || _provided$widgetData$2 === void 0 ? void 0 : _provided$widgetData$2[props.fields[0]],
          disableXAxis: true,
          disableZoom: true,
          disableChartPadding: true
        });
      },
      height: props.chartHeight
    }]
  });
}
HistogramWidget.displayName = "HistogramWidget";

const Subtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "elb5aiu0"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgets/lineChartListWidget.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgets/lineChartListWidget.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LineChartListWidget": () => (/* binding */ LineChartListWidget)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_charts_chart__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/performance/charts/chart */ "./app/views/performance/charts/chart.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _components_performanceWidget__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _components_selectableList__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../components/selectableList */ "./app/views/performance/landing/widgets/components/selectableList.tsx");
/* harmony import */ var _transforms_transformDiscoverToList__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../transforms/transformDiscoverToList */ "./app/views/performance/landing/widgets/transforms/transformDiscoverToList.tsx");
/* harmony import */ var _transforms_transformEventsToArea__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../transforms/transformEventsToArea */ "./app/views/performance/landing/widgets/transforms/transformEventsToArea.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports




























const slowList = [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_HTTP_OPS, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_DB_OPS, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_BROWSER_OPS, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_RESOURCE_OPS]; // Most N Frames, low population, and count vs. duration so treated separately from 'slow' widgets.

const framesList = [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_SLOW_FRAMES, _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_FROZEN_FRAMES];
function LineChartListWidget(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__.useMEPSettingContext)();
  const [selectedListIndex, setSelectListIndex] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(0);
  const {
    ContainerActions,
    organization
  } = props;
  const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
  const pageError = (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_16__.usePageError)();
  const field = props.fields[0];

  if (props.fields.length !== 1) {
    throw new Error(`Line chart list widget can only accept a single field (${props.fields})`);
  }

  const isSlowestType = slowList.includes(props.chartSetting);
  const isFramesType = framesList.includes(props.chartSetting);
  const listQuery = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => ({
    fields: field,
    component: provided => {
      const eventView = provided.eventView.clone();
      eventView.sorts = [{
        kind: 'desc',
        field
      }];

      if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
        eventView.fields = [{
          field: 'issue'
        }, {
          field: 'transaction'
        }, {
          field: 'title'
        }, {
          field: 'project.id'
        }, {
          field
        }];
        eventView.additionalConditions.setFilterValues('event.type', ['error']);
        eventView.additionalConditions.setFilterValues('!tags[transaction]', ['']);

        if ((0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__.canUseMetricsData)(organization)) {
          eventView.additionalConditions.setFilterValues('!transaction', [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_21__.UNPARAMETERIZED_TRANSACTION]);
        }

        const mutableSearch = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch(eventView.query);
        mutableSearch.removeFilter('transaction.duration');
        eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.

        eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.

        eventView.query = mutableSearch.formatString();
      } else if (isSlowestType || isFramesType) {
        eventView.additionalConditions.setFilterValues('epm()', ['>0.01']);
        eventView.fields = [{
          field: 'transaction'
        }, {
          field: 'project.id'
        }, {
          field: 'epm()'
        }, ...props.fields.map(f => ({
          field: f
        }))];
      } else {
        // Most related errors
        eventView.fields = [{
          field: 'transaction'
        }, {
          field: 'project.id'
        }, {
          field
        }];
      } // Don't retrieve list items with 0 in the field.


      eventView.additionalConditions.setFilterValues(field, ['>0']);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__["default"], { ...provided,
        eventView: eventView,
        location: props.location,
        limit: 3,
        cursor: "0:0:1",
        noPagination: true,
        queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.getMEPParamsIfApplicable)(mepSetting, props.chartSetting),
        useEvents: useEvents
      });
    },
    transform: _transforms_transformDiscoverToList__WEBPACK_IMPORTED_MODULE_25__.transformDiscoverToList
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [props.chartSetting, mepSetting.memoizationKey]);
  const chartQuery = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    return {
      enabled: widgetData => {
        var _widgetData$list, _widgetData$list$data;

        return !!(widgetData !== null && widgetData !== void 0 && (_widgetData$list = widgetData.list) !== null && _widgetData$list !== void 0 && (_widgetData$list$data = _widgetData$list.data) !== null && _widgetData$list$data !== void 0 && _widgetData$list$data.length);
      },
      fields: field,
      component: provided => {
        var _provided$widgetData$;

        const eventView = props.eventView.clone();

        if (!((_provided$widgetData$ = provided.widgetData.list.data[selectedListIndex]) !== null && _provided$widgetData$ !== void 0 && _provided$widgetData$.transaction)) {
          return null;
        }

        eventView.additionalConditions.setFilterValues('transaction', [provided.widgetData.list.data[selectedListIndex].transaction]);

        if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ISSUES) {
          var _provided$widgetData$2;

          if (!((_provided$widgetData$2 = provided.widgetData.list.data[selectedListIndex]) !== null && _provided$widgetData$2 !== void 0 && _provided$widgetData$2.issue)) {
            return null;
          }

          eventView.fields = [{
            field: 'issue'
          }, {
            field: 'issue.id'
          }, {
            field: 'transaction'
          }, {
            field
          }];
          eventView.additionalConditions.setFilterValues('issue', [provided.widgetData.list.data[selectedListIndex].issue]);
          eventView.additionalConditions.setFilterValues('event.type', ['error']);

          if ((0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__.canUseMetricsData)(organization)) {
            eventView.additionalConditions.setFilterValues('!transaction', [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_21__.UNPARAMETERIZED_TRANSACTION]);
          }

          eventView.additionalConditions.removeFilter('transaction.op'); // Remove transaction op incase it's applied from the performance view.

          eventView.additionalConditions.removeFilter('!transaction.op'); // Remove transaction op incase it's applied from the performance view.

          const mutableSearch = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch(eventView.query);
          mutableSearch.removeFilter('transaction.duration');
          eventView.query = mutableSearch.formatString();
        } else {
          eventView.fields = [{
            field: 'transaction'
          }, {
            field
          }];
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(EventsRequest, { ...lodash_pick__WEBPACK_IMPORTED_MODULE_5___default()(provided, _utils__WEBPACK_IMPORTED_MODULE_27__.eventsRequestQueryProps),
          limit: 1,
          includePrevious: true,
          includeTransformedData: true,
          partial: true,
          currentSeriesNames: [field],
          query: eventView.getQueryWithAdditionalConditions(),
          interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__.getInterval)({
            start: provided.start,
            end: provided.end,
            period: provided.period
          }, 'medium'),
          hideError: true,
          onError: pageError.setPageError,
          queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.getMEPParamsIfApplicable)(mepSetting, props.chartSetting)
        });
      },
      transform: _transforms_transformEventsToArea__WEBPACK_IMPORTED_MODULE_26__.transformEventsRequestToArea
    };
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [props.chartSetting, selectedListIndex, mepSetting.memoizationKey]);
  const Queries = {
    list: listQuery,
    chart: chartQuery
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_performanceWidget__WEBPACK_IMPORTED_MODULE_23__.GenericPerformanceWidget, { ...props,
    Subtitle: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.Subtitle, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Suggested transactions')
    }),
    HeaderActions: provided => {
      var _provided$widgetData$3;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ContainerActions, {
        isLoading: (_provided$widgetData$3 = provided.widgetData.list) === null || _provided$widgetData$3 === void 0 ? void 0 : _provided$widgetData$3.isLoading
      });
    },
    EmptyComponent: _components_selectableList__WEBPACK_IMPORTED_MODULE_24__.WidgetEmptyStateWarning,
    Queries: Queries,
    Visualizations: [{
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(DurationChart, { ...provided.widgetData.chart,
        ...provided,
        disableMultiAxis: true,
        disableXAxis: true,
        chartColors: props.chartColor ? [props.chartColor] : undefined,
        isLineChart: true
      }),
      height: props.chartHeight
    }, {
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__["default"], {
        selectedIndex: selectedListIndex,
        setSelectedIndex: setSelectListIndex,
        items: provided.widgetData.list.data.map(listItem => () => {
          var _ref, _valueMap;

          const transaction = (_ref = listItem.transaction) !== null && _ref !== void 0 ? _ref : '';
          const additionalQuery = {};

          if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_HTTP_OPS) {
            additionalQuery.breakdown = 'http';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_DB_OPS) {
            additionalQuery.breakdown = 'db';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_BROWSER_OPS) {
            additionalQuery.breakdown = 'browser';
            additionalQuery.display = 'latency';
          } else if (props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.SLOW_RESOURCE_OPS) {
            additionalQuery.breakdown = 'resource';
            additionalQuery.display = 'latency';
          }

          const transactionTarget = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_20__.transactionSummaryRouteWithQuery)({
            orgSlug: props.organization.slug,
            projectID: listItem['project.id'],
            transaction,
            query: props.eventView.getPageFiltersQuery(),
            additionalQuery
          });
          const fieldString = useEvents ? field : (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_14__.getAggregateAlias)(field);
          const valueMap = {
            [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ERRORS]: listItem.failure_count,
            [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ISSUES]: listItem.issue,
            slowest: (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_21__.getPerformanceDuration)(listItem[fieldString])
          };
          const rightValue = (_valueMap = valueMap[isSlowestType ? 'slowest' : props.chartSetting]) !== null && _valueMap !== void 0 ? _valueMap : listItem[fieldString];

          switch (props.chartSetting) {
            case _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ISSUES:
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.GrowLink, {
                  to: transactionTarget,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    value: transaction,
                    maxLength: 40
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.RightAlignedCell, {
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    title: listItem.title,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      to: `/organizations/${props.organization.slug}/issues/${listItem['issue.id']}/`,
                      children: rightValue
                    })
                  })
                }), !props.withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.ListClose, {
                  setSelectListIndex: setSelectListIndex,
                  onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_22__.excludeTransaction)(listItem.transaction, props)
                })]
              });

            case _widgetDefinitions__WEBPACK_IMPORTED_MODULE_28__.PerformanceWidgetSetting.MOST_RELATED_ERRORS:
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.GrowLink, {
                  to: transactionTarget,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    value: transaction,
                    maxLength: 40
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.RightAlignedCell, {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('[count] errors', {
                    count: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
                      value: rightValue
                    })
                  })
                }), !props.withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.ListClose, {
                  setSelectListIndex: setSelectListIndex,
                  onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_22__.excludeTransaction)(listItem.transaction, props)
                })]
              });

            default:
              if (typeof rightValue === 'number') {
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.GrowLink, {
                    to: transactionTarget,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_11__["default"], {
                      value: transaction,
                      maxLength: 40
                    })
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.RightAlignedCell, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
                      value: rightValue
                    })
                  }), !props.withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.ListClose, {
                    setSelectListIndex: setSelectListIndex,
                    onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_22__.excludeTransaction)(listItem.transaction, props)
                  })]
                });
              }

              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.GrowLink, {
                  to: transactionTarget,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    value: transaction,
                    maxLength: 40
                  })
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.RightAlignedCell, {
                  children: rightValue
                }), !props.withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_24__.ListClose, {
                  setSelectListIndex: setSelectListIndex,
                  onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_22__.excludeTransaction)(listItem.transaction, props)
                })]
              });
          }
        })
      }),
      height: 124,
      noPadding: true
    }]
  });
}
LineChartListWidget.displayName = "LineChartListWidget";
const EventsRequest = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__["default"])(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__["default"]);
const DurationChart = (0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(sentry_views_performance_charts_chart__WEBPACK_IMPORTED_MODULE_19__["default"]);

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgets/trendsWidget.tsx":
/*!************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgets/trendsWidget.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TrendsWidget": () => (/* binding */ TrendsWidget)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/trends/trendsDiscoverQuery */ "./app/utils/performance/trends/trendsDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_performance_trends_changedTransactions__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/trends/changedTransactions */ "./app/views/performance/trends/changedTransactions.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _trends_chart__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../../../trends/chart */ "./app/views/performance/trends/chart.tsx");
/* harmony import */ var _trends_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../../../trends/types */ "./app/views/performance/trends/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _components_performanceWidget__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _components_selectableList__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../components/selectableList */ "./app/views/performance/landing/widgets/components/selectableList.tsx");
/* harmony import */ var _transforms_transformTrendsDiscover__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../transforms/transformTrendsDiscover */ "./app/views/performance/landing/widgets/transforms/transformTrendsDiscover.tsx");
/* harmony import */ var _widgetDefinitions__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

 // eslint-disable-next-line no-restricted-imports




















const fields = [{
  field: 'transaction'
}, {
  field: 'project'
}];
function TrendsWidget(props) {
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_8__["default"])();
  const {
    eventView: _eventView,
    ContainerActions,
    location,
    organization,
    withStaticFilters
  } = props;
  const trendChangeType = props.chartSetting === _widgetDefinitions__WEBPACK_IMPORTED_MODULE_18__.PerformanceWidgetSetting.MOST_IMPROVED ? _trends_types__WEBPACK_IMPORTED_MODULE_13__.TrendChangeType.IMPROVED : _trends_types__WEBPACK_IMPORTED_MODULE_13__.TrendChangeType.REGRESSION;
  const trendFunctionField = _trends_types__WEBPACK_IMPORTED_MODULE_13__.TrendFunctionField.AVG; // Average is the easiest chart to understand.

  const [selectedListIndex, setSelectListIndex] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(0);

  const eventView = _eventView.clone();

  eventView.fields = fields;
  eventView.sorts = [{
    kind: trendChangeType === _trends_types__WEBPACK_IMPORTED_MODULE_13__.TrendChangeType.IMPROVED ? 'asc' : 'desc',
    field: 'trend_percentage()'
  }];
  const rest = { ...props,
    eventView
  };
  eventView.additionalConditions.addFilterValues('tpm()', ['>0.01']);
  eventView.additionalConditions.addFilterValues('count_percentage()', ['>0.25', '<4']);
  eventView.additionalConditions.addFilterValues('trend_percentage()', ['>0%']);
  eventView.additionalConditions.addFilterValues('confidence()', ['>6']);
  const chart = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => ({
    fields: ['transaction', 'project'],
    component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_6__["default"], { ...provided,
      eventView: provided.eventView,
      location: props.location,
      trendChangeType: trendChangeType,
      trendFunctionField: trendFunctionField,
      limit: 3,
      cursor: "0:0:1",
      noPagination: true
    }),
    transform: _transforms_transformTrendsDiscover__WEBPACK_IMPORTED_MODULE_17__.transformTrendsDiscover
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [props.chartSetting, trendChangeType]);
  const Queries = {
    chart
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_performanceWidget__WEBPACK_IMPORTED_MODULE_15__.GenericPerformanceWidget, { ...rest,
    Subtitle: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_16__.Subtitle, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Trending Transactions')
    }),
    HeaderActions: provided => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            onClick: () => (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__.handleTrendsClick)({
              location,
              organization,
              projectPlatforms: (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__.getSelectedProjectPlatforms)(location, projects)
            }),
            size: "sm",
            "data-test-id": "view-all-button",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('View All')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(ContainerActions, { ...provided.widgetData.chart
        })]
      });
    },
    EmptyComponent: _components_selectableList__WEBPACK_IMPORTED_MODULE_16__.WidgetEmptyStateWarning,
    Queries: Queries,
    Visualizations: [{
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(TrendsChart, { ...provided,
        ...rest,
        isLoading: provided.widgetData.chart.isLoading,
        statsData: provided.widgetData.chart.statsData,
        query: eventView.query,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        transaction: provided.widgetData.chart.transactionsList[selectedListIndex],
        trendChangeType: trendChangeType,
        trendFunctionField: trendFunctionField,
        disableXAxis: true,
        disableLegend: true
      }),
      bottomPadding: false,
      height: props.chartHeight
    }, {
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_16__["default"], {
        selectedIndex: selectedListIndex,
        setSelectedIndex: setSelectListIndex,
        items: provided.widgetData.chart.transactionsList.map(listItem => () => {
          const initialConditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_7__.MutableSearch([]);
          initialConditions.addFilterValues('transaction', [listItem.transaction]);
          const trendsTarget = (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__.trendsTargetRoute)({
            organization: props.organization,
            location: props.location,
            initialConditions,
            additionalQuery: {
              trendFunction: trendFunctionField
            }
          });
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_16__.GrowLink, {
              to: trendsTarget,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_4__["default"], {
                value: listItem.transaction,
                maxLength: 40
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_16__.RightAlignedCell, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_views_performance_trends_changedTransactions__WEBPACK_IMPORTED_MODULE_10__.CompareDurations, {
                transaction: listItem
              })
            }), !withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_16__.ListClose, {
              setSelectListIndex: setSelectListIndex,
              onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_14__.excludeTransaction)(listItem.transaction, props)
            })]
          });
        })
      }),
      height: 124,
      noPadding: true
    }]
  });
}
TrendsWidget.displayName = "TrendsWidget";
const TrendsChart = (0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_9__["default"])(_trends_chart__WEBPACK_IMPORTED_MODULE_12__.Chart));

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgets/vitalWidget.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgets/vitalWidget.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VitalBarCell": () => (/* binding */ VitalBarCell),
/* harmony export */   "VitalWidget": () => (/* binding */ VitalWidget),
/* harmony export */   "transformFieldsWithStops": () => (/* binding */ transformFieldsWithStops)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/performance/vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var sentry_views_performance_vitalDetail_vitalChart__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/performance/vitalDetail/vitalChart */ "./app/views/performance/vitalDetail/vitalChart.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _vitalsCards__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../../vitalsCards */ "./app/views/performance/landing/vitalsCards.tsx");
/* harmony import */ var _components_performanceWidget__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _components_selectableList__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../components/selectableList */ "./app/views/performance/landing/widgets/components/selectableList.tsx");
/* harmony import */ var _transforms_transformDiscoverToList__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../transforms/transformDiscoverToList */ "./app/views/performance/landing/widgets/transforms/transformDiscoverToList.tsx");
/* harmony import */ var _transforms_transformEventsToVitals__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../transforms/transformEventsToVitals */ "./app/views/performance/landing/widgets/transforms/transformEventsToVitals.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _widgetDefinitions__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ../widgetDefinitions */ "./app/views/performance/landing/widgets/widgetDefinitions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


































function getVitalFields(baseField) {
  const poorCountField = `count_web_vitals(${baseField}, poor)`;
  const mehCountField = `count_web_vitals(${baseField}, meh)`;
  const goodCountField = `count_web_vitals(${baseField}, good)`;
  const vitalFields = {
    poorCountField,
    mehCountField,
    goodCountField
  };
  return vitalFields;
}

function transformFieldsWithStops(props) {
  const {
    field,
    fields,
    vitalStops
  } = props;
  const poorStop = vitalStops === null || vitalStops === void 0 ? void 0 : vitalStops.poor;
  const mehStop = vitalStops === null || vitalStops === void 0 ? void 0 : vitalStops.meh;

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(poorStop) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(mehStop)) {
    return {
      sortField: fields[0],
      fieldsList: fields
    };
  }

  const vitalFields = getVitalFields(field);
  const fieldsList = [vitalFields.poorCountField, vitalFields.mehCountField, vitalFields.goodCountField];
  return {
    sortField: vitalFields.poorCountField,
    vitalFields,
    fieldsList
  };
}
function VitalWidget(props) {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__.useMEPSettingContext)();
  const {
    ContainerActions,
    eventView,
    organization,
    location
  } = props;
  const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
  const [selectedListIndex, setSelectListIndex] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(0);
  const field = props.fields[0];
  const pageError = (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_16__.usePageError)();
  const {
    fieldsList,
    vitalFields,
    sortField
  } = transformFieldsWithStops({
    field,
    fields: props.fields,
    vitalStops: props.chartDefinition.vitalStops
  });
  const Queries = {
    list: (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => ({
      fields: sortField,
      component: provided => {
        const _eventView = provided.eventView.clone();

        const fieldFromProps = fieldsList.map(propField => ({
          field: propField
        }));
        _eventView.sorts = [{
          kind: 'desc',
          field: sortField
        }];

        if ((0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_15__.canUseMetricsData)(organization)) {
          _eventView.additionalConditions.setFilterValues('!transaction', [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_20__.UNPARAMETERIZED_TRANSACTION]);
        }

        _eventView.fields = [{
          field: 'transaction'
        }, {
          field: 'title'
        }, {
          field: 'project.id'
        }, ...fieldFromProps];
        const mutableSearch = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(_eventView.query);
        _eventView.query = mutableSearch.formatString();
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_12__["default"], { ...provided,
          eventView: _eventView,
          location: props.location,
          limit: 4,
          cursor: "0:0:1",
          noPagination: true,
          queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_29__.getMEPQueryParams)(mepSetting),
          useEvents: useEvents
        });
      },
      transform: _transforms_transformDiscoverToList__WEBPACK_IMPORTED_MODULE_27__.transformDiscoverToList
    }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.eventView, fieldsList, props.organization.slug, mepSetting.memoizationKey]),
    chart: (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => ({
      enabled: widgetData => {
        var _widgetData$list, _widgetData$list$data;

        return !!(widgetData !== null && widgetData !== void 0 && (_widgetData$list = widgetData.list) !== null && _widgetData$list !== void 0 && (_widgetData$list$data = _widgetData$list.data) !== null && _widgetData$list$data !== void 0 && _widgetData$list$data.length);
      },
      fields: fieldsList,
      component: provided => {
        var _provided$widgetData$;

        const _eventView = provided.eventView.clone();

        _eventView.additionalConditions.setFilterValues('transaction', [(_provided$widgetData$ = provided.widgetData.list.data[selectedListIndex]) === null || _provided$widgetData$ === void 0 ? void 0 : _provided$widgetData$.transaction]);

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(EventsRequest, { ...lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(provided, _utils__WEBPACK_IMPORTED_MODULE_29__.eventsRequestQueryProps),
          limit: 1,
          currentSeriesNames: [sortField],
          includePrevious: false,
          partial: false,
          includeTransformedData: true,
          query: _eventView.getQueryWithAdditionalConditions(),
          interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__.getInterval)({
            start: provided.start,
            end: provided.end,
            period: provided.period
          }, 'medium'),
          hideError: true,
          onError: pageError.setPageError,
          queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_29__.getMEPQueryParams)(mepSetting)
        });
      },
      transform: _transforms_transformEventsToVitals__WEBPACK_IMPORTED_MODULE_28__.transformEventsRequestToVitals
    }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.chartSetting, selectedListIndex, mepSetting.memoizationKey])
  };
  const settingToVital = {
    [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_30__.PerformanceWidgetSetting.WORST_LCP_VITALS]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital.LCP,
    [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_30__.PerformanceWidgetSetting.WORST_FCP_VITALS]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital.FCP,
    [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_30__.PerformanceWidgetSetting.WORST_FID_VITALS]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital.FID,
    [_widgetDefinitions__WEBPACK_IMPORTED_MODULE_30__.PerformanceWidgetSetting.WORST_CLS_VITALS]: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.WebVital.CLS
  };

  const handleViewAllClick = () => {// TODO(k-fish): Add analytics.
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_performanceWidget__WEBPACK_IMPORTED_MODULE_25__.GenericPerformanceWidget, { ...props,
    Subtitle: provided => {
      var _provided$widgetData$2, _provided$widgetData$3;

      const listItem = (_provided$widgetData$2 = provided.widgetData.list) === null || _provided$widgetData$2 === void 0 ? void 0 : _provided$widgetData$2.data[selectedListIndex];

      if (!listItem) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__.Subtitle, {});
      }

      const vital = settingToVital[props.chartSetting];
      const data = {
        [settingToVital[props.chartSetting]]: getVitalDataForListItem(listItem, vital, !useEvents)
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__.Subtitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_vitalsCards__WEBPACK_IMPORTED_MODULE_24__.VitalBar, {
          isLoading: (_provided$widgetData$3 = provided.widgetData.list) === null || _provided$widgetData$3 === void 0 ? void 0 : _provided$widgetData$3.isLoading,
          vital: settingToVital[props.chartSetting],
          data: data,
          showBar: false,
          showDurationDetail: false,
          showDetail: true
        })
      });
    },
    EmptyComponent: _components_selectableList__WEBPACK_IMPORTED_MODULE_26__.WidgetEmptyStateWarning,
    HeaderActions: provided => {
      const vital = settingToVital[props.chartSetting];
      const target = (0,sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_21__.vitalDetailRouteWithQuery)({
        orgSlug: organization.slug,
        query: eventView.generateQueryStringObject(),
        vitalName: vital,
        projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeList)(location.query.project)
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            onClick: handleViewAllClick,
            to: target,
            size: "sm",
            "data-test-id": "view-all-button",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('View All')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(ContainerActions, { ...provided.widgetData.chart
        })]
      });
    },
    Queries: Queries,
    Visualizations: [{
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(sentry_views_performance_vitalDetail_vitalChart__WEBPACK_IMPORTED_MODULE_22__._VitalChart, { ...provided.widgetData.chart,
        ...provided,
        field: field,
        vitalFields: vitalFields,
        grid: provided.grid
      }),
      height: props.chartHeight
    }, {
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__["default"], {
        selectedIndex: selectedListIndex,
        setSelectedIndex: setSelectListIndex,
        items: provided.widgetData.list.data.slice(0, 3).map(listItem => () => {
          var _ref, _provided$widgetData$4;

          const transaction = (_ref = listItem === null || listItem === void 0 ? void 0 : listItem.transaction) !== null && _ref !== void 0 ? _ref : '';

          const _eventView = eventView.clone();

          const initialConditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(_eventView.query);
          initialConditions.addFilterValues('transaction', [transaction]);
          const vital = settingToVital[props.chartSetting];
          _eventView.query = initialConditions.formatString();
          const target = (0,sentry_views_performance_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_21__.vitalDetailRouteWithQuery)({
            orgSlug: organization.slug,
            query: _eventView.generateQueryStringObject(),
            vitalName: vital,
            projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeList)(location.query.project)
          });
          const data = {
            [settingToVital[props.chartSetting]]: getVitalDataForListItem(listItem, vital, !useEvents)
          };
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__.GrowLink, {
              to: target,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_8__["default"], {
                value: transaction,
                maxLength: 40
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(VitalBarCell, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_vitalsCards__WEBPACK_IMPORTED_MODULE_24__.VitalBar, {
                isLoading: (_provided$widgetData$4 = provided.widgetData.list) === null || _provided$widgetData$4 === void 0 ? void 0 : _provided$widgetData$4.isLoading,
                vital: settingToVital[props.chartSetting],
                data: data,
                showBar: true,
                showDurationDetail: false,
                showDetail: false,
                showTooltip: true,
                barHeight: 20
              })
            }), !props.withStaticFilters && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_31__.jsx)(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__.ListClose, {
              setSelectListIndex: setSelectListIndex,
              onClick: () => (0,_utils__WEBPACK_IMPORTED_MODULE_23__.excludeTransaction)(listItem.transaction, props)
            })]
          });
        })
      }),
      height: 124,
      noPadding: true
    }]
  });
}
VitalWidget.displayName = "VitalWidget";

function getVitalDataForListItem(listItem, vital) {
  let useAggregateAlias = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  const vitalFields = getVitalFields(vital);

  const transformFieldName = fieldName => useAggregateAlias ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.getAggregateAlias)(fieldName) : fieldName;

  const poorData = listItem[transformFieldName(vitalFields.poorCountField)] || 0;
  const mehData = listItem[transformFieldName(vitalFields.mehCountField)] || 0;
  const goodData = listItem[transformFieldName(vitalFields.goodCountField)] || 0;
  const _vitalData = {
    poor: poorData,
    meh: mehData,
    good: goodData,
    p75: 0
  };
  const vitalData = { ..._vitalData,
    total: _vitalData.poor + _vitalData.meh + _vitalData.good
  };
  return vitalData;
}

const VitalBarCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_components_selectableList__WEBPACK_IMPORTED_MODULE_26__.RightAlignedCell,  true ? {
  target: "ejni1p10"
} : 0)("width:120px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";display:flex;align-items:center;justify-content:center;" + ( true ? "" : 0));
const EventsRequest = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__["default"])(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__["default"]);

/***/ }),

/***/ "./app/views/performance/table.tsx":
/*!*****************************************!*\
  !*** ./app/views/performance/table.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getProjectID": () => (/* binding */ getProjectID)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var _landing_widgets_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./landing/widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _transactionSummary_transactionThresholdModal__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./transactionSummary/transactionThresholdModal */ "./app/views/performance/transactionSummary/transactionThresholdModal.tsx");
/* harmony import */ var _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./data */ "./app/views/performance/data.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























function getProjectID(eventData, projects) {
  const projectSlug = (eventData === null || eventData === void 0 ? void 0 : eventData.project) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  const project = projects.find(currentProject => currentProject.slug === projectSlug);

  if (!project) {
    return undefined;
  }

  return project.id;
}

class _Table extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      widths: [],
      transaction: undefined,
      transactionThreshold: undefined,
      transactionThresholdMetric: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCellAction", (column, dataRow) => {
      return (action, value) => {
        const {
          eventView,
          location,
          organization,
          projects
        } = this.props;
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('performance_views.overview.cellaction', {
          organization,
          action
        });

        if (action === sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.EDIT_THRESHOLD) {
          const project_threshold = dataRow.project_threshold_config;
          const transactionName = dataRow.transaction;
          const projectID = getProjectID(dataRow, projects);
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_transactionSummary_transactionThresholdModal__WEBPACK_IMPORTED_MODULE_25__["default"], { ...modalProps,
            organization: organization,
            transactionName: transactionName,
            eventView: eventView,
            project: projectID,
            transactionThreshold: project_threshold[1],
            transactionThresholdMetric: project_threshold[0],
            onApply: (threshold, metric) => {
              if (threshold !== project_threshold[1] || metric !== project_threshold[0]) {
                this.setState({
                  transaction: transactionName,
                  transactionThreshold: threshold,
                  transactionThresholdMetric: metric
                });
              }

              (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('[transactionName] updated successfully', {
                transactionName
              }));
            }
          }), {
            modalCss: _transactionSummary_transactionThresholdModal__WEBPACK_IMPORTED_MODULE_25__.modalCss,
            backdrop: 'static'
          });
          return;
        }

        const searchConditions = (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_26__.normalizeSearchConditionsWithTransactionName)(eventView.query);
        (0,sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.updateQuery)(searchConditions, action, column, value);
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
          pathname: location.pathname,
          query: { ...location.query,
            cursor: undefined,
            query: searchConditions.formatString()
          }
        });
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCellWithData", tableData => {
      return (column, dataRow) => this.renderBodyCell(tableData, column, dataRow);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "paginationAnalyticsEvent", direction => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('performance_views.landingv3.table_pagination', {
        organization,
        direction
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderHeadCellWithMeta", tableMeta => {
      var _this$props$columnTit;

      const columnTitles = (_this$props$columnTit = this.props.columnTitles) !== null && _this$props$columnTit !== void 0 ? _this$props$columnTit : _data__WEBPACK_IMPORTED_MODULE_27__.COLUMN_TITLES;
      return (column, index) => this.renderHeadCell(tableMeta, column, columnTitles[index]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderPrependCellWithData", tableData => {
      const {
        eventView
      } = this.props;
      const teamKeyTransactionColumn = eventView.getColumns().find(col => col.name === 'team_key_transaction');
      return (isHeader, dataRow) => {
        if (teamKeyTransactionColumn) {
          if (isHeader) {
            const star = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(TeamKeyTransactionWrapper, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconStar, {
                color: "yellow300",
                isSolid: true,
                "data-test-id": "team-key-transaction-header"
              }, "keyTransaction")
            });

            return [this.renderHeadCell(tableData === null || tableData === void 0 ? void 0 : tableData.meta, teamKeyTransactionColumn, star)];
          }

          return [this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow)];
        }

        return [];
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSummaryClick", () => {
      const {
        organization,
        location,
        projects
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('performance_views.overview.navigate.summary', {
        organization,
        project_platforms: (0,_utils__WEBPACK_IMPORTED_MODULE_28__.getSelectedProjectPlatforms)(location, projects)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResizeColumn", (columnIndex, nextColumn) => {
      const widths = [...this.state.widths];
      widths[columnIndex] = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_9__.COL_WIDTH_UNDEFINED;
      this.setState({
        widths
      });
    });
  }

  renderBodyCell(tableData, column, dataRow) {
    const {
      eventView,
      organization,
      projects,
      location,
      withStaticFilters
    } = this.props;
    const isAlias = !organization.features.includes('performance-frontend-use-events-endpoint');

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }

    const tableMeta = tableData.meta;
    const field = String(column.key);
    const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_20__.getFieldRenderer)(field, tableMeta, isAlias);
    const rendered = fieldRenderer(dataRow, {
      organization,
      location
    });
    const allowActions = [sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.ADD, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.EXCLUDE, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.SHOW_GREATER_THAN, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.SHOW_LESS_THAN, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.Actions.EDIT_THRESHOLD];
    const cellActions = withStaticFilters ? [] : allowActions;

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();

      if (dataRow['http.method']) {
        summaryView.additionalConditions.setFilterValues('http.method', [dataRow['http.method']]);
      }

      summaryView.query = summaryView.getQueryWithAdditionalConditions();
      const isUnparameterizedRow = dataRow.transaction === _utils__WEBPACK_IMPORTED_MODULE_28__.UNPARAMETERIZED_TRANSACTION;
      const target = isUnparameterizedRow ? (0,_utils__WEBPACK_IMPORTED_MODULE_28__.createUnnamedTransactionsDiscoverTarget)({
        organization,
        location
      }) : (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_26__.transactionSummaryRouteWithQuery)({
        orgSlug: organization.slug,
        transaction: String(dataRow.transaction) || '',
        query: summaryView.generateQueryStringObject(),
        projectID
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__["default"], {
        column: column,
        dataRow: dataRow,
        handleCellAction: this.handleCellAction(column, dataRow),
        allowActions: cellActions,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_11__["default"], {
          to: target,
          onClick: this.handleSummaryClick,
          style: {
            display: `block`,
            width: `100%`
          },
          children: rendered
        })
      });
    }

    if (field.startsWith('team_key_transaction')) {
      // don't display per cell actions for team_key_transaction
      return rendered;
    }

    const fieldName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.getAggregateAlias)(field);
    const value = dataRow[fieldName];

    if (tableMeta[fieldName] === 'integer' && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(value) && value > 999) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
        title: value.toLocaleString(),
        containerDisplayMode: "block",
        position: "right",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__["default"], {
          column: column,
          dataRow: dataRow,
          handleCellAction: this.handleCellAction(column, dataRow),
          allowActions: cellActions,
          children: rendered
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__["default"], {
      column: column,
      dataRow: dataRow,
      handleCellAction: this.handleCellAction(column, dataRow),
      allowActions: cellActions,
      children: rendered
    });
  }

  onSortClick(currentSortKind, currentSortField) {
    const {
      organization
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('performance_views.landingv2.transactions.sort', {
      organization,
      field: currentSortField,
      direction: currentSortKind
    });
  }

  renderHeadCell(tableMeta, column, title) {
    const {
      eventView,
      location
    } = this.props;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.fieldAlignment)(column.name, column.type, tableMeta);
    const field = {
      field: column.name,
      width: column.width
    };
    const aggregateAliasTableMeta = {};

    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.getAggregateAlias)(key)] = tableMeta[key];
      });
    }

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, aggregateAliasTableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();
      return { ...location,
        query: { ...location.query,
          sort: queryStringObject.sort
        }
      };
    }

    const currentSort = eventView.sortForField(field, aggregateAliasTableMeta);
    const canSort = (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_19__.isFieldSortable)(field, aggregateAliasTableMeta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const currentSortField = currentSort ? currentSort.field : undefined;

    const sortLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
      align: align,
      title: title || field.field,
      direction: currentSortKind,
      canSort: canSort,
      generateSortLink: generateSortLink,
      onClick: () => this.onSortClick(currentSortKind, currentSortField)
    });

    if (field.field.startsWith('user_misery')) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_8__["default"], {
        target: "project_transaction_threshold",
        position: "top",
        children: sortLink
      });
    }

    return sortLink;
  }

  getSortedEventView() {
    const {
      eventView
    } = this.props;
    return eventView.withSorts([{
      field: 'team_key_transaction',
      kind: 'desc'
    }, ...eventView.sorts]);
  }

  render() {
    const {
      eventView,
      organization,
      location,
      setError
    } = this.props;
    const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
    const {
      widths,
      transaction,
      transactionThreshold
    } = this.state;
    const columnOrder = eventView.getColumns(useEvents) // remove team_key_transactions from the column order as we'll be rendering it
    // via a prepended column
    .filter(col => col.name !== 'team_key_transaction' && !col.name.startsWith('count_miserable') && col.name !== 'project_threshold_config').map((col, i) => {
      if (typeof widths[i] === 'number') {
        return { ...col,
          width: widths[i]
        };
      }

      return col;
    });
    const sortedEventView = this.getSortedEventView();
    const columnSortBy = sortedEventView.getSorts();
    const prependColumnWidths = ['max-content'];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("div", {
      "data-test-id": "performance-table",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_22__.MEPConsumer, {
        children: value => {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_18__["default"], {
            eventView: sortedEventView,
            orgSlug: organization.slug,
            location: location,
            setError: error => setError(error === null || error === void 0 ? void 0 : error.message),
            referrer: "api.performance.landing-table",
            transactionName: transaction,
            transactionThreshold: transactionThreshold,
            queryExtras: (0,_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_24__.getMEPQueryParams)(value),
            useEvents: useEvents,
            children: _ref => {
              let {
                pageLinks,
                isLoading,
                tableData
              } = _ref;
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  isLoading: isLoading,
                  data: tableData ? tableData.data : [],
                  columnOrder: columnOrder,
                  columnSortBy: columnSortBy,
                  grid: {
                    onResizeColumn: this.handleResizeColumn,
                    renderHeadCell: this.renderHeadCellWithMeta(tableData === null || tableData === void 0 ? void 0 : tableData.meta),
                    renderBodyCell: this.renderBodyCellWithData(tableData),
                    renderPrependColumns: this.renderPrependCellWithData(tableData),
                    prependColumnWidths
                  },
                  location: location
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  pageLinks: pageLinks,
                  paginationAnalyticsEvent: this.paginationAnalyticsEvent
                })]
              });
            }
          });
        }
      })
    });
  }

}

_Table.displayName = "_Table";

function Table(props) {
  var _props$summaryConditi;

  const summaryConditions = (_props$summaryConditi = props.summaryConditions) !== null && _props$summaryConditi !== void 0 ? _props$summaryConditi : props.eventView.getQueryWithAdditionalConditions();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_Table, { ...props,
    summaryConditions: summaryConditions
  });
}

Table.displayName = "Table";

// Align the contained IconStar with the IconStar buttons in individual table
// rows, which have 2px padding + 1px border.
const TeamKeyTransactionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e4or71w0"
} : 0)( true ? {
  name: "1cwazio",
  styles: "padding:3px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Table);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/metricEvents/metricsEventsDropdown.tsx":
/*!*************************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/metricEvents/metricsEventsDropdown.tsx ***!
  \*************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricsEventsDropdown": () => (/* binding */ MetricsEventsDropdown)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const autoTextMap = {
  [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.AutoSampleState.unset]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Auto'),
  [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.AutoSampleState.metrics]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Auto (metrics)'),
  [sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.AutoSampleState.transactions]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Auto (transactions)')
};

function getOptions(mepContext) {
  const autoText = autoTextMap[mepContext.autoSampleState];

  const prefix = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("span", {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Dataset')
  });

  return [{
    value: sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.MEPState.auto,
    prefix,
    label: autoText
  }, {
    value: sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.MEPState.metricsOnly,
    prefix,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Processed')
  }, {
    value: sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.MEPState.transactionsOnly,
    prefix,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Indexed')
  }];
}

function MetricsEventsDropdown() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['performance-use-metrics'],
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(InnerDropdown, {})
  });
}
MetricsEventsDropdown.displayName = "MetricsEventsDropdown";

function InnerDropdown() {
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_3__.useMEPSettingContext)();
  const options = getOptions(mepSetting);
  const currentOption = options.find(_ref => {
    let {
      value
    } = _ref;
    return value === mepSetting.metricSettingState;
  }) || options[0];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_1__["default"], {
    triggerProps: {
      prefix: currentOption.prefix
    },
    value: currentOption.value,
    options: options,
    onChange: opt => mepSetting.setMetricSettingState(opt.value)
  });
}

InnerDropdown.displayName = "InnerDropdown";

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalChart.tsx":
/*!**********************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalChart.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "_VitalChart": () => (/* binding */ _VitalChart),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports
























function VitalChart(_ref) {
  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    router,
    start,
    end,
    interval
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_19__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.a)();
  const vitalName = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.vitalNameFromLocation)(location);
  const yAxis = `p75(${vitalName})`;
  const {
    utc,
    legend,
    vitalPoor,
    markLines,
    chartOptions
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getVitalChartDefinitions)({
    theme,
    location,
    yAxis,
    vital: vitalName
  });

  function handleLegendSelectChanged(legendChange) {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const to = { ...location,
      query: { ...location.query,
        unselectedSeries: unselected
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push(to);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.ChartContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.HeaderTitleLegend, {
        children: [(0,_utils__WEBPACK_IMPORTED_MODULE_21__.getVitalChartTitle)(vitalName), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
          size: "sm",
          position: "top",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(`The durations shown should fall under the vital threshold.`)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__["default"], {
        router: router,
        period: statsPeriod,
        start: start,
        end: end,
        utc: utc,
        children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__["default"], {
          api: api,
          organization: organization,
          period: statsPeriod,
          project: project,
          environment: environment,
          start: start,
          end: end,
          interval: interval,
          showLoading: false,
          query: query,
          includePrevious: false,
          yAxis: [yAxis],
          partial: true,
          children: _ref2 => {
            let {
              timeseriesData: results,
              errored,
              loading,
              reloading
            } = _ref2;

            if (errored) {
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconWarning, {
                  color: "gray500",
                  size: "lg"
                })
              });
            }

            const colors = results && theme.charts.getColorPalette(results.length - 2) || [];
            const {
              smoothedResults
            } = (0,_trends_utils__WEBPACK_IMPORTED_MODULE_20__.transformEventStatsSmoothed)(results);
            const smoothedSeries = smoothedResults ? smoothedResults.map((_ref3, i) => {
              let {
                seriesName,
                ...rest
              } = _ref3;
              return {
                seriesName: (0,_trends_utils__WEBPACK_IMPORTED_MODULE_20__.replaceSeriesName)(seriesName) || 'p75',
                ...rest,
                color: colors[i],
                lineStyle: {
                  opacity: 1,
                  width: 2
                }
              };
            }) : [];
            const seriesMax = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getMaxOfSeries)(smoothedSeries);
            const yAxisMax = Math.max(seriesMax, vitalPoor);
            chartOptions.yAxis.max = yAxisMax * 1.1;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_7__["default"], {
              start: start,
              end: end,
              period: statsPeriod,
              utc: utc,
              projects: project,
              environments: environment,
              children: _ref4 => {
                let {
                  releaseSeries
                } = _ref4;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  loading: loading,
                  reloading: reloading,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    visible: reloading
                  }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__["default"])({
                    value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__.LineChart, { ...zoomRenderProps,
                      ...chartOptions,
                      legend: legend,
                      onLegendSelectChanged: handleLegendSelectChanged,
                      series: [...markLines, ...releaseSeries, ...smoothedSeries]
                    }),
                    fixed: 'Web Vitals Chart'
                  })]
                });
              }
            });
          }
        })
      })]
    })
  });
}

VitalChart.displayName = "VitalChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(VitalChart));

function fieldToVitalType(seriesName, vitalFields) {
  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.poorCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.POOR;
  }

  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.mehCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.MEH;
  }

  if (seriesName === (vitalFields === null || vitalFields === void 0 ? void 0 : vitalFields.goodCountField.replace('equation|', ''))) {
    return _utils__WEBPACK_IMPORTED_MODULE_21__.VitalState.GOOD;
  }

  return undefined;
}

function _VitalChart(props) {
  const {
    field: yAxis,
    data: _results,
    loading,
    reloading,
    height,
    grid,
    utc,
    vitalFields
  } = props;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.a)();

  if (!_results || !vitalFields) {
    return null;
  }

  const chartOptions = {
    grid,
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, seriesName) => {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.aggregateOutputType)(vitalFields[0] === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_17__.WebVital.CLS ? seriesName : yAxis));
      }
    },
    xAxis: {
      show: false
    },
    xAxes: undefined,
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_15__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_16__.aggregateOutputType)(yAxis))
      }
    },
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true
  };

  const results = _results.filter(s => !!fieldToVitalType(s.seriesName, vitalFields));

  const smoothedSeries = results !== null && results !== void 0 && results.length ? results.map(_ref5 => {
    let {
      seriesName,
      ...rest
    } = _ref5;
    const adjustedSeries = fieldToVitalType(seriesName, vitalFields) || 'count';
    return {
      seriesName: adjustedSeries,
      ...rest,
      color: theme[_utils__WEBPACK_IMPORTED_MODULE_21__.vitalStateColors[adjustedSeries]],
      lineStyle: {
        opacity: 1,
        width: 2
      }
    };
  }) : [];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("div", {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
      loading: loading,
      reloading: reloading,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
        visible: reloading
      }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_18__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__.LineChart, {
          height: height,
          ...chartOptions,
          onLegendSelectChanged: () => {},
          series: [...smoothedSeries],
          isGroupedByDate: true
        }),
        fixed: 'Web Vitals Chart'
      })]
    })
  });
}
_VitalChart.displayName = "_VitalChart";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_content_tsx.daf8d615eaa226c7ef421af6b57e91fa.js.map