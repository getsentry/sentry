"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_widgetViewerModal_tsx-app_utils_discover_charts_tsx"],{

/***/ "./app/components/gridEditable/sortLink.tsx":
/*!**************************************************!*\
  !*** ./app/components/gridEditable/sortLink.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SortLink(_ref) {
  let {
    align,
    title,
    canSort,
    generateSortLink,
    onClick,
    direction
  } = _ref;
  const target = generateSortLink();

  if (!target || !canSort) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledNonLink, {
      align: align,
      children: title
    });
  }

  const arrow = !direction ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconArrow, {
    size: "xs",
    direction: direction === 'desc' ? 'down' : 'up'
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(StyledLink, {
    align: align,
    to: target,
    onClick: onClick,
    children: [title, " ", arrow]
  });
}

SortLink.displayName = "SortLink";

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const forwardProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['align']);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...forwardProps
  });
},  true ? {
  target: "e1xb2te62"
} : 0)("display:block;width:100%;white-space:nowrap;color:inherit;&:hover,&:active,&:focus,&:visited{color:inherit;}", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledNonLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xb2te61"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconArrow,  true ? {
  target: "e1xb2te60"
} : 0)( true ? {
  name: "40f4ru",
  styles: "vertical-align:top"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SortLink);

/***/ }),

/***/ "./app/components/modals/widgetViewerModal.tsx":
/*!*****************************************************!*\
  !*** ./app/components/modals/widgetViewerModal.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_45__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _sentry_utils__WEBPACK_IMPORTED_MODULE_44__ = __webpack_require__(/*! @sentry/utils */ "../node_modules/@sentry/utils/esm/string.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_selectOption__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/forms/selectOption */ "./app/components/forms/selectOption.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/searchSyntax/renderer */ "./app/components/searchSyntax/renderer.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_chart__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/chart */ "./app/views/dashboardsV2/widgetCard/chart.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/dashboardsMEPContext */ "./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_issueWidgetQueries__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/issueWidgetQueries */ "./app/views/dashboardsV2/widgetCard/issueWidgetQueries.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/releaseWidgetQueries */ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_widgetCardChartContainer__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer */ "./app/views/dashboardsV2/widgetCard/widgetCardChartContainer.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard/widgetQueries */ "./app/views/dashboardsV2/widgetCard/widgetQueries.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./widgetViewerModal/utils */ "./app/components/modals/widgetViewerModal/utils.tsx");
/* harmony import */ var _widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./widgetViewerModal/widgetViewerTableCell */ "./app/components/modals/widgetViewerModal/widgetViewerTableCell.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports












































const FULL_TABLE_ITEM_LIMIT = 20;
const HALF_TABLE_ITEM_LIMIT = 10;
const GEO_COUNTRY_CODE = 'geo.country_code';
const HALF_CONTAINER_HEIGHT = 300;
const EMPTY_QUERY_NAME = '(Empty Query Condition)';

const shouldWidgetCardChartMemo = (prevProps, props) => {
  const selectionMatches = props.selection === prevProps.selection;
  const sortMatches = props.location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.SORT] === prevProps.location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.SORT];
  const chartZoomOptionsMatches = lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()(props.chartZoomOptions, prevProps.chartZoomOptions);
  const isNotTopNWidget = props.widget.displayType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TOP_N && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_23__.defined)(props.widget.limit);
  return selectionMatches && chartZoomOptionsMatches && (sortMatches || isNotTopNWidget);
}; // WidgetCardChartContainer and WidgetCardChart rerenders if selection was changed.
// This is required because we want to prevent ECharts interactions from causing
// unnecessary rerenders which can break legends and zoom functionality.


const MemoizedWidgetCardChartContainer = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.memo)(sentry_views_dashboardsV2_widgetCard_widgetCardChartContainer__WEBPACK_IMPORTED_MODULE_37__.WidgetCardChartContainer, shouldWidgetCardChartMemo);
const MemoizedWidgetCardChart = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.memo)(sentry_views_dashboardsV2_widgetCard_chart__WEBPACK_IMPORTED_MODULE_33__["default"], shouldWidgetCardChartMemo);

async function fetchDiscoverTotal(api, organization, location, eventView) {
  if (!eventView.isValid()) {
    return undefined;
  }

  try {
    const total = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_10__.fetchTotalCount)(api, organization.slug, eventView.getEventsAPIPayload(location));
    return total.toLocaleString();
  } catch (err) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_42__.captureException(err);
    return undefined;
  }
}

