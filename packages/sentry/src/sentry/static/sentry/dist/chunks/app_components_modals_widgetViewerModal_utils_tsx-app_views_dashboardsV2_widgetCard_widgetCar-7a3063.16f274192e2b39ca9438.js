"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_widgetViewerModal_utils_tsx-app_views_dashboardsV2_widgetCard_widgetCar-7a3063"],{

/***/ "./app/actionCreators/metrics.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/metrics.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "doMetricsRequest": () => (/* binding */ doMetricsRequest)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");




const doMetricsRequest = (api, _ref) => {
  let {
    field,
    orgSlug,
    cursor,
    environment,
    groupBy,
    includeSeries,
    includeTotals,
    interval,
    limit,
    orderBy,
    project,
    query,
    includeAllArgs = false,
    statsPeriodStart,
    statsPeriodEnd,
    ...dateTime
  } = _ref;
  const {
    start,
    end,
    statsPeriod
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(dateTime, {
    allowEmptyPeriod: true
  });
  const urlQuery = Object.fromEntries(Object.entries({
    field: field.filter(f => !!f),
    cursor,
    end,
    environment,
    groupBy: groupBy === null || groupBy === void 0 ? void 0 : groupBy.filter(g => !!g),
    includeSeries,
    includeTotals,
    interval: interval || (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__.getInterval)({
      start,
      end,
      period: statsPeriod
    }),
    query: query || undefined,
    per_page: limit,
    project,
    orderBy,
    start,
    statsPeriod,
    statsPeriodStart,
    statsPeriodEnd
  }).filter(_ref2 => {
    let [, value] = _ref2;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(value) && value !== '';
  }));
  const pathname = `/organizations/${orgSlug}/metrics/data/`;
  return api.requestPromise(pathname, {
    includeAllArgs,
    query: urlQuery
  });
};

/***/ }),

/***/ "./app/actionCreators/sessions.tsx":
/*!*****************************************!*\
  !*** ./app/actionCreators/sessions.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "doSessionsRequest": () => (/* binding */ doSessionsRequest)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");




const doSessionsRequest = (api, _ref) => {
  let {
    field,
    orgSlug,
    cursor,
    environment,
    groupBy,
    interval,
    project,
    orderBy,
    query,
    includeAllArgs = false,
    statsPeriodStart,
    statsPeriodEnd,
    limit,
    ...dateTime
  } = _ref;
  const {
    start,
    end,
    statsPeriod
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_2__.normalizeDateTimeParams)(dateTime, {
    allowEmptyPeriod: true
  });
  const urlQuery = Object.fromEntries(Object.entries({
    field: field.filter(f => !!f),
    cursor,
    end,
    environment,
    groupBy: groupBy === null || groupBy === void 0 ? void 0 : groupBy.filter(g => !!g),
    interval: interval || (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_1__.getInterval)({
      start,
      end,
      period: statsPeriod
    }),
    orderBy,
    per_page: limit,
    query: query || undefined,
    project,
    start,
    statsPeriod,
    statsPeriodStart,
    statsPeriodEnd
  }).filter(_ref2 => {
    let [, value] = _ref2;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(value) && value !== '';
  }));
  return api.requestPromise(`/organizations/${orgSlug}/sessions/`, {
    includeAllArgs,
    query: urlQuery
  });
};

/***/ }),

/***/ "./app/components/charts/simpleTableChart.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/simpleTableChart.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TableCell": () => (/* binding */ TableCell),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_eventsV2_table_topResultsIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/eventsV2/table/topResultsIndicator */ "./app/views/eventsV2/table/topResultsIndicator.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function SimpleTableChart(_ref) {
  let {
    className,
    loading,
    eventView,
    fields,
    metadata,
    data,
    title,
    fieldHeaderMap,
    stickyHeaders,
    getCustomFieldRenderer,
    organization,
    topResultsIndicators,
    location,
    fieldAliases,
    loader
  } = _ref;

  function renderRow(index, row, tableMeta, columns) {
    return columns.map((column, columnIndex) => {
      var _getCustomFieldRender, _tableMeta$units;

      const fieldRenderer = (_getCustomFieldRender = getCustomFieldRenderer === null || getCustomFieldRenderer === void 0 ? void 0 : getCustomFieldRenderer(column.key, tableMeta, organization)) !== null && _getCustomFieldRender !== void 0 ? _getCustomFieldRender : (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.getFieldRenderer)(column.key, tableMeta);
      const unit = (_tableMeta$units = tableMeta.units) === null || _tableMeta$units === void 0 ? void 0 : _tableMeta$units[column.key];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TableCell, {
        children: [topResultsIndicators && columnIndex === 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_eventsV2_table_topResultsIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {
          count: topResultsIndicators,
          index: index
        }), fieldRenderer(row, {
          organization,
          location,
          eventView,
          unit
        })]
      }, `${index}-${columnIndex}:${column.name}`);
    });
  }

  const meta = metadata !== null && metadata !== void 0 ? metadata : {};
  const usingEvents = organization.features.includes('discover-frontend-use-events-endpoint');
  const columns = (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_11__.decodeColumnOrder)(fields.map((field, index) => ({
    field,
    alias: fieldAliases[index]
  })), usingEvents);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [title && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h4", {
      children: title
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledPanelTable, {
      className: className,
      isLoading: loading,
      loader: loader,
      headers: columns.map((column, index) => {
        var _fieldHeaderMap$colum;

        const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.fieldAlignment)(column.name, column.type, meta);
        const header = column.column.alias || ((_fieldHeaderMap$colum = fieldHeaderMap === null || fieldHeaderMap === void 0 ? void 0 : fieldHeaderMap[column.key]) !== null && _fieldHeaderMap$colum !== void 0 ? _fieldHeaderMap$colum : column.name);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(HeadCell, {
          align: align,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
            title: header,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledTruncate, {
              value: header,
              maxLength: 30,
              expandable: false
            })
          })
        }, index);
      }),
      isEmpty: !(data !== null && data !== void 0 && data.length),
      stickyHeaders: stickyHeaders,
      disablePadding: true,
      children: data === null || data === void 0 ? void 0 : data.map((row, index) => renderRow(index, row, meta, columns))
    })]
  });
}

SimpleTableChart.displayName = "SimpleTableChart";

const StyledTruncate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e3tr8vk3"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e3tr8vk2"
} : 0)("border-radius:0;border-left:0;border-right:0;border-bottom:0;margin:0;",
/* sc-selector */
sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_3__.PanelTableHeader, "{height:min-content;}" + ( true ? "" : 0));

const HeadCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3tr8vk1"
} : 0)(p => p.align ? `text-align: ${p.align};` : '', " padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";" + ( true ? "" : 0));

const TableCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3tr8vk0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(3), ";" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(SimpleTableChart));

/***/ }),

/***/ "./app/components/dashboards/widgetQueriesForm.tsx":
/*!*********************************************************!*\
  !*** ./app/components/dashboards/widgetQueriesForm.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SearchConditionsWrapper": () => (/* binding */ SearchConditionsWrapper),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "generateOrderOptions": () => (/* binding */ generateOrderOptions)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_buildSteps_filterResultsStep_releaseSearchBar__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _widgetQueryFields__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./widgetQueryFields */ "./app/components/dashboards/widgetQueryFields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const generateOrderOptions = _ref => {
  let {
    aggregates,
    columns,
    widgetType,
    widgetBuilderNewDesign = false
  } = _ref;
  const isRelease = widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_18__.WidgetType.RELEASE;
  const options = [];
  let equations = 0;
  (isRelease ? [...aggregates.map(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.stripDerivedMetricsPrefix), ...columns] : [...aggregates, ...columns]).filter(field => !!field).filter(field => !sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_20__.DISABLED_SORT.includes(field)).filter(field => isRelease ? !sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_20__.TAG_SORT_DENY_LIST.includes(field) : true).forEach(field => {
    var _alias2, _alias3;

    let alias;
    const label = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.stripEquationPrefix)(field); // Equations are referenced via a standard alias following this pattern

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.isEquation)(field)) {
      alias = `equation[${equations}]`;
      equations += 1;
    }

    if (widgetBuilderNewDesign) {
      var _alias;

      options.push({
        label,
        value: (_alias = alias) !== null && _alias !== void 0 ? _alias : field
      });
      return;
    }

    options.push({
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('%s asc', label),
      value: (_alias2 = alias) !== null && _alias2 !== void 0 ? _alias2 : field
    });
    options.push({
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('%s desc', label),
      value: `-${(_alias3 = alias) !== null && _alias3 !== void 0 ? _alias3 : field}`
    });
  });
  return options;
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueriesForm extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "blurTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", (queryIndex, field) => {
      const {
        queries,
        onChange
      } = this.props;
      const widgetQuery = queries[queryIndex];
      return function handleChange(value) {
        const newQuery = { ...widgetQuery,
          [field]: value
        };
        onChange(queryIndex, newQuery);
      };
    });
  }

  componentWillUnmount() {
    window.clearTimeout(this.blurTimeout);
  }

  getFirstQueryError(key) {
    const {
      errors
    } = this.props;

    if (!errors) {
      return undefined;
    }

    return errors.find(queryError => queryError && queryError[key]);
  }

  renderSearchBar(widgetQuery, queryIndex) {
    const {
      organization,
      selection,
      widgetType
    } = this.props;
    return widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_18__.WidgetType.RELEASE ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_views_dashboardsV2_widgetBuilder_buildSteps_filterResultsStep_releaseSearchBar__WEBPACK_IMPORTED_MODULE_19__.ReleaseSearchBar, {
      organization: organization,
      widgetQuery: widgetQuery,
      onClose: field => {
        this.handleFieldChange(queryIndex, 'conditions')(field);
      },
      pageFilters: selection
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledSearchBar, {
      searchSource: "widget_builder",
      organization: organization,
      projectIds: selection.projects,
      query: widgetQuery.conditions,
      fields: [],
      onClose: field => {
        this.handleFieldChange(queryIndex, 'conditions')(field);
      },
      useFormWrapper: false,
      maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_12__.MAX_QUERY_LENGTH
    });
  }

  render() {
    var _this$getFirstQueryEr;

    const {
      organization,
      errors,
      queries,
      canAddSearchConditions,
      handleAddSearchConditions,
      handleDeleteQuery,
      displayType,
      fieldOptions,
      onChange,
      widgetType = sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_18__.WidgetType.DISCOVER
    } = this.props;
    const hideLegendAlias = ['table', 'world_map', 'big_number'].includes(displayType);
    const query = queries[0];
    const explodedFields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(query.fields) ? query.fields.map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.explodeField)({
      field
    })) : [...query.columns, ...query.aggregates].map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.explodeField)({
      field
    }));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(QueryWrapper, {
      children: [queries.map((widgetQuery, queryIndex) => {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
          label: queryIndex === 0 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Query') : null,
          inline: false,
          style: {
            paddingBottom: `8px`
          },
          flexibleControlStateSize: true,
          stacked: true,
          error: errors === null || errors === void 0 ? void 0 : errors[queryIndex].conditions,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(SearchConditionsWrapper, {
            children: [this.renderSearchBar(widgetQuery, queryIndex), !hideLegendAlias && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(LegendAliasInput, {
              type: "text",
              name: "name",
              required: true,
              value: widgetQuery.name,
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Legend Alias'),
              onChange: event => this.handleFieldChange(queryIndex, 'name')(event.target.value)
            }), queries.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
              size: "zero",
              borderless: true,
              onClick: event => {
                event.preventDefault();
                handleDeleteQuery(queryIndex);
              },
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconDelete, {}),
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Remove query'),
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Remove query')
            })]
          })
        }, queryIndex);
      }), canAddSearchConditions && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconAdd, {
          isCircled: true
        }),
        onClick: event => {
          event.preventDefault();
          handleAddSearchConditions();
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Add Query')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_widgetQueryFields__WEBPACK_IMPORTED_MODULE_21__["default"], {
        widgetType: widgetType,
        displayType: displayType,
        fieldOptions: fieldOptions,
        errors: this.getFirstQueryError('fields'),
        fields: explodedFields,
        organization: organization,
        onChange: fields => {
          const {
            aggregates,
            columns
          } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.getColumnsAndAggregatesAsStrings)(fields);
          const fieldStrings = fields.map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_17__.generateFieldAsString)(field));
          queries.forEach((widgetQuery, queryIndex) => {
            const newQuery = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(widgetQuery);
            newQuery.fields = fieldStrings;
            newQuery.aggregates = aggregates;
            newQuery.columns = columns;

            if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(widgetQuery.orderby)) {
              const descending = widgetQuery.orderby.startsWith('-');
              const orderby = widgetQuery.orderby.replace('-', '');
              const prevFieldStrings = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(widgetQuery.fields) ? widgetQuery.fields : [...widgetQuery.columns, ...widgetQuery.aggregates];

              if (!aggregates.includes(orderby) && widgetQuery.orderby !== '') {
                if (prevFieldStrings.length === fields.length) {
                  // The Field that was used in orderby has changed. Get the new field.
                  newQuery.orderby = `${descending ? '-' : ''}${aggregates[prevFieldStrings.indexOf(orderby)]}`;
                } else {
                  newQuery.orderby = '';
                }
              }
            }

            onChange(queryIndex, newQuery);
          });
        }
      }), ['table', 'top_n'].includes(displayType) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_9__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Sort by'),
        inline: false,
        flexibleControlStateSize: true,
        stacked: true,
        error: (_this$getFirstQueryEr = this.getFirstQueryError('orderby')) === null || _this$getFirstQueryEr === void 0 ? void 0 : _this$getFirstQueryEr.orderby,
        style: {
          marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1)
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          value: queries[0].orderby,
          name: "orderby",
          options: generateOrderOptions({
            widgetType,
            columns: queries[0].columns,
            aggregates: queries[0].aggregates
          }),
          onChange: option => this.handleFieldChange(0, 'orderby')(option.value)
        })
      })]
    });
  }

}

WidgetQueriesForm.displayName = "WidgetQueriesForm";

const QueryWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10b8jq53"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const SearchConditionsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10b8jq52"
} : 0)("display:flex;align-items:center;>*+*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";}" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e10b8jq51"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

const LegendAliasInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e10b8jq50"
} : 0)( true ? {
  name: "1f6lq61",
  styles: "width:33%"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetQueriesForm);

/***/ }),

/***/ "./app/components/dashboards/widgetQueryFields.tsx":
/*!*********************************************************!*\
  !*** ./app/components/dashboards/widgetQueryFields.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "QueryFieldWrapper": () => (/* binding */ QueryFieldWrapper),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_eventsV2_table_columnEditCollection__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/eventsV2/table/columnEditCollection */ "./app/views/eventsV2/table/columnEditCollection.tsx");
/* harmony import */ var sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/eventsV2/table/queryField */ "./app/views/eventsV2/table/queryField.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function WidgetQueryFields(_ref) {
  let {
    widgetType,
    displayType,
    errors,
    fields,
    fieldOptions,
    organization,
    onChange,
    style
  } = _ref;
  const isReleaseWidget = widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_10__.WidgetType.RELEASE; // Handle new fields being added.

  function handleAdd(event) {
    event.preventDefault();
    const newFields = [...fields, {
      kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FIELD,
      field: ''
    }];
    onChange(newFields);
  }

  function handleAddEquation(event) {
    event.preventDefault();
    const newFields = [...fields, {
      kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.EQUATION,
      field: ''
    }];
    onChange(newFields);
  }

  function handleRemove(event, fieldIndex) {
    event.preventDefault();
    const newFields = [...fields];
    newFields.splice(fieldIndex, 1);
    onChange(newFields);
  }

  function handleChangeField(value, fieldIndex) {
    const newFields = [...fields];
    newFields[fieldIndex] = value;
    onChange(newFields);
  }

  function handleTopNChangeField(value) {
    const newFields = [...fields];
    newFields[fields.length - 1] = value;
    onChange(newFields);
  }

  function handleTopNColumnChange(columns) {
    const newFields = [...columns, fields[fields.length - 1]];
    onChange(newFields);
  }

  function handleColumnChange(columns) {
    onChange(columns);
  } // Any function/field choice for Big Number widgets is legal since the
  // data source is from an endpoint that is not timeseries-based.
  // The function/field choice for World Map widget will need to be numeric-like.
  // Column builder for Table widget is already handled above.


  const doNotValidateYAxis = displayType === 'big_number';

  const filterPrimaryOptions = option => {
    if (widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_10__.WidgetType.RELEASE) {
      if (displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_10__.DisplayType.TABLE) {
        return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.TAG, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
      }

      if (displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_10__.DisplayType.TOP_N) {
        return option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.TAG;
      }
    } // Only validate function names for timeseries widgets and
    // world map widgets.


    if (!doNotValidateYAxis && option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION) {
      const primaryOutput = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.aggregateFunctionOutputType)(option.value.meta.name, undefined);

      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(primaryOutput);
      }
    }

    return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
  };

  const filterMetricsOptions = option => {
    return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
  };

  const filterAggregateParameters = fieldValue => option => {
    // Only validate function parameters for timeseries widgets and
    // world map widgets.
    if (doNotValidateYAxis) {
      return true;
    }

    if (fieldValue.kind !== sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION) {
      return true;
    }

    if (isReleaseWidget || option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.METRICS) {
      return true;
    }

    const functionName = fieldValue.function[0];
    const primaryOutput = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.aggregateFunctionOutputType)(functionName, option.value.meta.name);

    if (primaryOutput) {
      return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(primaryOutput);
    }

    if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.FUNCTION || option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_13__.FieldValueKind.EQUATION) {
      // Functions and equations are not legal options as an aggregate/function parameter.
      return false;
    }

    return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(option.value.meta.dataType);
  };

  const hideAddYAxisButton = ['world_map', 'big_number'].includes(displayType) && fields.length === 1 || ['line', 'area', 'stacked_area', 'bar'].includes(displayType) && fields.length === 3;
  const canDelete = fields.length > 1;

  if (displayType === 'table') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
      "data-test-id": "columns",
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Columns'),
      inline: false,
      style: {
        padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1)} 0`,
        ...(style !== null && style !== void 0 ? style : {})
      },
      error: errors === null || errors === void 0 ? void 0 : errors.fields,
      flexibleControlStateSize: true,
      stacked: true,
      required: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledColumnEditCollection, {
        columns: fields,
        onChange: handleColumnChange,
        fieldOptions: fieldOptions,
        organization: organization,
        filterPrimaryOptions: isReleaseWidget ? filterPrimaryOptions : undefined,
        source: widgetType
      })
    });
  }

  if (displayType === 'top_n') {
    const fieldValue = fields[fields.length - 1];
    const columns = fields.slice(0, fields.length - 1);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        "data-test-id": "columns",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Columns'),
        inline: false,
        style: {
          padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1)} 0`,
          ...(style !== null && style !== void 0 ? style : {})
        },
        error: errors === null || errors === void 0 ? void 0 : errors.fields,
        flexibleControlStateSize: true,
        stacked: true,
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledColumnEditCollection, {
          columns: columns,
          onChange: handleTopNColumnChange,
          fieldOptions: fieldOptions,
          organization: organization,
          filterPrimaryOptions: isReleaseWidget ? filterPrimaryOptions : undefined,
          source: widgetType
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        "data-test-id": "y-axis",
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Y-Axis'),
        inline: false,
        style: {
          padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2)} 0 24px 0`,
          ...(style !== null && style !== void 0 ? style : {})
        },
        flexibleControlStateSize: true,
        error: errors === null || errors === void 0 ? void 0 : errors.fields,
        required: true,
        stacked: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(QueryFieldWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_12__.QueryField, {
            fieldValue: fieldValue,
            fieldOptions: isReleaseWidget ? fieldOptions : (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_14__.generateFieldOptions)({
              organization
            }),
            onChange: value => handleTopNChangeField(value),
            filterPrimaryOptions: isReleaseWidget ? filterMetricsOptions : filterPrimaryOptions,
            filterAggregateParameters: filterAggregateParameters(fieldValue)
          })
        }, `${fieldValue}:0`)
      })]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
    "data-test-id": "y-axis",
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Y-Axis'),
    inline: false,
    style: {
      padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2)} 0 24px 0`,
      ...(style !== null && style !== void 0 ? style : {})
    },
    flexibleControlStateSize: true,
    error: errors === null || errors === void 0 ? void 0 : errors.fields,
    required: true,
    stacked: true,
    children: [fields.map((field, i) => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(QueryFieldWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_12__.QueryField, {
          fieldValue: field,
          fieldOptions: fieldOptions,
          onChange: value => handleChangeField(value, i),
          filterPrimaryOptions: filterPrimaryOptions,
          filterAggregateParameters: filterAggregateParameters(field),
          otherColumns: fields
        }), (canDelete || field.kind === 'equation') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          size: "zero",
          borderless: true,
          onClick: event => handleRemove(event, i),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconDelete, {}),
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Remove this Y-Axis'),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Remove this Y-Axis')
        })]
      }, `${field}:${i}`);
    }), !hideAddYAxisButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Actions, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconAdd, {
          isCircled: true
        }),
        onClick: handleAdd,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Add Overlay')
      }), !isReleaseWidget && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
        size: "sm",
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Add an Equation'),
        onClick: handleAddEquation,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconAdd, {
          isCircled: true
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Add an Equation')
      })]
    })]
  });
}

WidgetQueryFields.displayName = "WidgetQueryFields";

const StyledColumnEditCollection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_eventsV2_table_columnEditCollection__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e2l1oc32"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

const QueryFieldWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2l1oc31"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";>*+*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e2l1oc30"
} : 0)("grid-column:2/3;& button{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetQueryFields);

/***/ }),

/***/ "./app/components/modals/widgetViewerModal/utils.tsx":
/*!***********************************************************!*\
  !*** ./app/components/modals/widgetViewerModal/utils.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetViewerQueryField": () => (/* binding */ WidgetViewerQueryField),
/* harmony export */   "isWidgetViewerPath": () => (/* binding */ isWidgetViewerPath)
/* harmony export */ });
// Widget Viewer specific query params so we don't interfere with other params like GSH
let WidgetViewerQueryField;

(function (WidgetViewerQueryField) {
  WidgetViewerQueryField["SORT"] = "sort";
  WidgetViewerQueryField["QUERY"] = "query";
  WidgetViewerQueryField["LEGEND"] = "legend";
  WidgetViewerQueryField["PAGE"] = "page";
  WidgetViewerQueryField["CURSOR"] = "cursor";
  WidgetViewerQueryField["WIDTH"] = "width";
  WidgetViewerQueryField["START"] = "viewerStart";
  WidgetViewerQueryField["END"] = "viewerEnd";
})(WidgetViewerQueryField || (WidgetViewerQueryField = {}));

function isWidgetViewerPath(pathname) {
  return pathname.match(/\/widget\/[0-9]+\/$/);
}

/***/ }),

/***/ "./app/utils/dashboards/issueFieldRenderers.tsx":
/*!******************************************************!*\
  !*** ./app/utils/dashboards/issueFieldRenderers.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getIssueFieldRenderer": () => (/* binding */ getIssueFieldRenderer),
/* harmony export */   "getSortField": () => (/* binding */ getSortField)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_assigneeSelector__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/assigneeSelector */ "./app/components/assigneeSelector.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector/utils */ "./app/components/organizations/timeRangeSelector/utils.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/issueWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");
/* harmony import */ var _discover_styles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















/**
 * Types, functions and definitions for rendering fields in discover results.
 */




