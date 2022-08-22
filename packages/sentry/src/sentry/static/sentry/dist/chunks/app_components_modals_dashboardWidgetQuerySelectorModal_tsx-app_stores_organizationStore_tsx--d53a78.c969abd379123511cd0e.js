(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_dashboardWidgetQuerySelectorModal_tsx-app_stores_organizationStore_tsx--d53a78"],{

/***/ "./app/actions/organizationActions.tsx":
/*!*********************************************!*\
  !*** ./app/actions/organizationActions.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const OrganizationActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['reset', 'fetchOrgError', 'update']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (OrganizationActions);

/***/ }),

/***/ "./app/components/modals/dashboardWidgetQuerySelectorModal.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetQuerySelectorModal.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/dashboardsV2/utils */ "./app/views/dashboardsV2/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















class DashboardWidgetQuerySelectorModal extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  renderQueries() {
    const {
      organization,
      widget,
      selection,
      isMetricsData
    } = this.props;
    const querySearchBars = widget.queries.map((query, index) => {
      const discoverLocation = (0,sentry_views_dashboardsV2_utils__WEBPACK_IMPORTED_MODULE_11__.getWidgetDiscoverUrl)({ ...widget,
        queries: [query]
      }, selection, organization, 0, isMetricsData);
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(QueryContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Container, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(SearchLabel, {
              htmlFor: "smart-search-input",
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Search events'),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconSearch, {})
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledInput, {
              value: query.conditions,
              disabled: true
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_2__.Link, {
            to: discoverLocation,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(OpenInDiscoverButton, {
              priority: "primary",
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconChevron, {
                size: "xs",
                direction: "right"
              }),
              onClick: () => {
                (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('dashboards_views.query_selector.selected', {
                  organization,
                  widget_type: widget.displayType
                });
              },
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Open in Discover')
            })
          })]
        })
      }, index);
    });
    return querySearchBars;
  }

  render() {
    const {
      Body,
      Header,
      widget
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Header, {
        closeButton: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h4", {
          children: widget.title
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Multiple queries were used to create this widget visualization. Which query would you like to view in Discover?')
        }), this.renderQueries()]
      })]
    });
  }

}

DashboardWidgetQuerySelectorModal.displayName = "DashboardWidgetQuerySelectorModal";

const StyledInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e10oo76w4"
} : 0)( true ? {
  name: "97snz3",
  styles: "text-overflow:ellipsis;padding:0px;box-shadow:none;height:auto;&:disabled{border:none;cursor:default;}"
} : 0);

const QueryContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e10oo76w3"
} : 0)("display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const OpenInDiscoverButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e10oo76w2"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e10oo76w1"
} : 0)("border:1px solid ", p => p.theme.border, ";box-shadow:inset ", p => p.theme.dropShadowLight, ";background:", p => p.theme.backgroundSecondary, ";padding:7px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";position:relative;display:grid;grid-template-columns:max-content 1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";align-items:start;flex-grow:1;border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const SearchLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "e10oo76w0"
} : 0)("display:flex;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " 0;margin:0;color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "l07bt5",
  styles: "width:100%;max-width:700px;margin:70px auto"
} : 0;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_10__["default"])(DashboardWidgetQuerySelectorModal)));

/***/ }),

/***/ "./app/stores/organizationStore.tsx":
/*!******************************************!*\
  !*** ./app/stores/organizationStore.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

"use strict";
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

/***/ "./app/utils/performance/vitals/constants.tsx":
/*!****************************************************!*\
  !*** ./app/utils/performance/vitals/constants.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

/***/ "./app/utils/useApi.tsx":
/*!******************************!*\
  !*** ./app/utils/useApi.tsx ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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

"use strict";
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

/***/ }),

/***/ "./app/views/dashboardsV2/utils.tsx":
/*!******************************************!*\
  !*** ./app/views/dashboardsV2/utils.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "cloneDashboard": () => (/* binding */ cloneDashboard),
