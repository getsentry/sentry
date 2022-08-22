(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_eventsRequest_tsx-app_components_charts_worldMapChart_tsx-app_utils_dis-4cc9e7"],{

/***/ "./app/actionCreators/events.tsx":
/*!***************************************!*\
  !*** ./app/actionCreators/events.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "doEventsRequest": () => (/* binding */ doEventsRequest),
/* harmony export */   "fetchTagFacets": () => (/* binding */ fetchTagFacets),
/* harmony export */   "fetchTotalCount": () => (/* binding */ fetchTotalCount)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/constants */ "./app/utils/performance/constants.tsx");






/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {Boolean} options.excludeOther Exclude the "Other" series when making a topEvents query
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 * @param {QueryBatching} options.queryBatching A container for batching functions from a provider
 * @param {Record<string, string>} options.queryExtras A list of extra query parameters
 * @param {(org: OrganizationSummary) => string} options.generatePathname A function that returns an override for the pathname
 */
const doEventsRequest = (api, _ref) => {
  var _generatePathname;

  let {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
    queryBatching,
    generatePathname,
    queryExtras,
    excludeOther,
    includeAllArgs
  } = _ref;
  const pathname = (_generatePathname = generatePathname === null || generatePathname === void 0 ? void 0 : generatePathname(organization)) !== null && _generatePathname !== void 0 ? _generatePathname : `/organizations/${organization.slug}/events-stats/`;
  const shouldDoublePeriod = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__.canIncludePreviousPeriod)(includePrevious, period);
  const urlQuery = Object.fromEntries(Object.entries({
    interval,
    comparisonDelta,
    project,
    environment,
    team,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial: partial ? '1' : undefined,
    withoutZerofill: withoutZerofill ? '1' : undefined,
    referrer: referrer ? referrer : 'api.organization-event-stats',
    excludeOther: excludeOther ? '1' : undefined
  }).filter(_ref2 => {
    let [, value] = _ref2;
    return typeof value !== 'undefined';
  })); // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.

  const periodObj = (0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__.getPeriod)({
    period,
    start,
    end
  }, {
    shouldDoublePeriod
  });
  const queryObject = {
    includeAllArgs,
    query: { ...urlQuery,
      ...periodObj,
      ...queryExtras
    }
  };

  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, pathname, queryObject);
  }

  return api.requestPromise(pathname, queryObject);
};

/**
 * Fetches tag facets for a query
 */
function fetchTagFacets(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption
  });
}
/**
 * Fetches total count of events for a given query
 */

function fetchTotalCount(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-meta/`, {
    query: queryOption
  }).then(res => res.count);
}

/***/ }),

/***/ "./app/components/alertBadge.tsx":
/*!***************************************!*\
  !*** ./app/components/alertBadge.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function AlertBadge(_ref) {
  let {
    status,
    hideText = false,
    isIssue
  } = _ref;
  let statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Resolved');
  let Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconCheckmark;
  let color = 'green300';

  if (isIssue) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issue');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconIssues;
    color = 'gray300';
  } else if (status === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__.IncidentStatus.CRITICAL) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Critical');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconFire;
    color = 'red300';
  } else if (status === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__.IncidentStatus.WARNING) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Warning');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconExclamation;
    color = 'yellow300';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Wrapper, {
    "data-test-id": "alert-badge",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(AlertIconWrapper, {
      color: color,
      icon: Icon,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertIconBackground, {
        color: color
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Icon, {
        color: "white"
      })]
    }), !hideText && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(IncidentStatusValue, {
      color: color,
      children: statusText
    })]
  });
}

AlertBadge.displayName = "AlertBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertBadge);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd3"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const AlertIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd2"
} : 0)("width:36px;height:36px;position:relative;svg:last-child{width:", p => p.icon === sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconIssues ? '13px' : '16px', ";z-index:2;position:absolute;top:0;bottom:0;left:0;right:0;margin:auto;}" + ( true ? "" : 0));

const AlertIconBackground = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconDiamond,  true ? {
  target: "ef4c9wd1"
} : 0)( true ? {
  name: "bgbjt4",
  styles: "width:36px;height:36px"
} : 0);

const IncidentStatusValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/charts/components/visualMap.tsx":
/*!********************************************************!*\
  !*** ./app/components/charts/components/visualMap.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VisualMap)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_visualMap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/visualMap */ "../node_modules/echarts/lib/component/visualMap.js");

function VisualMap(visualMap) {
  return visualMap;
}

/***/ }),

/***/ "./app/components/charts/errorPanel.tsx":
/*!**********************************************!*\
  !*** ./app/components/charts/errorPanel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const ErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1six6h50"
} : 0)("display:flex;flex-direction:column;justify-content:center;align-items:center;flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height || '200px', ";position:relative;border-color:transparent;margin-bottom:0;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorPanel);

/***/ }),

/***/ "./app/components/charts/eventsRequest.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/eventsRequest.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_omitBy__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omitBy */ "../node_modules/lodash/omitBy.js");
/* harmony import */ var lodash_omitBy__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omitBy__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














const propNamesToIgnore = ['api', 'children', 'organization', 'loading', 'queryBatching', 'generatePathname'];

const omitIgnoredProps = props => lodash_omitBy__WEBPACK_IMPORTED_MODULE_5___default()(props, (_value, key) => propNamesToIgnore.includes(key));

class EventsRequest extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      reloading: !!this.props.loading,
      errored: false,
      timeseriesData: null,
      fetchedWithPrevious: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unmounting", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        confirmedQuery,
        onError,
        expired,
        name,
        hideError,
        ...props
      } = this.props;
      let timeseriesData = null;

      if (confirmedQuery === false) {
        return;
      }

      this.setState(state => ({
        reloading: state.timeseriesData !== null,
        errored: false,
        errorMessage: undefined
      }));
      let errorMessage;

      if (expired) {
        errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('%s has an invalid date range. Please try a more recent date range.', name);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(errorMessage, {
          append: true
        });
        this.setState({
          errored: true,
          errorMessage
        });
      } else {
        try {
          api.clear();
          timeseriesData = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_6__.doEventsRequest)(api, props);
        } catch (resp) {
          if (resp && resp.responseJSON && resp.responseJSON.detail) {
            errorMessage = resp.responseJSON.detail;
          } else {
            errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Error loading chart data');
          }

          if (!hideError) {
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(errorMessage);
          }

          if (onError) {
            onError(errorMessage);
          }

          this.setState({
            errored: true,
            errorMessage
          });
        }
      }

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        timeseriesData,
        fetchedWithPrevious: props.includePrevious
      });

      if (props.dataLoadedCallback) {
        props.dataLoadedCallback(timeseriesData);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getData", data => {
      const {
        fetchedWithPrevious
      } = this.state;
      const {
        period,
        includePrevious
      } = this.props;
      const hasPreviousPeriod = fetchedWithPrevious || (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.canIncludePreviousPeriod)(includePrevious, period); // Take the floor just in case, but data should always be divisible by 2

      const dataMiddleIndex = Math.floor(data.length / 2);
      return {
        current: hasPreviousPeriod ? data.slice(dataMiddleIndex) : data,
        previous: hasPreviousPeriod ? data.slice(0, dataMiddleIndex) : null
      };
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(omitIgnoredProps(prevProps), omitIgnoredProps(this.props))) {
      return;
    }

    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  // This aggregates all values per `timestamp`
  calculateTotalsPerTimestamp(data) {
    let getName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : timestamp => timestamp * 1000;
    return data.map((_ref, i) => {
      let [timestamp, countArray] = _ref;
      return {
        name: getName(timestamp, countArray, i),
        value: countArray.reduce((acc, _ref2) => {
          let {
            count
          } = _ref2;
          return acc + count;
        }, 0)
      };
    });
  }
  /**
   * Get previous period data, but transform timestamps so that data fits unto
   * the current period's data axis
   */


  transformPreviousPeriodData(current, previous, seriesName) {
    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    if (!previous) {
      return null;
    }

    return {
      seriesName: seriesName !== null && seriesName !== void 0 ? seriesName : 'Previous',
      data: this.calculateTotalsPerTimestamp(previous, (_timestamp, _countArray, i) => current[i][0] * 1000),
      stack: 'previous'
    };
  }
  /**
   * Aggregate all counts for each time stamp
   */


  transformAggregatedTimeseries(data) {
    let seriesName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    return {
      seriesName,
      data: this.calculateTotalsPerTimestamp(data)
    };
  }
  /**
   * Transforms query response into timeseries data to be used in a chart
   */


  transformTimeseriesData(data, seriesName) {
    return [{
      seriesName: seriesName || 'Current',
      data: data.map(_ref3 => {
        let [timestamp, countsForTimestamp] = _ref3;
        return {
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, _ref4) => {
            let {
              count
            } = _ref4;
            return acc + count;
          }, 0)
        };
      })
    }];
  }
  /**
   * Transforms comparisonCount in query response into timeseries data to be used in a comparison chart for change alerts
   */


  transformComparisonTimeseriesData(data) {
    return [{
      seriesName: 'comparisonCount()',
      data: data.map(_ref5 => {
        let [timestamp, countsForTimestamp] = _ref5;
        return {
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, _ref6) => {
            let {
              comparisonCount
            } = _ref6;
            return acc + (comparisonCount !== null && comparisonCount !== void 0 ? comparisonCount : 0);
          }, 0)
        };
      })
    }];
  }

  processData(response) {
    var _ref7;

    let seriesIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    let seriesName = arguments.length > 2 ? arguments[2] : undefined;
    const {
      data,
      isMetricsData,
      totals
    } = response;
    const {
      includeTransformedData,
      includeTimeAggregation,
      timeAggregationSeriesName,
      currentSeriesNames,
      previousSeriesNames,
      comparisonDelta
    } = this.props;
    const {
      current,
      previous
    } = this.getData(data);
    const transformedData = includeTransformedData ? this.transformTimeseriesData(current, seriesName !== null && seriesName !== void 0 ? seriesName : currentSeriesNames === null || currentSeriesNames === void 0 ? void 0 : currentSeriesNames[seriesIndex]) : [];
    const transformedComparisonData = includeTransformedData && comparisonDelta ? this.transformComparisonTimeseriesData(current) : [];
    const previousData = includeTransformedData ? this.transformPreviousPeriodData(current, previous, (_ref7 = seriesName ? (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.getPreviousSeriesName)(seriesName) : undefined) !== null && _ref7 !== void 0 ? _ref7 : previousSeriesNames === null || previousSeriesNames === void 0 ? void 0 : previousSeriesNames[seriesIndex]) : null;
    const timeAggregatedData = includeTimeAggregation ? this.transformAggregatedTimeseries(current, timeAggregationSeriesName || '') : {};
    const timeframe = response.start && response.end ? !previous ? {
      start: response.start * 1000,
      end: response.end * 1000
    } : {
      // Find the midpoint of start & end since previous includes 2x data
      start: (response.start + response.end) * 500,
      end: response.end * 1000
    } : undefined;
    const processedData = {
      data: transformedData,
      comparisonData: transformedComparisonData,
      allData: data,
      originalData: current,
      totals,
      isMetricsData,
      originalPreviousData: previous,
      previousData,
      timeAggregatedData,
      timeframe
    };
    return processedData;
  }

  render() {
    const {
      children,
      showLoading,
      ...props
    } = this.props;
    const {
      topEvents
    } = this.props;
    const {
      timeseriesData,
      reloading,
      errored,
      errorMessage
    } = this.state; // Is "loading" if data is null

    const loading = this.props.loading || timeseriesData === null;

    if (showLoading && loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_8__["default"], {
        "data-test-id": "events-request-loading"
      });
    }

    if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.isMultiSeriesStats)(timeseriesData, (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(topEvents))) {
      // Convert multi-series results into chartable series. Multi series results
      // are created when multiple yAxis are used or a topEvents request is made.
      // Convert the timeseries data into a multi-series result set.
      // As the server will have replied with a map like:
      // {[titleString: string]: EventsStats}
      let timeframe = undefined;
      const seriesAdditionalInfo = {};
      const sortedTimeseriesData = Object.keys(timeseriesData).map((seriesName, index) => {
        const seriesData = timeseriesData[seriesName];
        const processedData = this.processData(seriesData, index, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_12__.stripEquationPrefix)(seriesName));

        if (!timeframe) {
          timeframe = processedData.timeframe;
        }

        if (processedData.isMetricsData) {
          seriesAdditionalInfo[seriesName] = {
            isMetricsData: processedData.isMetricsData
          };
        }

        return [seriesData.order || 0, processedData.data[0], processedData.previousData, {
          isMetricsData: processedData.isMetricsData
        }];
      }).sort((a, b) => a[0] - b[0]);
      const results = sortedTimeseriesData.map(item => {
        return item[1];
      });
      const previousTimeseriesData = sortedTimeseriesData.some(item => item[2] === null) ? undefined : sortedTimeseriesData.map(item => {
        return item[2];
      });
      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        results,
        timeframe,
        previousTimeseriesData,
        seriesAdditionalInfo,
        // sometimes we want to reference props that were given to EventsRequest
        ...props
      });
    }

    if (timeseriesData) {
      var _this$props$currentSe, _this$props$currentSe2;

      const {
        data: transformedTimeseriesData,
        comparisonData: transformedComparisonTimeseriesData,
        allData: allTimeseriesData,
        originalData: originalTimeseriesData,
        totals: timeseriesTotals,
        originalPreviousData: originalPreviousTimeseriesData,
        previousData: previousTimeseriesData,
        timeAggregatedData,
        timeframe,
        isMetricsData
      } = this.processData(timeseriesData);
      const seriesAdditionalInfo = {
        [(_this$props$currentSe = (_this$props$currentSe2 = this.props.currentSeriesNames) === null || _this$props$currentSe2 === void 0 ? void 0 : _this$props$currentSe2[0]) !== null && _this$props$currentSe !== void 0 ? _this$props$currentSe : 'current']: {
          isMetricsData
        }
      };
      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        // meta data,
        seriesAdditionalInfo,
        // timeseries data
        timeseriesData: transformedTimeseriesData,
        comparisonTimeseriesData: transformedComparisonTimeseriesData,
        allTimeseriesData,
        originalTimeseriesData,
        timeseriesTotals,
        originalPreviousTimeseriesData,
        previousTimeseriesData: previousTimeseriesData ? [previousTimeseriesData] : previousTimeseriesData,
        timeAggregatedData,
        timeframe,
        // sometimes we want to reference props that were given to EventsRequest
        ...props
      });
    }

    return children({
      loading,
      reloading,
      errored,
      errorMessage,
      ...props
    });
  }

}

EventsRequest.displayName = "EventsRequest";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(EventsRequest, "defaultProps", {
  period: undefined,
  start: null,
  end: null,
  interval: '1d',
  comparisonDelta: undefined,
  limit: 15,
  query: '',
  includePrevious: true,
  includeTransformedData: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsRequest);

/***/ }),

/***/ "./app/components/charts/lineChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/lineChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LineChart": () => (/* binding */ LineChart)
/* harmony export */ });
/* harmony import */ var _series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function LineChart(_ref) {
  let {
    series,
    seriesOptions,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    series: series.map(_ref2 => {
      let {
        seriesName,
        data,
        dataArray,
        ...options
      } = _ref2;
      return (0,_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...seriesOptions,
        ...options,
        name: seriesName,
        data: dataArray || (data === null || data === void 0 ? void 0 : data.map(_ref3 => {
          let {
            value,
            name
          } = _ref3;
          return [name, value];
        })),
        animation: false,
        animationThreshold: 1,
        animationDuration: 0
      });
    })
  });
}
LineChart.displayName = "LineChart";

/***/ }),

/***/ "./app/components/charts/loadingPanel.tsx":
/*!************************************************!*\
  !*** ./app/components/charts/loadingPanel.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const LoadingPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    height: _height,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__["default"], {})
  });
},  true ? {
  target: "eumb2md0"
} : 0)("flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height, ";position:relative;border-color:transparent;margin-bottom:0;" + ( true ? "" : 0));

LoadingPanel.defaultProps = {
  height: '200px'
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingPanel);

/***/ }),

/***/ "./app/components/charts/series/mapSeries.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/series/mapSeries.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MapSeries)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/map */ "../node_modules/echarts/lib/chart/map.js");

function MapSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
    map: ''
  };
  return {
    roam: true,
    ...props,
    emphasis: {
      label: {
        show: false
      },
      ...props.emphasis
    },
    type: 'map'
  };
}

/***/ }),

/***/ "./app/components/charts/stackedAreaChart.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/stackedAreaChart.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




class StackedAreaChart extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__.AreaChart, {
      tooltip: {
        filter: val => val > 0
      },
      ...this.props,
      stacked: true
    });
  }

}

StackedAreaChart.displayName = "StackedAreaChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StackedAreaChart);

/***/ }),

/***/ "./app/components/charts/transitionChart.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/transitionChart.tsx ***!
  \***************************************************/
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
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const defaultProps = {
  height: '200px'
};

class TransitionChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      prevReloading: this.props.reloading,
      prevLoading: this.props.loading,
      key: 1
    });
  }

  static getDerivedStateFromProps(props, state) {
    // Transitions are controlled using variables called:
    // - loading and,
    // - reloading (also called pending in other apps)
    //
    // This component remounts the chart to ensure the stable transition
    // from one dataset to the next.
    const prevReloading = state.prevReloading;
    const nextReloading = props.reloading;
    const prevLoading = state.prevLoading;
    const nextLoading = props.loading; // whenever loading changes, we explicitly remount the children by updating
    // the key prop; regardless of what state reloading is in

    if (prevLoading !== nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // invariant: prevLoading === nextLoading
    // if loading is true, and hasn't changed from the previous re-render,
    // do not remount the children.


    if (nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key
      };
    } // invariant: loading is false
    // whenever the chart is transitioning from the reloading (pending) state to a non-loading state,
    // remount the children


    if (prevReloading && !nextReloading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // do not remount the children in these remaining cases:
    // !prevReloading && !nextReloading (re-render with no prop change)
    // prevReloading && nextReloading (re-render with no prop change)
    // !prevReloading && nextReloading (from loaded to pending state)


    return {
      prevReloading: nextReloading,
      prevLoading: nextLoading,
      key: state.key
    };
  }

  render() {
    const {
      height,
      loading,
      reloading
    } = this.props;

    if (loading && !reloading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: height,
        "data-test-id": "events-request-loading"
      });
    } // We make use of the key prop to explicitly remount the children
    // https://reactjs.org/docs/lists-and-keys.html#keys


    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: this.props.children
    }, String(this.state.key));
  }

}

TransitionChart.displayName = "TransitionChart";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(TransitionChart, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransitionChart);

/***/ }),

/***/ "./app/components/charts/transparentLoadingMask.tsx":
/*!**********************************************************!*\
  !*** ./app/components/charts/transparentLoadingMask.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const TransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    className,
    visible,
    children,
    ...props
  } = _ref;
  const other = visible ? { ...props,
    'data-test-id': 'loading-placeholder'
  } : props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    ...other,
    children: children
  });
},  true ? {
  target: "ewtkxp50"
} : 0)(p => !p.visible && 'display: none;', ";opacity:0.4;z-index:1;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransparentLoadingMask);

/***/ }),

/***/ "./app/components/charts/worldMapChart.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/worldMapChart.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WorldMapChart": () => (/* binding */ WorldMapChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/lib/core/echarts.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/core.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/max */ "../node_modules/lodash/max.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_max__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _components_visualMap__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/visualMap */ "./app/components/charts/components/visualMap.tsx");
/* harmony import */ var _series_mapSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./series/mapSeries */ "./app/components/charts/series/mapSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const DEFAULT_ZOOM = 1.3;
const DISCOVER_ZOOM = 1.1;
const DISCOVER_QUERY_LIST_ZOOM = 0.9;
const DEFAULT_CENTER_X = 10.97;
const DISCOVER_QUERY_LIST_CENTER_Y = -12;
const DEFAULT_CENTER_Y = 9.71;
function WorldMapChart(_ref) {
  let {
    series,
    seriesOptions,
    fromDiscover,
    fromDiscoverQueryList,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(() => ({
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null
  }));
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    let unmounted = false;

    if (!unmounted) {
      loadWorldMap();
    }

    return () => {
      unmounted = true;
    };
  }, []);

  async function loadWorldMap() {
    try {
      var _echarts$registerMap;

      const [countryCodesMap, world] = await Promise.all([__webpack_require__.e(/*! import() */ "app_data_countryCodesMap_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/data/countryCodesMap */ "./app/data/countryCodesMap.tsx")), __webpack_require__.e(/*! import() */ "app_data_world_json").then(__webpack_require__.t.bind(__webpack_require__, /*! sentry/data/world.json */ "./app/data/world.json", 19))]);
      const countryToCodeMap = countryCodesMap.default;
      const worldMap = world.default; // Echarts not available in tests

      (_echarts$registerMap = echarts_core__WEBPACK_IMPORTED_MODULE_7__.registerMap) === null || _echarts$registerMap === void 0 ? void 0 : _echarts$registerMap.call(echarts_core__WEBPACK_IMPORTED_MODULE_8__, 'sentryWorld', worldMap);
      const codeToCountryMap = {};

      for (const country in worldMap) {
        codeToCountryMap[countryToCodeMap[country]] = country;
      }

      setState({
        countryToCodeMap,
        map: worldMap,
        codeToCountryMap
      });
    } catch {// do nothing
    }
  }

  if (state.countryToCodeMap === null || state.map === null) {
    return null;
  }

  const processedSeries = series.map(_ref2 => {
    var _state$countryToCodeM;

    let {
      seriesName,
      data,
      ...options
    } = _ref2;
    return (0,_series_mapSeries__WEBPACK_IMPORTED_MODULE_4__["default"])({ ...seriesOptions,
      ...options,
      map: 'sentryWorld',
      name: seriesName,
      nameMap: (_state$countryToCodeM = state.countryToCodeMap) !== null && _state$countryToCodeM !== void 0 ? _state$countryToCodeM : undefined,
      aspectScale: 0.85,
      zoom: fromDiscover ? DISCOVER_ZOOM : fromDiscoverQueryList ? DISCOVER_QUERY_LIST_ZOOM : DEFAULT_ZOOM,
      center: [DEFAULT_CENTER_X, fromDiscoverQueryList ? DISCOVER_QUERY_LIST_CENTER_Y : DEFAULT_CENTER_Y],
      itemStyle: {
        areaColor: theme.gray200,
        borderColor: theme.backgroundSecondary
      },
      emphasis: {
        itemStyle: {
          areaColor: theme.pink300
        },
        label: {
          show: false
        }
      },
      data,
      silent: fromDiscoverQueryList,
      roam: !fromDiscoverQueryList
    });
  }); // TODO(billy):
  // For absolute values, we want min/max to based on min/max of series
  // Otherwise it should be 0-100

  const maxValue = lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(series.map(_ref3 => {
    let {
      data
    } = _ref3;
    return lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(data.map(_ref4 => {
      let {
        value
      } = _ref4;
      return value;
    }));
  })) || 1;

  const tooltipFormatter = format => {
    var _state$codeToCountryM;

    const {
      marker,
      name,
      value
    } = Array.isArray(format) ? format[0] : format; // If value is NaN, don't show anything because we won't have a country code either

    if (isNaN(value)) {
      return '';
    } // `value` should be a number


    const formattedValue = typeof value === 'number' ? value.toLocaleString() : '';
    const countryOrCode = ((_state$codeToCountryM = state.codeToCountryMap) === null || _state$codeToCountryM === void 0 ? void 0 : _state$codeToCountryM[name]) || name;
    return [`<div class="tooltip-series tooltip-series-solo">
               <div><span class="tooltip-label">${marker} <strong>${countryOrCode}</strong></span> ${formattedValue}</div>
            </div>`, '<div class="tooltip-arrow"></div>'].join('');
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
    options: {
      backgroundColor: fromDiscoverQueryList ? undefined : theme.background,
      visualMap: [(0,_components_visualMap__WEBPACK_IMPORTED_MODULE_3__["default"])({
        show: !fromDiscoverQueryList,
        left: fromDiscover ? undefined : 'right',
        right: fromDiscover ? 5 : undefined,
        min: 0,
        max: maxValue,
        inRange: {
          color: [theme.purple200, theme.purple300]
        },
        text: ['High', 'Low'],
        textStyle: {
          color: theme.textColor
        },
        // Whether show handles, which can be dragged to adjust "selected range".
        // False because the handles are pretty ugly
        calculable: false
      })]
    },
    ...props,
    yAxis: null,
    xAxis: null,
    series: processedSeries,
    tooltip: {
      formatter: tooltipFormatter
    },
    height: fromDiscover ? 400 : undefined
  });
}
WorldMapChart.displayName = "WorldMapChart";

/***/ }),

/***/ "./app/components/createAlertButton.tsx":
/*!**********************************************!*\
  !*** ./app/components/createAlertButton.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CreateAlertFromViewButton": () => (/* binding */ CreateAlertFromViewButton),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


// eslint-disable-next-line no-restricted-imports













/**
 * Provide a button that can create an alert from an event view.
 * Emits incompatible query issues on click
 */
function CreateAlertFromViewButton(_ref) {
  var _queryParams$query, _queryParams$yAxis;

  let {
    projects,
    eventView,
    organization,
    referrer,
    onClick,
    alertType,
    disableMetricDataset,
    ...buttonProps
  } = _ref;
  const project = projects.find(p => p.id === `${eventView.project[0]}`);
  const queryParams = eventView.generateQueryStringObject();

  if ((_queryParams$query = queryParams.query) !== null && _queryParams$query !== void 0 && _queryParams$query.includes(`project:${project === null || project === void 0 ? void 0 : project.slug}`)) {
    queryParams.query = queryParams.query.replace(`project:${project === null || project === void 0 ? void 0 : project.slug}`, '');
  }

  const alertTemplate = alertType ? sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.AlertWizardRuleTemplates[alertType] : sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_12__.DEFAULT_WIZARD_TEMPLATE;
  const to = {
    pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
    query: { ...queryParams,
      createFromDiscover: true,
      disableMetricDataset,
      referrer,
      ...alertTemplate,
      project: project === null || project === void 0 ? void 0 : project.slug,
      aggregate: (_queryParams$yAxis = queryParams.yAxis) !== null && _queryParams$yAxis !== void 0 ? _queryParams$yAxis : alertTemplate.aggregate
    }
  };

  const handleClick = () => {
    onClick === null || onClick === void 0 ? void 0 : onClick();
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(CreateAlertButton, {
    organization: organization,
    onClick: handleClick,
    to: to,
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert'),
    ...buttonProps
  });
}

CreateAlertFromViewButton.displayName = "CreateAlertFromViewButton";
const CreateAlertButton = (0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(_ref2 => {
  let {
    organization,
    projectSlug,
    iconProps,
    referrer,
    router,
    hideIcon,
    showPermissionGuide,
    alertOption,
    onEnter,
    ...buttonProps
  } = _ref2;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();

  const createAlertUrl = providedProj => {
    const alertsBaseUrl = `/organizations/${organization.slug}/alerts`;
    const alertsArgs = [`${referrer ? `referrer=${referrer}` : ''}`, `${providedProj && providedProj !== ':projectId' ? `project=${providedProj}` : ''}`, alertOption ? `alert_option=${alertOption}` : ''].filter(item => item !== '');
    return `${alertsBaseUrl}/wizard/${alertsArgs.length ? '?' : ''}${alertsArgs.join('&')}`;
  };

  function handleClickWithoutProject(event) {
    event.preventDefault();
    onEnter === null || onEnter === void 0 ? void 0 : onEnter();
    (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_4__.navigateTo)(createAlertUrl(':projectId'), router);
  }

  async function enableAlertsMemberWrite() {
    const settingsEndpoint = `/organizations/${organization.slug}/`;
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addLoadingMessage)();

    try {
      await api.requestPromise(settingsEndpoint, {
        method: 'PUT',
        data: {
          alertsMemberWrite: true
        }
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Successfully updated organization settings'));
    } catch (err) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unable to update organization settings'));
    }
  }

  const permissionTooltipText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('Ask your organization owner or manager to [settingsLink:enable alerts access] for you.', {
    settingsLink: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
      to: `/settings/${organization.slug}`
    })
  });

  const renderButton = hasAccess => {
    var _buttonProps$children;

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
      disabled: !hasAccess,
      title: !hasAccess ? permissionTooltipText : undefined,
      icon: !hideIcon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconSiren, { ...iconProps
      }),
      to: projectSlug ? createAlertUrl(projectSlug) : undefined,
      tooltipProps: {
        isHoverable: true,
        position: 'top',
        overlayStyle: {
          maxWidth: '270px'
        }
      },
      onClick: projectSlug ? onEnter : handleClickWithoutProject,
      ...buttonProps,
      children: (_buttonProps$children = buttonProps.children) !== null && _buttonProps$children !== void 0 ? _buttonProps$children : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Create Alert')
    });
  };

  const showGuide = !organization.alertsMemberWrite && !!showPermissionGuide;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
    organization: organization,
    access: ['alerts:write'],
    children: _ref3 => {
      let {
        hasAccess
      } = _ref3;
      return showGuide ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
        organization: organization,
        access: ['org:write'],
        children: _ref4 => {
          let {
            hasAccess: isOrgAdmin
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__["default"], {
            target: isOrgAdmin ? 'alerts_write_owner' : 'alerts_write_member',
            onFinish: isOrgAdmin ? enableAlertsMemberWrite : undefined,
            children: renderButton(hasAccess)
          });
        }
      }) : renderButton(hasAccess);
    }
  });
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CreateAlertButton);

/***/ }),

/***/ "./app/components/discover/discoverFeature.tsx":
/*!*****************************************************!*\
  !*** ./app/components/discover/discoverFeature.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Provide a component that passes a prop to indicate if the current
 * organization doesn't have access to discover results.
 */
function DiscoverFeature(_ref) {
  let {
    children
  } = _ref;
  const noFeatureMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Requires discover feature.');

  const renderDisabled = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__.Hovercard, {
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], {
      features: p.features,
      hideHelpToggle: true,
      message: noFeatureMessage,
      featureName: noFeatureMessage
    }),
    children: p.children(p)
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    hookName: "feature-disabled:open-discover",
    features: ['organizations:discover-basic'],
    renderDisabled: renderDisabled,
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return children({
        hasFeature
      });
    }
  });
}

DiscoverFeature.displayName = "DiscoverFeature";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverFeature);

/***/ }),

/***/ "./app/components/discoverButton.tsx":
/*!*******************************************!*\
  !*** ./app/components/discoverButton.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/discover/discoverFeature */ "./app/components/discover/discoverFeature.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton(_ref) {
  let {
    children,
    ...buttonProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__["default"], {
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
        disabled: !hasFeature,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Open in Discover'),
        ...buttonProps,
        children: children
      });
    }
  });
}

DiscoverButton.displayName = "DiscoverButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverButton);

/***/ }),

/***/ "./app/components/globalAppStoreConnectUpdateAlert/index.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/globalAppStoreConnectUpdateAlert/index.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var _updateAlert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./updateAlert */ "./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function GlobalAppStoreConnectUpdateAlert(_ref) {
  let {
    project,
    organization,
    ...rest
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_0__.Provider, {
    project: project,
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_updateAlert__WEBPACK_IMPORTED_MODULE_1__["default"], {
      project: project,
      ...rest
    })
  });
}

GlobalAppStoreConnectUpdateAlert.displayName = "GlobalAppStoreConnectUpdateAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GlobalAppStoreConnectUpdateAlert);

/***/ }),

/***/ "./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx":
/*!*************************************************************************!*\
  !*** ./app/components/globalAppStoreConnectUpdateAlert/updateAlert.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/projects/appStoreConnectContext */ "./app/components/projects/appStoreConnectContext.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function UpdateAlert(_ref) {
  let {
    Wrapper,
    project,
    className
  } = _ref;
  const appStoreConnectContext = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(sentry_components_projects_appStoreConnectContext__WEBPACK_IMPORTED_MODULE_3__["default"]);

  if (!project || !appStoreConnectContext || !Object.keys(appStoreConnectContext).some(key => !!appStoreConnectContext[key].updateAlertMessage)) {
    return null;
  }

  const notices = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Notices, {
    className: className,
    children: Object.keys(appStoreConnectContext).map(key => {
      const {
        updateAlertMessage
      } = appStoreConnectContext[key];

      if (!updateAlertMessage) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(NoMarginBottomAlert, {
        type: "warning",
        showIcon: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertContent, {
          children: updateAlertMessage
        })
      }, key);
    })
  });

  return Wrapper ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Wrapper, {
    children: notices
  }) : notices;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UpdateAlert);

const Notices = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16hnbbm2"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(3), ";" + ( true ? "" : 0));

const NoMarginBottomAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e16hnbbm1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const AlertContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e16hnbbm0"
} : 0)("display:grid;grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/loadingMask.tsx":
/*!****************************************!*\
  !*** ./app/components/loadingMask.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const LoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dnwgq10"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border-radius:", p => p.theme.borderRadius, ";position:absolute;top:0;bottom:0;left:0;right:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingMask);

/***/ }),

/***/ "./app/components/projects/appStoreConnectContext.tsx":
/*!************************************************************!*\
  !*** ./app/components/projects/appStoreConnectContext.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Provider": () => (/* binding */ Provider),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/appStoreValidationErrorMessage */ "./app/utils/appStoreValidationErrorMessage.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const AppStoreConnectContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);

const Provider = _ref => {
  let {
    children,
    project,
    organization
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const [projectDetails, setProjectDetails] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  const [appStoreConnectStatusData, setAppStoreConnectStatusData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const appStoreConnectSymbolSources = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return (projectDetails !== null && projectDetails !== void 0 && projectDetails.symbolSources ? JSON.parse(projectDetails.symbolSources) : []).reduce((acc, _ref2) => {
      let {
        type,
        id,
        ...symbolSource
      } = _ref2;

      if (type.toLowerCase() === 'appstoreconnect') {
        acc[id] = {
          type,
          ...symbolSource
        };
      }

      return acc;
    }, {});
  }, [projectDetails === null || projectDetails === void 0 ? void 0 : projectDetails.symbolSources]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!project || projectDetails) {
      return undefined;
    }

    if (project.symbolSources) {
      setProjectDetails(project);
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${project.slug}/`).then(responseProjectDetails => {
      if (unmounted) {
        return;
      }

      setProjectDetails(responseProjectDetails);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [project, organization, api]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!projectDetails) {
      return undefined;
    }

    if (!Object.keys(appStoreConnectSymbolSources).length) {
      return undefined;
    }

    let unmounted = false;
    api.requestPromise(`/projects/${organization.slug}/${projectDetails.slug}/appstoreconnect/status/`).then(appStoreConnectStatus => {
      if (unmounted) {
        return;
      }

      setAppStoreConnectStatusData(appStoreConnectStatus);
    }).catch(() => {// We do not care about the error
    });
    return () => {
      unmounted = true;
    };
  }, [projectDetails, organization, appStoreConnectSymbolSources, api]);

  function getUpdateAlertMessage(respository, credentials) {
    if ((credentials === null || credentials === void 0 ? void 0 : credentials.status) === 'valid') {
      return undefined;
    }

    return (0,sentry_utils_appStoreValidationErrorMessage__WEBPACK_IMPORTED_MODULE_2__.getAppStoreValidationErrorMessage)(credentials, respository);
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(AppStoreConnectContext.Provider, {
    value: appStoreConnectStatusData && project ? Object.keys(appStoreConnectStatusData).reduce((acc, key) => {
      const appStoreConnect = appStoreConnectStatusData[key];
      return { ...acc,
        [key]: { ...appStoreConnect,
          updateAlertMessage: getUpdateAlertMessage({
            name: appStoreConnectSymbolSources[key].name,
            link: `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?customRepository=${key}`
          }, appStoreConnect.credentials)
        }
      };
    }, {}) : undefined,
    children: children
  });
};

