"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_dashboard_tsx"],{

/***/ "./app/actionCreators/dashboards.tsx":
/*!*******************************************!*\
  !*** ./app/actionCreators/dashboards.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createDashboard": () => (/* binding */ createDashboard),
/* harmony export */   "deleteDashboard": () => (/* binding */ deleteDashboard),
/* harmony export */   "fetchDashboard": () => (/* binding */ fetchDashboard),
/* harmony export */   "fetchDashboards": () => (/* binding */ fetchDashboards),
/* harmony export */   "updateDashboard": () => (/* binding */ updateDashboard),
/* harmony export */   "updateDashboardVisit": () => (/* binding */ updateDashboardVisit),
/* harmony export */   "validateWidget": () => (/* binding */ validateWidget)
/* harmony export */ });
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");





function fetchDashboards(api, orgSlug) {
  const promise = api.requestPromise(`/organizations/${orgSlug}/dashboards/`, {
    method: 'GET',
    query: {
      sort: 'myDashboardsAndRecentlyViewed'
    }
  });
  promise.catch(response => {
    var _response$responseJSO;

    const errorResponse = (_response$responseJSO = response === null || response === void 0 ? void 0 : response.responseJSON) !== null && _response$responseJSO !== void 0 ? _response$responseJSO : null;

    if (errorResponse) {
      const errors = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__.flattenErrors)(errorResponse, {});
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errors[Object.keys(errors)[0]]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to fetch dashboards'));
    }
  });
  return promise;
}
function createDashboard(api, orgId, newDashboard, duplicate) {
  const {
    title,
    widgets,
    projects,
    environment,
    period,
    start,
    end,
    filters,
    utc
  } = newDashboard;
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/`, {
    method: 'POST',
    data: {
      title,
      widgets: widgets.map(widget => lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(widget, ['tempId'])),
      duplicate,
      projects,
      environment,
      period,
      start,
      end,
      filters,
      utc
    },
    query: {
      project: projects
    }
  });
  promise.catch(response => {
    var _response$responseJSO2;

    const errorResponse = (_response$responseJSO2 = response === null || response === void 0 ? void 0 : response.responseJSON) !== null && _response$responseJSO2 !== void 0 ? _response$responseJSO2 : null;

    if (errorResponse) {
      const errors = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__.flattenErrors)(errorResponse, {});
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errors[Object.keys(errors)[0]]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to create dashboard'));
    }
  });
  return promise;
}
function updateDashboardVisit(api, orgId, dashboardId) {
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/${dashboardId}/visit/`, {
    method: 'POST'
  });
  return promise;
}
function fetchDashboard(api, orgId, dashboardId) {
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/${dashboardId}/`, {
    method: 'GET'
  });
  promise.catch(response => {
    var _response$responseJSO3;

    const errorResponse = (_response$responseJSO3 = response === null || response === void 0 ? void 0 : response.responseJSON) !== null && _response$responseJSO3 !== void 0 ? _response$responseJSO3 : null;

    if (errorResponse) {
      const errors = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__.flattenErrors)(errorResponse, {});
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errors[Object.keys(errors)[0]]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to load dashboard'));
    }
  });
  return promise;
}
function updateDashboard(api, orgId, dashboard) {
  const {
    title,
    widgets,
    projects,
    environment,
    period,
    start,
    end,
    filters,
    utc
  } = dashboard;
  const data = {
    title,
    widgets: widgets.map(widget => lodash_omit__WEBPACK_IMPORTED_MODULE_0___default()(widget, ['tempId'])),
    projects,
    environment,
    period,
    start,
    end,
    filters,
    utc
  };
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/${dashboard.id}/`, {
    method: 'PUT',
    data,
    query: {
      project: projects
    }
  });
  promise.catch(response => {
    var _response$responseJSO4;

    const errorResponse = (_response$responseJSO4 = response === null || response === void 0 ? void 0 : response.responseJSON) !== null && _response$responseJSO4 !== void 0 ? _response$responseJSO4 : null;

    if (errorResponse) {
      const errors = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__.flattenErrors)(errorResponse, {});
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errors[Object.keys(errors)[0]]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to update dashboard'));
    }
  });
  return promise;
}
function deleteDashboard(api, orgId, dashboardId) {
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/${dashboardId}/`, {
    method: 'DELETE'
  });
  promise.catch(response => {
    var _response$responseJSO5;

    const errorResponse = (_response$responseJSO5 = response === null || response === void 0 ? void 0 : response.responseJSON) !== null && _response$responseJSO5 !== void 0 ? _response$responseJSO5 : null;

    if (errorResponse) {
      const errors = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_4__.flattenErrors)(errorResponse, {});
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)(errors[Object.keys(errors)[0]]);
    } else {
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_1__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Unable to delete dashboard'));
    }
  });
  return promise;
}
function validateWidget(api, orgId, widget) {
  const promise = api.requestPromise(`/organizations/${orgId}/dashboards/widgets/`, {
    method: 'POST',
    data: widget,
    query: {
      // TODO: This should be replaced in the future with projects
      // when we save Dashboard page filters. This is being sent to
      // bypass validation when creating or updating dashboards
      project: [sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_2__.ALL_ACCESS_PROJECTS]
    }
  });
  return promise;
}

/***/ }),

/***/ "./app/views/dashboardsV2/addWidget.tsx":
/*!**********************************************!*\
  !*** ./app/views/dashboardsV2/addWidget.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ADD_WIDGET_BUTTON_DRAG_ID": () => (/* binding */ ADD_WIDGET_BUTTON_DRAG_ID),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @dnd-kit/sortable */ "../node_modules/@dnd-kit/sortable/dist/sortable.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _widgetWrapper__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./widgetWrapper */ "./app/views/dashboardsV2/widgetWrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';
const initialStyles = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1
};

function AddWidget(_ref) {
  let {
    onAddWidget
  } = _ref;
  const {
    setNodeRef,
    transform
  } = (0,_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_1__.useSortable)({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_widgetWrapper__WEBPACK_IMPORTED_MODULE_6__["default"], {
    ref: setNodeRef,
    displayType: _types__WEBPACK_IMPORTED_MODULE_5__.DisplayType.BIG_NUMBER,
    layoutId: ADD_WIDGET_BUTTON_DRAG_ID,
    style: {
      originX: 0,
      originY: 0
    },
    animate: transform ? {
      x: transform.x,
      y: transform.y,
      scaleX: transform !== null && transform !== void 0 && transform.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
      scaleY: transform !== null && transform !== void 0 && transform.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1
    } : initialStyles,
    transition: {
      duration: 0.25
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(InnerWrapper, {
      onClick: onAddWidget,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(AddButton, {
        "data-test-id": "widget-add",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconAdd, {
          size: "lg",
          isCircled: true,
          color: "inactive"
        }),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Add widget')
      })
    })
  }, "add");
}

AddWidget.displayName = "AddWidget";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AddWidget);

const AddButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "e1sxcph31"
} : 0)( true ? {
  name: "6ayxgl",
  styles: "border:none;&,&:focus,&:active,&:hover{background:transparent;box-shadow:none;}"
} : 0);

const InnerWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1sxcph30"
} : 0)("width:100%;height:110px;border:2px dashed ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";display:flex;align-items:center;justify-content:center;cursor:", p => p.onClick ? 'pointer' : '', ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/dashboard.tsx":
/*!**********************************************!*\
  !*** ./app/views/dashboardsV2/dashboard.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DRAG_HANDLE_CLASS": () => (/* binding */ DRAG_HANDLE_CLASS),
/* harmony export */   "NUM_DESKTOP_COLS": () => (/* binding */ NUM_DESKTOP_COLS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react_grid_layout_css_styles_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-grid-layout/css/styles.css */ "../node_modules/react-grid-layout/css/styles.css");
/* harmony import */ var react_resizable_css_styles_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-resizable/css/styles.css */ "../node_modules/react-resizable/css/styles.css");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_grid_layout__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-grid-layout */ "../node_modules/react-grid-layout/index.js");
/* harmony import */ var react_grid_layout__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(react_grid_layout__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var react_lazyload__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! react-lazyload */ "../node_modules/react-lazyload/lib/index.js");
/* harmony import */ var _dnd_kit_core__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @dnd-kit/core */ "../node_modules/@dnd-kit/core/dist/core.esm.js");
/* harmony import */ var _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @dnd-kit/sortable */ "../node_modules/@dnd-kit/sortable/dist/sortable.esm.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_13__);
/* harmony import */ var sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/actionCreators/dashboards */ "./app/actionCreators/dashboards.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/actionCreators/tags */ "./app/actionCreators/tags.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _addWidget__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./addWidget */ "./app/views/dashboardsV2/addWidget.tsx");
/* harmony import */ var _layoutUtils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./layoutUtils */ "./app/views/dashboardsV2/layoutUtils.tsx");
/* harmony import */ var _sortableWidget__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./sortableWidget */ "./app/views/dashboardsV2/sortableWidget.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");



































const DRAG_HANDLE_CLASS = 'widget-drag';
const DRAG_RESIZE_CLASS = 'widget-resize';
const DESKTOP = 'desktop';
const MOBILE = 'mobile';
const NUM_DESKTOP_COLS = 6;
const NUM_MOBILE_COLS = 2;
const ROW_HEIGHT = 120;
const WIDGET_MARGINS = [16, 16];
const BOTTOM_MOBILE_VIEW_POSITION = {
  x: 0,
  y: Number.MAX_SAFE_INTEGER
};
const MOBILE_BREAKPOINT = parseInt(sentry_utils_theme__WEBPACK_IMPORTED_MODULE_24__["default"].breakpoints.small, 10);
const BREAKPOINTS = {
  [MOBILE]: 0,
  [DESKTOP]: MOBILE_BREAKPOINT
};
const COLUMNS = {
  [MOBILE]: NUM_MOBILE_COLS,
  [DESKTOP]: NUM_DESKTOP_COLS
};

class Dashboard extends react__WEBPACK_IMPORTED_MODULE_6__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "forceCheckTimeout", undefined);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedHandleResize", lodash_debounce__WEBPACK_IMPORTED_MODULE_12___default()(() => {
      this.setState({
        windowWidth: window.innerWidth
      });
    }, 250));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleStartAdd", () => {
      const {
        organization,
        dashboard,
        selection,
        handleUpdateWidgetList,
        handleAddCustomWidget,
        router,
        location,
        paramDashboardId
      } = this.props;

      if (organization.features.includes('new-widget-builder-experience-design')) {
        if (paramDashboardId) {
          router.push({
            pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/new/`,
            query: { ...location.query,
              source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.DASHBOARDS
            }
          });
          return;
        }

        router.push({
          pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
          query: { ...location.query,
            source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.DASHBOARDS
          }
        });
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('dashboards_views.add_widget_modal.opened', {
        organization
      });
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('dashboards_views.widget_library.opened', {
        organization
      });
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_17__.openAddDashboardWidgetModal)({
        organization,
        dashboard,
        selection,
        onAddWidget: handleAddCustomWidget,
        onAddLibraryWidget: widgets => handleUpdateWidgetList(widgets),
        source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.LIBRARY
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUpdateComplete", prevWidget => nextWidget => {
      const {
        isEditing,
        onUpdate,
        handleUpdateWidgetList
      } = this.props;
      let nextList = [...this.props.dashboard.widgets];
      const updateIndex = nextList.indexOf(prevWidget);
      const nextWidgetData = { ...nextWidget,
        tempId: prevWidget.tempId
      }; // Only modify and re-compact if the default height has changed

      if ((0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getDefaultWidgetHeight)(prevWidget.displayType) !== (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getDefaultWidgetHeight)(nextWidget.displayType)) {
        nextList[updateIndex] = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.enforceWidgetHeightValues)(nextWidgetData);
        nextList = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.generateWidgetsAfterCompaction)(nextList);
      } else {
        nextList[updateIndex] = nextWidgetData;
      }

      onUpdate(nextList);

      if (!!!isEditing) {
        handleUpdateWidgetList(nextList);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteWidget", widgetToDelete => () => {
      const {
        dashboard,
        onUpdate,
        isEditing,
        handleUpdateWidgetList
      } = this.props;
      let nextList = dashboard.widgets.filter(widget => widget !== widgetToDelete);
      nextList = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.generateWidgetsAfterCompaction)(nextList);
      onUpdate(nextList);

      if (!!!isEditing) {
        handleUpdateWidgetList(nextList);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDuplicateWidget", (widget, index) => () => {
      const {
        dashboard,
        onUpdate,
        isEditing,
        handleUpdateWidgetList
      } = this.props;
      const widgetCopy = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_11___default()((0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.assignTempId)({ ...widget,
        id: undefined,
        tempId: undefined
      }));
      let nextList = [...dashboard.widgets];
      nextList.splice(index, 0, widgetCopy);
      nextList = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.generateWidgetsAfterCompaction)(nextList);
      onUpdate(nextList);

      if (!!!isEditing) {
        handleUpdateWidgetList(nextList);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleEditWidget", (widget, index) => () => {
      const {
        organization,
        dashboard,
        selection,
        router,
        location,
        paramDashboardId,
        handleAddCustomWidget,
        isEditing
      } = this.props;

      if (organization.features.includes('new-widget-builder-experience-design') && (!organization.features.includes('new-widget-builder-experience-modal-access') || isEditing)) {
        if (paramDashboardId) {
          router.push({
            pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/${index}/edit/`,
            query: { ...location.query,
              source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.DASHBOARDS
            }
          });
          return;
        }

        router.push({
          pathname: `/organizations/${organization.slug}/dashboards/new/widget/${index}/edit/`,
          query: { ...location.query,
            source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.DASHBOARDS
          }
        });
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_23__["default"])('dashboards_views.edit_widget_modal.opened', {
        organization
      });
      const modalProps = {
        organization,
        widget,
        selection,
        onAddWidget: handleAddCustomWidget,
        onUpdateWidget: this.handleUpdateComplete(widget)
      };
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_17__.openAddDashboardWidgetModal)({ ...modalProps,
        dashboard,
        source: _types__WEBPACK_IMPORTED_MODULE_30__.DashboardWidgetSource.DASHBOARDS
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleLayoutChange", (_, allLayouts) => {
      const {
        isMobile
      } = this.state;
      const {
        dashboard,
        onUpdate
      } = this.props;

      const isNotAddButton = _ref => {
        let {
          i
        } = _ref;
        return i !== _addWidget__WEBPACK_IMPORTED_MODULE_27__.ADD_WIDGET_BUTTON_DRAG_ID;
      };

      const newLayouts = {
        [DESKTOP]: allLayouts[DESKTOP].filter(isNotAddButton),
        [MOBILE]: allLayouts[MOBILE].filter(isNotAddButton)
      }; // Generate a new list of widgets where the layouts are associated

      let columnDepths = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.calculateColumnDepths)(newLayouts[DESKTOP]);
      const newWidgets = dashboard.widgets.map(widget => {
        const gridKey = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.constructGridItemKey)(widget);
        let matchingLayout = newLayouts[DESKTOP].find(_ref2 => {
          let {
            i
          } = _ref2;
          return i === gridKey;
        });

        if (!matchingLayout) {
          const height = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getDefaultWidgetHeight)(widget.displayType);
          const defaultWidgetParams = {
            w: _layoutUtils__WEBPACK_IMPORTED_MODULE_28__.DEFAULT_WIDGET_WIDTH,
            h: height,
            minH: height,
            i: gridKey
          }; // Calculate the available position

          const [nextPosition, nextColumnDepths] = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getNextAvailablePosition)(columnDepths, height);
          columnDepths = nextColumnDepths; // Set the position for the desktop layout

          matchingLayout = { ...defaultWidgetParams,
            ...nextPosition
          };

          if (isMobile) {
            // This is a new widget and it's on the mobile page so we keep it at the bottom
            const mobileLayout = newLayouts[MOBILE].filter(_ref3 => {
              let {
                i
              } = _ref3;
              return i !== gridKey;
            });
            mobileLayout.push({ ...defaultWidgetParams,
              ...BOTTOM_MOBILE_VIEW_POSITION
            });
            newLayouts[MOBILE] = mobileLayout;
          }
        }

        return { ...widget,
          layout: (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.pickDefinedStoreKeys)(matchingLayout)
        };
      });
      this.setState({
        layouts: newLayouts
      });
      onUpdate(newWidgets); // Force check lazyLoad elements that might have shifted into view after (re)moving an upper widget
      // Unfortunately need to use window.setTimeout since React Grid Layout animates widgets into view when layout changes
      // RGL doesn't provide a handler for post animation layout change

      window.clearTimeout(this.forceCheckTimeout);
      this.forceCheckTimeout = window.setTimeout(react_lazyload__WEBPACK_IMPORTED_MODULE_8__.forceCheck, 400);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBreakpointChange", newBreakpoint => {
      const {
        layouts
      } = this.state;
      const {
        dashboard: {
          widgets
        }
      } = this.props;

      if (newBreakpoint === MOBILE) {
        this.setState({
          isMobile: true,
          layouts: { ...layouts,
            [MOBILE]: (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getMobileLayout)(layouts[DESKTOP], widgets)
          }
        });
        return;
      }

      this.setState({
        isMobile: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderDndDashboard", () => {
      const {
        isEditing,
        onUpdate,
        dashboard,
        organization,
        widgetLimitReached
      } = this.props;
      let {
        widgets
      } = dashboard; // Filter out any issue/release widgets if the user does not have the feature flag

      widgets = widgets.filter(_ref4 => {
        let {
          widgetType
        } = _ref4;

        if (widgetType === _types__WEBPACK_IMPORTED_MODULE_30__.WidgetType.RELEASE) {
          return organization.features.includes('dashboards-releases');
        }

        return true;
      });
      const items = this.getWidgetIds();
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_dnd_kit_core__WEBPACK_IMPORTED_MODULE_9__.DndContext, {
        collisionDetection: _dnd_kit_core__WEBPACK_IMPORTED_MODULE_9__.closestCenter,
        onDragEnd: _ref5 => {
          let {
            over,
            active
          } = _ref5;
          const activeDragId = active.id;
          const getIndex = items.indexOf.bind(items);
          const activeIndex = activeDragId ? getIndex(activeDragId) : -1;

          if (over && over.id !== _addWidget__WEBPACK_IMPORTED_MODULE_27__.ADD_WIDGET_BUTTON_DRAG_ID) {
            const overIndex = getIndex(over.id);

            if (activeIndex !== overIndex) {
              onUpdate((0,_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_10__.arrayMove)(widgets, activeIndex, overIndex));
            }
          }
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(WidgetContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_10__.SortableContext, {
            items: items,
            strategy: _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_10__.rectSortingStrategy,
            children: [widgets.map((widget, index) => this.renderWidget(widget, index)), isEditing && !!!widgetLimitReached && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_addWidget__WEBPACK_IMPORTED_MODULE_27__["default"], {
              onAddWidget: this.handleStartAdd
            })]
          })
        })
      });
    });

    const {
      dashboard: _dashboard,
      organization: _organization
    } = props;

    const isUsingGrid = _organization.features.includes('dashboard-grid-layout');

    const desktopLayout = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getDashboardLayout)(_dashboard.widgets);
    this.state = {
      isMobile: false,
      layouts: {
        [DESKTOP]: isUsingGrid ? desktopLayout : [],
        [MOBILE]: isUsingGrid ? (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getMobileLayout)(desktopLayout, _dashboard.widgets) : []
      },
      windowWidth: window.innerWidth
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.organization.features.includes('dashboard-grid-layout')) {
      if (state.isMobile) {
        // Don't need to recalculate any layout state from props in the mobile view
        // because we want to force different positions (i.e. new widgets added
        // at the bottom)
        return null;
      } // If the user clicks "Cancel" and the dashboard resets,
      // recalculate the layout to revert to the unmodified state


      const dashboardLayout = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getDashboardLayout)(props.dashboard.widgets);

      if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_13___default()(dashboardLayout.map(_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.pickDefinedStoreKeys), state.layouts[DESKTOP].map(_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.pickDefinedStoreKeys))) {
        return { ...state,
          layouts: {
            [DESKTOP]: dashboardLayout,
            [MOBILE]: (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getMobileLayout)(dashboardLayout, props.dashboard.widgets)
          }
        };
      }
    }

    return null;
  }

  componentDidMount() {
    const {
      organization,
      newWidget
    } = this.props;

    if (organization.features.includes('dashboard-grid-layout')) {
      window.addEventListener('resize', this.debouncedHandleResize);
    } // Always load organization tags on dashboards


    this.fetchTags();

    if (newWidget) {
      this.addNewWidget();
    } // Get member list data for issue widgets


    this.fetchMemberList();
  }

  componentDidUpdate(prevProps) {
    const {
      selection,
      newWidget
    } = this.props;

    if (newWidget && newWidget !== prevProps.newWidget) {
      this.addNewWidget();
    }

    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_13___default()(prevProps.selection.projects, selection.projects)) {
      this.fetchMemberList();
    }
  }

  componentWillUnmount() {
    if (this.props.organization.features.includes('dashboard-grid-layout')) {
      window.removeEventListener('resize', this.debouncedHandleResize);
    }

    window.clearTimeout(this.forceCheckTimeout);
  }

  fetchMemberList() {
    var _selection$projects;

    const {
      api,
      selection
    } = this.props; // Stores MemberList in MemberListStore for use in modals and sets state for use is child components

    (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_16__.fetchOrgMembers)(api, this.props.organization.slug, (_selection$projects = selection.projects) === null || _selection$projects === void 0 ? void 0 : _selection$projects.map(projectId => String(projectId)));
  }

  async addNewWidget() {
    const {
      api,
      organization,
      newWidget,
      handleAddCustomWidget,
      onSetNewWidget
    } = this.props;

    if (newWidget) {
      try {
        await (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_14__.validateWidget)(api, organization.slug, newWidget);
        handleAddCustomWidget(newWidget);
        onSetNewWidget === null || onSetNewWidget === void 0 ? void 0 : onSetNewWidget();
      } catch (error) {
        // Don't do anything, widget isn't valid
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_15__.addErrorMessage)(error);
      }
    }
  }

  fetchTags() {
    const {
      api,
      organization,
      selection
    } = this.props;
    (0,sentry_actionCreators_tags__WEBPACK_IMPORTED_MODULE_18__.loadOrganizationTags)(api, organization.slug, selection);
  }

  getWidgetIds() {
    return [...this.props.dashboard.widgets.map((widget, index) => {
      return (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.generateWidgetId)(widget, index);
    }), _addWidget__WEBPACK_IMPORTED_MODULE_27__.ADD_WIDGET_BUTTON_DRAG_ID];
  }

  renderWidget(widget, index) {
    var _getDashboardFiltersF;

    const {
      isMobile,
      windowWidth
    } = this.state;
    const {
      isEditing,
      organization,
      widgetLimitReached,
      isPreview,
      dashboard,
      location
    } = this.props;
    const widgetProps = {
      widget,
      isEditing,
      widgetLimitReached,
      onDelete: this.handleDeleteWidget(widget),
      onEdit: this.handleEditWidget(widget, index),
      onDuplicate: this.handleDuplicateWidget(widget, index),
      isPreview,
      dashboardFilters: (_getDashboardFiltersF = (0,_utils__WEBPACK_IMPORTED_MODULE_31__.getDashboardFiltersFromURL)(location)) !== null && _getDashboardFiltersF !== void 0 ? _getDashboardFiltersF : dashboard.filters
    };

    if (organization.features.includes('dashboard-grid-layout')) {
      const key = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.constructGridItemKey)(widget);
      const dragId = key;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)("div", {
        "data-grid": widget.layout,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_sortableWidget__WEBPACK_IMPORTED_MODULE_29__["default"], { ...widgetProps,
          dragId: dragId,
          isMobile: isMobile,
          windowWidth: windowWidth,
          index: String(index)
        })
      }, key);
    }

    const key = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.generateWidgetId)(widget, index);
    const dragId = key;
    return (0,_emotion_react__WEBPACK_IMPORTED_MODULE_33__.createElement)(_sortableWidget__WEBPACK_IMPORTED_MODULE_29__["default"], { ...widgetProps,
      key: key,
      dragId: dragId,
      index: String(index)
    });
  }

  get addWidgetLayout() {
    const {
      isMobile,
      layouts
    } = this.state;
    let position = BOTTOM_MOBILE_VIEW_POSITION;

    if (!isMobile) {
      const columnDepths = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.calculateColumnDepths)(layouts[DESKTOP]);
      const [nextPosition] = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.getNextAvailablePosition)(columnDepths, 1);
      position = nextPosition;
    }

    return { ...position,
      w: _layoutUtils__WEBPACK_IMPORTED_MODULE_28__.DEFAULT_WIDGET_WIDTH,
      h: 1,
      isResizable: false
    };
  }

  renderGridDashboard() {
    const {
      layouts,
      isMobile
    } = this.state;
    const {
      isEditing,
      dashboard,
      organization,
      widgetLimitReached
    } = this.props;
    let {
      widgets
    } = dashboard; // Filter out any issue/release widgets if the user does not have the feature flag

    widgets = widgets.filter(_ref6 => {
      let {
        widgetType
      } = _ref6;

      if (widgetType === _types__WEBPACK_IMPORTED_MODULE_30__.WidgetType.RELEASE) {
        return organization.features.includes('dashboards-releases');
      }

      return true;
    });
    const columnDepths = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.calculateColumnDepths)(layouts[DESKTOP]);
    const widgetsWithLayout = (0,_layoutUtils__WEBPACK_IMPORTED_MODULE_28__.assignDefaultLayout)(widgets, columnDepths);
    const canModifyLayout = !isMobile && isEditing;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(GridLayout, {
      breakpoints: BREAKPOINTS,
      cols: COLUMNS,
      rowHeight: ROW_HEIGHT,
      margin: WIDGET_MARGINS,
      draggableHandle: `.${DRAG_HANDLE_CLASS}`,
      draggableCancel: `.${DRAG_RESIZE_CLASS}`,
      layouts: layouts,
      onLayoutChange: this.handleLayoutChange,
      onBreakpointChange: this.handleBreakpointChange,
      isDraggable: canModifyLayout,
      isResizable: canModifyLayout,
      resizeHandle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(ResizeHandle, {
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_21__.t)('Resize Widget'),
        "data-test-id": "custom-resize-handle",
        className: DRAG_RESIZE_CLASS,
        size: "xs",
        borderless: true,
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_20__.IconResize, {
          size: "xs"
        })
      }),
      useCSSTransforms: false,
      isBounded: true,
      children: [widgetsWithLayout.map((widget, index) => this.renderWidget(widget, index)), isEditing && !!!widgetLimitReached && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(AddWidgetWrapper, {
        "data-grid": this.addWidgetLayout,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_addWidget__WEBPACK_IMPORTED_MODULE_27__["default"], {
          onAddWidget: this.handleStartAdd
        })
      }, _addWidget__WEBPACK_IMPORTED_MODULE_27__.ADD_WIDGET_BUTTON_DRAG_ID)]
    });
  }

  render() {
    const {
      organization
    } = this.props;

    if (organization.features.includes('dashboard-grid-layout')) {
      return this.renderGridDashboard();
    }

    return this.renderDndDashboard();
  }

}

Dashboard.displayName = "Dashboard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_25__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_26__["default"])(Dashboard)));

const WidgetContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1wa3gzn3"
} : 0)("display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));grid-auto-flow:row dense;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:repeat(4, minmax(0, 1fr));}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){grid-template-columns:repeat(6, minmax(0, 1fr));}@media (min-width: ", p => p.theme.breakpoints.xxlarge, "){grid-template-columns:repeat(8, minmax(0, 1fr));}" + ( true ? "" : 0)); // A widget being dragged has a z-index of 3
// Allow the Add Widget tile to show above widgets when moved


const AddWidgetWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1wa3gzn2"
} : 0)("z-index:5;background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

const GridLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])((0,react_grid_layout__WEBPACK_IMPORTED_MODULE_7__.WidthProvider)(react_grid_layout__WEBPACK_IMPORTED_MODULE_7__.Responsive),  true ? {
  target: "e1wa3gzn1"
} : 0)("margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";.react-grid-item.react-grid-placeholder{background:", p => p.theme.purple200, ";border-radius:", p => p.theme.borderRadius, ";}" + ( true ? "" : 0));

const ResizeHandle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_19__["default"],  true ? {
  target: "e1wa3gzn0"
} : 0)("position:absolute;z-index:2;bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5), ";color:", p => p.theme.subText, ";cursor:nwse-resize;.react-resizable-hide &{display:none;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/layoutUtils.tsx":
/*!************************************************!*\
  !*** ./app/views/dashboardsV2/layoutUtils.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_WIDGET_WIDTH": () => (/* binding */ DEFAULT_WIDGET_WIDTH),
/* harmony export */   "assignDefaultLayout": () => (/* binding */ assignDefaultLayout),
/* harmony export */   "assignTempId": () => (/* binding */ assignTempId),
/* harmony export */   "calculateColumnDepths": () => (/* binding */ calculateColumnDepths),
/* harmony export */   "constructGridItemKey": () => (/* binding */ constructGridItemKey),
/* harmony export */   "enforceWidgetHeightValues": () => (/* binding */ enforceWidgetHeightValues),
/* harmony export */   "generateWidgetId": () => (/* binding */ generateWidgetId),
/* harmony export */   "generateWidgetsAfterCompaction": () => (/* binding */ generateWidgetsAfterCompaction),
/* harmony export */   "getDashboardLayout": () => (/* binding */ getDashboardLayout),
/* harmony export */   "getDefaultPosition": () => (/* binding */ getDefaultPosition),
/* harmony export */   "getDefaultWidgetHeight": () => (/* binding */ getDefaultWidgetHeight),
/* harmony export */   "getInitialColumnDepths": () => (/* binding */ getInitialColumnDepths),
/* harmony export */   "getMobileLayout": () => (/* binding */ getMobileLayout),
/* harmony export */   "getNextAvailablePosition": () => (/* binding */ getNextAvailablePosition),
/* harmony export */   "pickDefinedStoreKeys": () => (/* binding */ pickDefinedStoreKeys)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_grid_layout_build_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-grid-layout/build/utils */ "../node_modules/react-grid-layout/build/utils.js");
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pickBy */ "../node_modules/lodash/pickBy.js");
/* harmony import */ var lodash_pickBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pickBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/sortBy */ "../node_modules/lodash/sortBy.js");
/* harmony import */ var lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_sortBy__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_zip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/zip */ "../node_modules/lodash/zip.js");
/* harmony import */ var lodash_zip__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_zip__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _dashboard__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./dashboard */ "./app/views/dashboardsV2/dashboard.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");










const DEFAULT_WIDGET_WIDTH = 2;
const WIDGET_PREFIX = 'grid-item'; // Keys for grid layout values we track in the server

const STORE_KEYS = ['x', 'y', 'w', 'h', 'minW', 'maxW', 'minH', 'maxH'];
function generateWidgetId(widget, index) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}
function constructGridItemKey(widget) {
  var _widget$id;

  return `${WIDGET_PREFIX}-${(_widget$id = widget.id) !== null && _widget$id !== void 0 ? _widget$id : widget.tempId}`;
}
function assignTempId(widget) {
  var _widget$id2;

  if ((_widget$id2 = widget.id) !== null && _widget$id2 !== void 0 ? _widget$id2 : widget.tempId) {
    return widget;
  }

  return { ...widget,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_7__.uniqueId)()
  };
}
/**
 * Naive positioning for widgets assuming no resizes.
 */

function getDefaultPosition(index, displayType) {
  return {
    x: DEFAULT_WIDGET_WIDTH * index % _dashboard__WEBPACK_IMPORTED_MODULE_8__.NUM_DESKTOP_COLS,
    y: Number.MAX_SAFE_INTEGER,
    w: DEFAULT_WIDGET_WIDTH,
    h: displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER ? 1 : 2,
    minH: displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER ? 1 : 2
  };
}
function getMobileLayout(desktopLayout, widgets) {
  if (desktopLayout.length === 0) {
    // Initial case where the user has no layout saved, but
    // dashboard has widgets
    return [];
  }

  const layoutWidgetPairs = lodash_zip__WEBPACK_IMPORTED_MODULE_5___default()(desktopLayout, widgets); // Sort by y and then subsort by x

  const sorted = lodash_sortBy__WEBPACK_IMPORTED_MODULE_4___default()(layoutWidgetPairs, ['0.y', '0.x']);
  const mobileLayout = sorted.map((_ref, index) => {
    let [layout, widget] = _ref;
    return { ...layout,
      x: 0,
      y: index * 2,
      w: 2,
      h: widget.displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER ? 1 : 2
    };
  });
  return mobileLayout;
}
/**
 * Reads the layout from an array of widgets.
 */

function getDashboardLayout(widgets) {
  return widgets.filter(widget => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(widget.layout)).map(_ref2 => {
    let {
      layout,
      ...widget
    } = _ref2;
    return { ...layout,
      i: constructGridItemKey(widget)
    };
  });
}
function pickDefinedStoreKeys(layout) {
  // TODO(nar): Fix the types here
  return lodash_pickBy__WEBPACK_IMPORTED_MODULE_3___default()(layout, (value, key) => (0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(value) && STORE_KEYS.includes(key));
}
function getDefaultWidgetHeight(displayType) {
  return displayType === _types__WEBPACK_IMPORTED_MODULE_9__.DisplayType.BIG_NUMBER ? 1 : 2;
}
function getInitialColumnDepths() {
  return Array(_dashboard__WEBPACK_IMPORTED_MODULE_8__.NUM_DESKTOP_COLS).fill(0);
}
/**
 * Creates an array from layouts where each column stores how deep it is.
 */

function calculateColumnDepths(layouts) {
  const depths = getInitialColumnDepths(); // For each layout's x, record the max depth

  layouts.forEach(_ref3 => {
    let {
      x,
      w,
      y,
      h
    } = _ref3;

    // Adjust the column depths for each column the widget takes up
    for (let col = x; col < x + w; col++) {
      depths[col] = Math.max(y + h, depths[col]);
    }
  });
  return depths;
}
/**
 * Find the next place to place a widget and also returns the next
 * input when this operation needs to be called multiple times.
 *
 * @param columnDepths A profile of how deep the widgets in a column extend.
 * @param height The desired height of the next widget we want to place.
 * @returns An {x, y} positioning for the next available spot, as well as the
 * next columnDepths array if this position were used.
 */

function getNextAvailablePosition(initialColumnDepths, height) {
  const columnDepths = [...initialColumnDepths];
  const maxColumnDepth = Math.max(...columnDepths); // Look for an opening at each depth by scanning from 0, 0
  // By scanning from 0 depth to the highest depth, we ensure
  // we get the top-most available spot

  for (let currDepth = 0; currDepth <= maxColumnDepth; currDepth++) {
    for (let start = 0; start <= columnDepths.length - DEFAULT_WIDGET_WIDTH; start++) {
      if (columnDepths[start] > currDepth) {
        // There are potentially widgets in the way here, so skip
        continue;
      } // If all of the columns from start to end (the size of the widget)
      // have at most the current depth, then we've found a valid positioning
      // No other widgets extend into the space we need


      const end = start + DEFAULT_WIDGET_WIDTH;

      if (columnDepths.slice(start, end).every(val => val <= currDepth)) {
        for (let col = start; col < start + DEFAULT_WIDGET_WIDTH; col++) {
          columnDepths[col] = currDepth + height;
        }

        return [{
          x: start,
          y: currDepth
        }, [...columnDepths]];
      }
    }
  }

  for (let col = 0; col < DEFAULT_WIDGET_WIDTH; col++) {
    columnDepths[col] = maxColumnDepth;
  }

  return [{
    x: 0,
    y: maxColumnDepth
  }, [...columnDepths]];
}
function assignDefaultLayout(widgets, initialColumnDepths) {
  let columnDepths = [...initialColumnDepths];
  const newWidgets = widgets.map(widget => {
    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(widget.layout)) {
      return widget;
    }

    const height = getDefaultWidgetHeight(widget.displayType);
    const [nextPosition, nextColumnDepths] = getNextAvailablePosition(columnDepths, height);
    columnDepths = nextColumnDepths;
    return { ...widget,
      layout: { ...nextPosition,
        h: height,
        minH: height,
        w: DEFAULT_WIDGET_WIDTH
      }
    };
  });
  return newWidgets;
}
function enforceWidgetHeightValues(widget) {
  var _layout$h;

  const {
    displayType,
    layout
  } = widget;
  const nextWidget = { ...widget
  };

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_6__.defined)(layout)) {
    return nextWidget;
  }

  const minH = getDefaultWidgetHeight(displayType);
  const nextLayout = { ...layout,
    h: Math.max((_layout$h = layout === null || layout === void 0 ? void 0 : layout.h) !== null && _layout$h !== void 0 ? _layout$h : minH, minH),
    minH
  };
  return { ...nextWidget,
    layout: nextLayout
  };
}
function generateWidgetsAfterCompaction(widgets) {
  // Resolves any potential compactions that need to occur after a
  // single widget change would affect other widget positions, e.g. deletion
  const nextLayout = (0,react_grid_layout_build_utils__WEBPACK_IMPORTED_MODULE_2__.compact)(getDashboardLayout(widgets), 'vertical', _dashboard__WEBPACK_IMPORTED_MODULE_8__.NUM_DESKTOP_COLS);
  return widgets.map(widget => {
    const layout = nextLayout.find(_ref4 => {
      let {
        i
      } = _ref4;
      return i === constructGridItemKey(widget);
    });

    if (!layout) {
      return widget;
    }

    return { ...widget,
      layout
    };
  });
}

/***/ }),

/***/ "./app/views/dashboardsV2/sortableWidget.tsx":
/*!***************************************************!*\
  !*** ./app/views/dashboardsV2/sortableWidget.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @dnd-kit/sortable */ "../node_modules/@dnd-kit/sortable/dist/sortable.esm.js");
/* harmony import */ var sentry_components_panels_panelAlert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/panels/panelAlert */ "./app/components/panels/panelAlert.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard */ "./app/views/dashboardsV2/widgetCard/index.tsx");
/* harmony import */ var _widgetWrapper__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./widgetWrapper */ "./app/views/dashboardsV2/widgetWrapper.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









const TABLE_ITEM_LIMIT = 20;

function SortableWidget(props) {
  const {
    organization,
    widget,
    dragId,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    isPreview,
    isMobile,
    windowWidth,
    index,
    dashboardFilters
  } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: currentWidgetDragging,
    isSorting
  } = (0,_dnd_kit_sortable__WEBPACK_IMPORTED_MODULE_3__.useSortable)({
    id: dragId,
    transition: null
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!currentWidgetDragging) {
      return undefined;
    }

    document.body.style.cursor = 'grabbing';
    return function cleanup() {
      document.body.style.cursor = '';
    };
  }, [currentWidgetDragging]);
  let widgetProps = {
    widget,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    isSorting,
    hideToolbar: isSorting,
    currentWidgetDragging,
    showContextMenu: true,
    isPreview,
    showWidgetViewerButton: organization.features.includes('widget-viewer-modal'),
    index,
    dashboardFilters,
    renderErrorMessage: errorMessage => {
      return typeof errorMessage === 'string' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels_panelAlert__WEBPACK_IMPORTED_MODULE_4__["default"], {
        type: "error",
        children: errorMessage
      });
    }
  };

  if (organization.features.includes('dashboard-grid-layout')) {
    widgetProps = { ...widgetProps,
      isMobile,
      windowWidth,
      // TODO(nar): These aren't necessary for supporting RGL
      isSorting: false,
      currentWidgetDragging: false,
      tableItemLimit: TABLE_ITEM_LIMIT
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(GridWidgetWrapper, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_7__["default"], { ...widgetProps
      })
    });
  }

  const initialStyles = {
    zIndex: 'auto'
  };
  widgetProps = { ...widgetProps,
    draggableProps: {
      attributes,
      listeners
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_widgetWrapper__WEBPACK_IMPORTED_MODULE_8__["default"], {
    ref: setNodeRef,
    displayType: widget.displayType,
    layoutId: dragId,
    style: {
      // Origin is set to top right-hand corner where the drag handle is placed.
      // Otherwise, set the origin to be the top left-hand corner when swapping widgets.
      originX: currentWidgetDragging ? 1 : 0,
      originY: 0,
      boxShadow: currentWidgetDragging ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__["default"].dropShadowHeavy : 'none',
      borderRadius: currentWidgetDragging ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__["default"].borderRadius : undefined
    },
    animate: transform ? {
      x: transform.x,
      y: transform.y,
      scaleX: transform !== null && transform !== void 0 && transform.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
      scaleY: transform !== null && transform !== void 0 && transform.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
      zIndex: currentWidgetDragging ? sentry_utils_theme__WEBPACK_IMPORTED_MODULE_5__["default"].zIndex.modal : 'auto'
    } : initialStyles,
    transformTemplate: (___transform, generatedTransform) => {
      if (isEditing && !!transform) {
        return generatedTransform;
      }

      return 'none';
    },
    transition: {
      duration: !currentWidgetDragging ? 0.25 : 0,
      easings: {
        type: 'spring'
      }
    },
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_7__["default"], { ...widgetProps
    })
  });
}

SortableWidget.displayName = "SortableWidget";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(SortableWidget));

const GridWidgetWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12vujy00"
} : 0)( true ? {
  name: "13udsys",
  styles: "height:100%"
} : 0);

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/index.tsx":
/*!*****************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/index.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetCardPanel": () => (/* binding */ WidgetCardPanel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_lazyload__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-lazyload */ "../node_modules/react-lazyload/lib/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/searchSyntax/parser */ "./app/components/searchSyntax/parser.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _dashboard__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ../dashboard */ "./app/views/dashboardsV2/dashboard.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ../widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var _dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./dashboardsMEPContext */ "./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx");
/* harmony import */ var _widgetCardChartContainer__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./widgetCardChartContainer */ "./app/views/dashboardsV2/widgetCard/widgetCardChartContainer.tsx");
/* harmony import */ var _widgetCardContextMenu__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./widgetCardContextMenu */ "./app/views/dashboardsV2/widgetCard/widgetCardContextMenu.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


 // eslint-disable-next-line no-restricted-imports





























const ERROR_FIELDS = ['error.handled', 'error.unhandled', 'error.mechanism', 'error.type', 'error.value'];

class WidgetCard extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "setData", _ref => {
      let {
        tableResults,
        timeseriesResults,
        totalIssuesCount,
        pageLinks,
        timeseriesResultsType
      } = _ref;
      this.setState({
        seriesData: timeseriesResults,
        tableData: tableResults,
        totalIssuesCount,
        pageLinks,
        seriesResultsType: timeseriesResultsType
      });
    });
  }

  renderToolbar() {
    const {
      onEdit,
      onDelete,
      onDuplicate,
      draggableProps,
      hideToolbar,
      isEditing,
      isMobile
    } = this.props;

    if (!isEditing) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(ToolbarPanel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(IconContainer, {
        style: {
          visibility: hideToolbar ? 'hidden' : 'visible'
        },
        children: [!isMobile && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(GrabbableButton, {
          size: "xs",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Drag Widget'),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconGrabbable, {}),
          borderless: true,
          className: _dashboard__WEBPACK_IMPORTED_MODULE_25__.DRAG_HANDLE_CLASS,
          ...(draggableProps === null || draggableProps === void 0 ? void 0 : draggableProps.listeners),
          ...(draggableProps === null || draggableProps === void 0 ? void 0 : draggableProps.attributes)
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          "data-test-id": "widget-edit",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Edit Widget'),
          size: "xs",
          borderless: true,
          onClick: onEdit,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconEdit, {})
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Duplicate Widget'),
          size: "xs",
          borderless: true,
          onClick: onDuplicate,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconCopy, {})
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
          "data-test-id": "widget-delete",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Delete Widget'),
          borderless: true,
          size: "xs",
          onClick: onDelete,
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconDelete, {})
        })]
      })
    });
  }

  renderContextMenu() {
    const {
      widget,
      selection,
      organization,
      showContextMenu,
      isPreview,
      widgetLimitReached,
      onEdit,
      onDuplicate,
      onDelete,
      isEditing,
      showWidgetViewerButton,
      router,
      location,
      index
    } = this.props;
    const {
      seriesData,
      tableData,
      pageLinks,
      totalIssuesCount,
      seriesResultsType
    } = this.state;

    if (isEditing) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_widgetCardContextMenu__WEBPACK_IMPORTED_MODULE_31__["default"], {
      organization: organization,
      widget: widget,
      selection: selection,
      showContextMenu: showContextMenu,
      isPreview: isPreview,
      widgetLimitReached: widgetLimitReached,
      onDuplicate: onDuplicate,
      onEdit: onEdit,
      onDelete: onDelete,
      showWidgetViewerButton: showWidgetViewerButton,
      router: router,
      location: location,
      index: index,
      seriesData: seriesData,
      seriesResultsType: seriesResultsType,
      tableData: tableData,
      pageLinks: pageLinks,
      totalIssuesCount: totalIssuesCount
    });
  }

  render() {
    const {
      api,
      organization,
      selection,
      widget,
      isMobile,
      renderErrorMessage,
      tableItemLimit,
      windowWidth,
      noLazyLoad,
      showStoredAlert,
      noDashboardsMEPProvider,
      dashboardFilters
    } = this.props;

    if (widget.displayType === _types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N) {
      const queries = widget.queries.map(query => ({ ...query,
        // Use the last aggregate because that's where the y-axis is stored
        aggregates: query.aggregates.length ? [query.aggregates[query.aggregates.length - 1]] : []
      }));
      widget.queries = queries;
      widget.limit = _widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_28__.DEFAULT_RESULTS_LIMIT;
    }

    function conditionalWrapWithDashboardsMEPProvider(component) {
      if (noDashboardsMEPProvider) {
        return component;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_29__.DashboardsMEPProvider, {
        children: component
      });
    }

    const widgetContainsErrorFields = widget.queries.some(_ref2 => {
      let {
        columns,
        aggregates,
        conditions
      } = _ref2;
      return ERROR_FIELDS.some(errorField => {
        var _parseSearch;

        return columns.includes(errorField) || aggregates.some(aggregate => {
          var _parseFunction;

          return (_parseFunction = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_21__.parseFunction)(aggregate)) === null || _parseFunction === void 0 ? void 0 : _parseFunction.arguments.includes(errorField);
        }) || ((_parseSearch = (0,sentry_components_searchSyntax_parser__WEBPACK_IMPORTED_MODULE_16__.parseSearch)(conditions)) === null || _parseSearch === void 0 ? void 0 : _parseSearch.some(filter => {
          var _key;

          return ((_key = filter.key) === null || _key === void 0 ? void 0 : _key.value) === errorField;
        }));
      });
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_11__["default"], {
      customComponent: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(ErrorCard, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Error loading widget data')
      }),
      children: conditionalWrapWithDashboardsMEPProvider((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(WidgetCardPanel, {
          isDragging: false,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(WidgetHeader, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_17__["default"], {
              title: widget.title,
              containerDisplayMode: "grid",
              showOnlyOnOverflow: true,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(WidgetTitle, {
                children: widget.title
              })
            }), this.renderContextMenu()]
          }), noLazyLoad ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_widgetCardChartContainer__WEBPACK_IMPORTED_MODULE_30__["default"], {
            api: api,
            organization: organization,
            selection: selection,
            widget: widget,
            isMobile: isMobile,
            renderErrorMessage: renderErrorMessage,
            tableItemLimit: tableItemLimit,
            windowWidth: windowWidth,
            onDataFetched: this.setData,
            dashboardFilters: dashboardFilters
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(react_lazyload__WEBPACK_IMPORTED_MODULE_5__["default"], {
            once: true,
            resize: true,
            height: 200,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_widgetCardChartContainer__WEBPACK_IMPORTED_MODULE_30__["default"], {
              api: api,
              organization: organization,
              selection: selection,
              widget: widget,
              isMobile: isMobile,
              renderErrorMessage: renderErrorMessage,
              tableItemLimit: tableItemLimit,
              windowWidth: windowWidth,
              onDataFetched: this.setData,
              dashboardFilters: dashboardFilters
            })
          }), this.renderToolbar()]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_7__["default"], {
          organization: organization,
          features: ['dashboards-mep'],
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_29__.DashboardsMEPConsumer, {
            children: _ref3 => {
              let {
                isMetricsData
              } = _ref3;

              if (showStoredAlert && isMetricsData === false && widget.widgetType === _types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER) {
                if ((0,_utils__WEBPACK_IMPORTED_MODULE_27__.isCustomMeasurementWidget)(widget)) {
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(StoredDataAlert, {
                    showIcon: true,
                    type: "error",
                    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)('You have inputs that are incompatible with [customPerformanceMetrics: custom performance metrics]. See all compatible fields and functions [here: here]. Update your inputs or remove any custom performance metrics.', {
                      customPerformanceMetrics: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"], {
                        href: "https://docs.sentry.io/product/sentry-basics/metrics/#custom-performance-measurements"
                      }),
                      here: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"], {
                        href: "https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#properties-table"
                      })
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
                      type: "beta"
                    })]
                  });
                }

                if (!widgetContainsErrorFields) {
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsxs)(StoredDataAlert, {
                    showIcon: true,
                    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.tct)("Your selection is only applicable to [indexedData: indexed event data]. We've automatically adjusted your results.", {
                      indexedData: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"], {
                        href: "https://docs.sentry.io/product/dashboards/widget-builder/#errors--transactions"
                      })
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_32__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_12__["default"], {
                      type: "beta"
                    })]
                  });
                }
              }

              return null;
            }
          })
        })]
      }))
    });
  }

}

WidgetCard.displayName = "WidgetCard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_24__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_6__.withRouter)(WidgetCard)))));

const ErrorCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e1fl0u6g7"
} : 0)("display:flex;align-items:center;justify-content:center;background-color:", p => p.theme.alert.error.backgroundLight, ";border:1px solid ", p => p.theme.alert.error.border, ";color:", p => p.theme.alert.error.textLight, ";border-radius:", p => p.theme.borderRadius, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";" + ( true ? "" : 0));

const WidgetCardPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_14__.Panel,  true ? {
  shouldForwardProp: prop => prop !== 'isDragging',
  target: "e1fl0u6g6"
} : 0)("margin:0;visibility:", p => p.isDragging ? 'hidden' : 'visible', ";height:100%;min-height:96px;display:flex;flex-direction:column;" + ( true ? "" : 0));

const ToolbarPanel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1fl0u6g5"
} : 0)("position:absolute;top:0;left:0;z-index:2;width:100%;height:100%;display:flex;justify-content:flex-end;align-items:flex-start;background-color:", p => p.theme.overlayBackgroundAlpha, ";border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const IconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1fl0u6g4"
} : 0)("display:flex;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";touch-action:none;" + ( true ? "" : 0));

const GrabbableButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1fl0u6g3"
} : 0)( true ? {
  name: "1fgcczm",
  styles: "cursor:grab"
} : 0);

const WidgetTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_10__.HeaderTitle,  true ? {
  target: "e1fl0u6g2"
} : 0)(p => p.theme.overflowEllipsis, ";font-weight:normal;" + ( true ? "" : 0));

const WidgetHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1fl0u6g1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";min-height:36px;width:100%;display:flex;align-items:center;justify-content:space-between;" + ( true ? "" : 0));

const StoredDataAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_alert__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1fl0u6g0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";margin-bottom:0;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetCard/widgetCardContextMenu.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetCard/widgetCardContextMenu.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_modals_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/modals/widgetViewerModal/utils */ "./app/components/modals/widgetViewerModal/utils.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _widgetViewer_widgetViewerContext__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ../widgetViewer/widgetViewerContext */ "./app/views/dashboardsV2/widgetViewer/widgetViewerContext.tsx");
/* harmony import */ var _dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./dashboardsMEPContext */ "./app/views/dashboardsV2/widgetCard/dashboardsMEPContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




















function WidgetCardContextMenu(_ref) {
  let {
    organization,
    selection,
    widget,
    widgetLimitReached,
    onDelete,
    onDuplicate,
    onEdit,
    showContextMenu,
    isPreview,
    showWidgetViewerButton,
    router,
    location,
    index,
    seriesData,
    tableData,
    pageLinks,
    totalIssuesCount,
    seriesResultsType
  } = _ref;
  const {
    isMetricsData
  } = (0,_dashboardsMEPContext__WEBPACK_IMPORTED_MODULE_18__.useDashboardsMEPContext)();

  if (!showContextMenu) {
    return null;
  }

  const menuOptions = [];
  const usingCustomMeasurements = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_15__.isCustomMeasurementWidget)(widget);
  const disabledKeys = usingCustomMeasurements ? ['open-in-discover'] : [];

  const openWidgetViewerPath = id => {
    if (!(0,sentry_components_modals_widgetViewerModal_utils__WEBPACK_IMPORTED_MODULE_8__.isWidgetViewerPath)(location.pathname)) {
      router.push({
        pathname: `${location.pathname}${location.pathname.endsWith('/') ? '' : '/'}widget/${id}/`,
        query: location.query
      });
    }
  };

  if (isPreview) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_widgetViewer_widgetViewerContext__WEBPACK_IMPORTED_MODULE_17__.WidgetViewerContext.Consumer, {
      children: _ref2 => {
        let {
          setData
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(ContextWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
            organization: organization,
            features: ['dashboards-mep'],
            children: isMetricsData === false && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(SampledTag, {
              tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This widget is only applicable to indexed events.'),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Indexed')
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledDropdownMenuControl, {
            items: [{
              key: 'preview',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This is a preview only. To edit, you must add this dashboard.')
            }],
            triggerProps: {
              'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Widget actions'),
              size: 'xs',
              borderless: true,
              showChevron: false,
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconEllipsis, {
                direction: "down",
                size: "sm"
              })
            },
            placement: "bottom right",
            disabledKeys: [...disabledKeys, 'preview']
          }), showWidgetViewerButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(OpenWidgetViewerButton, {
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open Widget Viewer'),
            priority: "link",
            size: "zero",
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconExpand, {
              size: "xs"
            }),
            onClick: () => {
              (seriesData || tableData) && setData({
                seriesData,
                tableData,
                pageLinks,
                totalIssuesCount,
                seriesResultsType
              });
              openWidgetViewerPath(index);
            }
          })]
        });
      }
    });
  }

  if (organization.features.includes('discover-basic') && widget.widgetType === _types__WEBPACK_IMPORTED_MODULE_16__.WidgetType.DISCOVER) {
    // Open Widget in Discover
    if (widget.queries.length) {
      const discoverPath = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_15__.getWidgetDiscoverUrl)(widget, selection, organization, 0, isMetricsData);
      menuOptions.push({
        key: 'open-in-discover',
        label: usingCustomMeasurements ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
          skipWrapper: true,
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Widget using custom performance metrics cannot be opened in Discover.'),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open in Discover')
        }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open in Discover'),
        to: !usingCustomMeasurements && widget.queries.length === 1 ? discoverPath : undefined,
        onAction: () => {
          if (!usingCustomMeasurements) {
            if (widget.queries.length === 1) {
              (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('dashboards_views.open_in_discover.opened', {
                organization,
                widget_type: widget.displayType
              });
              return;
            }

            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_14__["default"])('dashboards_views.query_selector.opened', {
              organization,
              widget_type: widget.displayType
            });
            (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_3__.openDashboardWidgetQuerySelectorModal)({
              organization,
              widget,
              isMetricsData
            });
          }
        }
      });
    }
  }

  if (widget.widgetType === _types__WEBPACK_IMPORTED_MODULE_16__.WidgetType.ISSUE) {
    const issuesLocation = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_15__.getWidgetIssueUrl)(widget, selection, organization);
    menuOptions.push({
      key: 'open-in-issues',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open in Issues'),
      to: issuesLocation
    });
  }

  if (organization.features.includes('dashboards-edit')) {
    menuOptions.push({
      key: 'duplicate-widget',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Duplicate Widget'),
      onAction: () => onDuplicate === null || onDuplicate === void 0 ? void 0 : onDuplicate()
    });
    widgetLimitReached && disabledKeys.push('duplicate-widget');
    menuOptions.push({
      key: 'edit-widget',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Edit Widget'),
      onAction: () => onEdit === null || onEdit === void 0 ? void 0 : onEdit()
    });
    menuOptions.push({
      key: 'delete-widget',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Delete Widget'),
      priority: 'danger',
      onAction: () => {
        (0,sentry_components_confirm__WEBPACK_IMPORTED_MODULE_6__.openConfirmModal)({
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Are you sure you want to delete this widget?'),
          priority: 'danger',
          onConfirm: () => onDelete === null || onDelete === void 0 ? void 0 : onDelete()
        });
      }
    });
  }

  if (!menuOptions.length) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_widgetViewer_widgetViewerContext__WEBPACK_IMPORTED_MODULE_17__.WidgetViewerContext.Consumer, {
    children: _ref3 => {
      let {
        setData
      } = _ref3;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(ContextWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
          organization: organization,
          features: ['dashboards-mep'],
          children: isMetricsData === false && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(SampledTag, {
            tooltipText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('This widget is only applicable to indexed events.'),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Indexed')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(StyledDropdownMenuControl, {
          items: menuOptions,
          triggerProps: {
            'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Widget actions'),
            size: 'xs',
            borderless: true,
            showChevron: false,
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconEllipsis, {
              direction: "down",
              size: "sm"
            })
          },
          placement: "bottom right",
          disabledKeys: [...disabledKeys]
        }), showWidgetViewerButton && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(OpenWidgetViewerButton, {
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Open Widget Viewer'),
          priority: "link",
          size: "zero",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconExpand, {
            size: "xs"
          }),
          onClick: () => {
            var _widget$id;

            setData({
              seriesData,
              tableData,
              pageLinks,
              totalIssuesCount,
              seriesResultsType
            });
            openWidgetViewerPath((_widget$id = widget.id) !== null && _widget$id !== void 0 ? _widget$id : index);
          }
        })]
      });
    }
  });
}

WidgetCardContextMenu.displayName = "WidgetCardContextMenu";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetCardContextMenu);

const ContextWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1yltioa3"
} : 0)("display:flex;align-items:center;height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3), ";margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const StyledDropdownMenuControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1yltioa2"
} : 0)( true ? {
  name: "gbbqag",
  styles: "&>button{z-index:auto;}"
} : 0);

const OpenWidgetViewerButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1yltioa1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.75), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";color:", p => p.theme.textColor, ";&:hover{color:", p => p.theme.textColor, ";background:", p => p.theme.surface400, ";border-color:transparent;}" + ( true ? "" : 0));

const SampledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1yltioa0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/dashboardsV2/widgetViewer/widgetViewerContext.tsx":
/*!*********************************************************************!*\
  !*** ./app/views/dashboardsV2/widgetViewer/widgetViewerContext.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "WidgetViewerContext": () => (/* binding */ WidgetViewerContext)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

const WidgetViewerContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.createContext)({
  setData: () => undefined
});

/***/ }),

/***/ "./app/views/dashboardsV2/widgetWrapper.tsx":
/*!**************************************************!*\
  !*** ./app/views/dashboardsV2/widgetWrapper.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! framer-motion */ "../node_modules/framer-motion/dist/es/render/dom/motion.mjs");



const WidgetWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div,  true ? {
  target: "ec3gecx0"
} : 0)("position:relative;touch-action:manipulation;", p => {
  switch (p.displayType) {
    case 'big_number':
      return `
          /* 2 cols */
          grid-area: span 1 / span 2;

          @media (min-width: ${p.theme.breakpoints.small}) {
            /* 4 cols */
            grid-area: span 1 / span 1;
          }

          @media (min-width: ${p.theme.breakpoints.xlarge}) {
            /* 6 and 8 cols */
            grid-area: span 1 / span 2;
          }
        `;

    default:
      return `
          /* 2, 4, 6 and 8 cols */
          grid-area: span 2 / span 2;
        `;
  }
}, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (WidgetWrapper);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_dashboard_tsx.d06a96015d303ce3ca8690442bae6c4f.js.map