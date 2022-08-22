(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_charts_worldMapChart_tsx-app_views_releases_detail_overview_index_tsx"],{

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

/***/ "./app/components/charts/components/visualMap.tsx":
/*!********************************************************!*\
  !*** ./app/components/charts/components/visualMap.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VisualMap)
/* harmony export */ });
/* harmony import */ var echarts_lib_component_visualMap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/component/visualMap */ "../node_modules/echarts/lib/component/visualMap.js");

function VisualMap(visualMap) {
  return visualMap;
}

/***/ }),

/***/ "./app/components/charts/series/mapSeries.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/series/mapSeries.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MapSeries)
/* harmony export */ });
/* harmony import */ var echarts_lib_chart_map__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! echarts/lib/chart/map */ "../node_modules/echarts/lib/chart/map.js");

function MapSeries() {
  let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
    map: ''
  };
  return {
    roam: true,
    ...props,
    emphasis: {
      label: {
        show: false
      },
      ...props.emphasis
    },
    type: 'map'
  };
}

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

/***/ "./app/components/charts/stackedAreaChart.tsx":
/*!****************************************************!*\
  !*** ./app/components/charts/stackedAreaChart.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




class StackedAreaChart extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__.AreaChart, {
      tooltip: {
        filter: val => val > 0
      },
      ...this.props,
      stacked: true
    });
  }

}

StackedAreaChart.displayName = "StackedAreaChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (StackedAreaChart);

/***/ }),

/***/ "./app/components/charts/transitionChart.tsx":
/*!***************************************************!*\
  !*** ./app/components/charts/transitionChart.tsx ***!
  \***************************************************/
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
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const defaultProps = {
  height: '200px'
};

class TransitionChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      prevReloading: this.props.reloading,
      prevLoading: this.props.loading,
      key: 1
    });
  }

  static getDerivedStateFromProps(props, state) {
    // Transitions are controlled using variables called:
    // - loading and,
    // - reloading (also called pending in other apps)
    //
    // This component remounts the chart to ensure the stable transition
    // from one dataset to the next.
    const prevReloading = state.prevReloading;
    const nextReloading = props.reloading;
    const prevLoading = state.prevLoading;
    const nextLoading = props.loading; // whenever loading changes, we explicitly remount the children by updating
    // the key prop; regardless of what state reloading is in

    if (prevLoading !== nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // invariant: prevLoading === nextLoading
    // if loading is true, and hasn't changed from the previous re-render,
    // do not remount the children.


    if (nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key
      };
    } // invariant: loading is false
    // whenever the chart is transitioning from the reloading (pending) state to a non-loading state,
    // remount the children


    if (prevReloading && !nextReloading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1
      };
    } // do not remount the children in these remaining cases:
    // !prevReloading && !nextReloading (re-render with no prop change)
    // prevReloading && nextReloading (re-render with no prop change)
    // !prevReloading && nextReloading (from loaded to pending state)


    return {
      prevReloading: nextReloading,
      prevLoading: nextLoading,
      key: state.key
    };
  }

  render() {
    const {
      height,
      loading,
      reloading
    } = this.props;

    if (loading && !reloading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: height,
        "data-test-id": "events-request-loading"
      });
    } // We make use of the key prop to explicitly remount the children
    // https://reactjs.org/docs/lists-and-keys.html#keys


    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: this.props.children
    }, String(this.state.key));
  }

}

TransitionChart.displayName = "TransitionChart";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(TransitionChart, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransitionChart);

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

/***/ "./app/components/charts/worldMapChart.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/worldMapChart.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WorldMapChart": () => (/* binding */ WorldMapChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/lib/core/echarts.js");
/* harmony import */ var echarts_core__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! echarts/core */ "../node_modules/echarts/core.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/max */ "../node_modules/lodash/max.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_max__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _components_visualMap__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./components/visualMap */ "./app/components/charts/components/visualMap.tsx");
/* harmony import */ var _series_mapSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./series/mapSeries */ "./app/components/charts/series/mapSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const DEFAULT_ZOOM = 1.3;
const DISCOVER_ZOOM = 1.1;
const DISCOVER_QUERY_LIST_ZOOM = 0.9;
const DEFAULT_CENTER_X = 10.97;
const DISCOVER_QUERY_LIST_CENTER_Y = -12;
const DEFAULT_CENTER_Y = 9.71;
function WorldMapChart(_ref) {
  let {
    series,
    seriesOptions,
    fromDiscover,
    fromDiscoverQueryList,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(() => ({
    countryToCodeMap: null,
    map: null,
    codeToCountryMap: null
  }));
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    let unmounted = false;

    if (!unmounted) {
      loadWorldMap();
    }

    return () => {
      unmounted = true;
    };
  }, []);

  async function loadWorldMap() {
    try {
      var _echarts$registerMap;

      const [countryCodesMap, world] = await Promise.all([__webpack_require__.e(/*! import() */ "app_data_countryCodesMap_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/data/countryCodesMap */ "./app/data/countryCodesMap.tsx")), __webpack_require__.e(/*! import() */ "app_data_world_json").then(__webpack_require__.t.bind(__webpack_require__, /*! sentry/data/world.json */ "./app/data/world.json", 19))]);
      const countryToCodeMap = countryCodesMap.default;
      const worldMap = world.default; // Echarts not available in tests

      (_echarts$registerMap = echarts_core__WEBPACK_IMPORTED_MODULE_7__.registerMap) === null || _echarts$registerMap === void 0 ? void 0 : _echarts$registerMap.call(echarts_core__WEBPACK_IMPORTED_MODULE_8__, 'sentryWorld', worldMap);
      const codeToCountryMap = {};

      for (const country in worldMap) {
        codeToCountryMap[countryToCodeMap[country]] = country;
      }

      setState({
        countryToCodeMap,
        map: worldMap,
        codeToCountryMap
      });
    } catch {// do nothing
    }
  }

  if (state.countryToCodeMap === null || state.map === null) {
    return null;
  }

  const processedSeries = series.map(_ref2 => {
    var _state$countryToCodeM;

    let {
      seriesName,
      data,
      ...options
    } = _ref2;
    return (0,_series_mapSeries__WEBPACK_IMPORTED_MODULE_4__["default"])({ ...seriesOptions,
      ...options,
      map: 'sentryWorld',
      name: seriesName,
      nameMap: (_state$countryToCodeM = state.countryToCodeMap) !== null && _state$countryToCodeM !== void 0 ? _state$countryToCodeM : undefined,
      aspectScale: 0.85,
      zoom: fromDiscover ? DISCOVER_ZOOM : fromDiscoverQueryList ? DISCOVER_QUERY_LIST_ZOOM : DEFAULT_ZOOM,
      center: [DEFAULT_CENTER_X, fromDiscoverQueryList ? DISCOVER_QUERY_LIST_CENTER_Y : DEFAULT_CENTER_Y],
      itemStyle: {
        areaColor: theme.gray200,
        borderColor: theme.backgroundSecondary
      },
      emphasis: {
        itemStyle: {
          areaColor: theme.pink300
        },
        label: {
          show: false
        }
      },
      data,
      silent: fromDiscoverQueryList,
      roam: !fromDiscoverQueryList
    });
  }); // TODO(billy):
  // For absolute values, we want min/max to based on min/max of series
  // Otherwise it should be 0-100

  const maxValue = lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(series.map(_ref3 => {
    let {
      data
    } = _ref3;
    return lodash_max__WEBPACK_IMPORTED_MODULE_2___default()(data.map(_ref4 => {
      let {
        value
      } = _ref4;
      return value;
    }));
  })) || 1;

  const tooltipFormatter = format => {
    var _state$codeToCountryM;

    const {
      marker,
      name,
      value
    } = Array.isArray(format) ? format[0] : format; // If value is NaN, don't show anything because we won't have a country code either

    if (isNaN(value)) {
      return '';
    } // `value` should be a number


    const formattedValue = typeof value === 'number' ? value.toLocaleString() : '';
    const countryOrCode = ((_state$codeToCountryM = state.codeToCountryMap) === null || _state$codeToCountryM === void 0 ? void 0 : _state$codeToCountryM[name]) || name;
    return [`<div class="tooltip-series tooltip-series-solo">
               <div><span class="tooltip-label">${marker} <strong>${countryOrCode}</strong></span> ${formattedValue}</div>
            </div>`, '<div class="tooltip-arrow"></div>'].join('');
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
    options: {
      backgroundColor: fromDiscoverQueryList ? undefined : theme.background,
      visualMap: [(0,_components_visualMap__WEBPACK_IMPORTED_MODULE_3__["default"])({
        show: !fromDiscoverQueryList,
        left: fromDiscover ? undefined : 'right',
        right: fromDiscover ? 5 : undefined,
        min: 0,
        max: maxValue,
        inRange: {
          color: [theme.purple200, theme.purple300]
        },
        text: ['High', 'Low'],
        textStyle: {
          color: theme.textColor
        },
        // Whether show handles, which can be dragged to adjust "selected range".
        // False because the handles are pretty ugly
        calculable: false
      })]
    },
    ...props,
    yAxis: null,
    xAxis: null,
    series: processedSeries,
    tooltip: {
      formatter: tooltipFormatter
    },
    height: fromDiscover ? 400 : undefined
  });
}
WorldMapChart.displayName = "WorldMapChart";

/***/ }),

/***/ "./app/components/deployBadge.tsx":
/*!****************************************!*\
  !*** ./app/components/deployBadge.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const DeployBadge = _ref => {
  let {
    deploy,
    orgSlug,
    projectId,
    version,
    className
  } = _ref;
  const shouldLinkToIssues = !!orgSlug && !!version;

  const badge = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_1__["default"], {
    className: className,
    type: "highlight",
    icon: shouldLinkToIssues && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconOpen, {
      "data-test-id": "deploy-open-icon"
    }),
    textMaxWidth: 80,
    tooltipText: shouldLinkToIssues ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Open In Issues') : undefined,
    children: deploy.environment
  });

  if (!shouldLinkToIssues) {
    return badge;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_0__["default"], {
    to: {
      pathname: `/organizations/${orgSlug}/issues/`,
      query: {
        project: projectId !== null && projectId !== void 0 ? projectId : null,
        environment: deploy.environment,
        query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_4__.MutableSearch([`release:${version}`]).formatString()
      }
    },
    children: badge
  });
};

DeployBadge.displayName = "DeployBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DeployBadge);

/***/ }),

/***/ "./app/components/discover/performanceCardTable.tsx":
/*!**********************************************************!*\
  !*** ./app/components/discover/performanceCardTable.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















function PerformanceCardTable(_ref) {
  let {
    organization,
    location,
    project,
    releaseEventView,
    allReleasesTableData,
    thisReleaseTableData,
    performanceType,
    isLoading
  } = _ref;
  const miseryRenderer = (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)('user_misery()', allReleasesTableData.meta, false);

  function renderChange(allReleasesScore, thisReleaseScore, meta) {
    if (allReleasesScore === undefined || thisReleaseScore === undefined) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {});
    }

    const trend = allReleasesScore - thisReleaseScore;
    const trendSeconds = trend >= 1000 ? trend / 1000 : trend;
    const trendPercentage = (allReleasesScore - thisReleaseScore) * 100;
    const valPercentage = Math.round(Math.abs(trendPercentage));
    const val = Math.abs(trendSeconds).toFixed(2);

    if (trend === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SubText, {
        children: `0${meta === 'duration' ? 'ms' : '%'}`
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TrendText, {
      color: trend >= 0 ? 'success' : 'error',
      children: [`${meta === 'duration' ? val : valPercentage}${meta === 'duration' ? trend >= 1000 ? 's' : 'ms' : '%'}`, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledIconArrow, {
        color: trend >= 0 ? 'success' : 'error',
        direction: trend >= 0 ? 'down' : 'up',
        size: "xs"
      })]
    });
  }

  function userMiseryTrend() {
    var _allReleasesTableData, _allReleasesTableData2, _thisReleaseTableData, _thisReleaseTableData2;

    const allReleasesUserMisery = allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData = allReleasesTableData.data) === null || _allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData2 = _allReleasesTableData[0]) === null || _allReleasesTableData2 === void 0 ? void 0 : _allReleasesTableData2['user_misery()'];
    const thisReleaseUserMisery = thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData = thisReleaseTableData.data) === null || _thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData2 = _thisReleaseTableData[0]) === null || _thisReleaseTableData2 === void 0 ? void 0 : _thisReleaseTableData2['user_misery()'];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
      children: renderChange(allReleasesUserMisery, thisReleaseUserMisery, 'number')
    });
  }

  function renderFrontendPerformance() {
    const webVitals = [{
      title: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.FCP,
      field: 'p75(measurements.fcp)'
    }, {
      title: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.FID,
      field: 'p75(measurements.fid)'
    }, {
      title: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.LCP,
      field: 'p75(measurements.lcp)'
    }, {
      title: sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.WebVital.CLS,
      field: 'p75(measurements.cls)'
    }];
    const spans = [{
      title: 'HTTP',
      column: 'p75(spans.http)',
      field: 'p75(spans.http)'
    }, {
      title: 'Browser',
      column: 'p75(spans.browser)',
      field: 'p75(spans.browser)'
    }, {
      title: 'Resource',
      column: 'p75(spans.resource)',
      field: 'p75(spans.resource)'
    }];
    const webVitalTitles = webVitals.map((vital, idx) => {
      const newView = releaseEventView.withColumns([{
        kind: 'field',
        field: `p75(${vital.title})`
      }]);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SubTitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react_router__WEBPACK_IMPORTED_MODULE_2__.Link, {
          to: newView.getResultsViewUrlTarget(organization.slug),
          children: [sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.WEB_VITAL_DETAILS[vital.title].name, " (", sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.WEB_VITAL_DETAILS[vital.title].acronym, ")"]
        })
      }, idx);
    });
    const spanTitles = spans.map((span, idx) => {
      const newView = releaseEventView.withColumns([{
        kind: 'field',
        field: `${span.column}`
      }]);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SubTitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_2__.Link, {
          to: newView.getResultsViewUrlTarget(organization.slug),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(span.title)
        })
      }, idx);
    });
    const webVitalsRenderer = webVitals.map(vital => (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(vital.field, allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta, false));
    const spansRenderer = spans.map(span => (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(span.field, allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta, false));
    const webReleaseTrend = webVitals.map(vital => {
      var _allReleasesTableData3, _allReleasesTableData4, _allReleasesTableData5, _thisReleaseTableData3, _thisReleaseTableData4, _thisReleaseTableData5;

      return {
        allReleasesRow: {
          data: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData3 = allReleasesTableData.data) === null || _allReleasesTableData3 === void 0 ? void 0 : (_allReleasesTableData4 = _allReleasesTableData3[0]) === null || _allReleasesTableData4 === void 0 ? void 0 : _allReleasesTableData4[vital.field],
          meta: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData5 = allReleasesTableData.meta) === null || _allReleasesTableData5 === void 0 ? void 0 : _allReleasesTableData5[vital.field]
        },
        thisReleaseRow: {
          data: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData3 = thisReleaseTableData.data) === null || _thisReleaseTableData3 === void 0 ? void 0 : (_thisReleaseTableData4 = _thisReleaseTableData3[0]) === null || _thisReleaseTableData4 === void 0 ? void 0 : _thisReleaseTableData4[vital.field],
          meta: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData5 = thisReleaseTableData.meta) === null || _thisReleaseTableData5 === void 0 ? void 0 : _thisReleaseTableData5[vital.field]
        }
      };
    });
    const spansReleaseTrend = spans.map(span => {
      var _allReleasesTableData6, _allReleasesTableData7, _allReleasesTableData8, _thisReleaseTableData6, _thisReleaseTableData7, _thisReleaseTableData8;

      return {
        allReleasesRow: {
          data: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData6 = allReleasesTableData.data) === null || _allReleasesTableData6 === void 0 ? void 0 : (_allReleasesTableData7 = _allReleasesTableData6[0]) === null || _allReleasesTableData7 === void 0 ? void 0 : _allReleasesTableData7[span.field],
          meta: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData8 = allReleasesTableData.meta) === null || _allReleasesTableData8 === void 0 ? void 0 : _allReleasesTableData8[span.field]
        },
        thisReleaseRow: {
          data: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData6 = thisReleaseTableData.data) === null || _thisReleaseTableData6 === void 0 ? void 0 : (_thisReleaseTableData7 = _thisReleaseTableData6[0]) === null || _thisReleaseTableData7 === void 0 ? void 0 : _thisReleaseTableData7[span.field],
          meta: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData8 = thisReleaseTableData.meta) === null || _thisReleaseTableData8 === void 0 ? void 0 : _thisReleaseTableData8[span.field]
        }
      };
    });

    const emptyColumn = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), webVitals.map((vital, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MultipleEmptySubText, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
          })
        }, vital[index]))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), spans.map((span, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MultipleEmptySubText, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
          })
        }, span[index]))]
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('User Misery')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Web Vitals')
          }), webVitalTitles]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Span Operations')
          }), spanTitles]
        })]
      }), (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.length) === 0 ? emptyColumn : allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.map((dataRow, idx) => {
        const allReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const allReleasesWebVitals = webVitalsRenderer === null || webVitalsRenderer === void 0 ? void 0 : webVitalsRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        const allReleasesSpans = spansRenderer === null || spansRenderer === void 0 ? void 0 : spansRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: allReleasesMisery
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), allReleasesWebVitals.map(webVital => webVital)]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), allReleasesSpans.map(span => span)]
          })]
        }, idx);
      }), (thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.length) === 0 ? emptyColumn : thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.map((dataRow, idx) => {
        const thisReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const thisReleasesWebVitals = webVitalsRenderer === null || webVitalsRenderer === void 0 ? void 0 : webVitalsRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        const thisReleasesSpans = spansRenderer === null || spansRenderer === void 0 ? void 0 : spansRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
              children: thisReleasesMisery
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), thisReleasesWebVitals.map(webVital => webVital)]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), thisReleasesSpans.map(span => span)]
            })]
          })
        }, idx);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [userMiseryTrend(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), webReleaseTrend === null || webReleaseTrend === void 0 ? void 0 : webReleaseTrend.map(row => {
            var _row$allReleasesRow, _row$thisReleaseRow, _row$allReleasesRow2;

            return renderChange((_row$allReleasesRow = row.allReleasesRow) === null || _row$allReleasesRow === void 0 ? void 0 : _row$allReleasesRow.data, (_row$thisReleaseRow = row.thisReleaseRow) === null || _row$thisReleaseRow === void 0 ? void 0 : _row$thisReleaseRow.data, (_row$allReleasesRow2 = row.allReleasesRow) === null || _row$allReleasesRow2 === void 0 ? void 0 : _row$allReleasesRow2.meta);
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), spansReleaseTrend === null || spansReleaseTrend === void 0 ? void 0 : spansReleaseTrend.map(row => {
            var _row$allReleasesRow3, _row$thisReleaseRow2, _row$allReleasesRow4;

            return renderChange((_row$allReleasesRow3 = row.allReleasesRow) === null || _row$allReleasesRow3 === void 0 ? void 0 : _row$allReleasesRow3.data, (_row$thisReleaseRow2 = row.thisReleaseRow) === null || _row$thisReleaseRow2 === void 0 ? void 0 : _row$thisReleaseRow2.data, (_row$allReleasesRow4 = row.allReleasesRow) === null || _row$allReleasesRow4 === void 0 ? void 0 : _row$allReleasesRow4.meta);
          })]
        })]
      })]
    });
  }

  function renderBackendPerformance() {
    const spans = [{
      title: 'HTTP',
      column: 'p75(spans.http)',
      field: 'p75_spans_http'
    }, {
      title: 'DB',
      column: 'p75(spans.db)',
      field: 'p75_spans_db'
    }];
    const spanTitles = spans.map((span, idx) => {
      const newView = releaseEventView.withColumns([{
        kind: 'field',
        field: `${span.column}`
      }]);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SubTitle, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_2__.Link, {
          to: newView.getResultsViewUrlTarget(organization.slug),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(span.title)
        })
      }, idx);
    });
    const apdexRenderer = (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)('apdex', allReleasesTableData.meta, false);
    const spansRenderer = spans.map(span => (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(span.field, allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta, false));
    const spansReleaseTrend = spans.map(span => {
      var _allReleasesTableData9, _allReleasesTableData10, _allReleasesTableData11, _thisReleaseTableData9, _thisReleaseTableData10, _thisReleaseTableData11;

      return {
        allReleasesRow: {
          data: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData9 = allReleasesTableData.data) === null || _allReleasesTableData9 === void 0 ? void 0 : (_allReleasesTableData10 = _allReleasesTableData9[0]) === null || _allReleasesTableData10 === void 0 ? void 0 : _allReleasesTableData10[span.field],
          meta: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData11 = allReleasesTableData.meta) === null || _allReleasesTableData11 === void 0 ? void 0 : _allReleasesTableData11[span.field]
        },
        thisReleaseRow: {
          data: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData9 = thisReleaseTableData.data) === null || _thisReleaseTableData9 === void 0 ? void 0 : (_thisReleaseTableData10 = _thisReleaseTableData9[0]) === null || _thisReleaseTableData10 === void 0 ? void 0 : _thisReleaseTableData10[span.field],
          meta: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData11 = thisReleaseTableData.meta) === null || _thisReleaseTableData11 === void 0 ? void 0 : _thisReleaseTableData11[span.field]
        }
      };
    });

    function apdexTrend() {
      var _allReleasesTableData12, _allReleasesTableData13, _thisReleaseTableData12, _thisReleaseTableData13;

      const allReleasesApdex = allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData12 = allReleasesTableData.data) === null || _allReleasesTableData12 === void 0 ? void 0 : (_allReleasesTableData13 = _allReleasesTableData12[0]) === null || _allReleasesTableData13 === void 0 ? void 0 : _allReleasesTableData13.apdex;
      const thisReleaseApdex = thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData12 = thisReleaseTableData.data) === null || _thisReleaseTableData12 === void 0 ? void 0 : (_thisReleaseTableData13 = _thisReleaseTableData12[0]) === null || _thisReleaseTableData13 === void 0 ? void 0 : _thisReleaseTableData13.apdex;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
        children: renderChange(allReleasesApdex, thisReleaseApdex, 'string')
      });
    }

    const emptyColumn = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), spans.map((span, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MultipleEmptySubText, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
            tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
          })
        }, span[index]))]
      })]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('User Misery')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Apdex')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Span Operations')
          }), spanTitles]
        })]
      }), (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.length) === 0 ? emptyColumn : allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.map((dataRow, idx) => {
        const allReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const allReleasesApdex = apdexRenderer === null || apdexRenderer === void 0 ? void 0 : apdexRenderer(dataRow, {
          organization,
          location
        });
        const allReleasesSpans = spansRenderer === null || spansRenderer === void 0 ? void 0 : spansRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: allReleasesMisery
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ApdexPanelItem, {
            children: allReleasesApdex
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), allReleasesSpans.map(span => span)]
          })]
        }, idx);
      }), (thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.length) === 0 ? emptyColumn : thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.map((dataRow, idx) => {
        const thisReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const thisReleasesApdex = apdexRenderer === null || apdexRenderer === void 0 ? void 0 : apdexRenderer(dataRow, {
          organization,
          location
        });
        const thisReleasesSpans = spansRenderer === null || spansRenderer === void 0 ? void 0 : spansRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: thisReleasesMisery
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ApdexPanelItem, {
            children: thisReleasesApdex
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), thisReleasesSpans.map(span => span)]
          })]
        }, idx);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [userMiseryTrend(), apdexTrend(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(StyledPanelItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TitleSpace, {}), spansReleaseTrend === null || spansReleaseTrend === void 0 ? void 0 : spansReleaseTrend.map(row => {
            var _row$allReleasesRow5, _row$thisReleaseRow3, _row$allReleasesRow6;

            return renderChange((_row$allReleasesRow5 = row.allReleasesRow) === null || _row$allReleasesRow5 === void 0 ? void 0 : _row$allReleasesRow5.data, (_row$thisReleaseRow3 = row.thisReleaseRow) === null || _row$thisReleaseRow3 === void 0 ? void 0 : _row$thisReleaseRow3.data, (_row$allReleasesRow6 = row.allReleasesRow) === null || _row$allReleasesRow6 === void 0 ? void 0 : _row$allReleasesRow6.meta);
          })]
        })]
      })]
    });
  }

  function renderMobilePerformance() {
    const mobileVitals = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.MobileVital.AppStartCold, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.MobileVital.AppStartWarm, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.MobileVital.FramesSlow, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_13__.MobileVital.FramesFrozen];
    const mobileVitalTitles = mobileVitals.map(mobileVital => {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem, {
        children: sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_14__.MOBILE_VITAL_DETAILS[mobileVital].name
      }, mobileVital);
    });
    const mobileVitalFields = ['p75(measurements.app_start_cold)', 'p75(measurements.app_start_warm)', 'p75(measurements.frames_slow)', 'p75(measurements.frames_frozen)'];
    const mobileVitalsRenderer = mobileVitalFields.map(field => (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta) && (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_12__.getFieldRenderer)(field, allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.meta, false));
    const mobileReleaseTrend = mobileVitalFields.map(field => {
      var _allReleasesTableData14, _allReleasesTableData15, _allReleasesTableData16, _thisReleaseTableData14, _thisReleaseTableData15, _thisReleaseTableData16;

      return {
        allReleasesRow: {
          data: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData14 = allReleasesTableData.data) === null || _allReleasesTableData14 === void 0 ? void 0 : (_allReleasesTableData15 = _allReleasesTableData14[0]) === null || _allReleasesTableData15 === void 0 ? void 0 : _allReleasesTableData15[field],
          meta: allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : (_allReleasesTableData16 = allReleasesTableData.meta) === null || _allReleasesTableData16 === void 0 ? void 0 : _allReleasesTableData16[field]
        },
        thisReleaseRow: {
          data: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData14 = thisReleaseTableData.data) === null || _thisReleaseTableData14 === void 0 ? void 0 : (_thisReleaseTableData15 = _thisReleaseTableData14[0]) === null || _thisReleaseTableData15 === void 0 ? void 0 : _thisReleaseTableData15[field],
          meta: thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : (_thisReleaseTableData16 = thisReleaseTableData.meta) === null || _thisReleaseTableData16 === void 0 ? void 0 : _thisReleaseTableData16[field]
        }
      };
    });

    const emptyColumn = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      }), mobileVitalFields.map((vital, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      }, vital[index]))]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('User Misery')
        }), mobileVitalTitles]
      }), (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.length) === 0 ? emptyColumn : allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.map((dataRow, idx) => {
        const allReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const allReleasesMobile = mobileVitalsRenderer === null || mobileVitalsRenderer === void 0 ? void 0 : mobileVitalsRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: allReleasesMisery
          }), allReleasesMobile.map((mobileVital, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
            children: mobileVital
          }, i))]
        }, idx);
      }), (thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.length) === 0 ? emptyColumn : thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.map((dataRow, idx) => {
        const thisReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        const thisReleasesMobile = mobileVitalsRenderer === null || mobileVitalsRenderer === void 0 ? void 0 : mobileVitalsRenderer.map(renderer => renderer === null || renderer === void 0 ? void 0 : renderer(dataRow, {
          organization,
          location
        }));
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: thisReleasesMisery
          }), thisReleasesMobile.map((mobileVital, i) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
            children: mobileVital
          }, i))]
        }, idx);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
        children: [userMiseryTrend(), mobileReleaseTrend === null || mobileReleaseTrend === void 0 ? void 0 : mobileReleaseTrend.map((row, idx) => {
          var _row$allReleasesRow7, _row$thisReleaseRow4, _row$allReleasesRow8;

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelItem, {
            children: renderChange((_row$allReleasesRow7 = row.allReleasesRow) === null || _row$allReleasesRow7 === void 0 ? void 0 : _row$allReleasesRow7.data, (_row$thisReleaseRow4 = row.thisReleaseRow) === null || _row$thisReleaseRow4 === void 0 ? void 0 : _row$thisReleaseRow4.data, (_row$allReleasesRow8 = row.allReleasesRow) === null || _row$allReleasesRow8 === void 0 ? void 0 : _row$allReleasesRow8.meta)
          }, idx);
        })]
      })]
    });
  }

  function renderUnknownPerformance() {
    const emptyColumn = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SingleEmptySubText, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledNotAvailable, {
          tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No results found')
        })
      })
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('User Misery')
        })
      }), (allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.length) === 0 ? emptyColumn : allReleasesTableData === null || allReleasesTableData === void 0 ? void 0 : allReleasesTableData.data.map((dataRow, idx) => {
        const allReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: allReleasesMisery
          })
        }, idx);
      }), (thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.length) === 0 ? emptyColumn : thisReleaseTableData === null || thisReleaseTableData === void 0 ? void 0 : thisReleaseTableData.data.map((dataRow, idx) => {
        const thisReleasesMisery = miseryRenderer === null || miseryRenderer === void 0 ? void 0 : miseryRenderer(dataRow, {
          organization,
          location
        });
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(UserMiseryPanelItem, {
            children: thisReleasesMisery
          })
        }, idx);
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
        children: userMiseryTrend()
      })]
    });
  }

  const loader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledLoadingIndicator, {});

  const platformPerformanceRender = {
    [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__.PROJECT_PERFORMANCE_TYPE.FRONTEND]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Frontend Performance'),
      section: renderFrontendPerformance()
    },
    [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__.PROJECT_PERFORMANCE_TYPE.BACKEND]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Backend Performance'),
      section: renderBackendPerformance()
    },
    [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__.PROJECT_PERFORMANCE_TYPE.MOBILE]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Mobile Performance'),
      section: renderMobilePerformance()
    },
    [sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__.PROJECT_PERFORMANCE_TYPE.ANY]: {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('[Unknown] Performance'),
      section: renderUnknownPerformance()
    }
  };
  const isUnknownPlatform = performanceType === sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_15__.PROJECT_PERFORMANCE_TYPE.ANY;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(HeadCellContainer, {
      children: platformPerformanceRender[performanceType].title
    }), isUnknownPlatform && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledAlert, {
      type: "warning",
      showIcon: true,
      system: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('For more performance metrics, specify which platform this project is using in [link]', {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_2__.Link, {
          to: `/settings/${organization.slug}/projects/${project.slug}/`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('project settings.')
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledPanelTable, {
      isLoading: isLoading,
      headers: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
        align: "left",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Description')
      }, "description"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
        align: "right",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('All Releases')
      }, "releases"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
        align: "right",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This Release')
      }, "release"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Cell, {
        align: "right",
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Change')
      }, "change")],
      disablePadding: true,
      loader: loader,
      disableTopBorder: isUnknownPlatform,
      children: platformPerformanceRender[performanceType].section
    })]
  });
}

PerformanceCardTable.displayName = "PerformanceCardTable";

function PerformanceCardTableWrapper(_ref2) {
  let {
    organization,
    project,
    allReleasesEventView,
    releaseEventView,
    performanceType,
    location
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_11__["default"], {
    eventView: allReleasesEventView,
    orgSlug: organization.slug,
    location: location,
    useEvents: true,
    children: _ref3 => {
      let {
        isLoading,
        tableData: allReleasesTableData
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_11__["default"], {
        eventView: releaseEventView,
        orgSlug: organization.slug,
        location: location,
        useEvents: true,
        children: _ref4 => {
          let {
            isLoading: isReleaseLoading,
            tableData: thisReleaseTableData
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(PerformanceCardTable, {
            isLoading: isLoading || isReleaseLoading,
            organization: organization,
            location: location,
            project: project,
            allReleasesEventView: allReleasesEventView,
            releaseEventView: releaseEventView,
            allReleasesTableData: allReleasesTableData,
            thisReleaseTableData: thisReleaseTableData,
            performanceType: performanceType
          });
        }
      });
    }
  });
}

PerformanceCardTableWrapper.displayName = "PerformanceCardTableWrapper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PerformanceCardTableWrapper);

const emptyFieldCss = p => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.css)("color:", p.theme.chartOther, ";text-align:right;" + ( true ? "" : 0),  true ? "" : 0);

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e3pectd15"
} : 0)( true ? {
  name: "109hxx0",
  styles: "margin:70px auto"
} : 0);

const HeadCellContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd14"
} : 0)("font-size:", p => p.theme.fontSizeExtraLarge, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";border-top:1px solid ", p => p.theme.border, ";border-left:1px solid ", p => p.theme.border, ";border-right:1px solid ", p => p.theme.border, ";border-top-left-radius:", p => p.theme.borderRadius, ";border-top-right-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e3pectd13"
} : 0)("border-top-left-radius:0;border-top-right-radius:0;border-top:", p => p.disableTopBorder ? 'none' : `1px solid ${p.theme.border}`, ";@media (max-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:min-content 1fr 1fr 1fr;}" + ( true ? "" : 0));

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e3pectd12"
} : 0)( true ? {
  name: "1wb4dzc",
  styles: "display:block;white-space:nowrap;width:100%"
} : 0);

const SubTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd11"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), ";" + ( true ? "" : 0));

const TitleSpace = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd10"
} : 0)( true ? {
  name: "1ncq4tc",
  styles: "height:24px"
} : 0);

const UserMiseryPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e3pectd9"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

const ApdexPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e3pectd8"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

const SingleEmptySubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelItem,  true ? {
  target: "e3pectd7"
} : 0)("display:block;", emptyFieldCss, ";" + ( true ? "" : 0));

const MultipleEmptySubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd6"
} : 0)(emptyFieldCss, ";" + ( true ? "" : 0));

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd5"
} : 0)("text-align:", p => p.align, ";margin-left:", p => p.align === 'left' && (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";padding-right:", p => p.align === 'right' && (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e3pectd4"
} : 0)("border-top:1px solid ", p => p.theme.border, ";border-right:1px solid ", p => p.theme.border, ";border-left:1px solid ", p => p.theme.border, ";margin-bottom:0;" + ( true ? "" : 0));

const StyledNotAvailable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e3pectd3"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

const SubText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd2"
} : 0)("color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

const TrendText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e3pectd1"
} : 0)("color:", p => p.theme[p.color], ";text-align:right;" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconArrow,  true ? {
  target: "e3pectd0"
} : 0)("color:", p => p.theme[p.color], ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/discover/transactionsList.tsx":
/*!******************************************************!*\
  !*** ./app/components/discover/transactionsList.tsx ***!
  \******************************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/discoverButton */ "./app/components/discoverButton.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/performance/trends/trendsDiscoverQuery */ "./app/utils/performance/trends/trendsDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionEvents/utils */ "./app/views/performance/transactionSummary/transactionEvents/utils.tsx");
