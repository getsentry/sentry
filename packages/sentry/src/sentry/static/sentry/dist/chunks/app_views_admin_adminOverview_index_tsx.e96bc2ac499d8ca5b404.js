"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminOverview_index_tsx"],{

/***/ "./app/views/admin/adminOverview/apiChart.tsx":
/*!****************************************************!*\
  !*** ./app/views/admin/adminOverview/apiChart.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const initialState = {
  error: false,
  loading: true,
  rawData: {
    'client-api.all-versions.responses.2xx': [],
    'client-api.all-versions.responses.4xx': [],
    'client-api.all-versions.responses.5xx': []
  }
};

class ApiChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      const statNameList = ['client-api.all-versions.responses.2xx', 'client-api.all-versions.responses.4xx', 'client-api.all-versions.responses.5xx'];
      statNameList.forEach(statName => {
        this.props.api.request('/internal/stats/', {
          method: 'GET',
          data: {
            since: this.props.since,
            resolution: this.props.resolution,
            key: statName
          },
          success: data => {
            this.setState(prevState => {
              const rawData = prevState.rawData;
              rawData[statName] = data;
              return {
                rawData
              };
            }, this.requestFinished);
          },
          error: () => {
            this.setState({
              error: true
            });
          }
        });
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "requestFinished", () => {
      const {
        rawData
      } = this.state;

      if (rawData['client-api.all-versions.responses.2xx'] && rawData['client-api.all-versions.responses.4xx'] && rawData['client-api.all-versions.responses.5xx']) {
        this.setState({
          loading: false
        });
      }
    });
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.since !== nextProps.since) {
      this.setState(initialState, this.fetchData);
    }
  }

  processRawSeries(series) {
    return series.map(item => ({
      name: item[0] * 1000,
      value: item[1]
    }));
  }

  getChartSeries() {
    const {
      rawData
    } = this.state;
    return [{
      seriesName: '2xx',
      data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
      color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_6__["default"].green200
    }, {
      seriesName: '4xx',
      data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
      color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_6__["default"].blue300
    }, {
      seriesName: '5xx',
      data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
      color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_6__["default"].red200
    }];
  }

  render() {
    const {
      loading,
      error
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {});
    }

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRetry: this.fetchData
      });
    }

    const series = this.getChartSeries();
    const colors = series.map(_ref => {
      let {
        color
      } = _ref;
      return color;
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
      series: series,
      colors: colors,
      height: 110,
      stacked: true,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      labelYAxisExtents: true
    });
  }

}

ApiChart.displayName = "ApiChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__["default"])(ApiChart));

/***/ }),

/***/ "./app/views/admin/adminOverview/eventChart.tsx":
/*!******************************************************!*\
  !*** ./app/views/admin/adminOverview/eventChart.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const initialState = {
  error: false,
  loading: true,
  rawData: {
    'events.total': [],
    'events.dropped': []
  },
  stats: {
    received: [],
    rejected: []
  }
};

class EventChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      const statNameList = ['events.total', 'events.dropped'];
      statNameList.forEach(statName => {
        // query the organization stats via a separate call as its possible the project stats
        // are too heavy
        this.props.api.request('/internal/stats/', {
          method: 'GET',
          data: {
            since: this.props.since,
            resolution: this.props.resolution,
            key: statName
          },
          success: data => {
            this.setState(prevState => {
              const rawData = prevState.rawData;
              rawData[statName] = data;
              return {
                rawData
              };
            }, this.requestFinished);
          },
          error: () => {
            this.setState({
              error: true
            });
          }
        });
      });
    });
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.since !== nextProps.since) {
      this.setState(initialState, this.fetchData);
    }
  }

  requestFinished() {
    const {
      rawData
    } = this.state;

    if (rawData['events.total'] && rawData['events.dropped']) {
      this.processOrgData();
    }
  }

  processOrgData() {
    const {
      rawData
    } = this.state;
    const sReceived = {};
    const sRejected = {};
    const aReceived = [0, 0]; // received, points

    rawData['events.total'].forEach((point, idx) => {
      var _rawData$eventsDropp;

      const dReceived = point[1];
      const dRejected = (_rawData$eventsDropp = rawData['events.dropped'][idx]) === null || _rawData$eventsDropp === void 0 ? void 0 : _rawData$eventsDropp[1];
      const ts = point[0];

      if (sReceived[ts] === undefined) {
        sReceived[ts] = dReceived;
        sRejected[ts] = dRejected;
      } else {
        sReceived[ts] += dReceived;
        sRejected[ts] += dRejected;
      }

      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });
    this.setState({
      stats: {
        rejected: Object.keys(sRejected).map(ts => ({
          name: parseInt(ts, 10) * 1000,
          value: sRejected[ts] || 0
        })),
        accepted: Object.keys(sReceived).map(ts => ( // total number of events accepted (received - rejected)
        {
          name: parseInt(ts, 10) * 1000,
          value: sReceived[ts] - sRejected[ts]
        }))
      },
      loading: false
    });
  }

  getChartSeries() {
    const {
      stats
    } = this.state;
    return [{
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Accepted'),
      data: stats.accepted,
      color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].blue300
    }, {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Dropped'),
      data: stats.rejected,
      color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_7__["default"].red200
    }];
  }

  render() {
    const {
      loading,
      error
    } = this.state;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {});
    }

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRetry: this.fetchData
      });
    }

    const series = this.getChartSeries();
    const colors = series.map(_ref => {
      let {
        color
      } = _ref;
      return color;
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
      series: series,
      colors: colors,
      height: 110,
      stacked: true,
      isGroupedByDate: true,
      showTimeInTooltip: true,
      labelYAxisExtents: true
    });
  }

}

EventChart.displayName = "EventChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])(EventChart));

/***/ }),

/***/ "./app/views/admin/adminOverview/index.tsx":
/*!*************************************************!*\
  !*** ./app/views/admin/adminOverview/index.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _apiChart__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./apiChart */ "./app/views/admin/adminOverview/apiChart.tsx");
/* harmony import */ var _eventChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./eventChart */ "./app/views/admin/adminOverview/eventChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









const AdminOverview = () => {
  const resolution = '1h';
  const since = new Date().getTime() / 1000 - 3600 * 24 * 7;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Admin Overview'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('System Overview')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Event Throughput')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
          withPadding: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_eventChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
            since: since,
            resolution: resolution
          })
        })]
      }, "events"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('API Responses')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.PanelBody, {
          withPadding: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_apiChart__WEBPACK_IMPORTED_MODULE_4__["default"], {
            since: since,
            resolution: resolution
          })
        })]
      }, "api")]
    })
  });
};

AdminOverview.displayName = "AdminOverview";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AdminOverview);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminOverview_index_tsx.4030c27b71517f6f9d633c9c950103cd.js.map