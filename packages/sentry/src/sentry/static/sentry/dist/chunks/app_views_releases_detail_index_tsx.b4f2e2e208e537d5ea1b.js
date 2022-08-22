(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_releases_detail_index_tsx"],{

/***/ "./app/components/navigationButtonGroup.tsx":
/*!**************************************************!*\
  !*** ./app/components/navigationButtonGroup.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const NavigationButtonGroup = _ref => {
  let {
    links,
    hasNext = false,
    hasPrevious = false,
    className,
    size,
    onOldestClick,
    onOlderClick,
    onNewerClick,
    onNewestClick
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    merged: true,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[0],
      disabled: !hasPrevious,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Oldest'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconPrevious, {
        size: "xs"
      }),
      onClick: onOldestClick
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[1],
      disabled: !hasPrevious,
      onClick: onOlderClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Older')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[2],
      disabled: !hasNext,
      onClick: onNewerClick,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Newer')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
      size: size,
      to: links[3],
      disabled: !hasNext,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Newest'),
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconNext, {
        size: "xs"
      }),
      onClick: onNewestClick
    })]
  });
};

NavigationButtonGroup.displayName = "NavigationButtonGroup";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NavigationButtonGroup);

/***/ }),

/***/ "./app/components/pickProjectToContinue.tsx":
/*!**************************************************!*\
  !*** ./app/components/pickProjectToContinue.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/contextPickerModal */ "./app/components/contextPickerModal.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





function PickProjectToContinue(_ref) {
  let {
    noProjectRedirectPath,
    nextPath,
    router,
    projects
  } = _ref;
  const nextPathQuery = nextPath.query;
  let navigating = false;
  let path = `${nextPath.pathname}?project=`;

  if (nextPathQuery) {
    const filteredQuery = Object.entries(nextPathQuery).filter(_ref2 => {
      let [key, _value] = _ref2;
      return key !== 'project';
    }).map(_ref3 => {
      let [key, value] = _ref3;
      return `${key}=${value}`;
    });
    const newPathQuery = [...filteredQuery, 'project='].join('&');
    path = `${nextPath.pathname}?${newPathQuery}`;
  } // if the project in URL is missing, but this release belongs to only one project, redirect there


  if (projects.length === 1) {
    router.replace(path + projects[0].id);
    return null;
  }

  (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openModal)(modalProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_contextPickerModal__WEBPACK_IMPORTED_MODULE_4__["default"], { ...modalProps,
    needOrg: false,
    needProject: true,
    nextPath: `${path}:project`,
    onFinish: pathname => {
      navigating = true;
      router.replace(pathname);
    },
    projectSlugs: projects.map(p => p.slug)
  }), {
    onClose() {
      // we want this to be executed only if the user didn't select any project
      // (closed modal either via button, Esc, clicking outside, ...)
      if (!navigating) {
        router.push(noProjectRedirectPath);
      }
    }

  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ContextPickerBackground, {});
}

PickProjectToContinue.displayName = "PickProjectToContinue";

