"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_index_tsx"],{

/***/ "./app/views/dashboardsV2/index.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/index.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _detail__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./detail */ "./app/views/dashboardsV2/detail.tsx");
/* harmony import */ var _orgDashboards__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./orgDashboards */ "./app/views/dashboardsV2/orgDashboards.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _view__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./view */ "./app/views/dashboardsV2/view.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function DashboardsV2Container(props) {
  const {
    organization,
    params,
    api,
    location,
    children
  } = props;

  if (organization.features.includes('dashboards-edit')) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: children
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_view__WEBPACK_IMPORTED_MODULE_10__.DashboardBasicFeature, {
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_orgDashboards__WEBPACK_IMPORTED_MODULE_8__["default"], {
      api: api,
      location: location,
      params: params,
      organization: organization,
      children: _ref => {
        let {
          dashboard,
          dashboards,
          error,
          onDashboardUpdate
        } = _ref;
        return error ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_3__["default"], {}) : dashboard ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_2__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_detail__WEBPACK_IMPORTED_MODULE_7__["default"], { ...props,
            initialState: _types__WEBPACK_IMPORTED_MODULE_9__.DashboardState.VIEW,
            dashboard: dashboard,
            dashboards: dashboards,
            onDashboardUpdate: onDashboardUpdate
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {});
      }
    })
  });
}

DashboardsV2Container.displayName = "DashboardsV2Container";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_5__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(DashboardsV2Container)));

/***/ }),

/***/ "./app/views/dashboardsV2/orgDashboards.tsx":
/*!**************************************************!*\
  !*** ./app/views/dashboardsV2/orgDashboards.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _layoutUtils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./layoutUtils */ "./app/views/dashboardsV2/layoutUtils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















class OrgDashboards extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      // AsyncComponent state
      loading: true,
      reloading: false,
      error: false,
      errors: {},
      dashboards: [],
      selectedDashboard: null
    });
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(prevProps.params.dashboardId, this.props.params.dashboardId)) {
      this.remountComponent();
    }
  }

  getEndpoints() {
    const {
      organization,
      params
    } = this.props;
    const url = `/organizations/${organization.slug}/dashboards/`;
    const endpoints = [['dashboards', url]];

    if (params.dashboardId) {
      endpoints.push(['selectedDashboard', `${url}${params.dashboardId}/`]);
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_13__.trackAnalyticsEvent)({
        eventKey: 'dashboards2.view',
        eventName: 'Dashboards2: View dashboard',
        organization_id: parseInt(this.props.organization.id, 10),
        dashboard_id: params.dashboardId
      });
    }

    return endpoints;
  }

  onDashboardUpdate(updatedDashboard) {
    this.setState({
      selectedDashboard: updatedDashboard
    });
  }

  getDashboards() {
    const {
      dashboards
    } = this.state;
    return Array.isArray(dashboards) ? dashboards : [];
  }

  onRequestSuccess(_ref) {
    let {
      stateKey,
      data
    } = _ref;
    const {
      params,
      organization,
      location
    } = this.props;

    if (params.dashboardId || stateKey === 'selectedDashboard') {
      const queryParamFilters = new Set(['project', 'environment', 'statsPeriod', 'start', 'end', 'utc', 'release']);

      if (organization.features.includes('dashboards-top-level-filter') && stateKey === 'selectedDashboard' && // Only redirect if there are saved filters and none of the filters
      // appear in the query params
      (0,_utils__WEBPACK_IMPORTED_MODULE_15__.hasSavedPageFilters)(data) && lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(Object.keys(location.query).filter(unsavedQueryParam => queryParamFilters.has(unsavedQueryParam)))) {
        react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({ ...location,
          query: { ...location.query,
            project: data.projects,
            environment: data.environment,
            statsPeriod: data.period,
            start: data.start,
            end: data.end,
            utc: data.utc
          }
        });
      }

      return;
    } // If we don't have a selected dashboard, and one isn't going to arrive
    // we can redirect to the first dashboard in the list.


    const dashboardId = data.length ? data[0].id : 'default-overview';
    const url = `/organizations/${organization.slug}/dashboard/${dashboardId}/`;
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({
      pathname: url,
      query: { ...location.query
      }
    });
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__.PageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {})
    });
  }

  renderBody() {
    const {
      children,
      organization
    } = this.props;
    const {
      selectedDashboard,
      error
    } = this.state;
    let dashboard = selectedDashboard;

    if (organization.features.includes('dashboard-grid-layout')) {
      // Ensure there are always tempIds for grid layout
      // This is needed because there are cases where the dashboard
      // renders before the onRequestSuccess setState is processed
      // and will caused stacked widgets because of missing tempIds
      dashboard = selectedDashboard ? { ...selectedDashboard,
        widgets: selectedDashboard.widgets.map(_layoutUtils__WEBPACK_IMPORTED_MODULE_14__.assignTempId)
      } : null;
    }

    return children({
      error,
      dashboard,
      dashboards: this.getDashboards(),
      onDashboardUpdate: updatedDashboard => this.onDashboardUpdate(updatedDashboard)
    });
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(resp => resp && resp.status === 404);

    if (notFound) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_8__["default"], {});
    }

    return super.renderError(error, true);
  }

  renderComponent() {
    const {
      organization,
      location
    } = this.props;
    const {
      loading,
      selectedDashboard
    } = this.state;

    if (!organization.features.includes('dashboards-basic')) {
      // Redirect to Dashboards v1
      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: { ...location.query
        }
      });
      return null;
    }

    if (loading && organization.features.includes('dashboards-top-level-filter') && selectedDashboard && (0,_utils__WEBPACK_IMPORTED_MODULE_15__.hasSavedPageFilters)(selectedDashboard) && lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(location.query)) {
      // Block dashboard from rendering if the dashboard has filters and
      // the URL does not contain filters yet. The filters can either match the
      // saved filters, or can be different (i.e. sharing an unsaved state)
      return this.renderLoading();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_10__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Dashboards'),
      orgSlug: organization.slug,
      children: super.renderComponent()
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrgDashboards);

