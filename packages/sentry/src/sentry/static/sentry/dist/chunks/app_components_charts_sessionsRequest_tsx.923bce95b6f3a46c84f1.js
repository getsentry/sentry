"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_sessionsRequest_tsx"],{

/***/ "./app/components/charts/sessionsRequest.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/sessionsRequest.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/utils/sessions.tsx":
/*!********************************!*\
  !*** ./app/utils/sessions.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/releases/utils/index.tsx":
/*!********************************************!*\
  !*** ./app/views/releases/utils/index.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_sessionsRequest_tsx.f423eef51b1d7140b1b6682575556c9e.js.map