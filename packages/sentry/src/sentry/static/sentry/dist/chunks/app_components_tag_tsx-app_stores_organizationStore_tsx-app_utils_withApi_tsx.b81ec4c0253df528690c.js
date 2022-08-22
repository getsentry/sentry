"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_tag_tsx-app_stores_organizationStore_tsx-app_utils_withApi_tsx"],{

/***/ "./app/actions/organizationActions.tsx":
/*!*********************************************!*\
  !*** ./app/actions/organizationActions.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const OrganizationActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['reset', 'fetchOrgError', 'update']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationActions);

/***/ }),

/***/ "./app/components/tag.tsx":
/*!********************************!*\
  !*** ./app/components/tag.tsx ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Background": () => (/* binding */ Background),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const TAG_HEIGHT = '20px';

function Tag(_ref) {
  let {
    type = 'default',
    icon,
    tooltipText,
    to,
    onClick,
    href,
    onDismiss,
    children,
    textMaxWidth = 150,
    ...props
  } = _ref;
  const iconsProps = {
    size: '11px',
    color: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_12__["default"].tag[type].iconColor
  };

  const tag = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: tooltipText,
    containerDisplayMode: "inline-flex",
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Background, {
      type: type,
      children: [tagIcon(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Text, {
        type: type,
        maxWidth: textMaxWidth,
        children: children
      }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(onDismiss) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DismissButton, {
        onClick: handleDismiss,
        size: "zero",
        priority: "link",
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Dismiss'),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconClose, {
          isCircled: true,
          ...iconsProps
        })
      })]
    })
  });

  function handleDismiss(event) {
    event.preventDefault();
    onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
  }

  const trackClickEvent = () => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_11__["default"])('tag.clicked', {
      is_clickable: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(onClick) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(to) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(href),
      organization: null
    });
  };

  function tagIcon() {
    if ( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.isValidElement)(icon)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(IconWrapper, {
        children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.cloneElement)(icon, { ...iconsProps
        })
      });
    }

    if (((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(href) || (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(to)) && icon === undefined) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(IconWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconOpen, { ...iconsProps
        })
      });
    }

    return null;
  }

  function tagWithParent() {
    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(href)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
        href: href,
        children: tag
      });
    }

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(to) && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(onClick)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: to,
        onClick: onClick,
        children: tag
      });
    }

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(to)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: to,
        children: tag
      });
    }

    return tag;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(TagWrapper, { ...props,
    onClick: trackClickEvent,
    children: tagWithParent()
  });
}

Tag.displayName = "Tag";

const TagWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e8jgvoh4"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const Background = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8jgvoh3"
} : 0)("display:inline-flex;align-items:center;height:", TAG_HEIGHT, ";border-radius:", TAG_HEIGHT, ";background-color:", p => p.theme.tag[p.type].background, ";border:solid 1px ", p => p.theme.tag[p.type].border, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e8jgvoh2"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";display:inline-flex;" + ( true ? "" : 0));

const Text = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e8jgvoh1"
} : 0)("color:", p => ['black', 'white'].includes(p.type) ? p.theme.tag[p.type].iconColor : p.theme.textColor, ";max-width:", p => p.maxWidth, "px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:", TAG_HEIGHT, ";" + ( true ? "" : 0));

const DismissButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e8jgvoh0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(0.5), ";border:none;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Tag);

/***/ }),

/***/ "./app/stores/organizationStore.tsx":
/*!******************************************!*\
  !*** ./app/stores/organizationStore.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/organizationActions */ "./app/actions/organizationActions.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");





const storeConfig = {
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].update, this.onUpdate));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].reset, this.reset));
    this.unsubscribeListeners.push(this.listenTo(sentry_actions_organizationActions__WEBPACK_IMPORTED_MODULE_2__["default"].fetchOrgError, this.onFetchOrgError));
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
    this.dirty = false;
    this.trigger(this.get());
  },

  onUpdate(updatedOrg) {
    let {
      replace = false
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = replace ? updatedOrg : { ...this.organization,
      ...updatedOrg
    };
    this.dirty = false;
    this.trigger(this.get());
  },

  onFetchOrgError(err) {
    this.organization = null;
    this.errorType = null;

    switch (err === null || err === void 0 ? void 0 : err.status) {
      case 401:
        this.errorType = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS;
        break;

      case 404:
        this.errorType = sentry_constants__WEBPACK_IMPORTED_MODULE_3__.ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;

      default:
    }

    this.loading = false;
    this.error = err;
    this.dirty = false;
    this.trigger(this.get());
  },

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
      dirty: this.dirty
    };
  },

  getState() {
    return this.get();
  }

};
const OrganizationStore = (0,reflux__WEBPACK_IMPORTED_MODULE_1__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_4__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationStore);

