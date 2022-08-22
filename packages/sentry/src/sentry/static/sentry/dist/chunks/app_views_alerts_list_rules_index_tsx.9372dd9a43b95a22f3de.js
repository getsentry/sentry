"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_list_rules_index_tsx"],{

/***/ "./app/components/alertBadge.tsx":
/*!***************************************!*\
  !*** ./app/components/alertBadge.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/alerts/types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function AlertBadge(_ref) {
  let {
    status,
    hideText = false,
    isIssue
  } = _ref;
  let statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Resolved');
  let Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconCheckmark;
  let color = 'green300';

  if (isIssue) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Issue');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconIssues;
    color = 'gray300';
  } else if (status === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__.IncidentStatus.CRITICAL) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Critical');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconFire;
    color = 'red300';
  } else if (status === sentry_views_alerts_types__WEBPACK_IMPORTED_MODULE_4__.IncidentStatus.WARNING) {
    statusText = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Warning');
    Icon = sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconExclamation;
    color = 'yellow300';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Wrapper, {
    "data-test-id": "alert-badge",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(AlertIconWrapper, {
      color: color,
      icon: Icon,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(AlertIconBackground, {
        color: color
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Icon, {
        color: "white"
      })]
    }), !hideText && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(IncidentStatusValue, {
      color: color,
      children: statusText
    })]
  });
}

AlertBadge.displayName = "AlertBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AlertBadge);

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd3"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const AlertIconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd2"
} : 0)("width:36px;height:36px;position:relative;svg:last-child{width:", p => p.icon === sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconIssues ? '13px' : '16px', ";z-index:2;position:absolute;top:0;bottom:0;left:0;right:0;margin:auto;}" + ( true ? "" : 0));

const AlertIconBackground = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconDiamond,  true ? {
  target: "ef4c9wd1"
} : 0)( true ? {
  name: "bgbjt4",
  styles: "width:36px;height:36px"
} : 0);

const IncidentStatusValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ef4c9wd0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/performance/vitals/constants.tsx":
/*!****************************************************!*\
  !*** ./app/utils/performance/vitals/constants.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Browser": () => (/* binding */ Browser),
/* harmony export */   "MOBILE_VITAL_DETAILS": () => (/* binding */ MOBILE_VITAL_DETAILS),
/* harmony export */   "WEB_VITAL_DETAILS": () => (/* binding */ WEB_VITAL_DETAILS)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");



const WEB_VITAL_DETAILS = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FP]: {
    slug: 'fp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Paint'),
    acronym: 'FP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the first pixel loaded in the viewport (may overlap with FCP).'),
    poorThreshold: 3000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FCP]: {
    slug: 'fcp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Contentful Paint'),
    acronym: 'FCP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the first image, text or other DOM node in the viewport.'),
    poorThreshold: 3000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FCP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.LCP]: {
    slug: 'lcp',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Largest Contentful Paint'),
    acronym: 'LCP',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Render time of the largest image, text or other DOM node in the viewport.'),
    poorThreshold: 4000,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.LCP)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FID]: {
    slug: 'fid',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('First Input Delay'),
    acronym: 'FID',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Response time of the browser to a user interaction (clicking, tapping, etc).'),
    poorThreshold: 300,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.FID)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.CLS]: {
    slug: 'cls',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cumulative Layout Shift'),
    acronym: 'CLS',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Sum of layout shift scores that measure the visual stability of the page.'),
    poorThreshold: 0.25,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.CLS)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.TTFB]: {
    slug: 'ttfb',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Time to First Byte'),
    acronym: 'TTFB',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)("The time that it takes for a user's browser to receive the first byte of page content."),
    poorThreshold: 600,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.TTFB)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.RequestTime]: {
    slug: 'ttfb.requesttime',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Request Time'),
    acronym: 'RT',
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Captures the time spent making the request and receiving the first byte of the response.'),
    poorThreshold: 600,
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.WebVital.RequestTime)
  }
};
const MOBILE_VITAL_DETAILS = {
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartCold]: {
    slug: 'app_start_cold',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('App Start Cold'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cold start is a measure of the application start up time from scratch.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartCold)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartWarm]: {
    slug: 'app_start_warm',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('App Start Warm'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Warm start is a measure of the application start up time while still in memory.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.AppStartWarm)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesTotal]: {
    slug: 'frames_total',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total frames is a count of the number of frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesTotal)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlow]: {
    slug: 'frames_slow',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow frames is a count of the number of slow frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlow)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozen]: {
    slug: 'frames_frozen',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen frames is a count of the number of frozen frames recorded within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozen)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlowRate]: {
    slug: 'frames_slow_rate',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames Rate'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Frames Rate is the percentage of frames recorded within a transaction that is considered slow.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesSlowRate)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozenRate]: {
    slug: 'frames_frozen_rate',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate is the percentage of frames recorded within a transaction that is considered frozen.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.FramesFrozenRate)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallCount]: {
    slug: 'stall_count',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stalls'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stalls is the number of times the application stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallCount)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallTotalTime]: {
    slug: 'stall_total_time',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Stall Time'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Total Time is the total amount of time the application is stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallTotalTime)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallLongestTime]: {
    slug: 'stall_longest_time',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Longest Stall Time'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Longest Time is the longest amount of time the application is stalled within a transaction.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallLongestTime)
  },
  [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallPercentage]: {
    slug: 'stall_percentage',
    name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Percentage'),
    description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Stall Percentage is the percentage of the transaction duration the application was stalled.'),
    type: (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_1__.measurementType)(sentry_utils_fields__WEBPACK_IMPORTED_MODULE_2__.MobileVital.StallPercentage)
  }
};
let Browser;

