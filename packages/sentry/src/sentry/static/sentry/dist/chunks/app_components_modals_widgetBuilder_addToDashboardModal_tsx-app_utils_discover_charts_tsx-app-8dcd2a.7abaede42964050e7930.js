(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_widgetBuilder_addToDashboardModal_tsx-app_utils_discover_charts_tsx-app-8dcd2a"],{

/***/ "./app/components/modals/widgetBuilder/addToDashboardModal.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/modals/widgetBuilder/addToDashboardModal.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/dashboards */ "./app/actionCreators/dashboards.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard */ "./app/views/dashboardsV2/widgetCard/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















const SELECT_DASHBOARD_MESSAGE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Select a dashboard');

function AddToDashboardModal(_ref) {
  var _getDashboardFiltersF;

  let {
    Header,
    Body,
    Footer,
    closeModal,
    location,
    organization,
    router,
    selection,
    widget,
    widgetAsQueryParams
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const [dashboards, setDashboards] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [selectedDashboard, setSelectedDashboard] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [selectedDashboardId, setSelectedDashboardId] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;
    (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_4__.fetchDashboards)(api, organization.slug).then(response => {
      // If component has unmounted, dont set state
      if (unmounted) {
        return;
      }

      setDashboards(response);
    });
    return () => {
      unmounted = true;
    };
  }, [api, organization.slug]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    if (selectedDashboardId === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_15__.NEW_DASHBOARD_ID || selectedDashboardId === null) {
      setSelectedDashboard(null);
    } else {
      (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_4__.fetchDashboard)(api, organization.slug, selectedDashboardId).then(response => {
        // If component has unmounted, dont set state
        if (unmounted) {
          return;
        }

        setSelectedDashboard(response);
      });
    }

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, selectedDashboardId]);

  function handleGoToBuilder() {
    const pathname = selectedDashboardId === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_15__.NEW_DASHBOARD_ID ? `/organizations/${organization.slug}/dashboards/new/widget/new/` : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/widget/new/`;
    router.push({
      pathname,
      query: { ...widgetAsQueryParams,
        ...(organization.features.includes('dashboards-top-level-filter') && selectedDashboard ? (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_14__.getSavedPageFilters)(selectedDashboard) : {})
      }
    });
    closeModal();
  }

  async function handleAddAndStayInDiscover() {
    if (selectedDashboard === null) {
      return;
    }

    let orderby = widget.queries[0].orderby;

    if (!!!(sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_13__.DisplayType.AREA && widget.queries[0].columns.length)) {
      orderby = ''; // Clear orderby if its not a top n visualization.
    }

    const query = widget.queries[0];
    const newWidget = { ...widget,
      title: widget.title === '' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('All Events') : widget.title,
      queries: [{ ...query,
        orderby
      }]
    };

    try {
      const newDashboard = { ...selectedDashboard,
        widgets: [...selectedDashboard.widgets, newWidget]
      };
      await (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_4__.updateDashboard)(api, organization.slug, newDashboard);
      closeModal();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Successfully added widget to dashboard'));
    } catch (e) {
      const errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to add widget to dashboard');
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_11__["default"])(errorMessage)(e);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(errorMessage);
    }
  }

  const canSubmit = selectedDashboardId !== null;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Header, {
      closeButton: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h4", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Add to Dashboard')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Wrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__["default"], {
          disabled: dashboards === null,
          menuPlacement: "auto",
          name: "dashboard",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Select Dashboard'),
          value: selectedDashboardId,
          options: dashboards && [{
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('+ Create New Dashboard'),
            value: 'new'
          }, ...dashboards.map(_ref2 => {
            let {
              title,
              id,
              widgetDisplay
            } = _ref2;
            return {
              label: title,
              value: id,
              disabled: widgetDisplay.length >= sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_13__.MAX_WIDGETS,
              tooltip: widgetDisplay.length >= sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_13__.MAX_WIDGETS && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Max widgets ([maxWidgets]) per dashboard reached.', {
                maxWidgets: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_13__.MAX_WIDGETS
              }),
              tooltipOptions: {
                position: 'right'
              }
            };
          })],
          onChange: option => {
            if (option.disabled) {
              return;
            }

            setSelectedDashboardId(option.value);
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Wrapper, {
        children: organization.features.includes('dashboards-top-level-filter') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Any conflicting filters from this query will be overridden by Dashboard filters. This is a preview of how the widget will appear in your dashboard.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This is a preview of how the widget will appear in your dashboard.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_16__["default"], {
        api: api,
        organization: organization,
        currentWidgetDragging: false,
        isEditing: false,
        isSorting: false,
        widgetLimitReached: false,
        selection: organization.features.includes('dashboards-top-level-filter') && selectedDashboard ? (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_14__.getSavedFiltersAsPageFilters)(selectedDashboard) : selection,
        dashboardFilters: organization.features.includes('dashboards-top-level-filter') ? (_getDashboardFiltersF = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_14__.getDashboardFiltersFromURL)(location)) !== null && _getDashboardFiltersF !== void 0 ? _getDashboardFiltersF : selectedDashboard === null || selectedDashboard === void 0 ? void 0 : selectedDashboard.filters : {},
        widget: widget,
        showStoredAlert: true
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Footer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(StyledButtonBar, {
        gap: 1.5,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          onClick: handleAddAndStayInDiscover,
          disabled: !canSubmit || selectedDashboardId === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_15__.NEW_DASHBOARD_ID,
          title: canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Add + Stay in Discover')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          priority: "primary",
          onClick: handleGoToBuilder,
          disabled: !canSubmit,
          title: canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Open in Widget Builder')
        })]
      })
    })]
  });
}

AddToDashboardModal.displayName = "AddToDashboardModal";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AddToDashboardModal);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "erdydty1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "erdydty0"
} : 0)("@media (max-width: ", props => props.theme.breakpoints.small, "){grid-template-rows:repeat(2, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";width:100%;>button{width:100%;}}" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "jzg5s9",
  styles: "max-width:700px;margin:70px auto"
} : 0;

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ }),

/***/ "./app/utils/withProject.tsx":
/*!***********************************!*\
  !*** ./app/utils/withProject.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    render() {
      const {
        project,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(WrappedComponent, {
        project: project !== null && project !== void 0 ? project : this.context.project,
        ...props
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withProject(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__["default"])(WrappedComponent)})`), (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "contextTypes", {
    project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__["default"].Project
  }), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProject);

/***/ }),

/***/ "../node_modules/lodash/_baseExtremum.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_baseExtremum.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "../node_modules/lodash/isSymbol.js");

/**
 * The base implementation of methods like `_.max` and `_.min` which accepts a
 * `comparator` to determine the extremum value.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The iteratee invoked per iteration.
 * @param {Function} comparator The comparator used to compare values.
 * @returns {*} Returns the extremum value.
 */
function baseExtremum(array, iteratee, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index],
        current = iteratee(value);

    if (current != null && (computed === undefined
          ? (current === current && !isSymbol(current))
          : comparator(current, computed)
        )) {
      var computed = current,
          result = value;
    }
  }
  return result;
}

module.exports = baseExtremum;


/***/ }),

/***/ "../node_modules/lodash/_baseGt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseGt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.gt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is greater than `other`,
 *  else `false`.
 */
function baseGt(value, other) {
  return value > other;
}

module.exports = baseGt;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_widgetBuilder_addToDashboardModal_tsx-app_utils_discover_charts_tsx-app-8dcd2a.fcafdd548234b481fb5a503fa4049cd7.js.map