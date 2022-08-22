(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_eventsRequest_tsx-app_utils_discover_discoverQuery_tsx-app_views_perfor-9421d1"],{

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

/***/ "./app/components/charts/barChartZoom.tsx":
/*!************************************************!*\
  !*** ./app/components/charts/barChartZoom.tsx ***!
  \************************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_components_dataZoomInside__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/components/dataZoomInside */ "./app/components/charts/components/dataZoomInside.tsx");
/* harmony import */ var sentry_components_charts_components_toolBox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/components/toolBox */ "./app/components/charts/components/toolBox.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");








class BarChartZoom extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "zooming", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChartReady", chart => {
      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_6__.callIfFunction)(this.props.onChartReady, chart);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChartFinished", (_props, chart) => {
      var _chart$_componentsVie;

      if (typeof this.zooming === 'function') {
        this.zooming();
        this.zooming = null;
      } // This attempts to activate the area zoom toolbox feature


      const zoom = (_chart$_componentsVie = chart._componentsViews) === null || _chart$_componentsVie === void 0 ? void 0 : _chart$_componentsVie.find(c => c._features && c._features.dataZoom);

      if (zoom && !zoom._features.dataZoom._isZoomActive) {
        // Calling dispatchAction will re-trigger handleChartFinished
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'dataZoomSelect',
          dataZoomSelectActive: true
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDataZoom", (evt, chart) => {
      const model = chart.getModel();
      const {
        startValue,
        endValue
      } = model._payload.batch[0]; // Both of these values should not be null, but we include it just in case.
      // These values are null when the user uses the toolbox included in ECharts
      // to navigate back through zoom history, but we hide it below.

      if (startValue !== null && endValue !== null) {
        const {
          buckets,
          location,
          paramStart,
          paramEnd,
          minZoomWidth,
          onHistoryPush
        } = this.props;
        const {
          start
        } = buckets[startValue];
        const {
          end
        } = buckets[endValue];

        if (minZoomWidth === undefined || end - start > minZoomWidth) {
          const target = {
            pathname: location.pathname,
            query: { ...location.query,
              [paramStart]: start,
              [paramEnd]: end
            }
          };

          if (onHistoryPush) {
            onHistoryPush(start, end);
          } else {
            react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(target);
          }
        } else {
          // Dispatch the restore action here to stop ECharts from zooming
          chart.dispatchAction({
            type: 'restore'
          });
          (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_6__.callIfFunction)(this.props.onDataZoomCancelled);
        }
      } else {
        // Dispatch the restore action here to stop ECharts from zooming
        chart.dispatchAction({
          type: 'restore'
        });
        (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_6__.callIfFunction)(this.props.onDataZoomCancelled);
      }

      (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_6__.callIfFunction)(this.props.onDataZoom, evt, chart);
    });
  }

  render() {
    const {
      children,
      xAxisIndex
    } = this.props;
    const renderProps = {
      onChartReady: this.handleChartReady,
      onFinished: this.handleChartFinished,
      dataZoom: (0,sentry_components_charts_components_dataZoomInside__WEBPACK_IMPORTED_MODULE_4__["default"])({
        xAxisIndex
      }),
      // We must include data zoom in the toolbox for the zoom to work,
      // but we do not want to show the toolbox components.
      toolBox: (0,sentry_components_charts_components_toolBox__WEBPACK_IMPORTED_MODULE_5__["default"])({}, {
        dataZoom: {
          title: {
            zoom: '',
            back: ''
          },
          iconStyle: {
            borderWidth: 0,
            color: 'transparent',
            opacity: 0
          }
        }
      }),
      onDataZoom: this.handleDataZoom
    };
    return children(renderProps);
  }

}

BarChartZoom.displayName = "BarChartZoom";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BarChartZoom);

/***/ }),

/***/ "./app/components/charts/components/dataZoomInside.tsx":
/*!*************************************************************!*\
  !*** ./app/components/charts/components/dataZoomInside.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DataZoomInside)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_dataZoomInside__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/dataZoomInside */ "../node_modules/echarts/lib/component/dataZoomInside.js");

const DEFAULT = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is available but zoom is not
  zoomLock: true,
  throttle: 50
};
function DataZoomInside(props) {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = { ...DEFAULT,
      ...props
    };
    return [dataZoom];
  }

  return props;
}

/***/ }),