/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS = {
  issue: {
    sortField: null,
    renderFunc: (data, _ref) => {
      let {
        organization
      } = _ref;
      const issueID = data['issue.id'];

      if (!issueID) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.FieldShortId, {
            shortId: `${data.issue}`
          })
        });
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.OverflowLink, {
          to: target,
          "aria-label": issueID,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.FieldShortId, {
            shortId: `${data.issue}`
          })
        })
      });
    }
  },
  assignee: {
    sortField: null,
    renderFunc: data => {
      const memberList = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_10__["default"].getAll();
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ActorContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_assigneeSelector__WEBPACK_IMPORTED_MODULE_3__["default"], {
          id: data.id,
          memberList: memberList,
          noDropdown: true
        })
      });
    }
  },
  lifetimeEvents: {
    sortField: null,
    renderFunc: (data, _ref2) => {
      let {
        organization
      } = _ref2;
      return issuesCountRenderer(data, organization, 'lifetimeEvents');
    }
  },
  lifetimeUsers: {
    sortField: null,
    renderFunc: (data, _ref3) => {
      let {
        organization
      } = _ref3;
      return issuesCountRenderer(data, organization, 'lifetimeUsers');
    }
  },
  events: {
    sortField: 'freq',
    renderFunc: (data, _ref4) => {
      let {
        organization
      } = _ref4;
      return issuesCountRenderer(data, organization, 'events');
    }
  },
  users: {
    sortField: 'user',
    renderFunc: (data, _ref5) => {
      let {
        organization
      } = _ref5;
      return issuesCountRenderer(data, organization, 'users');
    }
  },
  lifetimeCount: {
    sortField: null,
    renderFunc: (data, _ref6) => {
      let {
        organization
      } = _ref6;
      return issuesCountRenderer(data, organization, 'lifetimeEvents');
    }
  },
  lifetimeUserCount: {
    sortField: null,
    renderFunc: (data, _ref7) => {
      let {
        organization
      } = _ref7;
      return issuesCountRenderer(data, organization, 'lifetimeUsers');
    }
  },
  count: {
    sortField: null,
    renderFunc: (data, _ref8) => {
      let {
        organization
      } = _ref8;
      return issuesCountRenderer(data, organization, 'events');
    }
  },
  userCount: {
    sortField: null,
    renderFunc: (data, _ref9) => {
      let {
        organization
      } = _ref9;
      return issuesCountRenderer(data, organization, 'users');
    }
  },
  links: {
    sortField: null,
    renderFunc: _ref10 => {
      let {
        links
      } = _ref10;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(LinksContainer, {
        dangerouslySetInnerHTML: {
          __html: links
        }
      });
    }
  }
};

const issuesCountRenderer = (data, organization, field) => {
  const {
    start,
    end,
    period
  } = data;
  const isUserField = !!/user/i.exec(field.toLowerCase());
  const primaryCount = data[field];
  const count = data[isUserField ? 'users' : 'events'];
  const lifetimeCount = data[isUserField ? 'lifetimeUsers' : 'lifetimeEvents'];
  const filteredCount = data[isUserField ? 'filteredUsers' : 'filteredEvents'];
  const discoverLink = getDiscoverUrl(data, organization);
  const filteredDiscoverLink = getDiscoverUrl(data, organization, true);
  const selectionDateString = !!start && !!end ? 'time range' : (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_6__.getRelativeSummary)(period || sentry_constants__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_STATS_PERIOD).toLowerCase();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_discover_styles__WEBPACK_IMPORTED_MODULE_14__.Container, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
      isHoverable: true,
      skipWrapper: true,
      overlayStyle: {
        padding: 0
      },
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
        children: [filteredCount ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyledLink, {
            to: filteredDiscoverLink,
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Matching search filters'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(WrappedCount, {
              value: filteredCount
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Divider, {})]
        }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyledLink, {
          to: discoverLink,
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(`Total in ${selectionDateString}`), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(WrappedCount, {
            value: count
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Divider, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(StyledContent, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Since issue began'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(WrappedCount, {
            value: lifetimeCount
          })]
        })]
      }),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("span", {
        children: ['events', 'users'].includes(field) && filteredCount ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"], {
            value: filteredCount
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SecondaryCount, {
            value: primaryCount
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"], {
          value: primaryCount
        })
      })
    })
  });
};

issuesCountRenderer.displayName = "issuesCountRenderer";

const getDiscoverUrl = (data, organization, filtered) => {
  const commonQuery = {
    projects: [Number(data.projectId)]
  };
  const discoverView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_12__["default"].fromSavedQuery({ ...commonQuery,
    id: undefined,
    start: data.start,
    end: data.end,
    range: data.period,
    name: data.title,
    fields: ['title', 'release', 'environment', 'user', 'timestamp'],
    orderby: '-timestamp',
    query: `issue.id:${data.id}${filtered ? data.discoverSearchQuery : ''}`,
    version: 2
  });
  return discoverView.getResultsViewUrlTarget(organization.slug);
};

function getSortField(field) {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].sortField;
  }

  switch (field) {
    case sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_13__.FieldKey.LAST_SEEN:
      return 'date';

    case sentry_views_dashboardsV2_widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_13__.FieldKey.FIRST_SEEN:
      return 'new';

    default:
      return null;
  }
}
const contentStyle =  true ? {
  name: "s5gdgx",
  styles: "width:100%;justify-content:space-between;display:flex;padding:6px 10px"
} : 0;

const StyledContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1va53iy6"
} : 0)(contentStyle, ";" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1va53iy5"
} : 0)(contentStyle, ";color:", p => p.theme.gray400, ";&:hover{color:", p => p.theme.gray400, ";background:", p => p.theme.hover, ";}" + ( true ? "" : 0));

const SecondaryCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1va53iy4"
} : 0)(":before{content:'/';padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), ";padding-right:2px;}" + ( true ? "" : 0));

const WrappedCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref11 => {
  let {
    value,
    ...p
  } = _ref11;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", { ...p,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_4__["default"], {
      value: value
    })
  });
},  true ? {
  target: "e1va53iy3"
} : 0)("text-align:right;font-weight:bold;font-variant-numeric:tabular-nums;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const Divider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1va53iy2"
} : 0)("height:1px;overflow:hidden;background-color:", p => p.theme.innerBorder, ";" + ( true ? "" : 0));

const ActorContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1va53iy1"
} : 0)( true ? {
  name: "1sl6pdq",
  styles: "display:flex;justify-content:left;margin-left:18px;height:24px;:hover{cursor:default;}"
} : 0);

const LinksContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1va53iy0"
} : 0)( true ? {
  name: "1bmnxg7",
  styles: "white-space:nowrap"
} : 0);
/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */


function getIssueFieldRenderer(field) {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  } // Return null if there is no field renderer for this field
  // Should check the discover field renderer for this field


  return null;
}

/***/ }),

/***/ "./app/views/dashboardsV2/datasetConfig/base.tsx":
/*!*******************************************************!*\
  !*** ./app/views/dashboardsV2/datasetConfig/base.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDatasetConfig": () => (/* binding */ getDatasetConfig),
/* harmony export */   "handleOrderByReset": () => (/* binding */ handleOrderByReset)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _errorsAndTransactions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./errorsAndTransactions */ "./app/views/dashboardsV2/datasetConfig/errorsAndTransactions.tsx");
/* harmony import */ var _issues__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./issues */ "./app/views/dashboardsV2/datasetConfig/issues.tsx");
/* harmony import */ var _releases__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./releases */ "./app/views/dashboardsV2/datasetConfig/releases.tsx");








function getDatasetConfig(widgetType) {
  switch (widgetType) {
    case _types__WEBPACK_IMPORTED_MODULE_3__.WidgetType.ISSUE:
      return _issues__WEBPACK_IMPORTED_MODULE_6__.IssuesConfig;

    case _types__WEBPACK_IMPORTED_MODULE_3__.WidgetType.RELEASE:
      return _releases__WEBPACK_IMPORTED_MODULE_7__.ReleasesConfig;

    case _types__WEBPACK_IMPORTED_MODULE_3__.WidgetType.DISCOVER:
    default:
      return _errorsAndTransactions__WEBPACK_IMPORTED_MODULE_5__.ErrorsAndTransactionsConfig;
  }
}
/**
 * A generic orderby reset helper function that updates the query's
 * orderby based on new selected fields.
 */

function handleOrderByReset(widgetQuery, newFields) {
  const rawOrderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_1___default()(widgetQuery.orderby, '-');
  const isDescending = widgetQuery.orderby.startsWith('-');
  const orderbyPrefix = isDescending ? '-' : '';

  if (!newFields.includes(rawOrderby) && widgetQuery.orderby !== '') {
    var _widgetQuery$aggregat;

    const isFromAggregates = widgetQuery.aggregates.includes(rawOrderby);
    const isCustomEquation = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_2__.isEquation)(rawOrderby);
    const isUsedInGrouping = widgetQuery.columns.includes(rawOrderby);
    const keepCurrentOrderby = isFromAggregates || isCustomEquation || isUsedInGrouping;
    const firstAggregateAlias = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_2__.isEquation)((_widgetQuery$aggregat = widgetQuery.aggregates[0]) !== null && _widgetQuery$aggregat !== void 0 ? _widgetQuery$aggregat : '') ? `equation[${(0,_utils__WEBPACK_IMPORTED_MODULE_4__.getNumEquations)(widgetQuery.aggregates) - 1}]` : newFields[0];
    widgetQuery.orderby = keepCurrentOrderby && widgetQuery.orderby || `${orderbyPrefix}${firstAggregateAlias}`;
  }

  return widgetQuery;
}

/***/ }),

/***/ "./app/views/dashboardsV2/datasetConfig/errorsAndTransactions.tsx":
/*!************************************************************************!*\
  !*** ./app/views/dashboardsV2/datasetConfig/errorsAndTransactions.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorsAndTransactionsConfig": () => (/* binding */ ErrorsAndTransactionsConfig),
/* harmony export */   "getCustomEventsFieldRenderer": () => (/* binding */ getCustomEventsFieldRenderer)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _widgetBuilder_buildSteps_filterResultsStep_eventsSearchBar__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar.tsx");
/* harmony import */ var _widgetBuilder_buildSteps_sortByStep__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../widgetBuilder/buildSteps/sortByStep */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/index.tsx");
/* harmony import */ var _widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../widgetCard/widgetQueries */ "./app/views/dashboardsV2/widgetCard/widgetQueries.tsx");
/* harmony import */ var _base__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


























const DEFAULT_WIDGET_QUERY = {
  name: '',
  fields: ['count()'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: '-count()'
};
const ErrorsAndTransactionsConfig = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  SearchBar: _widgetBuilder_buildSteps_filterResultsStep_eventsSearchBar__WEBPACK_IMPORTED_MODULE_21__.EventsSearchBar,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getTableFieldOptions: getEventsTableFieldOptions,
  getTimeseriesSortOptions,
  getTableSortOptions,
  getGroupByFieldOptions: getEventsTableFieldOptions,
  handleOrderByReset: _base__WEBPACK_IMPORTED_MODULE_24__.handleOrderByReset,
  supportedDisplayTypes: [_types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.AREA, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.BAR, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.BIG_NUMBER, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.LINE, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.TABLE, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.TOP_N, _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.WORLD_MAP],
  getTableRequest: (api, query, organization, pageFilters, limit, cursor, referrer) => {
    const shouldUseEvents = organization.features.includes('discover-frontend-use-events-endpoint');
    const url = shouldUseEvents ? `/organizations/${organization.slug}/events/` : `/organizations/${organization.slug}/eventsv2/`;
    return getEventsRequest(url, api, query, organization, pageFilters, limit, cursor, referrer);
  },
  getSeriesRequest: getEventsSeriesRequest,
  getWorldMapRequest: (api, query, organization, pageFilters, limit, cursor, referrer) => {
    return getEventsRequest(`/organizations/${organization.slug}/events-geo/`, api, query, organization, pageFilters, limit, cursor, referrer);
  },
  transformSeries: transformEventsResponseToSeries,
  transformTable: transformEventsResponseToTable,
  filterTableOptions,
  filterAggregateParams,
  getSeriesResultType
};

function getTableSortOptions(_organization, widgetQuery) {
  const {
    columns,
    aggregates
  } = widgetQuery;
  const options = [];
  let equations = 0;
  [...aggregates, ...columns].filter(field => !!field).forEach(field => {
    var _alias;

    let alias;
    const label = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.stripEquationPrefix)(field); // Equations are referenced via a standard alias following this pattern

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquation)(field)) {
      alias = `equation[${equations}]`;
      equations += 1;
    }

    options.push({
      label,
      value: (_alias = alias) !== null && _alias !== void 0 ? _alias : field
    });
  });
  return options;
}

function filterSeriesSortOptions(columns) {
  return option => {
    if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.FUNCTION || option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.EQUATION) {
      return true;
    }

    return columns.has(option.value.meta.name) || option.value.meta.name === _widgetBuilder_buildSteps_sortByStep__WEBPACK_IMPORTED_MODULE_22__.CUSTOM_EQUATION_VALUE;
  };
}

function getTimeseriesSortOptions(organization, widgetQuery, tags) {
  const options = {};
  options[`field:${_widgetBuilder_buildSteps_sortByStep__WEBPACK_IMPORTED_MODULE_22__.CUSTOM_EQUATION_VALUE}`] = {
    label: 'Custom Equation',
    value: {
      kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.EQUATION,
      meta: {
        name: _widgetBuilder_buildSteps_sortByStep__WEBPACK_IMPORTED_MODULE_22__.CUSTOM_EQUATION_VALUE
      }
    }
  };
  let equations = 0;
  [...widgetQuery.aggregates, ...widgetQuery.columns].filter(field => !!field).forEach(field => {
    let alias;
    const label = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.stripEquationPrefix)(field); // Equations are referenced via a standard alias following this pattern

    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquation)(field)) {
      var _alias2;

      alias = `equation[${equations}]`;
      equations += 1;
      options[`equation:${alias}`] = {
        label,
        value: {
          kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.EQUATION,
          meta: {
            name: (_alias2 = alias) !== null && _alias2 !== void 0 ? _alias2 : field
          }
        }
      };
    }
  });
  const fieldOptions = getEventsTableFieldOptions(organization, tags);
  return { ...options,
    ...fieldOptions
  };
}

function getEventsTableFieldOptions(organization, tags, customMeasurements) {
  const measurements = (0,sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_15__.getMeasurements)();
  return (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_17__.generateFieldOptions)({
    organization,
    tagKeys: Object.values(tags !== null && tags !== void 0 ? tags : {}).map(_ref => {
      let {
        key
      } = _ref;
      return key;
    }),
    measurementKeys: Object.values(measurements).map(_ref2 => {
      let {
        key
      } = _ref2;
      return key;
    }),
    spanOperationBreakdownKeys: sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.SPAN_OP_BREAKDOWN_FIELDS,
    customMeasurements: organization.features.includes('dashboards-mep') || organization.features.includes('mep-rollout-flag') ? Object.values(customMeasurements !== null && customMeasurements !== void 0 ? customMeasurements : {}).map(_ref3 => {
      let {
        key,
        functions
      } = _ref3;
      return {
        key,
        functions
      };
    }) : undefined
  });
}

function transformEventsResponseToTable(data, _widgetQuery, organization) {
  let tableData = data;
  const shouldUseEvents = organization.features.includes('discover-frontend-use-events-endpoint'); // events api uses a different response format so we need to construct tableData differently

  if (shouldUseEvents) {
    var _meta;

    const {
      fields,
      ...otherMeta
    } = (_meta = data.meta) !== null && _meta !== void 0 ? _meta : {};
    tableData = { ...data,
      meta: { ...fields,
        ...otherMeta
      }
    };
  }

  return tableData;
}

function filterYAxisAggregateParams(fieldValue, displayType) {
  return option => {
    // Only validate function parameters for timeseries widgets and
    // world map widgets.
    if (displayType === _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.BIG_NUMBER) {
      return true;
    }

    if (fieldValue.kind !== sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.FUNCTION) {
      return true;
    }

    const functionName = fieldValue.function[0];
    const primaryOutput = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.errorsAndTransactionsAggregateFunctionOutputType)(functionName, option.value.meta.name);

    if (primaryOutput) {
      return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(primaryOutput);
    }

    if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.FUNCTION || option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.EQUATION) {
      // Functions and equations are not legal options as an aggregate/function parameter.
      return false;
    }

    return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(option.value.meta.dataType);
  };
}

function filterYAxisOptions(displayType) {
  return option => {
    // Only validate function names for timeseries widgets and
    // world map widgets.
    if (!(displayType === _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.BIG_NUMBER) && option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.FUNCTION) {
      const primaryOutput = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.errorsAndTransactionsAggregateFunctionOutputType)(option.value.meta.name, undefined);

      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isLegalYAxisType)(primaryOutput);
      }
    }

    return option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.FUNCTION;
  };
}

function transformEventsResponseToSeries(data, widgetQuery, organization) {
  let output = [];
  const queryAlias = widgetQuery.name;
  const widgetBuilderNewDesign = organization.features.includes('new-widget-builder-experience-design') || false;

  if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.isMultiSeriesStats)(data)) {
    let seriesWithOrdering = [];
    const isMultiSeriesDataWithGrouping = widgetQuery.aggregates.length > 1 && widgetQuery.columns.length; // Convert multi-series results into chartable series. Multi series results
    // are created when multiple yAxis are used. Convert the timeseries
    // data into a multi-series data set.  As the server will have
    // replied with a map like: {[titleString: string]: EventsStats}

    if (widgetBuilderNewDesign && isMultiSeriesDataWithGrouping) {
      seriesWithOrdering = (0,_widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_23__.flattenMultiSeriesDataWithGrouping)(data, queryAlias);
    } else {
      seriesWithOrdering = Object.keys(data).map(seriesName => {
        const prefixedName = queryAlias ? `${queryAlias} : ${seriesName}` : seriesName;
        const seriesData = data[seriesName];
        return [seriesData.order || 0, (0,_widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_23__.transformSeries)(seriesData, prefixedName, seriesName)];
      });
    }

    output = [...seriesWithOrdering.sort((itemA, itemB) => itemA[0] - itemB[0]).map(item => item[1])];
  } else {
    const field = widgetQuery.aggregates[0];
    const prefixedName = queryAlias ? `${queryAlias} : ${field}` : field;
    const transformed = (0,_widgetCard_widgetQueries__WEBPACK_IMPORTED_MODULE_23__.transformSeries)(data, prefixedName, field);
    output.push(transformed);
  }

  return output;
} // Get the series result type from the EventsStats meta


function getSeriesResultType(data, widgetQuery) {
  var _data$meta;

  const field = widgetQuery.aggregates[0]; // Need to use getAggregateAlias since events-stats still uses aggregate alias format

  if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.isMultiSeriesStats)(data)) {
    var _data$Object$keys$0$m;

    return (_data$Object$keys$0$m = data[Object.keys(data)[0]].meta) === null || _data$Object$keys$0$m === void 0 ? void 0 : _data$Object$keys$0$m.fields[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.getAggregateAlias)(field)];
  }

  return (_data$meta = data.meta) === null || _data$meta === void 0 ? void 0 : _data$meta.fields[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.getAggregateAlias)(field)];
}

function renderEventIdAsLinkable(data, _ref4) {
  let {
    eventView,
    organization
  } = _ref4;
  const id = data === null || data === void 0 ? void 0 : data.id;

  if (!eventView || typeof id !== 'string') {
    return null;
  }

  const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_13__.generateEventSlug)(data);
  const target = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_13__.eventDetailsRouteWithEventView)({
    orgSlug: organization.slug,
    eventSlug,
    eventView
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View Event'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
      "data-test-id": "view-event",
      to: target,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_11__.Container, {
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_14__.getShortEventId)(id)
      })
    })
  });
}

renderEventIdAsLinkable.displayName = "renderEventIdAsLinkable";

function renderTraceAsLinkable(data, _ref5) {
  let {
    eventView,
    organization,
    location
  } = _ref5;
  const id = data === null || data === void 0 ? void 0 : data.trace;

  if (!eventView || typeof id !== 'string') {
    return null;
  }

  const dateSelection = eventView.normalizeDateSelection(location);
  const target = (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_18__.getTraceDetailsUrl)(organization, String(data.trace), dateSelection, {});
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View Trace'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
      "data-test-id": "view-trace",
      to: target,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_11__.Container, {
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_14__.getShortEventId)(id)
      })
    })
  });
}

renderTraceAsLinkable.displayName = "renderTraceAsLinkable";
function getCustomEventsFieldRenderer(field, meta, organization) {
  const isAlias = !(organization !== null && organization !== void 0 && organization.features.includes('discover-frontend-use-events-endpoint'));

  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable;
  }

  return (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_8__.getFieldRenderer)(field, meta, isAlias);
}

function getEventsRequest(url, api, query, organization, pageFilters, limit, cursor, referrer) {
  const isMEPEnabled = organization.features.includes('dashboards-mep');
  const eventView = (0,_utils__WEBPACK_IMPORTED_MODULE_20__.eventViewFromWidget)('', query, pageFilters);
  const params = {
    per_page: limit,
    cursor,
    referrer,
    ...(0,_utils__WEBPACK_IMPORTED_MODULE_20__.getDashboardsMEPQueryParams)(isMEPEnabled)
  };

  if (query.orderby) {
    params.sort = typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
  } // TODO: eventually need to replace this with just EventsTableData as we deprecate eventsv2


  return (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_10__.doDiscoverQuery)(api, url, { ...eventView.generateQueryStringObject(),
    ...params
  });
}

function getEventsSeriesRequest(api, widget, queryIndex, organization, pageFilters, referrer) {
  const widgetQuery = widget.queries[queryIndex];
  const {
    displayType,
    limit
  } = widget;
  const {
    environments,
    projects
  } = pageFilters;
  const {
    start,
    end,
    period: statsPeriod
  } = pageFilters.datetime;
  const interval = (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getWidgetInterval)(displayType, {
    start,
    end,
    period: statsPeriod
  });
  const isMEPEnabled = organization.features.includes('dashboards-mep');
  let requestData;

  if (displayType === _types__WEBPACK_IMPORTED_MODULE_19__.DisplayType.TOP_N) {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates[widgetQuery.aggregates.length - 1],
      includePrevious: false,
      referrer,
      partial: true,
      field: [...widgetQuery.columns, ...widgetQuery.aggregates],
      queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getDashboardsMEPQueryParams)(isMEPEnabled),
      includeAllArgs: true,
      topEvents: sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_12__.TOP_N
    };

    if (widgetQuery.orderby) {
      requestData.orderby = widgetQuery.orderby;
    }
  } else {
    var _widgetQuery$columns;

    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates,
      orderby: widgetQuery.orderby,
      includePrevious: false,
      referrer,
      partial: true,
      queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getDashboardsMEPQueryParams)(isMEPEnabled),
      includeAllArgs: true
    };

    if (((_widgetQuery$columns = widgetQuery.columns) === null || _widgetQuery$columns === void 0 ? void 0 : _widgetQuery$columns.length) !== 0) {
      requestData.topEvents = limit !== null && limit !== void 0 ? limit : sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_12__.TOP_N;
      requestData.field = [...widgetQuery.columns, ...widgetQuery.aggregates]; // Compare field and orderby as aliases to ensure requestData has
      // the orderby selected
      // If the orderby is an equation alias, do not inject it

      const orderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_2___default()(widgetQuery.orderby, '-');

      if (widgetQuery.orderby && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquationAlias)(orderby) && !requestData.field.includes(orderby)) {
        requestData.field.push(orderby);
      } // The "Other" series is only included when there is one
      // y-axis and one widgetQuery


      requestData.excludeOther = widgetQuery.aggregates.length !== 1 || widget.queries.length !== 1;

      if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquation)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_2___default()(widgetQuery.orderby, '-'))) {
        const nextEquationIndex = (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getNumEquations)(widgetQuery.aggregates);
        const isDescending = widgetQuery.orderby.startsWith('-');
        const prefix = isDescending ? '-' : ''; // Construct the alias form of the equation and inject it into the request

        requestData.orderby = `${prefix}equation[${nextEquationIndex}]`;
        requestData.field = [...widgetQuery.columns, ...widgetQuery.aggregates, lodash_trimStart__WEBPACK_IMPORTED_MODULE_2___default()(widgetQuery.orderby, '-')];
      }
    }
  }

  return (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_3__.doEventsRequest)(api, requestData);
} // Custom Measurements aren't selectable as columns/yaxis without using an aggregate


