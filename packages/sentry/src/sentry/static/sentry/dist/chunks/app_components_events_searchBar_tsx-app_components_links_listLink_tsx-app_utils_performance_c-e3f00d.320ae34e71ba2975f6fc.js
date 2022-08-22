"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_searchBar_tsx-app_components_links_listLink_tsx-app_utils_performance_c-e3f00d"],{

/***/ "./app/components/events/searchBar.tsx":
/*!*********************************************!*\
  !*** ./app/components/events/searchBar.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/assign */ "../node_modules/lodash/assign.js");
/* harmony import */ var lodash_assign__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_assign__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withTags */ "./app/utils/withTags.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(`^${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.NEGATION_OPERATOR}|\\${sentry_constants__WEBPACK_IMPORTED_MODULE_10__.SEARCH_WILDCARD}`, 'g');

const getFunctionTags = fields => Object.fromEntries(fields.filter(item => !Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).includes(item.field) && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isEquation)(item.field)).map(item => [item.field, {
  key: item.field,
  name: item.field,
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FUNCTION
}]));

const getFieldTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.FIELD_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

const getMeasurementTags = measurements => Object.fromEntries(Object.keys(measurements).map(key => [key, { ...measurements[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.MEASUREMENT
}]));

const getSpanTags = () => {
  return Object.fromEntries(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SPAN_OP_BREAKDOWN_FIELDS.map(key => [key, {
    key,
    name: key,
    kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.METRICS
  }]));
};

const getSemverTags = () => Object.fromEntries(Object.keys(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS).map(key => [key, { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.SEMVER_TAGS[key],
  kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
}]));

function SearchBar(props) {
  const {
    maxSearchItems,
    organization,
    tags,
    omitTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    maxMenuHeight
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_16__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    var _getEventFieldValues$, _getEventFieldValues$2;

    // Clear memoized data on mount to make tests more consistent.
    (_getEventFieldValues$ = (_getEventFieldValues$2 = getEventFieldValues.cache).clear) === null || _getEventFieldValues$ === void 0 ? void 0 : _getEventFieldValues$.call(_getEventFieldValues$2); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds]); // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready

  const getEventFieldValues = lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default()((tag, query, endpointParams) => {
    const projectIdStrings = projectIds === null || projectIds === void 0 ? void 0 : projectIds.map(String);

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isAggregateField)(tag.key) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isMeasurement)(tag.key)) {
      // We can't really auto suggest values for aggregate fields
      // or measurements, so we simply don't
      return Promise.resolve([]);
    }

    return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_8__.fetchTagValues)(api, organization.slug, tag.key, query, projectIdStrings, endpointParams, // allows searching for tags on transactions as well
    true, // allows searching for tags on sessions as well
    includeSessionTagsValues).then(results => lodash_flatten__WEBPACK_IMPORTED_MODULE_5___default()(results.filter(_ref => {
      let {
        name
      } = _ref;
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(name);
    }).map(_ref2 => {
      let {
        name
      } = _ref2;
      return name;
    })), () => {
      throw new Error('Unable to fetch event field values');
    });
  }, (_ref3, query) => {
    let {
      key
    } = _ref3;
    return `${key}-${query}`;
  });

  const getTagList = measurements => {
    const functionTags = getFunctionTags(fields !== null && fields !== void 0 ? fields : []);
    const fieldTags = getFieldTags();
    const measurementsWithKind = getMeasurementTags(measurements);
    const spanTags = getSpanTags();
    const semverTags = getSemverTags();
    const orgHasPerformanceView = organization.features.includes('performance-view');
    const combinedTags = orgHasPerformanceView ? Object.assign({}, measurementsWithKind, spanTags, fieldTags, functionTags) : lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(fieldTags, sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.TRACING_FIELDS);
    const tagsWithKind = Object.fromEntries(Object.keys(tags).map(key => [key, { ...tags[key],
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.TAG
    }]));
    lodash_assign__WEBPACK_IMPORTED_MODULE_4___default()(combinedTags, tagsWithKind, fieldTags, semverTags);
    const sortedTagKeys = Object.keys(combinedTags);
    sortedTagKeys.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    combinedTags.has = {
      key: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKey.HAS,
      name: 'Has property',
      values: sortedTagKeys,
      predefined: true,
      kind: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_14__.FieldKind.FIELD
    };
    return lodash_omit__WEBPACK_IMPORTED_MODULE_7___default()(combinedTags, omitTags !== null && omitTags !== void 0 ? omitTags : []);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__["default"], {
    children: _ref4 => {
      let {
        measurements
      } = _ref4;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
        hasRecentSearches: true,
        savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_11__.SavedSearchType.EVENT,
        onGetTagValues: getEventFieldValues,
        supportedTags: getTagList(measurements),
        prepareQuery: query => {
          // Prepare query string (e.g. strip special characters like negation operator)
          return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
        },
        maxSearchItems: maxSearchItems,
        excludeEnvironment: true,
        maxMenuHeight: maxMenuHeight !== null && maxMenuHeight !== void 0 ? maxMenuHeight : 300,
        ...props
      });
    }
  });
}