/***/ }),

/***/ "./app/utils/analytics/coreuiAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/coreuiAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "coreUIEventMap": () => (/* binding */ coreUIEventMap)
/* harmony export */ });
const coreUIEventMap = {
  'page_filters.pin_click': 'Page Filters: Pin Button Clicked'
};

/***/ }),

/***/ "./app/utils/analytics/dashboardsAnalyticsEvents.tsx":
/*!***********************************************************!*\
  !*** ./app/utils/analytics/dashboardsAnalyticsEvents.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dashboardsEventMap": () => (/* binding */ dashboardsEventMap)
/* harmony export */ });
// The add/edit widget modal is currently being ported to the widget builder full-page and
// this will be removed once that is done.
const dashboardsEventMapAddWidgetModal = {
  'dashboards_views.edit_widget_modal.confirm': 'Dashboards2: Edit Dashboard Widget modal form submitted',
  'dashboards_views.edit_widget_modal.opened': 'Dashboards2: Edit Widget Modal Opened',
  'dashboards_views.add_widget_modal.opened': 'Dashboards2: Add Widget Modal opened',
  'dashboards_views.add_widget_modal.change': 'Dashboards2: Field changed in Add Widget Modal',
  'dashboards_views.add_widget_modal.confirm': 'Dashboards2: Add Widget to Dashboard modal form submitted',
  'dashboards_views.add_widget_modal.save': 'Dashboards2: Widget saved directly to Dashboard from Add Widget to Dashboard modal'
}; // Used in the full-page widget builder

const dashboardsEventMapWidgetBuilder = {
  'dashboards_views.widget_builder.change': 'Widget Builder: Field changed',
  'dashboards_views.widget_builder.save': 'Widget Builder: Form submitted',
  'dashboards_views.widget_builder.opened': 'Widget Builder: Page opened'
};
const dashboardsEventMap = {
  'dashboards_views.query_selector.opened': 'Dashboards2: Query Selector opened for Widget',
  'dashboards_views.query_selector.selected': 'Dashboards2: Query selected in Query Selector',
  'dashboards_views.open_in_discover.opened': 'Dashboards2: Widget Opened In Discover',
  'dashboards_views.widget_library.add': 'Dashboards2: Number of prebuilt widgets added',
  'dashboards_views.widget_library.add_widget': 'Dashboards2: Title of prebuilt widget added',
  'dashboards_views.widget_library.switch_tab': 'Dashboards2: Widget Library tab switched',
  'dashboards_views.widget_library.opened': 'Dashboards2: Add Widget Library opened',
  'dashboards_manage.search': 'Dashboards Manager: Search',
  'dashboards_manage.change_sort': 'Dashboards Manager: Sort By Changed',
  'dashboards_manage.create.start': 'Dashboards Manager: Dashboard Create Started',
  'dashboards_manage.templates.toggle': 'Dashboards Manager: Template Toggle Changed',
  'dashboards_manage.templates.add': 'Dashboards Manager: Template Added',
  'dashboards_manage.templates.preview': 'Dashboards Manager: Template Previewed',
  'dashboards_views.widget_viewer.edit': 'Widget Viewer: Edit Widget Modal Opened',
  'dashboards_views.widget_viewer.open': 'Widget Viewer: Opened',
  'dashboards_views.widget_viewer.open_source': 'Widget Viewer: Opened in Discover/Issues',
  'dashboards_views.widget_viewer.paginate': 'Widget Viewer: Paginate',
  'dashboards_views.widget_viewer.select_query': 'Widget Viewer: Query Selected',
  'dashboards_views.widget_viewer.sort': 'Widget Viewer: Table Sorted',
  'dashboards_views.widget_viewer.toggle_legend': 'Widget Viewer: Legend Toggled',
  'dashboards_views.widget_viewer.zoom': 'Widget Viewer: Chart zoomed',
  ...dashboardsEventMapAddWidgetModal,
  ...dashboardsEventMapWidgetBuilder
};

