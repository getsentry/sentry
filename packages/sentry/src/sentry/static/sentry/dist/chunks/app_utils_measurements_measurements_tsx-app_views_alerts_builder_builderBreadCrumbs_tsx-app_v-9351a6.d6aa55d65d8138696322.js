"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_utils_measurements_measurements_tsx-app_views_alerts_builder_builderBreadCrumbs_tsx-app_v-9351a6"],{

/***/ "./app/components/charts/components/graphic.tsx":
/*!******************************************************!*\
  !*** ./app/components/charts/components/graphic.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Graphic)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_graphic__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/graphic */ "../node_modules/echarts/lib/component/graphic.js");


/**
 * eCharts graphic
 *
 * See https://echarts.apache.org/en/option.html#graphic
 */
function Graphic(props) {
  return props;
}

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

/***/ "./app/components/charts/optionSelector.tsx":
/*!**************************************************!*\
  !*** ./app/components/charts/optionSelector.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/truncate */ "./app/components/truncate.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function OptionSelector(_ref) {
  let {
    options,
    onChange,
    selected,
    title,
    featureType,
    multiple,
    ...rest
  } = _ref;
  const mappedOptions = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    return options.map(opt => ({ ...opt,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_truncate__WEBPACK_IMPORTED_MODULE_5__["default"], {
        value: String(opt.label),
        maxLength: 60,
        expandDirection: "left"
      })
    }));
  }, [options]);

  function onValueChange(option) {
    onChange(multiple ? option.map(o => o.value) : option.value);
  }

  function isOptionDisabled(option) {
    return (// Option is explicitly marked as disabled
      option.disabled || // The user has reached the maximum number of selections (3), and the option hasn't
      // yet been selected. These options should be disabled to visually indicate that the
      // user has reached the max.
      multiple && selected.length === 3 && !selected.includes(option.value)
    );
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__["default"], {
    size: "sm",
    options: mappedOptions,
    value: selected,
    onChange: onValueChange,
    isOptionDisabled: isOptionDisabled,
    multiple: multiple,
    triggerProps: {
      borderless: true,
      prefix: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [title, (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(featureType) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledFeatureBadge, {
          type: featureType
        }) : null]
      })
    },
    placement: "bottom right",
    ...rest
  });
}

OptionSelector.displayName = "OptionSelector";

const StyledFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1a4edto0"
} : 0)( true ? {
  name: "6og82r",
  styles: "margin-left:0px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OptionSelector);

/***/ }),

/***/ "./app/components/numberDragControl.tsx":
/*!**********************************************!*\
  !*** ./app/components/numberDragControl.tsx ***!
  \**********************************************/
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
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










class NumberDragControl extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isClicked: false
    });
  }

  render() {
    const {
      onChange,
      axis,
      step,
      shiftStep,
      ...props
    } = this.props;
    const isX = (axis !== null && axis !== void 0 ? axis : 'x') === 'x';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Wrapper, { ...props,
      onMouseDown: event => {
        if (event.button !== 0) {
          return;
        } // XXX(epurkhiser): We can remove this later, just curious if people
        // are actually using the drag control


        (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.trackAnalyticsEvent)({
          eventName: 'Number Drag Control: Clicked',
          eventKey: 'number_drag_control.clicked',
          organization_id: null
        });
        event.currentTarget.requestPointerLock();
        this.setState({
          isClicked: true
        });
      },
      onMouseUp: () => {
        document.exitPointerLock();
        this.setState({
          isClicked: false
        });
      },
      onMouseMove: event => {
        var _ref;

        if (!this.state.isClicked) {
          return;
        }

        const delta = isX ? event.movementX : event.movementY * -1;
        const deltaOne = delta > 0 ? Math.ceil(delta / 100) : Math.floor(delta / 100);
        const deltaStep = deltaOne * ((_ref = event.shiftKey ? shiftStep : step) !== null && _ref !== void 0 ? _ref : 1);
        onChange(deltaStep, event);
      },
      isActive: this.state.isClicked,
      isX: isX,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
        direction: isX ? 'left' : 'up',
        size: "8px"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
        direction: isX ? 'right' : 'down',
        size: "8px"
      })]
    });
  }

}

NumberDragControl.displayName = "NumberDragControl";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1l792q50"
} : 0)("display:grid;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";", p => p.isX ? 'grid-template-columns: max-content max-content' : 'grid-template-rows: max-content max-content', ";cursor:", p => p.isX ? 'ew-resize' : 'ns-resize', ";color:", p => p.isActive ? p.theme.gray500 : p.theme.gray300, ";background:", p => p.isActive && p.theme.backgroundSecondary, ";border-radius:2px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NumberDragControl);

/***/ }),

/***/ "./app/components/selectMembers/index.tsx":
/*!************************************************!*\
  !*** ./app/components/selectMembers/index.tsx ***!
  \************************************************/
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
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const getSearchKeyForUser = user => `${user.email && user.email.toLowerCase()} ${user.name && user.name.toLowerCase()}`;

/**
 * A component that allows you to select either members and/or teams
 */
class SelectMembers extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false,
      inputValue: '',
      options: null,
      memberListLoading: !sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__["default"].isLoaded()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unlisteners", [sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__["default"].listen(() => {
      this.setState({
        memberListLoading: !sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__["default"].isLoaded()
      });
    }, undefined)]);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderUserBadge", user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_6__["default"], {
      avatarSize: 24,
      user: user,
      hideEmail: true,
      useLink: false
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createMentionableUser", user => ({
      value: user.id,
      label: this.renderUserBadge(user),
      searchKey: getSearchKeyForUser(user),
      actor: {
        type: 'user',
        id: user.id,
        name: user.name
      }
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createUnmentionableUser", _ref => {
      let {
        user
      } = _ref;
      return { ...this.createMentionableUser(user),
        disabled: true,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DisabledLabel, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
            position: "left",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('%s is not a member of project', user.name || user.email),
            children: this.renderUserBadge(user)
          })
        })
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", newValue => {
      this.props.onChange(newValue);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInputChange", inputValue => {
      this.setState({
        inputValue
      });

      if (this.props.onInputChange) {
        this.props.onInputChange(inputValue);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "queryMembers", lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()((query, cb) => {
      const {
        api,
        organization
      } = this.props; // Because this function is debounced, the component can potentially be
      // unmounted before this fires, in which case, `api` is null

      if (!api) {
        return null;
      }

      return api.requestPromise(`/organizations/${organization.slug}/members/`, {
        query: {
          query
        }
      }).then(data => cb(null, data), err => cb(err));
    }, 250));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLoadOptions", () => {
      const usersInProject = this.getMentionableUsers();
      const usersInProjectById = usersInProject.map(_ref2 => {
        let {
          actor
        } = _ref2;
        return actor.id;
      }); // Return a promise for `react-select`

      return new Promise((resolve, reject) => {
        this.queryMembers(this.state.inputValue, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      }).then(members => // Be careful here as we actually want the `users` object, otherwise it means user
      // has not registered for sentry yet, but has been invited
      members ? members.filter(_ref3 => {
        let {
          user
        } = _ref3;
        return user && usersInProjectById.indexOf(user.id) === -1;
      }).map(this.createUnmentionableUser) : []).then(members => {
        const options = [...usersInProject, ...members];
        this.setState({
          options
        });
        return options;
      });
    });
  }

  componentWillUnmount() {
    this.unlisteners.forEach(sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_10__.callIfFunction);
  }

  getMentionableUsers() {
    return sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_9__["default"].getAll().map(this.createMentionableUser);
  }

  render() {
    var _this$state$options;

    const {
      placeholder,
      styles
    } = this.props; // If memberList is still loading we need to disable a placeholder Select,
    // otherwise `react-select` will call `loadOptions` and prematurely load
    // options

    if (this.state.memberListLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledSelectControl, {
        isDisabled: true,
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Loading')
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledSelectControl, {
      filterOption: (option, filterText) => {
        var _option$data, _option$data$searchKe;

        return (option === null || option === void 0 ? void 0 : (_option$data = option.data) === null || _option$data === void 0 ? void 0 : (_option$data$searchKe = _option$data.searchKey) === null || _option$data$searchKe === void 0 ? void 0 : _option$data$searchKe.indexOf(filterText)) > -1;
      },
      loadOptions: this.handleLoadOptions,
      defaultOptions: true,
      async: true,
      isDisabled: this.props.disabled,
      cacheOptions: false,
      placeholder: placeholder,
      onInputChange: this.handleInputChange,
      onChange: this.handleChange,
      value: (_this$state$options = this.state.options) === null || _this$state$options === void 0 ? void 0 : _this$state$options.find(_ref4 => {
        let {
          value
        } = _ref4;
        return value === this.props.value;
      }),
      styles: { ...(styles !== null && styles !== void 0 ? styles : {}),
        option: (provided, state) => ({ ...provided,
          svg: {
            color: state.isSelected && state.theme.white
          }
        })
      }
    });
  }

}

SelectMembers.displayName = "SelectMembers";

const DisabledLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "efbhsy21"
} : 0)( true ? {
  name: "v6ye5b",
  styles: "display:flex;opacity:0.5;overflow:hidden"
} : 0);

const StyledSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "efbhsy20"
} : 0)( true ? {
  name: "1b41ikp",
  styles: ".Select-value{display:flex;align-items:center;}.Select-input{margin-left:32px;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__["default"])(SelectMembers));

/***/ }),

/***/ "./app/types/alerts.tsx":
/*!******************************!*\
  !*** ./app/types/alerts.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AssigneeTargetType": () => (/* binding */ AssigneeTargetType),
/* harmony export */   "MailActionTargetType": () => (/* binding */ MailActionTargetType)
/* harmony export */ });
/**
 * These templates that tell the UI how to render the action or condition
 * and what fields it needs
 */

/**
 * These are the action or condition data that the user is editing or has saved.
 */
// Issue-based alert rule
// Project's alert rule stats
let MailActionTargetType;

(function (MailActionTargetType) {
  MailActionTargetType["IssueOwners"] = "IssueOwners";
  MailActionTargetType["Team"] = "Team";
  MailActionTargetType["Member"] = "Member";
  MailActionTargetType["ReleaseMembers"] = "ReleaseMembers";
})(MailActionTargetType || (MailActionTargetType = {}));

let AssigneeTargetType;

(function (AssigneeTargetType) {
  AssigneeTargetType["Unassigned"] = "Unassigned";
  AssigneeTargetType["Team"] = "Team";
  AssigneeTargetType["Member"] = "Member";
})(AssigneeTargetType || (AssigneeTargetType = {}));

/***/ }),

/***/ "./app/utils/measurements/measurements.tsx":
/*!*************************************************!*\
  !*** ./app/utils/measurements/measurements.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getMeasurements": () => (/* binding */ getMeasurements)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function measurementsFromDetails(details) {
  return Object.fromEntries(Object.entries(details).map(_ref => {
    let [key, value] = _ref;
    const newValue = {
      name: value.name,
      key
    };
    return [key, newValue];
  }));
}

const MOBILE_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.MOBILE_VITAL_DETAILS);
const WEB_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.WEB_VITAL_DETAILS);
function getMeasurements() {
  return { ...WEB_MEASUREMENTS,
    ...MOBILE_MEASUREMENTS
  };
}

function Measurements(_ref2) {
  let {
    children
  } = _ref2;
  const measurements = getMeasurements();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      measurements
    })
  });
}

Measurements.displayName = "Measurements";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Measurements);

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

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

/***/ "./app/utils/routeTitle.tsx":
/*!**********************************!*\
  !*** ./app/utils/routeTitle.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/alerts/builder/builderBreadCrumbs.tsx":
/*!*********************************************************!*\
  !*** ./app/views/alerts/builder/builderBreadCrumbs.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function BuilderBreadCrumbs(_ref) {
  let {
    title,
    alertName,
    projectSlug,
    organization
  } = _ref;
  const crumbs = [{
    to: `/organizations/${organization.slug}/alerts/rules/`,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Alerts'),
    preservePageFilters: true
  }, {
    label: title,
    ...(alertName ? {
      to: `/organizations/${organization.slug}/alerts/${projectSlug}/wizard`,
      preservePageFilters: true
    } : {})
  }];

  if (alertName) {
    crumbs.push({
      label: alertName
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledBreadcrumbs, {
    crumbs: crumbs
  });
}

BuilderBreadCrumbs.displayName = "BuilderBreadCrumbs";

const StyledBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "eykqk0t0"
} : 0)("font-size:18px;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BuilderBreadCrumbs);

/***/ }),

/***/ "./app/views/alerts/rules/issue/index.tsx":
/*!************************************************!*\
  !*** ./app/views/alerts/rules/issue/index.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_48__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_onboardingTasks__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/actionCreators/onboardingTasks */ "./app/actionCreators/onboardingTasks.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/forms/field/fieldHelp */ "./app/components/forms/field/fieldHelp.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_environment__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! sentry/utils/environment */ "./app/utils/environment.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! sentry/views/alerts/utils/constants */ "./app/views/alerts/utils/constants.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_44__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _ruleNodeList__WEBPACK_IMPORTED_MODULE_45__ = __webpack_require__(/*! ./ruleNodeList */ "./app/views/alerts/rules/issue/ruleNodeList.tsx");
