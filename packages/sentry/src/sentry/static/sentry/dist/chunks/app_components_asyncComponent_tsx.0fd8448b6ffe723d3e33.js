"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_asyncComponent_tsx"],{

/***/ "./app/components/asyncComponent.tsx":
/*!*******************************************!*\
  !*** ./app/components/asyncComponent.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! prop-types */ "../node_modules/prop-types/index.js");
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(prop_types__WEBPACK_IMPORTED_MODULE_16__);
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_components_asyncComponentSearchInput__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponentSearchInput */ "./app/components/asyncComponentSearchInput.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/getRouteStringFromRoutes */ "./app/utils/getRouteStringFromRoutes.tsx");
/* harmony import */ var sentry_views_permissionDenied__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/permissionDenied */ "./app/views/permissionDenied.tsx");
/* harmony import */ var sentry_views_routeError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/routeError */ "./app/views/routeError.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















/**
 * Wraps methods on the AsyncComponent to catch errors and set the `error`
 * state on error.
 */
function wrapErrorHandling(component, fn) {
  return function () {
    try {
      return fn(...arguments);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      window.setTimeout(() => {
        throw error;
      });
      component.setState({
        error
      });
      return null;
    }
  };
}

class AsyncComponent extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor(props, context) {
    var _this;

    super(props, context);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "reloadOnVisible", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReloadOnVisible", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "api", new sentry_api__WEBPACK_IMPORTED_MODULE_5__.Client());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_measurement", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "markShouldMeasure", function () {
      let {
        remainingRequests,
        error
      } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (!_this._measurement.hasMeasured) {
        _this._measurement.finished = remainingRequests === 0;
        _this._measurement.error = error || _this._measurement.error;
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "remountComponent", () => {
      if (this.shouldReload) {
        this.reloadData();
      } else {
        this.setState(this.getDefaultState(), this.fetchData);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "visibilityReloader", () => this.shouldReloadOnVisible && !this.state.loading && !document.hidden && this.reloadData());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", extraState => {
      const endpoints = this.getEndpoints();

      if (!endpoints.length) {
        this.setState({
          loading: false,
          error: false
        });
        return;
      } // Cancel any in flight requests


      this.api.clear();
      this.setState({
        loading: true,
        error: false,
        remainingRequests: endpoints.length,
        ...extraState
      });
      endpoints.forEach(_ref => {
        let [stateKey, endpoint, params, options] = _ref;
        options = options || {}; // If you're using nested async components/views make sure to pass the
        // props through so that the child component has access to props.location

        const locationQuery = this.props.location && this.props.location.query || {};
        let query = params && params.query || {}; // If paginate option then pass entire `query` object to API call
        // It should only be expecting `query.cursor` for pagination

        if ((options.paginate || locationQuery.cursor) && !options.disableEntireQuery) {
          query = { ...locationQuery,
            ...query
          };
        }

        this.api.request(endpoint, {
          method: 'GET',
          ...params,
          query,
          success: (data, _, resp) => {
            this.handleRequestSuccess({
              stateKey,
              data,
              resp
            }, true);
          },
          error: error => {
            // Allow endpoints to fail
            // allowError can have side effects to handle the error
            if (options.allowError && options.allowError(error)) {
              error = null;
            }

            this.handleError(error, [stateKey, endpoint, params, options]);
          }
        });
      });
    });

    this.fetchData = wrapErrorHandling(this, this.fetchData.bind(this));
    this.render = wrapErrorHandling(this, this.render.bind(this));
    this.state = this.getDefaultState();
    this._measurement = {
      hasMeasured: false
    };

    if (props.routes && props.routes) {
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_10__.metric.mark({
        name: `async-component-${(0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_11__["default"])(props.routes)}`
      });
    }
  }

  UNSAFE_componentWillMount() {
    this.api = new sentry_api__WEBPACK_IMPORTED_MODULE_5__.Client();
    this.fetchData();

    if (this.reloadOnVisible) {
      document.addEventListener('visibilitychange', this.visibilityReloader);
    }
  }

