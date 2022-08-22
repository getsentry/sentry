(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_rules_metric_details_index_tsx"],{

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

/***/ "./app/components/charts/components/markArea.tsx":
/*!*******************************************************!*\
  !*** ./app/components/charts/components/markArea.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MarkArea)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_markArea__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/markArea */ "../node_modules/echarts/lib/component/markArea.js");


/**
 * eCharts markArea
 *
 * See https://echarts.apache.org/en/option.html#series-line.markArea
 */
function MarkArea(props) {
  return { ...props
  };
}

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

/***/ "./app/components/charts/sessionsRequest.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/sessionsRequest.tsx ***!
  \***************************************************/
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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");









const propNamesToIgnore = ['api', 'children', 'organization'];

const omitIgnoredProps = props => lodash_omitBy__WEBPACK_IMPORTED_MODULE_5___default()(props, (_value, key) => propNamesToIgnore.includes(key));

class SessionsRequest extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      reloading: false,
      errored: false,
      response: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        isDisabled,
        shouldFilterSessionsInTimeWindow
      } = this.props;

      if (isDisabled) {
        return;
      }

      this.setState(state => ({
        reloading: state.response !== null,
        errored: false
      }));

      try {
        const response = await api.requestPromise(this.path, {
          query: this.baseQueryParams
        });
        this.setState({
          reloading: false,
          response: shouldFilterSessionsInTimeWindow ? (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_8__.filterSessionsInTimeWindow)(response, this.baseQueryParams.start, this.baseQueryParams.end) : response
        });
      } catch (error) {
        var _error$responseJSON$d, _error$responseJSON;

        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((_error$responseJSON$d = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail) !== null && _error$responseJSON$d !== void 0 ? _error$responseJSON$d : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Error loading health data'));
        this.setState({
          reloading: false,
          errored: true
        });
      }
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

  get path() {
    const {
      organization
    } = this.props;
    return `/organizations/${organization.slug}/sessions/`;
  }

  get baseQueryParams() {
    const {
      project,
      environment,
      field,
      statsPeriod,
      start,
      end,
      query,
      groupBy,
      interval,
      organization
    } = this.props;
    return {
      project,
      environment,
      field,
      statsPeriod,
      query,
      groupBy,
      start,
      end,
      interval: interval ? interval : (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_8__.getSessionsInterval)({
        start,
        end,
        period: statsPeriod
      }, {
        highFidelity: organization.features.includes('minute-resolution-sessions')
      })
    };
  }

  render() {
    const {
      reloading,
      errored,
      response
    } = this.state;
    const {
      children
    } = this.props;
    const loading = response === null;
    return children({
      loading,
      reloading,
      errored,
      response
    });
  }

}

SessionsRequest.displayName = "SessionsRequest";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SessionsRequest);

/***/ }),

/***/ "./app/components/collapsePanel.tsx":
/*!******************************************!*\
  !*** ./app/components/collapsePanel.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COLLAPSE_COUNT": () => (/* binding */ COLLAPSE_COUNT),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const COLLAPSE_COUNT = 5;

/**
 * Used to expand results.
 *
 * Our collapsible component was not used because we want our
 * expand button to be outside the list of children
 *
 */
function CollapsePanel(_ref) {
  let {
    items,
    children,
    buttonTitle,
    collapseCount = COLLAPSE_COUNT,
    disableBorder = true
  } = _ref;
  const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);

  function expandResults() {
    setIsExpanded(true);
  }

  return children({
    isExpanded,
    showMoreButton: isExpanded || items <= collapseCount ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(ShowMoreButton, {
      items: items,
      buttonTitle: buttonTitle,
      collapseCount: collapseCount,
      disableBorder: disableBorder,
      onClick: expandResults
    })
  });
}

function ShowMoreButton(_ref2) {
  let {
    items,
    buttonTitle = 'More',
    collapseCount = COLLAPSE_COUNT,
    disableBorder = true,
    onClick
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ShowMore, {
    onClick: onClick,
    role: "button",
    "data-test-id": "collapse-show-more",
    disableBorder: disableBorder,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ShowMoreText, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledIconList, {
        color: "gray300"
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('Show [count] [buttonTitle]', {
        count: items - collapseCount,
        buttonTitle
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconChevron, {
      color: "gray300",
      direction: "down"
    })]
  });
}

ShowMoreButton.displayName = "ShowMoreButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CollapsePanel);

const ShowMore = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dsvobb2"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";cursor:pointer;border-top:1px solid ", p => p.theme.border, ";", p => !p.disableBorder && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_7__.css)("border-left:1px solid ", p.theme.border, ";border-right:1px solid ", p.theme.border, ";border-bottom:1px solid ", p.theme.border, ";border-bottom-left-radius:", p.theme.borderRadius, ";border-bottom-right-radius:", p.theme.borderRadius, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const StyledIconList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconList,  true ? {
  target: "e1dsvobb1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

const ShowMoreText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dsvobb0"
} : 0)( true ? {
  name: "18keaja",
  styles: "display:flex;align-items:center;flex-grow:1"
} : 0);

/***/ }),

/***/ "./app/components/keyValueTable.tsx":
/*!******************************************!*\
  !*** ./app/components/keyValueTable.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "KeyValueTable": () => (/* binding */ KeyValueTable),
/* harmony export */   "KeyValueTableRow": () => (/* binding */ KeyValueTableRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





const KeyValueTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dl',  true ? {
  target: "e13z4zle2"
} : 0)( true ? {
  name: "u4s7v9",
  styles: "display:grid;grid-template-columns:50% 50%"
} : 0);
const KeyValueTableRow = _ref => {
  let {
    keyName,
    value
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Key, {
      children: keyName
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Value, {
      children: value
    })]
  });
};
KeyValueTableRow.displayName = "KeyValueTableRow";

const commonStyles = _ref2 => {
  let {
    theme
  } = _ref2;
  return `
font-size: ${theme.fontSizeMedium};
padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1)};
font-weight: normal;
line-height: inherit;
${p => p.theme.overflowEllipsis};
&:nth-of-type(2n-1) {
  background-color: ${theme.backgroundSecondary};
}
`;
};

const Key = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dt',  true ? {
  target: "e13z4zle1"
} : 0)(commonStyles, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const Value = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('dd',  true ? {
  target: "e13z4zle0"
} : 0)(commonStyles, ";color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

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

/***/ "./app/components/pageTimeRangeSelector.tsx":
/*!**************************************************!*\
  !*** ./app/components/pageTimeRangeSelector.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector */ "./app/components/organizations/timeRangeSelector/index.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function PageTimeRangeSelector(_ref) {
  let {
    className,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownDate, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_organizations_timeRangeSelector__WEBPACK_IMPORTED_MODULE_1__["default"], {
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(DropdownLabel, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Date Range:')
      }),
      detached: true,
      ...props
    }, `period:${props.relative}-start:${props.start}-end:${props.end}-utc:${props.utc}-defaultPeriod:${props.defaultPeriod}`)
  });
}

PageTimeRangeSelector.displayName = "PageTimeRangeSelector";

const DropdownDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel,  true ? {
  target: "e1hsuxgy1"
} : 0)("padding:0;margin:0;display:flex;justify-content:center;align-items:center;height:42px;background:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.textColor, ";>div{width:100%;align-self:stretch;}>div>div:first-child>div{padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";}>div>div:last-child:not(:first-child){min-width:calc(100% + 2px);transform:translateX(-1px);right:auto;}" + ( true ? "" : 0));

const DropdownLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1hsuxgy0"
} : 0)("text-align:left;font-weight:600;color:", p => p.theme.textColor, ";>span:last-child{font-weight:400;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageTimeRangeSelector);

/***/ }),

/***/ "./app/components/statusIndicator.tsx":
/*!********************************************!*\
  !*** ./app/components/statusIndicator.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * A badge/indicator at the beginning of the row that displays
 * the color of the status level (Warning, Error, Success, etc)
 *
 */
function StatusIndicator(_ref) {
  let {
    status,
    tooltipTitle
  } = _ref;
  let color = 'error';

  if (status === 'muted') {
    color = 'muted';
  } else if (status === 'info') {
    color = 'info';
  } else if (status === 'warning') {
    color = 'warning';
  } else if (status === 'success' || status === 'resolved') {
    color = 'success';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: tooltipTitle,
    skipWrapper: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(StatusLevel, {
      color: color
    })
  });
}

StatusIndicator.displayName = "StatusIndicator";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StatusIndicator);

const StatusLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1hixwjg0"
} : 0)("position:absolute;left:-1px;width:9px;height:15px;border-radius:0 3px 3px 0;background-color:", p => p.theme.alert[p.color].background, ";& span{display:block;width:9px;height:15px;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/discover/discoverQuery.tsx":
/*!**********************************************!*\
  !*** ./app/utils/discover/discoverQuery.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


/**
 * An individual row in a DiscoverQuery result
 */



function shouldRefetchData(prevProps, nextProps) {
  return prevProps.transactionName !== nextProps.transactionName || prevProps.transactionThreshold !== nextProps.transactionThreshold || prevProps.transactionThresholdMetric !== nextProps.transactionThresholdMetric;
}

function DiscoverQuery(props) {
  const endpoint = props.useEvents ? 'events' : 'eventsv2';
  const afterFetch = props.useEvents ? (data, _) => {
    var _data$meta;

    const {
      fields,
      ...otherMeta
    } = (_data$meta = data.meta) !== null && _data$meta !== void 0 ? _data$meta : {};
    return { ...data,
      meta: { ...fields,
        ...otherMeta
      }
    };
  } : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: endpoint,
    shouldRefetchData: shouldRefetchData,
    afterFetch: afterFetch,
    ...props
  });
}

DiscoverQuery.displayName = "DiscoverQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_0__["default"])(DiscoverQuery));

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

/***/ "./app/utils/performance/urls.ts":
/*!***************************************!*\
  !*** ./app/utils/performance/urls.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTransactionDetailsUrl": () => (/* binding */ getTransactionDetailsUrl)
/* harmony export */ });
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function getTransactionDetailsUrl(orgSlug, eventSlug, transaction, query, spanId) {
  const locationQuery = { ...(query || {}),
    transaction
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(locationQuery.transaction)) {
    delete locationQuery.transaction;
  }

  const target = {
    pathname: `/organizations/${orgSlug}/performance/${eventSlug}/`,
    query: locationQuery,
    hash: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(spanId) ? (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_0__.spanTargetHash)(spanId) : undefined
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(target.hash)) {
    delete target.hash;
  }

  return target;
}

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

/***/ "./app/views/alerts/rules/details/utils.tsx":
/*!**************************************************!*\
  !*** ./app/views/alerts/rules/details/utils.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "buildMetricGraphDateRange": () => (/* binding */ buildMetricGraphDateRange)
/* harmony export */ });
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/details/constants */ "./app/views/alerts/rules/metric/details/constants.tsx");




/**
 * Retrieve start/end date of a metric alert incident for the events graph
 * Will show at least 150 and no more than 10,000 data points
 */
function buildMetricGraphDateRange(incident) {
  const timeWindowMillis = incident.alertRule.timeWindow * 60 * 1000;
  const minRange = timeWindowMillis * sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_2__.API_INTERVAL_POINTS_MIN;
  const maxRange = timeWindowMillis * sentry_views_alerts_rules_metric_details_constants__WEBPACK_IMPORTED_MODULE_2__.API_INTERVAL_POINTS_LIMIT;
  const now = moment__WEBPACK_IMPORTED_MODULE_0___default().utc();
  const startDate = moment__WEBPACK_IMPORTED_MODULE_0___default().utc(incident.dateStarted); // make a copy of now since we will modify endDate and use now for comparing

  const endDate = incident.dateClosed ? moment__WEBPACK_IMPORTED_MODULE_0___default().utc(incident.dateClosed) : moment__WEBPACK_IMPORTED_MODULE_0___default()(now);
  const incidentRange = Math.max(endDate.diff(startDate), 3 * timeWindowMillis);
  const range = Math.min(maxRange, Math.max(minRange, incidentRange));
  const halfRange = moment__WEBPACK_IMPORTED_MODULE_0___default().duration(range / 2);
  return {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_1__.getUtcDateString)(startDate.subtract(halfRange)),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_1__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_0___default().min(endDate.add(halfRange), now))
  };
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/constants.tsx":
/*!*****************************************************!*\
  !*** ./app/views/alerts/rules/metric/constants.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COMPARISON_DELTA_OPTIONS": () => (/* binding */ COMPARISON_DELTA_OPTIONS),
/* harmony export */   "DATASET_EVENT_TYPE_FILTERS": () => (/* binding */ DATASET_EVENT_TYPE_FILTERS),
/* harmony export */   "DATASOURCE_EVENT_TYPE_FILTERS": () => (/* binding */ DATASOURCE_EVENT_TYPE_FILTERS),
/* harmony export */   "DEFAULT_AGGREGATE": () => (/* binding */ DEFAULT_AGGREGATE),
/* harmony export */   "DEFAULT_CHANGE_COMP_DELTA": () => (/* binding */ DEFAULT_CHANGE_COMP_DELTA),
/* harmony export */   "DEFAULT_CHANGE_TIME_WINDOW": () => (/* binding */ DEFAULT_CHANGE_TIME_WINDOW),
/* harmony export */   "DEFAULT_COUNT_TIME_WINDOW": () => (/* binding */ DEFAULT_COUNT_TIME_WINDOW),
/* harmony export */   "DEFAULT_TRANSACTION_AGGREGATE": () => (/* binding */ DEFAULT_TRANSACTION_AGGREGATE),
/* harmony export */   "DuplicateActionFields": () => (/* binding */ DuplicateActionFields),
/* harmony export */   "DuplicateMetricFields": () => (/* binding */ DuplicateMetricFields),
/* harmony export */   "DuplicateTriggerFields": () => (/* binding */ DuplicateTriggerFields),
/* harmony export */   "createDefaultRule": () => (/* binding */ createDefaultRule),
/* harmony export */   "createDefaultTrigger": () => (/* binding */ createDefaultTrigger),
/* harmony export */   "createRuleFromEventView": () => (/* binding */ createRuleFromEventView),
/* harmony export */   "createRuleFromWizardTemplate": () => (/* binding */ createRuleFromWizardTemplate),
/* harmony export */   "errorFieldConfig": () => (/* binding */ errorFieldConfig),
/* harmony export */   "getThresholdUnits": () => (/* binding */ getThresholdUnits),
/* harmony export */   "getWizardAlertFieldConfig": () => (/* binding */ getWizardAlertFieldConfig),
/* harmony export */   "transactionFieldConfig": () => (/* binding */ transactionFieldConfig)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");







