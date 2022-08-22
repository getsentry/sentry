"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_releases_list_releasesPromo_tsx"],{

/***/ "./app/utils/useApiRequests.tsx":
/*!**************************************!*\
  !*** ./app/utils/useApiRequests.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/getRouteStringFromRoutes */ "./app/utils/getRouteStringFromRoutes.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var sentry_utils_useRoutes__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useRoutes */ "./app/utils/useRoutes.tsx");
/* harmony import */ var sentry_views_permissionDenied__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/permissionDenied */ "./app/views/permissionDenied.tsx");
/* harmony import */ var sentry_views_routeError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/routeError */ "./app/views/routeError.tsx");
/* harmony import */ var _useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./useEffectAfterFirstRender */ "./app/utils/useEffectAfterFirstRender.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















/**
 * Turn {foo: X} into {foo: X, fooPageLinks: string}
 */



function renderLoading() {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
}

renderLoading.displayName = "renderLoading";

function useApiRequests(_ref) {
  let {
    endpoints,
    reloadOnVisible = false,
    shouldReload = false,
    shouldRenderBadRequests = false,
    disableErrorReport = true,
    onLoadAllEndpointsSuccess = () => {},
    onRequestSuccess = _data => {},
    onRequestError = (_error, _args) => {}
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_8__["default"])();
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_9__.useLocation)();
  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_10__.useParams)(); // Memoize the initialState so we can easily reuse it later

  const initialState = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => ({
    data: {},
    isLoading: false,
    hasError: false,
    isReloading: false,
    errors: {},
    remainingRequests: endpoints.length
  }), [endpoints.length]);
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(initialState); // Begin measuring the use of the hook for the given route

  const triggerMeasurement = useMeasureApiRequests();
  const handleRequestSuccess = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)((_ref2, initialRequest) => {
    let {
      stateKey,
      data,
      resp
    } = _ref2;
    setState(prevState => {
      const newState = { ...prevState,
        data: { ...prevState.data,
          [stateKey]: data,
          [`${stateKey}PageLinks`]: resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')
        }
      };

      if (initialRequest) {
        newState.remainingRequests = prevState.remainingRequests - 1;
        newState.isLoading = prevState.remainingRequests > 1;
        newState.isReloading = prevState.isReloading && newState.isLoading;
        triggerMeasurement({
          finished: newState.remainingRequests === 0
        });
      }

      return newState;
    }); // if everything is loaded and we don't have an error, call the callback

    onRequestSuccess({
      stateKey,
      data,
      resp
    });
  }, [onRequestSuccess, triggerMeasurement]);
  const handleError = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)((error, args) => {
    const [stateKey] = args;

    if (error && error.responseText) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_16__.addBreadcrumb({
        message: error.responseText,
        category: 'xhr',
        level: 'error'
      });
    }

    setState(prevState => {
      const isLoading = prevState.remainingRequests > 1;
      const newState = {
        errors: { ...prevState.errors,
          [stateKey]: error
        },
        data: { ...prevState.data,
          [stateKey]: null
        },
        hasError: prevState.hasError || !!error,
        remainingRequests: prevState.remainingRequests - 1,
        isLoading,
        isReloading: prevState.isReloading && isLoading
      };
      triggerMeasurement({
        finished: newState.remainingRequests === 0,
        error: true
      });
      return newState;
    });
    onRequestError(error, args);
  }, [triggerMeasurement, onRequestError]);
  const fetchData = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async function () {
    let extraState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    // Nothing to fetch if enpoints are empty
    if (!endpoints.length) {
      setState(prevState => ({ ...prevState,
        data: {},
        isLoading: false,
        hasError: false
      }));
      return;
    } // Cancel any in flight requests


    api.clear();
    setState(prevState => ({ ...prevState,
      isLoading: true,
      hasError: false,
      remainingRequests: endpoints.length,
      ...extraState
    }));
    await Promise.all(endpoints.map(async _ref3 => {
      var _options;

      let [stateKey, endpoint, parameters, options] = _ref3;
      options = (_options = options) !== null && _options !== void 0 ? _options : {}; // If you're using nested async components/views make sure to pass the
      // props through so that the child component has access to props.location

      const locationQuery = location && location.query || {};
      let query = parameters && parameters.query || {}; // If paginate option then pass entire `query` object to API call
      // It should only be expecting `query.cursor` for pagination

      if ((options.paginate || locationQuery.cursor) && !options.disableEntireQuery) {
        query = { ...locationQuery,
          ...query
        };
      }

      try {
        const results = await api.requestPromise(endpoint, {
          method: 'GET',
          ...parameters,
          query,
          includeAllArgs: true
        });
        const [data, _, resp] = results;
        handleRequestSuccess({
          stateKey,
          data,
          resp
        }, true);
      } catch (error) {
        handleError(error, [stateKey, endpoint, parameters, options]);
      }
    }));
  }, [api, endpoints, handleError, handleRequestSuccess, location]);
  const reloadData = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => fetchData({
    isReloading: true
  }), [fetchData]);
  const handleMount = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async () => {
    try {
      await fetchData();
    } catch (error) {
      setState(prevState => ({ ...prevState,
        hasError: true
      }));
      throw error;
    }
  }, [fetchData]); // Trigger fetch on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => void handleMount(), []);
  const handleFullReload = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    if (shouldReload) {
      return reloadData();
    }

    setState({ ...initialState
    });
    return fetchData();
  }, [initialState, reloadData, fetchData, shouldReload]); // Trigger fetch on location or parameter change
  // useEffectAfterFirstRender to avoid calling at the same time as handleMount

  (0,_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_14__.useEffectAfterFirstRender)(() => void handleFullReload(), // eslint-disable-next-line react-hooks/exhaustive-deps
  [location === null || location === void 0 ? void 0 : location.search, location === null || location === void 0 ? void 0 : location.state, params]);
  const visibilityReloader = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => !state.isLoading && !document.hidden && reloadData(), [state.isLoading, reloadData]); // Trigger fetch on visible change when using visibilityReloader

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (reloadOnVisible) {
      document.addEventListener('visibilitychange', visibilityReloader);
    }

    return () => document.removeEventListener('visibilitychange', visibilityReloader);
  }, [reloadOnVisible, visibilityReloader]); // Trigger onLoadAllEndpointsSuccess when everything has been loaded

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (endpoints.length && state.remainingRequests === 0 && !state.hasError) {
      onLoadAllEndpointsSuccess();
    }
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [state.remainingRequests, state.hasError, endpoints.length]);
  const renderError = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(function (error) {
    let disableLog = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const errors = state.errors; // 401s are captured by SudoModal, but may be passed back to AsyncComponent
    // if they close the modal without identifying

    const unauthorizedErrors = Object.values(errors).some(resp => (resp === null || resp === void 0 ? void 0 : resp.status) === 401); // Look through endpoint results to see if we had any 403s, means their
    // role can not access resource

    const permissionErrors = Object.values(errors).some(resp => (resp === null || resp === void 0 ? void 0 : resp.status) === 403); // If all error responses have status code === 0, then show error message
    // but don't log it to sentry

    const shouldLogSentry = !!Object.values(errors).some(resp => (resp === null || resp === void 0 ? void 0 : resp.status) !== 0) || disableLog;

    if (unauthorizedErrors) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('You are not authorized to access this resource.')
      });
    }

    if (permissionErrors) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_permissionDenied__WEBPACK_IMPORTED_MODULE_12__["default"], {});
    }

    if (shouldRenderBadRequests) {
      const badRequests = Object.values(errors).filter(resp => {
        var _resp$responseJSON;

        return (resp === null || resp === void 0 ? void 0 : resp.status) === 400 && (resp === null || resp === void 0 ? void 0 : (_resp$responseJSON = resp.responseJSON) === null || _resp$responseJSON === void 0 ? void 0 : _resp$responseJSON.detail);
      }).map(resp => resp.responseJSON.detail);

      if (badRequests.length) {
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_3__["default"], {
          message: [...new Set(badRequests)].join('\n')
        });
      }
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_routeError__WEBPACK_IMPORTED_MODULE_13__["default"], {
      error: error,
      disableLogSentry: !shouldLogSentry,
      disableReport: disableErrorReport
    });
  }, [state.errors, disableErrorReport, shouldRenderBadRequests]);
  const shouldRenderLoading = state.isLoading && (!shouldReload || !state.isReloading);
  const renderComponent = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(children => shouldRenderLoading ? renderLoading() : state.hasError ? renderError(new Error('Unable to load all required endpoints')) : children, [shouldRenderLoading, state.hasError, renderError]);
  return { ...state,
    renderComponent
  };
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApiRequests);