/* harmony import */ var _transactionsTable__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./transactionsTable */ "./app/components/discover/transactionsTable.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















const DEFAULT_TRANSACTION_LIMIT = 5;

class _TransactionsList extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCursor", (cursor, pathname, query) => {
      const {
        cursorName
      } = this.props;
      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
        pathname,
        query: { ...query,
          [cursorName]: cursor
        }
      });
    });
  }

  getEventView() {
    const {
      eventView,
      selected
    } = this.props;
    const sortedEventView = eventView.withSorts([selected.sort]);

    if (selected.query) {
      const query = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_16__.MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }

    return sortedEventView;
  }

  generateDiscoverEventView() {
    const {
      generateDiscoverEventView
    } = this.props;

    if (typeof generateDiscoverEventView === 'function') {
      return generateDiscoverEventView();
    }

    return this.getEventView();
  }

  generatePerformanceTransactionEventsView() {
    var _generatePerformanceT;

    const {
      generatePerformanceTransactionEventsView
    } = this.props;
    return (_generatePerformanceT = generatePerformanceTransactionEventsView === null || generatePerformanceTransactionEventsView === void 0 ? void 0 : generatePerformanceTransactionEventsView()) !== null && _generatePerformanceT !== void 0 ? _generatePerformanceT : this.getEventView();
  }

  renderHeader() {
    const {
      organization,
      selected,
      options,
      handleDropdownChange,
      handleOpenAllEventsClick,
      handleOpenInDiscoverClick,
      showTransactions,
      breakdown
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_9__["default"], {
          triggerProps: {
            prefix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Filter'),
            size: 'xs'
          },
          value: selected.value,
          options: options,
          onChange: opt => handleDropdownChange(opt.value)
        })
      }), !this.isTrend() && (handleOpenAllEventsClick ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__["default"], {
        target: "release_transactions_open_in_transaction_events",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          onClick: handleOpenAllEventsClick,
          to: this.generatePerformanceTransactionEventsView().getPerformanceTransactionEventsViewUrlTarget(organization.slug, {
            showTransactions: (0,sentry_views_performance_transactionSummary_transactionEvents_utils__WEBPACK_IMPORTED_MODULE_18__.mapShowTransactionToPercentile)(showTransactions),
            breakdown
          }),
          size: "xs",
          "data-test-id": "transaction-events-open",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('View All Events')
        })
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_6__["default"], {
        target: "release_transactions_open_in_discover",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_discoverButton__WEBPACK_IMPORTED_MODULE_8__["default"], {
          onClick: handleOpenInDiscoverClick,
          to: this.generateDiscoverEventView().getResultsViewUrlTarget(organization.slug),
          size: "xs",
          "data-test-id": "discover-open",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Open in Discover')
        })
      }))]
    });
  }

  renderTransactionTable() {
    var _location$query;

    const {
      location,
      organization,
      handleCellAction,
      cursorName,
      limit,
      titles,
      generateLink,
      forceLoading
    } = this.props;
    const useEvents = organization.features.includes('performance-frontend-use-events-endpoint');
    const eventView = this.getEventView();
    const columnOrder = eventView.getColumns();
    const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_15__.decodeScalar)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query[cursorName]);

    const tableRenderer = _ref => {
      let {
        isLoading,
        pageLinks,
        tableData
      } = _ref;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Header, {
          children: [this.renderHeader(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPagination, {
            pageLinks: pageLinks,
            onCursor: this.handleCursor,
            size: "xs"
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_transactionsTable__WEBPACK_IMPORTED_MODULE_19__["default"], {
          eventView: eventView,
          organization: organization,
          location: location,
          isLoading: isLoading,
          tableData: tableData,
          columnOrder: columnOrder,
          titles: titles,
          generateLink: generateLink,
          handleCellAction: handleCellAction,
          useAggregateAlias: !useEvents
        })]
      });
    };

    if (forceLoading) {
      return tableRenderer({
        isLoading: true,
        pageLinks: null,
        tableData: null
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_13__["default"], {
      location: location,
      eventView: eventView,
      orgSlug: organization.slug,
      limit: limit,
      cursor: cursor,
      referrer: "api.discover.transactions-list",
      useEvents: useEvents,
      children: tableRenderer
    });
  }

  renderTrendsTable() {
    var _location$query2;

    const {
      trendView,
      location,
      selected,
      organization,
      cursorName,
      generateLink
    } = this.props;
    const sortedEventView = trendView.clone();
    sortedEventView.sorts = [selected.sort];
    sortedEventView.trendType = selected.trendType;

    if (selected.query) {
      const query = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_16__.MutableSearch(sortedEventView.query);
      selected.query.forEach(item => query.setFilterValues(item[0], [item[1]]));
      sortedEventView.query = query.formatString();
    }

    const cursor = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_15__.decodeScalar)((_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2[cursorName]);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_performance_trends_trendsDiscoverQuery__WEBPACK_IMPORTED_MODULE_14__.TrendsEventsDiscoverQuery, {
      eventView: sortedEventView,
      orgSlug: organization.slug,
      location: location,
      cursor: cursor,
      limit: 5,
      children: _ref2 => {
        let {
          isLoading,
          trendsData,
          pageLinks
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Header, {
            children: [this.renderHeader(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledPagination, {
              pageLinks: pageLinks,
              onCursor: this.handleCursor,
              size: "sm"
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_transactionsTable__WEBPACK_IMPORTED_MODULE_19__["default"], {
            eventView: sortedEventView,
            organization: organization,
            location: location,
            isLoading: isLoading,
            tableData: trendsData,
            titles: ['transaction', 'percentage', 'difference'],
            columnOrder: (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_17__.decodeColumnOrder)([{
              field: 'transaction'
            }, {
              field: 'trend_percentage()'
            }, {
              field: 'trend_difference()'
            }]),
            generateLink: generateLink,
            useAggregateAlias: true
          })]
        });
      }
    });
  }

  isTrend() {
    const {
      selected
    } = this.props;
    return selected.trendType !== undefined;
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: this.isTrend() ? this.renderTrendsTable() : this.renderTransactionTable()
    });
  }

}

_TransactionsList.displayName = "_TransactionsList";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_TransactionsList, "defaultProps", {
  cursorName: 'transactionCursor',
  limit: DEFAULT_TRANSACTION_LIMIT
});

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ez2v7e91"
} : 0)("display:grid;grid-template-columns:1fr auto auto;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "ez2v7e90"
} : 0)("margin:0 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const TransactionsList = props => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_TransactionsList, { ...props
  });
};

TransactionsList.displayName = "TransactionsList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionsList);

/***/ }),

/***/ "./app/components/discover/transactionsTable.tsx":
/*!*******************************************************!*\
  !*** ./app/components/discover/transactionsTable.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/gridEditable/sortLink */ "./app/components/gridEditable/sortLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels/panelTable */ "./app/components/panels/panelTable.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fieldRenderers */ "./app/utils/discover/fieldRenderers.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/performanceForSentry */ "./app/utils/performanceForSentry.tsx");
/* harmony import */ var sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/eventsV2/table/cellAction */ "./app/views/eventsV2/table/cellAction.tsx");
/* harmony import */ var sentry_views_performance_styles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/performance/styles */ "./app/views/performance/styles.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















class TransactionsTable extends react__WEBPACK_IMPORTED_MODULE_2__.PureComponent {
  getTitles() {
    const {
      eventView,
      titles
    } = this.props;
    return titles !== null && titles !== void 0 ? titles : eventView.getFields();
  }

  renderHeader() {
    const {
      tableData,
      columnOrder
    } = this.props;
    const tableMeta = tableData === null || tableData === void 0 ? void 0 : tableData.meta;

    const generateSortLink = () => undefined;

    const tableTitles = this.getTitles();
    const headers = tableTitles.map((title, index) => {
      const column = columnOrder[index];
      const align = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.fieldAlignment)(column.name, column.type, tableMeta);

      if (column.key === 'span_ops_breakdown.relative') {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(HeadCellContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
            align: align,
            title: title === (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('operation duration') ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
              children: [title, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StyledIconQuestion, {
                size: "xs",
                position: "top",
                title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)(`Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.`)
              })]
            }) : title,
            direction: undefined,
            canSort: false,
            generateSortLink: generateSortLink
          })
        }, index);
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(HeadCellContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_gridEditable_sortLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
          align: align,
          title: title,
          direction: undefined,
          canSort: false,
          generateSortLink: generateSortLink
        })
      }, index);
    });
    return headers;
  }

  renderRow(row, rowIndex, columnOrder, tableMeta) {
    const {
      eventView,
      organization,
      location,
      generateLink,
      handleCellAction,
      titles,
      useAggregateAlias
    } = this.props;
    const fields = eventView.getFields();

    if (titles && titles.length) {
      // Slice to match length of given titles
      columnOrder = columnOrder.slice(0, titles.length);
    }

    const resultsRow = columnOrder.map((column, index) => {
      var _generateLink$field;

      const field = String(column.key); // TODO add a better abstraction for this in fieldRenderers.

      const fieldName = useAggregateAlias ? (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.getAggregateAlias)(field) : field;
      const fieldType = tableMeta[fieldName];
      const fieldRenderer = (0,sentry_utils_discover_fieldRenderers__WEBPACK_IMPORTED_MODULE_10__.getFieldRenderer)(field, tableMeta, useAggregateAlias);
      let rendered = fieldRenderer(row, {
        organization,
        location
      });
      const target = generateLink === null || generateLink === void 0 ? void 0 : (_generateLink$field = generateLink[field]) === null || _generateLink$field === void 0 ? void 0 : _generateLink$field.call(generateLink, organization, row, location.query);

      if (target) {
        rendered = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"], {
          "data-test-id": `view-${fields[index]}`,
          to: target,
          children: rendered
        });
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_performance_styles__WEBPACK_IMPORTED_MODULE_14__.GridCellNumber, {
        children: rendered
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_performance_styles__WEBPACK_IMPORTED_MODULE_14__.GridCell, {
        children: rendered
      });

      if (handleCellAction) {
        rendered = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_eventsV2_table_cellAction__WEBPACK_IMPORTED_MODULE_13__["default"], {
          column: column,
          dataRow: row,
          handleCellAction: handleCellAction(column),
          children: rendered
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(BodyCellContainer, {
        children: rendered
      }, key);
    });
    return resultsRow;
  }

  renderResults() {
    const {
      isLoading,
      tableData,
      columnOrder
    } = this.props;
    let cells = [];

    if (isLoading) {
      return cells;
    }

    if (!tableData || !tableData.meta || !tableData.data) {
      return cells;
    }

    tableData.data.forEach((row, i) => {
      // Another check to appease tsc
      if (!tableData.meta) {
        return;
      }

      cells = cells.concat(this.renderRow(row, i, columnOrder, tableData.meta));
    });
    return cells;
  }

  render() {
    const {
      isLoading,
      tableData
    } = this.props;
    const hasResults = tableData && tableData.data && tableData.meta && tableData.data.length > 0; // Custom set the height so we don't have layout shift when results are loaded.

    const loader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {
      style: {
        margin: '70px auto'
      }
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_utils_performanceForSentry__WEBPACK_IMPORTED_MODULE_12__.VisuallyCompleteWithData, {
      id: "TransactionsTable",
      hasData: hasResults,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels_panelTable__WEBPACK_IMPORTED_MODULE_6__["default"], {
        "data-test-id": "transactions-table",
        isEmpty: !hasResults,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('No transactions found'),
        headers: this.renderHeader(),
        isLoading: isLoading,
        disablePadding: true,
        loader: loader,
        children: this.renderResults()
      })
    });
  }

}

TransactionsTable.displayName = "TransactionsTable";

const HeadCellContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e892l522"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";" + ( true ? "" : 0));

const BodyCellContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e892l521"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const StyledIconQuestion = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e892l520"
} : 0)( true ? {
  name: "1dgfen9",
  styles: "position:relative;top:1px;left:4px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionsTable);

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

/***/ "./app/utils/performance/contexts/genericQueryBatcher.tsx":
/*!****************************************************************!*\
  !*** ./app/utils/performance/contexts/genericQueryBatcher.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GenericQueryBatcher": () => (/* binding */ GenericQueryBatcher),
/* harmony export */   "QueryBatchNode": () => (/* binding */ QueryBatchNode)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.reflect.to-string-tag.js */ "../node_modules/core-js/modules/es.reflect.to-string-tag.js");
/* harmony import */ var core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_reflect_to_string_tag_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_identity__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/identity */ "../node_modules/lodash/identity.js");
/* harmony import */ var lodash_identity__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_identity__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const [GenericQueryBatcherProvider, _useGenericQueryBatcher] = (0,_utils__WEBPACK_IMPORTED_MODULE_7__.createDefinedContext)({
  name: 'GenericQueryBatcherContext'
});

function mergeKey(query) {
  return `${query.batchProperty}.${query.path}`;
}

// Builds a map that will contain an array of query definitions by mergeable key (using batch property and path)
function queriesToMap(collectedQueries) {
  const keys = Reflect.ownKeys(collectedQueries);

  if (!keys.length) {
    return false;
  }

  const mergeMap = {};
  keys.forEach(key => {
    const query = collectedQueries[key];
    mergeMap[mergeKey(query)] = mergeMap[mergeKey(query)] || [];
    mergeMap[mergeKey(query)].push(query);
    delete collectedQueries[key];
  });
  return mergeMap;
}

function requestFunction(api, path, queryObject) {
  return api.requestPromise(path, queryObject);
}

function _handleUnmergeableQuery(queryDefinition) {
  const result = requestFunction(queryDefinition.api, queryDefinition.path, queryDefinition.requestQueryObject);
  queryDefinition.resolve(result);
}

function _handleUnmergeableQueries(mergeMap) {
  let queriesSent = 0;
  Object.keys(mergeMap).forEach(k => {
    // Using async forEach to ensure calls start in parallel.
    const mergeList = mergeMap[k];

    if (mergeList.length === 1) {
      const [queryDefinition] = mergeList;
      queriesSent++;

      _handleUnmergeableQuery(queryDefinition);
    }
  });
  return queriesSent;
}

function _handleMergeableQueries(mergeMap) {
  let queriesSent = 0;
  Object.keys(mergeMap).forEach(async k => {
    const mergeList = mergeMap[k];

    if (mergeList.length <= 1) {
      return;
    }

    const [exampleDefinition] = mergeList;
    const batchProperty = exampleDefinition.batchProperty;
    const query = { ...exampleDefinition.requestQueryObject.query
    };
    const requestQueryObject = { ...exampleDefinition.requestQueryObject,
      query
    };
    const batchValues = [];
    mergeList.forEach(q => {
      const batchFieldValue = q.requestQueryObject.query[batchProperty];

      if (Array.isArray(batchFieldValue)) {
        if (batchFieldValue.length > 1) {
          // Omit multiple requests with multi fields (eg. yAxis) for now and run them as single queries
          queriesSent++;

          _handleUnmergeableQuery(q);

          return;
        } // Unwrap array value if it is a single value


        batchValues.push(batchFieldValue[0]);
      } else {
        batchValues.push(batchFieldValue);
      }
    });
    requestQueryObject.query[batchProperty] = batchValues;
    queriesSent++;
    const requestPromise = requestFunction(exampleDefinition.api, exampleDefinition.path, requestQueryObject);

    try {
      const result = await requestPromise; // Unmerge back into individual results

      mergeList.forEach(queryDefinition => {
        queryDefinition.resolve((queryDefinition.transform || (lodash_identity__WEBPACK_IMPORTED_MODULE_3___default()))(result, queryDefinition));
      });
    } catch (e) {
      // On error fail all requests relying on this merged query (for now)
      mergeList.forEach(q => q.reject(e));
    }
  });
  return queriesSent;
}

function handleBatching(organization, queries) {
  const mergeMap = queriesToMap(queries);

  if (!mergeMap) {
    return;
  }

  let queriesSent = 0;
  queriesSent += _handleUnmergeableQueries(mergeMap);
  queriesSent += _handleMergeableQueries(mergeMap);
  const queriesCollected = Object.values(mergeMap).reduce((acc, mergeList) => acc + mergeList.length, 0);
  const queriesSaved = queriesCollected - queriesSent;
  (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__["default"])('performance_views.landingv3.batch_queries', {
    organization,
    num_collected: queriesCollected,
    num_saved: queriesSaved,
    num_sent: queriesSent
  });
}

const GenericQueryBatcher = _ref => {
  let {
    children
  } = _ref;
  const queries = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)({});
  const timeoutRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(undefined);
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])();

  const addQuery = (q, id) => {
    queries.current[id] = q;
    window.clearTimeout(timeoutRef.current); // Put batch function in the next macro task to aggregate all requests in this frame.

    timeoutRef.current = window.setTimeout(() => {
      handleBatching(organization, queries.current);
      timeoutRef.current = undefined;
    }, 0);
  }; // Cleanup timeout after component unmounts.


  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => () => {
    timeoutRef.current && window.clearTimeout(timeoutRef.current);
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(GenericQueryBatcherProvider, {
    value: {
      addQuery
    },
    children: children
  });
};
GenericQueryBatcher.displayName = "GenericQueryBatcher";
const BatchNodeContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)(undefined);
// Wraps api request components to collect at most one request per frame / render pass using symbol as a unique id.
// Transforms these requests into an intermediate promise and adds a query definition that the batch function will use.
function QueryBatchNode(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const {
    batchProperty,
    children,
    transform
  } = props;
  const id = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(Symbol());
  let batchContext;

  try {
    batchContext = _useGenericQueryBatcher();
  } catch (_) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: children({})
    });
  }

  function batchRequest(_, path, requestQueryObject) {
    const queryPromise = new Promise((resolve, reject) => {
      var _batchContext;

      const queryDefinition = {
        resolve,
        reject,
        transform,
        batchProperty,
        path,
        requestQueryObject,
        api
      };
      (_batchContext = batchContext) === null || _batchContext === void 0 ? void 0 : _batchContext.addQuery(queryDefinition, id.current);
    });
    return queryPromise;
  }

  const queryBatching = {
    batchRequest
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(BatchNodeContext.Provider, {
    value: {
      id,
      batchProperty
    },
    children: children({
      queryBatching
    })
  });
}
QueryBatchNode.displayName = "QueryBatchNode";

/***/ }),

/***/ "./app/utils/performance/contexts/pageError.tsx":
/*!******************************************************!*\
  !*** ./app/utils/performance/contexts/pageError.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PageErrorAlert": () => (/* binding */ PageErrorAlert),
