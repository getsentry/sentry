"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminQueue_tsx"],{

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

/***/ "./app/views/admin/adminQueue.tsx":
/*!****************************************!*\
  !*** ./app/views/admin/adminQueue.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AdminQueue)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_deprecatedforms__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/deprecatedforms */ "./app/components/deprecatedforms/index.tsx");
/* harmony import */ var sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/internalStatChart */ "./app/components/internalStatChart.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const TIME_WINDOWS = ['1h', '1d', '1w'];
class AdminQueue extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_7__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      timeWindow: '1w',
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
      taskName: null
    };
  }

  getEndpoints() {
    return [['taskList', '/internal/queue/tasks/']];
  }

  changeWindow(timeWindow) {
    let seconds;

    if (timeWindow === '1h') {
      seconds = 3600;
    } else if (timeWindow === '1d') {
      seconds = 3600 * 24;
    } else if (timeWindow === '1w') {
      seconds = 3600 * 24 * 7;
    } else {
      throw new Error('Invalid time window');
    }

    this.setState({
      since: new Date().getTime() / 1000 - seconds,
      timeWindow
    });
  }

  changeTask(value) {
    this.setState({
      activeTask: value
    });
  }

  renderBody() {
    const {
      activeTask,
      taskList
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
          children: "Queue Overview"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
          merged: true,
          active: this.state.timeWindow,
          children: TIME_WINDOWS.map(r => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            size: "sm",
            barId: r,
            onClick: () => this.changeWindow(r),
            children: r
          }, r))
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
          children: "Global Throughput"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
          withPadding: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
            since: this.state.since,
            resolution: this.state.resolution,
            stat: "jobs.all.started",
            label: "jobs started"
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
        children: "Task Details"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
          className: "m-b-1",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("label", {
            children: "Show details for task:"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_deprecatedforms__WEBPACK_IMPORTED_MODULE_4__.SelectField, {
            name: "task",
            onChange: value => this.changeTask(value),
            value: activeTask,
            clearable: true,
            options: taskList.map(t => ({
              value: t,
              label: t
            }))
          })]
        }), activeTask ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
              children: ["Jobs Started ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("small", {
                children: activeTask
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
              withPadding: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
                since: this.state.since,
                resolution: this.state.resolution,
                stat: `jobs.started.${activeTask}`,
                label: "jobs",
                height: 100
              })
            })]
          }, `jobs.started.${activeTask}`), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
              children: ["Jobs Finished ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("small", {
                children: activeTask
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
              withPadding: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_internalStatChart__WEBPACK_IMPORTED_MODULE_5__["default"], {
                since: this.state.since,
                resolution: this.state.resolution,
                stat: `jobs.finished.${activeTask}`,
                label: "jobs",
                height: 100
              })
            })]
          }, `jobs.finished.${activeTask}`)]
        }) : null]
      })]
    });
  }

}

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eevg6610"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);

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
//# sourceMappingURL=../sourcemaps/app_views_admin_adminQueue_tsx.1eb4c5cb71fa6643626a4ed6f2c271ec.js.map