(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupUserFeedback_tsx"],{

/***/ "./app/views/organizationGroupDetails/groupUserFeedback.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupUserFeedback.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_events_userFeedback__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/userFeedback */ "./app/components/events/userFeedback.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_userFeedback_userFeedbackEmpty__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/userFeedback/userFeedbackEmpty */ "./app/views/userFeedback/userFeedbackEmpty.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















class GroupUserFeedback extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      loading: true,
      error: false,
      reportList: [],
      pageLinks: ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      this.setState({
        loading: true,
        error: false
      });
      (0,_utils__WEBPACK_IMPORTED_MODULE_11__.fetchGroupUserReports)(this.props.group.id, { ...this.props.params,
        cursor: this.props.location.query.cursor || ''
      }).then(_ref => {
        let [data, _, resp] = _ref;
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')
        });
      }).catch(() => {
        this.setState({
          error: true,
          loading: false
        });
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (!lodash_isEqual__WEBPACK_IMPORTED_MODULE_3___default()(prevProps.params, this.props.params) || prevProps.location.pathname !== this.props.location.pathname || prevProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  }

  render() {
    const {
      reportList,
      loading,
      error
    } = this.state;
    const {
      organization,
      group
    } = this.props;

    if (loading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_7__["default"], {});
    }

    if (error) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_6__["default"], {
        onRetry: this.fetchData
      });
    }

    if (reportList.length) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Main, {
          children: [reportList.map((item, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_events_userFeedback__WEBPACK_IMPORTED_MODULE_4__["default"], {
            report: item,
            orgId: organization.slug,
            issueId: group.id
          }, idx)), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_8__["default"], {
            pageLinks: this.state.pageLinks,
            ...this.props
          })]
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_5__.Main, {
        fullWidth: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_userFeedback_userFeedbackEmpty__WEBPACK_IMPORTED_MODULE_10__.UserFeedbackEmpty, {
          projectIds: [group.project.id]
        })
      })
    });
  }

}

GroupUserFeedback.displayName = "GroupUserFeedback";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_9__["default"])(GroupUserFeedback));

/***/ }),

/***/ "./app/views/organizationGroupDetails/utils.tsx":
/*!******************************************************!*\
  !*** ./app/views/organizationGroupDetails/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReprocessingStatus": () => (/* binding */ ReprocessingStatus),
/* harmony export */   "fetchGroupEvent": () => (/* binding */ fetchGroupEvent),
/* harmony export */   "fetchGroupUserReports": () => (/* binding */ fetchGroupUserReports),
/* harmony export */   "getEventEnvironment": () => (/* binding */ getEventEnvironment),
/* harmony export */   "getGroupMostRecentActivity": () => (/* binding */ getGroupMostRecentActivity),
/* harmony export */   "getGroupReprocessingStatus": () => (/* binding */ getGroupReprocessingStatus),
/* harmony export */   "getSubscriptionReason": () => (/* binding */ getSubscriptionReason),
/* harmony export */   "markEventSeen": () => (/* binding */ markEventSeen)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/orderBy */ "../node_modules/lodash/orderBy.js");
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * Fetches group data and mark as seen
 *
 * @param orgId organization slug
 * @param groupId groupId
 * @param eventId eventId or "latest" or "oldest"
 * @param envNames
 * @param projectId project slug required for eventId that is not latest or oldest
 */
async function fetchGroupEvent(api, orgId, groupId, eventId, envNames, projectId) {
  const url = eventId === 'latest' || eventId === 'oldest' ? `/issues/${groupId}/events/${eventId}/` : `/projects/${orgId}/${projectId}/events/${eventId}/`;
  const query = {};

  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  const data = await api.requestPromise(url, {
    query
  });
  return data;
}
function markEventSeen(api, orgId, projectId, groupId) {
  (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__.bulkUpdate)(api, {
    orgId,
    projectId,
    itemIds: [groupId],
    failSilently: true,
    data: {
      hasSeen: true
    }
  }, {});
}
function fetchGroupUserReports(groupId, query) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_3__.Client();
  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query
  });
}
/**
 * Returns the environment name for an event or null
 *
 * @param event
 */