const ContextPickerBackground = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sj8doz0"
} : 0)( true ? {
  name: "4wiox3",
  styles: "height:100vh;width:100%"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PickProjectToContinue);

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

/***/ "./app/views/releases/detail/header/releaseActions.tsx":
/*!*************************************************************!*\
  !*** ./app/views/releases/detail/header/releaseActions.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/release */ "./app/actionCreators/release.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_navigationButtonGroup__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/navigationButtonGroup */ "./app/components/navigationButtonGroup.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















function ReleaseActions(_ref) {
  let {
    location,
    organization,
    projectSlug,
    release,
    releaseMeta,
    refetchData
  } = _ref;

  async function handleArchive() {
    try {
      await (0,sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_4__.archiveRelease)(new sentry_api__WEBPACK_IMPORTED_MODULE_5__.Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version
      });
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(`/organizations/${organization.slug}/releases/`);
    } catch {// do nothing, action creator is already displaying error message
    }
  }

  async function handleRestore() {
    try {
      await (0,sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_4__.restoreRelease)(new sentry_api__WEBPACK_IMPORTED_MODULE_5__.Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version
      });
      refetchData();
    } catch {// do nothing, action creator is already displaying error message
    }
  }

  function getProjectList() {
    const maxVisibleProjects = 5;
    const visibleProjects = releaseMeta.projects.slice(0, maxVisibleProjects);
    const numberOfCollapsedProjects = releaseMeta.projects.length - visibleProjects.length;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [visibleProjects.map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_9__["default"], {
        project: project,
        avatarSize: 18
      }, project.slug)), numberOfCollapsedProjects > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("span", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
          title: release.projects.slice(maxVisibleProjects).map(p => p.slug).join(', '),
          children: ["+ ", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tn)('%s other project', '%s other projects', numberOfCollapsedProjects)]
        })
      })]
    });
  }

  function getModalHeader(title) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("h4", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_11__["default"], {
        children: title
      })
    });
  }

  function getModalMessage(message) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [message, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(ProjectsWrapper, {
        children: getProjectList()
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Are you sure you want to do this?')]
    });
  }

  function replaceReleaseUrl(toRelease) {
    return toRelease ? {
      pathname: location.pathname.replace(encodeURIComponent(release.version), toRelease).replace(release.version, toRelease),
      query: { ...location.query,
        activeRepo: undefined
      }
    } : '';
  }

  function handleNavigationClick(direction) {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_16__.trackAnalyticsEvent)({
      eventKey: `release_detail.pagination`,
      eventName: `Release Detail: Pagination`,
      organization_id: parseInt(organization.id, 10),
      direction
    });
  }

  const menuItems = [(0,_utils__WEBPACK_IMPORTED_MODULE_18__.isReleaseArchived)(release) ? {
    key: 'restore',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Restore'),
    onAction: () => (0,sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__.openConfirmModal)({
      onConfirm: handleRestore,
      header: getModalHeader((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Restore Release [release]', {
        release: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__.formatVersion)(release.version)
      })),
      message: getModalMessage((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tn)('You are restoring this release for the following project:', 'By restoring this release, you are also restoring it for the following projects:', releaseMeta.projects.length)),
      cancelText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Nevermind'),
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Restore')
    })
  } : {
    key: 'archive',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Archive'),
    onAction: () => (0,sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__.openConfirmModal)({
      onConfirm: handleArchive,
      header: getModalHeader((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tct)('Archive Release [release]', {
        release: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__.formatVersion)(release.version)
      })),
      message: getModalMessage((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.tn)('You are archiving this release for the following project:', 'By archiving this release, you are also archiving it for the following projects:', releaseMeta.projects.length)),
      cancelText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Nevermind'),
      confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Archive')
    })
  }];
  const {
    nextReleaseVersion,
    prevReleaseVersion,
    firstReleaseVersion,
    lastReleaseVersion
  } = release.currentProjectMeta;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
    gap: 1,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_navigationButtonGroup__WEBPACK_IMPORTED_MODULE_10__["default"], {
      hasPrevious: !!prevReleaseVersion,
      hasNext: !!nextReleaseVersion,
      links: [replaceReleaseUrl(firstReleaseVersion), replaceReleaseUrl(prevReleaseVersion), replaceReleaseUrl(nextReleaseVersion), replaceReleaseUrl(lastReleaseVersion)],
      onOldestClick: () => handleNavigationClick('oldest'),
      onOlderClick: () => handleNavigationClick('older'),
      onNewerClick: () => handleNavigationClick('newer'),
      onNewestClick: () => handleNavigationClick('newest')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_8__["default"], {
      items: menuItems,
      triggerProps: {
        showChevron: false,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconEllipsis, {}),
        'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Actions')
      },
      placement: "bottom right"
    })]
  });
}

ReleaseActions.displayName = "ReleaseActions";

const ProjectsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ehxwv690"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";img{border:none!important;box-shadow:none!important;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseActions);

/***/ }),

/***/ "./app/views/releases/detail/header/releaseHeader.tsx":
/*!************************************************************!*\
  !*** ./app/views/releases/detail/header/releaseHeader.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/badge */ "./app/components/badge.tsx");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _releaseActions__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./releaseActions */ "./app/views/releases/detail/header/releaseActions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