/***/ "./app/components/charts/components/toolBox.tsx":
/*!******************************************************!*\
  !*** ./app/components/charts/components/toolBox.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ToolBox)
/* harmony export */ });
function getFeatures() {
  let {
    dataZoom,
    ...features
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return { ...(dataZoom ? {
      dataZoom: {
        yAxisIndex: 'none',
        title: {
          zoom: 'zoom',
          back: 'undo'
        },
        ...dataZoom
      }
    } : {}),
    ...features
  };
}

function ToolBox(options, features) {
  return {
    right: 0,
    top: 0,
    itemSize: 16,
    // Stack the toolbox under the legend.
    // so all series names are clickable.
    z: -1,
    feature: getFeatures(features),
    ...options
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

/***/ "./app/utils/performance/histogram/constants.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/performance/histogram/constants.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FILTER_OPTIONS": () => (/* binding */ FILTER_OPTIONS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const FILTER_OPTIONS = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Exclude'),
  value: 'exclude_outliers'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Include'),
  value: 'all'
}];

/***/ }),

/***/ "./app/utils/performance/histogram/histogramQuery.tsx":
/*!************************************************************!*\
  !*** ./app/utils/performance/histogram/histogramQuery.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function getHistogramRequestPayload(props) {
  const {
    fields,
    numBuckets,
    min,
    max,
    precision,
    dataFilter,
    eventView,
    location
  } = props;
  const baseApiPayload = {
    field: fields,
    numBuckets,
    min,
    max,
    precision,
    dataFilter
  };
  const additionalApiPayload = lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page']);
  const apiPayload = Object.assign(baseApiPayload, additionalApiPayload);
  return apiPayload;
}

function HistogramQuery(props) {
  const {
    children,
    fields,
    didReceiveMultiAxis
  } = props;

  function didFetch(data) {
    if (didReceiveMultiAxis) {
      const counts = {};
      Object.entries(data).forEach(_ref => {
        let [key, values] = _ref;
        return counts[key] = values.length ? values.reduce((prev, curr) => prev + curr.count, 0) : 0;
      });
      didReceiveMultiAxis(counts);
    }
  }

  if (fields.length === 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: children({
        isLoading: false,
        error: null,
        pageLinks: null,
        histograms: {}
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_3__["default"], {
    route: "events-histogram",
    getRequestPayload: getHistogramRequestPayload,
    didFetch: didFetch,
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(props, 'children'),
    children: _ref2 => {
      let {
        tableData,
        ...rest
      } = _ref2;
      return props.children({
        histograms: tableData,
        ...rest
      });
    }
  });
}

HistogramQuery.displayName = "HistogramQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_4__["default"])(HistogramQuery));

/***/ }),

/***/ "./app/utils/performance/histogram/index.tsx":
/*!***************************************************!*\
  !*** ./app/utils/performance/histogram/index.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "removeHistogramQueryStrings": () => (/* binding */ removeHistogramQueryStrings)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./constants */ "./app/utils/performance/histogram/constants.tsx");







class Histogram extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetView", () => {
      const {
        location,
        zoomKeys
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
        pathname: location.pathname,
        query: removeHistogramQueryStrings(location, zoomKeys)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFilterChange", value => {
      const {
        location,
        zoomKeys
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
        pathname: location.pathname,
        query: { ...removeHistogramQueryStrings(location, zoomKeys),
          dataFilter: value
        }
      });
    });
  }

  isZoomed() {
    const {
      location,
      zoomKeys
    } = this.props;
    return zoomKeys.map(key => location.query[key]).some(value => value !== undefined);
  }

  getActiveFilter() {
    const {
      location
    } = this.props;
    const dataFilter = location.query.dataFilter ? (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeScalar)(location.query.dataFilter) : _constants__WEBPACK_IMPORTED_MODULE_5__.FILTER_OPTIONS[0].value;
    return _constants__WEBPACK_IMPORTED_MODULE_5__.FILTER_OPTIONS.find(item => item.value === dataFilter) || _constants__WEBPACK_IMPORTED_MODULE_5__.FILTER_OPTIONS[0];
  }

  render() {
    const childrenProps = {
      isZoomed: this.isZoomed(),
      handleResetView: this.handleResetView,
      activeFilter: this.getActiveFilter(),
      handleFilterChange: this.handleFilterChange,
      filterOptions: _constants__WEBPACK_IMPORTED_MODULE_5__.FILTER_OPTIONS
    };
    return this.props.children(childrenProps);
  }

}

Histogram.displayName = "Histogram";
function removeHistogramQueryStrings(location, zoomKeys) {
  const query = { ...location.query,
    cursor: undefined
  };
  delete query.dataFilter; // reset all zoom parameters

  zoomKeys.forEach(key => delete query[key]);
  return query;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Histogram);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/constants.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "NUM_BUCKETS": () => (/* binding */ NUM_BUCKETS),
