"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminRelays_tsx"],{

/***/ "./app/components/links/linkWithConfirmation.tsx":
/*!*******************************************************!*\
  !*** ./app/components/links/linkWithConfirmation.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var _anchor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./anchor */ "./app/components/links/anchor.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * <Confirm> is a more generic version of this component
 */
function LinkWithConfirmation(_ref) {
  let {
    className,
    disabled,
    title,
    children,
    ...otherProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__["default"], { ...otherProps,
    disabled: disabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_anchor__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "#",
      className: className,
      disabled: disabled,
      title: title,
      children: children
    })
  });
}

LinkWithConfirmation.displayName = "LinkWithConfirmation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LinkWithConfirmation);

/***/ }),

/***/ "./app/views/admin/adminRelays.tsx":
/*!*****************************************!*\
  !*** ./app/views/admin/adminRelays.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AdminRelays": () => (/* binding */ AdminRelays),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/linkWithConfirmation */ "./app/components/links/linkWithConfirmation.tsx");
/* harmony import */ var sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/resultGrid */ "./app/components/resultGrid.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const prettyDate = x => moment__WEBPACK_IMPORTED_MODULE_3___default()(x).format('ll LTS');

class AdminRelays extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: false
    });
  }

  onDelete(key) {
    this.setState({
      loading: true
    });
    this.props.api.request(`/relays/${key}/`, {
      method: 'DELETE',
      success: () => this.setState({
        loading: false
      }),
      error: () => this.setState({
        loading: false
      })
    });
  }

  getRow(row) {
    return [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("strong", {
        children: row.relayId
      })
    }, "id"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      children: row.publicKey
    }, "key"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      style: {
        textAlign: 'right'
      },
      children: prettyDate(row.firstSeen)
    }, "firstSeen"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      style: {
        textAlign: 'right'
      },
      children: prettyDate(row.lastSeen)
    }, "lastSeen"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
      style: {
        textAlign: 'right'
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("span", {
        className: "editor-tools",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_4__["default"], {
          className: "danger",
          title: "Remove",
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Are you sure you wish to delete this relay?'),
          onConfirm: () => this.onDelete(row.id),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Remove')
        })
      })
    }, "tools")];
  }

  render() {
    const columns = [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("th", {
      style: {
        width: 350,
        textAlign: 'left'
      },
      children: "Relay"
    }, "id"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("th", {
      children: "Public Key"
    }, "key"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("th", {
      style: {
        width: 150,
        textAlign: 'right'
      },
      children: "First seen"
    }, "firstSeen"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("th", {
      style: {
        width: 150,
        textAlign: 'right'
      },
      children: "Last seen"
    }, "lastSeen"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("th", {}, "tools")];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Relays')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_resultGrid__WEBPACK_IMPORTED_MODULE_5__["default"], {
        path: "/manage/relays/",
        endpoint: "/relays/",
        method: "GET",
        columns: columns,
        columnsForRow: this.getRow,
        hasSearch: false,
        sortOptions: [['firstSeen', 'First seen'], ['lastSeen', 'Last seen'], ['relayId', 'Relay ID']],
        defaultSort: "firstSeen",
        ...this.props
      })]
    });
  }

}

AdminRelays.displayName = "AdminRelays";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__["default"])(AdminRelays));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminRelays_tsx.90b22ab3c97ac756e931f4bf2fb2bd17.js.map