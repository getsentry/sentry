"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_banner_tsx-app_components_charts_eventsRequest_tsx-app_utils_discover_charts_tsx"],{

/***/ "./app/components/banner.tsx":
/*!***********************************!*\
  !*** ./app/components/banner.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const makeKey = prefix => `${prefix}-banner-dismissed`;

function dismissBanner(bannerKey) {
  localStorage.setItem(makeKey(bannerKey), 'true');
}

function useDismissable(bannerKey) {
  const key = makeKey(bannerKey);
  const [value, setValue] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(localStorage.getItem(key));

  const dismiss = () => {
    setValue('true');
    dismissBanner(bannerKey);
  };

  return [value === 'true', dismiss];
}

const Banner = _ref => {
  let {
    title,
    subtitle,
    isDismissable = true,
    dismissKey = 'generic-banner',
    className,
    backgroundImg,
    backgroundComponent,
    children
  } = _ref;
  const [dismissed, dismiss] = useDismissable(dismissKey);

  if (dismissed) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(BannerWrapper, {
    backgroundImg: backgroundImg,
    className: className,
    children: [backgroundComponent, isDismissable ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(CloseButton, {
      onClick: dismiss,
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Close')
    }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(BannerContent, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BannerTitle, {
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BannerSubtitle, {
        children: subtitle
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledButtonBar, {
        gap: 1,
        children: children
      })]
    })]
  });
};

Banner.displayName = "Banner";
Banner.dismiss = dismissBanner;

const BannerWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8az5815"
} : 0)(p => p.backgroundImg ? /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.css)("background:url(", p.backgroundImg, ");background-repeat:no-repeat;background-size:cover;background-position:center center;" + ( true ? "" : 0),  true ? "" : 0) : /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_9__.css)("background-color:", p.theme.gray500, ";" + ( true ? "" : 0),  true ? "" : 0), " display:flex;overflow:hidden;align-items:center;justify-content:center;position:relative;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";box-shadow:", p => p.theme.dropShadowLight, ";border-radius:", p => p.theme.borderRadius, ";height:180px;color:", p => p.theme.white, ";@media (min-width: ", p => p.theme.breakpoints.small, "){height:220px;}" + ( true ? "" : 0));

const BannerContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8az5814"
} : 0)("position:absolute;display:grid;justify-items:center;grid-template-rows:repeat(3, max-content);text-align:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(4), ";" + ( true ? "" : 0));

const BannerTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h1',  true ? {
  target: "e8az5813"
} : 0)("margin:0;@media (min-width: ", p => p.theme.breakpoints.small, "){font-size:40px;}" + ( true ? "" : 0));

const BannerSubtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8az5812"
} : 0)("margin:0;@media (min-width: ", p => p.theme.breakpoints.small, "){font-size:", p => p.theme.fontSizeExtraLarge, ";}" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e8az5811"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";width:fit-content;" + ( true ? "" : 0));

const CloseButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e8az5810"
} : 0)("position:absolute;display:block;top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";color:", p => p.theme.white, ";cursor:pointer;z-index:1;" + ( true ? "" : 0));

CloseButton.defaultProps = {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconClose, {}),
  ['aria-label']: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Close'),
  priority: 'link',
  borderless: true,
  size: 'xs'
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Banner);

/***/ }),

/***/ "./app/components/charts/eventsRequest.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/eventsRequest.tsx ***!
  \*************************************************/
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

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_banner_tsx-app_components_charts_eventsRequest_tsx-app_utils_discover_charts_tsx.aab534549d3431c3c8e205116bd69025.js.map