/* harmony export */   "PERCENTILE": () => (/* binding */ PERCENTILE),
/* harmony export */   "VITAL_GROUPS": () => (/* binding */ VITAL_GROUPS),
/* harmony export */   "ZOOM_KEYS": () => (/* binding */ ZOOM_KEYS)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");




const NUM_BUCKETS = 100;
const PERCENTILE = 0.75;
/**
 * This defines the grouping for histograms. Histograms that are in the same group
 * will be queried together on initial load for alignment. However, the zoom controls
 * are defined for each measurement independently.
 */

const _VITAL_GROUPS = [{
  vitals: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__.WebVital.FP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__.WebVital.LCP],
  min: 0
}, {
  vitals: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__.WebVital.FID],
  min: 0,
  precision: 2
}, {
  vitals: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_1__.WebVital.CLS],
  min: 0,
  precision: 2
}];

const _COLORS = [...sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].charts.getColorPalette(_VITAL_GROUPS.reduce((count, _ref) => {
  let {
    vitals
  } = _ref;
  return count + vitals.length;
}, 0) - 1)].reverse();

const VITAL_GROUPS = _VITAL_GROUPS.map(group => ({ ...group,
  colors: _COLORS.splice(0, group.vitals.length)
}));
const ZOOM_KEYS = _VITAL_GROUPS.reduce((keys, _ref2) => {
  let {
    vitals
  } = _ref2;
  vitals.forEach(vital => {
    const vitalSlug = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.WEB_VITAL_DETAILS[vital].slug;
    keys.push(`${vitalSlug}Start`);
    keys.push(`${vitalSlug}End`);
  });
  return keys;
}, []);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/content.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/content.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/performance/histogram */ "./app/utils/performance/histogram/index.tsx");
/* harmony import */ var sentry_utils_performance_histogram_constants__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/performance/histogram/constants */ "./app/utils/performance/histogram/constants.tsx");
/* harmony import */ var sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsCardsDiscoverQuery */ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx");
/* harmony import */ var _vitalsPanel__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./vitalsPanel */ "./app/views/performance/transactionSummary/transactionVitals/vitalsPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


























function VitalsContent(props) {
  const {
    location,
    organization,
    eventView
  } = props;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_19__.decodeScalar)(location.query.query, '');

  const handleSearch = newQuery => {
    const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)({ ...(location.query || {}),
      query: newQuery
    }); // do not propagate pagination when making a new search

    delete queryParams.cursor;
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
      pathname: location.pathname,
      query: queryParams
    });
  };

  const allVitals = _constants__WEBPACK_IMPORTED_MODULE_20__.VITAL_GROUPS.reduce((keys, _ref) => {
    let {
      vitals
    } = _ref;
    return keys.concat(vitals);
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_16__["default"], {
    location: location,
    zoomKeys: _constants__WEBPACK_IMPORTED_MODULE_20__.ZOOM_KEYS,
    children: _ref2 => {
      let {
        activeFilter,
        handleFilterChange,
        handleResetView,
        isZoomed
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Main, {
        fullWidth: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_18__["default"], {
          eventView: eventView,
          orgSlug: organization.slug,
          location: location,
          vitals: allVitals,
          children: results => {
            const shouldDisplayMissingVitalsAlert = !results.isLoading && (0,_utils__WEBPACK_IMPORTED_MODULE_21__.isMissingVitalsData)(results.vitalsData, allVitals);
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
              children: [shouldDisplayMissingVitalsAlert && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
                type: "info",
                showIcon: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('If this page is looking a little bare, keep in mind not all browsers support these vitals. [link]', {
                  link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    href: "https://docs.sentry.io/product/performance/web-vitals/#browser-support",
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Read more about browser support.')
                  })
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(FilterActions, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  condensed: true,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    alignDropdown: "left"
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledSearchBar, {
                  organization: organization,
                  projectIds: eventView.project,
                  query: query,
                  fields: eventView.fields,
                  onSearch: handleSearch
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  value: activeFilter.value,
                  options: sentry_utils_performance_histogram_constants__WEBPACK_IMPORTED_MODULE_17__.FILTER_OPTIONS,
                  onChange: opt => {
                    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
                      eventKey: 'performance_views.vitals.filter_changed',
                      eventName: 'Performance Views: Change vitals filter',
                      organization_id: organization.id,
                      value: opt.value
                    });
                    handleFilterChange(opt.value);
                  },
                  triggerProps: {
                    prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Outliers')
                  },
                  triggerLabel: activeFilter.label
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
                  onClick: () => {
                    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_15__.trackAnalyticsEvent)({
                      eventKey: 'performance_views.vitals.reset_view',
                      eventName: 'Performance Views: Reset vitals view',
                      organization_id: organization.id
                    });
                    handleResetView();
                  },
                  disabled: !isZoomed,
                  "data-test-id": "reset-view",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Reset View')
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(_vitalsPanel__WEBPACK_IMPORTED_MODULE_22__["default"], {
                organization: organization,
                location: location,
                eventView: eventView,
                dataFilter: activeFilter.value,
                results: results
              })]
            });
          }
        })
      });
    }
  });
}