/***/ }),

/***/ "./app/utils/analytics/discoverAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/discoverAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "discoverEventMap": () => (/* binding */ discoverEventMap)
/* harmony export */ });
const discoverEventMap = {
  'discover_views.add_to_dashboard.modal_open': 'Discover2: Add to Dashboard modal opened',
  'discover_views.add_to_dashboard.confirm': 'Discover2: Add to Dashboard modal form submitted'
};

/***/ }),

/***/ "./app/utils/analytics/growthAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/growthAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "growthEventMap": () => (/* binding */ growthEventMap)
/* harmony export */ });
// define the event key to payload mappings
const growthEventMap = {
  'assistant.guide_finished': 'Assistant Guide Finished',
  'assistant.guide_dismissed': 'Assistant Guide Dismissed',
  'growth.clicked_mobile_prompt_setup_project': 'Growth: Clicked Mobile Prompt Setup Project',
  'growth.clicked_mobile_prompt_ask_teammate': 'Growth: Clicked Mobile Prompt Ask Teammate',
  'growth.submitted_mobile_prompt_ask_teammate': 'Growth: Submitted Mobile Prompt Ask Teammate',
  'growth.demo_click_get_started': 'Growth: Demo Click Get Started',
  'growth.demo_click_docs': 'Growth: Demo Click Docs',
  'growth.demo_click_request_demo': 'Growth: Demo Click Request Demo',
  'growth.clicked_sidebar': 'Growth: Clicked Sidebar',
  'growth.onboarding_load_choose_platform': 'Growth: Onboarding Load Choose Platform Page',
  'growth.onboarding_set_up_your_project': 'Growth: Onboarding Click Set Up Your Project',
  'growth.onboarding_set_up_your_projects': 'Growth: Onboarding Click Set Up Your Projects',
  'growth.select_platform': 'Growth: Onboarding Choose Platform',
  'growth.platformpicker_category': 'Growth: Onboarding Platform Category',
  'growth.platformpicker_search': 'Growth: Onboarding Platform Search',
  'growth.metric_alert_preset_use_template': 'Growth: Metric Alert Preset Use Template',
  'growth.metric_alert_preset_sidebar_clicked': 'Growth: Metric Alert Preset Sidebar Clicked',
  'growth.onboarding_start_onboarding': 'Growth: Onboarding Start Onboarding',
  'growth.onboarding_clicked_skip': 'Growth: Onboarding Clicked Skip',
  'growth.onboarding_take_to_error': 'Growth: Onboarding Take to Error',
  'growth.onboarding_view_full_docs': 'Growth: Onboarding View Full Docs',
  'growth.onboarding_view_sample_event': 'Growth: Onboarding View Sample Event',
  'growth.onboarding_clicked_instrument_app': 'Growth: Onboarding Clicked Instrument App',
  'growth.onboarding_clicked_setup_platform_later': 'Growth: Onboarding Clicked Setup Platform Later',
  'growth.onboarding_quick_start_cta': 'Growth: Quick Start Onboarding CTA',
  'invite_request.approved': 'Invite Request Approved',
  'invite_request.denied': 'Invite Request Denied',
  'growth.demo_modal_clicked_signup': 'Growth: Demo Modal Clicked Signup',
  'growth.demo_modal_clicked_continue': 'Growth: Demo Modal Clicked Continue',
  'growth.clicked_enter_sandbox': 'Growth: Clicked Enter Sandbox',
  'growth.onboarding_clicked_project_in_sidebar': 'Growth: Clicked Project Sidebar',
  'growth.sample_transaction_docs_link_clicked': 'Growth: Sample Transaction Docs Link Clicked',
  'growth.sample_error_onboarding_link_clicked': 'Growth: Sample Error Onboarding Link Clicked',
  'growth.issue_open_in_discover_btn_clicked': 'Growth: Open in Discover Button in Issue Details clicked',
  'member_settings_page.loaded': 'Member Settings Page Loaded',
  'invite_modal.opened': 'Invite Modal: Opened',
  'invite_modal.closed': 'Invite Modal: Closed',
  'invite_modal.add_more': 'Invite Modal: Add More',
  'invite_modal.invites_sent': 'Invite Modal: Invites Sent',
  'invite_modal.requests_sent': 'Invite Modal: Requests Sent',
  'sdk_updates.seen': 'SDK Updates: Seen',
  'sdk_updates.snoozed': 'SDK Updates: Snoozed',
  'sdk_updates.clicked': 'SDK Updates: Clicked',
  'onboarding.wizard_opened': 'Onboarding Wizard Opened',
  'onboarding.wizard_clicked': 'Onboarding Wizard Clicked',
  'sample_event.button_viewed': null,
  // high-volume event
  'sample_event.created': 'Sample Event Created',
  'sample_event.failed': 'Sample Event Failed',
  'vitals_alert.clicked_see_vitals': 'Vitals Alert: Clicked See Vitals',
  'vitals_alert.dismissed': 'Vitals Alert: Dismissed',
  'vitals_alert.clicked_docs': 'Vitals Alert: Clicked Docs',
  'vitals_alert.displayed': 'Vitals Alert: Displayed',
  'growth.onboarding_wizard_clicked_more_details': 'Onboarding Wizard: Clicked More Details',
  'growth.onboarding_wizard_interacted': 'Onboarding Wizard: Interacted',
  'assistant.guide_cued': 'Assistant Guide Cued'
};