const DEFAULT_COUNT_TIME_WINDOW = 1; // 1min

const DEFAULT_CHANGE_TIME_WINDOW = 60; // 1h

const DEFAULT_CHANGE_COMP_DELTA = 10080; // 1w

const DEFAULT_AGGREGATE = 'count()';
const DEFAULT_TRANSACTION_AGGREGATE = 'p95(transaction.duration)';
const DATASET_EVENT_TYPE_FILTERS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.TRANSACTIONS]: 'event.type:transaction',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.GENERIC_METRICS]: 'event.type:transaction'
};
const DATASOURCE_EVENT_TYPE_FILTERS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.ERROR_DEFAULT]: 'event.type:[error, default]',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.ERROR]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.DEFAULT]: 'event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.TRANSACTION]: 'event.type:transaction'
};

/**
 * Allowed error aggregations for alerts
 */
const errorFieldConfig = {
  aggregations: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Count, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.CountUnique],
  fields: ['user']
};
const commonAggregations = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Avg, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Percentile, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P50, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P75, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P95, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P99, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P100];
const allAggregations = [...commonAggregations, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.FailureRate, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Apdex, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Count];
const DuplicateMetricFields = ['dataset', 'eventTypes', 'aggregate', 'query', 'timeWindow', 'thresholdPeriod', 'projects', 'environment', 'resolveThreshold', 'thresholdType', 'owner', 'name', 'projectId', 'comparisonDelta'];
const DuplicateTriggerFields = ['alertThreshold', 'label'];
const DuplicateActionFields = ['type', 'targetType', 'targetIdentifier', 'inputChannelId', 'options'];
const COMPARISON_DELTA_OPTIONS = [{
  value: 5,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time 5 minutes ago')
}, // 5 minutes
{
  value: 15,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time 15 minutes ago')
}, // 15 minutes
{
  value: 60,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one hour ago')
}, // one hour
{
  value: 1440,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one day ago')
}, // one day
{
  value: 10080,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one week ago')
}, // one week
{
  value: 43200,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one month ago')
} // 30 days
];
function getWizardAlertFieldConfig(alertType, dataset) {
  if (alertType === 'custom' && dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS) {
    return errorFieldConfig;
  } // If user selected apdex we must include that in the OptionConfig as it has a user specified column


  const aggregations = alertType === 'apdex' || alertType === 'custom' ? allAggregations : commonAggregations;
  return {
    aggregations,
    fields: ['transaction.duration'],
    measurementKeys: Object.keys(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__.WEB_VITAL_DETAILS)
  };
}
/**
 * Allowed transaction aggregations for alerts
 */

const transactionFieldConfig = {
  aggregations: allAggregations,
  fields: ['transaction.duration'],
  measurementKeys: Object.keys(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__.WEB_VITAL_DETAILS)
};
function createDefaultTrigger(label) {
  return {
    label,
    alertThreshold: '',
    actions: []
  };
}
function createDefaultRule() {
  let defaultRuleOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.EventTypes.ERROR],
    aggregate: DEFAULT_AGGREGATE,
    query: '',
    timeWindow: 60,
    thresholdPeriod: 1,
    triggers: [createDefaultTrigger(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleTriggerType.CRITICAL), createDefaultTrigger(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleTriggerType.WARNING)],
    projects: [],
    environment: null,
    resolveThreshold: '',
    thresholdType: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.ABOVE,
    ...defaultRuleOptions
  };
}
/**
 * Create an unsaved alert from a discover EventView object
 */

function createRuleFromEventView(eventView) {
  var _parsedQuery$query;

  const parsedQuery = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.getQueryDatasource)(eventView.query);
  const datasetAndEventtypes = parsedQuery ? sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.DATA_SOURCE_TO_SET_AND_EVENT_TYPES[parsedQuery.source] : sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.DATA_SOURCE_TO_SET_AND_EVENT_TYPES.error;
  let aggregate = eventView.getYAxis();

  if (datasetAndEventtypes.dataset === 'transactions' && /^p\d{2,3}\(\)/.test(eventView.getYAxis())) {
    // p95() -> p95(transaction.duration)
    aggregate = eventView.getYAxis().slice(0, 3) + '(transaction.duration)';
  }

  return { ...createDefaultRule(),
    ...datasetAndEventtypes,
    query: (_parsedQuery$query = parsedQuery === null || parsedQuery === void 0 ? void 0 : parsedQuery.query) !== null && _parsedQuery$query !== void 0 ? _parsedQuery$query : eventView.query,
    aggregate,
    environment: eventView.environment.length ? eventView.environment[0] : null
  };
}
function createRuleFromWizardTemplate(wizardTemplate) {
  const {
    eventTypes,
    aggregate,
    dataset
  } = wizardTemplate;
  const defaultRuleOptions = {};

  if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.isSessionAggregate)(aggregate)) {
    defaultRuleOptions.thresholdType = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.BELOW;
    defaultRuleOptions.timeWindow = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TimeWindow.ONE_HOUR;
  }

  if (aggregate.includes('apdex')) {
    defaultRuleOptions.thresholdType = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.BELOW;
  }

  return { ...createDefaultRule(defaultRuleOptions),
    eventTypes: [eventTypes],
    aggregate,
    dataset
  };
}
function getThresholdUnits(aggregate, comparisonType) {
  // cls is a number not a measurement of time
  if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.isSessionAggregate)(aggregate) || comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleComparisonType.CHANGE) {
    return '%';
  }

  if (aggregate.includes('measurements.cls')) {
    return '';
  }

  if (aggregate.includes('duration') || aggregate.includes('measurements')) {
    return 'ms';
  }

  return '';
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/body.tsx":
/*!********************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/body.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DetailsBody)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/pageTimeRangeSelector */ "./app/components/pageTimeRangeSelector.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_details_metricHistory__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/details/metricHistory */ "./app/views/alerts/rules/metric/details/metricHistory.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/utils/getEventTypeFilter */ "./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../../../types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./constants */ "./app/views/alerts/rules/metric/details/constants.tsx");
/* harmony import */ var _metricChart__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./metricChart */ "./app/views/alerts/rules/metric/details/metricChart.tsx");
/* harmony import */ var _relatedIssues__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./relatedIssues */ "./app/views/alerts/rules/metric/details/relatedIssues.tsx");
/* harmony import */ var _relatedTransactions__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./relatedTransactions */ "./app/views/alerts/rules/metric/details/relatedTransactions.tsx");
/* harmony import */ var _sidebar__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./sidebar */ "./app/views/alerts/rules/metric/details/sidebar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
























class DetailsBody extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTimePeriodChange", datetime => {
      const {
        start,
        end,
        relative
      } = datetime;

      if (start && end) {
        return this.props.router.push({ ...this.props.location,
          query: {
            start: moment__WEBPACK_IMPORTED_MODULE_5___default()(start).utc().format(),
            end: moment__WEBPACK_IMPORTED_MODULE_5___default()(end).utc().format()
          }
        });
      }

      return this.props.router.push({ ...this.props.location,
        query: {
          period: relative
        }
      });
    });
  }

  getTimeWindow() {
    const {
      rule
    } = this.props;

    if (!rule) {
      return '';
    }

    const {
      timeWindow
    } = rule;
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('[window]', {
      window: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_8__["default"], {
        seconds: timeWindow * 60
      })
    });
  }

  getInterval() {
    const {
      timePeriod: {
        start,
        end
      },
      rule
    } = this.props;
    const startDate = moment__WEBPACK_IMPORTED_MODULE_5___default().utc(start);
    const endDate = moment__WEBPACK_IMPORTED_MODULE_5___default().utc(end);
    const timeWindow = rule === null || rule === void 0 ? void 0 : rule.timeWindow;
    const startEndDifferenceMs = endDate.diff(startDate);

    if (timeWindow && (startEndDifferenceMs < _constants__WEBPACK_IMPORTED_MODULE_20__.API_INTERVAL_POINTS_LIMIT * timeWindow * 60 * 1000 || // Special case 7 days * 1m interval over the api limit
    startEndDifferenceMs === _constants__WEBPACK_IMPORTED_MODULE_20__.TIME_WINDOWS[sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.TimePeriod.SEVEN_DAYS])) {
      return `${timeWindow}m`;
    }

    return (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_7__.getInterval)({
      start,
      end
    }, 'high');
  }

  getFilter() {
    const {
      rule
    } = this.props;
    const {
      dataset,
      query
    } = rule !== null && rule !== void 0 ? rule : {};

    if (!rule) {
      return null;
    }

    const eventType = (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_19__.isCrashFreeAlert)(dataset) ? null : (0,sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_17__.extractEventTypeFilterFromRule)(rule);
    return [eventType, query].join(' ').split(' ');
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Body, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Main, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
          height: "38px"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(ChartPanel, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.PanelBody, {
            withPadding: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
              height: "200px"
            })
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Side, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_12__["default"], {
          height: "200px"
        })
      })]
    });
  }

  render() {
    var _timePeriod$period;

    const {
      api,
      project,
      rule,
      incidents,
      location,
      organization,
      timePeriod,
      selectedIncident,
      params: {
        orgId
      }
    } = this.props;

    if (!rule || !project) {
      return this.renderLoading();
    }

    const {
      query,
      dataset
    } = rule;
    const queryWithTypeFilter = `${query} ${(0,sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_17__.extractEventTypeFilterFromRule)(rule)}`.trim();
    const relativeOptions = { ..._constants__WEBPACK_IMPORTED_MODULE_20__.SELECTOR_RELATIVE_PERIODS,
      ...(rule.timeWindow > 1 ? {
        [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.TimePeriod.FOURTEEN_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Last 14 days')
      } : {})
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [selectedIncident && selectedIncident.alertRule.status === _types__WEBPACK_IMPORTED_MODULE_18__.AlertRuleStatus.SNAPSHOT && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledLayoutBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledAlert, {
          type: "warning",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Alert Rule settings have been updated since this alert was triggered.')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Main, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledPageTimeRangeSelector, {
            organization: organization,
            relative: (_timePeriod$period = timePeriod.period) !== null && _timePeriod$period !== void 0 ? _timePeriod$period : '',
            start: timePeriod.custom && timePeriod.start || null,
            end: timePeriod.custom && timePeriod.end || null,
            utc: null,
            onUpdate: this.handleTimePeriodChange,
            relativeOptions: relativeOptions,
            showAbsolute: false
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_metricChart__WEBPACK_IMPORTED_MODULE_21__["default"], {
            api: api,
            rule: rule,
            incidents: incidents,
            timePeriod: timePeriod,
            selectedIncident: selectedIncident,
            organization: organization,
            project: project,
            interval: this.getInterval(),
            query: (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_19__.isCrashFreeAlert)(dataset) ? query : queryWithTypeFilter,
            filter: this.getFilter(),
            orgId: orgId
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(DetailWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(ActivityWrapper, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_views_alerts_rules_metric_details_metricHistory__WEBPACK_IMPORTED_MODULE_15__["default"], {
                organization: organization,
                incidents: incidents
              }), [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.Dataset.METRICS, sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.Dataset.SESSIONS, sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.Dataset.ERRORS].includes(dataset) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_relatedIssues__WEBPACK_IMPORTED_MODULE_22__["default"], {
                organization: organization,
                rule: rule,
                projects: [project],
                timePeriod: timePeriod,
                query: dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.Dataset.ERRORS ? queryWithTypeFilter : (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_19__.isCrashFreeAlert)(dataset) ? `${query} error.unhandled:true` : undefined
              }), dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_16__.Dataset.TRANSACTIONS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_relatedTransactions__WEBPACK_IMPORTED_MODULE_23__["default"], {
                organization: organization,
                location: location,
                rule: rule,
                projects: [project],
                timePeriod: timePeriod,
                filter: (0,sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_17__.extractEventTypeFilterFromRule)(rule)
              })]
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Side, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_sidebar__WEBPACK_IMPORTED_MODULE_24__["default"], {
            rule: rule
          })
        })]
      })]
    });
  }

}
DetailsBody.displayName = "DetailsBody";

const DetailWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1avmeho5"
} : 0)("display:flex;flex:1;@media (max-width: ", p => p.theme.breakpoints.small, "){flex-direction:column-reverse;}" + ( true ? "" : 0));

const StyledLayoutBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Body,  true ? {
  target: "e1avmeho4"
} : 0)("flex-grow:0;padding-bottom:0!important;@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:auto;}" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1avmeho3"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const ActivityWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1avmeho2"
} : 0)( true ? {
  name: "qu1srz",
  styles: "display:flex;flex:1;flex-direction:column;width:100%"
} : 0);

const ChartPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_11__.Panel,  true ? {
  target: "e1avmeho1"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

const StyledPageTimeRangeSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1avmeho0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/constants.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/constants.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALERT_DEFAULT_CHART_PERIOD": () => (/* binding */ ALERT_DEFAULT_CHART_PERIOD),
/* harmony export */   "API_INTERVAL_POINTS_LIMIT": () => (/* binding */ API_INTERVAL_POINTS_LIMIT),
/* harmony export */   "API_INTERVAL_POINTS_MIN": () => (/* binding */ API_INTERVAL_POINTS_MIN),
/* harmony export */   "SELECTOR_DEFAULT_PERIOD": () => (/* binding */ SELECTOR_DEFAULT_PERIOD),
/* harmony export */   "SELECTOR_RELATIVE_PERIODS": () => (/* binding */ SELECTOR_RELATIVE_PERIODS),
/* harmony export */   "TIME_OPTIONS": () => (/* binding */ TIME_OPTIONS),
/* harmony export */   "TIME_WINDOWS": () => (/* binding */ TIME_WINDOWS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");


const SELECTOR_RELATIVE_PERIODS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 6 hours'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 24 hours'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 3 days'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 7 days')
};
const ALERT_DEFAULT_CHART_PERIOD = '7d';
const TIME_OPTIONS = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 6 hours'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 24 hours'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 3 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 7 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Last 14 days'),
  value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS
}];
const TIME_WINDOWS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SIX_HOURS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_HOUR * 6 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.ONE_DAY]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.THREE_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 3 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.SEVEN_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 7 * 60 * 1000,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS]: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimeWindow.ONE_DAY * 14 * 60 * 1000
};
const SELECTOR_DEFAULT_PERIOD = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_1__.TimePeriod.FOURTEEN_DAYS;
const API_INTERVAL_POINTS_LIMIT = 10000;
const API_INTERVAL_POINTS_MIN = 150;

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/header.tsx":
/*!**********************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/header.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














function DetailsHeader(_ref) {
  var _project$slug, _rule$projects;

  let {
    hasMetricRuleDetailsError,
    rule,
    params,
    project
  } = _ref;
  const isRuleReady = !!rule && !hasMetricRuleDetailsError;
  const ruleTitle = rule && !hasMetricRuleDetailsError ? rule.name : '';
  const settingsLink = rule && `/organizations/${params.orgId}/alerts/${(0,_utils__WEBPACK_IMPORTED_MODULE_10__.isIssueAlert)(rule) ? 'rules' : 'metric-rules'}/${(_project$slug = project === null || project === void 0 ? void 0 : project.slug) !== null && _project$slug !== void 0 ? _project$slug : rule === null || rule === void 0 ? void 0 : (_rule$projects = rule.projects) === null || _rule$projects === void 0 ? void 0 : _rule$projects[0]}/${rule.id}/`;
  const duplicateLink = {
    pathname: `/organizations/${params.orgId}/alerts/new/metric/`,
    query: {
      project: project === null || project === void 0 ? void 0 : project.slug,
      duplicateRuleId: rule === null || rule === void 0 ? void 0 : rule.id,
      createFromDuplicate: true,
      referrer: 'metric_rule_details'
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(BreadCrumbBar, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(AlertBreadcrumbs, {
        crumbs: [{
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Alerts'),
          to: `/organizations/${params.orgId}/alerts/rules/`
        }, {
          label: ruleTitle
        }]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Controls, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconCopy, {}),
          to: duplicateLink,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Duplicate')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconEdit, {}),
          to: settingsLink,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Edit Rule')
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Details, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(RuleTitle, {
        "data-test-id": "incident-rule-title",
        loading: !isRuleReady,
        children: [project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
          project: project,
          avatarSize: 28,
          hideName: true,
          avatarProps: {
            hasTooltip: true,
            tooltip: project.slug
          }
        }), ruleTitle]
      })
    })]
  });
}

DetailsHeader.displayName = "DetailsHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DetailsHeader);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epymnhm5"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border-bottom:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

const BreadCrumbBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epymnhm4"
} : 0)("display:flex;margin-bottom:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const AlertBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "epymnhm3"
} : 0)("flex-grow:1;font-size:", p => p.theme.fontSizeExtraLarge, ";padding:0;" + ( true ? "" : 0));

const Controls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "epymnhm2"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_8__.PageHeader,  true ? {
  target: "epymnhm1"
} : 0)("margin-bottom:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";grid-template-columns:max-content auto;display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";grid-auto-flow:column;@media (max-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:auto;grid-auto-flow:row;}" + ( true ? "" : 0));

const RuleTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  shouldForwardProp: p => typeof p === 'string' && (0,_emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_1__["default"])(p) && p !== 'loading',
  target: "epymnhm0"
} : 0)(p => p.loading && 'opacity: 0', ";line-height:1.5;display:grid;grid-template-columns:max-content 1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/index.tsx":
/*!*********************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/index.tsx ***!
  \*********************************************************/
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
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_alerts_rules_details_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/rules/details/utils */ "./app/views/alerts/rules/details/utils.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_utils_apiCalls__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/alerts/utils/apiCalls */ "./app/views/alerts/utils/apiCalls.tsx");
/* harmony import */ var _body__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./body */ "./app/views/alerts/rules/metric/details/body.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./constants */ "./app/views/alerts/rules/metric/details/constants.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./header */ "./app/views/alerts/rules/metric/details/header.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

























class MetricAlertDetails extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isLoading: false,
      hasError: false,
      error: null,
      selectedIncident: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      var _this$state$rule;

      const {
        api,
        params: {
          orgId,
          ruleId
        },
        location
      } = this.props;
      this.setState({
        isLoading: true,
        hasError: false
      }); // Skip loading existing rule

      const rulePromise = ruleId === ((_this$state$rule = this.state.rule) === null || _this$state$rule === void 0 ? void 0 : _this$state$rule.id) ? Promise.resolve(this.state.rule) : (0,sentry_views_alerts_utils_apiCalls__WEBPACK_IMPORTED_MODULE_18__.fetchAlertRule)(orgId, ruleId, {
        expand: 'latestIncident'
      }); // Fetch selected incident, if it exists. We need this to set the selected date range

      let selectedIncident = null;

      if (location.query.alert) {
        try {
          selectedIncident = await (0,sentry_views_alerts_utils_apiCalls__WEBPACK_IMPORTED_MODULE_18__.fetchIncident)(api, orgId, location.query.alert);
        } catch {// TODO: selectedIncident specific error
        }
      }

      const timePeriod = this.getTimePeriod(selectedIncident);
      const {
        start,
        end
      } = timePeriod;

      try {
        const [incidents, rule] = await Promise.all([(0,sentry_views_alerts_utils_apiCalls__WEBPACK_IMPORTED_MODULE_18__.fetchIncidentsForRule)(orgId, ruleId, start, end), rulePromise]);
        this.setState({
          incidents,
          rule,
          selectedIncident,
          isLoading: false,
          hasError: false
        });
      } catch (error) {
        this.setState({
          selectedIncident,
          isLoading: false,
          hasError: true,
          error
        });
      }
    });
  }

  componentDidMount() {
    const {
      api,
      params
    } = this.props;
    (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__.fetchOrgMembers)(api, params.orgId);
    this.fetchData();
    this.trackView();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location.search !== this.props.location.search || prevProps.params.orgId !== this.props.params.orgId || prevProps.params.ruleId !== this.props.params.ruleId) {
      this.fetchData();
      this.trackView();
    }
  }

  trackView() {
    var _ref;

    const {
      params,
      organization,
      location
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__["default"])('alert_rule_details.viewed', {
      organization,
      rule_id: parseInt(params.ruleId, 10),
      alert: (_ref = location.query.alert) !== null && _ref !== void 0 ? _ref : '',
      has_chartcuterie: organization.features.includes('metric-alert-chartcuterie').toString()
    });
  }

  getTimePeriod(selectedIncident) {
    var _ref2, _TIME_OPTIONS$find;

    const {
      location
    } = this.props;
    const period = (_ref2 = location.query.period) !== null && _ref2 !== void 0 ? _ref2 : sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_17__.TimePeriod.SEVEN_DAYS;

    if (location.query.start && location.query.end) {
      return {
        start: location.query.start,
        end: location.query.end,
        period,
        usingPeriod: false,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Custom time'),
        display: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
            date: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(location.query.start)
          }), ' — ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
            date: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(location.query.end)
          })]
        }),
        custom: true
      };
    }

    if (location.query.alert && selectedIncident) {
      const {
        start,
        end
      } = (0,sentry_views_alerts_rules_details_utils__WEBPACK_IMPORTED_MODULE_16__.buildMetricGraphDateRange)(selectedIncident);
      return {
        start,
        end,
        period,
        usingPeriod: false,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Custom time'),
        display: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
            date: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(start)
          }), ' — ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
            date: moment__WEBPACK_IMPORTED_MODULE_4___default().utc(end)
          })]
        }),
        custom: true
      };
    }

    const timeOption = (_TIME_OPTIONS$find = _constants__WEBPACK_IMPORTED_MODULE_20__.TIME_OPTIONS.find(item => item.value === period)) !== null && _TIME_OPTIONS$find !== void 0 ? _TIME_OPTIONS$find : _constants__WEBPACK_IMPORTED_MODULE_20__.TIME_OPTIONS[1];
    const start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_13__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_4___default()(moment__WEBPACK_IMPORTED_MODULE_4___default().utc().diff(_constants__WEBPACK_IMPORTED_MODULE_20__.TIME_WINDOWS[timeOption.value])));
    const end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_13__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_4___default().utc());
    return {
      start,
      end,
      period,
      usingPeriod: true,
      label: timeOption.label,
      display: timeOption.label
    };
  }

  renderError() {
    const {
      error
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_11__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_6__["default"], {
        type: "error",
        showIcon: true,
        children: (error === null || error === void 0 ? void 0 : error.status) === 404 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('This alert rule could not be found.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('An error occurred while fetching the alert rule.')
      })
    });
  }

  render() {
    var _rule$name;

    const {
      rule,
      incidents,
      hasError,
      selectedIncident
    } = this.state;
    const {
      params,
      projects,
      loadingProjects
    } = this.props;
    const timePeriod = this.getTimePeriod(selectedIncident);

    if (hasError) {
      return this.renderError();
    }

    const project = projects.find(_ref3 => {
      let {
        slug
      } = _ref3;
      return slug === (rule === null || rule === void 0 ? void 0 : rule.projects[0]);
    });
    const isGlobalSelectionReady = project !== undefined && !loadingProjects;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_8__["default"], {
      skipLoadLastUsed: true,
      skipInitializeUrlParams: true,
      shouldForceProject: isGlobalSelectionReady,
      forceProject: project,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_9__["default"], {
        title: (_rule$name = rule === null || rule === void 0 ? void 0 : rule.name) !== null && _rule$name !== void 0 ? _rule$name : ''
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_header__WEBPACK_IMPORTED_MODULE_21__["default"], {
        hasMetricRuleDetailsError: hasError,
        params: params,
        rule: rule,
        project: project
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_body__WEBPACK_IMPORTED_MODULE_19__["default"], { ...this.props,
        rule: rule,
        project: project,
        incidents: incidents,
        timePeriod: timePeriod,
        selectedIncident: selectedIncident
      })]
    });
  }

}

MetricAlertDetails.displayName = "MetricAlertDetails";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_15__["default"])(MetricAlertDetails)));

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/metricChart.tsx":
/*!***************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/metricChart.tsx ***!
  \***************************************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_42___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_42__);
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/components/markArea */ "./app/components/charts/components/markArea.tsx");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/charts/series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/charts/sessionsRequest */ "./app/components/charts/sessionsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_metricRulePresets__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/metricRulePresets */ "./app/views/alerts/rules/metric/metricRulePresets.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/alerts/utils/getChangeStatus */ "./app/views/alerts/utils/getChangeStatus.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ../../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _utils_getMetricDatasetQueryExtras__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ../utils/getMetricDatasetQueryExtras */ "./app/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ../utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");
/* harmony import */ var _metricChartOption__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./metricChartOption */ "./app/views/alerts/rules/metric/details/metricChartOption.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports











































function formatTooltipDate(date, format) {
  const {
    options: {
      timezone
    }
  } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_25__["default"].get('user');
  return moment_timezone__WEBPACK_IMPORTED_MODULE_7___default().tz(date, timezone).format(format);
}

function getRuleChangeSeries(rule, data) {
  const {
    dateModified
  } = rule;

  if (!data.length || !data[0].data.length || !dateModified) {
    return [];
  }

  const seriesData = data[0].data;
  const seriesStart = new Date(seriesData[0].name).getTime();
  const ruleChanged = new Date(dateModified).getTime();

  if (ruleChanged < seriesStart) {
    return [];
  }

  return [{
    type: 'line',
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_13__["default"])({
      silent: true,
      animation: false,
      lineStyle: {
        color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].gray200,
        type: 'solid',
        width: 1
      },
      data: [{
        xAxis: ruleChanged
      }],
      label: {
        show: false
      }
    }),
    markArea: (0,sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_12__["default"])({
      silent: true,
      itemStyle: {
        color: color__WEBPACK_IMPORTED_MODULE_42___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].gray100).alpha(0.42).rgb().string()
      },
      data: [[{
        xAxis: seriesStart
      }, {
        xAxis: ruleChanged
      }]]
    }),
    data: []
  }];
}