VitalsContent.displayName = "VitalsContent";

const FilterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ekvr84z1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(3, min-content);}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){grid-template-columns:auto 1fr auto auto;}" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ekvr84z0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){order:1;grid-column:1/5;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){order:initial;grid-column:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VitalsContent);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/index.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/index.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _pageLayout__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../pageLayout */ "./app/views/performance/transactionSummary/pageLayout.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionVitals/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















function TransactionVitals(props) {
  const {
    location,
    organization,
    projects
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_pageLayout__WEBPACK_IMPORTED_MODULE_9__["default"], {
    location: location,
    organization: organization,
    projects: projects,
    tab: _tabs__WEBPACK_IMPORTED_MODULE_10__["default"].WebVitals,
    getDocumentTitle: getDocumentTitle,
    generateEventView: generateEventView,
    childComponent: _content__WEBPACK_IMPORTED_MODULE_12__["default"]
  });
}

TransactionVitals.displayName = "TransactionVitals";

function getDocumentTitle(transactionName) {
  const hasTransactionName = typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Vitals')].join(' \u2014 ');
  }

  return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Summary'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Vitals')].join(' \u2014 ');
}

function generateEventView(_ref) {
  let {
    location,
    transactionName
  } = _ref;
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_5__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_6__.MutableSearch(query);
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);
  Object.keys(conditions.filters).forEach(field => {
    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_3__.isAggregateField)(field)) {
      conditions.removeFilter(field);
    }
  });
  const vitals = _constants__WEBPACK_IMPORTED_MODULE_11__.VITAL_GROUPS.reduce((allVitals, group) => {
    return allVitals.concat(group.vitals);
  }, []);
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_2__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: transactionName,
    fields: [...vitals.map(vital => `percentile(${vital}, ${_constants__WEBPACK_IMPORTED_MODULE_11__.PERCENTILE})`), ...vitals.map(vital => `count_at_least(${vital}, 0)`), ...vitals.map(vital => `count_at_least(${vital}, ${sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__.WEB_VITAL_DETAILS[vital].poorThreshold})`)],
    query: conditions.formatString(),
    projects: []
  }, location);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_8__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])(TransactionVitals)));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/styles.tsx":
/*!*******************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/styles.tsx ***!
  \*******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Card": () => (/* binding */ Card),
/* harmony export */   "CardSection": () => (/* binding */ CardSection),
/* harmony export */   "CardSectionHeading": () => (/* binding */ CardSectionHeading),
/* harmony export */   "CardSummary": () => (/* binding */ CardSummary),
/* harmony export */   "Description": () => (/* binding */ Description),
/* harmony export */   "StatNumber": () => (/* binding */ StatNumber)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const Card = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelItem,  true ? {
  target: "e1l3pu0z5"
} : 0)( true ? {
  name: "1slq3zi",
  styles: "display:grid;grid-template-columns:325px minmax(100px, auto);padding:0"
} : 0);
const CardSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1l3pu0z4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";" + ( true ? "" : 0));
const CardSummary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(CardSection,  true ? {
  target: "e1l3pu0z3"
} : 0)("position:relative;border-right:1px solid ", p => p.theme.border, ";grid-column:1/1;display:flex;flex-direction:column;justify-content:space-between;" + ( true ? "" : 0));
const CardSectionHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.SectionHeading,  true ? {
  target: "e1l3pu0z2"
} : 0)( true ? {
  name: "cfjpzu",
  styles: "margin:0px"
} : 0);
const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1l3pu0z1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));
const StatNumber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1l3pu0z0"
} : 0)( true ? {
  name: "5r9nha",
  styles: "font-size:32px"
} : 0);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/vitalCard.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/vitalCard.tsx ***!
  \**********************************************************************************/
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/throttle */ "../node_modules/lodash/throttle.js");
/* harmony import */ var lodash_throttle__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_throttle__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/barChartZoom */ "./app/components/charts/barChartZoom.tsx");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/performance/histogram/utils */ "./app/utils/performance/histogram/utils.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionEvents/utils */ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx");
/* harmony import */ var _landing_vitalsCards__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../landing/vitalsCards */ "./app/views/performance/landing/vitalsCards.tsx");
/* harmony import */ var _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../../vitalDetail/utils */ "./app/views/performance/vitalDetail/utils.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _styles__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./styles */ "./app/views/performance/transactionSummary/transactionVitals/styles.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