SearchBar.displayName = "SearchBar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_17__["default"])(SearchBar));

/***/ }),

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

/***/ "./app/utils/measurements/measurements.tsx":
/*!*************************************************!*\
  !*** ./app/utils/measurements/measurements.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getMeasurements": () => (/* binding */ getMeasurements)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function measurementsFromDetails(details) {
  return Object.fromEntries(Object.entries(details).map(_ref => {
    let [key, value] = _ref;
    const newValue = {
      name: value.name,
      key
    };
    return [key, newValue];
  }));
}

const MOBILE_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.MOBILE_VITAL_DETAILS);
const WEB_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.WEB_VITAL_DETAILS);
function getMeasurements() {
  return { ...WEB_MEASUREMENTS,
    ...MOBILE_MEASUREMENTS
  };
}

function Measurements(_ref2) {
  let {
    children
  } = _ref2;
  const measurements = getMeasurements();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      measurements
    })
  });
}

Measurements.displayName = "Measurements";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Measurements);

/***/ }),

/***/ "./app/utils/performance/contexts/metricsCardinality.tsx":
/*!***************************************************************!*\
  !*** ./app/utils/performance/contexts/metricsCardinality.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetricCardinalityConsumer": () => (/* binding */ MetricCardinalityConsumer),
/* harmony export */   "MetricsCardinalityProvider": () => (/* binding */ MetricsCardinalityProvider),
/* harmony export */   "useMetricsCardinalityContext": () => (/* binding */ useMetricsCardinalityContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuery__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/performance/metricsEnhanced/metricsCompatibilityQuery */ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx");
/* harmony import */ var sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuerySums__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums */ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const [_Provider, _useContext, _Context] = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createDefinedContext)({
  name: 'MetricsCardinalityContext',
  strict: false
});
/**
 * This provider determines whether the metrics data is storing performance information correctly before we
 * make dozens of requests on pages such as performance landing and dashboards.
 */

const MetricsCardinalityProvider = props => {
  const isUsingMetrics = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_4__.canUseMetricsData)(props.organization);

  if (!isUsingMetrics) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_Provider, {
      value: {
        isLoading: false,
        outcome: {
          forceTransactionsOnly: true
        }
      },
      children: props.children
    });
  }

  const baseDiscoverProps = {
    location: props.location,
    orgSlug: props.organization.slug,
    cursor: '0:0:0'
  };
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__["default"].fromLocation(props.location);
  eventView.fields = [{
    field: 'tpm()'
  }];

  const _eventView = adjustEventViewTime(eventView);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuery__WEBPACK_IMPORTED_MODULE_5__["default"], {
      eventView: _eventView,
      ...baseDiscoverProps,
      children: compatabilityResult => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_performance_metricsEnhanced_metricsCompatibilityQuerySums__WEBPACK_IMPORTED_MODULE_6__["default"], {
        eventView: _eventView,
        ...baseDiscoverProps,
        children: sumsResult => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_Provider, {
          value: {
            isLoading: compatabilityResult.isLoading || sumsResult.isLoading,
            outcome: compatabilityResult.isLoading || sumsResult.isLoading ? undefined : getMetricsOutcome(compatabilityResult.tableData && sumsResult.tableData ? { ...compatabilityResult.tableData,
              ...sumsResult.tableData
            } : null, !!compatabilityResult.error && !!sumsResult.error)
          },
          children: props.children
        })
      })
    })
  });
};
MetricsCardinalityProvider.displayName = "MetricsCardinalityProvider";
const MetricCardinalityConsumer = _Context.Consumer;
const useMetricsCardinalityContext = _useContext;
/**
 * Logic for picking sides of metrics vs. transactions along with the associated warnings.
 */