class MetricChart extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      width: -1,
      height: -1
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "ref", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateDimensions", () => {
      var _this$ref, _this$ref$getEchartsI;

      const chartRef = (_this$ref = this.ref) === null || _this$ref === void 0 ? void 0 : (_this$ref$getEchartsI = _this$ref.getEchartsInstance) === null || _this$ref$getEchartsI === void 0 ? void 0 : _this$ref$getEchartsI.call(_this$ref);

      if (!chartRef) {
        return;
      }

      const width = chartRef.getWidth();
      const height = chartRef.getHeight();

      if (width !== this.state.width || height !== this.state.height) {
        this.setState({
          width,
          height
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRef", ref => {
      if (ref && !this.ref) {
        this.ref = ref;
        this.updateDimensions();
      }

      if (!ref) {
        this.ref = null;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleZoom", (start, end) => {
      const {
        location
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: {
          start,
          end
        }
      });
    });
  }

  renderChartActions(totalDuration, criticalDuration, warningDuration) {
    const {
      rule,
      orgId,
      project,
      timePeriod,
      query
    } = this.props;
    const {
      buttonText,
      ...props
    } = (0,sentry_views_alerts_rules_metric_metricRulePresets__WEBPACK_IMPORTED_MODULE_33__.makeDefaultCta)({
      orgSlug: orgId,
      projects: [project],
      rule,
      timePeriod,
      query
    });
    const resolvedPercent = 100 * Math.max(totalDuration - criticalDuration - warningDuration, 0) / totalDuration;
    const criticalPercent = 100 * Math.min(criticalDuration / totalDuration, 1);
    const warningPercent = 100 * Math.min(warningDuration / totalDuration, 1);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(StyledChartControls, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(StyledInlineContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Summary')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(StyledSectionValue, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ValueItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_23__.IconCheckmark, {
              color: "green300",
              isCircled: true
            }), resolvedPercent ? resolvedPercent.toFixed(2) : 0, "%"]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ValueItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_23__.IconWarning, {
              color: "yellow300"
            }), warningPercent ? warningPercent.toFixed(2) : 0, "%"]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ValueItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_23__.IconFire, {
              color: "red300"
            }), criticalPercent ? criticalPercent.toFixed(2) : 0, "%"]
          })]
        })]
      }), !(0,_utils__WEBPACK_IMPORTED_MODULE_38__.isSessionAggregate)(rule.aggregate) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
        features: ['discover-basic'],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          size: "sm",
          ...props,
          children: buttonText
        })
      })]
    });
  }

  renderChart(loading, timeseriesData, minutesThresholdToDisplaySeconds, comparisonTimeseriesData) {
    var _COMPARISON_DELTA_OPT;

    const {
      router,
      selectedIncident,
      interval,
      filter,
      incidents,
      rule,
      organization,
      timePeriod: {
        start,
        end
      }
    } = this.props;
    const {
      width
    } = this.state;
    const {
      dateModified,
      timeWindow
    } = rule;

    if (loading || !timeseriesData) {
      return this.renderEmpty();
    }

    const handleIncidentClick = incident => {
      router.push({
        pathname: (0,_utils__WEBPACK_IMPORTED_MODULE_38__.alertDetailsLink)(organization, incident),
        query: {
          alert: incident.identifier
        }
      });
    };

    const {
      criticalDuration,
      warningDuration,
      totalDuration,
      chartOption
    } = (0,_metricChartOption__WEBPACK_IMPORTED_MODULE_41__.getMetricAlertChartOption)({
      timeseriesData,
      rule,
      incidents,
      selectedIncident,
      handleIncidentClick
    });
    const comparisonSeriesName = lodash_capitalize__WEBPACK_IMPORTED_MODULE_5___default()(((_COMPARISON_DELTA_OPT = sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_32__.COMPARISON_DELTA_OPTIONS.find(_ref => {
      let {
        value
      } = _ref;
      return value === rule.comparisonDelta;
    })) === null || _COMPARISON_DELTA_OPT === void 0 ? void 0 : _COMPARISON_DELTA_OPT.label) || '');
    const additionalSeries = [...(comparisonTimeseriesData || []).map(_ref2 => {
      let {
        data: _data,
        ...otherSeriesProps
      } = _ref2;
      return (0,sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_15__["default"])({
        name: comparisonSeriesName,
        data: _data.map(_ref3 => {
          let {
            name,
            value
          } = _ref3;
          return [name, value];
        }),
        lineStyle: {
          color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].gray200,
          type: 'dashed',
          width: 1
        },
        itemStyle: {
          color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].gray200
        },
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
        ...otherSeriesProps
      });
    }), ...getRuleChangeSeries(rule, timeseriesData)];
    const queryFilter = (filter === null || filter === void 0 ? void 0 : filter.join(' ')) + (0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)(' over ') + (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_28__.getDuration)(rule.timeWindow * 60);
    const percentOfWidth = width >= 1151 ? 15 : width < 1151 && width >= 700 ? 14 : width < 700 && width >= 515 ? 13 : width < 515 && width >= 300 ? 12 : 8;
    const truncateWidth = percentOfWidth / 100 * width;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ChartPanel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(StyledPanelBody, {
        withPadding: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(ChartHeader, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__.HeaderTitleLegend, {
            children: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_36__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_37__.getAlertTypeFromAggregateDataset)(rule)]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ChartFilters, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledCircleIndicator, {
            size: 8
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Filters, {
            children: rule.aggregate
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_22__["default"], {
            value: queryFilter !== null && queryFilter !== void 0 ? queryFilter : '',
            maxLength: truncateWidth
          })]
        }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_29__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_11__["default"], {
            router: router,
            start: start,
            end: end,
            onZoom: zoomArgs => this.handleZoom(zoomArgs.start, zoomArgs.end),
            onFinished: () => {
              // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
              // any graphics related to the triggers (e.g. the threshold areas + boundaries)
              this.updateDimensions();
            },
            children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_10__.AreaChart, { ...zoomRenderProps,
              ...chartOption,
              showTimeInTooltip: true,
              minutesThresholdToDisplaySeconds: minutesThresholdToDisplaySeconds,
              forwardedRef: this.handleRef,
              additionalSeries: additionalSeries,
              tooltip: {
                formatter: seriesParams => {
                  var _parseStatsPeriod;

                  // seriesParams can be object instead of array
                  const pointSeries = Array.isArray(seriesParams) ? seriesParams : [seriesParams];
                  const {
                    marker,
                    data: pointData,
                    seriesName
                  } = pointSeries[0];
                  const [pointX, pointY] = pointData;
                  const pointYFormatted = (0,_utils__WEBPACK_IMPORTED_MODULE_38__.alertTooltipValueFormatter)(pointY, seriesName !== null && seriesName !== void 0 ? seriesName : '', rule.aggregate);
                  const isModified = dateModified && pointX <= new Date(dateModified).getTime();
                  const startTime = formatTooltipDate(moment__WEBPACK_IMPORTED_MODULE_6___default()(pointX), 'MMM D LT');
                  const {
                    period,
                    periodLength
                  } = (_parseStatsPeriod = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_19__.parseStatsPeriod)(interval)) !== null && _parseStatsPeriod !== void 0 ? _parseStatsPeriod : {
                    periodLength: 'm',
                    period: `${timeWindow}`
                  };
                  const endTime = formatTooltipDate(moment__WEBPACK_IMPORTED_MODULE_6___default()(pointX).add(parseInt(period, 10), periodLength), 'MMM D LT');
                  const comparisonSeries = pointSeries.length > 1 ? pointSeries.find(_ref4 => {
                    let {
                      seriesName: _sn
                    } = _ref4;
                    return _sn === comparisonSeriesName;
                  }) : undefined;
                  const comparisonPointY = comparisonSeries === null || comparisonSeries === void 0 ? void 0 : comparisonSeries.data[1];
                  const comparisonPointYFormatted = comparisonPointY !== undefined ? (0,_utils__WEBPACK_IMPORTED_MODULE_38__.alertTooltipValueFormatter)(comparisonPointY, seriesName !== null && seriesName !== void 0 ? seriesName : '', rule.aggregate) : undefined;
                  const changePercentage = comparisonPointY === undefined ? NaN : (pointY - comparisonPointY) * 100 / comparisonPointY;
                  const changeStatus = (0,sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_35__.getChangeStatus)(changePercentage, rule.thresholdType, rule.triggers);
                  const changeStatusColor = changeStatus === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_34__.AlertRuleTriggerType.CRITICAL ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].red300 : changeStatus === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_34__.AlertRuleTriggerType.WARNING ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].yellow300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_31__["default"].green300;
                  return [`<div class="tooltip-series">`, isModified && `<div><span class="tooltip-label"><strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_24__.t)('Alert Rule Modified')}</strong></span></div>`, `<div><span class="tooltip-label">${marker} <strong>${seriesName}</strong></span>${pointYFormatted}</div>`, comparisonSeries && `<div><span class="tooltip-label">${comparisonSeries.marker} <strong>${comparisonSeriesName}</strong></span>${comparisonPointYFormatted}</div>`, `</div>`, `<div class="tooltip-date">`, `<span>${startTime} &mdash; ${endTime}</span>`, comparisonPointY !== undefined && Math.abs(changePercentage) !== Infinity && !isNaN(changePercentage) && `<span style="color:${changeStatusColor};margin-left:10px;">${Math.sign(changePercentage) === 1 ? '+' : '-'}${Math.abs(changePercentage).toFixed(2)}%</span>`, `</div>`, '<div class="tooltip-arrow"></div>'].filter(e => e).join('');
                }
              }
            })
          }),
          fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_21__["default"], {
            height: "200px",
            testId: "skeleton-ui"
          })
        })]
      }), this.renderChartActions(totalDuration, criticalDuration, warningDuration)]
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(ChartPanel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_20__.PanelBody, {
        withPadding: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_21__["default"], {
          height: "200px"
        })
      })
    });
  }

  render() {
    const {
      api,
      rule,
      organization,
      timePeriod,
      project,
      interval,
      query,
      location
    } = this.props;
    const {
      aggregate,
      timeWindow,
      environment,
      dataset
    } = rule; // Fix for 7 days * 1m interval being over the max number of results from events api
    // 10k events is the current max

    if (timePeriod.usingPeriod && timePeriod.period === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_34__.TimePeriod.SEVEN_DAYS && interval === '1m') {
      timePeriod.start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_27__.getUtcDateString)( // -5 minutes provides a small cushion for rounding up minutes. This might be able to be smaller
      moment__WEBPACK_IMPORTED_MODULE_6___default()(moment__WEBPACK_IMPORTED_MODULE_6___default().utc(timePeriod.end).subtract(10000 - 5, 'minutes')));
    } // If the chart duration isn't as long as the rollup duration the events-stats
    // endpoint will return an invalid timeseriesData dataset


    const viableStartDate = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_27__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_6___default().min(moment__WEBPACK_IMPORTED_MODULE_6___default().utc(timePeriod.start), moment__WEBPACK_IMPORTED_MODULE_6___default().utc(timePeriod.end).subtract(timeWindow, 'minutes')));
    const viableEndDate = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_27__.getUtcDateString)(moment__WEBPACK_IMPORTED_MODULE_6___default().utc(timePeriod.end).add(timeWindow, 'minutes'));
    const queryExtras = (0,_utils_getMetricDatasetQueryExtras__WEBPACK_IMPORTED_MODULE_39__.getMetricDatasetQueryExtras)({
      organization,
      location,
      dataset,
      newAlertOrQuery: false
    });
    return (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_40__.isCrashFreeAlert)(dataset) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_16__["default"], {
      api: api,
      organization: organization,
      project: project.id ? [Number(project.id)] : [],
      environment: environment ? [environment] : undefined,
      start: viableStartDate,
      end: viableEndDate,
      query: query,
      interval: interval,
      field: _utils__WEBPACK_IMPORTED_MODULE_38__.SESSION_AGGREGATE_TO_FIELD[aggregate],
      groupBy: ['session.status'],
      children: _ref5 => {
        let {
          loading,
          response
        } = _ref5;
        return this.renderChart(loading, (0,_metricChartOption__WEBPACK_IMPORTED_MODULE_41__.transformSessionResponseToSeries)(response, rule), sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_30__.MINUTES_THRESHOLD_TO_DISPLAY_SECONDS);
      }
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_14__["default"], {
      api: api,
      organization: organization,
      query: query,
      environment: environment ? [environment] : undefined,
      project: project.id ? [Number(project.id)] : [],
      interval: interval,
      comparisonDelta: rule.comparisonDelta ? rule.comparisonDelta * 60 : undefined,
      start: viableStartDate,
      end: viableEndDate,
      yAxis: aggregate,
      includePrevious: false,
      currentSeriesNames: [aggregate],
      partial: false,
      queryExtras: queryExtras,
      referrer: "api.alerts.alert-rule-chart",
      children: _ref6 => {
        let {
          loading,
          timeseriesData,
          comparisonTimeseriesData
        } = _ref6;
        return this.renderChart(loading, timeseriesData, undefined, comparisonTimeseriesData);
      }
    });
  }

}

MetricChart.displayName = "MetricChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(MetricChart));

const ChartPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_20__.Panel,  true ? {
  target: "ezce5el9"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(2), ";" + ( true ? "" : 0));

const ChartHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ezce5el8"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(3), ";" + ( true ? "" : 0));

const StyledChartControls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__.ChartControls,  true ? {
  target: "ezce5el7"
} : 0)( true ? {
  name: "qgg235",
  styles: "display:flex;justify-content:space-between;flex-wrap:wrap"
} : 0);

const StyledInlineContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__.InlineContainer,  true ? {
  target: "ezce5el6"
} : 0)("grid-auto-flow:column;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(1), ";" + ( true ? "" : 0));

const StyledCircleIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "ezce5el5"
} : 0)("background:", p => p.theme.formText, ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(1), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(0.5), ";" + ( true ? "" : 0));

const ChartFilters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ezce5el4"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.family, ";color:", p => p.theme.textColor, ";display:inline-grid;grid-template-columns:repeat(3, max-content);align-items:center;" + ( true ? "" : 0));

const Filters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ezce5el3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(1), ";" + ( true ? "" : 0));

const StyledSectionValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_17__.SectionValue,  true ? {
  target: "ezce5el2"
} : 0)("display:grid;grid-template-columns:repeat(3, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(1.5), ";margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(1.5), ";" + ( true ? "" : 0));

const ValueItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ezce5el1"
} : 0)("display:grid;grid-template-columns:repeat(2, auto);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_26__["default"])(0.5), ";align-items:center;font-variant-numeric:tabular-nums;" + ( true ? "" : 0));
/* Override padding to make chart appear centered */


const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_20__.PanelBody,  true ? {
  target: "ezce5el0"
} : 0)( true ? {
  name: "sgs7ru",
  styles: "padding-right:6px"
} : 0);

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/metricChartOption.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/metricChartOption.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getMetricAlertChartOption": () => (/* binding */ getMetricAlertChartOption),
/* harmony export */   "transformSessionResponseToSeries": () => (/* binding */ transformSessionResponseToSeries)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_18___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_18__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/components/markArea */ "./app/components/charts/components/markArea.tsx");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");




















function formatTooltipDate(date, format) {
  const {
    options: {
      timezone
    }
  } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('user');
  return moment_timezone__WEBPACK_IMPORTED_MODULE_3___default().tz(date, timezone).format(format);
}

function createStatusAreaSeries(lineColor, startTime, endTime, yPosition) {
  return {
    seriesName: '',
    type: 'line',
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_5__["default"])({
      silent: true,
      lineStyle: {
        color: lineColor,
        type: 'solid',
        width: 4
      },
      data: [[{
        coord: [startTime, yPosition]
      }, {
        coord: [endTime, yPosition]
      }]]
    }),
    data: []
  };
}

function createThresholdSeries(lineColor, threshold) {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_5__["default"])({
      silent: true,
      lineStyle: {
        color: lineColor,
        type: 'dashed',
        width: 1
      },
      data: [{
        yAxis: threshold
      }],
      label: {
        show: false
      }
    }),
    data: []
  };
}

