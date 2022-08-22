"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_monitors_details_tsx"],{

/***/ "./app/components/issueList.tsx":
/*!**************************************!*\
  !*** ./app/components/issueList.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "IssueList": () => (/* binding */ IssueList),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_issues_compactIssue__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/issues/compactIssue */ "./app/components/issues/compactIssue.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

 // eslint-disable-next-line no-restricted-imports















function IssueList(_ref) {
  let {
    endpoint,
    emptyText,
    query,
    location,
    pagination,
    renderEmpty,
    noBorder,
    noMargin
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    issueIds: [],
    status: 'loading',
    pageLinks: null,
    data: []
  });
  const fetchIssueListData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    var _location$query;

    api.clear();
    api.request(endpoint, {
      method: 'GET',
      query: { ...query,
        ...(location !== null && location !== void 0 && (_location$query = location.query) !== null && _location$query !== void 0 && _location$query.cursor ? {
          cursor: location.query.cursor
        } : {})
      },
      success: (data, _, resp) => {
        var _resp$getResponseHead;

        setState({
          data,
          status: 'success',
          issueIds: data.map(item => item.id),
          pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : null
        });
      },
      error: () => {
        setState(prevState => ({ ...prevState,
          status: 'error'
        }));
      }
    });
  }, [query, endpoint, location.query, api]); // TODO: location should always be passed as a prop, check why we have this

  const hasLocation = !!location;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!hasLocation) {
      return;
    }

    setState({
      issueIds: [],
      status: 'loading',
      pageLinks: null,
      data: []
    });
    fetchIssueListData();
  }, [fetchIssueListData, hasLocation]);
  const panelStyles = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const styles = { ...(noBorder ? {
        border: 0,
        borderRadius: 0
      } : {}),
      ...(noMargin ? {
        marginBottom: 0
      } : {})
    };
    return styles;
  }, [noBorder, noMargin]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [state.status === 'loading' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
      style: {
        margin: '18px 18px 0'
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_5__["default"], {})
    }) : state.status === 'error' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("div", {
      style: {
        margin: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2)} 0`
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
        onRetry: fetchIssueListData
      })
    }) : state.issueIds.length > 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
      style: panelStyles,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
        className: "issue-list",
        children: state.data.map(issue => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_issues_compactIssue__WEBPACK_IMPORTED_MODULE_3__["default"], {
          id: issue.id,
          data: issue
        }, issue.id))
      })
    }) : renderEmpty ? renderEmpty() : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
      style: panelStyles,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_12__["default"], {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconSearch, {
          size: "xl"
        }),
        children: emptyText !== null && emptyText !== void 0 ? emptyText : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Nothing to show here, move along.')
      })
    }), pagination && state.pageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"], {
      pageLinks: state.pageLinks
    })]
  });
}

IssueList.displayName = "IssueList";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)(IssueList));

/***/ }),

/***/ "./app/utils/logging.tsx":
/*!*******************************!*\
  !*** ./app/utils/logging.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "logException": () => (/* binding */ logException)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");

function logException(ex, context) {
  _sentry_react__WEBPACK_IMPORTED_MODULE_0__.withScope(scope => {
    if (context) {
      scope.setExtra('context', context);
    }

    _sentry_react__WEBPACK_IMPORTED_MODULE_0__.captureException(ex);
  });
  /* eslint no-console:0 */

  window.console && console.error && console.error(ex);
}

/***/ }),

/***/ "./app/views/monitors/checkInIcon.tsx":
/*!********************************************!*\
  !*** ./app/views/monitors/checkInIcon.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div', {
  target: "ehlf75x0"
})("display:inline-block;position:relative;border-radius:50%;height:", p => p.size, "px;width:", p => p.size, "px;", p => p.color ? `background: ${p.color};` : `background: ${p.status === 'error' ? p.theme.error : p.status === 'ok' ? p.theme.success : p.theme.disabled};`, ";" + ( true ? "" : 0)));

/***/ }),

/***/ "./app/views/monitors/details.tsx":
/*!****************************************!*\
  !*** ./app/views/monitors/details.tsx ***!
  \****************************************/
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
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _monitorCheckIns__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./monitorCheckIns */ "./app/views/monitors/monitorCheckIns.tsx");
/* harmony import */ var _monitorHeader__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./monitorHeader */ "./app/views/monitors/monitorHeader.tsx");
/* harmony import */ var _monitorIssues__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./monitorIssues */ "./app/views/monitors/monitorIssues.tsx");
/* harmony import */ var _monitorStats__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./monitorStats */ "./app/views/monitors/monitorStats.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













class MonitorDetails extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_5__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onUpdate", data => this.setState(state => ({
      monitor: { ...state.monitor,
        ...data
      }
    })));
  }

  getEndpoints() {
    const {
      params,
      location
    } = this.props;
    return [['monitor', `/monitors/${params.monitorId}/`, {
      query: location.query
    }]];
  }

  getTitle() {
    if (this.state.monitor) {
      return `${this.state.monitor.name} - Monitors - ${this.props.params.orgId}`;
    }

    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    const {
      monitor
    } = this.state;

    if (monitor === null) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_monitorHeader__WEBPACK_IMPORTED_MODULE_7__["default"], {
        monitor: monitor,
        orgId: this.props.params.orgId,
        onUpdate: this.onUpdate
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_monitorStats__WEBPACK_IMPORTED_MODULE_9__["default"], {
        monitor: monitor
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
        style: {
          paddingBottom: 0
        },
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Related Issues')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_monitorIssues__WEBPACK_IMPORTED_MODULE_8__["default"], {
          monitor: monitor,
          orgId: this.props.params.orgId
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Recent Check-ins')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(_monitorCheckIns__WEBPACK_IMPORTED_MODULE_6__["default"], {
          monitor: monitor
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MonitorDetails);

/***/ }),

/***/ "./app/views/monitors/monitorCheckIns.tsx":
/*!************************************************!*\
  !*** ./app/views/monitors/monitorCheckIns.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MonitorCheckIns)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _checkInIcon__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./checkInIcon */ "./app/views/monitors/checkInIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









class MonitorCheckIns extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__["default"] {
  getEndpoints() {
    const {
      monitor
    } = this.props;
    return [['checkInList', `/monitors/${monitor.id}/checkins/`, {
      query: {
        per_page: 10
      }
    }]];
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ErrorWrapper, {
      children: super.renderError()
    });
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
      children: this.state.checkInList.map(checkIn => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelItem, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(CheckInIconWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_checkInIcon__WEBPACK_IMPORTED_MODULE_6__["default"], {
            status: checkIn.status,
            size: 16
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(TimeSinceWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_4__["default"], {
            date: checkIn.dateCreated
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(DurationWrapper, {
          children: checkIn.duration && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_2__["default"], {
            seconds: checkIn.duration / 100
          })
        })]
      }, checkIn.id))
    });
  }

}

const DivMargin = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19bvxt54"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(2), ";" + ( true ? "" : 0));

const CheckInIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(DivMargin,  true ? {
  target: "e19bvxt53"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const TimeSinceWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(DivMargin,  true ? {
  target: "e19bvxt52"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

const DurationWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19bvxt51"
} : 0)( true ? {
  name: "kow0uz",
  styles: "font-variant-numeric:tabular-nums"
} : 0);

const ErrorWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19bvxt50"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(3), " 0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/monitors/monitorHeader.tsx":
/*!**********************************************!*\
  !*** ./app/views/monitors/monitorHeader.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _monitorHeaderActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./monitorHeaderActions */ "./app/views/monitors/monitorHeaderActions.tsx");
/* harmony import */ var _monitorIcon__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./monitorIcon */ "./app/views/monitors/monitorIcon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const MonitorHeader = _ref => {
  let {
    monitor,
    orgId,
    onUpdate
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "release-details",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "row",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "col-sm-6 col-xs-10",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h3", {
          children: monitor.name
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
          className: "release-meta",
          children: monitor.id
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "col-sm-2 hidden-xs",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h6", {
          className: "nav-header",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Last Check-in')
        }), monitor.lastCheckIn && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_0__["default"], {
          date: monitor.lastCheckIn
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "col-sm-2 hidden-xs",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h6", {
          className: "nav-header",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Next Check-in')
        }), monitor.nextCheckIn && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_0__["default"], {
          date: monitor.nextCheckIn
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "col-sm-2",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("h6", {
          className: "nav-header",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Status')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_monitorIcon__WEBPACK_IMPORTED_MODULE_3__["default"], {
          status: monitor.status,
          size: 16
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_monitorHeaderActions__WEBPACK_IMPORTED_MODULE_2__["default"], {
      orgId: orgId,
      monitor: monitor,
      onUpdate: onUpdate
    })]
  });
};

MonitorHeader.displayName = "MonitorHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MonitorHeader);

/***/ }),

/***/ "./app/views/monitors/monitorHeaderActions.tsx":
/*!*****************************************************!*\
  !*** ./app/views/monitors/monitorHeaderActions.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_logging__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/logging */ "./app/utils/logging.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














const MonitorHeaderActions = _ref => {
  let {
    monitor,
    orgId,
    onUpdate
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__["default"])();

  const handleDelete = () => {
    const redirectPath = `/organizations/${orgId}/monitors/`;
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Deleting Monitor...'));
    api.requestPromise(`/monitors/${monitor.id}/`, {
      method: 'DELETE'
    }).then(() => {
      react_router__WEBPACK_IMPORTED_MODULE_1__.browserHistory.push(redirectPath);
    }).catch(() => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to remove monitor.'));
    });
  };

  const updateMonitor = data => {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addLoadingMessage)();
    api.requestPromise(`/monitors/${monitor.id}/`, {
      method: 'PUT',
      data
    }).then(resp => {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.clearIndicators)();
      onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate(resp);
    }).catch(err => {
      (0,sentry_utils_logging__WEBPACK_IMPORTED_MODULE_9__.logException)(err);
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_2__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to update monitor.'));
    });
  };

  const toggleStatus = () => updateMonitor({
    status: monitor.status === 'disabled' ? 'active' : 'disabled'
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(ButtonContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      gap: 1,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconEdit, {
          size: "xs"
        }),
        to: `/organizations/${orgId}/monitors/${monitor.id}/edit/`,
        children: ["\xA0", (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Edit')]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
        size: "sm",
        onClick: toggleStatus,
        children: monitor.status !== 'disabled' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Pause') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enable')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__["default"], {
        onConfirm: handleDelete,
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Deleting this monitor is permanent. Are you sure you wish to continue?'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          size: "sm",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconDelete, {
            size: "xs"
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Delete')
        })
      })]
    })
  });
};

MonitorHeaderActions.displayName = "MonitorHeaderActions";

const ButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e11hcv560"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";display:flex;flex-shrink:1;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MonitorHeaderActions);

/***/ }),

/***/ "./app/views/monitors/monitorIcon.tsx":
/*!********************************************!*\
  !*** ./app/views/monitors/monitorIcon.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div', {
  target: "ezalhst0"
})("display:inline-block;position:relative;border-radius:50%;height:", p => p.size, "px;width:", p => p.size, "px;", p => p.color ? `background: ${p.color};` : `background: ${p.status === 'error' ? p.theme.error : p.status === 'ok' ? p.theme.success : p.theme.disabled};`, ";" + ( true ? "" : 0)));

/***/ }),

/***/ "./app/views/monitors/monitorIssues.tsx":
/*!**********************************************!*\
  !*** ./app/views/monitors/monitorIssues.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_issueList__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/issueList */ "./app/components/issueList.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const MonitorIssues = _ref => {
  let {
    orgId,
    monitor
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_issueList__WEBPACK_IMPORTED_MODULE_0__["default"], {
    endpoint: `/organizations/${orgId}/issues/`,
    query: {
      query: 'monitor.id:"' + monitor.id + '"',
      project: monitor.project.id,
      limit: 5
    },
    pagination: false,
    emptyText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('No issues found'),
    noBorder: true,
    noMargin: true
  });
};

MonitorIssues.displayName = "MonitorIssues";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MonitorIssues);

/***/ }),

/***/ "./app/views/monitors/monitorStats.tsx":
/*!*********************************************!*\
  !*** ./app/views/monitors/monitorStats.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MonitorStats)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/miniBarChart */ "./app/components/charts/miniBarChart.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







class MonitorStats extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getEndpoints() {
    const {
      monitor
    } = this.props;
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    return [['stats', `/monitors/${monitor.id}/stats/`, {
      query: {
        since,
        until,
        resolution: '1d'
      }
    }]];
  }

  renderBody() {
    var _this$state$stats;

    let emptyStats = true;
    const success = {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Successful'),
      data: []
    };
    const failed = {
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Failed'),
      data: []
    };
    (_this$state$stats = this.state.stats) === null || _this$state$stats === void 0 ? void 0 : _this$state$stats.forEach(p => {
      if (p.ok || p.error) {
        emptyStats = false;
      }

      const timestamp = p.ts * 1000;
      success.data.push({
        name: timestamp.toString(),
        value: p.ok
      });
      failed.data.push({
        name: timestamp.toString(),
        value: p.error
      });
    });
    const colors = [sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].green300, sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].red300];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
        withPadding: true,
        children: !emptyStats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_charts_miniBarChart__WEBPACK_IMPORTED_MODULE_1__["default"], {
          isGroupedByDate: true,
          showTimeInTooltip: true,
          labelYAxisExtents: true,
          stacked: true,
          colors: colors,
          height: 150,
          series: [success, failed]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_5__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Nothing recorded in the last 30 days.'),
          description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('All check-ins for this monitor.')
        })
      })
    });
  }

}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_monitors_details_tsx.932e5746c6da9ba5fed4f95701906907.js.map