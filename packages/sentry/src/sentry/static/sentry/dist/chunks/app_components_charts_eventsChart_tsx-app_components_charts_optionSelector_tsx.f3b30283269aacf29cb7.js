"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_eventsChart_tsx-app_components_charts_optionSelector_tsx"],{

/***/ "./app/components/charts/eventsChart.tsx":
/*!***********************************************!*\
  !*** ./app/components/charts/eventsChart.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/charts/worldMapChart */ "./app/components/charts/worldMapChart.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _eventsGeoRequest__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./eventsGeoRequest */ "./app/components/charts/eventsGeoRequest.tsx");
/* harmony import */ var _eventsRequest__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























class Chart extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      seriesSelection: {},
      forceUpdate: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLegendSelectChanged", legendChange => {
      const {
        disableableSeries = []
      } = this.props;
      const {
        selected
      } = legendChange;
      const seriesSelection = Object.keys(selected).reduce((state, key) => {
        // we only want them to be able to disable the Releases&Other series,
        // and not any of the other possible series here
        const disableable = ['Releases', 'Other'].includes(key) || disableableSeries.includes(key);
        state[key] = disableable ? selected[key] : true;
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

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.state.seriesSelection, nextState.seriesSelection)) {
      return true;
    }

    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.props.timeseriesData, nextProps.timeseriesData) && lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.props.releaseSeries, nextProps.releaseSeries) && lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.props.previousTimeseriesData, nextProps.previousTimeseriesData) && lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(this.props.tableData, nextProps.tableData)) {
      return false;
    }

    return true;
  }

  getChartComponent() {
    const {
      showDaily,
      timeseriesData,
      yAxis,
      chartComponent
    } = this.props;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(chartComponent)) {
      return chartComponent;
    }

    if (showDaily) {
      return sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_7__.BarChart;
    }

    if (timeseriesData.length > 1) {
      switch ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__.aggregateMultiPlotType)(yAxis)) {
        case 'line':
          return sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_10__.LineChart;

        case 'area':
          return sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_6__.AreaChart;

        default:
          throw new Error(`Unknown multi plot type for ${yAxis}`);
      }
    }

    return sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_6__.AreaChart;
  }

  render() {
    var _markLine, _colors$slice;

    const {
      theme,
      loading: _loading,
      reloading: _reloading,
      yAxis,
      releaseSeries,
      zoomRenderProps,
      timeseriesData,
      previousTimeseriesData,
      showLegend,
      legendOptions,
      chartOptions: chartOptionsProp,
      currentSeriesNames,
      previousSeriesNames,
      seriesTransformer,
      previousSeriesTransformer,
      colors,
      height,
      timeframe,
      topEvents,
      tableData,
      fromDiscover,
      ...props
    } = this.props;
    const {
      seriesSelection
    } = this.state;
    let Component = this.getChartComponent();

    if (Component === sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_15__.WorldMapChart) {
      const {
        data,
        title
      } = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_14__.processTableResults)(tableData);
      const tableSeries = [{
        seriesName: title,
        data
      }];
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_15__.WorldMapChart, {
        series: tableSeries,
        fromDiscover: fromDiscover
      });
    }

    Component = Component;
    const data = [...(currentSeriesNames.length > 0 ? currentSeriesNames : [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Current')]), ...(previousSeriesNames.length > 0 ? previousSeriesNames : [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Previous')])];
    const releasesLegend = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Releases');
    const hasOther = topEvents && topEvents + 1 === timeseriesData.length;

    if (hasOther) {
      data.push('Other');
    }

    if (Array.isArray(releaseSeries)) {
      data.push(releasesLegend);
    } // Temporary fix to improve performance on pages with a high number of releases.


    const releases = releaseSeries && releaseSeries[0];
    const hideReleasesByDefault = Array.isArray(releaseSeries) && (releases === null || releases === void 0 ? void 0 : (_markLine = releases.markLine) === null || _markLine === void 0 ? void 0 : _markLine.data) && releases.markLine.data.length >= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_14__.RELEASE_LINES_THRESHOLD;
    const selected = !Array.isArray(releaseSeries) ? seriesSelection : Object.keys(seriesSelection).length === 0 && hideReleasesByDefault ? {
      [releasesLegend]: false
    } : seriesSelection;
    const legend = showLegend ? {
      right: 16,
      top: 12,
      data,
      selected,
      ...(legendOptions !== null && legendOptions !== void 0 ? legendOptions : {})
    } : undefined;
    let series = Array.isArray(releaseSeries) ? [...timeseriesData, ...releaseSeries] : timeseriesData;
    let previousSeries = previousTimeseriesData;

    if (seriesTransformer) {
      series = seriesTransformer(series);
    }

    if (previousSeriesTransformer) {
      var _previousSeries;

      previousSeries = (_previousSeries = previousSeries) === null || _previousSeries === void 0 ? void 0 : _previousSeries.map(prev => previousSeriesTransformer(prev));
    }

    const chartColors = timeseriesData.length ? (_colors$slice = colors === null || colors === void 0 ? void 0 : colors.slice(0, series.length)) !== null && _colors$slice !== void 0 ? _colors$slice : [...theme.charts.getColorPalette(timeseriesData.length - 2 - (hasOther ? 1 : 0))] : undefined;

    if (chartColors && chartColors.length && hasOther) {
      chartColors.push(theme.chartOther);
    }

    const chartOptions = {
      colors: chartColors,
      grid: {
        left: '24px',
        right: '24px',
        top: '32px',
        bottom: '12px'
      },
      seriesOptions: {
        showSymbol: false
      },
      tooltip: {
        trigger: 'axis',
        truncate: 80,
        valueFormatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_19__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__.aggregateOutputType)(yAxis))
      },
      xAxis: timeframe ? {
        min: timeframe.start,
        max: timeframe.end
      } : undefined,
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_19__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__.aggregateOutputType)(yAxis))
        }
      },
      ...(chartOptionsProp !== null && chartOptionsProp !== void 0 ? chartOptionsProp : {}),
      animation: typeof Component === typeof sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_7__.BarChart ? false : undefined
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Component, { ...props,
      ...zoomRenderProps,
      ...chartOptions,
      legend: legend,
      onLegendSelectChanged: this.handleLegendSelectChanged,
      series: series,
      previousPeriod: previousSeries ? previousSeries : undefined,
      height: height
    });
  }

}

