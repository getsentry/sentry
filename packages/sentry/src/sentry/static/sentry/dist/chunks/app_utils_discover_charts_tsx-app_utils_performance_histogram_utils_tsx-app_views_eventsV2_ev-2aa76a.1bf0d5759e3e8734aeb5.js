(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_discover_charts_tsx-app_utils_performance_histogram_utils_tsx-app_views_eventsV2_ev-2aa76a"],{

/***/ "./app/components/events/errorLevel.tsx":
/*!**********************************************!*\
  !*** ./app/components/events/errorLevel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DEFAULT_SIZE = '13px';

const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e145dcfe0"
} : 0)("padding:0;position:relative;width:", p => p.size || DEFAULT_SIZE, ";height:", p => p.size || DEFAULT_SIZE, ";text-indent:-9999em;display:inline-block;border-radius:50%;flex-shrink:0;background-color:", p => p.level ? p.theme.level[p.level] : p.theme.level.error, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorLevel);

/***/ }),

/***/ "./app/components/events/eventMessage.tsx":
/*!************************************************!*\
  !*** ./app/components/events/eventMessage.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const BaseEventMessage = _ref => {
  let {
    className,
    level,
    levelIndicatorSize,
    message,
    annotations
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: className,
    children: [level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledErrorLevel, {
      size: levelIndicatorSize,
      level: level,
      children: level
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Message, {
      children: message
    }), annotations]
  });
};

BaseEventMessage.displayName = "BaseEventMessage";

const EventMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseEventMessage,  true ? {
  target: "e1rp796r2"
} : 0)( true ? {
  name: "1go2o7p",
  styles: "display:flex;align-items:center;position:relative;line-height:1.2;overflow:hidden"
} : 0);

const StyledErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1rp796r1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rp796r0"
} : 0)(p => p.theme.overflowEllipsis, " width:auto;max-height:38px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMessage);

/***/ }),

/***/ "./app/components/group/times.tsx":
/*!****************************************!*\
  !*** ./app/components/group/times.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






/**
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */




const Times = _ref => {
  let {
    lastSeen,
    firstSeen
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Container, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(FlexWrapper, {
      children: [lastSeen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(StyledIconClock, {
          size: "11px"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__["default"], {
          date: lastSeen,
          suffix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('ago')
        })]
      }), firstSeen && lastSeen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
        className: "hidden-xs hidden-sm",
        children: "\xA0\u2014\xA0"
      }), firstSeen && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_2__["default"], {
        date: firstSeen,
        suffix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('old'),
        className: "hidden-xs hidden-sm"
      })]
    })
  });
};

Times.displayName = "Times";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pb87w32"
} : 0)( true ? {
  name: "bk4x30",
  styles: "flex-shrink:1;min-width:0"
} : 0);

const FlexWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1pb87w31"
} : 0)(p => p.theme.overflowEllipsis, "display:flex;align-items:center;" + ( true ? "" : 0));

const StyledIconClock = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconClock,  true ? {
  target: "e1pb87w30"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Times);

/***/ }),

/***/ "./app/components/seenByList.tsx":
/*!***************************************!*\
  !*** ./app/components/seenByList.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/avatarList */ "./app/components/avatar/avatarList.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const SeenByList = _ref => {
  let {
    avatarSize = 28,
    seenBy = [],
    iconTooltip = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('People who have viewed this'),
    maxVisibleAvatars = 10,
    iconPosition = 'left',
    className
  } = _ref;
  const activeUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('user');
  const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

  if (displayUsers.length === 0) {
    return null;
  } // Note className="seen-by" is required for responsive design


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(SeenByWrapper, {
    iconPosition: iconPosition,
    className: classnames__WEBPACK_IMPORTED_MODULE_2___default()('seen-by', className),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__["default"], {
      users: displayUsers,
      avatarSize: avatarSize,
      maxVisibleAvatars: maxVisibleAvatars,
      renderTooltip: user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__.userDisplayName)(user), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("br", {}), moment__WEBPACK_IMPORTED_MODULE_3___default()(user.lastSeen).format('LL')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
      iconPosition: iconPosition,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: iconTooltip,
        skipWrapper: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconShow, {
          size: "sm",
          color: "subText"
        })
      })
    })]
  });
};

SeenByList.displayName = "SeenByList";

const SeenByWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ayiung1"
} : 0)("display:flex;margin-top:15px;float:right;", p => p.iconPosition === 'left' ? 'flex-direction: row-reverse' : '', ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ayiung0"
} : 0)("display:flex;align-items:center;background-color:transparent;color:", p => p.theme.textColor, ";height:28px;width:24px;text-align:center;", p => p.iconPosition === 'left' ? 'margin-right: 10px' : '', ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SeenByList);

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