function filterTableOptions(option) {
  return option.value.kind !== sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.CUSTOM_MEASUREMENT;
} // Checks fieldValue to see what function is being used and only allow supported custom measurements


function filterAggregateParams(option, fieldValue) {
  if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_16__.FieldValueKind.CUSTOM_MEASUREMENT && (fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === 'function' && fieldValue !== null && fieldValue !== void 0 && fieldValue.function && !option.value.meta.functions.includes(fieldValue.function[0])) {
    return false;
  }

  return true;
}

/***/ }),

/***/ "./app/views/dashboardsV2/datasetConfig/issues.tsx":
/*!*********************************************************!*\
  !*** ./app/views/dashboardsV2/datasetConfig/issues.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IssuesConfig": () => (/* binding */ IssuesConfig),
/* harmony export */   "transformIssuesResponseToTable": () => (/* binding */ transformIssuesResponseToTable)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_utils_dashboards_issueFieldRenderers__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/dashboards/issueFieldRenderers */ "./app/utils/dashboards/issueFieldRenderers.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _widgetBuilder_buildSteps_filterResultsStep_issuesSearchBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar.tsx");
/* harmony import */ var _widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../widgetBuilder/issueWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");
/* harmony import */ var _widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../widgetBuilder/issueWidget/utils */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/utils.tsx");












const DEFAULT_WIDGET_QUERY = {
  name: '',
  fields: ['issue', 'assignee', 'title'],
  columns: ['issue', 'assignee', 'title'],
  fieldAliases: [],
  aggregates: [],
  conditions: '',
  orderby: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__.IssueSortOptions.DATE
};
const DEFAULT_SORT = sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__.IssueSortOptions.DATE;
const DEFAULT_EXPAND = ['owners'];
const IssuesConfig = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  disableSortOptions,
  getTableRequest,
  getCustomFieldRenderer: sentry_utils_dashboards_issueFieldRenderers__WEBPACK_IMPORTED_MODULE_5__.getIssueFieldRenderer,
  SearchBar: _widgetBuilder_buildSteps_filterResultsStep_issuesSearchBar__WEBPACK_IMPORTED_MODULE_9__.IssuesSearchBar,
  getTableSortOptions,
  getTableFieldOptions: _organization => (0,_widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_11__.generateIssueWidgetFieldOptions)(),
  fieldHeaderMap: _widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_10__.ISSUE_FIELD_TO_HEADER_MAP,
  supportedDisplayTypes: [_types__WEBPACK_IMPORTED_MODULE_8__.DisplayType.TABLE],
  transformTable: transformIssuesResponseToTable
};

function disableSortOptions(_widgetQuery) {
  return {
    disableSort: false,
    disableSortDirection: true,
    disableSortReason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Issues dataset does not yet support descending order')
  };
}

function getTableSortOptions(organization, _widgetQuery) {
  const sortOptions = [..._widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_11__.ISSUE_WIDGET_SORT_OPTIONS];

  if (organization.features.includes('issue-list-trend-sort')) {
    sortOptions.push(sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__.IssueSortOptions.TREND);
  }

  return sortOptions.map(sortOption => ({
    label: (0,sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__.getSortLabel)(sortOption),
    value: sortOption
  }));
}

function transformIssuesResponseToTable(data, widgetQuery, _organization, pageFilters) {
  sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_4__["default"].add(data);
  const transformedTableResults = [];
  data.forEach(_ref => {
    let {
      id,
      shortId,
      title,
      lifetime,
      filtered,
      count,
      userCount,
      project,
      annotations,
      ...resultProps
    } = _ref;
    const transformedResultProps = {};
    Object.keys(resultProps).filter(key => ['number', 'string'].includes(typeof resultProps[key])).forEach(key => {
      transformedResultProps[key] = resultProps[key];
    });
    const transformedTableResult = { ...transformedResultProps,
      events: count,
      users: userCount,
      id,
      'issue.id': id,
      issue: shortId,
      title,
      project: project.slug,
      links: annotations === null || annotations === void 0 ? void 0 : annotations.join(', ')
    }; // Get lifetime stats

    if (lifetime) {
      transformedTableResult.lifetimeEvents = lifetime === null || lifetime === void 0 ? void 0 : lifetime.count;
      transformedTableResult.lifetimeUsers = lifetime === null || lifetime === void 0 ? void 0 : lifetime.userCount;
    } // Get filtered stats


    if (filtered) {
      transformedTableResult.filteredEvents = filtered === null || filtered === void 0 ? void 0 : filtered.count;
      transformedTableResult.filteredUsers = filtered === null || filtered === void 0 ? void 0 : filtered.userCount;
    } // Discover Url properties


    const query = widgetQuery.conditions;
    const parsedResult = (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_2__.parseSearch)(query);
    const filteredTerms = parsedResult === null || parsedResult === void 0 ? void 0 : parsedResult.filter(p => !(p.type === sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_2__.Token.Filter && sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_7__.DISCOVER_EXCLUSION_FIELDS.includes(p.key.text)));
    transformedTableResult.discoverSearchQuery = (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_2__.joinQuery)(filteredTerms, true);
    transformedTableResult.projectId = project.id;
    const {
      period,
      start,
      end
    } = pageFilters.datetime || {};

    if (start && end) {
      transformedTableResult.start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(start);
      transformedTableResult.end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(end);
    }

    transformedTableResult.period = period !== null && period !== void 0 ? period : '';
    transformedTableResults.push(transformedTableResult);
  });
  return {
    data: transformedTableResults
  };
}

function getTableRequest(api, query, organization, pageFilters, limit, cursor) {
  var _pageFilters$projects, _pageFilters$environm;

  const groupListUrl = `/organizations/${organization.slug}/issues/`;
  const params = {
    project: (_pageFilters$projects = pageFilters.projects) !== null && _pageFilters$projects !== void 0 ? _pageFilters$projects : [],
    environment: (_pageFilters$environm = pageFilters.environments) !== null && _pageFilters$environm !== void 0 ? _pageFilters$environm : [],
    query: query.conditions,
    sort: query.orderby || DEFAULT_SORT,
    expand: DEFAULT_EXPAND,
    limit: limit !== null && limit !== void 0 ? limit : _types__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_TABLE_LIMIT,
    cursor
  };

  if (pageFilters.datetime.period) {
    params.statsPeriod = pageFilters.datetime.period;
  }

  if (pageFilters.datetime.end) {
    params.end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(pageFilters.datetime.end);
  }

  if (pageFilters.datetime.start) {
    params.start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(pageFilters.datetime.start);
  }

  if (pageFilters.datetime.utc) {
    params.utc = pageFilters.datetime.utc;
  }

  return api.requestPromise(groupListUrl, {
    includeAllArgs: true,
    method: 'GET',
    data: { ...params
    }
  });
}

/***/ }),

/***/ "./app/views/dashboardsV2/datasetConfig/releases.tsx":
/*!***********************************************************!*\
  !*** ./app/views/dashboardsV2/datasetConfig/releases.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReleasesConfig": () => (/* binding */ ReleasesConfig),
/* harmony export */   "transformSessionsResponseToSeries": () => (/* binding */ transformSessionsResponseToSeries),
/* harmony export */   "transformSessionsResponseToTable": () => (/* binding */ transformSessionsResponseToTable)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_metrics__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/metrics */ "./app/actionCreators/metrics.tsx");
/* harmony import */ var sentry_actionCreators_sessions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/sessions */ "./app/actionCreators/sessions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _widgetBuilder_buildSteps_filterResultsStep_releaseSearchBar__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar.tsx");
/* harmony import */ var _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../widgetCard/releaseWidgetQueries */ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx");
/* harmony import */ var _widgetCard_transformSessionsResponseToSeries__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../widgetCard/transformSessionsResponseToSeries */ "./app/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries.tsx");
/* harmony import */ var _widgetCard_transformSessionsResponseToTable__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../widgetCard/transformSessionsResponseToTable */ "./app/views/dashboardsV2/widgetCard/transformSessionsResponseToTable.tsx");
/* harmony import */ var _base__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");





















const DEFAULT_WIDGET_QUERY = {
  name: '',
  fields: [`crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_8__.SessionField.SESSION})`],
  columns: [],
  fieldAliases: [],
  aggregates: [`crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_8__.SessionField.SESSION})`],
  conditions: '',
  orderby: `-crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_8__.SessionField.SESSION})`
};
const METRICS_BACKED_SESSIONS_START_DATE = new Date('2022-07-12');
const ReleasesConfig = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  disableSortOptions,
  getTableRequest: (api, query, organization, pageFilters, limit, cursor) => getReleasesRequest(0, 1, api, query, organization, pageFilters, undefined, limit, cursor),
  getSeriesRequest: getReleasesSeriesRequest,
  getTableSortOptions,
  getTimeseriesSortOptions,
  filterTableOptions: filterPrimaryReleaseTableOptions,
  filterAggregateParams,
  filterYAxisAggregateParams: (_fieldValue, _displayType) => filterAggregateParams,
  filterYAxisOptions,
  getCustomFieldRenderer: (field, meta) => (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_11__.getFieldRenderer)(field, meta, false),
  SearchBar: _widgetBuilder_buildSteps_filterResultsStep_releaseSearchBar__WEBPACK_IMPORTED_MODULE_15__.ReleaseSearchBar,
  getTableFieldOptions: getReleasesTableFieldOptions,
  getGroupByFieldOptions: _organization => (0,_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.generateReleaseWidgetFieldOptions)([], _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.SESSIONS_TAGS),
  handleColumnFieldChangeOverride,
  handleOrderByReset: handleReleasesTableOrderByReset,
  filterSeriesSortOptions,
  supportedDisplayTypes: [_types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.AREA, _types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.BAR, _types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.BIG_NUMBER, _types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.LINE, _types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.TABLE, _types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.TOP_N],
  transformSeries: transformSessionsResponseToSeries,
  transformTable: transformSessionsResponseToTable
};

function disableSortOptions(widgetQuery) {
  const {
    columns
  } = widgetQuery;

  if (columns.includes('session.status')) {
    return {
      disableSort: true,
      disableSortDirection: true,
      disableSortReason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sorting currently not supported with session.status')
    };
  }

  return {
    disableSort: false,
    disableSortDirection: false
  };
}

function getTableSortOptions(_organization, widgetQuery) {
  const {
    columns,
    aggregates
  } = widgetQuery;
  const options = [];
  [...aggregates, ...columns].filter(field => !!field).filter(field => !_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.DISABLED_SORT.includes(field)).filter(field => !_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.TAG_SORT_DENY_LIST.includes(field)).forEach(field => {
    options.push({
      label: field,
      value: field
    });
  });
  return options;
}

function getTimeseriesSortOptions(_organization, widgetQuery) {
  const columnSet = new Set(widgetQuery.columns);
  const releaseFieldOptions = (0,_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.generateReleaseWidgetFieldOptions)(Object.values(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.SESSIONS_FIELDS), _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.SESSIONS_TAGS);
  const options = {};
  Object.entries(releaseFieldOptions).forEach(_ref => {
    let [key, option] = _ref;

    if (['count_healthy', 'count_errored'].includes(option.value.meta.name)) {
      return;
    }

    if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FIELD) {
      // Only allow sorting by release tag
      if (option.value.meta.name === 'release' && columnSet.has(option.value.meta.name)) {
        options[key] = option;
      }

      return;
    }

    options[key] = option;
  });
  return options;
}

function filterSeriesSortOptions(columns) {
  return option => {
    if (['count_healthy', 'count_errored'].includes(option.value.meta.name)) {
      return false;
    }

    if (option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FIELD) {
      // Only allow sorting by release tag
      return columns.has(option.value.meta.name) && option.value.meta.name === 'release';
    }

    return filterPrimaryReleaseTableOptions(option);
  };
}

function getReleasesSeriesRequest(api, widget, queryIndex, organization, pageFilters) {
  const query = widget.queries[queryIndex];
  const {
    displayType,
    limit
  } = widget;
  const {
    datetime
  } = pageFilters;
  const {
    start,
    end,
    period
  } = datetime;
  const isCustomReleaseSorting = (0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.requiresCustomReleaseSorting)(query);
  const includeTotals = query.columns.length > 0 ? 1 : 0;
  const interval = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.getWidgetInterval)(displayType, {
    start,
    end,
    period
  }, '5m', // requesting low fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
  isCustomReleaseSorting ? 'low' : undefined);
  return getReleasesRequest(1, includeTotals, api, query, organization, pageFilters, interval, limit);
}

function filterPrimaryReleaseTableOptions(option) {
  return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FIELD, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
}

function filterAggregateParams(option) {
  return option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.METRICS;
}

function filterYAxisOptions(_displayType) {
  return option => {
    return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
  };
}

function handleReleasesTableOrderByReset(widgetQuery, newFields) {
  const disableSortBy = widgetQuery.columns.includes('session.status');

  if (disableSortBy) {
    widgetQuery.orderby = '';
  }

  return (0,_base__WEBPACK_IMPORTED_MODULE_20__.handleOrderByReset)(widgetQuery, newFields);
}

function handleColumnFieldChangeOverride(widgetQuery) {
  if (widgetQuery.aggregates.length === 0) {
    // Release Health widgets require an aggregate in tables
    const defaultReleaseHealthAggregate = `crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_8__.SessionField.SESSION})`;
    widgetQuery.aggregates = [defaultReleaseHealthAggregate];
    widgetQuery.fields = widgetQuery.fields ? [...widgetQuery.fields, defaultReleaseHealthAggregate] : [defaultReleaseHealthAggregate];
  }

  return widgetQuery;
}

function getReleasesTableFieldOptions(_organization) {
  return (0,_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.generateReleaseWidgetFieldOptions)(Object.values(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.SESSIONS_FIELDS), _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.SESSIONS_TAGS);
}

function transformSessionsResponseToTable(data, widgetQuery) {
  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {
    derivedStatusFields,
    injectedFields
  } = (0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.resolveDerivedStatusFields)(widgetQuery.aggregates, widgetQuery.orderby, useSessionAPI);
  const rows = data.groups.map((group, index) => ({
    id: String(index),
    ...(0,_widgetCard_transformSessionsResponseToTable__WEBPACK_IMPORTED_MODULE_19__.mapDerivedMetricsToFields)(group.by),
    // if `sum(session)` or `count_unique(user)` are not
    // requested as a part of the payload for
    // derived status metrics through the Sessions API,
    // they are injected into the payload and need to be
    // stripped.
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_3___default()((0,_widgetCard_transformSessionsResponseToTable__WEBPACK_IMPORTED_MODULE_19__.mapDerivedMetricsToFields)(group.totals), injectedFields),
    // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`
    ...(0,_widgetCard_transformSessionsResponseToTable__WEBPACK_IMPORTED_MODULE_19__.getDerivedMetrics)(group.by, group.totals, derivedStatusFields)
  }));
  const singleRow = rows[0];
  const meta = { ...(0,_widgetCard_transformSessionsResponseToTable__WEBPACK_IMPORTED_MODULE_19__.changeObjectValuesToTypes)(lodash_omit__WEBPACK_IMPORTED_MODULE_3___default()(singleRow, 'id'))
  };
  return {
    meta,
    data: rows
  };
}
function transformSessionsResponseToSeries(data, widgetQuery) {
  if (data === null) {
    return [];
  }

  const queryAlias = widgetQuery.name;
  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {
    derivedStatusFields: requestedStatusMetrics,
    injectedFields
  } = (0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.resolveDerivedStatusFields)(widgetQuery.aggregates, widgetQuery.orderby, useSessionAPI);
  const results = [];

  if (!data.groups.length) {
    return [{
      seriesName: `(${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('no results')})`,
      data: data.intervals.map(interval => ({
        name: interval,
        value: 0
      }))
    }];
  }

  data.groups.forEach(group => {
    Object.keys(group.series).forEach(field => {
      // if `sum(session)` or `count_unique(user)` are not
      // requested as a part of the payload for
      // derived status metrics through the Sessions API,
      // they are injected into the payload and need to be
      // stripped.
      if (!!!injectedFields.includes((0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.derivedMetricsToField)(field))) {
        results.push({
          seriesName: (0,_widgetCard_transformSessionsResponseToSeries__WEBPACK_IMPORTED_MODULE_18__.getSeriesName)(field, group, queryAlias),
          data: data.intervals.map((interval, index) => {
            var _group$series$field$i;

            return {
              name: interval,
              value: (_group$series$field$i = group.series[field][index]) !== null && _group$series$field$i !== void 0 ? _group$series$field$i : 0
            };
          })
        });
      }
    }); // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`

    if (requestedStatusMetrics.length && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(group.by['session.status'])) {
      requestedStatusMetrics.forEach(status => {
        const result = status.match(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.DERIVED_STATUS_METRICS_PATTERN);

        if (result) {
          let metricField = undefined;

          if (group.by['session.status'] === result[1]) {
            if (result[2] === 'session') {
              metricField = 'sum(session)';
            } else if (result[2] === 'user') {
              metricField = 'count_unique(user)';
            }
          }

          results.push({
            seriesName: (0,_widgetCard_transformSessionsResponseToSeries__WEBPACK_IMPORTED_MODULE_18__.getSeriesName)(status, group, queryAlias),
            data: data.intervals.map((interval, index) => {
              var _group$series$metricF;

              return {
                name: interval,
                value: metricField ? (_group$series$metricF = group.series[metricField][index]) !== null && _group$series$metricF !== void 0 ? _group$series$metricF : 0 : 0
              };
            })
          });
        }
      });
    }
  });
  return results;
}

function fieldsToDerivedMetrics(field) {
  var _FIELD_TO_METRICS_EXP;

  return (_FIELD_TO_METRICS_EXP = _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.FIELD_TO_METRICS_EXPRESSION[field]) !== null && _FIELD_TO_METRICS_EXP !== void 0 ? _FIELD_TO_METRICS_EXP : field;
}

function getReleasesRequest(includeSeries, includeTotals, api, query, organization, pageFilters, interval, limit, cursor) {
  const {
    environments,
    projects,
    datetime
  } = pageFilters;
  const {
    start,
    end,
    period
  } = datetime;
  let showIncompleteDataAlert = false;

  if (start) {
    let startDate = undefined;

    if (typeof start === 'string') {
      startDate = new Date(start);
    } else {
      startDate = start;
    }

    showIncompleteDataAlert = startDate < METRICS_BACKED_SESSIONS_START_DATE;
  } else if (period) {
    const periodInDays = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_10__.statsPeriodToDays)(period);
    const current = new Date();
    const prior = new Date(new Date().setDate(current.getDate() - periodInDays));
    showIncompleteDataAlert = prior < METRICS_BACKED_SESSIONS_START_DATE;
  }

  if (showIncompleteDataAlert) {
    return Promise.reject(new Error((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Releases data is only available from Jul 12. Please retry your query with a more recent date range.')));
  } // Only time we need to use sessions API is when session.status is requested
  // as a group by.


  const useSessionAPI = query.columns.includes('session.status');
  const isCustomReleaseSorting = (0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.requiresCustomReleaseSorting)(query);
  const isDescending = query.orderby.startsWith('-');
  const rawOrderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_4___default()(query.orderby, '-');
  const unsupportedOrderby = _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';
  const columns = query.columns; // Temporary solution to support sorting on releases when querying the
  // Metrics API:
  //
  // We first request the top 50 recent releases from postgres. Note that the
  // release request is based on the project and environment selected in the
  // page filters.
  //
  // We then construct a massive OR condition and append it to any specified
  // filter condition. We also maintain an ordered array of release versions
  // to order the results returned from the metrics endpoint.
  //
  // Also note that we request a limit of 100 on the metrics endpoint, this
  // is because in a query, the limit should be applied after the results are
  // sorted based on the release version. The larger number of rows we
  // request, the more accurate our results are going to be.
  //
  // After the results are sorted, we truncate the data to the requested
  // limit. This will result in a few edge cases:
  //
  //   1. low to high sort may not show releases at the beginning of the
  //      selected period if there are more than 50 releases in the selected
  //      period.
  //
  //   2. if a recent release is not returned due to the 100 row limit
  //      imposed on the metrics query the user won't see it on the
  //      table/chart/
  //

  const {
    aggregates,
    injectedFields
  } = (0,_widgetCard_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_17__.resolveDerivedStatusFields)(query.aggregates, query.orderby, useSessionAPI);
  let requestData;
  let requester;

  if (useSessionAPI) {
    const sessionAggregates = aggregates.filter(agg => !!!Object.values(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_16__.DerivedStatusFields).includes(agg));
    requestData = {
      field: sessionAggregates,
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: columns,
      limit: undefined,
      orderBy: '',
      // Orderby not supported with session.status
      interval,
      project: projects,
      query: query.conditions,
      start,
      statsPeriod: period,
      includeAllArgs: true,
      cursor
    };
    requester = sentry_actionCreators_sessions__WEBPACK_IMPORTED_MODULE_6__.doSessionsRequest;
  } else {
    requestData = {
      field: aggregates.map(fieldsToDerivedMetrics),
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: columns.map(fieldsToDerivedMetrics),
      limit: columns.length === 0 ? 1 : isCustomReleaseSorting ? 100 : limit,
      orderBy: unsupportedOrderby ? '' : isDescending ? `-${fieldsToDerivedMetrics(rawOrderby)}` : fieldsToDerivedMetrics(rawOrderby),
      interval,
      project: projects,
      query: query.conditions,
      start,
      statsPeriod: period,
      includeAllArgs: true,
      cursor,
      includeSeries,
      includeTotals
    };
    requester = sentry_actionCreators_metrics__WEBPACK_IMPORTED_MODULE_5__.doMetricsRequest;

    if (rawOrderby && !!!unsupportedOrderby && !!!aggregates.includes(rawOrderby) && !!!columns.includes(rawOrderby)) {
      requestData.field = [...requestData.field, fieldsToDerivedMetrics(rawOrderby)];

      if (!!!injectedFields.includes(rawOrderby)) {
        injectedFields.push(rawOrderby);
      }
    }
  }

  return requester(api, requestData);
}

/***/ }),

