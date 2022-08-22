"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_profiling_profileSummary_index_tsx"],{

/***/ "./app/components/performanceDuration.tsx":
/*!************************************************!*\
  !*** ./app/components/performanceDuration.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function isMilliseconds(props) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(props.milliseconds);
}

function isNanoseconds(props) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(props.nanoseconds);
}

function PerformanceDuration(props) {
  const normalizedSeconds = isNanoseconds(props) ? props.nanoseconds / 1_000_000_000 : isMilliseconds(props) ? props.milliseconds / 1000 : props.seconds;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_0__["default"], {
    abbreviation: props.abbreviation,
    seconds: normalizedSeconds,
    fixedDigits: 2
  });
}

PerformanceDuration.displayName = "PerformanceDuration";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PerformanceDuration);

/***/ }),

/***/ "./app/components/profiling/arrayLinks.tsx":
/*!*************************************************!*\
  !*** ./app/components/profiling/arrayLinks.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ArrayLinks": () => (/* binding */ ArrayLinks)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function ArrayLinks(_ref) {
  let {
    items
  } = _ref;
  const [expanded, setExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ArrayContainer, {
    expanded: expanded,
    children: [items.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(LinkedItem, {
      item: items[0]
    }), items.length > 1 && expanded && items.slice(1, items.length).map(item => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(LinkedItem, {
      item: item
    }, item.value)), items.length > 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ButtonContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("button", {
        onClick: () => setExpanded(!expanded),
        children: expanded ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('[collapse]') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('[+%s more]', items.length - 1)
      })
    }) : null]
  });
}

ArrayLinks.displayName = "ArrayLinks";

function LinkedItem(_ref2) {
  let {
    item
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ArrayItem, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_3__.Link, {
      to: item.target,
      children: item.value
    })
  });
}

LinkedItem.displayName = "LinkedItem";

const ArrayContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11x8nqr2"
} : 0)("display:flex;flex-direction:", p => p.expanded ? 'column' : 'row', ";" + ( true ? "" : 0));

const ArrayItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e11x8nqr1"
} : 0)("flex-shrink:1;display:block;", p => p.theme.overflowEllipsis, ";width:unset;" + ( true ? "" : 0));

const ButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11x8nqr0"
} : 0)("white-space:nowrap;& button{background:none;border:0;outline:none;padding:0;cursor:pointer;color:", p => p.theme.blue300, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";}" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/profiling/breadcrumb.tsx":
/*!*************************************************!*\
  !*** ./app/components/profiling/breadcrumb.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Breadcrumb": () => (/* binding */ Breadcrumb)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function Breadcrumb(_ref) {
  let {
    location,
    organization,
    trails
  } = _ref;
  const crumbs = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => trails.map(trail => trailToCrumb(trail, {
    location,
    organization
  })), [location, organization, trails]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledBreadcrumbs, {
    crumbs: crumbs
  });
}

Breadcrumb.displayName = "Breadcrumb";

function trailToCrumb(trail, _ref2) {
  let {
    location,
    organization
  } = _ref2;

  switch (trail.type) {
    case 'landing':
      {
        return {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfilingRouteWithQuery)({
            location,
            orgSlug: organization.slug
          }),
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Profiling'),
          preservePageFilters: true
        };
      }

    case 'profile summary':
      {
        return {
          to: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileSummaryRouteWithQuery)({
            location,
            orgSlug: organization.slug,
            projectSlug: trail.payload.projectSlug,
            transaction: trail.payload.transaction
          }),
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Profile Summary'),
          preservePageFilters: true
        };
      }

    case 'flamechart':
      {
        const generateRouteWithQuery = trail.payload.tab === 'flamechart' ? sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileFlamechartRouteWithQuery : sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileDetailsRouteWithQuery;
        return {
          to: generateRouteWithQuery({
            location,
            orgSlug: organization.slug,
            projectSlug: trail.payload.projectSlug,
            profileId: trail.payload.profileId
          }),
          label: trail.payload.transaction,
          preservePageFilters: true
        };
      }

    default:
      throw new Error(`Unknown breadcrumb type: ${JSON.stringify(trail)}`);
  }
}

const StyledBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "edt2s550"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);



/***/ }),

/***/ "./app/components/profiling/functionsTable.tsx":
/*!*****************************************************!*\
  !*** ./app/components/profiling/functionsTable.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FunctionsTable": () => (/* binding */ FunctionsTable)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace-all.js */ "../node_modules/core-js/modules/es.string.replace-all.js");
/* harmony import */ var core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_all_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_components_profiling_arrayLinks__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/profiling/arrayLinks */ "./app/components/profiling/arrayLinks.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/profiling/tableRenderer */ "./app/utils/profiling/tableRenderer.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function FunctionsTable(props) {
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_14__.useLocation)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const sort = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => {
    let column = props.sort;
    let direction = 'asc';

    if (props.sort.startsWith('-')) {
      column = props.sort.substring(1);
      direction = 'desc';
    }

    if (!SORTABLE_COLUMNS.has(column)) {
      column = 'p99';
    }

    return {
      column: column,
      direction
    };
  }, [props.sort]);
  const functions = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => {
    return props.functions.map(func => {
      const {
        worst,
        examples,
        ...rest
      } = func;
      const allExamples = examples.filter(example => example !== worst);
      allExamples.unshift(worst);
      return { ...rest,
        examples: allExamples.map(example => {
          const profileId = example.replaceAll('-', '');
          return {
            value: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_11__.getShortEventId)(profileId),
            target: (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_12__.generateProfileFlamechartRouteWithQuery)({
              orgSlug: organization.slug,
              projectSlug: props.project.slug,
              profileId,
              query: {
                // specify the frame to focus, the flamegraph will switch
                // to the appropriate thread when these are specified
                frameName: func.name,
                framePackage: func.package
              }
            })
          };
        })
      };
    });
  }, [organization.slug, props.project.slug, props.functions]);
  const generateSortLink = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(column => {
    if (!SORTABLE_COLUMNS.has(column)) {
      return () => undefined;
    }

    const direction = sort.column !== column ? 'desc' : sort.direction === 'desc' ? 'asc' : 'desc';
    return () => ({ ...location,
      query: { ...location.query,
        functionsSort: `${direction === 'desc' ? '-' : ''}${column}`
      }
    });
  }, [location, sort]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__["default"], {
    isLoading: props.isLoading,
    error: props.error,
    data: functions,
    columnOrder: COLUMN_ORDER.map(key => COLUMNS[key]),
    columnSortBy: [],
    grid: {
      renderHeadCell: (0,sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_13__.renderTableHead)({
        currentSort: sort,
        rightAlignedColumns: RIGHT_ALIGNED_COLUMNS,
        sortableColumns: SORTABLE_COLUMNS,
        generateSortLink
      }),
      renderBodyCell: renderFunctionsTableCell
    },
    location: location
  });
}

FunctionsTable.displayName = "FunctionsTable";
const RIGHT_ALIGNED_COLUMNS = new Set(['p75', 'p99', 'count']);
const SORTABLE_COLUMNS = RIGHT_ALIGNED_COLUMNS;

function renderFunctionsTableCell(column, dataRow, rowIndex, columnIndex) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ProfilingFunctionsTableCell, {
    column: column,
    dataRow: dataRow,
    rowIndex: rowIndex,
    columnIndex: columnIndex
  });
}

renderFunctionsTableCell.displayName = "renderFunctionsTableCell";

const EmptyValueContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ef2cp6g0"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

function ProfilingFunctionsTableCell(_ref) {
  let {
    column,
    dataRow
  } = _ref;
  const value = dataRow[column.key];

  switch (column.key) {
    case 'count':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.NumberContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_5__["default"], {
          value: value
        })
      });

    case 'p75':
    case 'p99':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.NumberContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_7__["default"], {
          nanoseconds: value,
          abbreviation: true
        })
      });

    case 'examples':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_profiling_arrayLinks__WEBPACK_IMPORTED_MODULE_8__.ArrayLinks, {
        items: value
      });

    case 'name':
    case 'package':
      const name = value || (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(EmptyValueContainer, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unknown')
      });

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: name
      });

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: value
      });
  }
}

