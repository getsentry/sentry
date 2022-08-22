"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupMerged_index_tsx"],{

/***/ "./app/views/organizationGroupDetails/groupMerged/index.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupMerged/index.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupMergedView": () => (/* binding */ GroupMergedView),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/groupingActions */ "./app/actions/groupingActions.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _mergedList__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./mergedList */ "./app/views/organizationGroupDetails/groupMerged/mergedList.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















class GroupMergedView extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      mergedItems: [],
      loading: true,
      error: false,
      query: this.props.location.query.query || ''
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupingChange", _ref => {
      let {
        mergedItems,
        mergedLinks,
        loading,
        error
      } = _ref;

      if (mergedItems) {
        this.setState({
          mergedItems,
          mergedLinks,
          loading: typeof loading !== 'undefined' ? loading : false,
          error: typeof error !== 'undefined' ? error : false
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_10__["default"].listen(this.onGroupingChange, undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__["default"].fetch([{
        endpoint: this.getEndpoint(),
        dataKey: 'merged',
        queryParams: this.props.location.query
      }]);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleUnmerge", () => {
      sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__["default"].unmerge({
        groupId: this.props.params.groupId,
        loadingMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unmerging events\u2026'),
        successMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Events successfully queued for unmerging.'),
        errorMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to queue events for unmerging.')
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId || nextProps.location.search !== this.props.location.search) {
      const queryParams = nextProps.location.query;
      this.setState({
        query: queryParams.query
      }, this.fetchData);
    }
  }

  componentWillUnmount() {
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_11__.callIfFunction)(this.listener);
  }

  getEndpoint() {
    const {
      params,
      location
    } = this.props;
    const {
      groupId
    } = params;
    const queryParams = { ...location.query,
      limit: 50,
      query: this.state.query
    };
    return `/issues/${groupId}/hashes/?${query_string__WEBPACK_IMPORTED_MODULE_3__.stringify(queryParams)}`;
  }

  render() {
    const {
      project,
      params
    } = this.props;
    const {
      groupId
    } = params;
    const {
      loading: isLoading,
      error,
      mergedItems,
      mergedLinks
    } = this.state;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_6__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_5__["default"], {
          type: "warning",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This is an experimental feature. Data may not be immediately available while we process unmerges.')
        }), isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {}), isError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_7__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to load merged events, please try again later'),
          onRetry: this.fetchData
        }), isLoadedSuccessfully && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(_mergedList__WEBPACK_IMPORTED_MODULE_13__["default"], {
          project: project,
          fingerprints: mergedItems,
          pageLinks: mergedLinks,
          groupId: groupId,
          onUnmerge: this.handleUnmerge,
          onToggleCollapse: sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__["default"].toggleCollapseFingerprints
        })]
      })
    });
  }

}

GroupMergedView.displayName = "GroupMergedView";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_12__["default"])(GroupMergedView));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupMerged/mergedItem.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupMerged/mergedItem.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actions/groupingActions */ "./app/actions/groupingActions.tsx");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/eventOrGroupHeader */ "./app/components/eventOrGroupHeader.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