/***/ }),

/***/ "./app/views/dashboardsV2/view.tsx":
/*!*****************************************!*\
  !*** ./app/views/dashboardsV2/view.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DashboardBasicFeature": () => (/* binding */ DashboardBasicFeature),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/dashboards */ "./app/actionCreators/dashboards.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _detail__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./detail */ "./app/views/dashboardsV2/detail.tsx");
/* harmony import */ var _orgDashboards__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./orgDashboards */ "./app/views/dashboardsV2/orgDashboards.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















const ALLOWED_PARAMS = ['start', 'end', 'utc', 'period', 'project', 'environment', 'statsPeriod'];

function ViewEditDashboard(props) {
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_13__["default"])();
  const {
    organization,
    params,
    location
  } = props;
  const dashboardId = params.dashboardId;
  const orgSlug = organization.slug;
  const [newWidget, setNewWidget] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)();
  const [dashboardInitialState, setDashboardInitialState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(_types__WEBPACK_IMPORTED_MODULE_17__.DashboardState.VIEW);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (dashboardId && dashboardId !== 'default-overview') {
      (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_5__.updateDashboardVisit)(api, orgSlug, dashboardId);
    }
  }, [api, orgSlug, dashboardId]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const constructedWidget = (0,_utils__WEBPACK_IMPORTED_MODULE_18__.constructWidgetFromQuery)(location.query);
    setNewWidget(constructedWidget); // Clean up url after constructing widget from query string, only allow GHS params

    if (constructedWidget) {
      setDashboardInitialState(_types__WEBPACK_IMPORTED_MODULE_17__.DashboardState.EDIT);
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace({
        pathname: location.pathname,
        query: lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(location.query, ALLOWED_PARAMS)
      });
    }
  }, [location.pathname]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(DashboardBasicFeature, {
    organization: organization,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_orgDashboards__WEBPACK_IMPORTED_MODULE_16__["default"], {
      api: api,
      location: location,
      params: params,
      organization: organization,
      children: _ref => {
        let {
          dashboard,
          dashboards,
          error,
          onDashboardUpdate
        } = _ref;
        return error ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_9__["default"], {}) : dashboard ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_8__["default"], {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_detail__WEBPACK_IMPORTED_MODULE_15__["default"], { ...props,
            initialState: dashboardInitialState,
            dashboard: dashboard,
            dashboards: dashboards,
            onDashboardUpdate: onDashboardUpdate,
            newWidget: newWidget,
            onSetNewWidget: () => setNewWidget(undefined)
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {});
      }
    })
  });
}

ViewEditDashboard.displayName = "ViewEditDashboard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])(ViewEditDashboard));
const DashboardBasicFeature = _ref2 => {
  let {
    organization,
    children
  } = _ref2;

  const renderDisabled = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_12__.PageContent, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_7__["default"], {
      type: "warning",
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("You don't have access to this feature")
    })
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_6__["default"], {
    hookName: "feature-disabled:dashboards-page",
    features: ['organizations:dashboards-basic'],
    organization: organization,
    renderDisabled: renderDisabled,
    children: children
  });
};
DashboardBasicFeature.displayName = "DashboardBasicFeature";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_index_tsx.572c340773d2d16ed04f55262c173d39.js.map