const COLUMN_ORDER = ['name', 'package', 'count', 'p75', 'p99', 'examples'];
const COLUMNS = {
  name: {
    key: 'name',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Name'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  package: {
    key: 'package',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Package'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  path: {
    key: 'path',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Path'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  p75: {
    key: 'p75',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('P75 Duration'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  p99: {
    key: 'p99',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('P99 Duration'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  count: {
    key: 'count',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Count'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  },
  examples: {
    key: 'examples',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Example Profiles'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_6__.COL_WIDTH_UNDEFINED
  }
};


/***/ }),

/***/ "./app/components/profiling/profilesTable.tsx":
/*!****************************************************!*\
  !*** ./app/components/profiling/profilesTable.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfilesTable": () => (/* binding */ ProfilesTable)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/profiling/tableRenderer */ "./app/utils/profiling/tableRenderer.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















const REQUIRE_PROJECT_COLUMNS = new Set(['id', 'project_id', 'transaction_name']);

function ProfilesTable(props) {
  var _props$columnOrder;

  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_14__.useLocation)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__["default"], {
      isLoading: props.isLoading,
      error: props.error,
      data: props.traces,
      columnOrder: ((_props$columnOrder = props.columnOrder) !== null && _props$columnOrder !== void 0 ? _props$columnOrder : DEFAULT_COLUMN_ORDER).map(key => COLUMNS[key]),
      columnSortBy: [],
      grid: {
        renderHeadCell: (0,sentry_utils_profiling_tableRenderer__WEBPACK_IMPORTED_MODULE_13__.renderTableHead)({
          rightAlignedColumns: RIGHT_ALIGNED_COLUMNS
        }),
        renderBodyCell: renderProfilesTableCell
      },
      location: location
    })
  });
}

ProfilesTable.displayName = "ProfilesTable";
const RIGHT_ALIGNED_COLUMNS = new Set(['trace_duration_ms']);

function renderProfilesTableCell(column, dataRow, rowIndex, columnIndex) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ProfilesTableCell, {
    column: column,
    dataRow: dataRow,
    rowIndex: rowIndex,
    columnIndex: columnIndex
  });
}

renderProfilesTableCell.displayName = "renderProfilesTableCell";

function ProfilesTableCell(_ref) {
  let {
    column,
    dataRow
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_16__["default"])();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_14__.useLocation)(); // Not all columns need the project, so small optimization to avoid
  // the linear lookup for every cell.

  const project = REQUIRE_PROJECT_COLUMNS.has(column.key) ? projects.find(proj => proj.id === dataRow.project_id) : undefined;

  if (REQUIRE_PROJECT_COLUMNS.has(column.key) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(project)) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_18__.withScope(scope => {
      scope.setFingerprint(['profiles table', 'cell', 'missing project']);
      scope.setTag('cell_key', column.key);
      scope.setTag('missing_project', dataRow.project_id);
      scope.setTag('available_project', projects.length);
      _sentry_react__WEBPACK_IMPORTED_MODULE_18__.captureMessage(`Project ${dataRow.project_id} missing for ${column.key}`);
    });
  }

  const value = dataRow[column.key];

  switch (column.key) {
    case 'id':
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(project)) {
        // should never happen but just in case
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
          children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_11__.getShortEventId)(dataRow.id)
        });
      }

      const flamegraphTarget = (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_12__.generateProfileFlamechartRoute)({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        profileId: dataRow.id
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
          to: flamegraphTarget,
          children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_11__.getShortEventId)(dataRow.id)
        })
      });

    case 'project_id':
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(project)) {
        // should never happen but just in case
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('n/a')
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
          project: project,
          avatarSize: 16
        })
      });

    case 'transaction_name':
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(project)) {
        // should never happen but just in case
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('n/a')
        });
      }

      const profileSummaryTarget = (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_12__.generateProfileSummaryRouteWithQuery)({
        location,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        transaction: dataRow.transaction_name
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
          to: profileSummaryTarget,
          children: value
        })
      });

    case 'version_name':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: dataRow.version_code ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('%s (build %s)', value, dataRow.version_code) : value
      });

    case 'failed':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: value ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClose, {
          size: "sm",
          color: "red300",
          isCircled: true
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconCheckmark, {
          size: "sm",
          color: "green300",
          isCircled: true
        })
      });

    case 'timestamp':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
          date: value * 1000,
          year: true,
          seconds: true,
          timeZone: true
        })
      });

    case 'trace_duration_ms':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.NumberContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_6__["default"], {
          milliseconds: value,
          abbreviation: true
        })
      });

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_10__.Container, {
        children: value
      });
  }
}

