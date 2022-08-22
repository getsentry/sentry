"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_discover_genericDiscoverQuery_tsx-app_views_performance_traceDetails_utils_tsx"],{

/***/ "./app/components/events/interfaces/spans/constants.tsx":
/*!**************************************************************!*\
  !*** ./app/components/events/interfaces/spans/constants.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MERGE_LABELS_THRESHOLD_PERCENT": () => (/* binding */ MERGE_LABELS_THRESHOLD_PERCENT),
/* harmony export */   "MINIMAP_CONTAINER_HEIGHT": () => (/* binding */ MINIMAP_CONTAINER_HEIGHT),
/* harmony export */   "MINIMAP_HEIGHT": () => (/* binding */ MINIMAP_HEIGHT),
/* harmony export */   "MINIMAP_SPAN_BAR_HEIGHT": () => (/* binding */ MINIMAP_SPAN_BAR_HEIGHT),
/* harmony export */   "NUM_OF_SPANS_FIT_IN_MINI_MAP": () => (/* binding */ NUM_OF_SPANS_FIT_IN_MINI_MAP),
/* harmony export */   "TIME_AXIS_HEIGHT": () => (/* binding */ TIME_AXIS_HEIGHT),
/* harmony export */   "VIEW_HANDLE_HEIGHT": () => (/* binding */ VIEW_HANDLE_HEIGHT)
/* harmony export */ });
const MINIMAP_HEIGHT = 120;
const MINIMAP_SPAN_BAR_HEIGHT = 4;
const NUM_OF_SPANS_FIT_IN_MINI_MAP = MINIMAP_HEIGHT / MINIMAP_SPAN_BAR_HEIGHT;
const TIME_AXIS_HEIGHT = 20;
const SECONDARY_HEADER_HEIGHT = 20;
const MINIMAP_CONTAINER_HEIGHT = MINIMAP_HEIGHT + TIME_AXIS_HEIGHT + SECONDARY_HEADER_HEIGHT + 1;
const VIEW_HANDLE_HEIGHT = 18;
const MERGE_LABELS_THRESHOLD_PERCENT = 10;

/***/ }),

/***/ "./app/components/events/interfaces/spans/utils.tsx":
/*!**********************************************************!*\
  !*** ./app/components/events/interfaces/spans/utils.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SpansInViewMap": () => (/* binding */ SpansInViewMap),
/* harmony export */   "TimestampStatus": () => (/* binding */ TimestampStatus),
/* harmony export */   "boundsGenerator": () => (/* binding */ boundsGenerator),
/* harmony export */   "durationlessBrowserOps": () => (/* binding */ durationlessBrowserOps),
/* harmony export */   "generateRootSpan": () => (/* binding */ generateRootSpan),
/* harmony export */   "getCumulativeAlertLevelFromErrors": () => (/* binding */ getCumulativeAlertLevelFromErrors),
/* harmony export */   "getMeasurementBounds": () => (/* binding */ getMeasurementBounds),
/* harmony export */   "getMeasurements": () => (/* binding */ getMeasurements),
/* harmony export */   "getSiblingGroupKey": () => (/* binding */ getSiblingGroupKey),
/* harmony export */   "getSpanGroupBounds": () => (/* binding */ getSpanGroupBounds),
/* harmony export */   "getSpanGroupTimestamps": () => (/* binding */ getSpanGroupTimestamps),
/* harmony export */   "getSpanID": () => (/* binding */ getSpanID),
/* harmony export */   "getSpanOperation": () => (/* binding */ getSpanOperation),
/* harmony export */   "getSpanParentSpanID": () => (/* binding */ getSpanParentSpanID),
/* harmony export */   "getSpanTraceID": () => (/* binding */ getSpanTraceID),
/* harmony export */   "getTraceContext": () => (/* binding */ getTraceContext),
/* harmony export */   "getTraceDateTimeRange": () => (/* binding */ getTraceDateTimeRange),
/* harmony export */   "isEventFromBrowserJavaScriptSDK": () => (/* binding */ isEventFromBrowserJavaScriptSDK),
/* harmony export */   "isGapSpan": () => (/* binding */ isGapSpan),
/* harmony export */   "isOrphanSpan": () => (/* binding */ isOrphanSpan),
/* harmony export */   "isOrphanTreeDepth": () => (/* binding */ isOrphanTreeDepth),
/* harmony export */   "isSpanIdFocused": () => (/* binding */ isSpanIdFocused),
/* harmony export */   "isValidSpanID": () => (/* binding */ isValidSpanID),
/* harmony export */   "parseSpanTimestamps": () => (/* binding */ parseSpanTimestamps),
/* harmony export */   "parseTrace": () => (/* binding */ parseTrace),
/* harmony export */   "scrollToSpan": () => (/* binding */ scrollToSpan),
/* harmony export */   "setSpansOnTransaction": () => (/* binding */ setSpansOnTransaction),
/* harmony export */   "spanTargetHash": () => (/* binding */ spanTargetHash),
/* harmony export */   "unwrapTreeDepth": () => (/* binding */ unwrapTreeDepth)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isNumber */ "../node_modules/lodash/isNumber.js");
/* harmony import */ var lodash_isNumber__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isNumber__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isString */ "../node_modules/lodash/isString.js");
/* harmony import */ var lodash_isString__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isString__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_maxBy__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/maxBy */ "../node_modules/lodash/maxBy.js");
/* harmony import */ var lodash_maxBy__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_maxBy__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/performance/waterfall/treeConnector */ "./app/components/performance/waterfall/treeConnector.tsx");
/* harmony import */ var sentry_types_event__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types/event */ "./app/types/event.tsx");
/* harmony import */ var sentry_types_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types/utils */ "./app/types/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/performanceForSentry */ "./app/utils/performanceForSentry.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./constants */ "./app/components/events/interfaces/spans/constants.tsx");

















