"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminBuffer_tsx"],{

/***/ "./app/components/internalStatChart.tsx":
/*!**********************************************!*\
  !*** ./app/components/internalStatChart.tsx ***!
  \**********************************************/
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
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class InternalStatChart extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      error: false,
      loading: true,
      data: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      this.setState({
        loading: true
      });
      this.props.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: this.props.resolution,
          key: this.props.stat
        },
        success: data => this.setState({
          data,
          loading: false,
          error: false
        }),
        error: () => this.setState({
          error: true,
          loading: false
        })
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(_nextProps, nextState) {
    return this.state.loading !== nextState.loading;
  }

  componentDidUpdate(prevProps) {
    if (prevProps.since !== this.props.since || prevProps.stat !== this.props.stat || prevProps.resolution !== this.props.resolution) {
      this.fetchData();
    }
  }

  render() {
    var _data$map;

    const {
      loading,
      error,
      data
    } = this.state;
    const {
      label,
      height
    } = this.props;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {});
    }

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRetry: this.fetchData
      });
    }

    const series = {
      seriesName: label,
      data: (_data$map = data === null || data === void 0 ? void 0 : data.map(_ref => {
        let [timestamp, value] = _ref;
        return {
          name: timestamp * 1000,
          value
        };
      })) !== null && _data$map !== void 0 ? _data$map : []
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_3__["default"], {
      height: height !== null && height !== void 0 ? height : 150,
      series: [series],
      isGroupedByDate: true,
      showTimeInTooltip: true,
      labelYAxisExtents: true
    });
  }

}

InternalStatChart.displayName = "InternalStatChart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_6__["default"])(InternalStatChart));

/***/ }),

/***/ "./app/views/admin/adminBuffer.tsx":
/*!*****************************************!*\
  !*** ./app/views/admin/adminBuffer.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/internalStatChart */ "./app/components/internalStatChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const AdminBuffer = () => {
  const since = new Date().getTime() / 1000 - 3600 * 24 * 7;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("h3", {
      children: "Buffers"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
      className: "box",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
        className: "box-header",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("h4", {
          children: "About"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
        className: "box-content with-padding",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("p", {
          children: ["Sentry buffers are responsible for making changes to cardinality counters \u2014 such as an issues event count \u2014 as well as updating attributes like", ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("em", {
            children: "last seen"
          }), ". These are flushed on a regularly interval, and are directly affected by the queue backlog."]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
      className: "box",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
        className: "box-header",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("h4", {
          children: "Updates Processed"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_0__["default"], {
        since: since,
        resolution: "1h",
        stat: "jobs.finished.sentry.tasks.process_buffer.process_incr",
        label: "Jobs"
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsxs)("div", {
      className: "box",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
        className: "box-header",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("h4", {
          children: "Revoked Updates"
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_0__["default"], {
        since: since,
        resolution: "1h",
        stat: "buffer.revoked",
        label: "Jobs"
      })]
    })]
  });
};

AdminBuffer.displayName = "AdminBuffer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AdminBuffer);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminBuffer_tsx.fe0d2cd086e536614501044f082a3960.js.map