Chart.displayName = "Chart";
const ThemedChart = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_25__.d)(Chart);

class EventsChart extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  isStacked() {
    const {
      topEvents,
      yAxis
    } = this.props;
    return typeof topEvents === 'number' && topEvents > 0 || Array.isArray(yAxis) && yAxis.length > 1;
  }

  render() {
    const {
      api,
      organization,
      period,
      utc,
      query,
      router,
      start,
      end,
      projects,
      environments,
      showLegend,
      minutesThresholdToDisplaySeconds,
      yAxis,
      disablePrevious,
      disableReleases,
      emphasizeReleases,
      currentSeriesName: currentName,
      previousSeriesName: previousName,
      seriesTransformer,
      previousSeriesTransformer,
      field,
      interval,
      showDaily,
      topEvents,
      orderby,
      confirmedQuery,
      colors,
      chartHeader,
      legendOptions,
      chartOptions,
      preserveReleaseQueryParams,
      releaseQueryExtra,
      disableableSeries,
      chartComponent,
      usePageZoom,
      height,
      withoutZerofill,
      fromDiscover,
      ...props
    } = this.props; // Include previous only on relative dates (defaults to relative if no start and end)

    const includePrevious = !disablePrevious && !start && !end;
    const yAxisArray = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeList)(yAxis);
    const yAxisSeriesNames = yAxisArray.map(name => {
      let yAxisLabel = name && (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__.isEquation)(name) ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_20__.getEquation)(name) : name;

      if (yAxisLabel && yAxisLabel.length > 60) {
        yAxisLabel = yAxisLabel.substr(0, 60) + '...';
      }

      return yAxisLabel;
    });
    const previousSeriesNames = previousName ? [previousName] : yAxisSeriesNames.map(name => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('previous %s', name));
    const currentSeriesNames = currentName ? [currentName] : yAxisSeriesNames;
    const intervalVal = showDaily ? '1d' : interval || (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_14__.getInterval)(this.props, 'high');

    let chartImplementation = _ref => {
      let {
        zoomRenderProps,
        releaseSeries,
        errored,
        loading,
        reloading,
        results,
        timeseriesData,
        previousTimeseriesData,
        timeframe,
        tableData
      } = _ref;

      if (errored) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_9__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_16__.IconWarning, {
            color: "gray300",
            size: "lg"
          })
        });
      }

      const seriesData = results ? results : timeseriesData;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_12__["default"], {
        loading: loading,
        reloading: reloading,
        height: height ? `${height}px` : undefined,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_13__["default"], {
          visible: reloading
        }), /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_4__.isValidElement(chartHeader) && chartHeader, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(ThemedChart, {
          zoomRenderProps: zoomRenderProps,
          loading: loading,
          reloading: reloading,
          showLegend: showLegend,
          minutesThresholdToDisplaySeconds: minutesThresholdToDisplaySeconds,
          releaseSeries: releaseSeries || [],
          timeseriesData: seriesData !== null && seriesData !== void 0 ? seriesData : [],
          previousTimeseriesData: previousTimeseriesData,
          currentSeriesNames: currentSeriesNames,
          previousSeriesNames: previousSeriesNames,
          seriesTransformer: seriesTransformer,
          previousSeriesTransformer: previousSeriesTransformer,
          stacked: this.isStacked(),
          yAxis: yAxisArray[0],
          showDaily: showDaily,
          colors: colors,
          legendOptions: legendOptions,
          chartOptions: chartOptions,
          disableableSeries: disableableSeries,
          chartComponent: chartComponent,
          height: height,
          timeframe: timeframe,
          topEvents: topEvents,
          tableData: tableData !== null && tableData !== void 0 ? tableData : [],
          fromDiscover: fromDiscover
        })]
      });
    };

    if (!disableReleases) {
      const previousChart = chartImplementation;

      chartImplementation = chartProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_11__["default"], {
        utc: utc,
        period: period,
        start: start,
        end: end,
        projects: projects,
        environments: environments,
        emphasizeReleases: emphasizeReleases,
        preserveQueryParams: preserveReleaseQueryParams,
        queryExtra: releaseQueryExtra,
        children: _ref2 => {
          let {
            releaseSeries
          } = _ref2;
          return previousChart({ ...chartProps,
            releaseSeries
          });
        }
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_8__["default"], {
      router: router,
      period: period,
      start: start,
      end: end,
      utc: utc,
      usePageDate: usePageZoom,
      ...props,
      children: zoomRenderProps => {
        if (chartComponent === sentry_components_charts_worldMapChart__WEBPACK_IMPORTED_MODULE_15__.WorldMapChart) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_eventsGeoRequest__WEBPACK_IMPORTED_MODULE_22__["default"], {
            api: api,
            organization: organization,
            yAxis: yAxis,
            query: query,
            orderby: orderby,
            projects: projects,
            period: period,
            start: start,
            end: end,
            environments: environments,
            referrer: props.referrer,
            children: _ref3 => {
              let {
                errored,
                loading,
                reloading,
                tableData
              } = _ref3;
              return chartImplementation({
                errored,
                loading,
                reloading,
                zoomRenderProps,
                tableData
              });
            }
          });
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_eventsRequest__WEBPACK_IMPORTED_MODULE_23__["default"], { ...props,
          api: api,
          organization: organization,
          period: period,
          project: projects,
          environment: environments,
          start: start,
          end: end,
          interval: intervalVal,
          query: query,
          includePrevious: includePrevious,
          currentSeriesNames: currentSeriesNames,
          previousSeriesNames: previousSeriesNames,
          yAxis: yAxis,
          field: field,
          orderby: orderby,
          topEvents: topEvents,
          confirmedQuery: confirmedQuery,
          partial: true // Cannot do interpolation when stacking series
          ,
          withoutZerofill: withoutZerofill && !this.isStacked(),
          children: eventData => {
            return chartImplementation({ ...eventData,
              zoomRenderProps
            });
          }
        });
      }
    });
  }

}