const isValidSpanID = maybeSpanID => lodash_isString__WEBPACK_IMPORTED_MODULE_5___default()(maybeSpanID) && maybeSpanID.length > 0;
const setSpansOnTransaction = spanCount => {
  const transaction = (0,sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_15__.getPerformanceTransaction)();

  if (!transaction || spanCount === 0) {
    return;
  }

  const spanCountGroups = [10, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1001];
  const spanGroup = spanCountGroups.find(g => spanCount <= g) || -1;
  transaction.setTag('ui.spanCount', spanCount);
  transaction.setTag('ui.spanCount.grouped', `<=${spanGroup}`);
};

const normalizeTimestamps = spanBounds => {
  const {
    startTimestamp,
    endTimestamp
  } = spanBounds;

  if (startTimestamp > endTimestamp) {
    return {
      startTimestamp: endTimestamp,
      endTimestamp: startTimestamp
    };
  }

  return spanBounds;
};

let TimestampStatus;

(function (TimestampStatus) {
  TimestampStatus[TimestampStatus["Stable"] = 0] = "Stable";
  TimestampStatus[TimestampStatus["Reversed"] = 1] = "Reversed";
  TimestampStatus[TimestampStatus["Equal"] = 2] = "Equal";
})(TimestampStatus || (TimestampStatus = {}));

const parseSpanTimestamps = spanBounds => {
  const startTimestamp = spanBounds.startTimestamp;
  const endTimestamp = spanBounds.endTimestamp;

  if (startTimestamp < endTimestamp) {
    return TimestampStatus.Stable;
  }

  if (startTimestamp === endTimestamp) {
    return TimestampStatus.Equal;
  }

  return TimestampStatus.Reversed;
}; // given the start and end trace timestamps, and the view window, we want to generate a function
// that'll output the relative %'s for the width and placements relative to the left-hand side.
//
// The view window (viewStart and viewEnd) are percentage values (between 0% and 100%), they correspond to the window placement
// between the start and end trace timestamps.

const boundsGenerator = bounds => {
  const {
    viewStart,
    viewEnd
  } = bounds;
  const {
    startTimestamp: traceStartTimestamp,
    endTimestamp: traceEndTimestamp
  } = normalizeTimestamps({
    startTimestamp: bounds.traceStartTimestamp,
    endTimestamp: bounds.traceEndTimestamp
  }); // viewStart and viewEnd are percentage values (%) of the view window relative to the left
  // side of the trace view minimap
  // invariant: viewStart <= viewEnd
  // duration of the entire trace in seconds

  const traceDuration = traceEndTimestamp - traceStartTimestamp;
  const viewStartTimestamp = traceStartTimestamp + viewStart * traceDuration;
  const viewEndTimestamp = traceEndTimestamp - (1 - viewEnd) * traceDuration;
  const viewDuration = viewEndTimestamp - viewStartTimestamp;
  return spanBounds => {
    // TODO: alberto.... refactor so this is impossible 😠
    if (traceDuration <= 0) {
      return {
        type: 'TRACE_TIMESTAMPS_EQUAL',
        isSpanVisibleInView: true
      };
    }

    if (viewDuration <= 0) {
      return {
        type: 'INVALID_VIEW_WINDOW',
        isSpanVisibleInView: true
      };
    }

    const {
      startTimestamp,
      endTimestamp
    } = normalizeTimestamps(spanBounds);
    const timestampStatus = parseSpanTimestamps(spanBounds);
    const start = (startTimestamp - viewStartTimestamp) / viewDuration;
    const end = (endTimestamp - viewStartTimestamp) / viewDuration;
    const isSpanVisibleInView = end > 0 && start < 1;

    switch (timestampStatus) {
      case TimestampStatus.Equal:
        {
          return {
            type: 'TIMESTAMPS_EQUAL',
            start,
            width: 1,
            // a span bar is visible even if they're at the extreme ends of the view selection.
            // these edge cases are:
            // start == end == 0, and
            // start == end == 1
            isSpanVisibleInView: end >= 0 && start <= 1
          };
        }

      case TimestampStatus.Reversed:
        {
          return {
            type: 'TIMESTAMPS_REVERSED',
            start,
            end,
            isSpanVisibleInView
          };
        }

      case TimestampStatus.Stable:
        {
          return {
            type: 'TIMESTAMPS_STABLE',
            start,
            end,
            isSpanVisibleInView
          };
        }

      default:
        {
          const _exhaustiveCheck = timestampStatus;
          return _exhaustiveCheck;
        }
    }
  };
};
function generateRootSpan(trace) {
  const rootSpan = {
    trace_id: trace.traceID,
    span_id: trace.rootSpanID,
    parent_span_id: trace.parentSpanID,
    start_timestamp: trace.traceStartTimestamp,
    timestamp: trace.traceEndTimestamp,
    op: trace.op,
    description: trace.description,
    data: {},
    status: trace.rootSpanStatus,
    hash: trace.hash,
    exclusive_time: trace.exclusiveTime
  };
  return rootSpan;
} // start and end are assumed to be unix timestamps with fractional seconds