function WidgetViewerModal(props) {
  var _decodeInteger, _decodeInteger2;

  const {
    organization,
    widget,
    selection,
    location,
    Footer,
    Body,
    Header,
    closeModal,
    onEdit,
    router,
    routes,
    params,
    seriesData,
    tableData,
    totalIssuesCount,
    pageLinks: defaultPageLinks,
    seriesResultsType
  } = props;
  const shouldShowSlider = organization.features.includes('widget-viewer-modal-minimap'); // Get widget zoom from location
  // We use the start and end query params for just the initial state

  const start = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeScalar)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.START]);
  const end = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeScalar)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.END]);
  const isTableWidget = widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE;
  const locationPageFilter = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => start && end ? { ...selection,
    datetime: {
      start,
      end,
      period: null,
      utc: null
    }
  } : selection, [start, end, selection]);
  const [chartUnmodified, setChartUnmodified] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(true);
  const [chartZoomOptions, setChartZoomOptions] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)({
    start: 0,
    end: 100
  }); // We wrap the modalChartSelection in a useRef because we do not want to recalculate this value
  // (which would cause an unnecessary rerender on calculation) except for the initial load.
  // We use this for when a user visit a widget viewer url directly.

  const [modalTableSelection, setModalTableSelection] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(locationPageFilter);
  const modalChartSelection = (0,react__WEBPACK_IMPORTED_MODULE_4__.useRef)(modalTableSelection); // Detect when a user clicks back and set the PageFilter state to match the location
  // We need to use useEffect to prevent infinite looping rerenders due to the setModalTableSelection call

  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    if (location.action === 'POP') {
      setModalTableSelection(locationPageFilter);

      if (start && end) {
        setChartZoomOptions({
          startValue: moment__WEBPACK_IMPORTED_MODULE_9___default().utc(start).unix() * 1000,
          endValue: moment__WEBPACK_IMPORTED_MODULE_9___default().utc(end).unix() * 1000
        });
      } else {
        setChartZoomOptions({
          start: 0,
          end: 100
        });
      }
    }
  }, [end, location, locationPageFilter, start]); // Get legends toggle settings from location
  // We use the legend query params for just the initial state

  const [disabledLegends, setDisabledLegends] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)((0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeList)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.LEGEND]).reduce((acc, legend) => {
    acc[legend] = false;
    return acc;
  }, {}));
  const [totalResults, setTotalResults] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(); // Get query selection settings from location

  const selectedQueryIndex = (_decodeInteger = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeInteger)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.QUERY])) !== null && _decodeInteger !== void 0 ? _decodeInteger : 0; // Get pagination settings from location

  const page = (_decodeInteger2 = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeInteger)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.PAGE])) !== null && _decodeInteger2 !== void 0 ? _decodeInteger2 : 0;
  const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeScalar)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.CURSOR]); // Get table column widths from location

  const widths = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeList)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.WIDTH]); // Get table sort settings from location

  const sort = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_28__.decodeScalar)(location.query[_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.SORT]);
  const sortedQueries = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(sort ? widget.queries.map(query => ({ ...query,
    orderby: sort
  })) : widget.queries); // Top N widget charts (including widgets with limits) results rely on the sorting of the query
  // Set the orderby of the widget chart to match the location query params

  const primaryWidget = widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TOP_N || widget.limit !== undefined ? { ...widget,
    queries: sortedQueries
  } : widget;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_29__["default"])(); // Create Table widget

  const tableWidget = { ...lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()({ ...widget,
      queries: [sortedQueries[selectedQueryIndex]]
    }),
    displayType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE
  };
  const {
    aggregates,
    columns
  } = tableWidget.queries[0];
  const {
    orderby
  } = widget.queries[0];
  const order = orderby.startsWith('-');
  const rawOrderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default()(orderby, '-');
  const fields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_23__.defined)(tableWidget.queries[0].fields) ? tableWidget.queries[0].fields : [...columns, ...aggregates]; // Some Discover Widgets (Line, Area, Bar) allow the user to specify an orderby
  // that is not explicitly selected as an aggregate or column. We need to explicitly
  // include the orderby in the table widget aggregates and columns otherwise
  // eventsv2 will complain about sorting on an unselected field.

  if (widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER && orderby && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isEquationAlias)(rawOrderby) && !fields.includes(rawOrderby)) {
    fields.push(rawOrderby);
    [tableWidget, primaryWidget].forEach(aggregatesAndColumns => {
      if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isAggregateField)(rawOrderby) || (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isEquation)(rawOrderby)) {
        aggregatesAndColumns.queries.forEach(query => {
          if (!query.aggregates.includes(rawOrderby)) {
            query.aggregates.push(rawOrderby);
          }
        });
      } else {
        aggregatesAndColumns.queries.forEach(query => {
          if (!query.columns.includes(rawOrderby)) {
            query.columns.push(rawOrderby);
          }
        });
      }
    });
  } // Need to set the orderby of the eventsv2 query to equation[index] format
  // since eventsv2 does not accept the raw equation as a valid sort payload


  if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isEquation)(rawOrderby) && tableWidget.queries[0].orderby === orderby) {
    tableWidget.queries[0].orderby = `${order ? '-' : ''}equation[${(0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.getNumEquations)(fields) - 1}]`;
  } // World Map view should always have geo.country in the table chart


  if (widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.WORLD_MAP && !columns.includes(GEO_COUNTRY_CODE)) {
    fields.unshift(GEO_COUNTRY_CODE);
    columns.unshift(GEO_COUNTRY_CODE);
  } // Default table columns for visualizations that don't have a column setting


  const shouldReplaceTableColumns = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.AREA, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.LINE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.BIG_NUMBER, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.BAR].includes(widget.displayType) && widget.widgetType && [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.RELEASE].includes(widget.widgetType) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_23__.defined)(widget.limit); // Updates fields by adding any individual terms from equation fields as a column

  if (!isTableWidget) {
    const equationFields = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.getFieldsFromEquations)(fields);
    equationFields.forEach(term => {
      if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isAggregateField)(term) && !aggregates.includes(term)) {
        aggregates.unshift(term);
      }

      if (!(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_26__.isAggregateField)(term) && !columns.includes(term)) {
        columns.unshift(term);
      }
    });
  } // Add any group by columns into table fields if missing


  columns.forEach(column => {
    if (!fields.includes(column)) {
      fields.unshift(column);
    }
  });

  if (shouldReplaceTableColumns) {
    switch (widget.widgetType) {
      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER:
        if (fields.length === 1) {
          tableWidget.queries[0].orderby = tableWidget.queries[0].orderby || `-${fields[0]}`;
        }

        fields.unshift('title');
        columns.unshift('title');
        break;

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.RELEASE:
        fields.unshift('release');
        columns.unshift('release');
        break;

      default:
        break;
    }
  }

  const eventView = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.eventViewFromWidget)(tableWidget.title, tableWidget.queries[0], modalTableSelection, tableWidget.displayType);
  let columnOrder = (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_39__.decodeColumnOrder)(fields.map(field => ({
    field
  })), organization.features.includes('discover-frontend-use-events-endpoint'));
  const columnSortBy = eventView.getSorts();
  columnOrder = columnOrder.map((column, index) => ({ ...column,
    width: parseInt(widths[index], 10) || -1
  }));
  const queryOptions = sortedQueries.map((_ref, index) => {
    let {
      name,
      conditions
    } = _ref;
    // Creates the highlighted query elements to be used in the Query Select
    const parsedQuery = !!!name && !!conditions ? (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_19__.parseSearch)(conditions) : null;

    const getHighlightedQuery = highlightedContainerProps => {
      return parsedQuery !== null ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(HighlightContainer, { ...highlightedContainerProps,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_searchSyntax_renderer__WEBPACK_IMPORTED_MODULE_20__["default"], {
          parsedQuery: parsedQuery
        })
      }) : undefined;
    };

    return {
      label: (0,_sentry_utils__WEBPACK_IMPORTED_MODULE_44__.truncate)(name || conditions, 120),
      value: index,
      getHighlightedQuery
    };
  });

  const onResizeColumn = (columnIndex, nextColumn) => {
    const newWidth = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__.COL_WIDTH_UNDEFINED;
    const newWidths = new Array(Math.max(columnIndex, widths.length)).fill(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__.COL_WIDTH_UNDEFINED);
    widths.forEach((width, index) => newWidths[index] = parseInt(width, 10));
    newWidths[columnIndex] = newWidth;
    router.replace({
      pathname: location.pathname,
      query: { ...location.query,
        [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.WIDTH]: newWidths
      }
    });
  }; // Get discover result totals


  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    const getDiscoverTotals = async () => {
      if (widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER) {
        setTotalResults(await fetchDiscoverTotal(api, organization, location, eventView));
      }
    };

    getDiscoverTotals(); // Disabling this for now since this effect should only run on initial load and query index changes
    // Including all exhaustive deps would cause fetchDiscoverTotal on nearly every update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueryIndex]);

  function onLegendSelectChanged(_ref2) {
    var _widget$widgetType;

    let {
      selected
    } = _ref2;
    setDisabledLegends(selected);
    router.replace({
      pathname: location.pathname,
      query: { ...location.query,
        [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.LEGEND]: Object.keys(selected).filter(key => !selected[key])
      }
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.toggle_legend', {
      organization,
      widget_type: (_widget$widgetType = widget.widgetType) !== null && _widget$widgetType !== void 0 ? _widget$widgetType : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
      display_type: widget.displayType
    });
  }

  function DiscoverTable(_ref3) {
    var _links$previous, _tableResults$0$data, _tableResults$, _links$previous2, _links$next;

    let {
      tableResults,
      loading,
      pageLinks
    } = _ref3;
    const {
      isMetricsData
    } = (0,sentry_views_dashboardsV2_widgetCard_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_34__.useDashboardsMEPContext)();
    const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_27__["default"])(pageLinks !== null && pageLinks !== void 0 ? pageLinks : null);
    const isFirstPage = ((_links$previous = links.previous) === null || _links$previous === void 0 ? void 0 : _links$previous.results) === false;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__["default"], {
        isLoading: loading,
        data: (_tableResults$0$data = tableResults === null || tableResults === void 0 ? void 0 : (_tableResults$ = tableResults[0]) === null || _tableResults$ === void 0 ? void 0 : _tableResults$.data) !== null && _tableResults$0$data !== void 0 ? _tableResults$0$data : [],
        columnOrder: columnOrder,
        columnSortBy: columnSortBy,
        grid: {
          renderHeadCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderDiscoverGridHeaderCell)({ ...props,
            widget: tableWidget,
            tableData: tableResults === null || tableResults === void 0 ? void 0 : tableResults[0],
            onHeaderClick: () => {
              if ([sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TOP_N, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE].includes(widget.displayType) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_23__.defined)(widget.limit)) {
                setChartUnmodified(false);
              }
            },
            isMetricsData
          }),
          renderBodyCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderGridBodyCell)({ ...props,
            tableData: tableResults === null || tableResults === void 0 ? void 0 : tableResults[0],
            isFirstPage
          }),
          onResizeColumn
        },
        location: location
      }), ((links === null || links === void 0 ? void 0 : (_links$previous2 = links.previous) === null || _links$previous2 === void 0 ? void 0 : _links$previous2.results) || (links === null || links === void 0 ? void 0 : (_links$next = links.next) === null || _links$next === void 0 ? void 0 : _links$next.results)) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_17__["default"], {
        pageLinks: pageLinks,
        onCursor: newCursor => {
          router.replace({
            pathname: location.pathname,
            query: { ...location.query,
              [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.CURSOR]: newCursor
            }
          });

          if (widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE) {
            setChartUnmodified(false);
          }

          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.paginate', {
            organization,
            widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
            display_type: widget.displayType
          });
        }
      })]
    });
  }

  const renderIssuesTable = _ref4 => {
    var _tableResults$0$data2, _tableResults$2, _links$previous3, _links$next2;

    let {
      tableResults,
      loading,
      pageLinks,
      totalCount
    } = _ref4;

    if (totalResults === undefined && totalCount) {
      setTotalResults(totalCount);
    }

    const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_27__["default"])(pageLinks !== null && pageLinks !== void 0 ? pageLinks : null);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__["default"], {
        isLoading: loading,
        data: (_tableResults$0$data2 = tableResults === null || tableResults === void 0 ? void 0 : (_tableResults$2 = tableResults[0]) === null || _tableResults$2 === void 0 ? void 0 : _tableResults$2.data) !== null && _tableResults$0$data2 !== void 0 ? _tableResults$0$data2 : [],
        columnOrder: columnOrder,
        columnSortBy: columnSortBy,
        grid: {
          renderHeadCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderIssueGridHeaderCell)({
            location,
            organization,
            selection,
            widget: tableWidget,
            onHeaderClick: () => {
              setChartUnmodified(false);
            }
          }),
          renderBodyCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderGridBodyCell)({
            location,
            organization,
            selection,
            widget: tableWidget
          }),
          onResizeColumn
        },
        location: location
      }), ((links === null || links === void 0 ? void 0 : (_links$previous3 = links.previous) === null || _links$previous3 === void 0 ? void 0 : _links$previous3.results) || (links === null || links === void 0 ? void 0 : (_links$next2 = links.next) === null || _links$next2 === void 0 ? void 0 : _links$next2.results)) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_17__["default"], {
        pageLinks: pageLinks,
        onCursor: (nextCursor, _path, _query, delta) => {
          let nextPage = isNaN(page) ? delta : page + delta;
          let newCursor = nextCursor; // unset cursor and page when we navigate back to the first page
          // also reset cursor if somehow the previous button is enabled on
          // first page and user attempts to go backwards

          if (nextPage <= 0) {
            newCursor = undefined;
            nextPage = 0;
          }

          router.replace({
            pathname: location.pathname,
            query: { ...location.query,
              [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.CURSOR]: newCursor,
              [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.PAGE]: nextPage
            }
          });

          if (widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE) {
            setChartUnmodified(false);
          }

          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.paginate', {
            organization,
            widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.ISSUE,
            display_type: widget.displayType
          });
        }
      })]
    });
  };

  const renderReleaseTable = _ref5 => {
    var _links$previous4, _tableResults$0$data3, _tableResults$3, _links$previous5, _links$next3;

    let {
      tableResults,
      loading,
      pageLinks
    } = _ref5;
    const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_27__["default"])(pageLinks !== null && pageLinks !== void 0 ? pageLinks : null);
    const isFirstPage = ((_links$previous4 = links.previous) === null || _links$previous4 === void 0 ? void 0 : _links$previous4.results) === false;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_16__["default"], {
        isLoading: loading,
        data: (_tableResults$0$data3 = tableResults === null || tableResults === void 0 ? void 0 : (_tableResults$3 = tableResults[0]) === null || _tableResults$3 === void 0 ? void 0 : _tableResults$3.data) !== null && _tableResults$0$data3 !== void 0 ? _tableResults$0$data3 : [],
        columnOrder: columnOrder,
        columnSortBy: columnSortBy,
        grid: {
          renderHeadCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderReleaseGridHeaderCell)({ ...props,
            widget: tableWidget,
            tableData: tableResults === null || tableResults === void 0 ? void 0 : tableResults[0],
            onHeaderClick: () => {
              if ([sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TOP_N, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE].includes(widget.displayType) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_23__.defined)(widget.limit)) {
                setChartUnmodified(false);
              }
            }
          }),
          renderBodyCell: (0,_widgetViewerModal_widgetViewerTableCell__WEBPACK_IMPORTED_MODULE_41__.renderGridBodyCell)({ ...props,
            tableData: tableResults === null || tableResults === void 0 ? void 0 : tableResults[0],
            isFirstPage
          }),
          onResizeColumn
        },
        location: location
      }), !tableWidget.queries[0].orderby.match(/^-?release$/) && ((links === null || links === void 0 ? void 0 : (_links$previous5 = links.previous) === null || _links$previous5 === void 0 ? void 0 : _links$previous5.results) || (links === null || links === void 0 ? void 0 : (_links$next3 = links.next) === null || _links$next3 === void 0 ? void 0 : _links$next3.results)) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_17__["default"], {
        pageLinks: pageLinks,
        onCursor: newCursor => {
          router.replace({
            pathname: location.pathname,
            query: { ...location.query,
              [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.CURSOR]: newCursor
            }
          });
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.paginate', {
            organization,
            widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.RELEASE,
            display_type: widget.displayType
          });
        }
      })]
    });
  };

  const onZoom = (evt, chart) => {
    var _model$_payload$batch, _model$_payload$batch2, _widget$widgetType2;

    // @ts-ignore getModel() is private but we need this to retrieve datetime values of zoomed in region
    const model = chart.getModel();
    const {
      seriesStart,
      seriesEnd
    } = evt;
    let startValue, endValue;
    startValue = (_model$_payload$batch = model._payload.batch) === null || _model$_payload$batch === void 0 ? void 0 : _model$_payload$batch[0].startValue;
    endValue = (_model$_payload$batch2 = model._payload.batch) === null || _model$_payload$batch2 === void 0 ? void 0 : _model$_payload$batch2[0].endValue;
    const seriesStartTime = seriesStart ? new Date(seriesStart).getTime() : undefined;
    const seriesEndTime = seriesEnd ? new Date(seriesEnd).getTime() : undefined; // Slider zoom events don't contain the raw date time value, only the percentage
    // We use the percentage with the start and end of the series to calculate the adjusted zoom

    if (startValue === undefined || endValue === undefined) {
      if (seriesStartTime && seriesEndTime) {
        const diff = seriesEndTime - seriesStartTime;
        startValue = diff * model._payload.start * 0.01 + seriesStartTime;
        endValue = diff * model._payload.end * 0.01 + seriesStartTime;
      } else {
        return;
      }
    }

    setChartZoomOptions({
      startValue,
      endValue
    });
    const newStart = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_9___default().utc(startValue));
    const newEnd = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_9___default().utc(endValue));
    setModalTableSelection({ ...modalTableSelection,
      datetime: { ...modalTableSelection.datetime,
        start: newStart,
        end: newEnd,
        period: null
      }
    });
    router.push({
      pathname: location.pathname,
      query: { ...location.query,
        [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.START]: newStart,
        [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.END]: newEnd
      }
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.zoom', {
      organization,
      widget_type: (_widget$widgetType2 = widget.widgetType) !== null && _widget$widgetType2 !== void 0 ? _widget$widgetType2 : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
      display_type: widget.displayType
    });
  };

  function renderWidgetViewerTable() {
    switch (widget.widgetType) {
      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.ISSUE:
        if (tableData && chartUnmodified && widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE) {
          return renderIssuesTable({
            tableResults: tableData,
            loading: false,
            errorMessage: undefined,
            pageLinks: defaultPageLinks,
            totalCount: totalIssuesCount
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_dashboardsV2_widgetCard_issueWidgetQueries__WEBPACK_IMPORTED_MODULE_35__["default"], {
          api: api,
          organization: organization,
          widget: tableWidget,
          selection: modalTableSelection,
          limit: widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE ? FULL_TABLE_ITEM_LIMIT : HALF_TABLE_ITEM_LIMIT,
          cursor: cursor,
          children: renderIssuesTable
        });

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.RELEASE:
        if (tableData && chartUnmodified && widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE) {
          return renderReleaseTable({
            tableResults: tableData,
            loading: false,
            pageLinks: defaultPageLinks
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_dashboardsV2_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_36__["default"], {
          api: api,
          organization: organization,
          widget: tableWidget,
          selection: modalTableSelection,
          limit: widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE ? FULL_TABLE_ITEM_LIMIT : HALF_TABLE_ITEM_LIMIT,
          cursor: cursor,
          children: renderReleaseTable
        });

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER:
      default:
        if (tableData && chartUnmodified && widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(DiscoverTable, {
            tableResults: tableData,
            loading: false,
            pageLinks: defaultPageLinks
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_dashboardsV2_widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_38__["default"], {
          api: api,
          organization: organization,
          widget: tableWidget,
          selection: modalTableSelection,
          limit: widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE ? FULL_TABLE_ITEM_LIMIT : HALF_TABLE_ITEM_LIMIT,
          cursor: cursor,
          children: _ref6 => {
            let {
              tableResults,
              loading,
              pageLinks
            } = _ref6;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(DiscoverTable, {
              tableResults: tableResults,
              loading: loading,
              pageLinks: pageLinks
            });
          }
        });
    }
  }

  function renderWidgetViewer() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [widget.displayType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TABLE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Container, {
        height: widget.displayType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.BIG_NUMBER ? HALF_CONTAINER_HEIGHT + (shouldShowSlider && [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.AREA, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.LINE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.BAR, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.DisplayType.TOP_N].includes(widget.displayType) ? sentry_views_dashboardsV2_widgetCard_chart__WEBPACK_IMPORTED_MODULE_33__.SLIDER_HEIGHT : 0) : null,
        children: (!!seriesData || !!tableData) && chartUnmodified ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(MemoizedWidgetCardChart, {
          timeseriesResults: seriesData,
          timeseriesResultsType: seriesResultsType,
          tableResults: tableData,
          errorMessage: undefined,
          loading: false,
          location: location,
          widget: widget,
          selection: selection,
          router: router,
          organization: organization,
          onZoom: onZoom,
          onLegendSelectChanged: onLegendSelectChanged,
          legendOptions: {
            selected: disabledLegends
          },
          expandNumbers: true,
          showSlider: shouldShowSlider,
          noPadding: true,
          chartZoomOptions: chartZoomOptions
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(MemoizedWidgetCardChartContainer, {
          location: location,
          router: router,
          routes: routes,
          params: params,
          api: api,
          organization: organization,
          selection: modalChartSelection.current // Top N charts rely on the orderby of the table
          ,
          widget: primaryWidget,
          onZoom: onZoom,
          onLegendSelectChanged: onLegendSelectChanged,
          legendOptions: {
            selected: disabledLegends
          },
          expandNumbers: true,
          showSlider: shouldShowSlider,
          noPadding: true,
          chartZoomOptions: chartZoomOptions
        })
      }), widget.queries.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_11__["default"], {
        type: "info",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.')
      }), (widget.queries.length > 1 || widget.queries[0].conditions) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(QueryContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_14__["default"], {
          value: selectedQueryIndex,
          options: queryOptions,
          onChange: option => {
            var _widget$widgetType3;

            router.replace({
              pathname: location.pathname,
              query: { ...location.query,
                [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.QUERY]: option.value,
                [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.PAGE]: undefined,
                [_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_40__.WidgetViewerQueryField.CURSOR]: undefined
              }
            });
            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.select_query', {
              organization,
              widget_type: (_widget$widgetType3 = widget.widgetType) !== null && _widget$widgetType3 !== void 0 ? _widget$widgetType3 : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
              display_type: widget.displayType
            });
          },
          components: {
            // Replaces the displayed selected value
            SingleValue: containerProps => {
              var _queryOptions$selecte;

              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_45__.y.SingleValue, { ...containerProps,
                // Overwrites some of the default styling that interferes with highlighted query text
                getStyles: () => ({
                  wordBreak: 'break-word',
                  flex: 1,
                  display: 'flex',
                  padding: `0 ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5)}`
                }),
                children: (_queryOptions$selecte = queryOptions[selectedQueryIndex].getHighlightedQuery({
                  display: 'block'
                })) !== null && _queryOptions$selecte !== void 0 ? _queryOptions$selecte : queryOptions[selectedQueryIndex].label || (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(EmptyQueryContainer, {
                  children: EMPTY_QUERY_NAME
                })
              });
            },
            // Replaces the dropdown options
            Option: containerProps => {
              const highlightedQuery = containerProps.data.getHighlightedQuery({
                display: 'flex'
              });
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_forms_selectOption__WEBPACK_IMPORTED_MODULE_15__["default"], { ...(highlightedQuery ? { ...containerProps,
                  label: highlightedQuery
                } : containerProps.label ? containerProps : { ...containerProps,
                  label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(EmptyQueryContainer, {
                    children: EMPTY_QUERY_NAME
                  })
                })
              });
            },
            // Hide the dropdown indicator if there is only one option
            ...(widget.queries.length < 2 ? {
              IndicatorsContainer: _ => null
            } : {})
          },
          isSearchable: false,
          isDisabled: widget.queries.length < 2
        }), widget.queries.length === 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledQuestionTooltip, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('To edit this query, you must edit the widget.'),
          size: "sm"
        })]
      }), renderWidgetViewerTable()]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_views_dashboardsV2_widgetCard_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_34__.DashboardsMEPProvider, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Header, {
        closeButton: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("h3", {
          children: widget.title
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Body, {
        children: renderWidgetViewer()
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ResultsContainer, {
          children: [renderTotalResults(totalResults, widget.widgetType), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_13__["default"], {
            gap: 1,
            children: [onEdit && widget.id && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_12__["default"], {
              type: "button",
              onClick: () => {
                var _widget$widgetType4;

                closeModal();
                onEdit();
                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.edit', {
                  organization,
                  widget_type: (_widget$widgetType4 = widget.widgetType) !== null && _widget$widgetType4 !== void 0 ? _widget$widgetType4 : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
                  display_type: widget.displayType
                });
              },
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Edit Widget')
            }), widget.widgetType && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(OpenButton, {
              widget: primaryWidget,
              organization: organization,
              selection: modalTableSelection,
              selectedQueryIndex: selectedQueryIndex
            })]
          })]
        })
      })]
    })
  });
}