EventsChart.displayName = "EventsChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsChart);

/***/ }),

/***/ "./app/components/charts/eventsGeoRequest.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/eventsGeoRequest.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");






const EventsGeoRequest = _ref => {
  let {
    api,
    organization,
    yAxis,
    query,
    orderby,
    projects,
    period,
    start,
    end,
    environments,
    referrer,
    children
  } = _ref;
  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_3__["default"].fromSavedQuery({
    id: undefined,
    name: '',
    version: 2,
    fields: Array.isArray(yAxis) ? yAxis : [yAxis],
    query,
    orderby: orderby !== null && orderby !== void 0 ? orderby : '',
    projects,
    range: period !== null && period !== void 0 ? period : '',
    start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(start) : undefined,
    end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_2__.getUtcDateString)(end) : undefined,
    environment: environments
  });
  const [results, setResults] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(undefined);
  const [reloading, setReloading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [errored, setErrored] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    let mounted = true;
    setErrored(false);

    if (results) {
      setReloading(true);
    }

    (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_4__.doDiscoverQuery)(api, `/organizations/${organization.slug}/events-geo/`, { ...eventView.generateQueryStringObject(),
      referrer
    }).then(discoverQueryResults => {
      if (mounted) {
        setResults([discoverQueryResults[0]]);
        setReloading(false);
      }
    }).catch(() => {
      if (mounted) {
        setErrored(true);
        setReloading(false);
      }
    });
    return () => {
      // Prevent setState leaking on unmounted component
      mounted = false;
    };
  }, [query, yAxis, start, end, period, environments, projects, api]);
  return children({
    errored,
    loading: !results && !errored,
    reloading,
    tableData: results
  });
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsGeoRequest);

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