/***/ "./app/views/dashboardsV2/utils.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/utils.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cloneDashboard": () => (/* binding */ cloneDashboard),
/* harmony export */   "constructWidgetFromQuery": () => (/* binding */ constructWidgetFromQuery),
/* harmony export */   "eventViewFromWidget": () => (/* binding */ eventViewFromWidget),
/* harmony export */   "flattenErrors": () => (/* binding */ flattenErrors),
/* harmony export */   "getCurrentPageFilters": () => (/* binding */ getCurrentPageFilters),
/* harmony export */   "getCustomMeasurementQueryParams": () => (/* binding */ getCustomMeasurementQueryParams),
/* harmony export */   "getDashboardFiltersFromURL": () => (/* binding */ getDashboardFiltersFromURL),
/* harmony export */   "getDashboardsMEPQueryParams": () => (/* binding */ getDashboardsMEPQueryParams),
/* harmony export */   "getFieldsFromEquations": () => (/* binding */ getFieldsFromEquations),
/* harmony export */   "getNumEquations": () => (/* binding */ getNumEquations),
/* harmony export */   "getSavedFiltersAsPageFilters": () => (/* binding */ getSavedFiltersAsPageFilters),
/* harmony export */   "getSavedPageFilters": () => (/* binding */ getSavedPageFilters),
/* harmony export */   "getWidgetDiscoverUrl": () => (/* binding */ getWidgetDiscoverUrl),
/* harmony export */   "getWidgetInterval": () => (/* binding */ getWidgetInterval),
/* harmony export */   "getWidgetIssueUrl": () => (/* binding */ getWidgetIssueUrl),
/* harmony export */   "getWidgetReleasesUrl": () => (/* binding */ getWidgetReleasesUrl),
/* harmony export */   "hasSavedPageFilters": () => (/* binding */ hasSavedPageFilters),
/* harmony export */   "hasUnsavedFilterChanges": () => (/* binding */ hasUnsavedFilterChanges),
/* harmony export */   "isCustomMeasurement": () => (/* binding */ isCustomMeasurement),
/* harmony export */   "isCustomMeasurementWidget": () => (/* binding */ isCustomMeasurementWidget),
/* harmony export */   "isWidgetUsingTransactionName": () => (/* binding */ isWidgetUsingTransactionName),
/* harmony export */   "miniWidget": () => (/* binding */ miniWidget),
/* harmony export */   "resetPageFilters": () => (/* binding */ resetPageFilters)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry-images/dashboard/widget-area.svg */ "./images/dashboard/widget-area.svg");
/* harmony import */ var sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry-images/dashboard/widget-bar.svg */ "./images/dashboard/widget-bar.svg");
/* harmony import */ var sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry-images/dashboard/widget-big-number.svg */ "./images/dashboard/widget-big-number.svg");
/* harmony import */ var sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry-images/dashboard/widget-line-1.svg */ "./images/dashboard/widget-line-1.svg");
/* harmony import */ var sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry-images/dashboard/widget-table.svg */ "./images/dashboard/widget-table.svg");
/* harmony import */ var sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry-images/dashboard/widget-world-map.svg */ "./images/dashboard/widget-world-map.svg");
/* harmony import */ var sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/arithmeticInput/parser */ "./app/components/arithmeticInput/parser.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");



























function cloneDashboard(dashboard) {
  return lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(dashboard);
}
function eventViewFromWidget(title, query, selection, widgetDisplayType) {
  const {
    start,
    end,
    period: statsPeriod
  } = selection.datetime;
  const {
    projects,
    environments
  } = selection; // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget

  const fields = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.columns.includes('geo.country_code') ? ['geo.country_code', ...query.columns, ...query.aggregates] : [...query.columns, ...query.aggregates];
  const conditions = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.conditions.includes('has:geo.country_code') ? `${query.conditions} has:geo.country_code`.trim() : query.conditions;
  const {
    orderby
  } = query; // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format

  const aggregateAliasOrderBy = orderby ? `${orderby.startsWith('-') ? '-' : ''}${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateAlias)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default()(orderby, '-'))}` : orderby;
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__["default"].fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: aggregateAliasOrderBy,
    projects,
    range: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start) : undefined,
    end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end) : undefined,
    environment: environments
  });
}

function coerceStringToArray(value) {
  return typeof value === 'string' ? [value] : value;
}

function constructWidgetFromQuery(query) {
  if (query) {
    const queryNames = coerceStringToArray(query.queryNames);
    const queryConditions = coerceStringToArray(query.queryConditions);
    const queryFields = coerceStringToArray(query.queryFields);
    const queries = [];

    if (queryConditions && queryNames && queryFields && typeof query.queryOrderby === 'string') {
      const {
        columns,
        aggregates
      } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getColumnsAndAggregates)(queryFields);
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames[index],
          conditions: condition,
          fields: queryFields,
          columns,
          aggregates,
          orderby: query.queryOrderby
        });
      });
    }

    if (query.title && query.displayType && query.interval && queries.length > 0) {
      const newWidget = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_7___default()(query, ['title', 'displayType', 'interval']),
        widgetType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER,
        queries
      };
      return newWidget;
    }
  }

  return undefined;
}
function miniWidget(displayType) {
  switch (displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      return sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.AREA:
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      return sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BIG_NUMBER:
      return sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TABLE:
      return sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      return sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.LINE:
    default:
      return sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__;
  }
}
function getWidgetInterval(displayType, datetimeObj, widgetInterval, fidelity) {
  // Don't fetch more than 66 bins as we're plotting on a small area.
  const MAX_BIN_COUNT = 66; // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.

  let interval = displayType === 'bar' ? '1d' : widgetInterval;

  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }

  const desiredPeriod = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(interval);
  const selectedRange = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getDiffInMinutes)(datetimeObj);

  if (fidelity) {
    // Primarily to support lower fidelity for Release Health widgets
    // the sort on releases and hit the metrics API endpoint.
    interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, fidelity);

    if (selectedRange > sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.SIX_HOURS && selectedRange <= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.TWENTY_FOUR_HOURS) {
      interval = '1h';
    }

    return displayType === 'bar' ? '1d' : interval;
  } // selectedRange is in minutes, desiredPeriod is in hours
  // convert desiredPeriod to minutes


  if (selectedRange / (desiredPeriod * 60) > MAX_BIN_COUNT) {
    const highInterval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, 'high'); // Only return high fidelity interval if desired interval is higher fidelity

    if (desiredPeriod < (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(highInterval)) {
      return highInterval;
    }
  }

  return interval;
}
function getFieldsFromEquations(fields) {
  // Gather all fields and functions used in equations and prepend them to the provided fields
  const termsSet = new Set();
  fields.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).forEach(field => {
    const parsed = (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__.parseArithmetic)((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.stripEquationPrefix)(field)).tc;
    parsed.fields.forEach(_ref => {
      let {
        term
      } = _ref;
      return termsSet.add(term);
    });
    parsed.functions.forEach(_ref2 => {
      let {
        term
      } = _ref2;
      return termsSet.add(term);
    });
  });
  return Array.from(termsSet);
}
function getWidgetDiscoverUrl(widget, selection, organization) {
  let index = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  let isMetricsData = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  const eventView = eventViewFromWidget(widget.title, widget.queries[index], selection, widget.displayType);
  const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug); // Pull a max of 3 valid Y-Axis from the widget

  const yAxisOptions = eventView.getYAxisOptions().map(_ref3 => {
    let {
      value
    } = _ref3;
    return value;
  });
  discoverLocation.query.yAxis = [...new Set(widget.queries[0].aggregates.filter(aggregate => yAxisOptions.includes(aggregate)))].slice(0, 3); // Visualization specific transforms

  switch (widget.displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.WORLDMAP;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.BAR;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.TOP5; // Last field is used as the yAxis

      const aggregates = widget.queries[0].aggregates;
      discoverLocation.query.yAxis = aggregates[aggregates.length - 1];

      if (aggregates.slice(0, -1).includes(aggregates[aggregates.length - 1])) {
        discoverLocation.query.field = aggregates.slice(0, -1);
      }

      break;

    default:
      break;
  } // Equation fields need to have their terms explicitly selected as columns in the discover table


  const fields = discoverLocation.query.field;
  const query = widget.queries[0];
  const queryFields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(query.fields) ? query.fields : [...query.columns, ...query.aggregates];
  const equationFields = getFieldsFromEquations(queryFields); // Updates fields by adding any individual terms from equation fields as a column

  equationFields.forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });

  if (isMetricsData) {
    discoverLocation.query.fromMetric = 'true';
  } // Construct and return the discover url


  const discoverPath = `${discoverLocation.pathname}?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...discoverLocation.query
  })}`;
  return discoverPath;
}
function getWidgetIssueUrl(widget, selection, organization) {
  var _widget$queries, _widget$queries$, _widget$queries2, _widget$queries2$;

  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const issuesLocation = `/organizations/${organization.slug}/issues/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({
    query: (_widget$queries = widget.queries) === null || _widget$queries === void 0 ? void 0 : (_widget$queries$ = _widget$queries[0]) === null || _widget$queries$ === void 0 ? void 0 : _widget$queries$.conditions,
    sort: (_widget$queries2 = widget.queries) === null || _widget$queries2 === void 0 ? void 0 : (_widget$queries2$ = _widget$queries2[0]) === null || _widget$queries2$ === void 0 ? void 0 : _widget$queries2$.orderby,
    ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return issuesLocation;
}
function getWidgetReleasesUrl(_widget, selection, organization) {
  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const releasesLocation = `/organizations/${organization.slug}/releases/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return releasesLocation;
}
function flattenErrors(data, update) {
  if (typeof data === 'string') {
    update.error = data;
  } else {
    Object.keys(data).forEach(key => {
      const value = data[key];

      if (typeof value === 'string') {
        update[key] = value;
        return;
      } // Recurse into nested objects.


      if (Array.isArray(value) && typeof value[0] === 'string') {
        update[key] = value[0];
        return;
      }

      if (Array.isArray(value) && typeof value[0] === 'object') {
        value.map(item => flattenErrors(item, update));
      } else {
        flattenErrors(value, update);
      }
    });
  }

  return update;
}
function getDashboardsMEPQueryParams(isMEPEnabled) {
  return isMEPEnabled ? {
    dataset: 'metricsEnhanced'
  } : {};
}
function getNumEquations(possibleEquations) {
  return possibleEquations.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).length;
}
function isCustomMeasurement(field) {
  const definedMeasurements = Object.keys((0,sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__.getMeasurements)());
  return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isMeasurement)(field) && !definedMeasurements.includes(field);
}
function isCustomMeasurementWidget(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref4 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref4;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      // Should be ok to use getAggregateArg. getAggregateArg only returns the first arg
      // but there aren't any custom measurement aggregates that use custom measurements
      // outside of the first arg.
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => isCustomMeasurement(field));
  });
}
function getCustomMeasurementQueryParams() {
  return {
    dataset: 'metrics'
  };
}
function isWidgetUsingTransactionName(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref5 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref5;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => field === 'transaction');
  });
}
function hasSavedPageFilters(dashboard) {
  return !(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboard.projects) && dashboard.environment === undefined && dashboard.start === undefined && dashboard.end === undefined && dashboard.period === undefined);
}
function hasUnsavedFilterChanges(initialDashboard, location) {
  var _location$query;

  // Use Sets to compare the filter fields that are arrays
  const savedFilters = {
    projects: new Set(initialDashboard.projects),
    environment: new Set(initialDashboard.environment),
    period: initialDashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.end),
    utc: initialDashboard.utc
  };
  let currentFilters = { ...getCurrentPageFilters(location)
  };
  currentFilters = { ...currentFilters,
    projects: new Set(currentFilters.projects),
    environment: new Set(currentFilters.environment)
  };

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.release)) {
    var _initialDashboard$fil, _location$query2;

    // Release is only included in the comparison if it exists in the query
    // params, otherwise the dashboard should be using its saved state
    savedFilters.release = new Set((_initialDashboard$fil = initialDashboard.filters) === null || _initialDashboard$fil === void 0 ? void 0 : _initialDashboard$fil.release);
    currentFilters.release = new Set((_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2.release);
  }

  return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(savedFilters, currentFilters);
}
function getSavedFiltersAsPageFilters(dashboard) {
  return {
    datetime: {
      end: dashboard.end || null,
      period: dashboard.period || null,
      start: dashboard.start || null,
      utc: null
    },
    environments: dashboard.environment || [],
    projects: dashboard.projects || []
  };
}
function getSavedPageFilters(dashboard) {
  return {
    project: dashboard.projects,
    environment: dashboard.environment,
    statsPeriod: dashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.end),
    utc: dashboard.utc
  };
}
function resetPageFilters(dashboard, location) {
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace({ ...location,
    query: getSavedPageFilters(dashboard)
  });
}
function getCurrentPageFilters(location) {
  var _location$query3;

  const {
    project,
    environment,
    statsPeriod,
    start,
    end,
    utc
  } = (_location$query3 = location.query) !== null && _location$query3 !== void 0 ? _location$query3 : {};
  return {
    // Ensure projects and environment are sent as arrays, or undefined in the request
    // location.query will return a string if there's only one value
    projects: project === undefined || project === null ? [] : typeof project === 'string' ? [Number(project)] : project.map(Number),
    environment: typeof environment === 'string' ? [environment] : environment !== null && environment !== void 0 ? environment : undefined,
    period: statsPeriod,
    start: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(start) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(start) : undefined,
    end: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(end) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(end) : undefined,
    utc: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(utc) ? utc === 'true' : undefined
  };
}
function getDashboardFiltersFromURL(location) {
  const dashboardFilters = {};
  Object.values(sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DashboardFilterKeys).forEach(key => {
    var _location$query4;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query4 = location.query) === null || _location$query4 === void 0 ? void 0 : _location$query4[key])) {
      var _location$query5;

      dashboardFilters[key] = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__.decodeList)((_location$query5 = location.query) === null || _location$query5 === void 0 ? void 0 : _location$query5[key]);
    }
  });
  return !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboardFilters) ? dashboardFilters : null;
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/buildStep.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/buildStep.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BuildStep": () => (/* binding */ BuildStep)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function BuildStep(_ref) {
  let {
    title,
    description,
    required = false,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Heading, {
      children: [title, required && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(RequiredBadge, {})]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SubHeading, {
      children: description
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Content, {
      children: children
    })]
  });
}
BuildStep.displayName = "BuildStep";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "ecpormx4"
} : 0)( true ? {
  name: "vetbs0",
  styles: "display:grid"
} : 0);

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h5',  true ? {
  target: "ecpormx3"
} : 0)("margin-bottom:0;color:", p => p.theme.gray500, ";" + ( true ? "" : 0));

const SubHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "ecpormx2"
} : 0)("color:", p => p.theme.gray300, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " 0;@media (max-width: ", p => p.theme.breakpoints.small, "){padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";}" + ( true ? "" : 0));

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecpormx1"
} : 0)("display:grid;@media (max-width: ", p => p.theme.breakpoints.small, "){margin-left:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(4), ";}" + ( true ? "" : 0));

const RequiredBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecpormx0"
} : 0)("background:", p => p.theme.red300, ";opacity:0.6;width:5px;height:5px;border-radius:5px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";display:inline-block;vertical-align:super;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar.tsx":
/*!***********************************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar.tsx ***!
  \***********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventsSearchBar": () => (/* binding */ EventsSearchBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function EventsSearchBar(_ref) {
  let {
    organization,
    pageFilters,
    onClose,
    widgetQuery
  } = _ref;
  const projectIds = pageFilters.projects;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Search, {
    searchSource: "widget_builder",
    organization: organization,
    projectIds: projectIds,
    query: widgetQuery.conditions,
    fields: [],
    onClose: onClose,
    useFormWrapper: false,
    maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_2__.MAX_QUERY_LENGTH,
    maxSearchItems: sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_4__.MAX_SEARCH_ITEMS,
    maxMenuHeight: sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_4__.MAX_MENU_HEIGHT,
    savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SavedSearchType.EVENT
  });
}
EventsSearchBar.displayName = "EventsSearchBar";

const Search = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1pc9id60"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar.tsx":
/*!***********************************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar.tsx ***!
  \***********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IssuesSearchBar": () => (/* binding */ IssuesSearchBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withIssueTags__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withIssueTags */ "./app/utils/withIssueTags.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var sentry_views_issueList_searchBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/issueList/searchBar */ "./app/views/issueList/searchBar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function IssuesSearchBarContainer(_ref) {
  let {
    tags,
    onClose,
    widgetQuery,
    organization,
    pageFilters
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();

  function tagValueLoader(key, search) {
    const orgId = organization.slug;
    const projectIds = pageFilters.projects.map(id => id.toString());
    const endpointParams = {
      start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(pageFilters.datetime.start),
      end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(pageFilters.datetime.end),
      statsPeriod: pageFilters.datetime.period
    };
    return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_1__.fetchTagValues)(api, orgId, key, search, projectIds, endpointParams);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_10__.ClassNames, {
    children: _ref2 => {
      let {
        css
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledIssueListSearchBar, {
        searchSource: "widget_builder",
        query: widgetQuery.conditions || '',
        sort: "",
        onClose: onClose,
        excludeEnvironment: true,
        supportedTags: tags,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Search for issues, status, assigned, and more'),
        tagValueLoader: tagValueLoader,
        onSidebarToggle: () => undefined,
        maxSearchItems: sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_7__.MAX_SEARCH_ITEMS,
        savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_3__.SavedSearchType.ISSUE,
        dropdownClassName: css`
            max-height: ${sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_7__.MAX_MENU_HEIGHT}px;
            overflow-y: auto;
          `
      });
    }
  });
}

IssuesSearchBarContainer.displayName = "IssuesSearchBarContainer";
const IssuesSearchBar = (0,sentry_utils_withIssueTags__WEBPACK_IMPORTED_MODULE_6__["default"])(IssuesSearchBarContainer);


const StyledIssueListSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_issueList_searchBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ewve4jj0"
} : 0)( true ? {
  name: "1hoyb5r",
  styles: "flex-grow:1;button:not([aria-label='Clear search']){display:none;}"
} : 0);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar.tsx":
/*!************************************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar.tsx ***!
  \************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReleaseSearchBar": () => (/* binding */ ReleaseSearchBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var _releaseWidget_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../../releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(`^${sentry_constants__WEBPACK_IMPORTED_MODULE_6__.NEGATION_OPERATOR}|\\${sentry_constants__WEBPACK_IMPORTED_MODULE_6__.SEARCH_WILDCARD}`, 'g');
function ReleaseSearchBar(_ref) {
  let {
    organization,
    pageFilters,
    widgetQuery,
    onClose
  } = _ref;
  const orgSlug = organization.slug;
  const projectIds = pageFilters.projects;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__["default"])();
  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */

  function prepareQuery(searchQuery) {
    return searchQuery.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
  }

  function getTagValues(tag, searchQuery) {
    if (tag.name === 'session.status') {
      return Promise.resolve(_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_11__.SESSION_STATUSES);
    }

    const projectIdStrings = projectIds === null || projectIds === void 0 ? void 0 : projectIds.map(String);
    return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_4__.fetchTagValues)(api, orgSlug, tag.key, searchQuery, projectIdStrings, undefined, true).then(tagValues => tagValues.map(_ref2 => {
      let {
        value
      } = _ref2;
      return value;
    }), () => {
      throw new Error('Unable to fetch tag values');
    });
  }

  const supportedTags = Object.values(_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_11__.SESSIONS_FILTER_TAGS).reduce((acc, key) => {
    acc[key] = {
      key,
      name: key
    };
    return acc;
  }, {});
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_emotion_react__WEBPACK_IMPORTED_MODULE_13__.ClassNames, {
    children: _ref3 => {
      let {
        css
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SearchBar, {
        onGetTagValues: lodash_memoize__WEBPACK_IMPORTED_MODULE_3___default()(getTagValues, (_ref4, searchQuery) => {
          let {
            key
          } = _ref4;
          return `${key}-${searchQuery}`;
        }),
        supportedTags: supportedTags,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Search for release version, session status, and more'),
        prepareQuery: prepareQuery,
        dropdownClassName: css`
            max-height: ${sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_10__.MAX_MENU_HEIGHT !== null && sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_10__.MAX_MENU_HEIGHT !== void 0 ? sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_10__.MAX_MENU_HEIGHT : 300}px;
            overflow-y: auto;
          `,
        onClose: onClose,
        maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_6__.MAX_QUERY_LENGTH,
        maxSearchItems: sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_10__.MAX_SEARCH_ITEMS,
        searchSource: "widget_builder",
        query: widgetQuery.conditions,
        savedSearchType: sentry_types__WEBPACK_IMPORTED_MODULE_8__.SavedSearchType.SESSION,
        hasRecentSearches: true
      });
    }
  });
}
ReleaseSearchBar.displayName = "ReleaseSearchBar";

const SearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "ei7lnmi0"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/index.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/index.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CUSTOM_EQUATION_VALUE": () => (/* binding */ CUSTOM_EQUATION_VALUE),
/* harmony export */   "SortByStep": () => (/* binding */ SortByStep)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_dashboardsV2_datasetConfig_base__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/dashboardsV2/datasetConfig/base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var _buildStep__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../buildStep */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/buildStep.tsx");
/* harmony import */ var _sortBySelectors__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./sortBySelectors */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/sortBySelectors.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const CUSTOM_EQUATION_VALUE = 'custom-equation';
function SortByStep(_ref) {
  let {
    displayType,
    onSortByChange,
    queries,
    widgetType,
    error,
    limit,
    onLimitChange,
    tags
  } = _ref;
  const datasetConfig = (0,sentry_views_dashboardsV2_datasetConfig_base__WEBPACK_IMPORTED_MODULE_10__.getDatasetConfig)(widgetType);
  let disableSort = false;
  let disableSortDirection = false;
  let disableSortReason = undefined;

  if (datasetConfig.disableSortOptions) {
    ({
      disableSort,
      disableSortDirection,
      disableSortReason
    } = datasetConfig.disableSortOptions(queries[0]));
  }

  const orderBy = queries[0].orderby;
  const strippedOrderBy = lodash_trimStart__WEBPACK_IMPORTED_MODULE_4___default()(orderBy, '-');
  const maxLimit = (0,sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_12__.getResultsLimit)(queries.length, queries[0].aggregates.length);
  const isTimeseriesChart = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.LINE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.BAR, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.AREA].includes(displayType);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (!limit) {
      return;
    }

    if (limit > maxLimit) {
      onLimitChange(maxLimit);
    }
  }, [limit, maxLimit, onLimitChange]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_buildStep__WEBPACK_IMPORTED_MODULE_13__.BuildStep, {
    title: displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.TABLE ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sort by a column') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sort by a y-axis'),
    description: displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.TABLE ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)("Choose one of the columns you've created to sort by.") : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)("Choose one of the y-axis you've created to sort by."),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
      title: disableSortReason,
      disabled: !(disableSortDirection && disableSort),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_5__["default"], {
        inline: false,
        error: error,
        flexibleControlStateSize: true,
        stacked: true,
        children: [[sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.AREA, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.BAR, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.LINE].includes(displayType) && limit && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ResultsLimitSelector, {
          disabled: disableSortDirection && disableSort,
          name: "resultsLimit",
          menuPlacement: "auto",
          options: [...Array(maxLimit).keys()].map(resultLimit => {
            const value = resultLimit + 1;
            return {
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('Limit to %s result', 'Limit to %s results', value),
              value
            };
          }),
          value: limit,
          onChange: option => {
            onLimitChange(option.value);
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_sortBySelectors__WEBPACK_IMPORTED_MODULE_14__.SortBySelectors, {
          displayType: displayType,
          widgetType: widgetType,
          hasGroupBy: isTimeseriesChart && !!queries[0].columns.length,
          disableSortReason: disableSortReason,
          disableSort: disableSort,
          disableSortDirection: disableSortDirection,
          widgetQuery: queries[0],
          values: {
            sortDirection: orderBy[0] === '-' ? sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_12__.SortDirection.HIGH_TO_LOW : sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_12__.SortDirection.LOW_TO_HIGH,
            sortBy: strippedOrderBy
          },
          onChange: _ref2 => {
            let {
              sortDirection,
              sortBy
            } = _ref2;
            const newOrderBy = sortDirection === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_12__.SortDirection.HIGH_TO_LOW ? `-${sortBy}` : sortBy;
            onSortByChange(newOrderBy);
          },
          tags: tags
        })]
      })
    })
  });
}
SortByStep.displayName = "SortByStep";

const ResultsLimitSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e14t0x3e0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/sortBySelectors.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/sortBySelectors.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SortBySelectors": () => (/* binding */ SortBySelectors)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_views_dashboardsV2_datasetConfig_base__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/dashboardsV2/datasetConfig/base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var sentry_views_eventsV2_table_arithmeticInput__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/eventsV2/table/arithmeticInput */ "./app/views/eventsV2/table/arithmeticInput.tsx");
/* harmony import */ var sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/eventsV2/table/queryField */ "./app/views/eventsV2/table/queryField.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! . */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/sortByStep/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















function SortBySelectors(_ref) {
  let {
    values,
    widgetType,
    onChange,
    disableSortReason,
    disableSort,
    disableSortDirection,
    widgetQuery,
    displayType
  } = _ref;
  const datasetConfig = (0,sentry_views_dashboardsV2_datasetConfig_base__WEBPACK_IMPORTED_MODULE_11__.getDatasetConfig)(widgetType);
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const columnSet = new Set(widgetQuery.columns);
  const [showCustomEquation, setShowCustomEquation] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [customEquation, setCustomEquation] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)({
    sortBy: `${sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.EQUATION_PREFIX}`,
    sortDirection: values.sortDirection
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const isSortingByEquation = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquation)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_3___default()(values.sortBy, '-'));

    if (isSortingByEquation) {
      setCustomEquation({
        sortBy: lodash_trimStart__WEBPACK_IMPORTED_MODULE_3___default()(values.sortBy, '-'),
        sortDirection: values.sortDirection
      });
    }

    setShowCustomEquation(isSortingByEquation);
  }, [values.sortBy, values.sortDirection]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Wrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: disableSortReason,
      disabled: !disableSortDirection || disableSortDirection && disableSort,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
        name: "sortDirection",
        "aria-label": "Sort direction",
        menuPlacement: "auto",
        disabled: disableSortDirection,
        options: Object.keys(sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_13__.sortDirections).map(value => ({
          label: sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_13__.sortDirections[value],
          value
        })),
        value: values.sortDirection,
        onChange: option => {
          onChange({
            sortBy: values.sortBy,
            sortDirection: option.value
          });
        }
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: disableSortReason,
      disabled: !disableSort || disableSortDirection && disableSort,
      children: displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_12__.DisplayType.TABLE ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
        name: "sortBy",
        "aria-label": "Sort by",
        menuPlacement: "auto",
        disabled: disableSort,
        placeholder: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Select a column')}\u{2026}`,
        value: values.sortBy,
        options: lodash_uniqBy__WEBPACK_IMPORTED_MODULE_4___default()(datasetConfig.getTableSortOptions(organization, widgetQuery), _ref2 => {
          let {
            value
          } = _ref2;
          return value;
        }),
        onChange: option => {
          onChange({
            sortBy: option.value,
            sortDirection: values.sortDirection
          });
        }
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_15__.QueryField, {
        disabled: disableSort,
        fieldValue: showCustomEquation ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.explodeField)({
          field: ___WEBPACK_IMPORTED_MODULE_16__.CUSTOM_EQUATION_VALUE
        }) : (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.explodeField)({
          field: values.sortBy
        }),
        fieldOptions: datasetConfig.getTimeseriesSortOptions(organization, widgetQuery),
        filterPrimaryOptions: datasetConfig.filterSeriesSortOptions ? datasetConfig.filterSeriesSortOptions(columnSet) : undefined,
        filterAggregateParameters: datasetConfig.filterAggregateParams,
        onChange: value => {
          if (value.alias && (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquationAlias)(value.alias)) {
            onChange({
              sortBy: value.alias,
              sortDirection: values.sortDirection
            });
            return;
          }

          const parsedValue = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.generateFieldAsString)(value);
          const isSortingByCustomEquation = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isEquation)(parsedValue);
          setShowCustomEquation(isSortingByCustomEquation);

          if (isSortingByCustomEquation) {
            onChange(customEquation);
            return;
          }

          onChange({
            sortBy: parsedValue,
            sortDirection: values.sortDirection
          });
        }
      })
    }), showCustomEquation && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(ArithmeticInputWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_eventsV2_table_arithmeticInput__WEBPACK_IMPORTED_MODULE_14__["default"], {
        name: "arithmetic",
        type: "text",
        required: true,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enter Equation'),
        value: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.getEquation)(customEquation.sortBy),
        onUpdate: value => {
          const newValue = {
            sortBy: `${sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.EQUATION_PREFIX}${value}`,
            sortDirection: values.sortDirection
          };
          onChange(newValue);
          setCustomEquation(newValue);
        },
        hideFieldOptions: true
      })
    })]
  });
}
SortBySelectors.displayName = "SortBySelectors";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1grfh1l1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:200px 1fr;}" + ( true ? "" : 0));

const ArithmeticInputWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1grfh1l0"
} : 0)( true ? {
  name: "18iuzk9",
  styles: "grid-column:1/-1"
} : 0);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/issueWidget/utils.tsx":
/*!********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/issueWidget/utils.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ISSUE_WIDGET_SORT_OPTIONS": () => (/* binding */ ISSUE_WIDGET_SORT_OPTIONS),
/* harmony export */   "generateIssueWidgetFieldOptions": () => (/* binding */ generateIssueWidgetFieldOptions),
/* harmony export */   "generateIssueWidgetOrderOptions": () => (/* binding */ generateIssueWidgetOrderOptions)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");




function generateIssueWidgetFieldOptions() {
  let issueFields = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _fields__WEBPACK_IMPORTED_MODULE_3__.ISSUE_FIELDS;
  const fieldKeys = Object.keys(issueFields).sort();
  const fieldOptions = {};
  fieldKeys.forEach(field => {
    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_1__.FieldValueKind.FIELD,
        meta: {
          name: field,
          dataType: issueFields[field]
        }
      }
    };
  });
  return fieldOptions;
}
const ISSUE_WIDGET_SORT_OPTIONS = [sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.DATE, sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.NEW, sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.FREQ, sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.PRIORITY, sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.USER];
function generateIssueWidgetOrderOptions(includeRelativeChange) {
  const sortOptions = [...ISSUE_WIDGET_SORT_OPTIONS];

  if (includeRelativeChange) {
    sortOptions.push(sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.IssueSortOptions.TREND);
  }

  return sortOptions.map(sortOption => ({
    label: (0,sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_2__.getSortLabel)(sortOption),
    value: sortOption
  }));
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetBuilder/utils.tsx":
/*!********************************************************!*\
  !*** ./app/views/dashboardsV2/widgetBuilder/utils.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_RESULTS_LIMIT": () => (/* binding */ DEFAULT_RESULTS_LIMIT),
/* harmony export */   "DataSet": () => (/* binding */ DataSet),
/* harmony export */   "MAX_MENU_HEIGHT": () => (/* binding */ MAX_MENU_HEIGHT),
/* harmony export */   "MAX_SEARCH_ITEMS": () => (/* binding */ MAX_SEARCH_ITEMS),
/* harmony export */   "NEW_DASHBOARD_ID": () => (/* binding */ NEW_DASHBOARD_ID),
/* harmony export */   "SortDirection": () => (/* binding */ SortDirection),
/* harmony export */   "displayTypes": () => (/* binding */ displayTypes),
/* harmony export */   "doNotValidateYAxis": () => (/* binding */ doNotValidateYAxis),
/* harmony export */   "filterPrimaryOptions": () => (/* binding */ filterPrimaryOptions),
/* harmony export */   "getAmendedFieldOptions": () => (/* binding */ getAmendedFieldOptions),
/* harmony export */   "getFields": () => (/* binding */ getFields),
/* harmony export */   "getIsTimeseriesChart": () => (/* binding */ getIsTimeseriesChart),
/* harmony export */   "getMetricFields": () => (/* binding */ getMetricFields),
/* harmony export */   "getParsedDefaultWidgetQuery": () => (/* binding */ getParsedDefaultWidgetQuery),
/* harmony export */   "getResultsLimit": () => (/* binding */ getResultsLimit),
/* harmony export */   "mapErrors": () => (/* binding */ mapErrors),
/* harmony export */   "normalizeQueries": () => (/* binding */ normalizeQueries),
/* harmony export */   "sortDirections": () => (/* binding */ sortDirections)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.url-search-params.js */ "../node_modules/core-js/modules/web.url-search-params.js");
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_dashboards_widgetQueriesForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/dashboards/widgetQueriesForm */ "./app/components/dashboards/widgetQueriesForm.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../utils */ "./app/views/dashboardsV2/utils.tsx");













 // Used in the widget builder to limit the number of lines plotted in the chart

const DEFAULT_RESULTS_LIMIT = 5;
const RESULTS_LIMIT = 10; // Both dashboards and widgets use the 'new' keyword when creating

const NEW_DASHBOARD_ID = 'new';
let DataSet;

(function (DataSet) {
  DataSet["EVENTS"] = "events";
  DataSet["ISSUES"] = "issues";
  DataSet["RELEASES"] = "releases";
})(DataSet || (DataSet = {}));

let SortDirection;

(function (SortDirection) {
  SortDirection["HIGH_TO_LOW"] = "high_to_low";
  SortDirection["LOW_TO_HIGH"] = "low_to_high";
})(SortDirection || (SortDirection = {}));

const sortDirections = {
  [SortDirection.HIGH_TO_LOW]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('High to low'),
  [SortDirection.LOW_TO_HIGH]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Low to high')
};
const displayTypes = {
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.AREA]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Area Chart'),
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BAR]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Bar Chart'),
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.LINE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Line Chart'),
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Table'),
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('World Map'),
  [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Big Number')
};
function mapErrors(data, update) {
  Object.keys(data).forEach(key => {
    const value = data[key];

    if (typeof value === 'string') {
      update[key] = value;
      return;
    } // Recurse into nested objects.


    if (Array.isArray(value) && typeof value[0] === 'string') {
      update[key] = value[0];
      return;
    }

    if (Array.isArray(value) && typeof value[0] === 'object') {
      update[key] = value.map(item => mapErrors(item, {}));
    } else {
      update[key] = mapErrors(value, {});
    }
  });
  return update;
}
function normalizeQueries(_ref) {
  let {
    displayType,
    queries,
    widgetType,
    widgetBuilderNewDesign = false
  } = _ref;
  const isTimeseriesChart = getIsTimeseriesChart(displayType);
  const isTabularChart = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TOP_N].includes(displayType);
  queries = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_3___default()(queries);

  if ([sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER].includes(displayType)) {
    // Some display types may only support at most 1 query.
    queries = queries.slice(0, 1);
  } else if (isTimeseriesChart) {
    // Timeseries charts supports at most 3 queries.
    queries = queries.slice(0, 3);
  }

  if (widgetBuilderNewDesign) {
    queries = queries.map(query => {
      const {
        fields = [],
        columns
      } = query;

      if (isTabularChart) {
        // If the groupBy field has values, port everything over to the columnEditCollect field.
        query.fields = [...new Set([...fields, ...columns])];
      } else {
        // If columnEditCollect has field values , port everything over to the groupBy field.
        query.fields = fields.filter(field => !columns.includes(field));
      }

      if (getIsTimeseriesChart(displayType) && !query.columns.filter(column => !!column).length) {
        // The orderby is only applicable for timeseries charts when there's a
        // grouping selected, if all fields are empty then we also reset the orderby
        query.orderby = '';
        return query;
      }

      const queryOrderBy = widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.WidgetType.RELEASE ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.stripDerivedMetricsPrefix)(queries[0].orderby) : queries[0].orderby;
      const rawOrderBy = lodash_trimStart__WEBPACK_IMPORTED_MODULE_5___default()(queryOrderBy, '-');
      const resetOrderBy = // Raw Equation from Top N only applies to timeseries
      isTabularChart && (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isEquation)(rawOrderBy) || // Not contained as tag, field, or function
      !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isEquation)(rawOrderBy) && !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isEquationAlias)(rawOrderBy) && ![...query.columns, ...query.aggregates].includes(rawOrderBy) || // Equation alias and not contained
      (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isEquationAlias)(rawOrderBy) && (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.getEquationAliasIndex)(rawOrderBy) > (0,_utils__WEBPACK_IMPORTED_MODULE_13__.getNumEquations)([...query.columns, ...query.aggregates]) - 1;
      const orderBy = !resetOrderBy && lodash_trimStart__WEBPACK_IMPORTED_MODULE_5___default()(queryOrderBy, '-') || (widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.WidgetType.ISSUE ? sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_12__.IssueSortOptions.DATE : (0,sentry_components_dashboards_widgetQueriesForm__WEBPACK_IMPORTED_MODULE_6__.generateOrderOptions)({
        widgetType: widgetType !== null && widgetType !== void 0 ? widgetType : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.WidgetType.DISCOVER,
        widgetBuilderNewDesign,
        columns: queries[0].columns,
        aggregates: queries[0].aggregates
      })[0].value); // A widget should be descending if:
      // - There is no orderby, so we're defaulting to desc
      // - Not an issues widget since issues doesn't support descending and
      //   the original ordering was descending

      const isDescending = !query.orderby || widgetType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.WidgetType.ISSUE && queryOrderBy.startsWith('-');
      query.orderby = isDescending ? `-${String(orderBy)}` : String(orderBy);
      return query;
    });
  }

  if (isTabularChart) {
    return queries;
  } // Filter out non-aggregate fields


  queries = queries.map(query => {
    let aggregates = query.aggregates;

    if (isTimeseriesChart || displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP) {
      // Filter out fields that will not generate numeric output types
      aggregates = aggregates.filter(aggregate => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isLegalYAxisType)((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateOutputType)(aggregate)));
    }

    if (isTimeseriesChart && aggregates.length && aggregates.length > 3) {
      // Timeseries charts supports at most 3 fields.
      aggregates = aggregates.slice(0, 3);
    }

    return { ...query,
      fields: aggregates.length ? aggregates : ['count()'],
      columns: widgetBuilderNewDesign && query.columns ? query.columns : [],
      aggregates: aggregates.length ? aggregates : ['count()']
    };
  });

  if (isTimeseriesChart) {
    // For timeseries widget, all queries must share identical set of fields.
    const referenceAggregates = [...queries[0].aggregates];

    queryLoop: for (const query of queries) {
      if (referenceAggregates.length >= 3) {
        break;
      }

      if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(referenceAggregates, query.aggregates)) {
        continue;
      }

      for (const aggregate of query.aggregates) {
        if (referenceAggregates.length >= 3) {
          break queryLoop;
        }

        if (!referenceAggregates.includes(aggregate)) {
          referenceAggregates.push(aggregate);
        }
      }
    }

    queries = queries.map(query => {
      return { ...query,
        columns: widgetBuilderNewDesign && query.columns ? query.columns : [],
        aggregates: referenceAggregates,
        fields: referenceAggregates
      };
    });
  }

  if ([sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER].includes(displayType)) {
    // For world map chart, cap fields of the queries to only one field.
    queries = queries.map(query => {
      return { ...query,
        fields: query.aggregates.slice(0, 1),
        aggregates: query.aggregates.slice(0, 1),
        orderby: '',
        columns: []
      };
    });
  }

  return queries;
}
function getParsedDefaultWidgetQuery() {
  let query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  // "any" was needed here because it doesn't pass in getsentry
  const urlSeachParams = new URLSearchParams(query);
  const parsedQuery = Object.fromEntries(urlSeachParams.entries());

  if (!Object.keys(parsedQuery).length) {
    return undefined;
  }

  const columns = parsedQuery.columns ? getFields(parsedQuery.columns) : [];
  const aggregates = parsedQuery.aggregates ? getFields(parsedQuery.aggregates) : [];
  const fields = [...columns, ...aggregates];
  return { ...parsedQuery,
    fields,
    columns,
    aggregates
  };
}
function getFields(fieldsString) {
  // Use a negative lookahead to avoid splitting on commas inside equation fields
  return fieldsString.split(/,(?![^(]*\))/g);
}
function getAmendedFieldOptions(_ref2) {
  let {
    measurements,
    organization,
    tags
  } = _ref2;
  return (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_11__.generateFieldOptions)({
    organization,
    tagKeys: Object.values(tags).map(_ref3 => {
      let {
        key
      } = _ref3;
      return key;
    }),
    measurementKeys: Object.values(measurements).map(_ref4 => {
      let {
        key
      } = _ref4;
      return key;
    }),
    spanOperationBreakdownKeys: sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.SPAN_OP_BREAKDOWN_FIELDS
  });
} // Extract metric names from aggregation functions present in the widget queries

function getMetricFields(queries) {
  return queries.reduce((acc, query) => {
    for (const field of [...query.aggregates, ...query.columns]) {
      var _exec;

      const fieldParameter = (_exec = /\(([^)]*)\)/.exec(field)) === null || _exec === void 0 ? void 0 : _exec[1];

      if (fieldParameter && !acc.includes(fieldParameter)) {
        acc.push(fieldParameter);
      }
    }

    return acc;
  }, []);
} // Used to limit the number of results of the "filter your results" fields dropdown

const MAX_SEARCH_ITEMS = 5; // Used to set the max height of the smartSearchBar menu

const MAX_MENU_HEIGHT = 250; // Any function/field choice for Big Number widgets is legal since the
// data source is from an endpoint that is not timeseries-based.
// The function/field choice for World Map widget will need to be numeric-like.
// Column builder for Table widget is already handled above.

function doNotValidateYAxis(displayType) {
  return displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER;
}
function filterPrimaryOptions(_ref5) {
  let {
    option,
    widgetType,
    displayType
  } = _ref5;

  if (widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.WidgetType.RELEASE) {
    if (displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE) {
      return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.FIELD, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
    }

    if (displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TOP_N) {
      return option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.TAG;
    }
  } // Only validate function names for timeseries widgets and
  // world map widgets.


  if (!doNotValidateYAxis(displayType) && option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.FUNCTION) {
    const primaryOutput = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateFunctionOutputType)(option.value.meta.name, undefined);

    if (primaryOutput) {
      // If a function returns a specific type, then validate it.
      return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.isLegalYAxisType)(primaryOutput);
    }
  }

  return [sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.FUNCTION, sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_10__.FieldValueKind.NUMERIC_METRICS].includes(option.value.kind);
}
function getResultsLimit(numQueries, numYAxes) {
  if (numQueries === 0 || numYAxes === 0) {
    return DEFAULT_RESULTS_LIMIT;
  }

  return Math.floor(RESULTS_LIMIT / (numQueries * numYAxes));
}
function getIsTimeseriesChart(displayType) {
  return [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.LINE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.AREA, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BAR].includes(displayType);
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/chart.tsx":
/*!*****************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/chart.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SLIDER_HEIGHT": () => (/* binding */ SLIDER_HEIGHT),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_simpleTableChart__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/simpleTableChart */ "./app/components/charts/simpleTableChart.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/charts/worldMapChart */ "./app/components/charts/worldMapChart.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _datasetConfig_base__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../datasetConfig/base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





























const OTHER = 'Other';
const SLIDER_HEIGHT = 60;