function createIncidentSeries(incident, lineColor, incidentTimestamp, dataPoint, seriesName, aggregate, handleIncidentClick) {
  const formatter = _ref => {
    let {
      value,
      marker
    } = _ref;
    const time = formatTooltipDate(moment__WEBPACK_IMPORTED_MODULE_2___default()(value), 'MMM D, YYYY LT');
    return [`<div class="tooltip-series"><div>`, `<span class="tooltip-label">${marker} <strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Alert')} #${incident.identifier}</strong></span>${dataPoint !== null && dataPoint !== void 0 && dataPoint.value ? `${seriesName} ${(0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.alertTooltipValueFormatter)(dataPoint.value, seriesName !== null && seriesName !== void 0 ? seriesName : '', aggregate !== null && aggregate !== void 0 ? aggregate : '')}` : ''}`, `</div></div>`, `<div class="tooltip-date">${time}</div>`, '<div class="tooltip-arrow"></div>'].join('');
  };

  return {
    seriesName: 'Incident Line',
    type: 'line',
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_5__["default"])({
      silent: false,
      lineStyle: {
        color: lineColor,
        type: 'solid'
      },
      data: [{
        xAxis: incidentTimestamp,
        // @ts-expect-error onClick not in echart types
        onClick: () => handleIncidentClick === null || handleIncidentClick === void 0 ? void 0 : handleIncidentClick(incident)
      }],
      label: {
        silent: true,
        show: !!incident.identifier,
        position: 'insideEndBottom',
        formatter: incident.identifier,
        color: lineColor,
        fontSize: 10,
        fontFamily: 'Rubik'
      },
      tooltip: {
        formatter
      }
    }),
    data: [],
    tooltip: {
      trigger: 'item',
      alwaysShowContent: true,
      formatter
    }
  };
}

function getMetricAlertChartOption(_ref2) {
  var _dataArr$, _dataArr;

  let {
    timeseriesData,
    rule,
    incidents,
    selectedIncident,
    handleIncidentClick
  } = _ref2;
  const criticalTrigger = rule.triggers.find(_ref3 => {
    let {
      label
    } = _ref3;
    return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__.AlertRuleTriggerType.CRITICAL;
  });
  const warningTrigger = rule.triggers.find(_ref4 => {
    let {
      label
    } = _ref4;
    return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__.AlertRuleTriggerType.WARNING;
  });
  const series = [...timeseriesData];
  const areaSeries = []; // Ensure series data appears below incident/mark lines

  series[0].z = 1;
  series[0].color = sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_6__["default"][0][0];
  const dataArr = timeseriesData[0].data;
  const maxSeriesValue = dataArr.reduce((currMax, coord) => Math.max(currMax, coord.value), 0); // find the lowest value between chart data points, warning threshold,
  // critical threshold and then apply some breathing space

  const minChartValue = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.shouldScaleAlertChart)(rule.aggregate) ? Math.floor(Math.min(dataArr.reduce((currMax, coord) => Math.min(currMax, coord.value), Infinity), typeof (warningTrigger === null || warningTrigger === void 0 ? void 0 : warningTrigger.alertThreshold) === 'number' ? warningTrigger.alertThreshold : Infinity, typeof (criticalTrigger === null || criticalTrigger === void 0 ? void 0 : criticalTrigger.alertThreshold) === 'number' ? criticalTrigger.alertThreshold : Infinity) / sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.ALERT_CHART_MIN_MAX_BUFFER) : 0;
  const firstPoint = new Date((_dataArr$ = dataArr[0]) === null || _dataArr$ === void 0 ? void 0 : _dataArr$.name).getTime();
  const lastPoint = new Date((_dataArr = dataArr[dataArr.length - 1]) === null || _dataArr === void 0 ? void 0 : _dataArr.name).getTime();
  const totalDuration = lastPoint - firstPoint;
  let criticalDuration = 0;
  let warningDuration = 0;
  series.push(createStatusAreaSeries(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.green300, firstPoint, lastPoint, minChartValue));

  if (incidents) {
    // select incidents that fall within the graph range
    incidents.filter(incident => !incident.dateClosed || new Date(incident.dateClosed).getTime() > firstPoint).forEach(incident => {
      var _incident$activities, _incident$dateClosed;

      const activities = (_incident$activities = incident.activities) !== null && _incident$activities !== void 0 ? _incident$activities : [];
      const statusChanges = activities.filter(_ref5 => {
        let {
          type,
          value
        } = _ref5;
        return type === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentActivityType.STATUS_CHANGE && [sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.WARNING, sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.CRITICAL].includes(Number(value));
      }).sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
      const incidentEnd = (_incident$dateClosed = incident.dateClosed) !== null && _incident$dateClosed !== void 0 ? _incident$dateClosed : new Date().getTime();
      const timeWindowMs = rule.timeWindow * 60 * 1000;
      const incidentColor = warningTrigger && !statusChanges.find(_ref6 => {
        let {
          value
        } = _ref6;
        return Number(value) === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.CRITICAL;
      }) ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.red300;
      const incidentStartDate = new Date(incident.dateStarted).getTime();
      const incidentCloseDate = incident.dateClosed ? new Date(incident.dateClosed).getTime() : lastPoint;
      const incidentStartValue = dataArr.find(point => new Date(point.name).getTime() >= incidentStartDate);
      series.push(createIncidentSeries(incident, incidentColor, incidentStartDate, incidentStartValue, series[0].seriesName, rule.aggregate, handleIncidentClick));
      const areaStart = Math.max(new Date(incident.dateStarted).getTime(), firstPoint);
      const areaEnd = Math.min(statusChanges.length && statusChanges[0].dateCreated ? new Date(statusChanges[0].dateCreated).getTime() - timeWindowMs : new Date(incidentEnd).getTime(), lastPoint);
      const areaColor = warningTrigger ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.red300;

      if (areaEnd > areaStart) {
        series.push(createStatusAreaSeries(areaColor, areaStart, areaEnd, minChartValue));

        if (areaColor === sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300) {
          warningDuration += Math.abs(areaEnd - areaStart);
        } else {
          criticalDuration += Math.abs(areaEnd - areaStart);
        }
      }

      statusChanges.forEach((activity, idx) => {
        const statusAreaStart = Math.max(new Date(activity.dateCreated).getTime() - timeWindowMs, firstPoint);
        const statusAreaEnd = Math.min(idx === statusChanges.length - 1 ? new Date(incidentEnd).getTime() : new Date(statusChanges[idx + 1].dateCreated).getTime() - timeWindowMs, lastPoint);
        const statusAreaColor = activity.value === `${sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.CRITICAL}` ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.red300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300;

        if (statusAreaEnd > statusAreaStart) {
          series.push(createStatusAreaSeries(statusAreaColor, statusAreaStart, statusAreaEnd, minChartValue));

          if (statusAreaColor === sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300) {
            warningDuration += Math.abs(statusAreaEnd - statusAreaStart);
          } else {
            criticalDuration += Math.abs(statusAreaEnd - statusAreaStart);
          }
        }
      });

      if (selectedIncident && incident.id === selectedIncident.id) {
        const selectedIncidentColor = incidentColor === sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300 ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow100 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.red100;
        areaSeries.push({
          seriesName: '',
          type: 'line',
          markArea: (0,sentry_components_charts_components_markArea__WEBPACK_IMPORTED_MODULE_4__["default"])({
            silent: true,
            itemStyle: {
              color: color__WEBPACK_IMPORTED_MODULE_18___default()(selectedIncidentColor).alpha(0.42).rgb().string()
            },
            data: [[{
              xAxis: incidentStartDate
            }, {
              xAxis: incidentCloseDate
            }]]
          }),
          data: []
        });
      }
    });
  }

  let maxThresholdValue = 0;

  if (!rule.comparisonDelta && warningTrigger !== null && warningTrigger !== void 0 && warningTrigger.alertThreshold) {
    const {
      alertThreshold
    } = warningTrigger;
    const warningThresholdLine = createThresholdSeries(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.yellow300, alertThreshold);
    series.push(warningThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  if (!rule.comparisonDelta && criticalTrigger !== null && criticalTrigger !== void 0 && criticalTrigger.alertThreshold) {
    const {
      alertThreshold
    } = criticalTrigger;
    const criticalThresholdLine = createThresholdSeries(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.red300, alertThreshold);
    series.push(criticalThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  if (!rule.comparisonDelta && rule.resolveThreshold) {
    const resolveThresholdLine = createThresholdSeries(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_11__.lightTheme.green300, rule.resolveThreshold);
    series.push(resolveThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, rule.resolveThreshold);
  }

  const yAxis = {
    axisLabel: {
      formatter: value => (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.alertAxisFormatter)(value, timeseriesData[0].seriesName, rule.aggregate)
    },
    max: (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_17__.isCrashFreeAlert)(rule.dataset) ? 100 : maxThresholdValue > maxSeriesValue ? maxThresholdValue : undefined,
    min: minChartValue || undefined
  };
  return {
    criticalDuration,
    warningDuration,
    totalDuration,
    chartOption: {
      isGroupedByDate: true,
      yAxis,
      series,
      grid: {
        left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.25),
        right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2),
        top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3),
        bottom: 0
      }
    }
  };
}
function transformSessionResponseToSeries(response, rule) {
  const {
    aggregate
  } = rule;
  return [{
    seriesName: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__.getAlertTypeFromAggregateDataset)({
      aggregate,
      dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__.Dataset.SESSIONS
    })],
    data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_10__.getCrashFreeRateSeries)(response === null || response === void 0 ? void 0 : response.groups, response === null || response === void 0 ? void 0 : response.intervals, sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.SESSION_AGGREGATE_TO_FIELD[aggregate])
  }];
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/metricHistory.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/metricHistory.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/collapsePanel */ "./app/components/collapsePanel.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_statusIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/statusIndicator */ "./app/components/statusIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















const COLLAPSE_COUNT = 3;

function getTriggerName(value) {
  if (value === `${sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.WARNING}`) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Warning');
  }

  if (value === `${sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.CRITICAL}`) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Critical');
  } // Otherwise, activity type is not status change


  return '';
}

function MetricAlertActivity(_ref2) {
  var _incident$activities;

  let {
    organization,
    incident
  } = _ref2;
  const activities = ((_incident$activities = incident.activities) !== null && _incident$activities !== void 0 ? _incident$activities : []).filter(activity => activity.type === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentActivityType.STATUS_CHANGE);
  const criticalActivity = activities.filter(activity => activity.value === `${sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.CRITICAL}`);
  const warningActivity = activities.filter(activity => activity.value === `${sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_13__.IncidentStatus.WARNING}`);
  const triggeredActivity = !!criticalActivity.length ? criticalActivity[0] : warningActivity[0];
  const currentTrigger = getTriggerName(triggeredActivity.value);
  const nextActivity = activities.find(_ref3 => {
    let {
      previousValue
    } = _ref3;
    return previousValue === triggeredActivity.value;
  });
  const activityDuration = (nextActivity ? moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()(nextActivity.dateCreated) : moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()()).diff(moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()(triggeredActivity.dateCreated), 'milliseconds');
  const threshold = activityDuration !== null && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('[duration]', {
    duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_4__["default"], {
      abbreviation: true,
      seconds: activityDuration / 1000
    })
  });
  const warningThreshold = incident.alertRule.triggers.filter(trigger => trigger.label === 'warning').map(trig => trig.alertThreshold);
  const criticalThreshold = incident.alertRule.triggers.filter(trigger => trigger.label === 'critical').map(trig => trig.alertThreshold);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_5__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(Title, {
      "data-test-id": "alert-title",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_statusIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {
        status: currentTrigger.toLocaleLowerCase(),
        tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Status: [level]', {
          level: currentTrigger
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
        to: {
          pathname: (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_14__.alertDetailsLink)(organization, incident),
          query: {
            alert: incident.identifier
          }
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('#[id]', {
          id: incident.identifier
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Cell, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('[title] [selector] [threshold]', {
        title: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__.getAlertTypeFromAggregateDataset)(incident.alertRule)],
        selector: incident.alertRule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_12__.AlertRuleThresholdType.ABOVE ? 'above' : 'below',
        threshold: currentTrigger === 'Warning' ? warningThreshold : criticalThreshold
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(Cell, {
      children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
        value: threshold,
        fixed: '30s'
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledDateTime, {
      date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
        value: incident.dateCreated,
        fixed: 'Mar 4, 2022 10:44:13 AM UTC'
      }),
      year: true,
      seconds: true,
      timeZone: true
    })]
  });
}

MetricAlertActivity.displayName = "MetricAlertActivity";

function MetricHistory(_ref4) {
  let {
    organization,
    incidents
  } = _ref4;
  const numOfIncidents = (incidents !== null && incidents !== void 0 ? incidents : []).length;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_collapsePanel__WEBPACK_IMPORTED_MODULE_2__["default"], {
    items: numOfIncidents,
    collapseCount: COLLAPSE_COUNT,
    disableBorder: false,
    buttonTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tn)('Hidden Alert', 'Hidden Alerts', numOfIncidents - COLLAPSE_COUNT),
    children: _ref5 => {
      let {
        isExpanded,
        showMoreButton
      } = _ref5;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPanelTable, {
          headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Alert'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Reason'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Duration'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Date Triggered')],
          isEmpty: !numOfIncidents,
          emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No alerts triggered during this time.'),
          expanded: numOfIncidents <= COLLAPSE_COUNT || isExpanded,
          children: incidents && incidents.map((incident, idx) => {
            if (idx >= COLLAPSE_COUNT && !isExpanded) {
              return null;
            }

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(MetricAlertActivity, {
              incident: incident,
              organization: organization
            }, idx);
          })
        }), showMoreButton]
      });
    }
  });
}

MetricHistory.displayName = "MetricHistory";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MetricHistory);

var _ref =  true ? {
  name: "ha13ji",
  styles: "margin-bottom:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;border-bottom:none"
} : 0;

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1cnyss13"
} : 0)("grid-template-columns:max-content 1fr repeat(2, max-content);&>div{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";}div:last-of-type{padding:", p => p.isEmpty && `48px ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1)}`, ";}", p => !p.expanded && _ref, ";" + ( true ? "" : 0));

const StyledDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1cnyss12"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";display:flex;justify-content:flex-start;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), "!important;" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1cnyss11"
} : 0)("display:flex;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;font-size:", p => p.theme.fontSizeMedium, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1cnyss10"
} : 0)("display:flex;align-items:center;white-space:nowrap;font-size:", p => p.theme.fontSizeMedium, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/relatedIssues.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/relatedIssues.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/issues/groupList */ "./app/components/issues/groupList.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_details_relatedIssuesNotAvailable__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable */ "./app/views/alerts/rules/metric/details/relatedIssuesNotAvailable.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_metricRulePresets__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/metricRulePresets */ "./app/views/alerts/rules/metric/metricRulePresets.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















function RelatedIssues(_ref) {
  let {
    rule,
    organization,
    projects,
    query,
    timePeriod
  } = _ref;

  function renderErrorMessage(_ref2, retry) {
    let {
      detail
    } = _ref2;

    if (detail === sentry_views_alerts_rules_metric_details_relatedIssuesNotAvailable__WEBPACK_IMPORTED_MODULE_10__.RELATED_ISSUES_BOOLEAN_QUERY_ERROR && !(0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_12__.isSessionAggregate)(rule.aggregate)) {
      const {
        buttonText,
        to
      } = (0,sentry_views_alerts_rules_metric_metricRulePresets__WEBPACK_IMPORTED_MODULE_11__.makeDefaultCta)({
        orgSlug: organization.slug,
        projects,
        rule,
        query,
        timePeriod
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_alerts_rules_metric_details_relatedIssuesNotAvailable__WEBPACK_IMPORTED_MODULE_10__.RelatedIssuesNotAvailable, {
        buttonTo: to,
        buttonText: buttonText
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_6__["default"], {
      onRetry: retry
    });
  }

  function renderEmptyMessage() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_4__["default"], {
          small: true,
          withIcon: false,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No issues for this alert rule')
        })
      })
    });
  }

  const {
    start,
    end
  } = timePeriod;
  const path = `/organizations/${organization.slug}/issues/`;
  const queryParams = {
    start,
    end,
    groupStatsPeriod: 'auto',
    limit: 5,
    ...(rule.environment ? {
      environment: rule.environment
    } : {}),
    sort: rule.aggregate === 'count_unique(user)' ? 'user' : 'freq',
    query,
    project: projects.map(project => project.id)
  };
  const issueSearch = {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: queryParams
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(ControlsWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledSectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Related Issues')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        "data-test-id": "issues-open",
        size: "xs",
        to: issueSearch,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Open in Issues')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TableWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_5__["default"], {
        orgId: organization.slug,
        endpointPath: path,
        queryParams: queryParams,
        query: `start=${start}&end=${end}&groupStatsPeriod=auto`,
        canSelectGroups: false,
        renderEmptyMessage: renderEmptyMessage,
        renderErrorMessage: renderErrorMessage,
        withChart: true,
        withPagination: false,
        useFilteredStats: true,
        customStatsPeriod: timePeriod,
        useTintRow: false
      })
    })]
  });
}

RelatedIssues.displayName = "RelatedIssues";

const StyledSectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading,  true ? {
  target: "e8d5arw2"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const ControlsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8d5arw1"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const TableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8d5arw0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(4), ";", sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, "{margin-bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RelatedIssues);

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/relatedTransactions.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/relatedTransactions.tsx ***!
  \***********************************************************************/
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
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_utils_getMetricRuleDiscoverUrl__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/alerts/utils/getMetricRuleDiscoverUrl */ "./app/views/alerts/utils/getMetricRuleDiscoverUrl.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function getProjectID(eventData, projects) {
  const projectSlug = (eventData === null || eventData === void 0 ? void 0 : eventData.project) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  const project = projects.find(currentProject => currentProject.slug === projectSlug);

  if (!project) {
    return undefined;
  }

  return project.id;
}

class Table extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      widths: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyCellWithData", tableData => {
      return (column, dataRow) => this.renderBodyCell(tableData, column, dataRow);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderHeadCellWithMeta", (tableMeta, columnName) => {
      const columnTitles = ['transactions', 'project', columnName, 'users', 'user misery'];
      return (column, index) => this.renderHeadCell(tableMeta, column, columnTitles[index]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResizeColumn", (columnIndex, nextColumn) => {
      const widths = [...this.state.widths];
      widths[columnIndex] = nextColumn.width ? Number(nextColumn.width) : sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__.COL_WIDTH_UNDEFINED;
      this.setState({
        widths
      });
    });
  }

  renderBodyCell(tableData, column, dataRow) {
    const {
      eventView,
      organization,
      projects,
      location,
      summaryConditions
    } = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }

    const tableMeta = tableData.meta;
    const field = String(column.key);
    const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_7__.getFieldRenderer)(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {
      organization,
      location
    });

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      summaryView.query = summaryConditions;
      const target = (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_10__.transactionSummaryRouteWithQuery)({
        orgSlug: organization.slug,
        transaction: String(dataRow.transaction) || '',
        query: summaryView.generateQueryStringObject(),
        projectID
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: target,
        children: rendered
      });
    }

    return rendered;
  }

  renderHeadCell(tableMeta, column, title) {
    const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.fieldAlignment)(column.name, column.type, tableMeta);
    const field = {
      field: column.name,
      width: column.width
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(HeaderCell, {
      align: align,
      children: title || field.field
    });
  }

  getSortedEventView() {
    const {
      eventView
    } = this.props;
    return eventView.withSorts([...eventView.sorts]);
  }

  render() {
    const {
      eventView,
      organization,
      location
    } = this.props;
    const {
      widths
    } = this.state;
    const columnOrder = eventView.getColumns().map((col, i) => {
      if (typeof widths[i] === 'number') {
        return { ...col,
          width: widths[i]
        };
      }

      return col;
    });
    const sortedEventView = this.getSortedEventView();
    const columnSortBy = sortedEventView.getSorts();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_6__["default"], {
        eventView: sortedEventView,
        orgSlug: organization.slug,
        location: location,
        useEvents: true,
        children: _ref => {
          let {
            isLoading,
            tableData
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_4__["default"], {
            isLoading: isLoading,
            data: tableData ? tableData.data.slice(0, 5) : [],
            columnOrder: columnOrder,
            columnSortBy: columnSortBy,
            grid: {
              onResizeColumn: this.handleResizeColumn,
              renderHeadCell: this.renderHeadCellWithMeta(tableData === null || tableData === void 0 ? void 0 : tableData.meta, columnOrder[2].name),
              renderBodyCell: this.renderBodyCellWithData(tableData)
            },
            location: location
          });
        }
      })
    });
  }

}

Table.displayName = "Table";

function RelatedTransactions(_ref2) {
  let {
    rule,
    projects,
    filter,
    location,
    organization,
    timePeriod
  } = _ref2;
  const eventView = (0,sentry_views_alerts_utils_getMetricRuleDiscoverUrl__WEBPACK_IMPORTED_MODULE_9__.getMetricRuleDiscoverQuery)({
    rule,
    timePeriod,
    projects
  });

  if (!eventView) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Table, {
    eventView: eventView,
    projects: projects,
    organization: organization,
    location: location,
    summaryConditions: `${rule.query} ${filter}`
  });
}

RelatedTransactions.displayName = "RelatedTransactions";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RelatedTransactions);

const HeaderCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eik8fiy0"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/details/sidebar.tsx":
/*!***********************************************************!*\
  !*** ./app/views/alerts/rules/metric/details/sidebar.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Sidebar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alertBadge */ "./app/components/alertBadge.tsx");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../../../types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















class Sidebar extends react__WEBPACK_IMPORTED_MODULE_1__.PureComponent {
  getTimeWindow() {
    const {
      rule
    } = this.props;

    if (!rule) {
      return '';
    }

    const {
      timeWindow
    } = rule;
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[window]', {
      window: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_6__["default"], {
        seconds: timeWindow * 60
      })
    });
  }

  renderTrigger(label, threshold, actions) {
    var _COMPARISON_DELTA_OPT;

    const {
      rule
    } = this.props;
    const status = label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.CRITICAL ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Critical') : label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.WARNING ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Warning') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Resolved');
    const statusIconColor = label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.CRITICAL ? 'red300' : label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.WARNING ? 'yellow300' : 'green300';
    const defaultAction = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Change alert status to %s', status);
    const aboveThreshold = label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.RESOLVE ? rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleThresholdType.BELOW : rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleThresholdType.ABOVE;
    const thresholdTypeText = aboveThreshold ? rule.comparisonDelta ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('higher') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('above') : rule.comparisonDelta ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('lower') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('below');
    const thresholdText = rule.comparisonDelta ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[metric] is [threshold]% [comparisonType] in [timeWindow] compared to [comparisonDelta]', {
      metric: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__.getAlertTypeFromAggregateDataset)(rule)],
      threshold,
      comparisonType: thresholdTypeText,
      timeWindow: this.getTimeWindow(),
      comparisonDelta: ((_COMPARISON_DELTA_OPT = sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_13__.COMPARISON_DELTA_OPTIONS.find(_ref => {
        let {
          value
        } = _ref;
        return value === rule.comparisonDelta;
      })) !== null && _COMPARISON_DELTA_OPT !== void 0 ? _COMPARISON_DELTA_OPT : sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_13__.COMPARISON_DELTA_OPTIONS[0]).label
    }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tct)('[metric] is [condition] in [timeWindow]', {
      metric: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_15__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_16__.getAlertTypeFromAggregateDataset)(rule)],
      condition: `${thresholdTypeText} ${threshold}`,
      timeWindow: this.getTimeWindow()
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TriggerContainer, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TriggerTitle, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconDiamond, {
          color: statusIconColor,
          size: "xs"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerTitleText, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('%s Conditions', status)
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TriggerStep, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerTitleText, {
          children: "When"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerActions, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerText, {
            children: thresholdText
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TriggerStep, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerTitleText, {
          children: "Then"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(TriggerActions, {
          children: [actions.map(action => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerText, {
            children: action.desc
          }, action.id)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TriggerText, {
            children: defaultAction
          })]
        })]
      })]
    });
  }

  render() {
    var _ref2, _latestIncident$dateC, _rule$owner, _rule$environment, _rule$createdBy$name;

    const {
      rule
    } = this.props; // get current status

    const latestIncident = rule.latestIncident;
    const status = latestIncident ? latestIncident.status : _types__WEBPACK_IMPORTED_MODULE_17__.IncidentStatus.CLOSED; // The date at which the alert was triggered or resolved

    const activityDate = (_ref2 = (_latestIncident$dateC = latestIncident === null || latestIncident === void 0 ? void 0 : latestIncident.dateClosed) !== null && _latestIncident$dateC !== void 0 ? _latestIncident$dateC : latestIncident === null || latestIncident === void 0 ? void 0 : latestIncident.dateStarted) !== null && _ref2 !== void 0 ? _ref2 : null;
    const criticalTrigger = rule === null || rule === void 0 ? void 0 : rule.triggers.find(_ref3 => {
      let {
        label
      } = _ref3;
      return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.CRITICAL;
    });
    const warningTrigger = rule === null || rule === void 0 ? void 0 : rule.triggers.find(_ref4 => {
      let {
        label
      } = _ref4;
      return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.WARNING;
    });
    const ownerId = (_rule$owner = rule.owner) === null || _rule$owner === void 0 ? void 0 : _rule$owner.split(':')[1];
    const teamActor = ownerId && {
      type: 'team',
      id: ownerId,
      name: ''
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(StatusContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(HeaderItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Heading, {
            noMargin: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Alert Status')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Status, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
              status: status
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(HeaderItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Heading, {
            noMargin: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Last Triggered')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Status, {
            children: activityDate ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_8__["default"], {
              date: activityDate
            }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('No alerts triggered')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(SidebarGroup, {
        children: [typeof (criticalTrigger === null || criticalTrigger === void 0 ? void 0 : criticalTrigger.alertThreshold) === 'number' && this.renderTrigger(criticalTrigger.label, criticalTrigger.alertThreshold, criticalTrigger.actions), typeof (warningTrigger === null || warningTrigger === void 0 ? void 0 : warningTrigger.alertThreshold) === 'number' && this.renderTrigger(warningTrigger.label, warningTrigger.alertThreshold, warningTrigger.actions), typeof rule.resolveThreshold === 'number' && this.renderTrigger(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_14__.AlertRuleTriggerType.RESOLVE, rule.resolveThreshold, [])]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(SidebarGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(Heading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Alert Rule Details')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTable, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTableRow, {
            keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Environment'),
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OverflowTableValue, {
              children: (_rule$environment = rule.environment) !== null && _rule$environment !== void 0 ? _rule$environment : '-'
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTableRow, {
            keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Date created'),
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
              date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_12__["default"])({
                value: rule.dateCreated,
                fixed: new Date('2021-04-20')
              }),
              format: "ll"
            })
          }), rule.createdBy && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTableRow, {
            keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Created By'),
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(OverflowTableValue, {
              children: (_rule$createdBy$name = rule.createdBy.name) !== null && _rule$createdBy$name !== void 0 ? _rule$createdBy$name : '-'
            })
          }), rule.dateModified && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTableRow, {
            keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Last Modified'),
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_8__["default"], {
              date: rule.dateModified,
              suffix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('ago')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_7__.KeyValueTableRow, {
            keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Team'),
            value: teamActor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_3__["default"], {
              actor: teamActor,
              size: 24
            }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Unassigned')
          })]
        })]
      })]
    });
  }

}
Sidebar.displayName = "Sidebar";

const SidebarGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax11"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(3), ";" + ( true ? "" : 0));

const HeaderItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax10"
} : 0)( true ? {
  name: "10sya4f",
  styles: "flex:1;display:flex;flex-direction:column;>*:nth-child(2){flex:1;display:flex;align-items:center;}"
} : 0);

const Status = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax9"
} : 0)("position:relative;display:grid;grid-template-columns:auto auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";font-size:", p => p.theme.fontSizeLarge, ";" + ( true ? "" : 0));

const StatusContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax8"
} : 0)("height:60px;display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_4__.SectionHeading,  true ? {
  target: "ewgxzax7"
} : 0)("margin-top:", p => p.noMargin ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";margin-bottom:", p => p.noMargin ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

const OverflowTableValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax6"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const TriggerContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax5"
} : 0)("display:grid;grid-template-rows:auto auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(4), ";" + ( true ? "" : 0));

const TriggerTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax4"
} : 0)( true ? {
  name: "z76o0d",
  styles: "display:grid;grid-template-columns:20px 1fr;align-items:center"
} : 0);