(function (Browser) {
  Browser["CHROME"] = "Chrome";
  Browser["EDGE"] = "Edge";
  Browser["OPERA"] = "Opera";
  Browser["FIREFOX"] = "Firefox";
  Browser["SAFARI"] = "Safari";
  Browser["IE"] = "IE";
})(Browser || (Browser = {}));

/***/ }),

/***/ "./app/views/alerts/list/rules/index.tsx":
/*!***********************************************!*\
  !*** ./app/views/alerts/list/rules/index.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/hookOrDefault */ "./app/components/hookOrDefault.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _filterBar__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ../../filterBar */ "./app/views/alerts/filterBar.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../../types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ../header */ "./app/views/alerts/list/header.tsx");
/* harmony import */ var _row__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./row */ "./app/views/alerts/list/rules/row.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
























const HookHeader = (0,sentry_components_hookOrDefault__WEBPACK_IMPORTED_MODULE_7__["default"])({
  hookName: 'component:alerts-header'
});

class AlertRulesList extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeFilter", activeFilters => {
      const {
        router,
        location
      } = this.props;
      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      router.push({
        pathname: location.pathname,
        query: { ...currentQuery,
          team: activeFilters.length > 0 ? activeFilters : ''
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeSearch", name => {
      const {
        router,
        location
      } = this.props;
      const {
        cursor: _cursor,
        page: _page,
        ...currentQuery
      } = location.query;
      router.push({
        pathname: location.pathname,
        query: { ...currentQuery,
          name
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleOwnerChange", (projectId, rule, ownerValue) => {
      const {
        orgId
      } = this.props.params;
      const alertPath = rule.type === 'alert_rule' ? 'alert-rules' : 'rules';
      const endpoint = `/projects/${orgId}/${projectId}/${alertPath}/${rule.id}/`;
      const updatedRule = { ...rule,
        owner: ownerValue
      };
      this.api.request(endpoint, {
        method: 'PUT',
        data: updatedRule,
        success: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Updated alert rule'), 'success');
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unable to save change'), 'error');
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDeleteRule", async (projectId, rule) => {
      const {
        orgId
      } = this.props.params;
      const alertPath = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.isIssueAlert)(rule) ? 'rules' : 'alert-rules';

      try {
        await this.api.requestPromise(`/projects/${orgId}/${projectId}/${alertPath}/${rule.id}/`, {
          method: 'DELETE'
        });
        this.reloadData();
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Error deleting rule'));
      }
    });
  }

  getEndpoints() {
    const {
      params,
      location
    } = this.props;
    const {
      query
    } = location;
    query.expand = ['latestIncident', 'lastTriggered'];
    query.team = (0,_utils__WEBPACK_IMPORTED_MODULE_22__.getTeamParams)(query.team);

    if (!query.sort) {
      query.sort = ['incident_status', 'date_triggered'];
    }

    return [['ruleList', `/organizations/${params && params.orgId}/combined-rules/`, {
      query
    }]];
  }

  onRequestSuccess(_ref) {
    let {
      stateKey,
      resp
    } = _ref;

    if (stateKey === 'ruleList') {
      const issueRuleCount = resp.getResponseHeader('X-Sentry-Issue-Rule-Hits');
      const alertRuleCount = resp.getResponseHeader('X-Sentry-Alert-Rule-Hits');
      this.setState({
        issueRuleCount: parseInt(issueRuleCount, 10),
        alertRuleCount: parseInt(alertRuleCount, 10)
      });
    }
  }

  get projectsFromIncidents() {
    const {
      ruleList = []
    } = this.state;
    return [...new Set(ruleList === null || ruleList === void 0 ? void 0 : ruleList.map(_ref2 => {
      let {
        projects
      } = _ref2;
      return projects;
    }).flat())];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    const {
      params: {
        orgId
      },
      location,
      organization,
      router
    } = this.props;
    const {
      loading,
      ruleList = [],
      ruleListPageLinks,
      issueRuleCount,
      alertRuleCount
    } = this.state;
    const {
      query
    } = location;
    const hasEditAccess = organization.access.includes('alerts:write');
    const sort = {
      asc: query.asc === '1',
      field: query.sort || 'date_added'
    };
    const {
      cursor: _cursor,
      page: _page,
      ...currentQuery
    } = query;
    const isAlertRuleSort = sort.field.includes('incident_status') || sort.field.includes('date_triggered');

    const sortArrow = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
      color: "gray300",
      size: "xs",
      direction: sort.asc ? 'up' : 'down'
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__.Main, {
        fullWidth: true,
        children: [issueRuleCount !== undefined && issueRuleCount > 0 && alertRuleCount === 0 && !query.name && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(HookHeader, {
          organization: organization
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_filterBar__WEBPACK_IMPORTED_MODULE_20__["default"], {
          location: location,
          onChangeFilter: this.handleChangeFilter,
          onChangeSearch: this.handleChangeSearch
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_18__["default"], {
          provideUserTeams: true,
          children: _ref3 => {
            let {
              initiallyLoaded: loadedTeams,
              teams
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(StyledPanelTable, {
              headers: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(StyledSortLink, {
                role: "columnheader",
                "aria-sort": sort.field !== 'name' ? 'none' : sort.asc ? 'ascending' : 'descending',
                to: {
                  pathname: location.pathname,
                  query: { ...currentQuery,
                    // sort by name should start by ascending on first click
                    asc: sort.field === 'name' && sort.asc ? undefined : '1',
                    sort: 'name'
                  }
                },
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Alert Rule'), " ", sort.field === 'name' && sortArrow]
              }, "name"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(StyledSortLink, {
                role: "columnheader",
                "aria-sort": !isAlertRuleSort ? 'none' : sort.asc ? 'ascending' : 'descending',
                to: {
                  pathname: location.pathname,
                  query: { ...currentQuery,
                    asc: isAlertRuleSort && !sort.asc ? '1' : undefined,
                    sort: ['incident_status', 'date_triggered']
                  }
                },
                children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Status'), " ", isAlertRuleSort && sortArrow]
              }, "status"), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Project'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Team'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Actions')],
              isLoading: loading || !loadedTeams,
              isEmpty: (ruleList === null || ruleList === void 0 ? void 0 : ruleList.length) === 0,
              emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('No alert rules found for the current query.'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_17__["default"], {
                orgId: orgId,
                slugs: this.projectsFromIncidents,
                children: _ref4 => {
                  let {
                    initiallyLoaded,
                    projects
                  } = _ref4;
                  return ruleList.map(rule => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_row__WEBPACK_IMPORTED_MODULE_24__["default"] // Metric and issue alerts can have the same id
                  , {
                    projectsLoaded: initiallyLoaded,
                    projects: projects,
                    rule: rule,
                    orgId: orgId,
                    onOwnerChange: this.handleOwnerChange,
                    onDelete: this.handleDeleteRule,
                    userTeams: new Set(teams.map(team => team.id)),
                    hasEditAccess: hasEditAccess
                  }, `${(0,_utils__WEBPACK_IMPORTED_MODULE_22__.isIssueAlert)(rule) ? _types__WEBPACK_IMPORTED_MODULE_21__.AlertRuleType.METRIC : _types__WEBPACK_IMPORTED_MODULE_21__.AlertRuleType.ISSUE}-${rule.id}`));
                }
              })
            });
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
          pageLinks: ruleListPageLinks,
          onCursor: (cursor, path, _direction) => {
            let team = currentQuery.team; // Keep team parameter, but empty to remove parameters

            if (!team || team.length === 0) {
              team = '';
            }

            router.push({
              pathname: path,
              query: { ...currentQuery,
                team,
                cursor
              }
            });
          }
        })]
      })
    });
  }

  renderBody() {
    const {
      params,
      organization,
      router
    } = this.props;
    const {
      orgId
    } = params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_13__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Alerts'),
      orgSlug: orgId,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__["default"], {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_header__WEBPACK_IMPORTED_MODULE_23__["default"], {
          organization: organization,
          router: router,
          activeTab: "rules",
          projectSlugs: this.projectsFromIncidents
        }), this.renderList()]
      })
    });
  }

}

