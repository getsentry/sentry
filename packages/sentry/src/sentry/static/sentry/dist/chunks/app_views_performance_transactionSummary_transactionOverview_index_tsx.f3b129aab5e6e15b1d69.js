"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionSummary_transactionOverview_index_tsx"],{

/***/ "./app/components/charts/breakdownBars.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/breakdownBars.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function BreakdownBars(_ref) {
  let {
    data
  } = _ref;
  const total = data.reduce((sum, point) => point.value + sum, 0);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(BreakdownGrid, {
    children: data.map((point, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Percentage, {
        children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(point.value / total, 0)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(BarContainer, {
        "data-test-id": `status-${point.label}`,
        cursor: point.onClick ? 'pointer' : 'default',
        onClick: point.onClick,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Bar, {
          style: {
            width: `${(point.value / total * 100).toFixed(2)}%`
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Label, {
          children: point.label
        })]
      })]
    }, `${i}:${point.label}`))
  });
}

BreakdownBars.displayName = "BreakdownBars";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BreakdownBars);

const BreakdownGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1yzi37b4"
} : 0)("display:grid;grid-template-columns:min-content auto;column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Percentage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1yzi37b3"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";text-align:right;" + ( true ? "" : 0));

const BarContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1yzi37b2"
} : 0)("padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";position:relative;cursor:", p => p.cursor, ";" + ( true ? "" : 0));

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1yzi37b1"
} : 0)("position:relative;color:", p => p.theme.textColor, ";z-index:2;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Bar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1yzi37b0"
} : 0)("border-radius:2px;background-color:", p => p.theme.border, ";position:absolute;top:0;left:0;z-index:1;height:100%;width:0%;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/performance/anomalies/anomaliesQuery.tsx":
/*!************************************************************!*\
  !*** ./app/utils/performance/anomalies/anomaliesQuery.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionAnomalies/utils */ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function transformStatsTimes(stats) {
  stats.data.forEach(d => d[0] = d[0] * 1000);
  return stats;
}

function transformAnomaliesTimes(anoms) {
  anoms.forEach(a => {
    a.start = a.start * 1000;
    a.end = a.end * 1000;
  });
  return anoms;
}

function transformPayload(payload) {
  const newPayload = { ...payload
  };

  if (!payload.y || !payload.yhat_lower || !payload.yhat_upper || !payload.anomalies) {
    return newPayload;
  }

  newPayload.y = transformStatsTimes(payload.y);
  newPayload.yhat_upper = transformStatsTimes(payload.yhat_upper);
  newPayload.yhat_lower = transformStatsTimes(payload.yhat_lower);
  newPayload.anomalies = transformAnomaliesTimes(payload.anomalies);
  return newPayload;
}

function AnomaliesSeriesQuery(props) {
  if (!props.organization.features.includes(sentry_views_performance_transactionSummary_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_3__.ANOMALY_FLAG)) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
      children: props.children({
        data: null,
        isLoading: false,
        error: null,
        pageLinks: null
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_1__["default"], {
    route: "transaction-anomaly-detection",
    ...props,
    children: _ref => {
      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        data: tableData && tableData.y ? transformPayload(tableData) : null,
        ...rest
      });
    }
  });
}

AnomaliesSeriesQuery.displayName = "AnomaliesSeriesQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_2__["default"])(AnomaliesSeriesQuery));

/***/ }),

/***/ "./app/utils/performance/suspectSpans/suspectSpansQuery.tsx":
/*!******************************************************************!*\
  !*** ./app/utils/performance/suspectSpans/suspectSpansQuery.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function getSuspectSpanPayload(props) {
  const {
    perSuspect,
    spanOps,
    spanGroups,
    minExclusiveTime,
    maxExclusiveTime
  } = props;
  const payload = {
    perSuspect,
    spanOp: spanOps,
    spanGroup: spanGroups,
    min_exclusive_time: minExclusiveTime,
    max_exclusive_time: maxExclusiveTime
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(payload.perSuspect)) {
    delete payload.perSuspect;
  }

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(payload.spanOp)) {
    delete payload.spanOp;
  }

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(payload.spanGroup)) {
    delete payload.spanGroup;
  }

  const additionalPayload = props.eventView.getEventsAPIPayload(props.location);
  return { ...payload,
    ...additionalPayload
  };
}

function SuspectSpansQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_2__["default"], {
    route: "events-spans-performance",
    getRequestPayload: getSuspectSpanPayload,
    ...lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(props, 'children'),
    children: _ref => {
      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        suspectSpans: tableData,
        ...rest
      });
    }
  });
}

SuspectSpansQuery.displayName = "SuspectSpansQuery";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_3__["default"])(SuspectSpansQuery));

/***/ }),

/***/ "./app/views/eventsV2/tags.tsx":
/*!*************************************!*\
  !*** ./app/views/eventsV2/tags.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Tags": () => (/* binding */ Tags),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tagDistributionMeter */ "./app/components/tagDistributionMeter.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















class Tags extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      tags: [],
      totalValues: null,
      error: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRefetchData", prevProps => {
      const thisAPIPayload = this.props.eventView.getFacetsAPIPayload(this.props.location);
      const otherAPIPayload = prevProps.eventView.getFacetsAPIPayload(prevProps.location);
      return !(0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_14__.isAPIPayloadSimilar)(thisAPIPayload, otherAPIPayload);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async function () {
      let forceFetchData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      const {
        api,
        organization,
        eventView,
        location,
        confirmedQuery
      } = _this.props;

      _this.setState({
        loading: true,
        error: '',
        tags: []
      }); // Fetch should be forced after mounting as confirmedQuery isn't guaranteed
      // since this component can mount/unmount via show/hide tags separate from
      // data being loaded for the rest of the page.


      if (!forceFetchData && confirmedQuery === false) {
        return;
      }

      try {
        const tags = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_4__.fetchTagFacets)(api, organization.slug, eventView.getFacetsAPIPayload(location));

        _this.setState({
          loading: false,
          tags
        });
      } catch (err) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_16__.captureException(err);

        _this.setState({
          loading: false,
          error: err
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTagClick", tag => {
      const {
        organization
      } = this.props; // metrics

      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__.trackAnalyticsEvent)({
        eventKey: 'discover_v2.facet_map.clicked',
        eventName: 'Discoverv2: Clicked on a tag on the facet map',
        tag,
        organization_id: parseInt(organization.id, 10)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBody", () => {
      const {
        loading,
        error,
        tags
      } = this.state;

      if (loading) {
        return this.renderPlaceholders();
      }

      if (error) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
          height: "132px",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconWarning, {
            color: "gray300",
            size: "lg"
          })
        });
      }

      if (tags.length > 0) {
        return tags.map(tag => this.renderTag(tag));
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledEmptyStateWarning, {
        small: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No tags found')
      });
    });
  }

  componentDidMount() {
    this.fetchData(true);
  }

  componentDidUpdate(prevProps) {
    if (this.shouldRefetchData(prevProps) || prevProps.confirmedQuery !== this.props.confirmedQuery) {
      this.fetchData();
    }
  }

  renderTag(tag) {
    const {
      generateUrl,
      totalValues
    } = this.props;
    const segments = tag.topValues.map(segment => {
      segment.url = generateUrl(tag.key, segment.value);
      return segment;
    }); // Ensure we don't show >100% if there's a slight mismatch between the facets
    // endpoint and the totals endpoint

    const maxTotalValues = segments.length > 0 ? Math.max(Number(totalValues), segments[0].count) : totalValues;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_tagDistributionMeter__WEBPACK_IMPORTED_MODULE_9__["default"], {
      title: tag.key,
      segments: segments,
      totalValues: Number(maxTotalValues),
      renderLoading: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholder, {
        height: "16px"
      }),
      onTagClick: this.handleTagClick,
      showReleasePackage: true
    }, tag.key);
  }

  renderPlaceholders() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholderTitle, {}, "title-1"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholder, {}, "bar-1"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholderTitle, {}, "title-2"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholder, {}, "bar-2"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholderTitle, {}, "title-3"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledPlaceholder, {}, "bar-3")]
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.SectionHeading, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Tag Summary')
      }), this.renderBody()]
    });
  }

}

Tags.displayName = "Tags";

const StyledEmptyStateWarning = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1pu9veq2"
} : 0)( true ? {
  name: "rtpdsm",
  styles: "height:132px;padding:54px 15%"
} : 0);

const StyledPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1pu9veq1"
} : 0)("border-radius:", p => p.theme.borderRadius, ";height:16px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1.5), ";" + ( true ? "" : 0));

const StyledPlaceholderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1pu9veq0"
} : 0)("width:100px;height:12px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__["default"])(Tags));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/content.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/content.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/datePageFilter */ "./app/components/datePageFilter.tsx");
/* harmony import */ var sentry_components_discover_transactionsList__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/discover/transactionsList */ "./app/components/discover/transactionsList.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilterBar */ "./app/components/organizations/pageFilterBar.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var sentry_views_eventsV2_tags__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/eventsV2/tags */ "./app/views/eventsV2/tags.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionVitals_constants__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionVitals/constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _charts__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./charts */ "./app/views/performance/transactionSummary/transactionOverview/charts.tsx");
/* harmony import */ var _relatedIssues__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./relatedIssues */ "./app/views/performance/transactionSummary/transactionOverview/relatedIssues.tsx");
/* harmony import */ var _sidebarCharts__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./sidebarCharts */ "./app/views/performance/transactionSummary/transactionOverview/sidebarCharts.tsx");
/* harmony import */ var _sidebarMEPCharts__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ./sidebarMEPCharts */ "./app/views/performance/transactionSummary/transactionOverview/sidebarMEPCharts.tsx");
/* harmony import */ var _statusBreakdown__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./statusBreakdown */ "./app/views/performance/transactionSummary/transactionOverview/statusBreakdown.tsx");
/* harmony import */ var _suspectSpans__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./suspectSpans */ "./app/views/performance/transactionSummary/transactionOverview/suspectSpans.tsx");
/* harmony import */ var _tagExplorer__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./tagExplorer */ "./app/views/performance/transactionSummary/transactionOverview/tagExplorer.tsx");
/* harmony import */ var _userStats__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./userStats */ "./app/views/performance/transactionSummary/transactionOverview/userStats.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








































function SummaryContent(_ref) {
  var _ref4;

  let {
    eventView,
    location,
    totalValues,
    spanOperationBreakdownFilter,
    organization,
    projects,
    isLoading,
    error,
    projectId,
    transactionName,
    onChangeFilter
  } = _ref;
  const useAggregateAlias = !organization.features.includes('performance-frontend-use-events-endpoint');

  function handleSearch(query) {
    const queryParams = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_13__.normalizeDateTimeParams)({ ...(location.query || {}),
      query
    }); // do not propagate pagination when making a new search

    const searchQueryParams = lodash_omit__WEBPACK_IMPORTED_MODULE_5___default()(queryParams, 'cursor');
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams
    });
  }

  function generateTagUrl(key, value) {
    const query = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.generateQueryWithTag)(location.query, {
      key: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.formatTagKey)(key),
      value
    });
    return { ...location,
      query
    };
  }

  function handleCellAction(column) {
    return (action, value) => {
      const searchConditions = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.normalizeSearchConditions)(eventView.query);
      (0,sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_23__.updateQuery)(searchConditions, action, column, value);
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({
        pathname: location.pathname,
        query: { ...location.query,
          cursor: undefined,
          query: searchConditions.formatString()
        }
      });
    };
  }

  function handleTransactionsListSortChange(value) {
    const target = {
      pathname: location.pathname,
      query: { ...location.query,
        showTransactions: value,
        transactionCursor: undefined
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(target);
  }

  function handleAllEventsViewClick() {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_18__.trackAnalyticsEvent)({
      eventKey: 'performance_views.summary.view_in_transaction_events',
      eventName: 'Performance Views: View in All Events from Transaction Summary',
      organization_id: parseInt(organization.id, 10)
    });
  }

  function generateEventView(transactionsListEventView, transactionsListTitles) {
    var _ref2;

    const {
      selected
    } = getTransactionsListSort(location, {
      p95: (_ref2 = useAggregateAlias ? totalValues === null || totalValues === void 0 ? void 0 : totalValues.p95 : totalValues === null || totalValues === void 0 ? void 0 : totalValues['p95()']) !== null && _ref2 !== void 0 ? _ref2 : 0,
      spanOperationBreakdownFilter
    });
    const sortedEventView = transactionsListEventView.withSorts([selected.sort]);

    if (spanOperationBreakdownFilter === _filter__WEBPACK_IMPORTED_MODULE_27__.SpanOperationBreakdownFilter.None) {
      const fields = [// Remove the extra field columns
      ...sortedEventView.fields.slice(0, transactionsListTitles.length)]; // omit "Operation Duration" column

      sortedEventView.fields = fields.filter(_ref3 => {
        let {
          field
        } = _ref3;
        return !(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.isRelativeSpanOperationBreakdownField)(field);
      });
    }

    return sortedEventView;
  }

  const hasPerformanceChartInterpolation = organization.features.includes('performance-chart-interpolation');
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.query, '');
  const totalCount = totalValues === null ? null : useAggregateAlias ? totalValues.count : totalValues['count()']; // NOTE: This is not a robust check for whether or not a transaction is a front end
  // transaction, however it will suffice for now.

  const hasWebVitals = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.isSummaryViewFrontendPageLoad)(eventView, projects) || totalValues !== null && sentry_views_performance_transactionSummary_transactionVitals_constants__WEBPACK_IMPORTED_MODULE_25__.VITAL_GROUPS.some(group => group.vitals.some(vital => {
    const functionName = `percentile(${vital},${sentry_views_performance_transactionSummary_transactionVitals_constants__WEBPACK_IMPORTED_MODULE_25__.PERCENTILE})`;
    const field = useAggregateAlias ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.getAggregateAlias)(functionName) : functionName;
    return Number.isFinite(totalValues[field]);
  }));
  const isFrontendView = (0,_utils__WEBPACK_IMPORTED_MODULE_26__.isSummaryViewFrontend)(eventView, projects);
  const transactionsListTitles = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('event id'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('user'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('total duration'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('trace id'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('timestamp')];
  let transactionsListEventView = eventView.clone();

  if (organization.features.includes('performance-ops-breakdown')) {
    // update search conditions
    const spanOperationBreakdownConditions = (0,_filter__WEBPACK_IMPORTED_MODULE_27__.filterToSearchConditions)(spanOperationBreakdownFilter, location);

    if (spanOperationBreakdownConditions) {
      eventView = eventView.clone();
      eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
      transactionsListEventView = eventView.clone();
    } // update header titles of transactions list


    const operationDurationTableTitle = spanOperationBreakdownFilter === _filter__WEBPACK_IMPORTED_MODULE_27__.SpanOperationBreakdownFilter.None ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('operation duration') : `${spanOperationBreakdownFilter} duration`; // add ops breakdown duration column as the 3rd column

    transactionsListTitles.splice(2, 0, operationDurationTableTitle); // span_ops_breakdown.relative is a preserved name and a marker for the associated
    // field renderer to be used to generate the relative ops breakdown

    let durationField = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_RELATIVE_BREAKDOWN_FIELD;

    if (spanOperationBreakdownFilter !== _filter__WEBPACK_IMPORTED_MODULE_27__.SpanOperationBreakdownFilter.None) {
      durationField = (0,_filter__WEBPACK_IMPORTED_MODULE_27__.filterToField)(spanOperationBreakdownFilter);
    }

    const fields = [...transactionsListEventView.fields]; // add ops breakdown duration column as the 3rd column

    fields.splice(2, 0, {
      field: durationField
    });

    if (spanOperationBreakdownFilter === _filter__WEBPACK_IMPORTED_MODULE_27__.SpanOperationBreakdownFilter.None) {
      fields.push(...sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.SPAN_OP_BREAKDOWN_FIELDS.map(field => {
        return {
          field
        };
      }));
    }

    transactionsListEventView.fields = fields;
  }

  const openAllEventsProps = {
    generatePerformanceTransactionEventsView: () => {
      const performanceTransactionEventsView = generateEventView(transactionsListEventView, transactionsListTitles);
      performanceTransactionEventsView.query = query;
      return performanceTransactionEventsView;
    },
    handleOpenAllEventsClick: handleAllEventsViewClick
  };
  const isUsingMetrics = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_20__.canUseMetricsData)(organization);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Main, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(FilterActions, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_filter__WEBPACK_IMPORTED_MODULE_27__["default"], {
          organization: organization,
          currentFilter: spanOperationBreakdownFilter,
          onChangeFilter: onChangeFilter
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_organizations_pageFilterBar__WEBPACK_IMPORTED_MODULE_12__["default"], {
          condensed: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_9__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_datePageFilter__WEBPACK_IMPORTED_MODULE_7__["default"], {
            alignDropdown: "left"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(StyledSearchBar, {
          searchSource: "transaction_summary",
          organization: organization,
          projectIds: eventView.project,
          query: query,
          fields: eventView.fields,
          onSearch: handleSearch,
          maxQueryLength: sentry_constants__WEBPACK_IMPORTED_MODULE_14__.MAX_QUERY_LENGTH
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_charts__WEBPACK_IMPORTED_MODULE_29__["default"], {
        organization: organization,
        location: location,
        eventView: eventView,
        totalValues: totalCount,
        currentFilter: spanOperationBreakdownFilter,
        withoutZerofill: hasPerformanceChartInterpolation
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_discover_transactionsList__WEBPACK_IMPORTED_MODULE_8__["default"], {
        location: location,
        organization: organization,
        eventView: transactionsListEventView,
        ...openAllEventsProps,
        showTransactions: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.showTransactions, _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.SLOW),
        breakdown: (0,_filter__WEBPACK_IMPORTED_MODULE_27__.decodeFilterFromLocation)(location),
        titles: transactionsListTitles,
        handleDropdownChange: handleTransactionsListSortChange,
        generateLink: {
          id: (0,_utils__WEBPACK_IMPORTED_MODULE_28__.generateTransactionLink)(transactionName),
          trace: (0,_utils__WEBPACK_IMPORTED_MODULE_28__.generateTraceLink)(eventView.normalizeDateSelection(location))
        },
        handleCellAction: handleCellAction,
        ...getTransactionsListSort(location, {
          p95: (_ref4 = useAggregateAlias ? totalValues === null || totalValues === void 0 ? void 0 : totalValues.p95 : totalValues === null || totalValues === void 0 ? void 0 : totalValues['p95()']) !== null && _ref4 !== void 0 ? _ref4 : 0,
          spanOperationBreakdownFilter
        }),
        forceLoading: isLoading
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
        requireAll: false,
        features: ['organizations:performance-suspect-spans-view'],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_suspectSpans__WEBPACK_IMPORTED_MODULE_34__["default"], {
          location: location,
          organization: organization,
          eventView: eventView,
          totals: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_17__.defined)(totalValues === null || totalValues === void 0 ? void 0 : totalValues['count()']) ? {
            'count()': totalValues['count()']
          } : null,
          projectId: projectId,
          transactionName: transactionName
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_tagExplorer__WEBPACK_IMPORTED_MODULE_35__.TagExplorer, {
        eventView: eventView,
        organization: organization,
        location: location,
        projects: projects,
        transactionName: transactionName,
        currentFilter: spanOperationBreakdownFilter
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_relatedIssues__WEBPACK_IMPORTED_MODULE_30__["default"], {
        organization: organization,
        location: location,
        transaction: transactionName,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Side, {
      children: [(isUsingMetrics !== null && isUsingMetrics !== void 0 ? isUsingMetrics : null) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_sidebarMEPCharts__WEBPACK_IMPORTED_MODULE_32__["default"], {
          organization: organization,
          isLoading: isLoading,
          error: error,
          totals: totalValues,
          eventView: eventView,
          transactionName: transactionName,
          isShowingMetricsEventCount: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_utils__WEBPACK_IMPORTED_MODULE_28__.SidebarSpacer, {})]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_userStats__WEBPACK_IMPORTED_MODULE_36__["default"], {
        organization: organization,
        location: location,
        isLoading: isLoading,
        hasWebVitals: hasWebVitals,
        error: error,
        totals: totalValues,
        transactionName: transactionName,
        eventView: eventView
      }), !isFrontendView && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_statusBreakdown__WEBPACK_IMPORTED_MODULE_33__["default"], {
        eventView: eventView,
        organization: organization,
        location: location
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_utils__WEBPACK_IMPORTED_MODULE_28__.SidebarSpacer, {}), isUsingMetrics ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_sidebarMEPCharts__WEBPACK_IMPORTED_MODULE_32__["default"], {
        organization: organization,
        isLoading: isLoading,
        error: error,
        totals: totalValues,
        eventView: eventView,
        transactionName: transactionName
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_sidebarCharts__WEBPACK_IMPORTED_MODULE_31__["default"], {
        organization: organization,
        isLoading: isLoading,
        error: error,
        totals: totalValues,
        eventView: eventView,
        transactionName: transactionName
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(_utils__WEBPACK_IMPORTED_MODULE_28__.SidebarSpacer, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_37__.jsx)(sentry_views_eventsV2_tags__WEBPACK_IMPORTED_MODULE_24__["default"], {
        generateUrl: generateTagUrl,
        totalValues: totalCount,
        eventView: eventView,
        organization: organization,
        location: location
      })]
    })]
  });
}

SummaryContent.displayName = "SummaryContent";

function getFilterOptions(_ref5) {
  let {
    p95,
    spanOperationBreakdownFilter
  } = _ref5;

  if (spanOperationBreakdownFilter === _filter__WEBPACK_IMPORTED_MODULE_27__.SpanOperationBreakdownFilter.None) {
    return [{
      sort: {
        kind: 'asc',
        field: 'transaction.duration'
      },
      value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.FASTEST,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Fastest Transactions')
    }, {
      query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
      sort: {
        kind: 'desc',
        field: 'transaction.duration'
      },
      value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.SLOW,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Slow Transactions (p95)')
    }, {
      sort: {
        kind: 'desc',
        field: 'transaction.duration'
      },
      value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.OUTLIER,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Outlier Transactions (p100)')
    }, {
      sort: {
        kind: 'desc',
        field: 'timestamp'
      },
      value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.RECENT,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Recent Transactions')
    }];
  }

  const field = (0,_filter__WEBPACK_IMPORTED_MODULE_27__.filterToField)(spanOperationBreakdownFilter);
  const operationName = spanOperationBreakdownFilter;
  return [{
    sort: {
      kind: 'asc',
      field
    },
    value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.FASTEST,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Fastest %s Operations', operationName)
  }, {
    query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
    sort: {
      kind: 'desc',
      field
    },
    value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.SLOW,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Slow %s Operations (p95)', operationName)
  }, {
    sort: {
      kind: 'desc',
      field
    },
    value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.OUTLIER,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Outlier %s Operations (p100)', operationName)
  }, {
    sort: {
      kind: 'desc',
      field: 'timestamp'
    },
    value: _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.RECENT,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Recent Transactions')
  }];
}

function getTransactionsListSort(location, options) {
  const sortOptions = getFilterOptions(options);
  const urlParam = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.showTransactions, _utils__WEBPACK_IMPORTED_MODULE_28__.TransactionFilterOptions.SLOW);
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {
    selected: selectedSort,
    options: sortOptions
  };
}

const FilterActions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ent1li1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(2, min-content);}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){grid-template-columns:auto auto 1fr;}" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ent1li0"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){order:1;grid-column:1/4;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){order:initial;grid-column:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_22__["default"])(SummaryContent));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/index.tsx":
/*!********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/index.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/performance/histogram */ "./app/utils/performance/histogram/index.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _pageLayout__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../pageLayout */ "./app/views/performance/transactionSummary/pageLayout.tsx");
/* harmony import */ var _tabs__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../tabs */ "./app/views/performance/transactionSummary/tabs.tsx");
/* harmony import */ var _transactionVitals_constants__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../transactionVitals/constants */ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx");
/* harmony import */ var _latencyChart_utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./latencyChart/utils */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
























 // Used to cast the totals request to numbers