const ReleaseHeader = _ref => {
  let {
    location,
    organization,
    release,
    project,
    releaseMeta,
    refetchData
  } = _ref;
  const {
    version,
    url
  } = release;
  const {
    commitCount,
    commitFilesChanged
  } = releaseMeta;
  const releasePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(version)}/`;
  const tabs = [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Overview'),
    to: ''
  }, {
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Commits'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(NavTabsBadge, {
        text: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__.formatAbbreviatedNumber)(commitCount)
      })]
    }),
    to: `commits/`
  }, {
    title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Files Changed'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(NavTabsBadge, {
        text: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_17__.formatAbbreviatedNumber)(commitFilesChanged)
      })]
    }),
    to: `files-changed/`
  }];

  const getTabUrl = path => ({
    pathname: releasePath + path,
    query: lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(location.query, Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_13__.URL_PARAM))
  });

  const getActiveTabTo = () => {
    // We are not doing strict version check because there would be a tiny page shift when switching between releases with paginator
    const activeTab = tabs.filter(tab => tab.to.length) // remove home 'Overview' from consideration
    .find(tab => location.pathname.endsWith(tab.to));

    if (activeTab) {
      return activeTab.to;
    }

    return tabs[0].to; // default to 'Overview'
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.HeaderContent, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_4__["default"], {
        crumbs: [{
          to: `/organizations/${organization.slug}/releases/`,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Releases'),
          preservePageFilters: true
        }, {
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Release Details')
        }]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.Title, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(ReleaseName, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__["default"], {
            project: project,
            avatarSize: 28,
            hideName: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledVersion, {
            version: version,
            anchor: false,
            truncate: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(IconWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              title: version,
              containerDisplayMode: "flex",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_5__["default"], {
                value: version,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconCopy, {})
              })
            })
          }), !!url && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(IconWrapper, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
              title: url,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
                href: url,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconOpen, {})
              })
            })
          })]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_7__.HeaderActions, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_releaseActions__WEBPACK_IMPORTED_MODULE_18__["default"], {
        organization: organization,
        projectSlug: project.slug,
        release: release,
        releaseMeta: releaseMeta,
        refetchData: refetchData,
        location: location
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledNavTabs, {
        children: tabs.map(tab => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
          to: getTabUrl(tab.to),
          isActive: () => getActiveTabTo() === tab.to,
          children: tab.title
        }, tab.to))
      })
    })]
  });
};

ReleaseHeader.displayName = "ReleaseHeader";

const ReleaseName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1l92gzd4"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledVersion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_version__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e1l92gzd3"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1l92gzd2"
} : 0)("transition:color 0.3s ease-in-out;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), ";&,a{color:", p => p.theme.gray300, ";display:flex;&:hover{cursor:pointer;color:", p => p.theme.textColor, ";}}" + ( true ? "" : 0));

const StyledNavTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1l92gzd1"
} : 0)( true ? {
  name: "13jhhqe",
  styles: "margin-bottom:0;width:100%"
} : 0);

const NavTabsBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_badge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1l92gzd0"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){display:none;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseHeader);

/***/ }),

/***/ "./app/views/releases/detail/index.tsx":
/*!*********************************************!*\
  !*** ./app/views/releases/detail/index.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReleaseContext": () => (/* binding */ ReleaseContext),
/* harmony export */   "ReleasesDetailContainer": () => (/* binding */ ReleasesDetailContainer),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_pickProjectToContinue__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pickProjectToContinue */ "./app/components/pickProjectToContinue.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _header_releaseHeader__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./header/releaseHeader */ "./app/views/releases/detail/header/releaseHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



























const ReleaseContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_4__.createContext)({});

class ReleasesDetail extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_25__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);
  }

  getTitle() {
    const {
      params,
      organization,
      selection
    } = this.props;
    const {
      release
    } = this.state; // The release details page will always have only one project selected

    const project = release === null || release === void 0 ? void 0 : release.projects.find(p => p.id === selection.projects[0]);
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_21__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Release %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatVersion)(params.release)), organization.slug, false, project === null || project === void 0 ? void 0 : project.slug);
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      deploys: [],
      sessions: null
    };
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      organization,
      params,
      location
    } = this.props;

    if (prevProps.params.release !== params.release || prevProps.organization.slug !== organization.slug || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.pickLocationQuery(prevProps.location), this.pickLocationQuery(location))) {
      super.componentDidUpdate(prevProps, prevState);
    }
  }

  getEndpoints() {
    var _location$query$envir;

    const {
      organization,
      location,
      params,
      releaseMeta
    } = this.props;
    const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(params.release)}/`;
    const endpoints = [['release', basePath, {
      query: {
        adoptionStages: 1,
        ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(this.pickLocationQuery(location))
      }
    }]];

    if (releaseMeta.deployCount > 0) {
      endpoints.push(['deploys', `${basePath}deploys/`]);
    } // Used to figure out if the release has any health data


    endpoints.push(['sessions', `/organizations/${organization.slug}/sessions/`, {
      query: {
        project: location.query.project,
        environment: (_location$query$envir = location.query.environment) !== null && _location$query$envir !== void 0 ? _location$query$envir : [],
        query: `release:"${params.release}"`,
        field: 'sum(session)',
        statsPeriod: '90d',
        interval: '1d'
      }
    }]);
    return endpoints;
  }

  pickLocationQuery(location) {
    return lodash_pick__WEBPACK_IMPORTED_MODULE_6___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__.URL_PARAM), ...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_14__.PAGE_URL_PARAM)]);
  }

  renderError() {
    const possiblyWrongProject = Object.values(this.state.errors).find(e => (e === null || e === void 0 ? void 0 : e.status) === 404 || (e === null || e === void 0 ? void 0 : e.status) === 403);

    if (possiblyWrongProject) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This release may not be in your selected project.')
        })
      });
    }

    return super.renderError(...arguments);
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {})
    });
  }

  renderBody() {
    const {
      organization,
      location,
      selection,
      releaseMeta
    } = this.props;
    const {
      release,
      deploys,
      sessions,
      reloading
    } = this.state;
    const project = release === null || release === void 0 ? void 0 : release.projects.find(p => p.id === selection.projects[0]);
    const releaseBounds = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.getReleaseBounds)(release);

    if (!project || !release) {
      if (reloading) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {});
      }

      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_10__["default"], {
      organization: organization,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(StyledPageContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_header_releaseHeader__WEBPACK_IMPORTED_MODULE_27__["default"], {
          location: location,
          organization: organization,
          release: release,
          project: project,
          releaseMeta: releaseMeta,
          refetchData: this.fetchData
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ReleaseContext.Provider, {
          value: {
            release,
            project,
            deploys,
            releaseMeta,
            refetchData: this.fetchData,
            hasHealthData: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(sessions === null || sessions === void 0 ? void 0 : sessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_19__.SessionFieldWithOperation.SESSIONS) > 0,
            releaseBounds
          },
          children: this.props.children
        })]
      })
    });
  }

}