class AlertRulesListContainer extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(prevProps) {
    var _prevProps$location$q, _location$query;

    const {
      location
    } = this.props;

    if (((_prevProps$location$q = prevProps.location.query) === null || _prevProps$location$q === void 0 ? void 0 : _prevProps$location$q.sort) !== ((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.sort)) {
      this.trackView();
    }
  }

  trackView() {
    const {
      organization,
      location
    } = this.props;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_16__["default"])('alert_rules.viewed', {
      organization,
      sort: Array.isArray(location.query.sort) ? location.query.sort.join(',') : location.query.sort
    });
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(AlertRulesList, { ...this.props
    });
  }

}

AlertRulesListContainer.displayName = "AlertRulesListContainer";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_19__["default"])(AlertRulesListContainer));

const StyledSortLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1hnq40r1"
} : 0)( true ? {
  name: "1sbdiq8",
  styles: "color:inherit;:hover{color:inherit;}"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelTable,  true ? {
  target: "e1hnq40r0"
} : 0)("position:static;overflow:auto;@media (min-width: ", p => p.theme.breakpoints.small, "){overflow:initial;}grid-template-columns:4fr auto 140px 60px auto;white-space:nowrap;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/list/rules/row.tsx":
/*!*********************************************!*\
  !*** ./app/views/alerts/list/rules/row.tsx ***!
  \*********************************************/
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alertBadge */ "./app/components/alertBadge.tsx");
/* harmony import */ var sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/avatar/actorAvatar */ "./app/components/avatar/actorAvatar.tsx");
/* harmony import */ var sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/avatar/teamAvatar */ "./app/components/avatar/teamAvatar.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownBubble__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/dropdownBubble */ "./app/components/dropdownBubble.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_highlight__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/highlight */ "./app/components/highlight.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/constants */ "./app/views/alerts/rules/metric/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ../../types */ "./app/views/alerts/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ../../utils */ "./app/views/alerts/utils/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





