function getMetricsOutcome(dataCounts, hasOtherFallbackCondition) {
  const fallbackOutcome = {
    forceTransactionsOnly: true
  };
  const successOutcome = {
    forceTransactionsOnly: false
  };

  if (!dataCounts) {
    return fallbackOutcome;
  }

  const compatibleProjects = dataCounts.compatible_projects;

  if (hasOtherFallbackCondition) {
    return fallbackOutcome;
  }

  if (!dataCounts) {
    return fallbackOutcome;
  }

  if (checkForSamplingRules(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkNoDataFallback(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkIncompatibleData(dataCounts)) {
    return {
      shouldWarnIncompatibleSDK: true,
      forceTransactionsOnly: true,
      compatibleProjects
    };
  }

  if (checkIfAllOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      forceTransactionsOnly: true,
      compatibleProjects
    };
  }

  if (checkIfPartialOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      compatibleProjects,
      forceTransactionsOnly: false
    };
  }

  return successOutcome;
}
/**
 * Fallback if very similar amounts of metrics and transactions are found.
 * No projects with dynamic sampling means no rules have been enabled yet.
 */


function checkForSamplingRules(dataCounts) {
  var _dataCounts$dynamic_s;

  const counts = normalizeCounts(dataCounts);

  if (!((_dataCounts$dynamic_s = dataCounts.dynamic_sampling_projects) !== null && _dataCounts$dynamic_s !== void 0 && _dataCounts$dynamic_s.length)) {
    return true;
  }

  if (counts.metricsCount === 0) {
    return true;
  }

  return false;
}
/**
 * Fallback if no metrics found.
 */


function checkNoDataFallback(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return !counts.metricsCount;
}
/**
 * Fallback and warn if incompatible data found (old specific SDKs).
 */


function checkIncompatibleData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.nullCount > 0;
}
/**
 * Fallback and warn about unnamed transactions (specific SDKs).
 */


function checkIfAllOtherData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount >= counts.metricsCount;
}
/**
 * Show metrics but warn about unnamed transactions.
 */


function checkIfPartialOtherData(dataCounts) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount > 0;
}
/**
 * Temporary function, can be removed after API changes.
 */


function normalizeCounts(_ref) {
  let {
    sum
  } = _ref;

  try {
    const metricsCount = Number(sum.metrics);
    const unparamCount = Number(sum.metrics_unparam);
    const nullCount = Number(sum.metrics_null);
    return {
      metricsCount,
      unparamCount,
      nullCount
    };
  } catch (_) {
    return {
      metricsCount: 0,
      unparamCount: 0,
      nullCount: 0
    };
  }
}
/**
 * Performance optimization to limit the amount of rows scanned before showing the landing page.
 */


function adjustEventViewTime(eventView) {
  const _eventView = eventView.clone();

  if (!_eventView.start && !_eventView.end) {
    if (!_eventView.statsPeriod) {
      _eventView.statsPeriod = '1h';
      _eventView.start = undefined;
      _eventView.end = undefined;
    } else {
      const periodHours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.parsePeriodToHours)(_eventView.statsPeriod);

      if (periodHours > 1) {
        _eventView.statsPeriod = '1h';
        _eventView.start = undefined;
        _eventView.end = undefined;
      }
    }
  }

  return _eventView;
}

/***/ }),

/***/ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx":
/*!*****************************************************************************!*\
  !*** ./app/utils/performance/metricsEnhanced/metricsCompatibilityQuery.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MetricsCompatibilityQuery)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getRequestPayload(_ref) {
  let {
    eventView,
    location
  } = _ref;
  return lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page', 'query']);
}

function MetricsCompatibilityQuery(_ref2) {
  let {
    children,
    ...props
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "metrics-compatibility-sums",
    getRequestPayload: getRequestPayload,
    ...props,
    api: api,
    children: _ref3 => {
      let {
        tableData,
        ...rest
      } = _ref3;
      return children({
        tableData,
        ...rest
      });
    }
  });
}
MetricsCompatibilityQuery.displayName = "MetricsCompatibilityQuery";

/***/ }),