/* harmony export */   "constructWidgetFromQuery": () => (/* binding */ constructWidgetFromQuery),
/* harmony export */   "eventViewFromWidget": () => (/* binding */ eventViewFromWidget),
/* harmony export */   "flattenErrors": () => (/* binding */ flattenErrors),
/* harmony export */   "getCurrentPageFilters": () => (/* binding */ getCurrentPageFilters),
/* harmony export */   "getCustomMeasurementQueryParams": () => (/* binding */ getCustomMeasurementQueryParams),
/* harmony export */   "getDashboardFiltersFromURL": () => (/* binding */ getDashboardFiltersFromURL),
/* harmony export */   "getDashboardsMEPQueryParams": () => (/* binding */ getDashboardsMEPQueryParams),
/* harmony export */   "getFieldsFromEquations": () => (/* binding */ getFieldsFromEquations),
/* harmony export */   "getNumEquations": () => (/* binding */ getNumEquations),
/* harmony export */   "getSavedFiltersAsPageFilters": () => (/* binding */ getSavedFiltersAsPageFilters),
/* harmony export */   "getSavedPageFilters": () => (/* binding */ getSavedPageFilters),
/* harmony export */   "getWidgetDiscoverUrl": () => (/* binding */ getWidgetDiscoverUrl),
/* harmony export */   "getWidgetInterval": () => (/* binding */ getWidgetInterval),
/* harmony export */   "getWidgetIssueUrl": () => (/* binding */ getWidgetIssueUrl),
/* harmony export */   "getWidgetReleasesUrl": () => (/* binding */ getWidgetReleasesUrl),
/* harmony export */   "hasSavedPageFilters": () => (/* binding */ hasSavedPageFilters),
/* harmony export */   "hasUnsavedFilterChanges": () => (/* binding */ hasUnsavedFilterChanges),
/* harmony export */   "isCustomMeasurement": () => (/* binding */ isCustomMeasurement),
/* harmony export */   "isCustomMeasurementWidget": () => (/* binding */ isCustomMeasurementWidget),
/* harmony export */   "isWidgetUsingTransactionName": () => (/* binding */ isWidgetUsingTransactionName),
/* harmony export */   "miniWidget": () => (/* binding */ miniWidget),
/* harmony export */   "resetPageFilters": () => (/* binding */ resetPageFilters)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEmpty */ "../node_modules/lodash/isEmpty.js");
/* harmony import */ var lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/trimStart */ "../node_modules/lodash/trimStart.js");
/* harmony import */ var lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry-images/dashboard/widget-area.svg */ "./images/dashboard/widget-area.svg");
/* harmony import */ var sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry-images/dashboard/widget-bar.svg */ "./images/dashboard/widget-bar.svg");
/* harmony import */ var sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry-images/dashboard/widget-big-number.svg */ "./images/dashboard/widget-big-number.svg");
/* harmony import */ var sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry-images/dashboard/widget-line-1.svg */ "./images/dashboard/widget-line-1.svg");
/* harmony import */ var sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry-images/dashboard/widget-table.svg */ "./images/dashboard/widget-table.svg");
/* harmony import */ var sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry-images/dashboard/widget-world-map.svg */ "./images/dashboard/widget-world-map.svg");
/* harmony import */ var sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/arithmeticInput/parser */ "./app/components/arithmeticInput/parser.tsx");
/* harmony import */ var sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/charts/utils */ "./app/components/charts/utils.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/parse */ "./app/components/organizations/pageFilters/parse.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/discover/types */ "./app/utils/discover/types.tsx");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");



























function cloneDashboard(dashboard) {
  return lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_4___default()(dashboard);
}
function eventViewFromWidget(title, query, selection, widgetDisplayType) {
  const {
    start,
    end,
    period: statsPeriod
  } = selection.datetime;
  const {
    projects,
    environments
  } = selection; // World Map requires an additional column (geo.country_code) to display in discover when navigating from the widget

  const fields = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.columns.includes('geo.country_code') ? ['geo.country_code', ...query.columns, ...query.aggregates] : [...query.columns, ...query.aggregates];
  const conditions = widgetDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP && !query.conditions.includes('has:geo.country_code') ? `${query.conditions} has:geo.country_code`.trim() : query.conditions;
  const {
    orderby
  } = query; // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format

  const aggregateAliasOrderBy = orderby ? `${orderby.startsWith('-') ? '-' : ''}${(0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateAlias)(lodash_trimStart__WEBPACK_IMPORTED_MODULE_8___default()(orderby, '-'))}` : orderby;
  return sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__["default"].fromSavedQuery({
    id: undefined,
    name: title,
    version: 2,
    fields,
    query: conditions,
    orderby: aggregateAliasOrderBy,
    projects,
    range: statsPeriod !== null && statsPeriod !== void 0 ? statsPeriod : undefined,
    start: start ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start) : undefined,
    end: end ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end) : undefined,
    environment: environments
  });
}

function coerceStringToArray(value) {
  return typeof value === 'string' ? [value] : value;
}