  componentDidUpdate(prevProps, prevContext) {
    const isRouterInContext = !!prevContext.router;
    const isLocationInProps = prevProps.location !== undefined;
    const currentLocation = isLocationInProps ? this.props.location : isRouterInContext ? this.context.router.location : null;
    const prevLocation = isLocationInProps ? prevProps.location : isRouterInContext ? prevContext.router.location : null;

    if (!(currentLocation && prevLocation)) {
      return;
    } // Take a measurement from when this component is initially created until it finishes it's first
    // set of API requests


    if (!this._measurement.hasMeasured && this._measurement.finished && this.props.routes) {
      const routeString = (0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_11__["default"])(this.props.routes);
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_10__.metric.measure({
        name: 'app.component.async-component',
        start: `async-component-${routeString}`,
        data: {
          route: routeString,
          error: this._measurement.error
        }
      });
      this._measurement.hasMeasured = true;
    } // Re-fetch data when router params change.


    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_4___default()(this.props.params, prevProps.params) || currentLocation.search !== prevLocation.search || currentLocation.state !== prevLocation.state) {
      this.remountComponent();
    }
  }

  componentWillUnmount() {
    this.api.clear();
    document.removeEventListener('visibilitychange', this.visibilityReloader);
  }
  /**
   * Override this flag to have the component reload its state when the window
   * becomes visible again. This will set the loading and reloading state, but
   * will not render a loading state during reloading.
   *
   * eslint-disable-next-line react/sort-comp
   */


  // XXX: can't call this getInitialState as React whines
  getDefaultState() {
    const endpoints = this.getEndpoints();
    const state = {
      // has all data finished requesting?
      loading: true,
      // is the component reload
      reloading: false,
      // is there an error loading ANY data?
      error: false,
      errors: {}
    };
    endpoints.forEach(_ref2 => {
      let [stateKey, _endpoint] = _ref2;
      state[stateKey] = null;
    });
    return state;
  } // Check if we should measure render time for this component


  reloadData() {
    this.fetchData({
      reloading: true
    });
  }

  onRequestSuccess(_resp
  /* {stateKey, data, resp} */
  ) {// Allow children to implement this
  }

  onRequestError(_resp, _args) {// Allow children to implement this
  }

  onLoadAllEndpointsSuccess() {// Allow children to implement this
  }

  handleRequestSuccess(_ref3, initialRequest) {
    let {
      stateKey,
      data,
      resp
    } = _ref3;
    this.setState(prevState => {
      const state = {
        [stateKey]: data,
        // TODO(billy): This currently fails if this request is retried by SudoModal
        [`${stateKey}PageLinks`]: resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')
      };

      if (initialRequest) {
        state.remainingRequests = prevState.remainingRequests - 1;
        state.loading = prevState.remainingRequests > 1;
        state.reloading = prevState.reloading && state.loading;
        this.markShouldMeasure({
          remainingRequests: state.remainingRequests
        });
      }

      return state;
    }, () => {
      // if everything is loaded and we don't have an error, call the callback
      if (this.state.remainingRequests === 0 && !this.state.error) {
        this.onLoadAllEndpointsSuccess();
      }
    });
    this.onRequestSuccess({
      stateKey,
      data,
      resp
    });
  }

  handleError(error, args) {
    const [stateKey] = args;

    if (error && error.responseText) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_14__.addBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error'
      });
    }

    this.setState(prevState => {
      const loading = prevState.remainingRequests > 1;
      const state = {
        [stateKey]: null,
        errors: { ...prevState.errors,
          [stateKey]: error
        },
        error: prevState.error || !!error,
        remainingRequests: prevState.remainingRequests - 1,
        loading,
        reloading: prevState.reloading && loading
      };
      this.markShouldMeasure({
        remainingRequests: state.remainingRequests,
        error: true
      });
      return state;
    });
    this.onRequestError(error, args);
  }
  /**
   * Return a list of endpoint queries to make.
   *
   * return [
   *   ['stateKeyName', '/endpoint/', {optional: 'query params'}, {options}]
   * ]
   */


  getEndpoints() {
    return [];
  }

  renderSearchInput(_ref4) {
    let {
      stateKey,
      url,
      ...props
    } = _ref4;
    const [firstEndpoint] = this.getEndpoints() || [null];
    const stateKeyOrDefault = stateKey || firstEndpoint && firstEndpoint[0];
    const urlOrDefault = url || firstEndpoint && firstEndpoint[1];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_asyncComponentSearchInput__WEBPACK_IMPORTED_MODULE_6__["default"], {
      url: urlOrDefault,
      ...props,
      api: this.api,
      onSuccess: (data, resp) => {
        this.handleRequestSuccess({
          stateKey: stateKeyOrDefault,
          data,
          resp
        });
      },
      onError: () => {
        this.renderError(new Error('Error with AsyncComponentSearchInput'));
      }
    });
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {});
  }

  renderError(error) {
    let disableLog = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const {
      errors
    } = this.state; // 401s are captured by SudoModal, but may be passed back to AsyncComponent if they close the modal without identifying

    const unauthorizedErrors = Object.values(errors).find(resp => (resp === null || resp === void 0 ? void 0 : resp.status) === 401); // Look through endpoint results to see if we had any 403s, means their role can not access resource

    const permissionErrors = Object.values(errors).find(resp => (resp === null || resp === void 0 ? void 0 : resp.status) === 403); // If all error responses have status code === 0, then show error message but don't
    // log it to sentry

    const shouldLogSentry = !!Object.values(errors).find(resp => (resp === null || resp === void 0 ? void 0 : resp.status) !== 0) || disableLog;

    if (unauthorizedErrors) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('You are not authorized to access this resource.')
      });
    }

    if (permissionErrors) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_permissionDenied__WEBPACK_IMPORTED_MODULE_12__["default"], {});
    }

    if (this.shouldRenderBadRequests) {
      const badRequests = Object.values(errors).filter(resp => {
        var _resp$responseJSON;

        return (resp === null || resp === void 0 ? void 0 : resp.status) === 400 && (resp === null || resp === void 0 ? void 0 : (_resp$responseJSON = resp.responseJSON) === null || _resp$responseJSON === void 0 ? void 0 : _resp$responseJSON.detail);
      }).map(resp => resp.responseJSON.detail);

      if (badRequests.length) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__["default"], {
          message: [...new Set(badRequests)].join('\n')
        });
      }
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_routeError__WEBPACK_IMPORTED_MODULE_13__["default"], {
      error: error,
      disableLogSentry: !shouldLogSentry,
      disableReport: this.disableErrorReport
    });
  }

  get shouldRenderLoading() {
    return this.state.loading && (!this.shouldReload || !this.state.reloading);
  }

  renderComponent() {
    return this.shouldRenderLoading ? this.renderLoading() : this.state.error ? this.renderError(new Error('Unable to load all required endpoints')) : this.renderBody();
  }
  /**
   * Renders once all endpoints have been loaded
   */


  renderBody() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  render() {
    return this.renderComponent();
  }

}