/***/ "./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx":
/*!*********************************************************************************!*\
  !*** ./app/utils/performance/metricsEnhanced/metricsCompatibilityQuerySums.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MetricsCompatibilitySumsQuery)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getRequestPayload(_ref) {
  let {
    eventView,
    location
  } = _ref;
  return lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page', 'query']);
}

function MetricsCompatibilitySumsQuery(_ref2) {
  let {
    children,
    ...props
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_2__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "metrics-compatibility",
    getRequestPayload: getRequestPayload,
    ...props,
    api: api,
    children: _ref3 => {
      let {
        tableData,
        ...rest
      } = _ref3;
      return children({
        tableData,
        ...rest
      });
    }
  });
}
MetricsCompatibilitySumsQuery.displayName = "MetricsCompatibilitySumsQuery";

/***/ }),

/***/ "./app/utils/withTags.tsx":
/*!********************************!*\
  !*** ./app/utils/withTags.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/tagStore */ "./app/stores/tagStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * HOC for getting *only* tags from the TagStore.
 */
function withTags(WrappedComponent) {
  class WithTags extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        tags: sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].getStateTags()
      });

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unsubscribe", sentry_stores_tagStore__WEBPACK_IMPORTED_MODULE_3__["default"].listen(tags => this.setState({
        tags
      }), undefined));
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    render() {
      const {
        tags,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(WrappedComponent, {
        tags: tags !== null && tags !== void 0 ? tags : this.state.tags,
        ...props
      });
    }

  }

  WithTags.displayName = "WithTags";

  (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(WithTags, "displayName", `withTags(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`);

  return WithTags;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withTags);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionThresholdModal.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionThresholdModal.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "METRIC_CHOICES": () => (/* binding */ METRIC_CHOICES),
/* harmony export */   "TransactionThresholdMetric": () => (/* binding */ TransactionThresholdMetric),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















let TransactionThresholdMetric;

(function (TransactionThresholdMetric) {
  TransactionThresholdMetric["TRANSACTION_DURATION"] = "duration";
  TransactionThresholdMetric["LARGEST_CONTENTFUL_PAINT"] = "lcp";
})(TransactionThresholdMetric || (TransactionThresholdMetric = {}));

const METRIC_CHOICES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Transaction Duration'),
  value: 'duration'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Largest Contentful Paint'),
  value: 'lcp'
}];