/* harmony import */ var _setupAlertIntegrationButton__WEBPACK_IMPORTED_MODULE_46__ = __webpack_require__(/*! ./setupAlertIntegrationButton */ "./app/views/alerts/rules/issue/setupAlertIntegrationButton.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














































const FREQUENCY_OPTIONS = [{
  value: '5',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('5 minutes')
}, {
  value: '10',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('10 minutes')
}, {
  value: '30',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('30 minutes')
}, {
  value: '60',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('60 minutes')
}, {
  value: '180',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('3 hours')
}, {
  value: '720',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('12 hours')
}, {
  value: '1440',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('24 hours')
}, {
  value: '10080',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('1 week')
}, {
  value: '43200',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('30 days')
}];
const ACTION_MATCH_OPTIONS = [{
  value: 'all',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('all')
}, {
  value: 'any',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('any')
}, {
  value: 'none',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('none')
}];
const ACTION_MATCH_OPTIONS_MIGRATED = [{
  value: 'all',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('all')
}, {
  value: 'any',
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('any')
}];
const defaultRule = {
  actionMatch: 'all',
  filterMatch: 'all',
  actions: [],
  conditions: [],
  filters: [],
  name: '',
  frequency: 30,
  environment: sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY
};
const POLLING_MAX_TIME_LIMIT = 3 * 60000;

function isSavedAlertRule(rule) {
  var _rule$hasOwnProperty;

  return (_rule$hasOwnProperty = rule === null || rule === void 0 ? void 0 : rule.hasOwnProperty('id')) !== null && _rule$hasOwnProperty !== void 0 ? _rule$hasOwnProperty : false;
}

class IssueRuleEditor extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_44__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pollingTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pollHandler", async quitTime => {
      if (Date.now() > quitTime) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Looking for that channel took too long :('));
        this.setState({
          loading: false
        });
        return;
      }

      const {
        organization
      } = this.props;
      const {
        uuid,
        project
      } = this.state;
      const origRule = this.state.rule;

      try {
        const response = await this.api.requestPromise(`/projects/${organization.slug}/${project.slug}/rule-task/${uuid}/`);
        const {
          status,
          rule,
          error
        } = response;

        if (status === 'pending') {
          window.clearTimeout(this.pollingTimeout);
          this.pollingTimeout = window.setTimeout(() => {
            this.pollHandler(quitTime);
          }, 1000);
          return;
        }

        if (status === 'failed') {
          this.setState({
            detailedError: {
              actions: [error ? error : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('An error occurred')]
            },
            loading: false
          });
          this.handleRuleSaveFailure((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('An error occurred'));
        }

        if (rule) {
          const ruleId = isSavedAlertRule(origRule) ? `${origRule.id}/` : '';
          const isNew = !ruleId;
          this.handleRuleSuccess(isNew, rule);
        }
      } catch {
        this.handleRuleSaveFailure((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('An error occurred'));
        this.setState({
          loading: false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRuleSuccess", (isNew, rule) => {
      const {
        organization,
        router
      } = this.props;
      const {
        project
      } = this.state;
      this.setState({
        detailedError: null,
        loading: false,
        rule
      }); // The onboarding task will be completed on the server side when the alert
      // is created

      (0,sentry_actionCreators_onboardingTasks__WEBPACK_IMPORTED_MODULE_11__.updateOnboardingTask)(null, organization, {
        task: sentry_types__WEBPACK_IMPORTED_MODULE_34__.OnboardingTaskKey.ALERT_RULE,
        status: 'complete'
      });
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_35__.metric.endTransaction({
        name: 'saveAlertRule'
      });
      router.push({
        pathname: `/organizations/${organization.slug}/alerts/rules/${project.slug}/${rule.id}/details/`
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addSuccessMessage)(isNew ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Created alert rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Updated alert rule'));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async () => {
      const {
        project,
        rule
      } = this.state;
      const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
      const isNew = !ruleId;
      const {
        organization
      } = this.props;
      const endpoint = `/projects/${organization.slug}/${project.slug}/rules/${ruleId}`;

      if (rule && rule.environment === sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY) {
        delete rule.environment;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addLoadingMessage)();

      try {
        const transaction = sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_35__.metric.startTransaction({
          name: 'saveAlertRule'
        });
        transaction.setTag('type', 'issue');
        transaction.setTag('operation', isNew ? 'create' : 'edit');

        if (rule) {
          for (const action of rule.actions) {
            // Grab the last part of something like 'sentry.mail.actions.NotifyEmailAction'
            const splitActionId = action.id.split('.');
            const actionName = splitActionId[splitActionId.length - 1];

            if (actionName === 'SlackNotifyServiceAction') {
              transaction.setTag(actionName, true);
            }
          }

          transaction.setData('actions', rule.actions);
        }

        const [data,, resp] = await this.api.requestPromise(endpoint, {
          includeAllArgs: true,
          method: isNew ? 'POST' : 'PUT',
          data: rule,
          query: {
            duplicateRule: this.isDuplicateRule ? 'true' : 'false',
            wizardV3: 'true'
          }
        }); // if we get a 202 back it means that we have an async task
        // running to lookup and verify the channel id for Slack.

        if ((resp === null || resp === void 0 ? void 0 : resp.status) === 202) {
          this.setState({
            detailedError: null,
            loading: true,
            uuid: data.uuid
          });
          this.fetchStatus();
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Looking through all your channels...'));
        } else {
          this.handleRuleSuccess(isNew, data);
        }
      } catch (err) {
        this.setState({
          detailedError: err.responseJSON || {
            __all__: 'Unknown error'
          },
          loading: false
        });
        this.handleRuleSaveFailure((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('An error occurred'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteRule", async () => {
      const {
        project,
        rule
      } = this.state;
      const ruleId = isSavedAlertRule(rule) ? `${rule.id}/` : '';
      const isNew = !ruleId;
      const {
        organization
      } = this.props;

      if (isNew) {
        return;
      }

      const endpoint = `/projects/${organization.slug}/${project.slug}/rules/${ruleId}`;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Deleting...'));

      try {
        await this.api.requestPromise(endpoint, {
          method: 'DELETE'
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Deleted alert rule'));
        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace((0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_39__["default"])('', { ...this.props,
          stepBack: -2
        }));
      } catch (err) {
        this.setState({
          detailedError: err.responseJSON || {
            __all__: 'Unknown error'
          }
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('There was a problem deleting the alert'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCancel", () => {
      const {
        organization,
        router
      } = this.props;
      router.push(`/organizations/${organization.slug}/alerts/rules/`);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "hasError", field => {
      const {
        detailedError
      } = this.state;

      if (!detailedError) {
        return false;
      }

      return detailedError.hasOwnProperty(field);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEnvironmentChange", val => {
      // If 'All Environments' is selected the value should be null
      if (val === sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY) {
        this.handleChange('environment', null);
      } else {
        this.handleChange('environment', val);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (prop, val) => {
      this.setState(prevState => {
        const clonedState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(prevState);
        lodash_set__WEBPACK_IMPORTED_MODULE_9___default()(clonedState, `rule[${prop}]`, val);
        return { ...clonedState,
          detailedError: lodash_omit__WEBPACK_IMPORTED_MODULE_8___default()(prevState.detailedError, prop)
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handlePropertyChange", (type, idx, prop, val) => {
      this.setState(prevState => {
        const clonedState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(prevState);
        lodash_set__WEBPACK_IMPORTED_MODULE_9___default()(clonedState, `rule[${type}][${idx}][${prop}]`, val);
        return clonedState;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getInitialValue", (type, id) => {
      var _this$state$configs, _this$state$configs$t;

      const configuration = (_this$state$configs = this.state.configs) === null || _this$state$configs === void 0 ? void 0 : (_this$state$configs$t = _this$state$configs[type]) === null || _this$state$configs$t === void 0 ? void 0 : _this$state$configs$t.find(c => c.id === id);
      const hasChangeAlerts = (configuration === null || configuration === void 0 ? void 0 : configuration.id) && this.props.organization.features.includes('change-alerts') && sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_43__.CHANGE_ALERT_CONDITION_IDS.includes(configuration.id);
      return configuration !== null && configuration !== void 0 && configuration.formFields ? Object.fromEntries(Object.entries(configuration.formFields) // TODO(ts): Doesn't work if I cast formField as IssueAlertRuleFormField
      .map(_ref => {
        var _formField$initial, _formField$choices, _formField$choices$;

        let [key, formField] = _ref;
        return [key, hasChangeAlerts && key === 'interval' ? '1h' : (_formField$initial = formField === null || formField === void 0 ? void 0 : formField.initial) !== null && _formField$initial !== void 0 ? _formField$initial : formField === null || formField === void 0 ? void 0 : (_formField$choices = formField.choices) === null || _formField$choices === void 0 ? void 0 : (_formField$choices$ = _formField$choices[0]) === null || _formField$choices$ === void 0 ? void 0 : _formField$choices$[0]];
      }).filter(_ref2 => {
        let [, initial] = _ref2;
        return !!initial;
      })) : {};
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetRow", (type, idx, prop, val) => {
      this.setState(prevState => {
        const clonedState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(prevState); // Set initial configuration, but also set

        const id = clonedState.rule[type][idx].id;
        const newRule = { ...this.getInitialValue(type, id),
          id,
          [prop]: val
        };
        lodash_set__WEBPACK_IMPORTED_MODULE_9___default()(clonedState, `rule[${type}][${idx}]`, newRule);
        return clonedState;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddRow", (type, id) => {
      this.setState(prevState => {
        const clonedState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(prevState); // Set initial configuration

        const newRule = { ...this.getInitialValue(type, id),
          id
        };
        const newTypeList = prevState.rule ? prevState.rule[type] : [];
        lodash_set__WEBPACK_IMPORTED_MODULE_9___default()(clonedState, `rule[${type}]`, [...newTypeList, newRule]);
        return clonedState;
      });
      const {
        organization
      } = this.props;
      const {
        project
      } = this.state;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_36__["default"])('edit_alert_rule.add_row', {
        organization,
        project_id: project.id,
        type,
        name: id
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteRow", (type, idx) => {
      this.setState(prevState => {
        const clonedState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_7___default()(prevState);
        const newTypeList = prevState.rule ? prevState.rule[type] : [];

        if (prevState.rule) {
          newTypeList.splice(idx, 1);
        }

        lodash_set__WEBPACK_IMPORTED_MODULE_9___default()(clonedState, `rule[${type}]`, newTypeList);
        return clonedState;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddCondition", id => this.handleAddRow('conditions', id));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddAction", id => this.handleAddRow('actions', id));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddFilter", id => this.handleAddRow('filters', id));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteCondition", ruleIndex => this.handleDeleteRow('conditions', ruleIndex));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteAction", ruleIndex => this.handleDeleteRow('actions', ruleIndex));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteFilter", ruleIndex => this.handleDeleteRow('filters', ruleIndex));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeConditionProperty", (ruleIndex, prop, val) => this.handlePropertyChange('conditions', ruleIndex, prop, val));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActionProperty", (ruleIndex, prop, val) => this.handlePropertyChange('actions', ruleIndex, prop, val));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeFilterProperty", (ruleIndex, prop, val) => this.handlePropertyChange('filters', ruleIndex, prop, val));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetCondition", (ruleIndex, prop, value) => this.handleResetRow('conditions', ruleIndex, prop, value));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetAction", (ruleIndex, prop, value) => this.handleResetRow('actions', ruleIndex, prop, value));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResetFilter", (ruleIndex, prop, value) => this.handleResetRow('filters', ruleIndex, prop, value));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleValidateRuleName", () => {
      var _this$state$rule;

      const isRuleNameEmpty = !((_this$state$rule = this.state.rule) !== null && _this$state$rule !== void 0 && _this$state$rule.name.trim());

      if (!isRuleNameEmpty) {
        return;
      }

      this.setState(prevState => ({
        detailedError: { ...prevState.detailedError,
          name: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Field Required')]
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTeamId", () => {
      const {
        rule
      } = this.state;
      const owner = rule === null || rule === void 0 ? void 0 : rule.owner; // ownership follows the format team:<id>, just grab the id

      return owner && owner.split(':')[1];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOwnerChange", _ref3 => {
      let {
        value
      } = _ref3;
      const ownerValue = value && `team:${value}`;
      this.handleChange('owner', ownerValue);
    });
  }

  get isDuplicateRule() {
    const {
      location
    } = this.props;
    const createFromDuplicate = (location === null || location === void 0 ? void 0 : location.query.createFromDuplicate) === 'true';
    return createFromDuplicate && (location === null || location === void 0 ? void 0 : location.query.duplicateRuleId);
  }

  componentWillUnmount() {
    window.clearTimeout(this.pollingTimeout);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.project.id === this.state.project.id) {
      return;
    }

    this.fetchEnvironments();
  }

  getTitle() {
    const {
      organization
    } = this.props;
    const {
      rule,
      project
    } = this.state;
    const ruleName = rule === null || rule === void 0 ? void 0 : rule.name;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_40__["default"])(ruleName ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Alert %s', ruleName) : '', organization.slug, false, project === null || project === void 0 ? void 0 : project.slug);
  }

  getDefaultState() {
    var _userTeamIds$find;

    const {
      userTeamIds,
      project
    } = this.props;
    const defaultState = { ...super.getDefaultState(),
      configs: null,
      detailedError: null,
      rule: { ...defaultRule
      },
      environments: [],
      uuid: null,
      project
    };
    const projectTeamIds = new Set(project.teams.map(_ref4 => {
      let {
        id
      } = _ref4;
      return id;
    }));
    const userTeamId = (_userTeamIds$find = userTeamIds.find(id => projectTeamIds.has(id))) !== null && _userTeamIds$find !== void 0 ? _userTeamIds$find : null;
    defaultState.rule.owner = userTeamId && `team:${userTeamId}`;
    return defaultState;
  }

  getEndpoints() {
    var _this$state$project, _this$state;

    const {
      location: {
        query
      },
      params: {
        ruleId,
        orgId
      }
    } = this.props; // project in state isn't initialized when getEndpoints is first called

    const project = (_this$state$project = (_this$state = this.state) === null || _this$state === void 0 ? void 0 : _this$state.project) !== null && _this$state$project !== void 0 ? _this$state$project : this.props.project;
    const endpoints = [['environments', `/projects/${orgId}/${project.slug}/environments/`, {
      query: {
        visibility: 'visible'
      }
    }], ['configs', `/projects/${orgId}/${project.slug}/rules/configuration/`], ['ownership', `/projects/${orgId}/${project.slug}/ownership/`]];

    if (ruleId) {
      endpoints.push(['rule', `/projects/${orgId}/${project.slug}/rules/${ruleId}/`]);
    }

    if (!ruleId && query.createFromDuplicate && query.duplicateRuleId) {
      endpoints.push(['duplicateTargetRule', `/projects/${orgId}/${project.slug}/rules/${query.duplicateRuleId}/`]);
    }

    return endpoints;
  }

  onRequestSuccess(_ref5) {
    let {
      stateKey,
      data
    } = _ref5;

    if (stateKey === 'rule' && data.name) {
      var _this$props$onChangeT, _this$props;

      (_this$props$onChangeT = (_this$props = this.props).onChangeTitle) === null || _this$props$onChangeT === void 0 ? void 0 : _this$props$onChangeT.call(_this$props, data.name);
    }

    if (stateKey === 'duplicateTargetRule') {
      this.setState({
        rule: { ...lodash_omit__WEBPACK_IMPORTED_MODULE_8___default()(data, ['id']),
          name: data.name + ' copy'
        }
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    const {
      rule
    } = this.state;

    if (rule) {
      ((rule === null || rule === void 0 ? void 0 : rule.errors) || []).map(_ref6 => {
        let {
          detail
        } = _ref6;
        return (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)(detail, {
          append: true
        });
      });
    }
  }

  fetchEnvironments() {
    const {
      params: {
        orgId
      }
    } = this.props;
    const {
      project
    } = this.state;
    this.api.requestPromise(`/projects/${orgId}/${project.slug}/environments/`, {
      query: {
        visibility: 'visible'
      }
    }).then(response => this.setState({
      environments: response
    })).catch(_err => (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Unable to fetch environments')));
  }

  fetchStatus() {
    // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.
    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    window.clearTimeout(this.pollingTimeout);
    this.pollingTimeout = window.setTimeout(() => {
      this.pollHandler(quitTime);
    }, 1000);
  }

  handleRuleSaveFailure(msg) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)(msg);
    sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_35__.metric.endTransaction({
      name: 'saveAlertRule'
    });
  }

  getConditions() {
    var _this$state$configs$c2, _this$state$configs3, _this$state$configs3$;

    const {
      organization
    } = this.props;

    if (!organization.features.includes('change-alerts')) {
      var _this$state$configs$c, _this$state$configs2;

      return (_this$state$configs$c = (_this$state$configs2 = this.state.configs) === null || _this$state$configs2 === void 0 ? void 0 : _this$state$configs2.conditions) !== null && _this$state$configs$c !== void 0 ? _this$state$configs$c : null;
    }

    return (_this$state$configs$c2 = (_this$state$configs3 = this.state.configs) === null || _this$state$configs3 === void 0 ? void 0 : (_this$state$configs3$ = _this$state$configs3.conditions) === null || _this$state$configs3$ === void 0 ? void 0 : _this$state$configs3$.map(condition => sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_43__.CHANGE_ALERT_CONDITION_IDS.includes(condition.id) ? { ...condition,
      label: sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_43__.CHANGE_ALERT_PLACEHOLDERS_LABELS[condition.id]
    } : condition)) !== null && _this$state$configs$c2 !== void 0 ? _this$state$configs$c2 : null;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_13__["default"], {
      type: "error",
      showIcon: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Unable to access this alert rule -- check to make sure you have the correct permissions')
    });
  }

  renderRuleName(disabled) {
    var _detailedError$name;

    const {
      rule,
      detailedError
    } = this.state;
    const {
      name
    } = rule || {};
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledField, {
      label: null,
      help: null,
      error: detailedError === null || detailedError === void 0 ? void 0 : (_detailedError$name = detailedError.name) === null || _detailedError$name === void 0 ? void 0 : _detailedError$name[0],
      disabled: disabled,
      required: true,
      stacked: true,
      flexibleControlStateSize: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_24__["default"], {
        type: "text",
        name: "name",
        value: name,
        "data-test-id": "alert-name",
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Enter Alert Name'),
        onChange: event => this.handleChange('name', event.target.value),
        onBlur: this.handleValidateRuleName,
        disabled: disabled
      })
    });
  }

  renderTeamSelect(disabled) {
    var _rule$owner;

    const {
      rule,
      project
    } = this.state;
    const ownerId = rule === null || rule === void 0 ? void 0 : (_rule$owner = rule.owner) === null || _rule$owner === void 0 ? void 0 : _rule$owner.split(':')[1];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledField, {
      extraMargin: true,
      label: null,
      help: null,
      disabled: disabled,
      flexibleControlStateSize: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_22__["default"], {
        value: this.getTeamId(),
        project: project,
        onChange: this.handleOwnerChange,
        teamFilter: team => team.isMember || team.id === ownerId,
        useId: true,
        includeUnassigned: true,
        disabled: disabled
      })
    });
  }

  renderIdBadge(project) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_23__["default"], {
      project: project,
      avatarProps: {
        consistentWidth: true
      },
      avatarSize: 18,
      disableLink: true,
      hideName: true
    });
  }

  renderEnvironmentSelect(disabled) {
    var _environments$map;

    const {
      environments,
      rule
    } = this.state;
    const environmentOptions = [{
      value: sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('All Environments')
    }, ...((_environments$map = environments === null || environments === void 0 ? void 0 : environments.map(env => ({
      value: env.name,
      label: (0,sentry_utils_environment__WEBPACK_IMPORTED_MODULE_37__.getDisplayName)(env)
    }))) !== null && _environments$map !== void 0 ? _environments$map : [])];
    const environment = !rule || !rule.environment ? sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY : rule.environment;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_19__["default"], {
      name: "environment",
      inline: false,
      style: {
        padding: 0,
        border: 'none'
      },
      flexibleControlStateSize: true,
      className: this.hasError('environment') ? ' error' : '',
      required: true,
      disabled: disabled,
      children: _ref7 => {
        let {
          onChange,
          onBlur
        } = _ref7;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_20__["default"], {
          clearable: false,
          disabled: disabled,
          value: environment,
          options: environmentOptions,
          onChange: _ref8 => {
            let {
              value
            } = _ref8;
            this.handleEnvironmentChange(value);
            onChange(value, {});
            onBlur(value, {});
          }
        });
      }
    });
  }

  renderProjectSelect(disabled) {
    const {
      project: _selectedProject,
      projects,
      organization
    } = this.props;
    const hasOpenMembership = organization.features.includes('open-membership');
    const myProjects = projects.filter(project => project.hasAccess && project.isMember);
    const allProjects = projects.filter(project => project.hasAccess && !project.isMember);
    const myProjectOptions = myProjects.map(myProject => ({
      value: myProject.id,
      label: myProject.slug,
      leadingItems: this.renderIdBadge(myProject)
    }));
    const openMembershipProjects = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('My Projects'),
      options: myProjectOptions
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('All Projects'),
      options: allProjects.map(allProject => ({
        value: allProject.id,
        label: allProject.slug,
        leadingItems: this.renderIdBadge(allProject)
      }))
    }];
    const projectOptions = hasOpenMembership || (0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_38__.isActiveSuperuser)() ? openMembershipProjects : myProjectOptions;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_19__["default"], {
      name: "projectId",
      inline: false,
      style: {
        padding: 0
      },
      flexibleControlStateSize: true,
      children: _ref9 => {
        let {
          onChange,
          onBlur,
          model
        } = _ref9;

        const selectedProject = projects.find(_ref10 => {
          let {
            id
          } = _ref10;
          return id === model.getValue('projectId');
        }) || _selectedProject;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_20__["default"], {
          disabled: disabled,
          value: selectedProject.id,
          styles: {
            container: provided => ({ ...provided,
              marginBottom: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1)}`
            })
          },
          options: projectOptions,
          onChange: _ref11 => {
            var _projects$find, _model$getValue;

            let {
              value
            } = _ref11;
            // if the current owner/team isn't part of project selected, update to the first available team
            const nextSelectedProject = (_projects$find = projects.find(_ref12 => {
              let {
                id
              } = _ref12;
              return id === value;
            })) !== null && _projects$find !== void 0 ? _projects$find : selectedProject;
            const ownerId = (_model$getValue = model.getValue('owner')) === null || _model$getValue === void 0 ? void 0 : _model$getValue.split(':')[1];

            if (ownerId && nextSelectedProject.teams.find(_ref13 => {
              let {
                id
              } = _ref13;
              return id === ownerId;
            }) === undefined && nextSelectedProject.teams.length) {
              this.handleOwnerChange({
                value: nextSelectedProject.teams[0].id
              });
            }

            this.setState({
              project: nextSelectedProject
            });
            onChange(value, {});
            onBlur(value, {});
          },
          components: {
            SingleValue: containerProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_48__.y.ValueContainer, { ...containerProps,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_23__["default"], {
                project: selectedProject,
                avatarProps: {
                  consistentWidth: true
                },
                avatarSize: 18,
                disableLink: true
              })
            })
          }
        });
      }
    });
  }

  renderActionInterval(disabled) {
    const {
      rule
    } = this.state;
    const {
      frequency
    } = rule || {};
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_19__["default"], {
      name: "frequency",
      inline: false,
      style: {
        padding: 0,
        border: 'none'
      },
      label: null,
      help: null,
      className: this.hasError('frequency') ? ' error' : '',
      required: true,
      disabled: disabled,
      flexibleControlStateSize: true,
      children: _ref14 => {
        let {
          onChange,
          onBlur
        } = _ref14;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_20__["default"], {
          clearable: false,
          disabled: disabled,
          value: `${frequency}`,
          options: FREQUENCY_OPTIONS,
          onChange: _ref15 => {
            let {
              value
            } = _ref15;
            this.handleChange('frequency', value);
            onChange(value, {});
            onBlur(value, {});
          }
        });
      }
    });
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      project,
      rule,
      detailedError,
      loading,
      ownership
    } = this.state;
    const {
      actions,
      filters,
      conditions,
      frequency
    } = rule || {};
    const environment = !rule || !rule.environment ? sentry_constants__WEBPACK_IMPORTED_MODULE_30__.ALL_ENVIRONMENTS_KEY : rule.environment; // Note `key` on `<Form>` below is so that on initial load, we show
    // the form with a loading mask on top of it, but force a re-render by using
    // a different key when we have fetched the rule so that form inputs are filled in

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_12__["default"], {
      access: ['alerts:write'],
      children: _ref16 => {
        var _this$state$configs$f, _this$state$configs4, _this$state$configs$a, _this$state$configs5;

        let {
          hasAccess
        } = _ref16;
        // check if superuser or if user is on the alert's team
        const disabled = loading || !((0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_38__.isActiveSuperuser)() || hasAccess);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(Main, {
          fullWidth: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledForm, {
            onCancel: this.handleCancel,
            onSubmit: this.handleSubmit,
            initialData: { ...rule,
              environment,
              frequency: `${frequency}`,
              projectId: project.id
            },
            submitDisabled: disabled,
            submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Save Rule'),
            extraButton: isSavedAlertRule(rule) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_15__["default"], {
              disabled: disabled,
              priority: "danger",
              confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Delete Rule'),
              onConfirm: this.handleDeleteRule,
              header: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Delete Rule'),
              message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Are you sure you want to delete this rule?'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_14__["default"], {
                priority: "danger",
                type: "button",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Delete Rule')
              })
            }) : null,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(sentry_components_list__WEBPACK_IMPORTED_MODULE_26__["default"], {
              symbol: "colored-numeric",
              children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(SemiTransparentLoadingMask, {
                "data-test-id": "loading-mask"
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledListItem, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Add alert settings')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(SettingsContainer, {
                children: [this.renderEnvironmentSelect(disabled), this.renderProjectSelect(disabled)]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(SetConditionsListItem, {
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Set conditions'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(_setupAlertIntegrationButton__WEBPACK_IMPORTED_MODULE_46__["default"], {
                  projectSlug: project.slug,
                  organization: organization
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(ConditionsPanel, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_29__.PanelBody, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(Step, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StepConnector, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContainer, {
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(ChevronContainer, {
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_31__.IconChevron, {
                          color: "gray200",
                          isCircled: true,
                          direction: "right",
                          size: "sm"
                        })
                      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContent, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StepLead, {
                          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.tct)('[when:When] an event is captured by Sentry and [selector] of the following happens', {
                            when: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(Badge, {}),
                            selector: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(EmbeddedWrapper, {
                              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(EmbeddedSelectField, {
                                className: classnames__WEBPACK_IMPORTED_MODULE_6___default()({
                                  error: this.hasError('actionMatch')
                                }),
                                inline: false,
                                styles: {
                                  control: provided => ({ ...provided,
                                    minHeight: '20px',
                                    height: '20px'
                                  })
                                },
                                isSearchable: false,
                                isClearable: false,
                                name: "actionMatch",
                                required: true,
                                flexibleControlStateSize: true,
                                options: ACTION_MATCH_OPTIONS_MIGRATED,
                                onChange: val => this.handleChange('actionMatch', val),
                                disabled: disabled
                              })
                            })
                          })
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(_ruleNodeList__WEBPACK_IMPORTED_MODULE_45__["default"], {
                          nodes: this.getConditions(),
                          items: conditions !== null && conditions !== void 0 ? conditions : [],
                          selectType: "grouped",
                          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Add optional trigger...'),
                          onPropertyChange: this.handleChangeConditionProperty,
                          onAddRow: this.handleAddCondition,
                          onResetRow: this.handleResetCondition,
                          onDeleteRow: this.handleDeleteCondition,
                          organization: organization,
                          project: project,
                          disabled: disabled,
                          error: this.hasError('conditions') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledAlert, {
                            type: "error",
                            children: detailedError === null || detailedError === void 0 ? void 0 : detailedError.conditions[0]
                          })
                        })]
                      })]
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(Step, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StepConnector, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContainer, {
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(ChevronContainer, {
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_31__.IconChevron, {
                          color: "gray200",
                          isCircled: true,
                          direction: "right",
                          size: "sm"
                        })
                      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContent, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StepLead, {
                          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.tct)('[if:If] [selector] of these filters match', {
                            if: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(Badge, {}),
                            selector: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(EmbeddedWrapper, {
                              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(EmbeddedSelectField, {
                                className: classnames__WEBPACK_IMPORTED_MODULE_6___default()({
                                  error: this.hasError('filterMatch')
                                }),
                                inline: false,
                                styles: {
                                  control: provided => ({ ...provided,
                                    minHeight: '20px',
                                    height: '20px'
                                  })
                                },
                                isSearchable: false,
                                isClearable: false,
                                name: "filterMatch",
                                required: true,
                                flexibleControlStateSize: true,
                                options: ACTION_MATCH_OPTIONS,
                                onChange: val => this.handleChange('filterMatch', val),
                                disabled: disabled
                              })
                            })
                          })
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(_ruleNodeList__WEBPACK_IMPORTED_MODULE_45__["default"], {
                          nodes: (_this$state$configs$f = (_this$state$configs4 = this.state.configs) === null || _this$state$configs4 === void 0 ? void 0 : _this$state$configs4.filters) !== null && _this$state$configs$f !== void 0 ? _this$state$configs$f : null,
                          items: filters !== null && filters !== void 0 ? filters : [],
                          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Add optional filter...'),
                          onPropertyChange: this.handleChangeFilterProperty,
                          onAddRow: this.handleAddFilter,
                          onResetRow: this.handleResetFilter,
                          onDeleteRow: this.handleDeleteFilter,
                          organization: organization,
                          project: project,
                          disabled: disabled,
                          error: this.hasError('filters') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledAlert, {
                            type: "error",
                            children: detailedError === null || detailedError === void 0 ? void 0 : detailedError.filters[0]
                          })
                        })]
                      })]
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(Step, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContainer, {
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(ChevronContainer, {
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_31__.IconChevron, {
                          isCircled: true,
                          color: "gray200",
                          direction: "right",
                          size: "sm"
                        })
                      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StepContent, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StepLead, {
                          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.tct)('[then:Then] perform these actions', {
                            then: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(Badge, {})
                          })
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(_ruleNodeList__WEBPACK_IMPORTED_MODULE_45__["default"], {
                          nodes: (_this$state$configs$a = (_this$state$configs5 = this.state.configs) === null || _this$state$configs5 === void 0 ? void 0 : _this$state$configs5.actions) !== null && _this$state$configs$a !== void 0 ? _this$state$configs$a : null,
                          selectType: "grouped",
                          items: actions !== null && actions !== void 0 ? actions : [],
                          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Add action...'),
                          onPropertyChange: this.handleChangeActionProperty,
                          onAddRow: this.handleAddAction,
                          onResetRow: this.handleResetAction,
                          onDeleteRow: this.handleDeleteAction,
                          organization: organization,
                          project: project,
                          disabled: disabled,
                          ownership: ownership,
                          error: this.hasError('actions') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledAlert, {
                            type: "error",
                            children: detailedError === null || detailedError === void 0 ? void 0 : detailedError.actions[0]
                          })
                        })]
                      })]
                    })
                  })]
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsxs)(StyledListItem, {
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Set action interval'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledFieldHelp, {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Perform the actions above once this often for an issue')
                })]
              }), this.renderActionInterval(disabled), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_47__.jsx)(StyledListItem, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_32__.t)('Establish ownership')
              }), this.renderRuleName(disabled), this.renderTeamSelect(disabled)]
            })
          }, isSavedAlertRule(rule) ? rule.id : undefined)
        });
      }
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_41__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_42__["default"])(IssueRuleEditor))); // TODO(ts): Understand why styled is not correctly inheriting props here

const StyledForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "ey7y4ii18"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const ConditionsPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_29__.Panel,  true ? {
  target: "ey7y4ii17"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(0.5), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(2), ";" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "ey7y4ii16"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const StyledListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_27__["default"],  true ? {
  target: "ey7y4ii15"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1), " 0;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const StyledFieldHelp = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field_fieldHelp__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "ey7y4ii14"
} : 0)( true ? {
  name: "1i9vogi",
  styles: "margin-top:0"
} : 0);

const SetConditionsListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(StyledListItem,  true ? {
  target: "ey7y4ii13"
} : 0)( true ? {
  name: "1eoy87d",
  styles: "display:flex;justify-content:space-between"
} : 0);

const Step = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii12"
} : 0)("position:relative;display:flex;align-items:flex-start;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1), ";" + ( true ? "" : 0));

const StepContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii11"
} : 0)( true ? {
  name: "dxf6zn",
  styles: "position:relative;display:flex;align-items:flex-start;flex-grow:1"
} : 0);

const StepContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii10"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

const StepConnector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii9"
} : 0)("position:absolute;height:100%;top:28px;left:19px;border-right:1px ", p => p.theme.gray200, " dashed;" + ( true ? "" : 0));

const StepLead = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii8"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(0.5), ";" + ( true ? "" : 0));

const ChevronContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii7"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1.5), ";" + ( true ? "" : 0));

const Badge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ey7y4ii6"
} : 0)("display:inline-block;min-width:56px;background-color:", p => p.theme.purple300, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(0.75), ";border-radius:", p => p.theme.borderRadius, ";color:", p => p.theme.white, ";text-transform:uppercase;text-align:center;font-size:", p => p.theme.fontSizeMedium, ";font-weight:600;line-height:1.5;" + ( true ? "" : 0));

const EmbeddedWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii5"
} : 0)("display:inline-block;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(0.5), ";width:80px;" + ( true ? "" : 0));

const EmbeddedSelectField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_21__["default"],  true ? {
  target: "ey7y4ii4"
} : 0)( true ? {
  name: "1xnv1j2",
  styles: "padding:0;font-weight:normal;text-transform:none"
} : 0);

const SemiTransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_28__["default"],  true ? {
  target: "ey7y4ii3"
} : 0)( true ? {
  name: "2ux4k9",
  styles: "opacity:0.6;z-index:1"
} : 0);

const SettingsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ey7y4ii2"
} : 0)("display:grid;grid-template-columns:1fr 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1), ";" + ( true ? "" : 0));

const StyledField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "ey7y4ii1"
} : 0)(":last-child{padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(2), ";}border-bottom:none;padding:0;&>div{padding:0;width:100%;}margin-bottom:", p => `${p.extraMargin ? '60px' : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(1)}`, ";" + ( true ? "" : 0));

const Main = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_25__.Main,  true ? {
  target: "ey7y4ii0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_33__["default"])(4), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/issue/memberTeamFields.tsx":
/*!***********************************************************!*\
  !*** ./app/views/alerts/rules/issue/memberTeamFields.tsx ***!
  \***********************************************************/
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
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_selectMembers__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/selectMembers */ "./app/components/selectMembers/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class MemberTeamFields extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", (attribute, newValue) => {
      const {
        onChange,
        ruleData
      } = this.props;

      if (newValue === ruleData[attribute]) {
        return;
      }

      const newData = { ...ruleData,
        [attribute]: newValue
      };
      /**
       * TargetIdentifiers between the targetTypes are not unique, and may wrongly map to something that has not been
       * selected. E.g. A member and project can both have the `targetIdentifier`, `'2'`. Hence we clear the identifier.
       **/

      if (attribute === 'targetType') {
        newData.targetIdentifier = '';
      }

      onChange(newData);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActorType", optionRecord => {
      this.handleChange('targetType', optionRecord.value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActorId", optionRecord => {
      this.handleChange('targetIdentifier', optionRecord.value);
    });
  }

  render() {
    const {
      disabled,
      loading,
      project,
      organization,
      ruleData,
      memberValue,
      teamValue,
      options
    } = this.props;
    const teamSelected = ruleData.targetType === teamValue;
    const memberSelected = ruleData.targetType === memberValue;
    const selectControlStyles = {
      control: provided => ({ ...provided,
        minHeight: '28px',
        height: '28px'
      })
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(PanelItemGrid, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_4__["default"], {
        isClearable: false,
        isDisabled: disabled || loading,
        value: ruleData.targetType,
        styles: selectControlStyles,
        options: options,
        onChange: this.handleChangeActorType
      }), teamSelected ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_5__["default"], {
        disabled: disabled,
        project: project // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
        ,
        value: `${ruleData.targetIdentifier}`,
        styles: selectControlStyles,
        onChange: this.handleChangeActorId,
        useId: true
      }, teamValue) : memberSelected ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_selectMembers__WEBPACK_IMPORTED_MODULE_7__["default"], {
        disabled: disabled,
        project: project,
        organization: organization // The value from the endpoint is of type `number`, `SelectMembers` require value to be of type `string`
        ,
        value: `${ruleData.targetIdentifier}`,
        styles: selectControlStyles,
        onChange: this.handleChangeActorId
      }, teamSelected ? teamValue : memberValue) : null]
    });
  }

}

MemberTeamFields.displayName = "MemberTeamFields";

const PanelItemGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e7hhv040"
} : 0)("display:grid;grid-template-columns:200px 200px;padding:0;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MemberTeamFields);

/***/ }),

/***/ "./app/views/alerts/rules/issue/ruleNode.tsx":
/*!***************************************************!*\
  !*** ./app/views/alerts/rules/issue/ruleNode.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/types/alerts */ "./app/types/alerts.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue_memberTeamFields__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/views/alerts/rules/issue/memberTeamFields */ "./app/views/alerts/rules/issue/memberTeamFields.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue_sentryAppRuleModal__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/alerts/rules/issue/sentryAppRuleModal */ "./app/views/alerts/rules/issue/sentryAppRuleModal.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue_ticketRuleModal__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/alerts/rules/issue/ticketRuleModal */ "./app/views/alerts/rules/issue/ticketRuleModal.tsx");
/* harmony import */ var sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/projectInstall/issueAlertOptions */ "./app/views/projectInstall/issueAlertOptions.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















function NumberField(_ref) {
  let {
    data,
    index,
    disabled,
    name,
    fieldConfig,
    onPropertyChange
  } = _ref;
  const value = data[name] && typeof data[name] !== 'boolean' ? data[name] : ''; // Set default value of number fields to the placeholder value

  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (value === '' && data.id === 'sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter' && !isNaN(Number(fieldConfig.placeholder))) {
      onPropertyChange(index, name, `${fieldConfig.placeholder}`);
    } // Value omitted on purpose to avoid overwriting user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [onPropertyChange, index, name, fieldConfig.placeholder, data.id]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(InlineNumberInput, {
    type: "number",
    name: name,
    value: value,
    placeholder: `${fieldConfig.placeholder}`,
    disabled: disabled,
    onChange: e => onPropertyChange(index, name, e.target.value)
  });
}

NumberField.displayName = "NumberField";

function AssigneeFilterFields(_ref2) {
  let {
    data,
    organization,
    project,
    disabled,
    onMemberTeamChange
  } = _ref2;
  const isInitialized = data.targetType !== undefined && `${data.targetType}`.length > 0;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_issue_memberTeamFields__WEBPACK_IMPORTED_MODULE_16__["default"], {
    disabled: disabled,
    project: project,
    organization: organization,
    loading: !isInitialized,
    ruleData: data,
    onChange: onMemberTeamChange,
    options: [{
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.AssigneeTargetType.Unassigned,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('No One')
    }, {
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.AssigneeTargetType.Team,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Team')
    }, {
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.AssigneeTargetType.Member,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Member')
    }],
    memberValue: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.AssigneeTargetType.Member,
    teamValue: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.AssigneeTargetType.Team
  });
}

AssigneeFilterFields.displayName = "AssigneeFilterFields";

function MailActionFields(_ref3) {
  var _organization$feature;

  let {
    data,
    organization,
    project,
    disabled,
    onMemberTeamChange
  } = _ref3;
  const isInitialized = data.targetType !== undefined && `${data.targetType}`.length > 0;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_issue_memberTeamFields__WEBPACK_IMPORTED_MODULE_16__["default"], {
    disabled: disabled,
    project: project,
    organization: organization,
    loading: !isInitialized,
    ruleData: data,
    onChange: onMemberTeamChange,
    options: [{
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.IssueOwners,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Issue Owners')
    }, {
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.Team,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Team')
    }, {
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.Member,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Member')
    }, ...((_organization$feature = organization.features) !== null && _organization$feature !== void 0 && _organization$feature.includes('alert-release-notification-workflow') ? [{
      value: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.ReleaseMembers,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Release Members')
    }] : [])],
    memberValue: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.Member,
    teamValue: sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.Team
  });
}

MailActionFields.displayName = "MailActionFields";

function ChoiceField(_ref4) {
  let {
    data,
    disabled,
    index,
    onPropertyChange,
    onReset,
    name,
    fieldConfig
  } = _ref4;
  // Select the first item on this list
  // If it's not yet defined, call onPropertyChange to make sure the value is set on state
  let initialVal;

  if (data[name] === undefined && !!fieldConfig.choices.length) {
    initialVal = fieldConfig.initial ? `${fieldConfig.initial}` : `${fieldConfig.choices[0][0]}`;
  } else {
    initialVal = `${data[name]}`;
  } // All `value`s are cast to string
  // There are integrations that give the form field choices with the value as number, but
  // when the integration configuration gets saved, it gets saved and returned as a string


  const options = fieldConfig.choices.map(_ref5 => {
    let [value, label] = _ref5;
    return {
      value: `${value}`,
      label
    };
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(InlineSelectControl, {
    isClearable: false,
    name: name,
    value: initialVal,
    styles: {
      control: provided => ({ ...provided,
        minHeight: '28px',
        height: '28px'
      })
    },
    disabled: disabled,
    options: options,
    onChange: _ref6 => {
      let {
        value
      } = _ref6;

      if (fieldConfig.resetsForm) {
        onReset(index, name, value);
      } else {
        onPropertyChange(index, name, value);
      }
    }
  });
}

ChoiceField.displayName = "ChoiceField";

function TextField(_ref7) {
  let {
    data,
    index,
    onPropertyChange,
    disabled,
    name,
    fieldConfig
  } = _ref7;
  const value = data[name] && typeof data[name] !== 'boolean' ? data[name] : '';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(InlineInput, {
    type: "text",
    name: name,
    value: value,
    placeholder: `${fieldConfig.placeholder}`,
    disabled: disabled,
    onChange: e => onPropertyChange(index, name, e.target.value)
  });
}

TextField.displayName = "TextField";

function RuleNode(_ref8) {
  let {
    index,
    data,
    node,
    organization,
    project,
    disabled,
    onDelete,
    onPropertyChange,
    onReset,
    ownership
  } = _ref8;
  const handleDelete = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    onDelete(index);
  }, [index, onDelete]);
  const handleMemberTeamChange = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(_ref9 => {
    let {
      targetType,
      targetIdentifier
    } = _ref9;
    onPropertyChange(index, 'targetType', `${targetType}`);
    onPropertyChange(index, 'targetIdentifier', `${targetIdentifier}`);
  }, [index, onPropertyChange]);

  function getField(name, fieldConfig) {
    const fieldProps = {
      index,
      name,
      fieldConfig,
      data,
      organization,
      project,
      disabled,
      onMemberTeamChange: handleMemberTeamChange,
      onPropertyChange,
      onReset
    };

    switch (fieldConfig.type) {
      case 'choice':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ChoiceField, { ...fieldProps
        });

      case 'number':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(NumberField, { ...fieldProps
        });

      case 'string':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(TextField, { ...fieldProps
        });

      case 'mailAction':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(MailActionFields, { ...fieldProps
        });

      case 'assignee':
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(AssigneeFilterFields, { ...fieldProps
        });

      default:
        return null;
    }
  }

  function renderRow() {
    if (!node) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Separator, {
        children: "This node failed to render. It may have migrated to another section of the alert conditions"
      });
    }

    const {
      label,
      formFields
    } = node;
    const parts = label.split(/({\w+})/).map((part, i) => {
      if (!/^{\w+}$/.test(part)) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Separator, {
          children: part
        }, i);
      }

      const key = part.slice(1, -1); // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required

      if (key === 'value' && (data.match === 'is' || data.match === 'ns')) {
        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Separator, {
        children: formFields && formFields.hasOwnProperty(key) ? getField(key, formFields[key]) : part
      }, key);
    });
    const [title, ...inputs] = parts; // We return this so that it can be a grid

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [title, inputs]
    });
  }

  function conditionallyRenderHelpfulBanner() {
    if (data.id === sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_19__.EVENT_FREQUENCY_PERCENT_CONDITION) {
      if (!project.platform || !sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_11__.releaseHealth.includes(project.platform)) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(MarginlessAlert, {
          type: "error",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)("This project doesn't support sessions. [link:View supported platforms]", {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
              href: "https://docs.sentry.io/product/releases/setup/#release-health"
            })
          })
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(MarginlessAlert, {
        type: "warning",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('Percent of sessions affected is approximated by the ratio of the issue frequency to the number of sessions in the project. [link:Learn more.]', {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: "https://docs.sentry.io/product/alerts/create-alerts/issue-alert-config/"
          })
        })
      });
    }

    if (data.id === 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction') {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(MarginlessAlert, {
        type: "info",
        showIcon: true,
        trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          href: "https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error",
          size: "xs",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Learn More')
        }),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Having rate limiting problems? Enter a channel or user ID.')
      });
    }

    if (data.id === 'sentry.mail.actions.NotifyEmailAction' && data.targetType === sentry_types_alerts__WEBPACK_IMPORTED_MODULE_15__.MailActionTargetType.IssueOwners) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(MarginlessAlert, {
        type: "warning",
        children: !ownership ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('If there are no matching [issueOwners], ownership is determined by the [ownershipSettings].', {
          issueOwners: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: "https://docs.sentry.io/product/error-monitoring/issue-owners/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('issue owners')
          }),
          ownershipSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: `/settings/${organization.slug}/projects/${project.slug}/ownership/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('ownership settings')
          })
        }) : ownership.fallthrough ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('If there are no matching [issueOwners], all project members will receive this alert. To change this behavior, see [ownershipSettings].', {
          issueOwners: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: "https://docs.sentry.io/product/error-monitoring/issue-owners/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('issue owners')
          }),
          ownershipSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: `/settings/${organization.slug}/projects/${project.slug}/ownership/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('ownership settings')
          })
        }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.tct)('If there are no matching [issueOwners], this action will have no effect. To change this behavior, see [ownershipSettings].', {
          issueOwners: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: "https://docs.sentry.io/product/error-monitoring/issue-owners/",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('issue owners')
          }),
          ownershipSettings: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            href: `/settings/${organization.slug}/projects/${project.slug}/ownership/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('ownership settings')
          })
        })
      });
    }

    return null;
  }
  /**
   * Update all the AlertRuleAction's fields from the TicketRuleModal together
   * only after the user clicks "Apply Changes".
   * @param formData Form data
   * @param fetchedFieldOptionsCache Object
   */


  const updateParentFromTicketRule = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)((formData, fetchedFieldOptionsCache) => {
    // We only know the choices after the form loads.
    formData.dynamic_form_fields = (formData.dynamic_form_fields || []).map(field => {
      // Overwrite the choices because the user's pick is in this list.
      if (field.name in formData && fetchedFieldOptionsCache !== null && fetchedFieldOptionsCache !== void 0 && fetchedFieldOptionsCache.hasOwnProperty(field.name)) {
        field.choices = fetchedFieldOptionsCache[field.name];
      }

      return field;
    });

    for (const [name, value] of Object.entries(formData)) {
      onPropertyChange(index, name, value);
    }
  }, [index, onPropertyChange]);
  /**
   * Update all the AlertRuleAction's fields from the SentryAppRuleModal together
   * only after the user clicks "Save Changes".
   * @param formData Form data
   */

  const updateParentFromSentryAppRule = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(formData => {
    for (const [name, value] of Object.entries(formData)) {
      onPropertyChange(index, name, value);
    }
  }, [index, onPropertyChange]);
  const {
    actionType,
    id,
    sentryAppInstallationUuid
  } = node || {};
  const ticketRule = actionType === 'ticket';
  const sentryAppRule = actionType === 'sentryapp' && sentryAppInstallationUuid;
  const isNew = id === sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_19__.EVENT_FREQUENCY_PERCENT_CONDITION;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(RuleRowContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(RuleRow, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Rule, {
        children: [isNew && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledFeatureBadge, {
          type: "new"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("input", {
          type: "hidden",
          name: "id",
          value: data.id
        }), renderRow(), ticketRule && node && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconSettings, {
            size: "xs"
          }),
          type: "button",
          onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_issue_ticketRuleModal__WEBPACK_IMPORTED_MODULE_18__["default"], { ...deps,
            formFields: node.formFields || {},
            link: node.link,
            ticketType: node.ticketType,
            instance: data,
            index: index,
            onSubmitAction: updateParentFromTicketRule,
            organization: organization
          })),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Issue Link Settings')
        }), sentryAppRule && node && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconSettings, {
            size: "xs"
          }),
          type: "button",
          disabled: Boolean(data.disabled) || disabled,
          onClick: () => {
            (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_4__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_alerts_rules_issue_sentryAppRuleModal__WEBPACK_IMPORTED_MODULE_17__["default"], { ...deps,
              sentryAppInstallationUuid: sentryAppInstallationUuid,
              config: node.formFields,
              appName: node.prompt,
              onSubmitSuccess: updateParentFromSentryAppRule,
              resetValues: data
            }), {
              allowClickClose: false
            });
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Settings')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(DeleteButton, {
        disabled: disabled,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Delete Node'),
        onClick: handleDelete,
        type: "button",
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_12__.IconDelete, {})
      })]
    }), conditionallyRenderHelpfulBanner()]
  });
}