function getEventEnvironment(event) {
  const tag = event.tags.find(_ref => {
    let {
      key
    } = _ref;
    return key === 'environment';
  });
  return tag ? tag.value : null;
}
const SUBSCRIPTION_REASONS = {
  commented: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have commented on this issue."),
  assigned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you were assigned to this issue."),
  bookmarked: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have bookmarked this issue."),
  changed_status: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have changed the status of this issue."),
  mentioned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have been mentioned in this issue.")
};
/**
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */

function getSubscriptionReason(group) {
  let removeLinks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('You have [link:disabled workflow notifications] for this project.', {
      link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
        href: "/account/settings/notifications/"
      })
    });
  }

  if (!group.isSubscribed) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {
      reason
    } = group.subscriptionDetails;

    if (reason === 'unknown') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you are subscribed to this issue.");
    }

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)("You're receiving updates because you are [link:subscribed to workflow notifications] for this project.", {
    link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
      href: "/account/settings/notifications/"
    })
  });
}
function getGroupMostRecentActivity(activities) {
  // Most recent activity
  return lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default()([...activities], _ref2 => {
    let {
      dateCreated
    } = _ref2;
    return new Date(dateCreated);
  }, ['desc'])[0];
}
let ReprocessingStatus; // Reprocessing Checks

(function (ReprocessingStatus) {
  ReprocessingStatus["REPROCESSED_AND_HASNT_EVENT"] = "reprocessed_and_hasnt_event";
  ReprocessingStatus["REPROCESSED_AND_HAS_EVENT"] = "reprocessed_and_has_event";
  ReprocessingStatus["REPROCESSING"] = "reprocessing";
  ReprocessingStatus["NO_STATUS"] = "no_status";
})(ReprocessingStatus || (ReprocessingStatus = {}));

function getGroupReprocessingStatus(group, mostRecentActivity) {
  const {
    status,
    count,
    activity: activities
  } = group;
  const groupCount = Number(count);

  switch (status) {
    case 'reprocessing':
      return ReprocessingStatus.REPROCESSING;

    case 'unresolved':
      {
        const groupMostRecentActivity = mostRecentActivity !== null && mostRecentActivity !== void 0 ? mostRecentActivity : getGroupMostRecentActivity(activities);

        if ((groupMostRecentActivity === null || groupMostRecentActivity === void 0 ? void 0 : groupMostRecentActivity.type) === 'reprocess') {
          if (groupCount === 0) {
            return ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT;
          }

          return ReprocessingStatus.REPROCESSED_AND_HAS_EVENT;
        }

        return ReprocessingStatus.NO_STATUS;
      }

    default:
      return ReprocessingStatus.NO_STATUS;
  }
}

/***/ }),

/***/ "../node_modules/lodash/orderBy.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/orderBy.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseOrderBy = __webpack_require__(/*! ./_baseOrderBy */ "../node_modules/lodash/_baseOrderBy.js"),
    isArray = __webpack_require__(/*! ./isArray */ "../node_modules/lodash/isArray.js");

/**
 * This method is like `_.sortBy` except that it allows specifying the sort
 * orders of the iteratees to sort by. If `orders` is unspecified, all values
 * are sorted in ascending order. Otherwise, specify an order of "desc" for
 * descending or "asc" for ascending sort order of corresponding values.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
 *  The iteratees to sort by.
 * @param {string[]} [orders] The sort orders of `iteratees`.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {Array} Returns the new sorted array.
 * @example
 *
 * var users = [
 *   { 'user': 'fred',   'age': 48 },
 *   { 'user': 'barney', 'age': 34 },
 *   { 'user': 'fred',   'age': 40 },
 *   { 'user': 'barney', 'age': 36 }
 * ];
 *
 * // Sort by `user` in ascending order and by `age` in descending order.
 * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
 * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
 */
function orderBy(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (!isArray(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  orders = guard ? undefined : orders;
  if (!isArray(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseOrderBy(collection, iteratees, orders);
}

module.exports = orderBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupUserFeedback_tsx.4d7559d0657fbef5f3320e5207a72ebd.js.map