AsyncComponent.displayName = "AsyncComponent";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AsyncComponent, "contextTypes", {
  router: prop_types__WEBPACK_IMPORTED_MODULE_16__.object
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AsyncComponent);

/***/ }),

/***/ "./app/components/asyncComponentSearchInput.tsx":
/*!******************************************************!*\
  !*** ./app/components/asyncComponentSearchInput.tsx ***!
  \******************************************************/
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
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports









/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
 */
class AsyncComponentSearchInput extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      query: '',
      busy: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "immediateQuery", async searchQuery => {
      const {
        location,
        api
      } = this.props;
      this.setState({
        busy: true
      });

      try {
        const [data,, resp] = await api.requestPromise(`${this.props.url}`, {
          includeAllArgs: true,
          method: 'GET',
          query: { ...location.query,
            query: searchQuery
          }
        }); // only update data if the request's query matches the current query

        if (this.state.query === searchQuery) {
          this.props.onSuccess(data, resp);
        }
      } catch {
        this.props.onError();
      }

      this.setState({
        busy: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "query", lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default()(this.immediateQuery, this.props.debounceWait));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", query => {
      this.query(query);
      this.setState({
        query
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleInputChange", evt => this.handleChange(evt.target.value));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", evt => {
      const {
        updateRoute,
        onSearchSubmit
      } = this.props;
      evt.preventDefault(); // Update the URL to reflect search term.

      if (updateRoute) {
        const {
          router,
          location
        } = this.props;
        router.push({
          pathname: location.pathname,
          query: {
            query: this.state.query
          }
        });
      }

      if (typeof onSearchSubmit !== 'function') {
        return;
      }

      onSearchSubmit(this.state.query, evt);
    });
  }

  render() {
    const {
      placeholder,
      children,
      className
    } = this.props;
    const {
      busy,
      query
    } = this.state;

    const defaultSearchBar = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Form, {
      onSubmit: this.handleSearch,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_6__["default"], {
        value: query,
        onChange: this.handleInputChange,
        className: className,
        placeholder: placeholder
      }), busy && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledLoadingIndicator, {
        size: 18,
        hideMessage: true,
        mini: true
      })]
    });

    return children === undefined ? defaultSearchBar : children({
      defaultSearchBar,
      busy,
      value: query,
      handleChange: this.handleChange
    });
  }

}