function getTraceDateTimeRange(input) {
  const start = moment__WEBPACK_IMPORTED_MODULE_8___default().unix(input.start).subtract(12, 'hours').utc().format('YYYY-MM-DDTHH:mm:ss.SSS');
  const end = moment__WEBPACK_IMPORTED_MODULE_8___default().unix(input.end).add(12, 'hours').utc().format('YYYY-MM-DDTHH:mm:ss.SSS');
  return {
    start,
    end
  };
}
function isGapSpan(span) {
  if ('type' in span) {
    return span.type === 'gap';
  }

  return false;
}
function isOrphanSpan(span) {
  if ('type' in span) {
    if (span.type === 'orphan') {
      return true;
    }

    if (span.type === 'gap') {
      return span.isOrphan;
    }
  }

  return false;
}
function getSpanID(span) {
  let defaultSpanID = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  if (isGapSpan(span)) {
    return defaultSpanID;
  }

  return span.span_id;
}
function getSpanOperation(span) {
  if (isGapSpan(span)) {
    return undefined;
  }

  return span.op;
}
function getSpanTraceID(span) {
  if (isGapSpan(span)) {
    return 'gap-span';
  }

  return span.trace_id;
}
function getSpanParentSpanID(span) {
  if (isGapSpan(span)) {
    return 'gap-span';
  }

  return span.parent_span_id;
}
function getTraceContext(event) {
  var _event$contexts;

  return event === null || event === void 0 ? void 0 : (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : _event$contexts.trace;
}
function parseTrace(event) {
  var _spanEntry$data;

  const spanEntry = event.entries.find(entry => {
    return entry.type === sentry_types_event__WEBPACK_IMPORTED_MODULE_10__.EntryType.SPANS;
  });
  const spans = (_spanEntry$data = spanEntry === null || spanEntry === void 0 ? void 0 : spanEntry.data) !== null && _spanEntry$data !== void 0 ? _spanEntry$data : [];
  const traceContext = getTraceContext(event);
  const traceID = traceContext && traceContext.trace_id || '';
  const rootSpanID = traceContext && traceContext.span_id || '';
  const rootSpanOpName = traceContext && traceContext.op || 'transaction';
  const description = traceContext && traceContext.description;
  const parentSpanID = traceContext && traceContext.parent_span_id;
  const rootSpanStatus = traceContext && traceContext.status;
  const hash = traceContext && traceContext.hash;
  const exclusiveTime = traceContext && traceContext.exclusive_time;

  if (!spanEntry || spans.length <= 0) {
    return {
      op: rootSpanOpName,
      childSpans: {},
      traceStartTimestamp: event.startTimestamp,
      traceEndTimestamp: event.endTimestamp,
      traceID,
      rootSpanID,
      rootSpanStatus,
      parentSpanID,
      spans: [],
      description,
      hash,
      exclusiveTime
    };
  } // any span may be a parent of another span


  const potentialParents = new Set(spans.map(span => {
    return span.span_id;
  })); // the root transaction span is a parent of all other spans

  potentialParents.add(rootSpanID); // we reduce spans to become an object mapping span ids to their children

  const init = {
    op: rootSpanOpName,
    childSpans: {},
    traceStartTimestamp: event.startTimestamp,
    traceEndTimestamp: event.endTimestamp,
    traceID,
    rootSpanID,
    rootSpanStatus,
    parentSpanID,
    spans,
    description,
    hash,
    exclusiveTime
  };
  const reduced = spans.reduce((acc, inputSpan) => {
    var _acc$childSpans$span$;

    let span = inputSpan;
    const parentSpanId = getSpanParentSpanID(span);
    const hasParent = parentSpanId && potentialParents.has(parentSpanId);

    if (!isValidSpanID(parentSpanId) || !hasParent) {
      // this span is considered an orphan with respect to the spans within this transaction.
      // although the span is an orphan, it's still a descendant of this transaction,
      // so we set its parent span id to be the root transaction span's id
      span.parent_span_id = rootSpanID;
      span = {
        type: 'orphan',
        ...span
      };
    }

    (0,sentry_types_utils__WEBPACK_IMPORTED_MODULE_11__.assert)(span.parent_span_id); // get any span children whose parent_span_id is equal to span.parent_span_id,
    // otherwise start with an empty array

    const spanChildren = (_acc$childSpans$span$ = acc.childSpans[span.parent_span_id]) !== null && _acc$childSpans$span$ !== void 0 ? _acc$childSpans$span$ : [];
    spanChildren.push(span);
    lodash_set__WEBPACK_IMPORTED_MODULE_7___default()(acc.childSpans, span.parent_span_id, spanChildren); // set trace start & end timestamps based on given span's start and end timestamps

    if (!acc.traceStartTimestamp || span.start_timestamp < acc.traceStartTimestamp) {
      acc.traceStartTimestamp = span.start_timestamp;
    } // establish trace end timestamp


    const hasEndTimestamp = lodash_isNumber__WEBPACK_IMPORTED_MODULE_4___default()(span.timestamp);

    if (!acc.traceEndTimestamp) {
      if (hasEndTimestamp) {
        acc.traceEndTimestamp = span.timestamp;
        return acc;
      }

      acc.traceEndTimestamp = span.start_timestamp;
      return acc;
    }

    if (hasEndTimestamp && span.timestamp > acc.traceEndTimestamp) {
      acc.traceEndTimestamp = span.timestamp;
      return acc;
    }

    if (span.start_timestamp > acc.traceEndTimestamp) {
      acc.traceEndTimestamp = span.start_timestamp;
    }

    return acc;
  }, init); // sort span children

  Object.values(reduced.childSpans).forEach(spanChildren => {
    spanChildren.sort(sortSpans);
  });
  return reduced;
}

function sortSpans(firstSpan, secondSpan) {
  // orphan spans come after non-orphan spans.
  if (isOrphanSpan(firstSpan) && !isOrphanSpan(secondSpan)) {
    // sort secondSpan before firstSpan
    return 1;
  }

  if (!isOrphanSpan(firstSpan) && isOrphanSpan(secondSpan)) {
    // sort firstSpan before secondSpan
    return -1;
  } // sort spans by their start timestamp in ascending order


  if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
    // sort firstSpan before secondSpan
    return -1;
  }

  if (firstSpan.start_timestamp === secondSpan.start_timestamp) {
    return 0;
  } // sort secondSpan before firstSpan


  return 1;
}

