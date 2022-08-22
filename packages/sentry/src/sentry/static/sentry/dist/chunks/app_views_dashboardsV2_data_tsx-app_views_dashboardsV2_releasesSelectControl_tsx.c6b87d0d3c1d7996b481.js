"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dashboardsV2_data_tsx-app_views_dashboardsV2_releasesSelectControl_tsx"],{

/***/ "./app/utils/releases/releasesProvider.tsx":
/*!*************************************************!*\
  !*** ./app/utils/releases/releasesProvider.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReleasesConsumer": () => (/* binding */ ReleasesConsumer),
/* harmony export */   "ReleasesContext": () => (/* binding */ ReleasesContext),
/* harmony export */   "ReleasesProvider": () => (/* binding */ ReleasesProvider),
/* harmony export */   "useReleases": () => (/* binding */ useReleases)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/handleXhrErrorResponse */ "./app/utils/handleXhrErrorResponse.tsx");
/* harmony import */ var _useApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function fetchReleases(api, orgSlug, selection, search) {
  const {
    environments,
    projects,
    datetime
  } = selection;
  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'GET',
    data: {
      sort: 'date',
      project: projects,
      per_page: 50,
      environment: environments,
      query: search,
      ...(0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_4__.normalizeDateTimeParams)(datetime)
    }
  });
}

function ReleasesProvider(_ref) {
  let {
    children,
    organization,
    selection,
    skipLoad = false
  } = _ref;
  const api = (0,_useApi__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const [releases, setReleases] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)([]);
  const [searchTerm, setSearchTerm] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('');
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(true);

  function handleSearch(search) {
    setSearchTerm(search);
  }

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (skipLoad) {
      setLoading(false);
      return undefined;
    }

    let shouldCancelRequest = false;
    setLoading(true);
    fetchReleases(api, organization.slug, selection, searchTerm).then(response => {
      if (shouldCancelRequest) {
        setLoading(false);
        return;
      }

      setLoading(false);
      setReleases(response);
    }).catch(e => {
      var _e$responseJSON;

      if (shouldCancelRequest) {
        setLoading(false);
        return;
      }

      const errorResponse = (_e$responseJSON = e === null || e === void 0 ? void 0 : e.responseJSON) !== null && _e$responseJSON !== void 0 ? _e$responseJSON : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Unable to fetch releases');
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)(errorResponse);
      setLoading(false);
      (0,sentry_utils_handleXhrErrorResponse__WEBPACK_IMPORTED_MODULE_6__["default"])(errorResponse)(e);
    });
    return () => {
      shouldCancelRequest = true;
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipLoad, api, organization.slug, JSON.stringify(selection), searchTerm]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(ReleasesContext.Provider, {
    value: {
      releases,
      loading,
      onSearch: handleSearch
    },
    children: children
  });
}

ReleasesProvider.displayName = "ReleasesProvider";
const ReleasesContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)(undefined);

function useReleases() {
  const releasesContext = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(ReleasesContext);

  if (!releasesContext) {
    throw new Error('releasesContext was called outside of ReleasesProvider');
  }

  return releasesContext;
}

const ReleasesConsumer = ReleasesContext.Consumer;


/***/ }),

/***/ "./app/views/dashboardsV2/data.tsx":
/*!*****************************************!*\
  !*** ./app/views/dashboardsV2/data.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DASHBOARDS_TEMPLATES": () => (/* binding */ DASHBOARDS_TEMPLATES),
/* harmony export */   "DEFAULT_STATS_PERIOD": () => (/* binding */ DEFAULT_STATS_PERIOD),
/* harmony export */   "DISPLAY_TYPE_CHOICES": () => (/* binding */ DISPLAY_TYPE_CHOICES),
/* harmony export */   "EMPTY_DASHBOARD": () => (/* binding */ EMPTY_DASHBOARD),
/* harmony export */   "INTERVAL_CHOICES": () => (/* binding */ INTERVAL_CHOICES)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");



