"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionSummary_transactionOverview_tagExplorer_tsx"],{

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

/***/ "./app/utils/performance/segmentExplorer/segmentExplorerQuery.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/segmentExplorer/segmentExplorerQuery.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getRequestFunction": () => (/* binding */ getRequestFunction)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


/**
 * An individual row in a Segment explorer result
 */


function getRequestFunction(_props) {
  const {
    aggregateColumn
  } = _props;

  function getTagExplorerRequestPayload(props) {
    const {
      eventView
    } = props;
    const apiPayload = eventView.getEventsAPIPayload(props.location);
    apiPayload.aggregateColumn = aggregateColumn;
    apiPayload.sort = _props.sort ? _props.sort : apiPayload.sort;

    if (_props.allTagKeys) {
      apiPayload.allTagKeys = _props.allTagKeys;
    }

    if (_props.tagKey) {
      apiPayload.tagKey = _props.tagKey;
    }

    return apiPayload;
  }

  return getTagExplorerRequestPayload;
}

function shouldRefetchData(prevProps, nextProps) {
  return prevProps.aggregateColumn !== nextProps.aggregateColumn || prevProps.sort !== nextProps.sort || prevProps.allTagKeys !== nextProps.allTagKeys || prevProps.tagKey !== nextProps.tagKey;
}

function SegmentExplorerQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    route: "events-facets-performance",
    getRequestPayload: getRequestFunction(props),
    shouldRefetchData: shouldRefetchData,
    ...props
  });
}

SegmentExplorerQuery.displayName = "SegmentExplorerQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])(SegmentExplorerQuery));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/tagExplorer.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/tagExplorer.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TagExplorer": () => (/* binding */ TagExplorer),
/* harmony export */   "TagValue": () => (/* binding */ TagValue),
/* harmony export */   "getTransactionField": () => (/* binding */ getTransactionField)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/performanceDuration */ "./app/components/performanceDuration.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/performance/segmentExplorer/segmentExplorerQuery */ "./app/utils/performance/segmentExplorer/segmentExplorerQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _transactionTags_utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../transactionTags/utils */ "./app/views/performance/transactionSummary/transactionTags/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



























const TAGS_CURSOR_NAME = 'tags_cursor';
const COLUMN_ORDER = [{
  key: 'key',
  field: 'key',
  name: 'Tag Key',
  width: -1,
  column: {
    kind: 'field'
  }
}, {
  key: 'tagValue',
  field: 'tagValue',
  name: 'Tag Values',
  width: -1,
  column: {
    kind: 'field'
  }
}, {
  key: 'aggregate',
  field: 'aggregate',
  name: 'Avg Duration',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'frequency',
  field: 'frequency',
  name: 'Frequency',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'comparison',
  field: 'comparison',
  name: 'Compared To Avg',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}, {
  key: 'sumdelta',
  field: 'sumdelta',
  name: 'Total Time Lost',
  width: -1,
  column: {
    kind: 'field'
  },
  canSort: true
}];
const getTransactionField = (currentFilter, projects, eventView) => {
  const fieldFromFilter = _filter__WEBPACK_IMPORTED_MODULE_24__.SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter];

  if (fieldFromFilter) {
    return fieldFromFilter;
  }

  const performanceType = (0,_utils__WEBPACK_IMPORTED_MODULE_23__.platformAndConditionsToPerformanceType)(projects, eventView);

  if (performanceType === _utils__WEBPACK_IMPORTED_MODULE_23__.PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    return 'measurements.lcp';
  }

  return 'transaction.duration';
};

const getColumnsWithReplacedDuration = (currentFilter, projects, eventView) => {
  const columns = COLUMN_ORDER.map(c => ({ ...c
  }));
  const durationColumn = columns.find(c => c.key === 'aggregate');

  if (!durationColumn) {
    return columns;
  }

  const fieldFromFilter = _filter__WEBPACK_IMPORTED_MODULE_24__.SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter];

  if (fieldFromFilter) {
    durationColumn.name = 'Avg Span Duration';
    return columns;
  }

  const performanceType = (0,_utils__WEBPACK_IMPORTED_MODULE_23__.platformAndConditionsToPerformanceType)(projects, eventView);

  if (performanceType === _utils__WEBPACK_IMPORTED_MODULE_23__.PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    durationColumn.name = 'Avg LCP';
    return columns;
  }

  return columns;
};