/**
 * Helper hook that marks a measurement when the component mounts.
 *
 * Use the `triggerMeasurement` function to trigger a measurement when the
 * useApiRequests hook has finished loading all requests. Will only trigger once
 */
function useMeasureApiRequests() {
  const routes = (0,sentry_utils_useRoutes__WEBPACK_IMPORTED_MODULE_11__.useRoutes)();
  const measurement = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)({
    hasMeasured: false,
    finished: false,
    error: false
  }); // Start measuring immediately upon mount. We re-mark if the route list has
  // changed, since the component is now being used under a different route

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    // Reset the measurement object
    measurement.current = {
      hasMeasured: false,
      finished: false,
      error: false
    };

    if (routes && routes.length) {
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.metric.mark({
        name: `async-component-${(0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_7__["default"])(routes)}`
      });
    }
  }, [routes]);
  const triggerMeasurement = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(_ref4 => {
    let {
      finished,
      error
    } = _ref4;

    if (!routes) {
      return;
    }

    if (finished) {
      measurement.current.finished = true;
    }

    if (error) {
      measurement.current.error = true;
    }

    if (!measurement.current.hasMeasured && measurement.current.finished) {
      const routeString = (0,sentry_utils_getRouteStringFromRoutes__WEBPACK_IMPORTED_MODULE_7__["default"])(routes);
      sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_6__.metric.measure({
        name: 'app.component.async-component',
        start: `async-component-${routeString}`,
        data: {
          route: routeString,
          error: measurement.current.error
        }
      });
      measurement.current.hasMeasured = true;
    }
  }, [routes]);
  return triggerMeasurement;
}

/***/ }),

/***/ "./app/utils/useEffectAfterFirstRender.ts":
/*!************************************************!*\
  !*** ./app/utils/useEffectAfterFirstRender.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useEffectAfterFirstRender": () => (/* binding */ useEffectAfterFirstRender)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


const useEffectAfterFirstRender = (cb, deps) => {
  const firstRender = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(true);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    cb(); // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};



/***/ }),

/***/ "./app/utils/useLocation.tsx":
/*!***********************************!*\
  !*** ./app/utils/useLocation.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocation": () => (/* binding */ useLocation)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useLocation() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.location;
}

/***/ }),

/***/ "./app/utils/useParams.tsx":
/*!*********************************!*\
  !*** ./app/utils/useParams.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useParams": () => (/* binding */ useParams)
/* harmony export */ });
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");

function useParams() {
  const route = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_0__.useRouteContext)();
  return route.params;
}

/***/ }),

/***/ "./app/views/releases/list/releasesPromo.tsx":
/*!***************************************************!*\
  !*** ./app/views/releases/list/releasesPromo.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RELEASES_TOUR_STEPS": () => (/* binding */ RELEASES_TOUR_STEPS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_images_spot_releases_tour_commits_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/releases-tour-commits.svg */ "./images/spot/releases-tour-commits.svg");
