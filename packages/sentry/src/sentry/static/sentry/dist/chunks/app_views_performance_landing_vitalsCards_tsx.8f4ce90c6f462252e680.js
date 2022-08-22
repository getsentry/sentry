"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_landing_vitalsCards_tsx"],{

/***/ "./app/components/sparklines/index.tsx":
/*!*********************************************!*\
  !*** ./app/components/sparklines/index.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SparklinesWithCustomPropTypes)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react_sparklines__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-sparklines */ "../node_modules/react-sparklines/build/index.js");
/* harmony import */ var react_sparklines__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_sparklines__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! prop-types */ "../node_modules/prop-types/index.js");
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(prop_types__WEBPACK_IMPORTED_MODULE_2__);



/**
 * This is required because:
 *
 * - React.Suspense only works with default exports
 * - typescript complains that the library's `propTypes` does not
 * have `children defined.
 * - typescript also won't let us access `Sparklines.propTypes`
 */

class SparklinesWithCustomPropTypes extends react_sparklines__WEBPACK_IMPORTED_MODULE_1__.Sparklines {}

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(SparklinesWithCustomPropTypes, "propTypes", {
  children: prop_types__WEBPACK_IMPORTED_MODULE_2__.node,
  data: prop_types__WEBPACK_IMPORTED_MODULE_2__.array,
  limit: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  width: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  height: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  svgWidth: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  svgHeight: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  preserveAspectRatio: prop_types__WEBPACK_IMPORTED_MODULE_2__.string,
  margin: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  style: prop_types__WEBPACK_IMPORTED_MODULE_2__.object,
  min: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  max: prop_types__WEBPACK_IMPORTED_MODULE_2__.number,
  onMouseMove: prop_types__WEBPACK_IMPORTED_MODULE_2__.func
});

/***/ }),

/***/ "./app/components/sparklines/line.tsx":
/*!********************************************!*\
  !*** ./app/components/sparklines/line.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* reexport safe */ react_sparklines__WEBPACK_IMPORTED_MODULE_0__.SparklinesLine)
/* harmony export */ });
/* harmony import */ var react_sparklines__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-sparklines */ "../node_modules/react-sparklines/build/index.js");
/* harmony import */ var react_sparklines__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_sparklines__WEBPACK_IMPORTED_MODULE_0__);
// Need to re-export this as default because React.Suspense does not support
// named exports, only default


/***/ }),

/***/ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx":
/*!*******************************************************************!*\
  !*** ./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/constants */ "./app/utils/performance/constants.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function getRequestPayload(props) {
  const {
    eventView,
    vitals
  } = props;
  const apiPayload = eventView === null || eventView === void 0 ? void 0 : eventView.getEventsAPIPayload(props.location);
  return {
    vital: vitals,
    ...lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(apiPayload, ['query', ...Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_3__.PERFORMANCE_URL_PARAM)])
  };
}

function VitalsCardsDiscoverQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_2__["default"], {
    getRequestPayload: getRequestPayload,
    route: "events-vitals",
    ...props,
    children: _ref => {
      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        vitalsData: tableData,
        ...rest
      });
    }
  });
}

VitalsCardsDiscoverQuery.displayName = "VitalsCardsDiscoverQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__["default"])(VitalsCardsDiscoverQuery));

/***/ }),

/***/ "./app/views/performance/landing/vitalsCards.tsx":
/*!*******************************************************!*\
  !*** ./app/views/performance/landing/vitalsCards.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BackendCards": () => (/* binding */ BackendCards),