const TriggerTitleText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h4',  true ? {
  target: "ewgxzax3"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin:0;line-height:24px;min-width:40px;" + ( true ? "" : 0));

const TriggerStep = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax2"
} : 0)( true ? {
  name: "9i9rp7",
  styles: "display:grid;grid-template-columns:40px 1fr;align-items:stretch"
} : 0);

const TriggerActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewgxzax1"
} : 0)("display:grid;grid-template-columns:repeat(1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), ";align-items:center;" + ( true ? "" : 0));

const TriggerText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewgxzax0"
} : 0)("display:block;background-color:", p => p.theme.surface100, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.75), ";border-radius:", p => p.theme.borderRadius, ";color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeSmall, ";width:100%;font-weight:400;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/metricRulePresets.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/metric/metricRulePresets.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeDefaultCta": () => (/* binding */ makeDefaultCta)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_views_alerts_utils_getMetricRuleDiscoverUrl__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/utils/getMetricRuleDiscoverUrl */ "./app/views/alerts/utils/getMetricRuleDiscoverUrl.tsx");




/**
 * Get the CTA used for alert rules that do not have a preset
 */
function makeDefaultCta(_ref) {
  let {
    orgSlug,
    projects,
    rule,
    timePeriod,
    query
  } = _ref;

  if (!rule) {
    return {
      buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Open in Discover'),
      to: ''
    };
  }

  const extraQueryParams = {
    display: sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_1__.DisplayModes.TOP5
  };
  return {
    buttonText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Open in Discover'),
    to: (0,sentry_views_alerts_utils_getMetricRuleDiscoverUrl__WEBPACK_IMPORTED_MODULE_2__.getMetricRuleDiscoverUrl)({
      orgSlug,
      projects,
      rule,
      timePeriod,
      query,
      extraQueryParams
    })
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

/***/ "./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx":
/*!********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "extractEventTypeFilterFromRule": () => (/* binding */ extractEventTypeFilterFromRule),
/* harmony export */   "getEventTypeFilter": () => (/* binding */ getEventTypeFilter)
/* harmony export */ });
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../types */ "./app/views/alerts/rules/metric/types.tsx");



function extractEventTypeFilterFromRule(metricRule) {
  const {
    dataset,
    eventTypes
  } = metricRule;
  return getEventTypeFilter(dataset, eventTypes);
}
function getEventTypeFilter(dataset, eventTypes) {
  if (eventTypes) {
    var _convertDatasetEventT;

    return _constants__WEBPACK_IMPORTED_MODULE_1__.DATASOURCE_EVENT_TYPE_FILTERS[(_convertDatasetEventT = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_0__.convertDatasetEventTypesToSource)(dataset, eventTypes)) !== null && _convertDatasetEventT !== void 0 ? _convertDatasetEventT : _types__WEBPACK_IMPORTED_MODULE_2__.Datasource.ERROR];
  }

  return _constants__WEBPACK_IMPORTED_MODULE_1__.DATASET_EVENT_TYPE_FILTERS[dataset !== null && dataset !== void 0 ? dataset : _types__WEBPACK_IMPORTED_MODULE_2__.Dataset.ERRORS];
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getMetricDatasetQueryExtras": () => (/* binding */ getMetricDatasetQueryExtras)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");



function getMetricDatasetQueryExtras(_ref) {
  var _location$query;

  let {
    organization,
    location,
    dataset,
    newAlertOrQuery
  } = _ref;
  const hasMetricDataset = organization.features.includes('metrics-performance-alerts') || organization.features.includes('mep-rollout-flag');
  const disableMetricDataset = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_1__.decodeScalar)(location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.disableMetricDataset) === 'true';
  const queryExtras = hasMetricDataset && !disableMetricDataset ? {
    dataset: (0,sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_2__.getMEPAlertsDataset)(dataset, newAlertOrQuery)
  } : {};
  return queryExtras;
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx":
/*!******************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isCrashFreeAlert": () => (/* binding */ isCrashFreeAlert)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../types */ "./app/views/alerts/rules/metric/types.tsx");


/**
 * Currently we can tell if an alert is a crash free alert by the dataset,
 * but this may become more complicated soon
 */

function isCrashFreeAlert(dataset) {
  return dataset !== undefined && [_types__WEBPACK_IMPORTED_MODULE_1__.Dataset.SESSIONS, _types__WEBPACK_IMPORTED_MODULE_1__.Dataset.METRICS].includes(dataset);
}

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

/***/ "./app/views/alerts/utils/apiCalls.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/utils/apiCalls.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchAlertRule": () => (/* binding */ fetchAlertRule),
/* harmony export */   "fetchIncident": () => (/* binding */ fetchIncident),
/* harmony export */   "fetchIncidentsForRule": () => (/* binding */ fetchIncidentsForRule)
/* harmony export */ });
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");

// Use this api for requests that are getting cancelled
const uncancellableApi = new sentry_api__WEBPACK_IMPORTED_MODULE_0__.Client();
function fetchAlertRule(orgId, ruleId, query) {
  return uncancellableApi.requestPromise(`/organizations/${orgId}/alert-rules/${ruleId}/`, {
    query
  });
}
function fetchIncidentsForRule(orgId, alertRule, start, end) {
  return uncancellableApi.requestPromise(`/organizations/${orgId}/incidents/`, {
    query: {
      project: '-1',
      alertRule,
      includeSnapshots: true,
      start,
      end,
      expand: ['activities', 'seen_by', 'original_alert_rule']
    }
  });
}
function fetchIncident(api, orgId, alertId) {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}

/***/ }),

/***/ "./app/views/alerts/utils/getChangeStatus.tsx":
/*!****************************************************!*\
  !*** ./app/views/alerts/utils/getChangeStatus.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getChangeStatus": () => (/* binding */ getChangeStatus)
/* harmony export */ });
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");

const getChangeStatus = (value, thresholdType, triggers) => {
  const criticalTrigger = triggers === null || triggers === void 0 ? void 0 : triggers.find(trig => trig.label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.CRITICAL);
  const warningTrigger = triggers === null || triggers === void 0 ? void 0 : triggers.find(trig => trig.label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.WARNING);
  const criticalTriggerAlertThreshold = typeof (criticalTrigger === null || criticalTrigger === void 0 ? void 0 : criticalTrigger.alertThreshold) === 'number' ? criticalTrigger.alertThreshold : undefined;
  const warningTriggerAlertThreshold = typeof (warningTrigger === null || warningTrigger === void 0 ? void 0 : warningTrigger.alertThreshold) === 'number' ? warningTrigger.alertThreshold : undefined; // Need to catch the critical threshold cases before warning threshold cases

  if (thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleThresholdType.ABOVE && criticalTriggerAlertThreshold && value >= criticalTriggerAlertThreshold) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.CRITICAL;
  }

  if (thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleThresholdType.ABOVE && warningTriggerAlertThreshold && value >= warningTriggerAlertThreshold) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.WARNING;
  } // When threshold is below(lower than in comparison alerts) the % diff value is negative
  // It crosses the threshold if its abs value is greater than threshold
  // -80% change crosses below 60% threshold -1 * (-80) > 60


  if (thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleThresholdType.BELOW && criticalTriggerAlertThreshold && -1 * value >= criticalTriggerAlertThreshold) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.CRITICAL;
  }

  if (thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleThresholdType.BELOW && warningTriggerAlertThreshold && -1 * value >= warningTriggerAlertThreshold) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_0__.AlertRuleTriggerType.WARNING;
  }

  return '';
};

/***/ }),

/***/ "./app/views/alerts/utils/getMetricRuleDiscoverUrl.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/utils/getMetricRuleDiscoverUrl.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getMetricRuleDiscoverQuery": () => (/* binding */ getMetricRuleDiscoverQuery),
/* harmony export */   "getMetricRuleDiscoverUrl": () => (/* binding */ getMetricRuleDiscoverUrl)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");






/**
 * Gets the URL for a discover view of the rule with the following default
 * parameters:
 *
 * - Ordered by the rule aggregate, descending
 * - yAxis maps to the aggregate
 * - Start and end are the period's values selected in the chart header
 */
function getMetricRuleDiscoverUrl(_ref) {
  let {
    orgSlug,
    ...rest
  } = _ref;
  const discoverView = getMetricRuleDiscoverQuery(rest);

  if (!discoverView || !rest.rule) {
    return '';
  }

  const {
    query,
    ...toObject
  } = discoverView.getResultsViewUrlTarget(orgSlug);
  const timeWindowString = `${rest.rule.timeWindow}m`;
  return {
    query: { ...query,
      interval: timeWindowString
    },
    ...toObject
  };
}
function getMetricRuleDiscoverQuery(_ref2) {
  var _ref3;

  let {
    projects,
    rule,
    timePeriod,
    query,
    extraQueryParams
  } = _ref2;

  if (!projects || !projects.length || !rule) {
    return '';
  }

  const aggregateAlias = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_2__.getAggregateAlias)(rule.aggregate);
  const timePeriodFields = timePeriod.usingPeriod ? {
    range: timePeriod.period === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.TimePeriod.SEVEN_DAYS ? '7d' : timePeriod.period
  } : {
    start: timePeriod.start,
    end: timePeriod.end
  };
  const fields = rule.dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_3__.Dataset.ERRORS ? ['issue', 'count()', 'count_unique(user)'] : ['transaction', 'project', `${rule.aggregate}`, 'count_unique(user)', `user_misery(${sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_4__.DEFAULT_PROJECT_THRESHOLD})`];
  const eventQuery = {
    id: undefined,
    name: rule && rule.name || 'Transactions',
    fields,
    orderby: `-${aggregateAlias}`,
    query: (_ref3 = query !== null && query !== void 0 ? query : rule.query) !== null && _ref3 !== void 0 ? _ref3 : '',
    version: 2,
    projects: projects.filter(_ref4 => {
      let {
        slug
      } = _ref4;
      return rule.projects.includes(slug);
    }).map(project => Number(project.id)),
    environment: rule.environment ? [rule.environment] : undefined,
    ...timePeriodFields,
    ...extraQueryParams
  };
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_1__["default"].fromSavedQuery(eventQuery);
}

/***/ }),

/***/ "./app/views/alerts/utils/index.tsx":
/*!******************************************!*\
  !*** ./app/views/alerts/utils/index.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALERT_CHART_MIN_MAX_BUFFER": () => (/* binding */ ALERT_CHART_MIN_MAX_BUFFER),
/* harmony export */   "DATA_SOURCE_LABELS": () => (/* binding */ DATA_SOURCE_LABELS),
/* harmony export */   "DATA_SOURCE_TO_SET_AND_EVENT_TYPES": () => (/* binding */ DATA_SOURCE_TO_SET_AND_EVENT_TYPES),
/* harmony export */   "SESSION_AGGREGATE_TO_FIELD": () => (/* binding */ SESSION_AGGREGATE_TO_FIELD),
/* harmony export */   "alertAxisFormatter": () => (/* binding */ alertAxisFormatter),
/* harmony export */   "alertDetailsLink": () => (/* binding */ alertDetailsLink),
/* harmony export */   "alertTooltipValueFormatter": () => (/* binding */ alertTooltipValueFormatter),
/* harmony export */   "convertDatasetEventTypesToSource": () => (/* binding */ convertDatasetEventTypesToSource),
/* harmony export */   "getQueryDatasource": () => (/* binding */ getQueryDatasource),
/* harmony export */   "getQueryStatus": () => (/* binding */ getQueryStatus),
/* harmony export */   "getStartEndFromStats": () => (/* binding */ getStartEndFromStats),
/* harmony export */   "getTeamParams": () => (/* binding */ getTeamParams),
/* harmony export */   "isIssueAlert": () => (/* binding */ isIssueAlert),
/* harmony export */   "isSessionAggregate": () => (/* binding */ isSessionAggregate),
/* harmony export */   "shouldScaleAlertChart": () => (/* binding */ shouldScaleAlertChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../types */ "./app/views/alerts/types.tsx");











/**
 * Gets start and end date query parameters from stats
 */

function getStartEndFromStats(stats) {
  const start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(stats.eventStats.data[0][0] * 1000);
  const end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(stats.eventStats.data[stats.eventStats.data.length - 1][0] * 1000);
  return {
    start,
    end
  };
}
function isIssueAlert(data) {
  return !data.hasOwnProperty('triggers');
}
const DATA_SOURCE_LABELS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Errors'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Transactions'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT]: 'event.type:error OR event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT]: 'event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION]: 'event.type:transaction'
}; // Maps a datasource to the relevant dataset and event_types for the backend to use

const DATA_SOURCE_TO_SET_AND_EVENT_TYPES = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR, sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.TRANSACTION]
  }
}; // Converts the given dataset and event types array to a datasource for the datasource dropdown

function convertDatasetEventTypesToSource(dataset, eventTypes) {
  // transactions and generic_metrics only have one datasource option regardless of event type
  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS || dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.GENERIC_METRICS) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION;
  } // if no event type was provided use the default datasource


  if (!eventTypes) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR;
  }

  if (eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT) && eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR)) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT;
  }

  if (eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT)) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT;
  }

  return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR;
}
/**
 * Attempt to guess the data source of a discover query
 *
 * @returns An object containing the datasource and new query without the datasource.
 * Returns null on no datasource.
 */