/* harmony import */ var sentry_images_spot_releases_tour_email_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/releases-tour-email.svg */ "./images/spot/releases-tour-email.svg");
/* harmony import */ var sentry_images_spot_releases_tour_resolution_svg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry-images/spot/releases-tour-resolution.svg */ "./images/spot/releases-tour-resolution.svg");
/* harmony import */ var sentry_images_spot_releases_tour_stats_svg__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry-images/spot/releases-tour-stats.svg */ "./images/spot/releases-tour-stats.svg");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/modals/featureTourModal */ "./app/components/modals/featureTourModal.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useApiRequests__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/useApiRequests */ "./app/utils/useApiRequests.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























const releasesSetupUrl = 'https://docs.sentry.io/product/releases/';

const docsLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
  external: true,
  href: releasesSetupUrl,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Setup')
});

const RELEASES_TOUR_STEPS = [{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Suspect Commits'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_releases_tour_commits_svg__WEBPACK_IMPORTED_MODULE_3__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Sentry suggests which commit caused an issue and who is likely responsible so you can triage.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Release Stats'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_releases_tour_stats_svg__WEBPACK_IMPORTED_MODULE_6__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Get an overview of the commits in each release, and which issues were introduced or fixed.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Easily Resolve'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_releases_tour_resolution_svg__WEBPACK_IMPORTED_MODULE_5__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Automatically resolve issues by including the issue number in your commit message.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Deploy Emails'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_releases_tour_email_svg__WEBPACK_IMPORTED_MODULE_4__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Receive email notifications about when your code gets deployed. This can be customized in settings.')
  })
}];

const ReleasesPromo = _ref => {
  let {
    organization,
    project
  } = _ref;
  const {
    data,
    renderComponent,
    isLoading
  } = (0,sentry_utils_useApiRequests__WEBPACK_IMPORTED_MODULE_23__["default"])({
    endpoints: [['internalIntegrations', `/organizations/${organization.slug}/sentry-apps/`, {
      query: {
        status: 'internal'
      }
    }]]
  });
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_22__["default"])();
  const [token, setToken] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [integrations, setIntegrations] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);
  const [selectedItem, selectItem] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!isLoading && data.internalIntegrations) {
      setIntegrations(data.internalIntegrations);
    }
  }, [isLoading, data.internalIntegrations]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_21__["default"])('releases.quickstart_viewed', {
      organization,
      project_id: project.id
    }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trackQuickstartCopy = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_21__["default"])('releases.quickstart_copied', {
      organization,
      project_id: project.id
    });
  }, [organization, project]);
  const trackQuickstartCreatedIntegration = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(integration => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_21__["default"])('releases.quickstart_create_integration.success', {
      organization,
      project_id: project.id,
      integration_uuid: integration.uuid
    });
  }, [organization, project]);
  const trackCreateIntegrationModalClose = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_21__["default"])('releases.quickstart_create_integration_modal.close', {
      organization,
      project_id: project.id
    });
  }, [organization, project.id]);

  const fetchToken = async sentryAppSlug => {
    const tokens = await api.requestPromise(`/sentry-apps/${sentryAppSlug}/api-tokens/`);

    if (!tokens.length) {
      const newToken = await generateToken(sentryAppSlug);
      return setToken(newToken);
    }

    return setToken(tokens[0].token);
  };

  const generateToken = async sentryAppSlug => {
    const newToken = await api.requestPromise(`/sentry-apps/${sentryAppSlug}/api-tokens/`, {
      method: 'POST'
    });
    return newToken.token;
  };

  const handleCopy = async () => {
    if (!token || !selectedItem) {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Select an integration for your auth token!'));
      return;
    }

    const current_text = `
      # Install the cli
      curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION="2.2.0" bash
      # Setup configuration values
      SENTRY_AUTH_TOKEN=${token} # From internal integration: ${selectedItem.value.name}
      SENTRY_ORG=${organization.slug}
      SENTRY_PROJECT=${project.slug}
      VERSION=\`sentry-cli releases propose-version\`
      # Workflow to create releases
      sentry-cli releases new "$VERSION"
      sentry-cli releases set-commits "$VERSION" --auto
      sentry-cli releases finalize "$VERSION"
      `;
    await navigator.clipboard.writeText(current_text);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Copied to clipboard!'));
    trackQuickstartCopy();
  };

  const renderIntegrationNode = integration => {
    return {
      value: {
        slug: integration.slug,
        name: integration.name
      },
      searchKey: `${integration.name}`,
      label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(MenuItemWrapper, {
        "data-test-id": "integration-option",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Label, {
          children: integration.name
        })
      }, integration.uuid)
    };
  };

  return renderComponent((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledPageHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Set up Releases')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"], {
          priority: "default",
          size: "sm",
          href: releasesSetupUrl,
          external: true,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Full Documentation')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Find which release caused an issue, apply source maps, and get notified about your deploys.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Add the following commands to your CI config when you deploy your application.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(CodeBlock, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(CopyButton, {
          onClick: handleCopy,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconCopy, {})
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Comment, {
          children: "# Install the cli"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: "curl -sL https://sentry.io/get-cli/ | SENTRY_CLI_VERSION=\"2.2.0\" bash"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: '\n'
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Comment, {
          children: "# Setup configuration values"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Bash, {
          children: ["SENTRY_AUTH_TOKEN=", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledDropdownAutoComplete, {
            minWidth: 300,
            maxHeight: 400,
            onOpen: e => {
              // This can be called multiple times and does not always have `event`
              e === null || e === void 0 ? void 0 : e.stopPropagation();
            },
            items: [{
              label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(GroupHeader, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Available Integrations')
              }),
              id: 'available-integrations',
              items: (integrations || []).map(renderIntegrationNode)
            }],
            alignMenu: "left",
            onSelect: _ref2 => {
              let {
                label,
                value
              } = _ref2;
              selectItem({
                label,
                value
              });
              fetchToken(value.slug);
            },
            itemSize: "small",
            searchPlaceholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Select Internal Integration'),
            menuFooter: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_9__["default"], {
              access: ['org:integrations'],
              children: _ref3 => {
                let {
                  hasAccess
                } = _ref3;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_16__["default"], {
                  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('You must be an organization owner, manager or admin to create an integration.'),
                  disabled: hasAccess,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(CreateIntegrationLink, {
                    to: "",
                    "data-test-id": "create-release-integration",
                    disabled: !hasAccess,
                    onClick: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__.openCreateReleaseIntegration)({
                      organization,
                      project,
                      onCreateSuccess: integration => {
                        setIntegrations([integration, ...integrations]);
                        const {
                          label,
                          value
                        } = renderIntegrationNode(integration);
                        selectItem({
                          label,
                          value
                        });
                        fetchToken(value.slug);
                        trackQuickstartCreatedIntegration(integration);
                      },
                      onCancel: () => {
                        trackCreateIntegrationModalClose();
                      }
                    }),
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(MenuItemFooterWrapper, {
                      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(IconContainer, {
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconAdd, {
                          color: "purple300",
                          isCircled: true,
                          size: "14px"
                        })
                      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Label, {
                        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Create New Integration')
                      })]
                    })
                  })
                });
              }
            }),
            disableLabelPadding: true,
            emptyHidesInput: true,
            children: () => {
              return token && selectedItem ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)("span", {
                style: {
                  display: 'flex'
                },
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
                  children: token
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Comment, {
                  children: ` # From internal integration: ${selectedItem.value.name} `
                })]
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
                style: {
                  color: '#7cc5c4'
                },
                children: '<click-here-for-your-token>'
              });
            }
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: `SENTRY_ORG=${organization.slug}`
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: `SENTRY_PROJECT=${project.slug}`
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: "VERSION=`sentry-cli releases propose-version`"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: '\n'
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Comment, {
          children: "# Workflow to create releases"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: "sentry-cli releases new \"$VERSION\""
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: "sentry-cli releases set-commits \"$VERSION\" --auto"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Bash, {
          children: "sentry-cli releases finalize \"$VERSION\""
        })]
      })]
    })
  }));
};

const StyledPageHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_19__.PageHeader,  true ? {
  target: "en3hngy13"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";h3{margin:0;}@media (max-width: ", p => p.theme.breakpoints.small, "){flex-direction:column;align-items:flex-start;h3{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";}}" + ( true ? "" : 0));

const CodeBlock = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('pre',  true ? {
  target: "en3hngy12"
} : 0)("background:#251f3d;display:flex;flex-direction:column;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";overflow:initial;position:relative;" + ( true ? "" : 0));

const CopyButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "en3hngy11"
} : 0)( true ? {
  name: "7kopj8",
  styles: "position:absolute;right:20px"
} : 0);

const Language = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "en3hngy10"
} : 0)( true ? {
  name: "1tuu0op",
  styles: "font-size:15px;text-shadow:none;direction:ltr;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;line-height:1.5;display:flex;align-items:center"
} : 0);

const Bash = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Language,  true ? {
  target: "en3hngy9"
} : 0)( true ? {
  name: "1096u1z",
  styles: "color:#f2edf6"
} : 0);

const Comment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Language,  true ? {
  target: "en3hngy8"
} : 0)( true ? {
  name: "13ci6y6",
  styles: "color:#77658b"
} : 0);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "en3hngy7"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";" + ( true ? "" : 0));

const StyledDropdownAutoComplete = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "en3hngy6"
} : 0)("font-family:", p => p.theme.text.family, ";border:none;border-radius:4px;width:300px;" + ( true ? "" : 0));

const GroupHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "en3hngy5"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";font-family:", p => p.theme.text.family, ";font-weight:600;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), " 0;color:", p => p.theme.subText, ";line-height:", p => p.theme.fontSizeSmall, ";text-align:left;" + ( true ? "" : 0));

const CreateIntegrationLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "en3hngy4"
} : 0)("color:", p => p.disabled ? p.theme.disabled : p.theme.textColor, ";" + ( true ? "" : 0));

const MenuItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "en3hngy3"
} : 0)("cursor:", p => p.disabled ? 'not-allowed' : 'pointer', ";display:flex;align-items:center;font-family:", p => p.theme.text.family, ";font-size:13px;", p => typeof p.py !== 'undefined' && `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `, ";" + ( true ? "" : 0));

const MenuItemFooterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(MenuItemWrapper,  true ? {
  target: "en3hngy2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";border-top:1px solid ", p => p.theme.innerBorder, ";background-color:", p => p.theme.tag.highlight.background, ";color:", p => p.theme.active, ";:hover{color:", p => p.theme.activeHover, ";svg{fill:", p => p.theme.activeHover, ";}}" + ( true ? "" : 0));

const IconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "en3hngy1"
} : 0)( true ? {
  name: "ksp8pg",
  styles: "display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "en3hngy0"
} : 0)( true ? {
  name: "18jsklt",
  styles: "margin-left:6px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleasesPromo);

/***/ }),