/* harmony export */   "FrontendCards": () => (/* binding */ FrontendCards),
/* harmony export */   "MobileCards": () => (/* binding */ MobileCards),
/* harmony export */   "VitalBar": () => (/* binding */ VitalBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_card__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/card */ "./app/components/card.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_sparklines__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/sparklines */ "./app/components/sparklines/index.tsx");
/* harmony import */ var sentry_components_sparklines_line__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/sparklines/line */ "./app/components/sparklines/line.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsCardsDiscoverQuery */ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _vitalDetail_colorBar__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../vitalDetail/colorBar */ "./app/views/performance/vitalDetail/colorBar.tsx");
/* harmony import */ var _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _vitalDetail_vitalPercents__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../vitalDetail/vitalPercents */ "./app/views/performance/vitalDetail/vitalPercents.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./utils */ "./app/views/performance/landing/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
































function FrontendCards(props) {
  const {
    eventView,
    location,
    organization,
    projects,
    frontendOnly = false
  } = props;

  if (frontendOnly) {
    const defaultDisplay = (0,_utils__WEBPACK_IMPORTED_MODULE_29__.getDefaultDisplayFieldForPlatform)(projects, eventView);
    const isFrontend = defaultDisplay === _utils__WEBPACK_IMPORTED_MODULE_29__.LandingDisplayField.FRONTEND_PAGELOAD;

    if (!isFrontend) {
      return null;
    }
  }

  const vitals = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__.WebVital.LCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__.WebVital.FID, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__.WebVital.CLS];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_22__["default"], {
    eventView: eventView,
    location: location,
    orgSlug: organization.slug,
    vitals: vitals,
    children: _ref => {
      let {
        isLoading,
        vitalsData
      } = _ref;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalsContainer, {
        children: vitals.map(vital => {
          var _vitalsData$vital, _vitalMap$vital, _WEB_VITAL_DETAILS$vi;

          const target = (0,_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.vitalDetailRouteWithQuery)({
            orgSlug: organization.slug,
            query: eventView.generateQueryStringObject(),
            vitalName: vital,
            projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_23__.decodeList)(location.query.project)
          });
          const value = isLoading ? '\u2014' : getP75((_vitalsData$vital = vitalsData === null || vitalsData === void 0 ? void 0 : vitalsData[vital]) !== null && _vitalsData$vital !== void 0 ? _vitalsData$vital : null, vital);

          const chart = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalBarContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalBar, {
              isLoading: isLoading,
              vital: vital,
              data: vitalsData
            })
          });

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
            to: target,
            "data-test-id": `vitals-linked-card-${_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.vitalAbbreviations[vital]}`,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalCard, {
              title: (_vitalMap$vital = _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.vitalMap[vital]) !== null && _vitalMap$vital !== void 0 ? _vitalMap$vital : '',
              tooltip: (_WEB_VITAL_DETAILS$vi = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_21__.WEB_VITAL_DETAILS[vital].description) !== null && _WEB_VITAL_DETAILS$vi !== void 0 ? _WEB_VITAL_DETAILS$vi : '',
              value: isLoading ? '\u2014' : value,
              chart: chart,
              minHeight: 150
            })
          }, vital);
        })
      });
    }
  });
}
FrontendCards.displayName = "FrontendCards";

const VitalBarContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku9"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), ";" + ( true ? "" : 0));

function GenericCards(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_25__["default"])();
  const {
    eventView: baseEventView,
    location,
    organization,
    functions
  } = props;
  const {
    query
  } = location;
  const eventView = baseEventView.withColumns(functions); // construct request parameters for fetching chart data

  const globalSelection = eventView.getPageFilters();
  const start = globalSelection.datetime.start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__.getUtcToLocalDateObject)(globalSelection.datetime.start) : undefined;
  const end = globalSelection.datetime.end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__.getUtcToLocalDateObject)(globalSelection.datetime.end) : undefined;
  const interval = typeof query.sparkInterval === 'string' ? query.sparkInterval : (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__.getInterval)({
    start: start || null,
    end: end || null,
    period: globalSelection.datetime.period
  }, 'low');
  const apiPayload = eventView.getEventsAPIPayload(location);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_18__["default"], {
    location: location,
    eventView: eventView,
    orgSlug: organization.slug,
    limit: 1,
    referrer: "api.performance.vitals-cards",
    children: _ref2 => {
      let {
        isLoading: isSummaryLoading,
        tableData
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_4__["default"], {
        api: api,
        organization: organization,
        period: globalSelection.datetime.period,
        project: globalSelection.projects,
        environment: globalSelection.environments,
        team: apiPayload.team,
        start: start,
        end: end,
        interval: interval,
        query: apiPayload.query,
        includePrevious: false,
        yAxis: eventView.getFields(),
        partial: true,
        children: _ref3 => {
          let {
            results
          } = _ref3;
          const series = results === null || results === void 0 ? void 0 : results.reduce((allSeries, oneSeries) => {
            allSeries[oneSeries.seriesName] = oneSeries.data.map(item => item.value);
            return allSeries;
          }, {});
          const details = (0,_utils__WEBPACK_IMPORTED_MODULE_29__.vitalCardDetails)(organization);
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalsContainer, {
            children: functions.map(func => {
              var _tableData$data, _tableData$data$;

              let fieldName = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.generateFieldAsString)(func);

              if (fieldName.includes('apdex')) {
                // Replace apdex with explicit thresholds with a generic one for lookup
                fieldName = 'apdex()';
              }

              const cardDetail = details[fieldName];

              if (!cardDetail) {
                _sentry_react__WEBPACK_IMPORTED_MODULE_31__.captureMessage(`Missing field '${fieldName}' in vital cards.`);
                return null;
              }

              const {
                title,
                tooltip,
                formatter
              } = cardDetail;
              const alias = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.getAggregateAlias)(fieldName);
              const rawValue = tableData === null || tableData === void 0 ? void 0 : (_tableData$data = tableData.data) === null || _tableData$data === void 0 ? void 0 : (_tableData$data$ = _tableData$data[0]) === null || _tableData$data$ === void 0 ? void 0 : _tableData$data$[alias];
              const data = series === null || series === void 0 ? void 0 : series[fieldName];
              const value = isSummaryLoading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_16__.defined)(rawValue) ? '\u2014' : formatter(rawValue);

              const chart = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(SparklineChart, {
                data: data
              });

              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(VitalCard, {
                title: title,
                tooltip: tooltip,
                value: value,
                chart: chart,
                horizontal: true,
                minHeight: 96,
                isNotInteractive: true
              }, fieldName);
            })
          });
        }
      });
    }
  });
}