WidgetViewerModal.displayName = "WidgetViewerModal";

function OpenButton(_ref7) {
  let {
    widget,
    selection,
    organization,
    selectedQueryIndex
  } = _ref7;
  let openLabel;
  let path;
  const {
    isMetricsData
  } = (0,sentry_views_dashboardsV2_widgetCard_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_34__.useDashboardsMEPContext)();

  switch (widget.widgetType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.ISSUE:
      openLabel = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Open in Issues');
      path = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.getWidgetIssueUrl)(widget, selection, organization);
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.RELEASE:
      openLabel = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Open in Releases');
      path = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.getWidgetReleasesUrl)(widget, selection, organization);
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER:
    default:
      openLabel = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Open in Discover');
      path = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.getWidgetDiscoverUrl)({ ...widget,
        queries: [widget.queries[selectedQueryIndex]]
      }, selection, organization, 0, isMetricsData);
      break;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_12__["default"], {
    to: path,
    priority: "primary",
    type: "button",
    disabled: (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.isCustomMeasurementWidget)(widget),
    title: (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_32__.isCustomMeasurementWidget)(widget) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Widgets using custom performance metrics cannot be opened in Discover.') : undefined,
    onClick: () => {
      var _widget$widgetType5;

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('dashboards_views.widget_viewer.open_source', {
        organization,
        widget_type: (_widget$widgetType5 = widget.widgetType) !== null && _widget$widgetType5 !== void 0 ? _widget$widgetType5 : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER,
        display_type: widget.displayType
      });
    },
    children: openLabel
  });
}