/***/ }),

/***/ "./app/utils/analytics/issueAnalyticsEvents.tsx":
/*!******************************************************!*\
  !*** ./app/utils/analytics/issueAnalyticsEvents.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "issueEventMap": () => (/* binding */ issueEventMap)
/* harmony export */ });
const issueEventMap = {
  'event_cause.viewed': null,
  // send to main event store only due to high event volume
  'event_cause.docs_clicked': 'Event Cause Docs Clicked',
  'event_cause.snoozed': 'Event Cause Snoozed',
  'event_cause.dismissed': 'Event Cause Dismissed',
  'issue_error_banner.viewed': 'Issue Error Banner Viewed',
  'issues_tab.viewed': 'Viewed Issues Tab',
  // high volume but send to our secondary event store anyways
  'issue_search.failed': 'Issue Search: Failed',
  'issue_search.empty': 'Issue Search: Empty',
  'issue.search_sidebar_clicked': 'Issue Search Sidebar Clicked',
  'inbox_tab.issue_clicked': 'Clicked Issue from Inbox Tab',
  'issues_stream.realtime_clicked': 'Issues Stream: Realtime Clicked',
  'issues_stream.issue_clicked': 'Clicked Issue from Issues Stream',
  'issues_stream.issue_assigned': 'Assigned Issue from Issues Stream',
  'issues_stream.sort_changed': 'Changed Sort on Issues Stream',
  'issues_stream.paginate': 'Paginate Issues Stream',
  'issue.shared_publicly': 'Issue Shared Publicly',
  resolve_issue: 'Resolve Issue',
  'tag.clicked': 'Tag: Clicked',
  'issue.quick_trace_status': 'Issue Quick Trace Status',
  'span_view.embedded_child.hide': 'Span View: Hide Embedded Transaction',
  'span_view.embedded_child.show': 'Span View: Show Embedded Transaction'
};

/***/ }),

/***/ "./app/utils/analytics/performanceAnalyticsEvents.tsx":
/*!************************************************************!*\
  !*** ./app/utils/analytics/performanceAnalyticsEvents.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "performanceEventMap": () => (/* binding */ performanceEventMap)