GenericCards.displayName = "GenericCards";

function _BackendCards(props) {
  const functions = [{
    kind: 'function',
    function: ['p75', 'transaction.duration', undefined, undefined]
  }, {
    kind: 'function',
    function: ['tpm', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['failure_rate', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['apdex', '', undefined, undefined]
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(GenericCards, { ...props,
    functions: functions
  });
}

_BackendCards.displayName = "_BackendCards";
const BackendCards = _BackendCards;

function _MobileCards(props) {
  const functions = [{
    kind: 'function',
    function: ['p75', 'measurements.app_start_cold', undefined, undefined]
  }, {
    kind: 'function',
    function: ['p75', 'measurements.app_start_warm', undefined, undefined]
  }, {
    kind: 'function',
    function: ['p75', 'measurements.frames_slow_rate', undefined, undefined]
  }, {
    kind: 'function',
    function: ['p75', 'measurements.frames_frozen_rate', undefined, undefined]
  }];

  if (props.showStallPercentage) {
    functions.push({
      kind: 'function',
      function: ['p75', 'measurements.stall_percentage', undefined, undefined]
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(GenericCards, { ...props,
    functions: functions
  });
}

_MobileCards.displayName = "_MobileCards";
const MobileCards = _MobileCards;

function SparklineChart(props) {
  const {
    data
  } = props;
  const width = 150;
  const height = 24;
  const lineColor = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_24__["default"].charts.getColorPalette(1)[0];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(SparklineContainer, {
    "data-test-id": "sparkline",
    width: width,
    height: height,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_sparklines__WEBPACK_IMPORTED_MODULE_11__["default"], {
      data: data,
      width: width,
      height: height,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_sparklines_line__WEBPACK_IMPORTED_MODULE_12__["default"], {
        style: {
          stroke: lineColor,
          fill: 'none',
          strokeWidth: 3
        }
      })
    })
  });
}

SparklineChart.displayName = "SparklineChart";

const SparklineContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku8"
} : 0)("flex-grow:4;max-height:", p => p.height, "px;max-width:", p => p.width, "px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), ";" + ( true ? "" : 0));

const VitalsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku7"
} : 0)("display:grid;grid-template-columns:1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(2, 1fr);}@media (min-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));}" + ( true ? "" : 0));

function VitalBar(props) {
  var _data$vital;

  const {
    isLoading,
    data,
    vital,
    value,
    showBar = true,
    showStates = false,
    showDurationDetail = false,
    showVitalPercentNames = true,
    showVitalThresholds = false,
    showDetail = true,
    showTooltip = false,
    barHeight
  } = props;

  if (isLoading) {
    return showStates ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"], {
      height: "48px"
    }) : null;
  }

  const emptyState = showStates ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(EmptyVitalBar, {
    small: true,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('No vitals found')
  }) : null;

  if (!data) {
    return emptyState;
  }

  const counts = {
    poor: 0,
    meh: 0,
    good: 0,
    total: 0
  };
  const vitals = Array.isArray(vital) ? vital : [vital];
  vitals.forEach(vitalName => {
    var _data$vitalName;

    const c = (_data$vitalName = data === null || data === void 0 ? void 0 : data[vitalName]) !== null && _data$vitalName !== void 0 ? _data$vitalName : {};
    Object.keys(counts).forEach(countKey => counts[countKey] += c[countKey]);
  });

  if (!counts.total) {
    return emptyState;
  }

  const p75 = Array.isArray(vital) ? null : value !== null && value !== void 0 ? value : getP75((_data$vital = data === null || data === void 0 ? void 0 : data[vital]) !== null && _data$vital !== void 0 ? _data$vital : null, vital);
  const percents = getPercentsFromCounts(counts);
  const colorStops = getColorStopsFromPercents(percents);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [showBar && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(StyledTooltip, {
      title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_vitalDetail_vitalPercents__WEBPACK_IMPORTED_MODULE_28__["default"], {
        vital: vital,
        percents: percents,
        showVitalPercentNames: false,
        showVitalThresholds: false,
        hideTooltips: showTooltip
      }),
      disabled: !showTooltip,
      position: "bottom",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_vitalDetail_colorBar__WEBPACK_IMPORTED_MODULE_26__["default"], {
        barHeight: barHeight,
        colorStops: colorStops
      })
    }), showDetail && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(BarDetail, {
      children: [showDurationDetail && p75 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)("div", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('The p75 for all transactions is '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)("strong", {
          children: p75
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(_vitalDetail_vitalPercents__WEBPACK_IMPORTED_MODULE_28__["default"], {
        vital: vital,
        percents: percents,
        showVitalPercentNames: showVitalPercentNames,
        showVitalThresholds: showVitalThresholds
      })]
    })]
  });
}
VitalBar.displayName = "VitalBar";

const EmptyVitalBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1he14ku6"
} : 0)("height:48px;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), " 15%;" + ( true ? "" : 0));

function VitalCard(props) {
  const {
    chart,
    minHeight,
    horizontal,
    title,
    tooltip,
    value,
    isNotInteractive
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(StyledCard, {
    interactive: !isNotInteractive,
    minHeight: minHeight,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.HeaderTitle, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(OverflowEllipsis, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)(title)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
        size: "sm",
        position: "top",
        title: tooltip
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsxs)(CardContent, {
      horizontal: horizontal,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_30__.jsx)(CardValue, {
        children: value
      }), chart]
    })]
  });
}

VitalCard.displayName = "VitalCard";

const CardContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku5"
} : 0)("width:100%;display:flex;flex-direction:", p => p.horizontal ? 'row' : 'column', ";justify-content:space-between;" + ( true ? "" : 0));

const StyledCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_card__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1he14ku4"
} : 0)("color:", p => p.theme.textColor, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), ";align-items:flex-start;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";", p => p.minHeight && `min-height: ${p.minHeight}px`, ";" + ( true ? "" : 0));

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "e1he14ku3"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

function getP75(data, vitalName) {
  var _data$p;

  const p75 = (_data$p = data === null || data === void 0 ? void 0 : data.p75) !== null && _data$p !== void 0 ? _data$p : null;

  if (p75 === null) {
    return '\u2014';
  }

  return vitalName === sentry_utils_fields__WEBPACK_IMPORTED_MODULE_20__.WebVital.CLS ? p75.toFixed(2) : `${p75.toFixed(0)}ms`;
}

function getPercentsFromCounts(_ref4) {
  let {
    poor,
    meh,
    good,
    total
  } = _ref4;
  const poorPercent = poor / total;
  const mehPercent = meh / total;
  const goodPercent = good / total;
  const percents = [{
    vitalState: _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.VitalState.GOOD,
    percent: goodPercent
  }, {
    vitalState: _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.VitalState.MEH,
    percent: mehPercent
  }, {
    vitalState: _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.VitalState.POOR,
    percent: poorPercent
  }];
  return percents;
}