Provider.displayName = "Provider";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AppStoreConnectContext);

/***/ }),

/***/ "./app/constants/notAvailableMessages.tsx":
/*!************************************************!*\
  !*** ./app/constants/notAvailableMessages.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const NOT_AVAILABLE_MESSAGES = {
  performance: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This view is only available with Performance Monitoring.'),
  discover: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This view is only available with Discover.'),
  releaseHealth: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('This view is only available with Release Health.')
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NOT_AVAILABLE_MESSAGES);

/***/ }),

/***/ "./app/utils/appStoreValidationErrorMessage.tsx":
/*!******************************************************!*\
  !*** ./app/utils/appStoreValidationErrorMessage.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAppStoreValidationErrorMessage": () => (/* binding */ getAppStoreValidationErrorMessage),
/* harmony export */   "unexpectedErrorMessage": () => (/* binding */ unexpectedErrorMessage)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const unexpectedErrorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('An unexpected error occurred while configuring the App Store Connect integration');
function getAppStoreValidationErrorMessage(error, repo) {
  switch (error.code) {
    case 'app-connect-authentication-error':
      return repo ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)('App Store Connect credentials are invalid or missing. [linkToCustomRepository]', {
        linkToCustomRepository: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_1__["default"], {
          to: repo.link,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.tct)("Make sure the credentials of the '[customRepositoryName]' repository are correct and exist.", {
            customRepositoryName: repo.name
          })
        })
      }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied App Store Connect credentials are invalid or missing.');

    case 'app-connect-forbidden-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('The supplied API key does not have sufficient permissions.');

    case 'app-connect-multiple-sources-error':
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Only one App Store Connect application is allowed in this project.');

    default:
      {
        // this shall not happen
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Unknown app store connect error.'));
        return unexpectedErrorMessage;
      }
  }
}

/***/ }),

/***/ "./app/utils/discover/genericDiscoverQuery.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/discover/genericDiscoverQuery.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GenericDiscoverQuery": () => (/* binding */ GenericDiscoverQuery),
/* harmony export */   "QueryError": () => (/* binding */ QueryError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "doDiscoverQuery": () => (/* binding */ doDiscoverQuery)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/organizationContext */ "./app/views/organizationContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class QueryError {
  // For debugging in case parseError picks a value that doesn't make sense.
  constructor(errorMessage, originalError) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "message", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "originalError", void 0);

    this.message = errorMessage;
    this.originalError = originalError;
  }

  getOriginalError() {
    return this.originalError;
  }

}

/**
 * Generic component for discover queries
 */
class _GenericDiscoverQuery extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isLoading: true,
      tableFetchID: undefined,
      error: null,
      tableData: null,
      pageLinks: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_shouldRefetchData", prevProps => {
      const thisAPIPayload = this.getPayload(this.props);
      const otherAPIPayload = this.getPayload(prevProps);
      return !(0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__.isAPIPayloadSimilar)(thisAPIPayload, otherAPIPayload) || prevProps.limit !== this.props.limit || prevProps.route !== this.props.route || prevProps.cursor !== this.props.cursor;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_parseError", error => {
      var _error$responseJSON;

      if (this.props.parseError) {
        return this.props.parseError(error);
      }

      if (!error) {
        return null;
      }

      const detail = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail;

      if (typeof detail === 'string') {
        return new QueryError(detail, error);
      }

      const message = detail === null || detail === void 0 ? void 0 : detail.message;

      if (typeof message === 'string') {
        return new QueryError(message, error);
      }

      const unknownError = new QueryError((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('An unknown error occurred.'), error);
      return unknownError;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        queryBatching,
        beforeFetch,
        afterFetch,
        didFetch,
        eventView,
        orgSlug,
        route,
        setError
      } = this.props;

      if (!eventView.isValid()) {
        return;
      }

      const url = `/organizations/${orgSlug}/${route}/`;
      const tableFetchID = Symbol(`tableFetchID`);
      const apiPayload = this.getPayload(this.props);
      this.setState({
        isLoading: true,
        tableFetchID
      });
      setError === null || setError === void 0 ? void 0 : setError(undefined);
      beforeFetch === null || beforeFetch === void 0 ? void 0 : beforeFetch(api); // clear any inflight requests since they are now stale

      api.clear();

      try {
        const [data,, resp] = await doDiscoverQuery(api, url, apiPayload, queryBatching);

        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        const tableData = afterFetch ? afterFetch(data, this.props) : data;
        didFetch === null || didFetch === void 0 ? void 0 : didFetch(tableData);
        this.setState(prevState => {
          var _resp$getResponseHead;

          return {
            isLoading: false,
            tableFetchID: undefined,
            error: null,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : prevState.pageLinks,
            tableData
          };
        });
      } catch (err) {
        const error = this._parseError(err);

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error,
          tableData: null
        });

        if (setError) {
          setError(error !== null && error !== void 0 ? error : undefined);
        }
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    // Reload data if the payload changes
    const refetchCondition = this._shouldRefetchData(prevProps); // or if we've moved from an invalid view state to a valid one,


    const eventViewValidation = prevProps.eventView.isValid() === false && this.props.eventView.isValid();
    const shouldRefetchExternal = this.props.shouldRefetchData ? this.props.shouldRefetchData(prevProps, this.props) : false;

    if (refetchCondition || eventViewValidation || shouldRefetchExternal) {
      this.fetchData();
    }
  }

  getPayload(props) {
    var _props$queryExtras;

    const {
      cursor,
      limit,
      noPagination,
      referrer
    } = props;
    const payload = this.props.getRequestPayload ? this.props.getRequestPayload(props) : props.eventView.getEventsAPIPayload(props.location, props.forceAppendRawQueryString);

    if (cursor) {
      payload.cursor = cursor;
    }

    if (limit) {
      payload.per_page = limit;
    }

    if (noPagination) {
      payload.noPagination = noPagination;
    }

    if (referrer) {
      payload.referrer = referrer;
    }

    Object.assign(payload, (_props$queryExtras = props.queryExtras) !== null && _props$queryExtras !== void 0 ? _props$queryExtras : {});
    return payload;
  }

  render() {
    const {
      isLoading,
      error,
      tableData,
      pageLinks
    } = this.state;
    const childrenProps = {
      isLoading,
      error,
      tableData,
      pageLinks
    };
    const children = this.props.children; // Explicitly setting type due to issues with generics and React's children

    return children === null || children === void 0 ? void 0 : children(childrenProps);
  }

}

_GenericDiscoverQuery.displayName = "_GenericDiscoverQuery";
// Shim to allow us to use generic discover query or any specialization with or without passing org slug or eventview, which are now contexts.
// This will help keep tests working and we can remove extra uses of context-provided props and update tests as we go.
function GenericDiscoverQuery(props) {
  var _useContext, _useContext2, _props$orgSlug, _props$eventView;

  const organizationSlug = (_useContext = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__.OrganizationContext)) === null || _useContext === void 0 ? void 0 : _useContext.slug;
  const performanceEventView = (_useContext2 = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__.PerformanceEventViewContext)) === null || _useContext2 === void 0 ? void 0 : _useContext2.eventView;
  const orgSlug = (_props$orgSlug = props.orgSlug) !== null && _props$orgSlug !== void 0 ? _props$orgSlug : organizationSlug;
  const eventView = (_props$eventView = props.eventView) !== null && _props$eventView !== void 0 ? _props$eventView : performanceEventView;

  if (orgSlug === undefined || eventView === undefined) {
    throw new Error('GenericDiscoverQuery requires both an orgSlug and eventView');
  }

  const _props = { ...props,
    orgSlug,
    eventView
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_GenericDiscoverQuery, { ..._props
  });
}
GenericDiscoverQuery.displayName = "GenericDiscoverQuery";
function doDiscoverQuery(api, url, params, queryBatching) {
  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, url, {
      query: params,
      includeAllArgs: true
    });
  }

  return api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
    query: { // marking params as any so as to not cause typescript errors
      ...params
    }
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GenericDiscoverQuery);