RuleNode.displayName = "RuleNode";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RuleNode);

const InlineInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1tfo63u9"
} : 0)( true ? {
  name: "1jf5uxw",
  styles: "width:auto;height:28px"
} : 0);

const InlineNumberInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1tfo63u8"
} : 0)( true ? {
  name: "oshb5x",
  styles: "width:90px;height:28px"
} : 0);

const InlineSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1tfo63u7"
} : 0)( true ? {
  name: "educr3",
  styles: "width:180px"
} : 0);

const Separator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1tfo63u6"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(0.5), ";" + ( true ? "" : 0));

const RuleRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tfo63u5"
} : 0)("display:flex;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";" + ( true ? "" : 0));

const RuleRowContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tfo63u4"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border-radius:", p => p.theme.borderRadius, ";border:1px ", p => p.theme.innerBorder, " solid;" + ( true ? "" : 0));

const Rule = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tfo63u3"
} : 0)( true ? {
  name: "c61zw8",
  styles: "display:flex;align-items:center;flex:1;flex-wrap:wrap"
} : 0);

const DeleteButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1tfo63u2"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const MarginlessAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1tfo63u1"
} : 0)("border-top-left-radius:0;border-top-right-radius:0;border-width:0;border-top:1px ", p => p.theme.innerBorder, " solid;margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const StyledFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1tfo63u0"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), " 0 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/issue/ruleNodeList.tsx":
/*!*******************************************************!*\
  !*** ./app/views/alerts/rules/issue/ruleNodeList.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/alerts/utils/constants */ "./app/views/alerts/utils/constants.tsx");
/* harmony import */ var sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/projectInstall/issueAlertOptions */ "./app/views/projectInstall/issueAlertOptions.tsx");
/* harmony import */ var _metric_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _ruleNode__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./ruleNode */ "./app/views/alerts/rules/issue/ruleNode.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class RuleNodeList extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "propertyChangeTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getNode", (id, itemIdx) => {
      const {
        nodes,
        items,
        organization,
        onPropertyChange
      } = this.props;
      const node = nodes ? nodes.find(n => n.id === id) : null;

      if (!node) {
        return null;
      }

      if (!organization.features.includes('change-alerts') || !sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_10__.CHANGE_ALERT_CONDITION_IDS.includes(node.id)) {
        return node;
      }

      const item = items[itemIdx];
      let changeAlertNode = { ...node,
        label: node.label.replace('...', ' {comparisonType}'),
        formFields: { ...node.formFields,
          comparisonType: {
            type: 'choice',
            choices: sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_10__.COMPARISON_TYPE_CHOICES,
            // give an initial value from not among choices so selector starts with none selected
            initial: 'select'
          }
        }
      }; // item.comparison type isn't backfilled and is missing for old alert rules
      // this is a problem when an old alert is being edited, need to initialize it

      if (!item.comparisonType && item.value && item.name) {
        item.comparisonType = item.comparisonInterval === undefined ? 'count' : 'percent';
      }

      if (item.comparisonType) {
        changeAlertNode = { ...changeAlertNode,
          label: changeAlertNode.label.replace('{comparisonType}', sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_10__.COMPARISON_TYPE_CHOICE_VALUES[item.comparisonType])
        };

        if (item.comparisonType === _metric_types__WEBPACK_IMPORTED_MODULE_12__.AlertRuleComparisonType.PERCENT) {
          if (!item.comparisonInterval) {
            // comparisonInterval value in IssueRuleEditor state
            // is undefined even if initial value is defined
            // can't directly call onPropertyChange, because
            // getNode is called during render
            window.clearTimeout(this.propertyChangeTimeout);
            this.propertyChangeTimeout = window.setTimeout(() => onPropertyChange(itemIdx, 'comparisonInterval', '1w'));
          }

          changeAlertNode = { ...changeAlertNode,
            formFields: { ...changeAlertNode.formFields,
              comparisonInterval: {
                type: 'choice',
                choices: sentry_views_alerts_utils_constants__WEBPACK_IMPORTED_MODULE_10__.COMPARISON_INTERVAL_CHOICES,
                initial: '1w'
              }
            }
          };
        }
      }

      return changeAlertNode;
    });
  }

  componentWillUnmount() {
    window.clearTimeout(this.propertyChangeTimeout);
  }

  render() {
    const {
      onAddRow,
      onResetRow,
      onDeleteRow,
      onPropertyChange,
      nodes,
      placeholder,
      items,
      organization,
      ownership,
      project,
      disabled,
      error,
      selectType
    } = this.props;
    const enabledNodes = nodes ? nodes.filter(_ref => {
      let {
        enabled
      } = _ref;
      return enabled;
    }) : [];

    const createSelectOptions = actions => actions.map(node => {
      var _node$prompt;

      const isNew = node.id === sentry_views_projectInstall_issueAlertOptions__WEBPACK_IMPORTED_MODULE_11__.EVENT_FREQUENCY_PERCENT_CONDITION;

      if (node.id.includes('NotifyEmailAction')) {
        var _organization$feature;

        return {
          value: node.id,
          label: (_organization$feature = organization.features) !== null && _organization$feature !== void 0 && _organization$feature.includes('alert-release-notification-workflow') ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Issue Owners, Team, Member, or Release Members') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Issue Owners, Team, or Member')
        };
      }

      return {
        value: node.id,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
          children: [isNew && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledFeatureBadge, {
            type: "new",
            noTooltip: true
          }), (_node$prompt = node.prompt) !== null && _node$prompt !== void 0 && _node$prompt.length ? node.prompt : node.label]
        })
      };
    });

    let options = !selectType ? createSelectOptions(enabledNodes) : [];

    if (selectType === 'grouped') {
      const grouped = enabledNodes.reduce((acc, curr) => {
        if (curr.actionType === 'ticket') {
          acc.ticket.push(curr);
        } else if (curr.id.includes('event_frequency')) {
          acc.frequency.push(curr);
        } else if (curr.id.includes('sentry.rules.conditions') && !curr.id.includes('event_frequency')) {
          acc.change.push(curr);
        } else if (curr.id.includes('sentry.integrations')) {
          acc.notifyIntegration.push(curr);
        } else if (curr.id.includes('notify_event')) {
          acc.notifyIntegration.push(curr);
        } else {
          acc.notify.push(curr);
        }

        return acc;
      }, {
        notify: [],
        notifyIntegration: [],
        ticket: [],
        change: [],
        frequency: []
      });
      options = Object.entries(grouped).filter(_ref2 => {
        let [_, values] = _ref2;
        return values.length;
      }).map(_ref3 => {
        let [key, values] = _ref3;
        const label = {
          notify: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Send notification to\u{2026}'),
          notifyIntegration: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Notify integration\u{2026}'),
          ticket: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Create new\u{2026}'),
          change: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Issue state change'),
          frequency: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Issue frequency')
        };
        return {
          label: label[key],
          options: createSelectOptions(values)
        };
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(RuleNodes, {
        children: [error, items.map((item, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_ruleNode__WEBPACK_IMPORTED_MODULE_13__["default"], {
          index: idx,
          node: this.getNode(item.id, idx),
          onDelete: onDeleteRow,
          onPropertyChange: onPropertyChange,
          onReset: onResetRow,
          data: item,
          organization: organization,
          project: project,
          disabled: disabled,
          ownership: ownership
        }, idx))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledSelectControl, {
        placeholder: placeholder,
        value: null,
        onChange: obj => onAddRow(obj ? obj.value : obj),
        options: options,
        disabled: disabled
      })]
    });
  }

}

RuleNodeList.displayName = "RuleNodeList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RuleNodeList);

const StyledSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e13db82a2"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

const RuleNodes = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e13db82a1"
} : 0)("display:grid;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";@media (max-width: ", p => p.theme.breakpoints.medium, "){grid-auto-flow:row;}" + ( true ? "" : 0));

const StyledFeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e13db82a0"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " 0 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/issue/sentryAppRuleModal.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/issue/sentryAppRuleModal.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_organizationIntegrations_sentryAppExternalForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/organizationIntegrations/sentryAppExternalForm */ "./app/views/organizationIntegrations/sentryAppExternalForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const SentryAppRuleModal = _ref => {
  let {
    Header,
    Body,
    sentryAppInstallationUuid,
    appName,
    config,
    resetValues,
    onSubmitSuccess
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Header, {
      closeButton: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('[name] Settings', {
          name: appName
        })
      }), config.description && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Description, {
        children: config.description
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_views_organizationIntegrations_sentryAppExternalForm__WEBPACK_IMPORTED_MODULE_6__["default"], {
        sentryAppInstallationUuid: sentryAppInstallationUuid,
        appName: appName,
        config: (resetValues === null || resetValues === void 0 ? void 0 : resetValues.formFields) || config,
        element: "alert-rule-action",
        action: "create",
        onSubmitSuccess: function () {
          onSubmitSuccess(...arguments);
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.closeModal)();
        },
        resetValues: {
          settings: resetValues === null || resetValues === void 0 ? void 0 : resetValues.settings
        }
      })
    })]
  });
};

SentryAppRuleModal.displayName = "SentryAppRuleModal";

const Description = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tzb5e70"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0), ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryAppRuleModal);

/***/ }),

/***/ "./app/views/alerts/rules/issue/setupAlertIntegrationButton.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/alerts/rules/issue/setupAlertIntegrationButton.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SetupAlertIntegrationButton)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/plugins/components/pluginIcon */ "./app/plugins/components/pluginIcon.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








/**
 * This component renders a button to Set up an alert integration (just Slack for now)
 * if the project has no alerting integrations setup already.
 */
class SetupAlertIntegrationButton extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getEndpoints() {
    const {
      projectSlug,
      organization
    } = this.props;
    return [['detailedProject', `/projects/${organization.slug}/${projectSlug}/?expand=hasAlertIntegration`]];
  }

  renderLoading() {
    return null;
  } // if there is an error, just show nothing


  renderError() {
    return null;
  }

  renderBody() {
    const {
      organization
    } = this.props;
    const {
      detailedProject
    } = this.state; // don't render anything if we don't have the project yet or if an alert integration
    // is installed

    if (!detailedProject || detailedProject.hasAlertIntegrationInstalled) {
      return null;
    }

    const config = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_5__["default"].getConfig(); // link to docs to set up Slack for self-hosted folks

    const referrerQuery = '?referrer=issue-alert-builder';
    const buttonProps = config.isSelfHosted ? {
      href: `https://develop.sentry.dev/integrations/slack/${referrerQuery}`
    } : {
      to: `/settings/${organization.slug}/integrations/slack/${referrerQuery}`
    }; // TOOD(Steve): need to use the Tooltip component because adding a title to the button
    // puts the tooltip in the upper left hand corner of the page instead of the button

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Send Alerts to Slack. Install the integration now.'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_plugins_components_pluginIcon__WEBPACK_IMPORTED_MODULE_4__["default"], {
          pluginId: "slack",
          size: 16
        }),
        ...buttonProps,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Set Up Slack Now')
      })
    });
  }

}

/***/ }),

/***/ "./app/views/alerts/rules/issue/ticketRuleModal.tsx":
/*!**********************************************************!*\
  !*** ./app/views/alerts/rules/issue/ticketRuleModal.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_externalIssues_abstractExternalIssueForm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/externalIssues/abstractExternalIssueForm */ "./app/components/externalIssues/abstractExternalIssueForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const IGNORED_FIELDS = ['Sprint'];

class TicketRuleModal extends sentry_components_externalIssues_abstractExternalIssueForm__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReceiveIntegrationDetails", integrationDetails => {
      this.setState({
        issueConfigFieldsCache: integrationDetails[this.getConfigName()]
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getValidAndSavableFieldNames", () => {
      const {
        issueConfigFieldsCache
      } = this.state;
      return (issueConfigFieldsCache || []).filter(field => field.hasOwnProperty('name')).map(field => field.name);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "cleanData", data => {
      const {
        instance
      } = this.props;
      const {
        issueConfigFieldsCache
      } = this.state;
      const names = this.getValidAndSavableFieldNames();
      const formData = {};

      if (instance !== null && instance !== void 0 && instance.hasOwnProperty('integration')) {
        formData.integration = instance.integration;
      }

      formData.dynamic_form_fields = issueConfigFieldsCache;

      for (const [key, value] of Object.entries(data)) {
        if (names.includes(key)) {
          formData[key] = value;
        }
      }

      return formData;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFormSubmit", (data, _success, _error, e, model) => {
      const {
        onSubmitAction,
        closeModal
      } = this.props;
      const {
        fetchedFieldOptionsCache
      } = this.state; // This is a "fake form", so don't actually POST to an endpoint.

      e.preventDefault();
      e.stopPropagation();

      if (model.validateForm()) {
        onSubmitAction(this.cleanData(data), fetchedFieldOptionsCache);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Changes applied.'));
        closeModal();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getFormProps", () => {
      const {
        closeModal
      } = this.props;
      return { ...this.getDefaultFormProps(),
        cancelLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Close'),
        onCancel: closeModal,
        onSubmit: this.onFormSubmit,
        submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Apply Changes')
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "cleanFields", () => {
      const {
        instance
      } = this.props;
      const fields = [{
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'This will be the same as the Sentry Issue.',
        disabled: true
      }, {
        name: 'description',
        label: 'Description',
        type: 'string',
        default: 'This will be generated from the Sentry Issue details.',
        disabled: true
      }];
      return fields.concat(this.getCleanedFields() // Skip fields if they already exist.
      .filter(field => !fields.map(f => f.name).includes(field.name)).map(field => {
        // Overwrite defaults from cache.
        if (instance.hasOwnProperty(field.name)) {
          field.default = instance[field.name] || field.default;
        }

        return field;
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyText", () => {
      // `ticketType` already includes indefinite article.
      const {
        ticketType,
        link
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(BodyText, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('When this alert is triggered [ticketType] will be ' + 'created with the following fields. It will also [linkToDocs] ' + 'with the new Sentry Issue.', {
          linkToDocs: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_7__["default"], {
            href: link,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('stay in sync')
          }),
          ticketType
        })
      });
    });
  }

  getDefaultState() {
    const {
      instance
    } = this.props;
    const issueConfigFieldsCache = Object.values((instance === null || instance === void 0 ? void 0 : instance.dynamic_form_fields) || {});
    return { ...super.getDefaultState(),
      fetchedFieldOptionsCache: Object.fromEntries(issueConfigFieldsCache.map(field => [field.name, field.choices])),
      issueConfigFieldsCache
    };
  }

  getEndpoints() {
    const {
      instance
    } = this.props;
    const query = (instance.dynamic_form_fields || []).filter(field => field.updatesForm).filter(field => instance.hasOwnProperty(field.name)).reduce((accumulator, _ref) => {
      let {
        name
      } = _ref;
      accumulator[name] = instance[name];
      return accumulator;
    }, {
      action: 'create'
    });
    return [['integrationDetails', this.getEndPointString(), {
      query
    }]];
  }

  getEndPointString() {
    const {
      instance,
      organization
    } = this.props;
    return `/organizations/${organization.slug}/integrations/${instance.integration}/?ignored=${IGNORED_FIELDS}`;
  }
  /**
   * Clean up the form data before saving it to state.
   */


  getErrors() {
    const errors = {};

    for (const field of this.cleanFields()) {
      if (field.type === 'select' && field.default) {
        const fieldChoices = field.choices || [];
        const found = fieldChoices.find(_ref2 => {
          let [value, _] = _ref2;
          return Array.isArray(field.default) ? field.default.includes(value) : value === field.default;
        });

        if (!found) {
          errors[field.name] = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(FieldErrorLabel, {
            children: `Could not fetch saved option for ${field.label}. Please reselect.`
          });
        }
      }
    }

    return errors;
  }

  render() {
    return this.renderForm(this.cleanFields(), this.getErrors());
  }

}

TicketRuleModal.displayName = "TicketRuleModal";

const BodyText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1bl7x491"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(3), ";" + ( true ? "" : 0));

const FieldErrorLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('label',  true ? {
  target: "e1bl7x490"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";color:", p => p.theme.errorText, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TicketRuleModal);

/***/ }),

/***/ "./app/views/alerts/rules/metric/actions.tsx":
/*!***************************************************!*\
  !*** ./app/views/alerts/rules/metric/actions.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addOrUpdateRule": () => (/* binding */ addOrUpdateRule),
/* harmony export */   "deleteRule": () => (/* binding */ deleteRule)
/* harmony export */ });
function isSavedRule(rule) {
  return !!rule.id;
}
/**
 * Add a new rule or update an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 * @param query Query parameters for the request eg - referrer
 */


function addOrUpdateRule(api, orgId, projectId, rule, query) {
  const isExisting = isSavedRule(rule);
  const endpoint = `/projects/${orgId}/${projectId}/alert-rules/${isSavedRule(rule) ? `${rule.id}/` : ''}`;
  const method = isExisting ? 'PUT' : 'POST';
  return api.requestPromise(endpoint, {
    method,
    data: rule,
    query,
    includeAllArgs: true
  });
}
/**
 * Delete an existing rule
 *
 * @param api API Client
 * @param orgId Organization slug
 * @param rule Saved or Unsaved Metric Rule
 */