/* harmony export */   "PageErrorProvider": () => (/* binding */ PageErrorProvider),
/* harmony export */   "usePageError": () => (/* binding */ usePageError)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const pageErrorContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)({
  pageError: undefined,
  setPageError: _ => {}
});
const PageErrorProvider = _ref => {
  let {
    children
  } = _ref;
  const [pageError, setPageError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(pageErrorContext.Provider, {
    value: {
      pageError,
      setPageError
    },
    children: children
  });
};
PageErrorProvider.displayName = "PageErrorProvider";
const PageErrorAlert = () => {
  const {
    pageError
  } = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(pageErrorContext);

  if (!pageError) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
    type: "error",
    "data-test-id": "page-error-alert",
    showIcon: true,
    children: pageError
  });
};
PageErrorAlert.displayName = "PageErrorAlert";
const usePageError = () => (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(pageErrorContext);

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

/***/ "./app/utils/performance/trends/trendsDiscoverQuery.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/performance/trends/trendsDiscoverQuery.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TrendsEventsDiscoverQuery": () => (/* binding */ TrendsEventsDiscoverQuery),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getTrendsRequestPayload": () => (/* binding */ getTrendsRequestPayload)
/* harmony export */ });
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/views/performance/trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function getTrendsRequestPayload(props) {
  const {
    eventView,
    projects
  } = props;
  const apiPayload = eventView === null || eventView === void 0 ? void 0 : eventView.getEventsAPIPayload(props.location);
  const trendFunction = (0,sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_3__.getCurrentTrendFunction)(props.location, props.trendFunctionField);
  const trendParameter = (0,sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_3__.getCurrentTrendParameter)(props.location, projects, eventView.project);
  apiPayload.trendFunction = (0,sentry_views_performance_trends_utils__WEBPACK_IMPORTED_MODULE_3__.generateTrendFunctionAsString)(trendFunction.field, trendParameter.column);
  apiPayload.trendType = (eventView === null || eventView === void 0 ? void 0 : eventView.trendType) || props.trendChangeType;
  apiPayload.interval = eventView === null || eventView === void 0 ? void 0 : eventView.interval;
  apiPayload.middle = eventView === null || eventView === void 0 ? void 0 : eventView.middle;
  return apiPayload;
}

function TrendsDiscoverQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    route: "events-trends-stats",
    getRequestPayload: getTrendsRequestPayload,
    children: _ref => {
      let {
        tableData,
        ...rest
      } = _ref;
      return props.children({
        trendsData: tableData,
        ...rest
      });
    }
  });
}

TrendsDiscoverQuery.displayName = "TrendsDiscoverQuery";

function EventsDiscoverQuery(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    route: "events-trends",
    getRequestPayload: getTrendsRequestPayload,
    children: _ref2 => {
      let {
        tableData,
        ...rest
      } = _ref2;
      return props.children({
        trendsData: tableData,
        ...rest
      });
    }
  });
}

EventsDiscoverQuery.displayName = "EventsDiscoverQuery";
const TrendsEventsDiscoverQuery = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_2__["default"])(EventsDiscoverQuery));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_1__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_2__["default"])(TrendsDiscoverQuery)));

/***/ }),

/***/ "./app/views/performance/charts/chart.tsx":
/*!************************************************!*\
  !*** ./app/views/performance/charts/chart.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/max */ "../node_modules/lodash/max.js");
/* harmony import */ var lodash_max__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_max__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_min__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/min */ "../node_modules/lodash/min.js");
/* harmony import */ var lodash_min__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_min__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










// adapted from https://stackoverflow.com/questions/11397239/rounding-up-for-a-graph-maximum
function computeAxisMax(data) {
  // assumes min is 0
  const valuesDict = data.map(value => value.data.map(point => point.value));
  const maxValue = lodash_max__WEBPACK_IMPORTED_MODULE_0___default()(valuesDict.map((lodash_max__WEBPACK_IMPORTED_MODULE_0___default())));

  if (maxValue <= 1) {
    return 1;
  }

  const power = Math.log10(maxValue);
  const magnitude = lodash_min__WEBPACK_IMPORTED_MODULE_1___default()([lodash_max__WEBPACK_IMPORTED_MODULE_0___default()([10 ** (power - Math.floor(power)), 0]), 10]);
  let scale;

  if (magnitude <= 2.5) {
    scale = 0.2;
  } else if (magnitude <= 5) {
    scale = 0.5;
  } else if (magnitude <= 7.5) {
    scale = 1.0;
  } else {
    scale = 2.0;
  }

  const step = 10 ** Math.floor(power) * scale;
  return Math.round(Math.ceil(maxValue / step) * step);
}

function Chart(_ref) {
  let {
    data,
    previousData,
    router,
    statsPeriod,
    start,
    end,
    utc,
    loading,
    height,
    grid,
    disableMultiAxis,
    disableXAxis,
    definedAxisTicks,
    chartColors,
    isLineChart
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_7__.a)();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors !== null && chartColors !== void 0 ? chartColors : theme.charts.getColorPalette(4);
  const durationOnly = data.every(value => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(value.seriesName) === 'duration');
  const dataMax = durationOnly ? computeAxisMax(data) : undefined;
  const xAxes = disableMultiAxis ? undefined : [{
    gridIndex: 0,
    type: 'time'
  }, {
    gridIndex: 1,
    type: 'time'
  }];
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.getDurationUnit)(data);
  const yAxes = disableMultiAxis ? [{
    minInterval: durationUnit,
    splitNumber: definedAxisTicks,
    axisLabel: {
      color: theme.chartLabel,

      formatter(value) {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(data[0].seriesName), undefined, durationUnit);
      }

    }
  }] : [{
    gridIndex: 0,
    scale: true,
    minInterval: durationUnit,
    max: dataMax,
    axisLabel: {
      color: theme.chartLabel,

      formatter(value) {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(data[0].seriesName), undefined, durationUnit);
      }

    }
  }, {
    gridIndex: 1,
    scale: true,
    max: dataMax,
    minInterval: durationUnit,
    axisLabel: {
      color: theme.chartLabel,

      formatter(value) {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(data[1].seriesName), undefined, durationUnit);
      }

    }
  }];
  const axisPointer = disableMultiAxis ? undefined : {
    // Link the two series x-axis together.
    link: [{
      xAxisIndex: [0, 1]
    }]
  };
  const areaChartProps = {
    seriesOptions: {
      showSymbol: false
    },
    grid: disableMultiAxis ? grid : [{
      top: '8px',
      left: '24px',
      right: '52%',
      bottom: '16px'
    }, {
      top: '8px',
      left: '52%',
      right: '24px',
      bottom: '16px'
    }],
    axisPointer,
    xAxes,
    yAxes,
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[0], colors[1]],
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_5__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_6__.aggregateOutputType)(data && data.length ? data[0].seriesName : seriesName));
      },

      nameFormatter(value) {
        return value === 'epm()' ? 'tpm()' : value;
      }

    }
  };

  if (loading) {
    if (isLineChart) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_4__.LineChart, {
        height: height,
        series: [],
        ...areaChartProps
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_2__.AreaChart, {
      height: height,
      series: [],
      ...areaChartProps
    });
  }

  const series = data.map((values, i) => ({ ...values,
    yAxisIndex: i,
    xAxisIndex: i
  }));
  const xAxis = disableXAxis ? {
    show: false,
    axisLabel: {
      show: true,
      margin: 0
    },
    axisLine: {
      show: false
    }
  } : undefined;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_3__["default"], {
    router: router,
    period: statsPeriod,
    start: start,
    end: end,
    utc: utc,
    xAxisIndex: disableMultiAxis ? undefined : [0, 1],
    children: zoomRenderProps => {
      if (isLineChart) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_4__.LineChart, {
          height: height,
          ...zoomRenderProps,
          series: series,
          previousPeriod: previousData,
          xAxis: xAxis,
          yAxis: areaChartProps.yAxes[0],
          tooltip: areaChartProps.tooltip
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_2__.AreaChart, {
        height: height,
        ...zoomRenderProps,
        series: series,
        previousPeriod: previousData,
        xAxis: xAxis,
        ...areaChartProps
      });
    }
  });
}

Chart.displayName = "Chart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Chart);

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformDiscoverToSingleValue.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformDiscoverToSingleValue.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformDiscoverToSingleValue": () => (/* binding */ transformDiscoverToSingleValue)
/* harmony export */ });
function transformDiscoverToSingleValue(_widgetProps, results, _) {
  var _results$tableData, _results$tableData$da;

  const data = (_results$tableData = results.tableData) === null || _results$tableData === void 0 ? void 0 : (_results$tableData$da = _results$tableData.data) === null || _results$tableData$da === void 0 ? void 0 : _results$tableData$da[0]; // The discover query is not aggregated on any field, therefore there is only one element in the table

  return {
    isLoading: results.isLoading,
    isErrored: !!results.error,
    hasData: !!data,
    ...data
  };
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/transforms/transformEventsToArea.tsx":
/*!************************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/transforms/transformEventsToArea.tsx ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformEventsRequestToArea": () => (/* binding */ transformEventsRequestToArea)
/* harmony export */ });
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");


function transformEventsRequestToArea(widgetProps, results, _) {
  var _results$timeseriesDa, _results$previousTime;

  const {
    start,
    end,
    utc,
    interval,
    statsPeriod
  } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_0__.normalizeDateTimeParams)(widgetProps.location.query);
  const data = (_results$timeseriesDa = results.timeseriesData) !== null && _results$timeseriesDa !== void 0 ? _results$timeseriesDa : [];
  const childData = { ...results,
    isLoading: results.loading || results.reloading,
    isErrored: results.errored,
    hasData: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_1__.defined)(data) && !!data.length && !!data[0].data.length,
    data,
    previousData: (_results$previousTime = results.previousTimeseriesData) !== null && _results$previousTime !== void 0 ? _results$previousTime : undefined,
    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start !== null && start !== void 0 ? start : '',
    end: end !== null && end !== void 0 ? end : ''
  };
  return childData;
}

/***/ }),

/***/ "./app/views/performance/landing/widgets/widgets/singleFieldAreaWidget.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/landing/widgets/widgets/singleFieldAreaWidget.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DurationChart": () => (/* binding */ DurationChart),
/* harmony export */   "HighlightNumber": () => (/* binding */ HighlightNumber),
/* harmony export */   "SingleFieldAreaWidget": () => (/* binding */ SingleFieldAreaWidget),
/* harmony export */   "Subtitle": () => (/* binding */ Subtitle)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/discoverQuery */ "./app/utils/discover/discoverQuery.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_contexts_genericQueryBatcher__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/performance/contexts/genericQueryBatcher */ "./app/utils/performance/contexts/genericQueryBatcher.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/performance/contexts/pageError */ "./app/utils/performance/contexts/pageError.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_performance_charts_chart__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/performance/charts/chart */ "./app/views/performance/charts/chart.tsx");
/* harmony import */ var _components_performanceWidget__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../components/performanceWidget */ "./app/views/performance/landing/widgets/components/performanceWidget.tsx");
/* harmony import */ var _transforms_transformDiscoverToSingleValue__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../transforms/transformDiscoverToSingleValue */ "./app/views/performance/landing/widgets/transforms/transformDiscoverToSingleValue.tsx");
/* harmony import */ var _transforms_transformEventsToArea__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../transforms/transformEventsToArea */ "./app/views/performance/landing/widgets/transforms/transformEventsToArea.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // eslint-disable-next-line no-restricted-imports




















function SingleFieldAreaWidget(props) {
  const {
    ContainerActions
  } = props;
  const globalSelection = props.eventView.getPageFilters();
  const pageError = (0,sentry_utils_performance_contexts_pageError__WEBPACK_IMPORTED_MODULE_13__.usePageError)();
  const mepSetting = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_12__.useMEPSettingContext)();

  if (props.fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${props.fields})`);
  }

  const field = props.fields[0];
  const chartQuery = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => ({
    fields: props.fields[0],
    component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_performance_contexts_genericQueryBatcher__WEBPACK_IMPORTED_MODULE_11__.QueryBatchNode, {
      batchProperty: "yAxis",
      transform: unmergeIntoIndividualResults,
      children: _ref => {
        let {
          queryBatching
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(EventsRequest, { ...lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(provided, _utils__WEBPACK_IMPORTED_MODULE_19__.eventsRequestQueryProps),
          limit: 1,
          queryBatching: queryBatching,
          includePrevious: true,
          includeTransformedData: true,
          partial: true,
          currentSeriesNames: [field],
          previousSeriesNames: [(0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__.getPreviousSeriesName)(field)],
          query: provided.eventView.getQueryWithAdditionalConditions(),
          interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_6__.getInterval)({
            start: provided.start,
            end: provided.end,
            period: provided.period
          }, 'medium'),
          hideError: true,
          onError: pageError.setPageError,
          queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_19__.getMEPQueryParams)(mepSetting)
        });
      }
    }),
    transform: _transforms_transformEventsToArea__WEBPACK_IMPORTED_MODULE_18__.transformEventsRequestToArea
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [props.chartSetting, mepSetting.memoizationKey]);
  const overallQuery = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => ({
    fields: field,
    component: provided => {
      const eventView = provided.eventView.clone();
      eventView.sorts = [];
      eventView.fields = props.fields.map(fieldName => ({
        field: fieldName
      }));
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_performance_contexts_genericQueryBatcher__WEBPACK_IMPORTED_MODULE_11__.QueryBatchNode, {
        batchProperty: "field",
        children: _ref2 => {
          let {
            queryBatching
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_utils_discover_discoverQuery__WEBPACK_IMPORTED_MODULE_9__["default"], { ...provided,
            queryBatching: queryBatching,
            eventView: eventView,
            location: props.location,
            queryExtras: (0,_utils__WEBPACK_IMPORTED_MODULE_19__.getMEPQueryParams)(mepSetting),
            useEvents: true
          });
        }
      });
    },
    transform: _transforms_transformDiscoverToSingleValue__WEBPACK_IMPORTED_MODULE_17__.transformDiscoverToSingleValue
  }), // eslint-disable-next-line react-hooks/exhaustive-deps
  [props.chartSetting, mepSetting.memoizationKey]);
  const Queries = {
    chart: chartQuery,
    overall: overallQuery
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(_components_performanceWidget__WEBPACK_IMPORTED_MODULE_16__.GenericPerformanceWidget, { ...props,
    Subtitle: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Subtitle, {
      children: globalSelection.datetime.period ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Compared to last %s ', globalSelection.datetime.period) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Compared to the last period')
    }),
    HeaderActions: provided => {
      var _provided$widgetData, _provided$widgetData$;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(_provided$widgetData = provided.widgetData) !== null && _provided$widgetData !== void 0 && (_provided$widgetData$ = _provided$widgetData.overall) !== null && _provided$widgetData$ !== void 0 && _provided$widgetData$.hasData ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
          children: props.fields.map(fieldName => {
            var _provided$widgetData2, _provided$widgetData3;

            const value = (_provided$widgetData2 = provided.widgetData) === null || _provided$widgetData2 === void 0 ? void 0 : (_provided$widgetData3 = _provided$widgetData2.overall) === null || _provided$widgetData3 === void 0 ? void 0 : _provided$widgetData3[fieldName];

            if (!value) {
              return null;
            }

            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(HighlightNumber, {
              color: props.chartColor,
              children: (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_8__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.aggregateOutputType)(fieldName))
            }, fieldName);
          })
        }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ContainerActions, { ...provided.widgetData.chart
        })]
      });
    },
    Queries: Queries,
    Visualizations: [{
      component: provided => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(DurationChart, { ...provided.widgetData.chart,
        ...provided,
        disableMultiAxis: true,
        disableXAxis: true,
        definedAxisTicks: 4,
        chartColors: props.chartColor ? [props.chartColor] : undefined
      }),
      height: props.chartHeight
    }]
  });
}
SingleFieldAreaWidget.displayName = "SingleFieldAreaWidget";
const EventsRequest = (0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_14__["default"])(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_5__["default"]);
const DurationChart = (0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(sentry_views_performance_charts_chart__WEBPACK_IMPORTED_MODULE_15__["default"]);
const Subtitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eou5xbm1"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));
const HighlightNumber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eou5xbm0"
} : 0)("color:", p => p.color, ";font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

const unmergeIntoIndividualResults = (response, queryDefinition) => {
  const propertyName = Array.isArray(queryDefinition.requestQueryObject.query[queryDefinition.batchProperty]) ? queryDefinition.requestQueryObject.query[queryDefinition.batchProperty][0] : queryDefinition.requestQueryObject.query[queryDefinition.batchProperty];
  return response[propertyName];
};

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/charts.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/charts.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DisplayModes": () => (/* binding */ DisplayModes),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/optionSelector */ "./app/components/charts/optionSelector.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/performance/histogram */ "./app/utils/performance/histogram/index.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_releases_detail_overview__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/releases/detail/overview */ "./app/views/releases/detail/overview/index.tsx");
/* harmony import */ var _trends_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../../trends/types */ "./app/views/performance/trends/types.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../../trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _latencyChart_chartControls__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./latencyChart/chartControls */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/chartControls.tsx");
/* harmony import */ var _latencyChart_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./latencyChart/utils */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx");
/* harmony import */ var _durationChart__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./durationChart */ "./app/views/performance/transactionSummary/transactionOverview/durationChart/index.tsx");
/* harmony import */ var _durationPercentileChart__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./durationPercentileChart */ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/index.tsx");
/* harmony import */ var _latencyChart__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./latencyChart */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/index.tsx");
/* harmony import */ var _trendChart__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./trendChart */ "./app/views/performance/transactionSummary/transactionOverview/trendChart/index.tsx");
/* harmony import */ var _userMiseryChart__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./userMiseryChart */ "./app/views/performance/transactionSummary/transactionOverview/userMiseryChart/index.tsx");
/* harmony import */ var _vitalsChart__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./vitalsChart */ "./app/views/performance/transactionSummary/transactionOverview/vitalsChart/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
























let DisplayModes;

(function (DisplayModes) {
  DisplayModes["DURATION_PERCENTILE"] = "durationpercentile";
  DisplayModes["DURATION"] = "duration";
  DisplayModes["LATENCY"] = "latency";
  DisplayModes["TREND"] = "trend";
  DisplayModes["VITALS"] = "vitals";
  DisplayModes["USER_MISERY"] = "usermisery";
})(DisplayModes || (DisplayModes = {}));

function generateDisplayOptions(currentFilter) {
  if (currentFilter === _filter__WEBPACK_IMPORTED_MODULE_13__.SpanOperationBreakdownFilter.None) {
    return [{
      value: DisplayModes.DURATION,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Duration Breakdown')
    }, {
      value: DisplayModes.DURATION_PERCENTILE,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Duration Percentiles')
    }, {
      value: DisplayModes.LATENCY,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Duration Distribution')
    }, {
      value: DisplayModes.TREND,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Trends')
    }, {
      value: DisplayModes.VITALS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Web Vitals')
    }, {
      value: DisplayModes.USER_MISERY,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Misery')
    }];
  } // A span operation name breakdown has been chosen.


  return [{
    value: DisplayModes.DURATION,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Span Operation Breakdown')
  }, {
    value: DisplayModes.DURATION_PERCENTILE,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Span Operation Percentiles')
  }, {
    value: DisplayModes.LATENCY,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Span Operation Distribution')
  }, {
    value: DisplayModes.TREND,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Trends')
  }, {
    value: DisplayModes.VITALS,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Web Vitals')
  }];
}

const TREND_FUNCTIONS_OPTIONS = _trends_utils__WEBPACK_IMPORTED_MODULE_12__.TRENDS_FUNCTIONS.map(_ref => {
  let {
    field,
    label
  } = _ref;
  return {
    value: field,
    label
  };
});

function TransactionSummaryCharts(_ref2) {
  let {
    totalValues,
    eventView,
    organization,
    location,
    currentFilter,
    withoutZerofill
  } = _ref2;

  function handleDisplayChange(value) {
    const display = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.display, DisplayModes.DURATION);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_7__["default"])('performance_views.transaction_summary.change_chart_display', {
      organization,
      from_chart: display,
      to_chart: value
    });
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
      pathname: location.pathname,
      query: { ...(0,sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_8__.removeHistogramQueryStrings)(location, [_latencyChart_utils__WEBPACK_IMPORTED_MODULE_15__.ZOOM_START, _latencyChart_utils__WEBPACK_IMPORTED_MODULE_15__.ZOOM_END]),
        display: value
      }
    });
  }

  function handleTrendDisplayChange(value) {
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
      pathname: location.pathname,
      query: { ...location.query,
        trendFunction: value
      }
    });
  }

  function handleTrendColumnChange(value) {
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push({
      pathname: location.pathname,
      query: { ...location.query,
        trendColumn: value
      }
    });
  }

  const TREND_PARAMETERS_OPTIONS = _trends_utils__WEBPACK_IMPORTED_MODULE_12__.TRENDS_PARAMETERS.map(_ref3 => {
    let {
      column,
      label
    } = _ref3;
    return {
      value: column,
      label
    };
  });
  let display = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.display, DisplayModes.DURATION);
  let trendFunction = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.trendFunction, TREND_FUNCTIONS_OPTIONS[0].value);
  let trendColumn = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_9__.decodeScalar)(location.query.trendColumn, TREND_PARAMETERS_OPTIONS[0].value);

  if (!Object.values(DisplayModes).includes(display)) {
    display = DisplayModes.DURATION;
  }

  if (!Object.values(_trends_types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField).includes(trendFunction)) {
    trendFunction = _trends_types__WEBPACK_IMPORTED_MODULE_11__.TrendFunctionField.P50;
  }

  if (!Object.values(_trends_types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField).includes(trendColumn)) {
    trendColumn = _trends_types__WEBPACK_IMPORTED_MODULE_11__.TrendColumnField.DURATION;
  }

  const releaseQueryExtra = {
    yAxis: display === DisplayModes.VITALS ? 'countVital' : 'countDuration',
    showTransactions: display === DisplayModes.VITALS ? sentry_views_releases_detail_overview__WEBPACK_IMPORTED_MODULE_10__.TransactionsListOption.SLOW_LCP : display === DisplayModes.DURATION ? sentry_views_releases_detail_overview__WEBPACK_IMPORTED_MODULE_10__.TransactionsListOption.SLOW : undefined
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_4__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.ChartContainer, {
      children: [display === DisplayModes.LATENCY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_latencyChart__WEBPACK_IMPORTED_MODULE_18__["default"], {
        organization: organization,
        location: location,
        query: eventView.query,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        currentFilter: currentFilter
      }), display === DisplayModes.DURATION && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_durationChart__WEBPACK_IMPORTED_MODULE_16__["default"], {
        organization: organization,
        query: eventView.query,
        queryExtra: releaseQueryExtra,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        currentFilter: currentFilter,
        withoutZerofill: withoutZerofill
      }), display === DisplayModes.DURATION_PERCENTILE && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_durationPercentileChart__WEBPACK_IMPORTED_MODULE_17__["default"], {
        organization: organization,
        location: location,
        query: eventView.query,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        currentFilter: currentFilter
      }), display === DisplayModes.TREND && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_trendChart__WEBPACK_IMPORTED_MODULE_19__["default"], {
        trendFunction: trendFunction,
        trendParameter: trendColumn,
        organization: organization,
        query: eventView.query,
        queryExtra: releaseQueryExtra,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        withoutZerofill: withoutZerofill
      }), display === DisplayModes.VITALS && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_vitalsChart__WEBPACK_IMPORTED_MODULE_21__["default"], {
        organization: organization,
        query: eventView.query,
        queryExtra: releaseQueryExtra,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        withoutZerofill: withoutZerofill
      }), display === DisplayModes.USER_MISERY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_userMiseryChart__WEBPACK_IMPORTED_MODULE_20__["default"], {
        organization: organization,
        query: eventView.query,
        queryExtra: releaseQueryExtra,
        project: eventView.project,
        environment: eventView.environment,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        withoutZerofill: withoutZerofill
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.ChartControls, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.InlineContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Total Transactions')
        }, "total-heading"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.SectionValue, {
          children: totalValues === null ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_5__["default"], {
            height: "24px"
          }) : totalValues.toLocaleString()
        }, "total-value")]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.InlineContainer, {
        children: [display === DisplayModes.TREND && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_2__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Percentile'),
          selected: trendFunction,
          options: TREND_FUNCTIONS_OPTIONS,
          onChange: handleTrendDisplayChange
        }), display === DisplayModes.TREND && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_2__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Parameter'),
          selected: trendColumn,
          options: TREND_PARAMETERS_OPTIONS,
          onChange: handleTrendColumnChange
        }), display === DisplayModes.LATENCY && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(_latencyChart_chartControls__WEBPACK_IMPORTED_MODULE_14__["default"], {
          location: location
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_22__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_2__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Display'),
          selected: display,
          options: generateDisplayOptions(currentFilter),
          onChange: handleDisplayChange
        })]
      })]
    })]
  });
}

TransactionSummaryCharts.displayName = "TransactionSummaryCharts";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TransactionSummaryCharts);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationChart/content.tsx":
/*!************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationChart/content.tsx ***!
  \************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















function Content(_ref) {
  let {
    errored,
    theme,
    series: data,
    timeFrame,
    start,
    end,
    period,
    projects,
    environments,
    loading,
    reloading,
    legend,
    utc,
    queryExtra,
    router,
    onLegendSelectChanged
  } = _ref;

  if (errored) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_3__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconWarning, {
        color: "gray500",
        size: "lg"
      })
    });
  }

  const colors = data && theme.charts.getColorPalette(data.length - 2) || []; // Create a list of series based on the order of the fields,
  // We need to flip it at the end to ensure the series stack right.

  const series = data ? data.map((values, i) => {
    return { ...values,
      color: colors[i],
      lineStyle: {
        opacity: 0
      }
    };
  }).reverse() : [];
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.getDurationUnit)(series, legend);
  const chartOptions = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px'
    },
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.aggregateOutputType)(label))
    },
    xAxis: timeFrame ? {
      min: timeFrame.start,
      max: timeFrame.end
    } : undefined,
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: value => {
          return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.axisLabelFormatter)(value, 'duration', undefined, durationUnit);
        }
      }
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_2__["default"], {
    router: router,
    period: period,
    start: start,
    end: end,
    utc: utc,
    children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__["default"], {
      start: start,
      end: end,
      queryExtra: queryExtra,
      period: period,
      utc: utc,
      projects: projects,
      environments: environments,
      children: _ref2 => {
        let {
          releaseSeries
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          loading: loading,
          reloading: reloading,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__["default"], {
            visible: reloading
          }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_1__.AreaChart, { ...zoomRenderProps,
              ...chartOptions,
              legend: legend,
              onLegendSelectChanged: onLegendSelectChanged,
              series: [...series, ...releaseSeries]
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
              height: "200px",
              testId: "skeleton-ui"
            })
          })]
        });
      }
    })
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationChart/index.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationChart/index.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/durationChart/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
 // eslint-disable-next-line no-restricted-imports















var DurationFunctionField;
/**
 * Fetch and render a stacked area chart that shows duration percentiles over
 * the past 7 days
 */

(function (DurationFunctionField) {
  DurationFunctionField["P50"] = "p50";
  DurationFunctionField["P75"] = "p75";
  DurationFunctionField["P95"] = "p95";
  DurationFunctionField["P99"] = "p99";
  DurationFunctionField["p100"] = "p100";
})(DurationFunctionField || (DurationFunctionField = {}));

function DurationChart(_ref) {
  var _SPAN_OPERATION_BREAK;

  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    router,
    queryExtra,
    currentFilter,
    withoutZerofill,
    start: propsStart,
    end: propsEnd
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_12__.a)();

  function handleLegendSelectChanged(legendChange) {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const to = { ...location,
      query: { ...location.query,
        unselectedSeries: unselected
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push(to);
  }

  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsEnd) : null;
  const utc = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__.normalizeDateTimeParams)(location.query).utc === 'true';
  const period = statsPeriod;
  const legend = {
    right: 10,
    top: 5,
    selected: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getSeriesSelection)(location)
  };
  const datetimeSelection = {
    start,
    end,
    period
  };
  const contentCommonProps = {
    theme,
    router,
    start,
    end,
    utc,
    legend,
    queryExtra,
    period,
    projects: project,
    environments: environment,
    onLegendSelectChanged: handleLegendSelectChanged
  };
  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getInterval)(datetimeSelection, 'high')
  };
  const parameter = (_SPAN_OPERATION_BREAK = _filter__WEBPACK_IMPORTED_MODULE_10__.SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter]) !== null && _SPAN_OPERATION_BREAK !== void 0 ? _SPAN_OPERATION_BREAK : '';

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.HeaderTitleLegend, {
    children: [currentFilter === _filter__WEBPACK_IMPORTED_MODULE_10__.SpanOperationBreakdownFilter.None ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Duration Breakdown') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('Span Operation Breakdown - [operationName]', {
      operationName: currentFilter
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      size: "sm",
      position: "top",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`Duration Breakdown reflects transaction durations by percentile over time.`)
    })]
  });

  const yAxis = Object.values(DurationFunctionField).map(v => `${v}(${parameter})`);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__["default"], { ...requestCommonProps,
      organization: organization,
      showLoading: false,
      includePrevious: false,
      yAxis: yAxis,
      partial: true,
      withoutZerofill: withoutZerofill,
      referrer: "api.performance.transaction-summary.duration-chart",
      children: _ref2 => {
        let {
          results,
          errored,
          loading,
          reloading,
          timeframe: timeFrame
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_content__WEBPACK_IMPORTED_MODULE_11__["default"], {
          series: results,
          errored: errored,
          loading: loading,
          reloading: reloading,
          timeFrame: timeFrame,
          ...contentCommonProps
        });
      }
    })]
  });
}

DurationChart.displayName = "DurationChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(DurationChart));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/chart.tsx":
/*!********************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/chart.tsx ***!
  \********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function Chart(props) {
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_3__.a)();
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_1__.getDurationUnit)(props.series);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_0__.AreaChart, {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px'
    },
    xAxis: {
      type: 'category',
      truncate: true,
      axisLabel: {
        showMinLabel: true,
        showMaxLabel: true
      },
      axisTick: {
        interval: 0,
        alignWithLabel: true
      }
    },
    yAxis: {
      minInterval: durationUnit,
      type: 'value',
      axisLabel: {
        color: theme.chartLabel,
        // Use p50() to force time formatting.
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_1__.axisLabelFormatter)(value, 'duration', undefined, durationUnit)
      }
    },
    tooltip: {
      valueFormatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_2__.getDuration)(value / 1000, 2)
    },
    ...props
  });
}

Chart.displayName = "Chart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Chart);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/content.tsx":
/*!**********************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/content.tsx ***!
  \**********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _chart__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./chart */ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/chart.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class Content extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__["default"] {
  getEndpoints() {
    const {
      organization,
      query,
      start,
      end,
      statsPeriod,
      environment,
      project,
      fields,
      location
    } = this.props;
    const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields,
      orderby: '',
      projects: project,
      range: statsPeriod,
      query,
      environment,
      start,
      end
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.durationpercentilechart';
    const endpoint = organization.features.includes('performance-frontend-use-events-endpoint') ? `/organizations/${organization.slug}/events/` : `/organizations/${organization.slug}/eventsv2/`;
    return [['chartData', endpoint, {
      query: apiPayload
    }]];
  }

  componentDidUpdate(prevProps) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps) {
    if (this.state.loading) {
      return false;
    }

    return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_1___default()(lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(prevProps, _utils__WEBPACK_IMPORTED_MODULE_9__.QUERY_KEYS), lodash_pick__WEBPACK_IMPORTED_MODULE_2___default()(this.props, _utils__WEBPACK_IMPORTED_MODULE_9__.QUERY_KEYS));
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
      "data-test-id": "histogram-loading"
    });
  }

  renderError() {
    // Don't call super as we don't really need issues for this.
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconWarning, {
        color: "gray300",
        size: "lg"
      })
    });
  }

  renderBody() {
    const {
      currentFilter,
      organization
    } = this.props;
    const {
      chartData
    } = this.state;

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_7__.defined)(chartData)) {
      return null;
    }

    const colors = theme => currentFilter === _filter__WEBPACK_IMPORTED_MODULE_10__.SpanOperationBreakdownFilter.None ? theme.charts.getColorPalette(1) : [(0,_filter__WEBPACK_IMPORTED_MODULE_10__.filterToColor)(currentFilter)];

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_chart__WEBPACK_IMPORTED_MODULE_11__["default"], {
      series: (0,_utils__WEBPACK_IMPORTED_MODULE_12__.transformData)(chartData.data, !organization.features.includes('performance-frontend-use-events-endpoint')),
      colors: colors
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/index.tsx":
/*!********************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/index.tsx ***!
  \********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function DurationPercentileChart(_ref) {
  let {
    currentFilter,
    ...props
  } = _ref;

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.HeaderTitleLegend, {
    children: [currentFilter === _filter__WEBPACK_IMPORTED_MODULE_4__.SpanOperationBreakdownFilter.None ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Duration Percentiles') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Span Operation Percentiles - [operationName]', {
      operationName: currentFilter
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      position: "top",
      size: "sm",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`)
    })]
  });

  function generateFields() {
    if (currentFilter === _filter__WEBPACK_IMPORTED_MODULE_4__.SpanOperationBreakdownFilter.None) {
      return ['percentile(transaction.duration, 0.10)', 'percentile(transaction.duration, 0.25)', 'percentile(transaction.duration, 0.50)', 'percentile(transaction.duration, 0.75)', 'percentile(transaction.duration, 0.90)', 'percentile(transaction.duration, 0.95)', 'percentile(transaction.duration, 0.99)', 'percentile(transaction.duration, 0.995)', 'percentile(transaction.duration, 0.999)', 'p100()'];
    }

    const field = (0,_filter__WEBPACK_IMPORTED_MODULE_4__.filterToField)(currentFilter);
    return [`percentile(${field}, 0.10)`, `percentile(${field}, 0.25)`, `percentile(${field}, 0.50)`, `percentile(${field}, 0.75)`, `percentile(${field}, 0.90)`, `percentile(${field}, 0.95)`, `percentile(${field}, 0.99)`, `percentile(${field}, 0.995)`, `percentile(${field}, 0.999)`, `p100(${field})`];
  }

  const fields = generateFields();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_content__WEBPACK_IMPORTED_MODULE_5__["default"], { ...props,
      currentFilter: currentFilter,
      fields: fields
    })]
  });
}