/* harmony export */ });
const performanceEventMap = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
  'performance_views.landingv2.transactions.sort': 'Performance Views: Landing Transactions Sorted',
  'performance_views.overview.navigate.summary': 'Performance Views: Overview view summary',
  'performance_views.overview.cellaction': 'Performance Views: Cell Action Clicked',
  'performance_views.landingv3.widget.interaction': 'Performance Views: Landing Widget Interaction',
  'performance_views.landingv3.widget.switch': 'Performance Views: Landing Widget Switched',
  'performance_views.landingv3.batch_queries': 'Performance Views: Landing Query Batching',
  'performance_views.landingv3.display_change': 'Performance Views: Switch Landing Tabs',
  'performance_views.landingv3.table_pagination': 'Performance Views: Landing Page Transactions Table Page Changed',
  'performance_views.span_summary.change_chart': 'Performance Views: Span Summary displayed chart changed',
  'performance_views.span_summary.view': 'Performance Views: Span Summary page viewed',
  'performance_views.spans.change_op': 'Performance Views: Change span operation name',
  'performance_views.spans.change_sort': 'Performance Views: Change span sort column',
  'performance_views.overview.view': 'Performance Views: Transaction overview view',
  'performance_views.overview.search': 'Performance Views: Transaction overview search',
  'performance_views.vital_detail.view': 'Performance Views: Vital Detail viewed',
  'performance_views.vital_detail.switch_vital': 'Performance Views: Vital Detail vital type switched',
  'performance_views.trace_view.view': 'Performance Views: Trace View viewed',
  'performance_views.trace_view.open_in_discover': 'Performance Views: Trace View open in Discover button clicked',
  'performance_views.trace_view.open_transaction_details': 'Performance Views: Trace View transaction details opened',
  'performance_views.transaction_summary.change_chart_display': 'Performance Views: Transaction Summary chart display changed',
  'performance_views.transaction_summary.status_breakdown_click': 'Performance Views: Transaction Summary status breakdown option clicked',
  'performance_views.all_events.open_in_discover': 'Performance Views: All Events page open in Discover button clicked',
  'performance_views.tags.change_aggregate_column': 'Performance Views: Tags page changed aggregate column',
  'performance_views.tags.change_tag': 'Performance Views: Tags Page changed selected tag',
  'performance_views.tags.jump_to_release': 'Performance Views: Tags Page link to release in table clicked',
  'performance_views.team_key_transaction.set': 'Performance Views: Set Team Key Transaction',
  'performance_views.trends.widget_interaction': 'Performance Views: Trends Widget Interaction',
  'performance_views.trends.widget_pagination': 'Performance Views: Trends Widget Page Changed',
  'performance_views.trends.change_duration': 'Performance Views: Trends Widget Duration Changed',
  'performance_views.event_details.filter_by_op': 'Performance Views: Event Details page operation filter applied',
  'performance_views.event_details.search_query': 'Performance Views: Event Details search query',
  'performance_views.event_details.open_span_details': 'Performance Views: Event Details span details opened',
  'performance_views.event_details.anchor_span': 'Performance Views: Event Details span anchored',
  'performance_views.event_details.json_button_click': 'Performance Views: Event Details JSON button clicked',
  'performance_views.transaction_summary.view': 'Performance Views: Transaction Summary View',
  'performance_views.filter_dropdown.selection': 'Performance Views: Filter Dropdown',
  'performance_views.vital_detail.comparison_viewed': 'Performance Views: Vital Detail Comparison Viewed',
  'performance_views.relative_breakdown.selection': 'Performance Views: Select Relative Breakdown'
};

/***/ }),

/***/ "./app/utils/analytics/profilingAnalyticsEvents.tsx":
/*!**********************************************************!*\
  !*** ./app/utils/analytics/profilingAnalyticsEvents.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "profilingEventMap": () => (/* binding */ profilingEventMap)
/* harmony export */ });
const profilingEventMap = {
  'profiling_views.landing': 'Profiling Views: Landing',
  'profiling_views.onboarding': 'Profiling Views: Onboarding',
  'profiling_views.profile_flamegraph': 'Profiling Views: Flamegraph',
  'profiling_views.profile_summary': 'Profiling Views: Profile Summary',
  'profiling_views.profile_details': 'Profiling Views: Profile Details',
  'profiling_views.go_to_flamegraph': 'Profiling Views: Go to Flamegraph',
  'profiling_views.onboarding_action': 'Profiling Actions: Onboarding Action'
};

/***/ }),