function isOrphanTreeDepth(treeDepth) {
  if (typeof treeDepth === 'number') {
    return false;
  }

  return (treeDepth === null || treeDepth === void 0 ? void 0 : treeDepth.type) === 'orphan';
}
function unwrapTreeDepth(treeDepth) {
  if (isOrphanTreeDepth(treeDepth)) {
    return treeDepth.depth;
  }

  return treeDepth;
}
function isEventFromBrowserJavaScriptSDK(event) {
  var _event$sdk;

  const sdkName = (_event$sdk = event.sdk) === null || _event$sdk === void 0 ? void 0 : _event$sdk.name;

  if (!sdkName) {
    return false;
  } // based on https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/version.ts


  return ['sentry.javascript.browser', 'sentry.javascript.react', 'sentry.javascript.gatsby', 'sentry.javascript.ember', 'sentry.javascript.vue', 'sentry.javascript.angular', 'sentry.javascript.nextjs', 'sentry.javascript.electron', 'sentry.javascript.remix'].includes(sdkName.toLowerCase());
} // Durationless ops from: https://github.com/getsentry/sentry-javascript/blob/0defcdcc2dfe719343efc359d58c3f90743da2cd/packages/apm/src/integrations/tracing.ts#L629-L688
// PerformanceMark: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark
// PerformancePaintTiming: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming

const durationlessBrowserOps = ['mark', 'paint'];

function hasFailedThreshold(marks) {
  const names = Object.keys(marks);
  const records = Object.values(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.WEB_VITAL_DETAILS).filter(vital => names.includes(vital.slug));
  return records.some(record => {
    const {
      value
    } = marks[record.slug];

    if (typeof value === 'number' && typeof record.poorThreshold === 'number') {
      return value >= record.poorThreshold;
    }

    return false;
  });
}