function deleteRule(api, orgId, rule) {
  return api.requestPromise(`/organizations/${orgId}/alert-rules/${rule.id}/`, {
    method: 'DELETE'
  });
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/constants.tsx":
/*!*****************************************************!*\
  !*** ./app/views/alerts/rules/metric/constants.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/alerts/rules/metric/incompatibleAlertQuery.tsx":
/*!******************************************************************!*\
  !*** ./app/views/alerts/rules/metric/incompatibleAlertQuery.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IncompatibleAlertQuery": () => (/* binding */ IncompatibleAlertQuery),
/* harmony export */   "checkMetricAlertCompatiablity": () => (/* binding */ checkMetricAlertCompatiablity)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










/**
 * Discover query supports more features than alert rules
 * To create an alert rule from a discover query, some parameters need to be adjusted
 */




function incompatibleYAxis(eventView) {
  var _yAxisConfig$measurem;

  const column = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.explodeFieldString)(eventView.getYAxis());

  if (column.kind === 'field' || column.kind === 'equation' || column.kind === 'calculatedField') {
    return true;
  }

  const eventTypeMatch = eventView.query.match(/event\.type:(transaction|error)/);

  if (!eventTypeMatch) {
    return false;
  }

  const dataset = eventTypeMatch[1];
  const yAxisConfig = dataset === 'error' ? sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_10__.errorFieldConfig : sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_10__.transactionFieldConfig;
  const invalidFunction = !yAxisConfig.aggregations.includes(column.function[0]); // Allow empty parameters, allow all numeric parameters - eg. apdex(300)

  const aggregation = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.AGGREGATIONS[column.function[0]];

  if (!aggregation) {
    return false;
  }

  const isNumericParameter = aggregation.parameters.some(param => param.kind === 'value' && param.dataType === 'number'); // There are other measurements possible, but for the time being, only allow alerting
  // on the predefined set of measurements for alerts.

  const allowedParameters = ['', ...yAxisConfig.fields, ...((_yAxisConfig$measurem = yAxisConfig.measurementKeys) !== null && _yAxisConfig$measurem !== void 0 ? _yAxisConfig$measurem : [])];
  const invalidParameter = !isNumericParameter && !allowedParameters.includes(column.function[1]);
  return invalidFunction || invalidParameter;
}

function checkMetricAlertCompatiablity(eventView) {
  // Must have exactly one project selected and not -1 (all projects)
  const hasProjectError = eventView.project.length !== 1 || eventView.project[0] === -1; // Must have one or zero environments

  const hasEnvironmentError = eventView.environment.length > 1; // Must have event.type of error or transaction

  const hasEventTypeError = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_11__.getQueryDatasource)(eventView.query) === null; // yAxis must be a function and enabled on alerts

  const hasYAxisError = incompatibleYAxis(eventView);
  return {
    hasProjectError,
    hasEnvironmentError,
    hasEventTypeError,
    hasYAxisError
  };
}

/**
 * Displays messages to the user on what needs to change in their query
 */
function IncompatibleAlertQuery(props) {
  const [isOpen, setIsOpen] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(true);
  const incompatibleQuery = checkMetricAlertCompatiablity(props.eventView);
  const totalErrors = Object.values(incompatibleQuery).filter(val => val).length;

  if (!totalErrors || !isOpen) {
    return null;
  }

  const eventTypeError = props.eventView.clone();
  eventTypeError.query += ' event.type:error';
  const eventTypeTransaction = props.eventView.clone();
  eventTypeTransaction.query += ' event.type:transaction';
  const eventTypeDefault = props.eventView.clone();
  eventTypeDefault.query += ' event.type:default';
  const eventTypeErrorDefault = props.eventView.clone();
  eventTypeErrorDefault.query += ' event.type:error or event.type:default';
  const pathname = `/organizations/${props.orgSlug}/discover/results/`;
  const eventTypeLinks = {
    error: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: {
        pathname,
        query: eventTypeError.generateQueryStringObject()
      }
    }),
    default: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: {
        pathname,
        query: eventTypeDefault.generateQueryStringObject()
      }
    }),
    transaction: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: {
        pathname,
        query: eventTypeTransaction.generateQueryStringObject()
      }
    }),
    errorDefault: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
      to: {
        pathname,
        query: eventTypeErrorDefault.generateQueryStringObject()
      }
    })
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledAlert, {
    type: "info",
    showIcon: true,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClose, {
        size: "sm"
      }),
      "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Close'),
      size: "zero",
      onClick: () => setIsOpen(false),
      borderless: true
    }),
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('The following problems occurred while creating your alert:'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledUnorderedList, {
      children: [incompatibleQuery.hasProjectError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("li", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No project was selected')
      }), incompatibleQuery.hasEnvironmentError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("li", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Too many environments were selected')
      }), incompatibleQuery.hasEventTypeError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("li", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)("An event type wasn't selected", eventTypeLinks)
      }), incompatibleQuery.hasYAxisError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("li", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('An alert can’t use the metric [yAxis] just yet.', {
          yAxis: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledCode, {
            children: props.eventView.getYAxis()
          })
        })
      })]
    })]
  });
}
IncompatibleAlertQuery.displayName = "IncompatibleAlertQuery";

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "el9s8lw2"
} : 0)("color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const StyledUnorderedList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "el9s8lw1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const StyledCode = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "el9s8lw0"
} : 0)( true ? {
  name: "1imza1v",
  styles: "background-color:transparent;padding:0"
} : 0);

/***/ }),

/***/ "./app/views/alerts/rules/metric/metricField.tsx":
/*!*******************************************************!*\
  !*** ./app/views/alerts/rules/metric/metricField.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getFieldOptionConfig": () => (/* binding */ getFieldOptionConfig)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/eventsV2/table/queryField */ "./app/views/eventsV2/table/queryField.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const getFieldOptionConfig = _ref => {
  let {
    dataset,
    alertType
  } = _ref;
  let config;
  let hidePrimarySelector = false;
  let hideParameterSelector = false;

  if (alertType) {
    config = (0,_constants__WEBPACK_IMPORTED_MODULE_9__.getWizardAlertFieldConfig)(alertType, dataset);
    hidePrimarySelector = sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_5__.hidePrimarySelectorSet.has(alertType);
    hideParameterSelector = sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_5__.hideParameterSelectorSet.has(alertType);
  } else {
    config = dataset === _types__WEBPACK_IMPORTED_MODULE_10__.Dataset.ERRORS ? _constants__WEBPACK_IMPORTED_MODULE_9__.errorFieldConfig : _constants__WEBPACK_IMPORTED_MODULE_9__.transactionFieldConfig;
  }

  const aggregations = Object.fromEntries(config.aggregations.map(key => {
    // TODO(scttcper): Temporary hack for default value while we handle the translation of user
    if (key === 'count_unique') {
      const agg = sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_4__.AGGREGATIONS[key];

      agg.getFieldOverrides = () => {
        return {
          defaultValue: 'tags[sentry:user]'
        };
      };

      return [key, agg];
    }

    return [key, sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_4__.AGGREGATIONS[key]];
  }));
  const fieldKeys = config.fields.map(key => {
    // XXX(epurkhiser): Temporary hack while we handle the translation of user ->
    // tags[sentry:user].
    if (key === 'user') {
      return 'tags[sentry:user]';
    }

    return key;
  });
  const {
    measurementKeys
  } = config;
  return {
    fieldOptionsConfig: {
      aggregations,
      fieldKeys,
      measurementKeys
    },
    hidePrimarySelector,
    hideParameterSelector
  };
};

const MetricField = _ref2 => {
  let {
    organization,
    columnWidth,
    inFieldLabels,
    alertType,
    ...props
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_3__["default"], { ...props,
    children: _ref3 => {
      var _fieldOptions$fieldKe;

      let {
        onChange,
        value,
        model,
        disabled
      } = _ref3;
      const dataset = model.getValue('dataset');
      const {
        fieldOptionsConfig,
        hidePrimarySelector,
        hideParameterSelector
      } = getFieldOptionConfig({
        dataset: dataset,
        alertType
      });
      const fieldOptions = (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_8__.generateFieldOptions)({
        organization,
        ...fieldOptionsConfig
      });
      const fieldValue = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_4__.explodeFieldString)(value !== null && value !== void 0 ? value : '');
      const fieldKey = (fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_7__.FieldValueKind.FUNCTION ? `function:${fieldValue.function[0]}` : '';
      const selectedField = (_fieldOptions$fieldKe = fieldOptions[fieldKey]) === null || _fieldOptions$fieldKe === void 0 ? void 0 : _fieldOptions$fieldKe.value;
      const numParameters = (selectedField === null || selectedField === void 0 ? void 0 : selectedField.kind) === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_7__.FieldValueKind.FUNCTION ? selectedField.meta.parameters.length : 0;
      const parameterColumns = numParameters - (hideParameterSelector ? 1 : 0) - (hidePrimarySelector ? 1 : 0);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(StyledQueryField, {
          filterPrimaryOptions: option => option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_7__.FieldValueKind.FUNCTION,
          fieldOptions: fieldOptions,
          fieldValue: fieldValue,
          onChange: v => onChange((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_4__.generateFieldAsString)(v), {}),
          columnWidth: columnWidth,
          gridColumns: parameterColumns + 1,
          inFieldLabels: inFieldLabels,
          shouldRenderTag: false,
          disabled: disabled,
          hideParameterSelector: hideParameterSelector,
          hidePrimarySelector: hidePrimarySelector
        })
      });
    }
  });
};

MetricField.displayName = "MetricField";

const StyledQueryField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_6__.QueryField,  true ? {
  target: "e1a5h5oy1"
} : 0)(p => p.columnWidth && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_12__.css)("width:", p.gridColumns * p.columnWidth, "px;" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const PresetButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1a5h5oy0"
} : 0)(p => p.disabled && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_12__.css)("color:", p.theme.textColor, ";&:hover,&:focus{color:", p.theme.textColor, ";}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

PresetButton.defaultProps = {
  priority: 'link',
  borderless: true
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MetricField);

/***/ }),

/***/ "./app/views/alerts/rules/metric/presetSidebar.tsx":
/*!*********************************************************!*\
  !*** ./app/views/alerts/rules/metric/presetSidebar.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PresetSidebar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.promise.finally.js */ "../node_modules/core-js/modules/es.promise.finally.js");
/* harmony import */ var core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_finally_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _presets__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./presets */ "./app/views/alerts/rules/metric/presets.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











function PresetSidebar(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
    className: props.className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Header, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Suggested Alerts')
    }), _presets__WEBPACK_IMPORTED_MODULE_9__.PRESET_AGGREGATES.map((preset, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(PresetSidebarItem, {
      preset: preset,
      index: i,
      organization: props.organization,
      project: props.project,
      selected: props.selectedPresetId === preset.id,
      onClick: ctx => props.onSelect && props.onSelect(preset, ctx)
    }, preset.id))]
  });
}
PresetSidebar.displayName = "PresetSidebar";

function PresetSidebarItem(props) {
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.a)();
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__["default"])();
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const iconColor = theme.charts.getColorPalette(_presets__WEBPACK_IMPORTED_MODULE_9__.PRESET_AGGREGATES.length)[props.index];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(StyledPresetSidebarItemContainer, {
    selected: props.selected || false,
    onClick: () => {
      if (loading) {
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__["default"])('growth.metric_alert_preset_sidebar_clicked', {
        organization: props.organization,
        preset: props.preset.id
      });
      setLoading(true);
      props.preset.makeContext(api, props.project, props.organization).then(props.onClick).finally(() => setLoading(false));
    },
    children: [loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(LoadingWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledLoadingIndicator, {
        hideMessage: true
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
      backgroundColor: iconColor,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(props.preset.Icon, {
        color: "white"
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("h1", {
        children: props.preset.title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("small", {
        children: props.preset.description
      })]
    })]
  });
}

PresetSidebarItem.displayName = "PresetSidebarItem";

const LoadingWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebcw0ex4"
} : 0)("position:absolute;background-color:", p => p.theme.overlayBackgroundAlpha, ";top:0;bottom:0;left:0;right:0;display:flex;justify-content:center;align-items:center;cursor:default;" + ( true ? "" : 0));

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "ebcw0ex3"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const StyledPresetSidebarItemContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebcw0ex2"
} : 0)("border:1px solid transparent;position:relative;overflow:hidden;border-radius:", p => p.theme.borderRadius, ";transition:border-color 0.3s ease;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";h1{font-size:", p => p.theme.fontSizeLarge, ";font-weight:500;margin-bottom:0;color:", p => p.theme.gray500, ";}small{color:", p => p.theme.gray300, ";}display:flex;flex-direction:row;align-items:start;cursor:pointer;user-select:none;&:hover{border-color:", p => p.theme.gray100, ";}", p => p.selected && `border-color: ${p.theme.gray200};`, ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h5',  true ? {
  target: "ebcw0ex1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebcw0ex0"
} : 0)("display:flex;justify-content:center;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";min-width:40px;height:40px;border-radius:", p => p.theme.borderRadius, ";background:", p => p.backgroundColor, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/ruleConditionsForm.tsx":
/*!**************************************************************!*\
  !*** ./app/views/alerts/rules/metric/ruleConditionsForm.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/index-4322c0ed.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/events/searchBar */ "./app/components/events/searchBar.tsx");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_environment__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/environment */ "./app/utils/environment.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_wizardField__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/wizardField */ "./app/views/alerts/rules/metric/wizardField.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




























const TIME_WINDOW_MAP = {
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.ONE_MINUTE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('1 minute'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.FIVE_MINUTES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('5 minutes'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.TEN_MINUTES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('10 minutes'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.FIFTEEN_MINUTES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('15 minutes'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.THIRTY_MINUTES]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('30 minutes'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.ONE_HOUR]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('1 hour'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.TWO_HOURS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('2 hours'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.FOUR_HOURS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('4 hours'),
  [_types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.ONE_DAY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('24 hours')
};

class RuleConditionsForm extends react__WEBPACK_IMPORTED_MODULE_4__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      environments: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formElemBaseStyle", {
      padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5)}`,
      border: 'none'
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.project.id === this.props.project.id) {
      return;
    }

    this.fetchData();
  }

  async fetchData() {
    const {
      api,
      organization,
      project
    } = this.props;

    try {
      const environments = await api.requestPromise(`/projects/${organization.slug}/${project.slug}/environments/`, {
        query: {
          visibility: 'visible'
        }
      });
      this.setState({
        environments
      });
    } catch (_err) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Unable to fetch environments'));
    }
  }

  get timeWindowOptions() {
    let options = TIME_WINDOW_MAP;

    if ((0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_24__.isCrashFreeAlert)(this.props.dataset)) {
      options = lodash_pick__WEBPACK_IMPORTED_MODULE_5___default()(TIME_WINDOW_MAP, [// TimeWindow.THIRTY_MINUTES, leaving this option out until we figure out the sub-hour session resolution chart limitations
      _types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.ONE_HOUR, _types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.TWO_HOURS, _types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.FOUR_HOURS, _types__WEBPACK_IMPORTED_MODULE_26__.TimeWindow.ONE_DAY]);
    }

    return Object.entries(options).map(_ref => {
      let [value, label] = _ref;
      return {
        value: parseInt(value, 10),
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('[timeWindow] interval', {
          timeWindow: label.slice(-1) === 's' ? label.slice(0, -1) : label
        })
      };
    });
  }

  get searchPlaceholder() {
    switch (this.props.dataset) {
      case _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.ERRORS:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter events by level, message, and other properties\u2026');

      case _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.METRICS:
      case _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.SESSIONS:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter sessions by release version\u2026');

      case _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.TRANSACTIONS:
      default:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter transactions by URL, tags, and other properties\u2026');
    }
  }

  get searchSupportedTags() {
    if ((0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_24__.isCrashFreeAlert)(this.props.dataset)) {
      return {
        release: {
          key: 'release',
          name: 'release'
        }
      };
    }

    return undefined;
  }

  renderEventTypeFilter() {
    const {
      organization,
      disabled,
      alertType
    } = this.props;
    const dataSourceOptions = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Errors'),
      options: [{
        value: _types__WEBPACK_IMPORTED_MODULE_26__.Datasource.ERROR_DEFAULT,
        label: sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.DATA_SOURCE_LABELS[_types__WEBPACK_IMPORTED_MODULE_26__.Datasource.ERROR_DEFAULT]
      }, {
        value: _types__WEBPACK_IMPORTED_MODULE_26__.Datasource.DEFAULT,
        label: sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.DATA_SOURCE_LABELS[_types__WEBPACK_IMPORTED_MODULE_26__.Datasource.DEFAULT]
      }, {
        value: _types__WEBPACK_IMPORTED_MODULE_26__.Datasource.ERROR,
        label: sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.DATA_SOURCE_LABELS[_types__WEBPACK_IMPORTED_MODULE_26__.Datasource.ERROR]
      }]
    }];

    if (organization.features.includes('performance-view') && alertType === 'custom') {
      dataSourceOptions.push({
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Transactions'),
        options: [{
          value: _types__WEBPACK_IMPORTED_MODULE_26__.Datasource.TRANSACTION,
          label: sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.DATA_SOURCE_LABELS[_types__WEBPACK_IMPORTED_MODULE_26__.Datasource.TRANSACTION]
        }]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_9__["default"], {
      name: "datasource",
      inline: false,
      style: { ...this.formElemBaseStyle,
        minWidth: 300,
        flex: 2
      },
      flexibleControlStateSize: true,
      children: _ref2 => {
        let {
          onChange,
          onBlur,
          model
        } = _ref2;
        const formDataset = model.getValue('dataset');
        const formEventTypes = model.getValue('eventTypes');
        const mappedValue = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.convertDatasetEventTypesToSource)(formDataset, formEventTypes);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          value: mappedValue,
          inFieldLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Events: '),
          onChange: optionObj => {
            var _DATA_SOURCE_TO_SET_A;

            const optionValue = optionObj.value;
            onChange(optionValue, {});
            onBlur(optionValue, {}); // Reset the aggregate to the default (which works across
            // datatypes), otherwise we may send snuba an invalid query
            // (transaction aggregate on events datasource = bad).

            optionValue === 'transaction' ? model.setValue('aggregate', _constants__WEBPACK_IMPORTED_MODULE_25__.DEFAULT_TRANSACTION_AGGREGATE) : model.setValue('aggregate', _constants__WEBPACK_IMPORTED_MODULE_25__.DEFAULT_AGGREGATE); // set the value of the dataset and event type from data source

            const {
              dataset: datasetFromDataSource,
              eventTypes
            } = (_DATA_SOURCE_TO_SET_A = sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_23__.DATA_SOURCE_TO_SET_AND_EVENT_TYPES[optionValue]) !== null && _DATA_SOURCE_TO_SET_A !== void 0 ? _DATA_SOURCE_TO_SET_A : {};
            model.setValue('dataset', datasetFromDataSource);
            model.setValue('eventTypes', eventTypes);
          },
          options: dataSourceOptions,
          isDisabled: disabled
        });
      }
    });
  }

  renderIdBadge(project) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
      project: project,
      avatarProps: {
        consistentWidth: true
      },
      avatarSize: 18,
      disableLink: true,
      hideName: true
    });
  }

  renderProjectSelector() {
    const {
      project: _selectedProject,
      projects,
      disabled,
      organization,
      disableProjectSelector
    } = this.props;
    const hasOpenMembership = organization.features.includes('open-membership');
    const myProjects = projects.filter(project => project.hasAccess && project.isMember);
    const allProjects = projects.filter(project => project.hasAccess && !project.isMember);
    const myProjectOptions = myProjects.map(myProject => ({
      value: myProject.id,
      label: myProject.slug,
      leadingItems: this.renderIdBadge(myProject)
    }));
    const openMembershipProjects = [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('My Projects'),
      options: myProjectOptions
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All Projects'),
      options: allProjects.map(allProject => ({
        value: allProject.id,
        label: allProject.slug,
        leadingItems: this.renderIdBadge(allProject)
      }))
    }];
    const projectOptions = hasOpenMembership || (0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_20__.isActiveSuperuser)() ? openMembershipProjects : myProjectOptions;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_9__["default"], {
      name: "projectId",
      inline: false,
      style: { ...this.formElemBaseStyle,
        minWidth: 300,
        flex: 2
      },
      flexibleControlStateSize: true,
      children: _ref3 => {
        let {
          onChange,
          onBlur,
          model
        } = _ref3;

        const selectedProject = projects.find(_ref4 => {
          let {
            id
          } = _ref4;
          return id === model.getValue('projectId');
        }) || _selectedProject;

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          isDisabled: disabled || disableProjectSelector,
          value: selectedProject.id,
          options: projectOptions,
          onChange: _ref5 => {
            var _projects$find, _model$getValue;

            let {
              value
            } = _ref5;
            // if the current owner/team isn't part of project selected, update to the first available team
            const nextSelectedProject = (_projects$find = projects.find(_ref6 => {
              let {
                id
              } = _ref6;
              return id === value;
            })) !== null && _projects$find !== void 0 ? _projects$find : selectedProject;
            const ownerId = (_model$getValue = model.getValue('owner')) === null || _model$getValue === void 0 ? void 0 : _model$getValue.split(':')[1];

            if (ownerId && nextSelectedProject.teams.find(_ref7 => {
              let {
                id
              } = _ref7;
              return id === ownerId;
            }) === undefined && nextSelectedProject.teams.length) {
              model.setValue('owner', `team:${nextSelectedProject.teams[0].id}`);
            }

            onChange(value, {});
            onBlur(value, {});
          },
          components: {
            SingleValue: containerProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(react_select__WEBPACK_IMPORTED_MODULE_28__.y.ValueContainer, { ...containerProps,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
                project: selectedProject,
                avatarProps: {
                  consistentWidth: true
                },
                avatarSize: 18,
                disableLink: true
              })
            })
          }
        });
      }
    });
  }

  renderInterval() {
    const {
      organization,
      disabled,
      alertType,
      timeWindow,
      onTimeWindowChange
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledListItem, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledListTitle, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Define your metric')
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(FormRow, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_alerts_rules_metric_wizardField__WEBPACK_IMPORTED_MODULE_22__["default"], {
          name: "aggregate",
          help: null,
          organization: organization,
          disabled: disabled,
          style: { ...this.formElemBaseStyle,
            flex: 1
          },
          inline: false,
          flexibleControlStateSize: true,
          columnWidth: 200,
          alertType: alertType,
          required: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_10__["default"], {
          name: "timeWindow",
          styles: {
            control: provided => ({ ...provided,
              minWidth: 200,
              maxWidth: 300
            }),
            container: provided => ({ ...provided,
              margin: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5)}`
            })
          },
          options: this.timeWindowOptions,
          required: true,
          isDisabled: disabled,
          value: timeWindow,
          onChange: _ref8 => {
            let {
              value
            } = _ref8;
            return onTimeWindowChange(value);
          },
          inline: false,
          flexibleControlStateSize: true
        })]
      })]
    });
  }

  render() {
    var _environments$map;

    const {
      organization,
      disabled,
      onFilterSearch,
      allowChangeEventTypes,
      dataset,
      showMEPAlertBanner
    } = this.props;
    const {
      environments
    } = this.state;
    const environmentOptions = [{
      value: null,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All Environments')
    }, ...((_environments$map = environments === null || environments === void 0 ? void 0 : environments.map(env => ({
      value: env.name,
      label: (0,sentry_utils_environment__WEBPACK_IMPORTED_MODULE_18__.getDisplayName)(env)
    }))) !== null && _environments$map !== void 0 ? _environments$map : [])];
    const transactionTags = ['transaction', 'transaction.duration', 'transaction.op', 'transaction.status'];
    const measurementTags = Object.values({ ...sentry_utils_fields__WEBPACK_IMPORTED_MODULE_19__.WebVital,
      ...sentry_utils_fields__WEBPACK_IMPORTED_MODULE_19__.MobileVital
    });
    const eventOmitTags = dataset === 'events' ? [...measurementTags, ...transactionTags] : [];
    const hasMetricDataset = organization.features.includes('metrics-performance-alerts') || organization.features.includes('mep-rollout-flag');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ChartPanel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledPanelBody, {
          children: this.props.thresholdChart
        })
      }), showMEPAlertBanner && hasMetricDataset && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(AlertContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
          type: "info",
          showIcon: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.tct)('Filtering by these conditions automatically switch you to indexed events. [link:Learn more].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"], {
              href: "https://docs.sentry.io/product/sentry-basics/metrics/"
            })
          })
        })
      }), this.renderInterval(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledListItem, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Filter events')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(FormRow, {
        noMargin: true,
        columns: 1 + (allowChangeEventTypes ? 1 : 0) + 1,
        children: [this.renderProjectSelector(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_11__["default"], {
          name: "environment",
          placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All Environments'),
          style: { ...this.formElemBaseStyle,
            minWidth: 230,
            flex: 1
          },
          styles: {
            singleValue: base => ({ ...base
            }),
            option: base => ({ ...base
            })
          },
          options: environmentOptions,
          isDisabled: disabled || this.state.environments === null,
          isClearable: true,
          inline: false,
          flexibleControlStateSize: true
        }), allowChangeEventTypes && this.renderEventTypeFilter()]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(FormRow, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_9__["default"], {
          name: "query",
          inline: false,
          style: { ...this.formElemBaseStyle,
            flex: '6 0 500px'
          },
          flexibleControlStateSize: true,
          children: _ref9 => {
            var _initialData$query;

            let {
              onChange,
              onBlur,
              onKeyDown,
              initialData
            } = _ref9;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(SearchContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledSearchBar, {
                searchSource: "alert_builder",
                defaultQuery: (_initialData$query = initialData === null || initialData === void 0 ? void 0 : initialData.query) !== null && _initialData$query !== void 0 ? _initialData$query : '',
                omitTags: ['event.type', 'release.version', 'release.stage', 'release.package', 'release.build', 'project', ...eventOmitTags],
                includeSessionTagsValues: dataset === _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.SESSIONS,
                disabled: disabled,
                useFormWrapper: false,
                organization: organization,
                placeholder: this.searchPlaceholder,
                onChange: onChange,
                query: initialData.query,
                onKeyDown: e => {
                  /**
                   * Do not allow enter key to submit the alerts form since it is unlikely
                   * users will be ready to create the rule as this sits above required fields.
                   */
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }

                  onKeyDown === null || onKeyDown === void 0 ? void 0 : onKeyDown(e);
                },
                onClose: query => {
                  onFilterSearch(query);
                  onBlur(query);
                },
                onSearch: query => {
                  onFilterSearch(query);
                  onChange(query, {});
                },
                ...(this.searchSupportedTags ? {
                  supportedTags: this.searchSupportedTags
                } : {}),
                hasRecentSearches: dataset !== _types__WEBPACK_IMPORTED_MODULE_26__.Dataset.SESSIONS
              })
            });
          }
        })
      })]
    });
  }

}

RuleConditionsForm.displayName = "RuleConditionsForm";

const StyledListTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3ltgsh7"
} : 0)("display:flex;span{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";}" + ( true ? "" : 0));

const ChartPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel,  true ? {
  target: "e3ltgsh6"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";" + ( true ? "" : 0));

const AlertContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3ltgsh5"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));

const StyledPanelBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody,  true ? {
  target: "e3ltgsh4"
} : 0)("ol,h4{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";}" + ( true ? "" : 0));

const SearchContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3ltgsh3"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_searchBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e3ltgsh2"
} : 0)( true ? {
  name: "1ff36h2",
  styles: "flex-grow:1"
} : 0);

const StyledListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e3ltgsh1"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";font-size:", p => p.theme.fontSizeExtraLarge, ";line-height:1.3;" + ( true ? "" : 0));

const FormRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3ltgsh0"
} : 0)("display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;margin-bottom:", p => p.noMargin ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(4), ";", p => p.columns !== undefined && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_29__.css)("display:grid;grid-template-columns:repeat(", p.columns, ", auto);" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_21__["default"])(RuleConditionsForm));

/***/ }),

/***/ "./app/views/alerts/rules/metric/ruleForm.tsx":
/*!****************************************************!*\
  !*** ./app/views/alerts/rules/metric/ruleForm.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/stores/indicatorStore */ "./app/stores/indicatorStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_incompatibleAlertQuery__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/incompatibleAlertQuery */ "./app/views/alerts/rules/metric/incompatibleAlertQuery.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_ruleNameOwnerForm__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/ruleNameOwnerForm */ "./app/views/alerts/rules/metric/ruleNameOwnerForm.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_thresholdTypeForm__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/thresholdTypeForm */ "./app/views/alerts/rules/metric/thresholdTypeForm.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers */ "./app/views/alerts/rules/metric/triggers/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_chart__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/chart */ "./app/views/alerts/rules/metric/triggers/chart/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/utils/getEventTypeFilter */ "./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_utils_hasThresholdValue__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/utils/hasThresholdValue */ "./app/views/alerts/rules/metric/utils/hasThresholdValue.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ./utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");
/* harmony import */ var _actions__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./actions */ "./app/views/alerts/rules/metric/actions.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _presets__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./presets */ "./app/views/alerts/rules/metric/presets.tsx");
/* harmony import */ var _presetSidebar__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./presetSidebar */ "./app/views/alerts/rules/metric/presetSidebar.tsx");
/* harmony import */ var _ruleConditionsForm__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./ruleConditionsForm */ "./app/views/alerts/rules/metric/ruleConditionsForm.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










































const POLLING_MAX_TIME_LIMIT = 3 * 60000;

const isEmpty = str => str === '' || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_21__.defined)(str);

class RuleFormContainer extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_8__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "form", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_14__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pollingTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "resetPollingState", loadingSlackIndicator => {
      sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__["default"].remove(loadingSlackIndicator);
      this.setState({
        loading: false,
        uuid: undefined
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "pollHandler", async (model, quitTime, loadingSlackIndicator) => {
      if (Date.now() > quitTime) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Looking for that channel took too long :('));
        this.resetPollingState(loadingSlackIndicator);
        return;
      }

      const {
        organization,
        onSubmitSuccess,
        params: {
          ruleId
        }
      } = this.props;
      const {
        uuid,
        project
      } = this.state;

      try {
        const response = await this.api.requestPromise(`/projects/${organization.slug}/${project.slug}/alert-rule-task/${uuid}/`);
        const {
          status,
          alertRule,
          error
        } = response;

        if (status === 'pending') {
          window.clearTimeout(this.pollingTimeout);
          this.pollingTimeout = window.setTimeout(() => {
            this.pollHandler(model, quitTime, loadingSlackIndicator);
          }, 1000);
          return;
        }

        this.resetPollingState(loadingSlackIndicator);

        if (status === 'failed') {
          this.handleRuleSaveFailure(error);
        }

        if (alertRule) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)(ruleId ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Updated alert rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Created alert rule'));

          if (onSubmitSuccess) {
            onSubmitSuccess(alertRule, model);
          }
        }
      } catch {
        this.handleRuleSaveFailure((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('An error occurred'));
        this.resetPollingState(loadingSlackIndicator);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "isValidTrigger", (triggerIndex, trigger, errors, resolveThreshold) => {
      const {
        alertThreshold
      } = trigger;
      const {
        thresholdType
      } = this.state; // If value and/or other value is empty
      // then there are no checks to perform against

      if (!(0,sentry_views_alerts_rules_metric_utils_hasThresholdValue__WEBPACK_IMPORTED_MODULE_32__["default"])(alertThreshold) || !(0,sentry_views_alerts_rules_metric_utils_hasThresholdValue__WEBPACK_IMPORTED_MODULE_32__["default"])(resolveThreshold)) {
        return true;
      } // If this is alert threshold and not inverted, it can't be below resolve
      // If this is alert threshold and inverted, it can't be above resolve
      // If this is resolve threshold and not inverted, it can't be above resolve
      // If this is resolve threshold and inverted, it can't be below resolve
      // Since we're comparing non-inclusive thresholds here (>, <), we need
      // to modify the values when we compare. An example of why:
      // Alert > 0, resolve < 1. This means that we want to alert on values
      // of 1 or more, and resolve on values of 0 or less. This is valid, but
      // without modifying the values, this boundary case will fail.


      const isValid = thresholdType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleThresholdType.BELOW ? alertThreshold - 1 < resolveThreshold + 1 : alertThreshold + 1 > resolveThreshold - 1;
      const otherErrors = errors.get(triggerIndex) || {};

      if (isValid) {
        return true;
      } // Not valid... let's figure out an error message


      const isBelow = thresholdType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleThresholdType.BELOW;
      let errorMessage = '';

      if (typeof resolveThreshold !== 'number') {
        errorMessage = isBelow ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Resolution threshold must be greater than alert') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Resolution threshold must be less than alert');
      } else {
        errorMessage = isBelow ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Alert threshold must be less than resolution') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Alert threshold must be greater than resolution');
      }

      errors.set(triggerIndex, { ...otherErrors,
        alertThreshold: errorMessage
      });
      return false;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", (name, value) => {
      const {
        projects
      } = this.props;

      if (['aggregate', 'dataset', 'eventTypes', 'timeWindow', 'environment', 'comparisonDelta', 'projectId'].includes(name)) {
        this.setState(_ref => {
          let {
            project: _project
          } = _ref;
          return {
            [name]: value,
            project: name === 'projectId' ? projects.find(_ref2 => {
              let {
                id
              } = _ref2;
              return id === value;
            }) : _project
          };
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFilterUpdate", query => {
      const {
        organization,
        sessionId
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('alert_builder.filter', {
        organization,
        session_id: sessionId,
        query
      });
      this.setState({
        query
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async (_data, _onSubmitSuccess, _onSubmitError, _e, model) => {
      // This validates all fields *except* for Triggers
      const validRule = model.validateForm(); // Validate Triggers

      const triggerErrors = this.validateTriggers();
      const validTriggers = Array.from(triggerErrors).length === 0;

      if (!validTriggers) {
        this.setState(state => ({
          triggerErrors: new Map([...triggerErrors, ...state.triggerErrors])
        }));
      }

      if (!validRule || !validTriggers) {
        const missingFields = [!validRule && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('name'), !validRule && !validTriggers && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('and'), !validTriggers && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('critical threshold')].filter(x => x);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)(`Alert not valid: missing %s`, missingFields.join(' ')));
        return;
      }

      const {
        organization,
        rule,
        onSubmitSuccess,
        location,
        sessionId,
        params: {
          ruleId
        }
      } = this.props;
      const {
        project,
        aggregate,
        dataset,
        resolveThreshold,
        triggers,
        thresholdType,
        thresholdPeriod,
        comparisonDelta,
        uuid,
        timeWindow,
        eventTypes
      } = this.state; // Remove empty warning trigger

      const sanitizedTriggers = triggers.filter(trigger => trigger.label !== _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleTriggerType.WARNING || !isEmpty(trigger.alertThreshold)); // form model has all form state data, however we use local state to keep
      // track of the list of triggers (and actions within triggers)

      const loadingIndicator = sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__["default"].addMessage((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Saving your alert rule, hold on...'), 'loading');

      try {
        var _location$query;

        const transaction = sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__.metric.startTransaction({
          name: 'saveAlertRule'
        });
        transaction.setTag('type', sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_33__.AlertRuleType.METRIC);
        transaction.setTag('operation', !rule.id ? 'create' : 'edit');

        for (const trigger of sanitizedTriggers) {
          for (const action of trigger.actions) {
            if (action.type === 'slack') {
              transaction.setTag(action.type, true);
            }
          }
        }

        transaction.setData('actions', sanitizedTriggers);
        const hasMetricDataset = organization.features.includes('metrics-performance-alerts') || organization.features.includes('mep-rollout-flag');
        this.setState({
          loading: true
        });
        const [data,, resp] = await (0,_actions__WEBPACK_IMPORTED_MODULE_37__.addOrUpdateRule)(this.api, organization.slug, project.slug, { ...rule,
          ...model.getTransformedData(),
          triggers: sanitizedTriggers,
          resolveThreshold: isEmpty(resolveThreshold) ? null : resolveThreshold,
          thresholdType,
          thresholdPeriod,
          comparisonDelta: comparisonDelta !== null && comparisonDelta !== void 0 ? comparisonDelta : null,
          timeWindow,
          aggregate,
          ...(hasMetricDataset ? {
            queryType: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_34__.DatasetMEPAlertQueryTypes[dataset]
          } : {}),
          // Remove eventTypes as it is no longer requred for crash free
          eventTypes: (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_36__.isCrashFreeAlert)(rule.dataset) ? undefined : eventTypes,
          dataset
        }, {
          duplicateRule: this.isDuplicateRule ? 'true' : 'false',
          wizardV3: 'true',
          referrer: location === null || location === void 0 ? void 0 : (_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.referrer,
          sessionId
        }); // if we get a 202 back it means that we have an async task
        // running to lookup and verify the channel id for Slack.

        if ((resp === null || resp === void 0 ? void 0 : resp.status) === 202) {
          // if we have a uuid in state, no need to start a new polling cycle
          if (!uuid) {
            this.setState({
              loading: true,
              uuid: data.uuid
            });
            this.fetchStatus(model);
          }
        } else {
          sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__["default"].remove(loadingIndicator);
          this.setState({
            loading: false
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addSuccessMessage)(ruleId ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Updated alert rule') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Created alert rule'));

          if (onSubmitSuccess) {
            onSubmitSuccess(data, model);
          }
        }
      } catch (err) {
        sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__["default"].remove(loadingIndicator);
        this.setState({
          loading: false
        });
        const errors = err !== null && err !== void 0 && err.responseJSON ? Array.isArray(err === null || err === void 0 ? void 0 : err.responseJSON) ? err === null || err === void 0 ? void 0 : err.responseJSON : Object.values(err === null || err === void 0 ? void 0 : err.responseJSON) : [];
        const apiErrors = errors.length > 0 ? `: ${errors.join(', ')}` : '';
        this.handleRuleSaveFailure((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Unable to save alert%s', apiErrors));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeTriggers", (triggers, triggerIndex) => {
      this.setState(state => {
        let triggerErrors = state.triggerErrors;
        const newTriggerErrors = this.validateTriggers(triggers, state.thresholdType, state.resolveThreshold, triggerIndex);
        triggerErrors = newTriggerErrors;

        if (Array.from(newTriggerErrors).length === 0) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
        }

        return {
          triggers,
          triggerErrors
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleThresholdTypeChange", thresholdType => {
      const {
        triggers
      } = this.state;
      const triggerErrors = this.validateTriggers(triggers, thresholdType);
      this.setState(state => ({
        thresholdType,
        triggerErrors: new Map([...triggerErrors, ...state.triggerErrors])
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleThresholdPeriodChange", value => {
      this.setState({
        thresholdPeriod: value
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleResolveThresholdChange", resolveThreshold => {
      this.setState(state => {
        const triggerErrors = this.validateTriggers(state.triggers, state.thresholdType, resolveThreshold);

        if (Array.from(triggerErrors).length === 0) {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
        }

        return {
          resolveThreshold,
          triggerErrors
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleComparisonTypeChange", value => {
      var _this$state$compariso;

      const comparisonDelta = value === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleComparisonType.COUNT ? undefined : (_this$state$compariso = this.state.comparisonDelta) !== null && _this$state$compariso !== void 0 ? _this$state$compariso : _constants__WEBPACK_IMPORTED_MODULE_38__.DEFAULT_CHANGE_COMP_DELTA;
      const timeWindow = this.state.comparisonDelta ? _constants__WEBPACK_IMPORTED_MODULE_38__.DEFAULT_COUNT_TIME_WINDOW : _constants__WEBPACK_IMPORTED_MODULE_38__.DEFAULT_CHANGE_TIME_WINDOW;
      this.setState({
        comparisonType: value,
        comparisonDelta,
        timeWindow
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteRule", async () => {
      const {
        params
      } = this.props;
      const {
        orgId,
        projectId,
        ruleId
      } = params;

      try {
        await this.api.requestPromise(`/projects/${orgId}/${projectId}/alert-rules/${ruleId}/`, {
          method: 'DELETE'
        });
        this.goBack();
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Error deleting rule'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRuleSaveFailure", msg => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)(msg);
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__.metric.endTransaction({
        name: 'saveAlertRule'
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCancel", () => {
      this.goBack();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMEPAlertDataset", data => {
      const {
        isMetricsData
      } = data !== null && data !== void 0 ? data : {};

      if (isMetricsData === undefined || !this.props.organization.features.includes('metrics-performance-alerts')) {
        return;
      }

      const {
        dataset,
        showMEPAlertBanner
      } = this.state;

      if (isMetricsData && dataset === _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.TRANSACTIONS) {
        this.setState({
          dataset: _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.GENERIC_METRICS,
          showMEPAlertBanner: false
        });
      }

      if (!isMetricsData && dataset === _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.GENERIC_METRICS && !showMEPAlertBanner) {
        this.setState({
          dataset: _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.TRANSACTIONS,
          showMEPAlertBanner: true
        });
      }
    });
  }

  get isDuplicateRule() {
    return Boolean(this.props.isDuplicateRule);
  }

  get chartQuery() {
    const {
      query,
      eventTypes,
      dataset
    } = this.state;
    const eventTypeFilter = (0,sentry_views_alerts_rules_metric_utils_getEventTypeFilter__WEBPACK_IMPORTED_MODULE_31__.getEventTypeFilter)(this.state.dataset, eventTypes);
    const queryWithTypeFilter = `${query} ${eventTypeFilter}`.trim();
    return (0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_36__.isCrashFreeAlert)(dataset) ? query : queryWithTypeFilter;
  }

  componentDidMount() {
    var _this$props$location;

    const {
      organization
    } = this.props;
    const {
      project
    } = this.state; // SearchBar gets its tags from Reflux.

    (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_6__.fetchOrganizationTags)(this.api, organization.slug, [project.id]);

    if ((_this$props$location = this.props.location) !== null && _this$props$location !== void 0 && _this$props$location.query.preset) {
      const preset = _presets__WEBPACK_IMPORTED_MODULE_39__.PRESET_AGGREGATES.find(p => p.id === this.props.location.query.preset);

      if (preset) {
        preset.makeContext(this.api, project, this.props.organization).then(ctx => this.setPreset(preset, ctx));
      }
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.pollingTimeout);
  }

  getDefaultState() {
    var _location$query2, _ref3, _ref4, _rule$query, _rule$thresholdPeriod, _rule$comparisonDelta;

    const {
      rule,
      location
    } = this.props;
    const triggersClone = [...rule.triggers];
    const {
      aggregate,
      eventTypes: _eventTypes,
      dataset,
      name,
      showMEPAlertBanner
    } = (_location$query2 = location === null || location === void 0 ? void 0 : location.query) !== null && _location$query2 !== void 0 ? _location$query2 : {};
    const eventTypes = typeof _eventTypes === 'string' ? [_eventTypes] : _eventTypes; // Warning trigger is removed if it is blank when saving

    if (triggersClone.length !== 2) {
      triggersClone.push((0,_constants__WEBPACK_IMPORTED_MODULE_38__.createDefaultTrigger)(_types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleTriggerType.WARNING));
    }

    return { ...super.getDefaultState(),
      name: (_ref3 = name !== null && name !== void 0 ? name : rule.name) !== null && _ref3 !== void 0 ? _ref3 : '',
      aggregate: aggregate !== null && aggregate !== void 0 ? aggregate : rule.aggregate,
      dataset: dataset !== null && dataset !== void 0 ? dataset : rule.dataset,
      eventTypes: (_ref4 = eventTypes !== null && eventTypes !== void 0 ? eventTypes : rule.eventTypes) !== null && _ref4 !== void 0 ? _ref4 : [],
      query: (_rule$query = rule.query) !== null && _rule$query !== void 0 ? _rule$query : '',
      timeWindow: rule.timeWindow,
      environment: rule.environment || null,
      triggerErrors: new Map(),
      availableActions: null,
      triggers: triggersClone,
      resolveThreshold: rule.resolveThreshold,
      thresholdType: rule.thresholdType,
      thresholdPeriod: (_rule$thresholdPeriod = rule.thresholdPeriod) !== null && _rule$thresholdPeriod !== void 0 ? _rule$thresholdPeriod : 1,
      comparisonDelta: (_rule$comparisonDelta = rule.comparisonDelta) !== null && _rule$comparisonDelta !== void 0 ? _rule$comparisonDelta : undefined,
      comparisonType: rule.comparisonDelta ? _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleComparisonType.CHANGE : _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleComparisonType.COUNT,
      project: this.props.project,
      owner: rule.owner,
      showMEPAlertBanner: showMEPAlertBanner !== null && showMEPAlertBanner !== void 0 ? showMEPAlertBanner : false
    };
  }

  getEndpoints() {
    const {
      orgId
    } = this.props.params; // TODO(incidents): This is temporary until new API endpoints
    // We should be able to just fetch the rule if rule.id exists

    return [['availableActions', `/organizations/${orgId}/alert-rules/available-actions/`]];
  }

  setPreset(preset, context) {
    this.form.setInitialData({ ...this.form.initialData,
      name: context.name,
      dataset: context.dataset,
      eventTypes: context.eventTypes,
      aggregate: context.aggregate,
      comparisonDelta: context.comparisonDelta,
      timeWindow: context.timeWindow,
      query: context.query,
      projectId: this.form.getValue('projectId')
    });
    this.form.setValue('comparisonDelta', context.comparisonDelta);
    this.setState({
      comparisonType: context.comparisonType,
      triggers: context.triggers,
      thresholdType: context.thresholdType,
      triggerErrors: new Map(),
      selectedPresetId: preset.id
    });
  }

  goBack() {
    const {
      router
    } = this.props;
    const {
      orgId
    } = this.props.params;
    router.push(`/organizations/${orgId}/alerts/rules/`);
  }

  fetchStatus(model) {
    const loadingSlackIndicator = sentry_stores_indicatorStore__WEBPACK_IMPORTED_MODULE_19__["default"].addMessage((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Looking for your slack channel (this can take a while)'), 'loading'); // pollHandler calls itself until it gets either a success
    // or failed status but we don't want to poll forever so we pass
    // in a hard stop time of 3 minutes before we bail.

    const quitTime = Date.now() + POLLING_MAX_TIME_LIMIT;
    window.clearTimeout(this.pollingTimeout);
    this.pollingTimeout = window.setTimeout(() => {
      this.pollHandler(model, quitTime, loadingSlackIndicator);
    }, 1000);
  }

  validateFieldInTrigger(_ref5) {
    let {
      errors,
      triggerIndex,
      field,
      message,
      isValid
    } = _ref5;

    // If valid, reset error for fieldName
    if (isValid()) {
      const {
        [field]: _validatedField,
        ...otherErrors
      } = errors.get(triggerIndex) || {};

      if (Object.keys(otherErrors).length > 0) {
        errors.set(triggerIndex, otherErrors);
      } else {
        errors.delete(triggerIndex);
      }

      return errors;
    }

    if (!errors.has(triggerIndex)) {
      errors.set(triggerIndex, {});
    }

    const currentErrors = errors.get(triggerIndex);
    errors.set(triggerIndex, { ...currentErrors,
      [field]: message
    });
    return errors;
  }
  /**
   * Validate triggers
   *
   * @return Returns true if triggers are valid
   */


  validateTriggers() {
    var _warningTrigger$alert, _criticalTrigger$aler;

    let triggers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.state.triggers;
    let thresholdType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.state.thresholdType;
    let resolveThreshold = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.state.resolveThreshold;
    let changedTriggerIndex = arguments.length > 3 ? arguments[3] : undefined;
    const {
      comparisonType
    } = this.state;
    const triggerErrors = new Map();
    const requiredFields = ['label', 'alertThreshold'];
    triggers.forEach((trigger, triggerIndex) => {
      requiredFields.forEach(field => {
        // check required fields
        this.validateFieldInTrigger({
          errors: triggerErrors,
          triggerIndex,
          isValid: () => {
            if (trigger.label === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleTriggerType.CRITICAL) {
              return !isEmpty(trigger[field]);
            } // If warning trigger has actions, it must have a value


            return trigger.actions.length === 0 || !isEmpty(trigger[field]);
          },
          field,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Field is required')
        });
      }); // Check thresholds

      this.isValidTrigger(changedTriggerIndex !== null && changedTriggerIndex !== void 0 ? changedTriggerIndex : triggerIndex, trigger, triggerErrors, resolveThreshold);
    }); // If we have 2 triggers, we need to make sure that the critical and warning
    // alert thresholds are valid (e.g. if critical is above x, warning must be less than x)

    const criticalTriggerIndex = triggers.findIndex(_ref6 => {
      let {
        label
      } = _ref6;
      return label === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleTriggerType.CRITICAL;
    });
    const warningTriggerIndex = criticalTriggerIndex ^ 1;
    const criticalTrigger = triggers[criticalTriggerIndex];
    const warningTrigger = triggers[warningTriggerIndex];
    const isEmptyWarningThreshold = isEmpty(warningTrigger.alertThreshold);
    const warningThreshold = (_warningTrigger$alert = warningTrigger.alertThreshold) !== null && _warningTrigger$alert !== void 0 ? _warningTrigger$alert : 0;
    const criticalThreshold = (_criticalTrigger$aler = criticalTrigger.alertThreshold) !== null && _criticalTrigger$aler !== void 0 ? _criticalTrigger$aler : 0;
    const hasError = thresholdType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleThresholdType.ABOVE || comparisonType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleComparisonType.CHANGE ? warningThreshold > criticalThreshold : warningThreshold < criticalThreshold;

    if (hasError && !isEmptyWarningThreshold) {
      [criticalTriggerIndex, warningTriggerIndex].forEach(index => {
        var _triggerErrors$get;

        const otherErrors = (_triggerErrors$get = triggerErrors.get(index)) !== null && _triggerErrors$get !== void 0 ? _triggerErrors$get : {};
        triggerErrors.set(index, { ...otherErrors,
          alertThreshold: thresholdType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleThresholdType.ABOVE || comparisonType === _types__WEBPACK_IMPORTED_MODULE_42__.AlertRuleComparisonType.CHANGE ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Warning threshold must be less than critical threshold') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Warning threshold must be greater than critical threshold')
        });
      });
    }

    return triggerErrors;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      organization,
      ruleId,
      rule,
      onSubmitSuccess,
      router,
      disableProjectSelector,
      eventView,
      location
    } = this.props;
    const {
      name,
      query,
      project,
      timeWindow,
      triggers,
      aggregate,
      environment,
      thresholdType,
      thresholdPeriod,
      comparisonDelta,
      comparisonType,
      resolveThreshold,
      loading,
      eventTypes,
      dataset,
      selectedPresetId,
      showMEPAlertBanner
    } = this.state;
    const chartProps = {
      organization,
      projects: [project],
      triggers,
      location,
      query: this.chartQuery,
      aggregate,
      dataset,
      newAlertOrQuery: !ruleId || query !== rule.query,
      handleMEPAlertDataset: this.handleMEPAlertDataset,
      timeWindow,
      environment,
      resolveThreshold,
      thresholdType,
      comparisonDelta,
      comparisonType
    };
    const alertType = (0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_35__.getAlertTypeFromAggregateDataset)({
      aggregate,
      dataset
    });

    const wizardBuilderChart = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_alerts_rules_metric_triggers_chart__WEBPACK_IMPORTED_MODULE_30__["default"], { ...chartProps,
      header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(ChartHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(AlertName, {
          children: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_34__.AlertWizardAlertNames[alertType]
        }), !(0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_36__.isCrashFreeAlert)(dataset) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(AlertInfo, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(StyledCircleIndicator, {
            size: 8
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Aggregate, {
            children: aggregate
          }), "event.type:", eventTypes === null || eventTypes === void 0 ? void 0 : eventTypes.join(',')]
        })]
      })
    });

    const triggerForm = disabled => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_alerts_rules_metric_triggers__WEBPACK_IMPORTED_MODULE_29__["default"], {
      disabled: disabled,
      projects: [project],
      errors: this.state.triggerErrors,
      triggers: triggers,
      aggregate: aggregate,
      resolveThreshold: resolveThreshold,
      thresholdPeriod: thresholdPeriod,
      thresholdType: thresholdType,
      comparisonType: comparisonType,
      currentProject: project.slug,
      organization: organization,
      availableActions: this.state.availableActions,
      onChange: this.handleChangeTriggers,
      onThresholdTypeChange: this.handleThresholdTypeChange,
      onThresholdPeriodChange: this.handleThresholdPeriodChange,
      onResolveThresholdChange: this.handleResolveThresholdChange
    });

    const ruleNameOwnerForm = disabled => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_alerts_rules_metric_ruleNameOwnerForm__WEBPACK_IMPORTED_MODULE_27__["default"], {
      disabled: disabled,
      project: project
    });

    const thresholdTypeForm = disabled => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_alerts_rules_metric_thresholdTypeForm__WEBPACK_IMPORTED_MODULE_28__["default"], {
      comparisonType: comparisonType,
      dataset: dataset,
      disabled: disabled,
      onComparisonDeltaChange: value => this.handleFieldChange('comparisonDelta', value),
      onComparisonTypeChange: this.handleComparisonTypeChange,
      organization: organization,
      comparisonDelta: comparisonDelta
    });

    let showPresetSidebar = dataset === _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.TRANSACTIONS && project.firstTransactionEvent && !this.props.ruleId;

    if (showPresetSidebar) {
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_22__.logExperiment)({
        key: 'MetricAlertPresetExperiment',
        organization
      });
    }

    showPresetSidebar = showPresetSidebar && !!organization.experiments.MetricAlertPresetExperiment;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_7__["default"], {
      access: ['alerts:write'],
      children: _ref7 => {
        let {
          hasAccess
        } = _ref7;
        const disabled = loading || !((0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_24__.isActiveSuperuser)() || hasAccess);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [showPresetSidebar && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(Side, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_presetSidebar__WEBPACK_IMPORTED_MODULE_40__["default"], {
              organization: organization,
              project: project,
              onSelect: (preset, context) => {
                this.setPreset(preset, context);
              },
              selectedPresetId: selectedPresetId
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(Main, {
            fullWidth: !showPresetSidebar,
            children: [eventView && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_views_alerts_rules_metric_incompatibleAlertQuery__WEBPACK_IMPORTED_MODULE_26__.IncompatibleAlertQuery, {
              orgSlug: organization.slug,
              eventView: eventView
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_13__["default"], {
              model: this.form,
              apiMethod: ruleId ? 'PUT' : 'POST',
              apiEndpoint: `/organizations/${organization.slug}/alert-rules/${ruleId ? `${ruleId}/` : ''}`,
              submitDisabled: disabled,
              initialData: {
                name,
                dataset,
                eventTypes,
                aggregate,
                query,
                timeWindow: rule.timeWindow,
                environment: rule.environment || null,
                owner: rule.owner,
                projectId: project.id
              },
              saveOnBlur: false,
              onSubmit: this.handleSubmit,
              onSubmitSuccess: onSubmitSuccess,
              onCancel: this.handleCancel,
              onFieldChange: this.handleFieldChange,
              extraButton: !!rule.id ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_12__["default"], {
                disabled: disabled,
                message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Are you sure you want to delete this alert rule?'),
                header: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Delete Alert Rule?'),
                priority: "danger",
                confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Delete Rule'),
                onConfirm: this.handleDeleteRule,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  type: "button",
                  priority: "danger",
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Delete Rule')
                })
              }) : null,
              submitLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Save Rule'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsxs)(sentry_components_list__WEBPACK_IMPORTED_MODULE_16__["default"], {
                symbol: "colored-numeric",
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(_ruleConditionsForm__WEBPACK_IMPORTED_MODULE_41__["default"], {
                  api: this.api,
                  project: project,
                  organization: organization,
                  router: router,
                  disabled: disabled,
                  thresholdChart: wizardBuilderChart,
                  onFilterSearch: this.handleFilterUpdate,
                  allowChangeEventTypes: alertType === 'custom' || dataset === _types__WEBPACK_IMPORTED_MODULE_42__.Dataset.ERRORS,
                  alertType: alertType,
                  dataset: dataset,
                  timeWindow: timeWindow,
                  comparisonType: comparisonType,
                  comparisonDelta: comparisonDelta,
                  onComparisonDeltaChange: value => this.handleFieldChange('comparisonDelta', value),
                  onTimeWindowChange: value => this.handleFieldChange('timeWindow', value),
                  disableProjectSelector: disableProjectSelector,
                  showMEPAlertBanner: showMEPAlertBanner
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_43__.jsx)(AlertListItem, {
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set thresholds')
                }), thresholdTypeForm(disabled), triggerForm(disabled), ruleNameOwnerForm(disabled)]
              })
            })]
          })]
        });
      }
    });
  }

}

const Main = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Main,  true ? {
  target: "e3evdii8"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(4), ";" + ( true ? "" : 0));

const Side = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Side,  true ? {
  target: "e3evdii7"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(4), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";grid-row-start:1;@media (max-width: ", p => p.theme.breakpoints.large, "){border-bottom:1px solid ", p => p.theme.gray200, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";padding-bottom:0;}@media (min-width: ", p => p.theme.breakpoints.large, "){border-left:1px solid ", p => p.theme.gray200, ";max-width:400px;}" + ( true ? "" : 0));

const StyledListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "e3evdii6"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), " 0;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const AlertListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(StyledListItem,  true ? {
  target: "e3evdii5"
} : 0)( true ? {
  name: "1i9vogi",
  styles: "margin-top:0"
} : 0);

const ChartHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3evdii4"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";margin-bottom:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1.5), ";" + ( true ? "" : 0));

const AlertName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__.HeaderTitleLegend,  true ? {
  target: "e3evdii3"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const AlertInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e3evdii2"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.family, ";font-weight:normal;color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const StyledCircleIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e3evdii1"
} : 0)("background:", p => p.theme.formText, ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(0.5), ";" + ( true ? "" : 0));

const Aggregate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e3evdii0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_25__["default"])(RuleFormContainer));

/***/ }),

/***/ "./app/views/alerts/rules/metric/ruleNameOwnerForm.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/metric/ruleNameOwnerForm.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RuleNameOwnerForm)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function RuleNameOwnerForm(_ref) {
  let {
    disabled,
    project
  } = _ref;

  const renderRuleName = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledTextField, {
    "data-test-id": "alert-name",
    disabled: disabled,
    name: "name",
    label: null,
    help: null,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Enter Alert Name'),
    required: true,
    flexibleControlStateSize: true
  });