// as React.ReactText



function TransactionOverview(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const {
    location,
    selection,
    organization,
    projects
  } = props;
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_4__.loadOrganizationTags)(api, organization.slug, selection);
    (0,_utils__WEBPACK_IMPORTED_MODULE_18__.addRoutePerformanceContext)(selection);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('performance_views.transaction_summary.view', {
      organization
    });
  }, [selection, organization, api]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_10__.MEPSettingProvider, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_pageLayout__WEBPACK_IMPORTED_MODULE_20__["default"], {
      location: location,
      organization: organization,
      projects: projects,
      tab: _tabs__WEBPACK_IMPORTED_MODULE_21__["default"].TransactionSummary,
      getDocumentTitle: getDocumentTitle,
      generateEventView: generateEventView,
      childComponent: OverviewContentWrapper
    })
  });
}

TransactionOverview.displayName = "TransactionOverview";

function OverviewContentWrapper(props) {
  const {
    location,
    organization,
    eventView,
    projectId,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric
  } = props;
  const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
  const spanOperationBreakdownFilter = (0,_filter__WEBPACK_IMPORTED_MODULE_19__.decodeFilterFromLocation)(location);
  const totalsView = getTotalsEventView(organization, eventView);

  const onChangeFilter = newFilter => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('performance_views.filter_dropdown.selection', {
      organization,
      action: newFilter
    });
    const nextQuery = { ...(0,sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_11__.removeHistogramQueryStrings)(location, [_latencyChart_utils__WEBPACK_IMPORTED_MODULE_23__.ZOOM_START, _latencyChart_utils__WEBPACK_IMPORTED_MODULE_23__.ZOOM_END]),
      ...(0,_filter__WEBPACK_IMPORTED_MODULE_19__.filterToLocationQuery)(newFilter)
    };

    if (newFilter === _filter__WEBPACK_IMPORTED_MODULE_19__.SpanOperationBreakdownFilter.None) {
      delete nextQuery.breakdown;
    }

    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
      pathname: location.pathname,
      query: nextQuery
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_7__["default"], {
    eventView: totalsView,
    orgSlug: organization.slug,
    location: location,
    transactionThreshold: transactionThreshold,
    transactionThresholdMetric: transactionThresholdMetric,
    referrer: "api.performance.transaction-summary",
    useEvents: useEvents,
    children: _ref => {
      var _ref2, _tableData$data;

      let {
        isLoading,
        error,
        tableData
      } = _ref;
      const totals = (_ref2 = tableData === null || tableData === void 0 ? void 0 : (_tableData$data = tableData.data) === null || _tableData$data === void 0 ? void 0 : _tableData$data[0]) !== null && _ref2 !== void 0 ? _ref2 : null;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_content__WEBPACK_IMPORTED_MODULE_24__["default"], {
        location: location,
        organization: organization,
        eventView: eventView,
        projectId: projectId,
        transactionName: transactionName,
        isLoading: isLoading,
        error: error,
        totalValues: totals,
        onChangeFilter: onChangeFilter,
        spanOperationBreakdownFilter: spanOperationBreakdownFilter
      });
    }
  });
}