function getMeasurements(event, generateBounds) {
  if (!event.measurements || !event.startTimestamp) {
    return new Map();
  }

  const {
    startTimestamp
  } = event; // Note: CLS and INP should not be included here, since they are not timeline-based measurements.

  const allowedVitals = new Set([sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.FP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.FID, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.LCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.TTFB]);
  const measurements = Object.keys(event.measurements).filter(name => allowedVitals.has(`measurements.${name}`)).map(name => {
    const associatedMeasurement = event.measurements[name];
    return {
      name,
      // Time timestamp is in seconds, but the measurement value is given in ms so convert it here
      timestamp: startTimestamp + associatedMeasurement.value / 1000,
      value: associatedMeasurement ? associatedMeasurement.value : undefined
    };
  });
  const mergedMeasurements = new Map();
  measurements.forEach(measurement => {
    const name = measurement.name;
    const value = measurement.value;
    const bounds = generateBounds({
      startTimestamp: measurement.timestamp,
      endTimestamp: measurement.timestamp
    }); // This condition will never be hit, since we're using the same value for start and end in generateBounds
    // I've put this condition here to prevent the TS linter from complaining

    if (bounds.type !== 'TIMESTAMPS_EQUAL') {
      return;
    }

    const roundedPos = Math.round(bounds.start * 100); // Compare this position with the position of the other measurements, to determine if
    // they are close enough to be bucketed together

    for (const [otherPos] of mergedMeasurements) {
      const positionDelta = Math.abs(otherPos - roundedPos);

      if (positionDelta <= _constants__WEBPACK_IMPORTED_MODULE_16__.MERGE_LABELS_THRESHOLD_PERCENT) {
        const verticalMark = mergedMeasurements.get(otherPos);
        const {
          poorThreshold
        } = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.WEB_VITAL_DETAILS[`measurements.${name}`];
        verticalMark.marks = { ...verticalMark.marks,
          [name]: {
            value,
            timestamp: measurement.timestamp,
            failedThreshold: value ? value >= poorThreshold : false
          }
        };

        if (!verticalMark.failedThreshold) {
          verticalMark.failedThreshold = hasFailedThreshold(verticalMark.marks);
        }

        mergedMeasurements.set(otherPos, verticalMark);
        return;
      }
    }

    const {
      poorThreshold
    } = sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.WEB_VITAL_DETAILS[`measurements.${name}`];
    const marks = {
      [name]: {
        value,
        timestamp: measurement.timestamp,
        failedThreshold: value ? value >= poorThreshold : false
      }
    };
    mergedMeasurements.set(roundedPos, {
      marks,
      failedThreshold: hasFailedThreshold(marks)
    });
  });
  return mergedMeasurements;
}
function getMeasurementBounds(timestamp, generateBounds) {
  const bounds = generateBounds({
    startTimestamp: timestamp,
    endTimestamp: timestamp
  });

  switch (bounds.type) {
    case 'TRACE_TIMESTAMPS_EQUAL':
    case 'INVALID_VIEW_WINDOW':
      {
        return {
          warning: undefined,
          left: undefined,
          width: undefined,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    case 'TIMESTAMPS_EQUAL':
      {
        return {
          warning: undefined,
          left: bounds.start,
          width: 0.00001,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    case 'TIMESTAMPS_REVERSED':
      {
        return {
          warning: undefined,
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    case 'TIMESTAMPS_STABLE':
      {
        return {
          warning: void 0,
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    default:
      {
        const _exhaustiveCheck = bounds;
        return _exhaustiveCheck;
      }
  }
}
function scrollToSpan(spanId, scrollToHash, location, organization) {
  return e => {
    // do not use the default anchor behaviour
    // because it will be hidden behind the minimap
    e.preventDefault();
    const hash = spanTargetHash(spanId);
    scrollToHash(hash); // TODO(txiao): This is causing a rerender of the whole page,
    // which can be slow.
    //
    // make sure to update the location

    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({ ...location,
      hash
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__["default"])('performance_views.event_details.anchor_span', {
      organization,
      span_id: spanId
    });
  };
}
function spanTargetHash(spanId) {
  return `#span-${spanId}`;
}
function getSiblingGroupKey(span, occurrence) {
  if (occurrence !== undefined) {
    return `${span.op}.${span.description}.${occurrence}`;
  }

  return `${span.op}.${span.description}`;
}
function getSpanGroupTimestamps(spanGroup) {
  return spanGroup.reduce((acc, spanGroupItem) => {
    const {
      start_timestamp,
      timestamp
    } = spanGroupItem.span;
    let newStartTimestamp = acc.startTimestamp;
    let newEndTimestamp = acc.endTimestamp;

    if (start_timestamp < newStartTimestamp) {
      newStartTimestamp = start_timestamp;
    }

    if (newEndTimestamp < timestamp) {
      newEndTimestamp = timestamp;
    }

    return {
      startTimestamp: newStartTimestamp,
      endTimestamp: newEndTimestamp
    };
  }, {
    startTimestamp: spanGroup[0].span.start_timestamp,
    endTimestamp: spanGroup[0].span.timestamp
  });
}
function getSpanGroupBounds(spanGroup, generateBounds) {
  const {
    startTimestamp,
    endTimestamp
  } = getSpanGroupTimestamps(spanGroup);
  const bounds = generateBounds({
    startTimestamp,
    endTimestamp
  });

  switch (bounds.type) {
    case 'TRACE_TIMESTAMPS_EQUAL':
    case 'INVALID_VIEW_WINDOW':
      {
        return {
          warning: void 0,
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    case 'TIMESTAMPS_EQUAL':
      {
        return {
          warning: void 0,
          left: bounds.start,
          width: 0.00001,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    case 'TIMESTAMPS_REVERSED':
    case 'TIMESTAMPS_STABLE':
      {
        return {
          warning: void 0,
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView
        };
      }

    default:
      {
        const _exhaustiveCheck = bounds;
        return _exhaustiveCheck;
      }
  }
}
class SpansInViewMap {
  constructor(isRootSpanInView) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "spanDepthsInView", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "treeDepthSum", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "length", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isRootSpanInView", void 0);

    this.spanDepthsInView = new Map();
    this.treeDepthSum = 0;
    this.length = 0;
    this.isRootSpanInView = isRootSpanInView;
  }
  /**
   *
   * @param spanId
   * @param treeDepth
   * @returns false if the span is already stored, true otherwise
   */


  addSpan(spanId, treeDepth) {
    if (this.spanDepthsInView.has(spanId)) {
      return false;
    }

    this.spanDepthsInView.set(spanId, treeDepth);
    this.length += 1;
    this.treeDepthSum += treeDepth;

    if (treeDepth === 0) {
      this.isRootSpanInView = true;
    }

    return true;
  }
  /**
   *
   * @param spanId
   * @returns false if the span does not exist within the span, true otherwise
   */


  removeSpan(spanId) {
    if (!this.spanDepthsInView.has(spanId)) {
      return false;
    }

    const treeDepth = this.spanDepthsInView.get(spanId);
    this.spanDepthsInView.delete(spanId);
    this.length -= 1;
    this.treeDepthSum -= treeDepth;

    if (treeDepth === 0) {
      this.isRootSpanInView = false;
    }

    return true;
  }

  has(spanId) {
    return this.spanDepthsInView.has(spanId);
  }

  getScrollVal() {
    if (this.isRootSpanInView) {
      return 0;
    }

    const avgDepth = Math.round(this.treeDepthSum / this.length);
    return avgDepth * (sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_9__.TOGGLE_BORDER_BOX / 2) - sentry_components_performance_waterfall_treeConnector__WEBPACK_IMPORTED_MODULE_9__.TOGGLE_BUTTON_MAX_WIDTH / 2;
  }

}
function isSpanIdFocused(spanId, focusedSpanIds) {
  return spanId in focusedSpanIds || Object.values(focusedSpanIds).some(relatedSpans => relatedSpans.has(spanId));
}
function getCumulativeAlertLevelFromErrors(errors) {
  var _maxBy;

  const highestErrorLevel = (_maxBy = lodash_maxBy__WEBPACK_IMPORTED_MODULE_6___default()(errors || [], error => ERROR_LEVEL_WEIGHTS[error.level])) === null || _maxBy === void 0 ? void 0 : _maxBy.level;

  if (!highestErrorLevel) {
    return undefined;
  }

  return ERROR_LEVEL_TO_ALERT_TYPE[highestErrorLevel];
} // Maps the six known error levels to one of three Alert component types

const ERROR_LEVEL_TO_ALERT_TYPE = {
  fatal: 'error',
  error: 'error',
  default: 'error',
  warning: 'warning',
  sample: 'info',
  info: 'info'
}; // Allows sorting errors according to their level of severity

const ERROR_LEVEL_WEIGHTS = {
  fatal: 5,
  error: 4,
  default: 4,
  warning: 3,
  sample: 2,
  info: 1
};

/***/ }),

/***/ "./app/components/performance/waterfall/treeConnector.tsx":
/*!****************************************************************!*\
  !*** ./app/components/performance/waterfall/treeConnector.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ConnectorBar": () => (/* binding */ ConnectorBar),
/* harmony export */   "TOGGLE_BORDER_BOX": () => (/* binding */ TOGGLE_BORDER_BOX),
/* harmony export */   "TOGGLE_BUTTON_MAX_WIDTH": () => (/* binding */ TOGGLE_BUTTON_MAX_WIDTH),
/* harmony export */   "TreeConnector": () => (/* binding */ TreeConnector),
/* harmony export */   "TreeToggle": () => (/* binding */ TreeToggle),
/* harmony export */   "TreeToggleContainer": () => (/* binding */ TreeToggleContainer),
/* harmony export */   "TreeToggleIcon": () => (/* binding */ TreeToggleIcon)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/performance/waterfall/constants */ "./app/components/performance/waterfall/constants.tsx");
/* harmony import */ var sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/performance/waterfall/utils */ "./app/components/performance/waterfall/utils.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");





const TOGGLE_BUTTON_MARGIN_RIGHT = 16;
const TOGGLE_BUTTON_MAX_WIDTH = 30;
const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;
const TREE_TOGGLE_CONTAINER_WIDTH = 40;
const ConnectorBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xp7sks4"
} : 0)("height:250%;border-left:2px ", p => p.orphanBranch ? 'dashed' : 'solid', " ", p => p.theme.border, ";position:absolute;top:0;" + ( true ? "" : 0));
const TreeConnector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xp7sks3"
} : 0)("height:", p => p.isLast ? sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT / 2 + 1 : sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;width:100%;border-left:", p => `2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};`, ";position:absolute;top:0;", p => p.isLast ? `
      border-bottom: 2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};
      border-bottom-left-radius: ${p.theme.borderRadius};` : `
      &:before {
        content: '';
        height: 2px;
        left: -2px;
        border-bottom: 2px ${p.orphanBranch ? 'dashed' : 'solid'} ${p.theme.border};
        width: calc(100% - 2px);
        position: absolute;
        bottom: calc(50% - 1px);
      }`, " &:after{content:'';background-color:", p => p.theme.border, ";border-radius:50%;height:6px;width:6px;position:absolute;right:0;top:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT / 2 - 3, "px;}" + ( true ? "" : 0));
const TreeToggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xp7sks2"
} : 0)("height:16px;white-space:nowrap;min-width:30px;display:flex;align-items:center;justify-content:center;border-radius:99px;padding:0px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.5), ";transition:all 0.15s ease-in-out;font-size:10px;line-height:0;z-index:1;box-shadow:", p => p.theme.dropShadowLightest, ";", p => (0,sentry_components_performance_waterfall_utils__WEBPACK_IMPORTED_MODULE_2__.getToggleTheme)(p), ";" + ( true ? "" : 0));
const TreeToggleContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xp7sks1"
} : 0)("position:relative;height:", sentry_components_performance_waterfall_constants__WEBPACK_IMPORTED_MODULE_1__.ROW_HEIGHT, "px;width:", TREE_TOGGLE_CONTAINER_WIDTH, "px;min-width:", TREE_TOGGLE_CONTAINER_WIDTH, "px;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";z-index:", p => p.theme.zIndex.traceView.spanTreeToggler, ";display:flex;justify-content:flex-end;align-items:center;" + ( true ? "" : 0));
const TreeToggleIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconChevron,  true ? {
  target: "e1xp7sks0"
} : 0)("width:7px;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(0.25), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/discover/genericDiscoverQuery.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/discover/genericDiscoverQuery.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/utils/performance/contexts/performanceEventViewContext.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/contexts/performanceEventViewContext.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/utils/performance/quickTrace/utils.tsx":
/*!****************************************************!*\
  !*** ./app/utils/performance/quickTrace/utils.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "filterTrace": () => (/* binding */ filterTrace),
/* harmony export */   "flattenRelevantPaths": () => (/* binding */ flattenRelevantPaths),
/* harmony export */   "getTraceRequestPayload": () => (/* binding */ getTraceRequestPayload),
/* harmony export */   "getTraceTimeRangeFromEvent": () => (/* binding */ getTraceTimeRangeFromEvent),
/* harmony export */   "isCurrentEvent": () => (/* binding */ isCurrentEvent),
/* harmony export */   "isTraceFull": () => (/* binding */ isTraceFull),
/* harmony export */   "isTraceFullDetailed": () => (/* binding */ isTraceFullDetailed),
/* harmony export */   "isTransaction": () => (/* binding */ isTransaction),
/* harmony export */   "makeEventView": () => (/* binding */ makeEventView),
/* harmony export */   "parseQuickTrace": () => (/* binding */ parseQuickTrace),
/* harmony export */   "reduceTrace": () => (/* binding */ reduceTrace)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/utils */ "./app/components/events/interfaces/spans/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");








function isTransaction(event) {
  return event.type === 'transaction';
}
/**
 * An event can be an error or a transaction. We need to check whether the current
 * event id is in the list of errors as well
 */

function isCurrentEvent(event, currentEvent) {
  if (isTransaction(currentEvent)) {
    return event.event_id === currentEvent.id;
  }

  return event.errors !== undefined && event.errors.some(e => e.event_id === currentEvent.id);
}

/**
 * The `events-full` endpoint returns the full trace containing the specified event.
 * This means any sibling paths in the trace will also be returned.
 *
 * This method strips away these sibling paths leaving only the path from the root to
 * the specified event and all of its children/descendants.
 *
 * This method additionally flattens the trace into an array of the transactions in
 * the trace.
 */
function flattenRelevantPaths(currentEvent, traceFull) {
  const relevantPath = [];
  const events = [];
  /**
   * First find a path from the root transaction to the current transaction via
   * a breadth first search. This adds all transactions from the root to the
   * current transaction (excluding the current transaction itself), to the
   * relevant path.
   */

  const paths = [{
    event: traceFull,
    path: []
  }];

  while (paths.length) {
    const current = paths.shift();

    if (isCurrentEvent(current.event, currentEvent)) {
      for (const node of current.path) {
        relevantPath.push(node);
      }

      events.push(current.event);
    } else {
      const path = [...current.path, simplifyEvent(current.event)];

      for (const child of current.event.children) {
        paths.push({
          event: child,
          path
        });
      }
    }
  }

  if (!events.length) {
    throw new Error('No relevant path exists!');
  }
  /**
   * Traverse all transactions from current transaction onwards and add
   * them all to the relevant path.
   */


  while (events.length) {
    const current = events.shift();

    for (const child of current.children) {
      events.push(child);
    }

    relevantPath.push(simplifyEvent(current));
  }

  return relevantPath;
}

function simplifyEvent(event) {
  return lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(event, ['children']);
}

function parseQuickTrace(quickTrace, event, organization) {
  var _trace$find, _trace$find2, _trace$find3;

  const {
    type,
    trace
  } = quickTrace;

  if (type === 'empty' || trace === null) {
    throw new Error('Current event not in trace navigator!');
  }

  const isFullTrace = type === 'full';
  const current = (_trace$find = trace.find(e => isCurrentEvent(e, event))) !== null && _trace$find !== void 0 ? _trace$find : null;

  if (current === null) {
    throw new Error('Current event not in trace navigator!');
  }
  /**
   * The parent event is the direct ancestor of the current event.
   * This takes priority over the root, meaning if the parent is
   * the root of the trace, this favours showing it as the parent.
   */


  const parent = current.parent_event_id ? (_trace$find2 = trace.find(e => e.event_id === current.parent_event_id)) !== null && _trace$find2 !== void 0 ? _trace$find2 : null : null;
  /**
   * The root event is the first event in the trace. This has lower priority
   * than the parent event, meaning if the root event is the parent event of
   * the current event, this favours showing it as the parent event.
   */

  const root = (_trace$find3 = trace.find(e => // a root can't be the current event
  e.event_id !== current.event_id && // a root can't be the direct parent
  e.event_id !== (parent === null || parent === void 0 ? void 0 : parent.event_id) && // a root has to to be the first generation
  e.generation === 0)) !== null && _trace$find3 !== void 0 ? _trace$find3 : null;

  const isChildren = e => e.parent_event_id === current.event_id;

  const isDescendant = e => // the current generation needs to be known to determine a descendant
  current.generation !== null && // the event's generation needs to be known to determine a descendant
  e.generation !== null && // a descendant is the generation after the direct children
  current.generation + 1 < e.generation;

  const isAncestor = e => // the current generation needs to be known to determine an ancestor
  current.generation !== null && // the event's generation needs to be known to determine an ancestor
  e.generation !== null && // an ancestor can't be the root
  e.generation > 0 && // an ancestor is the generation before the direct parent
  current.generation - 1 > e.generation;

  const ancestors = isFullTrace ? [] : null;
  const children = [];
  const descendants = isFullTrace ? [] : null;
  const projects = new Set();
  trace.forEach(e => {
    projects.add(e.project_id);

    if (isChildren(e)) {
      children.push(e);
    } else if (isFullTrace) {
      if (isAncestor(e)) {
        ancestors === null || ancestors === void 0 ? void 0 : ancestors.push(e);
      } else if (isDescendant(e)) {
        descendants === null || descendants === void 0 ? void 0 : descendants.push(e);
      }
    }
  });

  if (isFullTrace && projects.size > 1) {
    handleProjectMeta(organization, projects.size);
  }

  return {
    root,
    ancestors: ancestors === null ? null : sortTraceLite(ancestors),
    parent,
    current,
    children: sortTraceLite(children),
    descendants: descendants === null ? null : sortTraceLite(descendants)
  };
}

function sortTraceLite(trace) {
  return trace.sort((a, b) => b['transaction.duration'] - a['transaction.duration']);
}

function getTraceRequestPayload(_ref) {
  let {
    eventView,
    location
  } = _ref;
  return lodash_omit__WEBPACK_IMPORTED_MODULE_2___default()(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page']);
}
function makeEventView(_ref2) {
  let {
    start,
    end,
    statsPeriod
  } = _ref2;
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_7__["default"].fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    // This field doesn't actually do anything,
    // just here to satisfy a constraint in EventView.
    fields: ['transaction.duration'],
    projects: [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.ALL_ACCESS_PROJECTS],
    query: '',
    environment: [],
    start,
    end,
    range: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined
  });
}
function getTraceTimeRangeFromEvent(event) {
  const start = isTransaction(event) ? event.startTimestamp : moment_timezone__WEBPACK_IMPORTED_MODULE_3___default()(event.dateReceived ? event.dateReceived : event.dateCreated).valueOf() / 1000;
  const end = isTransaction(event) ? event.endTimestamp : start;
  return (0,sentry_components_events_interfaces_spans_utils__WEBPACK_IMPORTED_MODULE_4__.getTraceDateTimeRange)({
    start,
    end
  });
}
function reduceTrace(trace, visitor, initialValue) {
  let result = initialValue;
  const events = [trace];

  while (events.length) {
    const current = events.pop();

    for (const child of current.children) {
      events.push(child);
    }

    result = visitor(result, current);
  }

  return result;
}
function filterTrace(trace, predicate) {
  return reduceTrace(trace, (transactions, transaction) => {
    if (predicate(transaction)) {
      transactions.push(transaction);
    }

    return transactions;
  }, []);
}
function isTraceFull(transaction) {
  return Boolean(transaction.event_id);
}
function isTraceFullDetailed(transaction) {
  return Boolean(transaction.event_id);
}

function handleProjectMeta(organization, projects) {
  (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.trackAnalyticsEvent)({
    eventKey: 'quick_trace.connected_services',
    eventName: 'Quick Trace: Connected Services',
    organization_id: parseInt(organization.id, 10),
    projects
  });
}

/***/ }),

/***/ "./app/utils/performance/vitals/constants.tsx":
/*!****************************************************!*\
  !*** ./app/utils/performance/vitals/constants.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/performance/traceDetails/utils.tsx":
/*!******************************************************!*\
  !*** ./app/views/performance/traceDetails/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTraceDetailsUrl": () => (/* binding */ getTraceDetailsUrl),
/* harmony export */   "getTraceInfo": () => (/* binding */ getTraceInfo),
/* harmony export */   "isRootTransaction": () => (/* binding */ isRootTransaction)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");



function getTraceDetailsUrl(organization, traceSlug, dateSelection, query) {
  const {
    start,
    end,
    statsPeriod
  } = dateSelection;
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: { ...query,
      statsPeriod,
      [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_1__.PAGE_URL_PARAM.PAGE_START]: start,
      [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_1__.PAGE_URL_PARAM.PAGE_END]: end
    }
  };
}

function traceVisitor() {
  return (accumulator, event) => {
    for (const error of (_event$errors = event.errors) !== null && _event$errors !== void 0 ? _event$errors : []) {
      var _event$errors;

      accumulator.errors.add(error.event_id);
    }

    accumulator.transactions.add(event.event_id);
    accumulator.projects.add(event.project_slug);
    accumulator.startTimestamp = Math.min(accumulator.startTimestamp, event.start_timestamp);
    accumulator.endTimestamp = Math.max(accumulator.endTimestamp, event.timestamp);
    accumulator.maxGeneration = Math.max(accumulator.maxGeneration, event.generation);
    return accumulator;
  };
}

function getTraceInfo(traces) {
  const initial = {
    projects: new Set(),
    errors: new Set(),
    transactions: new Set(),
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0
  };
  return traces.reduce((info, trace) => (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_2__.reduceTrace)(trace, traceVisitor(), info), initial);
}
function isRootTransaction(trace) {
  // Root transactions has no parent_span_id
  return trace.parent_span_id === null;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_discover_genericDiscoverQuery_tsx-app_views_performance_traceDetails_utils_tsx.61df64563894c785ac5a3c3a6c3a622f.js.map