/***/ }),

/***/ "./app/utils/getPeriod.tsx":
/*!*********************************!*\
  !*** ./app/utils/getPeriod.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getPeriod": () => (/* binding */ getPeriod)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");






/**
 * Gets the period to query with if we need to double the initial period in order
 * to get data for the previous period
 *
 * Returns an object with either a period or start/end dates ({statsPeriod: string} or {start: string, end: string})
 */
function getPeriod(_ref) {
  let {
    period,
    start,
    end
  } = _ref;
  let {
    shouldDoublePeriod
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!period && !start && !end) {
    period = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_STATS_PERIOD;
  } // you can not specify both relative and absolute periods
  // relative period takes precedence


  if (period) {
    if (!shouldDoublePeriod) {
      return {
        statsPeriod: period
      };
    }

    const [, periodNumber, periodLength] = period.match(/([0-9]+)([mhdw])/);
    return {
      statsPeriod: `${parseInt(periodNumber, 10) * 2}${periodLength}`
    };
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  const formattedStart = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(start);
  const formattedEnd = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(end);

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment__WEBPACK_IMPORTED_MODULE_2___default()(end).diff(moment__WEBPACK_IMPORTED_MODULE_2___default()(start));
    const previousPeriodStart = moment__WEBPACK_IMPORTED_MODULE_2___default()(start).subtract(diff); // This is not as accurate as having 2 start/end objs

    return {
      start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(previousPeriodStart),
      end: formattedEnd
    };
  }

  return {
    start: formattedStart,
    end: formattedEnd
  };
}

/***/ }),

/***/ "./app/utils/performance/contexts/performanceEventViewContext.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/contexts/performanceEventViewContext.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceEventViewContext": () => (/* binding */ PerformanceEventViewContext),
/* harmony export */   "PerformanceEventViewProvider": () => (/* binding */ PerformanceEventViewProvider),
/* harmony export */   "useMutablePerformanceEventView": () => (/* binding */ useMutablePerformanceEventView),
/* harmony export */   "usePerformanceEventView": () => (/* binding */ usePerformanceEventView)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");


const [PerformanceEventViewProvider, _usePerformanceEventView, PerformanceEventViewContext] = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.createDefinedContext)({
  name: 'PerformanceEventViewContext'
});
 // Provides a readonly event view. Also omits anything that isn't currently read-only, although in the future we should switch the code in EventView instead.
// If you need mutability, use the mutable version.

function usePerformanceEventView() {
  return _usePerformanceEventView().eventView;
}
function useMutablePerformanceEventView() {
  return usePerformanceEventView().clone();
}

/***/ }),

/***/ "./app/utils/performance/contexts/utils.tsx":
/*!**************************************************!*\
  !*** ./app/utils/performance/contexts/utils.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createDefinedContext": () => (/* binding */ createDefinedContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");



/*
 * Creates provider, context and useContext hook, guarding against calling useContext without a provider.
 * [0]: https://github.com/chakra-ui/chakra-ui/blob/c0f9c287df0397e2aa9bd90eb3d5c2f2c08aa0b1/packages/utils/src/react-helpers.ts#L27
 *
 * Renamed to createDefinedContext to not conflate with React context.
 */
function createDefinedContext(options) {
  const {
    strict = true,
    errorMessage = `useContext for "${options.name}" must be inside a Provider with a value`,
    name
  } = options;
  const Context = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);
  Context.displayName = name;

  function useDefinedContext() {
    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(Context);

    if (!context && strict) {
      throw new Error(errorMessage);
    }

    return context;
  }

  return [Context.Provider, useDefinedContext, Context];
}

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

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function routeTitleGen(routeName, orgSlug) {
  let withSentry = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let projectSlug = arguments.length > 3 ? arguments[3] : undefined;
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (routeTitleGen);

/***/ }),

/***/ "./app/utils/sessions.tsx":
/*!********************************!*\
  !*** ./app/utils/sessions.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MINUTES_THRESHOLD_TO_DISPLAY_SECONDS": () => (/* binding */ MINUTES_THRESHOLD_TO_DISPLAY_SECONDS),
/* harmony export */   "filterSessionsInTimeWindow": () => (/* binding */ filterSessionsInTimeWindow),
/* harmony export */   "getAdoptionSeries": () => (/* binding */ getAdoptionSeries),
/* harmony export */   "getCount": () => (/* binding */ getCount),
/* harmony export */   "getCountAtIndex": () => (/* binding */ getCountAtIndex),
/* harmony export */   "getCountSeries": () => (/* binding */ getCountSeries),
/* harmony export */   "getCrashFreeRate": () => (/* binding */ getCrashFreeRate),
/* harmony export */   "getCrashFreeRateSeries": () => (/* binding */ getCrashFreeRateSeries),
/* harmony export */   "getSeriesAverage": () => (/* binding */ getSeriesAverage),
/* harmony export */   "getSeriesSum": () => (/* binding */ getSeriesSum),
/* harmony export */   "getSessionP50Series": () => (/* binding */ getSessionP50Series),
/* harmony export */   "getSessionStatusRate": () => (/* binding */ getSessionStatusRate),
/* harmony export */   "getSessionStatusRateSeries": () => (/* binding */ getSessionStatusRateSeries),
/* harmony export */   "getSessionsInterval": () => (/* binding */ getSessionsInterval),
/* harmony export */   "initSessionsChart": () => (/* binding */ initSessionsChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_compact__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/compact */ "../node_modules/lodash/compact.js");
/* harmony import */ var lodash_compact__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_compact__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_mean__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/mean */ "../node_modules/lodash/mean.js");
/* harmony import */ var lodash_mean__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_mean__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/releases/utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");









/**
 * If the time window is less than or equal 10, seconds will be displayed on the graphs
 */

const MINUTES_THRESHOLD_TO_DISPLAY_SECONDS = 10;
function getCount() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  return groups.reduce((acc, group) => acc + group.totals[field], 0);
}
function getCountAtIndex() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  let index = arguments.length > 2 ? arguments[2] : undefined;
  return groups.reduce((acc, group) => acc + group.series[field][index], 0);
}
function getCrashFreeRate() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  const crashedRate = getSessionStatusRate(groups, field, sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.CRASHED);
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(crashedRate) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_7__.getCrashFreePercent)(100 - crashedRate) : null;
}
function getSeriesAverage() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  const totalCount = getCount(groups, field);
  const dataPoints = groups.filter(group => !!group.totals[field]).length;
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(totalCount) || dataPoints === null || totalCount === 0 ? null : totalCount / dataPoints;
}
function getSeriesSum() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  let intervals = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  const dataPointsSums = Array(intervals.length).fill(0);
  const groupSeries = groups.map(group => group.series[field]);
  groupSeries.forEach(series => {
    series.forEach((dataPoint, idx) => dataPointsSums[idx] += dataPoint);
  });
  return dataPointsSums;
}
function getSessionStatusRate() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let field = arguments.length > 1 ? arguments[1] : undefined;
  let status = arguments.length > 2 ? arguments[2] : undefined;
  const totalCount = getCount(groups, field);
  const crashedCount = getCount(groups.filter(_ref => {
    let {
      by
    } = _ref;
    return by['session.status'] === status;
  }), field);
  return !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(totalCount) || totalCount === 0 ? null : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.percent)(crashedCount !== null && crashedCount !== void 0 ? crashedCount : 0, totalCount !== null && totalCount !== void 0 ? totalCount : 0);
}
function getCrashFreeRateSeries() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let intervals = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let field = arguments.length > 2 ? arguments[2] : undefined;
  return lodash_compact__WEBPACK_IMPORTED_MODULE_1___default()(intervals.map((interval, i) => {
    var _groups$find$series$f, _groups$find, _groups$find$series$f2;

    const intervalTotalSessions = groups.reduce((acc, group) => {
      var _group$series$field$i, _group$series$field;

      return acc + ((_group$series$field$i = (_group$series$field = group.series[field]) === null || _group$series$field === void 0 ? void 0 : _group$series$field[i]) !== null && _group$series$field$i !== void 0 ? _group$series$field$i : 0);
    }, 0);
    const intervalCrashedSessions = (_groups$find$series$f = (_groups$find = groups.find(group => group.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.CRASHED)) === null || _groups$find === void 0 ? void 0 : (_groups$find$series$f2 = _groups$find.series[field]) === null || _groups$find$series$f2 === void 0 ? void 0 : _groups$find$series$f2[i]) !== null && _groups$find$series$f !== void 0 ? _groups$find$series$f : 0;
    const crashedSessionsPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.percent)(intervalCrashedSessions, intervalTotalSessions);

    if (intervalTotalSessions === 0) {
      return null;
    }

    return {
      name: interval,
      value: (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_7__.getCrashFreePercent)(100 - crashedSessionsPercent)
    };
  }));
}
function getSessionStatusRateSeries() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let intervals = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let field = arguments.length > 2 ? arguments[2] : undefined;
  let status = arguments.length > 3 ? arguments[3] : undefined;
  return lodash_compact__WEBPACK_IMPORTED_MODULE_1___default()(intervals.map((interval, i) => {
    var _groups$find$series$f3, _groups$find2;

    const intervalTotalSessions = groups.reduce((acc, group) => acc + group.series[field][i], 0);
    const intervalStatusSessions = (_groups$find$series$f3 = (_groups$find2 = groups.find(group => group.by['session.status'] === status)) === null || _groups$find2 === void 0 ? void 0 : _groups$find2.series[field][i]) !== null && _groups$find$series$f3 !== void 0 ? _groups$find$series$f3 : 0;
    const statusSessionsPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.percent)(intervalStatusSessions, intervalTotalSessions);

    if (intervalTotalSessions === 0) {
      return null;
    }

    return {
      name: interval,
      value: (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_7__.getSessionStatusPercent)(statusSessionsPercent)
    };
  }));
}
function getSessionP50Series() {
  let groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let intervals = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let field = arguments.length > 2 ? arguments[2] : undefined;
  let valueFormatter = arguments.length > 3 ? arguments[3] : undefined;
  return lodash_compact__WEBPACK_IMPORTED_MODULE_1___default()(intervals.map((interval, i) => {
    const meanValue = lodash_mean__WEBPACK_IMPORTED_MODULE_2___default()(groups.map(group => group.series[field][i]).filter(v => !!v));

    if (!meanValue) {
      return null;
    }

    return {
      name: interval,
      value: typeof valueFormatter === 'function' ? valueFormatter(meanValue) : meanValue
    };
  }));
}
function getAdoptionSeries() {
  let releaseGroups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let allGroups = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let intervals = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  let field = arguments.length > 3 ? arguments[3] : undefined;
  return intervals.map((interval, i) => {
    const intervalReleaseSessions = releaseGroups.reduce((acc, group) => {
      var _group$series$field$i2, _group$series$field2;

      return acc + ((_group$series$field$i2 = (_group$series$field2 = group.series[field]) === null || _group$series$field2 === void 0 ? void 0 : _group$series$field2[i]) !== null && _group$series$field$i2 !== void 0 ? _group$series$field$i2 : 0);
    }, 0);
    const intervalTotalSessions = allGroups.reduce((acc, group) => {
      var _group$series$field$i3, _group$series$field3;

      return acc + ((_group$series$field$i3 = (_group$series$field3 = group.series[field]) === null || _group$series$field3 === void 0 ? void 0 : _group$series$field3[i]) !== null && _group$series$field$i3 !== void 0 ? _group$series$field$i3 : 0);
    }, 0);
    const intervalAdoption = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.percent)(intervalReleaseSessions, intervalTotalSessions);
    return {
      name: interval,
      value: Math.round(intervalAdoption)
    };
  });
}
function getCountSeries(field, group) {
  let intervals = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  return intervals.map((interval, index) => {
    var _group$series$field$i4;

    return {
      name: interval,
      value: (_group$series$field$i4 = group === null || group === void 0 ? void 0 : group.series[field][index]) !== null && _group$series$field$i4 !== void 0 ? _group$series$field$i4 : 0
    };
  });
}
function initSessionsChart(theme) {
  const colors = theme.charts.getColorPalette(14);
  return {
    [sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.HEALTHY]: {
      seriesName: sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_8__.sessionTerm.healthy,
      data: [],
      color: theme.green300,
      areaStyle: {
        color: theme.green300,
        opacity: 1
      },
      lineStyle: {
        opacity: 0,
        width: 0.4
      }
    },
    [sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.ERRORED]: {
      seriesName: sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_8__.sessionTerm.errored,
      data: [],
      color: colors[12],
      areaStyle: {
        color: colors[12],
        opacity: 1
      },
      lineStyle: {
        opacity: 0,
        width: 0.4
      }
    },
    [sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.ABNORMAL]: {
      seriesName: sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_8__.sessionTerm.abnormal,
      data: [],
      color: colors[15],
      areaStyle: {
        color: colors[15],
        opacity: 1
      },
      lineStyle: {
        opacity: 0,
        width: 0.4
      }
    },
    [sentry_types__WEBPACK_IMPORTED_MODULE_5__.SessionStatus.CRASHED]: {
      seriesName: sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_8__.sessionTerm.crashed,
      data: [],
      color: theme.red300,
      areaStyle: {
        color: theme.red300,
        opacity: 1
      },
      lineStyle: {
        opacity: 0,
        width: 0.4
      }
    }
  };
}
function getSessionsInterval(datetimeObj) {
  let {
    highFidelity
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const diffInMinutes = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getDiffInMinutes)(datetimeObj);

  if (moment__WEBPACK_IMPORTED_MODULE_3___default()(datetimeObj.start).isSameOrBefore(moment__WEBPACK_IMPORTED_MODULE_3___default()().subtract(30, 'days'))) {
    // we cannot use sub-hour session resolution on buckets older than 30 days
    highFidelity = false;
  }

  if (diffInMinutes >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.SIXTY_DAYS) {
    return '1d';
  }

  if (diffInMinutes >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.THIRTY_DAYS) {
    return '4h';
  }

  if (diffInMinutes >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.SIX_HOURS) {
    return '1h';
  } // limit on backend for sub-hour session resolution is set to six hours


  if (highFidelity) {
    if (diffInMinutes <= MINUTES_THRESHOLD_TO_DISPLAY_SECONDS) {
      // This only works for metrics-based session stats.
      // Backend will silently replace with '1m' for session-based stats.
      return '10s';
    }

    if (diffInMinutes <= 30) {
      return '1m';
    }

    return '5m';
  }

  return '1h';
} // Sessions API can only round intervals to the closest hour - this is especially problematic when using sub-hour resolution.
// We filter out results that are out of bounds on frontend and recalculate totals.

function filterSessionsInTimeWindow(sessions, start, end) {
  if (!start || !end) {
    return sessions;
  }

  const filteredIndexes = [];
  const intervals = sessions.intervals.filter((interval, index) => {
    const isBetween = moment__WEBPACK_IMPORTED_MODULE_3___default().utc(interval).isBetween(moment__WEBPACK_IMPORTED_MODULE_3___default().utc(start), moment__WEBPACK_IMPORTED_MODULE_3___default().utc(end), undefined, '[]');

    if (isBetween) {
      filteredIndexes.push(index);
    }

    return isBetween;
  });
  const groups = sessions.groups.map(group => {
    const series = {};
    const totals = {};
    Object.keys(group.series).forEach(field => {
      totals[field] = 0;
      series[field] = group.series[field].filter((value, index) => {
        const isBetween = filteredIndexes.includes(index);

        if (isBetween) {
          var _totals$field;

          totals[field] = ((_totals$field = totals[field]) !== null && _totals$field !== void 0 ? _totals$field : 0) + value;
        }

        return isBetween;
      });

      if (field.startsWith('p50')) {
        totals[field] = lodash_mean__WEBPACK_IMPORTED_MODULE_2___default()(series[field]);
      }

      if (field.startsWith('count_unique')) {
        /* E.g. users
        We cannot sum here because users would not be unique anymore.
        User can be repeated and part of multiple buckets in series but it's still that one user so totals would be wrong.
        This operation is not 100% correct, because we are filtering series in time window but the total is for unfiltered series (it's the closest thing we can do right now) */
        totals[field] = group.totals[field];
      }
    });
    return { ...group,
      series,
      totals
    };
  });
  return {
    start: intervals[0],
    end: intervals[intervals.length - 1],
    query: sessions.query,
    intervals,
    groups
  };
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/types.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/rules/metric/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionLabel": () => (/* binding */ ActionLabel),
/* harmony export */   "ActionType": () => (/* binding */ ActionType),
/* harmony export */   "AlertRuleComparisonType": () => (/* binding */ AlertRuleComparisonType),
/* harmony export */   "AlertRuleThresholdType": () => (/* binding */ AlertRuleThresholdType),
/* harmony export */   "AlertRuleTriggerType": () => (/* binding */ AlertRuleTriggerType),
/* harmony export */   "Dataset": () => (/* binding */ Dataset),
/* harmony export */   "Datasource": () => (/* binding */ Datasource),
/* harmony export */   "EventTypes": () => (/* binding */ EventTypes),
/* harmony export */   "SessionsAggregate": () => (/* binding */ SessionsAggregate),
/* harmony export */   "TargetLabel": () => (/* binding */ TargetLabel),
/* harmony export */   "TargetType": () => (/* binding */ TargetType),
/* harmony export */   "TimePeriod": () => (/* binding */ TimePeriod),
/* harmony export */   "TimeWindow": () => (/* binding */ TimeWindow)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let AlertRuleThresholdType;

(function (AlertRuleThresholdType) {
  AlertRuleThresholdType[AlertRuleThresholdType["ABOVE"] = 0] = "ABOVE";
  AlertRuleThresholdType[AlertRuleThresholdType["BELOW"] = 1] = "BELOW";
})(AlertRuleThresholdType || (AlertRuleThresholdType = {}));

let AlertRuleTriggerType;

(function (AlertRuleTriggerType) {
  AlertRuleTriggerType["CRITICAL"] = "critical";
  AlertRuleTriggerType["WARNING"] = "warning";
  AlertRuleTriggerType["RESOLVE"] = "resolve";
})(AlertRuleTriggerType || (AlertRuleTriggerType = {}));

let AlertRuleComparisonType;

(function (AlertRuleComparisonType) {
  AlertRuleComparisonType["COUNT"] = "count";
  AlertRuleComparisonType["CHANGE"] = "change";
  AlertRuleComparisonType["PERCENT"] = "percent";
})(AlertRuleComparisonType || (AlertRuleComparisonType = {}));

let Dataset;

(function (Dataset) {
  Dataset["ERRORS"] = "events";
  Dataset["TRANSACTIONS"] = "transactions";
  Dataset["GENERIC_METRICS"] = "generic_metrics";
  Dataset["SESSIONS"] = "sessions";
  Dataset["METRICS"] = "metrics";
})(Dataset || (Dataset = {}));

let EventTypes;

(function (EventTypes) {
  EventTypes["DEFAULT"] = "default";
  EventTypes["ERROR"] = "error";
  EventTypes["TRANSACTION"] = "transaction";
  EventTypes["USER"] = "user";
  EventTypes["SESSION"] = "session";
})(EventTypes || (EventTypes = {}));

let Datasource;
/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */

(function (Datasource) {
  Datasource["ERROR_DEFAULT"] = "error_default";
  Datasource["DEFAULT"] = "default";
  Datasource["ERROR"] = "error";
  Datasource["TRANSACTION"] = "transaction";
})(Datasource || (Datasource = {}));

let SessionsAggregate;

(function (SessionsAggregate) {
  SessionsAggregate["CRASH_FREE_SESSIONS"] = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate";
  SessionsAggregate["CRASH_FREE_USERS"] = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate";
})(SessionsAggregate || (SessionsAggregate = {}));

let TimePeriod;

(function (TimePeriod) {
  TimePeriod["SIX_HOURS"] = "6h";
  TimePeriod["ONE_DAY"] = "1d";
  TimePeriod["THREE_DAYS"] = "3d";
  TimePeriod["SEVEN_DAYS"] = "10000m";
  TimePeriod["FOURTEEN_DAYS"] = "14d";
  TimePeriod["THIRTY_DAYS"] = "30d";
})(TimePeriod || (TimePeriod = {}));

let TimeWindow;

(function (TimeWindow) {
  TimeWindow[TimeWindow["ONE_MINUTE"] = 1] = "ONE_MINUTE";
  TimeWindow[TimeWindow["FIVE_MINUTES"] = 5] = "FIVE_MINUTES";
  TimeWindow[TimeWindow["TEN_MINUTES"] = 10] = "TEN_MINUTES";
  TimeWindow[TimeWindow["FIFTEEN_MINUTES"] = 15] = "FIFTEEN_MINUTES";
  TimeWindow[TimeWindow["THIRTY_MINUTES"] = 30] = "THIRTY_MINUTES";
  TimeWindow[TimeWindow["ONE_HOUR"] = 60] = "ONE_HOUR";
  TimeWindow[TimeWindow["TWO_HOURS"] = 120] = "TWO_HOURS";
  TimeWindow[TimeWindow["FOUR_HOURS"] = 240] = "FOUR_HOURS";
  TimeWindow[TimeWindow["ONE_DAY"] = 1440] = "ONE_DAY";
})(TimeWindow || (TimeWindow = {}));

let ActionType;

(function (ActionType) {
  ActionType["EMAIL"] = "email";
  ActionType["SLACK"] = "slack";
  ActionType["PAGERDUTY"] = "pagerduty";
  ActionType["MSTEAMS"] = "msteams";
  ActionType["SENTRY_APP"] = "sentry_app";
})(ActionType || (ActionType = {}));

const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Emai\u200Bl'),
  [ActionType.SLACK]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slack'),
  [ActionType.PAGERDUTY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Pagerduty'),
  [ActionType.MSTEAMS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MS Teams'),
  [ActionType.SENTRY_APP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notification')
};
let TargetType;

(function (TargetType) {
  TargetType["SPECIFIC"] = "specific";
  TargetType["USER"] = "user";
  TargetType["TEAM"] = "team";
  TargetType["SENTRY_APP"] = "sentry_app";
})(TargetType || (TargetType = {}));

const TargetLabel = {
  [TargetType.USER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Member'),
  [TargetType.TEAM]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Team')
};
/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */

/***/ }),

/***/ "./app/views/alerts/types.tsx":
/*!************************************!*\
  !*** ./app/views/alerts/types.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertRuleStatus": () => (/* binding */ AlertRuleStatus),
/* harmony export */   "AlertRuleType": () => (/* binding */ AlertRuleType),
/* harmony export */   "CombinedAlertType": () => (/* binding */ CombinedAlertType),
/* harmony export */   "IncidentActivityType": () => (/* binding */ IncidentActivityType),
/* harmony export */   "IncidentStatus": () => (/* binding */ IncidentStatus),
/* harmony export */   "IncidentStatusMethod": () => (/* binding */ IncidentStatusMethod)
/* harmony export */ });
let AlertRuleType;

