"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_globalSdkUpdateAlert_tsx-app_views_performance_onboarding_tsx"],{

/***/ "./app/components/globalSdkUpdateAlert.tsx":
/*!*************************************************!*\
  !*** ./app/components/globalSdkUpdateAlert.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GlobalSdkUpdateAlert": () => (/* binding */ WithSdkUpdatesGlobalSdkUpdateAlert),
/* harmony export */   "InnerGlobalSdkUpdateAlert": () => (/* binding */ InnerGlobalSdkUpdateAlert)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/prompts */ "./app/actionCreators/prompts.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/constants/pageFilters */ "./app/constants/pageFilters.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/stores/sidebarPanelStore */ "./app/stores/sidebarPanelStore.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/promptIsDismissed */ "./app/utils/promptIsDismissed.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/usePageFilters */ "./app/utils/usePageFilters.tsx");
/* harmony import */ var sentry_utils_withSdkUpdates__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withSdkUpdates */ "./app/utils/withSdkUpdates.tsx");
/* harmony import */ var _sidebar_types__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./sidebar/types */ "./app/components/sidebar/types.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./button */ "./app/components/button.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function InnerGlobalSdkUpdateAlert(props) {
  var _props$sdkUpdates, _selection$projects;

  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_10__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])();
  const {
    selection
  } = (0,sentry_utils_usePageFilters__WEBPACK_IMPORTED_MODULE_12__["default"])();
  const [showUpdateAlert, setShowUpdateAlert] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const handleSnoozePrompt = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__.promptsUpdate)(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
      status: 'snoozed'
    });
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.snoozed', {
      organization
    });
    setShowUpdateAlert(false);
  }, [api, organization]);
  const handleReviewUpdatesClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_7__["default"].activatePanel(_sidebar_types__WEBPACK_IMPORTED_MODULE_14__.SidebarPanelKey.Broadcasts);
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.clicked', {
      organization
    });
  }, [organization]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sdk_updates.seen', {
      organization
    });
    let isUnmounted = false;
    (0,sentry_actionCreators_prompts__WEBPACK_IMPORTED_MODULE_3__.promptsCheck)(api, {
      organizationId: organization.id,
      feature: 'sdk_updates'
    }).then(prompt => {
      if (isUnmounted) {
        return;
      }

      setShowUpdateAlert(!(0,sentry_utils_promptIsDismissed__WEBPACK_IMPORTED_MODULE_9__.promptIsDismissed)(prompt));
    });
    return () => {
      isUnmounted = true;
    };
  }, [api, organization]);

  if (!showUpdateAlert || !((_props$sdkUpdates = props.sdkUpdates) !== null && _props$sdkUpdates !== void 0 && _props$sdkUpdates.length)) {
    return null;
  } // withSdkUpdates explicitly only queries My Projects. This means that when
  // looking at any projects outside of My Projects (like All Projects), this
  // will only show the updates relevant to the to user.


  const projectSpecificUpdates = (selection === null || selection === void 0 ? void 0 : (_selection$projects = selection.projects) === null || _selection$projects === void 0 ? void 0 : _selection$projects.length) === 0 || (selection === null || selection === void 0 ? void 0 : selection.projects[0]) === sentry_constants_pageFilters__WEBPACK_IMPORTED_MODULE_5__.ALL_ACCESS_PROJECTS ? props.sdkUpdates : props.sdkUpdates.filter(update => {
    var _selection$projects2;

    return selection === null || selection === void 0 ? void 0 : (_selection$projects2 = selection.projects) === null || _selection$projects2 === void 0 ? void 0 : _selection$projects2.includes(parseInt(update.projectId, 10));
  }); // Check if we have at least one suggestion out of the list of updates

  if (projectSpecificUpdates.every(v => v.suggestions.length === 0)) {
    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_4__["default"], {
    type: "info",
    showIcon: true,
    className: props.className,
    trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_button__WEBPACK_IMPORTED_MODULE_15__["default"], {
        priority: "link",
        size: "zero",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Dismiss for the next two weeks'),
        onClick: handleSnoozePrompt,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Remind me later')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("span", {
        children: "|"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_button__WEBPACK_IMPORTED_MODULE_15__["default"], {
        priority: "link",
        size: "zero",
        onClick: handleReviewUpdatesClick,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Review updates')
      })]
    }),
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(`You have outdated SDKs in your projects. Update them for important fixes and features.`)
  });
}

InnerGlobalSdkUpdateAlert.displayName = "InnerGlobalSdkUpdateAlert";
const WithSdkUpdatesGlobalSdkUpdateAlert = (0,sentry_utils_withSdkUpdates__WEBPACK_IMPORTED_MODULE_13__["default"])(InnerGlobalSdkUpdateAlert);


/***/ }),

/***/ "./app/components/onboardingPanel.tsx":
/*!********************************************!*\
  !*** ./app/components/onboardingPanel.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function OnboardingPanel(_ref) {
  let {
    className,
    image,
    children
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_1__.Panel, {
    className: className,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IlloBox, {
        children: image
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledBox, {
        children: children
      })]
    })
  });
}

OnboardingPanel.displayName = "OnboardingPanel";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos2"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";position:relative;@media (min-width: ", p => p.theme.breakpoints.small, "){display:flex;align-items:center;flex-direction:row;justify-content:center;flex-wrap:wrap;min-height:300px;max-width:1000px;margin:0 auto;}@media (min-width: ", p => p.theme.breakpoints.medium, "){min-height:350px;}" + ( true ? "" : 0));

const StyledBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e19tujos1"
} : 0)("z-index:1;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:2;}" + ( true ? "" : 0));

const IlloBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(StyledBox,  true ? {
  target: "e19tujos0"
} : 0)("position:relative;min-height:100px;max-width:300px;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(2), " auto;@media (min-width: ", p => p.theme.breakpoints.small, "){flex:1;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(3), ";max-width:auto;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OnboardingPanel);

/***/ }),

/***/ "./app/views/performance/onboarding.tsx":
/*!**********************************************!*\
  !*** ./app/views/performance/onboarding.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PERFORMANCE_TOUR_STEPS": () => (/* binding */ PERFORMANCE_TOUR_STEPS),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_images_spot_performance_empty_state_svg__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry-images/spot/performance-empty-state.svg */ "./images/spot/performance-empty-state.svg");