class VitalCard extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      refDataRect: null,
      refPixelRect: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackOpenInDiscoverClicked", () => {
      const {
        organization
      } = this.props;
      const {
        vitalDetails: vital
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__.trackAnalyticsEvent)({
        eventKey: 'performance_views.vitals.open_in_discover',
        eventName: 'Performance Views: Open vitals in discover',
        organization_id: organization.id,
        vital: vital.slug
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackOpenAllEventsClicked", () => {
      const {
        organization
      } = this.props;
      const {
        vitalDetails: vital
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__.trackAnalyticsEvent)({
        eventKey: 'performance_views.vitals.open_all_events',
        eventName: 'Performance Views: Open vitals in all events',
        organization_id: organization.id,
        vital: vital.slug
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRendered", lodash_throttle__WEBPACK_IMPORTED_MODULE_5___default()((_, chartRef) => {
      const {
        chartData
      } = this.props;
      const {
        refDataRect
      } = this.state;

      if (refDataRect === null || chartData.length < 1) {
        return;
      }

      const refPixelRect = refDataRect === null ? null : (0,_utils__WEBPACK_IMPORTED_MODULE_25__.asPixelRect)(chartRef, refDataRect);

      if (refPixelRect !== null && !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(refPixelRect, this.state.refPixelRect)) {
        this.setState({
          refPixelRect
        });
      }
    }, 200, {
      leading: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDataZoomCancelled", () => {});
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const {
      isLoading,
      error,
      chartData
    } = nextProps;

    if (isLoading || error === null) {
      return { ...prevState
      };
    }

    const refDataRect = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.getRefRect)(chartData);

    if (prevState.refDataRect === null || refDataRect !== null && !lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(refDataRect, prevState.refDataRect)) {
      return { ...prevState,
        refDataRect
      };
    }

    return { ...prevState
    };
  }

  get summary() {
    var _summaryData$p;

    const {
      summaryData
    } = this.props;
    return (_summaryData$p = summaryData === null || summaryData === void 0 ? void 0 : summaryData.p75) !== null && _summaryData$p !== void 0 ? _summaryData$p : null;
  }

  get failureRate() {
    var _summaryData$poor, _summaryData$total;

    const {
      summaryData
    } = this.props;
    const numerator = (_summaryData$poor = summaryData === null || summaryData === void 0 ? void 0 : summaryData.poor) !== null && _summaryData$poor !== void 0 ? _summaryData$poor : 0;
    const denominator = (_summaryData$total = summaryData === null || summaryData === void 0 ? void 0 : summaryData.total) !== null && _summaryData$total !== void 0 ? _summaryData$total : 0;
    return denominator <= 0 ? 0 : numerator / denominator;
  }

  getFormattedStatNumber() {
    const {
      vitalDetails: vital
    } = this.props;
    const summary = this.summary;
    const {
      type
    } = vital;
    return summary === null ? '\u2014' : type === 'duration' ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__.getDuration)(summary / 1000, 2, true) : (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__.formatFloat)(summary, 2);
  }

  renderSummary() {
    var _newEventView$query;

    const {
      vitalDetails: vital,
      eventView,
      organization,
      min,
      max,
      dataFilter
    } = this.props;
    const {
      slug,
      name,
      description
    } = vital;
    const column = `measurements.${slug}`;
    const newEventView = eventView.withColumns([{
      kind: 'field',
      field: 'transaction'
    }, {
      kind: 'function',
      function: ['percentile', column, _constants__WEBPACK_IMPORTED_MODULE_23__.PERCENTILE.toString(), undefined]
    }, {
      kind: 'function',
      function: ['count', '', '', undefined]
    }]).withSorts([{
      kind: 'desc',
      field: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_15__.getAggregateAlias)(`percentile(${column},${_constants__WEBPACK_IMPORTED_MODULE_23__.PERCENTILE.toString()})`)
    }]);
    const query = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_19__.MutableSearch((_newEventView$query = newEventView.query) !== null && _newEventView$query !== void 0 ? _newEventView$query : '');
    query.addFilterValues('has', [column]); // add in any range constraints if any

    if (min !== undefined || max !== undefined) {
      if (min !== undefined) {
        query.addFilterValues(column, [`>=${min}`]);
      }

      if (max !== undefined) {
        query.addFilterValues(column, [`<=${max}`]);
      }
    }

    newEventView.query = query.formatString();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_24__.CardSummary, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(SummaryHeading, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_24__.CardSectionHeading, {
          children: `${name} (${slug.toUpperCase()})`
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_24__.StatNumber, {
        children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__["default"])({
          value: this.getFormattedStatNumber(),
          fixed: '\u2014'
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_styles__WEBPACK_IMPORTED_MODULE_24__.Description, {
        children: description
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          size: "xs",
          to: newEventView.withColumns([{
            kind: 'field',
            field: column
          }]).withSorts([{
            kind: 'desc',
            field: column
          }]).getPerformanceTransactionEventsViewUrlTarget(organization.slug, {
            showTransactions: dataFilter === 'all' ? sentry_views_performance_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_20__.EventsDisplayFilterName.p100 : sentry_views_performance_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_20__.EventsDisplayFilterName.p75,
            webVital: column
          }),
          onClick: this.trackOpenAllEventsClicked,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('View All Events')
        })
      })]
    });
  }
  /**
   * This callback happens everytime ECharts renders. This is NOT when ECharts
   * finishes rendering, so it can be called quite frequently. The calculations
   * here can get expensive if done frequently, furthermore, this can trigger a
   * state change leading to a re-render. So slow down the updates here as they
   * do not need to be updated every single time.
   */


  renderHistogram() {
    const {
      theme,
      location,
      isLoading,
      chartData,
      summaryData,
      error,
      colors,
      vital,
      vitalDetails,
      precision = 0
    } = this.props;
    const {
      slug
    } = vitalDetails;
    const series = this.getSeries();
    const xAxis = {
      type: 'category',
      truncate: true,
      axisTick: {
        alignWithLabel: true
      }
    };
    const values = series.data.map(point => point.value);
    const max = values.length ? Math.max(...values) : undefined;
    const yAxis = {
      type: 'value',
      max,
      axisLabel: {
        color: theme.chartLabel,
        formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__.formatAbbreviatedNumber
      }
    };
    const allSeries = [series];

    if (!isLoading && !error) {
      const baselineSeries = this.getBaselineSeries();

      if (baselineSeries !== null) {
        allSeries.push(baselineSeries);
      }
    }

    const vitalData = !isLoading && !error && summaryData !== null ? {
      [vital]: summaryData
    } : {};
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_8__["default"], {
      minZoomWidth: 10 ** -precision * _constants__WEBPACK_IMPORTED_MODULE_23__.NUM_BUCKETS,
      location: location,
      paramStart: `${slug}Start`,
      paramEnd: `${slug}End`,
      xAxisIndex: [0],
      buckets: (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_18__.computeBuckets)(chartData),
      onDataZoomCancelled: this.handleDataZoomCancelled,
      children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(Container, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
          visible: isLoading
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(PercentContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(_landing_vitalsCards__WEBPACK_IMPORTED_MODULE_21__.VitalBar, {
            isLoading: isLoading,
            data: vitalData,
            vital: vital,
            showBar: false,
            showStates: false,
            showVitalPercentNames: false,
            showVitalThresholds: false,
            showDurationDetail: false
          })
        }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_17__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_7__.BarChart, {
            series: allSeries,
            xAxis: xAxis,
            yAxis: yAxis,
            colors: colors,
            onRendered: this.handleRendered,
            grid: {
              left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3),
              right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3),
              top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3),
              bottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5)
            },
            stacked: true,
            ...zoomRenderProps
          }),
          fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_11__["default"], {
            testId: "skeleton-ui",
            height: "200px"
          })
        })]
      })
    });
  }

  bucketWidth() {
    const {
      chartData
    } = this.props; // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.

    return chartData.length >= 2 ? chartData[1].bin - chartData[0].bin : 0;
  }

  getSeries() {
    const {
      theme,
      chartData,
      precision,
      vitalDetails,
      vital
    } = this.props;

    const additionalFieldsFn = bucket => {
      return {
        itemStyle: {
          color: theme[this.getVitalsColor(vital, bucket)]
        }
      };
    };

    const data = (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_18__.formatHistogramData)(chartData, {
      precision: precision === 0 ? undefined : precision,
      type: vitalDetails.type,
      additionalFieldsFn
    });
    return {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Count'),
      data
    };
  }

  getVitalsColor(vital, value) {
    const poorThreshold = _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.webVitalPoor[vital];
    const mehThreshold = _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.webVitalMeh[vital];

    if (value >= poorThreshold) {
      return _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.vitalStateColors[_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.VitalState.POOR];
    }

    if (value >= mehThreshold) {
      return _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.vitalStateColors[_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.VitalState.MEH];
    }

    return _vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.vitalStateColors[_vitalDetail_utils__WEBPACK_IMPORTED_MODULE_22__.VitalState.GOOD];
  }

  getBaselineSeries() {
    const {
      theme,
      chartData
    } = this.props;
    const summary = this.summary;

    if (summary === null || this.state.refPixelRect === null) {
      return null;
    }

    const summaryBucket = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.findNearestBucketIndex)(chartData, summary);

    if (summaryBucket === null || summaryBucket === -1) {
      return null;
    }

    const thresholdPixelBottom = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.mapPoint)({
      // subtract 0.5 from the x here to ensure that the threshold lies between buckets
      x: summaryBucket - 0.5,
      y: 0
    }, this.state.refDataRect, this.state.refPixelRect);

    if (thresholdPixelBottom === null) {
      return null;
    }

    const thresholdPixelTop = (0,_utils__WEBPACK_IMPORTED_MODULE_25__.mapPoint)({
      // subtract 0.5 from the x here to ensure that the threshold lies between buckets
      x: summaryBucket - 0.5,
      y: Math.max(...chartData.map(data => data.count)) || 1
    }, this.state.refDataRect, this.state.refPixelRect);

    if (thresholdPixelTop === null) {
      return null;
    }

    const markLine = (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_9__["default"])({
      animationDuration: 200,
      data: [[thresholdPixelBottom, thresholdPixelTop]],
      label: {
        show: false
      },
      lineStyle: {
        color: theme.textColor,
        type: 'solid'
      },
      tooltip: {
        formatter: () => {
          return ['<div class="tooltip-series tooltip-series-solo">', '<span class="tooltip-label">', `<strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('p75')}</strong>`, '</span>', '</div>', '<div class="tooltip-arrow"></div>'].join('');
        }
      }
    });
    return {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('p75'),
      data: [],
      markLine
    };
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(_styles__WEBPACK_IMPORTED_MODULE_24__.Card, {
      children: [this.renderSummary(), this.renderHistogram()]
    });
  }

}