const EMPTY_DASHBOARD = {
  id: '',
  dateCreated: '',
  createdBy: undefined,
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Untitled dashboard'),
  widgets: [],
  projects: [],
  filters: {}
};
const DASHBOARDS_TEMPLATES = [{
  id: 'default-template',
  dateCreated: '',
  createdBy: undefined,
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('General Template'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Various Frontend and Backend Widgets'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of Errors'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of Issues'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(issue)'],
      aggregates: ['count_unique(issue)'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count_unique(issue)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 0
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Affected Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 1,
      y: 2
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Known Users'),
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: 'has:user.email !event.type:transaction',
      orderby: 'count_unique(user)'
    }, {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Anonymous Users'),
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: '!has:user.email !event.type:transaction',
      orderby: 'count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Handled vs. Unhandled'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 0,
      y: 2
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Handled'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:true',
      orderby: 'count()'
    }, {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unhandled'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:false',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Country'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.WORLD_MAP,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction has:geo.country_code',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('High Throughput Transactions'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: '!event.type:error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 1,
      x: 5,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['browser.name', 'count()'],
      aggregates: ['count()'],
      columns: ['browser.name'],
      conditions: '!event.type:transaction has:browser.name',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall User Misery'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['user_misery(300)'],
      aggregates: ['user_misery(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['apdex(300)'],
      aggregates: ['apdex(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('High Throughput Transactions'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: '!event.type:error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Ordered by Misery'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      y: 6,
      x: 2
    },
    queries: [{
      name: '',
      fields: ['transaction', 'user_misery(300)'],
      aggregates: ['user_misery(300)'],
      columns: ['transaction'],
      conditions: '',
      orderby: '-user_misery(300)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 1,
      x: 4,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['browser.name', 'count()'],
      aggregates: ['count()'],
      columns: ['browser.name'],
      conditions: 'event.type:error has:browser.name',
      orderby: '-count()'
    }]
  }]
}, {
  id: 'frontend-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frontend Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Erroring URLs and Web Vitals'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['issue'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser as Percentage'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.AREA,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 9
    },
    queries: [{
      name: '',
      fields: ['equation|count_if(browser.name,equals,Chrome)/count() * 100', 'equation|count_if(browser.name,equals,Firefox)/count() * 100', 'equation|count_if(browser.name,equals,Safari)/count() * 100'],
      aggregates: ['equation|count_if(browser.name,equals,Chrome)/count() * 100', 'equation|count_if(browser.name,equals,Firefox)/count() * 100', 'equation|count_if(browser.name,equals,Safari)/count() * 100'],
      columns: [],
      conditions: 'has:browser.name',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 3,
      minH: 2,
      w: 4,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)', 'title'],
      aggregates: ['count_unique(user)'],
      columns: ['issue', 'title'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('URLs grouped by Issue'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 4,
      y: 8
    },
    queries: [{
      name: '',
      fields: ['http.url', 'issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['http.url', 'issue'],
      conditions: 'event.type:error',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions 404ing'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 9
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:not_found',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Layout Shift Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 2,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.cls)'],
      aggregates: ['p75(measurements.cls)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('LCP by Country'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.WORLD_MAP,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)'],
      aggregates: ['p75(measurements.lcp)'],
      columns: [],
      conditions: 'has:geo.country_code',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Page Load Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 3,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)', 'p75(measurements.fcp)'],
      aggregates: ['p75(measurements.lcp)', 'p75(measurements.fcp)'],
      columns: [],
      conditions: 'transaction.op:pageload',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slowest Pageloads'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 0,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.op:pageload p75(measurements.lcp):>4s',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall LCP'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)'],
      aggregates: ['p75(measurements.lcp)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Page Navigations'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.duration:>2s',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall FCP'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.fcp)'],
      aggregates: ['p75(measurements.fcp)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall CLS'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.cls)'],
      aggregates: ['p75(measurements.cls)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall FID'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.fid)'],
      aggregates: ['p75(measurements.fid)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }]
}, {
  id: 'backend-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Backend Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues and Performance'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['issue'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Erroring Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 8
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:internal_error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Erroring Transactions by Percentage'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 4,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['equation|count_if(transaction.status,equals,internal_error) / count() * 100', 'transaction', 'count_if(transaction.status,equals,internal_error)', 'count()'],
      aggregates: ['equation|count_if(transaction.status,equals,internal_error) / count() * 100', 'count_if(transaction.status,equals,internal_error)', 'count()'],
      columns: ['transaction'],
      conditions: 'count():>100',
      orderby: '-equation[0]'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 0,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)', 'title'],
      aggregates: ['count_unique(user)'],
      columns: ['issue', 'title'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Erroring'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 2,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:internal_error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 7,
      minH: 2,
      w: 6,
      x: 0,
      y: 15
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('p75 Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['p75(transaction.duration)'],
      aggregates: ['p75(transaction.duration)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Throughput (Events Per Minute)'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 0
    },
    queries: [{
      name: 'Transactions',
      fields: ['epm()'],
      aggregates: ['epm()'],
      columns: [],
      conditions: 'event.type:transaction',
      orderby: ''
    }, {
      name: 'Errors',
      fields: ['epm()'],
      aggregates: ['epm()'],
      columns: [],
      conditions: 'event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Tasks Transactions with Poor Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'apdex():<0.5 transaction.op:*task*',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('HTTP Transactions with Poor Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 4,
      x: 2,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['epm()', 'http.method', 'http.status_code', 'transaction'],
      aggregates: ['epm()'],
      columns: ['http.method', 'http.status_code', 'transaction'],
      conditions: 'apdex():<0.5 transaction.op:*http* has:http.method has:http.status_code',
      orderby: '-epm()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['apdex(300)'],
      aggregates: ['apdex(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Duration'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(transaction.duration)'],
      aggregates: ['p75(transaction.duration)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall HTTP Spans'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(spans.http)'],
      aggregates: ['p75(spans.http)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall DB Spans'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(spans.db)'],
      aggregates: ['p75(spans.db)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }]
}, {
  id: 'mobile-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Mobile Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crash Details and Performance Vitals'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique Users Who Crashed'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique Issues Causing Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 2,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(issue)'],
      aggregates: ['count_unique(issue)'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Number of Errors'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 3,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Causing Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 3,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['issue', 'count()', 'count_unique(user)'],
      aggregates: ['count()', 'count_unique(user)'],
      columns: ['issue'],
      conditions: 'error.handled:false',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 3,
      minH: 2,
      w: 2,
      x: 4,
      y: 0
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes'),
      fields: ['count()', 'count_unique(user)'],
      aggregates: ['count()', 'count_unique(user)'],
      columns: [],
      conditions: 'error.handled:false',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes by OS'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 3,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['os', 'count()'],
      aggregates: ['count()'],
      columns: ['os'],
      conditions: 'has:os error.handled:false',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Warm Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.app_start_warm)'],
      aggregates: ['p75(measurements.app_start_warm)'],
      columns: [],
      conditions: 'has:measurements.app_start_warm',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Cold Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 2,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.app_start_cold)'],
      aggregates: ['p75(measurements.app_start_cold)'],
      columns: [],
      conditions: 'has:measurements.app_start_cold',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Warm Startup Times'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.app_start_warm)'],
      aggregates: ['p75(measurements.app_start_warm)'],
      columns: ['transaction'],
      conditions: 'has:measurements.app_start_warm',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cold Startup Times'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.app_start_cold)'],
      aggregates: ['p75(measurements.app_start_cold)'],
      columns: ['transaction'],
      conditions: 'has:measurements.app_start_cold',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Frozen Frames'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 4,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.frames_frozen_rate)'],
      aggregates: ['p75(measurements.frames_frozen_rate)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Max Warm Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['max(measurements.app_start_warm)'],
      aggregates: ['max(measurements.app_start_warm)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Max Cold Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 3,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['max(measurements.app_start_cold)'],
      aggregates: ['max(measurements.app_start_cold)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.frames_frozen_rate)'],
      aggregates: ['p75(measurements.frames_frozen_rate)'],
      columns: ['transaction'],
      conditions: 'has:measurements.frames_frozen_rate',
      orderby: '-p75(measurements.frames_frozen_rate)'
    }]
  }]
}];
const DISPLAY_TYPE_CHOICES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Area Chart'),
  value: 'area'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Bar Chart'),
  value: 'bar'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Line Chart'),
  value: 'line'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Table'),
  value: 'table'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('World Map'),
  value: 'world_map'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Big Number'),
  value: 'big_number'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Events'),
  value: 'top_n'
}];
const INTERVAL_CHOICES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Minute'),
  value: '1m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('5 Minutes'),
  value: '5m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('15 Minutes'),
  value: '15m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('30 Minutes'),
  value: '30m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Hour'),
  value: '1h'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Day'),
  value: '1d'
}];
const DEFAULT_STATS_PERIOD = '24h';