/***/ "./app/utils/analytics/releasesAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/releasesAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "releasesEventMap": () => (/* binding */ releasesEventMap)
/* harmony export */ });
const releasesEventMap = {
  'releases.quickstart_viewed': 'Releases: Quickstart Viewed',
  'releases.quickstart_copied': 'Releases: Quickstart Copied',
  'releases.quickstart_create_integration.success': 'Releases: Quickstart Created Integration',
  'releases.quickstart_create_integration_modal.close': 'Releases: Quickstart Create Integration Modal Exit'
};

/***/ }),

/***/ "./app/utils/analytics/samplingAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/samplingAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "samplingEventMap": () => (/* binding */ samplingEventMap)
/* harmony export */ });
const samplingEventMap = {
  'sampling.sdk.client.rate.change.alert': 'Recommended sdk client rate change alert',
  'sampling.sdk.updgrades.alert': 'Recommended sdk upgrades alert',
  'sampling.sdk.incompatible.alert': 'Incompatible sdk upgrades alert',
  'sampling.settings.modal.recommended.next.steps_back': 'Go back to uniform rate step',
  'sampling.settings.modal.recommended.next.steps_cancel': 'Cancel at recommended next steps step ',
  'sampling.settings.modal.recommended.next.steps_done': 'Create uniform rule at recommended next steps step',
  'sampling.settings.modal.recommended.next.steps_read_docs': 'Read docs at recommended next steps step',
  'sampling.settings.rule.specific_activate': 'Activate specific rule',
  'sampling.settings.modal.uniform.rate_cancel': 'Cancel at uniform rate step',
  'sampling.settings.rule.specific_deactivate': 'Deactivate specific rule',
  'sampling.settings.modal.uniform.rate_done': 'Create uniform rule at uniform rate step',
  'sampling.settings.modal.uniform.rate_next': 'Go to recommended next steps step',
  'sampling.settings.modal.uniform.rate_read_docs': 'Read docs at uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_current': 'Switch to current uniform rate step',
  'sampling.settings.modal.uniform.rate_switch_recommended': 'Switch to recommended next steps step',
  'sampling.settings.modal.specific.rule.condition_add': 'Add sampling condition',
  'sampling.settings.modal.specify.client.rate_read_docs': 'Read docs at specify client rate step',
  'sampling.settings.modal.specify.client.rate_cancel': 'Cancel at specify client rate step',
  'sampling.settings.modal.specify.client.rate_next': 'Go to uniform rate step',
  'sampling.settings.rule.specific_create': 'Create specific sampling rule',
  'sampling.settings.rule.specific_delete': 'Delete specific sampling rule',
  'sampling.settings.rule.specific_save': 'Save specific sampling rule',
  // fired for both create and update
  'sampling.settings.rule.specific_update': 'Update specific sampling rule',
  'sampling.settings.rule.uniform_activate': 'Activate uniform sampling rule',
  'sampling.settings.rule.uniform_create': 'Create uniform sampling rule',
  'sampling.settings.rule.uniform_deactivate': 'Deactivate uniform sampling rule',
  'sampling.settings.rule.uniform_save': 'Save uniform sampling rule',
  // fired for both create and update
  'sampling.settings.rule.uniform_update': 'Update uniform sampling rule',
  'sampling.settings.view': 'View sampling settings',
  'sampling.settings.view_get_started': 'Get started with sampling',
  'sampling.settings.view_read_docs': 'Read sampling docs' // fired for all read docs buttons

};

/***/ }),

/***/ "./app/utils/analytics/searchAnalyticsEvents.tsx":
/*!*******************************************************!*\
  !*** ./app/utils/analytics/searchAnalyticsEvents.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "searchEventMap": () => (/* binding */ searchEventMap)
/* harmony export */ });
const searchEventMap = {
  'search.searched': 'Search: Performed search',
  'search.operator_autocompleted': 'Search: Operator Autocompleted',
  'search.shortcut_used': 'Search: Shortcut Used',
  'search.search_with_invalid': 'Search: Attempted Invalid Search',
  'search.invalid_field': 'Search: Unsupported Field Warning Shown',
  'organization_saved_search.selected': 'Organization Saved Search: Selected saved search',
  'settings_search.open': 'settings_search Open',
  'command_palette.open': 'command_palette Open',
  'sidebar_help.open': 'sidebar_help Open',
  'settings_search.select': 'settings_search Select',
  'command_palette.select': 'command_palette Select',
  'sidebar_help.select': 'sidebar_help Select',
  'settings_search.query': 'settings_search Query',
  'command_palette.query': 'command_palette Query',
  'sidebar_help.query': 'sidebar_help Query',
  'projectselector.direct_selection': 'Project Selector: Direct Selection',
  'projectselector.update': 'Project Selector: Update',
  'projectselector.clear': 'Project Selector: Clear',
  'projectselector.toggle': 'Project Selector: Toggle',
  'projectselector.multi_button_clicked': 'Project Selector: Multi Button Clicked',
  'search.pin': 'Search: Pin'
};