  const renderTeamSelect = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledFormField, {
    extraMargin: true,
    name: "owner",
    label: null,
    help: null,
    disabled: disabled,
    flexibleControlStateSize: true,
    children: _ref2 => {
      let {
        model
      } = _ref2;
      const owner = model.getValue('owner');
      const ownerId = owner && owner.split(':')[1];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_3__["default"], {
        value: ownerId,
        project: project,
        onChange: _ref3 => {
          let {
            value
          } = _ref3;
          return model.setValue('owner', value && `team:${value}`);
        },
        teamFilter: team => team.isMember || team.id === ownerId,
        useId: true,
        includeUnassigned: true,
        disabled: disabled
      });
    }
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledListItem, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Establish ownership')
    }), renderRuleName(), renderTeamSelect()]
  });
}
RuleNameOwnerForm.displayName = "RuleNameOwnerForm";

const StyledListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "etj3rxo2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " 0;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const StyledTextField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "etj3rxo1"
} : 0)("border-bottom:none;padding:0;&>div{padding:0;width:100%;}margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const StyledFormField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "etj3rxo0"
} : 0)("padding:0;&>div{padding:0;width:100%;}margin-bottom:", p => `${p.extraMargin ? '60px' : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1)}`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/thresholdTypeForm.tsx":
/*!*************************************************************!*\
  !*** ./app/views/alerts/rules/metric/thresholdTypeForm.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var _utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils/isCrashFreeAlert */ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const ThresholdTypeForm = _ref => {
  let {
    organization,
    dataset,
    disabled,
    comparisonType,
    onComparisonDeltaChange,
    onComparisonTypeChange,
    comparisonDelta
  } = _ref;

  if ((0,_utils_isCrashFreeAlert__WEBPACK_IMPORTED_MODULE_7__.isCrashFreeAlert)(dataset)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_1__["default"], {
    features: ['organizations:change-alerts'],
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(FormRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledRadioGroup, {
        disabled: disabled,
        choices: [[_types__WEBPACK_IMPORTED_MODULE_8__.AlertRuleComparisonType.COUNT, 'Static: above or below {x}'], [_types__WEBPACK_IMPORTED_MODULE_8__.AlertRuleComparisonType.CHANGE, comparisonType === _types__WEBPACK_IMPORTED_MODULE_8__.AlertRuleComparisonType.COUNT ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Percent Change: {x%} higher or lower compared to previous period') : // Prevent default to avoid dropdown menu closing on click
        (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ComparisonContainer, {
          onClick: e => e.preventDefault(),
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Percent Change: {x%} higher or lower compared to'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_3__["default"], {
            name: "comparisonDelta",
            styles: {
              container: provided => ({ ...provided,
                marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1)
              }),
              control: provided => ({ ...provided,
                minHeight: 30,
                minWidth: 500,
                maxWidth: 1000
              }),
              valueContainer: provided => ({ ...provided,
                padding: 0
              }),
              singleValue: provided => ({ ...provided
              })
            },
            value: comparisonDelta,
            onChange: _ref2 => {
              let {
                value
              } = _ref2;
              return onComparisonDeltaChange(value);
            },
            options: sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_6__.COMPARISON_DELTA_OPTIONS,
            required: comparisonType === _types__WEBPACK_IMPORTED_MODULE_8__.AlertRuleComparisonType.CHANGE
          })]
        })]],
        value: comparisonType,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Threshold Type'),
        onChange: value => onComparisonTypeChange(value)
      })
    })
  });
};

ThresholdTypeForm.displayName = "ThresholdTypeForm";

const FormRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1w97v52"
} : 0)("display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0));

const ComparisonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1w97v51"
} : 0)( true ? {
  name: "fhxb3m",
  styles: "display:flex;flex-direction:row;align-items:center"
} : 0);

const StyledRadioGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1w97v50"
} : 0)( true ? {
  name: "7k5eab",
  styles: "flex:1;gap:0;&>label{height:33px;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ThresholdTypeForm);

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/actionsPanel/actionSpecificTargetSelector.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/actionsPanel/actionSpecificTargetSelector.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function ActionSpecificTargetSelector(_ref) {
  let {
    action,
    disabled,
    onChange
  } = _ref;

  const handleChangeSpecificTargetIdentifier = e => {
    onChange(e.target.value);
  };

  if (action.targetType !== sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.TargetType.SPECIFIC || action.type !== sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_2__.ActionType.SLACK) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_0__["default"], {
    type: "text",
    autoComplete: "off",
    disabled: disabled,
    value: action.inputChannelId || '',
    onChange: handleChangeSpecificTargetIdentifier,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('optional: channel ID or user ID')
  }, "inputChannelId");
}

ActionSpecificTargetSelector.displayName = "ActionSpecificTargetSelector";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActionSpecificTargetSelector);

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/actionsPanel/actionTargetSelector.tsx":
/*!**************************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/actionsPanel/actionTargetSelector.tsx ***!
  \**************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ActionTargetSelector)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/teamSelector */ "./app/components/forms/teamSelector.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_selectMembers__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/selectMembers */ "./app/components/selectMembers/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const getPlaceholderForType = type => {
  switch (type) {
    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.ActionType.SLACK:
      return '@username or #channel';

    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.ActionType.MSTEAMS:
      // no prefixes for msteams
      return 'username or channel';

    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.ActionType.PAGERDUTY:
      return 'service';

    default:
      throw Error('Not implemented');
  }
};

function ActionTargetSelector(props) {
  const {
    action,
    availableAction,
    disabled,
    loading,
    onChange,
    organization,
    project
  } = props;

  const handleChangeTargetIdentifier = value => {
    onChange(value.value);
  };

  const handleChangeSpecificTargetIdentifier = e => {
    onChange(e.target.value);
  };

  switch (action.targetType) {
    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TargetType.TEAM:
    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TargetType.USER:
      const isTeam = action.targetType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TargetType.TEAM;
      return isTeam ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_teamSelector__WEBPACK_IMPORTED_MODULE_2__["default"], {
        disabled: disabled,
        project: project,
        value: action.targetIdentifier,
        onChange: handleChangeTargetIdentifier,
        useId: true
      }, "team") : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_selectMembers__WEBPACK_IMPORTED_MODULE_4__["default"], {
        disabled: disabled,
        project: project,
        organization: organization,
        value: action.targetIdentifier,
        onChange: handleChangeTargetIdentifier
      }, "member");

    case sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TargetType.SPECIFIC:
      return availableAction !== null && availableAction !== void 0 && availableAction.options ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_1__["default"], {
        isDisabled: disabled || loading,
        value: action.targetIdentifier,
        options: availableAction.options,
        onChange: handleChangeTargetIdentifier
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_3__["default"], {
        type: "text",
        autoComplete: "off",
        disabled: disabled,
        value: action.targetIdentifier || '',
        onChange: handleChangeSpecificTargetIdentifier,
        placeholder: getPlaceholderForType(action.type)
      }, action.type);

    default:
      return null;
  }
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/actionsPanel/deleteActionButton.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/actionsPanel/deleteActionButton.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DeleteActionButton)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function DeleteActionButton(props) {
  const handleClick = e => {
    const {
      triggerIndex,
      index,
      onClick
    } = props;
    onClick(triggerIndex, index, e);
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
    type: "button",
    size: "sm",
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconDelete, {
      size: "xs"
    }),
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Remove action'),
    ...props,
    onClick: handleClick
  });
}
DeleteActionButton.displayName = "DeleteActionButton";

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/actionsPanel/index.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/actionsPanel/index.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_removeAtArrayIndex__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/removeAtArrayIndex */ "./app/utils/removeAtArrayIndex.tsx");
/* harmony import */ var sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/replaceAtArrayIndex */ "./app/utils/replaceAtArrayIndex.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_alerts_rules_issue_sentryAppRuleModal__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/alerts/rules/issue/sentryAppRuleModal */ "./app/views/alerts/rules/issue/sentryAppRuleModal.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_actionsPanel_actionSpecificTargetSelector__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/actionsPanel/actionSpecificTargetSelector */ "./app/views/alerts/rules/metric/triggers/actionsPanel/actionSpecificTargetSelector.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_actionsPanel_actionTargetSelector__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/actionsPanel/actionTargetSelector */ "./app/views/alerts/rules/metric/triggers/actionsPanel/actionTargetSelector.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_actionsPanel_deleteActionButton__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/actionsPanel/deleteActionButton */ "./app/views/alerts/rules/metric/triggers/actionsPanel/deleteActionButton.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























/**
 * When a new action is added, all of it's settings should be set to their default values.
 * @param actionConfig
 * @param dateCreated kept to maintain order of unsaved actions
 */
const getCleanAction = (actionConfig, dateCreated) => {
  return {
    unsavedId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_16__.uniqueId)(),
    unsavedDateCreated: dateCreated !== null && dateCreated !== void 0 ? dateCreated : new Date().toISOString(),
    type: actionConfig.type,
    targetType: actionConfig && actionConfig.allowedTargetTypes && actionConfig.allowedTargetTypes.length > 0 ? actionConfig.allowedTargetTypes[0] : null,
    targetIdentifier: actionConfig.sentryAppId || '',
    inputChannelId: null,
    integrationId: actionConfig.integrationId,
    sentryAppId: actionConfig.sentryAppId,
    options: actionConfig.options || null
  };
};
/**
 * Actions have a type (e.g. email, slack, etc), but only some have
 * an integrationId (e.g. email is null). This helper creates a unique
 * id based on the type and integrationId so that we know what action
 * a user's saved action corresponds to.
 */


const getActionUniqueKey = _ref => {
  let {
    type,
    integrationId,
    sentryAppId
  } = _ref;

  if (integrationId) {
    return `${type}-${integrationId}`;
  }

  if (sentryAppId) {
    return `${type}-${sentryAppId}`;
  }

  return type;
};
/**
 * Creates a human-friendly display name for the integration based on type and
 * server provided `integrationName`
 *
 * e.g. for slack we show that it is slack and the `integrationName` is the workspace name
 */


const getFullActionTitle = _ref2 => {
  let {
    type,
    integrationName,
    sentryAppName,
    status
  } = _ref2;

  if (sentryAppName) {
    if (status && status !== 'published') {
      return `${sentryAppName} (${status})`;
    }

    return `${sentryAppName}`;
  }

  const label = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_24__.ActionLabel[type];

  if (integrationName) {
    return `${label} - ${integrationName}`;
  }

  return label;
};
/**
 * Lists saved actions as well as control to add a new action
 */


class ActionsPanel extends react__WEBPACK_IMPORTED_MODULE_4__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddAction", () => {
      const {
        availableActions,
        onAdd
      } = this.props;
      const actionConfig = availableActions === null || availableActions === void 0 ? void 0 : availableActions[0];

      if (!actionConfig) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('There was a problem adding an action'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_25__.captureException(new Error('Unable to add an action'));
        return;
      }

      const action = getCleanAction(actionConfig); // Add new actions to critical by default

      const triggerIndex = 0;
      onAdd(triggerIndex, action);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteAction", (triggerIndex, index) => {
      const {
        triggers,
        onChange
      } = this.props;
      const {
        actions
      } = triggers[triggerIndex];
      onChange(triggerIndex, triggers, (0,sentry_utils_removeAtArrayIndex__WEBPACK_IMPORTED_MODULE_17__.removeAtArrayIndex)(actions, index));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActionLevel", (triggerIndex, index, value) => {
      const {
        triggers,
        onChange
      } = this.props; // Convert saved action to unsaved by removing id

      const {
        id: _,
        ...action
      } = triggers[triggerIndex].actions[index];
      action.unsavedId = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_16__.uniqueId)();
      triggers[value.value].actions.push(action);
      onChange(value.value, triggers, triggers[value.value].actions);
      this.handleDeleteAction(triggerIndex, index);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActionType", (triggerIndex, index, value) => {
      var _actions$index$dateCr;

      const {
        triggers,
        onChange,
        availableActions
      } = this.props;
      const {
        actions
      } = triggers[triggerIndex];
      const actionConfig = availableActions === null || availableActions === void 0 ? void 0 : availableActions.find(availableAction => getActionUniqueKey(availableAction) === value.value);

      if (!actionConfig) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('There was a problem changing an action'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_25__.captureException(new Error('Unable to change an action type'));
        return;
      }

      const existingDateCreated = (_actions$index$dateCr = actions[index].dateCreated) !== null && _actions$index$dateCr !== void 0 ? _actions$index$dateCr : actions[index].unsavedDateCreated;
      const newAction = getCleanAction(actionConfig, existingDateCreated);
      onChange(triggerIndex, triggers, (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_18__.replaceAtArrayIndex)(actions, index, newAction));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeTarget", (triggerIndex, index, value) => {
      const {
        triggers,
        onChange
      } = this.props;
      const {
        actions
      } = triggers[triggerIndex];
      const newAction = { ...actions[index],
        targetType: value.value,
        targetIdentifier: ''
      };
      onChange(triggerIndex, triggers, (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_18__.replaceAtArrayIndex)(actions, index, newAction));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateParentFromSentryAppRule", (triggerIndex, actionIndex, formData) => {
      const {
        triggers,
        onChange
      } = this.props;
      const {
        actions
      } = triggers[triggerIndex];
      const newAction = { ...actions[actionIndex],
        ...formData
      };
      onChange(triggerIndex, triggers, (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_18__.replaceAtArrayIndex)(actions, actionIndex, newAction));
    });
  }

  handleChangeKey(triggerIndex, index, key, value) {
    const {
      triggers,
      onChange
    } = this.props;
    const {
      actions
    } = triggers[triggerIndex];
    const newAction = { ...actions[index],
      [key]: value
    };
    onChange(triggerIndex, triggers, (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_18__.replaceAtArrayIndex)(actions, index, newAction));
  }

  conditionallyRenderHelpfulBanner(triggerIndex, index) {
    const {
      triggers
    } = this.props;
    const {
      actions
    } = triggers[triggerIndex];
    const newAction = { ...actions[index]
    };

    if (newAction.type !== 'slack') {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(MarginlessAlert, {
      type: "info",
      showIcon: true,
      trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
        href: "https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error",
        size: "xs",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Learn More')
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Having rate limiting problems? Enter a channel or user ID.')
    });
  }

  render() {
    const {
      availableActions,
      currentProject,
      disabled,
      loading,
      organization,
      projects,
      triggers
    } = this.props;
    const project = projects.find(_ref3 => {
      let {
        slug
      } = _ref3;
      return slug === currentProject;
    });
    const items = availableActions === null || availableActions === void 0 ? void 0 : availableActions.map(availableAction => ({
      value: getActionUniqueKey(availableAction),
      label: getFullActionTitle(availableAction)
    }));
    const levels = [{
      value: 0,
      label: 'Critical Status'
    }, {
      value: 1,
      label: 'Warning Status'
    }]; // Create single array of unsaved and saved trigger actions
    // Sorted by date created ascending

    const actions = triggers.flatMap((trigger, triggerIndex) => {
      return trigger.actions.map((action, actionIdx) => {
        var _action$dateCreated;

        const availableAction = availableActions === null || availableActions === void 0 ? void 0 : availableActions.find(a => getActionUniqueKey(a) === getActionUniqueKey(action));
        return {
          dateCreated: new Date((_action$dateCreated = action.dateCreated) !== null && _action$dateCreated !== void 0 ? _action$dateCreated : action.unsavedDateCreated).getTime(),
          triggerIndex,
          action,
          actionIdx,
          availableAction
        };
      });
    }).sort((a, b) => a.dateCreated - b.dateCreated);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(PerformActionsListItem, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Set actions')
      }), loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {}), actions.map(_ref4 => {
        var _triggers$triggerInde, _action$id, _availableAction$allo;

        let {
          action,
          actionIdx,
          triggerIndex,
          availableAction
        } = _ref4;
        const actionDisabled = ((_triggers$triggerInde = triggers[triggerIndex].actions[actionIdx]) === null || _triggers$triggerInde === void 0 ? void 0 : _triggers$triggerInde.disabled) || disabled;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(RuleRowContainer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(PanelItemGrid, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(PanelItemSelects, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  name: "select-level",
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Select a status level'),
                  isDisabled: disabled || loading,
                  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Select Level'),
                  onChange: this.handleChangeActionLevel.bind(this, triggerIndex, actionIdx),
                  value: triggerIndex,
                  options: levels
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  name: "select-action",
                  "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Select an Action'),
                  isDisabled: disabled || loading,
                  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Select Action'),
                  onChange: this.handleChangeActionType.bind(this, triggerIndex, actionIdx),
                  value: getActionUniqueKey(action),
                  options: items !== null && items !== void 0 ? items : []
                }), availableAction && availableAction.allowedTargetTypes.length > 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__["default"], {
                  isDisabled: disabled || loading,
                  value: action.targetType,
                  options: availableAction === null || availableAction === void 0 ? void 0 : (_availableAction$allo = availableAction.allowedTargetTypes) === null || _availableAction$allo === void 0 ? void 0 : _availableAction$allo.map(allowedType => ({
                    value: allowedType,
                    label: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_24__.TargetLabel[allowedType]
                  })),
                  onChange: this.handleChangeTarget.bind(this, triggerIndex, actionIdx)
                }) : availableAction && availableAction.type === 'sentry_app' && availableAction.settings ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconSettings, {}),
                  type: "button",
                  disabled: actionDisabled,
                  onClick: () => {
                    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_6__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_alerts_rules_issue_sentryAppRuleModal__WEBPACK_IMPORTED_MODULE_20__["default"], { ...deps,
                      // Using ! for keys that will exist for sentryapps
                      sentryAppInstallationUuid: availableAction.sentryAppInstallationUuid,
                      config: availableAction.settings,
                      appName: availableAction.sentryAppName,
                      onSubmitSuccess: this.updateParentFromSentryAppRule.bind(this, triggerIndex, actionIdx),
                      resetValues: triggers[triggerIndex].actions[actionIdx] || {}
                    }), {
                      allowClickClose: false
                    });
                  },
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Settings')
                }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_alerts_rules_metric_triggers_actionsPanel_actionTargetSelector__WEBPACK_IMPORTED_MODULE_22__["default"], {
                  action: action,
                  availableAction: availableAction,
                  disabled: disabled,
                  loading: loading,
                  onChange: this.handleChangeKey.bind(this, triggerIndex, actionIdx, 'targetIdentifier'),
                  organization: organization,
                  project: project
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_alerts_rules_metric_triggers_actionsPanel_actionSpecificTargetSelector__WEBPACK_IMPORTED_MODULE_21__["default"], {
                  action: action,
                  disabled: disabled,
                  onChange: this.handleChangeKey.bind(this, triggerIndex, actionIdx, 'inputChannelId')
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_alerts_rules_metric_triggers_actionsPanel_deleteActionButton__WEBPACK_IMPORTED_MODULE_23__["default"], {
                triggerIndex: triggerIndex,
                index: actionIdx,
                onClick: this.handleDeleteAction,
                disabled: disabled
              })]
            })
          }), this.conditionallyRenderHelpfulBanner(triggerIndex, actionIdx)]
        }, (_action$id = action.id) !== null && _action$id !== void 0 ? _action$id : action.unsavedId);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(ActionSection, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          type: "button",
          disabled: disabled || loading,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_13__.IconAdd, {
            isCircled: true,
            color: "gray300"
          }),
          onClick: this.handleAddAction,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Add Action')
        })
      })]
    });
  }

}

ActionsPanel.displayName = "ActionsPanel";

const ActionsPanelWithSpace = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(ActionsPanel,  true ? {
  target: "e1sw62qy7"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(4), ";" + ( true ? "" : 0));

const ActionSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sw62qy6"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), ";" + ( true ? "" : 0));

const PanelItemGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelItem,  true ? {
  target: "e1sw62qy5"
} : 0)("display:flex;align-items:center;border-bottom:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";" + ( true ? "" : 0));

const PanelItemSelects = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sw62qy4"
} : 0)("display:flex;width:100%;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";>*{flex:0 1 200px;&:not(:last-child){margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";}}" + ( true ? "" : 0));

const RuleRowContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sw62qy3"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border:1px ", p => p.theme.border, " solid;border-radius:", p => p.theme.borderRadius, " ", p => p.theme.borderRadius, " 0 0;&:last-child{border-radius:", p => p.theme.borderRadius, ";}" + ( true ? "" : 0));

const StyledListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1sw62qy2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), " 0;font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const PerformActionsListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(StyledListItem,  true ? {
  target: "e1sw62qy1"
} : 0)( true ? {
  name: "18d4xiq",
  styles: "margin-bottom:0;line-height:1.3"
} : 0);

const MarginlessAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1sw62qy0"
} : 0)("border-radius:0 0 ", p => p.theme.borderRadius, " ", p => p.theme.borderRadius, ";border:1px ", p => p.theme.border, " solid;border-top-width:0;margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__["default"])(ActionsPanelWithSpace));

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/chart/index.tsx":
/*!****************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/chart/index.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_maxBy__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/maxBy */ "../node_modules/lodash/maxBy.js");
/* harmony import */ var lodash_maxBy__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_maxBy__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_minBy__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/minBy */ "../node_modules/lodash/minBy.js");
/* harmony import */ var lodash_minBy__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_minBy__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/optionSelector */ "./app/components/charts/optionSelector.tsx");
/* harmony import */ var sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/sessionsRequest */ "./app/components/charts/sessionsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var sentry_views_alerts_utils_getComparisonMarkLines__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/views/alerts/utils/getComparisonMarkLines */ "./app/views/alerts/utils/getComparisonMarkLines.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/alerts/wizard/utils */ "./app/views/alerts/wizard/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../../types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _utils_getMetricDatasetQueryExtras__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../../utils/getMetricDatasetQueryExtras */ "./app/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras.tsx");
/* harmony import */ var _thresholdsChart__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./thresholdsChart */ "./app/views/alerts/rules/metric/triggers/chart/thresholdsChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






























