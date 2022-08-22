"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminQuotas_tsx"],{

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

/***/ "./app/views/admin/adminQuotas.tsx":
/*!*****************************************!*\
  !*** ./app/views/admin/adminQuotas.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AdminQuotas)
/* harmony export */ });
/* harmony import */ var sentry_components_deprecatedforms__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/deprecatedforms */ "./app/components/deprecatedforms/index.tsx");
/* harmony import */ var sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/internalStatChart */ "./app/components/internalStatChart.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





class AdminQuotas extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_2__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h'
    };
  }

  getEndpoints() {
    return [['config', '/internal/quotas/']];
  }

  renderBody() {
    const {
      config
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h3", {
        children: "Quotas"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "box",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "box-header",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h4", {
            children: "Config"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          className: "box-content with-padding",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_deprecatedforms__WEBPACK_IMPORTED_MODULE_0__.TextField, {
            name: "backend",
            value: config.backend,
            label: "Backend",
            disabled: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_deprecatedforms__WEBPACK_IMPORTED_MODULE_0__.TextField, {
            name: "rateLimit",
            value: config.options['system.rate-limit'],
            label: "Rate Limit",
            disabled: true
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "box",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "box-header",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h4", {
            children: "Total Events"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_1__["default"], {
          since: this.state.since,
          resolution: this.state.resolution,
          stat: "events.total",
          label: "Events"
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        className: "box",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          className: "box-header",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("h4", {
            children: "Dropped Events"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_1__["default"], {
          since: this.state.since,
          resolution: this.state.resolution,
          stat: "events.dropped",
          label: "Events"
        })]
      })]
    });
  }

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
//# sourceMappingURL=../sourcemaps/app_views_admin_adminQuotas_tsx.379bd05a02704e770fea42f33a95cb7c.js.map