const DEFAULT_COLUMN_ORDER = ['failed', 'id', 'project_id', 'transaction_name', 'version_name', 'timestamp', 'trace_duration_ms', 'device_model', 'device_classification'];
const COLUMNS = {
  id: {
    key: 'id',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Profile ID'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  project_id: {
    key: 'project_id',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Project'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  failed: {
    key: 'failed',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Status'),
    width: 14 // make this as small as possible

  },
  version_name: {
    key: 'version_name',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Version'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  transaction_name: {
    key: 'transaction_name',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Transaction Name'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  timestamp: {
    key: 'timestamp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Timestamp'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  trace_duration_ms: {
    key: 'trace_duration_ms',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Duration'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  device_model: {
    key: 'device_model',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Device Model'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  device_classification: {
    key: 'device_classification',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Device Classification'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  },
  device_os_version: {
    key: 'device_os_version',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Device OS Version'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_3__.COL_WIDTH_UNDEFINED
  }
};


/***/ }),

/***/ "./app/utils/profiling/hooks/useFunctions.tsx":
/*!****************************************************!*\
  !*** ./app/utils/profiling/hooks/useFunctions.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useFunctions": () => (/* binding */ useFunctions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");









function useFunctions(_ref) {
  let {
    functionType,
    project,
    query,
    transaction,
    sort,
    cursor,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const [requestState, setRequestState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (selection === undefined) {
      return undefined;
    }

    setRequestState({
      type: 'loading'
    });
    fetchFunctions(api, organization, {
      functionType,
      projectSlug: project.slug,
      query,
      selection,
      sort,
      transaction,
      cursor
    }).then(_ref2 => {
      var _functions$functions, _response$getResponse;

      let [functions,, response] = _ref2;
      setRequestState({
        type: 'resolved',
        data: {
          functions: (_functions$functions = functions.functions) !== null && _functions$functions !== void 0 ? _functions$functions : [],
          pageLinks: (_response$getResponse = response === null || response === void 0 ? void 0 : response.getResponseHeader('Link')) !== null && _response$getResponse !== void 0 ? _response$getResponse : null
        }
      });
    }).catch(err => {
      setRequestState({
        type: 'errored',
        error: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Error: Unable to load functions')
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_7__.captureException(err);
    });
    return () => api.clear();
  }, [api, cursor, functionType, organization, project.slug, query, selection, sort, transaction]);
  return requestState;
}

function fetchFunctions(api, organization, _ref3) {
  let {
    cursor,
    functionType,
    projectSlug,
    query,
    selection,
    sort,
    transaction
  } = _ref3;
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch(query);
  conditions.setFilterValues('transaction_name', [transaction]);
  return api.requestPromise(`/projects/${organization.slug}/${projectSlug}/profiling/functions/`, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime),
      query: conditions.formatString(),
      sort,
      is_application: functionType === 'application' ? '1' : functionType === 'system' ? '0' : undefined
    }
  });
}



/***/ }),

/***/ "./app/utils/profiling/hooks/useProfileFilters.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/profiling/hooks/useProfileFilters.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useProfileFilters": () => (/* binding */ useProfileFilters)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");






function useProfileFilters(_ref) {
  let {
    query,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_4__["default"])();
  const [profileFilters, setProfileFilters] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({});
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!selection) {
      return undefined;
    }

    fetchProfileFilters(api, organization, query, selection).then(response => {
      const withPredefinedFilters = response.reduce((filters, tag) => {
        filters[tag.key] = { ...tag,
          // predefined allows us to specify a list of possible values
          predefined: true
        };
        return filters;
      }, {});
      setProfileFilters(withPredefinedFilters);
    });
    return () => api.clear();
  }, [api, organization, query, selection]);
  return profileFilters;
}