(function (AlertRuleType) {
  AlertRuleType["METRIC"] = "metric";
  AlertRuleType["ISSUE"] = "issue";
})(AlertRuleType || (AlertRuleType = {}));

let IncidentActivityType;

(function (IncidentActivityType) {
  IncidentActivityType[IncidentActivityType["CREATED"] = 0] = "CREATED";
  IncidentActivityType[IncidentActivityType["DETECTED"] = 1] = "DETECTED";
  IncidentActivityType[IncidentActivityType["STATUS_CHANGE"] = 2] = "STATUS_CHANGE";
  IncidentActivityType[IncidentActivityType["COMMENT"] = 3] = "COMMENT";
  IncidentActivityType[IncidentActivityType["STARTED"] = 4] = "STARTED";
})(IncidentActivityType || (IncidentActivityType = {}));

let IncidentStatus;

(function (IncidentStatus) {
  IncidentStatus[IncidentStatus["OPENED"] = 1] = "OPENED";
  IncidentStatus[IncidentStatus["CLOSED"] = 2] = "CLOSED";
  IncidentStatus[IncidentStatus["WARNING"] = 10] = "WARNING";
  IncidentStatus[IncidentStatus["CRITICAL"] = 20] = "CRITICAL";
})(IncidentStatus || (IncidentStatus = {}));

let IncidentStatusMethod;

(function (IncidentStatusMethod) {
  IncidentStatusMethod[IncidentStatusMethod["MANUAL"] = 1] = "MANUAL";
  IncidentStatusMethod[IncidentStatusMethod["RULE_UPDATED"] = 2] = "RULE_UPDATED";
  IncidentStatusMethod[IncidentStatusMethod["RULE_TRIGGERED"] = 3] = "RULE_TRIGGERED";
})(IncidentStatusMethod || (IncidentStatusMethod = {}));

let AlertRuleStatus;

(function (AlertRuleStatus) {
  AlertRuleStatus[AlertRuleStatus["PENDING"] = 0] = "PENDING";
  AlertRuleStatus[AlertRuleStatus["SNAPSHOT"] = 4] = "SNAPSHOT";
  AlertRuleStatus[AlertRuleStatus["DISABLED"] = 5] = "DISABLED";
})(AlertRuleStatus || (AlertRuleStatus = {}));

let CombinedAlertType;

(function (CombinedAlertType) {
  CombinedAlertType["METRIC"] = "alert_rule";
  CombinedAlertType["ISSUE"] = "rule";
})(CombinedAlertType || (CombinedAlertType = {}));

/***/ }),

/***/ "./app/views/alerts/wizard/options.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/wizard/options.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertWizardAlertNames": () => (/* binding */ AlertWizardAlertNames),
/* harmony export */   "AlertWizardRuleTemplates": () => (/* binding */ AlertWizardRuleTemplates),
/* harmony export */   "DEFAULT_WIZARD_TEMPLATE": () => (/* binding */ DEFAULT_WIZARD_TEMPLATE),
/* harmony export */   "DatasetMEPAlertQueryTypes": () => (/* binding */ DatasetMEPAlertQueryTypes),
/* harmony export */   "MEPAlertsDataset": () => (/* binding */ MEPAlertsDataset),
/* harmony export */   "MEPAlertsQueryType": () => (/* binding */ MEPAlertsQueryType),
/* harmony export */   "getAlertWizardCategories": () => (/* binding */ getAlertWizardCategories),
/* harmony export */   "getMEPAlertsDataset": () => (/* binding */ getMEPAlertsDataset),
/* harmony export */   "hideParameterSelectorSet": () => (/* binding */ hideParameterSelectorSet),
/* harmony export */   "hidePrimarySelectorSet": () => (/* binding */ hidePrimarySelectorSet)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");




let MEPAlertsQueryType;

(function (MEPAlertsQueryType) {
  MEPAlertsQueryType[MEPAlertsQueryType["ERROR"] = 0] = "ERROR";
  MEPAlertsQueryType[MEPAlertsQueryType["PERFORMANCE"] = 1] = "PERFORMANCE";
  MEPAlertsQueryType[MEPAlertsQueryType["CRASH_RATE"] = 2] = "CRASH_RATE";
})(MEPAlertsQueryType || (MEPAlertsQueryType = {}));

let MEPAlertsDataset;

(function (MEPAlertsDataset) {
  MEPAlertsDataset["DISCOVER"] = "discover";
  MEPAlertsDataset["METRICS"] = "metrics";
  MEPAlertsDataset["METRICS_ENHANCED"] = "metricsEnhanced";
})(MEPAlertsDataset || (MEPAlertsDataset = {}));

const DatasetMEPAlertQueryTypes = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS]: MEPAlertsQueryType.ERROR,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS]: MEPAlertsQueryType.PERFORMANCE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.METRICS]: MEPAlertsQueryType.CRASH_RATE,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS]: MEPAlertsQueryType.CRASH_RATE
};
const AlertWizardAlertNames = {
  issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issues'),
  num_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Number of Errors'),
  users_experiencing_errors: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Users Experiencing Errors'),
  throughput: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Throughput'),
  trans_duration: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Transaction Duration'),
  apdex: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Apdex'),
  failure_rate: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Failure Rate'),
  lcp: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Largest Contentful Paint'),
  fid: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('First Input Delay'),
  cls: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Cumulative Layout Shift'),
  custom: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Custom Metric'),
  crash_free_sessions: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free Session Rate'),
  crash_free_users: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Crash Free User Rate')
};
const getAlertWizardCategories = org => [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Errors'),
  options: ['issues', 'num_errors', 'users_experiencing_errors']
}, ...(org.features.includes('crash-rate-alerts') ? [{
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sessions'),
  options: ['crash_free_sessions', 'crash_free_users']
}] : []), {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Performance'),
  options: ['throughput', 'trans_duration', 'apdex', 'failure_rate', 'lcp', 'fid', 'cls']
}, {
  categoryHeading: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Other'),
  options: ['custom']
}];
const AlertWizardRuleTemplates = {
  num_errors: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  users_experiencing_errors: {
    aggregate: 'count_unique(user)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.ERROR
  },
  throughput: {
    aggregate: 'count()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  trans_duration: {
    aggregate: 'p95(transaction.duration)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  apdex: {
    aggregate: 'apdex(300)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  failure_rate: {
    aggregate: 'failure_rate()',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  lcp: {
    aggregate: 'p95(measurements.lcp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  fid: {
    aggregate: 'p95(measurements.fid)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  cls: {
    aggregate: 'p95(measurements.cls)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  custom: {
    aggregate: 'p95(measurements.fp)',
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION
  },
  crash_free_sessions: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_SESSIONS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.SESSION
  },
  crash_free_users: {
    aggregate: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.SessionsAggregate.CRASH_FREE_USERS,
    // TODO(scttcper): Use Dataset.Metric on GA of alert-crash-free-metrics
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.SESSIONS,
    eventTypes: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.USER
  }
};
const DEFAULT_WIZARD_TEMPLATE = AlertWizardRuleTemplates.num_errors;
const hidePrimarySelectorSet = new Set(['num_errors', 'users_experiencing_errors', 'throughput', 'apdex', 'failure_rate', 'crash_free_sessions', 'crash_free_users']);
const hideParameterSelectorSet = new Set(['trans_duration', 'lcp', 'fid', 'cls']);
function getMEPAlertsDataset(dataset, newAlert) {
  // Dataset.ERRORS overrides all cases
  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS) {
    return MEPAlertsDataset.DISCOVER;
  }

  if (newAlert) {
    return MEPAlertsDataset.METRICS_ENHANCED;
  }

  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.GENERIC_METRICS) {
    return MEPAlertsDataset.METRICS;
  }

  return MEPAlertsDataset.DISCOVER;
}

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "./app/views/projectDetail/charts/projectBaseEventsChart.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/projectDetail/charts/projectBaseEventsChart.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_components_charts_eventsChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/eventsChart */ "./app/components/charts/eventsChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class ProjectBaseEventsChart extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  componentDidMount() {
    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps) {
    if (!(0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_5__.isSelectionEqual)(this.props.selection, prevProps.selection)) {
      this.fetchTotalCount();
    }
  }

  async fetchTotalCount() {
    const {
      api,
      organization,
      selection,
      onTotalValuesChange,
      query
    } = this.props;
    const {
      projects,
      environments,
      datetime
    } = selection;

    try {
      const totals = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_1__.fetchTotalCount)(api, organization.slug, {
        field: [],
        query,
        environment: environments,
        project: projects.map(proj => String(proj)),
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_4__.normalizeDateTimeParams)(datetime)
      });
      onTotalValuesChange(totals);
    } catch (err) {
      onTotalValuesChange(null);
      _sentry_react__WEBPACK_IMPORTED_MODULE_12__.captureException(err);
    }
  }

  render() {
    const {
      router,
      organization,
      selection,
      api,
      yAxis,
      query,
      field,
      title,
      help,
      ...eventsChartProps
    } = this.props;
    const {
      projects,
      environments,
      datetime
    } = selection;
    const {
      start,
      end,
      period,
      utc
    } = datetime;
    return (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
      value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_eventsChart__WEBPACK_IMPORTED_MODULE_2__["default"], { ...eventsChartProps,
        router: router,
        organization: organization,
        showLegend: true,
        yAxis: yAxis,
        query: query,
        api: api,
        projects: projects,
        environments: environments,
        start: start,
        end: end,
        period: period,
        utc: utc,
        field: field,
        currentSeriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This Period'),
        previousSeriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Previous Period'),
        disableableSeries: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This Period'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Previous Period')],
        chartHeader: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.HeaderTitleLegend, {
          children: [title, help && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
            size: "sm",
            position: "top",
            title: help
          })]
        }),
        legendOptions: {
          right: 10,
          top: 0
        },
        chartOptions: {
          grid: {
            left: '10px',
            right: '10px',
            top: '40px',
            bottom: '0px'
          },
          yAxis: {
            axisLabel: {
              formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_8__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.aggregateOutputType)(yAxis))
            },
            scale: true
          }
        }
      }),
      fixed: `${title} Chart`
    });
  }

}

ProjectBaseEventsChart.displayName = "ProjectBaseEventsChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_11__["default"])(ProjectBaseEventsChart));

/***/ }),

/***/ "./app/views/projectDetail/charts/projectBaseSessionsChart.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/projectDetail/charts/projectBaseSessionsChart.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_stackedAreaChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/stackedAreaChart */ "./app/components/charts/stackedAreaChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/releases/utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");
/* harmony import */ var _projectCharts__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../projectCharts */ "./app/views/projectDetail/projectCharts.tsx");
/* harmony import */ var _projectSessionsChartRequest__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./projectSessionsChartRequest */ "./app/views/projectDetail/charts/projectSessionsChartRequest.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























function ProjectBaseSessionsChart(_ref) {
  let {
    title,
    organization,
    router,
    selection,
    api,
    onTotalValuesChange,
    displayMode,
    help,
    disablePrevious,
    query
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_24__.a)();
  const {
    projects,
    environments,
    datetime
  } = selection;
  const {
    start,
    end,
    period,
    utc
  } = datetime;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__["default"])({
      value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_5__["default"], {
        router: router,
        period: period,
        start: start,
        end: end,
        utc: utc,
        children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_projectSessionsChartRequest__WEBPACK_IMPORTED_MODULE_23__["default"], {
          api: api,
          selection: selection,
          organization: organization,
          onTotalValuesChange: onTotalValuesChange,
          displayMode: displayMode,
          disablePrevious: disablePrevious,
          query: query,
          children: _ref2 => {
            let {
              errored,
              loading,
              reloading,
              timeseriesData,
              previousTimeseriesData
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_8__["default"], {
              utc: utc,
              period: period,
              start: start,
              end: end,
              projects: projects,
              environments: environments,
              query: query,
              children: _ref3 => {
                let {
                  releaseSeries
                } = _ref3;

                if (errored) {
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_6__["default"], {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconWarning, {
                      color: "gray300",
                      size: "lg"
                    })
                  });
                }

                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  loading: loading,
                  reloading: reloading,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_12__["default"], {
                    visible: reloading
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__.HeaderTitleLegend, {
                    children: [title, help && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
                      size: "sm",
                      position: "top",
                      title: help
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(Chart, {
                    theme: theme,
                    zoomRenderProps: zoomRenderProps,
                    reloading: reloading,
                    timeSeries: timeseriesData,
                    previousTimeSeries: previousTimeseriesData ? [previousTimeseriesData] : undefined,
                    releaseSeries: releaseSeries,
                    displayMode: displayMode
                  })]
                });
              }
            });
          }
        })
      }),
      fixed: `${title} Chart`
    })
  });
}

ProjectBaseSessionsChart.displayName = "ProjectBaseSessionsChart";

class Chart extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      seriesSelection: {},
      forceUpdate: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLegendSelectChanged", _ref4 => {
      let {
        selected
      } = _ref4;
      const seriesSelection = Object.keys(selected).reduce((state, key) => {
        state[key] = selected[key];
        return state;
      }, {}); // we have to force an update here otherwise ECharts will
      // update its internal state and disable the series

      this.setState({
        seriesSelection,
        forceUpdate: true
      }, () => this.setState({
        forceUpdate: false
      }));
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.forceUpdate) {
      return true;
    }

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(this.state.seriesSelection, nextState.seriesSelection)) {
      return true;
    }

    if (nextProps.releaseSeries !== this.props.releaseSeries && !nextProps.reloading && !this.props.reloading) {
      return true;
    }

    if (this.props.reloading && !nextProps.reloading) {
      return true;
    }

    if (nextProps.timeSeries !== this.props.timeSeries) {
      return true;
    }

    return false;
  } // inspired by app/components/charts/eventsChart.tsx@handleLegendSelectChanged


  get isCrashFree() {
    const {
      displayMode
    } = this.props;
    return [_projectCharts__WEBPACK_IMPORTED_MODULE_22__.DisplayModes.STABILITY, _projectCharts__WEBPACK_IMPORTED_MODULE_22__.DisplayModes.STABILITY_USERS].includes(displayMode);
  }

  get legend() {
    var _releaseSeries$, _releaseSeries$$markL;

    const {
      theme,
      timeSeries,
      previousTimeSeries,
      releaseSeries
    } = this.props;
    const {
      seriesSelection
    } = this.state;
    const hideReleasesByDefault = ((_releaseSeries$ = releaseSeries[0]) === null || _releaseSeries$ === void 0 ? void 0 : (_releaseSeries$$markL = _releaseSeries$.markLine) === null || _releaseSeries$$markL === void 0 ? void 0 : _releaseSeries$$markL.data.length) >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_13__.RELEASE_LINES_THRESHOLD;
    const hideHealthyByDefault = timeSeries.filter(s => sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_21__.sessionTerm.healthy !== s.seriesName).some(s => s.data.some(d => d.value > 0));
    const selected = Object.keys(seriesSelection).length === 0 && (hideReleasesByDefault || hideHealthyByDefault) ? {
      [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Releases')]: !hideReleasesByDefault,
      [sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_21__.sessionTerm.healthy]: !hideHealthyByDefault
    } : seriesSelection;
    return {
      right: 10,
      top: 0,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        color: theme.textColor,
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: theme.text.family
      },
      data: [...timeSeries.map(s => s.seriesName), ...(previousTimeSeries !== null && previousTimeSeries !== void 0 ? previousTimeSeries : []).map(s => s.seriesName), ...releaseSeries.map(s => s.seriesName)],
      selected
    };
  }

  get chartOptions() {
    return {
      grid: {
        left: '10px',
        right: '10px',
        top: '40px',
        bottom: '0px'
      },
      seriesOptions: {
        showSymbol: false
      },
      tooltip: {
        trigger: 'axis',
        truncate: 80,
        valueFormatter: value => {
          if (value === null) {
            return '\u2014';
          }

          if (this.isCrashFree) {
            return (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_20__.displayCrashFreePercent)(value, 0, 3);
          }

          return typeof value === 'number' ? value.toLocaleString() : value;
        }
      },
      yAxis: this.isCrashFree ? {
        axisLabel: {
          formatter: value => (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_20__.displayCrashFreePercent)(value)
        },
        scale: true,
        max: 100
      } : {
        min: 0
      }
    };
  }

  render() {
    const {
      zoomRenderProps,
      timeSeries,
      previousTimeSeries,
      releaseSeries
    } = this.props;
    const ChartComponent = this.isCrashFree ? sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_7__.LineChart : sentry_components_charts_stackedAreaChart__WEBPACK_IMPORTED_MODULE_9__["default"];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ChartComponent, { ...zoomRenderProps,
      ...this.chartOptions,
      legend: this.legend,
      series: Array.isArray(releaseSeries) ? [...timeSeries, ...releaseSeries] : timeSeries,
      previousPeriod: previousTimeSeries,
      onLegendSelectChanged: this.handleLegendSelectChanged,
      minutesThresholdToDisplaySeconds: sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_18__.MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
      transformSinglePointToBar: true
    });
  }

}

Chart.displayName = "Chart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__["default"])(ProjectBaseSessionsChart));

/***/ }),

/***/ "./app/views/projectDetail/charts/projectErrorsBasicChart.tsx":
/*!********************************************************************!*\
  !*** ./app/views/projectDetail/charts/projectErrorsBasicChart.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ERRORS_BASIC_CHART_PERIODS": () => (/* binding */ ERRORS_BASIC_CHART_PERIODS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














const ERRORS_BASIC_CHART_PERIODS = ['1h', '24h', '7d', '14d', '30d'];

class ProjectErrorsBasicChart extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      projects: null
    };
  }

  getEndpoints() {
    const {
      organization,
      projectId
    } = this.props;

    if (!projectId) {
      return [];
    }

    return [['projects', `/organizations/${organization.slug}/projects/`, {
      query: {
        statsPeriod: this.getStatsPeriod(),
        query: `id:${projectId}`
      }
    }]];
  }

  componentDidMount() {
    const {
      location
    } = this.props;

    if (!ERRORS_BASIC_CHART_PERIODS.includes(location.query.statsPeriod)) {
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace({
        pathname: location.pathname,
        query: { ...location.query,
          statsPeriod: this.getStatsPeriod(),
          start: undefined,
          end: undefined
        }
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    var _this$state$projects$, _this$state$projects, _this$state$projects$2, _this$state$projects$3;

    this.props.onTotalValuesChange((_this$state$projects$ = (_this$state$projects = this.state.projects) === null || _this$state$projects === void 0 ? void 0 : (_this$state$projects$2 = _this$state$projects[0]) === null || _this$state$projects$2 === void 0 ? void 0 : (_this$state$projects$3 = _this$state$projects$2.stats) === null || _this$state$projects$3 === void 0 ? void 0 : _this$state$projects$3.reduce((acc, _ref) => {
      let [, value] = _ref;
      return acc + value;
    }, 0)) !== null && _this$state$projects$ !== void 0 ? _this$state$projects$ : null);
  }

  getStatsPeriod() {
    const {
      location
    } = this.props;
    const statsPeriod = location.query.statsPeriod;

    if (ERRORS_BASIC_CHART_PERIODS.includes(statsPeriod)) {
      return statsPeriod;
    }

    return sentry_constants__WEBPACK_IMPORTED_MODULE_9__.DEFAULT_STATS_PERIOD;
  }

  getSeries() {
    var _projects$0$stats$map, _projects$, _projects$$stats;

    const {
      projects
    } = this.state;
    return [{
      cursor: 'normal',
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Errors'),
      type: 'bar',
      data: (_projects$0$stats$map = projects === null || projects === void 0 ? void 0 : (_projects$ = projects[0]) === null || _projects$ === void 0 ? void 0 : (_projects$$stats = _projects$.stats) === null || _projects$$stats === void 0 ? void 0 : _projects$$stats.map(_ref2 => {
        let [timestamp, value] = _ref2;
        return [timestamp * 1000, value];
      })) !== null && _projects$0$stats$map !== void 0 ? _projects$0$stats$map : []
    }];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      loading,
      reloading
    } = this.state;
    return (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
      value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_7__["default"], {
        loading: loading,
        reloading: reloading,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_8__["default"], {
          visible: reloading
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.HeaderTitleLegend, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Daily Errors')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          series: this.getSeries(),
          isGroupedByDate: true,
          showTimeInTooltip: true,
          colors: theme => [theme.purple300, theme.purple200],
          grid: {
            left: '10px',
            right: '10px',
            top: '40px',
            bottom: '0px'
          }
        })]
      }),
      fixed: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Number of Errors Chart')
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectErrorsBasicChart);

/***/ }),

/***/ "./app/views/projectDetail/charts/projectSessionsChartRequest.tsx":
/*!************************************************************************!*\
  !*** ./app/views/projectDetail/charts/projectSessionsChartRequest.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _projectCharts__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../projectCharts */ "./app/views/projectDetail/projectCharts.tsx");


