/**
 * Memoized function to find a project from a list of projects
 */
const getProject = lodash_memoize__WEBPACK_IMPORTED_MODULE_4___default()((slug, projects) => projects.find(project => project.slug === slug));

function RuleListRow(_ref) {
  var _rule$latestIncident, _rule$owner, _rule$latestIncident$, _rule$latestIncident3, _rule$latestIncident4;

  let {
    rule,
    projectsLoaded,
    projects,
    orgId,
    onDelete,
    onOwnerChange,
    userTeams,
    hasEditAccess
  } = _ref;
  const [assignee, setAssignee] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('');
  const activeIncident = ((_rule$latestIncident = rule.latestIncident) === null || _rule$latestIncident === void 0 ? void 0 : _rule$latestIncident.status) !== undefined && [_types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.CRITICAL, _types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.WARNING].includes(rule.latestIncident.status);

  function renderLastIncidentDate() {
    if ((0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule)) {
      if (!rule.lastTriggered) {
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Alerts not triggered yet');
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)("div", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Triggered '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_19__["default"], {
          date: rule.lastTriggered
        })]
      });
    }

    if (!rule.latestIncident) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Alerts not triggered yet');
    }

    if (activeIncident) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)("div", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Triggered '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_19__["default"], {
          date: rule.latestIncident.dateCreated
        })]
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)("div", {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Resolved '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_19__["default"], {
        date: rule.latestIncident.dateClosed
      })]
    });
  }

  function renderAlertRuleStatus() {
    var _rule$latestIncident2, _trigger$alertThresho;

    if ((0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule)) {
      return null;
    }

    const criticalTrigger = rule.triggers.find(_ref2 => {
      let {
        label
      } = _ref2;
      return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleTriggerType.CRITICAL;
    });
    const warningTrigger = rule.triggers.find(_ref3 => {
      let {
        label
      } = _ref3;
      return label === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleTriggerType.WARNING;
    });
    const resolvedTrigger = rule.resolveThreshold;
    const trigger = activeIncident && ((_rule$latestIncident2 = rule.latestIncident) === null || _rule$latestIncident2 === void 0 ? void 0 : _rule$latestIncident2.status) === _types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.CRITICAL ? criticalTrigger : warningTrigger !== null && warningTrigger !== void 0 ? warningTrigger : criticalTrigger;
    let iconColor = 'green300';
    let iconDirection;
    let thresholdTypeText = activeIncident && rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleThresholdType.ABOVE ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Above') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Below');

    if (activeIncident) {
      iconColor = (trigger === null || trigger === void 0 ? void 0 : trigger.label) === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleTriggerType.CRITICAL ? 'red300' : (trigger === null || trigger === void 0 ? void 0 : trigger.label) === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleTriggerType.WARNING ? 'yellow300' : 'green300';
      iconDirection = rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleThresholdType.ABOVE ? 'up' : 'down';
    } else {
      // Use the Resolved threshold type, which is opposite of Critical
      iconDirection = rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleThresholdType.ABOVE ? 'down' : 'up';
      thresholdTypeText = rule.thresholdType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleThresholdType.ABOVE ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Below') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Above');
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(FlexCenter, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconArrow, {
        color: iconColor,
        direction: iconDirection
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(TriggerText, {
        children: [`${thresholdTypeText} ${rule.latestIncident || !rule.latestIncident && !resolvedTrigger ? trigger === null || trigger === void 0 ? void 0 : (_trigger$alertThresho = trigger.alertThreshold) === null || _trigger$alertThresho === void 0 ? void 0 : _trigger$alertThresho.toLocaleString() : resolvedTrigger === null || resolvedTrigger === void 0 ? void 0 : resolvedTrigger.toLocaleString()}`, (0,sentry_views_alerts_rules_metric_constants__WEBPACK_IMPORTED_MODULE_24__.getThresholdUnits)(rule.aggregate, rule.comparisonDelta ? sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleComparisonType.CHANGE : sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_25__.AlertRuleComparisonType.COUNT)]
      })]
    });
  }

  const slug = rule.projects[0];
  const editLink = `/organizations/${orgId}/alerts/${(0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule) ? 'rules' : 'metric-rules'}/${slug}/${rule.id}/`;
  const duplicateLink = {
    pathname: `/organizations/${orgId}/alerts/new/${rule.type === _types__WEBPACK_IMPORTED_MODULE_26__.CombinedAlertType.METRIC ? 'metric' : 'issue'}/`,
    query: {
      project: slug,
      duplicateRuleId: rule.id,
      createFromDuplicate: true,
      referrer: 'alert_stream'
    }
  };
  const detailsLink = `/organizations/${orgId}/alerts/rules/details/${rule.id}/`;
  const ownerId = (_rule$owner = rule.owner) === null || _rule$owner === void 0 ? void 0 : _rule$owner.split(':')[1];
  const teamActor = ownerId ? {
    type: 'team',
    id: ownerId,
    name: ''
  } : null;
  const canEdit = ownerId ? userTeams.has(ownerId) : true;
  const alertLink = (0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_16__["default"], {
    to: `/organizations/${orgId}/alerts/rules/${rule.projects[0]}/${rule.id}/details/`,
    children: rule.name
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(TitleLink, {
    to: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule) ? editLink : detailsLink,
    children: rule.name
  });
  const IssueStatusText = {
    [_types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.CRITICAL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Critical'),
    [_types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.WARNING]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Warning'),
    [_types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.CLOSED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Resolved'),
    [_types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.OPENED]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Resolved')
  };
  const actions = [{
    key: 'edit',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Edit'),
    to: editLink
  }, {
    key: 'duplicate',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Duplicate'),
    to: duplicateLink
  }, {
    key: 'delete',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Delete'),
    priority: 'danger',
    onAction: () => {
      (0,sentry_components_confirm__WEBPACK_IMPORTED_MODULE_9__.openConfirmModal)({
        onConfirm: () => onDelete(slug, rule),
        header: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Delete Alert Rule?'),
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.tct)("Are you sure you want to delete [name]? You won't be able to view the history of this alert once it's deleted.", {
          name: rule.name
        }),
        confirmText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Delete Rule'),
        priority: 'danger'
      });
    }
  }];

  function handleOwnerChange(_ref4) {
    let {
      value
    } = _ref4;
    const ownerValue = value && `team:${value}`;
    setAssignee(ownerValue);
    onOwnerChange(slug, rule, ownerValue);
  }

  const unassignedOption = {
    value: '',
    label: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(MenuItemWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(StyledIconUser, {
        size: "20px"
      }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Unassigned')]
    }),
    searchKey: 'unassigned',
    actor: '',
    disabled: false
  };
  const projectRow = projects.filter(project => project.slug === slug);
  const projectRowTeams = projectRow[0].teams;
  const filteredProjectTeams = projectRowTeams === null || projectRowTeams === void 0 ? void 0 : projectRowTeams.filter(projTeam => {
    return userTeams.has(projTeam.id);
  });
  const dropdownTeams = filteredProjectTeams === null || filteredProjectTeams === void 0 ? void 0 : filteredProjectTeams.map((team, idx) => ({
    value: team.id,
    searchKey: team.slug,
    label: _ref5 => {
      let {
        inputValue
      } = _ref5;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(MenuItemWrapper, {
        "data-test-id": "assignee-option",
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(IconContainer, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_avatar_teamAvatar__WEBPACK_IMPORTED_MODULE_8__["default"], {
            team: team,
            size: 24
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(Label, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_highlight__WEBPACK_IMPORTED_MODULE_14__["default"], {
            text: inputValue,
            children: `#${team.slug}`
          })
        })]
      }, idx);
    }
  })).concat(unassignedOption);
  const teamId = assignee === null || assignee === void 0 ? void 0 : assignee.split(':')[1];
  const teamName = filteredProjectTeams === null || filteredProjectTeams === void 0 ? void 0 : filteredProjectTeams.find(team => team.id === teamId);
  const assigneeTeamActor = assignee && {
    type: 'team',
    id: teamId,
    name: ''
  };
  const avatarElement = assigneeTeamActor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_7__["default"], {
    actor: assigneeTeamActor,
    className: "avatar",
    size: 24,
    tooltip: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(TooltipWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.tct)('Assigned to [name]', {
        name: teamName && `#${teamName.name}`
      })
    })
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_20__["default"], {
    isHoverable: true,
    skipWrapper: true,
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Unassigned'),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(StyledIconUser, {
      size: "20px",
      color: "gray400"
    })
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_13__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(AlertNameWrapper, {
      isIssueAlert: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule),
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(FlexCenter, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_20__["default"], {
          title: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Issue Alert') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.tct)('Metric Alert Status: [status]', {
            status: IssueStatusText[(_rule$latestIncident$ = rule === null || rule === void 0 ? void 0 : (_rule$latestIncident3 = rule.latestIncident) === null || _rule$latestIncident3 === void 0 ? void 0 : _rule$latestIncident3.status) !== null && _rule$latestIncident$ !== void 0 ? _rule$latestIncident$ : _types__WEBPACK_IMPORTED_MODULE_26__.IncidentStatus.CLOSED]
          }),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_alertBadge__WEBPACK_IMPORTED_MODULE_6__["default"], {
            status: rule === null || rule === void 0 ? void 0 : (_rule$latestIncident4 = rule.latestIncident) === null || _rule$latestIncident4 === void 0 ? void 0 : _rule$latestIncident4.status,
            isIssue: (0,_utils__WEBPACK_IMPORTED_MODULE_27__.isIssueAlert)(rule),
            hideText: true
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(AlertNameAndStatus, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(AlertName, {
          children: alertLink
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(AlertIncidentDate, {
          children: renderLastIncidentDate()
        })]
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(FlexCenter, {
      children: renderAlertRuleStatus()
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(FlexCenter, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ProjectBadgeContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ProjectBadge, {
          avatarSize: 18,
          project: !projectsLoaded ? {
            slug
          } : getProject(slug, projects)
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(FlexCenter, {
      children: teamActor ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_avatar_actorAvatar__WEBPACK_IMPORTED_MODULE_7__["default"], {
        actor: teamActor,
        size: 24
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(AssigneeWrapper, {
        children: [!projectsLoaded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_17__["default"], {
          mini: true,
          style: {
            height: '24px',
            margin: 0,
            marginRight: 11
          }
        }), projectsLoaded && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_10__["default"], {
          "data-test-id": "alert-row-assignee",
          maxHeight: 400,
          onOpen: e => {
            e === null || e === void 0 ? void 0 : e.stopPropagation();
          },
          items: dropdownTeams,
          alignMenu: "right",
          onSelect: handleOwnerChange,
          itemSize: "small",
          searchPlaceholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Filter teams'),
          disableLabelPadding: true,
          emptyHidesInput: true,
          disabled: !hasEditAccess,
          children: _ref6 => {
            let {
              getActorProps,
              isOpen
            } = _ref6;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsxs)(DropdownButton, { ...getActorProps({}),
              children: [avatarElement, hasEditAccess && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(StyledChevron, {
                direction: isOpen ? 'up' : 'down',
                size: "xs"
              })]
            });
          }
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(ActionsRow, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
        access: ['alerts:write'],
        children: _ref7 => {
          let {
            hasAccess
          } = _ref7;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_12__["default"], {
            items: actions,
            placement: "bottom right",
            triggerProps: {
              'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Show more'),
              'data-test-id': 'alert-row-actions',
              size: 'xs',
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_28__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconEllipsis, {
                size: "xs"
              }),
              showChevron: false
            },
            disabledKeys: hasAccess && canEdit ? [] : ['delete']
          });
        }
      })
    })]
  });
}

RuleListRow.displayName = "RuleListRow";

const TitleLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "e1k8ax6w17"
} : 0)(p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const FlexCenter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w16"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const AlertNameWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(FlexCenter,  true ? {
  target: "e1k8ax6w15"
} : 0)("position:relative;", p => p.isIssueAlert && `padding: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(3)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2)}; line-height: 2.4;`, ";" + ( true ? "" : 0));