const TIME_PERIOD_MAP = {
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SIX_HOURS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 6 hours'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.ONE_DAY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 24 hours'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THREE_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 3 days'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SEVEN_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 7 days'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.FOURTEEN_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 14 days'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THIRTY_DAYS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Last 30 days')
};
/**
 * Just to avoid repeating it
 */

const MOST_TIME_PERIODS = [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.ONE_DAY, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THREE_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SEVEN_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.FOURTEEN_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THIRTY_DAYS];
/**
 * TimeWindow determines data available in TimePeriod
 * If TimeWindow is small, lower TimePeriod to limit data points
 */

const AVAILABLE_TIME_PERIODS = {
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.ONE_MINUTE]: [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SIX_HOURS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.ONE_DAY, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THREE_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SEVEN_DAYS],
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.FIVE_MINUTES]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.TEN_MINUTES]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.FIFTEEN_MINUTES]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.THIRTY_MINUTES]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.ONE_HOUR]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.TWO_HOURS]: MOST_TIME_PERIODS,
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.FOUR_HOURS]: [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THREE_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SEVEN_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.FOURTEEN_DAYS, _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THIRTY_DAYS],
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.ONE_DAY]: [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.THIRTY_DAYS]
};
const TIME_WINDOW_TO_SESSION_INTERVAL = {
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.THIRTY_MINUTES]: '30m',
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.ONE_HOUR]: '1h',
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.TWO_HOURS]: '2h',
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.FOUR_HOURS]: '4h',
  [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.ONE_DAY]: '1d'
};
const SESSION_AGGREGATE_TO_HEADING = {
  [_types__WEBPACK_IMPORTED_MODULE_25__.SessionsAggregate.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Total Sessions'),
  [_types__WEBPACK_IMPORTED_MODULE_25__.SessionsAggregate.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Total Users')
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends react__WEBPACK_IMPORTED_MODULE_4__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      statsPeriod: _types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SEVEN_DAYS,
      totalCount: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleStatsPeriodChange", timePeriod => {
      this.setState({
        statsPeriod: timePeriod
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getStatsPeriod", () => {
      const {
        statsPeriod
      } = this.state;
      const {
        timeWindow
      } = this.props;
      const statsPeriodOptions = this.availableTimePeriods[timeWindow];
      const period = statsPeriodOptions.includes(statsPeriod) ? statsPeriod : statsPeriodOptions[statsPeriodOptions.length - 1];
      return period;
    });
  }

  componentDidMount() {
    if (!(0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.isSessionAggregate)(this.props.aggregate)) {
      this.fetchTotalCount();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      query,
      environment,
      timeWindow,
      aggregate,
      projects
    } = this.props;
    const {
      statsPeriod
    } = this.state;

    if (!(0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.isSessionAggregate)(aggregate) && (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.projects, projects) || prevProps.environment !== environment || prevProps.query !== query || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.timeWindow, timeWindow) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevState.statsPeriod, statsPeriod))) {
      this.fetchTotalCount();
    }
  }

  get availableTimePeriods() {
    // We need to special case sessions, because sub-hour windows are available
    // only when time period is six hours or less (backend limitation)
    if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.isSessionAggregate)(this.props.aggregate)) {
      return { ...AVAILABLE_TIME_PERIODS,
        [_types__WEBPACK_IMPORTED_MODULE_25__.TimeWindow.THIRTY_MINUTES]: [_types__WEBPACK_IMPORTED_MODULE_25__.TimePeriod.SIX_HOURS]
      };
    }

    return AVAILABLE_TIME_PERIODS;
  }

  get comparisonSeriesName() {
    var _COMPARISON_DELTA_OPT;

    return lodash_capitalize__WEBPACK_IMPORTED_MODULE_5___default()(((_COMPARISON_DELTA_OPT = sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_20__.COMPARISON_DELTA_OPTIONS.find(_ref => {
      let {
        value
      } = _ref;
      return value === this.props.comparisonDelta;
    })) === null || _COMPARISON_DELTA_OPT === void 0 ? void 0 : _COMPARISON_DELTA_OPT.label) || '');
  }

  async fetchTotalCount() {
    const {
      api,
      organization,
      environment,
      projects,
      query
    } = this.props;
    const statsPeriod = this.getStatsPeriod();

    try {
      const totalCount = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_9__.fetchTotalCount)(api, organization.slug, {
        field: [],
        project: projects.map(_ref2 => {
          let {
            id
          } = _ref2;
          return id;
        }),
        query,
        statsPeriod,
        environment: environment ? [environment] : []
      });
      this.setState({
        totalCount
      });
    } catch (e) {
      this.setState({
        totalCount: null
      });
    }
  }

  renderChart() {
    var _minBy, _timeseriesData$, _maxBy, _timeseriesData$2;

    let timeseriesData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    let isLoading = arguments.length > 1 ? arguments[1] : undefined;
    let isReloading = arguments.length > 2 ? arguments[2] : undefined;
    let comparisonData = arguments.length > 3 ? arguments[3] : undefined;
    let comparisonMarkLines = arguments.length > 4 ? arguments[4] : undefined;
    let minutesThresholdToDisplaySeconds = arguments.length > 5 ? arguments[5] : undefined;
    const {
      triggers,
      resolveThreshold,
      thresholdType,
      header,
      timeWindow,
      aggregate,
      comparisonType
    } = this.props;
    const {
      statsPeriod,
      totalCount
    } = this.state;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = this.getStatsPeriod();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(TransparentLoadingMask, {
        visible: isReloading
      }), isLoading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ChartPlaceholder, {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(_thresholdsChart__WEBPACK_IMPORTED_MODULE_27__["default"], {
        period: statsPeriod,
        minValue: (_minBy = lodash_minBy__WEBPACK_IMPORTED_MODULE_8___default()((_timeseriesData$ = timeseriesData[0]) === null || _timeseriesData$ === void 0 ? void 0 : _timeseriesData$.data, _ref3 => {
          let {
            value
          } = _ref3;
          return value;
        })) === null || _minBy === void 0 ? void 0 : _minBy.value,
        maxValue: (_maxBy = lodash_maxBy__WEBPACK_IMPORTED_MODULE_7___default()((_timeseriesData$2 = timeseriesData[0]) === null || _timeseriesData$2 === void 0 ? void 0 : _timeseriesData$2.data, _ref4 => {
          let {
            value
          } = _ref4;
          return value;
        })) === null || _maxBy === void 0 ? void 0 : _maxBy.value,
        data: timeseriesData,
        comparisonData: comparisonData !== null && comparisonData !== void 0 ? comparisonData : [],
        comparisonSeriesName: this.comparisonSeriesName,
        comparisonMarkLines: comparisonMarkLines !== null && comparisonMarkLines !== void 0 ? comparisonMarkLines : [],
        hideThresholdLines: comparisonType === _types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleComparisonType.CHANGE,
        triggers: triggers,
        resolveThreshold: resolveThreshold,
        thresholdType: thresholdType,
        aggregate: aggregate,
        minutesThresholdToDisplaySeconds: minutesThresholdToDisplaySeconds
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__.ChartControls, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__.InlineContainer, {
          "data-test-id": "alert-total-events",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__.SectionHeading, {
            children: (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.isSessionAggregate)(aggregate) ? SESSION_AGGREGATE_TO_HEADING[aggregate] : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Total Events')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__.SectionValue, {
            children: totalCount !== null ? totalCount.toLocaleString() : '\u2014'
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_13__.InlineContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_11__["default"], {
            options: statsPeriodOptions.map(timePeriod => ({
              label: TIME_PERIOD_MAP[timePeriod],
              value: timePeriod,
              disabled: isLoading || isReloading
            })),
            selected: period,
            onChange: this.handleStatsPeriodChange,
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Display')
          })
        })]
      })]
    });
  }

  render() {
    const {
      api,
      organization,
      projects,
      timeWindow,
      query,
      location,
      aggregate,
      dataset,
      newAlertOrQuery,
      handleMEPAlertDataset,
      environment,
      comparisonDelta,
      triggers,
      thresholdType
    } = this.props;
    const period = this.getStatsPeriod();
    const renderComparisonStats = Boolean(organization.features.includes('change-alerts') && comparisonDelta);
    const queryExtras = (0,_utils_getMetricDatasetQueryExtras__WEBPACK_IMPORTED_MODULE_26__.getMetricDatasetQueryExtras)({
      organization,
      location,
      dataset,
      newAlertOrQuery
    });
    return (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.isSessionAggregate)(aggregate) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_12__["default"], {
      api: api,
      organization: organization,
      project: projects.map(_ref5 => {
        let {
          id
        } = _ref5;
        return Number(id);
      }),
      environment: environment ? [environment] : undefined,
      statsPeriod: period,
      query: query,
      interval: TIME_WINDOW_TO_SESSION_INTERVAL[timeWindow],
      field: sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.SESSION_AGGREGATE_TO_FIELD[aggregate],
      groupBy: ['session.status'],
      children: _ref6 => {
        let {
          loading,
          reloading,
          response
        } = _ref6;
        const {
          groups,
          intervals
        } = response || {};
        const sessionTimeSeries = [{
          seriesName: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_23__.AlertWizardAlertNames[(0,sentry_views_alerts_wizard_utils__WEBPACK_IMPORTED_MODULE_24__.getAlertTypeFromAggregateDataset)({
            aggregate,
            dataset: _types__WEBPACK_IMPORTED_MODULE_25__.Dataset.SESSIONS
          })],
          data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_18__.getCrashFreeRateSeries)(groups, intervals, sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_21__.SESSION_AGGREGATE_TO_FIELD[aggregate])
        }];
        return this.renderChart(sessionTimeSeries, loading, reloading, undefined, undefined, sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_18__.MINUTES_THRESHOLD_TO_DISPLAY_SECONDS);
      }
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_10__["default"], {
      api: api,
      organization: organization,
      query: query,
      environment: environment ? [environment] : undefined,
      project: projects.map(_ref7 => {
        let {
          id
        } = _ref7;
        return Number(id);
      }),
      interval: `${timeWindow}m`,
      comparisonDelta: comparisonDelta && comparisonDelta * 60,
      period: period,
      yAxis: aggregate,
      includePrevious: false,
      currentSeriesNames: [aggregate],
      partial: false,
      queryExtras: queryExtras,
      dataLoadedCallback: handleMEPAlertDataset,
      children: _ref8 => {
        let {
          loading,
          reloading,
          timeseriesData,
          comparisonTimeseriesData
        } = _ref8;
        let comparisonMarkLines = [];

        if (renderComparisonStats && comparisonTimeseriesData) {
          comparisonMarkLines = (0,sentry_views_alerts_utils_getComparisonMarkLines__WEBPACK_IMPORTED_MODULE_22__.getComparisonMarkLines)(timeseriesData, comparisonTimeseriesData, timeWindow, triggers, thresholdType);
        }

        return this.renderChart(timeseriesData, loading, reloading, comparisonTimeseriesData, comparisonMarkLines);
      }
    });
  }

}

TriggersChart.displayName = "TriggersChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_19__["default"])(TriggersChart));

const TransparentLoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e17sbfy61"
} : 0)(p => !p.visible && 'display: none;', ";opacity:0.4;z-index:1;" + ( true ? "" : 0));

const ChartPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e17sbfy60"
} : 0)("margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";height:184px;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/chart/thresholdsChart.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/chart/thresholdsChart.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ThresholdsChart)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_16__);
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_components_graphic__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/components/graphic */ "./app/components/charts/components/graphic.tsx");
/* harmony import */ var sentry_components_charts_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/components/tooltip */ "./app/components/charts/components/tooltip.tsx");
/* harmony import */ var sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants/chartPalette */ "./app/constants/chartPalette.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/alerts/utils/getChangeStatus */ "./app/views/alerts/utils/getChangeStatus.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../../types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const CHART_GRID = {
  left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2),
  right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2),
  top: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(4),
  bottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2)
}; // Colors to use for trigger thresholds

const COLOR = {
  RESOLUTION_FILL: color__WEBPACK_IMPORTED_MODULE_16___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].green200).alpha(0.1).rgb().string(),
  CRITICAL_FILL: color__WEBPACK_IMPORTED_MODULE_16___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].red300).alpha(0.25).rgb().string(),
  WARNING_FILL: color__WEBPACK_IMPORTED_MODULE_16___default()(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].yellow200).alpha(0.1).rgb().string()
};
/**
 * This chart displays shaded regions that represent different Trigger thresholds in a
 * Metric Alert rule.
 */

class ThresholdsChart extends react__WEBPACK_IMPORTED_MODULE_2__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      width: -1,
      height: -1,
      yAxisMax: null,
      yAxisMin: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "ref", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateChartAxis", () => {
      var _this$ref, _this$ref$getEchartsI;

      const {
        triggers,
        resolveThreshold,
        hideThresholdLines
      } = this.props;
      const chartRef = (_this$ref = this.ref) === null || _this$ref === void 0 ? void 0 : (_this$ref$getEchartsI = _this$ref.getEchartsInstance) === null || _this$ref$getEchartsI === void 0 ? void 0 : _this$ref$getEchartsI.call(_this$ref);

      if (hideThresholdLines) {
        return;
      }

      if (chartRef) {
        const thresholds = [resolveThreshold || null, ...triggers.map(t => t.alertThreshold || null)].filter(threshold => threshold !== null);
        this.updateChartAxis(Math.min(...thresholds), Math.max(...thresholds));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateChartAxis", lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()((minThreshold, maxThreshold) => {
      const {
        minValue,
        maxValue,
        aggregate
      } = this.props;
      const shouldScale = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.shouldScaleAlertChart)(aggregate);
      let yAxisMax = shouldScale && maxValue ? this.clampMaxValue(Math.ceil(maxValue * sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.ALERT_CHART_MIN_MAX_BUFFER)) : null;
      let yAxisMin = shouldScale && minValue ? Math.floor(minValue / sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.ALERT_CHART_MIN_MAX_BUFFER) : 0;

      if (typeof maxValue === 'number' && maxThreshold > maxValue) {
        yAxisMax = maxThreshold;
      }

      if (typeof minValue === 'number' && minThreshold < minValue) {
        yAxisMin = Math.floor(minThreshold / sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.ALERT_CHART_MIN_MAX_BUFFER);
      } // We need to force update after we set a new yAxis min/max because `convertToPixel`
      // can return a negative position (probably because yAxisMin/yAxisMax is not synced with chart yet)


      this.setState({
        yAxisMax,
        yAxisMin
      }, this.forceUpdate);
    }, 150));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateDimensions", () => {
      var _this$ref2, _this$ref2$getEcharts, _chartRef$getWidth;

      const chartRef = (_this$ref2 = this.ref) === null || _this$ref2 === void 0 ? void 0 : (_this$ref2$getEcharts = _this$ref2.getEchartsInstance) === null || _this$ref2$getEcharts === void 0 ? void 0 : _this$ref2$getEcharts.call(_this$ref2);

      if (!chartRef || !((_chartRef$getWidth = chartRef.getWidth) !== null && _chartRef$getWidth !== void 0 && _chartRef$getWidth.call(chartRef))) {
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
      // When chart initially renders, we want to update state with its width, as well as initialize starting
      // locations (on y axis) for the draggable lines
      if (ref && !this.ref) {
        this.ref = ref;
        this.updateDimensions();
        this.handleUpdateChartAxis();
      }

      if (!ref) {
        this.ref = null;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getThresholdLine", (trigger, type, isResolution) => {
      var _this$ref3, _this$ref3$getEcharts, _this$state$yAxisMax;

      const {
        thresholdType,
        resolveThreshold,
        maxValue,
        hideThresholdLines
      } = this.props;
      const position = type === 'alertThreshold' ? this.getChartPixelForThreshold(trigger[type]) : this.getChartPixelForThreshold(resolveThreshold);
      const isInverted = thresholdType === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleThresholdType.BELOW;
      const chartRef = (_this$ref3 = this.ref) === null || _this$ref3 === void 0 ? void 0 : (_this$ref3$getEcharts = _this$ref3.getEchartsInstance) === null || _this$ref3$getEcharts === void 0 ? void 0 : _this$ref3$getEcharts.call(_this$ref3);

      if (typeof position !== 'number' || isNaN(position) || !this.state.height || !chartRef || hideThresholdLines) {
        return [];
      }

      const yAxisPixelPosition = chartRef.convertToPixel({
        yAxisIndex: 0
      }, `${this.state.yAxisMin}`);
      const yAxisPosition = typeof yAxisPixelPosition === 'number' ? yAxisPixelPosition : 0; // As the yAxis gets larger we want to start our line/area further to the right
      // Handle case where the graph max is 1 and includes decimals

      const yAxisMax = Math.round(Math.max(maxValue !== null && maxValue !== void 0 ? maxValue : 1, (_this$state$yAxisMax = this.state.yAxisMax) !== null && _this$state$yAxisMax !== void 0 ? _this$state$yAxisMax : 1)) * 100 / 100;
      const yAxisSize = 15 + (yAxisMax <= 1 ? 15 : `${yAxisMax !== null && yAxisMax !== void 0 ? yAxisMax : ''}`.length * 8); // Shave off the right margin and yAxisSize from the width to get the actual area we want to render content in

      const graphAreaWidth = this.state.width - parseInt(CHART_GRID.right.slice(0, -2), 10) - yAxisSize; // Distance from the top of the chart to save for the legend

      const legendPadding = 20; // Shave off the left margin

      const graphAreaMargin = 7;
      const isCritical = trigger.label === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.CRITICAL;
      const LINE_STYLE = {
        stroke: isResolution ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].green300 : isCritical ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].red300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].yellow300,
        lineDash: [2]
      };
      return [// This line is used as a "border" for the shaded region
      // and represents the threshold value.
      {
        type: 'line',
        // Resolution is considered "off" if it is -1
        invisible: position === null,
        draggable: false,
        position: [yAxisSize, position],
        shape: {
          y1: 1,
          y2: 1,
          x1: graphAreaMargin,
          x2: graphAreaWidth
        },
        style: LINE_STYLE,
        silent: true,
        z: 100
      }, // Shaded area for incident/resolutions to show user when they can expect to be alerted
      // (or when they will be considered as resolved)
      //
      // Resolution is considered "off" if it is -1
      ...(position !== null ? [{
        type: 'rect',
        draggable: false,
        silent: true,
        position: isResolution !== isInverted ? [yAxisSize + graphAreaMargin, position + 1] : [yAxisSize + graphAreaMargin, legendPadding],
        shape: {
          width: graphAreaWidth - graphAreaMargin,
          height: isResolution !== isInverted ? yAxisPosition - position : position - legendPadding
        },
        style: {
          fill: isResolution ? COLOR.RESOLUTION_FILL : isCritical ? COLOR.CRITICAL_FILL : COLOR.WARNING_FILL
        },
        // This needs to be below the draggable line
        z: 100
      }] : [])];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getChartPixelForThreshold", threshold => {
      var _this$ref4, _this$ref4$getEcharts;

      const chartRef = (_this$ref4 = this.ref) === null || _this$ref4 === void 0 ? void 0 : (_this$ref4$getEcharts = _this$ref4.getEchartsInstance) === null || _this$ref4$getEcharts === void 0 ? void 0 : _this$ref4$getEcharts.call(_this$ref4);
      return threshold !== '' && chartRef && chartRef.convertToPixel({
        yAxisIndex: 0
      }, `${threshold}`);
    });
  }

  componentDidMount() {
    this.handleUpdateChartAxis();
  }

  componentDidUpdate(prevProps) {
    if (this.props.triggers !== prevProps.triggers || this.props.data !== prevProps.data || this.props.comparisonData !== prevProps.comparisonData || this.props.comparisonMarkLines !== prevProps.comparisonMarkLines) {
      this.handleUpdateChartAxis();
    }
  }

  clampMaxValue(value) {
    // When we apply top buffer to the crash free percentage (99.7% * 1.03), it
    // can cross 100%, so we clamp it
    if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.isSessionAggregate)(this.props.aggregate) && value > 100) {
      return 100;
    }

    return value;
  }

  render() {
    var _this$state$yAxisMin, _this$state$yAxisMax2;

    const {
      data,
      triggers,
      period,
      aggregate,
      comparisonData,
      comparisonSeriesName,
      comparisonMarkLines,
      minutesThresholdToDisplaySeconds,
      thresholdType
    } = this.props;
    const dataWithoutRecentBucket = data === null || data === void 0 ? void 0 : data.map(_ref => {
      let {
        data: eventData,
        ...restOfData
      } = _ref;
      return { ...restOfData,
        data: eventData.slice(0, -1)
      };
    });
    const comparisonDataWithoutRecentBucket = comparisonData === null || comparisonData === void 0 ? void 0 : comparisonData.map(_ref2 => {
      let {
        data: eventData,
        ...restOfData
      } = _ref2;
      return { ...restOfData,
        data: eventData.slice(0, -1)
      };
    });
    const chartOptions = {
      tooltip: {
        // use the main aggregate for all series (main, min, max, avg, comparison)
        // to format all values similarly
        valueFormatter: value => (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.alertTooltipValueFormatter)(value, aggregate, aggregate),
        formatAxisLabel: (value, isTimestamp, utc, showTimeInTooltip, addSecondsToTimeFormat, bucketSize, seriesParamsOrParam) => {
          const date = (0,sentry_components_charts_components_tooltip__WEBPACK_IMPORTED_MODULE_7__.defaultFormatAxisLabel)(value, isTimestamp, utc, showTimeInTooltip, addSecondsToTimeFormat, bucketSize);
          const seriesParams = Array.isArray(seriesParamsOrParam) ? seriesParamsOrParam : [seriesParamsOrParam];
          const pointY = seriesParams.length > 1 ? seriesParams[0].data[1] : undefined;
          const comparisonSeries = seriesParams.length > 1 ? seriesParams.find(_ref3 => {
            let {
              seriesName: _sn
            } = _ref3;
            return _sn === comparisonSeriesName;
          }) : undefined;
          const comparisonPointY = comparisonSeries === null || comparisonSeries === void 0 ? void 0 : comparisonSeries.data[1];

          if (comparisonPointY === undefined || pointY === undefined || comparisonPointY === 0) {
            return `<span>${date}</span>`;
          }

          const changePercentage = (pointY - comparisonPointY) * 100 / comparisonPointY;
          const changeStatus = (0,sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_14__.getChangeStatus)(changePercentage, thresholdType, triggers);
          const changeStatusColor = changeStatus === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.CRITICAL ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].red300 : changeStatus === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.WARNING ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].yellow300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].green300;
          return `<span>${date}<span style="color:${changeStatusColor};margin-left:10px;">
            ${Math.sign(changePercentage) === 1 ? '+' : '-'}${Math.abs(changePercentage).toFixed(2)}%</span></span>`;
        }
      },
      yAxis: {
        min: (_this$state$yAxisMin = this.state.yAxisMin) !== null && _this$state$yAxisMin !== void 0 ? _this$state$yAxisMin : undefined,
        max: (_this$state$yAxisMax2 = this.state.yAxisMax) !== null && _this$state$yAxisMax2 !== void 0 ? _this$state$yAxisMax2 : undefined,
        axisLabel: {
          formatter: value => (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_13__.alertAxisFormatter)(value, data[0].seriesName, aggregate)
        }
      }
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_5__.AreaChart, {
      isGroupedByDate: true,
      showTimeInTooltip: true,
      minutesThresholdToDisplaySeconds: minutesThresholdToDisplaySeconds,
      period: sentry_constants__WEBPACK_IMPORTED_MODULE_9__.DEFAULT_STATS_PERIOD || period,
      forwardedRef: this.handleRef,
      grid: CHART_GRID,
      ...chartOptions,
      graphic: (0,sentry_components_charts_components_graphic__WEBPACK_IMPORTED_MODULE_6__["default"])({
        elements: lodash_flatten__WEBPACK_IMPORTED_MODULE_4___default()(triggers.map(trigger => [...this.getThresholdLine(trigger, 'alertThreshold', false), ...this.getThresholdLine(trigger, 'resolveThreshold', true)]))
      }),
      colors: sentry_constants_chartPalette__WEBPACK_IMPORTED_MODULE_10__["default"][0],
      series: [...dataWithoutRecentBucket, ...comparisonMarkLines],
      additionalSeries: comparisonDataWithoutRecentBucket.map(_ref4 => {
        let {
          data: _data,
          ...otherSeriesProps
        } = _ref4;
        return (0,sentry_components_charts_series_lineSeries__WEBPACK_IMPORTED_MODULE_8__["default"])({
          name: comparisonSeriesName,
          data: _data.map(_ref5 => {
            let {
              name,
              value
            } = _ref5;
            return [name, value];
          }),
          lineStyle: {
            color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].gray200,
            type: 'dashed',
            width: 1
          },
          itemStyle: {
            color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].gray200
          },
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          ...otherSeriesProps
        });
      }),
      onFinished: () => {
        // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
        // any graphics related to the triggers (e.g. the threshold areas + boundaries)
        this.updateDimensions();
      }
    });
  }

}
ThresholdsChart.displayName = "ThresholdsChart";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ThresholdsChart, "defaultProps", {
  data: [],
  comparisonData: [],
  comparisonMarkLines: []
});

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/form.tsx":
/*!*********************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/form.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withConfig */ "./app/utils/withConfig.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_thresholdControl__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/thresholdControl */ "./app/views/alerts/rules/metric/triggers/thresholdControl.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class TriggerFormItem extends react__WEBPACK_IMPORTED_MODULE_4__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeThreshold", value => {
      const {
        onChange,
        trigger
      } = this.props;
      onChange({ ...trigger,
        alertThreshold: value.threshold
      }, {
        alertThreshold: value.threshold
      });
    });
  }

  render() {
    const {
      disabled,
      error,
      trigger,
      isCritical,
      thresholdType,
      thresholdPeriod,
      hideControl,
      comparisonType,
      fieldHelp,
      triggerLabel,
      placeholder,
      onThresholdTypeChange,
      onThresholdPeriodChange
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledField, {
      label: triggerLabel,
      help: fieldHelp,
      required: isCritical,
      error: error && error.alertThreshold,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_alerts_rules_metric_triggers_thresholdControl__WEBPACK_IMPORTED_MODULE_13__["default"], {
        disabled: disabled,
        disableThresholdType: !isCritical,
        type: trigger.label,
        thresholdType: thresholdType,
        thresholdPeriod: thresholdPeriod,
        hideControl: hideControl,
        threshold: trigger.alertThreshold,
        comparisonType: comparisonType,
        placeholder: placeholder,
        onChange: this.handleChangeThreshold,
        onThresholdTypeChange: onThresholdTypeChange,
        onThresholdPeriodChange: onThresholdPeriodChange
      })
    });
  }

}

TriggerFormItem.displayName = "TriggerFormItem";