AsyncComponentSearchInput.displayName = "AsyncComponentSearchInput";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AsyncComponentSearchInput, "defaultProps", {
  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Search...'),
  debounceWait: 200
});

const StyledLoadingIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "eup3waa1"
} : 0)( true ? {
  name: "1jyfazj",
  styles: "position:absolute;right:25px;top:50%;transform:translateY(-13px)"
} : 0);

const Form = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('form',  true ? {
  target: "eup3waa0"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(AsyncComponentSearchInput));

/***/ }),

/***/ "./app/components/loadingError.tsx":
/*!*****************************************!*\
  !*** ./app/components/loadingError.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * Renders an Alert box of type "error". Renders a "Retry" button only if a
 * `onRetry` callback is defined.
 */
function LoadingError(_ref) {
  let {
    className,
    onRetry,
    message = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('There was an error loading data.')
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledAlert, {
    type: "error",
    "data-test-id": "loading-error",
    showIcon: true,
    className: className,
    trailingItems: onRetry && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
      onClick: onRetry,
      type: "button",
      priority: "default",
      size: "sm",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Retry')
    }),
    children: message
  });
}

LoadingError.displayName = "LoadingError";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingError);

const StyledAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1aoltpz0"
} : 0)(
/* sc-selector */
sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, " &{border-radius:0;border-width:1px 0;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/sentryDocumentTitle.tsx":
/*!************************************************!*\
  !*** ./app/components/sentryDocumentTitle.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_document_title__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-document-title */ "../node_modules/react-document-title/index.js");
/* harmony import */ var react_document_title__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_document_title__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



/**
 * Assigns the document title. The deepest nested version of this title will be
 * the one which is assigned.
 */
function SentryDocumentTitle(_ref) {
  let {
    title = '',
    orgSlug,
    projectSlug,
    noSuffix,
    children
  } = _ref;

  function getPageTitle() {
    if (orgSlug && projectSlug) {
      return `${title} - ${orgSlug} - ${projectSlug}`;
    }

    if (orgSlug) {
      return `${title} - ${orgSlug}`;
    }

    if (projectSlug) {
      return `${title} - ${projectSlug}`;
    }

    return title;
  }

  const pageTitle = getPageTitle();
  const documentTitle = noSuffix ? pageTitle : pageTitle !== '' ? `${pageTitle} - Sentry` : 'Sentry';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)((react_document_title__WEBPACK_IMPORTED_MODULE_0___default()), {
    title: documentTitle,
    children: children
  });
}