/* harmony import */ var sentry_images_spot_performance_tour_alert_svg__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry-images/spot/performance-tour-alert.svg */ "./images/spot/performance-tour-alert.svg");
/* harmony import */ var sentry_images_spot_performance_tour_correlate_svg__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry-images/spot/performance-tour-correlate.svg */ "./images/spot/performance-tour-correlate.svg");
/* harmony import */ var sentry_images_spot_performance_tour_metrics_svg__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry-images/spot/performance-tour-metrics.svg */ "./images/spot/performance-tour-metrics.svg");
/* harmony import */ var sentry_images_spot_performance_tour_trace_svg__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry-images/spot/performance-tour-trace.svg */ "./images/spot/performance-tour-trace.svg");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/modals/featureTourModal */ "./app/components/modals/featureTourModal.tsx");
/* harmony import */ var sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/onboardingPanel */ "./app/components/onboardingPanel.tsx");
/* harmony import */ var sentry_components_performanceOnboarding_utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/performanceOnboarding/utils */ "./app/components/performanceOnboarding/utils.tsx");
/* harmony import */ var sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/sidebar/types */ "./app/components/sidebar/types.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/stores/sidebarPanelStore */ "./app/stores/sidebarPanelStore.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/useRouteContext */ "./app/utils/useRouteContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

























const performanceSetupUrl = 'https://docs.sentry.io/performance-monitoring/getting-started/';

const docsLink = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
  external: true,
  href: performanceSetupUrl,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Setup')
});

const PERFORMANCE_TOUR_STEPS = [{
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Track Application Metrics'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_performance_tour_metrics_svg__WEBPACK_IMPORTED_MODULE_8__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Monitor your slowest pageloads and APIs to see which users are having the worst time.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Correlate Errors and Performance'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_performance_tour_correlate_svg__WEBPACK_IMPORTED_MODULE_7__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('See what errors occurred within a transaction and the impact of those errors.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Watch and Alert'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_performance_tour_alert_svg__WEBPACK_IMPORTED_MODULE_6__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Highlight mission-critical pages and APIs and set latency alerts to notify you before things go wrong.')
  }),
  actions: docsLink
}, {
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Trace Across Systems'),
  image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourImage, {
    src: sentry_images_spot_performance_tour_trace_svg__WEBPACK_IMPORTED_MODULE_9__
  }),
  body: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__.TourText, {
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)("Follow a trace from a user's session and drill down to identify any bottlenecks that occur.")
  })
}];