const omitIgnoredProps = props => lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(props, ['api', 'organization', 'children', 'selection.datetime.utc']);

class ProjectSessionsChartRequest extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      reloading: false,
      errored: false,
      timeseriesData: null,
      previousTimeseriesData: null,
      totalSessions: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unmounting", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        selection: {
          datetime
        },
        onTotalValuesChange,
        displayMode,
        disablePrevious
      } = this.props;
      const shouldFetchWithPrevious = !disablePrevious && (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__.shouldFetchPreviousPeriod)({
        start: datetime.start,
        end: datetime.end,
        period: datetime.period
      });
      this.setState(state => ({
        reloading: state.timeseriesData !== null,
        errored: false
      }));

      try {
        const queryParams = this.queryParams({
          shouldFetchWithPrevious
        });
        const response = await api.requestPromise(this.path, {
          query: queryParams
        });
        const filteredResponse = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.filterSessionsInTimeWindow)(response, queryParams.start, queryParams.end);
        const {
          timeseriesData,
          previousTimeseriesData,
          totalSessions
        } = displayMode === _projectCharts__WEBPACK_IMPORTED_MODULE_15__.DisplayModes.SESSIONS ? this.transformSessionCountData(filteredResponse) : this.transformData(filteredResponse, {
          fetchedWithPrevious: shouldFetchWithPrevious
        });

        if (this.unmounting) {
          return;
        }

        this.setState({
          reloading: false,
          timeseriesData,
          previousTimeseriesData,
          totalSessions
        });
        onTotalValuesChange(totalSessions);
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Error loading chart data'));
        this.setState({
          errored: true,
          reloading: false,
          timeseriesData: null,
          previousTimeseriesData: null,
          totalSessions: null
        });
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(omitIgnoredProps(this.props), omitIgnoredProps(prevProps))) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  get path() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/sessions/`;
  }

  get field() {
    const {
      displayMode
    } = this.props;
    return displayMode === _projectCharts__WEBPACK_IMPORTED_MODULE_15__.DisplayModes.STABILITY_USERS ? sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.USERS : sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS;
  }

  queryParams(_ref) {
    let {
      shouldFetchWithPrevious = false
    } = _ref;
    const {
      selection,
      query,
      organization
    } = this.props;
    const {
      datetime,
      projects,
      environments: environment
    } = selection;
    const baseParams = {
      field: this.field,
      groupBy: 'session.status',
      interval: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getSessionsInterval)(datetime, {
        highFidelity: organization.features.includes('minute-resolution-sessions')
      }),
      project: projects[0],
      environment,
      query
    };

    if (!shouldFetchWithPrevious) {
      return { ...baseParams,
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.normalizeDateTimeParams)(datetime)
      };
    }

    const {
      period
    } = selection.datetime;
    const doubledPeriod = (0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_12__.getPeriod)({
      period,
      start: undefined,
      end: undefined
    }, {
      shouldDoublePeriod: true
    }).statsPeriod;
    return { ...baseParams,
      statsPeriod: doubledPeriod
    };
  }

  transformData(responseData, _ref2) {
    let {
      fetchedWithPrevious = false
    } = _ref2;
    const {
      theme
    } = this.props;
    const {
      field
    } = this; // Take the floor just in case, but data should always be divisible by 2

    const dataMiddleIndex = Math.floor(responseData.intervals.length / 2); // calculate the total number of sessions for this period (exclude previous if there)

    const totalSessions = responseData.groups.reduce((acc, group) => acc + group.series[field].slice(fetchedWithPrevious ? dataMiddleIndex : 0).reduce((value, groupAcc) => groupAcc + value, 0), 0);
    const previousPeriodTotalSessions = fetchedWithPrevious ? responseData.groups.reduce((acc, group) => acc + group.series[field].slice(0, dataMiddleIndex).reduce((value, groupAcc) => groupAcc + value, 0), 0) : 0; // TODO(project-details): refactor this to avoid duplication as we add more session charts

    const timeseriesData = [{
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This Period'),
      color: theme.green300,
      data: responseData.intervals.slice(fetchedWithPrevious ? dataMiddleIndex : 0).map((interval, i) => {
        var _responseData$groups$, _responseData$groups$2;

        const totalIntervalSessions = responseData.groups.reduce((acc, group) => acc + group.series[field].slice(fetchedWithPrevious ? dataMiddleIndex : 0)[i], 0);
        const intervalCrashedSessions = (_responseData$groups$ = (_responseData$groups$2 = responseData.groups.find(group => group.by['session.status'] === 'crashed')) === null || _responseData$groups$2 === void 0 ? void 0 : _responseData$groups$2.series[field].slice(fetchedWithPrevious ? dataMiddleIndex : 0)[i]) !== null && _responseData$groups$ !== void 0 ? _responseData$groups$ : 0;
        const crashedSessionsPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.percent)(intervalCrashedSessions, totalIntervalSessions);
        return {
          name: interval,
          value: totalSessions === 0 && previousPeriodTotalSessions === 0 ? 0 : totalIntervalSessions === 0 ? null : (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__.getCrashFreePercent)(100 - crashedSessionsPercent)
        };
      })
    }]; // TODO(project-detail): Change SeriesDataUnit value to support null

    const previousTimeseriesData = fetchedWithPrevious ? {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Previous Period'),
      data: responseData.intervals.slice(0, dataMiddleIndex).map((_interval, i) => {
        var _responseData$groups$3, _responseData$groups$4;

        const totalIntervalSessions = responseData.groups.reduce((acc, group) => acc + group.series[field].slice(0, dataMiddleIndex)[i], 0);
        const intervalCrashedSessions = (_responseData$groups$3 = (_responseData$groups$4 = responseData.groups.find(group => group.by['session.status'] === 'crashed')) === null || _responseData$groups$4 === void 0 ? void 0 : _responseData$groups$4.series[field].slice(0, dataMiddleIndex)[i]) !== null && _responseData$groups$3 !== void 0 ? _responseData$groups$3 : 0;
        const crashedSessionsPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.percent)(intervalCrashedSessions, totalIntervalSessions);
        return {
          name: responseData.intervals[i + dataMiddleIndex],
          value: totalSessions === 0 && previousPeriodTotalSessions === 0 ? 0 : totalIntervalSessions === 0 ? null : (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__.getCrashFreePercent)(100 - crashedSessionsPercent)
        };
      })
    } // TODO(project-detail): Change SeriesDataUnit value to support null
    : null;
    return {
      totalSessions,
      timeseriesData,
      previousTimeseriesData
    };
  }

  transformSessionCountData(responseData) {
    const {
      theme
    } = this.props;
    const sessionsChart = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.initSessionsChart)(theme);
    const {
      intervals,
      groups
    } = responseData;
    const totalSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getCount)(responseData.groups, sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS);
    const chartData = [{ ...sessionsChart[sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.HEALTHY],
      data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS, groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.HEALTHY), intervals)
    }, { ...sessionsChart[sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.ERRORED],
      data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS, groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.ERRORED), intervals)
    }, { ...sessionsChart[sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.ABNORMAL],
      data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS, groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.ABNORMAL), intervals)
    }, { ...sessionsChart[sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.CRASHED],
      data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_13__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS, groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionStatus.CRASHED), intervals)
    }];
    return {
      timeseriesData: chartData,
      previousTimeseriesData: null,
      totalSessions
    };
  }

  render() {
    const {
      children
    } = this.props;
    const {
      timeseriesData,
      reloading,
      errored,
      totalSessions,
      previousTimeseriesData
    } = this.state;
    const loading = timeseriesData === null;
    return children({
      loading,
      reloading,
      errored,
      totalSessions,
      previousTimeseriesData,
      timeseriesData: timeseriesData !== null && timeseriesData !== void 0 ? timeseriesData : []
    });
  }

}

ProjectSessionsChartRequest.displayName = "ProjectSessionsChartRequest";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_16__.d)(ProjectSessionsChartRequest));

/***/ }),

/***/ "./app/views/projectDetail/index.tsx":
/*!*******************************************!*\
  !*** ./app/views/projectDetail/index.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _projectDetail__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./projectDetail */ "./app/views/projectDetail/projectDetail.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function ProjectDetailContainer(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_projectDetail__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props
  });
}

ProjectDetailContainer.displayName = "ProjectDetailContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_0__["default"])(ProjectDetailContainer));

/***/ }),

/***/ "./app/views/projectDetail/missingFeatureButtons/missingAlertsButtons.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/projectDetail/missingFeatureButtons/missingAlertsButtons.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






const DOCS_URL = 'https://docs.sentry.io/product/alerts-notifications/metric-alerts/';

function MissingAlertsButtons(_ref) {
  let {
    organization,
    projectSlug
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    gap: 1,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_2__["default"], {
      organization: organization,
      iconProps: {
        size: 'xs'
      },
      size: "sm",
      priority: "primary",
      referrer: "project_detail",
      projectSlug: projectSlug,
      hideIcon: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Create Alert')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: "sm",
      external: true,
      href: DOCS_URL,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Learn More')
    })]
  });
}

MissingAlertsButtons.displayName = "MissingAlertsButtons";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MissingAlertsButtons);

/***/ }),

/***/ "./app/views/projectDetail/missingFeatureButtons/missingPerformanceButtons.tsx":
/*!*************************************************************************************!*\
  !*** ./app/views/projectDetail/missingFeatureButtons/missingPerformanceButtons.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/navigation */ "./app/actionCreators/navigation.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/modals/featureTourModal */ "./app/components/modals/featureTourModal.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_views_performance_onboarding__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/performance/onboarding */ "./app/views/performance/onboarding.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
// eslint-disable-next-line no-restricted-imports











const DOCS_URL = 'https://docs.sentry.io/performance-monitoring/getting-started/';

function MissingPerformanceButtons(_ref) {
  let {
    organization,
    router
  } = _ref;

  function handleTourAdvance(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_7__.trackAnalyticsEvent)({
      eventKey: 'project_detail.performance_tour.advance',
      eventName: 'Project Detail: Performance Tour Advance',
      organization_id: parseInt(organization.id, 10),
      step,
      duration
    });
  }

  function handleClose(step, duration) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_7__.trackAnalyticsEvent)({
      eventKey: 'project_detail.performance_tour.close',
      eventName: 'Project Detail: Performance Tour Close',
      organization_id: parseInt(organization.id, 10),
      step,
      duration
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_2__["default"], {
    hookName: "feature-disabled:project-performance-score-card",
    features: ['performance-view'],
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        priority: "primary",
        onClick: event => {
          event.preventDefault(); // TODO: add analytics here for this specific action.

          (0,sentry_actionCreators_navigation__WEBPACK_IMPORTED_MODULE_1__.navigateTo)(`/organizations/${organization.slug}/performance/?project=:project#performance-sidequest`, router);
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Start Setup')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_5__["default"], {
        steps: sentry_views_performance_onboarding__WEBPACK_IMPORTED_MODULE_8__.PERFORMANCE_TOUR_STEPS,
        onAdvance: handleTourAdvance,
        onCloseModal: handleClose,
        doneText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Start Setup'),
        doneUrl: DOCS_URL,
        children: _ref2 => {
          let {
            showModal
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
            size: "sm",
            onClick: showModal,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Get Tour')
          });
        }
      })]
    })
  });
}

MissingPerformanceButtons.displayName = "MissingPerformanceButtons";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_0__.withRouter)(MissingPerformanceButtons));

/***/ }),

/***/ "./app/views/projectDetail/projectCharts.tsx":
/*!***************************************************!*\
  !*** ./app/views/projectDetail/projectCharts.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DisplayModes": () => (/* binding */ DisplayModes),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/optionSelector */ "./app/components/charts/optionSelector.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_constants_notAvailableMessages__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants/notAvailableMessages */ "./app/constants/notAvailableMessages.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/releases/utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");
/* harmony import */ var _performance_data__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./charts/projectBaseEventsChart */ "./app/views/projectDetail/charts/projectBaseEventsChart.tsx");
/* harmony import */ var _charts_projectBaseSessionsChart__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./charts/projectBaseSessionsChart */ "./app/views/projectDetail/charts/projectBaseSessionsChart.tsx");
/* harmony import */ var _charts_projectErrorsBasicChart__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./charts/projectErrorsBasicChart */ "./app/views/projectDetail/charts/projectErrorsBasicChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























let DisplayModes;

(function (DisplayModes) {
  DisplayModes["APDEX"] = "apdex";
  DisplayModes["FAILURE_RATE"] = "failure_rate";
  DisplayModes["TPM"] = "tpm";
  DisplayModes["ERRORS"] = "errors";
  DisplayModes["TRANSACTIONS"] = "transactions";
  DisplayModes["STABILITY"] = "crash_free";
  DisplayModes["STABILITY_USERS"] = "crash_free_users";
  DisplayModes["SESSIONS"] = "sessions";
})(DisplayModes || (DisplayModes = {}));

class ProjectCharts extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      totalValues: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDisplayModeChange", value => {
      const {
        location,
        chartId,
        chartIndex,
        organization
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__.trackAnalyticsEvent)({
        eventKey: `project_detail.change_chart${chartIndex + 1}`,
        eventName: `Project Detail: Change Chart #${chartIndex + 1}`,
        organization_id: parseInt(organization.id, 10),
        metric: value
      });
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          [chartId]: value
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTotalValuesChange", value => {
      if (value !== this.state.totalValues) {
        this.setState({
          totalValues: value
        });
      }
    });
  }

  get defaultDisplayModes() {
    const {
      hasSessions,
      hasTransactions
    } = this.props;

    if (!hasSessions && !hasTransactions) {
      return [DisplayModes.ERRORS];
    }

    if (hasSessions && !hasTransactions) {
      return [DisplayModes.STABILITY, DisplayModes.ERRORS];
    }

    if (!hasSessions && hasTransactions) {
      return [DisplayModes.FAILURE_RATE, DisplayModes.APDEX];
    }

    return [DisplayModes.STABILITY, DisplayModes.APDEX];
  }

  get otherActiveDisplayModes() {
    const {
      location,
      visibleCharts,
      chartId
    } = this.props;
    return visibleCharts.filter(visibleChartId => visibleChartId !== chartId).map(urlKey => {
      return (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeScalar)(location.query[urlKey], this.defaultDisplayModes[visibleCharts.findIndex(value => value === urlKey)]);
    });
  }

  get displayMode() {
    const {
      location,
      chartId,
      chartIndex
    } = this.props;
    const displayMode = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeScalar)(location.query[chartId]) || this.defaultDisplayModes[chartIndex];

    if (!Object.values(DisplayModes).includes(displayMode)) {
      return this.defaultDisplayModes[chartIndex];
    }

    return displayMode;
  }

  get displayModes() {
    const {
      organization,
      hasSessions,
      hasTransactions
    } = this.props;
    const hasPerformance = organization.features.includes('performance-view');
    const noPerformanceTooltip = sentry_constants_notAvailableMessages__WEBPACK_IMPORTED_MODULE_13__["default"].performance;
    const noHealthTooltip = sentry_constants_notAvailableMessages__WEBPACK_IMPORTED_MODULE_13__["default"].releaseHealth;
    return [{
      value: DisplayModes.STABILITY,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Crash Free Sessions'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.STABILITY) || !hasSessions,
      tooltip: !hasSessions ? noHealthTooltip : undefined
    }, {
      value: DisplayModes.STABILITY_USERS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Crash Free Users'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.STABILITY_USERS) || !hasSessions,
      tooltip: !hasSessions ? noHealthTooltip : undefined
    }, {
      value: DisplayModes.APDEX,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Apdex'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.APDEX) || !hasPerformance || !hasTransactions,
      tooltip: hasPerformance && hasTransactions ? (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.APDEX) : noPerformanceTooltip
    }, {
      value: DisplayModes.FAILURE_RATE,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Failure Rate'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.FAILURE_RATE) || !hasPerformance || !hasTransactions,
      tooltip: hasPerformance && hasTransactions ? (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.FAILURE_RATE) : noPerformanceTooltip
    }, {
      value: DisplayModes.TPM,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Transactions Per Minute'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.TPM) || !hasPerformance || !hasTransactions,
      tooltip: hasPerformance && hasTransactions ? (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.TPM) : noPerformanceTooltip
    }, {
      value: DisplayModes.ERRORS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Errors'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.ERRORS)
    }, {
      value: DisplayModes.SESSIONS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Sessions'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.SESSIONS) || !hasSessions,
      tooltip: !hasSessions ? noHealthTooltip : undefined
    }, {
      value: DisplayModes.TRANSACTIONS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Transactions'),
      disabled: this.otherActiveDisplayModes.includes(DisplayModes.TRANSACTIONS) || !hasPerformance || !hasTransactions,
      tooltip: hasPerformance && hasTransactions ? undefined : noPerformanceTooltip
    }];
  }

  get summaryHeading() {
    switch (this.displayMode) {
      case DisplayModes.ERRORS:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Total Errors');

      case DisplayModes.STABILITY:
      case DisplayModes.SESSIONS:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Total Sessions');

      case DisplayModes.STABILITY_USERS:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Total Users');

      case DisplayModes.APDEX:
      case DisplayModes.FAILURE_RATE:
      case DisplayModes.TPM:
      case DisplayModes.TRANSACTIONS:
      default:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Total Transactions');
    }
  }

  get barChartInterval() {
    const {
      query
    } = this.props.location;
    const diffInMinutes = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.getDiffInMinutes)({ ...query,
      period: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_17__.decodeScalar)(query.statsPeriod)
    });

    if (diffInMinutes >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.TWO_WEEKS) {
      return '1d';
    }

    if (diffInMinutes >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.ONE_WEEK) {
      return '12h';
    }

    if (diffInMinutes > sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.TWENTY_FOUR_HOURS) {
      return '6h';
    }

    if (diffInMinutes === sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.TWENTY_FOUR_HOURS) {
      return '1h';
    }

    if (diffInMinutes <= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.ONE_HOUR) {
      return '1m';
    }

    return '15m';
  }

  render() {
    const {
      api,
      router,
      location,
      organization,
      theme,
      projectId,
      hasSessions,
      query
    } = this.props;
    const {
      totalValues
    } = this.state;
    const hasDiscover = organization.features.includes('discover-basic');
    const displayMode = this.displayMode;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.ChartContainer, {
        children: !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(hasSessions) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_6__["default"], {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [displayMode === DisplayModes.APDEX && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Apdex'),
            help: (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.APDEX),
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(['event.type:transaction', query !== null && query !== void 0 ? query : '']).formatString(),
            yAxis: "apdex()",
            field: ['apdex()'],
            api: api,
            router: router,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            colors: [sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_12__["default"][0][0], theme.purple200]
          }), displayMode === DisplayModes.FAILURE_RATE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Failure Rate'),
            help: (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.FAILURE_RATE),
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(['event.type:transaction', query !== null && query !== void 0 ? query : '']).formatString(),
            yAxis: "failure_rate()",
            field: [`failure_rate()`],
            api: api,
            router: router,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            colors: [theme.red300, theme.purple200]
          }), displayMode === DisplayModes.TPM && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Transactions Per Minute'),
            help: (0,_performance_data__WEBPACK_IMPORTED_MODULE_21__.getTermHelp)(organization, _performance_data__WEBPACK_IMPORTED_MODULE_21__.PERFORMANCE_TERM.TPM),
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(['event.type:transaction', query !== null && query !== void 0 ? query : '']).formatString(),
            yAxis: "tpm()",
            field: [`tpm()`],
            api: api,
            router: router,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            colors: [theme.yellow300, theme.purple200],
            disablePrevious: true
          }), displayMode === DisplayModes.ERRORS && (hasDiscover ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Errors'),
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(['!event.type:transaction', query !== null && query !== void 0 ? query : '']).formatString(),
            yAxis: "count()",
            field: [`count()`],
            api: api,
            router: router,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            colors: [theme.purple300, theme.purple200],
            interval: this.barChartInterval,
            chartComponent: sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_5__.BarChart,
            disableReleases: true
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectErrorsBasicChart__WEBPACK_IMPORTED_MODULE_24__["default"], {
            organization: organization,
            projectId: projectId,
            location: location,
            onTotalValuesChange: this.handleTotalValuesChange
          })), displayMode === DisplayModes.TRANSACTIONS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseEventsChart__WEBPACK_IMPORTED_MODULE_22__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Transactions'),
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_18__.MutableSearch(['event.type:transaction', query !== null && query !== void 0 ? query : '']).formatString(),
            yAxis: "count()",
            field: [`count()`],
            api: api,
            router: router,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            colors: [theme.gray200, theme.purple200],
            interval: this.barChartInterval,
            chartComponent: sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_5__.BarChart,
            disableReleases: true
          }), displayMode === DisplayModes.STABILITY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseSessionsChart__WEBPACK_IMPORTED_MODULE_23__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Crash Free Sessions'),
            help: (0,sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_20__.getSessionTermDescription)(sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_20__.SessionTerm.STABILITY, null),
            router: router,
            api: api,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            displayMode: displayMode,
            query: query
          }), displayMode === DisplayModes.STABILITY_USERS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseSessionsChart__WEBPACK_IMPORTED_MODULE_23__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Crash Free Users'),
            help: (0,sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_20__.getSessionTermDescription)(sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_20__.SessionTerm.CRASH_FREE_USERS, null),
            router: router,
            api: api,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            displayMode: displayMode,
            query: query
          }), displayMode === DisplayModes.SESSIONS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_charts_projectBaseSessionsChart__WEBPACK_IMPORTED_MODULE_23__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Number of Sessions'),
            router: router,
            api: api,
            organization: organization,
            onTotalValuesChange: this.handleTotalValuesChange,
            displayMode: displayMode,
            disablePrevious: true,
            query: query
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.ChartControls, {
        children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(hasSessions) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.InlineContainer, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.SectionHeading, {
              children: this.summaryHeading
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.SectionValue, {
              children: typeof totalValues === 'number' ? totalValues.toLocaleString() : '\u2014'
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.InlineContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_7__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Display'),
              selected: displayMode,
              options: this.displayModes,
              onChange: this.handleDisplayModeChange
            })
          })]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__["default"], {
          height: "34px"
        })
      })]
    });
  }

}