OverviewContentWrapper.displayName = "OverviewContentWrapper";

function getDocumentTitle(transactionName) {
  const hasTransactionName = typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Performance')].join(' - ');
  }

  return [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Summary'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Performance')].join(' - ');
}

function generateEventView(_ref3) {
  let {
    location,
    transactionName
  } = _ref3;
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_12__.decodeScalar)(location.query.query, '');
  const conditions = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_13__.MutableSearch(query);
  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);
  Object.keys(conditions.filters).forEach(field => {
    if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.isAggregateField)(field)) {
      conditions.removeFilter(field);
    }
  });
  const fields = ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: transactionName,
    fields,
    query: conditions.formatString(),
    projects: []
  }, location);
}

function getTotalsEventView(_organization, eventView) {
  const vitals = _transactionVitals_constants__WEBPACK_IMPORTED_MODULE_22__.VITAL_GROUPS.map(_ref4 => {
    let {
      vitals: vs
    } = _ref4;
    return vs;
  }).reduce((keys, vs) => {
    vs.forEach(vital => keys.push(vital));
    return keys;
  }, []);
  const totalsColumns = [{
    kind: 'function',
    function: ['p95', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['count', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['count_unique', 'user', undefined, undefined]
  }, {
    kind: 'function',
    function: ['failure_rate', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['tpm', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['count_miserable', 'user', undefined, undefined]
  }, {
    kind: 'function',
    function: ['user_misery', '', undefined, undefined]
  }, {
    kind: 'function',
    function: ['apdex', '', undefined, undefined]
  }];
  return eventView.withColumns([...totalsColumns, ...vitals.map(vital => ({
    kind: 'function',
    function: ['percentile', vital, _transactionVitals_constants__WEBPACK_IMPORTED_MODULE_22__.PERCENTILE.toString(), undefined]
  }))]);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_17__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_15__["default"])(TransactionOverview))));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/relatedIssues.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/relatedIssues.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/issues/groupList */ "./app/components/issues/groupList.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





















class RelatedIssues extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOpenClick", () => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_14__.trackAnalyticsEvent)({
        eventKey: 'performance_views.summary.open_issues',
        eventName: 'Performance Views: Open issues from transaction summary',
        organization_id: parseInt(organization.id, 10)
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderEmptyMessage", () => {
      const {
        statsPeriod
      } = this.props;
      const selectedTimePeriod = statsPeriod && sentry_constants__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_RELATIVE_PERIODS[statsPeriod];
      const displayedPeriod = selectedTimePeriod ? selectedTimePeriod.toLowerCase() : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('given timeframe');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__["default"], {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)("p", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('No new issues for this transaction for the [timePeriod].', {
                timePeriod: displayedPeriod
              })
            })
          })
        })
      });
    });
  }

  getIssuesEndpoint() {
    const {
      transaction,
      organization,
      start,
      end,
      statsPeriod,
      location
    } = this.props;
    const queryParams = {
      start,
      end,
      statsPeriod,
      limit: 5,
      sort: 'new',
      ...lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_11__.URL_PARAM), 'cursor'])
    };
    const currentFilter = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_16__.MutableSearch((0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_15__.decodeScalar)(location.query.query, ''));
    (0,_utils__WEBPACK_IMPORTED_MODULE_17__.removeTracingKeysFromSearch)(currentFilter);
    currentFilter.addFreeText('is:unresolved').setFilterValues('transaction', [transaction]);
    return {
      path: `/organizations/${organization.slug}/issues/`,
      queryParams: { ...queryParams,
        query: currentFilter.formatString()
      }
    };
  }

  render() {
    const {
      organization
    } = this.props;
    const {
      path,
      queryParams
    } = this.getIssuesEndpoint();
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(ControlsWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Related Issues')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          "data-test-id": "issues-open",
          size: "xs",
          to: issueSearch,
          onClick: this.handleOpenClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open in Issues')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(TableWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_8__["default"], {
          orgId: organization.slug,
          endpointPath: path,
          queryParams: queryParams,
          query: "",
          canSelectGroups: false,
          renderEmptyMessage: this.renderEmptyMessage,
          withChart: false,
          withPagination: false
        })
      })]
    });
  }

}

RelatedIssues.displayName = "RelatedIssues";

const ControlsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "el0d6on1"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const TableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "el0d6on0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";", sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, "{margin-bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RelatedIssues);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/sidebarCharts.tsx":
/*!****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/sidebarCharts.tsx ***!
  \****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_29___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_29__);
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_components_markPoint__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/components/markPoint */ "./app/components/charts/components/markPoint.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_anomalies_anomaliesQuery__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/performance/anomalies/anomaliesQuery */ "./app/utils/performance/anomalies/anomaliesQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../transactionAnomalies/utils */ "./app/views/performance/transactionSummary/transactionAnomalies/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

// eslint-disable-next-line no-restricted-imports






























function SidebarCharts(_ref) {
  let {
    organization,
    isLoading,
    error,
    totals,
    start,
    end,
    utc,
    router,
    statsPeriod,
    chartData,
    eventView,
    location,
    transactionName
  } = _ref;
  const useAggregateAlias = !organization.features.includes('performance-frontend-use-events-endpoint');
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_27__.a)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(RelativeBox, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartLabel, {
      top: "0px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Apdex'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
          position: "top",
          title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.PERFORMANCE_TERM.APDEX),
          size: "sm"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ChartSummaryValue, {
        "data-test-id": "apdex-summary-value",
        isLoading: isLoading,
        error: error,
        value: totals ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatFloat)(useAggregateAlias ? totals.apdex : totals['apdex()'], 4) : null
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartLabel, {
      top: "160px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Failure Rate'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
          position: "top",
          title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.PERFORMANCE_TERM.FAILURE_RATE),
          size: "sm"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ChartSummaryValue, {
        "data-test-id": "failure-rate-summary-value",
        isLoading: isLoading,
        error: error,
        value: totals ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatPercentage)(useAggregateAlias ? totals.failure_rate : totals['failure_rate()']) : null
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartLabel, {
      top: "320px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(ChartTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('TPM'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_14__["default"], {
          position: "top",
          title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_25__.PERFORMANCE_TERM.TPM),
          size: "sm"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ChartSummaryValue, {
        "data-test-id": "tpm-summary-value",
        isLoading: isLoading,
        error: error,
        value: totals ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('[tpm] tpm', {
          tpm: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatFloat)(useAggregateAlias ? totals.tpm : totals['tpm()'], 4)
        }) : null
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_utils_performance_anomalies_anomaliesQuery__WEBPACK_IMPORTED_MODULE_22__["default"], {
      location: location,
      organization: organization,
      eventView: eventView,
      children: results => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__["default"], {
        router: router,
        period: statsPeriod,
        start: start,
        end: end,
        utc: utc,
        xAxisIndex: [0, 1, 2],
        children: zoomRenderProps => {
          const {
            errored,
            loading,
            reloading,
            chartOptions,
            series
          } = chartData;

          if (errored) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
              height: "580px",
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconWarning, {
                color: "gray300",
                size: "lg"
              })
            });
          }

          if (organization.features.includes(_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_26__.ANOMALY_FLAG)) {
            const epmSeries = series.find(s => s.seriesName.includes('epm') || s.seriesName.includes('tpm'));

            if (epmSeries && results.data) {
              epmSeries.markPoint = (0,sentry_components_charts_components_markPoint__WEBPACK_IMPORTED_MODULE_4__["default"])({
                data: results.data.anomalies.map(a => {
                  var _epmSeries$data$find;

                  return {
                    name: a.id,
                    yAxis: (_epmSeries$data$find = epmSeries.data.find(_ref2 => {
                      let {
                        name
                      } = _ref2;
                      return name > (a.end + a.start) / 2;
                    })) === null || _epmSeries$data$find === void 0 ? void 0 : _epmSeries$data$find.value,
                    // TODO: the above is O(n*m), remove after we change the api to include the midpoint of y.
                    xAxis: a.start,
                    itemStyle: {
                      borderColor: color__WEBPACK_IMPORTED_MODULE_29___default()((0,_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_26__.anomalyToColor)(a.confidence, theme)).string(),
                      color: color__WEBPACK_IMPORTED_MODULE_29___default()((0,_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_26__.anomalyToColor)(a.confidence, theme)).alpha(0.2).rgb().string()
                    },
                    onClick: () => {
                      const target = (0,_transactionAnomalies_utils__WEBPACK_IMPORTED_MODULE_26__.anomaliesRouteWithQuery)({
                        orgSlug: organization.slug,
                        query: location.query,
                        projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_23__.decodeScalar)(location.query.project),
                        transaction: transactionName
                      });
                      react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push(target);
                    }
                  };
                }),
                symbol: 'circle',
                symbolSize: 16
              });
            }
          }

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_9__["default"], {
            loading: loading,
            reloading: reloading,
            height: "580px",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_10__["default"], {
              visible: reloading
            }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_21__["default"])({
              value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_7__.LineChart, { ...zoomRenderProps,
                ...chartOptions,
                series: series
              }),
              fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__["default"], {
                height: "480px",
                testId: "skeleton-ui"
              })
            })]
          });
        }
      })
    })]
  });
}