OpenButton.displayName = "OpenButton";

function renderTotalResults(totalResults, widgetType) {
  if (totalResults === undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("span", {});
  }

  switch (widgetType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.ISSUE:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("span", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.tct)('[description:Total Issues:] [total]', {
          description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("strong", {}),
          total: totalResults === '1000' ? '1000+' : totalResults
        })
      });

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_31__.WidgetType.DISCOVER:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("span", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.tct)('[description:Total Events:] [total]', {
          description: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("strong", {}),
          total: totalResults
        })
      });

    default:
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)("span", {});
  }
}

const modalCss =  true ? {
  name: "zhkibu",
  styles: "width:100%;max-width:1200px"
} : 0;

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eteb5ir5"
} : 0)("height:", p => p.height ? `${p.height}px` : 'auto', ";position:relative;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(3), ";" + ( true ? "" : 0));

const QueryContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eteb5ir4"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";position:relative;" + ( true ? "" : 0));

const StyledQuestionTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "eteb5ir3"
} : 0)("position:absolute;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1.5), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";" + ( true ? "" : 0));

const HighlightContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eteb5ir2"
} : 0)("display:", p => p.display, ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";font-family:", p => p.theme.text.familyMono, ";font-size:", p => p.theme.fontSizeSmall, ";line-height:2;flex:1;" + ( true ? "" : 0));

const ResultsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eteb5ir1"
} : 0)("display:flex;flex-grow:1;flex-direction:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1), ";@media (min-width: ", p => p.theme.breakpoints.small, "){align-items:center;flex-direction:row;justify-content:space-between;}" + ( true ? "" : 0));

const EmptyQueryContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eteb5ir0"
} : 0)("color:", p => p.theme.disabled, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__["default"])(WidgetViewerModal)));

/***/ }),

/***/ "./app/components/modals/widgetViewerModal/widgetViewerTableCell.tsx":
/*!***************************************************************************!*\
  !*** ./app/components/modals/widgetViewerModal/widgetViewerTableCell.tsx ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "renderDiscoverGridHeaderCell": () => (/* binding */ renderDiscoverGridHeaderCell),
/* harmony export */   "renderGridBodyCell": () => (/* binding */ renderGridBodyCell),
/* harmony export */   "renderIssueGridHeaderCell": () => (/* binding */ renderIssueGridHeaderCell),
/* harmony export */   "renderPrependColumns": () => (/* binding */ renderPrependColumns),
/* harmony export */   "renderReleaseGridHeaderCell": () => (/* binding */ renderReleaseGridHeaderCell)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dashboards_issueFieldRenderers__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/dashboards/issueFieldRenderers */ "./app/utils/dashboards/issueFieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/issueWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");
/* harmony import */ var sentry_views_eventsV2_table_topResultsIndicator__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/eventsV2/table/topResultsIndicator */ "./app/views/eventsV2/table/topResultsIndicator.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./utils */ "./app/components/modals/widgetViewerModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















 // Dashboards only supports top 5 for now