DurationPercentileChart.displayName = "DurationPercentileChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DurationPercentileChart);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils.tsx":
/*!********************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils.tsx ***!
  \********************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformData": () => (/* binding */ transformData)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

const AGGREGATE_ALIAS_VALUE_EXTRACT_PATTERN = /(\d+)$/;
const FUNCTION_FIELD_VALUE_EXTRACT_PATTERN = /(\d+)\)$/;
/**
 * Convert a discover response into a barchart compatible series
 */

function transformData(data) {
  let useAggregateAlias = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  const extractedData = Object.keys(data[0]).map(key => {
    const nameMatch = (useAggregateAlias ? AGGREGATE_ALIAS_VALUE_EXTRACT_PATTERN : FUNCTION_FIELD_VALUE_EXTRACT_PATTERN).exec(key);

    if (!nameMatch) {
      return [-1, -1];
    }

    let nameValue = Number(nameMatch[1]);

    if (nameValue > 100) {
      nameValue /= 10;
    }

    return [nameValue, data[0][key]];
  }).filter(i => i[0] > 0);
  extractedData.sort((a, b) => {
    if (a[0] > b[0]) {
      return 1;
    }

    if (a[0] < b[0]) {
      return -1;
    }

    return 0;
  });
  return [{
    seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Duration'),
    data: extractedData.map(i => ({
      value: i[1],
      name: `${i[0].toLocaleString()}%`
    }))
  }];
}

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/chartControls.tsx":
/*!*****************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/latencyChart/chartControls.tsx ***!
  \*****************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/charts/optionSelector */ "./app/components/charts/optionSelector.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/histogram */ "./app/utils/performance/histogram/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function ChartControls(_ref) {
  let {
    location
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_2__["default"], {
    location: location,
    zoomKeys: [_utils__WEBPACK_IMPORTED_MODULE_3__.ZOOM_START, _utils__WEBPACK_IMPORTED_MODULE_3__.ZOOM_END],
    children: _ref2 => {
      let {
        filterOptions,
        handleFilterChange,
        activeFilter
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_charts_optionSelector__WEBPACK_IMPORTED_MODULE_0__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Outliers'),
        selected: activeFilter.value,
        options: filterOptions,
        onChange: handleFilterChange
      });
    }
  });
}

ChartControls.displayName = "ChartControls";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ChartControls);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/content.tsx":
/*!***********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/latencyChart/content.tsx ***!
  \***********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/barChartZoom */ "./app/components/charts/barChartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/performance/histogram */ "./app/utils/performance/histogram/index.tsx");
/* harmony import */ var sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/performance/histogram/histogramQuery */ "./app/utils/performance/histogram/histogramQuery.tsx");
/* harmony import */ var sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/performance/histogram/utils */ "./app/utils/performance/histogram/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./utils */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















const NUM_BUCKETS = 50;

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 50 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
function Content(_ref) {
  var _filterToField;

  let {
    organization,
    query,
    start,
    end,
    statsPeriod,
    environment,
    project,
    location,
    currentFilter
  } = _ref;
  const [zoomError, setZoomError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);

  function handleMouseOver() {
    // Hide the zoom error tooltip on the next hover.
    if (zoomError) {
      setZoomError(false);
    }
  }

  function renderChart(data) {
    const xAxis = {
      type: 'category',
      truncate: true,
      axisTick: {
        interval: 0,
        alignWithLabel: true
      }
    };
    const colors = currentFilter === _filter__WEBPACK_IMPORTED_MODULE_13__.SpanOperationBreakdownFilter.None ? [...sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].charts.getColorPalette(1)] : [(0,_filter__WEBPACK_IMPORTED_MODULE_13__.filterToColor)(currentFilter)]; // Use a custom tooltip formatter as we need to replace
    // the tooltip content entirely when zooming is no longer available.

    const tooltip = {
      formatter(series) {
        const seriesData = Array.isArray(series) ? series : [series];
        let contents = [];

        if (!zoomError) {
          // Replicate the necessary logic from sentry/components/charts/components/tooltip.jsx
          contents = seriesData.map(item => {
            const label = item.seriesName;
            const value = item.value[1].toLocaleString();
            return ['<div class="tooltip-series">', `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`, '</div>'].join('');
          });
          const seriesLabel = seriesData[0].value[0];
          contents.push(`<div class="tooltip-date">${seriesLabel}</div>`);
        } else {
          contents = ['<div class="tooltip-series tooltip-series-solo">', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Target zoom region too small'), '</div>'];
        }

        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      }

    };
    const series = {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Count'),
      data: (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_11__.formatHistogramData)(data, {
        type: 'duration'
      })
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_barChartZoom__WEBPACK_IMPORTED_MODULE_3__["default"], {
      minZoomWidth: NUM_BUCKETS,
      location: location,
      paramStart: _utils__WEBPACK_IMPORTED_MODULE_14__.ZOOM_START,
      paramEnd: _utils__WEBPACK_IMPORTED_MODULE_14__.ZOOM_END,
      xAxisIndex: [0],
      buckets: (0,sentry_utils_performance_histogram_utils__WEBPACK_IMPORTED_MODULE_11__.computeBuckets)(data),
      onDataZoomCancelled: () => setZoomError(true),
      children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_2__.BarChart, {
        grid: {
          left: '10px',
          right: '10px',
          top: '40px',
          bottom: '0px'
        },
        xAxis: xAxis,
        yAxis: {
          type: 'value'
        },
        series: [series],
        tooltip: tooltip,
        colors: colors,
        onMouseOver: handleMouseOver,
        ...zoomRenderProps
      })
    });
  }

  const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_8__["default"].fromNewQueryWithLocation({
    id: undefined,
    version: 2,
    name: '',
    fields: ['transaction.duration'],
    projects: project,
    range: statsPeriod,
    query,
    environment,
    start,
    end
  }, location);
  const {
    min,
    max
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_14__.decodeHistogramZoom)(location);
  const field = (_filterToField = (0,_filter__WEBPACK_IMPORTED_MODULE_13__.filterToField)(currentFilter)) !== null && _filterToField !== void 0 ? _filterToField : 'transaction.duration';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_utils_performance_histogram__WEBPACK_IMPORTED_MODULE_9__["default"], {
    location: location,
    zoomKeys: [_utils__WEBPACK_IMPORTED_MODULE_14__.ZOOM_START, _utils__WEBPACK_IMPORTED_MODULE_14__.ZOOM_END],
    children: _ref2 => {
      let {
        activeFilter
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_utils_performance_histogram_histogramQuery__WEBPACK_IMPORTED_MODULE_10__["default"], {
        location: location,
        orgSlug: organization.slug,
        eventView: eventView,
        numBuckets: NUM_BUCKETS,
        fields: [field],
        min: min,
        max: max,
        dataFilter: activeFilter.value,
        children: _ref3 => {
          var _histograms$field;

          let {
            histograms,
            isLoading,
            error
          } = _ref3;

          if (isLoading) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
              "data-test-id": "histogram-loading"
            });
          }

          if (error) {
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_4__["default"], {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconWarning, {
                color: "gray300",
                size: "lg"
              })
            });
          }

          return renderChart((_histograms$field = histograms === null || histograms === void 0 ? void 0 : histograms[field]) !== null && _histograms$field !== void 0 ? _histograms$field : []);
        }
      });
    }
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/index.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/latencyChart/index.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _filter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../filter */ "./app/views/performance/transactionSummary/filter.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/latencyChart/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function LatencyChart(_ref) {
  let {
    currentFilter,
    ...props
  } = _ref;

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.HeaderTitleLegend, {
    children: [currentFilter === _filter__WEBPACK_IMPORTED_MODULE_4__.SpanOperationBreakdownFilter.None ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Duration Distribution') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.tct)('Span Operation Distribution - [operationName]', {
      operationName: currentFilter
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_2__["default"], {
      position: "top",
      size: "sm",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)(`Duration Distribution reflects the volume of transactions per median duration.`)
    })]
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_content__WEBPACK_IMPORTED_MODULE_5__["default"], { ...props,
      currentFilter: currentFilter
    })]
  });
}

LatencyChart.displayName = "LatencyChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LatencyChart);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/trendChart/content.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/trendChart/content.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../../../trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















function Content(_ref) {
  let {
    errored,
    theme,
    series: data,
    timeFrame,
    start,
    end,
    period,
    projects,
    environments,
    loading,
    reloading,
    legend,
    utc,
    queryExtra,
    router,
    onLegendSelectChanged
  } = _ref;

  if (errored) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconWarning, {
        color: "gray500",
        size: "lg"
      })
    });
  }

  const series = data ? data.map(values => {
    return { ...values,
      color: theme.purple300,
      lineStyle: {
        opacity: 0.75,
        width: 1
      }
    };
  }).reverse() : [];
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.getDurationUnit)(series, legend);
  const chartOptions = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px'
    },
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.tooltipFormatter)(value, 'duration')
    },
    xAxis: timeFrame ? {
      min: timeFrame.start,
      max: timeFrame.end
    } : undefined,
    yAxis: {
      min: 0,
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_10__.axisLabelFormatter)(value, 'duration', undefined, durationUnit)
      }
    }
  };
  const {
    smoothedResults
  } = (0,_trends_utils__WEBPACK_IMPORTED_MODULE_12__.transformEventStatsSmoothed)(data, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Smoothed'));
  const smoothedSeries = smoothedResults ? smoothedResults.map(values => {
    return { ...values,
      color: theme.purple300,
      lineStyle: {
        opacity: 1
      }
    };
  }) : [];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__["default"], {
    router: router,
    period: period,
    start: start,
    end: end,
    utc: utc,
    children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__["default"], {
      start: start,
      end: end,
      queryExtra: queryExtra,
      period: period,
      utc: utc,
      projects: projects,
      environments: environments,
      children: _ref2 => {
        let {
          releaseSeries
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          loading: loading,
          reloading: reloading,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__["default"], {
            visible: reloading
          }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__.LineChart, { ...zoomRenderProps,
              ...chartOptions,
              legend: legend,
              onLegendSelectChanged: onLegendSelectChanged,
              series: [...series, ...smoothedSeries, ...releaseSeries]
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
              height: "200px",
              testId: "skeleton-ui"
            })
          })]
        });
      }
    })
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/trendChart/index.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/trendChart/index.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _trends_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../../trends/utils */ "./app/views/performance/trends/utils.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/trendChart/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
 // eslint-disable-next-line no-restricted-imports
















function TrendChart(_ref) {
  var _normalizeDateTimePar;

  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    router,
    trendFunction,
    trendParameter,
    queryExtra,
    withoutZerofill,
    start: propsStart,
    end: propsEnd
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_9__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_12__.a)();

  function handleLegendSelectChanged(legendChange) {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const to = { ...location,
      query: { ...location.query,
        unselectedSeries: unselected
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push(to);
  }

  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsEnd) : null;
  const utc = ((_normalizeDateTimePar = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__.normalizeDateTimeParams)(location.query)) === null || _normalizeDateTimePar === void 0 ? void 0 : _normalizeDateTimePar.utc) === 'true';
  const period = statsPeriod;
  const legend = {
    right: 10,
    top: 0,
    selected: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getSeriesSelection)(location)
  };
  const datetimeSelection = {
    start,
    end,
    period
  };
  const contentCommonProps = {
    theme,
    router,
    start,
    end,
    utc,
    legend,
    queryExtra,
    period,
    projects: project,
    environments: environment,
    onLegendSelectChanged: handleLegendSelectChanged
  };
  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getInterval)(datetimeSelection, 'high')
  };

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.HeaderTitleLegend, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Trend'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      size: "sm",
      position: "top",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`Trends shows the smoothed value of an aggregate over time.`)
    })]
  });

  const trendDisplay = (0,_trends_utils__WEBPACK_IMPORTED_MODULE_10__.generateTrendFunctionAsString)(trendFunction, trendParameter);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__["default"], { ...requestCommonProps,
      organization: organization,
      showLoading: false,
      includePrevious: false,
      yAxis: trendDisplay,
      currentSeriesNames: [trendDisplay],
      partial: true,
      withoutZerofill: withoutZerofill,
      referrer: "api.performance.transaction-summary.trends-chart",
      children: _ref2 => {
        let {
          errored,
          loading,
          reloading,
          timeseriesData,
          timeframe: timeFrame
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_content__WEBPACK_IMPORTED_MODULE_11__["default"], {
          series: timeseriesData,
          errored: errored,
          loading: loading,
          reloading: reloading,
          timeFrame: timeFrame,
          ...contentCommonProps
        });
      }
    })]
  });
}

TrendChart.displayName = "TrendChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(TrendChart));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/userMiseryChart/index.tsx":
/*!************************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/userMiseryChart/index.tsx ***!
  \************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/performance/contexts/metricsEnhancedSetting */ "./app/utils/performance/contexts/metricsEnhancedSetting.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var sentry_views_performance_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/performance/landing/widgets/utils */ "./app/views/performance/landing/widgets/utils.tsx");
/* harmony import */ var sentry_views_performance_landing_widgets_widgets_singleFieldAreaWidget__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/performance/landing/widgets/widgets/singleFieldAreaWidget */ "./app/views/performance/landing/widgets/widgets/singleFieldAreaWidget.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
 // eslint-disable-next-line no-restricted-imports

















/**
 * Fetch and render an area chart that shows user misery over a period
 */
function UserMiseryChart(_ref) {
  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    withoutZerofill,
    start: propsStart,
    end: propsEnd
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const mepContext = (0,sentry_utils_performance_contexts_metricsEnhancedSetting__WEBPACK_IMPORTED_MODULE_9__.useMEPSettingContext)();
  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsEnd) : null;
  const utc = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__.normalizeDateTimeParams)(location.query).utc === 'true';
  const period = statsPeriod;
  const datetimeSelection = {
    start,
    end,
    period
  };
  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getInterval)(datetimeSelection, 'high')
  };

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.HeaderTitleLegend, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('User Misery'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      size: "sm",
      position: "top",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)((0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_11__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_11__.PERFORMANCE_TERM.USER_MISERY))
    })]
  });

  const yAxis = 'user_misery()';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__["default"], { ...requestCommonProps,
      organization: organization,
      showLoading: false,
      includePrevious: false,
      yAxis: yAxis,
      partial: true,
      withoutZerofill: withoutZerofill,
      referrer: "api.performance.transaction-summary.user-misery-chart",
      queryExtras: (0,sentry_views_performance_landing_widgets_utils__WEBPACK_IMPORTED_MODULE_12__.getMEPQueryParams)(mepContext),
      children: _ref2 => {
        let {
          loading,
          reloading,
          timeseriesData
        } = _ref2;
        const data = timeseriesData !== null && timeseriesData !== void 0 && timeseriesData[0] ? [{ ...timeseriesData[0],
          seriesName: yAxis
        }] : [];
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_views_performance_landing_widgets_widgets_singleFieldAreaWidget__WEBPACK_IMPORTED_MODULE_13__.DurationChart, {
          grid: {
            left: '10px',
            right: '10px',
            top: '40px',
            bottom: '0px'
          },
          data: data,
          statsPeriod: statsPeriod,
          loading: loading || reloading,
          disableMultiAxis: true,
          definedAxisTicks: 4,
          start: start,
          end: end,
          utc: utc
        });
      }
    })]
  });
}

UserMiseryChart.displayName = "UserMiseryChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(UserMiseryChart));

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/vitalsChart/content.tsx":
/*!**********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/vitalsChart/content.tsx ***!
  \**********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/releaseSeries */ "./app/components/charts/releaseSeries.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_views_releases_detail_overview__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/releases/detail/overview */ "./app/views/releases/detail/overview/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















function Content(_ref) {
  let {
    errored,
    theme,
    series: data,
    timeFrame,
    start,
    end,
    period,
    projects,
    environments,
    loading,
    reloading,
    legend,
    utc,
    queryExtra,
    router,
    onLegendSelectChanged
  } = _ref;

  if (errored) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_2__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconWarning, {
        color: "gray500",
        size: "lg"
      })
    });
  }

  const colors = data && theme.charts.getColorPalette(data.length - 2) || []; // Create a list of series based on the order of the fields,

  const series = data ? data.map((values, i) => ({ ...values,
    color: colors[i]
  })) : [];
  const durationUnit = (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.getDurationUnit)(series, legend);
  const chartOptions = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px'
    },
    seriesOptions: {
      showSymbol: false
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, label) => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.aggregateOutputType)(label))
    },
    xAxis: timeFrame ? {
      min: timeFrame.start,
      max: timeFrame.end
    } : undefined,
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        // p75(measurements.fcp) coerces the axis to be time based
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_9__.axisLabelFormatter)(value, 'duration', undefined, durationUnit)
      }
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_1__["default"], {
    router: router,
    period: period,
    start: start,
    end: end,
    utc: utc,
    children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_releaseSeries__WEBPACK_IMPORTED_MODULE_4__["default"], {
      start: start,
      end: end,
      queryExtra: { ...queryExtra,
        showTransactions: sentry_views_releases_detail_overview__WEBPACK_IMPORTED_MODULE_12__.TransactionsListOption.SLOW_LCP
      },
      period: period,
      utc: utc,
      projects: projects,
      environments: environments,
      children: _ref2 => {
        let {
          releaseSeries
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          loading: loading,
          reloading: reloading,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_6__["default"], {
            visible: reloading
          }), (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_11__["default"])({
            value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__.LineChart, { ...zoomRenderProps,
              ...chartOptions,
              legend: legend,
              onLegendSelectChanged: onLegendSelectChanged,
              series: [...series, ...releaseSeries]
            }),
            fixed: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_7__["default"], {
              height: "200px",
              testId: "skeleton-ui"
            })
          })]
        });
      }
    })
  });
}

Content.displayName = "Content";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Content);

/***/ }),

/***/ "./app/views/performance/transactionSummary/transactionOverview/vitalsChart/index.tsx":
/*!********************************************************************************************!*\
  !*** ./app/views/performance/transactionSummary/transactionOverview/vitalsChart/index.tsx ***!
  \********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionSummary/transactionOverview/vitalsChart/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
 // eslint-disable-next-line no-restricted-imports

















function VitalsChart(_ref) {
  let {
    project,
    environment,
    location,
    organization,
    query,
    statsPeriod,
    router,
    queryExtra,
    withoutZerofill,
    start: propsStart,
    end: propsEnd
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_13__.a)();

  const handleLegendSelectChanged = legendChange => {
    const {
      selected
    } = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);
    const to = { ...location,
      query: { ...location.query,
        unselectedSeries: unselected
      }
    };
    react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push(to);
  };

  const vitals = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.FCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.LCP, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.FID, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_10__.WebVital.CLS];
  const start = propsStart ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsStart) : null;
  const end = propsEnd ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_8__.getUtcToLocalDateObject)(propsEnd) : null;
  const utc = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_5__.normalizeDateTimeParams)(location.query).utc === 'true';
  const period = statsPeriod;
  const legend = {
    right: 10,
    top: 0,
    selected: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getSeriesSelection)(location),
    formatter: seriesName => {
      const arg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.getAggregateArg)(seriesName);

      if (arg !== null) {
        const slug = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_9__.getMeasurementSlug)(arg);

        if (slug !== null) {
          seriesName = slug.toUpperCase();
        }
      }

      return seriesName;
    }
  };
  const datetimeSelection = {
    start,
    end,
    period
  };
  const contentCommonProps = {
    theme,
    router,
    start,
    end,
    utc,
    legend,
    queryExtra,
    period,
    projects: project,
    environments: environment,
    onLegendSelectChanged: handleLegendSelectChanged
  };
  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_4__.getInterval)(datetimeSelection, 'high')
  };

  const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_3__.HeaderTitleLegend, {
    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Web Vitals Breakdown'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
      size: "sm",
      position: "top",
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(`Web Vitals Breakdown reflects the 75th percentile of web vitals over time.`)
    })]
  });

  const yAxis = vitals.map(v => `p75(${v})`);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [header, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_2__["default"], { ...requestCommonProps,
      organization: organization,
      showLoading: false,
      includePrevious: false,
      yAxis: yAxis,
      partial: true,
      withoutZerofill: withoutZerofill,
      referrer: "api.performance.transaction-summary.vitals-chart",
      children: _ref2 => {
        let {
          results,
          errored,
          loading,
          reloading,
          timeframe: timeFrame
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_content__WEBPACK_IMPORTED_MODULE_12__["default"], {
          series: results,
          errored: errored,
          loading: loading,
          reloading: reloading,
          timeFrame: timeFrame,
          ...contentCommonProps
        });
      }
    })]
  });
}

VitalsChart.displayName = "VitalsChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_1__.withRouter)(VitalsChart));

/***/ }),