const AlertNameAndStatus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w14"
} : 0)(p => p.theme.overflowEllipsis, " margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2), ";line-height:1.35;" + ( true ? "" : 0));

const AlertName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w13"
} : 0)(p => p.theme.overflowEllipsis, " font-size:", p => p.theme.fontSizeLarge, ";@media (max-width: ", p => p.theme.breakpoints.xlarge, "){max-width:300px;}@media (max-width: ", p => p.theme.breakpoints.large, "){max-width:165px;}@media (max-width: ", p => p.theme.breakpoints.medium, "){max-width:100px;}" + ( true ? "" : 0));

const AlertIncidentDate = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w12"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const ProjectBadgeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w11"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

const ProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e1k8ax6w10"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const TriggerText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w9"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";white-space:nowrap;font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const ActionsRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(FlexCenter,  true ? {
  target: "e1k8ax6w8"
} : 0)("justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";" + ( true ? "" : 0));

const AssigneeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w7"
} : 0)("display:flex;justify-content:flex-end;", sentry_components_dropdownBubble__WEBPACK_IMPORTED_MODULE_11__["default"], "{right:-14px;}" + ( true ? "" : 0));

const DropdownButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w6"
} : 0)( true ? {
  name: "1nfrdh1",
  styles: "display:flex;align-items:center;font-size:20px"
} : 0);