VitalCard.displayName = "VitalCard";

const SummaryHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yeyzg42"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yeyzg41"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const PercentContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yeyzg40"
} : 0)("position:absolute;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3), ";z-index:2;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_27__.d)(VitalCard));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/vitalsPanel.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/vitalsPanel.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/histogram/histogramQuery */ "./app/utils/performance/histogram/histogramQuery.tsx");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _vitalCard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./vitalCard */ "./app/views/performance/transactionSummary/transactionVitals/vitalCard.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class VitalsPanel extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  renderVitalCard(vital, isLoading, error, data, histogram, color, min, max, precision) {
    const {
      location,
      organization,
      eventView,
      dataFilter
    } = this.props;
    const vitalDetails = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_3__.WEB_VITAL_DETAILS[vital];
    const zoomed = min !== undefined || max !== undefined;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_2__["default"], {
      location: location,
      orgSlug: organization.slug,
      eventView: eventView,
      numBuckets: _constants__WEBPACK_IMPORTED_MODULE_5__.NUM_BUCKETS,
      fields: zoomed ? [vital] : [],
      min: min,
      max: max,
      precision: precision,
      dataFilter: dataFilter,
      children: results => {
        var _results$histograms$v, _results$histograms;

        const loading = zoomed ? results.isLoading : isLoading;
        const errored = zoomed ? results.error !== null : error;
        const chartData = zoomed ? (_results$histograms$v = (_results$histograms = results.histograms) === null || _results$histograms === void 0 ? void 0 : _results$histograms[vital]) !== null && _results$histograms$v !== void 0 ? _results$histograms$v : histogram : histogram;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_vitalCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
          location: location,
          isLoading: loading,
          error: errored,
          vital: vital,
          vitalDetails: vitalDetails,
          summaryData: data,
          chartData: chartData,
          colors: color,
          eventView: eventView,
          organization: organization,
          min: min,
          max: max,
          precision: precision,
          dataFilter: dataFilter
        });
      }
    });
  }

  renderVitalGroup(group, summaryResults) {
    const {
      location,
      organization,
      eventView,
      dataFilter
    } = this.props;
    const {
      vitals,
      colors,
      min,
      max,
      precision
    } = group;
    const bounds = vitals.reduce((allBounds, vital) => {
      const slug = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_3__.WEB_VITAL_DETAILS[vital].slug;
      allBounds[vital] = {
        start: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeScalar)(location.query[`${slug}Start`]),
        end: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeScalar)(location.query[`${slug}End`])
      };
      return allBounds;
    }, {});
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_2__["default"], {
      location: location,
      orgSlug: organization.slug,
      eventView: eventView,
      numBuckets: _constants__WEBPACK_IMPORTED_MODULE_5__.NUM_BUCKETS,
      fields: vitals,
      min: min,
      max: max,
      precision: precision,
      dataFilter: dataFilter,
      children: multiHistogramResults => {
        const isLoading = summaryResults.isLoading || multiHistogramResults.isLoading;
        const error = summaryResults.error !== null || multiHistogramResults.error !== null;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
          children: vitals.map((vital, index) => {
            var _summaryResults$vital, _summaryResults$vital2, _multiHistogramResult, _multiHistogramResult2, _bounds$vital;

            const data = (_summaryResults$vital = summaryResults === null || summaryResults === void 0 ? void 0 : (_summaryResults$vital2 = summaryResults.vitalsData) === null || _summaryResults$vital2 === void 0 ? void 0 : _summaryResults$vital2[vital]) !== null && _summaryResults$vital !== void 0 ? _summaryResults$vital : null;
            const histogram = (_multiHistogramResult = (_multiHistogramResult2 = multiHistogramResults.histograms) === null || _multiHistogramResult2 === void 0 ? void 0 : _multiHistogramResult2[vital]) !== null && _multiHistogramResult !== void 0 ? _multiHistogramResult : [];
            const {
              start,
              end
            } = (_bounds$vital = bounds[vital]) !== null && _bounds$vital !== void 0 ? _bounds$vital : {};
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
              children: this.renderVitalCard(vital, isLoading, error, data, histogram, [colors[index]], parseBound(start, precision), parseBound(end, precision), precision)
            }, vital);
          })
        });
      }
    });
  }

  render() {
    const {
      results
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
        children: _constants__WEBPACK_IMPORTED_MODULE_5__.VITAL_GROUPS.map(vitalGroup => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
          children: this.renderVitalGroup(vitalGroup, results)
        }, vitalGroup.vitals.join('')))
      })
    });
  }

}