class MergedItem extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      collapsed: false,
      checked: false,
      busy: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_9__["default"].listen(data => this.onGroupChange(data), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupChange", _ref => {
      let {
        unmergeState
      } = _ref;

      if (!unmergeState) {
        return;
      }

      const {
        fingerprint
      } = this.props;
      const stateForId = unmergeState.has(fingerprint.id) ? unmergeState.get(fingerprint.id) : undefined;

      if (!stateForId) {
        return;
      }

      Object.keys(stateForId).forEach(key => {
        if (stateForId[key] === this.state[key]) {
          return;
        }

        this.setState(prevState => ({ ...prevState,
          [key]: stateForId[key]
        }));
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleEvents", () => {
      const {
        fingerprint
      } = this.props;
      sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__["default"].toggleCollapseFingerprint(fingerprint.id);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggle", () => {
      const {
        fingerprint
      } = this.props;
      const {
        latestEvent
      } = fingerprint;

      if (this.state.busy) {
        return;
      } // clicking anywhere in the row will toggle the checkbox


      sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_4__["default"].toggleUnmerge([fingerprint.id, latestEvent.id]);
    });
  }

  // Disable default behavior of toggling checkbox
  handleLabelClick(event) {
    event.preventDefault();
  }

  handleCheckClick() {// noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }

  renderFingerprint(id, label) {
    if (!label) {
      return id;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_7__["default"], {
      title: id,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("code", {
        children: label
      })
    });
  }

  render() {
    const {
      fingerprint,
      organization
    } = this.props;
    const {
      latestEvent,
      id,
      label
    } = fingerprint;
    const {
      collapsed,
      busy,
      checked
    } = this.state;
    const checkboxDisabled = busy; // `latestEvent` can be null if last event w/ fingerprint is not within retention period

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(MergedGroup, {
      busy: busy,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(Controls, {
        expanded: !collapsed,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(ActionWrapper, {
          onClick: this.handleToggle,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_5__["default"], {
            id: id,
            value: id,
            checked: checked,
            disabled: checkboxDisabled,
            onChange: this.handleCheckClick
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(FingerprintLabel, {
            onClick: this.handleLabelClick,
            htmlFor: id,
            children: this.renderFingerprint(id, label)
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("div", {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Collapse, {
            onClick: this.handleToggleEvents,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconChevron, {
              direction: collapsed ? 'down' : 'up',
              size: "xs"
            })
          })
        })]
      }), !collapsed && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(MergedEventList, {
        className: "event-list",
        children: latestEvent && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(EventDetails, {
          className: "event-details",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_6__["default"], {
            data: latestEvent,
            organization: organization,
            hideIcons: true,
            hideLevel: true
          })
        })
      })]
    });
  }

}

MergedItem.displayName = "MergedItem";

const MergedGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2itrlr6"
} : 0)(p => p.busy && 'opacity: 0.2', ";" + ( true ? "" : 0));

const ActionWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2itrlr5"
} : 0)("display:grid;grid-auto-flow:column;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";input[type='checkbox']{margin:0;}" + ( true ? "" : 0));

const Controls = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2itrlr4"
} : 0)("display:flex;justify-content:space-between;border-top:1px solid ", p => p.theme.innerBorder, ";background-color:", p => p.theme.backgroundSecondary, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";", p => p.expanded && `border-bottom: 1px solid ${p.theme.innerBorder}`, ";", MergedGroup, "{&:first-child &{border-top:none;}&:last-child &{border-top:none;border-bottom:1px solid ", p => p.theme.innerBorder, ";}}" + ( true ? "" : 0));

const FingerprintLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('label',  true ? {
  target: "e2itrlr3"
} : 0)("font-family:", p => p.theme.text.familyMono, ";",
/* sc-selector */
Controls, " &{font-weight:400;margin:0;}" + ( true ? "" : 0));

const Collapse = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e2itrlr2"
} : 0)( true ? {
  name: "e0dnmk",
  styles: "cursor:pointer"
} : 0);

const MergedEventList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2itrlr1"
} : 0)("overflow:hidden;border:none;background-color:", p => p.theme.background, ";" + ( true ? "" : 0));

const EventDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e2itrlr0"
} : 0)("display:flex;justify-content:space-between;.event-list &{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MergedItem);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupMerged/mergedList.tsx":
/*!***********************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupMerged/mergedList.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/queryCount */ "./app/components/queryCount.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _mergedItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./mergedItem */ "./app/views/organizationGroupDetails/groupMerged/mergedItem.tsx");
/* harmony import */ var _mergedToolbar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./mergedToolbar */ "./app/views/organizationGroupDetails/groupMerged/mergedToolbar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function MergedList(_ref) {
  let {
    fingerprints = [],
    pageLinks,
    onToggleCollapse,
    onUnmerge,
    organization,
    groupId,
    project
  } = _ref;
  const fingerprintsWithLatestEvent = fingerprints.filter(_ref2 => {
    let {
      latestEvent
    } = _ref2;
    return !!latestEvent;
  });
  const hasResults = fingerprintsWithLatestEvent.length > 0;

  if (!hasResults) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_1__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)("There don't seem to be any hashes for this issue.")
        })
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("h4", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("span", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Merged fingerprints with latest event')
      }), ' ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_queryCount__WEBPACK_IMPORTED_MODULE_4__["default"], {
        count: fingerprintsWithLatestEvent.length
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_mergedToolbar__WEBPACK_IMPORTED_MODULE_8__["default"], {
        onToggleCollapse: onToggleCollapse,
        onUnmerge: onUnmerge,
        orgId: organization.slug,
        project: project,
        groupId: groupId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
        children: fingerprintsWithLatestEvent.map(fingerprint => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_mergedItem__WEBPACK_IMPORTED_MODULE_7__["default"], {
          organization: organization,
          fingerprint: fingerprint
        }, fingerprint.id))
      })]
    }), pageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_2__["default"], {
      pageLinks: pageLinks
    })]
  });
}

MergedList.displayName = "MergedList";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(MergedList));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupMerged/mergedToolbar.tsx":
/*!**************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupMerged/mergedToolbar.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















class MergedToolbar extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_10__["default"].listen(data => this.onGroupChange(data), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupChange", updateObj => {
      const allowedKeys = ['unmergeLastCollapsed', 'unmergeDisabled', 'unmergeList', 'enableFingerprintCompare'];
      this.setState(lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(updateObj, allowedKeys));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleShowDiff", event => {
      const {
        groupId,
        project,
        orgId
      } = this.props;
      const {
        unmergeList
      } = this.state;
      const entries = unmergeList.entries(); // `unmergeList` should only have 2 items in map

      if (unmergeList.size !== 2) {
        return;
      } // only need eventId, not fingerprint


      const [baseEventId, targetEventId] = Array.from(entries).map(_ref => {
        let [, eventId] = _ref;
        return eventId;
      });
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openDiffModal)({
        targetIssueId: groupId,
        project,
        baseIssueId: groupId,
        orgId,
        baseEventId,
        targetEventId
      });
      event.stopPropagation();
    });
  }

  getInitialState() {
    // @ts-ignore GroupingStore types are not correct, store.init dinamically sets these
    const {
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled,
      enableFingerprintCompare
    } = sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_10__["default"];
    return {
      enableFingerprintCompare,
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled
    };
  }

  componentWillUnmount() {
    var _this$listener;

    (_this$listener = this.listener) === null || _this$listener === void 0 ? void 0 : _this$listener.call(this);
  }

  render() {
    const {
      onUnmerge,
      onToggleCollapse
    } = this.props;
    const {
      unmergeList,
      unmergeLastCollapsed,
      unmergeDisabled,
      enableFingerprintCompare
    } = this.state;
    const unmergeCount = unmergeList && unmergeList.size || 0;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelHeader, {
      hasButtons: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__["default"], {
          disabled: unmergeDisabled,
          onConfirm: onUnmerge,
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
            size: "sm",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Unmerging [unmergeCount] events', {
              unmergeCount
            }),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unmerge'), " (", unmergeCount || 0, ")"]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(CompareButton, {
          size: "sm",
          disabled: !enableFingerprintCompare,
          onClick: this.handleShowDiff,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Compare')
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], {
        size: "sm",
        onClick: onToggleCollapse,
        children: unmergeLastCollapsed ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Expand All') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Collapse All')
      })]
    });
  }

}

MergedToolbar.displayName = "MergedToolbar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MergedToolbar);

const CompareButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e9vanab0"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupMerged_index_tsx.27e244437b06e15620622f467e3ed217.js.map