const StyledChevron = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconChevron,  true ? {
  target: "e1k8ax6w5"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";" + ( true ? "" : 0));

const TooltipWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w4"
} : 0)( true ? {
  name: "1flj9lk",
  styles: "text-align:left"
} : 0);

const StyledIconUser = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_21__.IconUser,  true ? {
  target: "e1k8ax6w3"
} : 0)( true ? {
  name: "2bhlo8",
  styles: "margin-right:2px"
} : 0);

const IconContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w2"
} : 0)( true ? {
  name: "ksp8pg",
  styles: "display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0"
} : 0);

const MenuItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k8ax6w1"
} : 0)( true ? {
  name: "na9qgn",
  styles: "display:flex;align-items:center;font-size:13px"
} : 0);

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "e1k8ax6w0"
} : 0)( true ? {
  name: "18jsklt",
  styles: "margin-left:6px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RuleListRow);

/***/ }),

/***/ "./app/views/alerts/rules/metric/constants.tsx":
/*!*****************************************************!*\
  !*** ./app/views/alerts/rules/metric/constants.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "COMPARISON_DELTA_OPTIONS": () => (/* binding */ COMPARISON_DELTA_OPTIONS),
/* harmony export */   "DATASET_EVENT_TYPE_FILTERS": () => (/* binding */ DATASET_EVENT_TYPE_FILTERS),
/* harmony export */   "DATASOURCE_EVENT_TYPE_FILTERS": () => (/* binding */ DATASOURCE_EVENT_TYPE_FILTERS),
/* harmony export */   "DEFAULT_AGGREGATE": () => (/* binding */ DEFAULT_AGGREGATE),
/* harmony export */   "DEFAULT_CHANGE_COMP_DELTA": () => (/* binding */ DEFAULT_CHANGE_COMP_DELTA),
/* harmony export */   "DEFAULT_CHANGE_TIME_WINDOW": () => (/* binding */ DEFAULT_CHANGE_TIME_WINDOW),
/* harmony export */   "DEFAULT_COUNT_TIME_WINDOW": () => (/* binding */ DEFAULT_COUNT_TIME_WINDOW),
/* harmony export */   "DEFAULT_TRANSACTION_AGGREGATE": () => (/* binding */ DEFAULT_TRANSACTION_AGGREGATE),
/* harmony export */   "DuplicateActionFields": () => (/* binding */ DuplicateActionFields),
/* harmony export */   "DuplicateMetricFields": () => (/* binding */ DuplicateMetricFields),
/* harmony export */   "DuplicateTriggerFields": () => (/* binding */ DuplicateTriggerFields),
/* harmony export */   "createDefaultRule": () => (/* binding */ createDefaultRule),
/* harmony export */   "createDefaultTrigger": () => (/* binding */ createDefaultTrigger),
/* harmony export */   "createRuleFromEventView": () => (/* binding */ createRuleFromEventView),
/* harmony export */   "createRuleFromWizardTemplate": () => (/* binding */ createRuleFromWizardTemplate),
/* harmony export */   "errorFieldConfig": () => (/* binding */ errorFieldConfig),
/* harmony export */   "getThresholdUnits": () => (/* binding */ getThresholdUnits),
/* harmony export */   "getWizardAlertFieldConfig": () => (/* binding */ getWizardAlertFieldConfig),
/* harmony export */   "transactionFieldConfig": () => (/* binding */ transactionFieldConfig)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/fields */ "./app/utils/fields/index.ts");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/views/alerts/utils */ "./app/views/alerts/utils/index.tsx");