/***/ "./app/utils/performance/histogram/utils.tsx":
/*!***************************************************!*\
  !*** ./app/utils/performance/histogram/utils.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "computeBuckets": () => (/* binding */ computeBuckets),
/* harmony export */   "formatHistogramData": () => (/* binding */ formatHistogramData),
/* harmony export */   "getBucketWidth": () => (/* binding */ getBucketWidth)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");


function getBucketWidth(data) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return data.length >= 2 ? data[1].bin - data[0].bin : 0;
}
function computeBuckets(data) {
  const width = getBucketWidth(data);
  return data.map(item => {
    const bucket = item.bin;
    return {
      start: bucket,
      end: bucket + width
    };
  });
}
function formatHistogramData(data) {
  let {
    precision,
    type,
    additionalFieldsFn
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const formatter = value => {
    switch (type) {
      case 'duration':
        const decimalPlaces = precision !== null && precision !== void 0 ? precision : value < 1000 ? 0 : 3;
        return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_1__.getDuration)(value / 1000, decimalPlaces, true);

      case 'number':
        // This is trying to avoid some of potential rounding errors that cause bins
        // have the same label, if the number of bins doesn't visually match what is
        // expected, check that this rounding is correct. If this issue persists,
        // consider formatting the bin as a string in the response
        const factor = 10 ** (precision !== null && precision !== void 0 ? precision : 0);
        return (Math.round((value + Number.EPSILON) * factor) / factor).toLocaleString();

      default:
        throw new Error(`Unable to format type: ${type}`);
    }
  };

  return data.map(item => {
    var _additionalFieldsFn;

    return {
      value: item.count,
      name: formatter(item.bin),
      ...((_additionalFieldsFn = additionalFieldsFn === null || additionalFieldsFn === void 0 ? void 0 : additionalFieldsFn(item.bin)) !== null && _additionalFieldsFn !== void 0 ? _additionalFieldsFn : {})
    };
  });
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

/***/ "./app/views/eventsV2/breadcrumb.tsx":
/*!*******************************************!*\
  !*** ./app/views/eventsV2/breadcrumb.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function DiscoverBreadcrumb(_ref) {
  let {
    eventView,
    event,
    organization,
    location
  } = _ref;
  const crumbs = [];
  const discoverTarget = organization.features.includes('discover-query') ? {
    pathname: (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_3__.getDiscoverLandingUrl)(organization),
    query: { ...location.query,
      ...eventView.generateBlankQueryStringObject(),
      ...eventView.getPageFiltersQuery()
    }
  } : null;
  crumbs.push({
    to: discoverTarget,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Discover')
  });

  if (eventView && eventView.isValid()) {
    crumbs.push({
      to: eventView.getResultsViewUrlTarget(organization.slug),
      label: eventView.name || ''
    });
  }

  if (event) {
    crumbs.push({
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Event Detail')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__["default"], {
    crumbs: crumbs
  });
}

DiscoverBreadcrumb.displayName = "DiscoverBreadcrumb";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverBreadcrumb);

/***/ }),

/***/ "./app/views/eventsV2/eventDetails/content.tsx":
/*!*****************************************************!*\
  !*** ./app/views/eventsV2/eventDetails/content.tsx ***!
  \*****************************************************/
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
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/eventOrGroupTitle */ "./app/components/eventOrGroupTitle.tsx");
/* harmony import */ var sentry_components_events_eventCustomPerformanceMetrics__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/events/eventCustomPerformanceMetrics */ "./app/components/events/eventCustomPerformanceMetrics.tsx");
/* harmony import */ var sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/events/eventEntries */ "./app/components/events/eventEntries.tsx");
/* harmony import */ var sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/events/eventMessage */ "./app/components/events/eventMessage.tsx");
/* harmony import */ var sentry_components_events_eventVitals__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/events/eventVitals */ "./app/components/events/eventVitals.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_context__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/context */ "./app/components/events/interfaces/spans/context.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_tagsTable__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/tagsTable */ "./app/components/tagsTable.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/discover/urls */ "./app/utils/discover/urls.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceContext */ "./app/utils/performance/quickTrace/quickTraceContext.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceQuery */ "./app/utils/performance/quickTrace/quickTraceQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_traceMetaQuery__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceMetaQuery */ "./app/utils/performance/quickTrace/traceMetaQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_views_performance_transactionDetails_eventMetas__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/performance/transactionDetails/eventMetas */ "./app/views/performance/transactionDetails/eventMetas.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _breadcrumb__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ../breadcrumb */ "./app/views/eventsV2/breadcrumb.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ../utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _linkedIssue__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./linkedIssue */ "./app/views/eventsV2/eventDetails/linkedIssue.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











