function constructWidgetFromQuery(query) {
  if (query) {
    const queryNames = coerceStringToArray(query.queryNames);
    const queryConditions = coerceStringToArray(query.queryConditions);
    const queryFields = coerceStringToArray(query.queryFields);
    const queries = [];

    if (queryConditions && queryNames && queryFields && typeof query.queryOrderby === 'string') {
      const {
        columns,
        aggregates
      } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getColumnsAndAggregates)(queryFields);
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames[index],
          conditions: condition,
          fields: queryFields,
          columns,
          aggregates,
          orderby: query.queryOrderby
        });
      });
    }

    if (query.title && query.displayType && query.interval && queries.length > 0) {
      const newWidget = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_7___default()(query, ['title', 'displayType', 'interval']),
        widgetType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER,
        queries
      };
      return newWidget;
    }
  }

  return undefined;
}
function miniWidget(displayType) {
  switch (displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      return sentry_images_dashboard_widget_bar_svg__WEBPACK_IMPORTED_MODULE_11__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.AREA:
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      return sentry_images_dashboard_widget_area_svg__WEBPACK_IMPORTED_MODULE_10__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BIG_NUMBER:
      return sentry_images_dashboard_widget_big_number_svg__WEBPACK_IMPORTED_MODULE_12__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TABLE:
      return sentry_images_dashboard_widget_table_svg__WEBPACK_IMPORTED_MODULE_14__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      return sentry_images_dashboard_widget_world_map_svg__WEBPACK_IMPORTED_MODULE_15__;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.LINE:
    default:
      return sentry_images_dashboard_widget_line_1_svg__WEBPACK_IMPORTED_MODULE_13__;
  }
}
function getWidgetInterval(displayType, datetimeObj, widgetInterval, fidelity) {
  // Don't fetch more than 66 bins as we're plotting on a small area.
  const MAX_BIN_COUNT = 66; // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.

  let interval = displayType === 'bar' ? '1d' : widgetInterval;

  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }

  const desiredPeriod = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(interval);
  const selectedRange = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getDiffInMinutes)(datetimeObj);

  if (fidelity) {
    // Primarily to support lower fidelity for Release Health widgets
    // the sort on releases and hit the metrics API endpoint.
    interval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, fidelity);

    if (selectedRange > sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.SIX_HOURS && selectedRange <= sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.TWENTY_FOUR_HOURS) {
      interval = '1h';
    }

    return displayType === 'bar' ? '1d' : interval;
  } // selectedRange is in minutes, desiredPeriod is in hours
  // convert desiredPeriod to minutes


  if (selectedRange / (desiredPeriod * 60) > MAX_BIN_COUNT) {
    const highInterval = (0,sentry_components_charts_utils__WEBPACK_IMPORTED_MODULE_17__.getInterval)(datetimeObj, 'high'); // Only return high fidelity interval if desired interval is higher fidelity

    if (desiredPeriod < (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.parsePeriodToHours)(highInterval)) {
      return highInterval;
    }
  }

  return interval;
}
function getFieldsFromEquations(fields) {
  // Gather all fields and functions used in equations and prepend them to the provided fields
  const termsSet = new Set();
  fields.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).forEach(field => {
    const parsed = (0,sentry_components_arithmeticInput_parser__WEBPACK_IMPORTED_MODULE_16__.parseArithmetic)((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.stripEquationPrefix)(field)).tc;
    parsed.fields.forEach(_ref => {
      let {
        term
      } = _ref;
      return termsSet.add(term);
    });
    parsed.functions.forEach(_ref2 => {
      let {
        term
      } = _ref2;
      return termsSet.add(term);
    });
  });
  return Array.from(termsSet);
}
function getWidgetDiscoverUrl(widget, selection, organization) {
  let index = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  let isMetricsData = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  const eventView = eventViewFromWidget(widget.title, widget.queries[index], selection, widget.displayType);
  const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug); // Pull a max of 3 valid Y-Axis from the widget

  const yAxisOptions = eventView.getYAxisOptions().map(_ref3 => {
    let {
      value
    } = _ref3;
    return value;
  });
  discoverLocation.query.yAxis = [...new Set(widget.queries[0].aggregates.filter(aggregate => yAxisOptions.includes(aggregate)))].slice(0, 3); // Visualization specific transforms

  switch (widget.displayType) {
    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.WORLD_MAP:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.WORLDMAP;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.BAR:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.BAR;
      break;

    case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DisplayType.TOP_N:
      discoverLocation.query.display = sentry_utils_discover_types__WEBPACK_IMPORTED_MODULE_23__.DisplayModes.TOP5; // Last field is used as the yAxis

      const aggregates = widget.queries[0].aggregates;
      discoverLocation.query.yAxis = aggregates[aggregates.length - 1];

      if (aggregates.slice(0, -1).includes(aggregates[aggregates.length - 1])) {
        discoverLocation.query.field = aggregates.slice(0, -1);
      }

      break;

    default:
      break;
  } // Equation fields need to have their terms explicitly selected as columns in the discover table


  const fields = discoverLocation.query.field;
  const query = widget.queries[0];
  const queryFields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(query.fields) ? query.fields : [...query.columns, ...query.aggregates];
  const equationFields = getFieldsFromEquations(queryFields); // Updates fields by adding any individual terms from equation fields as a column

  equationFields.forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });

  if (isMetricsData) {
    discoverLocation.query.fromMetric = 'true';
  } // Construct and return the discover url


  const discoverPath = `${discoverLocation.pathname}?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...discoverLocation.query
  })}`;
  return discoverPath;
}
function getWidgetIssueUrl(widget, selection, organization) {
  var _widget$queries, _widget$queries$, _widget$queries2, _widget$queries2$;

  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const issuesLocation = `/organizations/${organization.slug}/issues/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({
    query: (_widget$queries = widget.queries) === null || _widget$queries === void 0 ? void 0 : (_widget$queries$ = _widget$queries[0]) === null || _widget$queries$ === void 0 ? void 0 : _widget$queries$.conditions,
    sort: (_widget$queries2 = widget.queries) === null || _widget$queries2 === void 0 ? void 0 : (_widget$queries2$ = _widget$queries2[0]) === null || _widget$queries2$ === void 0 ? void 0 : _widget$queries2$.orderby,
    ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return issuesLocation;
}
function getWidgetReleasesUrl(_widget, selection, organization) {
  const {
    start,
    end,
    utc,
    period
  } = selection.datetime;
  const datetime = start && end ? {
    start: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(start),
    end: (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(end),
    utc
  } : {
    statsPeriod: period
  };
  const releasesLocation = `/organizations/${organization.slug}/releases/?${query_string__WEBPACK_IMPORTED_MODULE_9__.stringify({ ...datetime,
    project: selection.projects,
    environment: selection.environments
  })}`;
  return releasesLocation;
}
function flattenErrors(data, update) {
  if (typeof data === 'string') {
    update.error = data;
  } else {
    Object.keys(data).forEach(key => {
      const value = data[key];

      if (typeof value === 'string') {
        update[key] = value;
        return;
      } // Recurse into nested objects.


      if (Array.isArray(value) && typeof value[0] === 'string') {
        update[key] = value[0];
        return;
      }

      if (Array.isArray(value) && typeof value[0] === 'object') {
        value.map(item => flattenErrors(item, update));
      } else {
        flattenErrors(value, update);
      }
    });
  }

  return update;
}
function getDashboardsMEPQueryParams(isMEPEnabled) {
  return isMEPEnabled ? {
    dataset: 'metricsEnhanced'
  } : {};
}
function getNumEquations(possibleEquations) {
  return possibleEquations.filter(sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isEquation).length;
}
function isCustomMeasurement(field) {
  const definedMeasurements = Object.keys((0,sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_24__.getMeasurements)());
  return (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.isMeasurement)(field) && !definedMeasurements.includes(field);
}
function isCustomMeasurementWidget(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref4 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref4;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      // Should be ok to use getAggregateArg. getAggregateArg only returns the first arg
      // but there aren't any custom measurement aggregates that use custom measurements
      // outside of the first arg.
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => isCustomMeasurement(field));
  });
}
function getCustomMeasurementQueryParams() {
  return {
    dataset: 'metrics'
  };
}
function isWidgetUsingTransactionName(widget) {
  return widget.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.WidgetType.DISCOVER && widget.queries.some(_ref5 => {
    let {
      aggregates,
      columns,
      fields
    } = _ref5;
    const aggregateArgs = aggregates.reduce((acc, aggregate) => {
      const aggregateArg = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.getAggregateArg)(aggregate);

      if (aggregateArg) {
        acc.push(aggregateArg);
      }

      return acc;
    }, []);
    return [...aggregateArgs, ...columns, ...(fields !== null && fields !== void 0 ? fields : [])].some(field => field === 'transaction');
  });
}
function hasSavedPageFilters(dashboard) {
  return !(lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboard.projects) && dashboard.environment === undefined && dashboard.start === undefined && dashboard.end === undefined && dashboard.period === undefined);
}
function hasUnsavedFilterChanges(initialDashboard, location) {
  var _location$query;

  // Use Sets to compare the filter fields that are arrays
  const savedFilters = {
    projects: new Set(initialDashboard.projects),
    environment: new Set(initialDashboard.environment),
    period: initialDashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(initialDashboard.end),
    utc: initialDashboard.utc
  };
  let currentFilters = { ...getCurrentPageFilters(location)
  };
  currentFilters = { ...currentFilters,
    projects: new Set(currentFilters.projects),
    environment: new Set(currentFilters.environment)
  };

  if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query = location.query) === null || _location$query === void 0 ? void 0 : _location$query.release)) {
    var _initialDashboard$fil, _location$query2;

    // Release is only included in the comparison if it exists in the query
    // params, otherwise the dashboard should be using its saved state
    savedFilters.release = new Set((_initialDashboard$fil = initialDashboard.filters) === null || _initialDashboard$fil === void 0 ? void 0 : _initialDashboard$fil.release);
    currentFilters.release = new Set((_location$query2 = location.query) === null || _location$query2 === void 0 ? void 0 : _location$query2.release);
  }

  return !lodash_isEqual__WEBPACK_IMPORTED_MODULE_6___default()(savedFilters, currentFilters);
}
function getSavedFiltersAsPageFilters(dashboard) {
  return {
    datetime: {
      end: dashboard.end || null,
      period: dashboard.period || null,
      start: dashboard.start || null,
      utc: null
    },
    environments: dashboard.environment || [],
    projects: dashboard.projects || []
  };
}
function getSavedPageFilters(dashboard) {
  return {
    project: dashboard.projects,
    environment: dashboard.environment,
    statsPeriod: dashboard.period,
    start: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.start),
    end: (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(dashboard.end),
    utc: dashboard.utc
  };
}
function resetPageFilters(dashboard, location) {
  react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.replace({ ...location,
    query: getSavedPageFilters(dashboard)
  });
}
function getCurrentPageFilters(location) {
  var _location$query3;

  const {
    project,
    environment,
    statsPeriod,
    start,
    end,
    utc
  } = (_location$query3 = location.query) !== null && _location$query3 !== void 0 ? _location$query3 : {};
  return {
    // Ensure projects and environment are sent as arrays, or undefined in the request
    // location.query will return a string if there's only one value
    projects: project === undefined || project === null ? [] : typeof project === 'string' ? [Number(project)] : project.map(Number),
    environment: typeof environment === 'string' ? [environment] : environment !== null && environment !== void 0 ? environment : undefined,
    period: statsPeriod,
    start: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(start) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(start) : undefined,
    end: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(end) ? (0,sentry_components_organizations_pageFilters_parse__WEBPACK_IMPORTED_MODULE_18__.normalizeDateTimeString)(end) : undefined,
    utc: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(utc) ? utc === 'true' : undefined
  };
}
function getDashboardFiltersFromURL(location) {
  const dashboardFilters = {};
  Object.values(sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_26__.DashboardFilterKeys).forEach(key => {
    var _location$query4;

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)((_location$query4 = location.query) === null || _location$query4 === void 0 ? void 0 : _location$query4[key])) {
      var _location$query5;

      dashboardFilters[key] = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_25__.decodeList)((_location$query5 = location.query) === null || _location$query5 === void 0 ? void 0 : _location$query5[key]);
    }
  });
  return !lodash_isEmpty__WEBPACK_IMPORTED_MODULE_5___default()(dashboardFilters) ? dashboardFilters : null;
}

/***/ }),

/***/ "../node_modules/lodash/_charsStartIndex.js":
/*!**************************************************!*\
  !*** ../node_modules/lodash/_charsStartIndex.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseIndexOf = __webpack_require__(/*! ./_baseIndexOf */ "../node_modules/lodash/_baseIndexOf.js");

/**
 * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the first unmatched string symbol.
 */
function charsStartIndex(strSymbols, chrSymbols) {
  var index = -1,
      length = strSymbols.length;

  while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

module.exports = charsStartIndex;


/***/ }),

/***/ "../node_modules/lodash/trimStart.js":
/*!*******************************************!*\
  !*** ../node_modules/lodash/trimStart.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseToString = __webpack_require__(/*! ./_baseToString */ "../node_modules/lodash/_baseToString.js"),
    castSlice = __webpack_require__(/*! ./_castSlice */ "../node_modules/lodash/_castSlice.js"),
    charsStartIndex = __webpack_require__(/*! ./_charsStartIndex */ "../node_modules/lodash/_charsStartIndex.js"),
    stringToArray = __webpack_require__(/*! ./_stringToArray */ "../node_modules/lodash/_stringToArray.js"),
    toString = __webpack_require__(/*! ./toString */ "../node_modules/lodash/toString.js");

/** Used to match leading whitespace. */
var reTrimStart = /^\s+/;

/**
 * Removes leading whitespace or specified characters from `string`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category String
 * @param {string} [string=''] The string to trim.
 * @param {string} [chars=whitespace] The characters to trim.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
 * @returns {string} Returns the trimmed string.
 * @example
 *
 * _.trimStart('  abc  ');
 * // => 'abc  '
 *
 * _.trimStart('-_-abc-_-', '_-');
 * // => 'abc-_-'
 */
function trimStart(string, chars, guard) {
  string = toString(string);
  if (string && (guard || chars === undefined)) {
    return string.replace(reTrimStart, '');
  }
  if (!string || !(chars = baseToString(chars))) {
    return string;
  }
  var strSymbols = stringToArray(string),
      start = charsStartIndex(strSymbols, stringToArray(chars));

  return castSlice(strSymbols, start).join('');
}

module.exports = trimStart;


/***/ }),

/***/ "./images/dashboard/widget-area.svg":
/*!******************************************!*\
  !*** ./images/dashboard/widget-area.svg ***!
  \******************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTExLjI2MiA1NS42N2wtMS42MjguNjRhMSAxIDAgMDAtLjYzNC45M1Y3My41aDE0MVY0OS40NmExIDEgMCAwMC0xLjYxNC0uNzlsLTEuNDAzIDEuMDkxYTEuMDE1IDEuMDE1IDAgMDEtLjIyNC4xMzJsLTIuMTguOTI1YTEgMSAwIDAxLS45NjgtLjEwNGwtMi4xMjgtMS41MDRhLjk5OC45OTggMCAwMC0uNTE0LS4xODJsLTIuNTMxLS4xNTktMi4xMTYuMTMzYTEuMDAxIDEuMDAxIDAgMDEtLjk3OS0uNTk2bC0yLjI1Mi01LjEyOGExIDEgMCAwMC0uOTc4LS41OTZsLTIuMTE3LjEzMy0yLjgxMy4wNDQtMi4wMzMuMTZhMSAxIDAgMDEtMS4wMjgtLjY4M2wtMi40NzktNy40NzVhMSAxIDAgMDAtLjMwMi0uNDQ4bC0yLjMxNi0xLjk2NGExLjAwMyAxLjAwMyAwIDAxLS4zNDEtLjYxbC0xLjU3NC0xMC4xODVjLS4xNzktMS4xNTktMS44NjItMS4xMTctMS45ODMuMDVsLTEuOTYxIDE4Ljg4MWExIDEgMCAwMS0uNDkzLjc2MmwtMi4wODIgMS4yMWEuOTk4Ljk5OCAwIDAxLS42MjcuMTI3bC0xLjc4NC0uMjI0YTEgMSAwIDAwLTEuMDE0LjUzNWwtMi4wMDIgMy44OTlhMSAxIDAgMDEtMS40MTIuMzk2bC0xLjUyMS0uOTMyYTEgMSAwIDAwLS43OTQtLjExbC0yLjE1Ny42MWEuOTk5Ljk5OSAwIDAwLS40MTQuMjM1bC0yLjYzNiAyLjQ4My0yLjU3MiAxLjk4YTEgMSAwIDAxLS41NDcuMjA1bC0yLjM2LjE0OGExIDEgMCAwMS0uMjkzLS4wMjRsLTIuMDE3LS40NzVhMSAxIDAgMDEtLjc1OC0uODE2bC0yLjcwOS0xNi45NzItMS40MTQtNS41NTRjLS4yNzYtMS4wODQtMS44NTMtLjk2Ni0xLjk2NC4xNDdsLTIuMDQgMjAuMzgxYTEgMSAwIDAxLTEuNjk5LjYxMWwtLjkzLS45MmExIDEgMCAwMC0uOTMzLS4yNjNsLTIuMjc1LjUzNi0yLjgxNC4zNTQtMi40NDUuMDc2YTEgMSAwIDAxLS42NTctLjIxOWwtMS43OTgtMS40NGExIDEgMCAwMC0xLjM2LjEwMmwtMi4wMyAyLjIwMWExIDEgMCAwMS0uMzU3LjI0OGwtMi4xODcuODkzYTEgMSAwIDAxLS44MjgtLjAzM2wtMi4yMzItMS4xMjJhMSAxIDAgMDAtLjM3LS4xMDNsLTIuNDQ4LS4xOTJhMS4wMDEgMS4wMDEgMCAwMC0uMzM3LjAzbC0xLjU3Ny40MjJhMSAxIDAgMDEtMS4yNDUtLjgxbC0xLjUwNy05LjQ2Yy0uMTc4LTEuMTE0LTEuNzc3LTEuMTI4LTEuOTczLS4wMTdsLTEuODMzIDEwLjM5MWExIDEgMCAwMS0uOTUzLjgyNmwtMS44MDMuMDU3YTEgMSAwIDAxLS4zODQtLjA2NGwtMi40MjctLjkxNWEuOTk5Ljk5OSAwIDAwLS40MTYtLjA2MmwtMi41MDUuMTU3YTEuMDAyIDEuMDAyIDAgMDEtLjE4OC0uMDA2bC0yLjU1LS4zMmExIDEgMCAwMS0uMzI0LS4wOTlsLTIuMTU2LTEuMDg0YTEgMSAwIDAwLS45ODEuMDQ3bC0yLjI0NiAxLjQxYTEgMSAwIDAxLS4xOTIuMDk0bC0yLjcxMy45OC0yLjYzNS43ODdhLjk5OS45OTkgMCAwMS0uMzY0LjAzOGwtMi4zMTEtLjE4MWExIDEgMCAwMS0uNTYyLS4yMjhsLTIuNDgtMi4wNjRhMS4wMDYgMS4wMDYgMCAwMC0uMTk0LS4xMjdsLTMuMTc4LTEuNTc3YTEgMSAwIDAwLTEuNDM2Ljc3bC0uODM0IDYuNTQ3YTEgMSAwIDAxLS42MjcuODA0eiIgZmlsbD0iIzdBNTA4OCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-bar.svg":
/*!*****************************************!*\
  !*** ./images/dashboard/widget-bar.svg ***!
  \*****************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iI0I4NTU4NiIgZD0iTTE0MCA1MmgtOHYyMmg4ek0xMTggMzRoLTh2NDBoOHpNOTYgNDhoLTh2MjZoOHpNNzQgNDVoLTh2MjloOHpNNTIgMzRoLTh2NDBoOHpNMzAgNDVoLTh2MjloOHpNMTI5IDQ1aC04djI5aDh6TTE1MSAzOWgtOHYzNWg4ek0xMDcgMzloLTh2MzVoOHpNODUgMzloLTh2MzVoOHpNNjMgMzRoLTh2NDBoOHpNNDEgMjZoLTh2NDhoOHpNMTkgNTJoLTh2MjJoOHoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-big-number.svg":
/*!************************************************!*\
  !*** ./images/dashboard/widget-big-number.svg ***!
  \************************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjQ2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djQ0SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzLjV2NDJIMTU4VjN6TTIuNSAydjQ0SDE1OVYySDIuNXoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbD0iIzQ0NDY3NCIgZD0iTTkgMTloNjB2MTdIOXoiLz48L3N2Zz4=";

/***/ }),

/***/ "./images/dashboard/widget-line-1.svg":
/*!********************************************!*\
  !*** ./images/dashboard/widget-line-1.svg ***!
  \********************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0wIDBoMTU3djc5SDB6Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzek0yIDJ2NzloMTU3VjJIMnoiIGZpbGw9IiM0NDQ2NzQiLz48cmVjdCB4PSI5IiB5PSIxMCIgd2lkdGg9IjI5IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00My4wNTYgMjEuNTg2Yy4wMjUuMDIxLjA2My4wNjQuMDcxLjE3M2wxLjk4IDI2LjQyMmMuMDM2LjQ4Mi4yNy45MjguNjQ3IDEuMjMybDIuMTIzIDEuNzFhMS43NSAxLjc1IDAgMDAxLjM5OS4zNjFsMS41NDctLjI2OWEuMjUuMjUgMCAwMS4yNzcuMTZsMi4wMjkgNS40NzZhMS43NSAxLjc1IDAgMDAyLjc3NC43MjdsMS4yNy0xLjA3OGEuMjUuMjUgMCAwMS4yNTItLjA0M2wxLjk5OC43ODNhLjI1LjI1IDAgMDEuMTA3LjA4MWwyLjY0NSAzLjQ1NS4wNDguMDU3IDIuNTUyIDIuNzIzYy4yOTUuMzE0LjY5NS41MDkgMS4xMjUuNTQ2bDIuMjMuMTk0Yy4yMzQuMDIuNDctLjAwNi42OTUtLjA4bDIuMDEtLjY1NmExLjc1IDEuNzUgMCAwMDEuMTk1LTEuNDY0bDIuNzM4LTIzLjc4MyAxLjM5My03LjU4MmMuMDE4LS4xMDIuMDU4LS4xNC4wODYtLjE2YS4yNzYuMjc2IDAgMDEuMTczLS4wNDUuMjc1LjI3NSAwIDAxLjE2OC4wNjNjLjAyNS4wMjMuMDYuMDY2LjA2OC4xNjlsMi4wNTIgMjguNDI0Yy4xMTggMS42MjYgMi4yIDIuMjIyIDMuMTYuOTA0bC43NzctMS4wNjZhLjI1LjI1IDAgMDEuMjgtLjA5bDIuMDU1LjY3MWMuMDguMDI2LjE2LjA0Ni4yNDMuMDZsMi43NDMuNDc5LjA5Ni4wMSAyLjM0My4xMDJhMS43NSAxLjc1IDAgMDAxLjM3Ny0uNTc3bDEuNjM2LTEuODE3YS4yNS4yNSAwIDAxLjM5NC4wMjhsMS45NjggMi45NTdjLjE1Mi4yMjkuMzU2LjQxOC41OTUuNTUzbDIuMDU4IDEuMTY2YTEuNzUgMS43NSAwIDAwMS44NjMtLjA4N2wyLjA4Ny0xLjQ1NWEuMjU1LjI1NSAwIDAxLjExNi0uMDQ0bDIuMzI2LS4yNTNhLjI1Mi4yNTIgMCAwMS4xMTQuMDE0bDEuMzk3LjUxOGExLjc1IDEuNzUgMCAwMDIuMzQ3LTEuNDQybDEuNTMtMTMuMzE5Yy4wMTItLjEwNC4wNDktLjE0NS4wNzYtLjE2N2EuMjczLjI3MyAwIDAxLjE3MS0uMDU0Yy4wNzYgMCAuMTM2LjAyMy4xNzIuMDUyLjAyNi4wMjEuMDY0LjA2My4wNzcuMTY2bDEuODYgMTQuNjE5YTEuNzUgMS43NSAwIDAwMS42NiAxLjUyN2wxLjcwMy4wNzVhMS43NSAxLjc1IDAgMDAuODg3LS4xOThsMi4zMTctMS4yMWEuMjQ5LjI0OSAwIDAxLjEzNy0uMDI4bDIuMzkzLjIwOGMuMTUxLjAxNC4zMDMuMDA3LjQ1Mi0uMDE5bDIuNDY4LS40M2MuMjUxLS4wNDMuNDktLjE0Mi43LS4yODhsMS45OTItMS4zODhhLjI1LjI1IDAgMDEuMzA3LjAxN2wyLjEzIDEuODU1Yy4xMTEuMDk3LjIzNC4xNzkuMzY1LjI0NWwyLjcwMSAxLjM1Mi4wNDkuMDIzIDIuNTc4IDEuMDY2Yy4yNzEuMTEyLjU2Ni4xNTQuODU4LjEyM2wyLjE2OS0uMjM2YTEuNzUgMS43NSAwIDAwMS4xMzMtLjU5NGwyLjQ3NC0yLjg1NGEuMjEyLjIxMiAwIDAxLjA0Ny0uMDQybDMuMDI5LTIuMDg1YS4yNS4yNSAwIDAxLjM5MS4xODNsLjg4MSA5LjU5M2MuMDU0LjU4Mi4zOTQgMS4wOTguOTA2IDEuMzc3bDIuMzQ1IDEuMjc3LjcxOC0xLjMxOC0yLjM0NS0xLjI3NmEuMjUuMjUgMCAwMS0uMTMtLjE5N2wtLjg4MS05LjU5M2MtLjEyMy0xLjMzMi0xLjYzMy0yLjA0LTIuNzM1LTEuMjgxbC0zLjAzIDIuMDg0YTEuNzUgMS43NSAwIDAwLS4zMy4yOTZsLTIuNDczIDIuODU0YS4yNDkuMjQ5IDAgMDEtLjE2Mi4wODRsLTIuMTY5LjIzNmEuMjUxLjI1MSAwIDAxLS4xMjMtLjAxN2wtMi41NTMtMS4wNTYtMi42NzYtMS4zNGEuMjQzLjI0MyAwIDAxLS4wNTItLjAzNWwtMi4xMy0xLjg1NWExLjc1IDEuNzUgMCAwMC0yLjE1LS4xMTZsLTEuOTkyIDEuMzg4YS4yNS4yNSAwIDAxLS4xLjA0bC0yLjQ2Ny40M2EuMjUxLjI1MSAwIDAxLS4wNjUuMDAzbC0yLjM5My0uMjA4YTEuNzUgMS43NSAwIDAwLS45NjIuMTkybC0yLjMxNyAxLjIxYS4yNDcuMjQ3IDAgMDEtLjEyNi4wMjlsLTEuNzA0LS4wNzRhLjI1LjI1IDAgMDEtLjIzNy0uMjE4bC0xLjg2LTE0LjYyYy0uMjYxLTIuMDUtMy4yMzgtMi4wMzItMy40NzQuMDIybC0xLjUzMSAxMy4zMmEuMjUuMjUgMCAwMS0uMzM1LjIwNWwtMS4zOTgtLjUxN2ExLjc0NyAxLjc0NyAwIDAwLS43OTYtLjA5OWwtMi4zMjYuMjUzYTEuNzUgMS43NSAwIDAwLS44MTEuMzA0bC0yLjA4OCAxLjQ1NWEuMjUuMjUgMCAwMS0uMjY2LjAxMmwtMi4wNTgtMS4xNjVhLjI1LjI1IDAgMDEtLjA4NS0uMDhsLTEuOTY4LTIuOTU2YTEuNzUgMS43NSAwIDAwLTIuNzU4LS4yMDFsLTEuNjM2IDEuODE3YS4yNS4yNSAwIDAxLS4xOTcuMDgzbC0yLjI5NC0uMS0yLjY5Ni0uNDdhLjI0MS4yNDEgMCAwMS0uMDM0LS4wMDlsLTIuMDU1LS42N2ExLjc1IDEuNzUgMCAwMC0xLjk1OC42MzJsLS43NzcgMS4wNjZhLjI1LjI1IDAgMDEtLjQ1MS0uMTNMNzguMTUyIDMwLjY1Yy0uMTQ4LTIuMDUtMy4wOTUtMi4yMS0zLjQ2Ny0uMTlsLTEuMzk3IDcuNjA3LS4wMDguMDUtMi43NCAyMy44MDhhLjI1LjI1IDAgMDEtLjE3LjIxbC0yLjAxMS42NTZhLjI0OC4yNDggMCAwMS0uMS4wMTFsLTIuMjI5LS4xOTRhLjI1LjI1IDAgMDEtLjE2LS4wNzhsLTIuNTI3LTIuNjk2LTIuNjIyLTMuNDI1YTEuNzUgMS43NSAwIDAwLS43NS0uNTY1bC0xLjk5OC0uNzgzYTEuNzUgMS43NSAwIDAwLTEuNzcyLjI5NWwtMS4yNyAxLjA3OGEuMjUuMjUgMCAwMS0uMzk1LS4xMDRsLTIuMDI5LTUuNDc3YTEuNzUgMS43NSAwIDAwLTEuOTQxLTEuMTE2bC0xLjU0OC4yN2EuMjUuMjUgMCAwMS0uMi0uMDUybC0yLjEyMy0xLjcxYS4yNS4yNSAwIDAxLS4wOTMtLjE3N2wtMS45OC0yNi40MmMtLjE1OC0yLjEyMS0zLjI0OC0yLjE3Ny0zLjQ4NC0uMDY0bC0xLjU5IDE0LjI3YS4yNS4yNSAwIDAxLS4wNTguMTM1bC0yLjQ2MSAyLjg5M2ExLjc1IDEuNzUgMCAwMC0uMzY5LjcyN2wtMi41NTMgMTAuNjczYS4yNS4yNSAwIDAxLS4yNy4xOWwtMS45MzgtLjIxLS4wNjUtLjAwNS0yLjc5LS4wNi0xLjk5MS0uMTc0YTEuNzUgMS43NSAwIDAwLTEuODIgMS4yMTVsLTIuMzMgNy4zNTZhLjI1LjI1IDAgMDEtLjI2LjE3NGwtMS45My0uMTY4YTEuNzUgMS43NSAwIDAwLS4zMDMgMGwtMi4zNy4yMDZhMS43NSAxLjc1IDAgMDAtMS4wNzMuNDk0bC0yLjAxIDEuOTdhLjI1LjI1IDAgMDEtLjMwMy4wMzdsLTIuMDI3LTEuMTkyYS4yNDguMjQ4IDAgMDEtLjA1Ny0uMDQ1bC0zLjAyLTMuMjU3LTEuMSAxLjAyIDMuMDIgMy4yNTdjLjExNi4xMjUuMjUuMjMyLjM5Ny4zMThsMi4wMjcgMS4xOTJhMS43NSAxLjc1IDAgMDAyLjExMi0uMjU4bDIuMDExLTEuOTdhLjI1LjI1IDAgMDEuMTUzLS4wNzFsMi4zNy0uMjA3YS4yNjIuMjYyIDAgMDEuMDQ0IDBsMS45MjkuMTY4YTEuNzUgMS43NSAwIDAwMS44Mi0xLjIxNWwyLjMzLTcuMzU2YS4yNS4yNSAwIDAxLjI2LS4xNzNsMi4wMTYuMTc1LjA0OC4wMDMgMi43ODIuMDYgMS45MDUuMjA4YTEuNzUgMS43NSAwIDAwMS44OTItMS4zMzNsMi41NTMtMTAuNjczYS4yNS4yNSAwIDAxLjA1My0uMTA0bDIuNDYtMi44OTNhMS43NSAxLjc1IDAgMDAuNDA2LS45NGwxLjU5MS0xNC4yN2MuMDEyLS4xMS4wNTEtLjE1LjA3Ny0uMTcxYS4yOC4yOCAwIDAxLjE3Ni0uMDUyYy4wNzkuMDAxLjE0LjAyOC4xNzUuMDU4eiIgZmlsbD0iIzQ0NDY3NCIvPjwvc3ZnPg==";

/***/ }),

/***/ "./images/dashboard/widget-table.svg":
/*!*******************************************!*\
  !*** ./images/dashboard/widget-table.svg ***!
  \*******************************************/
/***/ ((module) => {

"use strict";
module.exports = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTU5IiBoZWlnaHQ9IjgxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDBoMTU3djc5SDBWMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNOSAxMWExIDEgMCAwMTEtMWgyN2ExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PHBhdGggZD0iTTEgMjBoMTU3djEzSDFWMjB6IiBmaWxsPSIjQzFCMkREIi8+PHBhdGggZD0iTTkgNDJhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xeiIgZmlsbD0iI0Q0RDFFQyIvPjxwYXRoIGQ9Ik05IDI3YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDI3YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjQTM5NkRBIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTggM0gzdjc3aDE1NVYzem0xLTF2NzlIMlYyaDE1N3oiIGZpbGw9IiM0NDQ2NzQiLz48cGF0aCBkPSJNMTIyIDQyYTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6TTkgNTFhMSAxIDAgMDExLTFoNDBhMSAxIDAgMTEwIDJIMTBhMSAxIDAgMDEtMS0xek0xMjIgNTFhMSAxIDAgMDExLTFoMjZhMSAxIDAgMDEwIDJoLTI2YTEgMSAwIDAxLTEtMXpNOSA2MGExIDEgMCAwMTEtMWg0MGExIDEgMCAxMTAgMkgxMGExIDEgMCAwMS0xLTF6TTEyMiA2MGExIDEgMCAwMTEtMWgyNmExIDEgMCAwMTAgMmgtMjZhMSAxIDAgMDEtMS0xek05IDY5YTEgMSAwIDAxMS0xaDQwYTEgMSAwIDExMCAySDEwYTEgMSAwIDAxLTEtMXpNMTIyIDY5YTEgMSAwIDAxMS0xaDI2YTEgMSAwIDAxMCAyaC0yNmExIDEgMCAwMS0xLTF6IiBmaWxsPSIjRDREMUVDIi8+PC9zdmc+";

/***/ }),

/***/ "./images/dashboard/widget-world-map.svg":
/*!***********************************************!*\
  !*** ./images/dashboard/widget-world-map.svg ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "assets/widget-world-map.b5c5097ff7a4945389d2.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_dashboardWidgetQuerySelectorModal_tsx-app_stores_organizationStore_tsx--d53a78.25e34d0d790521281cbe40fdda1e0961.js.map