SidebarCharts.displayName = "SidebarCharts";

function SidebarChartsContainer(_ref3) {
  let {
    location,
    eventView,
    organization,
    router,
    isLoading,
    error,
    totals,
    transactionName
  } = _ref3;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_24__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_27__.a)();
  const colors = theme.charts.getColorPalette(3);
  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__.getUtcToLocalDateObject)(eventView.start) : undefined;
  const end = eventView.end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_17__.getUtcToLocalDateObject)(eventView.end) : undefined;
  const project = eventView.project;
  const environment = eventView.environment;
  const query = eventView.query;
  const utc = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_12__.normalizeDateTimeParams)(location.query).utc === 'true';
  const axisLineConfig = {
    scale: true,
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    splitLine: {
      show: false
    }
  };
  const chartOptions = {
    height: 480,
    grid: [{
      top: '60px',
      left: '10px',
      right: '10px',
      height: '100px'
    }, {
      top: '220px',
      left: '10px',
      right: '10px',
      height: '100px'
    }, {
      top: '380px',
      left: '10px',
      right: '10px',
      height: '120px'
    }],
    axisPointer: {
      // Link each x-axis together.
      link: [{
        xAxisIndex: [0, 1, 2]
      }]
    },
    xAxes: Array.from(new Array(3)).map((_i, index) => ({
      gridIndex: index,
      type: 'time',
      show: false
    })),
    yAxes: [{
      // apdex
      gridIndex: 0,
      interval: 0.2,
      axisLabel: {
        formatter: value => `${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatFloat)(value, 1)}`,
        color: theme.chartLabel
      },
      ...axisLineConfig
    }, {
      // failure rate
      gridIndex: 1,
      splitNumber: 4,
      interval: 0.5,
      max: 1.0,
      axisLabel: {
        formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatPercentage)(value, 0),
        color: theme.chartLabel
      },
      ...axisLineConfig
    }, {
      // throughput
      gridIndex: 2,
      splitNumber: 4,
      axisLabel: {
        formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatAbbreviatedNumber,
        color: theme.chartLabel
      },
      ...axisLineConfig
    }],
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[0], colors[1], colors[2]],
    tooltip: {
      trigger: 'axis',
      truncate: 80,
      valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_18__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_19__.aggregateOutputType)(label)),

      nameFormatter(value) {
        return value === 'epm()' ? 'tpm()' : value;
      }

    }
  };
  const requestCommonProps = {
    api,
    start,
    end,
    period: statsPeriod,
    project,
    environment,
    query
  };
  const contentCommonProps = {
    organization,
    router,
    error,
    isLoading,
    start,
    end,
    utc,
    totals
  };
  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__["default"], { ...requestCommonProps,
    organization: organization,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_11__.getInterval)(datetimeSelection),
    showLoading: false,
    includePrevious: false,
    yAxis: ['apdex()', 'failure_rate()', 'epm()'],
    partial: true,
    referrer: "api.performance.transaction-summary.sidebar-chart",
    children: _ref4 => {
      let {
        results,
        errored,
        loading,
        reloading
      } = _ref4;
      const series = results ? results.map((values, i) => ({ ...values,
        yAxisIndex: i,
        xAxisIndex: i
      })) : [];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(SidebarCharts, { ...contentCommonProps,
        transactionName: transactionName,
        location: location,
        eventView: eventView,
        chartData: {
          series,
          errored,
          loading,
          reloading,
          chartOptions
        }
      });
    }
  });
}

SidebarChartsContainer.displayName = "SidebarChartsContainer";

function ChartSummaryValue(_ref5) {
  let {
    error,
    isLoading,
    value,
    ...props
  } = _ref5;

  if (error) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)("div", { ...props,
      children: '\u2014'
    });
  }

  if (isLoading) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_13__["default"], {
      height: "24px",
      ...props
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ChartValue, { ...props,
    children: value
  });
}

ChartSummaryValue.displayName = "ChartSummaryValue";

const RelativeBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecri4wp3"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const ChartTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_8__.SectionHeading,  true ? {
  target: "ecri4wp2"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const ChartLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecri4wp1"
} : 0)("position:absolute;top:", p => p.top, ";z-index:1;" + ( true ? "" : 0));

const ChartValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecri4wp0"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(SidebarChartsContainer));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/sidebarMEPCharts.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/sidebarMEPCharts.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsCardinality */ "./app/utils/performance/contexts/metricsCardinality.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _landing_widgets_utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../../landing/widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports






























function SidebarCharts(props) {
  const {
    isShowingMetricsEventCount,
    start,
    end,
    utc,
    router,
    statsPeriod,
    chartData
  } = props;
  const placeholderHeight = isShowingMetricsEventCount ? '200px' : '300px';
  const boxHeight = isShowingMetricsEventCount ? '300px' : '400px';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(RelativeBox, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartLabels, { ...props
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_6__["default"], {
      router: router,
      period: statsPeriod,
      start: start,
      end: end,
      utc: utc,
      xAxisIndex: [0, 1, 2],
      children: zoomRenderProps => {
        const {
          errored,
          loading,
          reloading,
          chartOptions,
          series
        } = chartData;

        if (errored) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_7__["default"], {
            height: boxHeight,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconWarning, {
              color: "gray300",
              size: "lg"
            })
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_11__["default"], {
          loading: loading,
          reloading: reloading,
          height: boxHeight,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_12__["default"], {
            visible: reloading
          }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_23__["default"])({
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_9__.LineChart, { ...zoomRenderProps,
              ...chartOptions,
              series: series
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"], {
              height: placeholderHeight,
              testId: "skeleton-ui"
            })
          })]
        });
      }
    })]
  });
}

SidebarCharts.displayName = "SidebarCharts";

function getDatasetCounts(_ref) {
  var _chartData$series$0$d, _chartData$series$, _metricsChartData$ser, _metricsChartData$ser2, _metricsCardinality$o;

  let {
    chartData,
    metricsChartData,
    metricsCardinality
  } = _ref;
  const transactionCount = (_chartData$series$0$d = chartData === null || chartData === void 0 ? void 0 : (_chartData$series$ = chartData.series[0]) === null || _chartData$series$ === void 0 ? void 0 : _chartData$series$.data.reduce((sum, _ref2) => {
    let {
      value
    } = _ref2;
    return sum + value;
  }, 0)) !== null && _chartData$series$0$d !== void 0 ? _chartData$series$0$d : 0;
  const metricsCount = (_metricsChartData$ser = metricsChartData === null || metricsChartData === void 0 ? void 0 : (_metricsChartData$ser2 = metricsChartData.series[0]) === null || _metricsChartData$ser2 === void 0 ? void 0 : _metricsChartData$ser2.data.reduce((sum, _ref3) => {
    let {
      value
    } = _ref3;
    return sum + value;
  }, 0)) !== null && _metricsChartData$ser !== void 0 ? _metricsChartData$ser : 0;
  const missingMetrics = !metricsCount && transactionCount || metricsCount < transactionCount || ((_metricsCardinality$o = metricsCardinality.outcome) === null || _metricsCardinality$o === void 0 ? void 0 : _metricsCardinality$o.forceTransactionsOnly);
  return {
    transactionCount,
    metricsCount,
    missingMetrics
  };
}

function ChartLabels(_ref4) {
  let {
    organization,
    isLoading,
    totals,
    error,
    isShowingMetricsEventCount,
    chartData,
    metricsChartData
  } = _ref4;
  const useAggregateAlias = !organization.features.includes('performance-frontend-use-events-endpoint');
  const metricsCardinality = (0,sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_24__.useMetricsCardinalityContext)();

  if (isShowingMetricsEventCount) {
    const {
      transactionCount,
      metricsCount,
      missingMetrics
    } = getDatasetCounts({
      chartData,
      metricsChartData,
      metricsCardinality
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartLabel, {
        top: "0px",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartTitle, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Count'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('The count of events for the selected time period, showing the indexed events powering this page with filters compared to total processed events.'),
            size: "sm"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartSummaryValue, {
          "data-test-id": "tpm-summary-value",
          isLoading: isLoading,
          error: error,
          value: totals ? missingMetrics ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)('[txnCount]', {
            txnCount: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber)(transactionCount)
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.tct)('[txnCount] of [metricCount]', {
            txnCount: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber)(transactionCount),
            metricCount: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber)(metricsCount)
          }) : null
        })]
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartLabel, {
      top: "0px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Apdex'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
          position: "top",
          title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_27__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_27__.PERFORMANCE_TERM.APDEX),
          size: "sm"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartSummaryValue, {
        "data-test-id": "apdex-summary-value",
        isLoading: isLoading,
        error: error,
        value: totals ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatFloat)(useAggregateAlias ? totals.apdex : totals['apdex()'], 4) : null
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartLabel, {
      top: "160px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartTitle, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Failure Rate'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
          position: "top",
          title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_27__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_27__.PERFORMANCE_TERM.FAILURE_RATE),
          size: "sm"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartSummaryValue, {
        "data-test-id": "failure-rate-summary-value",
        isLoading: isLoading,
        error: error,
        value: totals ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatPercentage)(useAggregateAlias ? totals.failure_rate : totals['failure_rate()']) : null
      })]
    })]
  });
}