function getColorStopsFromPercents(percents) {
  return percents.map(_ref5 => {
    let {
      percent,
      vitalState
    } = _ref5;
    return {
      percent,
      color: _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_27__.vitalStateColors[vitalState]
    };
  });
}

const BarDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku2"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;justify-content:space-between;}" + ( true ? "" : 0));

const CardValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku1"
} : 0)("font-size:32px;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const OverflowEllipsis = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1he14ku0"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/vitalDetail/colorBar.tsx":
/*!********************************************************!*\
  !*** ./app/views/performance/vitalDetail/colorBar.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const ColorBar = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(VitalBar, {
    barHeight: props.barHeight,
    fractions: props.colorStops.map(_ref => {
      let {
        percent
      } = _ref;
      return percent;
    }),
    children: props.colorStops.map(colorStop => {
      var _colorStop$renderBarS, _colorStop$renderBarS2;

      const barStatus = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(BarStatus, {
        color: colorStop.color
      }, colorStop.color);

      return (_colorStop$renderBarS = (_colorStop$renderBarS2 = colorStop.renderBarStatus) === null || _colorStop$renderBarS2 === void 0 ? void 0 : _colorStop$renderBarS2.call(colorStop, barStatus, colorStop.color)) !== null && _colorStop$renderBarS !== void 0 ? _colorStop$renderBarS : barStatus;
    })
  });
};

ColorBar.displayName = "ColorBar";

const VitalBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etd41501"
} : 0)("height:", p => p.barHeight ? `${p.barHeight}px` : '16px', ";width:100%;overflow:hidden;position:relative;background:", p => p.theme.gray100, ";display:grid;grid-template-columns:", p => p.fractions.map(f => `${f}fr`).join(' '), ";margin-bottom:", p => p.barHeight ? '' : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";border-radius:2px;" + ( true ? "" : 0));

const BarStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etd41500"
} : 0)("background-color:", p => {
  var _p$theme$p$color;

  return (_p$theme$p$color = p.theme[p.color]) !== null && _p$theme$p$color !== void 0 ? _p$theme$p$color : p.color;
}, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ColorBar);

/***/ }),

/***/ "./app/views/performance/vitalDetail/vitalPercents.tsx":
/*!*************************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalPercents.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VitalPercents)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function getVitalStateText(vital, vitalState) {
  const unit = !Array.isArray(vital) && vital !== sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.WebVital.CLS ? 'ms' : '';

  switch (vitalState) {
    case _utils__WEBPACK_IMPORTED_MODULE_5__.VitalState.POOR:
      return Array.isArray(vital) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Poor') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('(>[threshold][unit])', {
        threshold: _utils__WEBPACK_IMPORTED_MODULE_5__.webVitalPoor[vital],
        unit
      });

    case _utils__WEBPACK_IMPORTED_MODULE_5__.VitalState.MEH:
      return Array.isArray(vital) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Meh') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('(>[threshold][unit])', {
        threshold: _utils__WEBPACK_IMPORTED_MODULE_5__.webVitalMeh[vital],
        unit
      });

    case _utils__WEBPACK_IMPORTED_MODULE_5__.VitalState.GOOD:
      return Array.isArray(vital) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Good') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.tct)('(<=[threshold][unit])', {
        threshold: _utils__WEBPACK_IMPORTED_MODULE_5__.webVitalMeh[vital],
        unit
      });

    default:
      return null;
  }
}

function VitalPercents(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(VitalSet, {
    children: props.percents.map(pct => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(VitalStatus, {
      "data-test-id": "vital-status",
      children: [_utils__WEBPACK_IMPORTED_MODULE_5__.vitalStateIcons[pct.vitalState], props.showVitalPercentNames && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)(`${pct.vitalState}`), ' ', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_4__.formatPercentage)(pct.percent, 0), props.showVitalThresholds && getVitalStateText(props.vital, pct.vitalState)]
    }, pct.vitalState))
  });
}
VitalPercents.displayName = "VitalPercents";

const VitalSet = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ex3thpn1"
} : 0)("display:inline-grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), ";" + ( true ? "" : 0));

const VitalStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ex3thpn0"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_landing_vitalsCards_tsx.9db7ef2d723b4f2dd14261ccaabdc1b3.js.map