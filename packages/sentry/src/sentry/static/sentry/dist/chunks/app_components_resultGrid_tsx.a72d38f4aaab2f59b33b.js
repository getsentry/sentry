"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_resultGrid_tsx"],{

/***/ "./app/components/resultGrid.tsx":
/*!***************************************!*\
  !*** ./app/components/resultGrid.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ResultGrid": () => (/* binding */ ResultGrid),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/menuItem */ "./app/components/menuItem.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class Filter extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getSelector", () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      title: this.getCurrentLabel(),
      children: [this.getDefaultItem(), this.props.options.map(_ref => {
        let [value, label] = _ref;
        const filterQuery = {
          [this.props.queryKey]: value,
          cursor: ''
        };
        const query = { ...this.props.location.query,
          ...filterQuery
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
          isActive: this.props.value === value,
          to: {
            pathname: this.props.path,
            query
          },
          children: label
        }, value);
      })]
    }));
  }

  getCurrentLabel() {
    const selected = this.props.options.find(item => {
      var _this$props$value;

      return item[0] === ((_this$props$value = this.props.value) !== null && _this$props$value !== void 0 ? _this$props$value : '');
    });

    if (selected) {
      return this.props.name + ': ' + selected[1];
    }

    return this.props.name + ': ' + 'Any';
  }

  getDefaultItem() {
    const query = { ...this.props.location.query,
      cursor: ''
    };
    delete query[this.props.queryKey];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
      isActive: this.props.value === '' || !this.props.value,
      to: {
        pathname: this.props.path,
        query
      },
      children: "Any"
    }, "");
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
      className: "filter-options",
      children: this.props.options.length === 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {
        children: this.getCurrentLabel()
      }) : this.getSelector()
    });
  }

}

Filter.displayName = "Filter";

class SortBy extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  getCurrentSortLabel() {
    var _this$props$options$f;

    return (_this$props$options$f = this.props.options.find(_ref2 => {
      let [value] = _ref2;
      return value === this.props.value;
    })) === null || _this$props$options$f === void 0 ? void 0 : _this$props$options$f[1];
  }

  getSortBySelector() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
      title: this.getCurrentSortLabel(),
      className: "sorted-by",
      children: this.props.options.map(_ref3 => {
        let [value, label] = _ref3;
        const query = { ...this.props.location.query,
          sortBy: value,
          cursor: ''
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_menuItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
          isActive: this.props.value === value,
          to: {
            pathname: this.props.path,
            query
          },
          children: label
        }, value);
      })
    });
  }

  render() {
    if (this.props.options.length === 0) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      className: "sort-options",
      children: ["Showing results sorted by", this.props.options.length === 1 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {
        className: "sorted-by",
        children: this.getCurrentSortLabel()
      }) : this.getSortBySelector()]
    });
  }

}

SortBy.displayName = "SortBy";