ChartLabels.displayName = "ChartLabels";

function getSideChartsOptions(_ref5) {
  let {
    theme,
    utc,
    isShowingMetricsEventCount
  } = _ref5;
  const colors = theme.charts.getColorPalette(3);
  const axisLineConfig = {
    scale: true,
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    splitLine: {
      show: false
    }
  };

  if (isShowingMetricsEventCount) {
    const chartOptions = {
      height: 200,
      grid: [{
        top: '60px',
        left: '10px',
        right: '10px',
        height: '160px'
      }],
      axisPointer: {
        // Link each x-axis together.
        link: [{
          xAxisIndex: [0]
        }]
      },
      xAxes: Array.from(new Array(1)).map((_i, index) => ({
        gridIndex: index,
        type: 'time',
        show: false
      })),
      yAxes: [{
        // throughput
        gridIndex: 0,
        splitNumber: 4,
        axisLabel: {
          formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber,
          color: theme.chartLabel
        },
        ...axisLineConfig
      }, {
        // throughput
        gridIndex: 0,
        splitNumber: 4,
        axisLabel: {
          formatter: sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatAbbreviatedNumber,
          color: theme.chartLabel
        },
        ...axisLineConfig
      }],
      utc,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      colors: [colors[0], theme.gray300],
      tooltip: {
        trigger: 'axis',
        truncate: 80,
        valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_20__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.aggregateOutputType)(label)),

        nameFormatter(value) {
          return value === 'epm()' ? 'tpm()' : value;
        }

      }
    };
    return chartOptions;
  }

  const chartOptions = {
    height: 300,
    grid: [{
      top: '60px',
      left: '10px',
      right: '10px',
      height: '100px'
    }, {
      top: '220px',
      left: '10px',
      right: '10px',
      height: '100px'
    }],
    axisPointer: {
      // Link each x-axis together.
      link: [{
        xAxisIndex: [0, 1]
      }]
    },
    xAxes: Array.from(new Array(2)).map((_i, index) => ({
      gridIndex: index,
      type: 'time',
      show: false
    })),
    yAxes: [{
      // apdex
      gridIndex: 0,
      interval: 0.2,
      axisLabel: {
        formatter: value => `${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatFloat)(value, 1)}`,
        color: theme.chartLabel
      },
      ...axisLineConfig
    }, {
      // failure rate
      gridIndex: 1,
      splitNumber: 4,
      interval: 0.5,
      max: 1.0,
      axisLabel: {
        formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_22__.formatPercentage)(value, 0),
        color: theme.chartLabel
      },
      ...axisLineConfig
    }],
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[1], colors[2]],
    tooltip: {
      trigger: 'axis',
      truncate: 80,
      valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_20__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.aggregateOutputType)(label)),

      nameFormatter(value) {
        return value === 'epm()' ? 'tpm()' : value;
      }

    }
  };
  return chartOptions;
}
/**
 * Temporary function to remove 0 values from beginning and end of the metrics time series.
 * TODO(): Fix the data coming back from the api so it's consistent with existing count data.
 */


function trimLeadingTrailingZeroCounts(series) {
  if (!(series !== null && series !== void 0 && series.data)) {
    return undefined;
  }

  if (series.data[0] && series.data[0].value === 0) {
    series.data.shift();
  }

  if (series.data[series.data.length - 1] && series.data[series.data.length - 1].value === 0) {
    series.data.pop();
  }

  return series;
}

const ALLOWED_QUERY_KEYS = ['transaction.op', 'transaction'];

function SidebarChartsContainer(_ref6) {
  let {
    location,
    eventView,
    organization,
    router,
    isLoading,
    error,
    totals,
    transactionName,
    isShowingMetricsEventCount
  } = _ref6;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_26__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_30__.a)();
  const metricsCardinality = (0,sentry_utils_performance_contexts_metricsCardinality__WEBPACK_IMPORTED_MODULE_24__.useMetricsCardinalityContext)();
  const statsPeriod = eventView.statsPeriod;
  const start = eventView.start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_19__.getUtcToLocalDateObject)(eventView.start) : undefined;
  const end = eventView.end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_19__.getUtcToLocalDateObject)(eventView.end) : undefined;
  const project = eventView.project;
  const environment = eventView.environment;
  const query = eventView.query;
  const utc = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_14__.normalizeDateTimeParams)(location.query).utc === 'true';
  const chartOptions = getSideChartsOptions({
    theme,
    utc,
    isShowingMetricsEventCount
  });
  const requestCommonProps = {
    api,
    start,
    end,
    period: statsPeriod,
    project,
    environment,
    query
  };
  const contentCommonProps = {
    organization,
    router,
    error,
    isLoading,
    start,
    end,
    utc,
    totals
  };
  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod
  };
  const yAxis = isShowingMetricsEventCount ? ['count()', 'tpm()'] : ['apdex()', 'failure_rate()'];
  const requestProps = { ...requestCommonProps,
    organization,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_13__.getInterval)(datetimeSelection),
    showLoading: false,
    includePrevious: false,
    yAxis,
    partial: true,
    referrer: 'api.performance.transaction-summary.sidebar-chart'
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_8__["default"], { ...requestProps,
    children: _ref7 => {
      let {
        results: eventsResults,
        errored,
        loading,
        reloading
      } = _ref7;

      const _results = isShowingMetricsEventCount ? (eventsResults || []).slice(0, 1) : eventsResults;

      const series = _results ? _results.map((values, i) => ({ ...values,
        yAxisIndex: i,
        xAxisIndex: i
      })) : [];
      const metricsCompatibleQueryProps = { ...requestProps
      };
      const eventsQuery = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_25__.MutableSearch(query);
      const compatibleQuery = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_25__.MutableSearch('');

      for (const queryKey of ALLOWED_QUERY_KEYS) {
        if (eventsQuery.hasFilter(queryKey)) {
          compatibleQuery.setFilterValues(queryKey, eventsQuery.getFilterValues(queryKey));
        }
      }

      metricsCompatibleQueryProps.query = compatibleQuery.formatString();
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_8__["default"], { ...metricsCompatibleQueryProps,
        api: new sentry_api__WEBPACK_IMPORTED_MODULE_5__.Client(),
        queryExtras: (0,_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_28__.getMetricOnlyQueryParams)(),
        children: metricsChartData => {
          const metricSeries = metricsChartData.results ? metricsChartData.results.map((values, i) => ({ ...values,
            yAxisIndex: i,
            xAxisIndex: i
          })) : [];
          const chartData = {
            series,
            errored,
            loading,
            reloading,
            chartOptions
          };
          const _metricsChartData = { ...metricsChartData,
            series: metricSeries,
            chartOptions
          };

          if (isShowingMetricsEventCount && metricSeries.length) {
            const countSeries = series[0];

            if (countSeries) {
              countSeries.seriesName = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Indexed Events');
              const trimmed = trimLeadingTrailingZeroCounts(countSeries);

              if (trimmed) {
                series[0] = { ...countSeries,
                  ...trimmed
                };
              }
            }

            const {
              missingMetrics
            } = getDatasetCounts({
              chartData,
              metricsChartData: _metricsChartData,
              metricsCardinality
            });
            const metricsCountSeries = metricSeries[0];

            if (!missingMetrics) {
              if (metricsCountSeries) {
                metricsCountSeries.seriesName = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Processed Events');
                metricsCountSeries.lineStyle = {
                  type: 'dashed',
                  width: 1.5
                };
                const trimmed = trimLeadingTrailingZeroCounts(metricsCountSeries);

                if (trimmed) {
                  metricSeries[0] = { ...metricsCountSeries,
                    ...trimmed
                  };
                }
              }

              series.push(metricsCountSeries);
            }
          }

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(SidebarCharts, { ...contentCommonProps,
            transactionName: transactionName,
            location: location,
            eventView: eventView,
            chartData: chartData,
            isShowingMetricsEventCount: isShowingMetricsEventCount,
            metricsChartData: _metricsChartData
          });
        }
      });
    }
  });
}

SidebarChartsContainer.displayName = "SidebarChartsContainer";

function ChartSummaryValue(_ref8) {
  let {
    error,
    isLoading,
    value,
    ...props
  } = _ref8;

  if (error) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)("div", { ...props,
      children: '\u2014'
    });
  }

  if (isLoading) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"], {
      height: "24px",
      ...props
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartValue, { ...props,
    children: value
  });
}