/***/ "./app/components/charts/releaseSeries.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/releaseSeries.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/partition */ "../node_modules/lodash/partition.js");
/* harmony import */ var lodash_partition__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_partition__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");



 // eslint-disable-next-line no-restricted-imports
















// This is not an exported action/function because releases list uses AsyncComponent
// and this is not re-used anywhere else afaict
function getOrganizationReleases(api, organization, conditions) {
  const query = {};
  Object.keys(conditions).forEach(key => {
    let value = conditions[key];

    if (value && (key === 'start' || key === 'end')) {
      value = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_12__.getUtcDateString)(value);
    }

    if (value) {
      query[key] = value;
    }
  });
  api.clear();
  return api.requestPromise(`/organizations/${organization.slug}/releases/stats/`, {
    includeAllArgs: true,
    method: 'GET',
    query
  });
}

class ReleaseSeries extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      releases: null,
      releaseSeries: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_isMounted", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getOrganizationReleasesMemoized", lodash_memoize__WEBPACK_IMPORTED_MODULE_6___default()((api, organization, conditions) => getOrganizationReleases(api, organization, conditions), (_, __, conditions) => Object.values(conditions).map(val => JSON.stringify(val)).join('-')));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getReleaseSeries", function (releases) {
      let lineStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const {
        organization,
        router,
        tooltip,
        environments,
        start,
        end,
        period,
        preserveQueryParams,
        queryExtra,
        theme
      } = _this.props;
      const query = { ...queryExtra
      };

      if (organization.features.includes('global-views')) {
        query.project = router.location.query.project;
      }

      if (preserveQueryParams) {
        query.environment = [...environments];
        query.start = start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_12__.getUtcDateString)(start) : undefined;
        query.end = end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_12__.getUtcDateString)(end) : undefined;
        query.statsPeriod = period || undefined;
      }

      const markLine = (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_9__["default"])({
        animation: false,
        lineStyle: {
          color: theme.purple300,
          opacity: 0.3,
          type: 'solid',
          ...lineStyle
        },
        label: {
          show: false
        },
        data: releases.map(release => ({
          xAxis: +new Date(release.date),
          name: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatVersion)(release.version, true),
          value: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatVersion)(release.version, true),
          onClick: () => {
            router.push({
              pathname: `/organizations/${organization.slug}/releases/${release.version}/`,
              query
            });
          },
          label: {
            formatter: () => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatVersion)(release.version, true)
          }
        })),
        tooltip: tooltip || {
          trigger: 'item',
          formatter: _ref => {
            let {
              data
            } = _ref;
            // XXX using this.props here as this function does not get re-run
            // unless projects are changed. Using a closure variable would result
            // in stale values.
            const time = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_12__.getFormattedDate)(data.value, 'MMM D, YYYY LT', {
              local: !_this.props.utc
            });
            const version = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.escape)((0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_13__.formatVersion)(data.name, true));
            return ['<div class="tooltip-series">', `<div><span class="tooltip-label"><strong>${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Release')}</strong></span> ${version}</div>`, '</div>', '<div class="tooltip-date">', time, '</div>', '</div>', '<div class="tooltip-arrow"></div>'].join('');
          }
        }
      });
      return {
        seriesName: 'Releases',
        color: theme.purple200,
        data: [],
        markLine
      };
    });
  }

  componentDidMount() {
    this._isMounted = true;
    const {
      releases
    } = this.props;

    if (releases) {
      // No need to fetch releases if passed in from props
      this.setReleasesWithSeries(releases);
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.projects, this.props.projects) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.environments, this.props.environments) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.start, this.props.start) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.end, this.props.end) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.period, this.props.period) || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.query, this.props.query)) {
      this.fetchData();
    } else if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(prevProps.emphasizeReleases, this.props.emphasizeReleases)) {
      this.setReleasesWithSeries(this.state.releases);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.props.api.clear();
  }

  async fetchData() {
    const {
      api,
      organization,
      projects,
      environments,
      period,
      start,
      end,
      memoized,
      query
    } = this.props;
    const conditions = {
      start,
      end,
      project: projects,
      environment: environments,
      statsPeriod: period,
      query
    };
    let hasMore = true;
    const releases = [];

    while (hasMore) {
      try {
        const getReleases = memoized ? this.getOrganizationReleasesMemoized : getOrganizationReleases;
        const [newReleases,, resp] = await getReleases(api, organization, conditions);
        releases.push(...newReleases);

        if (this._isMounted) {
          this.setReleasesWithSeries(releases);
        }

        const pageLinks = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link');

        if (pageLinks) {
          var _paginationObject$nex, _paginationObject$nex2;

          const paginationObject = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_14__["default"])(pageLinks);
          hasMore = (_paginationObject$nex = paginationObject === null || paginationObject === void 0 ? void 0 : (_paginationObject$nex2 = paginationObject.next) === null || _paginationObject$nex2 === void 0 ? void 0 : _paginationObject$nex2.results) !== null && _paginationObject$nex !== void 0 ? _paginationObject$nex : false;
          conditions.cursor = paginationObject.next.cursor;
        } else {
          hasMore = false;
        }
      } catch {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_8__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Error fetching releases'));
        hasMore = false;
      }
    }
  }

  setReleasesWithSeries(releases) {
    const {
      emphasizeReleases = []
    } = this.props;
    const releaseSeries = [];

    if (emphasizeReleases.length) {
      const [unemphasizedReleases, emphasizedReleases] = lodash_partition__WEBPACK_IMPORTED_MODULE_7___default()(releases, release => !emphasizeReleases.includes(release.version));

      if (unemphasizedReleases.length) {
        releaseSeries.push(this.getReleaseSeries(unemphasizedReleases, {
          type: 'dotted'
        }));
      }

      if (emphasizedReleases.length) {
        releaseSeries.push(this.getReleaseSeries(emphasizedReleases, {
          opacity: 0.8
        }));
      }
    } else {
      releaseSeries.push(this.getReleaseSeries(releases));
    }

    this.setState({
      releases,
      releaseSeries
    });
  }

  render() {
    const {
      children
    } = this.props;
    return children({
      releases: this.state.releases,
      releaseSeries: this.state.releaseSeries
    });
  }

}

ReleaseSeries.displayName = "ReleaseSeries";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__["default"])((0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.d)(ReleaseSeries)))));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_eventsChart_tsx-app_components_charts_optionSelector_tsx.c428a9fdba2f40557d1746a2db930cfc.js.map