/***/ "./app/views/releases/detail/commitsAndFiles/emptyState.tsx":
/*!******************************************************************!*\
  !*** ./app/views/releases/detail/commitsAndFiles/emptyState.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const EmptyState = _ref => {
  let {
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_0__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("p", {
          children: children
        })
      })
    })
  });
};

EmptyState.displayName = "EmptyState";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EmptyState);

/***/ }),

/***/ "./app/views/releases/detail/overview/index.tsx":
/*!******************************************************!*\
  !*** ./app/views/releases/detail/overview/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TransactionsListOption": () => (/* binding */ TransactionsListOption),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/release */ "./app/actionCreators/release.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/sessionsRequest */ "./app/components/charts/sessionsRequest.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_discover_performanceCardTable__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/discover/performanceCardTable */ "./app/components/discover/performanceCardTable.tsx");
/* harmony import */ var sentry_components_discover_transactionsList__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/discover/transactionsList */ "./app/components/discover/transactionsList.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/pageTimeRangeSelector */ "./app/components/pageTimeRangeSelector.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/routeTitle */ "./app/utils/routeTitle.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/transactionOverview/charts */ "./app/views/performance/transactionSummary/transactionOverview/charts.tsx");
/* harmony import */ var sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/performance/transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var sentry_views_performance_trends_types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/performance/trends/types */ "./app/views/performance/trends/types.tsx");
/* harmony import */ var sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/performance/utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! .. */ "./app/views/releases/detail/index.tsx");
/* harmony import */ var _sidebar_commitAuthorBreakdown__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./sidebar/commitAuthorBreakdown */ "./app/views/releases/detail/overview/sidebar/commitAuthorBreakdown.tsx");
/* harmony import */ var _sidebar_deploys__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./sidebar/deploys */ "./app/views/releases/detail/overview/sidebar/deploys.tsx");
/* harmony import */ var _sidebar_otherProjects__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./sidebar/otherProjects */ "./app/views/releases/detail/overview/sidebar/otherProjects.tsx");
/* harmony import */ var _sidebar_projectReleaseDetails__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! ./sidebar/projectReleaseDetails */ "./app/views/releases/detail/overview/sidebar/projectReleaseDetails.tsx");
/* harmony import */ var _sidebar_releaseAdoption__WEBPACK_IMPORTED_MODULE_42__ = __webpack_require__(/*! ./sidebar/releaseAdoption */ "./app/views/releases/detail/overview/sidebar/releaseAdoption.tsx");
/* harmony import */ var _sidebar_releaseStats__WEBPACK_IMPORTED_MODULE_43__ = __webpack_require__(/*! ./sidebar/releaseStats */ "./app/views/releases/detail/overview/sidebar/releaseStats.tsx");
/* harmony import */ var _sidebar_totalCrashFreeUsers__WEBPACK_IMPORTED_MODULE_44__ = __webpack_require__(/*! ./sidebar/totalCrashFreeUsers */ "./app/views/releases/detail/overview/sidebar/totalCrashFreeUsers.tsx");
/* harmony import */ var _releaseArchivedNotice__WEBPACK_IMPORTED_MODULE_45__ = __webpack_require__(/*! ./releaseArchivedNotice */ "./app/views/releases/detail/overview/releaseArchivedNotice.tsx");
/* harmony import */ var _releaseComparisonChart__WEBPACK_IMPORTED_MODULE_46__ = __webpack_require__(/*! ./releaseComparisonChart */ "./app/views/releases/detail/overview/releaseComparisonChart/index.tsx");
/* harmony import */ var _releaseIssues__WEBPACK_IMPORTED_MODULE_47__ = __webpack_require__(/*! ./releaseIssues */ "./app/views/releases/detail/overview/releaseIssues.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















































const RELEASE_PERIOD_KEY = 'release';
let TransactionsListOption;

(function (TransactionsListOption) {
  TransactionsListOption["FAILURE_COUNT"] = "failure_count";
  TransactionsListOption["TPM"] = "tpm";
  TransactionsListOption["SLOW"] = "slow";
  TransactionsListOption["SLOW_LCP"] = "slow_lcp";
  TransactionsListOption["REGRESSION"] = "regression";
  TransactionsListOption["IMPROVEMENT"] = "improved";
})(TransactionsListOption || (TransactionsListOption = {}));

class ReleaseOverview extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_31__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleRestore", async (project, successCallback) => {
      const {
        params,
        organization
      } = this.props;

      try {
        await (0,sentry_actionCreators_release__WEBPACK_IMPORTED_MODULE_7__.restoreRelease)(new sentry_api__WEBPACK_IMPORTED_MODULE_8__.Client(), {
          orgSlug: organization.slug,
          projectSlug: project.slug,
          releaseVersion: params.release
        });
        successCallback();
      } catch {// do nothing, action creator is already displaying error message
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTransactionsListSortChange", value => {
      const {
        location
      } = this.props;
      const target = {
        pathname: location.pathname,
        query: { ...location.query,
          showTransactions: value,
          transactionCursor: undefined
        }
      };
      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(target);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDateChange", datetime => {
      const {
        router,
        location
      } = this.props;
      const {
        start,
        end,
        relative,
        utc
      } = datetime;

      if (start && end) {
        const parser = utc ? (moment__WEBPACK_IMPORTED_MODULE_6___default().utc) : (moment__WEBPACK_IMPORTED_MODULE_6___default());
        router.push({ ...location,
          query: { ...location.query,
            pageStatsPeriod: undefined,
            pageStart: parser(start).format(),
            pageEnd: parser(end).format(),
            pageUtc: utc !== null && utc !== void 0 ? utc : undefined
          }
        });
        return;
      }

      router.push({ ...location,
        query: { ...location.query,
          pageStatsPeriod: relative === RELEASE_PERIOD_KEY ? undefined : relative,
          pageStart: undefined,
          pageEnd: undefined,
          pageUtc: undefined
        }
      });
    });
  }

  getTitle() {
    const {
      params,
      organization
    } = this.props;
    return (0,sentry_utils_routeTitle__WEBPACK_IMPORTED_MODULE_27__["default"])((0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Release %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_25__.formatVersion)(params.release)), organization.slug, false);
  }

  getReleaseEventView(version, projectId, selectedSort, releaseBounds) {
    const {
      selection,
      location
    } = this.props;
    const {
      environments
    } = selection;
    const {
      start,
      end,
      statsPeriod
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getReleaseParams)({
      location,
      releaseBounds
    });
    const baseQuery = {
      id: undefined,
      version: 2,
      name: `Release ${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_25__.formatVersion)(version)}`,
      query: `event.type:transaction release:${version}`,
      fields: ['transaction', 'failure_count()', 'epm()', 'p50()'],
      orderby: '-failure_count',
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(start) : undefined,
      end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(end) : undefined
    };

    switch (selectedSort.value) {
      case TransactionsListOption.SLOW_LCP:
        return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
          query: `event.type:transaction release:${version} epm():>0.01 has:measurements.lcp`,
          fields: ['transaction', 'failure_count()', 'epm()', 'p75(measurements.lcp)'],
          orderby: 'p75_measurements_lcp'
        });

      case TransactionsListOption.SLOW:
        return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
          query: `event.type:transaction release:${version} epm():>0.01`
        });

      case TransactionsListOption.FAILURE_COUNT:
        return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
          query: `event.type:transaction release:${version} failure_count():>0`
        });

      default:
        return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery(baseQuery);
    }
  }

  getReleaseTrendView(version, projectId, versionDate, releaseBounds) {
    const {
      selection,
      location
    } = this.props;
    const {
      environments
    } = selection;
    const {
      start,
      end,
      statsPeriod
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getReleaseParams)({
      location,
      releaseBounds
    });
    const trendView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({
      id: undefined,
      version: 2,
      name: `Release ${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_25__.formatVersion)(version)}`,
      fields: ['transaction'],
      query: 'tpm():>0.01 trend_percentage():>0%',
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(start) : undefined,
      end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(end) : undefined
    });
    trendView.middle = versionDate;
    return trendView;
  }

  getReleasePerformanceEventView(performanceType, baseQuery) {
    const eventView = performanceType === sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_35__.PROJECT_PERFORMANCE_TYPE.FRONTEND ? sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
      fields: [...baseQuery.fields, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.WebVital.FCP})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.WebVital.FID})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.WebVital.LCP})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.WebVital.CLS})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.SpanOpBreakdown.SpansHttp})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.SpanOpBreakdown.SpansBrowser})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.SpanOpBreakdown.SpansResource})`]
    }) : performanceType === sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_35__.PROJECT_PERFORMANCE_TYPE.BACKEND ? sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
      fields: [...baseQuery.fields, 'apdex()', 'p75(spans.http)', 'p75(spans.db)']
    }) : performanceType === sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_35__.PROJECT_PERFORMANCE_TYPE.MOBILE ? sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery,
      fields: [...baseQuery.fields, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.MobileVital.AppStartCold})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.MobileVital.AppStartWarm})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.MobileVital.FramesSlow})`, `p75(${sentry_utils_fields__WEBPACK_IMPORTED_MODULE_24__.MobileVital.FramesFrozen})`]
    }) : sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_23__["default"].fromSavedQuery({ ...baseQuery
    });
    return eventView;
  }

  getAllReleasesPerformanceView(projectId, performanceType, releaseBounds) {
    const {
      selection,
      location
    } = this.props;
    const {
      environments
    } = selection;
    const {
      start,
      end,
      statsPeriod
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getReleaseParams)({
      location,
      releaseBounds
    });
    const baseQuery = {
      id: undefined,
      version: 2,
      name: 'All Releases',
      query: 'event.type:transaction',
      fields: ['user_misery()'],
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(start) : undefined,
      end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(end) : undefined
    };
    return this.getReleasePerformanceEventView(performanceType, baseQuery);
  }

  getReleasePerformanceView(version, projectId, performanceType, releaseBounds) {
    const {
      selection,
      location
    } = this.props;
    const {
      environments
    } = selection;
    const {
      start,
      end,
      statsPeriod
    } = (0,_utils__WEBPACK_IMPORTED_MODULE_36__.getReleaseParams)({
      location,
      releaseBounds
    });
    const baseQuery = {
      id: undefined,
      version: 2,
      name: `Release:${version}`,
      query: `event.type:transaction release:${version}`,
      fields: ['user_misery()'],
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(start) : undefined,
      end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(end) : undefined
    };
    return this.getReleasePerformanceEventView(performanceType, baseQuery);
  }

  get pageDateTime() {
    const query = this.props.location.query;
    const {
      start,
      end,
      statsPeriod
    } = (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_16__.normalizeDateTimeParams)(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true
    });

    if (statsPeriod) {
      return {
        period: statsPeriod
      };
    }

    if (start && end) {
      return {
        start: moment__WEBPACK_IMPORTED_MODULE_6___default().utc(start).format(),
        end: moment__WEBPACK_IMPORTED_MODULE_6___default().utc(end).format()
      };
    }

    return {};
  }

  render() {
    const {
      organization,
      selection,
      location,
      api
    } = this.props;
    const {
      start,
      end,
      period,
      utc
    } = this.pageDateTime;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(___WEBPACK_IMPORTED_MODULE_37__.ReleaseContext.Consumer, {
      children: _ref => {
        let {
          release,
          project,
          deploys,
          releaseMeta,
          refetchData,
          hasHealthData,
          releaseBounds
        } = _ref;
        const {
          commitCount,
          version
        } = release;
        const hasDiscover = organization.features.includes('discover-basic');
        const hasPerformance = organization.features.includes('performance-view');
        const hasReleaseComparisonPerformance = organization.features.includes('release-comparison-performance');
        const {
          environments
        } = selection;
        const performanceType = (0,sentry_views_performance_utils__WEBPACK_IMPORTED_MODULE_35__.platformToPerformanceType)([project], [project.id]);
        const {
          selectedSort,
          sortOptions
        } = getTransactionsListSort(location);
        const releaseEventView = this.getReleaseEventView(version, project.id, selectedSort, releaseBounds);
        const titles = selectedSort.value !== TransactionsListOption.SLOW_LCP ? [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('transaction'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('failure_count()'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('tpm()'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('p50()')] : [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('transaction'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('failure_count()'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('tpm()'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('p75(lcp)')];
        const releaseTrendView = this.getReleaseTrendView(version, project.id, releaseMeta.released, releaseBounds);
        const allReleasesPerformanceView = this.getAllReleasesPerformanceView(project.id, performanceType, releaseBounds);
        const releasePerformanceView = this.getReleasePerformanceView(version, project.id, performanceType, releaseBounds);
        const generateLink = {
          transaction: generateTransactionLink(version, project.id, selection, location.query.showTransactions)
        };
        const sessionsRequestProps = {
          api,
          organization,
          field: [sentry_types__WEBPACK_IMPORTED_MODULE_21__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_21__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_21__.SessionFieldWithOperation.DURATION],
          groupBy: ['session.status'],
          ...(0,_utils__WEBPACK_IMPORTED_MODULE_36__.getReleaseParams)({
            location,
            releaseBounds
          }),
          shouldFilterSessionsInTimeWindow: true
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_10__["default"], { ...sessionsRequestProps,
          children: _ref2 => {
            let {
              loading: allReleasesLoading,
              reloading: allReleasesReloading,
              errored: allReleasesErrored,
              response: allReleases
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_charts_sessionsRequest__WEBPACK_IMPORTED_MODULE_10__["default"], { ...sessionsRequestProps,
              query: `release:"${version}"`,
              children: _ref3 => {
                let {
                  loading: thisReleaseLoading,
                  reloading: thisReleaseReloading,
                  errored: thisReleaseErrored,
                  response: thisRelease
                } = _ref3;
                const loading = allReleasesLoading || thisReleaseLoading;
                const reloading = allReleasesReloading || thisReleaseReloading;
                const errored = allReleasesErrored || thisReleaseErrored;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Body, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Main, {
                    children: [(0,_utils__WEBPACK_IMPORTED_MODULE_36__.isReleaseArchived)(release) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_releaseArchivedNotice__WEBPACK_IMPORTED_MODULE_45__["default"], {
                      onRestore: () => this.handleRestore(project, refetchData)
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsxs)(ReleaseDetailsPageFilters, {
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_14__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(StyledPageTimeRangeSelector, {
                        organization: organization,
                        relative: period !== null && period !== void 0 ? period : '',
                        start: start !== null && start !== void 0 ? start : null,
                        end: end !== null && end !== void 0 ? end : null,
                        utc: utc !== null && utc !== void 0 ? utc : null,
                        onUpdate: this.handleDateChange,
                        relativeOptions: releaseBounds.type !== 'ancient' ? {
                          [RELEASE_PERIOD_KEY]: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                            children: [releaseBounds.type === 'clamped' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Clamped Release Period') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Entire Release Period'), ' ', "(", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_11__["default"], {
                              date: releaseBounds.releaseStart
                            }), " -", ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_11__["default"], {
                              date: releaseBounds.releaseEnd
                            }), ")"]
                          }),
                          ...sentry_constants__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_RELATIVE_PERIODS
                        } : sentry_constants__WEBPACK_IMPORTED_MODULE_18__.DEFAULT_RELATIVE_PERIODS,
                        defaultPeriod: releaseBounds.type !== 'ancient' ? RELEASE_PERIOD_KEY : '90d',
                        defaultAbsolute: {
                          start: moment__WEBPACK_IMPORTED_MODULE_6___default()(releaseBounds.releaseStart).subtract(1, 'hour').toDate(),
                          end: releaseBounds.releaseEnd ? moment__WEBPACK_IMPORTED_MODULE_6___default()(releaseBounds.releaseEnd).add(1, 'hour').toDate() : undefined
                        }
                      })]
                    }), (hasDiscover || hasPerformance || hasHealthData) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_releaseComparisonChart__WEBPACK_IMPORTED_MODULE_46__["default"], {
                      release: release,
                      releaseSessions: thisRelease,
                      allSessions: allReleases,
                      platform: project.platform,
                      location: location,
                      loading: loading,
                      reloading: reloading,
                      errored: errored,
                      project: project,
                      organization: organization,
                      api: api,
                      hasHealthData: hasHealthData
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_releaseIssues__WEBPACK_IMPORTED_MODULE_47__["default"], {
                      organization: organization,
                      selection: selection,
                      version: version,
                      location: location,
                      releaseBounds: releaseBounds,
                      queryFilterDescription: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('In this release'),
                      withChart: true
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_9__["default"], {
                      features: ['performance-view'],
                      children: hasReleaseComparisonPerformance ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_discover_performanceCardTable__WEBPACK_IMPORTED_MODULE_12__["default"], {
                        organization: organization,
                        project: project,
                        location: location,
                        allReleasesEventView: allReleasesPerformanceView,
                        releaseEventView: releasePerformanceView,
                        performanceType: performanceType
                      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(sentry_components_discover_transactionsList__WEBPACK_IMPORTED_MODULE_13__["default"], {
                        location: location,
                        organization: organization,
                        eventView: releaseEventView,
                        trendView: releaseTrendView,
                        selected: selectedSort,
                        options: sortOptions,
                        handleDropdownChange: this.handleTransactionsListSortChange,
                        titles: titles,
                        generateLink: generateLink
                      })
                    })]
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Side, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_releaseStats__WEBPACK_IMPORTED_MODULE_43__["default"], {
                      organization: organization,
                      release: release,
                      project: project
                    }), hasHealthData && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_releaseAdoption__WEBPACK_IMPORTED_MODULE_42__["default"], {
                      releaseSessions: thisRelease,
                      allSessions: allReleases,
                      loading: loading,
                      reloading: reloading,
                      errored: errored,
                      release: release,
                      project: project,
                      environment: environments
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_projectReleaseDetails__WEBPACK_IMPORTED_MODULE_41__["default"], {
                      release: release,
                      releaseMeta: releaseMeta,
                      orgSlug: organization.slug,
                      projectSlug: project.slug
                    }), commitCount > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_commitAuthorBreakdown__WEBPACK_IMPORTED_MODULE_38__["default"], {
                      version: version,
                      orgId: organization.slug,
                      projectSlug: project.slug
                    }), releaseMeta.projects.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_otherProjects__WEBPACK_IMPORTED_MODULE_40__["default"], {
                      projects: releaseMeta.projects.filter(p => p.slug !== project.slug),
                      location: location,
                      version: version,
                      organization: organization
                    }), hasHealthData && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_totalCrashFreeUsers__WEBPACK_IMPORTED_MODULE_44__["default"], {
                      organization: organization,
                      version: version,
                      projectSlug: project.slug,
                      location: location
                    }), deploys.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_48__.jsx)(_sidebar_deploys__WEBPACK_IMPORTED_MODULE_39__["default"], {
                      version: version,
                      orgSlug: organization.slug,
                      deploys: deploys,
                      projectId: project.id
                    })]
                  })]
                });
              }
            });
          }
        });
      }
    });
  }

}

ReleaseOverview.displayName = "ReleaseOverview";

function generateTransactionLink(version, projectId, selection, value) {
  return (organization, tableRow, _query) => {
    const {
      transaction
    } = tableRow;
    const trendTransaction = ['regression', 'improved'].includes(value);
    const {
      environments,
      datetime
    } = selection;
    const {
      start,
      end,
      period
    } = datetime;
    return (0,sentry_views_performance_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_33__.transactionSummaryRouteWithQuery)({
      orgSlug: organization.slug,
      transaction: transaction,
      query: {
        query: trendTransaction ? '' : `release:${version}`,
        environment: environments,
        start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(start) : undefined,
        end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_22__.getUtcDateString)(end) : undefined,
        statsPeriod: period
      },
      projectID: projectId.toString(),
      display: trendTransaction ? sentry_views_performance_transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_32__.DisplayModes.TREND : sentry_views_performance_transactionSummary_transactionOverview_charts__WEBPACK_IMPORTED_MODULE_32__.DisplayModes.DURATION
    });
  };
}

function getDropdownOptions() {
  return [{
    sort: {
      kind: 'desc',
      field: 'failure_count'
    },
    value: TransactionsListOption.FAILURE_COUNT,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Failing Transactions')
  }, {
    sort: {
      kind: 'desc',
      field: 'epm'
    },
    value: TransactionsListOption.TPM,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Frequent Transactions')
  }, {
    sort: {
      kind: 'desc',
      field: 'p50'
    },
    value: TransactionsListOption.SLOW,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Slow Transactions')
  }, {
    sort: {
      kind: 'desc',
      field: 'p75_measurements_lcp'
    },
    value: TransactionsListOption.SLOW_LCP,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Slow LCP')
  }, {
    sort: {
      kind: 'desc',
      field: 'trend_percentage()'
    },
    query: [['confidence()', '>6']],
    trendType: sentry_views_performance_trends_types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.REGRESSION,
    value: TransactionsListOption.REGRESSION,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Trending Regressions')
  }, {
    sort: {
      kind: 'asc',
      field: 'trend_percentage()'
    },
    query: [['confidence()', '>6']],
    trendType: sentry_views_performance_trends_types__WEBPACK_IMPORTED_MODULE_34__.TrendChangeType.IMPROVED,
    value: TransactionsListOption.IMPROVEMENT,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Trending Improvements')
  }];
}

function getTransactionsListSort(location) {
  const sortOptions = getDropdownOptions();
  const urlParam = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_26__.decodeScalar)(location.query.showTransactions, TransactionsListOption.FAILURE_COUNT);
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {
    selectedSort,
    sortOptions
  };
}

const ReleaseDetailsPageFilters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1yz478u1"
} : 0)("display:grid;grid-template-columns:minmax(0, max-content) 1fr;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";" + ( true ? "" : 0));

const StyledPageTimeRangeSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pageTimeRangeSelector__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "e1yz478u0"
} : 0)( true ? {
  name: "1k18kha",
  styles: "height:40px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_28__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_29__["default"])(ReleaseOverview))));

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseArchivedNotice.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseArchivedNotice.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function ReleaseArchivedNotice(_ref) {
  let {
    onRestore,
    multi
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_2__["default"], {
    type: "warning",
    children: [multi ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('These releases have been archived.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('This release has been archived.'), !multi && onRestore && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(UnarchiveButton, {
        size: "zero",
        priority: "link",
        onClick: onRestore,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Restore this release')
      })]
    })]
  });
}

ReleaseArchivedNotice.displayName = "ReleaseArchivedNotice";

const UnarchiveButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "ed64kpf0"
} : 0)("font-size:inherit;text-decoration:underline;&,&:hover,&:focus,&:active{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseArchivedNotice);

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseComparisonChart/index.tsx":
/*!*****************************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseComparisonChart/index.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _releaseComparisonChartRow__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./releaseComparisonChartRow */ "./app/views/releases/detail/overview/releaseComparisonChart/releaseComparisonChartRow.tsx");
/* harmony import */ var _releaseEventsChart__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./releaseEventsChart */ "./app/views/releases/detail/overview/releaseComparisonChart/releaseEventsChart.tsx");
/* harmony import */ var _releaseSessionsChart__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./releaseSessionsChart */ "./app/views/releases/detail/overview/releaseComparisonChart/releaseSessionsChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }































function ReleaseComparisonChart(_ref) {
  var _getSeriesAverage, _getSeriesAverage2;

  let {
    release,
    project,
    releaseSessions,
    allSessions,
    platform,
    location,
    loading,
    reloading,
    errored,
    api,
    organization,
    hasHealthData
  } = _ref;
  const [issuesTotals, setIssuesTotals] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [eventsTotals, setEventsTotals] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [eventsLoading, setEventsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const [expanded, setExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(new Set());
  const [isOtherExpanded, setIsOtherExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const charts = [];
  const additionalCharts = [];
  const hasDiscover = organization.features.includes('discover-basic') || organization.features.includes('performance-view');
  const hasPerformance = organization.features.includes('performance-view');
  const {
    statsPeriod: period,
    start,
    end,
    utc
  } = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => // Memoizing this so that it does not calculate different `end` for releases without events+sessions each rerender
  (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.getReleaseParams)({
    location,
    releaseBounds: (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.getReleaseBounds)(release)
  }), [release, location]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    const chartInUrl = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.chart);

    if ([sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.HEALTHY_SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ABNORMAL_SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERRORED_SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASHED_SESSIONS].includes(chartInUrl)) {
      setExpanded(e => new Set(e.add(sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS)));
    }

    if ([sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.HEALTHY_USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ABNORMAL_USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERRORED_USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASHED_USERS].includes(chartInUrl)) {
      setExpanded(e => new Set(e.add(sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_USERS)));
    }

    if ([sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.SESSION_COUNT, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.USER_COUNT, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERROR_COUNT, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.TRANSACTION_COUNT].includes(chartInUrl)) {
      setIsOtherExpanded(true);
    }
  }, [location.query.chart]);
  const fetchEventsTotals = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(async () => {
    const url = `/organizations/${organization.slug}/events/`;
    const commonQuery = {
      environment: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeList)(location.query.environment),
      project: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeList)(location.query.project),
      start,
      end,
      ...(period ? {
        statsPeriod: period
      } : {})
    };
    setEventsLoading(true);

    try {
      const [releaseTransactionTotals, allTransactionTotals, releaseErrorTotals, allErrorTotals] = await Promise.all([api.requestPromise(url, {
        query: {
          field: ['failure_rate()', 'count()'],
          query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_23__.MutableSearch(['event.type:transaction', `release:${release.version}`]).formatString(),
          ...commonQuery
        }
      }), api.requestPromise(url, {
        query: {
          field: ['failure_rate()', 'count()'],
          query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_23__.MutableSearch(['event.type:transaction']).formatString(),
          ...commonQuery
        }
      }), api.requestPromise(url, {
        query: {
          field: ['count()'],
          query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_23__.MutableSearch(['event.type:error', `release:${release.version}`]).formatString(),
          ...commonQuery
        }
      }), api.requestPromise(url, {
        query: {
          field: ['count()'],
          query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_23__.MutableSearch(['event.type:error']).formatString(),
          ...commonQuery
        }
      })]);
      setEventsTotals({
        allErrorCount: allErrorTotals.data[0]['count()'],
        releaseErrorCount: releaseErrorTotals.data[0]['count()'],
        allTransactionCount: allTransactionTotals.data[0]['count()'],
        releaseTransactionCount: releaseTransactionTotals.data[0]['count()'],
        releaseFailureRate: releaseTransactionTotals.data[0]['failure_rate()'],
        allFailureRate: allTransactionTotals.data[0]['failure_rate()']
      });
      setEventsLoading(false);
    } catch (err) {
      setEventsTotals(null);
      setEventsLoading(false);
      _sentry_react__WEBPACK_IMPORTED_MODULE_28__.captureException(err);
    }
  }, [api, end, location.query.environment, location.query.project, organization.slug, period, release.version, start]);
  const fetchIssuesTotals = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(async () => {
    const UNHANDLED_QUERY = `release:"${release.version}" error.handled:0`;
    const HANDLED_QUERY = `release:"${release.version}" error.handled:1`;

    try {
      var _response$HANDLED_QUE, _response$UNHANDLED_Q;

      const response = await api.requestPromise(`/organizations/${organization.slug}/issues-count/`, {
        query: {
          project: project.id,
          environment: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeList)(location.query.environment),
          start,
          end,
          ...(period ? {
            statsPeriod: period
          } : {}),
          query: [UNHANDLED_QUERY, HANDLED_QUERY]
        }
      });
      setIssuesTotals({
        handled: (_response$HANDLED_QUE = response[HANDLED_QUERY]) !== null && _response$HANDLED_QUE !== void 0 ? _response$HANDLED_QUE : 0,
        unhandled: (_response$UNHANDLED_Q = response[UNHANDLED_QUERY]) !== null && _response$UNHANDLED_Q !== void 0 ? _response$UNHANDLED_Q : 0
      });
    } catch (err) {
      setIssuesTotals(null);
      _sentry_react__WEBPACK_IMPORTED_MODULE_28__.captureException(err);
    }
  }, [api, end, location.query.environment, organization.slug, period, project.id, release.version, start]);
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (hasDiscover || hasPerformance) {
      fetchEventsTotals();
      fetchIssuesTotals();
    }
  }, [fetchEventsTotals, fetchIssuesTotals, hasDiscover, hasPerformance]);
  const releaseCrashFreeSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCrashFreeRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS);
  const allCrashFreeSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCrashFreeRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS);
  const diffCrashFreeSessions = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashFreeSessions) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashFreeSessions) ? releaseCrashFreeSessions - allCrashFreeSessions : null;
  const releaseHealthySessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.HEALTHY);
  const allHealthySessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.HEALTHY);
  const diffHealthySessions = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseHealthySessions) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allHealthySessions) ? releaseHealthySessions - allHealthySessions : null;
  const releaseAbnormalSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ABNORMAL);
  const allAbnormalSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ABNORMAL);
  const diffAbnormalSessions = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseAbnormalSessions) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allAbnormalSessions) ? releaseAbnormalSessions - allAbnormalSessions : null;
  const releaseErroredSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ERRORED);
  const allErroredSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ERRORED);
  const diffErroredSessions = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseErroredSessions) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allErroredSessions) ? releaseErroredSessions - allErroredSessions : null;
  const releaseCrashedSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.CRASHED);
  const allCrashedSessions = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.CRASHED);
  const diffCrashedSessions = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashedSessions) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashedSessions) ? releaseCrashedSessions - allCrashedSessions : null;
  const releaseCrashFreeUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCrashFreeRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);
  const allCrashFreeUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCrashFreeRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);
  const diffCrashFreeUsers = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashFreeUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashFreeUsers) ? releaseCrashFreeUsers - allCrashFreeUsers : null;
  const releaseHealthyUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.HEALTHY);
  const allHealthyUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.HEALTHY);
  const diffHealthyUsers = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseHealthyUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allHealthyUsers) ? releaseHealthyUsers - allHealthyUsers : null;
  const releaseAbnormalUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ABNORMAL);
  const allAbnormalUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ABNORMAL);
  const diffAbnormalUsers = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseAbnormalUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allAbnormalUsers) ? releaseAbnormalUsers - allAbnormalUsers : null;
  const releaseErroredUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ERRORED);
  const allErroredUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.ERRORED);
  const diffErroredUsers = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseErroredUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allErroredUsers) ? releaseErroredUsers - allErroredUsers : null;
  const releaseCrashedUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.CRASHED);
  const allCrashedUsers = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSessionStatusRate)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionStatus.CRASHED);
  const diffCrashedUsers = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashedUsers) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashedUsers) ? releaseCrashedUsers - allCrashedUsers : null;
  const releaseSessionsCount = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS);
  const allSessionsCount = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS);
  const releaseUsersCount = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);
  const allUsersCount = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);
  const sessionDurationTotal = (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.roundDuration)(((_getSeriesAverage = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSeriesAverage)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.DURATION)) !== null && _getSeriesAverage !== void 0 ? _getSeriesAverage : 0) / 1000);
  const allSessionDurationTotal = (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.roundDuration)(((_getSeriesAverage2 = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getSeriesAverage)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.DURATION)) !== null && _getSeriesAverage2 !== void 0 ? _getSeriesAverage2 : 0) / 1000);
  const diffFailure = eventsTotals !== null && eventsTotals !== void 0 && eventsTotals.releaseFailureRate && eventsTotals !== null && eventsTotals !== void 0 && eventsTotals.allFailureRate ? eventsTotals.releaseFailureRate - eventsTotals.allFailureRate : null;

  if (hasHealthData) {
    charts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS,
      role: 'parent',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashFreeSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseCrashFreeSessions) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashFreeSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allCrashFreeSessions) : null,
      diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffCrashFreeSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffCrashFreeSessions) : null,
      diffDirection: diffCrashFreeSessions ? diffCrashFreeSessions > 0 ? 'up' : 'down' : null,
      diffColor: diffCrashFreeSessions ? diffCrashFreeSessions > 0 ? 'green300' : 'red300' : null
    });

    if (expanded.has(sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS)) {
      charts.push({
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.HEALTHY_SESSIONS,
        role: 'children',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseHealthySessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseHealthySessions) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allHealthySessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allHealthySessions) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffHealthySessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffHealthySessions) : null,
        diffDirection: diffHealthySessions ? diffHealthySessions > 0 ? 'up' : 'down' : null,
        diffColor: diffHealthySessions ? diffHealthySessions > 0 ? 'green300' : 'red300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ABNORMAL_SESSIONS,
        role: 'children',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseAbnormalSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseAbnormalSessions) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allAbnormalSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allAbnormalSessions) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffAbnormalSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffAbnormalSessions) : null,
        diffDirection: diffAbnormalSessions ? diffAbnormalSessions > 0 ? 'up' : 'down' : null,
        diffColor: diffAbnormalSessions ? diffAbnormalSessions > 0 ? 'red300' : 'green300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERRORED_SESSIONS,
        role: 'children',
        drilldown: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(issuesTotals === null || issuesTotals === void 0 ? void 0 : issuesTotals.handled) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Open in Issues'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            to: (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.getReleaseHandledIssuesUrl)(organization.slug, project.id, release.version, {
              start,
              end,
              period: period !== null && period !== void 0 ? period : undefined
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('([count] handled [issues])', {
              count: issuesTotals !== null && issuesTotals !== void 0 && issuesTotals.handled ? issuesTotals.handled >= 100 ? '99+' : issuesTotals.handled : 0,
              issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tn)('issue', 'issues', issuesTotals === null || issuesTotals === void 0 ? void 0 : issuesTotals.handled)
            })
          })
        }) : null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseErroredSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseErroredSessions) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allErroredSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allErroredSessions) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffErroredSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffErroredSessions) : null,
        diffDirection: diffErroredSessions ? diffErroredSessions > 0 ? 'up' : 'down' : null,
        diffColor: diffErroredSessions ? diffErroredSessions > 0 ? 'red300' : 'green300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASHED_SESSIONS,
        role: 'default',
        drilldown: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(issuesTotals === null || issuesTotals === void 0 ? void 0 : issuesTotals.unhandled) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Open in Issues'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
            to: (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.getReleaseUnhandledIssuesUrl)(organization.slug, project.id, release.version, {
              start,
              end,
              period: period !== null && period !== void 0 ? period : undefined
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('([count] unhandled [issues])', {
              count: issuesTotals !== null && issuesTotals !== void 0 && issuesTotals.unhandled ? issuesTotals.unhandled >= 100 ? '99+' : issuesTotals.unhandled : 0,
              issues: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tn)('issue', 'issues', issuesTotals === null || issuesTotals === void 0 ? void 0 : issuesTotals.unhandled)
            })
          })
        }) : null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashedSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseCrashedSessions) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashedSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allCrashedSessions) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffCrashedSessions) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffCrashedSessions) : null,
        diffDirection: diffCrashedSessions ? diffCrashedSessions > 0 ? 'up' : 'down' : null,
        diffColor: diffCrashedSessions ? diffCrashedSessions > 0 ? 'red300' : 'green300' : null
      });
    }
  }

  const hasUsers = !!(0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_22__.getCount)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);

  if (hasHealthData && (hasUsers || loading)) {
    charts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_USERS,
      role: 'parent',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashFreeUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseCrashFreeUsers) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashFreeUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allCrashFreeUsers) : null,
      diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffCrashFreeUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffCrashFreeUsers) : null,
      diffDirection: diffCrashFreeUsers ? diffCrashFreeUsers > 0 ? 'up' : 'down' : null,
      diffColor: diffCrashFreeUsers ? diffCrashFreeUsers > 0 ? 'green300' : 'red300' : null
    });

    if (expanded.has(sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_USERS)) {
      charts.push({
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.HEALTHY_USERS,
        role: 'children',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseHealthyUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseHealthyUsers) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allHealthyUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allHealthyUsers) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffHealthyUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffHealthyUsers) : null,
        diffDirection: diffHealthyUsers ? diffHealthyUsers > 0 ? 'up' : 'down' : null,
        diffColor: diffHealthyUsers ? diffHealthyUsers > 0 ? 'green300' : 'red300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ABNORMAL_USERS,
        role: 'children',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseAbnormalUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseAbnormalUsers) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allAbnormalUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allAbnormalUsers) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffAbnormalUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffAbnormalUsers) : null,
        diffDirection: diffAbnormalUsers ? diffAbnormalUsers > 0 ? 'up' : 'down' : null,
        diffColor: diffAbnormalUsers ? diffAbnormalUsers > 0 ? 'red300' : 'green300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERRORED_USERS,
        role: 'children',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseErroredUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseErroredUsers) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allErroredUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allErroredUsers) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffErroredUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffErroredUsers) : null,
        diffDirection: diffErroredUsers ? diffErroredUsers > 0 ? 'up' : 'down' : null,
        diffColor: diffErroredUsers ? diffErroredUsers > 0 ? 'red300' : 'green300' : null
      }, {
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASHED_USERS,
        role: 'default',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseCrashedUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(releaseCrashedUsers) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allCrashedUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(allCrashedUsers) : null,
        diff: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffCrashedUsers) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displaySessionStatusPercent)(diffCrashedUsers) : null,
        diffDirection: diffCrashedUsers ? diffCrashedUsers > 0 ? 'up' : 'down' : null,
        diffColor: diffCrashedUsers ? diffCrashedUsers > 0 ? 'red300' : 'green300' : null
      });
    }
  }

  if (hasPerformance) {
    charts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.FAILURE_RATE,
      role: 'default',
      drilldown: null,
      thisRelease: eventsTotals !== null && eventsTotals !== void 0 && eventsTotals.releaseFailureRate ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_19__.formatPercentage)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.releaseFailureRate) : null,
      allReleases: eventsTotals !== null && eventsTotals !== void 0 && eventsTotals.allFailureRate ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_19__.formatPercentage)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.allFailureRate) : null,
      diff: diffFailure ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_19__.formatPercentage)(Math.abs(diffFailure)) : null,
      diffDirection: diffFailure ? diffFailure > 0 ? 'up' : 'down' : null,
      diffColor: diffFailure ? diffFailure > 0 ? 'red300' : 'green300' : null
    });
  }

  if (hasHealthData) {
    charts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.SESSION_DURATION,
      role: 'default',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(sessionDurationTotal) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_9__["default"], {
        seconds: sessionDurationTotal,
        abbreviation: true
      }) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allSessionDurationTotal) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_9__["default"], {
        seconds: allSessionDurationTotal,
        abbreviation: true
      }) : null,
      diff: null,
      diffDirection: null,
      diffColor: null
    });
    additionalCharts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.SESSION_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseSessionsCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: releaseSessionsCount
      }) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allSessionsCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: allSessionsCount
      }) : null,
      diff: null,
      diffDirection: null,
      diffColor: null
    });

    if (hasUsers || loading) {
      additionalCharts.push({
        type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.USER_COUNT,
        role: 'default',
        drilldown: null,
        thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(releaseUsersCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
          value: releaseUsersCount
        }) : null,
        allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(allUsersCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
          value: allUsersCount
        }) : null,
        diff: null,
        diffDirection: null,
        diffColor: null
      });
    }
  }

  if (hasDiscover) {
    additionalCharts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERROR_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.releaseErrorCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.releaseErrorCount
      }) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.allErrorCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.allErrorCount
      }) : null,
      diff: null,
      diffDirection: null,
      diffColor: null
    });
  }

  if (hasPerformance) {
    additionalCharts.push({
      type: sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.TRANSACTION_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.releaseTransactionCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.releaseTransactionCount
      }) : null,
      allReleases: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.allTransactionCount) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_8__["default"], {
        value: eventsTotals === null || eventsTotals === void 0 ? void 0 : eventsTotals.allTransactionCount
      }) : null,
      diff: null,
      diffDirection: null,
      diffColor: null
    });
  }

  function handleChartChange(chartType) {
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push({ ...location,
      query: { ...location.query,
        chart: chartType
      }
    });
  }

  function handleExpanderToggle(chartType) {
    if (expanded.has(chartType)) {
      expanded.delete(chartType);
      setExpanded(new Set(expanded));
    } else {
      setExpanded(new Set(expanded.add(chartType)));
    }
  }

  function getTableHeaders(withExpanders) {
    const headers = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(DescriptionCell, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Description')
    }, "description"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Cell, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('All Releases')
    }, "releases"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Cell, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('This Release')
    }, "release"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Cell, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Change')
    }, "change")];

    if (withExpanders) {
      headers.push((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Cell, {}, "expanders"));
    }

    return headers;
  }

  function getChartDiff(diff, diffColor, diffDirection) {
    return diff ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(Change, {
      color: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffColor) ? diffColor : undefined,
      children: [diff, ' ', (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(diffDirection) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
        direction: diffDirection,
        size: "xs"
      }) : diff === '0%' ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledNotAvailable, {})]
    }) : null;
  } // if there are no sessions, we do not need to do row toggling because there won't be as many rows


  if (!hasHealthData) {
    charts.push(...additionalCharts);
    additionalCharts.splice(0, additionalCharts.length);
  }

  let activeChart = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_21__.decodeScalar)(location.query.chart, hasHealthData ? sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS : hasPerformance ? sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.FAILURE_RATE : sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERROR_COUNT);
  let chart = [...charts, ...additionalCharts].find(ch => ch.type === activeChart);

  if (!chart) {
    chart = charts[0];
    activeChart = charts[0].type;
  }

  const showPlaceholders = loading || eventsLoading;
  const withExpanders = hasHealthData || additionalCharts.length > 0;

  if (errored || !chart) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_6__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconWarning, {
          color: "gray300",
          size: "lg"
        })
      })
    });
  }

  const titleChartDiff = chart.diff !== '0%' && chart.thisRelease !== '0%' ? getChartDiff(chart.diff, chart.diffColor, chart.diffDirection) : null;

  function renderChartRow(_ref2) {
    let {
      diff,
      diffColor,
      diffDirection,
      ...rest
    } = _ref2;
    return (0,_emotion_react__WEBPACK_IMPORTED_MODULE_30__.createElement)(_releaseComparisonChartRow__WEBPACK_IMPORTED_MODULE_25__["default"], { ...rest,
      key: rest.type,
      diff: diff,
      showPlaceholders: showPlaceholders,
      activeChart: activeChart,
      onChartChange: handleChartChange,
      chartDiff: getChartDiff(diff, diffColor, diffDirection),
      onExpanderToggle: handleExpanderToggle,
      expanded: expanded.has(rest.type),
      withExpanders: withExpanders
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ChartPanel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__.ChartContainer, {
        children: [sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.ERROR_COUNT, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.TRANSACTION_COUNT, sentry_types__WEBPACK_IMPORTED_MODULE_17__.ReleaseComparisonChartType.FAILURE_RATE].includes(activeChart) ? (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_releaseEventsChart__WEBPACK_IMPORTED_MODULE_26__["default"], {
            release: release,
            project: project,
            chartType: activeChart,
            period: period !== null && period !== void 0 ? period : undefined,
            start: start,
            end: end,
            utc: utc === 'true',
            value: chart.thisRelease,
            diff: titleChartDiff
          }),
          fixed: 'Events Chart'
        }) : (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_20__["default"])({
          value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_releaseSessionsChart__WEBPACK_IMPORTED_MODULE_27__["default"], {
            releaseSessions: releaseSessions,
            allSessions: allSessions,
            release: release,
            project: project,
            chartType: activeChart,
            platform: platform,
            period: period !== null && period !== void 0 ? period : undefined,
            start: start,
            end: end,
            utc: utc === 'true',
            value: chart.thisRelease,
            diff: titleChartDiff,
            loading: loading,
            reloading: reloading
          }),
          fixed: 'Sessions Chart'
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ChartTable, {
      headers: getTableHeaders(withExpanders),
      "data-test-id": "release-comparison-table",
      withExpanders: withExpanders,
      children: [charts.map(chartRow => renderChartRow(chartRow)), isOtherExpanded && additionalCharts.map(chartRow => renderChartRow(chartRow)), additionalCharts.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ShowMoreWrapper, {
        onClick: () => setIsOtherExpanded(!isOtherExpanded),
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ShowMoreTitle, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconList, {
            size: "xs"
          }), isOtherExpanded ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tn)('Hide %s Other', 'Hide %s Others', additionalCharts.length) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tn)('Show %s Other', 'Show %s Others', additionalCharts.length)]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ShowMoreButton, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            borderless: true,
            size: "zero",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconChevron, {
              direction: isOtherExpanded ? 'up' : 'down'
            }),
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Toggle additional charts')
          })
        })]
      })]
    })]
  });
}

ReleaseComparisonChart.displayName = "ReleaseComparisonChart";

const ChartPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel,  true ? {
  target: "ezo15h58"
} : 0)( true ? {
  name: "1524n4i",
  styles: "margin-bottom:0;border-bottom-left-radius:0;border-bottom:none;border-bottom-right-radius:0"
} : 0);

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ezo15h57"
} : 0)("text-align:right;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const DescriptionCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "ezo15h56"
} : 0)( true ? {
  name: "5mb4cs",
  styles: "text-align:left;overflow:visible"
} : 0);

const Change = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ezo15h55"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";", p => p.color && `color: ${p.theme[p.color]}`, ";" + ( true ? "" : 0));

const ChartTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelTable,  true ? {
  target: "ezo15h54"
} : 0)("border-top-left-radius:0;border-top-right-radius:0;grid-template-columns:minmax(400px, auto) repeat(3, minmax(min-content, 1fr)) ", p => p.withExpanders ? '75px' : '', ";>*{border-bottom:1px solid ", p => p.theme.border, ";}@media (max-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:repeat(4, minmax(min-content, 1fr)) ", p => p.withExpanders ? '75px' : '', ";}" + ( true ? "" : 0));

const StyledNotAvailable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "ezo15h53"
} : 0)( true ? {
  name: "1r5gb7q",
  styles: "display:inline-block"
} : 0);

const ShowMoreWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ezo15h52"
} : 0)("display:contents;&:hover{cursor:pointer;}>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";}" + ( true ? "" : 0));

const ShowMoreTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ezo15h51"
} : 0)("color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeMedium, ";display:inline-grid;grid-template-columns:auto auto;gap:10px;align-items:center;justify-content:flex-start;svg{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.25), ";}" + ( true ? "" : 0));

const ShowMoreButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ezo15h50"
} : 0)( true ? {
  name: "ek8iy4",
  styles: "grid-column:2/-1;display:flex;align-items:center;justify-content:flex-end"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseComparisonChart);

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseComparisonChart/releaseComparisonChartRow.tsx":
/*!*************************************************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseComparisonChart/releaseComparisonChartRow.tsx ***!
  \*************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_radio__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/radio */ "./app/components/radio.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














function ReleaseComparisonChartRow(_ref) {
  let {
    type,
    role,
    drilldown,
    thisRelease,
    allReleases,
    diff,
    showPlaceholders,
    activeChart,
    chartDiff,
    onChartChange,
    onExpanderToggle,
    expanded,
    withExpanders
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ChartTableRow, {
    htmlFor: type,
    isActive: type === activeChart,
    isLoading: showPlaceholders,
    role: role,
    expanded: expanded,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(DescriptionCell, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(TitleWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_radio__WEBPACK_IMPORTED_MODULE_4__["default"], {
          id: type,
          disabled: false,
          checked: type === activeChart,
          onChange: () => onChartChange(type)
        }), _utils__WEBPACK_IMPORTED_MODULE_9__.releaseComparisonChartLabels[type], "\xA0", drilldown]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NumericCell, {
      children: showPlaceholders ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: "20px"
      }) : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(allReleases) ? allReleases : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NumericCell, {
      children: showPlaceholders ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: "20px"
      }) : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(thisRelease) ? thisRelease : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {})
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(NumericCell, {
      children: showPlaceholders ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_3__["default"], {
        height: "20px"
      }) : (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(diff) ? chartDiff : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {})
    }), withExpanders && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ExpanderCell, {
      children: role === 'parent' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ToggleButton, {
        onClick: () => onExpanderToggle(type),
        borderless: true,
        size: "zero",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconChevron, {
          direction: expanded ? 'up' : 'down'
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Toggle chart group')
      })
    })]
  });
}

ReleaseComparisonChartRow.displayName = "ReleaseComparisonChartRow";

const Cell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1frklny6"
} : 0)("text-align:right;color:", p => p.theme.subText, ";", p => p.theme.overflowEllipsis, " font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const NumericCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1frklny5"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

const DescriptionCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1frklny4"
} : 0)("text-align:left;overflow:visible;color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const ExpanderCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Cell,  true ? {
  target: "e1frklny3"
} : 0)( true ? {
  name: "19mh0x6",
  styles: "display:flex;align-items:center;justify-content:flex-end"
} : 0);

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1frklny2"
} : 0)("display:flex;align-items:center;position:relative;z-index:1;background:", p => p.theme.background, ";input{width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";flex-shrink:0;background-color:", p => p.theme.background, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), "!important;&:checked:after{width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";}&:hover{cursor:pointer;}}" + ( true ? "" : 0));

const ChartTableRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e1frklny1"
} : 0)("display:contents;font-weight:400;margin-bottom:0;>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";}", p => p.isActive && !p.isLoading && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)(Cell, ",", NumericCell, ",", DescriptionCell, ",", TitleWrapper, ",", ExpanderCell, "{background-color:", p.theme.bodyBackground, ";}" + ( true ? "" : 0),  true ? "" : 0), " &:hover{cursor:pointer;",
/* sc-selector */
Cell, ",",
/* sc-selector */
NumericCell, ",",
/* sc-selector */
DescriptionCell, ",",
/* sc-selector */
ExpanderCell, ",",
/* sc-selector */
TitleWrapper, "{", p => !p.isLoading && `background-color: ${p.theme.bodyBackground}`, ";}}", p => (p.role === 'default' || p.role === 'parent' && !p.expanded) && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)("&:not(:last-child){", Cell, ",", NumericCell, ",", DescriptionCell, ",", ExpanderCell, "{border-bottom:1px solid ", p.theme.border, ";}}" + ( true ? "" : 0),  true ? "" : 0), " ", p => p.role === 'children' && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)(DescriptionCell, "{padding-left:44px;position:relative;&:before{content:'';width:15px;height:36px;position:absolute;top:-17px;left:24px;border-bottom:1px solid ", p.theme.border, ";border-left:1px solid ", p.theme.border, ";}}" + ( true ? "" : 0),  true ? "" : 0), " ", p => p.role === 'children' && /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_11__.css)(Cell, ",", NumericCell, ",", DescriptionCell, ",", ExpanderCell, "{padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";border-bottom:0;}" + ( true ? "" : 0),  true ? "" : 0), ";" + ( true ? "" : 0));

const ToggleButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1frklny0"
} : 0)( true ? {
  name: "z3qbed",
  styles: "&,&:hover,&:focus,&:active{background:transparent;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseComparisonChartRow);

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseComparisonChart/releaseEventsChart.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseComparisonChart/releaseEventsChart.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_charts_eventsChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/eventsChart */ "./app/components/charts/eventsChart.tsx");
/* harmony import */ var sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/eventsRequest */ "./app/components/charts/eventsRequest.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/views/performance/data */ "./app/views/performance/data.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


 // eslint-disable-next-line no-restricted-imports





















function ReleaseEventsChart(_ref) {
  let {
    release,
    project,
    chartType,
    value,
    diff,
    organization,
    router,
    period,
    start,
    end,
    utc,
    location
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_19__.a)();

  function getColors() {
    const colors = theme.charts.getColorPalette(14);

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.ERROR_COUNT:
        return [colors[12]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.TRANSACTION_COUNT:
        return [colors[0]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE:
        return [colors[9]];

      default:
        return undefined;
    }
  }

  function getQuery() {
    const releaseFilter = `release:${release.version}`;

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.ERROR_COUNT:
        return new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__.MutableSearch(['!event.type:transaction', releaseFilter]).formatString();

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.TRANSACTION_COUNT:
        return new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__.MutableSearch(['event.type:transaction', releaseFilter]).formatString();

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE:
        return new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_14__.MutableSearch(['event.type:transaction', releaseFilter]).formatString();

      default:
        return '';
    }
  }

  function getField() {
    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.ERROR_COUNT:
        return ['count()'];

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.TRANSACTION_COUNT:
        return ['count()'];

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE:
        return ['failure_rate()'];

      default:
        return undefined;
    }
  }

  function getYAxis() {
    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.ERROR_COUNT:
        return 'count()';

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.TRANSACTION_COUNT:
        return 'count()';

      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE:
        return 'failure_rate()';

      default:
        return '';
    }
  }

  function getHelp() {
    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE:
        return (0,sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_17__.getTermHelp)(organization, sentry_views_performance_data__WEBPACK_IMPORTED_MODULE_17__.PERFORMANCE_TERM.FAILURE_RATE);

      default:
        return null;
    }
  }

  const projects = location.query.project;
  const environments = location.query.environment;
  const markLines = (0,_utils__WEBPACK_IMPORTED_MODULE_18__.generateReleaseMarkLines)(release, project, theme, location);
  return (
    /**
     * EventsRequest is used to fetch the second series of Failure Rate chart.
     * First one is "This Release" - fetched as usual inside EventsChart
     * component and this one is "All Releases" that's shoehorned in place
     * of Previous Period via previousSeriesTransformer
     */
    (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_charts_eventsRequest__WEBPACK_IMPORTED_MODULE_6__["default"], {
      organization: organization,
      api: new sentry_api__WEBPACK_IMPORTED_MODULE_4__.Client(),
      period: period,
      project: projects,
      environment: environments,
      start: start,
      end: end,
      interval: (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_8__.getInterval)({
        start,
        end,
        period,
        utc
      }, 'high'),
      query: "event.type:transaction",
      includePrevious: false,
      currentSeriesNames: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All Releases')],
      yAxis: getYAxis(),
      field: getField(),
      confirmedQuery: chartType === sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE,
      partial: true,
      referrer: "api.releases.release-details-chart",
      children: _ref2 => {
        let {
          timeseriesData,
          loading,
          reloading
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_charts_eventsChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
          query: getQuery(),
          yAxis: getYAxis(),
          field: getField(),
          colors: getColors(),
          api: api,
          router: router,
          organization: organization,
          disableReleases: true,
          disablePrevious: true,
          showLegend: true,
          projects: projects,
          environments: environments,
          start: start !== null && start !== void 0 ? start : null,
          end: end !== null && end !== void 0 ? end : null,
          period: period,
          utc: utc,
          currentSeriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('This Release') + (loading || reloading ? ' ' : '') // HACK: trigger echarts rerender without remounting
          ,
          previousSeriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All Releases'),
          disableableSeries: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('This Release'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All Releases')],
          chartHeader: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__.HeaderTitleLegend, {
              children: [_utils__WEBPACK_IMPORTED_MODULE_18__.releaseComparisonChartTitles[chartType], getHelp() && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
                size: "sm",
                position: "top",
                title: getHelp()
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_7__.HeaderValue, {
              children: [value, " ", diff]
            })]
          }),
          legendOptions: {
            right: 10,
            top: 0,
            textStyle: {
              padding: [2, 0, 0, 0]
            }
          },
          chartOptions: {
            grid: {
              left: '10px',
              right: '10px',
              top: '70px',
              bottom: '0px'
            },
            tooltip: {
              trigger: 'axis',
              truncate: 80,
              valueFormatter: (val, label) => {
                if (label && Object.values(_utils__WEBPACK_IMPORTED_MODULE_18__.releaseMarkLinesLabels).includes(label)) {
                  return '';
                }

                return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_12__.tooltipFormatter)(val, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_13__.aggregateOutputType)(getYAxis()));
              }
            }
          },
          usePageZoom: true,
          height: 240,
          seriesTransformer: series => [...series, ...markLines],
          previousSeriesTransformer: series => {
            if (chartType === sentry_types__WEBPACK_IMPORTED_MODULE_11__.ReleaseComparisonChartType.FAILURE_RATE) {
              return timeseriesData === null || timeseriesData === void 0 ? void 0 : timeseriesData[0];
            }

            return series;
          },
          referrer: "api.releases.release-details-chart"
        });
      }
    })
  );
}

ReleaseEventsChart.displayName = "ReleaseEventsChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(ReleaseEventsChart)));

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseComparisonChart/releaseSessionsChart.tsx":
/*!********************************************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseComparisonChart/releaseSessionsChart.tsx ***!
  \********************************************************************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/areaChart */ "./app/components/charts/areaChart.tsx");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_stackedAreaChart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/stackedAreaChart */ "./app/components/charts/stackedAreaChart.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports





















class ReleaseSessionsChart extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formatTooltipValue", (value, label) => {
      if (label && Object.values(_utils__WEBPACK_IMPORTED_MODULE_19__.releaseMarkLinesLabels).includes(label)) {
        return '';
      }

      const {
        chartType
      } = this.props;

      if (value === null) {
        return '\u2015';
      }

      switch (chartType) {
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_SESSIONS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_SESSIONS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_SESSIONS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_USERS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_USERS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_USERS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_USERS:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_USERS:
          return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(value) ? `${value}%` : '\u2015';

        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_DURATION:
          return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_15__.defined)(value) && typeof value === 'number' ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__.getExactDuration)(value, true) : '\u2015';

        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_COUNT:
        case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.USER_COUNT:
        default:
          return typeof value === 'number' ? value.toLocaleString() : value;
      }
    });
  }

  getYAxis() {
    const {
      theme,
      chartType
    } = this.props;

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_USERS:
        return {
          max: 100,
          scale: true,
          axisLabel: {
            formatter: value => (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_18__.displayCrashFreePercent)(value),
            color: theme.chartLabel
          }
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_USERS:
        return {
          scale: true,
          axisLabel: {
            formatter: value => `${lodash_round__WEBPACK_IMPORTED_MODULE_5___default()(value, 2)}%`,
            color: theme.chartLabel
          }
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_DURATION:
        return {
          scale: true,
          axisLabel: {
            formatter: value => (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_16__.getDuration)(value, undefined, true),
            color: theme.chartLabel
          }
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_COUNT:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getChart() {
    const {
      chartType
    } = this.props;

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_SESSIONS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_USERS:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_USERS:
      default:
        return sentry_components_charts_areaChart__WEBPACK_IMPORTED_MODULE_6__.AreaChart;

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_COUNT:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_DURATION:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.USER_COUNT:
        return sentry_components_charts_stackedAreaChart__WEBPACK_IMPORTED_MODULE_8__["default"];
    }
  }

  getColors() {
    const {
      theme,
      chartType
    } = this.props;
    const colors = theme.charts.getColorPalette(14);

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return [colors[0]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_SESSIONS:
        return [theme.green300];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        return [colors[15]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_SESSIONS:
        return [colors[12]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_SESSIONS:
        return [theme.red300];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_USERS:
        return [colors[6]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_USERS:
        return [theme.green300];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_USERS:
        return [colors[15]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_USERS:
        return [colors[12]];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_USERS:
        return [theme.red300];

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_COUNT:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_DURATION:
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getSeries(chartType) {
    const {
      releaseSessions,
      allSessions,
      release,
      location,
      project,
      theme
    } = this.props;
    const countCharts = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.initSessionsChart)(theme);

    if (!releaseSessions) {
      return {};
    }

    const markLines = (0,_utils__WEBPACK_IMPORTED_MODULE_19__.generateReleaseMarkLines)(release, project, theme, location);

    switch (chartType) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCrashFreeRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCrashFreeRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_SESSIONS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_SESSIONS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_SESSIONS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASH_FREE_USERS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCrashFreeRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCrashFreeRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.HEALTHY_USERS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ABNORMAL_USERS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.ERRORED_USERS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.CRASHED_USERS:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED)
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionStatusRateSeries)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_COUNT:
        return {
          series: [{ ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.SESSIONS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED), releaseSessions.intervals)
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.SESSION_DURATION:
        return {
          series: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('This Release'),
            connectNulls: true,
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionP50Series)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.DURATION, duration => (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_18__.roundDuration)(duration / 1000))
          }],
          previousSeries: [{
            seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('All Releases'),
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getSessionP50Series)(allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.DURATION, duration => (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_18__.roundDuration)(duration / 1000))
          }],
          markLines
        };

      case sentry_types__WEBPACK_IMPORTED_MODULE_14__.ReleaseComparisonChartType.USER_COUNT:
        return {
          series: [{ ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.HEALTHY), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ERRORED), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.ABNORMAL), releaseSessions.intervals)
          }, { ...countCharts[sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED],
            data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.getCountSeries)(sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionFieldWithOperation.USERS, releaseSessions.groups.find(g => g.by['session.status'] === sentry_types__WEBPACK_IMPORTED_MODULE_14__.SessionStatus.CRASHED), releaseSessions.intervals)
          }],
          markLines
        };

      default:
        return {};
    }
  }

  render() {
    const {
      chartType,
      router,
      period,
      start,
      end,
      utc,
      value,
      diff,
      loading,
      reloading
    } = this.props;
    const Chart = this.getChart();
    const {
      series,
      previousSeries,
      markLines
    } = this.getSeries(chartType);
    const legend = {
      right: 10,
      top: 0,
      textStyle: {
        padding: [2, 0, 0, 0]
      },
      data: [...(series !== null && series !== void 0 ? series : []), ...(previousSeries !== null && previousSeries !== void 0 ? previousSeries : [])].map(s => s.seriesName)
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_10__["default"], {
      loading: loading,
      reloading: reloading,
      height: "240px",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_11__["default"], {
        visible: reloading
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.HeaderTitleLegend, {
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Chart Title'),
        children: [_utils__WEBPACK_IMPORTED_MODULE_19__.releaseComparisonChartTitles[chartType], _utils__WEBPACK_IMPORTED_MODULE_19__.releaseComparisonChartHelp[chartType] && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_12__["default"], {
          size: "sm",
          position: "top",
          title: _utils__WEBPACK_IMPORTED_MODULE_19__.releaseComparisonChartHelp[chartType]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_9__.HeaderValue, {
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Chart Value'),
        children: [value, " ", diff]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_7__["default"], {
        router: router,
        period: period,
        utc: utc,
        start: start,
        end: end,
        usePageDate: true,
        children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Chart, {
          legend: legend,
          series: [...(series !== null && series !== void 0 ? series : []), ...(markLines !== null && markLines !== void 0 ? markLines : [])],
          previousPeriod: previousSeries !== null && previousSeries !== void 0 ? previousSeries : [],
          ...zoomRenderProps,
          grid: {
            left: '10px',
            right: '10px',
            top: '70px',
            bottom: '0px'
          },
          minutesThresholdToDisplaySeconds: sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_17__.MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
          yAxis: this.getYAxis(),
          tooltip: {
            valueFormatter: this.formatTooltipValue
          },
          colors: this.getColors(),
          transformSinglePointToBar: true,
          height: 240
        })
      })]
    });
  }

}

ReleaseSessionsChart.displayName = "ReleaseSessionsChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_emotion_react__WEBPACK_IMPORTED_MODULE_21__.d)((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ReleaseSessionsChart)));

/***/ }),

/***/ "./app/views/releases/detail/overview/releaseIssues.tsx":
/*!**************************************************************!*\
  !*** ./app/views/releases/detail/overview/releaseIssues.tsx ***!
  \**************************************************************/
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
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/issues/groupList */ "./app/components/issues/groupList.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/queryCount */ "./app/components/queryCount.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/tokenizeSearch */ "./app/utils/tokenizeSearch.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _commitsAndFiles_emptyState__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../commitsAndFiles/emptyState */ "./app/views/releases/detail/commitsAndFiles/emptyState.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















var IssuesType;

(function (IssuesType) {
  IssuesType["NEW"] = "new";
  IssuesType["UNHANDLED"] = "unhandled";
  IssuesType["REGRESSED"] = "regressed";
  IssuesType["RESOLVED"] = "resolved";
  IssuesType["ALL"] = "all";
})(IssuesType || (IssuesType = {}));

var IssuesQuery;

(function (IssuesQuery) {
  IssuesQuery["NEW"] = "first-release";
  IssuesQuery["UNHANDLED"] = "error.handled:0";
  IssuesQuery["REGRESSED"] = "regressed_in_release";
  IssuesQuery["RESOLVED"] = "is:resolved";
  IssuesQuery["ALL"] = "release";
})(IssuesQuery || (IssuesQuery = {}));

const defaultProps = {
  withChart: false
};

class ReleaseIssues extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleIssuesTypeSelection", issuesType => {
      const {
        location
      } = this.props;
      const issuesTypeQuery = issuesType === IssuesType.ALL ? IssuesType.ALL : issuesType === IssuesType.NEW ? IssuesType.NEW : issuesType === IssuesType.RESOLVED ? IssuesType.RESOLVED : issuesType === IssuesType.UNHANDLED ? IssuesType.UNHANDLED : issuesType === IssuesType.REGRESSED ? IssuesType.REGRESSED : '';
      const to = { ...location,
        query: { ...location.query,
          issuesType: issuesTypeQuery
        }
      };
      react_router__WEBPACK_IMPORTED_MODULE_6__.browserHistory.replace(to);
      this.setState({
        issuesType
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFetchSuccess", (groupListState, onCursor) => {
      this.setState({
        pageLinks: groupListState.pageLinks,
        onCursor
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderEmptyMessage", () => {
      const {
        location,
        releaseBounds
      } = this.props;
      const {
        issuesType
      } = this.state;
      const isEntireReleasePeriod = !location.query.pageStatsPeriod && !location.query.pageStart;
      const {
        statsPeriod
      } = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getReleaseParams)({
        location,
        releaseBounds
      });
      const selectedTimePeriod = statsPeriod ? sentry_constants__WEBPACK_IMPORTED_MODULE_14__.DEFAULT_RELATIVE_PERIODS[statsPeriod] : null;
      const displayedPeriod = selectedTimePeriod ? selectedTimePeriod.toLowerCase() : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('given timeframe');
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(_commitsAndFiles_emptyState__WEBPACK_IMPORTED_MODULE_22__["default"], {
        children: [issuesType === IssuesType.NEW ? isEntireReleasePeriod ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No new issues in this release.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('No new issues for the [timePeriod].', {
          timePeriod: displayedPeriod
        }) : null, issuesType === IssuesType.UNHANDLED ? isEntireReleasePeriod ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No unhandled issues in this release.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('No unhandled issues for the [timePeriod].', {
          timePeriod: displayedPeriod
        }) : null, issuesType === IssuesType.REGRESSED ? isEntireReleasePeriod ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No regressed issues in this release.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('No regressed issues for the [timePeriod].', {
          timePeriod: displayedPeriod
        }) : null, issuesType === IssuesType.RESOLVED && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No resolved issues in this release.'), issuesType === IssuesType.ALL ? isEntireReleasePeriod ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No issues in this release') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)('No issues for the [timePeriod].', {
          timePeriod: displayedPeriod
        }) : null]
      });
    });
  }

  getInitialState() {
    const {
      location
    } = this.props;
    const query = location.query ? location.query.issuesType : null;
    const issuesTypeState = !query ? IssuesType.NEW : query.includes(IssuesType.NEW) ? IssuesType.NEW : query.includes(IssuesType.UNHANDLED) ? IssuesType.REGRESSED : query.includes(IssuesType.REGRESSED) ? IssuesType.UNHANDLED : query.includes(IssuesType.RESOLVED) ? IssuesType.RESOLVED : query.includes(IssuesType.ALL) ? IssuesType.ALL : IssuesType.ALL;
    return {
      issuesType: issuesTypeState,
      count: {
        new: null,
        all: null,
        resolved: null,
        unhandled: null,
        regressed: null
      }
    };
  }

  componentDidMount() {
    this.fetchIssuesCount();
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_7___default()((0,_utils__WEBPACK_IMPORTED_MODULE_21__.getReleaseParams)({
      location: this.props.location,
      releaseBounds: this.props.releaseBounds
    }), (0,_utils__WEBPACK_IMPORTED_MODULE_21__.getReleaseParams)({
      location: prevProps.location,
      releaseBounds: prevProps.releaseBounds
    }))) {
      this.fetchIssuesCount();
    }
  }

  getIssuesUrl() {
    const {
      version,
      organization
    } = this.props;
    const {
      issuesType
    } = this.state;
    const {
      queryParams
    } = this.getIssuesEndpoint();
    const query = new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch([]);

    switch (issuesType) {
      case IssuesType.NEW:
        query.setFilterValues('firstRelease', [version]);
        break;

      case IssuesType.UNHANDLED:
        query.setFilterValues('release', [version]);
        query.setFilterValues('error.handled', ['0']);
        break;

      case IssuesType.REGRESSED:
        query.setFilterValues('regressed_in_release', [version]);
        break;

      case IssuesType.RESOLVED:
      case IssuesType.ALL:
      default:
        query.setFilterValues('release', [version]);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: { ...queryParams,
        limit: undefined,
        cursor: undefined,
        query: query.formatString()
      }
    };
  }

  getIssuesEndpoint() {
    const {
      version,
      organization,
      location,
      releaseBounds
    } = this.props;
    const {
      issuesType
    } = this.state;
    const queryParams = { ...(0,_utils__WEBPACK_IMPORTED_MODULE_21__.getReleaseParams)({
        location,
        releaseBounds
      }),
      limit: 10,
      sort: sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_20__.IssueSortOptions.FREQ,
      groupStatsPeriod: 'auto'
    };

    switch (issuesType) {
      case IssuesType.ALL:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: { ...queryParams,
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch([`${IssuesQuery.ALL}:${version}`, 'is:unresolved']).formatString()
          }
        };

      case IssuesType.RESOLVED:
        return {
          path: `/organizations/${organization.slug}/releases/${encodeURIComponent(version)}/resolved/`,
          queryParams: { ...queryParams,
            query: ''
          }
        };

      case IssuesType.UNHANDLED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: { ...queryParams,
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch([`${IssuesQuery.ALL}:${version}`, IssuesQuery.UNHANDLED, 'is:unresolved']).formatString()
          }
        };

      case IssuesType.REGRESSED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: { ...queryParams,
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch([`${IssuesQuery.REGRESSED}:${version}`]).formatString()
          }
        };

      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: { ...queryParams,
            query: new sentry_utils_tokenizeSearch__WEBPACK_IMPORTED_MODULE_17__.MutableSearch([`${IssuesQuery.NEW}:${version}`, 'is:unresolved']).formatString()
          }
        };
    }
  }

  async fetchIssuesCount() {
    const {
      api,
      organization,
      version
    } = this.props;
    const issueCountEndpoint = this.getIssueCountEndpoint();
    const resolvedEndpoint = `/organizations/${organization.slug}/releases/${encodeURIComponent(version)}/resolved/`;

    try {
      await Promise.all([api.requestPromise(issueCountEndpoint), api.requestPromise(resolvedEndpoint)]).then(_ref => {
        let [issueResponse, resolvedResponse] = _ref;
        this.setState({
          count: {
            all: issueResponse[`${IssuesQuery.ALL}:"${version}" is:unresolved`] || 0,
            new: issueResponse[`${IssuesQuery.NEW}:"${version}" is:unresolved`] || 0,
            resolved: resolvedResponse.length,
            unhandled: issueResponse[`${IssuesQuery.UNHANDLED} ${IssuesQuery.ALL}:"${version}" is:unresolved`] || 0,
            regressed: issueResponse[`${IssuesQuery.REGRESSED}:"${version}"`] || 0
          }
        });
      });
    } catch {// do nothing
    }
  }

  getIssueCountEndpoint() {
    const {
      organization,
      version,
      location,
      releaseBounds
    } = this.props;
    const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;
    const params = [`${IssuesQuery.NEW}:"${version}" is:unresolved`, `${IssuesQuery.ALL}:"${version}" is:unresolved`, `${IssuesQuery.UNHANDLED} ${IssuesQuery.ALL}:"${version}" is:unresolved`, `${IssuesQuery.REGRESSED}:"${version}"`];
    const queryParams = params.map(param => param);
    const queryParameters = { ...(0,_utils__WEBPACK_IMPORTED_MODULE_21__.getReleaseParams)({
        location,
        releaseBounds
      }),
      query: queryParams
    };
    return `${issuesCountPath}?${query_string__WEBPACK_IMPORTED_MODULE_8__.stringify(queryParameters)}`;
  }

  render() {
    const {
      issuesType,
      count,
      pageLinks,
      onCursor
    } = this.state;
    const {
      organization,
      queryFilterDescription,
      withChart
    } = this.props;
    const {
      path,
      queryParams
    } = this.getIssuesEndpoint();
    const issuesTypes = [{
      value: IssuesType.ALL,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('All Issues'),
      issueCount: count.all
    }, {
      value: IssuesType.NEW,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('New Issues'),
      issueCount: count.new
    }, {
      value: IssuesType.UNHANDLED,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unhandled'),
      issueCount: count.unhandled
    }, {
      value: IssuesType.REGRESSED,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Regressed'),
      issueCount: count.regressed
    }, {
      value: IssuesType.RESOLVED,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Resolved'),
      issueCount: count.resolved
    }];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(ControlsWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledButtonBar, {
          active: issuesType,
          merged: true,
          children: issuesTypes.map(_ref2 => {
            let {
              value,
              label,
              issueCount
            } = _ref2;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
              barId: value,
              size: "xs",
              onClick: () => this.handleIssuesTypeSelection(value),
              "data-test-id": `filter-${value}`,
              children: [label, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_13__["default"], {
                count: issueCount,
                max: 99,
                hideParens: true,
                hideIfEmpty: false
              })]
            }, value);
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(OpenInButtonBar, {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
            to: this.getIssuesUrl(),
            size: "xs",
            "data-test-id": "issues-button",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Open in Issues')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledPagination, {
            pageLinks: pageLinks,
            onCursor: onCursor,
            size: "xs"
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("div", {
        "data-test-id": "release-wrapper",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_issues_groupList__WEBPACK_IMPORTED_MODULE_11__["default"], {
          orgId: organization.slug,
          endpointPath: path,
          queryParams: queryParams,
          query: "",
          canSelectGroups: false,
          queryFilterDescription: queryFilterDescription,
          withChart: withChart,
          narrowGroups: true,
          renderEmptyMessage: this.renderEmptyMessage,
          withPagination: false,
          onFetchSuccess: this.handleFetchSuccess
        })
      })]
    });
  }

}

ReleaseIssues.displayName = "ReleaseIssues";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ReleaseIssues, "defaultProps", defaultProps);

const ControlsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7fml7j3"
} : 0)("display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;", sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__.ButtonGrid, "{overflow:auto;}}" + ( true ? "" : 0));

const OpenInButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e7fml7j2"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(1), " 0;" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e7fml7j1"
} : 0)("grid-template-columns:repeat(4, 1fr);", sentry_components_button__WEBPACK_IMPORTED_MODULE_9__.ButtonLabel, "{white-space:nowrap;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";span:last-child{color:", p => p.theme.buttonCount, ";}}.active{", sentry_components_button__WEBPACK_IMPORTED_MODULE_9__.ButtonLabel, "{span:last-child{color:", p => p.theme.buttonCountActive, ";}}}" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e7fml7j0"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_18__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_19__["default"])(ReleaseIssues)));

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/commitAuthorBreakdown.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/commitAuthorBreakdown.tsx ***!
  \******************************************************************************/
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
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/collapsible */ "./app/components/collapsible.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class CommitAuthorBreakdown extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_3__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);
  }

  getEndpoints() {
    const {
      orgId,
      projectSlug,
      version
    } = this.props;
    const commitsEndpoint = `/projects/${orgId}/${projectSlug}/releases/${encodeURIComponent(version)}/commits/`;
    return [['commits', commitsEndpoint]];
  }

  componentDidUpdate(prevProps) {
    if (prevProps.version !== this.props.version) {
      this.remountComponent();
    }
  }

  getDisplayPercent(authorCommitCount) {
    const {
      commits
    } = this.state;
    const calculatedPercent = Math.round((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.percent)(authorCommitCount, commits.length));
    return `${calculatedPercent < 1 ? '<1' : calculatedPercent}%`;
  }

  renderBody() {
    var _this$state$commits;

    // group commits by author
    const groupedAuthorCommits = (_this$state$commits = this.state.commits) === null || _this$state$commits === void 0 ? void 0 : _this$state$commits.reduce((authorCommitsAccumulator, commit) => {
      var _commit$author$email, _commit$author;

      const email = (_commit$author$email = (_commit$author = commit.author) === null || _commit$author === void 0 ? void 0 : _commit$author.email) !== null && _commit$author$email !== void 0 ? _commit$author$email : 'unknown';

      if (authorCommitsAccumulator.hasOwnProperty(email)) {
        authorCommitsAccumulator[email].commitCount += 1;
      } else {
        authorCommitsAccumulator[email] = {
          commitCount: 1,
          author: commit.author
        };
      }

      return authorCommitsAccumulator;
    }, {}); // sort authors by number of commits

    const sortedAuthorsByNumberOfCommits = Object.values(groupedAuthorCommits).sort((a, b) => b.commitCount - a.commitCount);

    if (!sortedAuthorsByNumberOfCommits.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_7__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Commit Author Breakdown'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_6__["default"], {
        expandButton: _ref => {
          let {
            onExpand,
            numberOfHiddenItems
          } = _ref;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            priority: "link",
            onClick: onExpand,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('Show %s collapsed author', 'Show %s collapsed authors', numberOfHiddenItems)
          });
        },
        children: sortedAuthorsByNumberOfCommits.map((_ref2, index) => {
          var _author$email;

          let {
            commitCount,
            author
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(AuthorLine, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
              user: author,
              size: 20,
              hasTooltip: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(AuthorName, {
              children: (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_11__.userDisplayName)(author || {}, false)
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Commits, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('%s commit', '%s commits', commitCount)
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Percent, {
              children: this.getDisplayPercent(commitCount)
            })]
          }, (_author$email = author === null || author === void 0 ? void 0 : author.email) !== null && _author$email !== void 0 ? _author$email : index);
        })
      })
    });
  }

}

const AuthorLine = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10xjmnv3"
} : 0)("display:inline-grid;grid-template-columns:30px 2fr 1fr 40px;width:100%;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const AuthorName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10xjmnv2"
} : 0)("color:", p => p.theme.textColor, ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const Commits = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10xjmnv1"
} : 0)("color:", p => p.theme.subText, ";text-align:right;" + ( true ? "" : 0));

const Percent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e10xjmnv0"
} : 0)( true ? {
  name: "myuf92",
  styles: "min-width:40px;text-align:right"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommitAuthorBreakdown);

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/deploys.tsx":
/*!****************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/deploys.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_deployBadge__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/deployBadge */ "./app/components/deployBadge.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const Deploys = _ref => {
  let {
    version,
    orgSlug,
    projectId,
    deploys
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_2__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Deploys'),
    children: deploys.map(deploy => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Row, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledDeployBadge, {
        deploy: deploy,
        orgSlug: orgSlug,
        version: version,
        projectId: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_3__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
          date: deploy.dateFinished
        })
      })]
    }, deploy.id))
  });
};

Deploys.displayName = "Deploys";

