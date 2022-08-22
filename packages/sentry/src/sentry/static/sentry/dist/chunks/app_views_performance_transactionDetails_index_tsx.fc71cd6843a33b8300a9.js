"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_performance_transactionDetails_index_tsx"],{

/***/ "./app/components/events/eventMetadata.tsx":
/*!*************************************************!*\
  !*** ./app/components/events/eventMetadata.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













/**
 * Render metadata about the event and provide a link to the JSON blob.
 * Used in the sidebar of performance event details and discover2 event details.
 */
function EventMetadata(_ref) {
  let {
    event,
    organization,
    projectId
  } = _ref;
  const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${event.eventID}/json/`;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MetaDataID, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_1__.SectionHeading, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Event ID')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(MetadataContainer, {
      "data-test-id": "event-id",
      children: event.eventID
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(MetadataContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
        date: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_8__["default"])({
          value: event.dateCreated || (event.endTimestamp || 0) * 1000,
          fixed: 'Dummy timestamp'
        })
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_9__["default"], {
      orgId: organization.slug,
      slugs: [projectId],
      children: _ref2 => {
        let {
          projects
        } = _ref2;
        const project = projects.find(p => p.slug === projectId);
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledProjectBadge, {
          project: project ? project : {
            slug: projectId
          },
          avatarSize: 16
        });
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(MetadataJSON, {
      href: eventJsonUrl,
      className: "json-link",
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Preview JSON'), " (", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_3__["default"], {
        bytes: event.size
      }), ")"]
    })]
  });
}

EventMetadata.displayName = "EventMetadata";

const MetaDataID = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "er0il1f3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(4), ";" + ( true ? "" : 0));

const MetadataContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "er0il1f2"
} : 0)("display:flex;justify-content:space-between;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const MetadataJSON = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "er0il1f1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StyledProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "er0il1f0"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(2), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMetadata);

/***/ }),

/***/ "./app/components/events/rootSpanStatus.tsx":
/*!**************************************************!*\
  !*** ./app/components/events/rootSpanStatus.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/styles */ "./app/components/charts/styles.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








class RootSpanStatus extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
  getTransactionEvent() {
    const {
      event
    } = this.props;

    if (event.type === 'transaction') {
      return event;
    }

    return undefined;
  }

  getRootSpanStatus() {
    var _event$contexts, _traceContext$status;

    const event = this.getTransactionEvent();
    const DEFAULT = '\u2014';

    if (!event) {
      return DEFAULT;
    }

    const traceContext = event === null || event === void 0 ? void 0 : (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : _event$contexts.trace;
    return (_traceContext$status = traceContext === null || traceContext === void 0 ? void 0 : traceContext.status) !== null && _traceContext$status !== void 0 ? _traceContext$status : DEFAULT;
  }

  getHttpStatusCode() {
    const {
      event
    } = this.props;
    const {
      tags
    } = event;

    if (!Array.isArray(tags)) {
      return '';
    }

    const tag = tags.find(tagObject => tagObject.key === 'http.status_code');

    if (!tag) {
      return '';
    }

    return tag.value;
  }

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    const label = `${this.getHttpStatusCode()} ${this.getRootSpanStatus()}`.trim();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(Container, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_charts_styles__WEBPACK_IMPORTED_MODULE_2__.SectionHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Status')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("div", {
        children: label
      })]
    });
  }

}

RootSpanStatus.displayName = "RootSpanStatus";

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1mhywwu1"
} : 0)("color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeMedium, ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(4), ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1mhywwu0"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RootSpanStatus);

/***/ }),

/***/ "./app/components/pageAlertBar.tsx":
/*!*****************************************!*\
  !*** ./app/components/pageAlertBar.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const PageAlertBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eb4vrz50"
} : 0)("display:flex;align-items:center;justify-content:center;color:", p => p.theme.headerBackground, ";background-color:", p => p.theme.bannerBackground, ";padding:6px 30px;font-size:14px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageAlertBar);

/***/ }),

/***/ "./app/utils/profiling/routes.tsx":
/*!****************************************!*\
  !*** ./app/utils/profiling/routes.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateProfileDetailsRoute": () => (/* binding */ generateProfileDetailsRoute),
/* harmony export */   "generateProfileDetailsRouteWithQuery": () => (/* binding */ generateProfileDetailsRouteWithQuery),
/* harmony export */   "generateProfileFlamechartRoute": () => (/* binding */ generateProfileFlamechartRoute),
/* harmony export */   "generateProfileFlamechartRouteWithQuery": () => (/* binding */ generateProfileFlamechartRouteWithQuery),
/* harmony export */   "generateProfileSummaryRoute": () => (/* binding */ generateProfileSummaryRoute),
/* harmony export */   "generateProfileSummaryRouteWithQuery": () => (/* binding */ generateProfileSummaryRouteWithQuery),
/* harmony export */   "generateProfilingRoute": () => (/* binding */ generateProfilingRoute),
/* harmony export */   "generateProfilingRouteWithQuery": () => (/* binding */ generateProfilingRouteWithQuery)
/* harmony export */ });
function generateProfilingRoute(_ref) {
  let {
    orgSlug
  } = _ref;
  return `/organizations/${orgSlug}/profiling/`;
}
function generateProfileSummaryRoute(_ref2) {
  let {
    orgSlug,
    projectSlug
  } = _ref2;
  return `/organizations/${orgSlug}/profiling/summary/${projectSlug}/`;
}
function generateProfileFlamechartRoute(_ref3) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref3;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/flamechart/`;
}
function generateProfileDetailsRoute(_ref4) {
  let {
    orgSlug,
    projectSlug,
    profileId
  } = _ref4;
  return `/organizations/${orgSlug}/profiling/profile/${projectSlug}/${profileId}/details/`;
}
function generateProfilingRouteWithQuery(_ref5) {
  let {
    location,
    orgSlug,
    query
  } = _ref5;
  const pathname = generateProfilingRoute({
    orgSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileSummaryRouteWithQuery(_ref6) {
  let {
    location,
    orgSlug,
    projectSlug,
    transaction,
    query
  } = _ref6;
  const pathname = generateProfileSummaryRoute({
    orgSlug,
    projectSlug
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query,
      transaction
    }
  };
}
function generateProfileFlamechartRouteWithQuery(_ref7) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref7;
  const pathname = generateProfileFlamechartRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}
function generateProfileDetailsRouteWithQuery(_ref8) {
  let {
    location,
    orgSlug,
    projectSlug,
    profileId,
    query
  } = _ref8;
  const pathname = generateProfileDetailsRoute({
    orgSlug,
    projectSlug,
    profileId
  });
  return {
    pathname,
    query: { ...(location === null || location === void 0 ? void 0 : location.query),
      ...query
    }
  };
}

/***/ }),

/***/ "./app/views/performance/transactionDetails/content.tsx":
/*!**************************************************************!*\
  !*** ./app/views/performance/transactionDetails/content.tsx ***!
  \**************************************************************/
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/errors/notFound */ "./app/components/errors/notFound.tsx");
/* harmony import */ var sentry_components_events_eventCustomPerformanceMetrics__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/events/eventCustomPerformanceMetrics */ "./app/components/events/eventCustomPerformanceMetrics.tsx");
/* harmony import */ var sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/events/eventEntries */ "./app/components/events/eventEntries.tsx");
/* harmony import */ var sentry_components_events_eventMetadata__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/events/eventMetadata */ "./app/components/events/eventMetadata.tsx");
/* harmony import */ var sentry_components_events_eventVitals__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/events/eventVitals */ "./app/components/events/eventVitals.tsx");
/* harmony import */ var sentry_components_events_interfaces_spans_context__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/events/interfaces/spans/context */ "./app/components/events/interfaces/spans/context.tsx");
/* harmony import */ var sentry_components_events_rootSpanStatus__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/events/rootSpanStatus */ "./app/components/events/rootSpanStatus.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_tagsTable__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/tagsTable */ "./app/components/tagsTable.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceContext */ "./app/utils/performance/quickTrace/quickTraceContext.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/quickTraceQuery */ "./app/utils/performance/quickTrace/quickTraceQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_traceMetaQuery__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/traceMetaQuery */ "./app/utils/performance/quickTrace/traceMetaQuery.tsx");
/* harmony import */ var sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/performance/quickTrace/utils */ "./app/utils/performance/quickTrace/utils.tsx");
/* harmony import */ var sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/performance/urls */ "./app/utils/performance/urls.ts");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_views_performance_breadcrumb__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/views/performance/breadcrumb */ "./app/views/performance/breadcrumb.tsx");
/* harmony import */ var _transactionSummary_utils__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ../transactionSummary/utils */ "./app/views/performance/transactionSummary/utils.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! ../utils */ "./app/views/performance/utils.tsx");
/* harmony import */ var _eventMetas__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./eventMetas */ "./app/views/performance/transactionDetails/eventMetas.tsx");
/* harmony import */ var _finishSetupAlert__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! ./finishSetupAlert */ "./app/views/performance/transactionDetails/finishSetupAlert.tsx");
/* harmony import */ var _transactionToProfileButton__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! ./transactionToProfileButton */ "./app/views/performance/transactionDetails/transactionToProfileButton.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







