const DEFAULT_COUNT_TIME_WINDOW = 1; // 1min

const DEFAULT_CHANGE_TIME_WINDOW = 60; // 1h

const DEFAULT_CHANGE_COMP_DELTA = 10080; // 1w

const DEFAULT_AGGREGATE = 'count()';
const DEFAULT_TRANSACTION_AGGREGATE = 'p95(transaction.duration)';
const DATASET_EVENT_TYPE_FILTERS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.TRANSACTIONS]: 'event.type:transaction',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.GENERIC_METRICS]: 'event.type:transaction'
};
const DATASOURCE_EVENT_TYPE_FILTERS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.ERROR_DEFAULT]: 'event.type:[error, default]',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.ERROR]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.DEFAULT]: 'event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Datasource.TRANSACTION]: 'event.type:transaction'
};

/**
 * Allowed error aggregations for alerts
 */
const errorFieldConfig = {
  aggregations: [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Count, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.CountUnique],
  fields: ['user']
};
const commonAggregations = [sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Avg, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Percentile, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P50, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P75, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P95, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P99, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.P100];
const allAggregations = [...commonAggregations, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.FailureRate, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Apdex, sentry_utils_fields__WEBPACK_IMPORTED_MODULE_3__.AggregationKey.Count];
const DuplicateMetricFields = ['dataset', 'eventTypes', 'aggregate', 'query', 'timeWindow', 'thresholdPeriod', 'projects', 'environment', 'resolveThreshold', 'thresholdType', 'owner', 'name', 'projectId', 'comparisonDelta'];
const DuplicateTriggerFields = ['alertThreshold', 'label'];
const DuplicateActionFields = ['type', 'targetType', 'targetIdentifier', 'inputChannelId', 'options'];
const COMPARISON_DELTA_OPTIONS = [{
  value: 5,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time 5 minutes ago')
}, // 5 minutes
{
  value: 15,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time 15 minutes ago')
}, // 15 minutes
{
  value: 60,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one hour ago')
}, // one hour
{
  value: 1440,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one day ago')
}, // one day
{
  value: 10080,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one week ago')
}, // one week
{
  value: 43200,
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('same time one month ago')
} // 30 days
];
function getWizardAlertFieldConfig(alertType, dataset) {
  if (alertType === 'custom' && dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS) {
    return errorFieldConfig;
  } // If user selected apdex we must include that in the OptionConfig as it has a user specified column


  const aggregations = alertType === 'apdex' || alertType === 'custom' ? allAggregations : commonAggregations;
  return {
    aggregations,
    fields: ['transaction.duration'],
    measurementKeys: Object.keys(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__.WEB_VITAL_DETAILS)
  };
}
/**
 * Allowed transaction aggregations for alerts
 */