SentryDocumentTitle.displayName = "SentryDocumentTitle";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SentryDocumentTitle);

/***/ }),

/***/ "./app/styles/organization.tsx":
/*!*************************************!*\
  !*** ./app/styles/organization.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HeaderTitle": () => (/* binding */ HeaderTitle),
/* harmony export */   "PageContent": () => (/* binding */ PageContent),
/* harmony export */   "PageHeader": () => (/* binding */ PageHeader)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");

// Shared styles for the new org level pages with global project/env/time selection

const PageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12cn1y22"
} : 0)("display:flex;flex-direction:column;flex:1;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(4), ";" + ( true ? "" : 0));
const PageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12cn1y21"
} : 0)("display:flex;justify-content:space-between;align-items:center;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";min-height:32px;" + ( true ? "" : 0));
const HeaderTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h4',  true ? {
  target: "e12cn1y20"
} : 0)(p => p.theme.text.pageTitle, ";color:", p => p.theme.headingColor, ";flex:1;margin:0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/getRouteStringFromRoutes.tsx":
/*!************************************************!*\
  !*** ./app/utils/getRouteStringFromRoutes.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getRouteStringFromRoutes)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Creates a route string from an array of `routes` from react-router
 *
 * It will look for the last route path that begins with a `/` and
 * concatenate all of the following routes. Skips any routes without a path
 *
 * @param {Array<{}>} routes An array of route objects from react-router
 * @return String Returns a route path
 */
function getRouteStringFromRoutes(routes) {
  if (!Array.isArray(routes)) {
    return '';
  }

  const routesWithPaths = routes.filter(route => !!route.path);
  const lastAbsolutePathIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(routesWithPaths, _ref => {
    let {
      path
    } = _ref;
    return path.startsWith('/');
  });
  return routesWithPaths.slice(lastAbsolutePathIndex).filter(_ref2 => {
    let {
      path
    } = _ref2;
    return !!path;
  }).map(_ref3 => {
    let {
      path
    } = _ref3;
    return path;
  }).join('');
}

/***/ }),

/***/ "./app/utils/withProject.tsx":
/*!***********************************!*\
  !*** ./app/utils/withProject.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    render() {
      const {
        project,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(WrappedComponent, {
        project: project !== null && project !== void 0 ? project : this.context.project,
        ...props
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withProject(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__["default"])(WrappedComponent)})`), (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "contextTypes", {
    project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__["default"].Project
  }), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProject);

/***/ }),

/***/ "./app/views/permissionDenied.tsx":
/*!****************************************!*\
  !*** ./app/views/permissionDenied.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/getRouteStringFromRoutes */ "./app/utils/getRouteStringFromRoutes.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

 // eslint-disable-next-line no-restricted-imports












const ERROR_NAME = 'Permission Denied';