function TagValue(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
    className: "truncate",
    children: props.row.tags_value
  });
}
TagValue.displayName = "TagValue";
class TagExplorer extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      widths: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResizeColumn", (columnIndex, nextColumn) => {
      const widths = [...this.state.widths];
      widths[columnIndex] = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_8__.COL_WIDTH_UNDEFINED;
      this.setState({
        widths
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getColumnOrder", columns => {
      const {
        widths
      } = this.state;
      return columns.map((col, i) => {
        if (typeof widths[i] === 'number') {
          return { ...col,
            width: widths[i]
          };
        }

        return col;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderHeadCellWithMeta", (sortedEventView, tableMeta, columns) => {
      return (column, index) => this.renderHeadCell(sortedEventView, tableMeta, column, columns[index]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTagValueClick", (location, tagKey, tagValue) => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
        eventKey: 'performance_views.summary.tag_explorer.tag_value',
        eventName: 'Performance Views: Tag Explorer Value Clicked',
        organization_id: parseInt(organization.id, 10)
      });
      const queryString = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)(location.query.query);
      const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_21__.MutableSearch(queryString !== null && queryString !== void 0 ? queryString : '');
      conditions.addFilterValues(tagKey, [tagValue]);
      const query = conditions.formatString();
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          query: String(query).trim()
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCellAction", (column, tagValue, actionRow) => {
      return action => {
        const {
          eventView,
          location,
          organization
        } = this.props;
        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
          eventKey: 'performance_views.summary.tag_explorer.cell_action',
          eventName: 'Performance Views: Tag Explorer Cell Action Clicked',
          organization_id: parseInt(organization.id, 10)
        });
        const searchConditions = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.normalizeSearchConditions)(eventView.query);
        (0,sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_22__.updateQuery)(searchConditions, action, { ...column,
          name: actionRow.id
        }, tagValue);
        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
          pathname: location.pathname,
          query: { ...location.query,
            [TAGS_CURSOR_NAME]: undefined,
            query: searchConditions.formatString()
          }
        });
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCell", (parentProps, column, dataRow) => {
      const value = dataRow[column.key];
      const {
        location,
        organization,
        transactionName
      } = parentProps;

      if (column.key === 'key') {
        const target = (0,_transactionTags_utils__WEBPACK_IMPORTED_MODULE_25__.tagsRouteWithQuery)({
          orgSlug: organization.slug,
          transaction: transactionName,
          projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)(location.query.project),
          query: { ...location.query,
            tagKey: dataRow.tags_key
          }
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_10__["default"], {
          to: target,
          onClick: () => this.onTagKeyClick(),
          children: dataRow.tags_key
        });
      }

      const allowActions = [sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_22__.Actions.ADD, sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_22__.Actions.EXCLUDE];

      if (column.key === 'tagValue') {
        const actionRow = { ...dataRow,
          id: dataRow.tags_key
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_22__["default"], {
          column: column,
          dataRow: actionRow,
          handleCellAction: this.handleCellAction(column, dataRow.tags_value, actionRow),
          allowActions: allowActions,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
            className: "truncate",
            children: dataRow.tags_value
          })
        });
      }

      if (column.key === 'frequency') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(AlignRight, {
          children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__.formatPercentage)(dataRow.frequency, 0)
        });
      }

      if (column.key === 'comparison') {
        const localValue = dataRow.comparison;
        const pct = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__.formatPercentage)(localValue - 1, 0);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(AlignRight, {
          children: localValue > 1 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('+%s slower', pct) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('%s faster', pct)
        });
      }

      if (column.key === 'aggregate') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(AlignRight, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_12__["default"], {
            abbreviation: true,
            milliseconds: dataRow.aggregate
          })
        });
      }

      if (column.key === 'sumdelta') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(AlignRight, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_performanceDuration__WEBPACK_IMPORTED_MODULE_12__["default"], {
            abbreviation: true,
            milliseconds: dataRow.sumdelta
          })
        });
      }

      return value;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCellWithData", parentProps => {
      return (column, dataRow) => this.renderBodyCell(parentProps, column, dataRow);
    });
  }

  onSortClick(currentSortKind, currentSortField) {
    const {
      organization
    } = this.props;
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
      eventKey: 'performance_views.summary.tag_explorer.sort',
      eventName: 'Performance Views: Tag Explorer Sorted',
      organization_id: parseInt(organization.id, 10),
      field: currentSortField,
      direction: currentSortKind
    });
  }

  renderHeadCell(sortedEventView, tableMeta, column, columnInfo) {
    const {
      location
    } = this.props;
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.fieldAlignment)(column.key, column.type, tableMeta);
    const field = {
      field: column.key,
      width: column.width
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = sortedEventView.sortOnField(field, tableMeta);
      const {
        sort
      } = nextEventView.generateQueryStringObject();
      return { ...location,
        query: { ...location.query,
          [TAGS_CURSOR_NAME]: undefined,
          tagSort: sort
        }
      };
    }

    const currentSort = sortedEventView.sortForField(field, tableMeta);
    const canSort = (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_16__.isFieldSortable)(field, tableMeta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const currentSortField = currentSort ? currentSort.field : undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
      align: align,
      title: columnInfo.name,
      direction: currentSortKind,
      canSort: canSort,
      generateSortLink: generateSortLink,
      onClick: () => this.onSortClick(currentSortKind, currentSortField)
    });
  }

  onTagKeyClick() {
    const {
      organization
    } = this.props;
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
      eventKey: 'performance_views.summary.tag_explorer.visit_tag_key',
      eventName: 'Performance Views: Tag Explorer - Visit Tag Key',
      organization_id: parseInt(organization.id, 10)
    });
  }

  render() {
    var _location$query, _location$query2;

    const {
      eventView,
      organization,
      location,
      currentFilter,
      projects,
      transactionName
    } = this.props;
    const tagSort = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.tagSort);
    const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)((_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2[TAGS_CURSOR_NAME]);
    const tagEventView = eventView.clone();
    tagEventView.fields = COLUMN_ORDER;
    const tagSorts = (0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_16__.fromSorts)(tagSort);
    const sortedEventView = tagEventView.withSorts(tagSorts.length ? tagSorts : [{
      field: 'sumdelta',
      kind: 'desc'
    }]);
    const aggregateColumn = getTransactionField(currentFilter, projects, sortedEventView);
    const adjustedColumns = getColumnsWithReplacedDuration(currentFilter, projects, sortedEventView);
    const columns = this.getColumnOrder(adjustedColumns);
    const columnSortBy = sortedEventView.getSorts();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_utils_performance_segmentExplorer_segmentExplorerQuery__WEBPACK_IMPORTED_MODULE_19__["default"], {
      eventView: sortedEventView,
      orgSlug: organization.slug,
      location: location,
      aggregateColumn: aggregateColumn,
      limit: 5,
      cursor: cursor,
      children: _ref => {
        let {
          isLoading,
          tableData,
          pageLinks
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_5__["default"], {
            target: "tag_explorer",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(TagsHeader, {
              transactionName: transactionName,
              location: location,
              organization: organization,
              pageLinks: pageLinks
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_8__["default"], {
            isLoading: isLoading,
            data: tableData && tableData.data ? tableData.data : [],
            columnOrder: columns,
            columnSortBy: columnSortBy,
            grid: {
              renderHeadCell: this.renderHeadCellWithMeta(sortedEventView, (tableData === null || tableData === void 0 ? void 0 : tableData.meta) || {}, adjustedColumns),
              renderBodyCell: this.renderBodyCellWithData(this.props),
              onResizeColumn: this.handleResizeColumn
            },
            location: location
          })]
        });
      }
    });
  }

}
TagExplorer.displayName = "TagExplorer";