ProjectCharts.displayName = "ProjectCharts";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__["default"])((0,_emotion_react__WEBPACK_IMPORTED_MODULE_26__.d)(ProjectCharts)));

/***/ }),

/***/ "./app/views/projectDetail/projectDetail.tsx":
/*!***************************************************!*\
  !*** ./app/views/projectDetail/projectDetail.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_organization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/organization */ "./app/actionCreators/organization.tsx");
/* harmony import */ var sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/pageFilters */ "./app/actionCreators/pageFilters.tsx");
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/createAlertButton */ "./app/components/createAlertButton.tsx");
/* harmony import */ var sentry_components_globalAppStoreConnectUpdateAlert__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/globalAppStoreConnectUpdateAlert */ "./app/components/globalAppStoreConnectUpdateAlert/index.tsx");
/* harmony import */ var sentry_components_globalEventProcessingAlert__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/globalEventProcessingAlert */ "./app/components/globalEventProcessingAlert.tsx");
/* harmony import */ var sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/globalSdkUpdateAlert */ "./app/components/globalSdkUpdateAlert.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/components/projects/missingProjectMembership */ "./app/components/projects/missingProjectMembership.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _charts_projectErrorsBasicChart__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./charts/projectErrorsBasicChart */ "./app/views/projectDetail/charts/projectErrorsBasicChart.tsx");
/* harmony import */ var _projectScoreCards_projectScoreCards__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./projectScoreCards/projectScoreCards */ "./app/views/projectDetail/projectScoreCards/projectScoreCards.tsx");
/* harmony import */ var _projectCharts__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./projectCharts */ "./app/views/projectDetail/projectCharts.tsx");
/* harmony import */ var _projectFilters__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./projectFilters */ "./app/views/projectDetail/projectFilters.tsx");
/* harmony import */ var _projectIssues__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./projectIssues */ "./app/views/projectDetail/projectIssues.tsx");
/* harmony import */ var _projectLatestAlerts__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./projectLatestAlerts */ "./app/views/projectDetail/projectLatestAlerts.tsx");
/* harmony import */ var _projectLatestReleases__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./projectLatestReleases */ "./app/views/projectDetail/projectLatestReleases.tsx");
/* harmony import */ var _projectQuickLinks__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./projectQuickLinks */ "./app/views/projectDetail/projectQuickLinks.tsx");
/* harmony import */ var _projectTeamAccess__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! ./projectTeamAccess */ "./app/views/projectDetail/projectTeamAccess.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










































class ProjectDetail extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_33__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleProjectChange", selectedProjects => {
      const {
        projects,
        router,
        location,
        organization
      } = this.props;
      const newlySelectedProject = projects.find(p => p.id === String(selectedProjects[0])); // if we change project in global header, we need to sync the project slug in the URL

      if (newlySelectedProject !== null && newlySelectedProject !== void 0 && newlySelectedProject.id) {
        router.replace({
          pathname: `/organizations/${organization.slug}/projects/${newlySelectedProject.slug}/`,
          query: { ...location.query,
            project: newlySelectedProject.id,
            environment: undefined
          }
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", query => {
      const {
        router,
        location
      } = this.props;
      router.replace({
        pathname: location.pathname,
        query: { ...location.query,
          query
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tagValueLoader", (key, search) => {
      const {
        location,
        organization
      } = this.props;
      const {
        project: projectId
      } = location.query;
      return (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_9__.fetchTagValues)(this.api, organization.slug, key, search, projectId ? [projectId] : null, location.query);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRetryProjects", () => {
      const {
        params
      } = this.props;
      (0,sentry_actionCreators_organization__WEBPACK_IMPORTED_MODULE_7__.fetchOrganizationDetails)(this.api, params.orgId, true, false);
    });
  }

  getTitle() {
    const {
      params
    } = this.props;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_30__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Project %s', params.projectId), params.orgId, false);
  }

  componentDidMount() {
    this.syncProjectWithSlug();
  }

  componentDidUpdate() {
    this.syncProjectWithSlug();
  }

  get project() {
    const {
      projects,
      params
    } = this.props;
    return projects.find(p => p.slug === params.projectId);
  }

  syncProjectWithSlug() {
    var _this$project;

    const {
      router,
      location
    } = this.props;
    const projectId = (_this$project = this.project) === null || _this$project === void 0 ? void 0 : _this$project.id;

    if (projectId && projectId !== location.query.project) {
      // if someone visits /organizations/sentry/projects/javascript/ (without ?project=XXX) we need to update URL and globalSelection with the right project ID
      (0,sentry_actionCreators_pageFilters__WEBPACK_IMPORTED_MODULE_8__.updateProjects)([Number(projectId)], router);
    }
  }

  isProjectStabilized() {
    var _this$project2;

    const {
      selection,
      location
    } = this.props;
    const projectId = (_this$project2 = this.project) === null || _this$project2 === void 0 ? void 0 : _this$project2.id;
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_29__.defined)(projectId) && projectId === location.query.project && projectId === String(selection.projects[0]);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderNoAccess(project) {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_27__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_23__["default"], {
        organization: organization,
        project: project
      })
    });
  }

  renderProjectNotFound() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_27__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_20__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('This project could not be found.'),
        onRetry: this.onRetryProjects
      })
    });
  }

  renderBody() {
    var _project$hasSessions;

    const {
      organization,
      params,
      location,
      router,
      loadingProjects,
      selection
    } = this.props;
    const project = this.project;
    const {
      query
    } = location.query;
    const hasPerformance = organization.features.includes('performance-view');
    const hasDiscover = organization.features.includes('discover-basic');
    const hasTransactions = hasPerformance && (project === null || project === void 0 ? void 0 : project.firstTransactionEvent);
    const isProjectStabilized = this.isProjectStabilized();
    const visibleCharts = ['chart1'];
    const hasSessions = (_project$hasSessions = project === null || project === void 0 ? void 0 : project.hasSessions) !== null && _project$hasSessions !== void 0 ? _project$hasSessions : null;
    const hasOnlyBasicChart = !hasPerformance && !hasDiscover && !hasSessions;

    if (hasTransactions || hasSessions) {
      visibleCharts.push('chart2');
    }

    if (!loadingProjects && !project) {
      return this.renderProjectNotFound();
    }

    if (!loadingProjects && project && !project.hasAccess) {
      return this.renderNoAccess(project);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_22__["default"], {
      skipLoadLastUsed: true,
      showAbsolute: !hasOnlyBasicChart,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_21__["default"], {
        organization: organization,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(StyledPageContent, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Header, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.HeaderContent, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_11__["default"], {
                crumbs: [{
                  to: `/organizations/${params.orgId}/projects/`,
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Projects')
                }, {
                  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Project Details')
                }]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Title, {
                children: project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_18__["default"], {
                  project: project,
                  avatarSize: 28,
                  hideOverflow: "100%",
                  disableLink: true
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.HeaderActions, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_13__["default"], {
                gap: 1,
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  to: // if we are still fetching project, we can use project slug to build issue stream url and let the redirect handle it
                  project !== null && project !== void 0 && project.id ? `/organizations/${params.orgId}/issues/?project=${project.id}` : `/${params.orgId}/${params.projectId}`,
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('View All Issues')
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_createAlertButton__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  organization: organization,
                  projectSlug: params.projectId
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_12__["default"], {
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_25__.IconSettings, {}),
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_26__.t)('Settings'),
                  to: `/settings/${params.orgId}/projects/${params.projectId}/`
                })]
              })
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Body, {
            noRowGap: true,
            children: [project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledGlobalEventProcessingAlert, {
              projects: [project]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Main, {
              fullWidth: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledSdkUpdatesAlert, {})
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledGlobalAppStoreConnectUpdateAlert, {
              project: project,
              organization: organization
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Main, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(ProjectFiltersWrapper, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectFilters__WEBPACK_IMPORTED_MODULE_37__["default"], {
                  query: query,
                  onSearch: this.handleSearch,
                  relativeDateOptions: hasOnlyBasicChart ? lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(sentry_constants__WEBPACK_IMPORTED_MODULE_24__.DEFAULT_RELATIVE_PERIODS, _charts_projectErrorsBasicChart__WEBPACK_IMPORTED_MODULE_34__.ERRORS_BASIC_CHART_PERIODS) : undefined,
                  tagValueLoader: this.tagValueLoader
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectScoreCards_projectScoreCards__WEBPACK_IMPORTED_MODULE_35__["default"], {
                organization: organization,
                isProjectStabilized: isProjectStabilized,
                selection: selection,
                hasSessions: hasSessions,
                hasTransactions: hasTransactions,
                query: query
              }), isProjectStabilized && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
                children: [visibleCharts.map((id, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectCharts__WEBPACK_IMPORTED_MODULE_36__["default"], {
                  location: location,
                  organization: organization,
                  router: router,
                  chartId: id,
                  chartIndex: index,
                  projectId: project === null || project === void 0 ? void 0 : project.id,
                  hasSessions: hasSessions,
                  hasTransactions: !!hasTransactions,
                  visibleCharts: visibleCharts,
                  query: query
                }, `project-charts-${id}`)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectIssues__WEBPACK_IMPORTED_MODULE_38__["default"], {
                  organization: organization,
                  location: location,
                  projectId: selection.projects[0],
                  query: query,
                  api: this.api
                })]
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Side, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectTeamAccess__WEBPACK_IMPORTED_MODULE_42__["default"], {
                organization: organization,
                project: project
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_10__["default"], {
                features: ['incidents'],
                organization: organization,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectLatestAlerts__WEBPACK_IMPORTED_MODULE_39__["default"], {
                  organization: organization,
                  projectSlug: params.projectId,
                  location: location,
                  isProjectStabilized: isProjectStabilized
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectLatestReleases__WEBPACK_IMPORTED_MODULE_40__["default"], {
                organization: organization,
                projectSlug: params.projectId,
                projectId: project === null || project === void 0 ? void 0 : project.id,
                location: location,
                isProjectStabilized: isProjectStabilized
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_projectQuickLinks__WEBPACK_IMPORTED_MODULE_41__["default"], {
                organization: organization,
                project: project,
                location: location
              })]
            })]
          })]
        })
      })
    });
  }

}

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_27__.PageContent,  true ? {
  target: "e92ab5a4"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const ProjectFiltersWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e92ab5a3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_28__["default"])(2), ";" + ( true ? "" : 0));

const StyledSdkUpdatesAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_globalSdkUpdateAlert__WEBPACK_IMPORTED_MODULE_17__.GlobalSdkUpdateAlert,  true ? {
  target: "e92ab5a2"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_28__["default"])(2), ";}" + ( true ? "" : 0));

const StyledGlobalEventProcessingAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_globalEventProcessingAlert__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "e92ab5a1"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){margin-bottom:0;}" + ( true ? "" : 0));

const StyledGlobalAppStoreConnectUpdateAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_globalAppStoreConnectUpdateAlert__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e92ab5a0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){margin-bottom:0;}" + ( true ? "" : 0));

StyledGlobalAppStoreConnectUpdateAlert.defaultProps = {
  Wrapper: p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_19__.Main, {
    fullWidth: true,
    ...p
  })
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_32__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_31__["default"])(ProjectDetail)));

/***/ }),

/***/ "./app/views/projectDetail/projectFilters.tsx":
/*!****************************************************!*\
  !*** ./app/views/projectDetail/projectFilters.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/smartSearchBar */ "./app/components/smartSearchBar/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function ProjectFilters(_ref) {
  let {
    query,
    relativeDateOptions,
    tagValueLoader,
    onSearch
  } = _ref;

  const getTagValues = async (tag, currentQuery) => {
    const values = await tagValueLoader(tag.key, currentQuery);
    return values.map(_ref2 => {
      let {
        value
      } = _ref2;
      return value;
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(FiltersWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_3__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_2__["default"], {
        relativeOptions: relativeDateOptions,
        alignDropdown: "left"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_1__["default"], {
      target: "releases_search",
      position: "bottom",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_smartSearchBar__WEBPACK_IMPORTED_MODULE_5__["default"], {
        searchSource: "project_filters",
        query: query,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Search by release version, build, package, or stage'),
        hasRecentSearches: false,
        supportedTags: { ...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.SEMVER_TAGS,
          release: {
            key: 'release',
            name: 'release'
          }
        },
        maxMenuHeight: 500,
        onSearch: onSearch,
        onGetTagValues: getTagValues
      })
    })]
  });
}

ProjectFilters.displayName = "ProjectFilters";

const FiltersWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1t4uye80"
} : 0)("display:grid;grid-template-columns:minmax(0, max-content) 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:minmax(0, 1fr);}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectFilters);

/***/ }),

/***/ "./app/views/projectDetail/projectIssues.tsx":
/*!***************************************************!*\
  !*** ./app/views/projectDetail/projectIssues.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/discoverButton */ "./app/components/discoverButton.tsx");
/* harmony import */ var sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/issues/groupList */ "./app/components/issues/groupList.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/queryCount */ "./app/components/queryCount.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _issueList_noGroupsHandler__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../issueList/noGroupsHandler */ "./app/views/issueList/noGroupsHandler/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















var IssuesType;

(function (IssuesType) {
  IssuesType["NEW"] = "new";
  IssuesType["UNHANDLED"] = "unhandled";
  IssuesType["REGRESSED"] = "regressed";
  IssuesType["RESOLVED"] = "resolved";
  IssuesType["ALL"] = "all";
})(IssuesType || (IssuesType = {}));

var IssuesQuery;

(function (IssuesQuery) {
  IssuesQuery["NEW"] = "is:unresolved is:for_review";
  IssuesQuery["UNHANDLED"] = "error.unhandled:true is:unresolved";
  IssuesQuery["REGRESSED"] = "regressed_in_release:latest";
  IssuesQuery["RESOLVED"] = "is:resolved";
  IssuesQuery["ALL"] = "";
})(IssuesQuery || (IssuesQuery = {}));

function ProjectIssues(_ref) {
  let {
    organization,
    location,
    projectId,
    query,
    api
  } = _ref;
  const [pageLinks, setPageLinks] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)();
  const [onCursor, setOnCursor] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)();
  const [issuesType, setIssuesType] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(location.query.issuesType || IssuesType.UNHANDLED);
  const [issuesCount, setIssuesCount] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)({
    all: 0,
    new: 0,
    regressed: 0,
    resolved: 0,
    unhandled: 0
  });
  const fetchIssuesCount = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(async () => {
    const getIssueCountEndpoint = queryParameters => {
      const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;
      return `${issuesCountPath}?${query_string__WEBPACK_IMPORTED_MODULE_7__.stringify(queryParameters)}`;
    };

    const params = [`${IssuesQuery.NEW}`, `${IssuesQuery.ALL}`, `${IssuesQuery.RESOLVED}`, `${IssuesQuery.UNHANDLED}`, `${IssuesQuery.REGRESSED}`];
    const queryParams = params.map(param => param);
    const queryParameters = {
      project: projectId,
      query: queryParams,
      ...(!location.query.start && {
        statsPeriod: location.query.statsPeriod || sentry_constants__WEBPACK_IMPORTED_MODULE_16__.DEFAULT_STATS_PERIOD
      }),
      start: location.query.start,
      end: location.query.end,
      environment: location.query.environment,
      cursor: location.query.cursor
    };
    const issueCountEndpoint = getIssueCountEndpoint(queryParameters);

    try {
      const data = await api.requestPromise(issueCountEndpoint);
      setIssuesCount({
        all: data[`${IssuesQuery.ALL}`] || 0,
        new: data[`${IssuesQuery.NEW}`] || 0,
        resolved: data[`${IssuesQuery.RESOLVED}`] || 0,
        unhandled: data[`${IssuesQuery.UNHANDLED}`] || 0,
        regressed: data[`${IssuesQuery.REGRESSED}`] || 0
      });
    } catch {// do nothing
    }
  }, [api, location.query.cursor, location.query.end, location.query.environment, location.query.start, location.query.statsPeriod, organization.slug, projectId]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    fetchIssuesCount();
  }, [fetchIssuesCount]);

  function handleOpenInIssuesClick() {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_20__.trackAnalyticsEvent)({
      eventKey: 'project_detail.open_issues',
      eventName: 'Project Detail: Open issues from project detail',
      organization_id: parseInt(organization.id, 10)
    });
  }

  function handleOpenInDiscoverClick() {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_20__.trackAnalyticsEvent)({
      eventKey: 'project_detail.open_discover',
      eventName: 'Project Detail: Open discover from project detail',
      organization_id: parseInt(organization.id, 10)
    });
  }

  function handleFetchSuccess(groupListState, cursorHandler) {
    setPageLinks(groupListState.pageLinks);
    setOnCursor(() => cursorHandler);
  }

  const discoverQuery = issuesType === 'unhandled' ? ['event.type:error error.unhandled:true', query].join(' ').trim() : ['event.type:error', query].join(' ').trim();

  function getDiscoverUrl() {
    return {
      pathname: `/organizations/${organization.slug}/discover/results/`,
      query: {
        name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Frequent Unhandled Issues'),
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        sort: ['-count'],
        query: discoverQuery,
        display: 'top5',
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_17__.URL_PARAM)]))
      }
    };
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;
  const issueQuery = Object.values(IssuesType).includes(issuesType) ? [`${IssuesQuery[issuesType.toUpperCase()]}`, query].join(' ').trim() : [`${IssuesQuery.ALL}`, query].join(' ').trim();
  const queryParams = {
    limit: 5,
    ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_17__.URL_PARAM), 'cursor'])),
    query: issueQuery,
    sort: 'freq'
  };
  const issueSearch = {
    pathname: endpointPath,
    query: queryParams
  };

  function handleIssuesTypeSelection(issueType) {
    const to = { ...location,
      query: { ...location.query,
        issuesType: issueType
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace(to);
    setIssuesType(issueType);
  }

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start ? null : sentry_constants__WEBPACK_IMPORTED_MODULE_16__.DEFAULT_RELATIVE_PERIODS[(0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.statsPeriod, sentry_constants__WEBPACK_IMPORTED_MODULE_16__.DEFAULT_STATS_PERIOD)];
    const displayedPeriod = selectedTimePeriod ? selectedTimePeriod.toLowerCase() : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('given timeframe');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_issueList_noGroupsHandler__WEBPACK_IMPORTED_MODULE_22__["default"], {
          api: api,
          organization: organization,
          query: issueQuery,
          selectedProjectIds: [projectId],
          groupIds: [],
          emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)('No [issuesType] issues for the [timePeriod].', {
            issuesType: issuesType === 'all' ? '' : issuesType,
            timePeriod: displayedPeriod
          })
        })
      })
    });
  }

  const issuesTypes = [{
    value: IssuesType.ALL,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('All Issues'),
    issueCount: issuesCount.all
  }, {
    value: IssuesType.NEW,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('New Issues'),
    issueCount: issuesCount.new
  }, {
    value: IssuesType.UNHANDLED,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Unhandled'),
    issueCount: issuesCount.unhandled
  }, {
    value: IssuesType.REGRESSED,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Regressed'),
    issueCount: issuesCount.regressed
  }, {
    value: IssuesType.RESOLVED,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Resolved'),
    issueCount: issuesCount.resolved
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(ControlsWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledButtonBar, {
        active: issuesType,
        merged: true,
        children: issuesTypes.map(_ref2 => {
          let {
            value,
            label,
            issueCount
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
            barId: value,
            size: "xs",
            onClick: () => handleIssuesTypeSelection(value),
            "data-test-id": `filter-${value}`,
            children: [label, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_15__["default"], {
              count: issueCount,
              max: 99,
              hideParens: true,
              hideIfEmpty: false
            })]
          }, value);
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(OpenInButtonBar, {
        gap: 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          "data-test-id": "issues-open",
          size: "xs",
          to: issueSearch,
          onClick: handleOpenInIssuesClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Open in Issues')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_10__["default"], {
          onClick: handleOpenInDiscoverClick,
          to: getDiscoverUrl(),
          size: "xs",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Open in Discover')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledPagination, {
          pageLinks: pageLinks,
          onCursor: onCursor,
          size: "xs"
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_11__["default"], {
      orgId: organization.slug,
      endpointPath: endpointPath,
      queryParams: queryParams,
      query: "",
      canSelectGroups: false,
      renderEmptyMessage: renderEmptyMessage,
      withChart: false,
      withPagination: false,
      onFetchSuccess: handleFetchSuccess
    })]
  });
}

ProjectIssues.displayName = "ProjectIssues";

const ControlsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ev2ivek3"
} : 0)("display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";flex-wrap:wrap;@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ev2ivek2"
} : 0)("grid-template-columns:repeat(4, 1fr);", sentry_components_button__WEBPACK_IMPORTED_MODULE_8__.ButtonLabel, "{white-space:nowrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(0.5), ";span:last-child{color:", p => p.theme.buttonCount, ";}}.active{", sentry_components_button__WEBPACK_IMPORTED_MODULE_8__.ButtonLabel, "{span:last-child{color:", p => p.theme.buttonCountActive, ";}}}" + ( true ? "" : 0));

const OpenInButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ev2ivek1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_19__["default"])(1), ";" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "ev2ivek0"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectIssues);

/***/ }),

/***/ "./app/views/projectDetail/projectLatestAlerts.tsx":
/*!*********************************************************!*\
  !*** ./app/views/projectDetail/projectLatestAlerts.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alertBadge */ "./app/components/alertBadge.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _alerts_types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _missingFeatureButtons_missingAlertsButtons__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./missingFeatureButtons/missingAlertsButtons */ "./app/views/projectDetail/missingFeatureButtons/missingAlertsButtons.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./styles */ "./app/views/projectDetail/styles.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./utils */ "./app/views/projectDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const PLACEHOLDER_AND_EMPTY_HEIGHT = '172px';