/***/ }),

/***/ "./app/utils/analytics/settingsAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/settingsAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "settingsEventMap": () => (/* binding */ settingsEventMap)
/* harmony export */ });
const settingsEventMap = {
  'notification_settings.index_page_viewed': 'Notification Settings: Index Page Viewed',
  'notification_settings.tuning_page_viewed': 'Notification Settings: Tuning Page Viewed',
  'notification_settings.updated_tuning_setting': 'Notification Settings: Updated Tuning Setting'
};

/***/ }),

/***/ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _coreuiAnalyticsEvents__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./coreuiAnalyticsEvents */ "./app/utils/analytics/coreuiAnalyticsEvents.tsx");
/* harmony import */ var _dashboardsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./dashboardsAnalyticsEvents */ "./app/utils/analytics/dashboardsAnalyticsEvents.tsx");
/* harmony import */ var _discoverAnalyticsEvents__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./discoverAnalyticsEvents */ "./app/utils/analytics/discoverAnalyticsEvents.tsx");
/* harmony import */ var _growthAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./growthAnalyticsEvents */ "./app/utils/analytics/growthAnalyticsEvents.tsx");
/* harmony import */ var _issueAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./issueAnalyticsEvents */ "./app/utils/analytics/issueAnalyticsEvents.tsx");
/* harmony import */ var _makeAnalyticsFunction__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./makeAnalyticsFunction */ "./app/utils/analytics/makeAnalyticsFunction.tsx");
/* harmony import */ var _performanceAnalyticsEvents__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./performanceAnalyticsEvents */ "./app/utils/analytics/performanceAnalyticsEvents.tsx");
/* harmony import */ var _profilingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./profilingAnalyticsEvents */ "./app/utils/analytics/profilingAnalyticsEvents.tsx");
/* harmony import */ var _releasesAnalyticsEvents__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./releasesAnalyticsEvents */ "./app/utils/analytics/releasesAnalyticsEvents.tsx");
/* harmony import */ var _samplingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./samplingAnalyticsEvents */ "./app/utils/analytics/samplingAnalyticsEvents.tsx");
/* harmony import */ var _searchAnalyticsEvents__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./searchAnalyticsEvents */ "./app/utils/analytics/searchAnalyticsEvents.tsx");
/* harmony import */ var _settingsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./settingsAnalyticsEvents */ "./app/utils/analytics/settingsAnalyticsEvents.tsx");
/* harmony import */ var _workflowAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./workflowAnalyticsEvents */ "./app/utils/analytics/workflowAnalyticsEvents.tsx");













const allEventMap = { ..._coreuiAnalyticsEvents__WEBPACK_IMPORTED_MODULE_0__.coreUIEventMap,
  ..._dashboardsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_1__.dashboardsEventMap,
  ..._discoverAnalyticsEvents__WEBPACK_IMPORTED_MODULE_2__.discoverEventMap,
  ..._growthAnalyticsEvents__WEBPACK_IMPORTED_MODULE_3__.growthEventMap,
  ..._issueAnalyticsEvents__WEBPACK_IMPORTED_MODULE_4__.issueEventMap,
  ..._performanceAnalyticsEvents__WEBPACK_IMPORTED_MODULE_6__.performanceEventMap,
  ..._profilingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_7__.profilingEventMap,
  ..._samplingAnalyticsEvents__WEBPACK_IMPORTED_MODULE_9__.samplingEventMap,
  ..._searchAnalyticsEvents__WEBPACK_IMPORTED_MODULE_10__.searchEventMap,
  ..._settingsAnalyticsEvents__WEBPACK_IMPORTED_MODULE_11__.settingsEventMap,
  ..._workflowAnalyticsEvents__WEBPACK_IMPORTED_MODULE_12__.workflowEventMap,
  ..._releasesAnalyticsEvents__WEBPACK_IMPORTED_MODULE_8__.releasesEventMap
};
/**
 * Generic typed analytics function for growth, issue, and performance events.
 * Can split up analytics functions to a smaller set of events like we do for trackIntegrationAnalytics
 */

