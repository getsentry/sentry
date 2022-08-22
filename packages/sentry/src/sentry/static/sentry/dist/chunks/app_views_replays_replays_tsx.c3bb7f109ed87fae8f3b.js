(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_replays_replays_tsx"],{

/***/ "./app/components/events/searchBar.tsx":
/*!*********************************************!*\
  !*** ./app/components/events/searchBar.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/components/replays/replaysFeatureBadge.tsx":
/*!********************************************************!*\
  !*** ./app/components/replays/replaysFeatureBadge.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function ReplaysFeatureBadge(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    type: "alpha"
  });
}

ReplaysFeatureBadge.displayName = "ReplaysFeatureBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplaysFeatureBadge);

/***/ }),

/***/ "./app/utils/measurements/measurements.tsx":
/*!*************************************************!*\
  !*** ./app/utils/measurements/measurements.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/utils/performance/vitals/constants.tsx":
/*!****************************************************!*\
  !*** ./app/utils/performance/vitals/constants.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Browser": () => (/* binding */ Browser),
/* harmony export */   "MOBILE_VITAL_DETAILS": () => (/* binding */ MOBILE_VITAL_DETAILS),
/* harmony export */   "WEB_VITAL_DETAILS": () => (/* binding */ WEB_VITAL_DETAILS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");



const WEB_VITAL_DETAILS = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FP]: {
    slug: 'fp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Paint'),
    acronym: 'FP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the first pixel loaded in the viewport (may overlap with FCP).'),
    poorThreshold: 3000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FCP]: {
    slug: 'fcp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Contentful Paint'),
    acronym: 'FCP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the first image, text or other DOM node in the viewport.'),
    poorThreshold: 3000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FCP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.LCP]: {
    slug: 'lcp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Largest Contentful Paint'),
    acronym: 'LCP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the largest image, text or other DOM node in the viewport.'),
    poorThreshold: 4000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.LCP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FID]: {
    slug: 'fid',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Input Delay'),
    acronym: 'FID',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Response time of the browser to a user interaction (clicking, tapping, etc).'),
    poorThreshold: 300,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FID)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.CLS]: {
    slug: 'cls',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative Layout Shift'),
    acronym: 'CLS',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Sum of layout shift scores that measure the visual stability of the page.'),
    poorThreshold: 0.25,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.CLS)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.TTFB]: {
    slug: 'ttfb',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Time to First Byte'),
    acronym: 'TTFB',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("The time that it takes for a user's browser to receive the first byte of page content."),
    poorThreshold: 600,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.TTFB)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.RequestTime]: {
    slug: 'ttfb.requesttime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Request Time'),
    acronym: 'RT',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Captures the time spent making the request and receiving the first byte of the response.'),
    poorThreshold: 600,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.RequestTime)
  }
};
const MOBILE_VITAL_DETAILS = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartCold]: {
    slug: 'app_start_cold',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('App Start Cold'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cold start is a measure of the application start up time from scratch.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartCold)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartWarm]: {
    slug: 'app_start_warm',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('App Start Warm'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Warm start is a measure of the application start up time while still in memory.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartWarm)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesTotal]: {
    slug: 'frames_total',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total frames is a count of the number of frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesTotal)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlow]: {
    slug: 'frames_slow',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow frames is a count of the number of slow frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlow)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozen]: {
    slug: 'frames_frozen',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen frames is a count of the number of frozen frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozen)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlowRate]: {
    slug: 'frames_slow_rate',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames Rate'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames Rate is the percentage of frames recorded within a transaction that is considered slow.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlowRate)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozenRate]: {
    slug: 'frames_frozen_rate',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate is the percentage of frames recorded within a transaction that is considered frozen.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozenRate)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallCount]: {
    slug: 'stall_count',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stalls'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stalls is the number of times the application stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallCount)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallTotalTime]: {
    slug: 'stall_total_time',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Stall Time'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Total Time is the total amount of time the application is stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallTotalTime)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallLongestTime]: {
    slug: 'stall_longest_time',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Longest Stall Time'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Longest Time is the longest amount of time the application is stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallLongestTime)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallPercentage]: {
    slug: 'stall_percentage',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Percentage'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Percentage is the percentage of the transaction duration the application was stalled.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallPercentage)
  }
};
let Browser;

(function (Browser) {
  Browser["CHROME"] = "Chrome";
  Browser["EDGE"] = "Edge";
  Browser["OPERA"] = "Opera";
  Browser["FIREFOX"] = "Firefox";
  Browser["SAFARI"] = "Safari";
  Browser["IE"] = "IE";
})(Browser || (Browser = {}));

/***/ }),

/***/ "./app/utils/withTags.tsx":
/*!********************************!*\
  !*** ./app/utils/withTags.tsx ***!
  \********************************/
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

/***/ "./app/views/replays/filters.tsx":
/*!***************************************!*\
  !*** ./app/views/replays/filters.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/projectPageFilter */ "./app/components/projectPageFilter.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function ReplaysFilters(_ref) {
  let {
    organization,
    handleSearchQuery,
    query
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(FilterContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      condensed: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_projectPageFilter__WEBPACK_IMPORTED_MODULE_5__["default"], {
        resetParamsOnChange: ['cursor']
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_2__["default"], {
        resetParamsOnChange: ['cursor']
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_1__["default"], {
        alignDropdown: "left",
        resetParamsOnChange: ['cursor']
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
      organization: organization,
      defaultQuery: "",
      query: query,
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Search'),
      onSearch: handleSearchQuery
    })]
  });
}