class TransactionThresholdModal extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      threshold: this.props.transactionThreshold,
      metric: this.props.transactionThresholdMetric,
      error: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleApply", event => {
      event.preventDefault();
      const {
        api,
        closeModal,
        organization,
        transactionName,
        onApply
      } = this.props;
      const project = this.getProject();

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(project)) {
        return;
      }

      const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;
      api.requestPromise(transactionThresholdUrl, {
        method: 'POST',
        includeAllArgs: true,
        query: {
          project: project.id
        },
        data: {
          transaction: transactionName,
          threshold: this.state.threshold,
          metric: this.state.metric
        }
      }).then(() => {
        closeModal();

        if (onApply) {
          onApply(this.state.threshold, this.state.metric);
        }
      }).catch(err => {
        var _ref, _err$responseJSON$thr, _err$responseJSON, _err$responseJSON2;

        this.setState({
          error: err
        });
        const errorMessage = (_ref = (_err$responseJSON$thr = (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.threshold) !== null && _err$responseJSON$thr !== void 0 ? _err$responseJSON$thr : (_err$responseJSON2 = err.responseJSON) === null || _err$responseJSON2 === void 0 ? void 0 : _err$responseJSON2.non_field_errors) !== null && _ref !== void 0 ? _ref : null;
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(errorMessage);
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", field => value => {
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(prevState);
        lodash_set__WEBPACK_IMPORTED_MODULE_5___default()(newState, field, value);
        return { ...newState,
          errors: undefined
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReset", event => {
      event.preventDefault();
      const {
        api,
        closeModal,
        organization,
        transactionName,
        onApply
      } = this.props;
      const project = this.getProject();

      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(project)) {
        return;
      }

      const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;
      api.requestPromise(transactionThresholdUrl, {
        method: 'DELETE',
        includeAllArgs: true,
        query: {
          project: project.id
        },
        data: {
          transaction: transactionName
        }
      }).then(() => {
        const projectThresholdUrl = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
        this.props.api.requestPromise(projectThresholdUrl, {
          method: 'GET',
          includeAllArgs: true,
          query: {
            project: project.id
          }
        }).then(_ref2 => {
          let [data] = _ref2;
          this.setState({
            threshold: data.threshold,
            metric: data.metric
          });
          closeModal();

          if (onApply) {
            onApply(this.state.threshold, this.state.metric);
          }
        }).catch(err => {
          var _err$responseJSON$thr2, _err$responseJSON3;

          const errorMessage = (_err$responseJSON$thr2 = (_err$responseJSON3 = err.responseJSON) === null || _err$responseJSON3 === void 0 ? void 0 : _err$responseJSON3.threshold) !== null && _err$responseJSON$thr2 !== void 0 ? _err$responseJSON$thr2 : null;
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(errorMessage);
        });
      }).catch(err => {
        this.setState({
          error: err
        });
      });
    });
  }

  getProject() {
    const {
      projects,
      eventView,
      project
    } = this.props;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(project)) {
      return projects.find(proj => proj.id === project);
    }

    const projectId = String(eventView.project[0]);
    return projects.find(proj => proj.id === projectId);
  }

  renderModalFields() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
        "data-test-id": "response-metric",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Calculation Method'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This determines which duration metric is used for the Response Time Threshold.'),
        showHelpInTooltip: true,
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          required: true,
          options: METRIC_CHOICES.slice(),
          name: "responseMetric",
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Calculation Method'),
          value: this.state.metric,
          onChange: option => {
            this.handleFieldChange('metric')(option.value);
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
        "data-test-id": "response-time-threshold",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Response Time Threshold (ms)'),
        inline: false,
        help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('The satisfactory response time for the calculation method defined above. This is used to calculate Apdex and User Misery scores.'),
        showHelpInTooltip: true,
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_11__["default"], {
          type: "number",
          name: "threshold",
          required: true,
          pattern: "[0-9]*(\\.[0-9]*)?",
          onChange: event => {
            this.handleFieldChange('threshold')(event.target.value);
          },
          value: this.state.threshold,
          step: 100,
          min: 100
        })
      })]
    });
  }

  render() {
    const {
      Header,
      Body,
      Footer,
      organization,
      transactionName,
      eventView
    } = this.props;
    const project = this.getProject();
    const summaryView = eventView.clone();
    summaryView.query = summaryView.getQueryWithAdditionalConditions();
    const target = (0,_utils__WEBPACK_IMPORTED_MODULE_18__.transactionSummaryRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transactionName,
      query: summaryView.generateQueryStringObject(),
      projectID: project === null || project === void 0 ? void 0 : project.id
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Header, {
        closeButton: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("h4", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Transaction Settings')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Instruction, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('The changes below will only be applied to [transaction]. To set it at a more global level, go to [projectSettings: Project Settings].', {
            transaction: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"], {
              to: target,
              children: transactionName
            }),
            projectSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"], {
              to: `/settings/${organization.slug}/projects/${project === null || project === void 0 ? void 0 : project.slug}/performance/`
            })
          })
        }), this.renderModalFields()]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            priority: "default",
            onClick: this.handleReset,
            "data-test-id": "reset-all",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Reset All')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Apply'),
            priority: "primary",
            onClick: this.handleApply,
            "data-test-id": "apply-threshold",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Apply')
          })]
        })
      })]
    });
  }

}

TransactionThresholdModal.displayName = "TransactionThresholdModal";

const Instruction = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ezg6l150"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(4), ";" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "9w3zq5",
  styles: "width:100%;max-width:650px;margin:70px auto"
} : 0;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__["default"])(TransactionThresholdModal)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_searchBar_tsx-app_components_links_listLink_tsx-app_utils_performance_c-e3f00d.c38cd70e7f7879675f2f983d60902e97.js.map