ChartSummaryValue.displayName = "ChartSummaryValue";

const RelativeBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h72ow73"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const ChartTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__.SectionHeading,  true ? {
  target: "e1h72ow72"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const ChartLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h72ow71"
} : 0)("position:absolute;top:", p => p.top, ";z-index:1;" + ( true ? "" : 0));

const ChartValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h72ow70"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(SidebarChartsContainer));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/statusBreakdown.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/statusBreakdown.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_breakdownBars__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/breakdownBars */ "./app/components/charts/breakdownBars.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















function StatusBreakdown(_ref) {
  let {
    eventView,
    location,
    organization
  } = _ref;
  const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
  const breakdownView = eventView.withColumns([{
    kind: 'function',
    function: ['count', '', '', undefined]
  }, {
    kind: 'field',
    field: 'transaction.status'
  }]).withSorts([{
    kind: 'desc',
    field: 'count'
  }]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_6__.SectionHeading, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Status Breakdown'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
        position: "top",
        title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_15__.PERFORMANCE_TERM.STATUS_BREAKDOWN),
        size: "sm"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__["default"], {
      eventView: breakdownView,
      location: location,
      orgSlug: organization.slug,
      referrer: "api.performance.status-breakdown",
      useEvents: useEvents,
      children: _ref2 => {
        let {
          isLoading,
          error,
          tableData
        } = _ref2;

        if (isLoading) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_8__["default"], {
            height: "124px"
          });
        }

        if (error) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
            height: "124px",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconWarning, {
              color: "gray300",
              size: "lg"
            })
          });
        }

        if (!tableData || tableData.data.length === 0) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(EmptyStatusBreakdown, {
            small: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No statuses found')
          });
        }

        const points = tableData.data.map(row => ({
          label: String(row['transaction.status']),
          value: parseInt(String(row[useEvents ? 'count()' : 'count']), 10),
          onClick: () => {
            const query = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__.MutableSearch(eventView.query);
            query.removeFilter('!transaction.status').setFilterValues('transaction.status', [row['transaction.status']]);
            react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
              pathname: location.pathname,
              query: { ...location.query,
                cursor: undefined,
                query: query.formatString()
              }
            });
            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_12__["default"])('performance_views.transaction_summary.status_breakdown_click', {
              organization,
              status: row['transaction.status']
            });
          }
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_charts_breakdownBars__WEBPACK_IMPORTED_MODULE_4__["default"], {
          data: points
        });
      }
    })]
  });
}

StatusBreakdown.displayName = "StatusBreakdown";

const EmptyStatusBreakdown = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1ilkz930"
} : 0)( true ? {
  name: "wwhhbg",
  styles: "height:124px;padding:50px 15%"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StatusBreakdown);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/suspectSpans.tsx":
/*!***************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/suspectSpans.tsx ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SuspectSpans)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_performance_suspectSpans_suspectSpansQuery__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/performance/suspectSpans/suspectSpansQuery */ "./app/utils/performance/suspectSpans/suspectSpansQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _transactionSpans_suspectSpansTable__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../transactionSpans/suspectSpansTable */ "./app/views/performance/transactionSummary/transactionSpans/suspectSpansTable.tsx");
/* harmony import */ var _transactionSpans_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../transactionSpans/types */ "./app/views/performance/transactionSummary/transactionSpans/types.tsx");
/* harmony import */ var _transactionSpans_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../transactionSpans/utils */ "./app/views/performance/transactionSummary/transactionSpans/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















const SPANS_CURSOR_NAME = 'spansCursor';
function SuspectSpans(props) {
  var _location$query;

  const {
    location,
    organization,
    eventView,
    totals,
    projectId,
    transactionName
  } = props;
  const sort = (0,_transactionSpans_utils__WEBPACK_IMPORTED_MODULE_14__.getSuspectSpanSortFromLocation)(location, 'spanSort');
  const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_10__.decodeScalar)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query[SPANS_CURSOR_NAME]);
  const sortedEventView = eventView.withColumns([...Object.values(_transactionSpans_types__WEBPACK_IMPORTED_MODULE_13__.SpanSortOthers), ...Object.values(_transactionSpans_types__WEBPACK_IMPORTED_MODULE_13__.SpanSortPercentiles)].map(field => ({
    kind: 'field',
    field
  }))).withSorts([{
    kind: 'desc',
    field: sort.field
  }]);
  const fields = _transactionSpans_utils__WEBPACK_IMPORTED_MODULE_14__.SPAN_SORT_TO_FIELDS[sort.field];
  sortedEventView.fields = fields ? fields.map(field => ({
    field
  })) : [];
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_11__["default"])();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_utils_performance_suspectSpans_suspectSpansQuery__WEBPACK_IMPORTED_MODULE_9__["default"], {
    location: location,
    orgSlug: organization.slug,
    eventView: sortedEventView,
    limit: 4,
    perSuspect: 0,
    cursor: cursor,
    children: _ref => {
      let {
        suspectSpans,
        isLoading,
        pageLinks
      } = _ref;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SuspectSpansHeader, {
          location: location,
          organization: organization,
          projectId: projectId,
          transactionName: transactionName,
          pageLinks: pageLinks
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_transactionSpans_suspectSpansTable__WEBPACK_IMPORTED_MODULE_12__["default"], {
          location: location,
          organization: organization,
          transactionName: transactionName,
          project: projects.find(p => p.id === projectId),
          isLoading: isLoading,
          suspectSpans: suspectSpans !== null && suspectSpans !== void 0 ? suspectSpans : [],
          totals: totals,
          sort: _transactionSpans_types__WEBPACK_IMPORTED_MODULE_13__.SpanSortOthers.SUM_EXCLUSIVE_TIME
        })]
      });
    }
  });
}
SuspectSpans.displayName = "SuspectSpans";

function SuspectSpansHeader(props) {
  const {
    location,
    organization,
    projectId,
    transactionName,
    pageLinks
  } = props;
  const viewAllTarget = (0,_transactionSpans_utils__WEBPACK_IMPORTED_MODULE_14__.spansRouteWithQuery)({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: projectId,
    query: location.query
  });

  const handleCursor = (cursor, pathname, query) => {
    react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
      pathname,
      query: { ...query,
        [SPANS_CURSOR_NAME]: cursor
      }
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Header, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_5__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Suspect Spans')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
      to: viewAllTarget,
      size: "xs",
      "data-test-id": "suspect-spans-open-tab",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('View All Spans')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledPagination, {
      pageLinks: pageLinks,
      onCursor: handleCursor,
      size: "xs"
    })]
  });
}

SuspectSpansHeader.displayName = "SuspectSpansHeader";

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e96e1ws1"
} : 0)("display:grid;grid-template-columns:1fr auto auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e96e1ws0"
} : 0)("margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/userStats.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/userStats.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_userMisery__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/userMisery */ "./app/components/userMisery.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionVitals_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionVitals/utils */ "./app/views/performance/transactionSummary/transactionVitals/utils.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var sentry_views_performance_vitalDetail_vitalInfo__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/performance/vitalDetail/vitalInfo */ "./app/views/performance/vitalDetail/vitalInfo.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















function UserStats(_ref) {
  let {
    isLoading,
    hasWebVitals,
    error,
    totals,
    location,
    organization,
    transactionName,
    eventView
  } = _ref;
  const useAggregateAlias = !organization.features.includes('performance-frontend-use-events-endpoint');
  let userMisery = error !== null ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
    children: '\u2014'
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"], {
    height: "34px"
  });

  if (!isLoading && error === null && totals) {
    const threshold = totals.project_threshold_config[1];
    const miserableUsers = useAggregateAlias ? totals.count_miserable_user : totals['count_miserable_user()'];
    const userMiseryScore = useAggregateAlias ? totals.user_misery : totals['user_misery()'];
    const totalUsers = useAggregateAlias ? totals.count_unique_user : totals['count_unique_user()'];
    userMisery = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_userMisery__WEBPACK_IMPORTED_MODULE_7__["default"], {
      bars: 40,
      barHeight: 30,
      userMisery: userMiseryScore,
      miseryLimit: threshold,
      totalUsers: totalUsers,
      miserableUsers: miserableUsers
    });
  }

  const orgSlug = organization.slug;
  const webVitalsTarget = (0,sentry_views_performance_transactionSummary_transactionVitals_utils__WEBPACK_IMPORTED_MODULE_13__.vitalsRouteWithQuery)({
    orgSlug,
    transaction: transactionName,
    projectID: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_11__.decodeScalar)(location.query.project),
    query: location.query
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [hasWebVitals && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(VitalsHeading, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Web Vitals'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Web Vitals with p75 better than the "poor" threshold, as defined by Google Web Vitals.'),
            size: "sm"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"], {
          to: webVitalsTarget,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconOpen, {})
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_performance_vitalDetail_vitalInfo__WEBPACK_IMPORTED_MODULE_15__["default"], {
        location: location,
        vital: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.LCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.FID, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.CLS],
        orgSlug: orgSlug,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        project: eventView.project,
        hideVitalThresholds: true,
        hideDurationDetail: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_14__.SidebarSpacer, {})]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('User Misery'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
        position: "top",
        title: (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_12__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_12__.PERFORMANCE_TERM.USER_MISERY),
        size: "sm"
      })]
    }), userMisery, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_14__.SidebarSpacer, {})]
  });
}