class TriggerFormContainer extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeTrigger", triggerIndex => (trigger, changeObj) => {
      const {
        onChange
      } = this.props;
      onChange(triggerIndex, trigger, changeObj);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeResolveTrigger", (trigger, _) => {
      const {
        onResolveThresholdChange
      } = this.props;
      onResolveThresholdChange(trigger.alertThreshold);
    });
  }

  componentDidMount() {
    const {
      api,
      organization
    } = this.props;
    (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_5__.fetchOrgMembers)(api, organization.slug);
  }

  getCriticalThresholdPlaceholder(aggregate, comparisonType) {
    if (aggregate.includes('failure_rate')) {
      return '0.05';
    }

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_14__.isSessionAggregate)(aggregate)) {
      return '97';
    }

    if (comparisonType === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleComparisonType.CHANGE) {
      return '100';
    }

    return '300';
  }

  getIndicator(type) {
    if (type === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.CRITICAL) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIconDiamond, {
        color: "red300",
        size: "sm"
      });
    }

    if (type === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.WARNING) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIconDiamond, {
        color: "yellow300",
        size: "sm"
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIconDiamond, {
      color: "green300",
      size: "sm"
    });
  }

  render() {
    const {
      api,
      config,
      disabled,
      errors,
      organization,
      triggers,
      thresholdType,
      thresholdPeriod,
      comparisonType,
      aggregate,
      resolveThreshold,
      projects,
      onThresholdTypeChange,
      onThresholdPeriodChange
    } = this.props;
    const resolveTrigger = {
      label: _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.RESOLVE,
      alertThreshold: resolveThreshold,
      actions: []
    };
    const thresholdUnits = (0,sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_12__.getThresholdUnits)(aggregate, comparisonType);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [triggers.map((trigger, index) => {
        const isCritical = index === 0; // eslint-disable-next-line no-use-before-define

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TriggerFormItem, {
          api: api,
          config: config,
          disabled: disabled,
          error: errors && errors.get(index),
          trigger: trigger,
          thresholdPeriod: thresholdPeriod,
          thresholdType: thresholdType,
          comparisonType: comparisonType,
          aggregate: aggregate,
          resolveThreshold: resolveThreshold,
          organization: organization,
          projects: projects,
          triggerIndex: index,
          isCritical: isCritical,
          fieldHelp: null,
          triggerLabel: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TriggerLabel, {
            children: [this.getIndicator(isCritical ? _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.CRITICAL : _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.WARNING), isCritical ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Critical') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Warning')]
          }),
          placeholder: isCritical ? `${this.getCriticalThresholdPlaceholder(aggregate, comparisonType)}${comparisonType === _types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleComparisonType.COUNT ? thresholdUnits : ''}` : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('None'),
          onChange: this.handleChangeTrigger(index),
          onThresholdTypeChange: onThresholdTypeChange,
          onThresholdPeriodChange: onThresholdPeriodChange
        }, index);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TriggerFormItem, {
        api: api,
        config: config,
        disabled: disabled,
        error: errors && errors.get(2),
        trigger: resolveTrigger // Flip rule thresholdType to opposite
        ,
        thresholdPeriod: thresholdPeriod,
        thresholdType: +!thresholdType,
        comparisonType: comparisonType,
        aggregate: aggregate,
        resolveThreshold: resolveThreshold,
        organization: organization,
        projects: projects,
        triggerIndex: 2,
        isCritical: false,
        fieldHelp: null,
        triggerLabel: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TriggerLabel, {
          children: [this.getIndicator(_types__WEBPACK_IMPORTED_MODULE_15__.AlertRuleTriggerType.RESOLVE), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Resolved')]
        }),
        placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Automatic'),
        onChange: this.handleChangeResolveTrigger,
        onThresholdTypeChange: onThresholdTypeChange,
        onThresholdPeriodChange: onThresholdPeriodChange
      })]
    });
  }

}

TriggerFormContainer.displayName = "TriggerFormContainer";

const TriggerLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ebmwntt2"
} : 0)( true ? {
  name: "fhxb3m",
  styles: "display:flex;flex-direction:row;align-items:center"
} : 0);

const StyledIconDiamond = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconDiamond,  true ? {
  target: "ebmwntt1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.75), ";" + ( true ? "" : 0));

const StyledField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ebmwntt0"
} : 0)( true ? {
  name: "1ivpj7k",
  styles: "&>label>div:first-child>span{display:flex;flex-direction:row;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_11__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__["default"])(TriggerFormContainer)));

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/index.tsx":
/*!**********************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/index.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_utils_removeAtArrayIndex__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/removeAtArrayIndex */ "./app/utils/removeAtArrayIndex.tsx");
/* harmony import */ var sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/replaceAtArrayIndex */ "./app/utils/replaceAtArrayIndex.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_actionsPanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/actionsPanel */ "./app/views/alerts/rules/metric/triggers/actionsPanel/index.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_triggers_form__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/triggers/form */ "./app/views/alerts/rules/metric/triggers/form.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











/**
 * A list of forms to add, edit, and delete triggers.
 */
class Triggers extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteTrigger", index => {
      const {
        triggers,
        onChange
      } = this.props;
      const updatedTriggers = (0,sentry_utils_removeAtArrayIndex__WEBPACK_IMPORTED_MODULE_4__.removeAtArrayIndex)(triggers, index);
      onChange(updatedTriggers);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeTrigger", (triggerIndex, trigger, changeObj) => {
      const {
        triggers,
        onChange
      } = this.props;
      const updatedTriggers = (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_5__.replaceAtArrayIndex)(triggers, triggerIndex, trigger);
      onChange(updatedTriggers, triggerIndex, changeObj);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddAction", (triggerIndex, action) => {
      const {
        onChange,
        triggers
      } = this.props;
      const trigger = triggers[triggerIndex];
      const actions = [...trigger.actions, action];
      const updatedTriggers = (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_5__.replaceAtArrayIndex)(triggers, triggerIndex, { ...trigger,
        actions
      });
      onChange(updatedTriggers, triggerIndex, {
        actions
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeActions", (triggerIndex, triggers, actions) => {
      const {
        onChange
      } = this.props;
      const trigger = triggers[triggerIndex];
      const updatedTriggers = (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_5__.replaceAtArrayIndex)(triggers, triggerIndex, { ...trigger,
        actions
      });
      onChange(updatedTriggers, triggerIndex, {
        actions
      });
    });
  }

  render() {
    const {
      availableActions,
      currentProject,
      errors,
      organization,
      projects,
      triggers,
      disabled,
      aggregate,
      thresholdType,
      thresholdPeriod,
      comparisonType,
      resolveThreshold,
      onThresholdTypeChange,
      onResolveThresholdChange,
      onThresholdPeriodChange
    } = this.props; // Note we only support 2 triggers max

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_alerts_rules_metric_triggers_form__WEBPACK_IMPORTED_MODULE_7__["default"], {
            disabled: disabled,
            errors: errors,
            organization: organization,
            projects: projects,
            triggers: triggers,
            aggregate: aggregate,
            resolveThreshold: resolveThreshold,
            thresholdType: thresholdType,
            thresholdPeriod: thresholdPeriod,
            comparisonType: comparisonType,
            onChange: this.handleChangeTrigger,
            onThresholdTypeChange: onThresholdTypeChange,
            onResolveThresholdChange: onResolveThresholdChange,
            onThresholdPeriodChange: onThresholdPeriodChange
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_views_alerts_rules_metric_triggers_actionsPanel__WEBPACK_IMPORTED_MODULE_6__["default"], {
        disabled: disabled,
        loading: availableActions === null,
        error: false,
        availableActions: availableActions,
        currentProject: currentProject,
        organization: organization,
        projects: projects,
        triggers: triggers,
        onChange: this.handleChangeActions,
        onAdd: this.handleAddAction
      })]
    });
  }

}

Triggers.displayName = "Triggers";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Triggers);

/***/ }),

/***/ "./app/views/alerts/rules/metric/triggers/thresholdControl.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/triggers/thresholdControl.tsx ***!
  \*********************************************************************/
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
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_numberDragControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/numberDragControl */ "./app/components/numberDragControl.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class ThresholdControl extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      currentValue: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleThresholdChange", e => {
      const {
        value
      } = e.target; // Only allow number and partial number inputs

      if (!/^[0-9]*\.?[0-9]*$/.test(value)) {
        return;
      }

      const {
        onChange,
        thresholdType
      } = this.props; // Empty input

      if (value === '') {
        this.setState({
          currentValue: null
        });
        onChange({
          thresholdType,
          threshold: ''
        }, e);
        return;
      } // Only call onChange if the new number is valid, and not partially typed
      // (eg writing out the decimal '5.')


      if (/\.+0*$/.test(value)) {
        this.setState({
          currentValue: value
        });
        return;
      }

      const numberValue = Number(value);
      this.setState({
        currentValue: null
      });
      onChange({
        thresholdType,
        threshold: numberValue
      }, e);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleThresholdBlur", e => {
      if (this.state.currentValue === null) {
        return;
      }

      const {
        onChange,
        thresholdType
      } = this.props;
      onChange({
        thresholdType,
        threshold: Number(this.state.currentValue)
      }, e);
      this.setState({
        currentValue: null
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTypeChange", _ref => {
      let {
        value
      } = _ref;
      const {
        onThresholdTypeChange
      } = this.props;
      onThresholdTypeChange(value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDragChange", (delta, e) => {
      const {
        onChange,
        thresholdType,
        threshold
      } = this.props;
      const currentValue = threshold || 0;
      onChange({
        thresholdType,
        threshold: currentValue + delta
      }, e);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleThresholdPeriodChange", _ref2 => {
      let {
        value
      } = _ref2;
      this.props.onThresholdPeriodChange(value);
    });
  }

  render() {
    var _ref3;

    const {
      currentValue
    } = this.state;
    const {
      thresholdPeriod,
      thresholdType,
      comparisonType,
      hideControl,
      threshold,
      placeholder,
      type,
      onChange: _,
      onThresholdTypeChange: __,
      disabled,
      disableThresholdType
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Container, {
        comparisonType: comparisonType,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SelectContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
            isDisabled: disabled || disableThresholdType,
            name: `${type}ThresholdType`,
            value: thresholdType,
            options: [{
              value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleThresholdType.BELOW,
              label: comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleComparisonType.COUNT ? hideControl ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When below Critical or Warning') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Below') : hideControl ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When lower than Critical or Warning') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Lower than')
            }, {
              value: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleThresholdType.ABOVE,
              label: comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleComparisonType.COUNT ? hideControl ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When above Critical or Warning') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Above') : hideControl ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('When higher than Critical or Warning') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Higher than')
            }],
            components: disableThresholdType ? {
              DropdownIndicator: null
            } : undefined,
            styles: disableThresholdType ? {
              control: provided => ({ ...provided,
                cursor: 'not-allowed',
                pointerEvents: 'auto'
              })
            } : undefined,
            onChange: this.handleTypeChange
          })
        }), !hideControl && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ThresholdContainer, {
          comparisonType: comparisonType,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ThresholdInput, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledInput, {
              disabled: disabled,
              name: `${type}Threshold`,
              "data-test-id": `${type}-threshold`,
              placeholder: placeholder,
              value: (_ref3 = currentValue !== null && currentValue !== void 0 ? currentValue : threshold) !== null && _ref3 !== void 0 ? _ref3 : '',
              onChange: this.handleThresholdChange,
              onBlur: this.handleThresholdBlur // Disable lastpass autocomplete
              ,
              "data-lpignore": "true"
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(DragContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Drag to adjust threshold[break]You can hold shift to fine tune', {
                  break: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("br", {})
                }),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_numberDragControl__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  step: 5,
                  axis: "y",
                  onChange: this.handleDragChange
                })
              })
            })]
          }), comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleComparisonType.CHANGE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(PercentWrapper, {
            children: "%"
          })]
        })]
      }), !hideControl && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
        features: ['metric-alert-threshold-period'],
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SelectContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
            isDisabled: disabled,
            name: "thresholdPeriod",
            value: thresholdPeriod,
            options: [1, 2, 5, 10, 20].map(value => ({
              value,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tn)('For %s minute', 'For %s minutes', value)
            })),
            onChange: this.handleThresholdPeriodChange
          })
        })
      })]
    });
  }

}

ThresholdControl.displayName = "ThresholdControl";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa7"
} : 0)("display:flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa6"
} : 0)("flex:2;display:flex;align-items:center;flex-direction:", p => p.comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_11__.AlertRuleComparisonType.COUNT ? 'row' : 'row-reverse', ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const SelectContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa5"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const ThresholdContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa4"
} : 0)( true ? {
  name: "7or6jb",
  styles: "flex:1;display:flex;flex-direction:row;align-items:center"
} : 0);

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1gmdxsa3"
} : 0)( true ? {
  name: "1k18kha",
  styles: "height:40px"
} : 0);

const ThresholdInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa2"
} : 0)( true ? {
  name: "1ly0j98",
  styles: "position:relative;display:flex;flex-direction:row;align-items:center"
} : 0);

const PercentWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const DragContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1gmdxsa0"
} : 0)( true ? {
  name: "39il5g",
  styles: "position:absolute;top:4px;right:12px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ThresholdControl);

/***/ }),

/***/ "./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx":
/*!********************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/getEventTypeFilter.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/alerts/rules/metric/utils/hasThresholdValue.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/hasThresholdValue.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ hasThresholdValue)
/* harmony export */ });
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");

/**
 * A threshold has a value if it is not one of the following:
 *
 * '', null, undefined
 *
 *
 */

function hasThresholdValue(value) {
  return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_0__.defined)(value) && value !== '';
}

/***/ }),

/***/ "./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx":
/*!******************************************************************!*\
  !*** ./app/views/alerts/rules/metric/utils/isCrashFreeAlert.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/alerts/rules/metric/wizardField.tsx":
/*!*******************************************************!*\
  !*** ./app/views/alerts/rules/metric/wizardField.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ WizardField)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var lodash_findKey__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/findKey */ "../node_modules/lodash/findKey.js");
/* harmony import */ var lodash_findKey__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_findKey__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/formField */ "./app/components/forms/formField/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/alerts/wizard/options */ "./app/views/alerts/wizard/options.tsx");
/* harmony import */ var sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/eventsV2/table/queryField */ "./app/views/eventsV2/table/queryField.tsx");
/* harmony import */ var sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/eventsV2/table/types */ "./app/views/eventsV2/table/types.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _metricField__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./metricField */ "./app/views/alerts/rules/metric/metricField.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const menuOptions = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('ERRORS'),
  options: [{
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.num_errors,
    value: 'num_errors'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.users_experiencing_errors,
    value: 'users_experiencing_errors'
  }]
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('SESSIONS'),
  options: [{
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.crash_free_sessions,
    value: 'crash_free_sessions'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.crash_free_users,
    value: 'crash_free_users'
  }]
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('PERFORMANCE'),
  options: [{
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.throughput,
    value: 'throughput'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.trans_duration,
    value: 'trans_duration'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.apdex,
    value: 'apdex'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.failure_rate,
    value: 'failure_rate'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.lcp,
    value: 'lcp'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.fid,
    value: 'fid'
  }, {
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.cls,
    value: 'cls'
  }]
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('CUSTOM'),
  options: [{
    label: sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardAlertNames.custom,
    value: 'custom'
  }]
}];
function WizardField(_ref) {
  let {
    organization,
    columnWidth,
    inFieldLabels,
    alertType,
    ...fieldProps
  } = _ref;

  const matchTemplateAggregate = (template, aggregate) => {
    var _templateFieldValue$f, _aggregateFieldValue$, _templateFieldValue$f2, _aggregateFieldValue$2, _templateFieldValue$f3, _aggregateFieldValue$3, _templateFieldValue$f4, _aggregateFieldValue$4;

    const templateFieldValue = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.explodeFieldString)(template.aggregate);
    const aggregateFieldValue = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.explodeFieldString)(aggregate);

    if (template.aggregate === aggregate) {
      return true;
    }

    if (templateFieldValue.kind !== 'function' || aggregateFieldValue.kind !== 'function') {
      return false;
    }

    if (((_templateFieldValue$f = templateFieldValue.function) === null || _templateFieldValue$f === void 0 ? void 0 : _templateFieldValue$f[0]) === 'apdex' && ((_aggregateFieldValue$ = aggregateFieldValue.function) === null || _aggregateFieldValue$ === void 0 ? void 0 : _aggregateFieldValue$[0]) === 'apdex') {
      return true;
    }

    return (_templateFieldValue$f2 = templateFieldValue.function) !== null && _templateFieldValue$f2 !== void 0 && _templateFieldValue$f2[1] && (_aggregateFieldValue$2 = aggregateFieldValue.function) !== null && _aggregateFieldValue$2 !== void 0 && _aggregateFieldValue$2[1] ? ((_templateFieldValue$f3 = templateFieldValue.function) === null || _templateFieldValue$f3 === void 0 ? void 0 : _templateFieldValue$f3[1]) === ((_aggregateFieldValue$3 = aggregateFieldValue.function) === null || _aggregateFieldValue$3 === void 0 ? void 0 : _aggregateFieldValue$3[1]) : ((_templateFieldValue$f4 = templateFieldValue.function) === null || _templateFieldValue$f4 === void 0 ? void 0 : _templateFieldValue$f4[0]) === ((_aggregateFieldValue$4 = aggregateFieldValue.function) === null || _aggregateFieldValue$4 === void 0 ? void 0 : _aggregateFieldValue$4[0]);
  };

  const matchTemplateDataset = (template, dataset) => template.dataset === dataset || organization.features.includes('alert-crash-free-metrics') && (template.aggregate === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_SESSIONS || template.aggregate === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_USERS) && dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.METRICS;

  const matchTemplateEventTypes = (template, eventTypes, aggregate) => aggregate === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_SESSIONS || aggregate === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_USERS || eventTypes.includes(template.eventTypes);

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_formField__WEBPACK_IMPORTED_MODULE_4__["default"], { ...fieldProps,
    children: _ref2 => {
      var _model$getValue, _fieldOptions$fieldKe;

      let {
        onChange,
        model,
        disabled
      } = _ref2;
      const aggregate = model.getValue('aggregate');
      const dataset = model.getValue('dataset');
      const eventTypes = [...((_model$getValue = model.getValue('eventTypes')) !== null && _model$getValue !== void 0 ? _model$getValue : [])];
      const selectedTemplate = alertType === 'custom' ? alertType : lodash_findKey__WEBPACK_IMPORTED_MODULE_3___default()(sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardRuleTemplates, template => matchTemplateAggregate(template, aggregate) && matchTemplateDataset(template, dataset) && matchTemplateEventTypes(template, eventTypes, aggregate)) || 'num_errors';
      const {
        fieldOptionsConfig,
        hidePrimarySelector,
        hideParameterSelector
      } = (0,_metricField__WEBPACK_IMPORTED_MODULE_14__.getFieldOptionConfig)({
        dataset: dataset,
        alertType
      });
      const fieldOptions = (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_13__.generateFieldOptions)({
        organization,
        ...fieldOptionsConfig
      });
      const fieldValue = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.explodeFieldString)(aggregate !== null && aggregate !== void 0 ? aggregate : '');
      const fieldKey = (fieldValue === null || fieldValue === void 0 ? void 0 : fieldValue.kind) === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FUNCTION ? `function:${fieldValue.function[0]}` : '';
      const selectedField = (_fieldOptions$fieldKe = fieldOptions[fieldKey]) === null || _fieldOptions$fieldKe === void 0 ? void 0 : _fieldOptions$fieldKe.value;
      const numParameters = (selectedField === null || selectedField === void 0 ? void 0 : selectedField.kind) === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FUNCTION ? selectedField.meta.parameters.length : 0;
      const gridColumns = 1 + numParameters - (hideParameterSelector ? 1 : 0) - (hidePrimarySelector ? 1 : 0);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Container, {
        hideGap: gridColumns < 1,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_5__["default"], {
          value: selectedTemplate,
          options: menuOptions,
          onChange: option => {
            const template = sentry_views_alerts_wizard_options__WEBPACK_IMPORTED_MODULE_10__.AlertWizardRuleTemplates[option.value];
            model.setValue('aggregate', template.aggregate);
            model.setValue('dataset', template.dataset);
            model.setValue('eventTypes', [template.eventTypes]);
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledQueryField, {
          filterPrimaryOptions: option => option.value.kind === sentry_views_eventsV2_table_types__WEBPACK_IMPORTED_MODULE_12__.FieldValueKind.FUNCTION,
          fieldOptions: fieldOptions,
          fieldValue: fieldValue,
          onChange: v => onChange((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.generateFieldAsString)(v), {}),
          columnWidth: columnWidth,
          gridColumns: gridColumns,
          inFieldLabels: inFieldLabels,
          shouldRenderTag: false,
          disabled: disabled,
          hideParameterSelector: hideParameterSelector,
          hidePrimarySelector: hidePrimarySelector
        })]
      });
    }
  });
}
WizardField.displayName = "WizardField";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "erovx8d1"
} : 0)("display:grid;grid-template-columns:1fr auto;gap:", p => p.hideGap ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0) : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const StyledQueryField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_views_eventsV2_table_queryField__WEBPACK_IMPORTED_MODULE_11__.QueryField,  true ? {
  target: "erovx8d0"
} : 0)(p => p.columnWidth && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_16__.css)("width:", p.gridColumns * p.columnWidth, "px;" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/utils/constants.tsx":
/*!**********************************************!*\
  !*** ./app/views/alerts/utils/constants.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CHANGE_ALERT_CONDITION_IDS": () => (/* binding */ CHANGE_ALERT_CONDITION_IDS),
/* harmony export */   "CHANGE_ALERT_PLACEHOLDERS_LABELS": () => (/* binding */ CHANGE_ALERT_PLACEHOLDERS_LABELS),
/* harmony export */   "COMPARISON_INTERVAL_CHOICES": () => (/* binding */ COMPARISON_INTERVAL_CHOICES),
/* harmony export */   "COMPARISON_TYPE_CHOICES": () => (/* binding */ COMPARISON_TYPE_CHOICES),
/* harmony export */   "COMPARISON_TYPE_CHOICE_VALUES": () => (/* binding */ COMPARISON_TYPE_CHOICE_VALUES)
/* harmony export */ });
const CHANGE_ALERT_CONDITION_IDS = ['sentry.rules.conditions.event_frequency.EventFrequencyCondition', 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition', 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition'];
const CHANGE_ALERT_PLACEHOLDERS_LABELS = {
  'sentry.rules.conditions.event_frequency.EventFrequencyCondition': 'Number of events in an issue is...',
  'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition': 'Number of users affected by an issue is...',
  'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition': 'Percent of sessions affected by an issue is...'
};
const COMPARISON_TYPE_CHOICE_VALUES = {
  count: 'more than {value} in {interval}',
  percent: '{value}% higher in {interval} compared to {comparisonInterval} ago'
};
const COMPARISON_TYPE_CHOICES = [['count', COMPARISON_TYPE_CHOICE_VALUES.count], ['percent', COMPARISON_TYPE_CHOICE_VALUES.percent]];
const COMPARISON_INTERVAL_CHOICES = [['5m', '5 minutes'], ['15m', '15 minutes'], ['1h', 'one hour'], ['1d', 'one day'], ['1w', 'one week'], ['30d', '30 days']];

/***/ }),

/***/ "./app/views/alerts/utils/getChangeStatus.tsx":
/*!****************************************************!*\
  !*** ./app/views/alerts/utils/getChangeStatus.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/alerts/utils/getComparisonMarkLines.tsx":
/*!***********************************************************!*\
  !*** ./app/views/alerts/utils/getComparisonMarkLines.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getComparisonMarkLines": () => (/* binding */ getComparisonMarkLines)
/* harmony export */ });
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/utils/getChangeStatus */ "./app/views/alerts/utils/getChangeStatus.tsx");






const getComparisonMarkLines = function () {
  var _timeseriesData$, _comparisonTimeseries;

  let timeseriesData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  let comparisonTimeseriesData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  let timeWindow = arguments.length > 2 ? arguments[2] : undefined;
  let triggers = arguments.length > 3 ? arguments[3] : undefined;
  let thresholdType = arguments.length > 4 ? arguments[4] : undefined;
  const changeStatuses = [];

  if ((timeseriesData === null || timeseriesData === void 0 ? void 0 : (_timeseriesData$ = timeseriesData[0]) === null || _timeseriesData$ === void 0 ? void 0 : _timeseriesData$.data) !== undefined && timeseriesData[0].data.length > 1 && (comparisonTimeseriesData === null || comparisonTimeseriesData === void 0 ? void 0 : (_comparisonTimeseries = comparisonTimeseriesData[0]) === null || _comparisonTimeseries === void 0 ? void 0 : _comparisonTimeseries.data) !== undefined && comparisonTimeseriesData[0].data.length > 1) {
    const changeData = comparisonTimeseriesData[0].data;
    const baseData = timeseriesData[0].data;

    if (triggers.some(_ref => {
      let {
        alertThreshold
      } = _ref;
      return typeof alertThreshold === 'number';
    })) {
      const lastPointLimit = baseData[changeData.length - 1].name - timeWindow * sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_2__.MINUTE;
      changeData.forEach((_ref2, idx) => {
        let {
          name,
          value: comparisonValue
        } = _ref2;
        const baseValue = baseData[idx].value;
        const comparisonPercentage = comparisonValue === 0 ? baseValue === 0 ? 0 : Infinity : (baseValue - comparisonValue) / comparisonValue * 100;
        const status = (0,sentry_views_alerts_utils_getChangeStatus__WEBPACK_IMPORTED_MODULE_5__.getChangeStatus)(comparisonPercentage, thresholdType, triggers);

        if (idx === 0 || idx === changeData.length - 1 || status !== changeStatuses[changeStatuses.length - 1].status) {
          changeStatuses.push({
            name,
            status
          });
        }
      });
      return changeStatuses.slice(0, -1).map((_ref3, idx) => {
        let {
          name,
          status
        } = _ref3;
        return {
          seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('status'),
          type: 'line',
          markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_0__["default"])({
            silent: true,
            lineStyle: {
              color: status === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_4__.AlertRuleTriggerType.CRITICAL ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].red300 : status === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_4__.AlertRuleTriggerType.WARNING ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].yellow300 : sentry_utils_theme__WEBPACK_IMPORTED_MODULE_3__["default"].green300,
              type: 'solid',
              width: 4
            },
            data: [[{
              coord: [name, 0]
            }, {
              coord: [Math.min(changeStatuses[idx + 1].name, lastPointLimit), 0]
            }]]
          }),
          data: []
        };
      });
    }
  }

  return [];
};

/***/ }),

/***/ "./app/views/alerts/wizard/options.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/wizard/options.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_utils_measurements_measurements_tsx-app_views_alerts_builder_builderBreadCrumbs_tsx-app_v-9351a6.92017201ff3fc74b807386c13e1542e1.js.map