class WidgetCardChart extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      containerHeight: 0
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    var _this$props$widget, _nextProps$widget;

    if (this.props.widget.displayType === _types__WEBPACK_IMPORTED_MODULE_28__.DisplayType.BIG_NUMBER && nextProps.widget.displayType === _types__WEBPACK_IMPORTED_MODULE_28__.DisplayType.BIG_NUMBER && (this.props.windowWidth !== nextProps.windowWidth || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()((_this$props$widget = this.props.widget) === null || _this$props$widget === void 0 ? void 0 : _this$props$widget.layout, (_nextProps$widget = nextProps.widget) === null || _nextProps$widget === void 0 ? void 0 : _nextProps$widget.layout))) {
      return true;
    } // Widget title changes should not update the WidgetCardChart component tree


    const currentProps = { ...lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(this.props, ['windowWidth']),
      widget: { ...this.props.widget,
        title: ''
      }
    };
    nextProps = { ...lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(nextProps, ['windowWidth']),
      widget: { ...nextProps.widget,
        title: ''
      }
    };
    return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(currentProps, nextProps) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.state, nextState);
  }

  tableResultComponent(_ref) {
    let {
      loading,
      errorMessage,
      tableResults
    } = _ref;
    const {
      location,
      widget,
      organization,
      selection
    } = this.props;

    if (errorMessage) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledErrorPanel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconWarning, {
          color: "gray500",
          size: "lg"
        })
      });
    }

    if (typeof tableResults === 'undefined') {
      // Align height to other charts.
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingPlaceholder, {});
    }

    const datasetConfig = (0,_datasetConfig_base__WEBPACK_IMPORTED_MODULE_27__.getDatasetConfig)(widget.widgetType);
    return tableResults.map((result, i) => {
      var _widget$queries$i$fie, _widget$queries$i, _widget$queries$i$fie2, _widget$queries$i$fie3, _widget$queries$i2;

      const fields = (_widget$queries$i$fie = (_widget$queries$i = widget.queries[i]) === null || _widget$queries$i === void 0 ? void 0 : (_widget$queries$i$fie2 = _widget$queries$i.fields) === null || _widget$queries$i$fie2 === void 0 ? void 0 : _widget$queries$i$fie2.map(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.stripDerivedMetricsPrefix)) !== null && _widget$queries$i$fie !== void 0 ? _widget$queries$i$fie : [];
      const fieldAliases = (_widget$queries$i$fie3 = (_widget$queries$i2 = widget.queries[i]) === null || _widget$queries$i2 === void 0 ? void 0 : _widget$queries$i2.fieldAliases) !== null && _widget$queries$i$fie3 !== void 0 ? _widget$queries$i$fie3 : [];
      const eventView = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_26__.eventViewFromWidget)(widget.title, widget.queries[0], selection, widget.displayType);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledSimpleTableChart, {
        eventView: eventView,
        fieldAliases: fieldAliases,
        location: location,
        fields: fields,
        title: tableResults.length > 1 ? result.title : '',
        loading: loading,
        loader: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingPlaceholder, {}),
        metadata: result.meta,
        data: result.data,
        organization: organization,
        stickyHeaders: true,
        getCustomFieldRenderer: datasetConfig.getCustomFieldRenderer
      }, `table:${result.title}`);
    });
  }

  bigNumberComponent(_ref2) {
    let {
      loading,
      errorMessage,
      tableResults
    } = _ref2;

    if (errorMessage) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledErrorPanel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconWarning, {
          color: "gray500",
          size: "lg"
        })
      });
    }

    if (typeof tableResults === 'undefined' || loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(BigNumber, {
        children: '\u2014'
      });
    }

    const {
      containerHeight
    } = this.state;
    const {
      location,
      organization,
      widget,
      isMobile,
      expandNumbers
    } = this.props;
    const isAlias = !organization.features.includes('discover-frontend-use-events-endpoint') && widget.widgetType !== _types__WEBPACK_IMPORTED_MODULE_28__.WidgetType.RELEASE;
    return tableResults.map(result => {
      var _result$data, _tableMeta$units;

      const tableMeta = { ...result.meta
      };
      const fields = Object.keys(tableMeta);
      const field = fields[0]; // Change tableMeta for the field from integer to string since we will be rendering with toLocaleString

      const shouldExpandInteger = !!expandNumbers && tableMeta[field] === 'integer';

      if (shouldExpandInteger) {
        tableMeta[field] = 'string';
      }

      if (!field || !((_result$data = result.data) !== null && _result$data !== void 0 && _result$data.length)) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(BigNumber, {
          children: '\u2014'
        }, `big_number:${result.title}`);
      }

      const dataRow = result.data[0];
      const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_23__.getFieldFormatter)(field, tableMeta, isAlias);
      const unit = (_tableMeta$units = tableMeta.units) === null || _tableMeta$units === void 0 ? void 0 : _tableMeta$units[field];
      const rendered = fieldRenderer(shouldExpandInteger ? {
        [field]: dataRow[field].toLocaleString()
      } : dataRow, {
        location,
        organization,
        unit
      });
      const isModalWidget = !!!(widget.id || widget.tempId);

      if (!!!organization.features.includes('dashboard-grid-layout') || isModalWidget || isMobile) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(BigNumber, {
          children: rendered
        }, `big_number:${result.title}`);
      } // The font size is the container height, minus the top and bottom padding


      const fontSize = !!!expandNumbers ? containerHeight - parseInt((0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), 10) - parseInt((0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3), 10) : `max(min(8vw, 90px), ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(4)})`;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(BigNumber, {
        style: {
          fontSize,
          ...(!!expandNumbers ? {
            padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3)} 0 ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3)}`
          } : {})
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_19__["default"], {
          title: rendered,
          showOnlyOnOverflow: true,
          children: rendered
        })
      }, `big_number:${result.title}`);
    });
  }

  chartComponent(chartProps) {
    const {
      organization,
      widget
    } = this.props;
    const stacked = organization.features.includes('new-widget-builder-experience-design') && widget.queries[0].columns.length > 0;

    switch (widget.displayType) {
      case 'bar':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_8__.BarChart, { ...chartProps,
          stacked: stacked
        });

      case 'area':
      case 'top_n':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_7__.AreaChart, {
          stacked: true,
          ...chartProps
        });

      case 'world_map':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_16__.WorldMapChart, { ...chartProps
        });

      case 'line':
      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_11__.LineChart, { ...chartProps
        });
    }
  }

  render() {
    var _widget$queries$0$agg, _widget$queries$, _widget$queries$$aggr;

    const {
      theme,
      tableResults,
      timeseriesResults,
      errorMessage,
      loading,
      widget,
      organization,
      onZoom,
      legendOptions,
      expandNumbers,
      showSlider,
      noPadding,
      chartZoomOptions,
      timeseriesResultsType
    } = this.props;

    if (widget.displayType === 'table') {
      return (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_25__["default"])({
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_13__["default"], {
          loading: loading,
          reloading: loading,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingScreen, {
            loading: loading
          }), this.tableResultComponent({
            tableResults,
            loading,
            errorMessage
          })]
        }),
        fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_18__["default"], {
          height: "200px",
          testId: "skeleton-ui"
        })
      });
    }

    if (widget.displayType === 'big_number') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_13__["default"], {
        loading: loading,
        reloading: loading,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingScreen, {
          loading: loading
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(BigNumberResizeWrapper, {
          ref: el => {
            if (el !== null && !!!expandNumbers) {
              const {
                height
              } = el.getBoundingClientRect();

              if (height !== this.state.containerHeight) {
                this.setState({
                  containerHeight: height
                });
              }
            }
          },
          children: this.bigNumberComponent({
            tableResults,
            loading,
            errorMessage
          })
        })]
      });
    }

    if (errorMessage) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledErrorPanel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconWarning, {
          color: "gray500",
          size: "lg"
        })
      });
    }

    const {
      location,
      router,
      selection,
      onLegendSelectChanged
    } = this.props;
    const {
      start,
      end,
      period,
      utc
    } = selection.datetime; // Only allow height resizing for widgets that are on a dashboard

    const autoHeightResize = Boolean(organization.features.includes('dashboard-grid-layout') && (widget.id || widget.tempId));

    if (widget.displayType === 'world_map') {
      const {
        data,
        title
      } = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_15__.processTableResults)(tableResults);
      const series = [{
        seriesName: title,
        data
      }];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_13__["default"], {
        loading: loading,
        reloading: loading,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingScreen, {
          loading: loading
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartWrapper, {
          autoHeightResize: autoHeightResize,
          children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_25__["default"])({
            value: this.chartComponent({
              series,
              autoHeightResize
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_18__["default"], {
              height: "200px",
              testId: "skeleton-ui"
            })
          })
        })]
      });
    }

    const legend = {
      left: 0,
      top: 0,
      selected: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_15__.getSeriesSelection)(location),
      formatter: seriesName => {
        const arg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.getAggregateArg)(seriesName);

        if (arg !== null) {
          const slug = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.getMeasurementSlug)(arg);

          if (slug !== null) {
            seriesName = slug.toUpperCase();
          }
        }

        if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.maybeEquationAlias)(seriesName)) {
          seriesName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.stripEquationPrefix)(seriesName);
        }

        return seriesName;
      },
      ...legendOptions
    };
    const axisField = (_widget$queries$0$agg = (_widget$queries$ = widget.queries[0]) === null || _widget$queries$ === void 0 ? void 0 : (_widget$queries$$aggr = _widget$queries$.aggregates) === null || _widget$queries$$aggr === void 0 ? void 0 : _widget$queries$$aggr[0]) !== null && _widget$queries$0$agg !== void 0 ? _widget$queries$0$agg : 'count()';
    const axisLabel = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.isEquation)(axisField) ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.getEquation)(axisField) : axisField;
    const chartOptions = {
      autoHeightResize,
      grid: {
        left: 0,
        right: 4,
        top: '40px',
        bottom: showSlider ? SLIDER_HEIGHT : 0
      },
      seriesOptions: {
        showSymbol: false
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value, seriesName) => timeseriesResultsType ? (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_22__.tooltipFormatter)(value, timeseriesResultsType) : (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_22__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.aggregateOutputType)(seriesName))
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: value => timeseriesResultsType ? (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_22__.axisLabelFormatterUsingAggregateOutputType)(value, timeseriesResultsType) : (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_22__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.aggregateOutputType)(axisLabel))
        }
      }
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_9__["default"], {
      router: router,
      period: period,
      start: start,
      end: end,
      utc: utc,
      showSlider: showSlider,
      chartZoomOptions: chartZoomOptions,
      children: zoomRenderProps => {
        var _series$, _series$$data$, _series$2, _series$2$data;

        if (errorMessage) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledErrorPanel, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconWarning, {
              color: "gray500",
              size: "lg"
            })
          });
        }

        const otherRegex = new RegExp(`(?:.* : ${OTHER}$)|^${OTHER}$`);
        const shouldColorOther = timeseriesResults === null || timeseriesResults === void 0 ? void 0 : timeseriesResults.some(_ref3 => {
          let {
            seriesName
          } = _ref3;
          return seriesName && seriesName.match(otherRegex);
        });
        const colors = timeseriesResults ? theme.charts.getColorPalette(timeseriesResults.length - (shouldColorOther ? 3 : 2)) : []; // TODO(wmak): Need to change this when updating dashboards to support variable topEvents

        if (shouldColorOther) {
          colors[colors.length] = theme.chartOther;
        } // Create a list of series based on the order of the fields,


        const series = timeseriesResults ? timeseriesResults.map((values, i) => {
          let seriesName = '';

          if (values.seriesName !== undefined) {
            seriesName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.isEquation)(values.seriesName) ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_24__.getEquation)(values.seriesName) : values.seriesName;
          }

          return { ...values,
            seriesName,
            color: colors[i]
          };
        }) : [];
        const seriesStart = (_series$ = series[0]) === null || _series$ === void 0 ? void 0 : (_series$$data$ = _series$.data[0]) === null || _series$$data$ === void 0 ? void 0 : _series$$data$.name;
        const seriesEnd = (_series$2 = series[0]) === null || _series$2 === void 0 ? void 0 : (_series$2$data = _series$2.data[series[0].data.length - 1]) === null || _series$2$data === void 0 ? void 0 : _series$2$data.name;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_13__["default"], {
          loading: loading,
          reloading: loading,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(LoadingScreen, {
            loading: loading
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartWrapper, {
            autoHeightResize: autoHeightResize,
            noPadding: noPadding,
            children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_25__["default"])({
              value: this.chartComponent({ ...zoomRenderProps,
                ...chartOptions,
                // Override default datazoom behaviour for updating Global Selection Header
                ...(onZoom ? {
                  onDataZoom: (evt, chartProps) => // Need to pass seriesStart and seriesEnd to onZoom since slider zooms
                  // callback with percentage instead of datetime values. Passing seriesStart
                  // and seriesEnd allows calculating datetime values with percentage.
                  onZoom({ ...evt,
                    seriesStart,
                    seriesEnd
                  }, chartProps)
                } : {}),
                legend,
                series,
                onLegendSelectChanged
              }),
              fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_18__["default"], {
                height: "200px",
                testId: "skeleton-ui"
              })
            })
          })]
        });
      }
    });
  }

}

WidgetCardChart.displayName = "WidgetCardChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_30__.d)(WidgetCardChart));

const StyledTransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_14__["default"], { ...props,
  maskBackgroundColor: "transparent"
}),  true ? {
  target: "eb7j3e6"
} : 0)( true ? {
  name: "1vcob1d",
  styles: "display:flex;justify-content:center;align-items:center"
} : 0);

const LoadingScreen = _ref4 => {
  let {
    loading
  } = _ref4;

  if (!loading) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledTransparentLoadingMask, {
    visible: loading,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__["default"], {
      mini: true
    })
  });
};

LoadingScreen.displayName = "LoadingScreen";

const LoadingPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref5 => {
  let {
    className
  } = _ref5;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_18__["default"], {
    height: "200px",
    className: className
  });
},  true ? {
  target: "eb7j3e5"
} : 0)("background-color:", p => p.theme.surface200, ";" + ( true ? "" : 0));

const BigNumberResizeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb7j3e4"
} : 0)( true ? {
  name: "af8mp8",
  styles: "height:100%;width:100%;overflow:hidden"
} : 0);

const BigNumber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb7j3e3"
} : 0)("line-height:1;display:inline-flex;flex:1;width:100%;min-height:0;font-size:32px;color:", p => p.theme.headingColor, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3), ";*{text-align:left!important;}" + ( true ? "" : 0));

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eb7j3e2"
} : 0)(p => p.autoHeightResize && 'height: 100%;', " padding:", p => !!p.noPadding ? `0` : `0 ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(3)}`, ";" + ( true ? "" : 0));

const StyledSimpleTableChart = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_simpleTableChart__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "eb7j3e1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(1.5), ";border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";font-size:", p => p.theme.fontSizeMedium, ";box-shadow:none;" + ( true ? "" : 0));

const StyledErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eb7j3e0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_21__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx":
/*!********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DashboardsMEPConsumer": () => (/* binding */ DashboardsMEPConsumer),
/* harmony export */   "DashboardsMEPContext": () => (/* binding */ DashboardsMEPContext),
/* harmony export */   "DashboardsMEPProvider": () => (/* binding */ DashboardsMEPProvider),
/* harmony export */   "useDashboardsMEPContext": () => (/* binding */ useDashboardsMEPContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_contexts_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/contexts/utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const [_DashboardsMEPProvider, useDashboardsMEPContext, DashboardsMEPContext] = (0,sentry_utils_performance_contexts_utils__WEBPACK_IMPORTED_MODULE_2__.createDefinedContext)({
  name: 'DashboardsMEPContext'
});
const DashboardsMEPConsumer = DashboardsMEPContext.Consumer;

function DashboardsMEPProvider(_ref) {
  let {
    children
  } = _ref;
  const [isMetricsData, setIsMetricsData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined); // undefined means not initialized

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_DashboardsMEPProvider, {
    value: {
      isMetricsData,
      setIsMetricsData
    },
    children: children
  });
}

DashboardsMEPProvider.displayName = "DashboardsMEPProvider";


/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/genericWidgetQueries.tsx":
/*!********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/genericWidgetQueries.tsx ***!
  \********************************************************************/
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
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");











function getReferrer(displayType) {
  let referrer = '';

  if (displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else if (displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP) {
    referrer = 'api.dashboards.worldmapwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

class GenericWidgetQueries extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      queryFetchID: undefined,
      errorMessage: undefined,
      timeseriesResults: undefined,
      rawResults: undefined,
      tableResults: undefined,
      pageLinks: undefined,
      timeseriesResultsType: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_isMounted", false);
  }

  componentDidMount() {
    this._isMounted = true;

    if (!this.props.loading) {
      this.fetchData();
    }
  }

  componentDidUpdate(prevProps) {
    var _this$state$rawResult;

    const {
      selection,
      widget,
      cursor,
      organization,
      config,
      customDidUpdateComparator
    } = this.props; // We do not fetch data whenever the query name changes.
    // Also don't count empty fields when checking for field changes

    const [prevWidgetQueryNames, prevWidgetQueries] = prevProps.widget.queries.map(query => {
      query.aggregates = query.aggregates.filter(field => !!field);
      query.columns = query.columns.filter(field => !!field);
      return query;
    }).reduce((_ref, _ref2) => {
      let [names, queries] = _ref;
      let {
        name,
        ...rest
      } = _ref2;
      names.push(name);
      queries.push(rest);
      return [names, queries];
    }, [[], []]);
    const [widgetQueryNames, widgetQueries] = widget.queries.map(query => {
      query.aggregates = query.aggregates.filter(field => !!field && field !== 'equation|');
      query.columns = query.columns.filter(field => !!field && field !== 'equation|');
      return query;
    }).reduce((_ref3, _ref4) => {
      let [names, queries] = _ref3;
      let {
        name,
        ...rest
      } = _ref4;
      names.push(name);
      queries.push(rest);
      return [names, queries];
    }, [[], []]);

    if (customDidUpdateComparator ? customDidUpdateComparator(prevProps, this.props) : widget.limit !== prevProps.widget.limit || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(widget.displayType, prevProps.widget.displayType) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(widget.interval, prevProps.widget.interval) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(widgetQueries, prevWidgetQueries) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(this.props.dashboardFilters, prevProps.dashboardFilters) || !(0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_7__.isSelectionEqual)(selection, prevProps.selection) || cursor !== prevProps.cursor) {
      this.fetchData();
      return;
    }

    if (!this.state.loading && !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevWidgetQueryNames, widgetQueryNames) && ((_this$state$rawResult = this.state.rawResults) === null || _this$state$rawResult === void 0 ? void 0 : _this$state$rawResult.length) === widget.queries.length) {
      // If the query names has changed, then update timeseries labels
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        const timeseriesResults = widget.queries.reduce((acc, query, index) => {
          return acc.concat(config.transformSeries(prevState.rawResults[index], query, organization));
        }, []);
        return { ...prevState,
          timeseriesResults
        };
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  applyDashboardFilters(widget) {
    const {
      dashboardFilters
    } = this.props;
    let dashboardFilterConditions = '';

    if (dashboardFilters) {
      for (const [key, activeFilters] of Object.entries(dashboardFilters)) {
        if (activeFilters.length === 1) {
          dashboardFilterConditions += `${key}:${activeFilters[0]} `;
        } else if (activeFilters.length > 1) {
          dashboardFilterConditions += `${key}:[${activeFilters.join(',')}] `;
        }
      }
    }

    widget.queries.forEach(query => {
      query.conditions = query.conditions + (dashboardFilterConditions === '' ? '' : ` ${dashboardFilterConditions}`);
    });
    return widget;
  }

  async fetchTableData(queryFetchID) {
    const {
      widget: originalWidget,
      limit,
      config,
      api,
      organization,
      selection,
      cursor,
      afterFetchTableData,
      onDataFetched
    } = this.props;
    const widget = this.applyDashboardFilters(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default()(originalWidget));
    const responses = await Promise.all(widget.queries.map(query => {
      let requestLimit = limit !== null && limit !== void 0 ? limit : _types__WEBPACK_IMPORTED_MODULE_9__.DEFAULT_TABLE_LIMIT;
      let requestCreator = config.getTableRequest;

      if (widget.displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP) {
        requestLimit = undefined;
        requestCreator = config.getWorldMapRequest;
      }

      if (!requestCreator) {
        throw new Error((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('This display type is not supported by the selected dataset.'));
      }

      return requestCreator(api, query, organization, selection, requestLimit, cursor, getReferrer(widget.displayType));
    }));
    let transformedTableResults = [];
    let responsePageLinks;
    let afterTableFetchData;
    responses.forEach((_ref5, i) => {
      var _afterFetchTableData, _widget$queries$i$nam, _widget$queries$i, _ref6;

      let [data, _textstatus, resp] = _ref5;
      afterTableFetchData = (_afterFetchTableData = afterFetchTableData === null || afterFetchTableData === void 0 ? void 0 : afterFetchTableData(data, resp)) !== null && _afterFetchTableData !== void 0 ? _afterFetchTableData : {}; // Cast so we can add the title.

      const transformedData = config.transformTable(data, widget.queries[0], organization, selection);
      transformedData.title = (_widget$queries$i$nam = (_widget$queries$i = widget.queries[i]) === null || _widget$queries$i === void 0 ? void 0 : _widget$queries$i.name) !== null && _widget$queries$i$nam !== void 0 ? _widget$queries$i$nam : ''; // Overwrite the local var to work around state being stale in tests.

      transformedTableResults = [...transformedTableResults, transformedData]; // There is some inconsistency with the capitalization of "link" in response headers

      responsePageLinks = (_ref6 = (resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) || (resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('link'))) !== null && _ref6 !== void 0 ? _ref6 : undefined;
    });

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched === null || onDataFetched === void 0 ? void 0 : onDataFetched({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks,
        ...afterTableFetchData
      });
      this.setState({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks
      });
    }
  }

  async fetchSeriesData(queryFetchID) {
    var _cloneDeep, _config$getSeriesResu;

    const {
      widget: originalWidget,
      config,
      api,
      organization,
      selection,
      afterFetchSeriesData,
      onDataFetched
    } = this.props;
    const widget = this.applyDashboardFilters(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default()(originalWidget));
    const responses = await Promise.all(widget.queries.map((_query, index) => {
      return config.getSeriesRequest(api, widget, index, organization, selection, getReferrer(widget.displayType));
    }));
    const rawResultsClone = (_cloneDeep = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default()(this.state.rawResults)) !== null && _cloneDeep !== void 0 ? _cloneDeep : [];
    const transformedTimeseriesResults = [];
    responses.forEach((_ref7, requestIndex) => {
      let [data] = _ref7;
      afterFetchSeriesData === null || afterFetchSeriesData === void 0 ? void 0 : afterFetchSeriesData(data);
      rawResultsClone[requestIndex] = data;
      const transformedResult = config.transformSeries(data, widget.queries[requestIndex], organization); // When charting timeseriesData on echarts, color association to a timeseries result
      // is order sensitive, ie series at index i on the timeseries array will use color at
      // index i on the color array. This means that on multi series results, we need to make
      // sure that the order of series in our results do not change between fetches to avoid
      // coloring inconsistencies between renders.

      transformedResult.forEach((result, resultIndex) => {
        transformedTimeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });
    }); // Get series result type
    // Only used by custom measurements in errorsAndTransactions at the moment

    const timeseriesResultsType = (_config$getSeriesResu = config.getSeriesResultType) === null || _config$getSeriesResu === void 0 ? void 0 : _config$getSeriesResu.call(config, responses[0][0], widget.queries[0]);

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched === null || onDataFetched === void 0 ? void 0 : onDataFetched({
        timeseriesResults: transformedTimeseriesResults,
        timeseriesResultsType
      });
      this.setState({
        timeseriesResults: transformedTimeseriesResults,
        rawResults: rawResultsClone,
        timeseriesResultsType
      });
    }
  }

  async fetchData() {
    const {
      widget
    } = this.props;
    const queryFetchID = Symbol('queryFetchID');
    this.setState({
      loading: true,
      tableResults: undefined,
      timeseriesResults: undefined,
      errorMessage: undefined,
      queryFetchID
    });

    try {
      if ([_types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.TABLE, _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER, _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.WORLD_MAP].includes(widget.displayType)) {
        await this.fetchTableData(queryFetchID);
      } else {
        await this.fetchSeriesData(queryFetchID);
      }
    } catch (err) {
      if (this._isMounted) {
        var _err$responseJSON;

        this.setState({
          errorMessage: (err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) || (err === null || err === void 0 ? void 0 : err.message) || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('An unknown error occurred.')
        });
      }
    } finally {
      if (this._isMounted) {
        this.setState({
          loading: false
        });
      }
    }
  }

  render() {
    const {
      children
    } = this.props;
    const {
      loading,
      tableResults,
      timeseriesResults,
      errorMessage,
      pageLinks,
      timeseriesResultsType
    } = this.state;
    return children({
      loading,
      tableResults,
      timeseriesResults,
      errorMessage,
      pageLinks,
      timeseriesResultsType
    });
  }

}

GenericWidgetQueries.displayName = "GenericWidgetQueries";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GenericWidgetQueries);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/issueWidgetCard.tsx":
/*!***************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/issueWidgetCard.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IssueWidgetCard": () => (/* binding */ IssueWidgetCard)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_simpleTableChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/simpleTableChart */ "./app/components/charts/simpleTableChart.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _datasetConfig_base__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../datasetConfig/base */ "./app/views/dashboardsV2/datasetConfig/base.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../widgetBuilder/issueWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function IssueWidgetCard(_ref) {
  var _query$fieldAliases;

  let {
    organization,
    selection,
    widget,
    errorMessage,
    loading,
    transformedResults,
    location
  } = _ref;
  const datasetConfig = (0,_datasetConfig_base__WEBPACK_IMPORTED_MODULE_9__.getDatasetConfig)(_types__WEBPACK_IMPORTED_MODULE_10__.WidgetType.ISSUE);

  if (errorMessage) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconWarning, {
        color: "gray500",
        size: "lg"
      })
    });
  }

  if (loading) {
    // Align height to other charts.
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(LoadingPlaceholder, {
      height: "200px"
    });
  }

  const query = widget.queries[0];
  const queryFields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(query.fields) ? query.fields : [...query.columns, ...query.aggregates];
  const fieldAliases = (_query$fieldAliases = query.fieldAliases) !== null && _query$fieldAliases !== void 0 ? _query$fieldAliases : [];
  const eventView = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_8__.eventViewFromWidget)(widget.title, widget.queries[0], selection, widget.displayType);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledSimpleTableChart, {
    location: location,
    title: "",
    eventView: eventView,
    fields: queryFields,
    fieldAliases: fieldAliases,
    loading: loading,
    metadata: _widgetBuilder_issueWidget_fields__WEBPACK_IMPORTED_MODULE_11__.ISSUE_FIELDS,
    data: transformedResults,
    organization: organization,
    getCustomFieldRenderer: datasetConfig.getCustomFieldRenderer,
    fieldHeaderMap: datasetConfig.fieldHeaderMap,
    stickyHeaders: true
  });
}
IssueWidgetCard.displayName = "IssueWidgetCard";

const LoadingPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e11eoa721"
} : 0)("background-color:", p => p.theme.surface200, ";" + ( true ? "" : 0));

const StyledSimpleTableChart = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_simpleTableChart__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e11eoa720"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";border-bottom-left-radius:", p => p.theme.borderRadius, ";border-bottom-right-radius:", p => p.theme.borderRadius, ";font-size:", p => p.theme.fontSizeMedium, ";box-shadow:none;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/issueWidgetQueries.tsx":
/*!******************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/issueWidgetQueries.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _datasetConfig_issues__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../datasetConfig/issues */ "./app/views/dashboardsV2/datasetConfig/issues.tsx");
/* harmony import */ var _genericWidgetQueries__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./genericWidgetQueries */ "./app/views/dashboardsV2/widgetCard/genericWidgetQueries.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function IssueWidgetQueries(_ref) {
  let {
    children,
    api,
    organization,
    selection,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched
  } = _ref;
  const [memberListStoreLoaded, setMemberListStoreLoaded] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    setMemberListStoreLoaded(sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__["default"].isLoaded());
    const unlistener = sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__["default"].listen(() => {
      setMemberListStoreLoaded(sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_2__["default"].isLoaded());
    }, undefined);
    return () => unlistener();
  }, []);
  const config = _datasetConfig_issues__WEBPACK_IMPORTED_MODULE_4__.IssuesConfig;

  const afterFetchTableData = (_rawResult, response) => {
    var _response$getResponse;

    return {
      totalIssuesCount: (_response$getResponse = response === null || response === void 0 ? void 0 : response.getResponseHeader('X-Hits')) !== null && _response$getResponse !== void 0 ? _response$getResponse : undefined
    };
  };

  return (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_3__["default"])({
    value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_genericWidgetQueries__WEBPACK_IMPORTED_MODULE_5__["default"], {
      config: config,
      api: api,
      organization: organization,
      selection: selection,
      widget: widget,
      cursor: cursor,
      limit: limit,
      dashboardFilters: dashboardFilters,
      onDataFetched: onDataFetched,
      afterFetchTableData: afterFetchTableData,
      children: _ref2 => {
        let {
          loading,
          ...rest
        } = _ref2;
        return children({
          loading: loading || !memberListStoreLoaded,
          ...rest
        });
      }
    }),
    fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {})
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueWidgetQueries);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx":
/*!********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "derivedMetricsToField": () => (/* binding */ derivedMetricsToField),
/* harmony export */   "requiresCustomReleaseSorting": () => (/* binding */ requiresCustomReleaseSorting),
/* harmony export */   "resolveDerivedStatusFields": () => (/* binding */ resolveDerivedStatusFields)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var _datasetConfig_releases__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../datasetConfig/releases */ "./app/views/dashboardsV2/datasetConfig/releases.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _genericWidgetQueries__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./genericWidgetQueries */ "./app/views/dashboardsV2/widgetCard/genericWidgetQueries.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















function derivedMetricsToField(field) {
  var _METRICS_EXPRESSION_T;

  return (_METRICS_EXPRESSION_T = _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_15__.METRICS_EXPRESSION_TO_FIELD[field]) !== null && _METRICS_EXPRESSION_T !== void 0 ? _METRICS_EXPRESSION_T : field;
}

function getReleasesQuery(releases) {
  let releaseCondition = '';
  const releasesArray = [];
  releaseCondition += 'release:[' + releases[0].version;
  releasesArray.push(releases[0].version);

  for (let i = 1; i < releases.length; i++) {
    releaseCondition += ',' + releases[i].version;
    releasesArray.push(releases[i].version);
  }

  releaseCondition += ']';

  if (releases.length < 10) {
    return {
      releaseQueryString: releaseCondition,
      releasesUsed: releasesArray
    };
  }

  if (releases.length > 10 && releaseCondition.length > 1500) {
    return getReleasesQuery(releases.slice(0, -10));
  }

  return {
    releaseQueryString: releaseCondition,
    releasesUsed: releasesArray
  };
}
/**
 * Given a list of requested fields, this function returns
 * 'aggregates' which is a list of aggregate functions that
 * can be passed to either Metrics or Sessions endpoints,
 * 'derivedStatusFields' which need to be requested from the
 * Metrics endpoint and 'injectFields' which are fields not
 * requested but required to calculate the value of a derived
 * status field so will need to be stripped away in post processing.
 */


function resolveDerivedStatusFields(fields, orderby, useSessionAPI) {
  const aggregates = fields.map(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.stripDerivedMetricsPrefix);
  const derivedStatusFields = aggregates.filter(agg => Object.values(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_15__.DerivedStatusFields).includes(agg));
  const injectedFields = [];
  const rawOrderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_7___default()(orderby, '-');
  const unsupportedOrderby = _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_15__.DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

  if (rawOrderby && !!!unsupportedOrderby && !!!fields.includes(rawOrderby)) {
    if (!!!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

  if (!!!useSessionAPI) {
    return {
      aggregates,
      derivedStatusFields,
      injectedFields
    };
  }

  derivedStatusFields.forEach(field => {
    const result = field.match(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_15__.DERIVED_STATUS_METRICS_PATTERN);

    if (result) {
      if (result[2] === 'user' && !!!aggregates.includes('count_unique(user)')) {
        injectedFields.push('count_unique(user)');
        aggregates.push('count_unique(user)');
      }

      if (result[2] === 'session' && !!!aggregates.includes('sum(session)')) {
        injectedFields.push('sum(session)');
        aggregates.push('sum(session)');
      }
    }
  });
  return {
    aggregates,
    derivedStatusFields,
    injectedFields
  };
}
function requiresCustomReleaseSorting(query) {
  const useMetricsAPI = !!!query.columns.includes('session.status');
  const rawOrderby = lodash_trimStart__WEBPACK_IMPORTED_MODULE_7___default()(query.orderby, '-');
  return useMetricsAPI && rawOrderby === 'release';
}

class ReleaseWidgetQueries extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      errorMessage: undefined,
      releases: undefined
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "config", _datasetConfig_releases__WEBPACK_IMPORTED_MODULE_13__.ReleasesConfig);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_isMounted", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchReleases", async () => {
      this.setState({
        loading: true,
        errorMessage: undefined
      });
      const {
        selection,
        api,
        organization
      } = this.props;
      const {
        environments,
        projects
      } = selection;

      try {
        const releases = await api.requestPromise(`/organizations/${organization.slug}/releases/`, {
          method: 'GET',
          data: {
            sort: 'date',
            project: projects,
            per_page: 50,
            environment: environments
          }
        });

        if (!this._isMounted) {
          return;
        }

        this.setState({
          releases,
          loading: false
        });
      } catch (error) {
        if (!this._isMounted) {
          return;
        }

        const message = error.responseJSON ? error.responseJSON.error : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Error sorting by releases');
        this.setState({
          errorMessage: message,
          loading: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_8__.addErrorMessage)(message);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "customDidUpdateComparator", (prevProps, nextProps) => {
      const {
        loading,
        limit,
        widget,
        cursor,
        organization,
        selection,
        dashboardFilters
      } = nextProps;
      const ignoredWidgetProps = ['queries', 'title', 'id', 'layout', 'tempId', 'widgetType'];
      const ignoredQueryProps = ['name', 'fields', 'aggregates', 'columns'];
      return limit !== prevProps.limit || organization.slug !== prevProps.organization.slug || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(dashboardFilters, prevProps.dashboardFilters) || !(0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_9__.isSelectionEqual)(selection, prevProps.selection) || // If the widget changed (ignore unimportant fields, + queries as they are handled lower)
      !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(widget, ignoredWidgetProps), lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.widget, ignoredWidgetProps)) || // If the queries changed (ignore unimportant name, + fields as they are handled lower)
      !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(widget.queries.map(q => lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(q, ignoredQueryProps)), prevProps.widget.queries.map(q => lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(q, ignoredQueryProps))) || // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Overlay)
      !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(widget.queries.flatMap(q => {
        var _q$fields;

        return (_q$fields = q.fields) === null || _q$fields === void 0 ? void 0 : _q$fields.filter(field => !!field);
      }), prevProps.widget.queries.flatMap(q => {
        var _q$fields2;

        return (_q$fields2 = q.fields) === null || _q$fields2 === void 0 ? void 0 : _q$fields2.filter(field => !!field);
      })) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate)), prevProps.widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate))) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(widget.queries.flatMap(q => q.columns.filter(column => !!column)), prevProps.widget.queries.flatMap(q => q.columns.filter(column => !!column))) || loading !== prevProps.loading || cursor !== prevProps.cursor;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "transformWidget", initialWidget => {
      const {
        releases
      } = this.state;
      const widget = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(initialWidget);
      const isCustomReleaseSorting = requiresCustomReleaseSorting(widget.queries[0]);
      const isDescending = widget.queries[0].orderby.startsWith('-');
      const useSessionAPI = widget.queries[0].columns.includes('session.status');
      let releaseCondition = '';
      const releasesArray = [];

      if (isCustomReleaseSorting) {
        if (releases && releases.length === 1) {
          releaseCondition += `release:${releases[0].version}`;
          releasesArray.push(releases[0].version);
        }

        if (releases && releases.length > 1) {
          const {
            releaseQueryString,
            releasesUsed
          } = getReleasesQuery(releases);
          releaseCondition += releaseQueryString;
          releasesArray.push(...releasesUsed);

          if (!!!isDescending) {
            releasesArray.reverse();
          }
        }
      }

      if (!useSessionAPI) {
        widget.queries.forEach(query => {
          query.conditions = query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`);
        });
      }

      return widget;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "afterFetchData", data => {
      const {
        widget
      } = this.props;
      const {
        releases
      } = this.state;
      const isDescending = widget.queries[0].orderby.startsWith('-');
      const releasesArray = [];

      if (requiresCustomReleaseSorting(widget.queries[0])) {
        if (releases && releases.length === 1) {
          releasesArray.push(releases[0].version);
        }

        if (releases && releases.length > 1) {
          const {
            releasesUsed
          } = getReleasesQuery(releases);
          releasesArray.push(...releasesUsed);

          if (!!!isDescending) {
            releasesArray.reverse();
          }
        }
      }

      if (releasesArray.length) {
        data.groups.sort(function (group1, group2) {
          const release1 = group1.by.release;
          const release2 = group2.by.release;
          return releasesArray.indexOf(release1) - releasesArray.indexOf(release2);
        });
        data.groups = data.groups.slice(0, this.limit);
      }
    });
  }

  componentDidMount() {
    this._isMounted = true;

    if (requiresCustomReleaseSorting(this.props.widget.queries[0])) {
      this.fetchReleases();
      return;
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  get limit() {
    const {
      limit
    } = this.props;

    switch (this.props.widget.displayType) {
      case _types__WEBPACK_IMPORTED_MODULE_14__.DisplayType.TOP_N:
        return sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_12__.TOP_N;

      case _types__WEBPACK_IMPORTED_MODULE_14__.DisplayType.TABLE:
        return limit !== null && limit !== void 0 ? limit : _types__WEBPACK_IMPORTED_MODULE_14__.DEFAULT_TABLE_LIMIT;

      case _types__WEBPACK_IMPORTED_MODULE_14__.DisplayType.BIG_NUMBER:
        return 1;

      default:
        return limit !== null && limit !== void 0 ? limit : 20;
      // TODO(dam): Can be changed to undefined once [INGEST-1079] is resolved
    }
  }

  render() {
    const {
      api,
      children,
      organization,
      selection,
      widget,
      cursor,
      dashboardFilters,
      onDataFetched
    } = this.props;
    const config = _datasetConfig_releases__WEBPACK_IMPORTED_MODULE_13__.ReleasesConfig;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_genericWidgetQueries__WEBPACK_IMPORTED_MODULE_16__["default"], {
      config: config,
      api: api,
      organization: organization,
      selection: selection,
      widget: this.transformWidget(widget),
      dashboardFilters: dashboardFilters,
      cursor: cursor,
      limit: this.limit,
      onDataFetched: onDataFetched,
      loading: requiresCustomReleaseSorting(widget.queries[0]) ? !this.state.releases : undefined,
      customDidUpdateComparator: this.customDidUpdateComparator,
      afterFetchTableData: this.afterFetchData,
      afterFetchSeriesData: this.afterFetchData,
      children: _ref => {
        var _this$state$errorMess;

        let {
          errorMessage,
          ...rest
        } = _ref;
        return children({
          errorMessage: (_this$state$errorMess = this.state.errorMessage) !== null && _this$state$errorMess !== void 0 ? _this$state$errorMess : errorMessage,
          ...rest
        });
      }
    });
  }

}