/***/ "./images/spot/releases-tour-commits.svg":
/*!***********************************************!*\
  !*** ./images/spot/releases-tour-commits.svg ***!
  \***********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzEyIiBoZWlnaHQ9IjE2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjc0LjgxOSA2OC45MjNsLjUzNiA1My41NzdMMi45NiAxMTkuODg3IDEgNjUuMDE3bDI3My44MTkgMy45MDZ6IiBzdHJva2U9IiNGRjc3MzgiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0iTTQuMjgxIDY3LjYyOWwtLjY2OCA1MS40ODkgMjY5LjEzOC43NjkgMS4yOTctNTEuODcyTDQuMjgxIDY3LjYzeiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjxyZWN0IHg9IjIxNS4yNTgiIHk9Ijg1LjkxOSIgd2lkdGg9IjQxLjgwNiIgaGVpZ2h0PSIxNC4zNzEiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PHJlY3QgeD0iNTcuMTc4IiB5PSI5NS4wNjQiIHdpZHRoPSI1Mi4yNTgiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSIxMTQuNjYxIiB5PSI5NS4wNjQiIHdpZHRoPSIxMS43NTgiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSI1Ny42MjkiIHk9Ijg4IiB3aWR0aD0iNTgiIGhlaWdodD0iMyIgcng9IjEuNSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjExOC42MjkiIHk9Ijg4IiB3aWR0aD0iNTMiIGhlaWdodD0iMyIgcng9IjEuNSIgZmlsbD0iIzNFMkM3MyIvPjxjaXJjbGUgY3g9IjMxLjA0OCIgY3k9IjkyLjQ1MSIgcj0iMTEuNzU4IiBmaWxsPSIjRkY3NzM4Ii8+PHJlY3QgeD0iMjI5LjYyOSIgeT0iOTIuNDUyIiB3aWR0aD0iMTQuMzcxIiBoZWlnaHQ9IjEuNSIgcng9Ii43NSIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjMyLjM1NSIgY3k9IjkzLjc1OCIgcj0iMTEuMzgzIiBzdHJva2U9IiMzRTJDNzMiIHN0cm9rZS13aWR0aD0iLjc1Ii8+PHBhdGggZD0iTTMxMC4wOTMgMTA5LjQyM2wuNTM2IDUzLjU3Ny0yNzIuMzk1LTIuNjEzLTEuOTYtNTQuODcxIDI3My44MTkgMy45MDd6IiBzdHJva2U9IiNGRjc3MzgiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0iTTM5LjU1NSAxMDguMTI5bC0uNjY4IDUxLjQ4OSAyNjkuMTM4Ljc2OSAxLjI5Ny01MS44NzItMjY5Ljc2Ny0uMzg2eiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjxyZWN0IHg9IjI1MC41MzIiIHk9IjEyNi40MTkiIHdpZHRoPSI0MS44MDYiIGhlaWdodD0iMTQuMzcxIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjkyLjQ1MiIgeT0iMTM1LjU2NCIgd2lkdGg9IjEzLjA2NSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjEwOS40MzYiIHk9IjEzNS41NjQiIHdpZHRoPSI0OS42NDUiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSIyNjQuOTAzIiB5PSIxMzIuOTUyIiB3aWR0aD0iMTQuMzcxIiBoZWlnaHQ9IjEuNSIgcng9Ii43NSIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjkyLjYyOSIgeT0iMTI4IiB3aWR0aD0iNzQiIGhlaWdodD0iMyIgcng9IjEuNSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjE3MC42MjkiIHk9IjEyOCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjMiIHJ4PSIxLjUiIGZpbGw9IiMzRTJDNzMiLz48Y2lyY2xlIGN4PSI2Ni4zMjMiIGN5PSIxMzIuOTUyIiByPSIxMS43NTgiIGZpbGw9IiM1QTRBNzkiLz48Y2lyY2xlIGN4PSI2Ny42MjkiIGN5PSIxMzQuMjU4IiByPSIxMS4zODMiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cGF0aCBkPSJNMzEwLjA5MyA0LjkwN2wuNTM2IDUzLjU3N0wzOC4yMzQgNTUuODcgMzYuMjc0IDFsMjczLjgxOSAzLjkwN3oiIHN0cm9rZT0iI0ZGNzczOCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48cGF0aCBkPSJNMzkuNTU1IDMuNjEzbC0uNjY4IDUxLjQ5IDI2OS4xMzguNzY4IDEuMjk3LTUxLjg3Mi0yNjkuNzY3LS4zODZ6IiBmaWxsPSIjZmZmIiBzdHJva2U9IiMzRTJDNzMiIHN0cm9rZS13aWR0aD0iLjc1Ii8+PHJlY3QgeD0iMjUwLjUzMiIgeT0iMjEuOTAzIiB3aWR0aD0iNDEuODA2IiBoZWlnaHQ9IjE0LjM3MSIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSI5Mi40NTIiIHk9IjMxLjA0OCIgd2lkdGg9IjEzLjA2NSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjEwOS40MzYiIHk9IjMxLjA0OCIgd2lkdGg9IjQ5LjY0NSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjI2NC45MDMiIHk9IjI4LjQzNiIgd2lkdGg9IjE0LjM3MSIgaGVpZ2h0PSIxLjUiIHJ4PSIuNzUiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSI5Mi42MjkiIHk9IjI0IiB3aWR0aD0iNzIiIGhlaWdodD0iMyIgcng9IjEuNSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjE2Ny42MjkiIHk9IjI0IiB3aWR0aD0iOSIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjM0UyQzczIi8+PGNpcmNsZSBjeD0iNjYuMzIzIiBjeT0iMjguNDM1IiByPSIxMS43NTgiIGZpbGw9IiNFREU3RjUiLz48Y2lyY2xlIGN4PSI2Ny42MjkiIGN5PSIyOS43NDIiIHI9IjExLjM4MyIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/spot/releases-tour-email.svg":
/*!*********************************************!*\
  !*** ./images/spot/releases-tour-email.svg ***!
  \*********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzEyIiBoZWlnaHQ9IjE3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTEyLjQ1IDE2OS40NDNMMjU3IDE3MWwtMS4xMTYtMTQ4LjYzMkwxMTAgMjJsMi40NSAxNDcuNDQzeiIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjRkY3NzM4IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik0xMTIgMjRoMTQzbC0uODA4IDQ1SDExMlYyNHoiIGZpbGw9IiNDMUIyREQiLz48cGF0aCBkPSJNMTEyIDE0NWgxNDJsLS44MDIgMjNIMTEydi0yM3oiIGZpbGw9IiM1QTRBNzkiLz48cmVjdCB4PSIxNDYiIHk9Ijg2IiB3aWR0aD0iNzYiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIxNDYiIHk9IjkxIiB3aWR0aD0iNzYiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIxNDYiIHk9IjgxIiB3aWR0aD0iNzYiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIxNjgiIHk9IjEwNSIgd2lkdGg9IjMyIiBoZWlnaHQ9IjExIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjE3OSIgeT0iMTEwIiB3aWR0aD0iMTEiIGhlaWdodD0iMSIgcng9Ii41IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE3MiA0NGExIDEgMCAwMTEtMWgyMmExIDEgMCAwMTAgMmgtMjJhMSAxIDAgMDEtMS0xeiIgZmlsbD0iIzVBNEE3OSIvPjxyZWN0IHg9IjE1MSIgeT0iNTIiIHdpZHRoPSI2NSIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzVBNEE3OSIvPjxwYXRoIGQ9Ik0yNTQgMTY3LjY0NEwxMTIgMTY4bDEuODExLTE0Mi43NDRMMjUzLjg0NyAyNCAyNTQgMTY3LjY0NHoiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cGF0aCBkPSJNMTUzLjQ1IDE0OC40NDNMMjk4IDE1MCAyOTYuODg0IDEuMzY4IDE1MSAxbDIuNDUgMTQ3LjQ0M3oiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI0ZGNzczOCIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48cGF0aCBkPSJNMTUzIDNoMTQzbC0uODA4IDQ1SDE1M1YzeiIgZmlsbD0iI0MxQjJERCIvPjxwYXRoIGQ9Ik0xNTMgMTI0aDE0MmwtLjgwMiAyM0gxNTN2LTIzeiIgZmlsbD0iIzVBNEE3OSIvPjxyZWN0IHg9IjE4NyIgeT0iNjUiIHdpZHRoPSI3NiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjE4NyIgeT0iNzAiIHdpZHRoPSI3NiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjE4NyIgeT0iNjAiIHdpZHRoPSI3NiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjIwOSIgeT0iODQiIHdpZHRoPSIzMiIgaGVpZ2h0PSIxMSIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyMjAiIHk9Ijg5IiB3aWR0aD0iMTEiIGhlaWdodD0iMSIgcng9Ii41IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTIxMyAyM2ExIDEgMCAwMTEtMWgyMmExIDEgMCAwMTAgMmgtMjJhMSAxIDAgMDEtMS0xeiIgZmlsbD0iIzVBNEE3OSIvPjxyZWN0IHg9IjE5MiIgeT0iMzEiIHdpZHRoPSI2NSIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzVBNEE3OSIvPjxwYXRoIGQ9Ik0yOTUgMTQ2LjY0NEwxNTMgMTQ3bDEuODExLTE0Mi43NDRMMjk0Ljg0NyAzIDI5NSAxNDYuNjQ0eiIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjxwYXRoIGQ9Ik0xMDAgMTIyLjg1NEwxIDEyM2wxLjI2Mi01OC40ODZMOTkuODkzIDY0bC4xMDcgNTguODU0eiIgc3Ryb2tlPSIjRkY3NzM4IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik05OSAxMjEuODU5TDMuMjM3IDEyMVY2NS40OTdIOThsMSA1Ni4zNjJ6IiBmaWxsPSIjRURFN0Y1IiBzdHJva2U9IiMzRTJDNzMiIHN0cm9rZS13aWR0aD0iLjc1Ii8+PHBhdGggZD0iTTMgNjZsNDguMjU0IDM1TDk4IDY2TTMgMTIwLjVMMzcgOTFtNjEuNSAzMEw2NiA5MCIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjxwYXRoIGQ9Ik0xMjIgMTQwLjg1NEwyMyAxNDFsMS4yNjItNTguNDg2TDEyMS44OTQgODJsLjEwNyA1OC44NTR6IiBzdHJva2U9IiNGRjc3MzgiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHBhdGggZD0iTTEyMSAxMzkuODU5TDI1LjIzNyAxMzlWODMuNDk3SDEyMGwxIDU2LjM2MnoiIGZpbGw9IiNFREU3RjUiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cGF0aCBkPSJNMjUgODRsNDguMjU0IDM1TDEyMCA4NE0yNSAxMzguNUw1OSAxMDltNjEuNSAzMEw4OCAxMDgiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cGF0aCBkPSJNMzAyIDExOWwtMTQgMS05IDEzIC41IDExIDguNSAxMC41aDEzLjVMMzExIDE0NGwuNS0xNS05LjUtMTB6IiBmaWxsPSIjRkY3NzM4Ii8+PGNpcmNsZSBjeD0iMjk0LjUiIGN5PSIxNDQiIHI9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyOTMuNSIgeT0iMTI2IiB3aWR0aD0iMiIgaGVpZ2h0PSIxNSIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/spot/releases-tour-resolution.svg":
/*!**************************************************!*\
  !*** ./images/spot/releases-tour-resolution.svg ***!
  \**************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjc1IiBoZWlnaHQ9IjE2NyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjY5IiBoZWlnaHQ9IjE2MCIgcng9IjQiIGZpbGw9IiMzMDI4MzkiLz48cGF0aCBkPSJNMCA1YTQgNCAwIDAxNC00aDI2MWE0IDQgMCAwMTQgNHYxOEgwVjV6IiBmaWxsPSIjQzFCMkREIi8+PHJlY3QgeD0iMTMiIHk9IjQ3IiB3aWR0aD0iMjA2IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjQzFCMkREIi8+PHJlY3QgeD0iMTMiIHk9IjM3IiB3aWR0aD0iMTU0IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjQzFCMkREIi8+PHJlY3QgeD0iMTMiIHk9Ijc3IiB3aWR0aD0iMjA2IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjQzFCMkREIi8+PHJlY3QgeD0iMTMiIHk9IjExNyIgd2lkdGg9IjE2OSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjExIiB5PSIxMSIgd2lkdGg9IjExMSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzVBNEE3OSIvPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjIiIHJ4PSIxIiB0cmFuc2Zvcm09Im1hdHJpeCgtMSAwIDAgMSAyNTkgMTEpIiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMTMiIHk9IjU3IiB3aWR0aD0iMTYiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNGRjc3MzgiLz48cmVjdCB4PSIzNyIgeT0iNTciIHdpZHRoPSIxMTkiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIxMyIgeT0iNjciIHdpZHRoPSIxNiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0ZGNzczOCIvPjxyZWN0IHg9IjM3IiB5PSI2NyIgd2lkdGg9IjUyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMTMiIHk9IjEwNyIgd2lkdGg9IjE0MCIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjEzIiB5PSI4NyIgd2lkdGg9IjE2IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRkY3NzM4Ii8+PHJlY3QgeD0iMzciIHk9Ijg3IiB3aWR0aD0iMTE5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMTMiIHk9Ijk3IiB3aWR0aD0iMTYiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNGRjc3MzgiLz48cmVjdCB4PSIxMyIgeT0iMTQ3IiB3aWR0aD0iMTY5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjQzFCMkREIi8+PHJlY3QgeD0iMTMiIHk9IjEzNyIgd2lkdGg9IjE0MCIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0MxQjJERCIvPjxyZWN0IHg9IjEzIiB5PSIxMjciIHdpZHRoPSIxNiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI0ZGNzczOCIvPjxyZWN0IHg9IjM3IiB5PSI5NyIgd2lkdGg9IjUyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMzciIHk9IjEyNyIgd2lkdGg9IjExOSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yLjY3MiA0LjMwOEwyIDE2NmwyNjkuNjI4LTIuMTA2TDI3NCAxIDIuNjcyIDQuMzA4eiIgc3Ryb2tlPSIjM0UyQzczIiBzdHJva2Utd2lkdGg9Ii43NSIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/spot/releases-tour-stats.svg":
/*!*********************************************!*\
  !*** ./images/spot/releases-tour-stats.svg ***!
  \*********************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDc1IiBoZWlnaHQ9IjE1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjQzFCMkREIiBkPSJNMCA1MWg0NzV2MTlIMHoiLz48cGF0aCBkPSJNNS4xNTcgMTUwLjk3M0w0IDNsNDYzLjkxOSAxLjkyOEw0NzIgMTU0IDUuMTU3IDE1MC45NzN6IiBzdHJva2U9IiMzRTJDNzMiIHN0cm9rZS13aWR0aD0iLjc1Ii8+PHJlY3QgeD0iMjUiIHk9IjI0IiB3aWR0aD0iNTEiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSIyNSIgeT0iMzEiIHdpZHRoPSIyMiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjM5IiB5PSI4NiIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PHJlY3QgeD0iMjAwIiB5PSI4NiIgd2lkdGg9IjE5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PG1hc2sgaWQ9ImEiIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjE4OCIgeT0iODMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIi8+PC9tYXNrPjxyZWN0IHg9IjE4OCIgeT0iODMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIiBzdHJva2U9IiNDMUIyREQiIHN0cm9rZS13aWR0aD0iMyIgbWFzaz0idXJsKCNhKSIvPjxyZWN0IHg9IjI1NiIgeT0iODYiIHdpZHRoPSIxOSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxtYXNrIGlkPSJiIiBmaWxsPSIjZmZmIj48cmVjdCB4PSIyNDMiIHk9IjgzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIvPjwvbWFzaz48cmVjdCB4PSIyNDMiIHk9IjgzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIgc3Ryb2tlPSIjQzFCMkREIiBzdHJva2Utd2lkdGg9IjMiIG1hc2s9InVybCgjYikiLz48cmVjdCB4PSIzOTgiIHk9Ijg2IiB3aWR0aD0iMTkiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSI0MzAiIHk9Ijg2IiB3aWR0aD0iMjIiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIxMDgiIHk9IjI0IiB3aWR0aD0iNTIiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSIxMDgiIHk9IjMxIiB3aWR0aD0iNjQiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyOTUiIHk9IjI0IiB3aWR0aD0iNzciIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSIyOTUiIHk9IjMxIiB3aWR0aD0iNjMiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSI0MTciIHk9IjI0IiB3aWR0aD0iMzUiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiNDMUIyREQiLz48cmVjdCB4PSI0MzUiIHk9IjMxIiB3aWR0aD0iMTciIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyNSIgeT0iODMiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSI0IiBmaWxsPSIjQzFCMkREIi8+PHBhdGggZD0iTTEwOCA4NGExIDEgMCAwMTEtMWgyOHY4aC0yOGExIDEgMCAwMS0xLTF2LTZ6IiBmaWxsPSIjRkY3NzM4Ii8+PG1hc2sgaWQ9ImMiIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjI5NSIgeT0iODIiIHdpZHRoPSI3OSIgaGVpZ2h0PSIxMCIgcng9IjEiLz48L21hc2s+PHJlY3QgeD0iMjk1IiB5PSI4MiIgd2lkdGg9Ijc5IiBoZWlnaHQ9IjEwIiByeD0iMSIgc3Ryb2tlPSIjRkY3NzM4IiBzdHJva2Utd2lkdGg9IjMiIG1hc2s9InVybCgjYykiLz48cmVjdCB4PSIzOSIgeT0iMTA5IiB3aWR0aD0iMjIiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyMDAiIHk9IjEwOSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PG1hc2sgaWQ9ImQiIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjE4OCIgeT0iMTA2IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIvPjwvbWFzaz48cmVjdCB4PSIxODgiIHk9IjEwNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjEiIHN0cm9rZT0iI0MxQjJERCIgc3Ryb2tlLXdpZHRoPSIzIiBtYXNrPSJ1cmwoI2QpIi8+PHJlY3QgeD0iMjU2IiB5PSIxMDkiIHdpZHRoPSIxOSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxtYXNrIGlkPSJlIiBmaWxsPSIjZmZmIj48cmVjdCB4PSIyNDMiIHk9IjEwNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjEiLz48L21hc2s+PHJlY3QgeD0iMjQzIiB5PSIxMDYiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIiBzdHJva2U9IiNDMUIyREQiIHN0cm9rZS13aWR0aD0iMyIgbWFzaz0idXJsKCNlKSIvPjxyZWN0IHg9IjM5OCIgeT0iMTA5IiB3aWR0aD0iMTkiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSI0MzAiIHk9IjEwOSIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PHJlY3QgeD0iMjUiIHk9IjEwNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjQiIGZpbGw9IiNDMUIyREQiLz48cGF0aCBkPSJNMTA4IDEwN2ExIDEgMCAwMTEtMWgyOHY4aC0yOGExIDEgMCAwMS0xLTF2LTZ6IiBmaWxsPSIjRkY3NzM4Ii8+PG1hc2sgaWQ9ImYiIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjI5NSIgeT0iMTA1IiB3aWR0aD0iNzkiIGhlaWdodD0iMTAiIHJ4PSIxIi8+PC9tYXNrPjxyZWN0IHg9IjI5NSIgeT0iMTA1IiB3aWR0aD0iNzkiIGhlaWdodD0iMTAiIHJ4PSIxIiBzdHJva2U9IiNGRjc3MzgiIHN0cm9rZS13aWR0aD0iMyIgbWFzaz0idXJsKCNmKSIvPjxyZWN0IHg9IjM5IiB5PSIxMzEiIHdpZHRoPSIyMiIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjIwMCIgeT0iMTMxIiB3aWR0aD0iMTkiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48bWFzayBpZD0iZyIgZmlsbD0iI2ZmZiI+PHJlY3QgeD0iMTg4IiB5PSIxMjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHJ4PSIxIi8+PC9tYXNrPjxyZWN0IHg9IjE4OCIgeT0iMTI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIgc3Ryb2tlPSIjQzFCMkREIiBzdHJva2Utd2lkdGg9IjMiIG1hc2s9InVybCgjZykiLz48cmVjdCB4PSIyNTYiIHk9IjEzMSIgd2lkdGg9IjE5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjM0UyQzczIi8+PG1hc2sgaWQ9ImgiIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjI0MyIgeT0iMTI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMSIvPjwvbWFzaz48cmVjdCB4PSIyNDMiIHk9IjEyOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjEiIHN0cm9rZT0iI0MxQjJERCIgc3Ryb2tlLXdpZHRoPSIzIiBtYXNrPSJ1cmwoI2gpIi8+PHJlY3QgeD0iMzk4IiB5PSIxMzEiIHdpZHRoPSIxOSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzNFMkM3MyIvPjxyZWN0IHg9IjQzMCIgeT0iMTMxIiB3aWR0aD0iMjIiIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMzRTJDNzMiLz48cmVjdCB4PSIyNSIgeT0iMTI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iNCIgZmlsbD0iI0MxQjJERCIvPjxwYXRoIGQ9Ik0xMDggMTI5YTEgMSAwIDAxMS0xaDI4djhoLTI4YTEgMSAwIDAxLTEtMXYtNnoiIGZpbGw9IiNGRjc3MzgiLz48bWFzayBpZD0iaSIgZmlsbD0iI2ZmZiI+PHJlY3QgeD0iMjk1IiB5PSIxMjciIHdpZHRoPSI3OSIgaGVpZ2h0PSIxMCIgcng9IjEiLz48L21hc2s+PHJlY3QgeD0iMjk1IiB5PSIxMjciIHdpZHRoPSI3OSIgaGVpZ2h0PSIxMCIgcng9IjEiIHN0cm9rZT0iI0ZGNzczOCIgc3Ryb2tlLXdpZHRoPSIzIiBtYXNrPSJ1cmwoI2kpIi8+PHBhdGggZD0iTTQ3MiAxNTIuNDMzVjFIMy4xNzNMMiAxNTVsNDcwLTIuNTY3eiIgc3Ryb2tlPSIjRkY3NzM4IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxyZWN0IHg9IjI1IiB5PSI2MCIgd2lkdGg9IjUxIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMTA4IiB5PSI2MCIgd2lkdGg9IjUyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMTg4IiB5PSI2MCIgd2lkdGg9IjMxIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMjQzIiB5PSI2MCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMjk1IiB5PSI2MCIgd2lkdGg9IjMxIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMzk1IiB5PSI2MCIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iNDMwIiB5PSI2MCIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjNUE0QTc5Ii8+PHJlY3QgeD0iMTEwLjM3NSIgeT0iODQuMzc1IiB3aWR0aD0iMzYuMjUiIGhlaWdodD0iNy4yNSIgcng9Ii42MjUiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cmVjdCB4PSIxMTAuMzc1IiB5PSIxMDcuMzc1IiB3aWR0aD0iMzYuMjUiIGhlaWdodD0iNy4yNSIgcng9Ii42MjUiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48cmVjdCB4PSIxMTAuMzc1IiB5PSIxMjkuMzc1IiB3aWR0aD0iMzYuMjUiIGhlaWdodD0iNy4yNSIgcng9Ii42MjUiIHN0cm9rZT0iIzNFMkM3MyIgc3Ryb2tlLXdpZHRoPSIuNzUiLz48L3N2Zz4=";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_releases_list_releasesPromo_tsx.4d52b1782d5b3010222063acca292269.js.map