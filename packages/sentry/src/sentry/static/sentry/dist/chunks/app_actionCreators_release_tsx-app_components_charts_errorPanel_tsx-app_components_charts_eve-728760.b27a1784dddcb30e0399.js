"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_release_tsx-app_components_charts_errorPanel_tsx-app_components_charts_eve-728760"],{

/***/ "./app/actionCreators/events.tsx":
/*!***************************************!*\
  !*** ./app/actionCreators/events.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "doEventsRequest": () => (/* binding */ doEventsRequest),
/* harmony export */   "fetchTagFacets": () => (/* binding */ fetchTagFacets),
/* harmony export */   "fetchTotalCount": () => (/* binding */ fetchTotalCount)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getPeriod */ "./app/utils/getPeriod.tsx");
/* harmony import */ var sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/constants */ "./app/utils/performance/constants.tsx");






/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {Boolean} options.excludeOther Exclude the "Other" series when making a topEvents query
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 * @param {QueryBatching} options.queryBatching A container for batching functions from a provider
 * @param {Record<string, string>} options.queryExtras A list of extra query parameters
 * @param {(org: OrganizationSummary) => string} options.generatePathname A function that returns an override for the pathname
 */
const doEventsRequest = (api, _ref) => {
  var _generatePathname;

  let {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
    queryBatching,
    generatePathname,
    queryExtras,
    excludeOther,
    includeAllArgs
  } = _ref;
  const pathname = (_generatePathname = generatePathname === null || generatePathname === void 0 ? void 0 : generatePathname(organization)) !== null && _generatePathname !== void 0 ? _generatePathname : `/organizations/${organization.slug}/events-stats/`;
  const shouldDoublePeriod = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_2__.canIncludePreviousPeriod)(includePrevious, period);
  const urlQuery = Object.fromEntries(Object.entries({
    interval,
    comparisonDelta,
    project,
    environment,
    team,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial: partial ? '1' : undefined,
    withoutZerofill: withoutZerofill ? '1' : undefined,
    referrer: referrer ? referrer : 'api.organization-event-stats',
    excludeOther: excludeOther ? '1' : undefined
  }).filter(_ref2 => {
    let [, value] = _ref2;
    return typeof value !== 'undefined';
  })); // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.

  const periodObj = (0,sentry_utils_getPeriod__WEBPACK_IMPORTED_MODULE_3__.getPeriod)({
    period,
    start,
    end
  }, {
    shouldDoublePeriod
  });
  const queryObject = {
    includeAllArgs,
    query: { ...urlQuery,
      ...periodObj,
      ...queryExtras
    }
  };

  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, pathname, queryObject);
  }

  return api.requestPromise(pathname, queryObject);
};

/**
 * Fetches tag facets for a query
 */
function fetchTagFacets(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption
  });
}
/**
 * Fetches total count of events for a given query
 */

function fetchTotalCount(api, orgSlug, query) {
  const urlParams = lodash_pick__WEBPACK_IMPORTED_MODULE_1___default()(query, Object.values(sentry_utils_performance_constants__WEBPACK_IMPORTED_MODULE_4__.PERFORMANCE_URL_PARAM));
  const queryOption = { ...urlParams,
    query: query.query
  };
  return api.requestPromise(`/organizations/${orgSlug}/events-meta/`, {
    query: queryOption
  }).then(res => res.count);
}

/***/ }),

/***/ "./app/actionCreators/release.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/release.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "archiveRelease": () => (/* binding */ archiveRelease),
/* harmony export */   "getProjectRelease": () => (/* binding */ getProjectRelease),
/* harmony export */   "getReleaseDeploys": () => (/* binding */ getReleaseDeploys),
/* harmony export */   "restoreRelease": () => (/* binding */ restoreRelease)
/* harmony export */ });
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/releaseStore */ "./app/stores/releaseStore.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");






function getProjectRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(releaseVersion)}/`; // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRelease for the same
  // release to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.releaseLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getRelease-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function getReleaseDeploys(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  const path = `/organizations/${orgSlug}/releases/${encodeURIComponent(releaseVersion)}/deploys/`; // HACK(leedongwei): Same as above

  sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__["default"].state.deploysLoading[(0,sentry_stores_releaseStore__WEBPACK_IMPORTED_MODULE_3__.getReleaseStoreKey)(projectSlug, releaseVersion)] = true;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploys(orgSlug, projectSlug, releaseVersion);
  return api.requestPromise(path, {
    method: 'GET'
  }).then(res => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, res);
  }).catch(err => {
    // This happens when a Project is not linked to a specific Release
    if (err.status === 404) {
      sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysSuccess(projectSlug, releaseVersion, null);
      return;
    }

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadDeploysError(projectSlug, releaseVersion, err);
    _sentry_react__WEBPACK_IMPORTED_MODULE_5__.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['getReleaseDeploys-action-creator']);
      _sentry_react__WEBPACK_IMPORTED_MODULE_5__.captureException(err);
    });
  });
}
function archiveRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Archiving Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Archived,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully archived.'));
  }).catch(error => {
    var _error$responseJSON$d, _error$responseJSON;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail) !== null && _error$responseJSON$d !== void 0 ? _error$responseJSON$d : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be archived.'));
    throw error;
  });
}
function restoreRelease(api, params) {
  const {
    orgSlug,
    projectSlug,
    releaseVersion
  } = params;
  sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadRelease(orgSlug, projectSlug, releaseVersion);
  (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Restoring Release\u2026'));
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'POST',
    data: {
      status: sentry_types__WEBPACK_IMPORTED_MODULE_4__.ReleaseStatus.Active,
      projects: [],
      version: releaseVersion
    }
  }).then(release => {
    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseSuccess(projectSlug, releaseVersion, release);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release was successfully restored.'));
  }).catch(error => {
    var _error$responseJSON$d2, _error$responseJSON2;

    sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_1__["default"].loadReleaseError(projectSlug, releaseVersion, error);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_0__.addErrorMessage)((_error$responseJSON$d2 = (_error$responseJSON2 = error.responseJSON) === null || _error$responseJSON2 === void 0 ? void 0 : _error$responseJSON2.detail) !== null && _error$responseJSON$d2 !== void 0 ? _error$responseJSON$d2 : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Release could not be be restored.'));
    throw error;
  });
}

/***/ }),

/***/ "./app/actions/releaseActions.tsx":
/*!****************************************!*\
  !*** ./app/actions/releaseActions.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const ReleaseActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['loadRelease', // Singular as it loads 1 release
'loadReleaseError', 'loadReleaseSuccess', 'loadDeploys', // Plural as it loads all deploys related to a release
'loadDeploysError', 'loadDeploysSuccess']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseActions);

/***/ }),

/***/ "./app/components/charts/errorPanel.tsx":
/*!**********************************************!*\
  !*** ./app/components/charts/errorPanel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const ErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1six6h50"
} : 0)("display:flex;flex-direction:column;justify-content:center;align-items:center;flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height || '200px', ";position:relative;border-color:transparent;margin-bottom:0;color:", p => p.theme.gray300, ";font-size:", p => p.theme.fontSizeExtraLarge, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorPanel);

/***/ }),

/***/ "./app/components/charts/eventsRequest.tsx":
/*!*************************************************!*\
  !*** ./app/components/charts/eventsRequest.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/* harmony import */ var sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/events */ "./app/actionCreators/events.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/charts/loadingPanel */ "./app/components/charts/loadingPanel.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");














const propNamesToIgnore = ['api', 'children', 'organization', 'loading', 'queryBatching', 'generatePathname'];

const omitIgnoredProps = props => lodash_omitBy__WEBPACK_IMPORTED_MODULE_5___default()(props, (_value, key) => propNamesToIgnore.includes(key));

class EventsRequest extends react__WEBPACK_IMPORTED_MODULE_3__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      reloading: !!this.props.loading,
      errored: false,
      timeseriesData: null,
      fetchedWithPrevious: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "unmounting", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        confirmedQuery,
        onError,
        expired,
        name,
        hideError,
        ...props
      } = this.props;
      let timeseriesData = null;

      if (confirmedQuery === false) {
        return;
      }

      this.setState(state => ({
        reloading: state.timeseriesData !== null,
        errored: false,
        errorMessage: undefined
      }));
      let errorMessage;

      if (expired) {
        errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('%s has an invalid date range. Please try a more recent date range.', name);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(errorMessage, {
          append: true
        });
        this.setState({
          errored: true,
          errorMessage
        });
      } else {
        try {
          api.clear();
          timeseriesData = await (0,sentry_actionCreators_events__WEBPACK_IMPORTED_MODULE_6__.doEventsRequest)(api, props);
        } catch (resp) {
          if (resp && resp.responseJSON && resp.responseJSON.detail) {
            errorMessage = resp.responseJSON.detail;
          } else {
            errorMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Error loading chart data');
          }

          if (!hideError) {
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)(errorMessage);
          }

          if (onError) {
            onError(errorMessage);
          }

          this.setState({
            errored: true,
            errorMessage
          });
        }
      }

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        timeseriesData,
        fetchedWithPrevious: props.includePrevious
      });

      if (props.dataLoadedCallback) {
        props.dataLoadedCallback(timeseriesData);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getData", data => {
      const {
        fetchedWithPrevious
      } = this.state;
      const {
        period,
        includePrevious
      } = this.props;
      const hasPreviousPeriod = fetchedWithPrevious || (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.canIncludePreviousPeriod)(includePrevious, period); // Take the floor just in case, but data should always be divisible by 2

      const dataMiddleIndex = Math.floor(data.length / 2);
      return {
        current: hasPreviousPeriod ? data.slice(dataMiddleIndex) : data,
        previous: hasPreviousPeriod ? data.slice(0, dataMiddleIndex) : null
      };
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

  componentWillUnmount() {
    this.unmounting = true;
  }

  // This aggregates all values per `timestamp`
  calculateTotalsPerTimestamp(data) {
    let getName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : timestamp => timestamp * 1000;
    return data.map((_ref, i) => {
      let [timestamp, countArray] = _ref;
      return {
        name: getName(timestamp, countArray, i),
        value: countArray.reduce((acc, _ref2) => {
          let {
            count
          } = _ref2;
          return acc + count;
        }, 0)
      };
    });
  }
  /**
   * Get previous period data, but transform timestamps so that data fits unto
   * the current period's data axis
   */


  transformPreviousPeriodData(current, previous, seriesName) {
    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    if (!previous) {
      return null;
    }

    return {
      seriesName: seriesName !== null && seriesName !== void 0 ? seriesName : 'Previous',
      data: this.calculateTotalsPerTimestamp(previous, (_timestamp, _countArray, i) => current[i][0] * 1000),
      stack: 'previous'
    };
  }
  /**
   * Aggregate all counts for each time stamp
   */


  transformAggregatedTimeseries(data) {
    let seriesName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    return {
      seriesName,
      data: this.calculateTotalsPerTimestamp(data)
    };
  }
  /**
   * Transforms query response into timeseries data to be used in a chart
   */


  transformTimeseriesData(data, seriesName) {
    return [{
      seriesName: seriesName || 'Current',
      data: data.map(_ref3 => {
        let [timestamp, countsForTimestamp] = _ref3;
        return {
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, _ref4) => {
            let {
              count
            } = _ref4;
            return acc + count;
          }, 0)
        };
      })
    }];
  }
  /**
   * Transforms comparisonCount in query response into timeseries data to be used in a comparison chart for change alerts
   */


  transformComparisonTimeseriesData(data) {
    return [{
      seriesName: 'comparisonCount()',
      data: data.map(_ref5 => {
        let [timestamp, countsForTimestamp] = _ref5;
        return {
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, _ref6) => {
            let {
              comparisonCount
            } = _ref6;
            return acc + (comparisonCount !== null && comparisonCount !== void 0 ? comparisonCount : 0);
          }, 0)
        };
      })
    }];
  }

  processData(response) {
    var _ref7;

    let seriesIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    let seriesName = arguments.length > 2 ? arguments[2] : undefined;
    const {
      data,
      isMetricsData,
      totals
    } = response;
    const {
      includeTransformedData,
      includeTimeAggregation,
      timeAggregationSeriesName,
      currentSeriesNames,
      previousSeriesNames,
      comparisonDelta
    } = this.props;
    const {
      current,
      previous
    } = this.getData(data);
    const transformedData = includeTransformedData ? this.transformTimeseriesData(current, seriesName !== null && seriesName !== void 0 ? seriesName : currentSeriesNames === null || currentSeriesNames === void 0 ? void 0 : currentSeriesNames[seriesIndex]) : [];
    const transformedComparisonData = includeTransformedData && comparisonDelta ? this.transformComparisonTimeseriesData(current) : [];
    const previousData = includeTransformedData ? this.transformPreviousPeriodData(current, previous, (_ref7 = seriesName ? (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.getPreviousSeriesName)(seriesName) : undefined) !== null && _ref7 !== void 0 ? _ref7 : previousSeriesNames === null || previousSeriesNames === void 0 ? void 0 : previousSeriesNames[seriesIndex]) : null;
    const timeAggregatedData = includeTimeAggregation ? this.transformAggregatedTimeseries(current, timeAggregationSeriesName || '') : {};
    const timeframe = response.start && response.end ? !previous ? {
      start: response.start * 1000,
      end: response.end * 1000
    } : {
      // Find the midpoint of start & end since previous includes 2x data
      start: (response.start + response.end) * 500,
      end: response.end * 1000
    } : undefined;
    const processedData = {
      data: transformedData,
      comparisonData: transformedComparisonData,
      allData: data,
      originalData: current,
      totals,
      isMetricsData,
      originalPreviousData: previous,
      previousData,
      timeAggregatedData,
      timeframe
    };
    return processedData;
  }

  render() {
    const {
      children,
      showLoading,
      ...props
    } = this.props;
    const {
      topEvents
    } = this.props;
    const {
      timeseriesData,
      reloading,
      errored,
      errorMessage
    } = this.state; // Is "loading" if data is null

    const loading = this.props.loading || timeseriesData === null;

    if (showLoading && loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_charts_loadingPanel__WEBPACK_IMPORTED_MODULE_8__["default"], {
        "data-test-id": "events-request-loading"
      });
    }

    if ((0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_9__.isMultiSeriesStats)(timeseriesData, (0,sentry_utils__WEBPACK_IMPORTED_MODULE_11__.defined)(topEvents))) {
      // Convert multi-series results into chartable series. Multi series results
      // are created when multiple yAxis are used or a topEvents request is made.
      // Convert the timeseries data into a multi-series result set.
      // As the server will have replied with a map like:
      // {[titleString: string]: EventsStats}
      let timeframe = undefined;
      const seriesAdditionalInfo = {};
      const sortedTimeseriesData = Object.keys(timeseriesData).map((seriesName, index) => {
        const seriesData = timeseriesData[seriesName];
        const processedData = this.processData(seriesData, index, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_12__.stripEquationPrefix)(seriesName));

        if (!timeframe) {
          timeframe = processedData.timeframe;
        }

        if (processedData.isMetricsData) {
          seriesAdditionalInfo[seriesName] = {
            isMetricsData: processedData.isMetricsData
          };
        }

        return [seriesData.order || 0, processedData.data[0], processedData.previousData, {
          isMetricsData: processedData.isMetricsData
        }];
      }).sort((a, b) => a[0] - b[0]);
      const results = sortedTimeseriesData.map(item => {
        return item[1];
      });
      const previousTimeseriesData = sortedTimeseriesData.some(item => item[2] === null) ? undefined : sortedTimeseriesData.map(item => {
        return item[2];
      });
      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        results,
        timeframe,
        previousTimeseriesData,
        seriesAdditionalInfo,
        // sometimes we want to reference props that were given to EventsRequest
        ...props
      });
    }

    if (timeseriesData) {
      var _this$props$currentSe, _this$props$currentSe2;

      const {
        data: transformedTimeseriesData,
        comparisonData: transformedComparisonTimeseriesData,
        allData: allTimeseriesData,
        originalData: originalTimeseriesData,
        totals: timeseriesTotals,
        originalPreviousData: originalPreviousTimeseriesData,
        previousData: previousTimeseriesData,
        timeAggregatedData,
        timeframe,
        isMetricsData
      } = this.processData(timeseriesData);
      const seriesAdditionalInfo = {
        [(_this$props$currentSe = (_this$props$currentSe2 = this.props.currentSeriesNames) === null || _this$props$currentSe2 === void 0 ? void 0 : _this$props$currentSe2[0]) !== null && _this$props$currentSe !== void 0 ? _this$props$currentSe : 'current']: {
          isMetricsData
        }
      };
      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        // meta data,
        seriesAdditionalInfo,
        // timeseries data
        timeseriesData: transformedTimeseriesData,
        comparisonTimeseriesData: transformedComparisonTimeseriesData,
        allTimeseriesData,
        originalTimeseriesData,
        timeseriesTotals,
        originalPreviousTimeseriesData,
        previousTimeseriesData: previousTimeseriesData ? [previousTimeseriesData] : previousTimeseriesData,
        timeAggregatedData,
        timeframe,
        // sometimes we want to reference props that were given to EventsRequest
        ...props
      });
    }

    return children({
      loading,
      reloading,
      errored,
      errorMessage,
      ...props
    });
  }

}

EventsRequest.displayName = "EventsRequest";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(EventsRequest, "defaultProps", {
  period: undefined,
  start: null,
  end: null,
  interval: '1d',
  comparisonDelta: undefined,
  limit: 15,
  query: '',
  includePrevious: true,
  includeTransformedData: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsRequest);

/***/ }),

/***/ "./app/components/charts/lineChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/lineChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LineChart": () => (/* binding */ LineChart)
/* harmony export */ });
/* harmony import */ var _series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function LineChart(_ref) {
  let {
    series,
    seriesOptions,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    series: series.map(_ref2 => {
      let {
        seriesName,
        data,
        dataArray,
        ...options
      } = _ref2;
      return (0,_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...seriesOptions,
        ...options,
        name: seriesName,
        data: dataArray || (data === null || data === void 0 ? void 0 : data.map(_ref3 => {
          let {
            value,
            name
          } = _ref3;
          return [name, value];
        })),
        animation: false,
        animationThreshold: 1,
        animationDuration: 0
      });
    })
  });
}
LineChart.displayName = "LineChart";

/***/ }),

/***/ "./app/components/charts/loadingPanel.tsx":
/*!************************************************!*\
  !*** ./app/components/charts/loadingPanel.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/loadingMask */ "./app/components/loadingMask.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const LoadingPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref => {
  let {
    height: _height,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_loadingMask__WEBPACK_IMPORTED_MODULE_1__["default"], {})
  });
},  true ? {
  target: "eumb2md0"
} : 0)("flex:1;flex-shrink:0;overflow:hidden;height:", p => p.height, ";position:relative;border-color:transparent;margin-bottom:0;" + ( true ? "" : 0));

LoadingPanel.defaultProps = {
  height: '200px'
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingPanel);

/***/ }),

/***/ "./app/components/discover/discoverFeature.tsx":
/*!*****************************************************!*\
  !*** ./app/components/discover/discoverFeature.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Provide a component that passes a prop to indicate if the current
 * organization doesn't have access to discover results.
 */
function DiscoverFeature(_ref) {
  let {
    children
  } = _ref;
  const noFeatureMessage = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Requires discover feature.');

  const renderDisabled = p => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_2__.Hovercard, {
    body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_1__["default"], {
      features: p.features,
      hideHelpToggle: true,
      message: noFeatureMessage,
      featureName: noFeatureMessage
    }),
    children: p.children(p)
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    hookName: "feature-disabled:open-discover",
    features: ['organizations:discover-basic'],
    renderDisabled: renderDisabled,
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return children({
        hasFeature
      });
    }
  });
}

DiscoverFeature.displayName = "DiscoverFeature";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverFeature);

/***/ }),

/***/ "./app/components/discoverButton.tsx":
/*!*******************************************!*\
  !*** ./app/components/discoverButton.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/discover/discoverFeature */ "./app/components/discover/discoverFeature.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton(_ref) {
  let {
    children,
    ...buttonProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_discover_discoverFeature__WEBPACK_IMPORTED_MODULE_1__["default"], {
    children: _ref2 => {
      let {
        hasFeature
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
        disabled: !hasFeature,
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Open in Discover'),
        ...buttonProps,
        children: children
      });
    }
  });
}

DiscoverButton.displayName = "DiscoverButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DiscoverButton);

/***/ }),

/***/ "./app/components/loadingMask.tsx":
/*!****************************************!*\
  !*** ./app/components/loadingMask.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const LoadingMask = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1dnwgq10"
} : 0)("background-color:", p => p.theme.backgroundSecondary, ";border-radius:", p => p.theme.borderRadius, ";position:absolute;top:0;bottom:0;left:0;right:0;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LoadingMask);

/***/ }),

/***/ "./app/components/notAvailable.tsx":
/*!*****************************************!*\
  !*** ./app/components/notAvailable.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function NotAvailable(_ref) {
  let {
    tooltip,
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_1__["default"], {
    title: tooltip,
    skipWrapper: true,
    disabled: tooltip === undefined,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Wrapper, {
      className: className,
      children: '\u2014'
    })
  });
}

NotAvailable.displayName = "NotAvailable";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ickyb10"
} : 0)("color:", p => p.theme.gray200, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NotAvailable);

/***/ }),

/***/ "./app/stores/releaseStore.tsx":
/*!*************************************!*\
  !*** ./app/stores/releaseStore.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getReleaseStoreKey": () => (/* binding */ getReleaseStoreKey)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actions/releaseActions */ "./app/actions/releaseActions.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const getReleaseStoreKey = (projectSlug, releaseVersion) => `${projectSlug}${releaseVersion}`;
const storeConfig = {
  state: {
    orgSlug: undefined,
    release: new Map(),
    releaseLoading: new Map(),
    releaseError: new Map(),
    deploys: new Map(),
    deploysLoading: new Map(),
    deploysError: new Map()
  },
  listenables: sentry_actions_releaseActions__WEBPACK_IMPORTED_MODULE_3__["default"],
  unsubscribeListeners: [],

  init() {
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.updateOrganization));
    this.reset();
  },

  reset() {
    this.state = {
      orgSlug: undefined,
      release: new Map(),
      releaseLoading: new Map(),
      releaseError: new Map(),
      deploys: new Map(),
      deploysLoading: new Map(),
      deploysError: new Map()
    };
    this.trigger(this.state);
  },

  updateOrganization(org) {
    this.reset();
    this.state.orgSlug = org.slug;
    this.trigger(this.state);
  },

  loadRelease(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: true
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadReleaseError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadReleaseSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      release,
      releaseLoading,
      releaseError,
      ...state
    } = this.state;
    this.state = { ...state,
      release: { ...release,
        [releaseKey]: data
      },
      releaseLoading: { ...releaseLoading,
        [releaseKey]: false
      },
      releaseError: { ...releaseError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploys(orgSlug, projectSlug, releaseVersion) {
    // Wipe entire store if the user switched organizations
    if (!this.orgSlug || this.orgSlug !== orgSlug) {
      this.reset();
      this.orgSlug = orgSlug;
    }

    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: true
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  loadDeploysError(projectSlug, releaseVersion, error) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: error
      }
    };
    this.trigger(this.state);
  },

  loadDeploysSuccess(projectSlug, releaseVersion, data) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    const {
      deploys,
      deploysLoading,
      deploysError,
      ...state
    } = this.state;
    this.state = { ...state,
      deploys: { ...deploys,
        [releaseKey]: data
      },
      deploysLoading: { ...deploysLoading,
        [releaseKey]: false
      },
      deploysError: { ...deploysError,
        [releaseKey]: undefined
      }
    };
    this.trigger(this.state);
  },

  get(projectSlug, releaseVersion) {
    const releaseKey = getReleaseStoreKey(projectSlug, releaseVersion);
    return {
      release: this.state.release[releaseKey],
      releaseLoading: this.state.releaseLoading[releaseKey],
      releaseError: this.state.releaseError[releaseKey],
      deploys: this.state.deploys[releaseKey],
      deploysLoading: this.state.deploysLoading[releaseKey],
      deploysError: this.state.deploysError[releaseKey]
    };
  }

};
const ReleaseStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleaseStore);

/***/ }),

/***/ "./app/utils/getPeriod.tsx":
/*!*********************************!*\
  !*** ./app/utils/getPeriod.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getPeriod": () => (/* binding */ getPeriod)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");






/**
 * Gets the period to query with if we need to double the initial period in order
 * to get data for the previous period
 *
 * Returns an object with either a period or start/end dates ({statsPeriod: string} or {start: string, end: string})
 */
function getPeriod(_ref) {
  let {
    period,
    start,
    end
  } = _ref;
  let {
    shouldDoublePeriod
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!period && !start && !end) {
    period = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_STATS_PERIOD;
  } // you can not specify both relative and absolute periods
  // relative period takes precedence


  if (period) {
    if (!shouldDoublePeriod) {
      return {
        statsPeriod: period
      };
    }

    const [, periodNumber, periodLength] = period.match(/([0-9]+)([mhdw])/);
    return {
      statsPeriod: `${parseInt(periodNumber, 10) * 2}${periodLength}`
    };
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  const formattedStart = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(start);
  const formattedEnd = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(end);

  if (shouldDoublePeriod) {
    // get duration of end - start and double
    const diff = moment__WEBPACK_IMPORTED_MODULE_2___default()(end).diff(moment__WEBPACK_IMPORTED_MODULE_2___default()(start));
    const previousPeriodStart = moment__WEBPACK_IMPORTED_MODULE_2___default()(start).subtract(diff); // This is not as accurate as having 2 start/end objs

    return {
      start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_4__.getUtcDateString)(previousPeriodStart),
      end: formattedEnd
    };
  }

  return {
    start: formattedStart,
    end: formattedEnd
  };
}

/***/ }),

/***/ "./app/views/performance/styles.tsx":
/*!******************************************!*\
  !*** ./app/views/performance/styles.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DoubleHeaderContainer": () => (/* binding */ DoubleHeaderContainer),
/* harmony export */   "ErrorPanel": () => (/* binding */ ErrorPanel),
/* harmony export */   "GridCell": () => (/* binding */ GridCell),
/* harmony export */   "GridCellNumber": () => (/* binding */ GridCellNumber)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


const GridCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "exyvyft3"
} : 0)( true ? {
  name: "mmdt3g",
  styles: "font-size:14px"
} : 0);
const GridCellNumber = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(GridCell,  true ? {
  target: "exyvyft2"
} : 0)( true ? {
  name: "1ofxr9c",
  styles: "text-align:right;font-variant-numeric:tabular-nums;flex-grow:1"
} : 0);
const DoubleHeaderContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "exyvyft1"
} : 0)("display:grid;grid-template-columns:1fr 1fr;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(3), ";" + ( true ? "" : 0));
const ErrorPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "exyvyft0"
} : 0)( true ? {
  name: "1oc6478",
  styles: "display:flex;justify-content:center;align-items:center;flex:1;flex-shrink:0;overflow:hidden;height:200px;position:relative;border-color:transparent;margin-bottom:0"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_release_tsx-app_components_charts_errorPanel_tsx-app_components_charts_eve-728760.62e46b71cb3f7c62287596dc71dbfcd4.js.map