class ResultGrid extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.defaultState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSearch", e => {
      var _this$props$location, _location$query;

      const location = (_this$props$location = this.props.location) !== null && _this$props$location !== void 0 ? _this$props$location : {};
      const {
        query
      } = this.state;
      const targetQueryParams = { ...((_location$query = location.query) !== null && _location$query !== void 0 ? _location$query : {}),
        query,
        cursor: ''
      };
      e.preventDefault();
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
        pathname: this.props.path,
        query: targetQueryParams
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onQueryChange", evt => {
      this.setState({
        query: evt.target.value
      });
    });
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps() {
    var _queryParams$query, _queryParams$sortBy;

    const queryParams = this.query;
    this.setState({
      query: (_queryParams$query = queryParams.query) !== null && _queryParams$query !== void 0 ? _queryParams$query : '',
      sortBy: (_queryParams$sortBy = queryParams.sortBy) !== null && _queryParams$sortBy !== void 0 ? _queryParams$sortBy : this.props.defaultSort,
      filters: { ...queryParams
      },
      pageLinks: null,
      loading: true,
      error: false
    }, this.fetchData);
  }

  get defaultState() {
    var _queryParams$query2, _queryParams$sortBy2;

    const queryParams = this.query;
    return {
      rows: [],
      loading: true,
      error: false,
      pageLinks: null,
      query: (_queryParams$query2 = queryParams.query) !== null && _queryParams$query2 !== void 0 ? _queryParams$query2 : '',
      sortBy: (_queryParams$sortBy2 = queryParams.sortBy) !== null && _queryParams$sortBy2 !== void 0 ? _queryParams$sortBy2 : this.props.defaultSort,
      filters: { ...queryParams
      }
    };
  }

  get query() {
    var _query, _this$props$location2;

    return (_query = ((_this$props$location2 = this.props.location) !== null && _this$props$location2 !== void 0 ? _this$props$location2 : {}).query) !== null && _query !== void 0 ? _query : {};
  }

  remountComponent() {
    this.setState(this.defaultState, this.fetchData);
  }

  refresh() {
    this.setState({
      loading: true
    }, this.fetchData);
  }

  fetchData() {
    // TODO(dcramer): this should explicitly allow filters/sortBy/cursor/perPage
    const queryParams = { ...this.props.defaultParams,
      sortBy: this.state.sortBy,
      ...this.query
    };
    this.props.api.request(this.props.endpoint, {
      method: this.props.method,
      data: queryParams,
      success: (data, _, resp) => {
        var _resp$getResponseHead;

        this.setState({
          loading: false,
          error: false,
          rows: data,
          pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : null
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tr", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("td", {
        colSpan: this.props.columns.length,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
          className: "loading",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
            className: "loading-indicator"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
            className: "loading-message",
            children: "Hold on to your butts!"
          })]
        })
      })
    });
  }

  renderError() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tr", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("td", {
        colSpan: this.props.columns.length,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
          className: "alert-block alert-error",
          children: "Something bad happened :("
        })
      })
    });
  }

  renderNoResults() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tr", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("td", {
        colSpan: this.props.columns.length,
        children: "No results found."
      })
    });
  }

  renderResults() {
    return this.state.rows.map(row => {
      var _this$props$keyForRow, _this$props, _this$props$columnsFo, _this$props2;

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tr", {
        children: (_this$props$columnsFo = (_this$props2 = this.props).columnsForRow) === null || _this$props$columnsFo === void 0 ? void 0 : _this$props$columnsFo.call(_this$props2, row)
      }, (_this$props$keyForRow = (_this$props = this.props).keyForRow) === null || _this$props$keyForRow === void 0 ? void 0 : _this$props$keyForRow.call(_this$props, row));
    });
  }

  render() {
    const {
      filters,
      sortOptions,
      path,
      location
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
      className: "result-grid",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
        className: "table-options",
        children: [this.props.hasSearch && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
          className: "result-grid-search",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("form", {
            onSubmit: this.onSearch,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("div", {
              className: "form-group",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("input", {
                type: "text",
                className: "form-control input-search",
                placeholder: "search",
                style: {
                  width: 300
                },
                name: "query",
                autoComplete: "off",
                value: this.state.query,
                onChange: this.onQueryChange
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("button", {
                type: "submit",
                className: "btn btn-sm btn-primary",
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconSearch, {
                  size: "xs"
                })
              })]
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SortBy, {
          options: sortOptions !== null && sortOptions !== void 0 ? sortOptions : [],
          value: this.state.sortBy,
          path: path !== null && path !== void 0 ? path : '',
          location: location
        }), Object.keys(filters !== null && filters !== void 0 ? filters : {}).map(filterKey => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Filter, {
          queryKey: filterKey,
          value: this.state.filters[filterKey],
          path: path !== null && path !== void 0 ? path : '',
          location: location,
          ...(filters === null || filters === void 0 ? void 0 : filters[filterKey])
        }, filterKey))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("table", {
        className: "table table-grid",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("thead", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tr", {
            children: this.props.columns
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("tbody", {
          children: this.state.loading ? this.renderLoading() : this.state.error ? this.renderError() : this.state.rows.length === 0 ? this.renderNoResults() : this.renderResults()
        })]
      }), this.props.hasPagination && this.state.pageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"], {
        pageLinks: this.state.pageLinks
      })]
    });
  }

}

ResultGrid.displayName = "ResultGrid";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ResultGrid, "defaultProps", {
  path: '',
  endpoint: '',
  method: 'GET',
  columns: [],
  sortOptions: [],
  filters: {},
  defaultSort: '',
  keyForRow: row => row.id,
  columnsForRow: () => [],
  defaultParams: {
    per_page: 50
  },
  hasPagination: true,
  hasSearch: false
});


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_8__["default"])(ResultGrid));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_resultGrid_tsx.e536ce7e21043ff12912876f1f511104.js.map