ReleaseWidgetQueries.displayName = "ReleaseWidgetQueries";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseWidgetQueries);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getSeriesName": () => (/* binding */ getSeriesName),
/* harmony export */   "transformSessionsResponseToSeries": () => (/* binding */ transformSessionsResponseToSeries)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./releaseWidgetQueries */ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx");






function getSeriesName(field, group, queryAlias) {
  const groupName = Object.entries(group.by).map(_ref => {
    let [_, value] = _ref;
    return `${value}`;
  }).join(', ');
  const seriesName = groupName ? `${groupName} : ${(0,_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__.derivedMetricsToField)(field)}` : (0,_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__.derivedMetricsToField)(field);
  return `${queryAlias ? `${queryAlias} > ` : ''}${seriesName}`;
}
function transformSessionsResponseToSeries(response, requestedStatusMetrics, injectedFields, queryAlias) {
  if (response === null) {
    return [];
  }

  const results = [];

  if (!response.groups.length) {
    return [{
      seriesName: `(${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('no results')})`,
      data: response.intervals.map(interval => ({
        name: interval,
        value: 0
      }))
    }];
  }

  response.groups.forEach(group => {
    Object.keys(group.series).forEach(field => {
      // if `sum(session)` or `count_unique(user)` are not
      // requested as a part of the payload for
      // derived status metrics through the Sessions API,
      // they are injected into the payload and need to be
      // stripped.
      if (!!!injectedFields.includes((0,_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__.derivedMetricsToField)(field))) {
        results.push({
          seriesName: getSeriesName(field, group, queryAlias),
          data: response.intervals.map((interval, index) => {
            var _group$series$field$i;

            return {
              name: interval,
              value: (_group$series$field$i = group.series[field][index]) !== null && _group$series$field$i !== void 0 ? _group$series$field$i : 0
            };
          })
        });
      }
    }); // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`

    if (requestedStatusMetrics.length && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_3__.defined)(group.by['session.status'])) {
      requestedStatusMetrics.forEach(status => {
        const result = status.match(_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_4__.DERIVED_STATUS_METRICS_PATTERN);

        if (result) {
          let metricField = undefined;

          if (group.by['session.status'] === result[1]) {
            if (result[2] === 'session') {
              metricField = 'sum(session)';
            } else if (result[2] === 'user') {
              metricField = 'count_unique(user)';
            }
          }

          results.push({
            seriesName: getSeriesName(status, group, queryAlias),
            data: response.intervals.map((interval, index) => {
              var _group$series$metricF;

              return {
                name: interval,
                value: metricField ? (_group$series$metricF = group.series[metricField][index]) !== null && _group$series$metricF !== void 0 ? _group$series$metricF : 0 : 0
              };
            })
          });
        }
      });
    }
  });
  return results;
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/transformSessionsResponseToTable.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/transformSessionsResponseToTable.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "changeObjectValuesToTypes": () => (/* binding */ changeObjectValuesToTypes),
/* harmony export */   "getDerivedMetrics": () => (/* binding */ getDerivedMetrics),
/* harmony export */   "mapDerivedMetricsToFields": () => (/* binding */ mapDerivedMetricsToFields),
/* harmony export */   "transformSessionsResponseToTable": () => (/* binding */ transformSessionsResponseToTable)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var _releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./releaseWidgetQueries */ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx");






function changeObjectValuesToTypes(obj) {
  return Object.keys(obj !== null && obj !== void 0 ? obj : {}).reduce((acc, key) => {
    acc[key] = sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_4__.SESSIONS_TAGS.includes(key) ? 'string' : (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_3__.aggregateOutputType)(key);
    return acc;
  }, {});
}
function mapDerivedMetricsToFields(results) {
  const mappedResults = {};

  for (const [key, value] of Object.entries(results)) {
    mappedResults[(0,_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_5__.derivedMetricsToField)(key)] = value;
  }

  return mappedResults;
}
function getDerivedMetrics(groupBy, totals, requestedStatusMetrics) {
  const derivedTotals = {};

  if (!requestedStatusMetrics.length) {
    return derivedTotals;
  }

  if (groupBy['session.status'] === undefined) {
    return derivedTotals;
  }

  requestedStatusMetrics.forEach(status => {
    const result = status.match(sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_4__.DERIVED_STATUS_METRICS_PATTERN);

    if (result) {
      if (groupBy['session.status'] === result[1]) {
        if (result[2] === 'session') {
          derivedTotals[status] = totals['sum(session)'];
        } else if (result[2] === 'user') {
          derivedTotals[status] = totals['count_unique(user)'];
        }
      } else {
        derivedTotals[status] = 0;
      }
    }
  });
  return derivedTotals;
}
function transformSessionsResponseToTable(response, requestedStatusMetrics, injectedFields) {
  var _response$groups$map;

  const data = (_response$groups$map = response === null || response === void 0 ? void 0 : response.groups.map((group, index) => ({
    id: String(index),
    ...mapDerivedMetricsToFields(group.by),
    // if `sum(session)` or `count_unique(user)` are not
    // requested as a part of the payload for
    // derived status metrics through the Sessions API,
    // they are injected into the payload and need to be
    // stripped.
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(mapDerivedMetricsToFields(group.totals), injectedFields),
    // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`
    ...getDerivedMetrics(group.by, group.totals, requestedStatusMetrics)
  }))) !== null && _response$groups$map !== void 0 ? _response$groups$map : [];
  const singleRow = data[0]; // TODO(metrics): these should come from the API in the future

  const meta = { ...changeObjectValuesToTypes(lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(singleRow, 'id'))
  };
  return {
    meta,
    data
  };
}

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/widgetCardChartContainer.tsx":
/*!************************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/widgetCardChartContainer.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetCardChartContainer": () => (/* binding */ WidgetCardChartContainer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _chart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./chart */ "./app/views/dashboardsV2/widgetCard/chart.tsx");
/* harmony import */ var _issueWidgetCard__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./issueWidgetCard */ "./app/views/dashboardsV2/widgetCard/issueWidgetCard.tsx");
/* harmony import */ var _issueWidgetQueries__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./issueWidgetQueries */ "./app/views/dashboardsV2/widgetCard/issueWidgetQueries.tsx");
/* harmony import */ var _releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./releaseWidgetQueries */ "./app/views/dashboardsV2/widgetCard/releaseWidgetQueries.tsx");
/* harmony import */ var _widgetQueries__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./widgetQueries */ "./app/views/dashboardsV2/widgetCard/widgetQueries.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports












function WidgetCardChartContainer(_ref) {
  let {
    location,
    router,
    api,
    organization,
    selection,
    widget,
    dashboardFilters,
    isMobile,
    renderErrorMessage,
    tableItemLimit,
    windowWidth,
    onZoom,
    onLegendSelectChanged,
    legendOptions,
    expandNumbers,
    onDataFetched,
    showSlider,
    noPadding,
    chartZoomOptions
  } = _ref;

  if (widget.widgetType === _types__WEBPACK_IMPORTED_MODULE_5__.WidgetType.ISSUE) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_issueWidgetQueries__WEBPACK_IMPORTED_MODULE_8__["default"], {
      api: api,
      organization: organization,
      widget: widget,
      selection: selection,
      limit: tableItemLimit,
      onDataFetched: onDataFetched,
      dashboardFilters: dashboardFilters,
      children: _ref2 => {
        var _tableResults$0$data;

        let {
          tableResults,
          errorMessage,
          loading
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [typeof renderErrorMessage === 'function' ? renderErrorMessage(errorMessage) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(LoadingScreen, {
            loading: loading
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_issueWidgetCard__WEBPACK_IMPORTED_MODULE_7__.IssueWidgetCard, {
            transformedResults: (_tableResults$0$data = tableResults === null || tableResults === void 0 ? void 0 : tableResults[0].data) !== null && _tableResults$0$data !== void 0 ? _tableResults$0$data : [],
            loading: loading,
            errorMessage: errorMessage,
            widget: widget,
            organization: organization,
            location: location,
            selection: selection
          })]
        });
      }
    });
  }

  if (widget.widgetType === _types__WEBPACK_IMPORTED_MODULE_5__.WidgetType.RELEASE) {
    var _widget$limit;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_releaseWidgetQueries__WEBPACK_IMPORTED_MODULE_9__["default"], {
      api: api,
      organization: organization,
      widget: widget,
      selection: selection,
      limit: (_widget$limit = widget.limit) !== null && _widget$limit !== void 0 ? _widget$limit : tableItemLimit,
      onDataFetched: onDataFetched,
      dashboardFilters: dashboardFilters,
      children: _ref3 => {
        let {
          tableResults,
          timeseriesResults,
          errorMessage,
          loading
        } = _ref3;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [typeof renderErrorMessage === 'function' ? renderErrorMessage(errorMessage) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_chart__WEBPACK_IMPORTED_MODULE_6__["default"], {
            timeseriesResults: timeseriesResults,
            tableResults: tableResults,
            errorMessage: errorMessage,
            loading: loading,
            location: location,
            widget: widget,
            selection: selection,
            router: router,
            organization: organization,
            isMobile: isMobile,
            windowWidth: windowWidth,
            expandNumbers: expandNumbers,
            onZoom: onZoom,
            showSlider: showSlider,
            noPadding: noPadding,
            chartZoomOptions: chartZoomOptions
          })]
        });
      }
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_widgetQueries__WEBPACK_IMPORTED_MODULE_10__["default"], {
    api: api,
    organization: organization,
    widget: widget,
    selection: selection,
    limit: tableItemLimit,
    onDataFetched: onDataFetched,
    dashboardFilters: dashboardFilters,
    children: _ref4 => {
      let {
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsType
      } = _ref4;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [typeof renderErrorMessage === 'function' ? renderErrorMessage(errorMessage) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_chart__WEBPACK_IMPORTED_MODULE_6__["default"], {
          timeseriesResults: timeseriesResults,
          tableResults: tableResults,
          errorMessage: errorMessage,
          loading: loading,
          location: location,
          widget: widget,
          selection: selection,
          router: router,
          organization: organization,
          isMobile: isMobile,
          windowWidth: windowWidth,
          onZoom: onZoom,
          onLegendSelectChanged: onLegendSelectChanged,
          legendOptions: legendOptions,
          expandNumbers: expandNumbers,
          showSlider: showSlider,
          noPadding: noPadding,
          chartZoomOptions: chartZoomOptions,
          timeseriesResultsType: timeseriesResultsType
        })]
      });
    }
  });
}
WidgetCardChartContainer.displayName = "WidgetCardChartContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(WidgetCardChartContainer));

const StyledTransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
  maskBackgroundColor: "transparent"
}),  true ? {
  target: "e14ay5ol0"
} : 0)( true ? {
  name: "1vcob1d",
  styles: "display:flex;justify-content:center;align-items:center"
} : 0);

const LoadingScreen = _ref5 => {
  let {
    loading
  } = _ref5;

  if (!loading) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledTransparentLoadingMask, {
    visible: loading,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {
      mini: true
    })
  });
};

LoadingScreen.displayName = "LoadingScreen";

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/widgetQueries.tsx":
/*!*************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/widgetQueries.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "flattenMultiSeriesDataWithGrouping": () => (/* binding */ flattenMultiSeriesDataWithGrouping),
/* harmony export */   "getIsMetricsDataFromSeriesResponse": () => (/* binding */ getIsMetricsDataFromSeriesResponse),
/* harmony export */   "transformSeries": () => (/* binding */ transformSeries)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _datasetConfig_errorsAndTransactions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../datasetConfig/errorsAndTransactions */ "./app/views/dashboardsV2/datasetConfig/errorsAndTransactions.tsx");
/* harmony import */ var _dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./dashboardsMEPContext */ "./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx");
/* harmony import */ var _genericWidgetQueries__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./genericWidgetQueries */ "./app/views/dashboardsV2/widgetCard/genericWidgetQueries.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function transformSeries(stats, seriesName, field) {
  var _stats$meta, _stats$meta$units, _ref, _DURATION_UNITS$unit, _stats$data$map, _stats$data;

  const unit = (_stats$meta = stats.meta) === null || _stats$meta === void 0 ? void 0 : (_stats$meta$units = _stats$meta.units) === null || _stats$meta$units === void 0 ? void 0 : _stats$meta$units[(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.getAggregateAlias)(field)]; // Scale series values to milliseconds or bytes depending on units from meta

  const scale = (_ref = unit && ((_DURATION_UNITS$unit = sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_5__.DURATION_UNITS[unit]) !== null && _DURATION_UNITS$unit !== void 0 ? _DURATION_UNITS$unit : sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_5__.SIZE_UNITS[unit])) !== null && _ref !== void 0 ? _ref : 1;
  return {
    seriesName,
    data: (_stats$data$map = stats === null || stats === void 0 ? void 0 : (_stats$data = stats.data) === null || _stats$data === void 0 ? void 0 : _stats$data.map(_ref2 => {
      let [timestamp, counts] = _ref2;
      return {
        name: timestamp * 1000,
        value: counts.reduce((acc, _ref3) => {
          let {
            count
          } = _ref3;
          return acc + count;
        }, 0) * scale
      };
    })) !== null && _stats$data$map !== void 0 ? _stats$data$map : []
  };
}
/**
 * Multiseries data with a grouping needs to be "flattened" because the aggregate data
 * are stored under the group names. These names need to be combined with the aggregate
 * names to show a series.
 *
 * e.g. count() and count_unique() grouped by environment
 * {
 *    "local": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    },
 *    "prod": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    }
 * }
 */