class PermissionDenied extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  componentDidMount() {
    const {
      organization,
      project,
      routes
    } = this.props;
    const route = (0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_8__["default"])(routes);
    _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
      scope.setFingerprint([ERROR_NAME, route]);
      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', organization && organization.features || []);
      scope.setExtra('orgAccess', organization && organization.access || []);
      scope.setExtra('projectFeatures', project && project.features || []);
      _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(new Error(`${ERROR_NAME}${route ? ` : ${route}` : ''}`));
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Permission Denied'),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_7__.PageContent, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_4__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)(`Your role does not have the necessary permissions to access this
               resource, please read more about [link:organizational roles]`, {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"], {
              href: "https://docs.sentry.io/product/accounts/membership/"
            })
          })
        })
      })
    });
  }

}

PermissionDenied.displayName = "PermissionDenied";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_10__["default"])(PermissionDenied))));

/***/ }),

/***/ "./app/views/routeError.tsx":
/*!**********************************!*\
  !*** ./app/views/routeError.tsx ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/browser/esm/sdk.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_list__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/list */ "./app/components/list/index.tsx");
/* harmony import */ var sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/list/listItem */ "./app/components/list/listItem.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/organizationStore */ "./app/stores/organizationStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getRouteStringFromRoutes */ "./app/utils/getRouteStringFromRoutes.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

 // eslint-disable-next-line no-restricted-imports















function RouteError(_ref) {
  let {
    error,
    disableLogSentry,
    disableReport,
    project,
    routes
  } = _ref;
  const {
    organization
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_8__.useLegacyStore)(sentry_stores_organizationStore__WEBPACK_IMPORTED_MODULE_7__["default"]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (disableLogSentry) {
      return undefined;
    }

    if (!error) {
      return undefined;
    }

    const route = (0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_10__["default"])(routes);

    const enrichScopeContext = scope => {
      var _organization$feature, _organization$access, _project$features;

      scope.setExtra('route', route);
      scope.setExtra('orgFeatures', (_organization$feature = organization === null || organization === void 0 ? void 0 : organization.features) !== null && _organization$feature !== void 0 ? _organization$feature : []);
      scope.setExtra('orgAccess', (_organization$access = organization === null || organization === void 0 ? void 0 : organization.access) !== null && _organization$access !== void 0 ? _organization$access : []);
      scope.setExtra('projectFeatures', (_project$features = project === null || project === void 0 ? void 0 : project.features) !== null && _project$features !== void 0 ? _project$features : []);
      return scope;
    };

    if (route) {
      // Unexpectedly, error.message would sometimes not have a setter
      // property, causing another exception to be thrown, and losing the
      // original error in the process. Wrapping the mutation in a try-catch in
      // an attempt to preserve the original error for logging.
      //
      // See https://github.com/getsentry/sentry/issues/16314 for more details.
      try {
        error.message = `${error.message}: ${route}`;
      } catch (e) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_12__.withScope(scope => {
          enrichScopeContext(scope);
          _sentry_react__WEBPACK_IMPORTED_MODULE_12__.captureException(e);
        });
      }
    } // TODO(dcramer): show something in addition to embed (that contains it?)
    // throw this in a timeout so if it errors we don't fall over


    const reportDialogTimeout = window.setTimeout(() => {
      _sentry_react__WEBPACK_IMPORTED_MODULE_12__.withScope(scope => {
        enrichScopeContext(scope);
        _sentry_react__WEBPACK_IMPORTED_MODULE_12__.captureException(error);
      });

      if (!disableReport) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_13__.showReportDialog();
      }
    });
    return function cleanup() {
      window.clearTimeout(reportDialogTimeout);
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, disableLogSentry]); // Remove the report dialog on unmount

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => () => {
    var _document$querySelect;

    return (_document$querySelect = document.querySelector('.sentry-error-embed-wrapper')) === null || _document$querySelect === void 0 ? void 0 : _document$querySelect.remove();
  }); // TODO(dcramer): show additional resource links

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
    type: "error",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Heading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Oops! Something went wrong')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(`
          It looks like you've hit an issue in our client application. Don't worry though!
          We use Sentry to monitor Sentry and it's likely we're already looking into this!
          `)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("If you're daring, you may want to try the following:")
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_list__WEBPACK_IMPORTED_MODULE_4__["default"], {
      symbol: "bullet",
      children: [window && window.adblockSuspected && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("We detected something AdBlock-like. Try disabling it, as it's known to cause issues.")
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)(`Give it a few seconds and [link:reload the page].`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("a", {
            onClick: () => {
              window.location.href = window.location.href;
            }
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_list_listItem__WEBPACK_IMPORTED_MODULE_5__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)(`If all else fails, [link:contact us] with more details.`, {
          link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)("a", {
            href: "https://github.com/getsentry/sentry/issues/new/choose"
          })
        })
      })]
    })]
  });
}

RouteError.displayName = "RouteError";

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h1',  true ? {
  target: "e1isf1bc0"
} : 0)("font-size:", p => p.theme.fontSizeLarge, ";line-height:1.4;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_2__.withRouter)((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_11__["default"])(RouteError)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_asyncComponent_tsx.2feb40820ae9b6ee6eada3a37aff20bc.js.map