class ReleasesDetailContainer extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);
  }

  getEndpoints() {
    const {
      organization,
      params
    } = this.props; // fetch projects this release belongs to

    return [['releaseMeta', `/organizations/${organization.slug}/releases/${encodeURIComponent(params.release)}/meta/`]];
  }

  componentDidMount() {
    this.removeGlobalDateTimeFromUrl();
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      organization,
      params
    } = this.props;
    this.removeGlobalDateTimeFromUrl();

    if (prevProps.params.release !== params.release || prevProps.organization.slug !== organization.slug) {
      super.componentDidUpdate(prevProps, prevState);
    }
  }

  removeGlobalDateTimeFromUrl() {
    const {
      router,
      location
    } = this.props;
    const {
      start,
      end,
      statsPeriod,
      utc,
      ...restQuery
    } = location.query;

    if (start || end || statsPeriod || utc) {
      router.replace({ ...location,
        query: restQuery
      });
    }
  }

  renderError() {
    const has404Errors = Object.values(this.state.errors).find(e => (e === null || e === void 0 ? void 0 : e.status) === 404);

    if (has404Errors) {
      // This catches a 404 coming from the release endpoint and displays a custom error message.
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "error",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This release could not be found.')
        })
      });
    }

    return super.renderError(...arguments);
  }

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;
    return !projectId || typeof projectId !== 'string';
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {})
    });
  }

  renderProjectsFooterMessage() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ProjectsFooterMessage, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconInfo, {
        size: "xs"
      }), " ", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Only projects with this release are visible.')]
    });
  }

  renderBody() {
    const {
      organization,
      params,
      router
    } = this.props;
    const {
      releaseMeta
    } = this.state;

    if (!releaseMeta) {
      return null;
    }

    const {
      projects
    } = releaseMeta;

    if (this.isProjectMissingInUrl()) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_pickProjectToContinue__WEBPACK_IMPORTED_MODULE_13__["default"], {
        projects: projects.map(_ref => {
          let {
            id,
            slug
          } = _ref;
          return {
            id: String(id),
            slug
          };
        }),
        router: router,
        nextPath: {
          pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(params.release)}/`
        },
        noProjectRedirectPath: `/organizations/${organization.slug}/releases/`
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_11__["default"], {
      shouldForceProject: projects.length === 1,
      forceProject: projects.length === 1 ? { ...projects[0],
        id: String(projects[0].id)
      } : undefined,
      specificProjectSlugs: projects.map(p => p.slug),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ReleasesDetail, { ...this.props,
        releaseMeta: releaseMeta
      })
    });
  }

}

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_17__.PageContent,  true ? {
  target: "eii7qn31"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const ProjectsFooterMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eii7qn30"
} : 0)("display:grid;align-items:center;grid-template-columns:min-content 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_24__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])(ReleasesDetailContainer)));

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


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_releases_detail_index_tsx.7c7b84bc4fd7e5965b5f24cca00e1118.js.map