ReplaysFilters.displayName = "ReplaysFilters";

const FilterContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b9rkza0"
} : 0)("display:inline-grid;grid-template-columns:minmax(0, max-content) minmax(20rem, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";width:100%;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:minmax(0, 1fr);}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplaysFilters);

/***/ }),

/***/ "./app/views/replays/replays.tsx":
/*!***************************************!*\
  !*** ./app/views/replays/replays.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/errors/detailedError */ "./app/components/errors/detailedError.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/replays/replaysFeatureBadge */ "./app/components/replays/replaysFeatureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/replays/hooks/useReplayList */ "./app/utils/replays/hooks/useReplayList.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useMedia */ "./app/utils/useMedia.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_views_replays_filters__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/replays/filters */ "./app/views/replays/filters.tsx");
/* harmony import */ var sentry_views_replays_replayTable__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/replays/replayTable */ "./app/views/replays/replayTable.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























function Replays(_ref) {
  let {
    location
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_19__.a)();
  const minWidthIsSmall = (0,sentry_utils_useMedia__WEBPACK_IMPORTED_MODULE_15__["default"])(`(min-width: ${theme.breakpoints.small})`);
  const eventView = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.query, '');
    const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__.MutableSearch(query);
    return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_11__["default"].fromNewQueryWithLocation({
      id: '',
      name: '',
      version: 2,
      fields: sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_13__.REPLAY_LIST_FIELDS,
      projects: [],
      query: conditions.formatString(),
      orderby: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.sort, sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_13__.DEFAULT_SORT)
    }, location);
  }, [location]);
  const {
    pathname,
    query
  } = location;
  const {
    replays,
    pageLinks,
    isFetching,
    fetchError
  } = (0,sentry_utils_replays_hooks_useReplayList__WEBPACK_IMPORTED_MODULE_13__["default"])({
    organization,
    eventView
  });

  if (fetchError && !isFetching) {
    const reasons = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('The search parameters you selected are invalid in some way'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('There is an internal systems error or active issue')];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_errors_detailedError__WEBPACK_IMPORTED_MODULE_3__["default"], {
      hideSupportLinks: true,
      heading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sorry, the list of replays could not be found.'),
      message: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('This could be due to a handful of reasons:')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("ol", {
          className: "detailed-error-list",
          children: reasons.map((reason, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("li", {
            children: reason
          }, i))
        })]
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPageHeader, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(HeaderTitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Replays'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_7__["default"], {})]
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_4__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(StyledPageContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_replays_filters__WEBPACK_IMPORTED_MODULE_17__["default"], {
          query: query.query || '',
          organization: organization,
          handleSearchQuery: searchQuery => {
            react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
              pathname,
              query: { ...query,
                cursor: undefined,
                query: searchQuery.trim()
              }
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_replays_replayTable__WEBPACK_IMPORTED_MODULE_18__["default"], {
          isFetching: isFetching,
          replays: replays,
          showProjectColumn: minWidthIsSmall,
          sort: eventView.sorts[0]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"], {
          pageLinks: pageLinks,
          onCursor: (cursor, path, searchQuery) => {
            react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
              pathname: path,
              query: { ...searchQuery,
                cursor
              }
            });
          }
        })]
      })
    })]
  });
}

Replays.displayName = "Replays";

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_9__.PageHeader,  true ? {
  target: "e23fllz2"
} : 0)("background-color:", p => p.theme.surface100, ";min-width:max-content;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(4), ";" + ( true ? "" : 0));

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_9__.PageContent,  true ? {
  target: "e23fllz1"
} : 0)("box-shadow:0px 0px 1px ", p => p.theme.gray200, ";background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

const HeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e23fllz0"
} : 0)( true ? {
  name: "1npqnnc",
  styles: "display:flex;align-items:center;justify-content:space-between;flex:1"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Replays);

/***/ }),

/***/ "../node_modules/lodash/assign.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/assign.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var assignValue = __webpack_require__(/*! ./_assignValue */ "../node_modules/lodash/_assignValue.js"),
    copyObject = __webpack_require__(/*! ./_copyObject */ "../node_modules/lodash/_copyObject.js"),
    createAssigner = __webpack_require__(/*! ./_createAssigner */ "../node_modules/lodash/_createAssigner.js"),
    isArrayLike = __webpack_require__(/*! ./isArrayLike */ "../node_modules/lodash/isArrayLike.js"),
    isPrototype = __webpack_require__(/*! ./_isPrototype */ "../node_modules/lodash/_isPrototype.js"),
    keys = __webpack_require__(/*! ./keys */ "../node_modules/lodash/keys.js");

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Assigns own enumerable string keyed properties of source objects to the
 * destination object. Source objects are applied from left to right.
 * Subsequent sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object` and is loosely based on
 * [`Object.assign`](https://mdn.io/Object/assign).
 *
 * @static
 * @memberOf _
 * @since 0.10.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.assignIn
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * function Bar() {
 *   this.c = 3;
 * }
 *
 * Foo.prototype.b = 2;
 * Bar.prototype.d = 4;
 *
 * _.assign({ 'a': 0 }, new Foo, new Bar);
 * // => { 'a': 1, 'c': 3 }
 */
var assign = createAssigner(function(object, source) {
  if (isPrototype(source) || isArrayLike(source)) {
    copyObject(source, keys(source), object);
    return;
  }
  for (var key in source) {
    if (hasOwnProperty.call(source, key)) {
      assignValue(object, key, source[key]);
    }
  }
});

module.exports = assign;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_replays_replays_tsx.80ad333a1e35e55e8926516f347549b6.js.map