function fetchProfileFilters(api, organization, query, selection) {
  return api.requestPromise(`/organizations/${organization.slug}/profiling/filters/`, {
    method: 'GET',
    query: {
      query,
      project: selection.projects,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime)
    }
  });
}



/***/ }),

/***/ "./app/utils/profiling/hooks/useProfiles.tsx":
/*!***************************************************!*\
  !*** ./app/utils/profiling/hooks/useProfiles.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useProfiles": () => (/* binding */ useProfiles)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");









function useProfiles(_ref) {
  let {
    cursor,
    limit,
    query,
    selection
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const [requestState, setRequestState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(selection)) {
      return undefined;
    }

    setRequestState({
      type: 'loading'
    });
    fetchTraces(api, organization, {
      cursor,
      limit,
      query,
      selection
    }).then(_ref2 => {
      var _response$getResponse;

      let [traces,, response] = _ref2;
      setRequestState({
        type: 'resolved',
        data: {
          traces,
          pageLinks: (_response$getResponse = response === null || response === void 0 ? void 0 : response.getResponseHeader('Link')) !== null && _response$getResponse !== void 0 ? _response$getResponse : null
        }
      });
    }).catch(err => {
      setRequestState({
        type: 'errored',
        error: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Error: Unable to load profiles')
      });
      _sentry_react__WEBPACK_IMPORTED_MODULE_7__.captureException(err);
    });
    return () => api.clear();
  }, [api, organization, cursor, limit, query, selection]);
  return requestState;
}

function fetchTraces(api, organization, _ref3) {
  let {
    cursor,
    limit,
    query,
    selection
  } = _ref3;
  return api.requestPromise(`/organizations/${organization.slug}/profiling/profiles/`, {
    method: 'GET',
    includeAllArgs: true,
    query: {
      cursor,
      query,
      per_page: limit,
      project: selection.projects,
      environment: selection.environments,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(selection.datetime)
    }
  });
}



/***/ }),

/***/ "./app/utils/profiling/routes.tsx":
/*!****************************************!*\
  !*** ./app/utils/profiling/routes.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateProfileDetailsRoute": () => (/* binding */ generateProfileDetailsRoute),
