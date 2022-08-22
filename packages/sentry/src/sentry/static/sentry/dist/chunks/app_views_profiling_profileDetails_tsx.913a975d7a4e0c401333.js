"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_profiling_profileDetails_tsx"],{

/***/ "./app/utils/profiling/units/units.ts":
/*!********************************************!*\
  !*** ./app/utils/profiling/units/units.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeFormatter": () => (/* binding */ makeFormatter),
/* harmony export */   "makeTimelineFormatter": () => (/* binding */ makeTimelineFormatter),
/* harmony export */   "relativeChange": () => (/* binding */ relativeChange)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);

function relativeChange(final, initial) {
  return (final - initial) / initial;
}
const durationMappings = {
  nanoseconds: 1e-9,
  microseconds: 1e-6,
  milliseconds: 1e-3,
  seconds: 1
};

const format = (v, abbrev, precision) => {
  return v.toFixed(precision) + abbrev;
};

function makeFormatter(from) {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format from unit ${from}, duration mapping is not defined`);
  }

  return value => {
    const duration = value * multiplier;

    if (duration >= 1) {
      return format(duration, 's', 2);
    }

    if (duration / 1e-3 >= 1) {
      return format(duration / 1e-3, 'ms', 2);
    }

    if (duration / 1e-6 >= 1) {
      return format(duration / 1e-6, 'μs', 2);
    }

    return format(duration / 1e-9, 'ns', 2);
  };
}

function pad(n, slots) {
  return Math.floor(n).toString().padStart(slots, '0');
}

function makeTimelineFormatter(from) {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format from unit ${from}, duration mapping is not defined`);
  }

  return value => {
    const s = value * multiplier;
    const m = s / 60;
    const ms = s * 1e3;
    return `${pad(m, 2)}:${pad(s % 60, 2)}.${pad(ms % 1e3, 3)}`;
  };
}

/***/ }),

/***/ "./app/utils/useEffectAfterFirstRender.ts":
/*!************************************************!*\
  !*** ./app/utils/useEffectAfterFirstRender.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useEffectAfterFirstRender": () => (/* binding */ useEffectAfterFirstRender)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


const useEffectAfterFirstRender = (cb, deps) => {
  const firstRender = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(true);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    cb(); // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};



/***/ }),

/***/ "./app/views/profiling/profileDetails.tsx":
/*!************************************************!*\
  !*** ./app/views/profiling/profileDetails.tsx ***!
  \************************************************/
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
/* harmony import */ var fuse_js__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! fuse.js */ "../node_modules/fuse.js/dist/fuse.esm.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/profiling/tableRenderer */ "./app/utils/profiling/tableRenderer.tsx");
/* harmony import */ var sentry_utils_profiling_units_units__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/profiling/units/units */ "./app/utils/profiling/units/units.ts");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/useEffectAfterFirstRender */ "./app/utils/useEffectAfterFirstRender.ts");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var _profileGroupProvider__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./profileGroupProvider */ "./app/views/profiling/profileGroupProvider.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























function collectTopProfileFrames(profile) {
  const nodes = [];
  profile.forEach(node => {
    if (node.selfWeight > 0) {
      nodes.push(node);
    }
  }, () => {});
  return nodes.sort((a, b) => b.selfWeight - a.selfWeight) // take only the slowest nodes from each thread because the rest
  // aren't useful to display
  .slice(0, 500).map(node => ({
    symbol: node.frame.name,
    image: node.frame.image,
    thread: profile.threadId,
    type: node.frame.is_application ? 'application' : 'system',
    'self weight': node.selfWeight,
    'total weight': node.totalWeight
  }));
}

const RESULTS_PER_PAGE = 50;