VitalsPanel.displayName = "VitalsPanel";

function parseBound(boundString, precision) {
  if (boundString === undefined) {
    return undefined;
  }

  if (precision === undefined || precision === 0) {
    return parseInt(boundString, 10);
  }

  return parseFloat(boundString);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VitalsPanel);

/***/ }),

/***/ "../node_modules/lodash/throttle.js":
/*!******************************************!*\
  !*** ../node_modules/lodash/throttle.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var debounce = __webpack_require__(/*! ./debounce */ "../node_modules/lodash/debounce.js"),
    isObject = __webpack_require__(/*! ./isObject */ "../node_modules/lodash/isObject.js");

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds. The throttled function comes with a `cancel`
 * method to cancel delayed `func` invocations and a `flush` method to
 * immediately invoke them. Provide `options` to indicate whether `func`
 * should be invoked on the leading and/or trailing edge of the `wait`
 * timeout. The `func` is invoked with the last arguments provided to the
 * throttled function. Subsequent calls to the throttled function return the
 * result of the last `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the throttled function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.throttle` and `_.debounce`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to throttle.
 * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=true]
 *  Specify invoking on the leading edge of the timeout.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new throttled function.
 * @example
 *
 * // Avoid excessively updating the position while scrolling.
 * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
 *
 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
 * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
 * jQuery(element).on('click', throttled);
 *
 * // Cancel the trailing throttled invocation.
 * jQuery(window).on('popstate', throttled.cancel);
 */
function throttle(func, wait, options) {
  var leading = true,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  if (isObject(options)) {
    leading = 'leading' in options ? !!options.leading : leading;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }
  return debounce(func, wait, {
    'leading': leading,
    'maxWait': wait,
    'trailing': trailing
  });
}

module.exports = throttle;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_eventsRequest_tsx-app_utils_discover_discoverQuery_tsx-app_views_perfor-9421d1.ada8804a76fc25b1b1802880e714e15e.js.map