const DEFAULT_NUM_TOP_EVENTS = 5;
const renderIssueGridHeaderCell = _ref => {
  let {
    location,
    widget,
    tableData,
    organization,
    onHeaderClick
  } = _ref;
  return (column, _columnIndex) => {
    const tableMeta = tableData === null || tableData === void 0 ? void 0 : tableData.meta;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.fieldAlignment)(column.name, column.type, tableMeta);
    const sortField = (0,sentry_utils_dashboards_issueFieldRenderers__WEBPACK_IMPORTED_MODULE_10__.getSortField)(String(column.key));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      align: align,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledTooltip, {
        title: column.name,
        children: column.name
      }),
      direction: widget.queries[0].orderby === sortField ? 'desc' : undefined,
      canSort: !!sortField,
      generateSortLink: () => ({ ...location,
        query: { ...location.query,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.SORT]: sortField,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.PAGE]: undefined,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.CURSOR]: undefined
        }
      }),
      onClick: () => {
        onHeaderClick === null || onHeaderClick === void 0 ? void 0 : onHeaderClick();
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('dashboards_views.widget_viewer.sort', {
          organization,
          widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.ISSUE,
          display_type: widget.displayType,
          column: column.name,
          order: 'desc'
        });
      }
    });
  };
};
const renderDiscoverGridHeaderCell = _ref2 => {
  let {
    location,
    selection,
    widget,
    tableData,
    organization,
    onHeaderClick,
    isMetricsData
  } = _ref2;
  return (column, _columnIndex) => {
    const {
      orderby
    } = widget.queries[0]; // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format

    const aggregateAliasOrderBy = `${orderby.startsWith('-') ? '-' : ''}${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.getAggregateAlias)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_3___default()(orderby, '-'))}`;
    const eventView = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_16__.eventViewFromWidget)(widget.title, { ...widget.queries[0],
      orderby: aggregateAliasOrderBy
    }, selection, widget.displayType);
    const tableMeta = tableData === null || tableData === void 0 ? void 0 : tableData.meta;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.fieldAlignment)(column.name, column.type, tableMeta);
    const field = {
      field: String(column.key),
      width: column.width
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta, undefined, true);
      const queryStringObject = nextEventView.generateQueryStringObject();
      return { ...location,
        query: { ...location.query,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.SORT]: queryStringObject.sort,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.PAGE]: undefined,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.CURSOR]: undefined
        }
      };
    }

    const currentSort = eventView.sortForField(field, tableMeta);
    const canSort = !(isMetricsData && field.field === 'title') && (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_11__.isFieldSortable)(field, tableMeta);
    const titleText = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isEquationAlias)(column.name) ? eventView.getEquations()[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.getEquationAliasIndex)(column.name)] : column.name;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      align: align,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledTooltip, {
        title: titleText,
        children: titleText
      }),
      direction: currentSort ? currentSort.kind : undefined,
      canSort: canSort,
      generateSortLink: generateSortLink,
      onClick: () => {
        onHeaderClick === null || onHeaderClick === void 0 ? void 0 : onHeaderClick();
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('dashboards_views.widget_viewer.sort', {
          organization,
          widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.DISCOVER,
          display_type: widget.displayType,
          column: column.name,
          order: (currentSort === null || currentSort === void 0 ? void 0 : currentSort.kind) === 'desc' ? 'asc' : 'desc'
        });
      }
    });
  };
};
const renderGridBodyCell = _ref3 => {
  let {
    location,
    organization,
    widget,
    tableData,
    isFirstPage
  } = _ref3;
  return (column, dataRow, rowIndex, columnIndex) => {
    var _getIssueFieldRendere, _tableData$meta$units;

    const columnKey = String(column.key);
    const isTopEvents = widget.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.DisplayType.TOP_N;
    let cell;
    const isAlias = !organization.features.includes('discover-frontend-use-events-endpoint') && widget.widgetType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.RELEASE;

    switch (widget.widgetType) {
      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.ISSUE:
        cell = ((_getIssueFieldRendere = (0,sentry_utils_dashboards_issueFieldRenderers__WEBPACK_IMPORTED_MODULE_10__.getIssueFieldRenderer)(columnKey)) !== null && _getIssueFieldRendere !== void 0 ? _getIssueFieldRendere : (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(columnKey, sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_17__.ISSUE_FIELDS))(dataRow, {
          organization,
          location
        });
        break;

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.DISCOVER:
      default:
        if (!tableData || !tableData.meta) {
          return dataRow[column.key];
        }

        const unit = (_tableData$meta$units = tableData.meta.units) === null || _tableData$meta$units === void 0 ? void 0 : _tableData$meta$units[column.key];
        cell = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(columnKey, tableData.meta, isAlias)(dataRow, {
          organization,
          location,
          unit
        });
        const fieldName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.getAggregateAlias)(columnKey);
        const value = dataRow[fieldName];

        if (tableData.meta[fieldName] === 'integer' && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(value) && value > 999) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
            title: value.toLocaleString(),
            containerDisplayMode: "block",
            position: "right",
            children: cell
          });
        }

        break;
    }

    const topResultsCount = tableData ? Math.min(tableData === null || tableData === void 0 ? void 0 : tableData.data.length, DEFAULT_NUM_TOP_EVENTS) : DEFAULT_NUM_TOP_EVENTS;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [isTopEvents && isFirstPage && rowIndex < DEFAULT_NUM_TOP_EVENTS && columnIndex === 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_eventsV2_table_topResultsIndicator__WEBPACK_IMPORTED_MODULE_18__["default"], {
        count: topResultsCount,
        index: rowIndex
      }) : null, cell]
    });
  };
};
const renderPrependColumns = _ref4 => {
  let {
    location,
    organization,
    tableData,
    eventView
  } = _ref4;
  return (isHeader, dataRow, rowIndex) => {
    if (isHeader) {
      return [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(PrependHeader, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
          align: "left",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('event id'),
          direction: undefined,
          canSort: false,
          generateSortLink: () => undefined
        })
      }, "header-event-id")];
    }

    let value = dataRow.id;

    if (tableData !== null && tableData !== void 0 && tableData.meta) {
      const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)('id', tableData === null || tableData === void 0 ? void 0 : tableData.meta);
      value = fieldRenderer(dataRow, {
        organization,
        location
      });
    }

    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_14__.generateEventSlug)(dataRow);
    const target = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_14__.eventDetailsRouteWithEventView)({
      orgSlug: organization.slug,
      eventSlug,
      eventView
    });
    return [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View Event'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        "data-test-id": "view-event",
        to: target,
        children: value
      })
    }, `eventlink${rowIndex}`)];
  };
};
const renderReleaseGridHeaderCell = _ref5 => {
  let {
    location,
    widget,
    tableData,
    organization,
    onHeaderClick
  } = _ref5;
  return (column, _columnIndex) => {
    const tableMeta = tableData === null || tableData === void 0 ? void 0 : tableData.meta;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.fieldAlignment)(column.name, column.type, tableMeta);
    const widgetOrderBy = widget.queries[0].orderby;
    const sort = {
      kind: widgetOrderBy.startsWith('-') ? 'desc' : 'asc',
      field: widgetOrderBy.startsWith('-') ? widgetOrderBy.slice(1) : widgetOrderBy
    };
    const canSort = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.isAggregateField)(column.name);
    const titleText = column.name;

    function generateSortLink() {
      const columnSort = column.name === sort.field ? { ...sort,
        kind: sort.kind === 'desc' ? 'asc' : 'desc'
      } : {
        kind: 'desc',
        field: column.name
      };
      return { ...location,
        query: { ...location.query,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.SORT]: columnSort.kind === 'desc' ? `-${columnSort.field}` : columnSort.field,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.PAGE]: undefined,
          [_utils__WEBPACK_IMPORTED_MODULE_19__.WidgetViewerQueryField.CURSOR]: undefined
        }
      };
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      align: align,
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledTooltip, {
        title: titleText,
        children: titleText
      }),
      direction: sort.field === column.name ? sort.kind : undefined,
      canSort: canSort,
      generateSortLink: generateSortLink,
      onClick: () => {
        onHeaderClick === null || onHeaderClick === void 0 ? void 0 : onHeaderClick();
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_9__["default"])('dashboards_views.widget_viewer.sort', {
          organization,
          widget_type: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_15__.WidgetType.RELEASE,
          display_type: widget.displayType,
          column: column.name,
          order: (sort === null || sort === void 0 ? void 0 : sort.kind) === 'desc' ? 'asc' : 'desc'
        });
      }
    });
  };
};

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1fqlj201"
} : 0)( true ? {
  name: "168giuu",
  styles: "display:initial"
} : 0);

const PrependHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1fqlj200"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/pagination.tsx":
/*!***************************************!*\
  !*** ./app/components/pagination.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

// eslint-disable-next-line no-restricted-imports







/**
 * @param cursor The string cursor value
 * @param path   The current page pathname
 * @param query  The current query object
 * @param delta  The delta in page number change triggered by the
 *               click. A negative delta would be a "previous" page.
 */




const defaultOnCursor = (cursor, path, query, _direction) => react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
  pathname: path,
  query: { ...query,
    cursor
  }
});

const Pagination = _ref => {
  var _links$previous, _links$next;

  let {
    to,
    location,
    className,
    onCursor = defaultOnCursor,
    paginationAnalyticsEvent,
    pageLinks,
    size = 'sm',
    caption,
    disabled = false
  } = _ref;

  if (!pageLinks) {
    return null;
  }

  const path = to !== null && to !== void 0 ? to : location.pathname;
  const query = location.query;
  const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_7__["default"])(pageLinks);
  const previousDisabled = disabled || ((_links$previous = links.previous) === null || _links$previous === void 0 ? void 0 : _links$previous.results) === false;
  const nextDisabled = disabled || ((_links$next = links.next) === null || _links$next === void 0 ? void 0 : _links$next.results) === false;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Wrapper, {
    className: className,
    children: [caption && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(PaginationCaption, {
      children: caption
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
      merged: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
          direction: "left",
          size: "sm"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Previous'),
        size: size,
        disabled: previousDisabled,
        onClick: () => {
          var _links$previous2;

          onCursor === null || onCursor === void 0 ? void 0 : onCursor((_links$previous2 = links.previous) === null || _links$previous2 === void 0 ? void 0 : _links$previous2.cursor, path, query, -1);
          paginationAnalyticsEvent === null || paginationAnalyticsEvent === void 0 ? void 0 : paginationAnalyticsEvent('Previous');
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
          direction: "right",
          size: "sm"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Next'),
        size: size,
        disabled: nextDisabled,
        onClick: () => {
          var _links$next2;

          onCursor === null || onCursor === void 0 ? void 0 : onCursor((_links$next2 = links.next) === null || _links$next2 === void 0 ? void 0 : _links$next2.cursor, path, query, 1);
          paginationAnalyticsEvent === null || paginationAnalyticsEvent === void 0 ? void 0 : paginationAnalyticsEvent('Next');
        }
      })]
    })]
  });
};