function Onboarding(_ref) {
  var _organization$feature;

  let {
    organization,
    project
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_21__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_22__["default"])();
  const {
    location
  } = (0,sentry_utils_useRouteContext__WEBPACK_IMPORTED_MODULE_23__.useRouteContext)();
  const {
    projectsForOnboarding
  } = (0,sentry_components_performanceOnboarding_utils__WEBPACK_IMPORTED_MODULE_15__.filterProjects)(projects);
  const showOnboardingChecklist = (_organization$feature = organization.features) === null || _organization$feature === void 0 ? void 0 : _organization$feature.includes('performance-onboarding-checklist');
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (showOnboardingChecklist && location.hash === '#performance-sidequest' && projectsForOnboarding.some(p => p.id === project.id)) {
      sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_19__["default"].activatePanel(sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_16__.SidebarPanelKey.PerformanceOnboarding);
    }
  }, [location.hash, projectsForOnboarding, project.id, showOnboardingChecklist]);

  function handleAdvance(step, duration) {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('performance_views.tour.advance', {
      step,
      duration,
      organization
    });
  }

  function handleClose(step, duration) {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('performance_views.tour.close', {
      step,
      duration,
      organization
    });
  }

  const currentPlatform = project.platform;
  const hasPerformanceOnboarding = currentPlatform ? sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_17__.withPerformanceOnboarding.has(currentPlatform) : false;

  let setupButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
    priority: "primary",
    href: "https://docs.sentry.io/performance-monitoring/getting-started/",
    external: true,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Start Setup')
  });

  if (hasPerformanceOnboarding && showOnboardingChecklist) {
    setupButton = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
      priority: "primary",
      onClick: event => {
        event.preventDefault();
        window.location.hash = 'performance-sidequest';
        sentry_stores_sidebarPanelStore__WEBPACK_IMPORTED_MODULE_19__["default"].activatePanel(sentry_components_sidebar_types__WEBPACK_IMPORTED_MODULE_16__.SidebarPanelKey.PerformanceOnboarding);
      },
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Start Checklist')
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_onboardingPanel__WEBPACK_IMPORTED_MODULE_14__["default"], {
    image: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(PerfImage, {
      src: sentry_images_spot_performance_empty_state_svg__WEBPACK_IMPORTED_MODULE_5__
    }),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("h3", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Pinpoint problems')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(ButtonList, {
      gap: 1,
      children: [setupButton, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
        "data-test-id": "create-sample-transaction-btn",
        onClick: async () => {
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('performance_views.create_sample_transaction', {
            platform: project.platform,
            organization
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Processing sample event...'), {
            duration: 15000
          });
          const url = `/projects/${organization.slug}/${project.slug}/create-sample-transaction/`;

          try {
            const eventData = await api.requestPromise(url, {
              method: 'POST'
            });
            react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/organizations/${organization.slug}/performance/${project.slug}:${eventData.eventID}/`);
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.clearIndicators)();
          } catch (error) {
            _sentry_react__WEBPACK_IMPORTED_MODULE_25__.withScope(scope => {
              scope.setExtra('error', error);
              _sentry_react__WEBPACK_IMPORTED_MODULE_25__.captureException(new Error('Failed to create sample event'));
            });
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.clearIndicators)();
            (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Failed to create a new sample event'));
            return;
          }
        },
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('View Sample Transaction')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_modals_featureTourModal__WEBPACK_IMPORTED_MODULE_13__["default"], {
      steps: PERFORMANCE_TOUR_STEPS,
      onAdvance: handleAdvance,
      onCloseModal: handleClose,
      doneUrl: performanceSetupUrl,
      doneText: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Start Setup'),
      children: _ref2 => {
        let {
          showModal
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
          priority: "link",
          onClick: () => {
            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_20__["default"])('performance_views.tour.start', {
              organization
            });
            showModal();
          },
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Take a Tour')
        });
      }
    })]
  });
}

Onboarding.displayName = "Onboarding";

const PerfImage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('img',  true ? {
  target: "eqjjp101"
} : 0)("@media (min-width: ", p => p.theme.breakpoints.small, "){max-width:unset;user-select:none;position:absolute;top:75px;bottom:0;width:450px;margin-top:auto;margin-bottom:auto;}@media (min-width: ", p => p.theme.breakpoints.medium, "){width:480px;}@media (min-width: ", p => p.theme.breakpoints.large, "){width:600px;}" + ( true ? "" : 0));

const ButtonList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "eqjjp100"
} : 0)( true ? {
  name: "xxkxya",
  styles: "grid-template-columns:repeat(auto-fit, minmax(130px, max-content));margin-bottom:16px"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Onboarding);

/***/ }),

/***/ "./images/spot/performance-empty-state.svg":
/*!*************************************************!*\
  !*** ./images/spot/performance-empty-state.svg ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/performance-empty-state.8da0e336a4e99ef87edb.svg";

/***/ }),

/***/ "./images/spot/performance-tour-alert.svg":
/*!************************************************!*\
  !*** ./images/spot/performance-tour-alert.svg ***!
  \************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgNDY4IDczIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA0NjggNzM7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4gPHN0eWxlIHR5cGU9InRleHQvY3NzIj4gLnN0MHtmaWxsOiM1QTRBNzk7fSAuc3Qxe2ZpbGw6bm9uZTtzdHJva2U6I0MxQjJERDtzdHJva2Utd2lkdGg6MS41O3N0cm9rZS1kYXNoYXJyYXk6NCwyO30gLnN0MntmaWxsOm5vbmU7c3Ryb2tlOiMzRTJDNzM7c3Ryb2tlLXdpZHRoOjAuNzU7fSAuc3Qze2ZpbGw6bm9uZTtzdHJva2U6I0ZGNzczODtzdHJva2Utd2lkdGg6MS41O30gLmhpZ2hsaWdodHtmaWxsOiNGRjc3Mzg7c3Ryb2tlOiNGRjc3Mzg7fSAuZG90e2ZpbGw6I0ZGRkZGRjtzdHJva2U6IzNFMkM3MztzdHJva2Utd2lkdGg6MS41O30gLmJsb29wIHt0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXIgY2VudGVyO3RyYW5zZm9ybTogc2NhbGUoMCk7YW5pbWF0aW9uOiBibG9vcCBpbmZpbml0ZSA0cyBlYXNlLWluLW91dCBhbHRlcm5hdGU7fSAubGluZXtmaWxsOm5vbmU7c3Ryb2tlOiMzRTJDNzM7c3Ryb2tlLXdpZHRoOjEuNTtzdHJva2UtbGluZWpvaW46IGJldmVsO3N0cm9rZS1taXRlcmxpbWl0OiAxMDtzdHJva2UtZGFzaGFycmF5OiA2MDA7YW5pbWF0aW9uOiBkcmF3bGluZSBpbmZpbml0ZSA0cyBlYXNlLWluLW91dCBhbHRlcm5hdGU7fSBAa2V5ZnJhbWVzIGRyYXdsaW5lIHtmcm9tIHtzdHJva2UtZGFzaG9mZnNldDogLTU1MDt9dG8ge3N0cm9rZS1kYXNob2Zmc2V0OiAwO319IEBrZXlmcmFtZXMgYmxvb3AgezAlLCA0OCUge3RyYW5zZm9ybTogc2NhbGUoMCk7fTUwJSB7dHJhbnNmb3JtOiBzY2FsZSgxLjIpO301MiUsIDEwMCUge3RyYW5zZm9ybTogc2NhbGUoMSk7fX0gPC9zdHlsZT4gPGcgaWQ9ImJhY2tncm91bmQiPiA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDM0LjUsMzRoMzFjMC44LDAsMS41LDAuNywxLjUsMS41cy0wLjcsMS41LTEuNSwxLjVoLTMxYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVTNDMzLjcsMzQsNDM0LjUsMzR6Ii8+IDxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik00NjcsNDFMMSw0MyIvPiA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDM0LjUsMTdoMzFjMC44LDAsMS41LDAuNywxLjUsMS41cy0wLjcsMS41LTEuNSwxLjVoLTMxYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVTNDMzLjcsMTcsNDM0LjUsMTd6Ii8+IDxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik00NjcsMjRMMSwyNiIvPiA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDM0LjUsMGgzMWMwLjgsMCwxLjUsMC43LDEuNSwxLjVTNDY2LjMsMyw0NjUuNSwzaC0zMWMtMC44LDAtMS41LTAuNy0xLjUtMS41UzQzMy43LDAsNDM0LjUsMHoiLz4gPHBhdGggY2xhc3M9InN0MSIgZD0iTTQ2Nyw3TDEsOSIvPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNNDY1LDcxTDEsNzIiLz4gPHBhdGggY2xhc3M9InN0MyIgZD0iTTEsNzBsNDY2LDIiLz4gPC9nPiA8ZyBpZD0iaGlnaGxpZ2h0Ij4gPGNpcmNsZSBpZD0iaGlnaGxpZ2h0IiBjbGFzcz0iaGlnaGxpZ2h0IGJsb29wIiBjeD0iMjMyLjUiIGN5PSIzMi41IiByPSIxNCIvPiA8L2c+IDxnIGlkPSJsaW5lIj4gPHBhdGggaWQ9ImxpbmUiIGNsYXNzPSJsaW5lIiBkPSJNNDY3LDY0LjFoLTYuMWwtNS43LDAuN2gtMC42bC01LjQtMWgtMC43bC00LjUsMC44Yy0wLjcsMC4xLTEuNS0wLjEtMS45LTAuN2wtNC40LTUuNCBjLTAuNS0wLjctMS40LTAuOS0yLjItMC42bC00LjcsMS43bC00LjgsMi4yYy0wLjgsMC40LTEuNywwLjItMi4zLTAuNGwtNS4xLTUuMmwtNS4zLTQuOWMtMC40LTAuNC0xLjEtMC42LTEuNy0wLjVsLTQuOSwwLjdoLTAuMyBsLTUuOS0wLjFsLTYuMSwwLjFsLTYuMS0wLjdsLTYuMSwwLjFsLTUuOS0wLjRjLTAuMSwwLTAuMywwLTAuNC0wLjFsLTUuMy0xLjVjLTAuMy0wLjEtMC43LTAuMy0wLjktMC41bC01LjQtNS41IGMtMC4yLTAuMi0wLjQtMC4zLTAuNi0wLjRsLTQuMi0xLjhjLTAuOS0wLjQtMS45LTAuMS0yLjQsMC43bC00LjEsNS45Yy0wLjYsMC45LTEuOCwxLjEtMi43LDAuNmwtNC4zLTIuNiBjLTAuMS0wLjEtMC4yLTAuMS0wLjMtMC4ybC01LjctNC45Yy0wLjEtMC4xLTAuMy0wLjItMC41LTAuM2wtNC41LTIuMWMtMC44LTAuNC0xLjctMC4yLTIuMiwwLjRsLTQuOSw0LjggYy0wLjEsMC4xLTAuMiwwLjItMC40LDAuM2wtNS42LDMuNGMtMC4xLDAuMS0wLjMsMC4xLTAuNCwwLjJsLTUuNiwxLjhjLTAuMSwwLTAuMywwLjEtMC40LDAuMWwtNS43LDAuNmgtMC40bC01LjYtMC40aC0wLjUgbC00LjUsMC44Yy0wLjgsMC4xLTEuNi0wLjItMi0wLjlsLTQuNi02LjljLTAuNC0wLjctMS4yLTEtMi0wLjlsLTQuOCwwLjhsLTUuNywxLjZsLTAuNiwwLjNsLTUuNSwzLjhsLTAuNiwwLjNsLTUuNCwxLjMgYy0wLjIsMC4xLTAuNCwwLjEtMC43LDAuMWwtNS43LTAuNWwtNS40LTAuOWMtMC40LTAuMS0wLjksMC0xLjIsMC4ybC00LjYsMi40Yy0wLjUsMC4zLTEuMiwwLjMtMS43LDBsLTQuOC0yLjIgYy0wLjMtMC4xLTAuNS0wLjMtMC43LTAuNWwtNS42LTYuNmMtMC4xLTAuMS0wLjItMC4yLTAuMi0wLjNsLTMuOC02LjhjLTAuOC0xLjUtMy4xLTEuMy0zLjYsMC4zbC0zLjEsOS4yIGMtMC42LDEuNy0yLjksMS45LTMuNywwLjNsLTEuNS0yLjljLTAuOC0xLjYtMy4yLTEuNC0zLjcsMC40TDIxMyw1Ny45Yy0wLjEsMC4zLTAuMiwwLjYtMC41LDAuOGwtNSw1LjRjLTAuNCwwLjUtMS4xLDAuNy0xLjgsMC42IEwyMDEsNjRoLTAuNmwtNS41LDAuOWgtMC41bC01LjgtMC40bC01LjgtMC44aC0wLjVsLTUuNSwwLjdoLTAuNWwtNS41LTAuN2gtMC42bC01LjUsMWgtMC41bC01LjgtMC4zbC01LTAuMSBjLTAuNywwLTEuMy0wLjQtMS43LTAuOWwtNC02LjRjLTAuNy0xLjItMi40LTEuMy0zLjMtMC4ybC00LDQuOWMtMC4yLDAuMi0wLjQsMC40LTAuNywwLjZsLTUuMiwyLjRjLTAuMywwLjEtMC41LDAuMi0wLjgsMC4yIGwtNS42LDAuMUgxMjJsLTYuMS0wLjFsLTYuMS0wLjVsLTUuOC0wLjhoLTAuNWwtNS44LDAuN2wtNi4xLDAuM2wtNi4xLDAuMWwtNS0wLjdjLTAuNS0wLjEtMS0wLjMtMS40LTAuOGwtNC40LTUuOCBjLTAuNy0wLjktMS45LTEuMS0yLjgtMC40bC00LjUsMy4zbC01LjUsMy44Yy0wLjQsMC4zLTAuOCwwLjQtMS4zLDAuNGwtNS4yLTAuNGgtMC4zbC01LjktMS4zbC01LjgtMS4yYy0wLjIsMC0wLjQtMC4xLTAuNiwwIEwzNy4zLDYybC02LjEsMC41bC02LjEtMC4zTDE5LDYxLjlsLTUuOCwwLjRoLTAuNUw4LDYxLjRjLTAuNi0wLjEtMS4xLTAuNS0xLjQtMS4xTDEsNDkuNSIvPiA8L2c+IDxnIGlkPSJkb3QiPiA8Y2lyY2xlIGlkPSJkb3QiIGNsYXNzPSJkb3QgYmxvb3AiIGN4PSIyMzIuNSIgY3k9IjMyLjUiIHI9IjIuOCIvPiA8L2c+IDwvc3ZnPgo=";

/***/ }),

/***/ "./images/spot/performance-tour-correlate.svg":
/*!****************************************************!*\
  !*** ./images/spot/performance-tour-correlate.svg ***!
  \****************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDI4OCAxNTgiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4OCAxNTg7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4gPHN0eWxlIHR5cGU9InRleHQvY3NzIj4gLnN0MHtmaWxsOiNGRkZGRkY7fSAuc3Qxe2ZpbGw6I0VERTdGNTt9IC5zdDJ7ZmlsbDojQzFCMkREO30gLmJhcntmaWxsOiMzRTJDNzM7fSAuc3Q0e2ZpbGw6bm9uZTtzdHJva2U6IzNFMkM3MztzdHJva2Utd2lkdGg6MC43NTt9IC5zdDV7ZmlsbDpub25lO3N0cm9rZTojRkY3NzM4O3N0cm9rZS13aWR0aDoxLjU7fSAuc3Q2e2ZpbGw6IzVBNEE3OTt9IC5zdDd7ZmlsbDojRkY3NzM4O30gPC9zdHlsZT4gPGcgaWQ9ImNhcmRfMSI+IDxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0yMTksMTA5LjJMMjE4LjEsNWMwLTEuMS0wLjktMi0yLTJINy4xYy0xLjEsMC0yLDAuOS0yLDJMNCwxMTBjMCwxLjEsMC45LDIsMiwybDIxMS0wLjggQzIxOC4xLDExMS4yLDIxOSwxMTAuMywyMTksMTA5LjJ6Ii8+IDxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0wLDM0aDIyNHY1MkgwVjM0eiIvPiA8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMjAwLDEyYzQuNCwwLDgsMy42LDgsOHMtMy42LDgtOCw4cy04LTMuNi04LThTMTk1LjYsMTIsMjAwLDEyeiIvPiA8cGF0aCBjbGFzcz0iYmFyIiBkPSJNNDEuNSwxOGgxMDJjMC44LDAsMS41LDAuNywxLjUsMS41cy0wLjcsMS41LTEuNSwxLjVoLTEwMmMtMC44LDAtMS41LTAuNy0xLjUtMS41UzQwLjcsMTgsNDEuNSwxOHoiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTE5LDk5aDI4YzAuNiwwLDEsMC40LDEsMXMtMC40LDEtMSwxSDE5Yy0wLjYsMC0xLTAuNC0xLTFTMTguNCw5OSwxOSw5OXogTTU0LDk5aDY4YzAuNiwwLDEsMC40LDEsMSBzLTAuNCwxLTEsMUg1NGMtMC42LDAtMS0wLjQtMS0xUzUzLjQsOTksNTQsOTl6Ii8+IDxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yMTksMTA5LjNMMjE4LjEsNC45YzAtMS4xLTAuOS0yLTItMkg3LjFjLTEuMSwwLTIsMC45LTIsMkw0LDExMC4xYzAsMS4xLDAuOSwyLDIsMmwyMTEtMC44IEMyMTguMSwxMTEuMywyMTksMTEwLjQsMjE5LDEwOS4zeiIvPiA8cGF0aCBjbGFzcz0ic3Q1IiBkPSJNMywxMDkuNEwyLDNjMC0xLjEsMC45LTIsMi0yaDIxNC40YzEuMSwwLDIsMC45LDIsMmwwLjUsMTA5YzAsMS4xLTAuOSwyLTIsMkw1LDExMS40IEMzLjksMTExLjQsMywxMTAuNSwzLDEwOS40eiIvPiA8cGF0aCBjbGFzcz0ic3Q2IiBkPSJNMTksMTNoMTBjMS4xLDAsMiwwLjksMiwydjEwYzAsMS4xLTAuOSwyLTIsMkgxOWMtMS4xLDAtMi0wLjktMi0yVjE1QzE3LDEzLjksMTcuOSwxMywxOSwxM3oiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTE3LDExLjRoMTBjMC45LDAsMS42LDAuNywxLjYsMS42djEwYzAsMC45LTAuNywxLjYtMS42LDEuNkgxN2MtMC45LDAtMS42LTAuNy0xLjYtMS42VjEzIEMxNS40LDEyLjEsMTYuMSwxMS40LDE3LDExLjR6IE0xOTgsMTEuNGM0LjIsMCw3LjYsMy40LDcuNiw3LjZzLTMuNCw3LjYtNy42LDcuNmMtNC4yLDAtNy42LTMuNC03LjYtNy42UzE5My44LDExLjQsMTk4LDExLjR6Ii8+IDxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0xODksMTJjNC40LDAsOCwzLjYsOCw4cy0zLjYsOC04LDhzLTgtMy42LTgtOFMxODQuNiwxMiwxODksMTJ6Ii8+IDxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0xODcsMTEuNGM0LjIsMCw3LjYsMy40LDcuNiw3LjZzLTMuNCw3LjYtNy42LDcuNmMtNC4yLDAtNy42LTMuNC03LjYtNy42UzE4Mi44LDExLjQsMTg3LDExLjR6Ii8+IDwvZz4gPGc+IDxyZWN0IHg9IjE1IiB5PSI4NCIgY2xhc3M9ImJhciIgd2lkdGg9IjgiIGhlaWdodD0iNCIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDE5IDg2KSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iaGVpZ2h0IiBkdXI9IjRzIiB2YWx1ZXM9IjQ7MTA7NCIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+IDxyZWN0IHg9IjI4IiB5PSI4MCIgY2xhc3M9ImJhciIgd2lkdGg9IjgiIGhlaWdodD0iOCI+PC9yZWN0PiA8cmVjdCB4PSI0MSIgeT0iNzgiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjEwIiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgNDUgODMpIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJoZWlnaHQiIGR1cj0iNHMiIHZhbHVlcz0iMTA7MjA7MTAiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PiA8cmVjdCB4PSI1NCIgeT0iNzUiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjEzIiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgNTggODEuNSkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9ImhlaWdodCIgZHVyPSI0cyIgdmFsdWVzPSIxMzs0OzEzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD4gPC9nPiA8ZyBpZD0iY2FyZF8yIj4gPHBhdGggY2xhc3M9InN0MCIgZD0iTTI4MywxNTIuMkwyODIuMSw0OGMwLTEuMS0wLjktMi0yLTJoLTIwOWMtMS4xLDAtMiwwLjktMiwyTDY4LDE1M2MwLDEuMSwwLjksMiwyLDJsMjExLTAuOCBDMjgyLjEsMTU0LjIsMjgzLDE1My4zLDI4MywxNTIuMnoiLz4gPHBhdGggY2xhc3M9InN0MSIgZD0iTTY0LDc3aDIyNHY1Mkg2NFY3N3oiLz4gPHBhdGggY2xhc3M9InN0MiIgZD0iTTI2NCw1NWM0LjQsMCw4LDMuNiw4LDhzLTMuNiw4LTgsOHMtOC0zLjYtOC04UzI1OS42LDU1LDI2NCw1NXoiLz4gPHBhdGggY2xhc3M9ImJhciIgZD0iTTEwNS41LDYxaDEwMmMwLjgsMCwxLjUsMC43LDEuNSwxLjVzLTAuNywxLjUtMS41LDEuNWgtMTAyYy0wLjgsMC0xLjUtMC43LTEuNS0xLjVTMTA0LjcsNjEsMTA1LjUsNjF6Ii8+IDxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik04MywxNDJoMjhjMC42LDAsMSwwLjQsMSwxcy0wLjQsMS0xLDFIODNjLTAuNiwwLTEtMC40LTEtMVM4Mi40LDE0Miw4MywxNDJ6IE0xMTgsMTQyaDY4YzAuNiwwLDEsMC40LDEsMSBzLTAuNCwxLTEsMWgtNjhjLTAuNiwwLTEtMC40LTEtMVMxMTcuNCwxNDIsMTE4LDE0MnoiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTI4MywxNTIuM2wtMC45LTEwNC40YzAtMS4xLTAuOS0yLTItMmgtMjA5Yy0xLjEsMC0yLDAuOS0yLDJMNjgsMTUzLjFjMCwxLjEsMC45LDIsMiwybDIxMS0wLjggQzI4Mi4xLDE1NC4zLDI4MywxNTMuNCwyODMsMTUyLjN6Ii8+IDxwYXRoIGNsYXNzPSJzdDUiIGQ9Ik02NywxNTIuNEw2Niw0NmMwLTEuMSwwLjktMiwyLTJoMjE0LjRjMS4xLDAsMiwwLjksMiwybDAuNSwxMDljMCwxLjEtMC45LDItMiwybC0yMTQtMi42IEM2Ny45LDE1NC40LDY3LDE1My41LDY3LDE1Mi40eiIvPiA8cGF0aCBjbGFzcz0ic3Q3IiBkPSJNODMsNTZoMTBjMS4xLDAsMiwwLjksMiwydjEwYzAsMS4xLTAuOSwyLTIsMkg4M2MtMS4xLDAtMi0wLjktMi0yVjU4QzgxLDU2LjksODEuOSw1Niw4Myw1NnoiLz4gPHBhdGggY2xhc3M9InN0NCIgZD0iTTgxLDU0LjRoMTBjMC45LDAsMS42LDAuNywxLjYsMS42djEwYzAsMC45LTAuNywxLjYtMS42LDEuNkg4MWMtMC45LDAtMS42LTAuNy0xLjYtMS42VjU2IEM3OS40LDU1LjEsODAuMSw1NC40LDgxLDU0LjR6IE0yNjIsNTQuNGM0LjIsMCw3LjYsMy40LDcuNiw3LjZzLTMuNCw3LjYtNy42LDcuNnMtNy42LTMuNC03LjYtNy42UzI1Ny44LDU0LjQsMjYyLDU0LjR6Ii8+IDwvZz4gPGc+IDxyZWN0IHg9IjgwIiB5PSIxMTYiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgODQgMTIzLjUpIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJoZWlnaHQiIGR1cj0iNHMiIHZhbHVlcz0iMTU7MTA7MTUiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PiA8cmVjdCB4PSI5MyIgeT0iMTIzIiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgaGVpZ2h0PSI4Ij48L3JlY3Q+IDxyZWN0IHg9IjEwNiIgeT0iMTEwIiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDExMCAxMjAuNSkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9ImhlaWdodCIgZHVyPSI0cyIgdmFsdWVzPSIyMTszMDsyMSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+IDxyZWN0IHg9IjExOSIgeT0iMTEzIiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDEyMyAxMjIpIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJoZWlnaHQiIGR1cj0iNHMiIHZhbHVlcz0iMTg7MTA7MTgiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PiA8cmVjdCB4PSIxMzIiIHk9Ijk5IiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgaGVpZ2h0PSIzMiIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDEzNiAxMTUpIj48L3JlY3Q+IDxyZWN0IHg9IjE1OCIgeT0iOTkiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgMTYyIDExNSkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9ImhlaWdodCIgZHVyPSI0cyIgdmFsdWVzPSIzMjs0MDszMiIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+IDxyZWN0IHg9IjE0NSIgeT0iODQiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgMTQ5IDEwNy41KSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iaGVpZ2h0IiBkdXI9IjRzIiB2YWx1ZXM9IjQ3OzM1OzQ3IiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD4gPHJlY3QgeD0iMTcxIiB5PSIxMTAiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjIxIj48L3JlY3Q+IDxyZWN0IHg9IjE4NCIgeT0iODYiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjQ1IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgMTg4IDEwOC41KSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iaGVpZ2h0IiBkdXI9IjRzIiB2YWx1ZXM9IjQ1OzUwOzQ1IiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD4gPHJlY3QgeD0iMTk3IiB5PSIxMTMiIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjE4Ij48L3JlY3Q+IDxyZWN0IHg9IjIxMCIgeT0iMTA1IiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgaGVpZ2h0PSIyNiIgdHJhbnNmb3JtPSJyb3RhdGUoMTgwIDIxNCAxMTgpIj48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJoZWlnaHQiIGR1cj0iNHMiIHZhbHVlcz0iMjY7MzA7MjYiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PiA8cmVjdCB4PSIyMjMiIHk9IjEyMyIgY2xhc3M9ImJhciIgd2lkdGg9IjgiIGhlaWdodD0iOCI+PC9yZWN0PiA8cmVjdCB4PSIyMzYiIHk9IjExMSIgY2xhc3M9ImJhciIgd2lkdGg9IjgiIGhlaWdodD0iMjAiIHRyYW5zZm9ybT0icm90YXRlKDE4MCAyNDAgMTIxKSI+PGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iaGVpZ2h0IiBkdXI9IjRzIiB2YWx1ZXM9IjIwOzI2OzIwIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPjwvcmVjdD4gPHJlY3QgeD0iMjQ5IiB5PSIxMDciIGNsYXNzPSJiYXIiIHdpZHRoPSI4IiBoZWlnaHQ9IjI0IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgMjUzIDExOSkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9ImhlaWdodCIgZHVyPSI0cyIgdmFsdWVzPSIyNDszMDsyNCIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3JlY3Q+IDxyZWN0IHg9IjI2MiIgeT0iMTI3IiBjbGFzcz0iYmFyIiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiB0cmFuc2Zvcm09InJvdGF0ZSgxODAgMjY2IDEyOSkiPjxhbmltYXRlIGF0dHJpYnV0ZU5hbWU9ImhlaWdodCIgZHVyPSI0cyIgdmFsdWVzPSI0OzIwOzQiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9yZWN0PiA8L2c+IDwvc3ZnPgo=";

/***/ }),

/***/ "./images/spot/performance-tour-metrics.svg":
/*!**************************************************!*\
  !*** ./images/spot/performance-tour-metrics.svg ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/performance-tour-metrics.1d314da32bef6efd9752.svg";

/***/ }),

/***/ "./images/spot/performance-tour-trace.svg":
/*!************************************************!*\
  !*** ./images/spot/performance-tour-trace.svg ***!
  \************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjkxIDE0NyIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMjkxIDE0NzsiIHhtbDpzcGFjZT0icHJlc2VydmUiPiA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPiAuc3Bhbi1vcmFuZ2V7ZmlsbDojRkY3NzM4O30gLnNwYW4tcHVycGxle2ZpbGw6IzVBNEE3OTt9IC50cmVle2ZpbGw6IzVBNEE3OTt9IC5ib3JkZXItcHVycGxle2ZpbGw6bm9uZTtzdHJva2U6IzNFMkM3MztzdHJva2Utd2lkdGg6MC43NTt9IC5ib3JkZXItb3Jhbmdle2ZpbGw6bm9uZTtzdHJva2U6I0ZGNzczODtzdHJva2Utd2lkdGg6MS41O30gLnJvd3tmaWxsOiNFREU3RjU7fSAucm93LWFjdGl2ZSB7YW5pbWF0aW9uOiByb3dEYXJrZW4gNHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7fSAudHJlZS1hY3RpdmUge2FuaW1hdGlvbjogdHJlZUxpZ2h0ZW4gNHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7fSAuY2xpY2sge3RyYW5zZm9ybS1vcmlnaW46IGJvdHRvbSBjZW50ZXI7YW5pbWF0aW9uOiBjbGlja2VkIDRzIGluZmluaXRlIGVhc2UtaW4tb3V0O30gLmJvcmRlcnMgcGF0aHthbmltYXRpb246IGJvcmRlckxlbmd0aGVuIDRzIGluZmluaXRlIGVhc2UtaW4tb3V0O30gLmRpdmlkZXJ7ZmlsbDpub25lO3N0cm9rZTojM0UyQzczO3N0cm9rZS13aWR0aDowLjc1O2FuaW1hdGlvbjogZGl2aWRlclNob3J0ZW4gNHMgaW5maW5pdGUgZWFzZS1pbi1vdXQ7fSBAa2V5ZnJhbWVzIHJvd0RhcmtlbiB7MCUsIDI2JSB7ZmlsbDojRkZGRkZGO30zMCUsIDkwJSB7ZmlsbDojMzAyODM5O30xMDAlIHtmaWxsOiNGRkZGRkY7fX0gQGtleWZyYW1lcyB0cmVlTGlnaHRlbiB7MCUsIDI1JSB7ZmlsbDojNUE0QTc5O30zMCUsIDkwJSB7ZmlsbDojRkZGRkZGO30xMDAlIHtmaWxsOiM1QTRBNzk7fX0gQGtleWZyYW1lcyBjbGlja2VkIHswJSwgMjQlIHt0cmFuc2Zvcm06IHNjYWxlWSgxKTt9MjUle3RyYW5zZm9ybTogdHJhbnNsYXRlWSgtMXB4KSBzY2FsZVkoMC45NSk7fTMwJSwgODUlIHt0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCkgc2NhbGVZKDEpO304NiUge3RyYW5zZm9ybTogdHJhbnNsYXRlWSgtMXB4KSBzY2FsZVkoMC45NSk7fTkwJSwgMTAwJSB7dHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApIHNjYWxlWSgxKTt9fSBAa2V5ZnJhbWVzIGRpdmlkZXJTaG9ydGVuIHsyNiUge3RyYW5zZm9ybTogc2NhbGVZKDEpO30zNSUsIDg2JSB7dHJhbnNmb3JtOiBzY2FsZVkoMC44Nyk7fTEwMCUge3RyYW5zZm9ybTogc2NhbGVZKDEpO319IEBrZXlmcmFtZXMgYm9yZGVyTGVuZ3RoZW4gezI2JSB7dHJhbnNmb3JtOiBzY2FsZVkoMSk7fTQwJSwgODYlIHt0cmFuc2Zvcm06IHNjYWxlWSgxLjIpO30xMDAlIHt0cmFuc2Zvcm06IHNjYWxlWSgxKTt9fSA8L3N0eWxlPiA8ZyBpZD0icm93LWluYWN0aXZlIj4gPHBhdGggY2xhc3M9InJvdyIgZD0iTTgxLDY1aDIxMHY4SDgxVjY1eiIvPiA8cGF0aCBjbGFzcz0icm93IiBkPSJNODEsNDloMjEwdjhIODFWNDl6Ii8+IDxwYXRoIGNsYXNzPSJyb3ciIGQ9Ik04MSwzM2gyMTB2OEg4MVYzM3oiLz4gPHBhdGggY2xhc3M9InJvdyIgZD0iTTgxLDE3aDIxMHY4SDgxVjE3eiIvPiA8cGF0aCBjbGFzcz0icm93IiBkPSJNODEsOTdoMjEwdjhIODFWOTd6Ii8+IDxwYXRoIGNsYXNzPSJyb3ciIGQ9Ik04MSw4MWgyMTB2OEg4MVY4MXoiLz4gPC9nPiA8ZyBpZD0ic3Bhbi1pbmFjdGl2ZSI+IDxyZWN0IHg9IjgxIiB5PSI5IiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiLz4gPHJlY3QgeD0iODkiIHk9IjE3IiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSIxNiIgaGVpZ2h0PSI4Ii8+IDxyZWN0IHg9IjEwNSIgeT0iMjUiIGNsYXNzPSJzcGFuLW9yYW5nZSIgd2lkdGg9IjMzIiBoZWlnaHQ9IjgiLz4gPHJlY3QgeD0iMTU5IiB5PSI0OSIgY2xhc3M9InNwYW4tb3JhbmdlIiB3aWR0aD0iMTgiIGhlaWdodD0iOCIvPiA8cmVjdCB4PSIxMzgiIHk9IjMzIiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSI3IiBoZWlnaHQ9IjgiLz4gPHJlY3QgeD0iMTQ1IiB5PSI0MSIgY2xhc3M9InNwYW4tcHVycGxlIiB3aWR0aD0iMTQiIGhlaWdodD0iOCIvPiA8cmVjdCB4PSIxNzciIHk9IjU3IiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSIzIiBoZWlnaHQ9IjgiLz4gPHJlY3QgeD0iMTgwIiB5PSI2NSIgY2xhc3M9InNwYW4tcHVycGxlIiB3aWR0aD0iMzAiIGhlaWdodD0iOCIvPiA8cmVjdCB4PSIyMTAiIHk9IjczIiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSIyIiBoZWlnaHQ9IjgiLz4gPHJlY3QgeD0iMjEyIiB5PSI4MSIgY2xhc3M9InNwYW4tcHVycGxlIiB3aWR0aD0iMiIgaGVpZ2h0PSI4Ii8+IDxyZWN0IHg9IjIxNCIgeT0iODkiIGNsYXNzPSJzcGFuLXB1cnBsZSIgd2lkdGg9IjgiIGhlaWdodD0iOCIvPiA8cmVjdCB4PSIyMjIiIHk9Ijk3IiBjbGFzcz0ic3Bhbi1wdXJwbGUiIHdpZHRoPSI1IiBoZWlnaHQ9IjgiLz4gPC9nPiA8ZyBpZD0idHJlZS1pbmFjdGl2ZSI+IDxwYXRoIGNsYXNzPSJ0cmVlIiBkPSJNMTIsMTJoNDNjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMTJjLTAuNiwwLTEtMC40LTEtMWwwLDBDMTEsMTIuNCwxMS40LDEyLDEyLDEyeiIvPiA8cGF0aCBjbGFzcz0idHJlZSIgZD0iTTIwLDI4aDI2YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDIwYy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE5LDI4LjQsMTkuNCwyOCwyMCwyOHoiLz4gPHBhdGggY2xhc3M9InRyZWUiIGQ9Ik0yMCwzNmgzM2MwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgyMGMtMC42LDAtMS0wLjQtMS0xbDAsMEMxOSwzNi40LDE5LjQsMzYsMjAsMzZ6Ii8+IDxwYXRoIGNsYXNzPSJ0cmVlIiBkPSJNMjAsNDRoNDFjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMjBjLTAuNiwwLTEtMC40LTEtMWwwLDBDMTksNDQuNCwxOS40LDQ0LDIwLDQ0eiIvPiA8cGF0aCBjbGFzcz0idHJlZSIgZD0iTTIwLDUyaDI4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDIwYy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE5LDUyLjQsMTkuNCw1MiwyMCw1MnoiLz4gPHBhdGggY2xhc3M9InRyZWUiIGQ9Ik0yMCw2MGg0MWMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgyMGMtMC42LDAtMS0wLjQtMS0xbDAsMEMxOSw2MC40LDE5LjQsNjAsMjAsNjB6Ii8+IDxwYXRoIGNsYXNzPSJ0cmVlIiBkPSJNMjAsMjBoMzdjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMjBjLTAuNiwwLTEtMC40LTEtMWwwLDBDMTksMjAuNCwxOS40LDIwLDIwLDIweiIvPiA8cGF0aCBjbGFzcz0idHJlZSIgZD0iTTIwLDY4aDMyYzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDIwYy0wLjYsMC0xLTAuNC0xLTFsMCwwQzE5LDY4LjQsMTkuNCw2OCwyMCw2OHoiLz4gPHBhdGggY2xhc3M9InRyZWUiIGQ9Ik0yOSw3NmgzM2MwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgyOWMtMC42LDAtMS0wLjQtMS0xbDAsMEMyOCw3Ni40LDI4LjQsNzYsMjksNzZ6Ii8+IDxwYXRoIGNsYXNzPSJ0cmVlIiBkPSJNMjksODRoMzdjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMjljLTAuNiwwLTEtMC40LTEtMWwwLDBDMjgsODQuNCwyOC40LDg0LDI5LDg0eiIvPiA8cGF0aCBjbGFzcz0idHJlZSIgZD0iTTI5LDkyaDI4YzAuNiwwLDEsMC40LDEsMWwwLDBjMCwwLjYtMC40LDEtMSwxSDI5Yy0wLjYsMC0xLTAuNC0xLTFsMCwwQzI4LDkyLjQsMjguNCw5MiwyOSw5MnoiLz4gPHBhdGggY2xhc3M9InRyZWUiIGQ9Ik0yOSwxMDBoNDFjMC42LDAsMSwwLjQsMSwxbDAsMGMwLDAuNi0wLjQsMS0xLDFIMjljLTAuNiwwLTEtMC40LTEtMWwwLDBDMjgsMTAwLjQsMjguNCwxMDAsMjksMTAweiIvPiA8L2c+IDxnIGlkPSJjbGljayIgY2xhc3M9ImNsaWNrIj4gPHJlY3QgY2xhc3M9InJvdyByb3ctYWN0aXZlIiB4PSIzIiB5PSIxMDUiIHdpZHRoPSIyODciIGhlaWdodD0iOCIvPiA8cGF0aCBjbGFzcz0idHJlZSB0cmVlLWFjdGl2ZSIgZD0iTTI5LDEwOGg0MWMwLjYsMCwxLDAuNCwxLDFsMCwwYzAsMC42LTAuNCwxLTEsMUgyOWMtMC42LDAtMS0wLjQtMS0xbDAsMEMyOCwxMDguNCwyOC40LDEwOCwyOSwxMDh6Ii8+IDxyZWN0IGNsYXNzPSJzcGFuLW9yYW5nZSIgeD0iMjI3IiB5PSIxMDUiIHdpZHRoPSI2MCIgaGVpZ2h0PSI4Ii8+IDwvZz4gPGxpbmUgY2xhc3M9ImRpdmlkZXIiIHgxPSI4MS40IiB5MT0iMyIgeDI9IjgxLjQiIHkyPSIxMjIiLz4gPGcgaWQ9ImJvcmRlcnMiIGNsYXNzPSJib3JkZXJzIj4gPHBhdGggY2xhc3M9ImJvcmRlci1vcmFuZ2UiIGQ9Ik0yODksMTIyTDI4OCwxSDEuN0wxLDEyMS4xTDI4OSwxMjJ6Ii8+IDxwYXRoIGNsYXNzPSJib3JkZXItcHVycGxlIiBkPSJNMy43LDExOC45TDMsM2wyODMuNSwwLjJMMjg3LDEyMEwzLjcsMTE4Ljl6Ii8+IDwvZz4gPC9zdmc+Cg==";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_globalSdkUpdateAlert_tsx-app_views_performance_onboarding_tsx.01c2c28650a73581a015e5d10422a046.js.map