function ProfileDetails() {
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_20__.useLocation)();
  const [state] = (0,_profileGroupProvider__WEBPACK_IMPORTED_MODULE_23__.useProfileGroup)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_13__["default"])('profiling_views.profile_summary', {
      organization
    });
  }, [organization]);
  const cursor = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    const cursorQuery = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.cursor, '');
    return parseInt(cursorQuery, 10) || 0;
  }, [location.query.cursor]);
  const query = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_18__.decodeScalar)(location.query.query, ''), [location]);
  const allFunctions = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    return state.type === 'resolved' ? state.data.profiles.flatMap(collectTopProfileFrames) // Self weight desc sort
    .sort((a, b) => b['self weight'] - a['self weight']) : [];
  }, [state]);
  const searchIndex = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    return new fuse_js__WEBPACK_IMPORTED_MODULE_24__["default"](allFunctions, {
      keys: ['symbol'],
      threshold: 0.3
    });
  }, [allFunctions]);
  const search = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(queryString => {
    if (!queryString) {
      return allFunctions;
    }

    return searchIndex.search(queryString).map(result => result.item).sort((a, b) => b['self weight'] - a['self weight']);
  }, [searchIndex, allFunctions]);
  const [slowestFunctions, setSlowestFunctions] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(() => {
    return search(query);
  });
  (0,sentry_utils_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_19__.useEffectAfterFirstRender)(() => {
    setSlowestFunctions(search(query));
  }, [allFunctions, query, search]);
  const pageLinks = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    const prevResults = cursor >= RESULTS_PER_PAGE ? 'true' : 'false';
    const prevCursor = cursor >= RESULTS_PER_PAGE ? cursor - RESULTS_PER_PAGE : 0;
    const prevQuery = { ...location.query,
      cursor: prevCursor
    };
    const prevHref = `${location.pathname}${query_string__WEBPACK_IMPORTED_MODULE_5__.stringify(prevQuery)}`;
    const prev = `<${prevHref}>; rel="previous"; results="${prevResults}"; cursor="${prevCursor}"`;
    const nextResults = cursor + RESULTS_PER_PAGE < slowestFunctions.length ? 'true' : 'false';
    const nextCursor = cursor + RESULTS_PER_PAGE < slowestFunctions.length ? cursor + RESULTS_PER_PAGE : 0;
    const nextQuery = { ...location.query,
      cursor: nextCursor
    };
    const nextHref = `${location.pathname}${query_string__WEBPACK_IMPORTED_MODULE_5__.stringify(nextQuery)}`;
    const next = `<${nextHref}>; rel="next"; results="${nextResults}"; cursor="${nextCursor}"`;
    return `${prev},${next}`;
  }, [cursor, location, slowestFunctions]);
  const handleSearch = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(searchString => {
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({ ...location,
      query: { ...location.query,
        query: searchString,
        cursor: undefined
      }
    });
    setSlowestFunctions(search(searchString));
  }, [location, search]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Profiling \u2014 Details'),
      orgSlug: organization.slug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Main, {
          fullWidth: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ActionBar, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_9__["default"], {
              defaultQuery: "",
              query: query,
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Search for frames'),
              onChange: handleSearch
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Slowest Functions'),
            isLoading: state.type === 'loading',
            error: state.type === 'errored',
            data: slowestFunctions.slice(cursor, cursor + RESULTS_PER_PAGE),
            columnOrder: COLUMN_ORDER.map(key => COLUMNS[key]),
            columnSortBy: [],
            grid: {
              renderHeadCell: (0,sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_16__.renderTableHead)({
                rightAlignedColumns: RIGHT_ALIGNED_COLUMNS
              }),
              renderBodyCell: renderFunctionCell
            },
            location: location
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"], {
            pageLinks: pageLinks
          })]
        })
      })
    })
  });
}

ProfileDetails.displayName = "ProfileDetails";
const RIGHT_ALIGNED_COLUMNS = new Set(['self weight', 'total weight']);

const ActionBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecwa59y0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";grid-template-columns:auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";" + ( true ? "" : 0));

function renderFunctionCell(column, dataRow, rowIndex, columnIndex) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ProfilingFunctionsTableCell, {
    column: column,
    dataRow: dataRow,
    rowIndex: rowIndex,
    columnIndex: columnIndex
  });
}

renderFunctionCell.displayName = "renderFunctionCell";
const formatter = (0,sentry_utils_profiling_units_units__WEBPACK_IMPORTED_MODULE_17__.makeFormatter)('nanoseconds');

function ProfilingFunctionsTableCell(_ref) {
  let {
    column,
    dataRow
  } = _ref;
  const value = dataRow[column.key];
  const {
    orgId,
    projectId,
    eventId
  } = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_22__.useParams)();

  switch (column.key) {
    case 'self weight':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__.NumberContainer, {
        children: formatter(value)
      });

    case 'total weight':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__.NumberContainer, {
        children: formatter(value)
      });

    case 'image':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
        children: value !== null && value !== void 0 ? value : 'Unknown'
      });

    case 'thread':
      {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, {
            to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_15__.generateProfileFlamechartRouteWithQuery)({
              orgSlug: orgId,
              projectSlug: projectId,
              profileId: eventId,
              query: {
                tid: dataRow.thread
              }
            }),
            children: value
          })
        });
      }

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
        children: value
      });
  }
}

const COLUMN_ORDER = ['symbol', 'image', 'thread', 'type', 'self weight', 'total weight']; // TODO: looks like these column names change depending on the platform?

const COLUMNS = {
  symbol: {
    key: 'symbol',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Symbol'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  image: {
    key: 'image',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Binary'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  thread: {
    key: 'thread',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Thread'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  type: {
    key: 'type',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Type'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  'self weight': {
    key: 'self weight',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Self Weight'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  'total weight': {
    key: 'total weight',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Total Weight'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfileDetails);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_profiling_profileDetails_tsx.d1e9e0d9014214819428e46bc4c748fd.js.map