class EventDetailsContent extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      // AsyncComponent state
      loading: true,
      reloading: false,
      error: false,
      errors: {},
      event: undefined,
      // local state
      isSidebarVisible: true
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleSidebar", () => {
      this.setState({
        isSidebarVisible: !this.state.isSidebarVisible
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "generateTagUrl", tag => {
      const {
        location,
        organization
      } = this.props;
      const {
        event
      } = this.state;

      if (!event) {
        return '';
      }

      const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_29__.decodeScalar)(location.query.query, '');
      const newQuery = { ...location.query,
        query: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_29__.appendTagCondition)(query, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_22__.formatTagKey)(tag.key), tag.value)
      };
      return (0,_transactionSummary_utils__WEBPACK_IMPORTED_MODULE_31__.transactionSummaryRouteWithQuery)({
        orgSlug: organization.slug,
        transaction: event.title,
        projectID: event.projectID,
        query: newQuery
      });
    });
  }

  getEndpoints() {
    const {
      organization,
      params
    } = this.props;
    const {
      eventSlug
    } = params;
    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;
    return [['event', url]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  renderBody() {
    const {
      event
    } = this.state;
    const {
      organization
    } = this.props;

    if (!event) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_7__["default"], {});
    }

    const isSampleTransaction = event.tags.some(tag => tag.key === 'sample_event' && tag.value === 'yes');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [isSampleTransaction && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(_finishSetupAlert__WEBPACK_IMPORTED_MODULE_34__["default"], {
        organization: organization,
        projectId: this.projectId
      }), this.renderContent(event)]
    });
  }

  renderContent(event) {
    var _event$contexts$trace, _event$contexts, _event$contexts$trace2;

    const {
      organization,
      location,
      eventSlug,
      route,
      router,
      projects
    } = this.props; // metrics

    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_21__.trackAnalyticsEvent)({
      eventKey: 'performance.event_details',
      eventName: 'Performance: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
      project_platforms: (0,_utils__WEBPACK_IMPORTED_MODULE_32__.getSelectedProjectPlatforms)(location, projects)
    });
    const {
      isSidebarVisible
    } = this.state;
    const transactionName = event.title;
    const query = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_29__.decodeScalar)(location.query.query, '');
    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${event.eventID}/json/`;
    const traceId = (_event$contexts$trace = (_event$contexts = event.contexts) === null || _event$contexts === void 0 ? void 0 : (_event$contexts$trace2 = _event$contexts.trace) === null || _event$contexts$trace2 === void 0 ? void 0 : _event$contexts$trace2.trace_id) !== null && _event$contexts$trace !== void 0 ? _event$contexts$trace : '';
    const {
      start,
      end
    } = (0,sentry_utils_performance_quickTrace_utils__WEBPACK_IMPORTED_MODULE_26__.getTraceTimeRangeFromEvent)(event);
    const hasProfilingFeature = organization.features.includes('profiling');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_utils_performance_quickTrace_traceMetaQuery__WEBPACK_IMPORTED_MODULE_25__["default"], {
      location: location,
      orgSlug: organization.slug,
      traceId: traceId,
      start: start,
      end: end,
      children: metaResults => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_utils_performance_quickTrace_quickTraceQuery__WEBPACK_IMPORTED_MODULE_24__["default"], {
        event: event,
        location: location,
        orgSlug: organization.slug,
        children: results => {
          var _metaResults$meta;

          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Header, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.HeaderContent, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_views_performance_breadcrumb__WEBPACK_IMPORTED_MODULE_30__["default"], {
                  organization: organization,
                  location: location,
                  transaction: {
                    project: event.projectID,
                    name: transactionName
                  },
                  eventSlug: eventSlug
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Title, {
                  "data-test-id": "event-header",
                  children: event.title
                })]
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.HeaderActions, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
                  gap: 1,
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    onClick: this.toggleSidebar,
                    children: isSidebarVisible ? 'Hide Details' : 'Show Details'
                  }), results && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconOpen, {}),
                    href: eventJsonUrl,
                    external: true,
                    children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('JSON'), " (", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_14__["default"], {
                      bytes: event.size
                    }), ")"]
                  }), hasProfilingFeature && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(_transactionToProfileButton__WEBPACK_IMPORTED_MODULE_35__.TransactionToProfileButton, {
                    orgId: organization.slug,
                    projectId: this.projectId,
                    transactionId: event.eventID
                  })]
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Body, {
              children: [results && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Main, {
                fullWidth: true,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(_eventMetas__WEBPACK_IMPORTED_MODULE_33__["default"], {
                  quickTrace: results,
                  meta: (_metaResults$meta = metaResults === null || metaResults === void 0 ? void 0 : metaResults.meta) !== null && _metaResults$meta !== void 0 ? _metaResults$meta : null,
                  event: event,
                  organization: organization,
                  projectId: this.projectId,
                  location: location,
                  errorDest: "issue",
                  transactionDest: "performance"
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Main, {
                fullWidth: !isSidebarVisible,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_28__["default"], {
                  orgId: organization.slug,
                  slugs: [this.projectId],
                  children: _ref => {
                    let {
                      projects: _projects
                    } = _ref;
                    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_interfaces_spans_context__WEBPACK_IMPORTED_MODULE_12__.Provider, {
                      value: {
                        getViewChildTransactionTarget: childTransactionProps => {
                          return (0,sentry_utils_performance_urls__WEBPACK_IMPORTED_MODULE_27__.getTransactionDetailsUrl)(organization.slug, childTransactionProps.eventSlug, childTransactionProps.transaction, location.query);
                        }
                      },
                      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_utils_performance_quickTrace_quickTraceContext__WEBPACK_IMPORTED_MODULE_23__.QuickTraceContext.Provider, {
                        value: results,
                        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_eventEntries__WEBPACK_IMPORTED_MODULE_9__.BorderlessEventEntries, {
                          organization: organization,
                          event: event,
                          project: _projects[0],
                          showExampleCommit: false,
                          showTagSummary: false,
                          location: location,
                          api: this.api,
                          router: router,
                          route: route
                        })
                      })
                    });
                  }
                })
              }), isSidebarVisible && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_15__.Side, {
                children: [results === undefined && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_eventMetadata__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    event: event,
                    organization: organization,
                    projectId: this.projectId
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_rootSpanStatus__WEBPACK_IMPORTED_MODULE_13__["default"], {
                    event: event
                  })]
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_eventVitals__WEBPACK_IMPORTED_MODULE_11__["default"], {
                  event: event
                }), (organization.features.includes('dashboards-mep') || organization.features.includes('mep-rollout-flag')) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_events_eventCustomPerformanceMetrics__WEBPACK_IMPORTED_MODULE_8__["default"], {
                  event: event,
                  location: location,
                  organization: organization
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_tagsTable__WEBPACK_IMPORTED_MODULE_18__.TagsTable, {
                  event: event,
                  query: query,
                  generateUrl: this.generateTagUrl
                })]
              })]
            })]
          });
        }
      })
    });
  }

  renderError(error) {
    const notFound = Object.values(this.state.errors).find(resp => resp && resp.status === 404);
    const permissionDenied = Object.values(this.state.errors).find(resp => resp && resp.status === 403);

    if (notFound) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_errors_notFound__WEBPACK_IMPORTED_MODULE_7__["default"], {});
    }

    if (permissionDenied) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_16__["default"], {
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('You do not have permission to view that event.')
      });
    }

    return super.renderError(error, true);
  }

  renderComponent() {
    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_36__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_17__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Performance - Event Details'),
      orgSlug: organization.slug,
      children: super.renderComponent()
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventDetailsContent);

/***/ }),

/***/ "./app/views/performance/transactionDetails/finishSetupAlert.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/performance/transactionDetails/finishSetupAlert.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FinishSetupAlert)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_pageAlertBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/pageAlertBar */ "./app/components/pageAlertBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function FinishSetupAlert(_ref) {
  let {
    organization,
    projectId
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_pageAlertBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconLightning, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(TextWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You are viewing a sample transaction. Configure performance to start viewing real transactions.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
      size: "xs",
      priority: "primary",
      external: true,
      href: "https://docs.sentry.io/performance-monitoring/getting-started/",
      onClick: () => (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('growth.sample_transaction_docs_link_clicked', {
        project_id: projectId,
        organization
      }),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Get Started')
    })]
  });
}
FinishSetupAlert.displayName = "FinishSetupAlert";

const TextWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e63o3h0"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/performance/transactionDetails/index.tsx":
/*!************************************************************!*\
  !*** ./app/views/performance/transactionDetails/index.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_organization__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/organization */ "./app/styles/organization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _content__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./content */ "./app/views/performance/transactionDetails/content.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function EventDetails(props) {
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_5__["default"])();

  const getEventSlug = () => {
    const {
      eventSlug
    } = props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  const {
    organization,
    location,
    params,
    router,
    route
  } = props;
  const documentTitle = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Performance Details');
  const eventSlug = getEventSlug();
  const projectSlug = eventSlug.split(':')[0];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_2__["default"], {
    title: documentTitle,
    orgSlug: organization.slug,
    projectSlug: projectSlug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledPageContent, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_1__["default"], {
        organization: organization,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_content__WEBPACK_IMPORTED_MODULE_7__["default"], {
          organization: organization,
          location: location,
          params: params,
          eventSlug: eventSlug,
          router: router,
          route: route,
          projects: projects
        })
      })
    })
  });
}

EventDetails.displayName = "EventDetails";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(EventDetails));

const StyledPageContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_styles_organization__WEBPACK_IMPORTED_MODULE_4__.PageContent,  true ? {
  target: "e6cv9030"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

/***/ }),

/***/ "./app/views/performance/transactionDetails/transactionToProfileButton.tsx":
/*!*********************************************************************************!*\
  !*** ./app/views/performance/transactionDetails/transactionToProfileButton.tsx ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TransactionToProfileButton": () => (/* binding */ TransactionToProfileButton)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/routes */ "./app/utils/profiling/routes.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function TransactionToProfileButton(_ref) {
  let {
    transactionId,
    orgId,
    projectId
  } = _ref;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_6__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])();
  const [profileIdState, setProfileIdState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    type: 'initial'
  });
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    fetchProfileId(api, transactionId, orgId, projectId).then(profileId => {
      setProfileIdState({
        type: 'resolved',
        data: profileId.profile_id
      });
    }).catch(err => {
      // If there isn't a matching profile, we get a 404. No need to raise an error
      // in this case, but we should otherwise.
      if (err.status !== 404) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_8__.captureException(err);
      }
    });
  }, [api, transactionId, orgId, projectId]);

  if (profileIdState.type !== 'resolved') {
    return null;
  }

  function handleGoToProfile() {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_4__["default"])('profiling_views.go_to_flamegraph', {
      organization,
      source: 'transaction_details'
    });
  }

  const target = (0,sentry_utils_profiling_routes__WEBPACK_IMPORTED_MODULE_5__.generateProfileFlamechartRoute)({
    orgSlug: orgId,
    projectSlug: projectId,
    profileId: profileIdState.data
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    onClick: handleGoToProfile,
    to: target,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Go to Profile')
  });
}

TransactionToProfileButton.displayName = "TransactionToProfileButton";

function fetchProfileId(api, transactionId, orgId, projectId) {
  return api.requestPromise(`/projects/${orgId}/${projectId}/profiling/transactions/${transactionId}/`, {
    method: 'GET'
  });
}



/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_performance_transactionDetails_index_tsx.f4835950aa0f342f0e2d275f86762f44.js.map