const transactionFieldConfig = {
  aggregations: allAggregations,
  fields: ['transaction.duration'],
  measurementKeys: Object.keys(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_4__.WEB_VITAL_DETAILS)
};
function createDefaultTrigger(label) {
  return {
    label,
    alertThreshold: '',
    actions: []
  };
}
function createDefaultRule() {
  let defaultRuleOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.EventTypes.ERROR],
    aggregate: DEFAULT_AGGREGATE,
    query: '',
    timeWindow: 60,
    thresholdPeriod: 1,
    triggers: [createDefaultTrigger(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleTriggerType.CRITICAL), createDefaultTrigger(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleTriggerType.WARNING)],
    projects: [],
    environment: null,
    resolveThreshold: '',
    thresholdType: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.ABOVE,
    ...defaultRuleOptions
  };
}
/**
 * Create an unsaved alert from a discover EventView object
 */

function createRuleFromEventView(eventView) {
  var _parsedQuery$query;

  const parsedQuery = (0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.getQueryDatasource)(eventView.query);
  const datasetAndEventtypes = parsedQuery ? sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.DATA_SOURCE_TO_SET_AND_EVENT_TYPES[parsedQuery.source] : sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.DATA_SOURCE_TO_SET_AND_EVENT_TYPES.error;
  let aggregate = eventView.getYAxis();

  if (datasetAndEventtypes.dataset === 'transactions' && /^p\d{2,3}\(\)/.test(eventView.getYAxis())) {
    // p95() -> p95(transaction.duration)
    aggregate = eventView.getYAxis().slice(0, 3) + '(transaction.duration)';
  }

  return { ...createDefaultRule(),
    ...datasetAndEventtypes,
    query: (_parsedQuery$query = parsedQuery === null || parsedQuery === void 0 ? void 0 : parsedQuery.query) !== null && _parsedQuery$query !== void 0 ? _parsedQuery$query : eventView.query,
    aggregate,
    environment: eventView.environment.length ? eventView.environment[0] : null
  };
}
function createRuleFromWizardTemplate(wizardTemplate) {
  const {
    eventTypes,
    aggregate,
    dataset
  } = wizardTemplate;
  const defaultRuleOptions = {};

  if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.isSessionAggregate)(aggregate)) {
    defaultRuleOptions.thresholdType = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.BELOW;
    defaultRuleOptions.timeWindow = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.TimeWindow.ONE_HOUR;
  }

  if (aggregate.includes('apdex')) {
    defaultRuleOptions.thresholdType = sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleThresholdType.BELOW;
  }

  return { ...createDefaultRule(defaultRuleOptions),
    eventTypes: [eventTypes],
    aggregate,
    dataset
  };
}
function getThresholdUnits(aggregate, comparisonType) {
  // cls is a number not a measurement of time
  if ((0,sentry_views_alerts_utils__WEBPACK_IMPORTED_MODULE_6__.isSessionAggregate)(aggregate) || comparisonType === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_5__.AlertRuleComparisonType.CHANGE) {
    return '%';
  }

  if (aggregate.includes('measurements.cls')) {
    return '';
  }

  if (aggregate.includes('duration') || aggregate.includes('measurements')) {
    return 'ms';
  }

  return '';
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_list_rules_index_tsx.aa4899d11568e6ec4a3240d64db5b7f8.js.map