function TagsHeader(props) {
  const {
    pageLinks,
    organization,
    location,
    transactionName
  } = props;

  const handleCursor = (cursor, pathname, query) => {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
      eventKey: 'performance_views.summary.tag_explorer.change_page',
      eventName: 'Performance Views: Tag Explorer Change Page',
      organization_id: parseInt(organization.id, 10)
    });
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
      pathname,
      query: { ...query,
        [TAGS_CURSOR_NAME]: cursor
      }
    });
  };

  const handleViewAllTagsClick = () => {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
      eventKey: 'performance_views.summary.tag_explorer.change_page',
      eventName: 'Performance Views: Tag Explorer Change Page',
      organization_id: parseInt(organization.id, 10)
    });
  };

  const viewAllTarget = (0,_transactionTags_utils__WEBPACK_IMPORTED_MODULE_25__.tagsRouteWithQuery)({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_20__.decodeScalar)(location.query.project),
    query: { ...location.query
    }
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__.SectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Suspect Tags')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
      onClick: handleViewAllTagsClick,
      to: viewAllTarget,
      size: "xs",
      "data-test-id": "tags-explorer-open-tags",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('View All Tags')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledPagination, {
      pageLinks: pageLinks,
      onCursor: handleCursor,
      size: "xs"
    })]
  });
}

TagsHeader.displayName = "TagsHeader";

const AlignRight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7jltvn2"
} : 0)( true ? {
  name: "p2k0n3",
  styles: "text-align:right;font-variant-numeric:tabular-nums;width:100%"
} : 0);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7jltvn1"
} : 0)("display:grid;grid-template-columns:1fr auto auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e7jltvn0"
} : 0)("margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionSummary_transactionOverview_tagExplorer_tsx.b57b7c8c095f44718d7bfa21ec6b5196.js.map