/***/ }),

/***/ "./app/views/dashboardsV2/releasesSelectControl.tsx":
/*!**********************************************************!*\
  !*** ./app/views/dashboardsV2/releasesSelectControl.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_badge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/badge */ "./app/components/badge.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_releases_releasesProvider__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/releases/releasesProvider */ "./app/utils/releases/releasesProvider.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }















const ALIASED_RELEASES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Latest Release(s)'),
  value: 'latest'
}];

function ReleasesSelectControl(_ref) {
  let {
    handleChangeFilter,
    selectedReleases,
    className,
    isDisabled
  } = _ref;
  const {
    releases,
    loading,
    onSearch
  } = (0,sentry_utils_releases_releasesProvider__WEBPACK_IMPORTED_MODULE_12__.useReleases)();
  const [activeReleases, setActiveReleases] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(selectedReleases);

  function resetSearch() {
    onSearch('');
  }

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    setActiveReleases(selectedReleases);
  }, [selectedReleases]);
  const triggerLabel = activeReleases.length ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_7__["default"], {
    children: [activeReleases[0], " "]
  }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('All Releases');
  const activeReleasesSet = new Set(activeReleases);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_6__["default"], {
    multiple: true,
    isClearable: true,
    isSearchable: true,
    isDisabled: isDisabled,
    isLoading: loading,
    menuTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(MenuTitleWrapper, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Filter Releases'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_5__["default"], {
        type: "new"
      })]
    }),
    className: className,
    onInputChange: lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()(val => {
      onSearch(val);
    }, sentry_constants__WEBPACK_IMPORTED_MODULE_8__.DEFAULT_DEBOUNCE_DURATION),
    options: [{
      value: '_releases',
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_10__.t)('Sorted by date created'),
      options: [...ALIASED_RELEASES, ...activeReleases.filter(version => version !== 'latest').map(version => ({
        label: version,
        value: version
      })), ...releases.filter(_ref2 => {
        let {
          version
        } = _ref2;
        return !activeReleasesSet.has(version);
      }).map(_ref3 => {
        let {
          version
        } = _ref3;
        return {
          label: version,
          value: version
        };
      })]
    }],
    onChange: opts => setActiveReleases(opts.map(opt => opt.value)),
    onClose: () => {
      resetSearch();
      handleChangeFilter === null || handleChangeFilter === void 0 ? void 0 : handleChangeFilter({
        [_types__WEBPACK_IMPORTED_MODULE_13__.DashboardFilterKeys.RELEASE]: activeReleases
      });
    },
    value: activeReleases,
    triggerLabel: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(ButtonLabelWrapper, {
      children: [triggerLabel, ' ', activeReleases.length > 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledBadge, {
        text: `+${activeReleases.length - 1}`
      })]
    }),
    triggerProps: {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_9__.IconReleases, {})
    }
  });
}

ReleasesSelectControl.displayName = "ReleasesSelectControl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReleasesSelectControl);

const StyledBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_badge__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1ysg74p2"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const ButtonLabelWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1ysg74p1"
} : 0)( true ? {
  name: "yn3x4i",
  styles: "width:100%;text-align:left;align-items:center;display:inline-grid;grid-template-columns:1fr auto"
} : 0);

const MenuTitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1ysg74p0"
} : 0)("display:inline-block;padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dashboardsV2_data_tsx-app_views_dashboardsV2_releasesSelectControl_tsx.c7b8a7d2dff364abea8e38964bf31ef1.js.map