Pagination.displayName = "Pagination";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgwd3b1"
} : 0)("display:flex;align-items:center;justify-content:flex-end;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), " 0 0 0;" + ( true ? "" : 0));

const PaginationCaption = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewgwd3b0"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(Pagination));

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "axisDuration": () => (/* binding */ axisDuration),
/* harmony export */   "axisLabelFormatter": () => (/* binding */ axisLabelFormatter),
/* harmony export */   "axisLabelFormatterUsingAggregateOutputType": () => (/* binding */ axisLabelFormatterUsingAggregateOutputType),
/* harmony export */   "categorizeDuration": () => (/* binding */ categorizeDuration),
/* harmony export */   "findRangeOfMultiSeries": () => (/* binding */ findRangeOfMultiSeries),
/* harmony export */   "getDurationUnit": () => (/* binding */ getDurationUnit),
/* harmony export */   "tooltipFormatter": () => (/* binding */ tooltipFormatter),
/* harmony export */   "tooltipFormatterUsingAggregateOutputType": () => (/* binding */ tooltipFormatterUsingAggregateOutputType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");




/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */

function tooltipFormatter(value) {
  let outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}
/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */

function tooltipFormatterUsingAggregateOutputType(value, type) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 2);

    case 'duration':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.getDuration)(value / 1000, 2, true);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value);

    default:
      return value.toString();
  }
}
/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */

function axisLabelFormatter(value, outputType) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;
  return axisLabelFormatterUsingAggregateOutputType(value, outputType, abbreviation, durationUnit);
}
/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */

function axisLabelFormatterUsingAggregateOutputType(value, type) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;

  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatAbbreviatedNumber)(value) : value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 0);

    case 'duration':
      return axisDuration(value, durationUnit);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value, 0);

    default:
      return value.toString();
  }
}
/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */

function axisDuration(value, durationUnit) {
  var _durationUnit;

  (_durationUnit = durationUnit) !== null && _durationUnit !== void 0 ? _durationUnit : durationUnit = categorizeDuration(value);

  if (value === 0) {
    return '0';
  }

  switch (durationUnit) {
    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%swk', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sd', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%shr', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%smin', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%ss', label);
      }

    default:
      const label = value.toFixed(0);
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sms', label);
  }
}
/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend
 * Assumes series[0] > series[1] > ...
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */

function findRangeOfMultiSeries(series, legend) {
  var _series$;

  let range;

  if ((_series$ = series[0]) !== null && _series$ !== void 0 && _series$.data) {
    var _maxSeries2;

    let minSeries = series[0];
    let maxSeries;
    series.forEach((_ref, idx) => {
      var _legend$selected;

      let {
        seriesName,
        data
      } = _ref;

      if ((legend === null || legend === void 0 ? void 0 : (_legend$selected = legend.selected) === null || _legend$selected === void 0 ? void 0 : _legend$selected[seriesName]) !== false && data.length) {
        var _maxSeries;

        minSeries = series[idx];
        (_maxSeries = maxSeries) !== null && _maxSeries !== void 0 ? _maxSeries : maxSeries = series[idx];
      }
    });

    if ((_maxSeries2 = maxSeries) !== null && _maxSeries2 !== void 0 && _maxSeries2.data) {
      const max = Math.max(...maxSeries.data.map(_ref2 => {
        let {
          value
        } = _ref2;
        return value;
      }).filter(value => !!value));
      const min = Math.min(...minSeries.data.map(_ref3 => {
        let {
          value
        } = _ref3;
        return value;
      }).filter(value => !!value));
      range = {
        max,
        min
      };
    }
  }

  return range;
}
/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */

function getDurationUnit(series, legend) {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);

  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;

    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }

  return durationUnit;
}
/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */

function categorizeDuration(value) {
  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND;
  }

  return 1;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_widgetViewerModal_tsx-app_utils_discover_charts_tsx.789aedecda16e8c01cf502362cd439c0.js.map