UserStats.displayName = "UserStats";

const VitalsHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11vlg4d0"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (UserStats);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ZoomKeys": () => (/* binding */ ZoomKeys),
/* harmony export */   "generateSpanDetailsRoute": () => (/* binding */ generateSpanDetailsRoute),
/* harmony export */   "spanDetailsRouteWithQuery": () => (/* binding */ spanDetailsRouteWithQuery)
/* harmony export */ });
function generateSpanDetailsRoute(_ref) {
  let {
    orgSlug,
    spanSlug
  } = _ref;
  const spanComponent = `${encodeURIComponent(spanSlug.op)}:${spanSlug.group}`;
  return `/organizations/${orgSlug}/performance/summary/spans/${spanComponent}/`;
}
function spanDetailsRouteWithQuery(_ref2) {
  let {
    orgSlug,
    transaction,
    query,
    spanSlug,
    projectID
  } = _ref2;
  const pathname = generateSpanDetailsRoute({
    orgSlug,
    spanSlug
  });
  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query
    }
  };
}
let ZoomKeys;

(function (ZoomKeys) {
  ZoomKeys["MIN"] = "min";
  ZoomKeys["MAX"] = "max";
})(ZoomKeys || (ZoomKeys = {}));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionSpans/suspectSpansTable.tsx":
/*!*****************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionSpans/suspectSpansTable.tsx ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SuspectSpansTable)
/* harmony export */ });
/* harmony import */ var sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/gridEditable */ "./app/components/gridEditable/index.tsx");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/styles */ "./app/utils/discover/styles.tsx");
/* harmony import */ var _spanDetails_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./spanDetails/utils */ "./app/views/performance/transactionSummary/transactionSpans/spanDetails/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./types */ "./app/views/performance/transactionSummary/transactionSpans/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function SuspectSpansTable(props) {
  const {
    location,
    organization,
    transactionName,
    isLoading,
    suspectSpans,
    totals,
    sort,
    project
  } = props;
  const data = suspectSpans.map(suspectSpan => ({
    operation: suspectSpan.op,
    group: suspectSpan.group,
    description: suspectSpan.description,
    totalCount: suspectSpan.count,
    frequency: // Frequency is computed using the `uniq` function in ClickHouse.
    // Because it is an approximation, it can occasionally exceed the number of events.
    (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(suspectSpan.frequency) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_4__.defined)(totals === null || totals === void 0 ? void 0 : totals['count()']) ? Math.min(1, suspectSpan.frequency / totals['count()']) : null,
    avgOccurrences: suspectSpan.avgOccurrences,
    p50ExclusiveTime: suspectSpan.p50ExclusiveTime,
    p75ExclusiveTime: suspectSpan.p75ExclusiveTime,
    p95ExclusiveTime: suspectSpan.p95ExclusiveTime,
    p99ExclusiveTime: suspectSpan.p99ExclusiveTime,
    sumExclusiveTime: suspectSpan.sumExclusiveTime
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__["default"], {
    isLoading: isLoading,
    data: data,
    columnOrder: COLUMN_ORDER[sort].map(column => COLUMNS[column]),
    columnSortBy: [],
    grid: {
      renderHeadCell,
      renderBodyCell: renderBodyCellWithMeta(location, organization, transactionName, project)
    },
    location: location
  });
}
SuspectSpansTable.displayName = "SuspectSpansTable";

function renderHeadCell(column, _index) {
  const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.fieldAlignment)(column.key, COLUMN_TYPE[column.key]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: column.name,
    align: align,
    direction: undefined,
    canSort: false,
    generateSortLink: () => undefined
  });
}

renderHeadCell.displayName = "renderHeadCell";

function renderBodyCellWithMeta(location, organization, transactionName, project) {
  return (column, dataRow) => {
    const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_5__.getFieldRenderer)(column.key, COLUMN_TYPE);

    if (column.key === 'description') {
      var _dataRow$column$key;

      const target = (0,_spanDetails_utils__WEBPACK_IMPORTED_MODULE_8__.spanDetailsRouteWithQuery)({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {
          op: dataRow.operation,
          group: dataRow.group
        },
        projectID: project === null || project === void 0 ? void 0 : project.id
      });
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_utils_discover_styles__WEBPACK_IMPORTED_MODULE_7__.Container, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], {
          to: target,
          children: (_dataRow$column$key = dataRow[column.key]) !== null && _dataRow$column$key !== void 0 ? _dataRow$column$key : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('(unnamed span)')
        })
      });
    }

    return fieldRenderer(dataRow, {
      location,
      organization
    });
  };
}

const COLUMN_ORDER = {
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortOthers.COUNT]: ['operation', 'description', 'totalCount', 'frequency', 'p75ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortOthers.AVG_OCCURRENCE]: ['operation', 'description', 'avgOccurrences', 'frequency', 'p75ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortOthers.SUM_EXCLUSIVE_TIME]: ['operation', 'description', 'totalCount', 'frequency', 'p75ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortPercentiles.P50_EXCLUSIVE_TIME]: ['operation', 'description', 'totalCount', 'frequency', 'p50ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortPercentiles.P75_EXCLUSIVE_TIME]: ['operation', 'description', 'totalCount', 'frequency', 'p75ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortPercentiles.P95_EXCLUSIVE_TIME]: ['operation', 'description', 'totalCount', 'frequency', 'p95ExclusiveTime', 'sumExclusiveTime'],
  [_types__WEBPACK_IMPORTED_MODULE_9__.SpanSortPercentiles.P99_EXCLUSIVE_TIME]: ['operation', 'description', 'totalCount', 'frequency', 'p99ExclusiveTime', 'sumExclusiveTime']
};
const COLUMNS = {
  operation: {
    key: 'operation',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Span Operation'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  description: {
    key: 'description',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Span Name'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  totalCount: {
    key: 'totalCount',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Total Count'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  frequency: {
    key: 'frequency',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Frequency'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  avgOccurrences: {
    key: 'avgOccurrences',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Average Occurrences'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  p50ExclusiveTime: {
    key: 'p50ExclusiveTime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('P50 Self Time'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  p75ExclusiveTime: {
    key: 'p75ExclusiveTime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('P75 Self Time'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  p95ExclusiveTime: {
    key: 'p95ExclusiveTime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('P95 Self Time'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  p99ExclusiveTime: {
    key: 'p99ExclusiveTime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('P99 Self Time'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  },
  sumExclusiveTime: {
    key: 'sumExclusiveTime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Total Self Time'),
    width: sentry_components_gridEditable__WEBPACK_IMPORTED_MODULE_0__.COL_WIDTH_UNDEFINED
  }
};
const COLUMN_TYPE = {
  operation: 'string',
  description: 'string',
  totalCount: 'integer',
  frequency: 'percentage',
  avgOccurrences: 'number',
  p50ExclusiveTime: 'duration',
  p75ExclusiveTime: 'duration',
  p95ExclusiveTime: 'duration',
  p99ExclusiveTime: 'duration',
  sumExclusiveTime: 'duration'
};

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionVitals/constants.tsx":
/*!**********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionVitals/constants.tsx ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/performance/vitalDetail/vitalInfo.tsx":
/*!*********************************************************!*\
  !*** ./app/views/performance/vitalDetail/vitalInfo.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/performance/vitals/vitalsCardsDiscoverQuery */ "./app/utils/performance/vitals/vitalsCardsDiscoverQuery.tsx");
/* harmony import */ var _landing_vitalsCards__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../landing/vitalsCards */ "./app/views/performance/landing/vitalsCards.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function VitalInfo(_ref) {
  let {
    vital,
    location,
    isLoading,
    hideBar,
    hideStates,
    hideVitalPercentNames,
    hideVitalThresholds,
    hideDurationDetail
  } = _ref;
  const vitals = Array.isArray(vital) ? vital : [vital];
  const contentCommonProps = {
    vital,
    showBar: !hideBar,
    showStates: !hideStates,
    showVitalPercentNames: !hideVitalPercentNames,
    showVitalThresholds: !hideVitalThresholds,
    showDurationDetail: !hideDurationDetail
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_utils_performance_vitals_vitalsCardsDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], {
    location: location,
    vitals: vitals,
    children: _ref2 => {
      let {
        isLoading: loading,
        vitalsData
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_landing_vitalsCards__WEBPACK_IMPORTED_MODULE_1__.VitalBar, { ...contentCommonProps,
        isLoading: isLoading || loading,
        data: vitalsData
      });
    }
  });
}

VitalInfo.displayName = "VitalInfo";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VitalInfo);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionSummary_transactionOverview_index_tsx.b3a922e48211648c893396aa8e057d76.js.map