class ProjectLatestAlerts extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderAlertRow", alert => {
      const {
        organization
      } = this.props;
      const {
        status,
        id,
        identifier,
        title,
        dateClosed,
        dateStarted
      } = alert;
      const isResolved = status === _alerts_types__WEBPACK_IMPORTED_MODULE_15__.IncidentStatus.CLOSED;
      const isWarning = status === _alerts_types__WEBPACK_IMPORTED_MODULE_15__.IncidentStatus.WARNING;
      const Icon = isResolved ? sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconCheckmark : isWarning ? sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconExclamation : sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconFire;
      const statusProps = {
        isResolved,
        isWarning
      };
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(AlertRowLink, {
        to: `/organizations/${organization.slug}/alerts/${identifier}/`,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(AlertBadgeWrapper, { ...statusProps,
          icon: Icon,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
            status: status,
            hideText: true
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(AlertDetails, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(AlertTitle, {
            children: title
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(AlertDate, { ...statusProps,
            children: isResolved ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Resolved [date]', {
              date: dateClosed ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__["default"], {
                date: dateClosed
              }) : null
            }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Triggered [date]', {
              date: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_10__["default"], {
                date: dateStarted,
                tooltipUnderlineColor: getStatusColor(statusProps)
              })
            })
          })]
        })]
      }, id);
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    const {
      location,
      isProjectStabilized
    } = this.props; // TODO(project-detail): we temporarily removed refetching based on timeselector

    if (this.state !== nextState || (0,_utils__WEBPACK_IMPORTED_MODULE_18__.didProjectOrEnvironmentChange)(location, nextProps.location) || isProjectStabilized !== nextProps.isProjectStabilized) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps) {
    const {
      location,
      isProjectStabilized
    } = this.props;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_18__.didProjectOrEnvironmentChange)(prevProps.location, location) || prevProps.isProjectStabilized !== isProjectStabilized) {
      this.remountComponent();
    }
  }

  getEndpoints() {
    const {
      location,
      organization,
      isProjectStabilized
    } = this.props;

    if (!isProjectStabilized) {
      return [];
    }

    const query = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM)),
      per_page: 3
    }; // we are listing 3 alerts total, first unresolved and then we fill with resolved

    return [['unresolvedAlerts', `/organizations/${organization.slug}/incidents/`, {
      query: { ...query,
        status: 'open'
      }
    }], ['resolvedAlerts', `/organizations/${organization.slug}/incidents/`, {
      query: { ...query,
        status: 'closed'
      }
    }]];
  }
  /**
   * If our alerts are empty, determine if we've configured alert rules (empty message differs then)
   */


  async onLoadAllEndpointsSuccess() {
    const {
      unresolvedAlerts,
      resolvedAlerts
    } = this.state;
    const {
      location,
      organization,
      isProjectStabilized
    } = this.props;

    if (!isProjectStabilized) {
      return;
    }

    if ([...(unresolvedAlerts !== null && unresolvedAlerts !== void 0 ? unresolvedAlerts : []), ...(resolvedAlerts !== null && resolvedAlerts !== void 0 ? resolvedAlerts : [])].length !== 0) {
      this.setState({
        hasAlertRule: true
      });
      return;
    }

    this.setState({
      loading: true
    });
    const alertRules = await this.api.requestPromise(`/organizations/${organization.slug}/alert-rules/`, {
      method: 'GET',
      query: { ...lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM)]),
        per_page: 1
      }
    });
    this.setState({
      hasAlertRule: alertRules.length > 0,
      loading: false
    });
  }

  get alertsLink() {
    const {
      organization
    } = this.props; // as this is a link to latest alerts, we want to only preserve project and environment

    return {
      pathname: `/organizations/${organization.slug}/alerts/`,
      query: {
        statsPeriod: undefined,
        start: undefined,
        end: undefined,
        utc: undefined
      }
    };
  }

  renderInnerBody() {
    const {
      organization,
      projectSlug,
      isProjectStabilized
    } = this.props;
    const {
      loading,
      unresolvedAlerts,
      resolvedAlerts,
      hasAlertRule
    } = this.state;
    const alertsUnresolvedAndResolved = [...(unresolvedAlerts !== null && unresolvedAlerts !== void 0 ? unresolvedAlerts : []), ...(resolvedAlerts !== null && resolvedAlerts !== void 0 ? resolvedAlerts : [])];
    const checkingForAlertRules = alertsUnresolvedAndResolved.length === 0 && hasAlertRule === undefined;
    const showLoadingIndicator = loading || checkingForAlertRules || !isProjectStabilized;

    if (showLoadingIndicator) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"], {
        height: PLACEHOLDER_AND_EMPTY_HEIGHT
      });
    }

    if (!hasAlertRule) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_missingFeatureButtons_missingAlertsButtons__WEBPACK_IMPORTED_MODULE_16__["default"], {
        organization: organization,
        projectSlug: projectSlug
      });
    }

    if (alertsUnresolvedAndResolved.length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledEmptyStateWarning, {
        small: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No alerts found')
      });
    }

    return alertsUnresolvedAndResolved.slice(0, 3).map(this.renderAlertRow);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_17__.SidebarSection, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_17__.SectionHeadingWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Latest Alerts')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_17__.SectionHeadingLink, {
          to: this.alertsLink,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconOpen, {})
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("div", {
        children: this.renderInnerBody()
      })]
    });
  }

}

const AlertRowLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e6ksqh85"
} : 0)("display:flex;align-items:center;height:40px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(3), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";&,&:hover,&:focus{color:inherit;}&:first-child{margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";}" + ( true ? "" : 0));

const getStatusColor = _ref => {
  let {
    isResolved,
    isWarning
  } = _ref;
  return isResolved ? 'green300' : isWarning ? 'yellow300' : 'red300';
};

const AlertBadgeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e6ksqh84"
} : 0)("display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:", p => p.icon === sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconExclamation ? undefined : 1, ";" + ( true ? "" : 0));

const AlertDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e6ksqh83"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1.5), ";", p => p.theme.overflowEllipsis, " line-height:1.35;" + ( true ? "" : 0));

const AlertTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e6ksqh82"
} : 0)( true ? {
  name: "1ty05yx",
  styles: "font-weight:400;overflow:hidden;text-overflow:ellipsis"
} : 0);

const AlertDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e6ksqh81"
} : 0)("color:", p => p.theme[getStatusColor(p)], ";" + ( true ? "" : 0));

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e6ksqh80"
} : 0)("height:", PLACEHOLDER_AND_EMPTY_HEIGHT, ";justify-content:center;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectLatestAlerts);

/***/ }),

/***/ "./app/views/projectDetail/projectLatestReleases.tsx":
/*!***********************************************************!*\
  !*** ./app/views/projectDetail/projectLatestReleases.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_views_releases_list_releasesPromo__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/releases/list/releasesPromo */ "./app/views/releases/list/releasesPromo.tsx");
/* harmony import */ var _missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./missingFeatureButtons/missingReleasesButtons */ "./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./styles */ "./app/views/projectDetail/styles.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/projectDetail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
























const PLACEHOLDER_AND_EMPTY_HEIGHT = '160px';

class ProjectLatestReleases extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTourAdvance", index => {
      const {
        organization,
        projectId
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_17__.analytics)('releases.landing_card_clicked', {
        org_id: parseInt(organization.id, 10),
        project_id: projectId && parseInt(projectId, 10),
        step_id: index,
        step_title: sentry_views_releases_list_releasesPromo__WEBPACK_IMPORTED_MODULE_18__.RELEASES_TOUR_STEPS[index].title
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderReleaseRow", release => {
      const {
        projectId
      } = this.props;
      const {
        lastDeploy,
        dateCreated
      } = release;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_8__["default"], {
          date: (lastDeploy === null || lastDeploy === void 0 ? void 0 : lastDeploy.dateFinished) || dateCreated,
          seconds: false
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_11__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledVersion, {
            version: release.version,
            tooltipRawVersion: true,
            projectId: projectId
          })
        })]
      }, release.version);
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    const {
      location,
      isProjectStabilized
    } = this.props; // TODO(project-detail): we temporarily removed refetching based on timeselector

    if (this.state !== nextState || (0,_utils__WEBPACK_IMPORTED_MODULE_21__.didProjectOrEnvironmentChange)(location, nextProps.location) || isProjectStabilized !== nextProps.isProjectStabilized) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps) {
    const {
      location,
      isProjectStabilized
    } = this.props;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_21__.didProjectOrEnvironmentChange)(prevProps.location, location) || prevProps.isProjectStabilized !== isProjectStabilized) {
      this.remountComponent();
    }
  }

  getEndpoints() {
    const {
      location,
      organization,
      projectSlug,
      isProjectStabilized
    } = this.props;

    if (!isProjectStabilized) {
      return [];
    }

    const query = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_13__.URL_PARAM)),
      per_page: 5
    }; // TODO(project-detail): this does not filter releases for the given time

    return [['releases', `/projects/${organization.slug}/${projectSlug}/releases/`, {
      query
    }]];
  }
  /**
   * If our releases are empty, determine if we had a release in the last 90 days (empty message differs then)
   */


  async onLoadAllEndpointsSuccess() {
    const {
      releases
    } = this.state;
    const {
      organization,
      projectId,
      isProjectStabilized
    } = this.props;

    if (!isProjectStabilized) {
      return;
    }

    if ((releases !== null && releases !== void 0 ? releases : []).length !== 0 || !projectId) {
      this.setState({
        hasOlderReleases: true
      });
      return;
    }

    this.setState({
      loading: true
    });
    const hasOlderReleases = await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.fetchAnyReleaseExistence)(this.api, organization.slug, projectId);
    this.setState({
      hasOlderReleases,
      loading: false
    });
  }

  get releasesLink() {
    const {
      organization
    } = this.props; // as this is a link to latest releases, we want to only preserve project and environment

    return {
      pathname: `/organizations/${organization.slug}/releases/`,
      query: {
        statsPeriod: undefined,
        start: undefined,
        end: undefined,
        utc: undefined
      }
    };
  }

  renderInnerBody() {
    const {
      organization,
      projectId,
      isProjectStabilized
    } = this.props;
    const {
      loading,
      releases,
      hasOlderReleases
    } = this.state;
    const checkingForOlderReleases = !(releases !== null && releases !== void 0 ? releases : []).length && hasOlderReleases === undefined;
    const showLoadingIndicator = loading || checkingForOlderReleases || !isProjectStabilized;

    if (showLoadingIndicator) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_10__["default"], {
        height: PLACEHOLDER_AND_EMPTY_HEIGHT
      });
    }

    if (!hasOlderReleases) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_19__["default"], {
        organization: organization,
        projectId: projectId
      });
    }

    if (!releases || releases.length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(StyledEmptyStateWarning, {
        small: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No releases found')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(ReleasesTable, {
      children: releases.map(this.renderReleaseRow)
    });
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_20__.SidebarSection, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_20__.SectionHeadingWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Latest Releases')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_20__.SectionHeadingLink, {
          to: this.releasesLink,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconOpen, {})
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)("div", {
        children: this.renderInnerBody()
      })]
    });
  }

}

const ReleasesTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eopk6et2"
} : 0)("display:grid;font-size:", p => p.theme.fontSizeMedium, ";white-space:nowrap;grid-template-columns:1fr auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";&>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";height:32px;}&>*:nth-child(2n + 2){text-align:right;}&>*:nth-child(4n + 1),&>*:nth-child(4n + 2){background-color:", p => p.theme.rowBackground, ";}" + ( true ? "" : 0));

const StyledVersion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_version__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "eopk6et1"
} : 0)(p => p.theme.overflowEllipsis, " line-height:1.6;font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "eopk6et0"
} : 0)("height:", PLACEHOLDER_AND_EMPTY_HEIGHT, ";justify-content:center;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectLatestReleases);

/***/ }),

/***/ "./app/views/projectDetail/projectQuickLinks.tsx":
/*!*******************************************************!*\
  !*** ./app/views/projectDetail/projectQuickLinks.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./styles */ "./app/views/projectDetail/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















function ProjectQuickLinks(_ref) {
  let {
    organization,
    project,
    location
  } = _ref;

  function getTrendsLink() {
    const queryString = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeScalar)(location.query.query);
    const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_9__.MutableSearch(queryString || '');
    conditions.setFilterValues('tpm()', ['>0.01']);
    conditions.setFilterValues('transaction.duration', ['>0', `<${sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_MAX_DURATION}`]);
    return {
      pathname: (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__.getPerformanceTrendsUrl)(organization),
      query: {
        project: project === null || project === void 0 ? void 0 : project.id,
        cursor: undefined,
        query: conditions.formatString()
      }
    };
  }

  const quickLinks = [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Feedback'),
    to: {
      pathname: `/organizations/${organization.slug}/user-feedback/`,
      query: {
        project: project === null || project === void 0 ? void 0 : project.id
      }
    }
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('View Transactions'),
    to: {
      pathname: (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_11__.getPerformanceLandingUrl)(organization),
      query: {
        project: project === null || project === void 0 ? void 0 : project.id
      }
    },
    disabled: !organization.features.includes('performance-view')
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Most Improved/Regressed Transactions'),
    to: getTrendsLink(),
    disabled: !organization.features.includes('performance-view')
  }];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_12__.SidebarSection, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Quick Links')
    }), quickLinks // push disabled links to the bottom
    .sort((link1, link2) => Number(!!link1.disabled) - Number(!!link2.disabled)).map(_ref2 => {
      let {
        title,
        to,
        disabled
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("You don't have access to this feature"),
          disabled: !disabled,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(QuickLink, {
            to: to,
            disabled: disabled,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconLink, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(QuickLinkText, {
              children: title
            })]
          })
        })
      }, title);
    })]
  });
}

ProjectQuickLinks.displayName = "ProjectQuickLinks";

const QuickLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(p => p.disabled ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("span", {
  className: p.className,
  children: p.children
}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_3__["default"], { ...p
}),  true ? {
  target: "emtxi5m1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";grid-template-columns:auto 1fr;", p => p.disabled && `
    color: ${p.theme.gray200};
    cursor: not-allowed;
  `, ";" + ( true ? "" : 0));

const QuickLinkText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "emtxi5m0"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectQuickLinks);

/***/ }),

/***/ "./app/views/projectDetail/projectScoreCards/projectApdexScoreCard.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/projectDetail/projectScoreCards/projectApdexScoreCard.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector/utils */ "./app/components/organizations/timeRangeSelector/utils.tsx");
/* harmony import */ var sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/scoreCard */ "./app/components/scoreCard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _missingFeatureButtons_missingPerformanceButtons__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../missingFeatureButtons/missingPerformanceButtons */ "./app/views/projectDetail/missingFeatureButtons/missingPerformanceButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















class ProjectApdexScoreCard extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      currentApdex: null,
      previousApdex: null
    };
  }

  getEndpoints() {
    const {
      organization,
      selection,
      isProjectStabilized,
      hasTransactions,
      query
    } = this.props;

    if (!this.hasFeature() || !isProjectStabilized || !hasTransactions) {
      return [];
    }

    const {
      projects,
      environments,
      datetime
    } = selection;
    const {
      period
    } = datetime;
    const commonQuery = {
      environment: environments,
      project: projects.map(proj => String(proj)),
      field: ['apdex()'],
      query: ['event.type:transaction count():>0', query].join(' ').trim()
    };
    const endpoints = [['currentApdex', `/organizations/${organization.slug}/events/`, {
      query: { ...commonQuery,
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_8__.normalizeDateTimeParams)(datetime)
      }
    }]];

    if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__.shouldFetchPreviousPeriod)({
      start: datetime.start,
      end: datetime.end,
      period: datetime.period
    })) {
      const {
        start: previousStart
      } = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_9__.parseStatsPeriod)((0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_14__.getPeriod)({
        period,
        start: undefined,
        end: undefined
      }, {
        shouldDoublePeriod: true
      }).statsPeriod);
      const {
        start: previousEnd
      } = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_9__.parseStatsPeriod)((0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_14__.getPeriod)({
        period,
        start: undefined,
        end: undefined
      }, {
        shouldDoublePeriod: false
      }).statsPeriod);
      endpoints.push(['previousApdex', `/organizations/${organization.slug}/events/`, {
        query: { ...commonQuery,
          start: previousStart,
          end: previousEnd
        }
      }]);
    }

    return endpoints;
  }

  componentDidUpdate(prevProps) {
    const {
      selection,
      isProjectStabilized,
      hasTransactions,
      query
    } = this.props;

    if (prevProps.selection !== selection || prevProps.hasTransactions !== hasTransactions || prevProps.isProjectStabilized !== isProjectStabilized || prevProps.query !== query) {
      this.remountComponent();
    }
  }

  hasFeature() {
    return this.props.organization.features.includes('performance-view');
  }

  get cardTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Apdex');
  }

  get cardHelp() {
    const {
      organization
    } = this.props;
    const baseHelp = (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__.PERFORMANCE_TERM.APDEX);

    if (this.trend) {
      return baseHelp + (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)(' This shows how it has changed since the last period.');
    }

    return baseHelp;
  }

  get currentApdex() {
    var _currentApdex$data$;

    const {
      currentApdex
    } = this.state;
    const apdex = currentApdex === null || currentApdex === void 0 ? void 0 : (_currentApdex$data$ = currentApdex.data[0]) === null || _currentApdex$data$ === void 0 ? void 0 : _currentApdex$data$['apdex()'];
    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get previousApdex() {
    var _previousApdex$data$;

    const {
      previousApdex
    } = this.state;
    const apdex = previousApdex === null || previousApdex === void 0 ? void 0 : (_previousApdex$data$ = previousApdex.data[0]) === null || _previousApdex$data$ === void 0 ? void 0 : _previousApdex$data$['apdex()'];
    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get trend() {
    if (this.currentApdex && this.previousApdex) {
      return lodash_round__WEBPACK_IMPORTED_MODULE_4___default()(this.currentApdex - this.previousApdex, 3);
    }

    return null;
  }

  get trendStatus() {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMissingFeatureCard() {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_10__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_missingFeatureButtons_missingPerformanceButtons__WEBPACK_IMPORTED_MODULE_16__["default"], {
        organization: organization
      })
    });
  }

  renderScore() {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(this.currentApdex) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_7__["default"], {
      value: this.currentApdex
    }) : '\u2014';
  }

  renderTrend() {
    // we want to show trend only after currentApdex has loaded to prevent jumping
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(this.currentApdex) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_13__.defined)(this.trend) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [this.trend >= 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconArrow, {
        direction: "up",
        size: "xs"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconArrow, {
        direction: "down",
        size: "xs"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_7__["default"], {
        value: Math.abs(this.trend)
      })]
    }) : null;
  }

  renderBody() {
    const {
      hasTransactions
    } = this.props;

    if (!this.hasFeature() || hasTransactions === false) {
      return this.renderMissingFeatureCard();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_10__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: this.renderScore(),
      trend: this.renderTrend(),
      trendStatus: this.trendStatus
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectApdexScoreCard);

/***/ }),

/***/ "./app/views/projectDetail/projectScoreCards/projectScoreCards.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/projectDetail/projectScoreCards/projectScoreCards.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var _projectApdexScoreCard__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./projectApdexScoreCard */ "./app/views/projectDetail/projectScoreCards/projectApdexScoreCard.tsx");
/* harmony import */ var _projectStabilityScoreCard__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./projectStabilityScoreCard */ "./app/views/projectDetail/projectScoreCards/projectStabilityScoreCard.tsx");
/* harmony import */ var _projectVelocityScoreCard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./projectVelocityScoreCard */ "./app/views/projectDetail/projectScoreCards/projectVelocityScoreCard.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function ProjectScoreCards(_ref) {
  let {
    organization,
    selection,
    isProjectStabilized,
    hasSessions,
    hasTransactions,
    query
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(CardWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_projectStabilityScoreCard__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      selection: selection,
      isProjectStabilized: isProjectStabilized,
      hasSessions: hasSessions,
      query: query,
      field: sentry_types__WEBPACK_IMPORTED_MODULE_2__.SessionFieldWithOperation.SESSIONS
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_projectStabilityScoreCard__WEBPACK_IMPORTED_MODULE_4__["default"], {
      organization: organization,
      selection: selection,
      isProjectStabilized: isProjectStabilized,
      hasSessions: hasSessions,
      query: query,
      field: sentry_types__WEBPACK_IMPORTED_MODULE_2__.SessionFieldWithOperation.USERS
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_projectVelocityScoreCard__WEBPACK_IMPORTED_MODULE_5__["default"], {
      organization: organization,
      selection: selection,
      isProjectStabilized: isProjectStabilized,
      query: query
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_projectApdexScoreCard__WEBPACK_IMPORTED_MODULE_3__["default"], {
      organization: organization,
      selection: selection,
      isProjectStabilized: isProjectStabilized,
      hasTransactions: hasTransactions,
      query: query
    })]
  });
}

ProjectScoreCards.displayName = "ProjectScoreCards";

const CardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1g4xdfa0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.medium, "){display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";grid-template-columns:repeat(2, minmax(0, 1fr));}@media (min-width: 1600px){grid-template-columns:repeat(4, minmax(0, 1fr));}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectScoreCards);

/***/ }),

/***/ "./app/views/projectDetail/projectScoreCards/projectStabilityScoreCard.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/projectDetail/projectScoreCards/projectStabilityScoreCard.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/scoreCard */ "./app/components/scoreCard.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/releases/utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");
/* harmony import */ var _missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../missingFeatureButtons/missingReleasesButtons */ "./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















class ProjectStabilityScoreCard extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      currentSessions: null,
      previousSessions: null
    };
  }

  getEndpoints() {
    const {
      organization,
      selection,
      isProjectStabilized,
      hasSessions,
      query,
      field
    } = this.props;

    if (!isProjectStabilized || !hasSessions) {
      return [];
    }

    const {
      projects,
      environments: environment,
      datetime
    } = selection;
    const {
      period
    } = datetime;
    const commonQuery = {
      environment,
      project: projects[0],
      groupBy: 'session.status',
      interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getDiffInMinutes)(datetime) > 24 * 60 ? '1d' : '1h',
      query,
      field
    }; // Unfortunately we can't do something like statsPeriod=28d&interval=14d to get scores for this and previous interval with the single request
    // https://github.com/getsentry/sentry/pull/22770#issuecomment-758595553

    const endpoints = [['currentSessions', `/organizations/${organization.slug}/sessions/`, {
      query: { ...commonQuery,
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__.normalizeDateTimeParams)(datetime)
      }
    }]];

    if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.shouldFetchPreviousPeriod)({
      start: datetime.start,
      end: datetime.end,
      period: datetime.period
    })) {
      const doubledPeriod = (0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_13__.getPeriod)({
        period,
        start: undefined,
        end: undefined
      }, {
        shouldDoublePeriod: true
      }).statsPeriod;
      endpoints.push(['previousSessions', `/organizations/${organization.slug}/sessions/`, {
        query: { ...commonQuery,
          statsPeriodStart: doubledPeriod,
          statsPeriodEnd: period !== null && period !== void 0 ? period : sentry_constants__WEBPACK_IMPORTED_MODULE_7__.DEFAULT_STATS_PERIOD
        }
      }]);
    }

    return endpoints;
  }

  get cardTitle() {
    return this.props.field === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Crash Free Sessions') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Crash Free Users');
  }

  get cardHelp() {
    return (0,sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_15__.getSessionTermDescription)(this.props.field === sentry_types__WEBPACK_IMPORTED_MODULE_10__.SessionFieldWithOperation.SESSIONS ? sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_15__.SessionTerm.CRASH_FREE_SESSIONS : sentry_views_releases_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_15__.SessionTerm.CRASH_FREE_USERS, null);
  }

  get score() {
    const {
      currentSessions
    } = this.state;
    return this.calculateCrashFree(currentSessions);
  }

  get trend() {
    const {
      previousSessions
    } = this.state;
    const previousScore = this.calculateCrashFree(previousSessions);

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(this.score) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(previousScore)) {
      return undefined;
    }

    return lodash_round__WEBPACK_IMPORTED_MODULE_2___default()(this.score - previousScore, 3);
  }

  get trendStatus() {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  componentDidUpdate(prevProps) {
    const {
      selection,
      isProjectStabilized,
      hasSessions,
      query
    } = this.props;

    if (prevProps.selection !== selection || prevProps.hasSessions !== hasSessions || prevProps.isProjectStabilized !== isProjectStabilized || prevProps.query !== query) {
      this.remountComponent();
    }
  }

  calculateCrashFree(data) {
    var _data$groups$find;

    const {
      field
    } = this.props;

    if (!data) {
      return undefined;
    }

    const totalSessions = data.groups.reduce((acc, group) => acc + group.totals[field], 0);
    const crashedSessions = (_data$groups$find = data.groups.find(group => group.by['session.status'] === 'crashed')) === null || _data$groups$find === void 0 ? void 0 : _data$groups$find.totals[field];

    if (totalSessions === 0 || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(totalSessions) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(crashedSessions)) {
      return undefined;
    }

    const crashedSessionsPercent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.percent)(crashedSessions, totalSessions);
    return (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__.getCrashFreePercent)(100 - crashedSessionsPercent);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMissingFeatureCard() {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(_missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_16__["default"], {
        organization: organization,
        health: true
      })
    });
  }

  renderScore() {
    const {
      loading
    } = this.state;

    if (loading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(this.score)) {
      return '\u2014';
    }

    return (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_14__.displayCrashFreePercent)(this.score);
  }

  renderTrend() {
    const {
      loading
    } = this.state;

    if (loading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(this.score) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(this.trend)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      children: [this.trend >= 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconArrow, {
        direction: "up",
        size: "xs"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconArrow, {
        direction: "down",
        size: "xs"
      }), `${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__.formatAbbreviatedNumber)(Math.abs(this.trend))}\u0025`]
    });
  }

  renderBody() {
    const {
      hasSessions
    } = this.props;

    if (hasSessions === false) {
      return this.renderMissingFeatureCard();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: this.renderScore(),
      trend: this.renderTrend(),
      trendStatus: this.trendStatus
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectStabilityScoreCard);

/***/ }),

/***/ "./app/views/projectDetail/projectScoreCards/projectVelocityScoreCard.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/projectDetail/projectScoreCards/projectVelocityScoreCard.tsx ***!
  \********************************************************************************/
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
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector/utils */ "./app/components/organizations/timeRangeSelector/utils.tsx");
/* harmony import */ var sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/scoreCard */ "./app/components/scoreCard.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var _missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../missingFeatureButtons/missingReleasesButtons */ "./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const API_LIMIT = 1000;

class ProjectVelocityScoreCard extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      currentReleases: null,
      previousReleases: null,
      noReleaseEver: false
    };
  }

  getEndpoints() {
    const {
      organization,
      selection,
      isProjectStabilized,
      query
    } = this.props;

    if (!isProjectStabilized) {
      return [];
    }

    const {
      projects,
      environments,
      datetime
    } = selection;
    const {
      period
    } = datetime;
    const commonQuery = {
      environment: environments,
      project: projects[0],
      query
    };
    const endpoints = [['currentReleases', `/organizations/${organization.slug}/releases/stats/`, {
      includeAllArgs: true,
      method: 'GET',
      query: { ...commonQuery,
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__.normalizeDateTimeParams)(datetime)
      }
    }]];

    if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_5__.shouldFetchPreviousPeriod)({
      start: datetime.start,
      end: datetime.end,
      period: datetime.period
    })) {
      const {
        start: previousStart
      } = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_7__.parseStatsPeriod)((0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_12__.getPeriod)({
        period,
        start: undefined,
        end: undefined
      }, {
        shouldDoublePeriod: true
      }).statsPeriod);
      const {
        start: previousEnd
      } = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_7__.parseStatsPeriod)((0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_12__.getPeriod)({
        period,
        start: undefined,
        end: undefined
      }, {
        shouldDoublePeriod: false
      }).statsPeriod);
      endpoints.push(['previousReleases', `/organizations/${organization.slug}/releases/stats/`, {
        query: { ...commonQuery,
          start: previousStart,
          end: previousEnd
        }
      }]);
    }

    return endpoints;
  }
  /**
   * If our releases are empty, determine if we had a release in the last 90 days (empty message differs then)
   */


  async onLoadAllEndpointsSuccess() {
    const {
      currentReleases,
      previousReleases
    } = this.state;
    const {
      organization,
      selection,
      isProjectStabilized
    } = this.props;

    if (!isProjectStabilized) {
      return;
    }

    if ([...(currentReleases !== null && currentReleases !== void 0 ? currentReleases : []), ...(previousReleases !== null && previousReleases !== void 0 ? previousReleases : [])].length !== 0) {
      this.setState({
        noReleaseEver: false
      });
      return;
    }

    this.setState({
      loading: true
    });
    const hasOlderReleases = await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_3__.fetchAnyReleaseExistence)(this.api, organization.slug, selection.projects[0]);
    this.setState({
      noReleaseEver: !hasOlderReleases,
      loading: false
    });
  }

  get cardTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Number of Releases');
  }

  get cardHelp() {
    return this.trend ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The number of releases for this project and how it has changed since the last period.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('The number of releases for this project.');
  }

  get trend() {
    const {
      currentReleases,
      previousReleases
    } = this.state;

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(currentReleases) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(previousReleases)) {
      return null;
    }

    return currentReleases.length - previousReleases.length;
  }

  get trendStatus() {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  componentDidUpdate(prevProps) {
    const {
      selection,
      isProjectStabilized,
      query
    } = this.props;

    if (prevProps.selection !== selection || prevProps.isProjectStabilized !== isProjectStabilized || prevProps.query !== query) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMissingFeatureCard() {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_8__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_13__["default"], {
        organization: organization
      })
    });
  }

  renderScore() {
    const {
      currentReleases,
      loading
    } = this.state;

    if (loading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(currentReleases)) {
      return '\u2014';
    }

    return currentReleases.length === API_LIMIT ? `${API_LIMIT - 1}+` : currentReleases.length;
  }

  renderTrend() {
    const {
      loading,
      currentReleases
    } = this.state;

    if (loading || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(this.trend) || (currentReleases === null || currentReleases === void 0 ? void 0 : currentReleases.length) === API_LIMIT) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [this.trend >= 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconArrow, {
        direction: "up",
        size: "xs"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconArrow, {
        direction: "down",
        size: "xs"
      }), Math.abs(this.trend)]
    });
  }

  renderBody() {
    const {
      noReleaseEver
    } = this.state;

    if (noReleaseEver) {
      return this.renderMissingFeatureCard();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_8__["default"], {
      title: this.cardTitle,
      help: this.cardHelp,
      score: this.renderScore(),
      trend: this.renderTrend(),
      trendStatus: this.trendStatus
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectVelocityScoreCard);

/***/ }),

/***/ "./app/views/projectDetail/projectTeamAccess.tsx":
/*!*******************************************************!*\
  !*** ./app/views/projectDetail/projectTeamAccess.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/collapsible */ "./app/components/collapsible.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./styles */ "./app/views/projectDetail/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















function ProjectTeamAccess(_ref) {
  let {
    organization,
    project
  } = _ref;
  const hasEditPermissions = organization.access.includes('project:write');
  const settingsLink = `/settings/${organization.slug}/projects/${project === null || project === void 0 ? void 0 : project.slug}/teams/`;

  function renderInnerBody() {
    if (!project) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
        height: "23px"
      });
    }

    if (project.teams.length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        to: settingsLink,
        disabled: !hasEditPermissions,
        title: hasEditPermissions ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You do not have permission to do this'),
        priority: "primary",
        size: "sm",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Assign Team')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_4__["default"], {
      expandButton: _ref2 => {
        let {
          onExpand,
          numberOfHiddenItems
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
          priority: "link",
          onClick: onExpand,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tn)('Show %s collapsed team', 'Show %s collapsed teams', numberOfHiddenItems)
        });
      },
      children: project.teams.sort((a, b) => a.slug.localeCompare(b.slug)).map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledLink, {
        to: `/settings/${organization.slug}/teams/${team.slug}/`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
          team: team,
          hideAvatar: true
        })
      }, team.slug))
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledSidebarSection, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_11__.SectionHeadingWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Team Access')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_11__.SectionHeadingLink, {
        to: settingsLink,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconOpen, {})
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
      children: renderInnerBody()
    })]
  });
}

ProjectTeamAccess.displayName = "ProjectTeamAccess";

const StyledSidebarSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_styles__WEBPACK_IMPORTED_MODULE_11__.SidebarSection,  true ? {
  target: "erftgpa1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "erftgpa0"
} : 0)("display:block;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectTeamAccess);

/***/ }),

/***/ "./app/views/projectDetail/styles.tsx":
/*!********************************************!*\
  !*** ./app/views/projectDetail/styles.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SectionHeadingLink": () => (/* binding */ SectionHeadingLink),
/* harmony export */   "SectionHeadingWrapper": () => (/* binding */ SectionHeadingWrapper),
/* harmony export */   "SidebarSection": () => (/* binding */ SidebarSection)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const SidebarSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('section',  true ? {
  target: "e137cko32"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(2), ";", sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.SectionHeading, "{line-height:1;}" + ( true ? "" : 0));
const SectionHeadingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e137cko31"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);
const SectionHeadingLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e137cko30"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

/***/ }),

/***/ "./app/views/projectDetail/utils.tsx":
/*!*******************************************!*\
  !*** ./app/views/projectDetail/utils.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "didProjectOrEnvironmentChange": () => (/* binding */ didProjectOrEnvironmentChange)
/* harmony export */ });
function didProjectOrEnvironmentChange(location1, location2) {
  return location1.query.environment !== location2.query.environment || location1.query.project !== location2.query.project;
}

/***/ }),

/***/ "./app/views/releases/utils/sessionTerm.tsx":
/*!**************************************************!*\
  !*** ./app/views/releases/utils/sessionTerm.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SessionTerm": () => (/* binding */ SessionTerm),
/* harmony export */   "commonTermsDescription": () => (/* binding */ commonTermsDescription),
/* harmony export */   "desktopTermDescriptions": () => (/* binding */ desktopTermDescriptions),
/* harmony export */   "getSessionTermDescription": () => (/* binding */ getSessionTermDescription),
/* harmony export */   "mobileTermsDescription": () => (/* binding */ mobileTermsDescription),
/* harmony export */   "sessionTerm": () => (/* binding */ sessionTerm)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let SessionTerm;

(function (SessionTerm) {
  SessionTerm["CRASHES"] = "crashes";
  SessionTerm["CRASHED"] = "crashed";
  SessionTerm["ABNORMAL"] = "abnormal";
  SessionTerm["CRASH_FREE"] = "crashFree";
  SessionTerm["CRASH_FREE_USERS"] = "crash-free-users";
  SessionTerm["CRASH_FREE_SESSIONS"] = "crash-free-sessions";
  SessionTerm["HEALTHY"] = "healthy";
  SessionTerm["ERRORED"] = "errored";
  SessionTerm["UNHANDLED"] = "unhandled";
  SessionTerm["STABILITY"] = "stability";
  SessionTerm["ADOPTION"] = "adoption";
})(SessionTerm || (SessionTerm = {}));

const sessionTerm = {
  [SessionTerm.CRASHES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes'),
  [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashed'),
  [SessionTerm.ABNORMAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Abnormal'),
  [SessionTerm.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crash Free Users'),
  [SessionTerm.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crash Free Sessions'),
  [SessionTerm.HEALTHY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Healthy'),
  [SessionTerm.ERRORED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errored'),
  [SessionTerm.UNHANDLED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unhandled'),
  [SessionTerm.ADOPTION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Adoption'),
  duration: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Session Duration'),
  otherCrashed: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Crashed'),
  otherAbnormal: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Abnormal'),
  otherErrored: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Errored'),
  otherHealthy: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Healthy'),
  otherCrashFreeUsers: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Crash Free Users'),
  otherCrashFreeSessions: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Crash Free Sessions'),
  otherReleases: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Other Releases')
}; // This should never be used directly (except in tests)

const commonTermsDescription = {
  [SessionTerm.CRASHES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of sessions with a crashed state'),
  [SessionTerm.CRASH_FREE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage of sessions/users who did not experience a crash.'),
  [SessionTerm.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage of unique users with non-crashed sessions'),
  [SessionTerm.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage of non-crashed sessions'),
  [SessionTerm.STABILITY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The percentage of crash free sessions.'),
  [SessionTerm.ADOPTION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Adoption compares the sessions or users of a release with the total sessions or users for this project in the last 24 hours.')
}; // This should never be used directly (except in tests)

const mobileTermsDescription = {
  [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The process was terminated due to an unhandled exception or a request to the server that ended with an error'),
  [SessionTerm.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Percentage of non-crashed sessions'),
  [SessionTerm.ABNORMAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An unknown session exit. Like due to loss of power or killed by the operating system'),
  [SessionTerm.HEALTHY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A session without errors'),
  [SessionTerm.ERRORED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A session with errors'),
  [SessionTerm.UNHANDLED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Not handled by user code')
}; // This should never be used directly (except in tests)

const desktopTermDescriptions = {
  crashed: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application crashed with a hard crash (eg. segfault)'),
  [SessionTerm.ABNORMAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application did not properly end the session, for example, due to force-quit'),
  [SessionTerm.HEALTHY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application exited normally and did not observe any errors'),
  [SessionTerm.ERRORED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application exited normally but observed error events while running'),
  [SessionTerm.UNHANDLED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application crashed with a hard crash')
};

function getTermDescriptions(platform) {
  const technology = platform === 'react-native' || platform === 'java-spring' || platform === 'apple-ios' || platform === 'dotnet-aspnetcore' ? platform : platform === null || platform === void 0 ? void 0 : platform.split('-')[0];

  switch (technology) {
    case 'dotnet':
    case 'java':
      return { ...commonTermsDescription,
        ...mobileTermsDescription
      };

    case 'java-spring':
    case 'dotnet-aspnetcore':
      return { ...commonTermsDescription,
        ...mobileTermsDescription,
        [SessionTerm.CRASHES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('A request that resulted in an unhandled exception and hence a Server Error response')
      };

    case 'android':
    case 'cordova':
    case 'react-native':
    case 'flutter':
      return { ...commonTermsDescription,
        ...mobileTermsDescription,
        [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An unhandled exception that resulted in the application crashing')
      };

    case 'apple':
      {
        return { ...commonTermsDescription,
          ...mobileTermsDescription,
          [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An error that resulted in the application crashing')
        };
      }

    case 'node':
    case 'javascript':
      return { ...commonTermsDescription,
        [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('During the session an unhandled global error/promise rejection occurred.'),
        [SessionTerm.ABNORMAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Non applicable for Javascript.'),
        [SessionTerm.HEALTHY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('No errors were captured during session life-time.'),
        [SessionTerm.ERRORED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('During the session at least one handled error occurred.'),
        [SessionTerm.UNHANDLED]: "An error was captured by the global 'onerror' or 'onunhandledrejection' handler."
      };

    case 'apple-ios':
    case 'minidump':
    case 'native':
      return { ...commonTermsDescription,
        ...desktopTermDescriptions
      };

    case 'rust':
      return { ...commonTermsDescription,
        ...desktopTermDescriptions,
        [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('The application had an unrecoverable error (a panic)')
      };

    default:
      return { ...commonTermsDescription,
        [SessionTerm.CRASHED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of users who experienced an unhandled error'),
        [SessionTerm.ABNORMAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('An unknown session exit'),
        [SessionTerm.HEALTHY]: mobileTermsDescription.healthy,
        [SessionTerm.ERRORED]: mobileTermsDescription.errored,
        [SessionTerm.UNHANDLED]: mobileTermsDescription.unhandled
      };
  }
}

function getSessionTermDescription(term, platform) {
  return getTermDescriptions(platform)[term];
}

/***/ }),

/***/ "../node_modules/lodash/_baseMean.js":
/*!*******************************************!*\
  !*** ../node_modules/lodash/_baseMean.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseSum = __webpack_require__(/*! ./_baseSum */ "../node_modules/lodash/_baseSum.js");

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/**
 * The base implementation of `_.mean` and `_.meanBy` without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {number} Returns the mean.
 */
function baseMean(array, iteratee) {
  var length = array == null ? 0 : array.length;
  return length ? (baseSum(array, iteratee) / length) : NAN;
}

module.exports = baseMean;


/***/ }),

/***/ "../node_modules/lodash/_baseSum.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/_baseSum.js ***!
  \******************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.sum` and `_.sumBy` without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {number} Returns the sum.
 */
function baseSum(array, iteratee) {
  var result,
      index = -1,
      length = array.length;

  while (++index < length) {
    var current = iteratee(array[index]);
    if (current !== undefined) {
      result = result === undefined ? current : (result + current);
    }
  }
  return result;
}

module.exports = baseSum;


/***/ }),

/***/ "../node_modules/lodash/mean.js":
/*!**************************************!*\
  !*** ../node_modules/lodash/mean.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseMean = __webpack_require__(/*! ./_baseMean */ "../node_modules/lodash/_baseMean.js"),
    identity = __webpack_require__(/*! ./identity */ "../node_modules/lodash/identity.js");

/**
 * Computes the mean of the values in `array`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Math
 * @param {Array} array The array to iterate over.
 * @returns {number} Returns the mean.
 * @example
 *
 * _.mean([4, 2, 8, 6]);
 * // => 5
 */
function mean(array) {
  return baseMean(array, identity);
}

module.exports = mean;


/***/ }),

/***/ "../node_modules/lodash/negate.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/negate.js ***!
  \****************************************/
/***/ ((module) => {

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that negates the result of the predicate `func`. The
 * `func` predicate is invoked with the `this` binding and arguments of the
 * created function.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Function
 * @param {Function} predicate The predicate to negate.
 * @returns {Function} Returns the new negated function.
 * @example
 *
 * function isEven(n) {
 *   return n % 2 == 0;
 * }
 *
 * _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
 * // => [1, 3, 5]
 */
function negate(predicate) {
  if (typeof predicate != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  return function() {
    var args = arguments;
    switch (args.length) {
      case 0: return !predicate.call(this);
      case 1: return !predicate.call(this, args[0]);
      case 2: return !predicate.call(this, args[0], args[1]);
      case 3: return !predicate.call(this, args[0], args[1], args[2]);
    }
    return !predicate.apply(this, args);
  };
}

module.exports = negate;


/***/ }),

/***/ "../node_modules/lodash/omitBy.js":
/*!****************************************!*\
  !*** ../node_modules/lodash/omitBy.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIteratee = __webpack_require__(/*! ./_baseIteratee */ "../node_modules/lodash/_baseIteratee.js"),
    negate = __webpack_require__(/*! ./negate */ "../node_modules/lodash/negate.js"),
    pickBy = __webpack_require__(/*! ./pickBy */ "../node_modules/lodash/pickBy.js");

/**
 * The opposite of `_.pickBy`; this method creates an object composed of
 * the own and inherited enumerable string keyed properties of `object` that
 * `predicate` doesn't return truthy for. The predicate is invoked with two
 * arguments: (value, key).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The source object.
 * @param {Function} [predicate=_.identity] The function invoked per property.
 * @returns {Object} Returns the new object.
 * @example
 *
 * var object = { 'a': 1, 'b': '2', 'c': 3 };
 *
 * _.omitBy(object, _.isNumber);
 * // => { 'b': '2' }
 */
function omitBy(object, predicate) {
  return pickBy(object, negate(baseIteratee(predicate)));
}

module.exports = omitBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_eventsRequest_tsx-app_components_charts_worldMapChart_tsx-app_utils_dis-4cc9e7.93053408cbc31d1f163b7f37aa7dbbad.js.map