function flattenMultiSeriesDataWithGrouping(result, queryAlias) {
  const seriesWithOrdering = [];
  const groupNames = Object.keys(result);
  groupNames.forEach(groupName => {
    // Each group contains an order key which we should ignore
    const aggregateNames = Object.keys(lodash_omit__WEBPACK_IMPORTED_MODULE_3___default()(result[groupName], 'order'));
    aggregateNames.forEach(aggregate => {
      const seriesName = `${groupName} : ${aggregate}`;
      const prefixedName = queryAlias ? `${queryAlias} > ${seriesName}` : seriesName;
      const seriesData = result[groupName][aggregate];
      seriesWithOrdering.push([result[groupName].order || 0, transformSeries(seriesData, prefixedName, seriesName)]);
    });
  });
  return seriesWithOrdering;
}
function getIsMetricsDataFromSeriesResponse(result) {
  const multiIsMetricsData = Object.values(result).map(_ref4 => {
    let {
      isMetricsData
    } = _ref4;
    return isMetricsData;
  }) // One non-metrics series will cause all of them to be marked as such
  .reduce((acc, value) => acc === false ? false : value, undefined);
  return (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.isMultiSeriesStats)(result) ? multiIsMetricsData : result.isMetricsData;
}

function WidgetQueries(_ref5) {
  let {
    api,
    children,
    organization,
    selection,
    widget,
    dashboardFilters,
    cursor,
    limit,
    onDataFetched
  } = _ref5;
  const config = _datasetConfig_errorsAndTransactions__WEBPACK_IMPORTED_MODULE_7__.ErrorsAndTransactionsConfig;
  const context = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_8__.DashboardsMEPContext);
  let setIsMetricsData;

  if (context) {
    setIsMetricsData = context.setIsMetricsData;
  }

  const isSeriesMetricsDataResults = [];

  const afterFetchSeriesData = rawResults => {
    var _setIsMetricsData;

    if (rawResults.data) {
      rawResults = rawResults;

      if (rawResults.isMetricsData !== undefined) {
        isSeriesMetricsDataResults.push(rawResults.isMetricsData);
      }
    } else {
      Object.keys(rawResults).forEach(key => {
        const rawResult = rawResults[key];

        if (rawResult.isMetricsData !== undefined) {
          isSeriesMetricsDataResults.push(rawResult.isMetricsData);
        }
      });
    } // If one of the queries is sampled, then mark the whole thing as sampled


    (_setIsMetricsData = setIsMetricsData) === null || _setIsMetricsData === void 0 ? void 0 : _setIsMetricsData(!isSeriesMetricsDataResults.includes(false));
  };

  const isTableMetricsDataResults = [];

  const afterFetchTableData = rawResults => {
    var _rawResults$meta, _setIsMetricsData2;

    if (((_rawResults$meta = rawResults.meta) === null || _rawResults$meta === void 0 ? void 0 : _rawResults$meta.isMetricsData) !== undefined) {
      isTableMetricsDataResults.push(rawResults.meta.isMetricsData);
    } // If one of the queries is sampled, then mark the whole thing as sampled


    (_setIsMetricsData2 = setIsMetricsData) === null || _setIsMetricsData2 === void 0 ? void 0 : _setIsMetricsData2(!isTableMetricsDataResults.includes(false));
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_genericWidgetQueries__WEBPACK_IMPORTED_MODULE_9__["default"], {
    config: config,
    api: api,
    organization: organization,
    selection: selection,
    widget: widget,
    cursor: cursor,
    limit: limit,
    dashboardFilters: dashboardFilters,
    onDataFetched: onDataFetched,
    afterFetchSeriesData: afterFetchSeriesData,
    afterFetchTableData: afterFetchTableData,
    children: children
  });
}

WidgetQueries.displayName = "WidgetQueries";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetQueries);

/***/ }),

/***/ "./images/dashboard/widget-area.svg":
/*!******************************************!*\
  !*** ./images/dashboard/widget-area.svg ***!
  \******************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTExLjI2MiA1NS42N2wtMS42MjguNjRhMSAxIDAgMDAtLjYzNC45M1Y3My41aDE0MVY0OS40NmExIDEgMCAwMC0xLjYxNC0uNzlsLTEuNDAzIDEuMDkxYTEuMDE1IDEuMDE1IDAgMDEtLjIyNC4xMzJsLTIuMTguOTI1YTEgMSAwIDAxLS45NjgtLjEwNGwtMi4xMjgtMS41MDRhLjk5OC45OTggMCAwMC0uNTE0LS4xODJsLTIuNTMxLS4xNTktMi4xMTYuMTMzYTEuMDAxIDEuMDAxIDAgMDEtLjk3OS0uNTk2bC0yLjI1Mi01LjEyOGExIDEgMCAwMC0uOTc4LS41OTZsLTIuMTE3LjEzMy0yLjgxMy4wNDQtMi4wMzMuMTZhMSAxIDAgMDEtMS4wMjgtLjY4M2wtMi40NzktNy40NzVhMSAxIDAgMDAtLjMwMi0uNDQ4bC0yLjMxNi0xLjk2NGExLjAwMyAxLjAwMyAwIDAxLS4zNDEtLjYxbC0xLjU3NC0xMC4xODVjLS4xNzktMS4xNTktMS44NjItMS4xMTctMS45ODMuMDVsLTEuOTYxIDE4Ljg4MWExIDEgMCAwMS0uNDkzLjc2MmwtMi4wODIgMS4yMWEuOTk4Ljk5OCAwIDAxLS42MjcuMTI3bC0xLjc4NC0uMjI0YTEgMSAwIDAwLTEuMDE0LjUzNWwtMi4wMDIgMy44OTlhMSAxIDAgMDEtMS40MTIuMzk2bC0xLjUyMS0uOTMyYTEgMSAwIDAwLS43OTQtLjExbC0yLjE1Ny42MWEuOTk5Ljk5OSAwIDAwLS40MTQuMjM1bC0yLjYzNiAyLjQ4My0yLjU3MiAxLjk4YTEgMSAwIDAxLS41NDcuMjA1bC0yLjM2LjE0OGExIDEgMCAwMS0uMjkzLS4wMjRsLTIuMDE3LS40NzVhMSAxIDAgMDEtLjc1OC0uODE2bC0yLjcwOS0xNi45NzItMS40MTQtNS41NTRjLS4yNzYtMS4wODQtMS44NTMtLjk2Ni0xLjk2NC4xNDdsLTIuMDQgMjAuMzgxYTEgMSAwIDAxLTEuNjk5LjYxMWwtLjkzLS45MmExIDEgMCAwMC0uOTMzLS4yNjNsLTIuMjc1LjUzNi0yLjgxNC4zNTQtMi40NDUuMDc2YTEgMSAwIDAxLS42NTctLjIxOWwtMS43OTgtMS40NGExIDEgMCAwMC0xLjM2LjEwMmwtMi4wMyAyLjIwMWExIDEgMCAwMS0uMzU3LjI0OGwtMi4xODcuODkzYTEgMSAwIDAxLS44MjgtLjAzM2wtMi4yMzItMS4xMjJhMSAxIDAgMDAtLjM3LS4xMDNsLTIuNDQ4LS4xOTJhMS4wMDEgMS4wMDEgMCAwMC0uMzM3LjAzbC0xLjU3Ny40MjJhMSAxIDAgMDEtMS4yNDUtLjgxbC0xLjUwNy05LjQ2Yy0uMTc4LTEuMTE0LTEuNzc3LTEuMTI4LTEuOTczLS4wMTdsLTEuODMzIDEwLjM5MWExIDEgMCAwMS0uOTUzLjgyNmwtMS44MDMuMDU3YTEgMSAwIDAxLS4zODQtLjA2NGwtMi40MjctLjkxNWEuOTk5Ljk5OSAwIDAwLS40MTYtLjA2MmwtMi41MDUuMTU3YTEuMDAyIDEuMDAyIDAgMDEtLjE4OC0uMDA2bC0yLjU1LS4zMmExIDEgMCAwMS0uMzI0LS4wOTlsLTIuMTU2LTEuMDg0YTEgMSAwIDAwLS45ODEuMDQ3bC0yLjI0NiAxLjQxYTEgMSAwIDAxLS4xOTIuMDk0bC0yLjcxMy45OC0yLjYzNS43ODdhLjk5OS45OTkgMCAwMS0uMzY0LjAzOGwtMi4zMTEtLjE4MWExIDEgMCAwMS0uNTYyLS4yMjhsLTIuNDgtMi4wNjRhMS4wMDYgMS4wMDYgMCAwMC0uMTk0LS4xMjdsLTMuMTc4LTEuNTc3YTEgMSAwIDAwLTEuNDM2Ljc3bC0uODM0IDYuNTQ3YTEgMSAwIDAxLS42MjcuODA0eiIgZmlsbD0iIzdBNTA4OCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-bar.svg":
/*!*****************************************!*\
  !*** ./images/dashboard/widget-bar.svg ***!
  \*****************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iI0I4NTU4NiIgZD0iTTE0MCA1MmgtOHYyMmg4ek0xMTggMzRoLTh2NDBoOHpNOTYgNDhoLTh2MjZoOHpNNzQgNDVoLTh2MjloOHpNNTIgMzRoLTh2NDBoOHpNMzAgNDVoLTh2MjloOHpNMTI5IDQ1aC04djI5aDh6TTE1MSAzOWgtOHYzNWg4ek0xMDcgMzloLTh2MzVoOHpNODUgMzloLTh2MzVoOHpNNjMgMzRoLTh2NDBoOHpNNDEgMjZoLTh2NDhoOHpNMTkgNTJoLTh2MjJoOHoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-big-number.svg":
/*!************************************************!*\
  !*** ./images/dashboard/widget-big-number.svg ***!
  \************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjQ2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djQ0SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzLjV2NDJIMTU4VjN6TTIuNSAydjQ0SDE1OVYySDIuNXoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iIzQ0NDY3NCIgZD0iTTkgMTloNjB2MTdIOXoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-line-1.svg":
/*!********************************************!*\
  !*** ./images/dashboard/widget-line-1.svg ***!
  \********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00My4wNTYgMjEuNTg2Yy4wMjUuMDIxLjA2My4wNjQuMDcxLjE3M2wxLjk4IDI2LjQyMmMuMDM2LjQ4Mi4yNy45MjguNjQ3IDEuMjMybDIuMTIzIDEuNzFhMS43NSAxLjc1IDAgMDAxLjM5OS4zNjFsMS41NDctLjI2OWEuMjUuMjUgMCAwMS4yNzcuMTZsMi4wMjkgNS40NzZhMS43NSAxLjc1IDAgMDAyLjc3NC43MjdsMS4yNy0xLjA3OGEuMjUuMjUgMCAwMS4yNTItLjA0M2wxLjk5OC43ODNhLjI1LjI1IDAgMDEuMTA3LjA4MWwyLjY0NSAzLjQ1NS4wNDguMDU3IDIuNTUyIDIuNzIzYy4yOTUuMzE0LjY5NS41MDkgMS4xMjUuNTQ2bDIuMjMuMTk0Yy4yMzQuMDIuNDctLjAwNi42OTUtLjA4bDIuMDEtLjY1NmExLjc1IDEuNzUgMCAwMDEuMTk1LTEuNDY0bDIuNzM4LTIzLjc4MyAxLjM5My03LjU4MmMuMDE4LS4xMDIuMDU4LS4xNC4wODYtLjE2YS4yNzYuMjc2IDAgMDEuMTczLS4wNDUuMjc1LjI3NSAwIDAxLjE2OC4wNjNjLjAyNS4wMjMuMDYuMDY2LjA2OC4xNjlsMi4wNTIgMjguNDI0Yy4xMTggMS42MjYgMi4yIDIuMjIyIDMuMTYuOTA0bC43NzctMS4wNjZhLjI1LjI1IDAgMDEuMjgtLjA5bDIuMDU1LjY3MWMuMDguMDI2LjE2LjA0Ni4yNDMuMDZsMi43NDMuNDc5LjA5Ni4wMSAyLjM0My4xMDJhMS43NSAxLjc1IDAgMDAxLjM3Ny0uNTc3bDEuNjM2LTEuODE3YS4yNS4yNSAwIDAxLjM5NC4wMjhsMS45NjggMi45NTdjLjE1Mi4yMjkuMzU2LjQxOC41OTUuNTUzbDIuMDU4IDEuMTY2YTEuNzUgMS43NSAwIDAwMS44NjMtLjA4N2wyLjA4Ny0xLjQ1NWEuMjU1LjI1NSAwIDAxLjExNi0uMDQ0bDIuMzI2LS4yNTNhLjI1Mi4yNTIgMCAwMS4xMTQuMDE0bDEuMzk3LjUxOGExLjc1IDEuNzUgMCAwMDIuMzQ3LTEuNDQybDEuNTMtMTMuMzE5Yy4wMTItLjEwNC4wNDktLjE0NS4wNzYtLjE2N2EuMjczLjI3MyAwIDAxLjE3MS0uMDU0Yy4wNzYgMCAuMTM2LjAyMy4xNzIuMDUyLjAyNi4wMjEuMDY0LjA2My4wNzcuMTY2bDEuODYgMTQuNjE5YTEuNzUgMS43NSAwIDAwMS42NiAxLjUyN2wxLjcwMy4wNzVhMS43NSAxLjc1IDAgMDAuODg3LS4xOThsMi4zMTctMS4yMWEuMjQ5LjI0OSAwIDAxLjEzNy0uMDI4bDIuMzkzLjIwOGMuMTUxLjAxNC4zMDMuMDA3LjQ1Mi0uMDE5bDIuNDY4LS40M2MuMjUxLS4wNDMuNDktLjE0Mi43LS4yODhsMS45OTItMS4zODhhLjI1LjI1IDAgMDEuMzA3LjAxN2wyLjEzIDEuODU1Yy4xMTEuMDk3LjIzNC4xNzkuMzY1LjI0NWwyLjcwMSAxLjM1Mi4wNDkuMDIzIDIuNTc4IDEuMDY2Yy4yNzEuMTEyLjU2Ni4xNTQuODU4LjEyM2wyLjE2OS0uMjM2YTEuNzUgMS43NSAwIDAwMS4xMzMtLjU5NGwyLjQ3NC0yLjg1NGEuMjEyLjIxMiAwIDAxLjA0Ny0uMDQybDMuMDI5LTIuMDg1YS4yNS4yNSAwIDAxLjM5MS4xODNsLjg4MSA5LjU5M2MuMDU0LjU4Mi4zOTQgMS4wOTguOTA2IDEuMzc3bDIuMzQ1IDEuMjc3LjcxOC0xLjMxOC0yLjM0NS0xLjI3NmEuMjUuMjUgMCAwMS0uMTMtLjE5N2wtLjg4MS05LjU5M2MtLjEyMy0xLjMzMi0xLjYzMy0yLjA0LTIuNzM1LTEuMjgxbC0zLjAzIDIuMDg0YTEuNzUgMS43NSAwIDAwLS4zMy4yOTZsLTIuNDczIDIuODU0YS4yNDkuMjQ5IDAgMDEtLjE2Mi4wODRsLTIuMTY5LjIzNmEuMjUxLjI1MSAwIDAxLS4xMjMtLjAxN2wtMi41NTMtMS4wNTYtMi42NzYtMS4zNGEuMjQzLjI0MyAwIDAxLS4wNTItLjAzNWwtMi4xMy0xLjg1NWExLjc1IDEuNzUgMCAwMC0yLjE1LS4xMTZsLTEuOTkyIDEuMzg4YS4yNS4yNSAwIDAxLS4xLjA0bC0yLjQ2Ny40M2EuMjUxLjI1MSAwIDAxLS4wNjUuMDAzbC0yLjM5My0uMjA4YTEuNzUgMS43NSAwIDAwLS45NjIuMTkybC0yLjMxNyAxLjIxYS4yNDcuMjQ3IDAgMDEtLjEyNi4wMjlsLTEuNzA0LS4wNzRhLjI1LjI1IDAgMDEtLjIzNy0uMjE4bC0xLjg2LTE0LjYyYy0uMjYxLTIuMDUtMy4yMzgtMi4wMzItMy40NzQuMDIybC0xLjUzMSAxMy4zMmEuMjUuMjUgMCAwMS0uMzM1LjIwNWwtMS4zOTgtLjUxN2ExLjc0NyAxLjc0NyAwIDAwLS43OTYtLjA5OWwtMi4zMjYuMjUzYTEuNzUgMS43NSAwIDAwLS44MTEuMzA0bC0yLjA4OCAxLjQ1NWEuMjUuMjUgMCAwMS0uMjY2LjAxMmwtMi4wNTgtMS4xNjVhLjI1LjI1IDAgMDEtLjA4NS0uMDhsLTEuOTY4LTIuOTU2YTEuNzUgMS43NSAwIDAwLTIuNzU4LS4yMDFsLTEuNjM2IDEuODE3YS4yNS4yNSAwIDAxLS4xOTcuMDgzbC0yLjI5NC0uMS0yLjY5Ni0uNDdhLjI0MS4yNDEgMCAwMS0uMDM0LS4wMDlsLTIuMDU1LS42N2ExLjc1IDEuNzUgMCAwMC0xLjk1OC42MzJsLS43NzcgMS4wNjZhLjI1LjI1IDAgMDEtLjQ1MS0uMTNMNzguMTUyIDMwLjY1Yy0uMTQ4LTIuMDUtMy4wOTUtMi4yMS0zLjQ2Ny0uMTlsLTEuMzk3IDcuNjA3LS4wMDguMDUtMi43NCAyMy44MDhhLjI1LjI1IDAgMDEtLjE3LjIxbC0yLjAxMS42NTZhLjI0OC4yNDggMCAwMS0uMS4wMTFsLTIuMjI5LS4xOTRhLjI1LjI1IDAgMDEtLjE2LS4wNzhsLTIuNTI3LTIuNjk2LTIuNjIyLTMuNDI1YTEuNzUgMS43NSAwIDAwLS43NS0uNTY1bC0xLjk5OC0uNzgzYTEuNzUgMS43NSAwIDAwLTEuNzcyLjI5NWwtMS4yNyAxLjA3OGEuMjUuMjUgMCAwMS0uMzk1LS4xMDRsLTIuMDI5LTUuNDc3YTEuNzUgMS43NSAwIDAwLTEuOTQxLTEuMTE2bC0xLjU0OC4yN2EuMjUuMjUgMCAwMS0uMi0uMDUybC0yLjEyMy0xLjcxYS4yNS4yNSAwIDAxLS4wOTMtLjE3N2wtMS45OC0yNi40MmMtLjE1OC0yLjEyMS0zLjI0OC0yLjE3Ny0zLjQ4NC0uMDY0bC0xLjU5IDE0LjI3YS4yNS4yNSAwIDAxLS4wNTguMTM1bC0yLjQ2MSAyLjg5M2ExLjc1IDEuNzUgMCAwMC0uMzY5LjcyN2wtMi41NTMgMTAuNjczYS4yNS4yNSAwIDAxLS4yNy4xOWwtMS45MzgtLjIxLS4wNjUtLjAwNS0yLjc5LS4wNi0xLjk5MS0uMTc0YTEuNzUgMS43NSAwIDAwLTEuODIgMS4yMTVsLTIuMzMgNy4zNTZhLjI1LjI1IDAgMDEtLjI2LjE3NGwtMS45My0uMTY4YTEuNzUgMS43NSAwIDAwLS4zMDMgMGwtMi4zNy4yMDZhMS43NSAxLjc1IDAgMDAtMS4wNzMuNDk0bC0yLjAxIDEuOTdhLjI1LjI1IDAgMDEtLjMwMy4wMzdsLTIuMDI3LTEuMTkyYS4yNDguMjQ4IDAgMDEtLjA1Ny0uMDQ1bC0zLjAyLTMuMjU3LTEuMSAxLjAyIDMuMDIgMy4yNTdjLjExNi4xMjUuMjUuMjMyLjM5Ny4zMThsMi4wMjcgMS4xOTJhMS43NSAxLjc1IDAgMDAyLjExMi0uMjU4bDIuMDExLTEuOTdhLjI1LjI1IDAgMDEuMTUzLS4wNzFsMi4zNy0uMjA3YS4yNjIuMjYyIDAgMDEuMDQ0IDBsMS45MjkuMTY4YTEuNzUgMS43NSAwIDAwMS44Mi0xLjIxNWwyLjMzLTcuMzU2YS4yNS4yNSAwIDAxLjI2LS4xNzNsMi4wMTYuMTc1LjA0OC4wMDMgMi43ODIuMDYgMS45MDUuMjA4YTEuNzUgMS43NSAwIDAwMS44OTItMS4zMzNsMi41NTMtMTAuNjczYS4yNS4yNSAwIDAxLjA1My0uMTA0bDIuNDYtMi44OTNhMS43NSAxLjc1IDAgMDAuNDA2LS45NGwxLjU5MS0xNC4yN2MuMDEyLS4xMS4wNTEtLjE1LjA3Ny0uMTcxYS4yOC4yOCAwIDAxLjE3Ni0uMDUyYy4wNzkuMDAxLjE0LjAyOC4xNzUuMDU4eiIgZmlsbD0iIzQ0NDY3NCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-table.svg":
/*!*******************************************!*\
  !*** ./images/dashboard/widget-table.svg ***!
  \*******************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDBoMTU3djc5SDBWMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNOSAxMWExIDEgMCAwMTEtMWgyN2ExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTEgMjBoMTU3djEzSDFWMjB6IiBmaWxsPSIjQzFCMkREIi8+PHBhdGggZD0iTTkgNDJhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xeiIgZmlsbD0iI0Q0RDFFQyIvPjxwYXRoIGQ9Ik05IDI3YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDI3YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjQTM5NkRBIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzem0xLTF2NzlIMlYyaDE1N3oiIGZpbGw9IiM0NDQ2NzQiLz48cGF0aCBkPSJNMTIyIDQyYTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6TTkgNTFhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xek0xMjIgNTFhMSAxIDAgMDExLTFoMjZhMSAxIDAgMDEwIDJoLTI2YTEgMSAwIDAxLTEtMXpNOSA2MGExIDEgMCAwMTEtMWg0MGExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6TTEyMiA2MGExIDEgMCAwMTEtMWgyNmExIDEgMCAwMTAgMmgtMjZhMSAxIDAgMDEtMS0xek05IDY5YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDY5YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PC9zdmc+";

/***/ }),

/***/ "./images/dashboard/widget-world-map.svg":
/*!***********************************************!*\
  !*** ./images/dashboard/widget-world-map.svg ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/widget-world-map.b5c5097ff7a4945389d2.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_widgetViewerModal_utils_tsx-app_views_dashboardsV2_widgetCard_widgetCar-7a3063.30c7d7cb410aa034f7ff1c2548589273.js.map