const trackAdvancedAnalyticsEvent = (0,_makeAnalyticsFunction__WEBPACK_IMPORTED_MODULE_5__["default"])(allEventMap);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (trackAdvancedAnalyticsEvent);

/***/ }),

/***/ "./app/utils/analytics/workflowAnalyticsEvents.tsx":
/*!*********************************************************!*\
  !*** ./app/utils/analytics/workflowAnalyticsEvents.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "workflowEventMap": () => (/* binding */ workflowEventMap)
/* harmony export */ });
const workflowEventMap = {
  'alert_builder.filter': 'Alert Builder: Filter',
  'alert_details.viewed': 'Alert Details: Viewed',
  'alert_rule_details.viewed': 'Alert Rule Details: Viewed',
  'alert_rules.viewed': 'Alert Rules: Viewed',
  'alert_stream.viewed': 'Alert Stream: Viewed',
  'alert_wizard.option_selected': 'Alert Wizard: Option Selected',
  'alert_wizard.option_viewed': 'Alert Wizard: Option Viewed',
  'edit_alert_rule.add_row': 'Edit Alert Rule: Add Row',
  'edit_alert_rule.viewed': 'Edit Alert Rule: Viewed',
  'issue_alert_rule_details.edit_clicked': 'Issue Alert Rule Details: Edit Clicked',
  'issue_alert_rule_details.viewed': 'Issue Alert Rule Details: Viewed',
  'issue_details.action_clicked': 'Issue Details: Action Clicked',
  'issue_details.event_json_clicked': 'Issue Details: Event JSON Clicked',
  'issue_details.event_navigation_clicked': 'Issue Details: Event Navigation Clicked',
  'issue_details.viewed': 'Issue Details: Viewed',
  'new_alert_rule.viewed': 'New Alert Rule: Viewed',
  'team_insights.viewed': 'Team Insights: Viewed',
  'project_creation_page.viewed': 'Project Create: Creation page viewed',
  'project_creation_page.created': 'Project Create: Project Created'
};

/***/ }),

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");



/**
 * Returns an API client that will have it's requests canceled when the owning
 * React component is unmounted (may be disabled via options).
 */
function useApi() {
  let {
    persistInFlight,
    api: providedApi
  } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const localApi = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(); // Lazily construct the client if we weren't provided with one

  if (localApi.current === undefined && providedApi === undefined) {
    localApi.current = new sentry_api__WEBPACK_IMPORTED_MODULE_1__.Client();
  } // Use the provided client if available


  const api = providedApi !== null && providedApi !== void 0 ? providedApi : localApi.current; // Clear API calls on unmount (if persistInFlight is disabled

  const clearOnUnmount = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!persistInFlight) {
      api.clear();
    }
  }, [api, persistInFlight]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => clearOnUnmount, [clearOnUnmount]);
  return api;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (useApi);

/***/ }),

/***/ "./app/utils/withApi.tsx":
/*!*******************************!*\
  !*** ./app/utils/withApi.tsx ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * XXX: Prefer useApi if you are wrapping a Function Component!
 *
 * React Higher-Order Component (HoC) that provides "api" client when mounted,
 * and clears API requests when component is unmounted.
 *
 * If an `api` prop is provided when the component is invoked it will be passed
 * through.
 */
const withApi = function (WrappedComponent) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const WithApi = _ref => {
    let {
      api: propsApi,
      ...props
    } = _ref;
    const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_1__["default"])({
      api: propsApi,
      ...options
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(WrappedComponent, { ...props,
      api: api
    });
  };

  WithApi.displayName = `withApi(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_0__["default"])(WrappedComponent)})`;
  return WithApi;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withApi);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_tag_tsx-app_stores_organizationStore_tsx-app_utils_withApi_tsx.54af55200fc14ac0bd4908b8ba102046.js.map