const Row = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebzjdob1"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledDeployBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_deployBadge__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "ebzjdob0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Deploys);

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/otherProjects.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/otherProjects.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/collapsible */ "./app/components/collapsible.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/utils */ "./app/components/organizations/pageFilters/utils.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function OtherProjects(_ref) {
  let {
    projects,
    location,
    version,
    organization
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_5__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tn)('Other Project for This Release', 'Other Projects for This Release', projects.length),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_collapsible__WEBPACK_IMPORTED_MODULE_2__["default"], {
      expandButton: _ref2 => {
        let {
          onExpand,
          numberOfHiddenItems
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          priority: "link",
          onClick: onExpand,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tn)('Show %s collapsed project', 'Show %s collapsed projects', numberOfHiddenItems)
        });
      },
      children: projects.map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Row, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_3__["default"], {
          project: project,
          avatarSize: 16
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
          size: "xs",
          to: {
            pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(version)}/`,
            query: { ...(0,sentry_components_organizations_pageFilters_utils__WEBPACK_IMPORTED_MODULE_4__.extractSelectionParameters)(location.query),
              project: project.id,
              yAxis: undefined
            }
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('View')
        })]
      }, project.id))
    })
  });
}

OtherProjects.displayName = "OtherProjects";

const Row = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1vy22z50"
} : 0)("display:grid;grid-template-columns:1fr max-content;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";font-size:", p => p.theme.fontSizeMedium, ";@media (min-width: ", p => p.theme.breakpoints.medium, ") and (max-width: ", p => p.theme.breakpoints.large, "){grid-template-columns:200px max-content;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OtherProjects);

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/projectReleaseDetails.tsx":
/*!******************************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/projectReleaseDetails.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/keyValueTable */ "./app/components/keyValueTable.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













const ProjectReleaseDetails = _ref => {
  var _versionInfo$package;

  let {
    release,
    releaseMeta,
    orgSlug,
    projectSlug
  } = _ref;
  const {
    version,
    versionInfo,
    dateCreated,
    firstEvent,
    lastEvent
  } = release;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_5__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Project Release Details'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTable, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Created'),
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
          date: dateCreated,
          seconds: false
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Version'),
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_8__["default"], {
          version: version,
          anchor: false
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Package'),
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTextOverflow, {
          ellipsisDirection: "left",
          children: (_versionInfo$package = versionInfo.package) !== null && _versionInfo$package !== void 0 ? _versionInfo$package : '\u2014'
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('First Event'),
        value: firstEvent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_7__["default"], {
          date: firstEvent
        }) : '\u2014'
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Last Event'),
        value: lastEvent ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_7__["default"], {
          date: lastEvent
        }) : '\u2014'
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_keyValueTable__WEBPACK_IMPORTED_MODULE_3__.KeyValueTableRow, {
        keyName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Source Maps'),
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_4__["default"], {
          to: `/settings/${orgSlug}/projects/${projectSlug}/source-maps/${encodeURIComponent(version)}/`,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_1__["default"], {
            value: releaseMeta.releaseFileCount
          }), ' ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tn)('artifact', 'artifacts', releaseMeta.releaseFileCount)]
        })
      })]
    })
  });
};

ProjectReleaseDetails.displayName = "ProjectReleaseDetails";

const StyledTextOverflow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e11dcsas0"
} : 0)( true ? {
  name: "olmadw",
  styles: "line-height:inherit;text-align:right"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProjectReleaseDetails);

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/releaseAdoption.tsx":
/*!************************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/releaseAdoption.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/charts/chartZoom */ "./app/components/charts/chartZoom.tsx");
/* harmony import */ var sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/charts/errorPanel */ "./app/components/charts/errorPanel.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/charts/transitionChart */ "./app/components/charts/transitionChart.tsx");
/* harmony import */ var sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/transparentLoadingMask */ "./app/components/charts/transparentLoadingMask.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/sessions */ "./app/utils/sessions.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../../../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../utils */ "./app/views/releases/detail/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

// eslint-disable-next-line no-restricted-imports






















const sessionsAxisIndex = 0;
const usersAxisIndex = 1;
const axisIndexToSessionsField = {
  [sessionsAxisIndex]: sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS,
  [usersAxisIndex]: sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS
};

function ReleaseAdoption(_ref) {
  var _release$adoptionStag, _release$adoptionStag2;

  let {
    release,
    project,
    environment,
    releaseSessions,
    allSessions,
    loading,
    reloading,
    errored,
    router,
    location
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_22__.a)();
  const hasUsers = !!(0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_19__.getCount)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS);

  function getSeries() {
    if (!releaseSessions) {
      return [];
    }

    const sessionsMarkLines = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.generateReleaseMarkLines)(release, project, theme, location, {
      hideLabel: true,
      axisIndex: sessionsAxisIndex
    });
    const series = [...sessionsMarkLines, {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Sessions'),
      connectNulls: true,
      yAxisIndex: sessionsAxisIndex,
      xAxisIndex: sessionsAxisIndex,
      data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_19__.getAdoptionSeries)(releaseSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.SESSIONS)
    }];

    if (hasUsers) {
      const usersMarkLines = (0,_utils__WEBPACK_IMPORTED_MODULE_21__.generateReleaseMarkLines)(release, project, theme, location, {
        hideLabel: true,
        axisIndex: usersAxisIndex
      });
      series.push(...usersMarkLines);
      series.push({
        seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Users'),
        connectNulls: true,
        yAxisIndex: usersAxisIndex,
        xAxisIndex: usersAxisIndex,
        data: (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_19__.getAdoptionSeries)(releaseSessions.groups, allSessions === null || allSessions === void 0 ? void 0 : allSessions.groups, releaseSessions.intervals, sentry_types__WEBPACK_IMPORTED_MODULE_17__.SessionFieldWithOperation.USERS)
      });
    }

    return series;
  }

  const colors = theme.charts.getColorPalette(2);
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
    },
    max: 100,
    axisLabel: {
      formatter: value => `${value}%`,
      color: theme.chartLabel
    }
  };
  const chartOptions = {
    height: hasUsers ? 280 : 140,
    grid: [{
      top: '40px',
      left: '10px',
      right: '10px',
      height: '100px'
    }, {
      top: '180px',
      left: '10px',
      right: '10px',
      height: '100px'
    }],
    axisPointer: {
      // Link each x-axis together.
      link: [{
        xAxisIndex: [sessionsAxisIndex, usersAxisIndex]
      }]
    },
    xAxes: Array.from(new Array(2)).map((_i, index) => ({
      gridIndex: index,
      type: 'time',
      show: false
    })),
    yAxes: [{
      gridIndex: sessionsAxisIndex,
      ...axisLineConfig
    }, {
      gridIndex: usersAxisIndex,
      ...axisLineConfig
    }],
    // utc: utc === 'true', //TODO(release-comparison)
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[0], colors[1]],
    tooltip: {
      trigger: 'axis',
      truncate: 80,
      valueFormatter: (value, label, seriesParams) => {
        const {
          axisIndex,
          dataIndex
        } = seriesParams || {};
        const absoluteCount = (0,sentry_utils_sessions__WEBPACK_IMPORTED_MODULE_19__.getCountAtIndex)(releaseSessions === null || releaseSessions === void 0 ? void 0 : releaseSessions.groups, axisIndexToSessionsField[axisIndex !== null && axisIndex !== void 0 ? axisIndex : 0], dataIndex !== null && dataIndex !== void 0 ? dataIndex : 0);
        return label && Object.values(_utils__WEBPACK_IMPORTED_MODULE_21__.releaseMarkLinesLabels).includes(label) ? '' : `<span>${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_18__.formatAbbreviatedNumber)(absoluteCount)} <span style="color: ${theme.textColor};margin-left: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5)}">${value}%</span></span>`;
      },
      filter: (_, seriesParam) => {
        const {
          seriesName,
          axisIndex
        } = seriesParam; // do not display tooltips for "Users Adopted" marklines

        if (axisIndex === usersAxisIndex && Object.values(_utils__WEBPACK_IMPORTED_MODULE_21__.releaseMarkLinesLabels).includes(seriesName)) {
          return false;
        }

        return true;
      }
    }
  };
  const {
    statsPeriod: period,
    start,
    end,
    utc
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getReleaseParams)({
    location,
    releaseBounds: (0,_utils__WEBPACK_IMPORTED_MODULE_20__.getReleaseBounds)(release)
  });
  const adoptionStage = (_release$adoptionStag = release.adoptionStages) === null || _release$adoptionStag === void 0 ? void 0 : (_release$adoptionStag2 = _release$adoptionStag[project.slug]) === null || _release$adoptionStag2 === void 0 ? void 0 : _release$adoptionStag2.stage;
  const adoptionStageLabel = _utils__WEBPACK_IMPORTED_MODULE_20__.ADOPTION_STAGE_LABELS[adoptionStage];
  const multipleEnvironments = environment.length === 0 || environment.length > 1;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
    children: [(0,_utils__WEBPACK_IMPORTED_MODULE_20__.isMobileRelease)(project.platform) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_11__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Adoption Stage'),
      icon: multipleEnvironments && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('See if a release has low adoption, been adopted by users, or replaced by another release. Select an environment above to view the stage this release is in.'),
        size: "sm"
      }),
      children: adoptionStageLabel && !multipleEnvironments ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_13__["default"], {
          title: adoptionStageLabel.tooltipTitle,
          isHoverable: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_tag__WEBPACK_IMPORTED_MODULE_12__["default"], {
            type: adoptionStageLabel.type,
            children: adoptionStageLabel.name
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(AdoptionEnvironment, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.tct)(`in [environment]`, {
            environment
          })
        })]
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(NotAvailableWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_9__["default"], {})
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(RelativeBox, {
      children: [!loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ChartLabel, {
        top: "0px",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ChartTitle, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Sessions Adopted'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Adoption compares the sessions of a release with the total sessions for this project.'),
            size: "sm"
          })
        })
      }), !loading && hasUsers && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ChartLabel, {
        top: "140px",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(ChartTitle, {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Users Adopted'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Adoption compares the users of a release with the total users for this project.'),
            size: "sm"
          })
        })
      }), errored ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_errorPanel__WEBPACK_IMPORTED_MODULE_5__["default"], {
        height: "280px",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconWarning, {
          color: "gray300",
          size: "lg"
        })
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_charts_transitionChart__WEBPACK_IMPORTED_MODULE_7__["default"], {
        loading: loading,
        reloading: reloading,
        height: "280px",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_transparentLoadingMask__WEBPACK_IMPORTED_MODULE_8__["default"], {
          visible: reloading
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_chartZoom__WEBPACK_IMPORTED_MODULE_4__["default"], {
          router: router,
          period: period !== null && period !== void 0 ? period : undefined,
          utc: utc === 'true',
          start: start,
          end: end,
          usePageDate: true,
          xAxisIndex: [sessionsAxisIndex, usersAxisIndex],
          children: zoomRenderProps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_6__.LineChart, { ...chartOptions,
            ...zoomRenderProps,
            series: getSeries(),
            transformSinglePointToLine: true
          })
        })]
      })]
    })]
  });
}

ReleaseAdoption.displayName = "ReleaseAdoption";

const NotAvailableWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecm7kxd4"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const AdoptionEnvironment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ecm7kxd3"
} : 0)("color:", p => p.theme.textColor, ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(0.5), ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const RelativeBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecm7kxd2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const ChartTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "ecm7kxd1"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const ChartLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ecm7kxd0"
} : 0)("position:absolute;top:", p => p.top, ";z-index:1;left:0;right:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_3__.withRouter)(ReleaseAdoption));

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/releaseStats.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/releaseStats.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_deployBadge__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/deployBadge */ "./app/components/deployBadge.tsx");
/* harmony import */ var sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/notAvailable */ "./app/components/notAvailable.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function ReleaseStats(_ref) {
  var _lastDeploy$dateFinis;

  let {
    organization,
    release,
    project
  } = _ref;
  const {
    lastDeploy,
    dateCreated,
    version
  } = release;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Container, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_3__["default"], {
      title: lastDeploy !== null && lastDeploy !== void 0 && lastDeploy.dateFinished ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Date Deployed') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Date Created'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
        date: (_lastDeploy$dateFinis = lastDeploy === null || lastDeploy === void 0 ? void 0 : lastDeploy.dateFinished) !== null && _lastDeploy$dateFinis !== void 0 ? _lastDeploy$dateFinis : dateCreated
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_3__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Last Deploy'),
      children: lastDeploy !== null && lastDeploy !== void 0 && lastDeploy.dateFinished ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_deployBadge__WEBPACK_IMPORTED_MODULE_1__["default"], {
        deploy: lastDeploy,
        orgSlug: organization.slug,
        version: version,
        projectId: project.id
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_notAvailable__WEBPACK_IMPORTED_MODULE_2__["default"], {})
    })]
  });
}

ReleaseStats.displayName = "ReleaseStats";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efpxwwm0"
} : 0)("display:grid;grid-template-columns:50% 50%;grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseStats);

/***/ }),

/***/ "./app/views/releases/detail/overview/sidebar/totalCrashFreeUsers.tsx":
/*!****************************************************************************!*\
  !*** ./app/views/releases/detail/overview/sidebar/totalCrashFreeUsers.tsx ***!
  \****************************************************************************/
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
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/sidebarSection */ "./app/components/sidebarSection.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../../../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















class TotalCrashFreeUsers extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);
  }

  getEndpoints() {
    const {
      location,
      organization,
      projectSlug,
      version
    } = this.props;
    return [['releaseStats', `/projects/${organization.slug}/${projectSlug}/releases/${encodeURIComponent(version)}/stats/`, {
      query: { ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_7__.normalizeDateTimeParams)(lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(location.query, [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_9__.URL_PARAM.PROJECT, sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_9__.URL_PARAM.ENVIRONMENT])),
        type: 'sessions'
      }
    }]];
  }

  componentDidUpdate(prevProps) {
    if (prevProps.version !== this.props.version) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    var _this$state$releaseSt;

    const crashFreeTimeBreakdown = (_this$state$releaseSt = this.state.releaseStats) === null || _this$state$releaseSt === void 0 ? void 0 : _this$state$releaseSt.usersBreakdown;

    if (!(crashFreeTimeBreakdown !== null && crashFreeTimeBreakdown !== void 0 && crashFreeTimeBreakdown.length)) {
      return null;
    }

    const timeline = crashFreeTimeBreakdown.map((_ref, index, data) => {
      let {
        date,
        crashFreeUsers,
        totalUsers
      } = _ref;
      // count number of crash free users from knowing percent and total
      const crashFreeUserCount = Math.round((crashFreeUsers !== null && crashFreeUsers !== void 0 ? crashFreeUsers : 0) * totalUsers / 100); // first item of timeline is release creation date, then we want to have relative date label

      const dateLabel = index === 0 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Release created') : `${moment__WEBPACK_IMPORTED_MODULE_4___default()(data[0].date).from(date, true)} ${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('later')}`;
      return {
        date: moment__WEBPACK_IMPORTED_MODULE_4___default()(date),
        dateLabel,
        crashFreeUsers,
        crashFreeUserCount
      };
    }) // remove those timeframes that are in the future
    .filter(item => item.date.isBefore()) // we want timeline to go from bottom to up
    .reverse();

    if (!timeline.length) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_sidebarSection__WEBPACK_IMPORTED_MODULE_8__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Total Crash Free Users'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Timeline, {
        children: timeline.map(row => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Row, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(InnerRow, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Text, {
              bold: true,
              children: row.date.format('MMMM D')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Text, {
              bold: true,
              right: true,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_6__["default"], {
                value: row.crashFreeUserCount
              }), ' ', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.tn)('user', 'users', row.crashFreeUserCount)]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(InnerRow, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Text, {
              children: row.dateLabel
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Percent, {
              right: true,
              children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_12__.defined)(row.crashFreeUsers) ? (0,_utils__WEBPACK_IMPORTED_MODULE_13__.displayCrashFreePercent)(row.crashFreeUsers) : '-'
            })]
          })]
        }, row.date.toString()))
      })
    });
  }

}

const Timeline = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e7mioh4"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";line-height:1.2;" + ( true ? "" : 0));

const DOT_SIZE = 10;

const Row = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e7mioh3"
} : 0)("border-left:1px solid ", p => p.theme.border, ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";position:relative;&:before{content:'';width:", DOT_SIZE, "px;height:", DOT_SIZE, "px;border-radius:100%;background-color:", p => p.theme.purple300, ";position:absolute;top:0;left:-", Math.floor(DOT_SIZE / 2), "px;}&:last-child{border-left:0;}" + ( true ? "" : 0));

const InnerRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e7mioh2"
} : 0)("display:grid;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), ";grid-auto-flow:column;grid-auto-columns:1fr;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";" + ( true ? "" : 0));

const Text = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1e7mioh1"
} : 0)("text-align:", p => p.right ? 'right' : 'left', ";color:", p => p.bold ? p.theme.textColor : p.theme.gray300, ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.25), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const Percent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(Text,  true ? {
  target: "e1e7mioh0"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TotalCrashFreeUsers);

/***/ }),

/***/ "./app/views/releases/detail/utils.tsx":
/*!*********************************************!*\
  !*** ./app/views/releases/detail/utils.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateReleaseMarkLines": () => (/* binding */ generateReleaseMarkLines),
/* harmony export */   "getCommitsByRepository": () => (/* binding */ getCommitsByRepository),
/* harmony export */   "getFilesByRepository": () => (/* binding */ getFilesByRepository),
/* harmony export */   "getQuery": () => (/* binding */ getQuery),
/* harmony export */   "getReposToRender": () => (/* binding */ getReposToRender),
/* harmony export */   "releaseComparisonChartHelp": () => (/* binding */ releaseComparisonChartHelp),
/* harmony export */   "releaseComparisonChartLabels": () => (/* binding */ releaseComparisonChartLabels),
/* harmony export */   "releaseComparisonChartTitles": () => (/* binding */ releaseComparisonChartTitles),
/* harmony export */   "releaseMarkLinesLabels": () => (/* binding */ releaseMarkLinesLabels)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/components/markLine */ "./app/components/charts/components/markLine.tsx");
/* harmony import */ var sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/timeRangeSelector/utils */ "./app/components/organizations/timeRangeSelector/utils.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utils/sessionTerm */ "./app/views/releases/utils/sessionTerm.tsx");












/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 */
function getFilesByRepository(fileList) {
  return fileList.reduce((filesByRepository, file) => {
    const {
      filename,
      repoName,
      author,
      type
    } = file;

    if (!filesByRepository.hasOwnProperty(repoName)) {
      filesByRepository[repoName] = {};
    }

    if (!filesByRepository[repoName].hasOwnProperty(filename)) {
      filesByRepository[repoName][filename] = {
        authors: {},
        types: new Set()
      };
    }

    if (author.email) {
      filesByRepository[repoName][filename].authors[author.email] = author;
    }

    filesByRepository[repoName][filename].types.add(type);
    return filesByRepository;
  }, {});
}
/**
 * Convert list of individual commits into a summary grouped by repository
 */

function getCommitsByRepository(commitList) {
  return commitList.reduce((commitsByRepository, commit) => {
    var _commit$repository$na, _commit$repository;

    const repositoryName = (_commit$repository$na = (_commit$repository = commit.repository) === null || _commit$repository === void 0 ? void 0 : _commit$repository.name) !== null && _commit$repository$na !== void 0 ? _commit$repository$na : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('unknown');

    if (!commitsByRepository.hasOwnProperty(repositoryName)) {
      commitsByRepository[repositoryName] = [];
    }

    commitsByRepository[repositoryName].push(commit);
    return commitsByRepository;
  }, {});
}
/**
 * Get request query according to the url params and active repository
 */

function getQuery(_ref) {
  let {
    location,
    perPage = 40,
    activeRepository
  } = _ref;
  const query = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(location.query, [...Object.values(sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.URL_PARAM), 'cursor']),
    per_page: perPage
  };

  if (!activeRepository) {
    return query;
  }

  return { ...query,
    repo_name: activeRepository.name
  };
}
/**
 * Get repositories to render according to the activeRepository
 */

function getReposToRender(repos, activeRepository) {
  if (!activeRepository) {
    return repos;
  }

  return [activeRepository.name];
}
const releaseComparisonChartLabels = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_DURATION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Duration p50'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERROR_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Error Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.TRANSACTION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Transaction Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.FAILURE_RATE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Failure Rate')
};
const releaseComparisonChartTitles = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_SESSIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed Session Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crash Free User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.HEALTHY_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Healthy User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ABNORMAL_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Abnormal User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERRORED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Errored User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASHED_USERS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Crashed User Rate'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_DURATION]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Session Duration'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('User Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.ERROR_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Error Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.TRANSACTION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Transaction Count'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.FAILURE_RATE]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Failure Rate')
};
const releaseComparisonChartHelp = {
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.commonTermsDescription[_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.SessionTerm.CRASH_FREE_SESSIONS],
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.CRASH_FREE_USERS]: _utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.commonTermsDescription[_utils_sessionTerm__WEBPACK_IMPORTED_MODULE_10__.SessionTerm.CRASH_FREE_USERS],
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.SESSION_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('The number of sessions in a given period.'),
  [sentry_types__WEBPACK_IMPORTED_MODULE_7__.ReleaseComparisonChartType.USER_COUNT]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('The number of users in a given period.')
};

function generateReleaseMarkLine(title, position, theme, options) {
  const {
    hideLabel,
    axisIndex
  } = options || {};
  return {
    seriesName: title,
    type: 'line',
    data: [{
      name: position,
      value: null
    }],
    // TODO(ts): echart types
    yAxisIndex: axisIndex !== null && axisIndex !== void 0 ? axisIndex : undefined,
    xAxisIndex: axisIndex !== null && axisIndex !== void 0 ? axisIndex : undefined,
    color: theme.gray300,
    markLine: (0,sentry_components_charts_components_markLine__WEBPACK_IMPORTED_MODULE_3__["default"])({
      silent: true,
      lineStyle: {
        color: theme.gray300,
        type: 'solid'
      },
      label: {
        position: 'insideEndBottom',
        formatter: hideLabel ? '' : title,
        // @ts-expect-error weird echart types
        font: 'Rubik',
        fontSize: 11
      },
      data: [{
        xAxis: position
      }]
    })
  };
}

const releaseMarkLinesLabels = {
  created: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Release Created'),
  adopted: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Adopted'),
  unadopted: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Replaced')
};
function generateReleaseMarkLines(release, project, theme, location, options) {
  var _release$adoptionStag;

  const markLines = [];
  const adoptionStages = (_release$adoptionStag = release.adoptionStages) === null || _release$adoptionStag === void 0 ? void 0 : _release$adoptionStag[project.slug];
  const isSingleEnv = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_8__.decodeList)(location.query.environment).length === 1;
  const releaseBounds = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getReleaseBounds)(release);
  const {
    statsPeriod,
    ...releaseParamsRest
  } = (0,_utils__WEBPACK_IMPORTED_MODULE_9__.getReleaseParams)({
    location,
    releaseBounds
  });
  let {
    start,
    end
  } = releaseParamsRest;
  const isDefaultPeriod = !(location.query.pageStart || location.query.pageEnd || location.query.pageStatsPeriod);

  if (statsPeriod) {
    const parsedStatsPeriod = (0,sentry_components_organizations_timeRangeSelector_utils__WEBPACK_IMPORTED_MODULE_4__.parseStatsPeriod)(statsPeriod, null);
    start = parsedStatsPeriod.start;
    end = parsedStatsPeriod.end;
  }

  const releaseCreated = moment__WEBPACK_IMPORTED_MODULE_2___default()(release.dateCreated).startOf('minute');

  if (releaseCreated.isBetween(start, end) || isDefaultPeriod && releaseBounds.type === 'normal') {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.created, releaseCreated.valueOf(), theme, options));
  }

  if (!isSingleEnv || !(0,_utils__WEBPACK_IMPORTED_MODULE_9__.isMobileRelease)(project.platform)) {
    // for now want to show marklines only on mobile platforms with single environment selected
    return markLines;
  }

  const releaseAdopted = (adoptionStages === null || adoptionStages === void 0 ? void 0 : adoptionStages.adopted) && moment__WEBPACK_IMPORTED_MODULE_2___default()(adoptionStages.adopted);

  if (releaseAdopted && releaseAdopted.isBetween(start, end)) {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.adopted, releaseAdopted.valueOf(), theme, options));
  }

  const releaseReplaced = (adoptionStages === null || adoptionStages === void 0 ? void 0 : adoptionStages.unadopted) && moment__WEBPACK_IMPORTED_MODULE_2___default()(adoptionStages.unadopted);

  if (releaseReplaced && releaseReplaced.isBetween(start, end)) {
    markLines.push(generateReleaseMarkLine(releaseMarkLinesLabels.unadopted, releaseReplaced.valueOf(), theme, options));
  }

  return markLines;
}

/***/ }),

/***/ "../node_modules/core-js/modules/es.reflect.to-string-tag.js":
/*!*******************************************************************!*\
  !*** ../node_modules/core-js/modules/es.reflect.to-string-tag.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

var $ = __webpack_require__(/*! ../internals/export */ "../node_modules/core-js/internals/export.js");
var global = __webpack_require__(/*! ../internals/global */ "../node_modules/core-js/internals/global.js");
var setToStringTag = __webpack_require__(/*! ../internals/set-to-string-tag */ "../node_modules/core-js/internals/set-to-string-tag.js");

$({ global: true }, { Reflect: {} });

// Reflect[@@toStringTag] property
// https://tc39.es/ecma262/#sec-reflect-@@tostringtag
setToStringTag(global.Reflect, 'Reflect', true);


/***/ }),

/***/ "../node_modules/lodash/_baseLt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseLt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.lt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is less than `other`,
 *  else `false`.
 */
function baseLt(value, other) {
  return value < other;
}

module.exports = baseLt;


/***/ }),

/***/ "../node_modules/lodash/min.js":
/*!*************************************!*\
  !*** ../node_modules/lodash/min.js ***!
  \*************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseExtremum = __webpack_require__(/*! ./_baseExtremum */ "../node_modules/lodash/_baseExtremum.js"),
    baseLt = __webpack_require__(/*! ./_baseLt */ "../node_modules/lodash/_baseLt.js"),
    identity = __webpack_require__(/*! ./identity */ "../node_modules/lodash/identity.js");

/**
 * Computes the minimum value of `array`. If `array` is empty or falsey,
 * `undefined` is returned.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Math
 * @param {Array} array The array to iterate over.
 * @returns {*} Returns the minimum value.
 * @example
 *
 * _.min([4, 2, 8, 6]);
 * // => 2
 *
 * _.min([]);
 * // => undefined
 */
function min(array) {
  return (array && array.length)
    ? baseExtremum(array, identity, baseLt)
    : undefined;
}

module.exports = min;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_charts_worldMapChart_tsx-app_views_releases_detail_overview_index_tsx.5f2905727bf794bbabe7fe15de265f5e.js.map