class EventDetailsContent extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      // AsyncComponent state
      loading: true,
      reloading: false,
      error: false,
      errors: {},
      event: undefined,
      // local state
      isSidebarVisible: true
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleSidebar", () => {
      this.setState({
        isSidebarVisible: !this.state.isSidebarVisible
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "generateTagUrl", tag => {
      const {
        eventView,
        organization
      } = this.props;
      const {
        event
      } = this.state;

      if (!event) {
        return '';
      }

      const eventReference = { ...event
      };

      if (eventReference.id) {
        delete eventReference.id;
      }

      const tagKey = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_27__.formatTagKey)(tag.key);
      const nextView = (0,_utils__WEBPACK_IMPORTED_MODULE_38__.getExpandedResults)(eventView, {
        [tagKey]: tag.value
      }, eventReference);
      return nextView.getResultsViewUrlTarget(organization.slug);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getEventSlug", () => {
      const {
        eventSlug
      } = this.props.params;

      if (typeof eventSlug === 'string') {
        return eventSlug.trim();
      }

      return '';
    });
  }

  getEndpoints() {
    const {
      organization,
      params,
      location,
      eventView
    } = this.props;
    const {
      eventSlug
    } = params;
    const query = eventView.getEventsAPIPayload(location); // Fields aren't used, reduce complexity by omitting from query entirely

    query.field = [];
    const url = `/organizations/${organization.slug}/events/${eventSlug}/`; // Get a specific event. This could be coming from
    // a paginated group or standalone event.

    return [['event', url, {
      query
    }]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  renderBody() {
    const {
      event
    } = this.state;

    if (!event) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    }

    return this.renderContent(event);
  }

  renderContent(event) {
    var _event$tags$find;

    const {
      organization,
      location,
      eventView,
      route,
      router
    } = this.props;
    const {
      isSidebarVisible
    } = this.state; // metrics

    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_25__.trackAnalyticsEvent)({
      eventKey: 'discover_v2.event_details',
      eventName: 'Discoverv2: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10)
    });
    const transactionName = (_event$tags$find = event.tags.find(tag => tag.key === 'transaction')) === null || _event$tags$find === void 0 ? void 0 : _event$tags$find.value;
    const transactionSummaryTarget = event.type === 'transaction' && transactionName ? (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_36__.transactionSummaryRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: event.projectID,
      query: location.query
    }) : null;
    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${event.eventID}/json/`;

    const renderContent = (results, metaResults) => {
      var _metaResults$meta;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Header, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.HeaderContent, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_breadcrumb__WEBPACK_IMPORTED_MODULE_37__["default"], {
              eventView: eventView,
              event: event,
              organization: organization,
              location: location
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(EventHeader, {
              event: event
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.HeaderActions, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
              gap: 1,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                onClick: this.toggleSidebar,
                children: isSidebarVisible ? 'Hide Details' : 'Show Details'
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_22__.IconOpen, {}),
                href: eventJsonUrl,
                external: true,
                onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('performance_views.event_details.json_button_click', {
                  organization
                }),
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('JSON'), " (", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_16__["default"], {
                  bytes: event.size
                }), ")"]
              }), transactionSummaryTarget && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_5__["default"], {
                organization: organization,
                features: ['performance-view'],
                children: _ref => {
                  let {
                    hasFeature
                  } = _ref;
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                    disabled: !hasFeature,
                    priority: "primary",
                    to: transactionSummaryTarget,
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('Go to Summary')
                  });
                }
              })]
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Body, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Main, {
            fullWidth: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_views_performance_transactionDetails_eventMetas__WEBPACK_IMPORTED_MODULE_35__["default"], {
              quickTrace: results !== null && results !== void 0 ? results : null,
              meta: (_metaResults$meta = metaResults === null || metaResults === void 0 ? void 0 : metaResults.meta) !== null && _metaResults$meta !== void 0 ? _metaResults$meta : null,
              event: event,
              organization: organization,
              projectId: this.projectId,
              location: location,
              errorDest: "discover",
              transactionDest: "discover"
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Main, {
            fullWidth: !isSidebarVisible,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_34__["default"], {
              orgId: organization.slug,
              slugs: [this.projectId],
              children: _ref2 => {
                let {
                  projects,
                  initiallyLoaded
                } = _ref2;
                return initiallyLoaded ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_interfaces_spans_context__WEBPACK_IMPORTED_MODULE_15__.Provider, {
                  value: {
                    getViewChildTransactionTarget: childTransactionProps => {
                      const childTransactionLink = (0,sentry_utils_discover_urls__WEBPACK_IMPORTED_MODULE_28__.eventDetailsRoute)({
                        eventSlug: childTransactionProps.eventSlug,
                        orgSlug: organization.slug
                      });
                      return {
                        pathname: childTransactionLink,
                        query: eventView.generateQueryStringObject()
                      };
                    }
                  },
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_30__.QuickTraceContext.Provider, {
                    value: results,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_12__.BorderlessEventEntries, {
                      organization: organization,
                      event: event,
                      project: projects[0],
                      location: location,
                      showExampleCommit: false,
                      showTagSummary: false,
                      api: this.api,
                      router: router,
                      route: route
                    })
                  })
                }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_19__["default"], {});
              }
            })
          }), isSidebarVisible && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_17__.Side, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_eventVitals__WEBPACK_IMPORTED_MODULE_14__["default"], {
              event: event
            }), (organization.features.includes('dashboards-mep') || organization.features.includes('mep-rollout-flag')) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_eventCustomPerformanceMetrics__WEBPACK_IMPORTED_MODULE_11__["default"], {
              event: event,
              location: location,
              organization: organization
            }), event.groupID && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(_linkedIssue__WEBPACK_IMPORTED_MODULE_39__["default"], {
              groupId: event.groupID,
              eventId: event.eventID
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_tagsTable__WEBPACK_IMPORTED_MODULE_21__.TagsTable, {
              generateUrl: this.generateTagUrl,
              event: event,
              query: eventView.query
            })]
          })]
        })]
      });
    };

    const hasQuickTraceView = organization.features.includes('performance-view');

    if (hasQuickTraceView) {
      var _event$contexts$trace, _event$contexts, _event$contexts$trace2;

      const traceId = (_event$contexts$trace = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace2 = _event$contexts.trace) === null || _event$contexts$trace2 === void 0 ? void 0 : _event$contexts$trace2.trace_id) !== null && _event$contexts$trace !== void 0 ? _event$contexts$trace : '';
      const {
        start,
        end
      } = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_33__.getTraceTimeRangeFromEvent)(event);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_quickTrace_traceMetaQuery__WEBPACK_IMPORTED_MODULE_32__["default"], {
        location: location,
        orgSlug: organization.slug,
        traceId: traceId,
        start: start,
        end: end,
        children: metaResults => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_31__["default"], {
          event: event,
          location: location,
          orgSlug: organization.slug,
          children: results => renderContent(results, metaResults)
        })
      });
    }

    return renderContent();
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(resp => resp && resp.status === 404);
    const permissionDenied = Object.values(this.state.errors).find(resp => resp && resp.status === 403);

    if (notFound) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    }

    if (permissionDenied) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_18__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_23__.t)('You do not have permission to view that event.')
      });
    }

    return super.renderError(error, true);
  }

  renderComponent() {
    const {
      eventView,
      organization
    } = this.props;
    const {
      event
    } = this.state;
    const eventSlug = this.getEventSlug();
    const projectSlug = eventSlug.split(':')[0];
    const title = (0,_utils__WEBPACK_IMPORTED_MODULE_38__.generateTitle)({
      eventView,
      event,
      organization
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_20__["default"], {
      title: title,
      orgSlug: organization.slug,
      projectSlug: projectSlug,
      children: super.renderComponent()
    });
  }

}

const EventHeader = _ref3 => {
  let {
    event
  } = _ref3;
  const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_29__.getMessage)(event);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsxs)(EventHeaderContainer, {
    "data-test-id": "event-header",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(TitleWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
        data: event
      })
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(MessageWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_40__.jsx)(sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_13__["default"], {
        message: message
      })
    })]
  });
};

EventHeader.displayName = "EventHeader";

const EventHeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eis1z1e2"
} : 0)("max-width:", p => p.theme.breakpoints.small, ";" + ( true ? "" : 0));

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eis1z1e1"
} : 0)("font-size:", p => p.theme.headerFontSize, ";margin-top:20px;" + ( true ? "" : 0));

const MessageWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eis1z1e0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_24__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventDetailsContent);

/***/ }),

/***/ "./app/views/eventsV2/eventDetails/index.tsx":
/*!***************************************************!*\
  !*** ./app/views/eventsV2/eventDetails/index.tsx ***!
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./content */ "./app/views/eventsV2/eventDetails/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











class EventDetails extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getEventSlug", () => {
      const {
        eventSlug
      } = this.props.params;

      if (typeof eventSlug === 'string') {
        return eventSlug.trim();
      }

      return '';
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getEventView", () => {
      const {
        location
      } = this.props;
      return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromLocation(location);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDocumentTitle", name => typeof name === 'string' && String(name).trim().length > 0 ? [String(name).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Discover')] : [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Discover')]);
  }

  render() {
    const {
      organization,
      location,
      params,
      router,
      route
    } = this.props;
    const eventView = this.getEventView();
    const eventSlug = this.getEventSlug();
    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');
    const projectSlug = eventSlug.split(':')[0];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: documentTitle,
      orgSlug: organization.slug,
      projectSlug: projectSlug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledPageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_4__["default"], {
          organization: organization,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_content__WEBPACK_IMPORTED_MODULE_10__["default"], {
            organization: organization,
            location: location,
            params: params,
            eventView: eventView,
            eventSlug: eventSlug,
            router: router,
            route: route
          })
        })
      })
    });
  }

}

EventDetails.displayName = "EventDetails";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(EventDetails));

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__.PageContent,  true ? {
  target: "e1nc8qts0"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

/***/ }),

/***/ "./app/views/eventsV2/eventDetails/linkedIssue.tsx":
/*!*********************************************************!*\
  !*** ./app/views/eventsV2/eventDetails/linkedIssue.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_group_times__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/group/times */ "./app/components/group/times.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_seenByList__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/seenByList */ "./app/components/seenByList.tsx");
/* harmony import */ var sentry_components_shortId__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/shortId */ "./app/components/shortId.tsx");
/* harmony import */ var sentry_components_stream_groupChart__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/stream/groupChart */ "./app/components/stream/groupChart.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class LinkedIssue extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_2__["default"] {
  getEndpoints() {
    const {
      groupId
    } = this.props;
    const groupUrl = `/issues/${groupId}/`;
    return [['group', groupUrl]];
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
      height: "120px",
      bottomGutter: 2
    });
  }

  renderError(error) {
    let disableLog = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const {
      errors
    } = this.state;
    const hasNotFound = Object.values(errors).find(resp => resp && resp.status === 404);

    if (hasNotFound) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
        type: "warning",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The linked issue cannot be found. It may have been deleted, or merged.')
      });
    }

    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {
      eventId
    } = this.props;
    const {
      group
    } = this.state;
    const issueUrl = `${group.permalink}events/${eventId}/`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Section, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Event Issue')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(StyledIssueCard, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(IssueCardHeader, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledLink, {
            to: issueUrl,
            "data-test-id": "linked-issue",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledShortId, {
              shortId: group.shortId,
              avatar: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
                project: group.project,
                avatarSize: 16,
                hideName: true,
                disableLink: true
              })
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledSeenByList, {
            seenBy: group.seenBy,
            maxVisibleAvatars: 5
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(IssueCardBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_stream_groupChart__WEBPACK_IMPORTED_MODULE_10__["default"], {
            statsPeriod: "30d",
            data: group,
            height: 56
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(IssueCardFooter, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_group_times__WEBPACK_IMPORTED_MODULE_4__["default"], {
            lastSeen: group.lastSeen,
            firstSeen: group.firstSeen
          })
        })]
      })]
    });
  }

}

const Section = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wtoeov7"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";" + ( true ? "" : 0));

const StyledIssueCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wtoeov6"
} : 0)("border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const IssueCardHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wtoeov5"
} : 0)("display:flex;align-items:center;justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1wtoeov4"
} : 0)( true ? {
  name: "11g6mpt",
  styles: "justify-content:flex-start"
} : 0);

const IssueCardBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wtoeov3"
} : 0)("background:", p => p.theme.backgroundSecondary, ";padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const StyledSeenByList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_seenByList__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1wtoeov2"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const StyledShortId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_shortId__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1wtoeov1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const IssueCardFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1wtoeov0"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeSmall, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LinkedIssue);

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
//# sourceMappingURL=../sourcemaps/app_utils_discover_charts_tsx-app_utils_performance_histogram_utils_tsx-app_views_eventsV2_ev-2aa76a.b757f1b1f9d5e10a0f56a86d9539ca37.js.map