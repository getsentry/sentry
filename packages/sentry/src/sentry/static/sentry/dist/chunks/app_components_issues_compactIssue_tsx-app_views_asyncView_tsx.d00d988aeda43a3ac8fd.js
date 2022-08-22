"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_issues_compactIssue_tsx-app_views_asyncView_tsx"],{

/***/ "./app/components/events/errorLevel.tsx":
/*!**********************************************!*\
  !*** ./app/components/events/errorLevel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DEFAULT_SIZE = '13px';

const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e145dcfe0"
} : 0)("padding:0;position:relative;width:", p => p.size || DEFAULT_SIZE, ";height:", p => p.size || DEFAULT_SIZE, ";text-indent:-9999em;display:inline-block;border-radius:50%;flex-shrink:0;background-color:", p => p.level ? p.theme.level[p.level] : p.theme.level.error, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorLevel);

/***/ }),

/***/ "./app/components/issues/compactIssue.tsx":
/*!************************************************!*\
  !*** ./app/components/issues/compactIssue.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompactIssue": () => (/* binding */ CompactIssue),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/eventOrGroupTitle */ "./app/components/eventOrGroupTitle.tsx");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


















function CompactIssueHeader(_ref) {
  let {
    data,
    organization,
    projectId,
    eventId
  } = _ref;
  const basePath = `/organizations/${organization.slug}/issues/`;
  const issueLink = eventId ? `/organizations/${organization.slug}/projects/${projectId}/events/${eventId}/` : `${basePath}${data.id}/`;
  const commentColor = data.subscriptionDetails && data.subscriptionDetails.reason === 'mentioned' ? 'success' : 'textColor';
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(IssueHeaderMetaWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(StyledErrorLevel, {
        size: "12px",
        level: data.level,
        title: data.level
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("h3", {
        className: "truncate",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(IconLink, {
          to: issueLink || '',
          children: [data.status === 'ignored' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconMute, {
            size: "xs"
          }), data.isBookmarked && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconStar, {
            isSolid: true,
            size: "xs"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_6__["default"], {
            data: data
          })]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)("div", {
      className: "event-extra",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("span", {
        className: "project-name",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("strong", {
          children: data.project.slug
        })
      }), data.numComments !== 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("span", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(IconLink, {
          to: `${basePath}${data.id}/activity/`,
          className: "comments",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconChat, {
            size: "xs",
            color: commentColor
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("span", {
            className: "tag-count",
            children: data.numComments
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)("span", {
        className: "culprit",
        children: (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_14__.getMessage)(data)
      })]
    })]
  });
}

CompactIssueHeader.displayName = "CompactIssueHeader";

/**
 * Type assertion to disambiguate GroupTypes
 *
 * The GroupCollapseRelease type isn't compatible with BaseGroup
 */
function isGroup(maybe) {
  return maybe.status !== undefined;
}

class CompactIssue extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      issue: this.props.data || sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_12__["default"].get(this.props.id)
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_12__["default"].listen(itemIds => this.onGroupChange(itemIds), undefined));
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        issue: sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_12__["default"].get(this.props.id)
      });
    }
  }

  componentWillUnmount() {
    this.listener();
  }

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }

    const id = this.props.id;
    const issue = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_12__["default"].get(id);
    this.setState({
      issue
    });
  }

  onUpdate(data) {
    const issue = this.state.issue;

    if (!issue) {
      return;
    }

    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Saving changes\u2026'));
    (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.bulkUpdate)(this.props.api, {
      orgId: this.props.organization.slug,
      projectId: issue.project.slug,
      itemIds: [issue.id],
      data
    }, {
      complete: () => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      }
    });
  }

  render() {
    const issue = this.state.issue;
    const {
      organization
    } = this.props;

    if (!isGroup(issue)) {
      return null;
    }

    let className = 'issue';

    if (issue.isBookmarked) {
      className += ' isBookmarked';
    }

    if (issue.hasSeen) {
      className += ' hasSeen';
    }

    if (issue.status === 'resolved') {
      className += ' isResolved';
    }

    if (issue.status === 'ignored') {
      className += ' isIgnored';
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(IssueRow, {
      className: className,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(CompactIssueHeader, {
        data: issue,
        organization: organization,
        projectId: issue.project.slug,
        eventId: this.props.eventId
      }), this.props.children]
    });
  }

}

CompactIssue.displayName = "CompactIssue";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_15__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_16__["default"])(CompactIssue)));

const IssueHeaderMetaWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1wgifuz3"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1wgifuz2"
} : 0)("display:block;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

const IconLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1wgifuz1"
} : 0)("&>svg{margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";}" + ( true ? "" : 0));

const IssueRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelItem,  true ? {
  target: "e1wgifuz0"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.75), ";flex-direction:column;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_issues_compactIssue_tsx-app_views_asyncView_tsx.2f561cd3c631aa33bc18b1400464dfe8.js.map