/* harmony export */   "generateProfileDetailsRouteWithQuery": () => (/* binding */ generateProfileDetailsRouteWithQuery),
/* harmony export */   "generateProfileFlamechartRoute": () => (/* binding */ generateProfileFlamechartRoute),
/* harmony export */   "generateProfileFlamechartRouteWithQuery": () => (/* binding */ generateProfileFlamechartRouteWithQuery),
/* harmony export */   "generateProfileSummaryRoute": () => (/* binding */ generateProfileSummaryRoute),
/* harmony export */   "generateProfileSummaryRouteWithQuery": () => (/* binding */ generateProfileSummaryRouteWithQuery),
/* harmony export */   "generateProfilingRoute": () => (/* binding */ generateProfilingRoute),
/* harmony export */   "generateProfilingRouteWithQuery": () => (/* binding */ generateProfilingRouteWithQuery)
/* harmony export */ });
function generateProfilingRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/profiling/`;
}
function generateProfileSummaryRoute(_ref2) {
  let {
    orgSlug,
    projectSlug
  } = _ref2;
  return `/organizations/${orgSlug}/profiling/summary/${projectSlug}/`;
}
function generateProfileFlamechartRoute(_ref3) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref3;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamechart/`;
}
function generateProfileDetailsRoute(_ref4) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref4;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/details/`;
}
function generateProfilingRouteWithQuery(_ref5) {
  let {
    location,
    orgSlug,
    query
  } = _ref5;
  const pathname = generateProfilingRoute({
    orgSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileSummaryRouteWithQuery(_ref6) {
  let {
    location,
    orgSlug,
    projectSlug,
    transaction,
    query
  } = _ref6;
  const pathname = generateProfileSummaryRoute({
    orgSlug,
    projectSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query,
      transaction
    }
  };
}
function generateProfileFlamechartRouteWithQuery(_ref7) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref7;
  const pathname = generateProfileFlamechartRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileDetailsRouteWithQuery(_ref8) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref8;
  const pathname = generateProfileDetailsRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}

/***/ }),

/***/ "./app/utils/useLocation.tsx":
/*!***********************************!*\
  !*** ./app/utils/useLocation.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocation": () => (/* binding */ useLocation)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useLocation() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.location;
}

/***/ }),

/***/ "./app/views/profiling/profileSummary/content.tsx":
/*!********************************************************!*\
  !*** ./app/views/profiling/profileSummary/content.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfileSummaryContent": () => (/* binding */ ProfileSummaryContent)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_profiling_functionsTable__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/profiling/functionsTable */ "./app/components/profiling/functionsTable.tsx");
/* harmony import */ var sentry_components_profiling_profilesTable__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/profiling/profilesTable */ "./app/components/profiling/profilesTable.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useFunctions__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useFunctions */ "./app/utils/profiling/hooks/useFunctions.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useProfiles__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useProfiles */ "./app/utils/profiling/hooks/useProfiles.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const FUNCTIONS_CURSOR_NAME = 'functionsCursor';
const PROFILES_COLUMN_ORDER = ['failed', 'id', 'timestamp', 'version_name', 'device_model', 'device_classification', 'trace_duration_ms'];

function ProfileSummaryContent(props) {
  const profilesCursor = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__.decodeScalar)(props.location.query.cursor), [props.location.query.cursor]);
  const functionsCursor = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__.decodeScalar)(props.location.query.functionsCursor), [props.location.query.functionsCursor]);
  const functionsSort = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_14__.decodeScalar)(props.location.query.functionsSort, '-p99'), [props.location.query.functionsSort]);
  const profiles = (0,sentry_utils_profiling_hooks_useProfiles__WEBPACK_IMPORTED_MODULE_13__.useProfiles)({
    cursor: profilesCursor,
    limit: 5,
    query: props.query,
    selection: props.selection
  });
  const [functionType, setFunctionType] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('application');
  const functions = (0,sentry_utils_profiling_hooks_useFunctions__WEBPACK_IMPORTED_MODULE_12__.useFunctions)({
    cursor: functionsCursor,
    project: props.project,
    query: props.query,
    selection: props.selection,
    transaction: props.transaction,
    sort: functionsSort,
    functionType
  });
  const handleFunctionsCursor = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)((cursor, pathname, query) => {
    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
      pathname,
      query: { ...query,
        [FUNCTIONS_CURSOR_NAME]: cursor
      }
    });
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Main, {
    fullWidth: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TableHeader, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_4__.SectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Recent Profiles')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledPagination, {
        pageLinks: profiles.type === 'resolved' ? profiles.data.pageLinks : null,
        size: "xs"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_profiling_profilesTable__WEBPACK_IMPORTED_MODULE_9__.ProfilesTable, {
      error: profiles.type === 'errored' ? profiles.error : null,
      isLoading: profiles.type === 'initial' || profiles.type === 'loading',
      traces: profiles.type === 'resolved' ? profiles.data.traces : [],
      columnOrder: PROFILES_COLUMN_ORDER
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TableHeader, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_5__["default"], {
        triggerProps: {
          prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Suspect Functions'),
          size: 'xs'
        },
        value: functionType,
        options: [{
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All'),
          value: 'all'
        }, {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Application'),
          value: 'application'
        }, {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('System'),
          value: 'system'
        }],
        onChange: _ref => {
          let {
            value
          } = _ref;
          return setFunctionType(value);
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledPagination, {
        pageLinks: functions.type === 'resolved' ? functions.data.pageLinks : null,
        onCursor: handleFunctionsCursor,
        size: "xs"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_profiling_functionsTable__WEBPACK_IMPORTED_MODULE_8__.FunctionsTable, {
      error: functions.type === 'errored' ? functions.error : null,
      isLoading: functions.type === 'initial' || functions.type === 'loading',
      functions: functions.type === 'resolved' ? functions.data.functions : [],
      project: props.project,
      sort: functionsSort
    })]
  });
}

ProfileSummaryContent.displayName = "ProfileSummaryContent";

const TableHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewy0nsd1"
} : 0)("display:flex;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ewy0nsd0"
} : 0)("margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/views/profiling/profileSummary/index.tsx":
/*!******************************************************!*\
  !*** ./app/views/profiling/profileSummary/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_profiling_breadcrumb__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/profiling/breadcrumb */ "./app/components/profiling/breadcrumb.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useProfileFilters__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useProfileFilters */ "./app/utils/profiling/hooks/useProfileFilters.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./content */ "./app/views/profiling/profileSummary/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























function ProfileSummaryPage(props) {
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_22__["default"])({
    slugs: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(props.params.projectId) ? [props.params.projectId] : []
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_17__["default"])('profiling_views.profile_summary', {
      organization
    });
  }, [organization]); // Extract the project matching the provided project slug,
  // if it doesn't exist, set this to null and handle it accordingly.

  const project = projects.length === 1 ? projects[0] : null;
  const transaction = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__.decodeScalar)(props.location.query.transaction);
  const rawQuery = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__.decodeScalar)(props.location.query.query, ''), [props.location.query.query]);
  const query = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const search = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_20__.MutableSearch(rawQuery);

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(transaction)) {
      search.setFilterValues('transaction_name', [transaction]);
    }

    return search.formatString();
  }, [rawQuery, transaction]);
  const filtersQuery = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    // To avoid querying for the filters each time the query changes,
    // do not pass the user query to get the filters.
    const search = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_20__.MutableSearch('');

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(transaction)) {
      search.setFilterValues('transaction_name', [transaction]);
    }

    return search.formatString();
  }, [transaction]);
  const profileFilters = (0,sentry_utils_profiling_hooks_useProfileFilters__WEBPACK_IMPORTED_MODULE_18__.useProfileFilters)({
    query: filtersQuery,
    selection: props.selection
  });
  const handleSearch = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(searchQuery => {
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({ ...props.location,
      query: { ...props.location.query,
        query: searchQuery || undefined
      }
    });
  }, [props.location]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_11__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Profiling \u2014 Profile Summary'),
    orgSlug: organization.slug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_9__["default"], {
      shouldForceProject: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(project),
      forceProject: project,
      specificProjectSlugs: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(project) ? [project.slug] : [],
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_7__["default"], {
        organization: organization,
        children: project && transaction && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Header, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.HeaderContent, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_breadcrumb__WEBPACK_IMPORTED_MODULE_10__.Breadcrumb, {
                location: props.location,
                organization: organization,
                trails: [{
                  type: 'landing'
                }, {
                  type: 'profile summary',
                  payload: {
                    projectSlug: project.slug,
                    transaction
                  }
                }]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Title, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(Title, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    project: project,
                    avatarSize: 28,
                    hideName: true,
                    avatarProps: {
                      hasTooltip: true,
                      tooltip: project.slug
                    }
                  }), transaction]
                })
              })]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Body, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Main, {
              fullWidth: true,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(ActionBar, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  condensed: true,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_4__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_3__["default"], {
                    alignDropdown: "left"
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  organization: organization,
                  hasRecentSearches: true,
                  searchSource: "profile_summary",
                  supportedTags: profileFilters,
                  query: rawQuery,
                  onSearch: handleSearch,
                  maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_13__.MAX_QUERY_LENGTH
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_content__WEBPACK_IMPORTED_MODULE_24__.ProfileSummaryContent, {
                location: props.location,
                project: project,
                selection: props.selection,
                transaction: transaction,
                query: query
              })]
            })
          })]
        })
      })
    })
  });
}

ProfileSummaryPage.displayName = "ProfileSummaryPage";

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecjk55m1"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const ActionBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecjk55m0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";grid-template-columns:min-content auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_23__["default"])(ProfileSummaryPage));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_profiling_profileSummary_index_tsx.49912a5962be24424cbabdce8c5ac902.js.map