function getQueryDatasource(query) {
  let match = query.match(/\(?\bevent\.type:(error|default|transaction)\)?\WOR\W\(?event\.type:(error|default|transaction)\)?/i);

  if (match) {
    // should be [error, default] or [default, error]
    const eventTypes = match.slice(1, 3).sort().join(',');

    if (eventTypes !== 'default,error') {
      return null;
    }

    return {
      source: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT,
      query: query.replace(match[0], '').trim()
    };
  }

  match = query.match(/(^|\s)event\.type:(error|default|transaction)/i);

  if (match && sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource[match[2].toUpperCase()]) {
    return {
      source: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource[match[2].toUpperCase()],
      query: query.replace(match[0], '').trim()
    };
  }

  return null;
}
function isSessionAggregate(aggregate) {
  return Object.values(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate).includes(aggregate);
}
const SESSION_AGGREGATE_TO_FIELD = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_SESSIONS]: sentry_types__WEBPACK_IMPORTED_MODULE_4__.SessionFieldWithOperation.SESSIONS,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_USERS]: sentry_types__WEBPACK_IMPORTED_MODULE_4__.SessionFieldWithOperation.USERS
};
function alertAxisFormatter(value, seriesName, aggregate) {
  if (isSessionAggregate(aggregate)) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value) ? `${lodash_round__WEBPACK_IMPORTED_MODULE_2___default()(value, 2)}%` : '\u2015';
  }

  return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateOutputType)(seriesName));
}
function alertTooltipValueFormatter(value, seriesName, aggregate) {
  if (isSessionAggregate(aggregate)) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value) ? `${value}%` : '\u2015';
  }

  return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateOutputType)(seriesName));
}
const ALERT_CHART_MIN_MAX_BUFFER = 1.03;
function shouldScaleAlertChart(aggregate) {
  // We want crash free rate charts to be scaled because they are usually too
  // close to 100% and therefore too fine to see the spikes on 0%-100% scale.
  return isSessionAggregate(aggregate);
}
function alertDetailsLink(organization, incident) {
  return `/organizations/${organization.slug}/alerts/rules/details/${incident.alertRule.status === _types__WEBPACK_IMPORTED_MODULE_10__.AlertRuleStatus.SNAPSHOT && incident.alertRule.originalAlertRuleId ? incident.alertRule.originalAlertRuleId : incident.alertRule.id}/`;
}
/**
 * Noramlizes a status string
 */

function getQueryStatus(status) {
  if (Array.isArray(status) || status === '') {
    return 'all';
  }

  return ['open', 'closed'].includes(status) ? status : 'all';
}
const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];
/**
 * Noramlize a team slug from the query
 */

function getTeamParams(team) {
  if (team === undefined) {
    return ALERT_LIST_QUERY_DEFAULT_TEAMS;
  }

  if (team === '') {
    return [];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}

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

/***/ "./app/views/alerts/wizard/utils.tsx":
/*!*******************************************!*\
  !*** ./app/views/alerts/wizard/utils.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getAlertTypeFromAggregateDataset": () => (/* binding */ getAlertTypeFromAggregateDataset)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");



// A set of unique identifiers to be able to tie aggregate and dataset back to a wizard alert type
const alertTypeIdentifiers = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.Dataset.ERRORS]: {
    num_errors: 'count()',
    users_experiencing_errors: 'count_unique(user)'
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.Dataset.TRANSACTIONS]: {
    throughput: 'count()',
    trans_duration: 'transaction.duration',
    apdex: 'apdex',
    failure_rate: 'failure_rate()',
    lcp: 'measurements.lcp',
    fid: 'measurements.fid',
    cls: 'measurements.cls'
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.Dataset.GENERIC_METRICS]: {
    throughput: 'count()',
    trans_duration: 'transaction.duration',
    apdex: 'apdex',
    failure_rate: 'failure_rate()',
    lcp: 'measurements.lcp',
    fid: 'measurements.fid',
    cls: 'measurements.cls'
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.Dataset.SESSIONS]: {
    crash_free_sessions: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.SessionsAggregate.CRASH_FREE_USERS
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.Dataset.METRICS]: {
    crash_free_sessions: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.SessionsAggregate.CRASH_FREE_SESSIONS,
    crash_free_users: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.SessionsAggregate.CRASH_FREE_USERS
  }
};
/**
 * Given an aggregate and dataset object, will return the corresponding wizard alert type
 * e.g. {aggregate: 'count()', dataset: 'events'} will yield 'num_errors'
 * @param template
 */

function getAlertTypeFromAggregateDataset(_ref) {
  let {
    aggregate,
    dataset
  } = _ref;
  const identifierForDataset = alertTypeIdentifiers[dataset];
  const matchingAlertTypeEntry = Object.entries(identifierForDataset).find(_ref2 => {
    let [_alertType, identifier] = _ref2;
    return identifier && aggregate.includes(identifier);
  });
  const alertType = matchingAlertTypeEntry && matchingAlertTypeEntry[0];
  return alertType ? alertType : 'custom';
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/utils.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/transactionSummary/utils.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SidebarSpacer": () => (/* binding */ SidebarSpacer),
/* harmony export */   "TransactionFilterOptions": () => (/* binding */ TransactionFilterOptions),
/* harmony export */   "generateTraceLink": () => (/* binding */ generateTraceLink),
/* harmony export */   "generateTransactionLink": () => (/* binding */ generateTransactionLink),
/* harmony export */   "generateTransactionSummaryRoute": () => (/* binding */ generateTransactionSummaryRoute),
/* harmony export */   "normalizeSearchConditions": () => (/* binding */ normalizeSearchConditions),
/* harmony export */   "normalizeSearchConditionsWithTransactionName": () => (/* binding */ normalizeSearchConditionsWithTransactionName),
/* harmony export */   "transactionSummaryRouteWithQuery": () => (/* binding */ transactionSummaryRouteWithQuery)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/performance/traceDetails/utils */ "./app/views/performance/traceDetails/utils.tsx");






let TransactionFilterOptions;

(function (TransactionFilterOptions) {
  TransactionFilterOptions["FASTEST"] = "fastest";
  TransactionFilterOptions["SLOW"] = "slow";
  TransactionFilterOptions["OUTLIER"] = "outlier";
  TransactionFilterOptions["RECENT"] = "recent";
})(TransactionFilterOptions || (TransactionFilterOptions = {}));

function generateTransactionSummaryRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/performance/summary/`;
} // normalizes search conditions by removing any redundant search conditions before presenting them in:
// - query strings
// - search UI

function normalizeSearchConditions(query) {
  const filterParams = normalizeSearchConditionsWithTransactionName(query); // no need to include transaction as its already in the query params

  filterParams.removeFilter('transaction');
  return filterParams;
} // normalizes search conditions by removing any redundant search conditions, but retains any transaction name

function normalizeSearchConditionsWithTransactionName(query) {
  const filterParams = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch(query); // remove any event.type queries since it is implied to apply to only transactions

  filterParams.removeFilter('event.type');
  return filterParams;
}
function transactionSummaryRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    projectID,
    query,
    unselectedSeries = 'p100()',
    display,
    trendFunction,
    trendColumn,
    showTransactions,
    additionalQuery
  } = _ref2;
  const pathname = generateTransactionSummaryRoute({
    orgSlug
  });
  let searchFilter;

  if (typeof query.query === 'string') {
    searchFilter = normalizeSearchConditions(query.query).formatString();
  } else {
    searchFilter = query.query;
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: searchFilter,
      unselectedSeries,
      showTransactions,
      display,
      trendFunction,
      trendColumn,
      ...additionalQuery
    }
  };
}
function generateTraceLink(dateSelection) {
  return (organization, tableRow, _query) => {
    const traceId = `${tableRow.trace}`;

    if (!traceId) {
      return {};
    }

    return (0,sentry_views_performance_traceDetails_utils__WEBPACK_IMPORTED_MODULE_5__.getTraceDetailsUrl)(organization, traceId, dateSelection, {});
  };
}
function generateTransactionLink(transactionName) {
  return (organization, tableRow, query, spanId) => {
    const eventSlug = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_2__.generateEventSlug)(tableRow);
    return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_3__.getTransactionDetailsUrl)(organization.slug, eventSlug, transactionName, query, spanId);
  };
}
const SidebarSpacer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1radvp0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/releases/utils/index.tsx":
/*!********************************************!*\
  !*** ./app/views/releases/utils/index.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ADOPTION_STAGE_LABELS": () => (/* binding */ ADOPTION_STAGE_LABELS),
/* harmony export */   "CRASH_FREE_DECIMAL_THRESHOLD": () => (/* binding */ CRASH_FREE_DECIMAL_THRESHOLD),
/* harmony export */   "displayCrashFreePercent": () => (/* binding */ displayCrashFreePercent),
/* harmony export */   "displaySessionStatusPercent": () => (/* binding */ displaySessionStatusPercent),
/* harmony export */   "getCrashFreePercent": () => (/* binding */ getCrashFreePercent),
/* harmony export */   "getReleaseBounds": () => (/* binding */ getReleaseBounds),
/* harmony export */   "getReleaseHandledIssuesUrl": () => (/* binding */ getReleaseHandledIssuesUrl),
/* harmony export */   "getReleaseNewIssuesUrl": () => (/* binding */ getReleaseNewIssuesUrl),
/* harmony export */   "getReleaseParams": () => (/* binding */ getReleaseParams),
/* harmony export */   "getReleaseUnhandledIssuesUrl": () => (/* binding */ getReleaseUnhandledIssuesUrl),
/* harmony export */   "getSessionStatusPercent": () => (/* binding */ getSessionStatusPercent),
/* harmony export */   "isMobileRelease": () => (/* binding */ isMobileRelease),
/* harmony export */   "isReleaseArchived": () => (/* binding */ isReleaseArchived),
/* harmony export */   "roundDuration": () => (/* binding */ roundDuration)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const CRASH_FREE_DECIMAL_THRESHOLD = 95;
const roundDuration = seconds => {
  return lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(seconds, seconds > 60 ? 0 : 3);
};
const getCrashFreePercent = function (percent) {
  let decimalThreshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CRASH_FREE_DECIMAL_THRESHOLD;
  let decimalPlaces = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 3;
  const roundedValue = lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(percent, percent > decimalThreshold ? decimalPlaces : 0);

  if (roundedValue === 100 && percent < 100) {
    return Math.floor(percent * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  return roundedValue;
};
const displayCrashFreePercent = function (percent) {
  let decimalThreshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : CRASH_FREE_DECIMAL_THRESHOLD;
  let decimalPlaces = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 3;

  if (isNaN(percent)) {
    return '\u2015';
  }

  if (percent < 1 && percent > 0) {
    return `<1\u0025`;
  }

  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces).toLocaleString();
  return `${rounded}\u0025`;
};
const getSessionStatusPercent = function (percent) {
  let absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return lodash_round__WEBPACK_IMPORTED_MODULE_3___default()(absolute ? Math.abs(percent) : percent, 3);
};
const displaySessionStatusPercent = function (percent) {
  let absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return `${getSessionStatusPercent(percent, absolute).toLocaleString()}\u0025`;
};
const getReleaseNewIssuesUrl = (orgSlug, projectId, version) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      project: projectId,
      // we are resetting time selector because releases' new issues count doesn't take time selector into account
      statsPeriod: undefined,
      start: undefined,
      end: undefined,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`firstRelease:${version}`]).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const getReleaseUnhandledIssuesUrl = function (orgSlug, projectId, version) {
  let dateTime = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: { ...dateTime,
      project: projectId,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`release:${version}`, 'error.unhandled:true']).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const getReleaseHandledIssuesUrl = function (orgSlug, projectId, version) {
  let dateTime = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: { ...dateTime,
      project: projectId,
      query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_12__.MutableSearch([`release:${version}`, 'error.handled:true']).formatString(),
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_13__.IssueSortOptions.FREQ
    }
  };
};
const isReleaseArchived = release => release.status === sentry_types__WEBPACK_IMPORTED_MODULE_10__.ReleaseStatus.Archived;
function getReleaseBounds(release) {
  var _ref;

  const retentionBound = moment__WEBPACK_IMPORTED_MODULE_4___default()().subtract(90, 'days');
  const {
    lastEvent,
    currentProjectMeta,
    dateCreated
  } = release || {};
  const {
    sessionsUpperBound
  } = currentProjectMeta || {};
  let type = 'normal';
  let releaseStart = moment__WEBPACK_IMPORTED_MODULE_4___default()(dateCreated).startOf('minute');
  let releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()((_ref = moment__WEBPACK_IMPORTED_MODULE_4___default()(sessionsUpperBound).isAfter(lastEvent) ? sessionsUpperBound : lastEvent) !== null && _ref !== void 0 ? _ref : undefined).endOf('minute');

  if (moment__WEBPACK_IMPORTED_MODULE_4___default()(releaseStart).isSame(releaseEnd, 'minute')) {
    releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()(releaseEnd).add(1, 'minutes');
  }

  if (releaseStart.isBefore(retentionBound)) {
    releaseStart = retentionBound;
    type = 'clamped';

    if (releaseEnd.isBefore(releaseStart) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(sessionsUpperBound) && !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(lastEvent)) {
      releaseEnd = moment__WEBPACK_IMPORTED_MODULE_4___default()();
      type = 'ancient';
    }
  }

  return {
    type,
    releaseStart: releaseStart.utc().format(),
    releaseEnd: releaseEnd.utc().format()
  };
}
function getReleaseParams(_ref2) {
  let {
    location,
    releaseBounds
  } = _ref2;
  const params = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_6__.normalizeDateTimeParams)(lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM), ...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.PAGE_URL_PARAM), 'cursor']), {
    allowAbsolutePageDatetime: true,
    allowEmptyPeriod: true
  });

  if (!Object.keys(params).some(param => [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.START, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.END, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.UTC, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.PERIOD].includes(param))) {
    params[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.START] = releaseBounds.releaseStart;
    params[sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_7__.URL_PARAM.END] = releaseBounds.releaseEnd;
  }

  return params;
}

const adoptionStagesLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
  href: "https://docs.sentry.io/product/releases/health/#adoption-stages"
});

const ADOPTION_STAGE_LABELS = {
  low_adoption: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Low Adoption'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release has a low percentage of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'warning'
  },
  adopted: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Adopted'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release has a high percentage of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'success'
  },
  replaced: {
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Replaced'),
    tooltipTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('This release was previously Adopted, but now has a lower level of sessions compared to other releases in this project. [link:Learn more]', {
      link: adoptionStagesLink
    }),
    type: 'default'
  }
};
const isMobileRelease = releaseProjectPlatform => [...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__.mobile, ...sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_8__.desktop].includes(releaseProjectPlatform);

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
//# sourceMappingURL=../sourcemaps/app_views_alerts_rules_metric_details_index_tsx.2b6bd47f24a20bc4a262b324708456bd.js.map